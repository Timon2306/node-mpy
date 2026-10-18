import { create } from 'zustand';
import {
  Connection,
  Edge,
  EdgeChange,
  Node,
  NodeChange,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
} from '@xyflow/react';
import { NodeInstanceData, extractImportsFromNode } from '../types/nodes';
import { PaletteCategory } from '../types/registry';
import { NodeMpyProject, NodeTealProject, FlowTab } from '../types/project';
import { arePortsCompatible, PORT_COLORS, getIncompatibleConnectionReason } from '../types/ports';
import { LibraryRegistry } from '../registry/registryLoader';
import { CodeGenerator } from '../compiler/codeGenerator';
import { Language } from '../i18n';

export interface HistorySnapshot {
  nodes: Node<NodeInstanceData>[];
  edges: Edge[];
}

export interface SimLogEntry {
  id: string;
  time: string;
  type: 'boot' | 'info' | 'gpio' | 'time' | 'print' | 'error';
  text: string;
}

export interface VirtualPin {
  mode: 'IN' | 'OUT';
  value: 0 | 1;
  label?: string;
}

export const INITIAL_ESP8266_PINS: Record<number, VirtualPin> = {
  0: { mode: 'IN', value: 1, label: 'D3 (Flash)' },
  2: { mode: 'OUT', value: 1, label: 'D4 (Builtin LED)' },
  4: { mode: 'IN', value: 0, label: 'D2 (SDA)' },
  5: { mode: 'IN', value: 0, label: 'D1 (SCL)' },
  12: { mode: 'IN', value: 0, label: 'D6 (MISO)' },
  13: { mode: 'IN', value: 0, label: 'D7 (MOSI)' },
  14: { mode: 'IN', value: 0, label: 'D5 (SCK)' },
  15: { mode: 'OUT', value: 0, label: 'D8 (CS)' },
  16: { mode: 'OUT', value: 0, label: 'D0 (Wake)' },
};

interface FlowState {
  language: Language;
  flows: FlowTab[];
  activeFlowId: string;
  nodes: Node<NodeInstanceData>[];
  edges: Edge[];
  selectedNodeId: string | null;
  draggedDefinitionId: string | null;
  generatedCode: string;
  activeLibraryIds: string[];
  categories: PaletteCategory[];
  copiedNodes: Node<NodeInstanceData>[];
  copiedEdges: Edge[];
  history: Record<string, { past: HistorySnapshot[]; future: HistorySnapshot[] }>;
  canUndo: boolean;
  canRedo: boolean;
  inspectorTab: 'properties' | 'code';
  connectionToast: string | null;

  // Modals & Panels
  isPaletteModalOpen: boolean;
  isFunctionModalOpen: boolean;
  isShortcutsModalOpen: boolean;
  isAboutModalOpen: boolean;
  isChangelogModalOpen: boolean;
  isSettingsModalOpen: boolean;
  settingsActiveTab: 'general' | 'updates';
  isSimulationOpen: boolean;

  // Simulation State
  isSimRunning: boolean;
  isSimPaused: boolean;
  simSpeed: number;
  simEngineMode: 'visual' | 'wasm';
  activeSimNodeId: string | null;
  errorSimNodeId: string | null;
  simLogs: SimLogEntry[];
  virtualPins: Record<number, VirtualPin>;

