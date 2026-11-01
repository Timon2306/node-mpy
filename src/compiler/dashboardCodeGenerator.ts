import { Edge, Node } from '@xyflow/react';
import { NodeInstanceData } from '../types/nodes';
import { DASHBOARD_ENGINE_SOURCE } from './dashboardEngine';

export interface DashboardCompilerResult {
  serverCode: string;
  htmlCode: string;
  widgetsCount: number;
  endpointsCount: number;
  nodeWarnings: Record<string, string>;
}

export interface DashboardConfig {
  endpoints: Array<{ id: string; path: string; param: string }>;
  controls: Record<string, { kind: 'switch' | 'slider' | 'button'; channel: string; on?: string; off?: string; payload?: string; min?: number }>;
  functions: Record<string, string>;
  displays: Record<string, { kind: 'gauge' | 'chart' | 'text' | 'led'; points?: number }>;
  responses: Record<string, { text: string; status: number }>;
  wires: Array<[string, string, string, string]>;
  replies: Record<string, string>;
}

type DashNode = Node<NodeInstanceData>;

const DISPLAY_KINDS: Record<string, 'gauge' | 'chart' | 'text' | 'led'> = {
  'dashboard:gauge': 'gauge',
  'dashboard:chart': 'chart',
  'dashboard:text_display': 'text',
  'dashboard:led_indicator': 'led',
};

const FLOW_PORTS = new Set(['flow_in', 'flow_out']);

const ofType = (nodes: DashNode[], definitionId: string) => nodes.filter(n => n.data?.definitionId === definitionId);
const propsOf = (node: DashNode) => node.data?.properties || {};

const escapeHtml = (value: unknown) =>
  String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

const normalizePath = (path: unknown) => {
  const trimmed = String(path || '/light').trim();
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
};

export class DashboardCodeGenerator {
  public static generateCode(nodes: DashNode[], edges: Edge[]): DashboardCompilerResult {
    const dashboardNodes = nodes.filter(n => n.data?.definitionId?.startsWith('dashboard:'));
    const config = this.buildConfig(nodes, edges);

    return {
      serverCode: this.generateServerTs(nodes, edges),
      htmlCode: this.generateHtml(nodes, edges),
      widgetsCount: Object.keys(config.displays).length + Object.keys(config.controls).length,
      endpointsCount: dashboardNodes.filter(n => n.data?.definitionId === 'dashboard:http_endpoint').length,
      nodeWarnings: this.collectNodeWarnings(nodes, edges, config),
    };
  }

