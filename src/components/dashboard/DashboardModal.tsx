import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, Play, RefreshCw, Send, Radio, Check, Copy, ExternalLink, Zap, Plus } from 'lucide-react';
import { useFlowStore } from '../../store/useFlowStore';
import { DashboardCodeGenerator } from '../../compiler/dashboardCodeGenerator';
import { createDashboardEngine } from '../../compiler/dashboardEngine';
import { DASHBOARD_PORT, isDesktopApp, runAction, startDashboardServer, stopDashboardServer, useDashboardServer } from '../../services/dashboardServer';

export const DashboardModal: React.FC = () => {
  const { isDashboardModalOpen, setDashboardModalOpen, nodes, edges, flows, activeFlowId, loadDashboardTemplate } = useFlowStore();
  const activeFlow = flows.find(f => f.id === activeFlowId);

  const [copiedUrl, setCopiedUrl] = useState(false);
  const [testValue, setTestValue] = useState<number>(512);
  const [lastReply, setLastReply] = useState<string>('');
  const [, setRevision] = useState(0);

  const configJson = JSON.stringify(DashboardCodeGenerator.buildConfig(nodes, edges));
  const localEngine = useMemo(() => createDashboardEngine(JSON.parse(configJson)), [configJson]);
  const server = useDashboardServer();
  const engine = server.running && server.engine ? server.engine : localEngine;
  const refresh = () => {
    setLastReply(JSON.stringify(engine.state.channels));
    setRevision(r => r + 1);
  };
  const act = (id: string, value?: unknown) => {
    if (server.running) runAction(id, value);
    else {
      localEngine.action(id, value);
      refresh();
    }
  };
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!server.running) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [server.running]);
  const espOnline = server.running && engine.state.lastSeen !== null && now - engine.state.lastSeen < 10000;
  const widgetValues = engine.state.widgets;
  const chartHistories = engine.state.history;

  const canvasRefs = useRef<Record<string, HTMLCanvasElement | null>>({});

  const dashboardNodes = nodes.filter(n => n.data?.definitionId?.startsWith('dashboard:'));
  const gauges = dashboardNodes.filter(n => n.data?.definitionId === 'dashboard:gauge');
  const charts = dashboardNodes.filter(n => n.data?.definitionId === 'dashboard:chart');
  const buttons = dashboardNodes.filter(n => n.data?.definitionId === 'dashboard:button');
  const switches = dashboardNodes.filter(n => n.data?.definitionId === 'dashboard:switch');
  const sliders = dashboardNodes.filter(n => n.data?.definitionId === 'dashboard:slider');
  const texts = dashboardNodes.filter(n => n.data?.definitionId === 'dashboard:text_display');
  const leds = dashboardNodes.filter(n => n.data?.definitionId === 'dashboard:led_indicator');
  const endpoints = dashboardNodes.filter(n => n.data?.definitionId === 'dashboard:http_endpoint');
  const [testEndpointId, setTestEndpointId] = useState<string>('');
  const endpoint = endpoints.find(n => n.id === testEndpointId) || endpoints[0];

  const endpointPath = endpoint?.data?.properties?.path || '/light';
  const endpointParam = endpoint?.data?.properties?.param_name || 'value';
  const normalizedPath = endpointPath.startsWith('/') ? endpointPath : '/' + endpointPath;
  const host = server.running && server.ip ? server.ip : '<IP_ЭТОГО_ПК>';
  const pageUrl = `http://${host}:${DASHBOARD_PORT}`;
  const sampleUrl = `${pageUrl}${normalizedPath}?${endpointParam}=512`;

  useEffect(() => {
    setLastReply(JSON.stringify(engine.state.channels));
  }, [engine, server.revision]);

  useEffect(() => {
    charts.forEach(ch => {
      const canvas = canvasRefs.current[ch.id];
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      ctx.strokeStyle = '#232936';
      ctx.lineWidth = 1;
      for (let y = 30; y < h; y += 30) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      const points = chartHistories[ch.id] || [];
      if (points.length < 2) return;

      const min = Math.min(...points);
      const max = Math.max(...points);

      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, 'rgba(0, 212, 178, 0.25)');
      grad.addColorStop(1, 'rgba(0, 212, 178, 0.0)');

      ctx.beginPath();
      points.forEach((p, i) => {
        const x = (i / (points.length - 1)) * (w - 20) + 10;
        const y = h - 15 - ((p - min) / (max - min || 1)) * (h - 30);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = '#00D4B2';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      ctx.lineTo((w - 20) + 10, h);
      ctx.lineTo(10, h);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();
    });
  });

  if (!isDashboardModalOpen) return null;

  const handleSimulateTelemetry = (val: number) => {
    setTestValue(val);
    engine.request(normalizedPath, { [endpointParam]: String(val) });
    refresh();
  };

  const copyUrl = () => {
    navigator.clipboard?.writeText(sampleUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-[#12161F] border border-[#2D3748] rounded-xl shadow-2xl w-full max-w-5xl h-[88vh] flex flex-col overflow-hidden text-gray-200">
        <div className="h-14 px-6 border-b border-[#2D3748] bg-[#181C24] flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center font-bold">
              <Zap className="w-4 h-4 text-rose-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                Node-MPY Dashboard
                <span className="text-xs px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-400 border border-teal-500/20 font-mono">
                  {activeFlow?.name || 'Панель управления'}
                </span>
              </h2>
              <p className="text-[11px] text-gray-400">
                {server.running
                  ? 'Сервер запущен: плата и телефон подключаются по адресу ниже'
                  : 'Проверка схемы без платы. Чтобы подключить плату, запустите сервер'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {server.running ? (
              <div
                title="Плата считается подключённой, если выходила на связь за последние 10 секунд"
                className={`flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-mono ${
                  espOnline ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-gray-500/10 border-gray-500/20 text-gray-400'
                }`}
              >
                <span>{espOnline ? 'ESP НА СВЯЗИ' : 'ЖДЁМ ESP'}</span>
              </div>
            ) : (
              <div
                title="Это проверка схемы внутри приложения. Настоящая плата сюда не подключена."
                className="flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-mono"
              >
                <span>СИМУЛЯЦИЯ</span>
              </div>
            )}

            <button
              onClick={() => setDashboardModalOpen(false)}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#242832] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="px-6 py-2.5 bg-[#161A22] border-b border-[#252B38] flex items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-2 text-gray-300 overflow-hidden">
            <Radio className="w-3.5 h-3.5 text-teal-400 flex-shrink-0" />
            <span className="text-gray-400">URL для ESP:</span>
            <code className="text-teal-300 bg-[#0F1115] px-2 py-0.5 rounded border border-[#2D3748] truncate">
              {sampleUrl}
            </code>
            <button
              onClick={copyUrl}
              className="text-gray-400 hover:text-white p-1 hover:bg-[#252B38] rounded transition-colors"
              title="Скопировать URL"
            >
              {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => (server.running ? stopDashboardServer() : startDashboardServer())}
              disabled={!isDesktopApp()}
              title={isDesktopApp() ? '' : 'Сервер работает только в приложении, а не в браузере'}
              className={`px-3 py-1 rounded font-semibold border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                server.running
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/30 hover:bg-rose-500/30'
                  : 'bg-teal-500/20 text-teal-300 border-teal-500/30 hover:bg-teal-500/30'
              }`}
            >
              {server.running ? 'Остановить сервер' : 'Запустить сервер'}
            </button>
            <span className="text-gray-400">Ответ контроллеру:</span>
            <span className="px-2 py-0.5 rounded bg-teal-500/20 text-teal-300 font-bold border border-teal-500/30">
              {lastReply}
            </span>
          </div>
        </div>

        {server.error && (
          <div className="px-6 py-2 bg-rose-500/10 border-b border-rose-500/20 text-rose-300 text-xs">{server.error}</div>
        )}
        {server.running && (
          <div className="px-6 py-2 bg-[#161A22] border-b border-[#252B38] text-xs text-gray-300">
            Страница дашборда для телефона: <code className="text-teal-300">{pageUrl}</code>
            {!server.ip && ' (адрес компьютера определить не удалось, возьмите его из настроек сети)'}. Телефон и компьютер должны быть в одной сети Wi-Fi.
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-gray-700">
          {dashboardNodes.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-gray-300 space-y-4 max-w-lg mx-auto p-4">
              <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
                <Radio className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-white">На полотне дашборда пока нет виджетов</h3>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Дашборд отображает приборы, добавленные на схему (Шкала, График, Переключатель, Кнопка).
                </p>
              </div>

              <div className="w-full bg-[#161A22] border border-[#2D3748] rounded-xl p-4 text-left space-y-2.5 text-xs">
                <span className="font-semibold text-teal-400 flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                  💡 Как связать микроконтроллер и дашборд для любого задания:
                </span>
                <div className="space-y-2 text-gray-300 text-[11px] leading-relaxed">
                  <div className="flex items-start gap-2">
                    <span className="w-4 h-4 rounded-full bg-teal-500/20 text-teal-300 flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">1</span>
                    <span>На вкладке <strong>MicroPython Flow</strong> добавьте ноду <code>Отправка в Дашборд</code> из категории «Сеть». Подключите к ней любые датчики (АЦП, свет, DHT22, термометр).</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-4 h-4 rounded-full bg-teal-500/20 text-teal-300 flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">2</span>
                    <span>Для приёма команд с кнопок используйте выход <code>command</code> и ноду <code>Проверка команды</code> (например <code>FAN_ON</code>, <code>START</code>, <code>RELAY_ON</code>). Для ШИМ/серво используйте число <code>slider_val</code>.</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-4 h-4 rounded-full bg-teal-500/20 text-teal-300 flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">3</span>
                    <span>На вкладке <strong>Dashboard Flow</strong> добавляйте любые кнопки, тумблеры, шкалы и графики — сервер автоматически транслирует команды и данные датчиков в обе стороны!</span>
                  </div>
                </div>
              </div>

              <button
                onClick={loadDashboardTemplate}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition-colors shadow-lg shadow-rose-950/50"
              >
                <Plus className="w-4 h-4" />
                <span>Вставить типовой шаблон (Шкала + График + Переключатель)</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {gauges.map(g => {
                const val = Number(widgetValues[g.id] ?? 0) || 0;
                const min = Number(g.data?.properties?.min ?? 0);
                const max = Number(g.data?.properties?.max ?? 1024);
                const units = g.data?.properties?.units || 'лк';
                const label = g.data?.properties?.label || 'Освещённость';

                const pct = Math.max(0, Math.min(1, (val - min) / (max - min || 1)));
                const angle = -Math.PI + pct * Math.PI;
                const x = 100 + 80 * Math.cos(angle);
                const y = 100 + 80 * Math.sin(angle);
                const strokeColor = pct > 0.8 ? '#EF4444' : pct > 0.5 ? '#F59E0B' : '#00D4B2';

                return (
                  <div key={g.id} className="bg-[#1C2027] border border-[#2D3748] rounded-xl p-5 shadow-lg flex flex-col justify-between">
                    <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
                      {label}
                    </div>
                    <div className="flex flex-col items-center justify-center my-2">
                      <svg className="w-48 h-28" viewBox="0 0 200 120">
                        <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="#2D3748" strokeWidth="16" strokeLinecap="round" />
                        <path d={`M 20 100 A 80 80 0 0 1 ${x} ${y}`} fill="none" stroke={strokeColor} strokeWidth="16" strokeLinecap="round" className="transition-all duration-300" />
                      </svg>
                      <div className="text-3xl font-bold font-mono text-white -mt-3">
                        {Math.round(val)}
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {units} ({min}..{max})
                      </div>
                    </div>
                  </div>
                );
              })}

              {charts.map(c => {
                const label = c.data?.properties?.label || 'График во времени';
                const count = (chartHistories[c.id] || []).length;
                return (
                  <div key={c.id} className="bg-[#1C2027] border border-[#2D3748] rounded-xl p-5 shadow-lg flex flex-col justify-between md:col-span-2">
                    <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
                      <span>{label}</span>
                      <span className="font-mono text-[10px] text-teal-400">{count} точек</span>
                    </div>
                    <canvas
                      ref={el => (canvasRefs.current[c.id] = el)}
                      width={520}
                      height={150}
                      className="w-full h-36 bg-[#13171F] rounded-lg border border-[#232936]"
                    />
                  </div>
                );
              })}

              {switches.map(sw => {
                const label = sw.data?.properties?.label || 'Тумблер';
                const onPayload = sw.data?.properties?.on_payload || 'CMD_ON';
                const offPayload = sw.data?.properties?.off_payload || 'CMD_OFF';
                const isChecked = widgetValues[sw.id] === true;

                const handleToggle = (checked: boolean) => {
                  act(sw.id, checked);
                };

                return (
                  <div key={sw.id} className="bg-[#1C2027] border border-[#2D3748] rounded-xl p-5 shadow-lg flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold text-white">{label}</div>
                      <div className="text-xs text-gray-400 font-mono mt-0.5">
                        Команда: <span className="text-teal-300">{isChecked ? onPayload : offPayload}</span>
                      </div>
                    </div>

                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={e => handleToggle(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-12 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-500" />
                    </label>
                  </div>
                );
              })}

              {buttons.map(b => {
                const label = b.data?.properties?.label || 'Отправить команду';
                const payload = b.data?.properties?.payload || 'CMD_ON';
                const color = b.data?.properties?.button_color || 'teal';

                const btnClasses =
                  color === 'red'
                    ? 'bg-rose-600 hover:bg-rose-500 active:bg-rose-700 shadow-rose-900/30'
                    : color === 'blue'
                    ? 'bg-sky-600 hover:bg-sky-500 active:bg-sky-700 shadow-sky-900/30'
                    : 'bg-teal-600 hover:bg-teal-500 active:bg-teal-700 shadow-teal-900/30';

                return (
                  <div key={b.id} className="bg-[#1C2027] border border-[#2D3748] rounded-xl p-5 shadow-lg flex flex-col justify-between">
                    <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
                      Действие
                    </div>
                    <button
                      onClick={() => {
                        act(b.id);
                      }}
                      className={`w-full py-3 px-4 rounded-lg font-semibold text-white shadow-lg transition-all transform active:scale-95 ${btnClasses}`}
                    >
                      {label}
                    </button>
                    <div className="text-[11px] text-gray-400 text-center font-mono mt-2">
                      Payload: <code className="text-teal-300">{payload}</code>
                    </div>
                  </div>
                );
              })}

              {sliders.map(s => {
                const label = s.data?.properties?.label || 'Регулятор';
                const min = Number(s.data?.properties?.min ?? 0);
                const max = Number(s.data?.properties?.max ?? 1023);
                const step = Number(s.data?.properties?.step ?? 10);
                const val = widgetValues[s.id] ?? min;

                return (
                  <div key={s.id} className="bg-[#1C2027] border border-[#2D3748] rounded-xl p-5 shadow-lg flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-white">{label}</span>
                      <span className="font-mono text-sm font-bold text-teal-300">{val}</span>
                    </div>
                    <input
                      type="range"
                      min={min}
                      max={max}
                      step={step}
                      value={val}
                      onChange={e => {
                        act(s.id, Number(e.target.value));
                      }}
                      className="w-full accent-teal-400 cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-gray-500 font-mono mt-1">
                      <span>{min}</span>
                      <span>{max}</span>
                    </div>
                  </div>
                );
              })}

              {leds.map(l => {
                const label = l.data?.properties?.label || 'Индикатор';
                const colorOn = l.data?.properties?.color_on || '#10B981';
                const raw = widgetValues[l.id];
                const isOn = raw === true || (typeof raw === 'number' && raw !== 0) || (typeof raw === 'string' && /ON$|^1$|^true$/i.test(raw));

                return (
                  <div key={l.id} className="bg-[#1C2027] border border-[#2D3748] rounded-xl p-5 shadow-lg flex items-center gap-4">
                    <div
                      className="w-8 h-8 rounded-full border-2 transition-all duration-300 flex-shrink-0"
                      style={{
                        backgroundColor: isOn ? colorOn : '#374151',
                        borderColor: isOn ? '#fff' : '#4B5563',
                        boxShadow: isOn ? `0 0 16px ${colorOn}` : 'none',
                      }}
                    />
                    <div>
                      <div className="text-sm font-semibold text-white">{label}</div>
                      <div className="text-xs font-mono text-gray-400">
                        {isOn ? 'АКТИВЕН (ON)' : 'ВЫКЛЮЧЕН (OFF)'}
                      </div>
                    </div>
                  </div>
                );
              })}

              {texts.map(t => {
                const label = t.data?.properties?.label || 'Инфо';
                const prefix = t.data?.properties?.prefix || 'Статус: ';
                const val = widgetValues[t.id] ?? 'Ожидание данных...';

                return (
                  <div key={t.id} className="bg-[#1C2027] border border-[#2D3748] rounded-xl p-5 shadow-lg flex flex-col justify-between">
                    <div className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
                      {label}
                    </div>
                    <div className="text-lg font-bold text-sky-400 font-mono">
                      {prefix}{val}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="px-6 py-4 bg-[#141820] border-t border-[#2D3748] flex flex-wrap items-center justify-between gap-4 flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold uppercase tracking-wider text-teal-400 flex items-center gap-1.5">
              <RefreshCw className="w-3.5 h-3.5" />
              Тест датчика (ESP Simulator):
            </span>
            {endpoints.length > 1 && (
              <select
                value={endpoint?.id}
                onChange={e => setTestEndpointId(e.target.value)}
                className="bg-[#1C2027] border border-[#2D3748] rounded px-2 py-1 text-xs font-mono text-white"
              >
                {endpoints.map(ep => (
                  <option key={ep.id} value={ep.id}>
                    {ep.data?.properties?.path} ({ep.data?.properties?.param_name || 'value'})
                  </option>
                ))}
              </select>
            )}
            <input
              type="range"
              min={0}
              max={1024}
              value={testValue}
              onChange={e => handleSimulateTelemetry(Number(e.target.value))}
              className="w-48 accent-teal-400 cursor-pointer"
            />
            <span className="font-mono text-xs text-white bg-[#1C2027] px-2 py-1 rounded border border-[#2D3748]">
              {testValue}
            </span>
            <button
              onClick={() => handleSimulateTelemetry(testValue)}
              className="flex items-center gap-1.5 text-xs px-3 py-1 bg-teal-600 hover:bg-teal-500 active:bg-teal-700 text-white rounded font-medium transition-colors"
            >
              <Send className="w-3 h-3" />
              Отправить в дашборд
            </button>
          </div>

          <div className="text-xs text-gray-400">
            Значение идёт по проводам схемы, как от настоящей ESP
          </div>
        </div>
      </div>
    </div>
  );
};