  // Actions
  setLanguage: (lang: Language) => void;
  setDraggedDefinitionId: (id: string | null) => void;
  setInspectorTab: (tab: 'properties' | 'code') => void;
  setConnectionToast: (msg: string | null) => void;
  onNodesChange: (changes: NodeChange<Node<NodeInstanceData>>[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => boolean;
  addNode: (definitionId: string, position?: { x: number; y: number }) => void;
  updateNodeProperties: (nodeId: string, properties: Record<string, any>) => void;
  deleteSelectedNode: () => void;
  selectNode: (nodeId: string | null, multi?: boolean) => void;
  selectAllNodes: () => void;
  clearCanvas: () => void;
  recalculate: () => void;
  loadProject: (project: any) => void;
  exportProject: (projectName?: string) => NodeMpyProject;
  loadDemoProject: () => void;

  // Multi-Flow Tab Actions
  addFlow: (name?: string) => void;
  deleteFlow: (flowId: string) => void;
  switchFlow: (flowId: string) => void;
  renameFlow: (flowId: string, newName: string) => void;

  // History Actions (Undo / Redo)
  pushHistory: () => void;
  undo: () => void;
  redo: () => void;

  // Clipboard Actions
  copySelectedNodes: () => void;
  pasteNodes: (position?: { x: number; y: number }) => void;
  duplicateSelectedNodes: () => void;

  // Modal setters
  setPaletteModalOpen: (open: boolean) => void;
  setFunctionModalOpen: (open: boolean) => void;
  setShortcutsModalOpen: (open: boolean) => void;
  setAboutModalOpen: (open: boolean) => void;
  setChangelogModalOpen: (open: boolean) => void;
  setSettingsModalOpen: (open: boolean, tab?: 'general' | 'updates') => void;
  setSettingsActiveTab: (tab: 'general' | 'updates') => void;

  // Simulation Actions
  setSimulationOpen: (open: boolean) => void;
  toggleSimulation: () => void;
  setSimRunning: (running: boolean) => void;
  setSimPaused: (paused: boolean) => void;
  setSimSpeed: (speed: number) => void;
  setSimEngineMode: (mode: 'visual' | 'wasm') => void;
  setActiveSimNodeId: (id: string | null) => void;
  setErrorSimNodeId: (id: string | null) => void;
  addSimLog: (type: SimLogEntry['type'], text: string) => void;
  clearSimLogs: () => void;
  updateVirtualPin: (pin: number, data: Partial<VirtualPin>) => void;
  resetVirtualPins: () => void;
}

const AUTOSAVE_STORAGE_KEY = 'node_mpy_autosave_v1';
const LEGACY_AUTOSAVE_KEY = 'node_teal_autosave_v1';
const savedLang =
  (typeof localStorage !== 'undefined'
    ? ((localStorage.getItem('node_mpy_lang') || localStorage.getItem('node_teal_lang')) as Language)
    : null) || 'ru';

// Helper to load autosaved flows from localStorage or create initial empty Flow 1
const loadAutoSavedState = (): { flows: FlowTab[]; activeFlowId: string } => {
  if (typeof localStorage !== 'undefined') {
    try {
      const raw = localStorage.getItem(AUTOSAVE_STORAGE_KEY) || localStorage.getItem(LEGACY_AUTOSAVE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (Array.isArray(data.flows) && data.flows.length > 0) {
          const sanitizedFlows: FlowTab[] = data.flows.map((f: any, idx: number) => ({
            id: f.id || `flow_${idx + 1}`,
            name: f.name || `Flow ${idx + 1}`,
            nodes: Array.isArray(f.nodes) ? f.nodes : [],
            edges: Array.isArray(f.edges) ? f.edges : [],
          }));
          const activeFlowId = sanitizedFlows.some((f) => f.id === data.activeFlowId)
            ? data.activeFlowId
            : sanitizedFlows[0].id;
          return {
            flows: sanitizedFlows,
            activeFlowId,
          };
        } else if (Array.isArray(data.nodes)) {
          // Backward compatibility for single-flow project format
          const singleFlow: FlowTab = {
            id: 'flow_1',
            name: 'Flow 1',
            nodes: data.nodes || [],
            edges: data.edges || [],
          };
          return {
            flows: [singleFlow],
            activeFlowId: singleFlow.id,
          };
        }
      }
    } catch (e) {
      console.error('Failed to parse auto-saved flows:', e);
    }
  }

  // Default clean start: 1 empty flow tab
  const defaultFlow: FlowTab = {
    id: 'flow_1',
    name: 'Flow 1',
    nodes: [],
    edges: [],
  };
  return {
    flows: [defaultFlow],
    activeFlowId: defaultFlow.id,
  };
};

// Helper to save autosaved flows to localStorage
const saveAutoSavedState = (flows: FlowTab[], activeFlowId: string) => {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(
      AUTOSAVE_STORAGE_KEY,
      JSON.stringify({
        flows,
        activeFlowId,
        timestamp: Date.now(),
      })
    );
  } catch (e) {
    console.error('Failed to auto-save flows:', e);
  }
};

let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;
const saveAutoSavedStateDebounced = (flows: FlowTab[], activeFlowId: string) => {
  if (autoSaveTimer) clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(() => {
    saveAutoSavedState(flows, activeFlowId);
  }, 250);
};

// Helper to synchronize active nodes and edges into the flows array
const syncFlows = (
  flows: FlowTab[],
  activeFlowId: string,
  currentNodes: Node<NodeInstanceData>[],
  currentEdges: Edge[]
): FlowTab[] => {
  return flows.map((f) => {
    if (f.id === activeFlowId) {
      return { ...f, nodes: currentNodes, edges: currentEdges };
    }
    return f;
  });
};

const initialSaved = loadAutoSavedState();
const initialActiveFlow =
  initialSaved.flows.find((f) => f.id === initialSaved.activeFlowId) || initialSaved.flows[0];

export const useFlowStore = create<FlowState>((set, get) => ({
  language: savedLang === 'en' ? 'en' : 'ru',
  flows: initialSaved.flows,
  activeFlowId: initialSaved.activeFlowId,
  nodes: initialActiveFlow.nodes || [],
  edges: initialActiveFlow.edges || [],
  selectedNodeId: null,
  draggedDefinitionId: null,
  generatedCode: '',
  activeLibraryIds: [],
  categories: LibraryRegistry.getPaletteCategories([]),
  copiedNodes: [],
  copiedEdges: [],
  history: {},
  canUndo: false,
  canRedo: false,
  inspectorTab: 'properties',
  connectionToast: null,

  isPaletteModalOpen: false,
  isFunctionModalOpen: false,
  isShortcutsModalOpen: false,
  isAboutModalOpen: false,
  isChangelogModalOpen: false,
  isSettingsModalOpen: false,
  settingsActiveTab: 'general',
  isSimulationOpen: false,

  isSimRunning: false,
  isSimPaused: false,
  simSpeed: 1,
  simEngineMode: 'visual',
  activeSimNodeId: null,
  errorSimNodeId: null,
  simLogs: [],
  virtualPins: { ...INITIAL_ESP8266_PINS },

  setLanguage: (lang) => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('node_mpy_lang', lang);
      localStorage.setItem('node_teal_lang', lang);
    }
    set({ language: lang });
    get().recalculate();
  },

  setDraggedDefinitionId: (id) => set({ draggedDefinitionId: id }),
  setInspectorTab: (tab) => set({ inspectorTab: tab }),
  setConnectionToast: (msg) => set({ connectionToast: msg }),

  setPaletteModalOpen: (open) => set({ isPaletteModalOpen: open }),
  setFunctionModalOpen: (open) => set({ isFunctionModalOpen: open }),
  setShortcutsModalOpen: (open) => set({ isShortcutsModalOpen: open }),
  setAboutModalOpen: (open) => set({ isAboutModalOpen: open }),
  setChangelogModalOpen: (open) => set({ isChangelogModalOpen: open }),
  setSettingsModalOpen: (open, tab) =>
    set({
      isSettingsModalOpen: open,
      ...(tab ? { settingsActiveTab: tab } : {}),
    }),
  setSettingsActiveTab: (tab) => set({ settingsActiveTab: tab }),

  setSimulationOpen: (open) => set({ isSimulationOpen: open }),
  toggleSimulation: () => set((state) => ({ isSimulationOpen: !state.isSimulationOpen })),
  setSimRunning: (running) => set({ isSimRunning: running }),
  setSimPaused: (paused) => set({ isSimPaused: paused }),
  setSimSpeed: (speed) => set({ simSpeed: speed }),
  setSimEngineMode: (mode) => set({ simEngineMode: mode }),
  setActiveSimNodeId: (id) => set({ activeSimNodeId: id }),
  setErrorSimNodeId: (id) => set({ errorSimNodeId: id }),
  addSimLog: (type, text) => {
    const timeStr = new Date().toLocaleTimeString('ru-RU', { hour12: false });
    const newEntry: SimLogEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      time: timeStr,
      type,
      text,
    };
    set((state) => ({
      simLogs: [...state.simLogs.slice(-150), newEntry],
    }));
  },
  clearSimLogs: () => set({ simLogs: [] }),
  updateVirtualPin: (pin, data) =>
    set((state) => ({
      virtualPins: {
        ...state.virtualPins,
        [pin]: { ...state.virtualPins[pin], ...data },
      },
    })),
  resetVirtualPins: () => set({ virtualPins: { ...INITIAL_ESP8266_PINS } }),

