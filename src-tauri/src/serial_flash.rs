//! Заливка main.py и драйверов на плату по USB и вывод print() платы.
//!
//! Работает через raw REPL MicroPython (Ctrl-A), как BoardyPy: файлы пишутся кусками по 256 байт
//! в виде hex-строк, а между кусками платa вызывает gc.collect(), чтобы хватило памяти ESP8266.

use std::io::{Read, Write};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};
use serialport::{SerialPort, SerialPortType};
use tauri::{AppHandle, Emitter, State};

const BAUD: u32 = 115_200;
const CHUNK: usize = 256;
// Переходники, которые ставят на платы ESP: CH340, CP210x, FTDI, родной USB Espressif
const BOARD_VIDS: [u16; 4] = [0x1A86, 0x10C4, 0x0403, 0x303A];

#[derive(Serialize)]
pub struct PortEntry {
    name: String,
    description: String,
    likely_board: bool,
}

#[derive(Deserialize)]
pub struct FlashFile {
    name: String,
    content: String,
}

#[derive(Default)]
pub struct SerialMonitor {
    stop: Mutex<Option<Arc<AtomicBool>>>,
}

#[tauri::command]
pub fn list_serial_ports() -> Result<Vec<PortEntry>, String> {
    let ports = serialport::available_ports().map_err(|e| e.to_string())?;
    Ok(ports
        .into_iter()
        .map(|p| match p.port_type {
            SerialPortType::UsbPort(usb) => PortEntry {
                description: usb.product.unwrap_or_else(|| format!("USB {:04X}:{:04X}", usb.vid, usb.pid)),
                likely_board: BOARD_VIDS.contains(&usb.vid),
                name: p.port_name,
            },
            _ => PortEntry { description: String::new(), likely_board: false, name: p.port_name },
        })
        .collect())
}

fn open(port: &str) -> Result<Box<dyn SerialPort>, String> {
    let mut serial = serialport::new(port, BAUD)
        .timeout(Duration::from_millis(50))
        .open()
        .map_err(|e| format!("Не удалось открыть {}: {}. Закройте другие программы, которые используют порт (BoardyPy, Thonny)", port, e))?;
    // Сигналы DTR/RTS на многих платах перезагружают контроллер
    let _ = serial.write_data_terminal_ready(false);
    let _ = serial.write_request_to_send(false);
    Ok(serial)
}

fn read_until(serial: &mut Box<dyn SerialPort>, marker: &[u8], timeout: Duration) -> Result<Vec<u8>, String> {
    let deadline = Instant::now() + timeout;
    let mut buf = Vec::new();
    let mut byte = [0u8; 1];
    while Instant::now() < deadline {
        match serial.read(&mut byte) {
            Ok(1) => {
                buf.push(byte[0]);
                if buf.ends_with(marker) {
                    return Ok(buf);
                }
            }
            Ok(_) => {}
            Err(e) if e.kind() == std::io::ErrorKind::TimedOut => {}
            Err(e) => return Err(e.to_string()),
        }
    }
    Err("Плата не отвечает".to_string())
}

fn enter_raw_repl(serial: &mut Box<dyn SerialPort>) -> Result<(), String> {
    for _ in 0..3 {
        let _ = serial.write_all(b"\x03");
        thread::sleep(Duration::from_millis(150));
        let _ = serial.write_all(b"\x03");
        thread::sleep(Duration::from_millis(200));
        let _ = serial.clear(serialport::ClearBuffer::Input);
        let _ = serial.write_all(b"\x01");
        if read_until(serial, b"raw REPL; CTRL-B to exit\r\n>", Duration::from_secs(2)).is_ok() {
            return Ok(());
        }
    }
    Err("Плата не отвечает. Проверьте кабель и выбранный порт, нажмите RESET на плате и попробуйте снова".to_string())
}

/// Выполняет код на плате. Возвращает (вывод, текст ошибки)
fn exec(serial: &mut Box<dyn SerialPort>, code: &str) -> Result<(String, String), String> {
    for part in code.as_bytes().chunks(CHUNK) {
        serial.write_all(part).map_err(|e| e.to_string())?;
        thread::sleep(Duration::from_millis(10));
    }
    serial.write_all(b"\x04").map_err(|e| e.to_string())?;
    read_until(serial, b"OK", Duration::from_secs(5))?;
    let mut out = read_until(serial, b"\x04", Duration::from_secs(20))?;
    let mut err = read_until(serial, b"\x04", Duration::from_secs(20))?;
    out.pop();
    err.pop();
    Ok((String::from_utf8_lossy(&out).trim().to_string(), String::from_utf8_lossy(&err).trim().to_string()))
}