  public static buildConfig(nodes: DashNode[], edges: Edge[]): DashboardConfig {
    const endpoints = ofType(nodes, 'dashboard:http_endpoint');
    const responses = ofType(nodes, 'dashboard:http_response');

    const channelFor = (node: DashNode, autoName: string) => String(propsOf(node).channel || '').trim() || autoName;

    const controls: DashboardConfig['controls'] = {};
    ofType(nodes, 'dashboard:switch').forEach((node, i) => {
      const p = propsOf(node);
      controls[node.id] = { kind: 'switch', channel: channelFor(node, `switch${i + 1}`), on: String(p.on_payload ?? 'CMD_ON'), off: String(p.off_payload ?? 'CMD_OFF') };
    });
    ofType(nodes, 'dashboard:slider').forEach((node, i) => {
      controls[node.id] = { kind: 'slider', channel: channelFor(node, `slider${i + 1}`), min: Number(propsOf(node).min ?? 0) };
    });
    ofType(nodes, 'dashboard:button').forEach(node => {
      controls[node.id] = { kind: 'button', channel: channelFor(node, 'buttons'), payload: String(propsOf(node).payload ?? 'CMD_ON') };
    });

    const functions: DashboardConfig['functions'] = {};
    ofType(nodes, 'dashboard:function').forEach(node => {
      functions[node.id] = String(propsOf(node).code ?? 'return msg;');
    });

    const displays: DashboardConfig['displays'] = {};
    for (const node of nodes) {
      const kind = DISPLAY_KINDS[node.data?.definitionId];
      if (!kind) continue;
      displays[node.id] = kind === 'chart' ? { kind, points: Number(propsOf(node).points ?? 30) } : { kind };
    }

    const responseConfigs: DashboardConfig['responses'] = {};
    responses.forEach(node => {
      const p = propsOf(node);
      responseConfigs[node.id] = { text: String(p.default_text ?? 'OK'), status: Number(p.status_code ?? 200) };
    });

    const known = new Set(nodes.map(n => n.id));
    const wires = edges
      .filter(e => known.has(e.source) && known.has(e.target) && !FLOW_PORTS.has(e.sourceHandle || '') && !FLOW_PORTS.has(e.targetHandle || ''))
      .map((e): [string, string, string, string] => [e.source, e.sourceHandle || '', e.target, e.targetHandle || '']);

    const endpointList = endpoints.map(ep => ({ id: ep.id, path: normalizePath(propsOf(ep).path), param: String(propsOf(ep).param_name || 'value').trim() }));
    const displayPort: Record<string, string> = { gauge: 'value', chart: 'value', text: 'text', led: 'state' };
    for (const node of nodes) {
      const kind = DISPLAY_KINDS[node.data?.definitionId];
      const source = String(propsOf(node).source || '').trim();
      if (!kind || !source || edges.some(e => e.target === node.id)) continue;
      const path = normalizePath(source);
      let endpoint = endpointList.find(ep => ep.path === path && ep.param === 'value');
      if (!endpoint) {
        endpoint = { id: `auto:${source}`, path, param: 'value' };
        endpointList.push(endpoint);
      }
      wires.push([endpoint.id, 'value', node.id, displayPort[kind]]);
    }

    for (const node of nodes) {
      const source = String(propsOf(node).source || '').trim();
      if (!source || !(node.id in controls)) continue;
      const path = normalizePath(source);
      if (!endpointList.some(ep => ep.path === path)) endpointList.push({ id: `auto:${source}`, path, param: 'value' });
    }

    const replies: DashboardConfig['replies'] = {};
    for (const ep of endpoints) {
      const seen = new Set<string>([ep.id]);
      const queue = [ep.id];
      while (queue.length > 0 && !replies[ep.id]) {
        const id = queue.shift()!;
        for (const edge of edges) {
          if (edge.source !== id || edge.sourceHandle !== 'flow_out' || seen.has(edge.target)) continue;
          if (edge.target in responseConfigs) replies[ep.id] = edge.target;
          seen.add(edge.target);
          queue.push(edge.target);
        }
      }
    }

    return {
      endpoints: endpointList,
      controls,
      functions,
      displays,
      responses: responseConfigs,
      wires,
      replies,
    };
  }

  private static collectNodeWarnings(nodes: DashNode[], edges: Edge[], config: DashboardConfig): Record<string, string> {
    const warnings: Record<string, string> = {};
    const wiredIn = (id: string) => edges.some(e => e.target === id);

    for (const id of Object.keys(config.displays)) {
      const source = String(propsOf(nodes.find(n => n.id === id)!).source || '').trim();
      if (!wiredIn(id) && !source) warnings[id] = 'Укажите «Имя показаний» (то же, что в прошивке) или соедините вход с другой нодой';
    }
    for (const id of Object.keys(config.functions)) {
      if (!wiredIn(id)) warnings[id] = 'Функция не получает данных: подключите её вход';
    }
    for (const id of Object.keys(config.responses)) {
      if (!Object.values(config.replies).includes(id)) warnings[id] = 'Ответ не сработает: соедините выход Request у HTTP Endpoint с входом этой ноды';
    }

    const owners = new Map<string, string>();
    for (const [id, control] of Object.entries(config.controls)) {
      const owner = owners.get(control.channel);
      if (owner && !(control.kind === 'button' && config.controls[owner].kind === 'button')) {
        warnings[id] = `Канал "${control.channel}" уже занят другим виджетом, значения будут затирать друг друга`;
      }
      owners.set(control.channel, id);
    }

    for (const node of nodes) {
      if (node.data?.definitionId && !node.data.definitionId.startsWith('dashboard:')) {
        warnings[node.id] = 'На дашборде эта нода не выполняется';
      }
    }
    return warnings;
  }