  // Multi-Flow Tab Actions
  addFlow: (name) => {
    const { flows } = get();
    const flowNum = flows.length + 1;
    const newFlowId = `flow_${Date.now()}`;
    const newFlowName = name || `Flow ${flowNum}`;
    const newFlow: FlowTab = {
      id: newFlowId,
      name: newFlowName,
      nodes: [],
      edges: [],
    };
    const updatedFlows = [...flows, newFlow];
    saveAutoSavedState(updatedFlows, newFlowId);

    set({
      flows: updatedFlows,
      activeFlowId: newFlowId,
      nodes: [],
      edges: [],
      selectedNodeId: null,
      canUndo: false,
      canRedo: false,
    });
    get().recalculate();
  },

  deleteFlow: (flowId) => {
    const { flows, activeFlowId, nodes, edges, history } = get();
    if (flows.length <= 1) return;

    // Sync current active flow first so counts are accurate
    const syncedFlows = syncFlows(flows, activeFlowId, nodes, edges);
    const targetFlow = syncedFlows.find((f) => f.id === flowId);
    if (!targetFlow) return;

    if (targetFlow.nodes.length > 0) {
      const confirmDelete = window.confirm(
        get().language === 'ru'
          ? `Удалить вкладку "${targetFlow.name}" со всеми её нодами (${targetFlow.nodes.length})?`
          : `Delete flow tab "${targetFlow.name}" with its ${targetFlow.nodes.length} node(s)?`
      );
      if (!confirmDelete) return;
    }

    const updatedFlows = syncedFlows.filter((f) => f.id !== flowId);
    let newActiveId = activeFlowId;
    let newNodes = nodes;
    let newEdges = edges;

    if (activeFlowId === flowId) {
      const currentIndex = syncedFlows.findIndex((f) => f.id === flowId);
      const nextIndex = Math.max(0, currentIndex - 1);
      newActiveId = updatedFlows[nextIndex].id;
      newNodes = JSON.parse(JSON.stringify(updatedFlows[nextIndex].nodes || []));
      newEdges = JSON.parse(JSON.stringify(updatedFlows[nextIndex].edges || []));
    }

    saveAutoSavedState(updatedFlows, newActiveId);

    const updatedHistory = { ...history };
    delete updatedHistory[flowId];
    const targetHistory = updatedHistory[newActiveId] || { past: [], future: [] };

    set({
      flows: updatedFlows,
      activeFlowId: newActiveId,
      nodes: newNodes,
      edges: newEdges,
      history: updatedHistory,
      selectedNodeId: null,
      canUndo: targetHistory.past.length > 0,
      canRedo: targetHistory.future.length > 0,
    });
    get().recalculate();
  },

  switchFlow: (flowId) => {
    const { flows, activeFlowId, nodes, edges, history } = get();
    if (flowId === activeFlowId) return;

    // Save current active flow state first
    const updatedFlows = syncFlows(flows, activeFlowId, nodes, edges);
    const targetFlow = updatedFlows.find((f) => f.id === flowId);
    if (!targetFlow) return;

    saveAutoSavedState(updatedFlows, flowId);

    const targetHistory = history[flowId] || { past: [], future: [] };
    const newNodes = JSON.parse(JSON.stringify(targetFlow.nodes || [])).map((n: any) => ({
      ...n,
      selected: false,
    }));
    const newEdges = JSON.parse(JSON.stringify(targetFlow.edges || []));

    set({
      flows: updatedFlows,
      activeFlowId: flowId,
      nodes: newNodes,
      edges: newEdges,
      selectedNodeId: null,
      canUndo: targetHistory.past.length > 0,
      canRedo: targetHistory.future.length > 0,
    });

    get().recalculate();
  },

