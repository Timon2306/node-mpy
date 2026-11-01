import { Edge, Node } from '@xyflow/react';
import { LibraryRegistry } from '../registry/registryLoader';
import { FlowMode, FlowTab } from '../types/project';
import { NodeInstanceData } from '../types/nodes';
import { PORT_COLORS } from '../types/ports';

type NodeSpec = [string, string, Record<string, unknown>, number, number];
type EdgeSpec = [string, string, string, string];

interface FlowSpec {
  name: string;
  mode: FlowMode;
  nodes: NodeSpec[];
  edges: EdgeSpec[];
}

export interface ExampleInfo {
  id: string;
  title: string;
  description: string;
  flows: FlowSpec[];
}

const WIFI = { ssid: 'MyWiFi', password: '12345678' };

const firmware = (name: string, body: NodeSpec[], edges: EdgeSpec[], first: string): FlowSpec => ({
  name,
  mode: 'micropython',
  nodes: [
    ['start', 'core:setup', {}, 40, 40],
    ['wifi', 'network:wlan_connect', WIFI, 280, 40],
    ['loop', 'core:while_loop', {}, 520, 40],
    ...body,
  ],
  edges: [
    ['start', 'flow_out', 'wifi', 'flow_in'],
    ['wifi', 'flow_out', 'loop', 'flow_in'],
    ['loop', 'loop_body', first, 'flow_in'],
    ...edges,
  ],
});

export const EXAMPLES: ExampleInfo[] = [
  {
    id: 'light',
    title: 'Датчик света на дашборде',
    description: 'Фоторезистор на A0, показания идут на шкалу и график.',
    flows: [
      firmware(
        'Плата: датчик света',
        [
          ['adc', 'machine:adc_init', { pin: 0 }, 280, 220],
          ['read', 'machine:adc_read', {}, 760, 40],
          ['send', 'network:dashboard_client', { path: 'light' }, 1000, 40],
          ['pause', 'time:sleep_ms', { duration: 1000 }, 1240, 40],
        ],
        [
          ['adc', 'adc_obj', 'read', 'adc'],
          ['read', 'flow_out', 'send', 'flow_in'],
          ['read', 'val', 'send', 'value'],
          ['send', 'flow_out', 'pause', 'flow_in'],
        ],
        'read'
      ),
      {
        name: 'Дашборд: свет',
        mode: 'dashboard',
        nodes: [
          ['gauge', 'dashboard:gauge', { label: 'Освещённость', min: 0, max: 1023, units: '', source: 'light' }, 80, 50],
          ['chart', 'dashboard:chart', { label: 'Динамика света', source: 'light' }, 80, 190],
        ],
        edges: [],
      },
    ],
  },
  {
    id: 'led',
    title: 'Светодиод с телефона',
    description: 'Тумблер на странице дашборда включает и выключает светодиод на D1 (GPIO5).',
    flows: [
      firmware(
        'Плата: светодиод',
        [
          ['led', 'machine:pin_init', { pin: 5, mode: 'OUT' }, 280, 220],
          ['send', 'network:dashboard_client', { path: 'led' }, 760, 40],
          ['set', 'machine:pin_write', {}, 1000, 40],
          ['pause', 'time:sleep_ms', { duration: 300 }, 1240, 40],
        ],
        [
          ['send', 'flow_out', 'set', 'flow_in'],
          ['send', 'is_on', 'set', 'val'],
          ['led', 'pin_obj', 'set', 'pin'],
          ['set', 'flow_out', 'pause', 'flow_in'],
        ],
        'send'
      ),
      {
        name: 'Дашборд: светодиод',
        mode: 'dashboard',
        nodes: [
          ['sw', 'dashboard:switch', { label: 'Светодиод', channel: 'led', source: 'led' }, 80, 100],
        ],
        edges: [],
      },
    ],
  },
  {
    id: 'pwm',
    title: 'Яркость ползунком',
    description: 'Ползунок на дашборде управляет ШИМ светодиода на D1 (GPIO5).',
    flows: [
      firmware(
        'Плата: ШИМ',
        [
          ['pin', 'machine:pin_init', { pin: 5, mode: 'OUT' }, 280, 220],
          ['pwm', 'machine:pwm_init', { freq: 1000, duty: 0 }, 520, 220],
          ['send', 'network:dashboard_client', { path: 'pwm' }, 760, 40],
          ['duty', 'machine:pwm_set', {}, 1000, 40],
          ['pause', 'time:sleep_ms', { duration: 200 }, 1240, 40],
        ],
        [
          ['pin', 'pin_obj', 'pwm', 'pin'],
          ['send', 'flow_out', 'duty', 'flow_in'],
          ['send', 'slider_val', 'duty', 'duty'],
          ['pwm', 'pwm_obj', 'duty', 'pwm'],
          ['duty', 'flow_out', 'pause', 'flow_in'],
        ],
        'send'
      ),
      {
        name: 'Дашборд: яркость',
        mode: 'dashboard',
        nodes: [
          ['sl', 'dashboard:slider', { label: 'Яркость', min: 0, max: 1023, step: 10, source: 'pwm' }, 80, 100],
        ],
        edges: [],
      },
    ],
  },
];

const buildFlow = (spec: FlowSpec, index: number, exampleId: string): FlowTab => {
  const prefix = '';
  const nodes: Node<NodeInstanceData>[] = spec.nodes.map(([id, definitionId, overrides, x, y]) => {
    const def = LibraryRegistry.getNodeDefinition(definitionId);
    if (!def) throw new Error(`Пример ${exampleId}: нет ноды ${definitionId}`);
    const properties: Record<string, unknown> = {};
    for (const p of def.properties) if (p.defaultValue !== undefined) properties[p.id] = p.defaultValue;
    return {
      id: prefix + id,
      type: 'nodeMpy',
      position: { x, y },
      data: {
        definitionId,
        libraryId: def.libraryId,
        label: def.label,
        color: def.color,
        icon: def.icon,
        properties: { ...properties, ...overrides },
      },
    } as Node<NodeInstanceData>;
  });

  const edges: Edge[] = spec.edges.map(([source, sourceHandle, target, targetHandle]) => {
    const sourceNode = nodes.find((n) => n.id === prefix + source)!;
    const port = LibraryRegistry.getNodeDefinition(sourceNode.data.definitionId)!.outputs.find((o) => o.id === sourceHandle);
    if (!port) throw new Error(`Пример ${exampleId}: у ${source} нет выхода ${sourceHandle}`);
    return {
      id: `e_${prefix}${source}_${sourceHandle}_${target}_${targetHandle}`,
      type: 'default',
      source: prefix + source,
      sourceHandle,
      target: prefix + target,
      targetHandle,
      style: { stroke: PORT_COLORS[port.type], strokeWidth: port.type === 'flow' ? 2.5 : 2 },
      animated: port.type === 'flow',
    };
  });

  return { id: `flow_${index + 1}`, name: spec.name, mode: spec.mode, nodes, edges };
};

export const buildExampleProject = (exampleId: string) => {
  const example = EXAMPLES.find((e) => e.id === exampleId);
  if (!example) throw new Error(`Неизвестный пример ${exampleId}`);
  const flows = example.flows.map((f, i) => buildFlow(f, i, example.id));
  return { projectName: example.title, flows, activeFlowId: flows[0].id, nodes: flows[0].nodes, edges: flows[0].edges };
};