  public static generateServerTs(nodes: DashNode[], edges: Edge[]): string {
    const dashboardNodes = nodes.filter(n => n.data?.definitionId?.startsWith('dashboard:'));

    if (dashboardNodes.length === 0) {
      return [
        '// =========================================================',
        '// Node-MPY — Сервер дашборда (TypeScript)',
        '// =========================================================\n',
        '// Полотно дашборда пока пусто.',
        '// Добавьте ноды из палитры слева:',
        '// 1. «HTTP Endpoint (In)» — приём данных от микроконтроллера (ESP32)',
        '// 2. «Шкала (Gauge)» или «График (Chart)» — визуализация данных',
        '// 3. «Переключатель (Switch)» или «Кнопка (Button)» — управление реле/светодиодом\n',
        'import http from "node:http";\n',
        'const PORT = 1880;',
        'const server = http.createServer((req, res) => {',
        '  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });',
        '  res.end(`',
        '    <body style="background:#0F1115;color:#E5E7EB;font-family:sans-serif;padding:40px;text-align:center;">',
        '      <h2 style="color:#00D4B2;">Node-MPY Dashboard</h2>',
        '      <p>Полотно дашборда пока пусто. Добавьте ноды на схему для настройки приборов.</p>',
        '    </body>',
        '  `);',
        '});\n',
        'server.listen(PORT, () => {',
        '  console.log(`[Node-MPY] Сервер ожидает добавления нод на http://localhost:${PORT}`);',
        '});',
      ].join('\n');
    }

    const config = this.buildConfig(nodes, edges);
    const firstPath = config.endpoints[0]?.path || '/light';
    const firstParam = config.endpoints[0]?.param || 'value';

    return `import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const PORT = 1880;

const config = ${JSON.stringify(config, null, 2)};

${DASHBOARD_ENGINE_SOURCE.replace(/function createDashboardEngine\(config\)/, 'function createDashboardEngine(config: any): any')}

const engine = createDashboardEngine(config);

const sseClients = new Set<http.ServerResponse>();
function broadcast() {
  const message = \`data: \${JSON.stringify(engine.state)}\\n\\n\`;
  for (const client of sseClients) client.write(message);
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => resolve(body));
  });
}

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

  const url = new URL(req.url || "/", "http://localhost");
  const pathname = url.pathname;

  if (pathname === "/favicon.ico") { res.writeHead(204); res.end(); return; }

  if (pathname === "/api/events") {
    res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive" });
    res.write(\`data: \${JSON.stringify(engine.state)}\\n\\n\`);
    sseClients.add(res);
    req.on("close", () => sseClients.delete(res));
    return;
  }

  if (pathname === "/api/action" && req.method === "POST") {
    try {
      const { id, value } = JSON.parse((await readBody(req)) || "{}");
      const ok = engine.action(id, value);
      broadcast();
      res.writeHead(ok ? 200 : 400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok }));
    } catch {
      res.writeHead(400);
      res.end("Bad JSON");
    }
    return;
  }

  if (pathname === "/" || pathname === "/dashboard") {
    const htmlPath = path.join(process.cwd(), "dashboard.html");
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(fs.existsSync(htmlPath) ? fs.readFileSync(htmlPath, "utf-8") : "Положите dashboard.html в одну папку с server.ts");
    return;
  }

  const query: Record<string, string> = Object.fromEntries(url.searchParams);
  if (req.method === "POST") {
    const body = await readBody(req);
    try {
      const parsed = JSON.parse(body);
      if (parsed && typeof parsed === "object") Object.assign(query, parsed);
      else for (const ep of config.endpoints) if (ep.path === pathname) query[ep.param] ??= String(parsed);
    } catch {
      for (const ep of config.endpoints) if (ep.path === pathname) query[ep.param] ??= body;
    }
  }

  const reply = engine.request(pathname, query);
  broadcast();
  if (!reply) {
    console.log(\`[ESP] Неизвестный путь \${pathname}. Сервер ждёт: \${config.endpoints.map((ep) => ep.path).join(", ") || "нет эндпоинтов"}\`);
    res.writeHead(404);
    res.end("Not Found");
    return;
  }
  console.log(\`[ESP] \${req.method} \${req.url} -> \${reply.body}\`);
  res.writeHead(reply.status, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(reply.body);
});

server.listen(PORT, () => {
  console.log(\`Дашборд:       http://localhost:\${PORT}\`);
  console.log(\`Адрес для ESP: http://<IP_ЭТОГО_ПК>:\${PORT}${firstPath}?${firstParam}=...\`);
});
`;
  }

