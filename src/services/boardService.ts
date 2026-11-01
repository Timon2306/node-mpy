import { create } from 'zustand';
import { CodeGenerator } from '../compiler/codeGenerator';
import { useFlowStore } from '../store/useFlowStore';
import { isDesktopApp } from './dashboardServer';

const driverSources = import.meta.glob('../resources/libs/*.py', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const drivers: Record<string, string> = Object.fromEntries(
  Object.entries(driverSources).map(([path, source]) => [path.split('/').pop()!.replace(/\.py$/, ''), source])
);

const importedModules = (source: string) =>
  [...source.matchAll(/^\s*(?:from|import)\s+([A-Za-z0-9_]+)/gm)].map((m) => m[1]);

export function neededDrivers(code: string): string[] {
  const found = new Set<string>();
  const queue = importedModules(code);
  while (queue.length) {
    const name = queue.pop()!;
    if (!drivers[name] || found.has(name)) continue;
    found.add(name);
    queue.push(...importedModules(drivers[name]));
  }
  return [...found].sort();
}

export function firmwareCode(): string {
  const { flows, activeFlowId, nodes, edges } = useFlowStore.getState();
  const active = flows.find((f) => f.id === activeFlowId);
  if (active && active.mode !== 'dashboard') return CodeGenerator.generateCode(nodes, edges).code;
  const flow = flows.find((f) => f.mode !== 'dashboard');
  return flow ? CodeGenerator.generateCode(flow.nodes, flow.edges).code : '';
}

export interface SerialPortEntry {
  name: string;
  description: string;
  likely_board: boolean;
}

interface BoardState {
  open: boolean;
  ports: SerialPortEntry[];
  port: string;
  busy: boolean;
  log: string[];
  output: string;
  error: string;
}

export const useBoard = create<BoardState>(() => ({
  open: false,
  ports: [],
  port: '',
  busy: false,
  log: [],
  output: '',
  error: '',
}));

const set = useBoard.setState;
const MAX_OUTPUT = 20000;
let listening = false;

async function call<T = void>(command: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<T>(command, args);
}

async function ensureListeners() {
  if (listening) return;
  listening = true;
  const { listen } = await import('@tauri-apps/api/event');
  await listen<string>('flash-progress', (e) => set((s) => ({ log: [...s.log, e.payload] })));
  await listen<string>('serial-data', (e) =>
    set((s) => ({ output: (s.output + e.payload.replace(/\r/g, '')).slice(-MAX_OUTPUT) }))
  );
}

export async function refreshPorts() {
  if (!isDesktopApp()) return;
  try {
    const ports = await call<SerialPortEntry[]>('list_serial_ports');
    const current = useBoard.getState().port;
    const keep = ports.some((p) => p.name === current) ? current : '';
    const guess = keep || (ports.find((p) => p.likely_board) || ports[0])?.name || '';
    set({ ports, port: guess, error: '' });
  } catch (err) {
    set({ error: String(err) });
  }
}

export async function openBoardPanel() {
  set({ open: true });
  await ensureListeners();
  await refreshPorts();
}

export async function closeBoardPanel() {
  await call('serial_monitor_stop').catch(() => undefined);
  set({ open: false });
}

export async function startMonitor() {
  const { port } = useBoard.getState();
  if (!port) return;
  try {
    await call('serial_monitor_start', { port });
    set({ error: '' });
  } catch (err) {
    set({ error: String(err) });
  }
}

export async function flashBoard() {
  const { port } = useBoard.getState();
  if (!port) {
    set({ error: 'Выберите порт платы' });
    return;
  }
  const code = firmwareCode();
  if (!code.trim()) {
    set({ error: 'На вкладке MicroPython нет программы' });
    return;
  }
  set({ busy: true, error: '', log: [], output: '' });
  try {
    await call('serial_monitor_stop');
    const libs = neededDrivers(code);
    const files = [...libs.map((name) => ({ name: `${name}.py`, content: drivers[name] })), { name: 'main.py', content: code }];
    await call('flash_files', { port, files });
    await startMonitor();
  } catch (err) {
    set({ error: String(err) });
  } finally {
    set({ busy: false });
  }
}
