import { create } from 'zustand';
import { Edge, Node } from '@xyflow/react';
import { CodeGenerator } from '../compiler/codeGenerator';
import { DashboardCodeGenerator } from '../compiler/dashboardCodeGenerator';
import { DashboardEngine, createDashboardEngine } from '../compiler/dashboardEngine';
import { useFlowStore } from '../store/useFlowStore';
import { NodeInstanceData } from '../types/nodes';

export const DASHBOARD_PORT = 1880;

interface DashboardServerState {
  running: boolean;
  port: number;
  ip: string;
  error: string;
  engine: DashboardEngine | null;
  revision: number;
}

export const useDashboardServer = create<DashboardServerState>(() => ({
  running: false,
  port: DASHBOARD_PORT,
  ip: '',
  error: '',
  engine: null,
  revision: 0,
}));

type DashNode = Node<NodeInstanceData>;
interface Schema {
  nodes: DashNode[];
  edges: Edge[];
  configJson: string;
}

let schema: Schema | null = null;
let unlisten: (() => void) | null = null;
let unsubscribeStore: (() => void) | null = null;
let syncTimer: ReturnType<typeof setTimeout> | null = null;

export async function detectLocalIp() {
  if (!isDesktopApp()) return;
  try {
    CodeGenerator.defaultServerIp = await call<string>('local_ip');
    useFlowStore.getState().recalculate();
  } catch {
    return;
  }
}

export const isDesktopApp = () => typeof window !== 'undefined' && Boolean((window as any).__TAURI_INTERNALS__);

function collectSchema(): Schema {
  const { flows, activeFlowId, nodes, edges } = useFlowStore.getState();
  const nodeList: DashNode[] = [];
  const edgeList: Edge[] = [];
  for (const flow of flows) {
    if (flow.mode !== 'dashboard') continue;
    const active = flow.id === activeFlowId;
    nodeList.push(...(active ? nodes : flow.nodes));
    edgeList.push(...(active ? edges : flow.edges));
  }
  return { nodes: nodeList, edges: edgeList, configJson: JSON.stringify(DashboardCodeGenerator.buildConfig(nodeList, edgeList)) };
}

async function call<T = void>(command: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<T>(command, args);
}

const touch = () => useDashboardServer.setState((s) => ({ revision: s.revision + 1 }));

function publish() {
  const engine = useDashboardServer.getState().engine;
  if (engine) void call('dashboard_publish', { state: JSON.stringify(engine.state) });
}

export function runAction(id: string, value?: unknown) {
  const engine = useDashboardServer.getState().engine;
  if (!engine) return;
  engine.action(id, value);
  publish();
  touch();
}

async function handleRequest(req: { id: number; method: string; target: string; body: string }) {
  const { engine } = useDashboardServer.getState();
  const reply = (status: number, contentType: string, body: string) =>
    call('dashboard_respond', { id: req.id, status, contentType, body });
  if (!engine || !schema) return reply(503, 'text/plain; charset=utf-8', 'Сервер остановлен');

  const url = new URL(req.target, 'http://localhost');
  const pathname = url.pathname;
  const text = 'text/plain; charset=utf-8';

  if (pathname === '/favicon.ico') return reply(204, text, '');

  if (pathname === '/api/action' && req.method === 'POST') {
    try {
      const { id, value } = JSON.parse(req.body || '{}');
      const ok = engine.action(id, value);
      publish();
      touch();
      return reply(ok ? 200 : 400, 'application/json', JSON.stringify({ ok }));
    } catch {
      return reply(400, text, 'Bad JSON');
    }
  }

  if (pathname === '/' || pathname === '/dashboard') {
    return reply(200, 'text/html; charset=utf-8', DashboardCodeGenerator.generateHtml(schema.nodes, schema.edges));
  }

  const config = JSON.parse(schema.configJson) as { endpoints: { path: string; param: string }[] };
  const query: Record<string, string> = Object.fromEntries(url.searchParams);
  if (req.method === 'POST') {
    try {
      const parsed = JSON.parse(req.body);
      if (parsed && typeof parsed === 'object') Object.assign(query, parsed);
      else for (const ep of config.endpoints) if (ep.path === pathname) query[ep.param] ??= String(parsed);
    } catch {
      for (const ep of config.endpoints) if (ep.path === pathname) query[ep.param] ??= req.body;
    }
  }

  const result = engine.request(pathname, query);
  publish();
  touch();
  if (!result) return reply(404, text, 'Not Found');
  return reply(result.status, text, result.body);
}

function watchSchema() {
  unsubscribeStore = useFlowStore.subscribe(() => {
    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = setTimeout(() => {
      const next = collectSchema();
      if (!schema || next.configJson === schema.configJson) {
        if (schema) schema = next;
        return;
      }
      schema = next;
      useDashboardServer.setState({ engine: createDashboardEngine(JSON.parse(next.configJson)) });
      publish();
      touch();
    }, 200);
  });
}

export async function startDashboardServer(): Promise<void> {
  if (!isDesktopApp()) {
    useDashboardServer.setState({ error: 'Сервер работает только в приложении, а не в браузере' });
    return;
  }
  schema = collectSchema();
  try {
    const port = await call<number>('dashboard_start', { port: DASHBOARD_PORT });
    const ip = await call<string>('local_ip').catch(() => '');
    const { listen } = await import('@tauri-apps/api/event');
    unlisten = await listen<{ id: number; method: string; target: string; body: string }>('dashboard-request', (event) => {
      void handleRequest(event.payload);
    });
    useDashboardServer.setState({
      running: true,
      port,
      ip,
      error: '',
      engine: createDashboardEngine(JSON.parse(schema.configJson)),
    });
    watchSchema();
    publish();
  } catch (err) {
    useDashboardServer.setState({ running: false, error: String(err) });
  }
}

export async function stopDashboardServer(): Promise<void> {
  unlisten?.();
  unlisten = null;
  unsubscribeStore?.();
  unsubscribeStore = null;
  if (syncTimer) clearTimeout(syncTimer);
  schema = null;
  await call('dashboard_stop').catch(() => undefined);
  useDashboardServer.setState({ running: false, engine: null, error: '' });
}
