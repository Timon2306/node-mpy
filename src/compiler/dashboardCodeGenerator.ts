import { Edge, Node } from '@xyflow/react';
import { NodeInstanceData } from '../types/nodes';
import { LibraryRegistry } from '../registry/registryLoader';

export interface DashboardCompilerResult {
  serverCode: string;
  htmlCode: string;
  widgetsCount: number;
  endpointsCount: number;
}

export class DashboardCodeGenerator {
  /**
   * Generates both TypeScript server code and standalone HTML dashboard
   */
  public static generateCode(nodes: Node<NodeInstanceData>[], edges: Edge[]): DashboardCompilerResult {
    const dashboardNodes = nodes.filter(n => n.data?.definitionId?.startsWith('dashboard:'));
    const widgetsCount = dashboardNodes.filter(n =>
      ['dashboard:gauge', 'dashboard:chart', 'dashboard:button', 'dashboard:switch', 'dashboard:slider', 'dashboard:text_display', 'dashboard:led_indicator'].includes(n.data?.definitionId)
    ).length;
    const endpointsCount = dashboardNodes.filter(n => n.data?.definitionId === 'dashboard:http_endpoint').length;

    const serverCode = this.generateServerTs(nodes, edges);
    const htmlCode = this.generateHtml(nodes, edges);

    return {
      serverCode,
      htmlCode,
      widgetsCount,
      endpointsCount,
    };
  }

