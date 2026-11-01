//! Встроенный сервер дашборда.
//!
//! Принимает HTTP-запросы от платы и браузеров и отдаёт их окну приложения, где работает
//! тот же движок дашборда, что и в экспортируемом server.ts. Ответ окно возвращает командой
//! `dashboard_respond`. Живые обновления страницы (SSE) рассылаются командой `dashboard_publish`.

use std::collections::HashMap;
use std::io::{BufRead, BufReader, Read, Write};
use std::net::{Ipv4Addr, SocketAddr, TcpListener, TcpStream, UdpSocket};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{mpsc, Arc, Mutex};
use std::thread;
use std::time::Duration;

use tauri::{AppHandle, Emitter, State};

const MAX_BODY: usize = 64 * 1024;
const REPLY_TIMEOUT: Duration = Duration::from_secs(5);

struct Reply {
    status: u16,
    content_type: String,
    body: String,
}

#[derive(Default)]
struct Shared {
    pending: Mutex<HashMap<u64, mpsc::Sender<Reply>>>,
    sse_clients: Mutex<Vec<TcpStream>>,
    last_state: Mutex<String>,
    next_id: AtomicU64,
}

struct Running {
    stop: Arc<AtomicBool>,
    port: u16,
}

#[derive(Default)]
pub struct DashboardServer {
    shared: Arc<Shared>,
    running: Mutex<Option<Running>>,
}

fn reason(status: u16) -> &'static str {
    match status {
        200 => "OK",
        204 => "No Content",
        400 => "Bad Request",
        404 => "Not Found",
        504 => "Gateway Timeout",
        _ => "OK",
    }
}

fn write_response(stream: &mut TcpStream, status: u16, content_type: &str, body: &str) {
    let head = format!(
        "HTTP/1.1 {} {}\r\nContent-Type: {}\r\nContent-Length: {}\r\nAccess-Control-Allow-Origin: *\r\nAccess-Control-Allow-Methods: GET, POST, OPTIONS\r\nAccess-Control-Allow-Headers: Content-Type\r\nConnection: close\r\n\r\n",
        status,
        reason(status),
        content_type,
        body.len()
    );
    let _ = stream.write_all(head.as_bytes());
    let _ = stream.write_all(body.as_bytes());
    let _ = stream.flush();
}

fn handle_connection(mut stream: TcpStream, shared: Arc<Shared>, app: AppHandle) {
    let _ = stream.set_read_timeout(Some(Duration::from_secs(5)));
    let mut reader = BufReader::new(match stream.try_clone() {
        Ok(s) => s,
        Err(_) => return,
    });

    let mut request_line = String::new();
    if reader.read_line(&mut request_line).unwrap_or(0) == 0 {
        return;
    }
    let mut parts = request_line.split_whitespace();
    let (method, target) = match (parts.next(), parts.next()) {
        (Some(m), Some(t)) => (m.to_string(), t.to_string()),
        _ => return,
    };

    let mut content_length = 0usize;
    loop {
        let mut line = String::new();
        if reader.read_line(&mut line).unwrap_or(0) == 0 {
            return;
        }
        let line = line.trim_end();
        if line.is_empty() {
            break;
        }
        if let Some((name, value)) = line.split_once(':') {
            if name.eq_ignore_ascii_case("content-length") {
                content_length = value.trim().parse().unwrap_or(0);
            }
        }
    }

    let mut body = vec![0u8; content_length.min(MAX_BODY)];
    if reader.read_exact(&mut body).is_err() {
        body.clear();
    }

    if method == "OPTIONS" {
        write_response(&mut stream, 204, "text/plain", "");
        return;
    }

    let path_only = target.split('?').next().unwrap_or("");

    // Браузер подписывается на обновления: соединение остаётся открытым
    if path_only == "/api/events" {
        let head = "HTTP/1.1 200 OK\r\nContent-Type: text/event-stream\r\nCache-Control: no-cache\r\nAccess-Control-Allow-Origin: *\r\nConnection: keep-alive\r\n\r\n";
        let state = shared.last_state.lock().unwrap().clone();
        let first = format!("data: {}\n\n", if state.is_empty() { "{}" } else { &state });
        if stream.write_all(head.as_bytes()).is_ok() && stream.write_all(first.as_bytes()).is_ok() {
            let _ = stream.set_read_timeout(None);
            shared.sse_clients.lock().unwrap().push(stream);
        }
        return;
    }

    let id = shared.next_id.fetch_add(1, Ordering::SeqCst);
    let (tx, rx) = mpsc::channel();
    shared.pending.lock().unwrap().insert(id, tx);
    let payload = serde_json::json!({
        "id": id,
        "method": method,
        "target": target,
        "body": String::from_utf8_lossy(&body),
    });
    if app.emit("dashboard-request", payload).is_err() {
        shared.pending.lock().unwrap().remove(&id);
        write_response(&mut stream, 504, "text/plain; charset=utf-8", "Окно приложения не отвечает");
        return;
    }

    match rx.recv_timeout(REPLY_TIMEOUT) {
        Ok(reply) => write_response(&mut stream, reply.status, &reply.content_type, &reply.body),
        Err(_) => {
            shared.pending.lock().unwrap().remove(&id);
            write_response(&mut stream, 504, "text/plain; charset=utf-8", "Окно приложения не отвечает");
        }
    }
}