  renameFlow: (flowId, newName) => {
    const cleanName = newName.trim();
    if (!cleanName) return;

    const { flows, activeFlowId, nodes, edges } = get();
    const updatedFlows = flows.map((f) => (f.id === flowId ? { ...f, name: cleanName } : f));

    saveAutoSavedState(updatedFlows, activeFlowId);
    set({ flows: updatedFlows });
  },

  // History / Undo / Redo
  pushHistory: () => {
    const { activeFlowId, nodes, edges, history } = get();
    const flowHistory = history[activeFlowId] || { past: [], future: [] };

    const snapshot: HistorySnapshot = {
      nodes: JSON.parse(JSON.stringify(nodes)),
      edges: JSON.parse(JSON.stringify(edges)),
    };

    const newPast = [...flowHistory.past, snapshot].slice(-40);

    set({
      history: {
        ...history,
        [activeFlowId]: {
          past: newPast,
          future: [],
        },
      },
      canUndo: true,
      canRedo: false,
    });
  },

  undo: () => {
    const { activeFlowId, history, nodes, edges, flows } = get();
    const flowHistory = history[activeFlowId] || { past: [], future: [] };
    if (flowHistory.past.length === 0) return;

    const previous = flowHistory.past[flowHistory.past.length - 1];
    const newPast = flowHistory.past.slice(0, flowHistory.past.length - 1);
    const currentSnapshot: HistorySnapshot = {
      nodes: JSON.parse(JSON.stringify(nodes)),
      edges: JSON.parse(JSON.stringify(edges)),
    };
    const newFuture = [currentSnapshot, ...flowHistory.future].slice(0, 40);

    const prevNodes = JSON.parse(JSON.stringify(previous.nodes));
    const prevEdges = JSON.parse(JSON.stringify(previous.edges));
    const updatedFlows = syncFlows(flows, activeFlowId, prevNodes, prevEdges);
    saveAutoSavedState(updatedFlows, activeFlowId);

    set({
      nodes: prevNodes,
      edges: prevEdges,
      flows: updatedFlows,
      history: {
        ...history,
        [activeFlowId]: { past: newPast, future: newFuture },
      },
      selectedNodeId: null,
      canUndo: newPast.length > 0,
      canRedo: true,
    });

    get().recalculate();
  },

  redo: () => {
    const { activeFlowId, history, nodes, edges, flows } = get();
    const flowHistory = history[activeFlowId] || { past: [], future: [] };
    if (flowHistory.future.length === 0) return;

    const next = flowHistory.future[0];
    const newFuture = flowHistory.future.slice(1);
    const currentSnapshot: HistorySnapshot = {
      nodes: JSON.parse(JSON.stringify(nodes)),
      edges: JSON.parse(JSON.stringify(edges)),
    };
    const newPast = [...flowHistory.past, currentSnapshot].slice(-40);

    const nextNodes = JSON.parse(JSON.stringify(next.nodes));
    const nextEdges = JSON.parse(JSON.stringify(next.edges));
    const updatedFlows = syncFlows(flows, activeFlowId, nextNodes, nextEdges);
    saveAutoSavedState(updatedFlows, activeFlowId);

    set({
      nodes: nextNodes,
      edges: nextEdges,
      flows: updatedFlows,
      history: {
        ...history,
        [activeFlowId]: { past: newPast, future: newFuture },
      },
      selectedNodeId: null,
      canUndo: true,
      canRedo: newFuture.length > 0,
    });

    get().recalculate();
  },

  // Clipboard & Duplicate with Connecting Wires
  copySelectedNodes: () => {
    const { nodes, edges, selectedNodeId } = get();
    const selected = nodes.filter((n) => n.selected || n.id === selectedNodeId);
    if (selected.length === 0) return;

    const selectedIds = new Set(selected.map((n) => n.id));
    const connectingEdges = edges.filter(
      (e) => selectedIds.has(e.source) && selectedIds.has(e.target)
    );

    set({
      copiedNodes: JSON.parse(JSON.stringify(selected)),
      copiedEdges: JSON.parse(JSON.stringify(connectingEdges)),
    });
  },

  pasteNodes: (position) => {
    const { copiedNodes, copiedEdges = [], nodes, edges, activeFlowId, flows } = get();
    if (!copiedNodes || copiedNodes.length === 0) return;

    get().pushHistory();

    let minX = Infinity;
    let minY = Infinity;
    copiedNodes.forEach((n) => {
      if (n.position.x < minX) minX = n.position.x;
      if (n.position.y < minY) minY = n.position.y;
    });

    const timestamp = Date.now();
    const idMap = new Map<string, string>();

    const newNodes: Node<NodeInstanceData>[] = copiedNodes.map((oldNode, idx) => {
      const newId = `node_${timestamp}_${idx}_${Math.floor(Math.random() * 1000)}`;
      idMap.set(oldNode.id, newId);

      const targetPos = position
        ? {
            x: Math.round((position.x + (oldNode.position.x - minX)) / 16) * 16,
            y: Math.round((position.y + (oldNode.position.y - minY)) / 16) * 16,
          }
        : {
            x: Math.round((oldNode.position.x + 32) / 16) * 16,
            y: Math.round((oldNode.position.y + 32) / 16) * 16,
          };

      return {
        ...oldNode,
        id: newId,
        position: targetPos,
        selected: true,
        data: JSON.parse(JSON.stringify(oldNode.data)),
      };
    });

    // Recreate inter-node wires with remapped IDs
    const newEdges: Edge[] = copiedEdges
      .filter((e) => idMap.has(e.source) && idMap.has(e.target))
      .map((e, idx) => ({
        ...e,
        id: `edge_${idMap.get(e.source)}_${e.sourceHandle}_to_${idMap.get(e.target)}_${e.targetHandle}_${timestamp}_${idx}`,
        source: idMap.get(e.source)!,
        target: idMap.get(e.target)!,
        selected: false,
      }));

    const existingDeselected = nodes.map((n) => ({ ...n, selected: false }));
    const combinedNodes = [...existingDeselected, ...newNodes];
    const combinedEdges = [...edges, ...newEdges];

    const updatedFlows = syncFlows(flows, activeFlowId, combinedNodes, combinedEdges);
    saveAutoSavedState(updatedFlows, activeFlowId);

    set({
      nodes: combinedNodes,
      edges: combinedEdges,
      flows: updatedFlows,
      selectedNodeId: newNodes.length === 1 ? newNodes[0].id : null,
    });

    get().recalculate();
  },