  /**
   * Generates readable, self-contained TypeScript server (runs with: npx tsx server.ts / bun server.ts)
   */
  public static generateServerTs(nodes: Node<NodeInstanceData>[], edges: Edge[]): string {
    const dashboardNodes = nodes.filter(n => n.data?.definitionId?.startsWith('dashboard:'));

    // If canvas is empty, return clean, compact 20-line starter template with instructions
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

    const endpoints = nodes.filter(n => n.data?.definitionId === 'dashboard:http_endpoint');
    const buttons = nodes.filter(n => n.data?.definitionId === 'dashboard:button');
    const switches = nodes.filter(n => n.data?.definitionId === 'dashboard:switch');
    const gauges = nodes.filter(n => n.data?.definitionId === 'dashboard:gauge');
    const charts = nodes.filter(n => n.data?.definitionId === 'dashboard:chart');
    const leds = nodes.filter(n => n.data?.definitionId === 'dashboard:led_indicator');

    // Find response logic connected to endpoints
    const endpointConfigs = endpoints.map(ep => {
      const path = (ep.data?.properties?.path || '/light').trim();
      const param = (ep.data?.properties?.param_name || 'value').trim();
      const method = (ep.data?.properties?.method || 'GET').toUpperCase();

      // Find connected nodes
      const outEdges = edges.filter(e => e.source === ep.id);
      const connectedNodeIds = outEdges.map(e => e.target);

      // Check if button/switch command exists
      let defaultCommand = 'OK';
      for (const btn of buttons) {
        if (btn.data?.properties?.payload) {
          defaultCommand = btn.data.properties.payload;
          break;
        }
      }

      return {
        id: ep.id,
        path: path.startsWith('/') ? path : `/${path}`,
        param,
        method,
        defaultCommand,
        connectedNodeIds,
      };
    });

    const lines: string[] = [
      '// =========================================================',
      '// Node-MPY — Сервер дашборда (TypeScript)',
      '// Запуск: npx tsx server.ts  ИЛИ  bun server.ts',
      '// =========================================================\n',
      'import http from "node:http";',
      'import url from "node:url";',
      'import fs from "node:fs";',
      'import path from "node:path";\n',
      'const PORT = 1880;',
      'console.log(`[Node-MPY Dashboard] Запуск сервера на порту ${PORT}...`);\n',
      '// --- 1. СОСТОЯНИЕ ДАШБОРДА И ПЕРЕМЕННЫЕ ---',
      'interface DashboardState {',
      '  lastCommand: string;',
      '  sliderValue: number;',
      '  values: Record<string, number | string | boolean>;',
      '  chartHistory: Record<string, Array<{ time: string; value: number }>>;',
      '}',
      'const state: DashboardState = {',
      '  lastCommand: "CMD_OFF",',
      '  sliderValue: 0,',
      '  values: {},',
      '  chartHistory: {},',
      '};\n',
      '// Список активных SSE-клиентов (браузер дашборда)',
      'const sseClients: http.ServerResponse[] = [];',
      'function broadcastUpdate(data: Record<string, any>) {',
      '  const msg = `data: ${JSON.stringify(data)}\\n\\n`;',
      '  for (let i = sseClients.length - 1; i >= 0; i--) {',
      '    try {',
      '      sseClients[i].write(msg);',
      '    } catch {',
      '      sseClients.splice(i, 1);',
      '    }',
      '  }',
      '}\n',
      '// --- 2. HTTP СЕРВЕР ОБРАБОТКИ ЗАПРОСОВ ---',
      'const server = http.createServer((req, res) => {',
      '  // Включаем CORS для свободного доступа',
      '  res.setHeader("Access-Control-Allow-Origin", "*");',
      '  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");',
      '  res.setHeader("Access-Control-Allow-Headers", "Content-Type");',
      '  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }\n',
      '  const parsed = url.parse(req.url || "/", true);',
      '  const pathname = parsed.pathname || "/";\n',
      '  // 2.1. Поток событий дашборда (Server-Sent Events для живого обновления)',
      '  if (pathname === "/api/events") {',
      '    res.writeHead(200, {',
      '      "Content-Type": "text/event-stream",',
      '      "Cache-Control": "no-cache",',
      '      "Connection": "keep-alive",',
      '    });',
      '    res.write(`data: ${JSON.stringify({ type: "init", state })}\\n\\n`);',
      '    sseClients.push(res);',
      '    req.on("close", () => {',
      '      const idx = sseClients.indexOf(res);',
      '      if (idx !== -1) sseClients.splice(idx, 1);',
      '    });',
      '    return;',
      '  }\n',
      '  // 2.2. Приём действий от кнопок и переключателей дашборда',
      '  if (pathname === "/api/action" && req.method === "POST") {',
      '    let body = "";',
      '    req.on("data", chunk => body += chunk);',
      '    req.on("end", () => {',
      '      try {',
      '        const action = JSON.parse(body || "{}");',
      '        if (action.command) {',
      '          state.lastCommand = String(action.command);',
      '          console.log(`[Dashboard] Команда для ESP: "${state.lastCommand}"`);',
      '        }',
      '        if (action.value !== undefined) {',
      '          state.values[action.id] = action.value;',
      '          if (typeof action.value === "number") state.sliderValue = action.value;',
      '        }',
      '        broadcastUpdate({ type: "action", action, state });',
      '        res.writeHead(200, { "Content-Type": "application/json" });',
      '        res.end(JSON.stringify({ ok: true, state }));',
      '      } catch {',
      '        res.writeHead(400); res.end("Bad JSON");',
      '      }',
      '    });',
      '    return;',
      '  }\n',
    ];

    // Generate endpoints from canvas
    if (endpointConfigs.length === 0) {
      endpointConfigs.push({
        id: 'ep_default',
        path: '/api/data',
        param: 'value',
        method: 'GET',
        defaultCommand: 'CMD_ON',
        connectedNodeIds: [],
      });
    }

    lines.push('  // 2.3. Маршруты интеграции с контроллером ESP (HTTP Endpoints)');
    endpointConfigs.forEach((ep, idx) => {
      lines.push(`  // Маршрут ${idx + 1}: ${ep.method} ${ep.path}`);
      lines.push(`  if (pathname === "${ep.path}" || pathname === "/api/data" || pathname === "/light") {`);
      lines.push(`    const rawVal = parsed.query["${ep.param}"] || parsed.query["value"] || parsed.query["temp"] || "";`);
      lines.push(`    const numVal = Number(rawVal) || 0;`);
      lines.push('    console.log(`[ESP -> Server] ${req.method} ${pathname} => ${JSON.stringify(parsed.query)}`);');
      lines.push(`    state.values["${ep.id}"] = numVal;`);
      lines.push('    Object.assign(state.values, parsed.query);\n');
      if (charts.length > 0) {
        lines.push('    // Добавляем в историю графиков');
        lines.push(`    const nowTime = new Date().toLocaleTimeString();`);
        charts.forEach(ch => {
          lines.push(`    if (!state.chartHistory["${ch.id}"]) state.chartHistory["${ch.id}"] = [];`);
          lines.push(`    state.chartHistory["${ch.id}"].push({ time: nowTime, value: numVal });`);
          lines.push(`    if (state.chartHistory["${ch.id}"].length > 30) state.chartHistory["${ch.id}"].shift();`);
        });
      }
      lines.push('    // Рассылаем обновление в браузер дашборда');
      lines.push('    broadcastUpdate({ type: "telemetry", endpointId: "' + ep.id + '", value: numVal, state });\n');
      lines.push('    // Отправляем ответ контроллеру (активная команда от кнопок/тумблеров/ползунков)');
      lines.push('    res.writeHead(200, { "Content-Type": "text/plain" });');
      lines.push('    res.end(state.lastCommand || String(state.sliderValue ?? "OK"));');
      lines.push('    return;');
      lines.push('  }\n');
    });

    lines.push('  // 2.4. Главная страница дашборда (раздаёт dashboard.html)');
    lines.push('  if (pathname === "/" || pathname === "/dashboard") {');
    lines.push('    const localHtml = path.join(process.cwd(), "dashboard.html");');
    lines.push('    if (fs.existsSync(localHtml)) {');
    lines.push('      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });');
    lines.push('      res.end(fs.readFileSync(localHtml, "utf-8"));');
    lines.push('      return;');
    lines.push('    }');
    lines.push('    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });');
    lines.push('    res.end(FALLBACK_PAGE);');
    lines.push('    return;');
    lines.push('  }\n');
    lines.push('  res.writeHead(404);');
    lines.push('  res.end("Not Found");');
    lines.push('});\n');
    lines.push('server.listen(PORT, () => {');
    lines.push('  console.log(`\\n======================================================`);');
    lines.push('  console.log(`[ГОТОВО] Дашборд открыт:  http://localhost:${PORT}`);');
    const firstEpPath = endpointConfigs[0]?.path || '/light';
    lines.push('  console.log(`[ЭНДПОИНТ ДЛЯ ESP]:     http://<IP_ЭТОГО_ПК>:${PORT}' + firstEpPath + '?value=...`);');
    lines.push('  console.log(`======================================================\\n`);');
    lines.push('});\n');

    lines.push('// Запасная страница (если dashboard.html не лежит в одной папке с server.ts)');
    lines.push('const FALLBACK_PAGE = `<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8"><title>Node-MPY</title><style>body{background:#0F1115;color:#F3F4F6;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}.box{text-align:center;padding:32px 40px;background:#1C2027;border:1px solid #2D3748;border-radius:12px}h2{color:#00D4B2;margin-bottom:8px}p{color:#9CA3AF;font-size:14px}code{background:#12161F;color:#38BDF8;padding:2px 6px;border-radius:4px;font-family:monospace}</style></head><body><div class="box"><h2>Node-MPY Dashboard</h2><p>Поместите файл <code>dashboard.html</code> в одну папку с <code>server.ts</code></p></div></body></html>`;');

    return lines.join('\n');
  }

