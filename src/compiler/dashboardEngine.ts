export const DASHBOARD_ENGINE_SOURCE = `function createDashboardEngine(config) {
  const state = {
    channels: {},       // what the ESP receives: { channelName: command or number }
    widgets: {},        // current value of every widget on the page
    history: {},        // chart points: { chartId: [numbers] }
    lastSeen: null,     // time of the last request from the ESP
    unknownPath: null,  // last path the ESP asked for that no endpoint serves
  };
  const responseInputs = {};
  const functions = {};

  for (const [id, code] of Object.entries(config.functions)) {
    try {
      functions[id] = new Function('msg', code);
    } catch (err) {
      console.error('[Dashboard] Ошибка в коде ноды Function:', err.message);
    }
  }

  function emit(source, port, value, depth = 0) {
    if (depth > 32) return; // wires form a cycle
    for (const [from, fromPort, to] of config.wires) {
      if (from !== source || fromPort !== port) continue;
      if (to in config.functions) {
        try {
          const result = functions[to] ? functions[to](value) : undefined;
          if (result !== undefined) emit(to, 'result', result, depth + 1);
        } catch (err) {
          console.error('[Dashboard] Ошибка в коде ноды Function:', err.message);
        }
      } else if (to in config.responses) {
        responseInputs[to] = value;
      } else if (to in config.displays) {
        state.widgets[to] = value;
        const display = config.displays[to];
        if (display.kind === 'chart' && Number.isFinite(Number(value))) {
          const points = state.history[to] || (state.history[to] = []);
          points.push(Number(value));
          if (points.length > display.points) points.shift();
        }
      }
    }
  }

  function action(id, value) {
    const control = config.controls[id];
    if (!control) return false;
    if (control.kind === 'switch') {
      const on = value === true;
      const payload = on ? control.on : control.off;
      state.widgets[id] = on;
      state.channels[control.channel] = payload;
      emit(id, 'state', on);
      emit(id, 'payload', payload);
    } else if (control.kind === 'slider') {
      const number = Number(value);
      if (!Number.isFinite(number)) return false;
      state.widgets[id] = number;
      state.channels[control.channel] = number;
      emit(id, 'value', number);
    } else {
      state.channels[control.channel] = control.payload;
      emit(id, 'payload', control.payload);
    }
    return true;
  }

  function request(path, query) {
    const endpoints = config.endpoints.filter((ep) => ep.path === path);
    if (endpoints.length === 0) {
      state.unknownPath = path;
      return null;
    }
    state.lastSeen = Date.now();
    state.unknownPath = null;

    let reply = null;
    for (const ep of endpoints) {
      const raw = query[ep.param];
      if (raw !== undefined) {
        const number = Number(raw);
        emit(ep.id, 'value', raw !== '' && Number.isFinite(number) ? number : raw);
        emit(ep.id, 'raw_query', String(raw));
      }
      const responseId = config.replies[ep.id];
      if (responseId) {
        const response = config.responses[responseId];
        const data = responseInputs[responseId];
        reply = { status: response.status, body: String(data !== undefined ? data : response.text) };
      }
    }
    return reply || { status: 200, body: JSON.stringify(state.channels) };
  }

  for (const [id, control] of Object.entries(config.controls)) {
    if (control.kind === 'switch') action(id, false);
    if (control.kind === 'slider') action(id, control.min);
  }

  return { state, action, request };
}`;

export interface DashboardEngineState {
  channels: Record<string, string | number>;
  widgets: Record<string, any>;
  history: Record<string, number[]>;
  lastSeen: number | null;
  unknownPath: string | null;
}

export interface DashboardEngine {
  state: DashboardEngineState;
  action: (id: string, value?: unknown) => boolean;
  request: (path: string, query: Record<string, string>) => { status: number; body: string } | null;
}

export function createDashboardEngine(config: unknown): DashboardEngine {
  return new Function(`${DASHBOARD_ENGINE_SOURCE}\nreturn createDashboardEngine;`)()(config);
}