  duplicateSelectedNodes: () => {
    const { nodes, edges, selectedNodeId, flows, activeFlowId } = get();
    const selected = nodes.filter((n) => n.selected || n.id === selectedNodeId);
    if (selected.length === 0) return;

    get().pushHistory();

    const selectedIds = new Set(selected.map((n) => n.id));
    const connectingEdges = edges.filter(
      (e) => selectedIds.has(e.source) && selectedIds.has(e.target)
    );

    const timestamp = Date.now();
    const idMap = new Map<string, string>();

    const newNodes: Node<NodeInstanceData>[] = selected.map((oldNode, idx) => {
      const newId = `node_${timestamp}_${idx}_${Math.floor(Math.random() * 1000)}`;
      idMap.set(oldNode.id, newId);
      return {
        ...oldNode,
        id: newId,
        position: {
          x: Math.round((oldNode.position.x + 32) / 16) * 16,
          y: Math.round((oldNode.position.y + 32) / 16) * 16,
        },
        selected: true,
        data: JSON.parse(JSON.stringify(oldNode.data)),
      };
    });

    const newEdges: Edge[] = connectingEdges
      .filter((e) => idMap.has(e.source) && idMap.has(e.target))
      .map((e, idx) => ({
        ...e,
        id: `edge_${idMap.get(e.source)}_${e.sourceHandle}_to_${idMap.get(e.target)}_${e.targetHandle}_${timestamp}_${idx}`,
        source: idMap.get(e.source)!,
        target: idMap.get(e.target)!,
        selected: false,
      }));

    const existingDeselected = nodes.map((n) => ({ ...n, selected: false }));
    const combinedNodes = [...existingDeselected, ...newNodes];
    const combinedEdges = [...edges, ...newEdges];

    const updatedFlows = syncFlows(flows, activeFlowId, combinedNodes, combinedEdges);
    saveAutoSavedState(updatedFlows, activeFlowId);

    set({
      nodes: combinedNodes,
      edges: combinedEdges,
      flows: updatedFlows,
      selectedNodeId: newNodes.length === 1 ? newNodes[0].id : null,
    });

    get().recalculate();
  },

  onNodesChange: (changes) => {
    const updatedNodes = applyNodeChanges(changes, get().nodes);
    const { flows, activeFlowId, edges } = get();
    const updatedFlows = syncFlows(flows, activeFlowId, updatedNodes, edges);

    const isOnlyPosition = changes.every((c) => c.type === 'position');
    if (isOnlyPosition) {
      saveAutoSavedStateDebounced(updatedFlows, activeFlowId);
      set({
        nodes: updatedNodes,
        flows: updatedFlows,
      });
      return;
    }

    saveAutoSavedState(updatedFlows, activeFlowId);
    set({
      nodes: updatedNodes,
      flows: updatedFlows,
    });
    get().recalculate();
  },

  onEdgesChange: (changes) => {
    const updatedEdges = applyEdgeChanges(changes, get().edges);
    const { flows, activeFlowId, nodes } = get();
    const updatedFlows = syncFlows(flows, activeFlowId, nodes, updatedEdges);
    saveAutoSavedState(updatedFlows, activeFlowId);

    set({
      edges: updatedEdges,
      flows: updatedFlows,
    });
    get().recalculate();
  },

  onConnect: (connection) => {
    const { nodes, edges, flows, activeFlowId } = get();

    // Validate connection compatibility
    const sourceNode = nodes.find((n) => n.id === connection.source);
    const targetNode = nodes.find((n) => n.id === connection.target);

    if (!sourceNode || !targetNode) return false;

    const sourceDef = LibraryRegistry.getNodeDefinition(sourceNode.data.definitionId);
    const targetDef = LibraryRegistry.getNodeDefinition(targetNode.data.definitionId);

    if (!sourceDef || !targetDef) return false;

    const sourcePort = sourceDef.outputs.find((p) => p.id === connection.sourceHandle);
    const targetPort = targetDef.inputs.find((p) => p.id === connection.targetHandle);

    if (!sourcePort || !targetPort) return false;

    // Strict Socket Type Validation with informative toast notification
    if (!arePortsCompatible(sourcePort.type, targetPort.type)) {
      const reason = getIncompatibleConnectionReason(sourcePort.type, targetPort.type, get().language);
      set({ connectionToast: reason });
      setTimeout(() => {
        if (get().connectionToast === reason) {
          set({ connectionToast: null });
        }
      }, 4000);
      return false;
    }

    get().pushHistory();

    const edgeColor = PORT_COLORS[sourcePort.type] || '#FFFFFF';

    const newEdge: Edge = {
      ...connection,
      id: `edge_${connection.source}_${connection.sourceHandle}_to_${connection.target}_${connection.targetHandle}`,
      type: 'default',
      style: {
        stroke: edgeColor,
        strokeWidth: sourcePort.type === 'flow' ? 2.5 : 2,
      },
      animated: sourcePort.type === 'flow',
    };

    const updatedEdges = addEdge(newEdge, edges);
    const updatedFlows = syncFlows(flows, activeFlowId, nodes, updatedEdges);
    saveAutoSavedState(updatedFlows, activeFlowId);

    set({
      edges: updatedEdges,
      flows: updatedFlows,
    });

    get().recalculate();
    return true;
  },