  public static generateHtml(nodes: DashNode[], edges: Edge[]): string {
    const dashboardNodes = nodes.filter(n => n.data?.definitionId?.startsWith('dashboard:'));
    if (dashboardNodes.length === 0) {
      return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <title>Node-MPY — Dashboard</title>
  <style>
    body { background: #0F1115; color: #F3F4F6; font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
    .box { text-align: center; padding: 40px; background: #1C2027; border: 1px solid #2D3748; border-radius: 12px; }
    h2 { color: #00D4B2; margin-bottom: 8px; }
    p { color: #9CA3AF; font-size: 14px; }
  </style>
</head>
<body>
  <div class="box">
    <h2>Node-MPY Dashboard</h2>
    <p>Полотно дашборда пусто. Добавьте ноды на схему.</p>
  </div>
</body>
</html>`;
    }

    const gauges = ofType(nodes, 'dashboard:gauge');
    const charts = ofType(nodes, 'dashboard:chart');
    const buttons = ofType(nodes, 'dashboard:button');
    const switches = ofType(nodes, 'dashboard:switch');
    const sliders = ofType(nodes, 'dashboard:slider');
    const texts = ofType(nodes, 'dashboard:text_display');
    const leds = ofType(nodes, 'dashboard:led_indicator');

    const card = (title: unknown, body: string) => `
    <section class="card">
      <h2 class="card-title">${escapeHtml(title)}</h2>
      ${body}
    </section>`;

    const widgets = [
      ...gauges.map(g => {
        const p = propsOf(g);
        const min = Number(p.min ?? 0);
        const max = Number(p.max ?? 1024);
        return card(p.label || 'Шкала', `<div class="gauge" data-widget="gauge" data-id="${escapeHtml(g.id)}" data-min="${min}" data-max="${max}">
        <svg viewBox="0 0 200 120" aria-hidden="true">
          <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="#2D3748" stroke-width="16" stroke-linecap="round" />
          <path class="arc" d="M 20 100 A 80 80 0 0 1 20 100" fill="none" stroke="#00D4B2" stroke-width="16" stroke-linecap="round" />
        </svg>
        <div class="gauge-value">—</div>
        <div class="muted">${escapeHtml(p.units ?? '')} (${min}..${max})</div>
      </div>`);
      }),
      ...charts.map(c => card(propsOf(c).label || 'График', `<canvas class="chart" data-widget="chart" data-id="${escapeHtml(c.id)}" width="600" height="220"></canvas>`)),
      ...switches.map(s => card(propsOf(s).label || 'Переключатель', `<div class="row">
        <span class="switch-state" data-id="${escapeHtml(s.id)}">ВЫКЛ</span>
        <label class="toggle"><input type="checkbox" data-widget="switch" data-id="${escapeHtml(s.id)}"><span class="track"></span></label>
      </div>`)),
      ...sliders.map(s => {
        const p = propsOf(s);
        const min = Number(p.min ?? 0);
        const max = Number(p.max ?? 1023);
        return card(p.label || 'Ползунок', `<output class="slider-value" data-id="${escapeHtml(s.id)}">${min}</output>
      <input type="range" data-widget="slider" data-id="${escapeHtml(s.id)}" min="${min}" max="${max}" step="${Number(p.step ?? 10)}" value="${min}">
      <div class="row muted"><span>${min}</span><span>${max}</span></div>`);
      }),
      ...buttons.map(b => {
        const p = propsOf(b);
        const color = ['red', 'blue', 'green'].includes(p.button_color) ? ` btn-${p.button_color}` : '';
        return card('Команда', `<button class="btn${color}" data-widget="button" data-id="${escapeHtml(b.id)}">${escapeHtml(p.label || 'Отправить команду')}</button>`);
      }),
      ...leds.map(l => {
        const p = propsOf(l);
        return card('Индикатор', `<div class="row start">
        <span class="led" data-widget="led" data-id="${escapeHtml(l.id)}" data-color="${escapeHtml(p.color_on || '#10B981')}"></span>
        <span>${escapeHtml(p.label || 'Светодиод')}</span>
      </div>`);
      }),
      ...texts.map(t => {
        const p = propsOf(t);
        return card(p.label || 'Инфо', `<div class="text-value" data-widget="text" data-id="${escapeHtml(t.id)}" data-prefix="${escapeHtml(p.prefix ?? '')}">Ожидание данных...</div>`);
      }),
    ].join('\n');

    return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Node-MPY — Dashboard</title>
  <style>
    :root { --bg: #0F1115; --card: #1C2027; --border: #2D3748; --text: #F3F4F6; --muted: #9CA3AF; --teal: #00D4B2; --red: #E11D48; --green: #10B981; --blue: #0284C7; --amber: #F59E0B; }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    body { background: var(--bg); color: var(--text); min-height: 100vh; padding: 16px; }
    header { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; max-width: 1200px; margin: 0 auto 20px; padding-bottom: 16px; border-bottom: 1px solid var(--border); }
    .brand { font-size: 20px; font-weight: 700; }
    .brand span { color: var(--teal); }
    .badges { display: flex; flex-wrap: wrap; gap: 8px; }
    .badge { font-size: 12px; padding: 4px 12px; border-radius: 9999px; border: 1px solid var(--border); color: var(--muted); }
    .badge.ok { color: var(--green); border-color: var(--green); }
    .badge.bad { color: #FCA5A5; border-color: var(--red); }
    .alert { display: none; max-width: 1200px; margin: 0 auto 20px; padding: 12px 16px; border: 1px solid var(--amber); border-radius: 8px; color: #FDE68A; font-size: 14px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr)); gap: 16px; max-width: 1200px; margin: 0 auto; }
    .card { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 20px; min-width: 0; }
    .card-title { font-size: 13px; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 16px; }
    .muted { font-size: 12px; color: var(--muted); }
    .row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    .row.start { justify-content: flex-start; }
    .gauge { text-align: center; }
    .gauge svg { width: 100%; max-width: 220px; }
    .gauge-value { font-size: 32px; font-weight: 700; font-family: monospace; }
    .chart { display: block; width: 100%; height: 160px; background: #13171F; border: 1px solid #232936; border-radius: 8px; }
    .btn { width: 100%; padding: 14px; border: none; border-radius: 8px; font-size: 15px; font-weight: 600; cursor: pointer; color: #06201C; background: var(--teal); }
    .btn:hover { filter: brightness(1.1); }
    .btn:active { filter: brightness(0.9); }
    .btn-red { background: var(--red); color: #fff; }
    .btn-blue { background: var(--blue); color: #fff; }
    .btn-green { background: var(--green); color: #06201C; }
    .toggle { position: relative; display: inline-block; width: 56px; height: 30px; cursor: pointer; }
    .toggle input { position: absolute; opacity: 0; width: 100%; height: 100%; margin: 0; cursor: pointer; }
    .track { position: absolute; inset: 0; background: #374151; border-radius: 30px; transition: background .2s; pointer-events: none; }
    .track::before { content: ""; position: absolute; width: 22px; height: 22px; left: 4px; top: 4px; background: #fff; border-radius: 50%; transition: transform .2s; }
    input:checked + .track { background: var(--teal); }
    input:checked + .track::before { transform: translateX(26px); }
    input:focus-visible + .track { outline: 2px solid var(--teal); outline-offset: 2px; }
    input[type=range] { width: 100%; accent-color: var(--teal); cursor: pointer; margin: 12px 0 4px; }
    .slider-value { font-size: 24px; font-weight: 700; font-family: monospace; color: var(--teal); }
    .led { width: 24px; height: 24px; flex: none; border-radius: 50%; background: #374151; border: 2px solid #4B5563; transition: all .2s; }
    .text-value { font-size: 20px; font-weight: 600; color: #38BDF8; overflow-wrap: anywhere; }
  </style>
</head>
<body>
  <header>
    <div class="brand">Node<span>-MPY</span> Dashboard</div>
    <div class="badges">
      <span class="badge" id="serverStatus">Подключение к серверу...</span>
      <span class="badge" id="espStatus">ESP: нет данных</span>
    </div>
  </header>
  <div class="alert" id="pathAlert" role="alert"></div>
  <main class="grid">
${widgets}
  </main>

  <script>
    const ESP_TIMEOUT_MS = 10000;
    let state = null;
    let draggingSlider = null;

    const all = (kind) => document.querySelectorAll('[data-widget="' + kind + '"]');
    const send = (id, value) => fetch('/api/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, value }),
    }).catch(() => {});

    function drawGauge(el, value) {
      const min = Number(el.dataset.min), max = Number(el.dataset.max);
      const number = Number(value);
      if (value === undefined || !Number.isFinite(number)) return;
      el.querySelector('.gauge-value').textContent = Math.round(number * 10) / 10;
      const pct = Math.max(0, Math.min(1, (number - min) / (max - min || 1)));
      const angle = -Math.PI + pct * Math.PI;
      const arc = el.querySelector('.arc');
      arc.setAttribute('d', 'M 20 100 A 80 80 0 0 1 ' + (100 + 80 * Math.cos(angle)) + ' ' + (100 + 80 * Math.sin(angle)));
      arc.setAttribute('stroke', pct > 0.8 ? '#EF4444' : pct > 0.5 ? '#F59E0B' : '#00D4B2');
    }

    function drawChart(canvas, points) {
      const ctx = canvas.getContext('2d');
      const w = canvas.width, h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      ctx.strokeStyle = '#232936';
      ctx.lineWidth = 1;
      for (let y = 40; y < h; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
      if (!points || points.length === 0) return;
      const min = Math.min(...points), max = Math.max(...points);
      const range = max - min || 1;
      const yOf = (v) => h - 24 - ((v - min) / range) * (h - 48);
      ctx.fillStyle = '#9CA3AF';
      ctx.font = '13px monospace';
      ctx.fillText(String(max), 6, 16);
      ctx.fillText(String(min), 6, h - 6);
      ctx.strokeStyle = '#00D4B2';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      points.forEach((p, i) => {
        const x = points.length === 1 ? w / 2 : (i / (points.length - 1)) * (w - 20) + 10;
        if (i === 0) ctx.moveTo(x, yOf(p)); else ctx.lineTo(x, yOf(p));
      });
      ctx.stroke();
    }

    function render() {
      if (!state) return;
      const w = state.widgets;
      all('gauge').forEach((el) => drawGauge(el, w[el.dataset.id]));
      all('chart').forEach((el) => drawChart(el, state.history[el.dataset.id]));
      all('text').forEach((el) => {
        if (w[el.dataset.id] !== undefined) el.textContent = el.dataset.prefix + w[el.dataset.id];
      });
      all('led').forEach((el) => {
        const v = w[el.dataset.id];
        const on = v === true || (typeof v === 'number' && v !== 0) || (typeof v === 'string' && /ON$|^1$|^true$/i.test(v));
        el.style.background = on ? el.dataset.color : '';
        el.style.boxShadow = on ? '0 0 16px ' + el.dataset.color : '';
      });
      all('switch').forEach((el) => {
        el.checked = w[el.dataset.id] === true;
        document.querySelector('.switch-state[data-id="' + el.dataset.id + '"]').textContent = el.checked ? 'ВКЛ' : 'ВЫКЛ';
      });
      all('slider').forEach((el) => {
        if (el === draggingSlider || w[el.dataset.id] === undefined) return;
        el.value = w[el.dataset.id];
        document.querySelector('.slider-value[data-id="' + el.dataset.id + '"]').textContent = el.value;
      });
      const alert = document.getElementById('pathAlert');
      alert.style.display = state.unknownPath ? 'block' : 'none';
      alert.textContent = state.unknownPath ? 'ESP обращается к пути ' + state.unknownPath + ', а на схеме нет такого HTTP Endpoint. Проверьте путь в обеих нодах.' : '';
      renderEspStatus();
    }

    function renderEspStatus() {
      const el = document.getElementById('espStatus');
      const online = state && state.lastSeen && Date.now() - state.lastSeen < ESP_TIMEOUT_MS;
      el.textContent = online ? 'ESP на связи' : (state && state.lastSeen ? 'ESP не отвечает' : 'ESP: нет данных');
      el.className = 'badge' + (online ? ' ok' : state && state.lastSeen ? ' bad' : '');
    }

    all('button').forEach((el) => el.addEventListener('click', () => send(el.dataset.id)));
    all('switch').forEach((el) => el.addEventListener('change', () => send(el.dataset.id, el.checked)));
    all('slider').forEach((el) => {
      el.addEventListener('input', () => {
        draggingSlider = el;
        document.querySelector('.slider-value[data-id="' + el.dataset.id + '"]').textContent = el.value;
      });
      el.addEventListener('change', () => {
        draggingSlider = null;
        send(el.dataset.id, Number(el.value));
      });
    });

    const status = document.getElementById('serverStatus');
    const events = new EventSource('/api/events');
    events.onopen = () => { status.textContent = 'Сервер на связи'; status.className = 'badge ok'; };
    events.onerror = () => { status.textContent = 'Нет связи с сервером'; status.className = 'badge bad'; };
    events.onmessage = (e) => { state = JSON.parse(e.data); render(); };
    setInterval(renderEspStatus, 1000);
  </script>
</body>
</html>`;
  }
}