#[tauri::command]
pub fn dashboard_start(app: AppHandle, server: State<'_, DashboardServer>, port: u16) -> Result<u16, String> {
    let mut running = server.running.lock().unwrap();
    if let Some(current) = running.as_ref() {
        return Ok(current.port);
    }

    let listener = TcpListener::bind(SocketAddr::from((Ipv4Addr::UNSPECIFIED, port))).map_err(|e| {
        if e.kind() == std::io::ErrorKind::AddrInUse {
            format!("Порт {} уже занят. Закройте другую программу или запущенный server.ts", port)
        } else {
            format!("Не удалось запустить сервер: {}", e)
        }
    })?;

    let stop = Arc::new(AtomicBool::new(false));
    let stop_flag = stop.clone();
    let shared = server.shared.clone();
    thread::spawn(move || {
        for incoming in listener.incoming() {
            if stop_flag.load(Ordering::SeqCst) {
                break;
            }
            if let Ok(stream) = incoming {
                let shared = shared.clone();
                let app = app.clone();
                thread::spawn(move || handle_connection(stream, shared, app));
            }
        }
    });

    *running = Some(Running { stop, port });
    Ok(port)
}

#[tauri::command]
pub fn dashboard_stop(server: State<'_, DashboardServer>) {
    if let Some(current) = server.running.lock().unwrap().take() {
        current.stop.store(true, Ordering::SeqCst);
        // Пустое подключение будит поток, который ждёт новых соединений
        let _ = TcpStream::connect_timeout(&SocketAddr::from((Ipv4Addr::LOCALHOST, current.port)), Duration::from_millis(500));
    }
    server.shared.sse_clients.lock().unwrap().clear();
    server.shared.pending.lock().unwrap().clear();
    server.shared.last_state.lock().unwrap().clear();
}

#[tauri::command]
pub fn dashboard_respond(server: State<'_, DashboardServer>, id: u64, status: u16, content_type: String, body: String) {
    if let Some(tx) = server.shared.pending.lock().unwrap().remove(&id) {
        let _ = tx.send(Reply { status, content_type, body });
    }
}

#[tauri::command]
pub fn dashboard_publish(server: State<'_, DashboardServer>, state: String) {
    let message = format!("data: {}\n\n", state);
    *server.shared.last_state.lock().unwrap() = state;
    server
        .shared
        .sse_clients
        .lock()
        .unwrap()
        .retain_mut(|client| client.write_all(message.as_bytes()).and_then(|_| client.flush()).is_ok());
}

/// Адрес этого компьютера в локальной сети: его нужно вписать в прошивку платы
#[tauri::command]
pub fn local_ip() -> Result<String, String> {
    let socket = UdpSocket::bind("0.0.0.0:0").map_err(|e| e.to_string())?;
    // UDP connect ничего не отправляет, он только выбирает сетевой интерфейс
    socket.connect("8.8.8.8:80").map_err(|_| "Компьютер не подключён к сети".to_string())?;
    socket.local_addr().map(|a| a.ip().to_string()).map_err(|e| e.to_string())
}