  addNode: (definitionId, position) => {
    const def = LibraryRegistry.getNodeDefinition(definitionId);
    if (!def) return;

    get().pushHistory();

    const id = `node_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const initialProps: Record<string, any> = {};

    def.properties.forEach((p) => {
      initialProps[p.id] = p.defaultValue;
    });

    if (definitionId === 'core:import_module') {
      if (!initialProps.imports) {
        initialProps.imports = [
          {
            id: `imp_${Date.now()}`,
            module: initialProps.module || 'machine',
            import_all: initialProps.import_all !== false,
            classes: initialProps.classes || '',
          },
        ];
      }
    }

    const currentNodes = get().nodes;
    const finalPosition = position || {
      x: 280 + (currentNodes.length % 6) * 30,
      y: 120 + (currentNodes.length % 6) * 35,
    };

    const newNode: Node<NodeInstanceData> = {
      id,
      type: 'nodeMpy',
      position: finalPosition,
      selected: true,
      data: {
        definitionId,
        libraryId: def.libraryId,
        label: def.label,
        color: def.color,
        icon: def.icon,
        properties: initialProps,
      },
    };

    // Deselect other nodes when a new node is added
    const deselectedNodes = currentNodes.map((n) => ({ ...n, selected: false }));
    const newNodes = [...deselectedNodes, newNode];
    const { flows, activeFlowId, edges } = get();
    const updatedFlows = syncFlows(flows, activeFlowId, newNodes, edges);
    saveAutoSavedState(updatedFlows, activeFlowId);

    set({
      nodes: newNodes,
      flows: updatedFlows,
      selectedNodeId: id,
    });

    get().recalculate();
  },

  updateNodeProperties: (nodeId, properties) => {
    get().pushHistory();

    const updatedNodes = get().nodes.map((node) => {
      if (node.id === nodeId) {
        return {
          ...node,
          data: {
            ...node.data,
            properties: {
              ...node.data.properties,
              ...properties,
            },
          },
        };
      }
      return node;
    });

    const { flows, activeFlowId, edges } = get();
    const updatedFlows = syncFlows(flows, activeFlowId, updatedNodes, edges);
    saveAutoSavedState(updatedFlows, activeFlowId);

    set({ nodes: updatedNodes, flows: updatedFlows });
    get().recalculate();
  },

  deleteSelectedNode: () => {
    const { selectedNodeId, nodes, edges, flows, activeFlowId } = get();
    const selectedNodeIds = new Set(nodes.filter((n) => n.selected).map((n) => n.id));
    if (selectedNodeId) {
      selectedNodeIds.add(selectedNodeId);
    }
    const selectedEdgeIds = new Set(edges.filter((e) => e.selected).map((e) => e.id));

    if (selectedNodeIds.size === 0 && selectedEdgeIds.size === 0) return;

    get().pushHistory();

    const newNodes = nodes.filter((n) => !selectedNodeIds.has(n.id));
    const newEdges = edges.filter(
      (e) => !selectedEdgeIds.has(e.id) && !selectedNodeIds.has(e.source) && !selectedNodeIds.has(e.target)
    );

    const updatedFlows = syncFlows(flows, activeFlowId, newNodes, newEdges);
    saveAutoSavedState(updatedFlows, activeFlowId);

    set({
      nodes: newNodes,
      edges: newEdges,
      flows: updatedFlows,
      selectedNodeId: null,
    });

    get().recalculate();
  },

  selectNode: (nodeId, multi = false) => {
    const { nodes } = get();
    if (!nodeId) {
      const updated = nodes.map((n) => (n.selected ? { ...n, selected: false } : n));
      set({ selectedNodeId: null, nodes: updated });
      return;
    }
    const target = nodes.find((n) => n.id === nodeId);
    if (multi || target?.selected) {
      set({ selectedNodeId: nodeId });
    } else {
      const updated = nodes.map((n) => ({
        ...n,
        selected: n.id === nodeId,
      }));
      set({ selectedNodeId: nodeId, nodes: updated });
    }
  },

  selectAllNodes: () => {
    const { nodes } = get();
    const updated = nodes.map((n) => ({ ...n, selected: true }));
    set({ nodes: updated });
  },

  clearCanvas: () => {
    const { activeFlowId, flows } = get();
    get().pushHistory();

    const updatedFlows = syncFlows(flows, activeFlowId, [], []);
    saveAutoSavedState(updatedFlows, activeFlowId);

    set({
      nodes: [],
      edges: [],
      flows: updatedFlows,
      selectedNodeId: null,
      generatedCode: 'while True:\n    pass',
      activeLibraryIds: [],
      categories: LibraryRegistry.getPaletteCategories([]),
    });
  },

  recalculate: () => {
    const { nodes, edges } = get();

    // 1. Calculate active library imports from all core:import_module nodes
    const activeLibs = new Set<string>();
    nodes.forEach((n) => {
      if (n.data.definitionId === 'core:import_module') {
        const importList = extractImportsFromNode(n.data.properties);
        importList.forEach((imp) => {
          if (imp.module) activeLibs.add(imp.module);
        });
      }
    });

    const activeLibraryIds = Array.from(activeLibs);

    // 2. Mark nodes with warnings if their library is not imported
    const validatedNodes = nodes.map((node) => {
      const isCore = node.data.libraryId === 'core';
      const isImported = isCore || activeLibraryIds.includes(node.data.libraryId);

      return {
        ...node,
        data: {
          ...node.data,
          hasWarning: !isImported,
          warningMessage: !isImported ? `Модуль "${node.data.libraryId}" не импортирован на холст!` : undefined,
        },
      };
    });

    // 3. Update categories in left palette
    const categories = LibraryRegistry.getPaletteCategories(activeLibraryIds);

    // 4. Generate Python code
    const compResult = CodeGenerator.generateCode(validatedNodes, edges);

    set({
      nodes: validatedNodes,
      activeLibraryIds,
      categories,
      generatedCode: compResult.code,
    });
  },

  loadProject: (project) => {
    if (Array.isArray(project.flows) && project.flows.length > 0) {
      const activeId = project.flows.some((f: any) => f.id === project.activeFlowId)
        ? project.activeFlowId
        : project.flows[0].id;
      const activeFlow = project.flows.find((f: any) => f.id === activeId) || project.flows[0];

      saveAutoSavedState(project.flows, activeId);

      set({
        flows: project.flows,
        activeFlowId: activeId,
        nodes: activeFlow.nodes || [],
        edges: activeFlow.edges || [],
        selectedNodeId: null,
        history: {},
        canUndo: false,
        canRedo: false,
      });
    } else {
      const singleFlow: FlowTab = {
        id: 'flow_1',
        name: project.projectName || 'Flow 1',
        nodes: project.nodes || [],
        edges: project.edges || [],
      };
      saveAutoSavedState([singleFlow], singleFlow.id);

      set({
        flows: [singleFlow],
        activeFlowId: singleFlow.id,
        nodes: singleFlow.nodes,
        edges: singleFlow.edges,
        selectedNodeId: null,
        history: {},
        canUndo: false,
        canRedo: false,
      });
    }
    get().recalculate();
  },

  exportProject: (projectName = 'my_nodempy_project') => {
    const { flows, activeFlowId, nodes, edges } = get();
    const updatedFlows = syncFlows(flows, activeFlowId, nodes, edges);

    return {
      formatVersion: '1.0',
      appName: 'Node-MPY',
      projectName,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      flows: updatedFlows,
      activeFlowId,
      nodes,
      edges,
    };
  },

  loadDemoProject: () => {
    // Preconfigured starter project: DHT22 reading -> OLED SSD1306 Display in while True loop
    const demoNodes: Node<NodeInstanceData>[] = [
      {
        id: 'imp_all',
        type: 'nodeMpy',
        position: { x: 40, y: 40 },
        data: {
          definitionId: 'core:import_module',
          libraryId: 'core',
          label: 'Imports (4)',
          color: '#3B82F6',
          icon: 'Box',
          properties: {
            imports: [
              { id: 'imp_1', module: 'machine', import_all: true, classes: '' },
              { id: 'imp_2', module: 'time', import_all: true, classes: '' },
              { id: 'imp_3', module: 'dht', import_all: true, classes: '' },
              { id: 'imp_4', module: 'ssd1306', import_all: true, classes: '' },
            ],
            module: 'machine',
          },
        },
      },
      {
        id: 'pin_dht',
        type: 'nodeMpy',
        position: { x: 280, y: 40 },
        data: {
          definitionId: 'machine:pin_init',
          libraryId: 'machine',
          label: 'DHT Pin (GPIO 4)',
          color: '#10B981',
          icon: 'ToggleLeft',
          properties: { pin: 4, mode: 'IN', pull: 'PULL_UP' },
        },
      },
      {
        id: 'dht_init',
        type: 'nodeMpy',
        position: { x: 520, y: 40 },
        data: {
          definitionId: 'dht:init',
          libraryId: 'dht',
          label: 'DHT22 Sensor',
          color: '#F59E0B',
          icon: 'Thermometer',
          properties: { model: 'DHT22' },
        },
      },
      {
        id: 'i2c_bus',
        type: 'nodeMpy',
        position: { x: 280, y: 140 },
        data: {
          definitionId: 'machine:i2c_init',
          libraryId: 'machine',
          label: 'I2C Bus (SCL:22, SDA:21)',
          color: '#8B5CF6',
          icon: 'Cpu',
          properties: { bus_id: 0, scl: 22, sda: 21, freq: 400000 },
        },
      },
      {
        id: 'oled_init',
        type: 'nodeMpy',
        position: { x: 520, y: 140 },
        data: {
          definitionId: 'ssd1306:init_i2c',
          libraryId: 'ssd1306',
          label: 'OLED SSD1306',
          color: '#00D4B2',
          icon: 'Tv',
          properties: { width: 128, height: 64, addr: '0x3C' },
        },
      },
      {
        id: 'while_loop',
        type: 'nodeMpy',
        position: { x: 280, y: 280 },
        data: {
          definitionId: 'core:while_loop',
          libraryId: 'core',
          label: 'While True Loop',
          color: '#3B82F6',
          icon: 'Repeat',
          properties: {},
        },
      },
      {
        id: 'dht_read',
        type: 'nodeMpy',
        position: { x: 520, y: 280 },
        data: {
          definitionId: 'dht:read',
          libraryId: 'dht',
          label: 'DHT Read',
          color: '#F59E0B',
          icon: 'Activity',
          properties: {},
        },
      },
      {
        id: 'oled_clear',
        type: 'nodeMpy',
        position: { x: 780, y: 280 },
        data: {
          definitionId: 'ssd1306:clear',
          libraryId: 'ssd1306',
          label: 'OLED Clear',
          color: '#00D4B2',
          icon: 'Square',
          properties: {},
        },
      },
      {
        id: 'oled_text',
        type: 'nodeMpy',
        position: { x: 1020, y: 280 },
        data: {
          definitionId: 'ssd1306:text',
          libraryId: 'ssd1306',
          label: 'OLED Print Temp',
          color: '#00D4B2',
          icon: 'Type',
          properties: { def_text: 'Temp: ', def_x: 0, def_y: 20 },
        },
      },
      {
        id: 'oled_show',
        type: 'nodeMpy',
        position: { x: 1260, y: 280 },
        data: {
          definitionId: 'ssd1306:show',
          libraryId: 'ssd1306',
          label: 'OLED Show',
          color: '#00D4B2',
          icon: 'CheckCircle',
          properties: {},
        },
      },
      {
        id: 'sleep_node',
        type: 'nodeMpy',
        position: { x: 1500, y: 280 },
        data: {
          definitionId: 'time:sleep_ms',
          libraryId: 'time',
          label: 'Sleep 2000ms',
          color: '#3B82F6',
          icon: 'PauseCircle',
          properties: { duration: 2000 },
        },
      },
    ];

    const demoEdges: Edge[] = [
      {
        id: 'e_pin_dht',
        type: 'default',
        source: 'pin_dht',
        sourceHandle: 'pin_obj',
        target: 'dht_init',
        targetHandle: 'pin',
        style: { stroke: PORT_COLORS.pin, strokeWidth: 2 },
      },
      {
        id: 'e_i2c_oled',
        type: 'default',
        source: 'i2c_bus',
        sourceHandle: 'bus',
        target: 'oled_init',
        targetHandle: 'bus',
        style: { stroke: PORT_COLORS.bus, strokeWidth: 2 },
      },
      {
        id: 'e_loop_dht',
        type: 'default',
        source: 'while_loop',
        sourceHandle: 'loop_body',
        target: 'dht_read',
        targetHandle: 'flow_in',
        style: { stroke: PORT_COLORS.flow, strokeWidth: 2.5 },
        animated: true,
      },
      {
        id: 'e_dht_dev',
        type: 'default',
        source: 'dht_init',
        sourceHandle: 'device',
        target: 'dht_read',
        targetHandle: 'device',
        style: { stroke: PORT_COLORS.device, strokeWidth: 2 },
      },
      {
        id: 'e_dht_clear',
        type: 'default',
        source: 'dht_read',
        sourceHandle: 'flow_out',
        target: 'oled_clear',
        targetHandle: 'flow_in',
        style: { stroke: PORT_COLORS.flow, strokeWidth: 2.5 },
        animated: true,
      },
      {
        id: 'e_oled_dev1',
        type: 'default',
        source: 'oled_init',
        sourceHandle: 'oled',
        target: 'oled_clear',
        targetHandle: 'oled',
        style: { stroke: PORT_COLORS.device, strokeWidth: 2 },
      },
      {
        id: 'e_clear_text',
        type: 'default',
        source: 'oled_clear',
        sourceHandle: 'flow_out',
        target: 'oled_text',
        targetHandle: 'flow_in',
        style: { stroke: PORT_COLORS.flow, strokeWidth: 2.5 },
        animated: true,
      },
      {
        id: 'e_oled_dev2',
        type: 'default',
        source: 'oled_init',
        sourceHandle: 'oled',
        target: 'oled_text',
        targetHandle: 'oled',
        style: { stroke: PORT_COLORS.device, strokeWidth: 2 },
      },
      {
        id: 'e_temp_text',
        type: 'default',
        source: 'dht_read',
        sourceHandle: 'temperature',
        target: 'oled_text',
        targetHandle: 'text',
        style: { stroke: PORT_COLORS.number, strokeWidth: 2 },
      },
      {
        id: 'e_text_show',
        type: 'default',
        source: 'oled_text',
        sourceHandle: 'flow_out',
        target: 'oled_show',
        targetHandle: 'flow_in',
        style: { stroke: PORT_COLORS.flow, strokeWidth: 2.5 },
        animated: true,
      },
      {
        id: 'e_oled_dev3',
        type: 'default',
        source: 'oled_init',
        sourceHandle: 'oled',
        target: 'oled_show',
        targetHandle: 'oled',
        style: { stroke: PORT_COLORS.device, strokeWidth: 2 },
      },
      {
        id: 'e_show_sleep',
        type: 'default',
        source: 'oled_show',
        sourceHandle: 'flow_out',
        target: 'sleep_node',
        targetHandle: 'flow_in',
        style: { stroke: PORT_COLORS.flow, strokeWidth: 2.5 },
        animated: true,
      },
    ];

    const { flows, activeFlowId } = get();
    const updatedFlows = syncFlows(flows, activeFlowId, demoNodes, demoEdges);
    saveAutoSavedState(updatedFlows, activeFlowId);

    set({
      nodes: demoNodes,
      edges: demoEdges,
      flows: updatedFlows,
      selectedNodeId: 'dht_init',
    });

    get().recalculate();
  },
}));
