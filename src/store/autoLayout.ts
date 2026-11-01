import { Edge, Node } from '@xyflow/react';
import { LibraryRegistry } from '../registry/registryLoader';
import { NodeInstanceData } from '../types/nodes';

const COLUMN = 280;
const GAP = 24;

type FlowNode = Node<NodeInstanceData>;

const heightOf = (node: FlowNode) => {
  const def = LibraryRegistry.getNodeDefinition(node.data.definitionId);
  const rows = def ? Math.max(def.inputs.length, def.outputs.length, 1) : 1;
  return 34 + rows * 24 + 16;
};

/**
 * Расставляет ноды так, как читается код: поток исполнения идёт сверху вниз,
 * тело цикла или ветки сдвигается вправо, а датчики и шины стоят слева от тех, кому они нужны.
 * Если в схеме нет потока исполнения (дашборд), ноды выстраиваются слева направо по ходу данных.
 */
export function arrangeNodes(nodes: FlowNode[], edges: Edge[]): Record<string, { x: number; y: number }> {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const portType = (nodeId: string, handle: string | null | undefined) => {
    const node = byId.get(nodeId);
    const def = node && LibraryRegistry.getNodeDefinition(node.data.definitionId);
    return def?.outputs.find((o) => o.id === handle)?.type;
  };

  const flowEdges = edges.filter((e) => byId.has(e.source) && byId.has(e.target) && portType(e.source, e.sourceHandle) === 'flow');
  const dataEdges = edges.filter((e) => byId.has(e.source) && byId.has(e.target) && portType(e.source, e.sourceHandle) !== 'flow');
  const positions: Record<string, { x: number; y: number }> = {};
  const order = (a: FlowNode, b: FlowNode) => a.position.y - b.position.y || a.position.x - b.position.x;

  const flowNodeIds = new Set(flowEdges.flatMap((e) => [e.source, e.target]));
  const hasFlow = flowNodeIds.size > 0;

  const depthOf = (id: string, seen = new Set<string>()): number => {
    if (seen.has(id)) return 0;
    seen.add(id);
    const incoming = dataEdges.filter((e) => e.target === id);
    return incoming.length ? 1 + Math.max(...incoming.map((e) => depthOf(e.source, new Set(seen)))) : 0;
  };

  if (!hasFlow) {
    const columns = new Map<number, FlowNode[]>();
    for (const node of [...nodes].sort(order)) {
      const depth = depthOf(node.id);
      columns.set(depth, [...(columns.get(depth) || []), node]);
    }
    for (const [depth, list] of columns) {
      let y = 0;
      for (const node of list) {
        positions[node.id] = { x: depth * COLUMN, y };
        y += heightOf(node) + GAP;
      }
    }
    return positions;
  }

  const incomingFlow = new Set(flowEdges.map((e) => e.target));
  const roots = nodes.filter((n) => flowNodeIds.has(n.id) && !incomingFlow.has(n.id)).sort(order);
  const placed = new Set<string>();
  const rowY = new Map<string, number>();
  let y = 0;

  const place = (node: FlowNode, column: number) => {
    if (placed.has(node.id)) return;
    placed.add(node.id);
    positions[node.id] = { x: column * COLUMN, y };
    rowY.set(node.id, y);
    y += heightOf(node) + GAP;

    const def = LibraryRegistry.getNodeDefinition(node.data.definitionId);
    const outs = (def?.outputs || []).filter((o) => o.type === 'flow');
    for (const out of outs) {
      const inner = out.id !== 'flow_out' && out.id !== 'flow_next';
      const targets = flowEdges
        .filter((e) => e.source === node.id && e.sourceHandle === out.id)
        .map((e) => byId.get(e.target)!)
        .sort(order);
      for (const target of targets) place(target, inner ? column + 1 : column);
    }
  };
  for (const root of roots) place(root, 0);
  for (const node of nodes.filter((n) => flowNodeIds.has(n.id)).sort(order)) place(node, 0);

  const lanes = new Map<number, number>();
  const feeds = (id: string) => dataEdges.filter((e) => e.source === id).map((e) => e.target);
  const rowOfConsumer = (id: string, seen = new Set<string>()): number | undefined => {
    if (rowY.has(id)) return rowY.get(id);
    if (seen.has(id)) return undefined;
    seen.add(id);
    const rows = feeds(id).map((t) => rowOfConsumer(t, seen)).filter((v): v is number => v !== undefined);
    return rows.length ? Math.min(...rows) : undefined;
  };
  const distanceToFlow = (id: string, seen = new Set<string>()): number => {
    if (rowY.has(id)) return 0;
    if (seen.has(id)) return 0;
    seen.add(id);
    const next = feeds(id).map((t) => distanceToFlow(t, new Set(seen)));
    return next.length ? 1 + Math.min(...next) : 1;
  };

  const helpers = nodes.filter((n) => !placed.has(n.id)).sort(order);
  const loose: FlowNode[] = [];
  for (const node of helpers) {
    const row = rowOfConsumer(node.id);
    if (row === undefined) {
      loose.push(node);
      continue;
    }
    const lane = -distanceToFlow(node.id);
    const bottom = lanes.get(lane) ?? -Infinity;
    const top = Math.max(row, bottom);
    positions[node.id] = { x: lane * COLUMN, y: top };
    lanes.set(lane, top + heightOf(node) + GAP);
  }

  const furthest = Math.max(0, ...Object.values(positions).map((p) => p.x));
  let looseY = 0;
  for (const node of loose) {
    positions[node.id] = { x: furthest + COLUMN, y: looseY };
    looseY += heightOf(node) + GAP;
  }
  return positions;
}