  /**
   * Generates standalone dark-themed HTML dashboard
   */
  public static generateHtml(nodes: Node<NodeInstanceData>[], edges: Edge[]): string {
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

    const gauges = nodes.filter(n => n.data?.definitionId === 'dashboard:gauge');
    const charts = nodes.filter(n => n.data?.definitionId === 'dashboard:chart');
    const buttons = nodes.filter(n => n.data?.definitionId === 'dashboard:button');
    const switches = nodes.filter(n => n.data?.definitionId === 'dashboard:switch');
    const sliders = nodes.filter(n => n.data?.definitionId === 'dashboard:slider');
    const texts = nodes.filter(n => n.data?.definitionId === 'dashboard:text_display');
    const leds = nodes.filter(n => n.data?.definitionId === 'dashboard:led_indicator');

    return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Node-MPY — Dashboard</title>
  <style>
    :root {
      --bg-canvas: #0F1115;
      --bg-card: #1C2027;
      --bg-card-hover: #242832;
      --border: #2D3748;
      --text-main: #F3F4F6;
      --text-muted: #9CA3AF;
      --accent-teal: #00D4B2;
      --accent-red: #E11D48;
      --accent-green: #10B981;
      --accent-blue: #38BDF8;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    body { background: var(--bg-canvas); color: var(--text-main); min-height: 100vh; padding: 24px; }
    header { display: flex; align-items: center; justify-content: space-between; padding-bottom: 20px; border-bottom: 1px solid var(--border); margin-bottom: 24px; }
    .brand { display: flex; align-items: center; gap: 10px; font-size: 20px; font-weight: 700; }
    .brand span { color: var(--accent-teal); }
    .status-badge { display: flex; align-items: center; gap: 8px; font-size: 12px; background: rgba(16, 185, 129, 0.1); color: var(--accent-green); border: 1px solid rgba(16, 185, 129, 0.3); padding: 4px 12px; rounded: 9999px; border-radius: 9999px; font-family: monospace; }
    .status-badge .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--accent-green); box-shadow: 0 0 8px var(--accent-green); }
    
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 20px; max-width: 1200px; margin: 0 auto; }
    .card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px; padding: 20px; display: flex; flex-col; flex-direction: column; justify-content: space-between; box-shadow: 0 4px 12px rgba(0,0,0,0.3); transition: transform 0.15s ease, border-color 0.15s ease; }
    .card:hover { border-color: #4A5568; }
    .card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
    .card-title { font-size: 14px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; }

    /* Gauge styling */
    .gauge-container { display: flex; flex-direction: column; align-items: center; justify-content: center; position: relative; }
    .gauge-svg { width: 220px; height: 130px; }
    .gauge-val { font-size: 32px; font-weight: 700; color: var(--text-main); font-family: 'Fira Code', monospace; margin-top: -10px; }
    .gauge-unit { font-size: 13px; color: var(--text-muted); }

    /* Button */
    .btn-action { width: 100%; padding: 14px; border: none; border-radius: 8px; font-size: 15px; font-weight: 600; cursor: pointer; color: #fff; background: var(--accent-teal); transition: all 0.15s; box-shadow: 0 4px 12px rgba(0, 212, 178, 0.25); }
    .btn-action:hover { filter: brightness(1.15); transform: translateY(-1px); }
    .btn-action:active { transform: translateY(1px); filter: brightness(0.9); }
    .btn-red { background: var(--accent-red); box-shadow: 0 4px 12px rgba(225, 29, 72, 0.25); }
    .btn-blue { background: var(--accent-blue); box-shadow: 0 4px 12px rgba(56, 189, 248, 0.25); }

    /* Switch */
    .switch-row { display: flex; align-items: center; justify-content: space-between; padding: 8px 0; }
    .switch-label { font-size: 15px; font-weight: 500; }
    .toggle { position: relative; width: 56px; height: 30px; }
    .toggle input { opacity: 0; width: 0; height: 0; }
    .slider-track { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #374151; transition: .3s; border-radius: 30px; }
    .slider-track:before { position: absolute; content: ""; height: 22px; width: 22px; left: 4px; bottom: 4px; background-color: white; transition: .3s; border-radius: 50%; }
    input:checked + .slider-track { background-color: var(--accent-teal); }
    input:checked + .slider-track:before { transform: translateX(26px); }

    /* Canvas chart */
    canvas.chart-canvas { width: 100%; height: 160px; background: #13171F; border-radius: 8px; border: 1px solid #232936; }

    /* LED */
    .led-row { display: flex; align-items: center; gap: 14px; padding: 12px 0; }
    .led-circle { width: 24px; height: 24px; border-radius: 50%; background: #374151; border: 2px solid #4B5563; transition: all 0.3s; }
    .led-circle.active { background: var(--accent-green); border-color: #34D399; box-shadow: 0 0 16px var(--accent-green); }

    .last-cmd-box { margin-top: 24px; padding: 14px; background: #181B21; border-radius: 8px; border: 1px solid var(--border); font-family: monospace; font-size: 13px; display: flex; align-items: center; justify-content: space-between; }
  </style>
</head>
<body>
  <header>
    <div class="brand">
      Node<span>-MPY</span> Dashboard
    </div>
    <div class="status-badge">
      <div class="dot"></div>
      <span id="connStatus">ONLINE • PORT 1880</span>
    </div>
  </header>

  <div class="grid">
    ${gauges.map(g => `
    <div class="card" id="card_${g.id}">
      <div class="card-header">
        <span class="card-title">${g.data?.properties?.label || 'Шкала'}</span>
      </div>
      <div class="gauge-container">
        <svg class="gauge-svg" viewBox="0 0 200 120">
          <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="#2D3748" stroke-width="16" stroke-linecap="round" />
          <path id="gaugeArc_${g.id}" d="M 20 100 A 80 80 0 0 1 20 100" fill="none" stroke="#00D4B2" stroke-width="16" stroke-linecap="round" />
        </svg>
        <div class="gauge-val" id="gaugeVal_${g.id}">0</div>
        <div class="gauge-unit">${g.data?.properties?.units || 'лк'} (0..${g.data?.properties?.max || 1024})</div>
      </div>
    </div>
    `).join('')}

    ${charts.map(c => `
    <div class="card" id="card_${c.id}">
      <div class="card-header">
        <span class="card-title">${c.data?.properties?.label || 'График'}</span>
      </div>
      <canvas class="chart-canvas" id="chart_${c.id}" width="300" height="150"></canvas>
    </div>
    `).join('')}

    ${switches.map(sw => `
    <div class="card" id="card_${sw.id}">
      <div class="card-header">
        <span class="card-title">${sw.data?.properties?.label || 'Переключатель'}</span>
      </div>
      <div class="switch-row">
        <span class="switch-label" id="swLabel_${sw.id}">Состояние: ВЫКЛ</span>
        <label class="toggle">
          <input type="checkbox" id="sw_${sw.id}" onchange="toggleSwitch('${sw.id}', this.checked, '${sw.data?.properties?.on_payload || 'CMD_ON'}', '${sw.data?.properties?.off_payload || 'CMD_OFF'}')">
          <span class="slider-track"></span>
        </label>
      </div>
    </div>
    `).join('')}

    ${sliders.map(sl => `
    <div class="card" id="card_${sl.id}">
      <div class="card-header">
        <span class="card-title">${sl.data?.properties?.label || 'Ползунок'}</span>
        <span id="slVal_${sl.id}" style="font-family: monospace; color: var(--accent-teal); font-weight: 700;">${sl.data?.properties?.min || 0}</span>
      </div>
      <div style="padding: 12px 0;">
        <input type="range" id="sl_${sl.id}" min="${sl.data?.properties?.min || 0}" max="${sl.data?.properties?.max || 1023}" step="${sl.data?.properties?.step || 10}" value="${sl.data?.properties?.min || 0}" style="width: 100%; accent-color: var(--accent-teal); cursor: pointer;" oninput="updateSlider('${sl.id}', this.value)">
      </div>
      <div style="display: flex; justify-content: space-between; font-size: 11px; color: var(--text-muted); font-family: monospace;">
        <span>${sl.data?.properties?.min || 0}</span>
        <span>${sl.data?.properties?.max || 1023}</span>
      </div>
    </div>
    `).join('')}

    ${buttons.map(b => `
    <div class="card" id="card_${b.id}">
      <div class="card-header">
        <span class="card-title">Команда</span>
      </div>
      <button class="btn-action ${b.data?.properties?.button_color === 'red' ? 'btn-red' : b.data?.properties?.button_color === 'blue' ? 'btn-blue' : ''}" onclick="sendButtonAction('${b.id}', '${b.data?.properties?.payload || 'CMD_ON'}')">
        ${b.data?.properties?.label || 'Отправить команду'}
      </button>
    </div>
    `).join('')}

    ${leds.map(l => `
    <div class="card" id="card_${l.id}">
      <div class="card-header">
        <span class="card-title">Индикатор</span>
      </div>
      <div class="led-row">
        <div class="led-circle" id="led_${l.id}"></div>
        <span style="font-weight: 500">${l.data?.properties?.label || 'Светодиод'}</span>
      </div>
    </div>
    `).join('')}

    ${texts.map(t => `
    <div class="card" id="card_${t.id}">
      <div class="card-header">
        <span class="card-title">${t.data?.properties?.label || 'Инфо'}</span>
      </div>
      <div style="font-size: 20px; font-weight: 600; color: #38BDF8;" id="txt_${t.id}">
        ${t.data?.properties?.prefix || ''} Ожидание данных...
      </div>
    </div>
    `).join('')}
  </div>

  <div class="last-cmd-box">
    <span>Активная команда / значение: <strong id="activeCmd" style="color: #00D4B2;">CMD_OFF</strong></span>
    <span style="color: #6B7280;">Порт: 1880 (/api/data)</span>
  </div>

  <script>
    const chartHistories = {};
    function updateGauge(id, val, min = 0, max = 1024) {
      const elVal = document.getElementById('gaugeVal_' + id);
      const elArc = document.getElementById('gaugeArc_' + id);
      if (elVal) elVal.innerText = Math.round(val);
      if (elArc) {
        const clamped = Math.max(min, Math.min(max, val));
        const pct = (clamped - min) / (max - min);
        const angle = -Math.PI + pct * Math.PI;
        const x = 100 + 80 * Math.cos(angle);
        const y = 100 + 80 * Math.sin(angle);
        elArc.setAttribute('d', 'M 20 100 A 80 80 0 0 1 ' + x + ' ' + y);
        elArc.setAttribute('stroke', pct > 0.8 ? '#EF4444' : pct > 0.5 ? '#F59E0B' : '#00D4B2');
      }
    }

    function drawChart(id, points) {
      const canvas = document.getElementById('chart_' + id);
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      // Grid
      ctx.strokeStyle = '#232936';
      ctx.lineWidth = 1;
      for (let y = 30; y < h; y += 30) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      }

      if (!points || points.length < 2) return;
      const vals = points.map(p => p.value);
      const min = Math.min(...vals, 0);
      const max = Math.max(...vals, 1024);

      // Path
      ctx.beginPath();
      ctx.strokeStyle = '#00D4B2';
      ctx.lineWidth = 2.5;
      points.forEach((p, i) => {
        const x = (i / (points.length - 1)) * (w - 20) + 10;
        const y = h - 15 - ((p.value - min) / (max - min || 1)) * (h - 30);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }

    function sendButtonAction(id, cmd) {
      document.getElementById('activeCmd').innerText = cmd;
      fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, command: cmd })
      }).catch(() => {});
    }

    function toggleSwitch(id, checked, onCmd, offCmd) {
      const cmd = checked ? onCmd : offCmd;
      document.getElementById('activeCmd').innerText = cmd;
      const lbl = document.getElementById('swLabel_' + id);
      if (lbl) lbl.innerText = 'Состояние: ' + (checked ? 'ВКЛ' : 'ВЫКЛ');
      fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, value: checked, command: cmd })
      }).catch(() => {});
    }

    function updateSlider(id, val) {
      const lbl = document.getElementById('slVal_' + id);
      if (lbl) lbl.innerText = val;
      document.getElementById('activeCmd').innerText = val;
      fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, value: Number(val), command: String(val) })
      }).catch(() => {});
    }

    // Connect to live updates via Server-Sent Events
    try {
      const evt = new EventSource('/api/events');
      evt.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        if (msg.state?.lastCommand) {
          document.getElementById('activeCmd').innerText = msg.state.lastCommand;
        }
        if (msg.type === 'telemetry') {
          // Update gauges & charts
          ${gauges.map(g => `updateGauge('${g.id}', msg.value);`).join('\n')}
          ${charts.map(c => `
          if (!chartHistories['${c.id}']) chartHistories['${c.id}'] = [];
          chartHistories['${c.id}'].push({ value: msg.value });
          if (chartHistories['${c.id}'].length > 30) chartHistories['${c.id}'].shift();
          drawChart('${c.id}', chartHistories['${c.id}']);
          `).join('\n')}
        }
      };
    } catch {}
  </script>
</body>
</html>`;
  }
}