fn exec_checked(serial: &mut Box<dyn SerialPort>, code: &str) -> Result<String, String> {
    let (out, err) = exec(serial, code)?;
    if err.is_empty() {
        Ok(out)
    } else {
        Err(err)
    }
}

fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{:02x}", b)).collect()
}

/// Записывает файл на плату. Если на плате уже лежит файл того же размера, ничего не делает
fn write_file(serial: &mut Box<dyn SerialPort>, name: &str, data: &[u8]) -> Result<bool, String> {
    let same = exec_checked(
        serial,
        &format!(
            "import os\ntry:\n    print(os.stat({:?})[6] == {})\nexcept OSError:\n    print(False)\n",
            name,
            data.len()
        ),
    )?;
    if same == "True" {
        return Ok(false);
    }

    exec_checked(
        serial,
        &format!(
            "import gc\ntry:\n    from ubinascii import unhexlify\nexcept ImportError:\n    from binascii import unhexlify\ngc.collect()\n_f = open({:?}, 'wb')\n",
            name
        ),
    )?;
    for (index, part) in data.chunks(CHUNK).enumerate() {
        let mut code = format!("_f.write(unhexlify('{}'))\n", hex(part));
        if (index + 1) % 8 == 0 {
            code.push_str("gc.collect()\n");
        }
        exec_checked(serial, &code)?;
    }
    exec_checked(serial, "_f.close()\ndel _f\ngc.collect()\n")?;
    Ok(true)
}

fn flash_blocking(app: &AppHandle, port: &str, files: &[FlashFile]) -> Result<String, String> {
    let progress = |message: String| {
        let _ = app.emit("flash-progress", message);
    };

    progress(format!("Подключаюсь к {}...", port));
    let mut serial = open(port)?;
    enter_raw_repl(&mut serial)?;

    let result = (|| -> Result<(), String> {
        for file in files {
            let written = write_file(&mut serial, &file.name, file.content.as_bytes())?;
            progress(if written {
                format!("Записан {}", file.name)
            } else {
                format!("{} уже на плате", file.name)
            });
        }
        Ok(())
    })();

    // Выходим из raw REPL и перезапускаем плату, чтобы сразу выполнился новый main.py
    let _ = serial.write_all(b"\x02");
    thread::sleep(Duration::from_millis(100));
    result?;
    let _ = serial.write_all(b"\x04");
    progress("Плата перезапущена, программа запущена".to_string());
    Ok("OK".to_string())
}

#[tauri::command]
pub async fn flash_files(app: AppHandle, port: String, files: Vec<FlashFile>) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || flash_blocking(&app, &port, &files))
        .await
        .map_err(|e| e.to_string())?
}

/// Показывает всё, что плата печатает через print(), событиями `serial-data`
#[tauri::command]
pub fn serial_monitor_start(app: AppHandle, monitor: State<'_, SerialMonitor>, port: String) -> Result<(), String> {
    let mut slot = monitor.stop.lock().unwrap();
    if let Some(old) = slot.take() {
        old.store(true, Ordering::SeqCst);
        thread::sleep(Duration::from_millis(150));
    }
    let mut serial = open(&port)?;
    let stop = Arc::new(AtomicBool::new(false));
    let flag = stop.clone();
    *slot = Some(stop);

    thread::spawn(move || {
        let mut buf = [0u8; 512];
        while !flag.load(Ordering::SeqCst) {
            match serial.read(&mut buf) {
                Ok(n) if n > 0 => {
                    let _ = app.emit("serial-data", String::from_utf8_lossy(&buf[..n]).to_string());
                }
                Ok(_) => {}
                Err(e) if e.kind() == std::io::ErrorKind::TimedOut => {}
                Err(_) => {
                    let _ = app.emit("serial-data", "\n[порт закрыт или плата отключена]\n".to_string());
                    break;
                }
            }
        }
    });
    Ok(())
}

#[tauri::command]
pub fn serial_monitor_stop(monitor: State<'_, SerialMonitor>) {
    if let Some(stop) = monitor.stop.lock().unwrap().take() {
        stop.store(true, Ordering::SeqCst);
        // Порт освобождается, когда поток дочитает последний кусок
        thread::sleep(Duration::from_millis(150));
    }
}
