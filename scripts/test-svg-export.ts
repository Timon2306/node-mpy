import { LibraryRegistry } from '../src/registry/registryLoader';
import { generateFlowSvg } from '../src/services/exportService';
import fs from 'fs';

// LibraryRegistry auto-loads statically

const flow = {
  id: 'flow_1',
  name: 'Blink Flow',
  nodes: [
    {
      id: 'node_import',
      position: { x: 50, y: 100 },
      data: {
        definitionId: 'core:import_module',
        label: 'Imports (2)',
        color: '#F59E0B',
        icon: 'Box',
        properties: {
          imports: [
            { module: 'machine', import_all: true },
            { module: 'time', import_all: true }
          ]
        }
      }
    },
    {
      id: 'node_pin_init',
      position: { x: 300, y: 100 },
      data: {
        definitionId: 'machine:pin_init',
        label: 'Pin Setup',
        color: '#06B6D4',
        icon: 'Cpu',
        properties: { pin: 2, mode: 'OUT' }
      }
    },
    {
      id: 'node_while',
      position: { x: 540, y: 100 },
      data: {
        definitionId: 'core:while_loop',
        label: 'While Loop',
        color: '#8B5CF6',
        icon: 'Repeat',
        properties: {}
      }
    },
    {
      id: 'node_toggle',
      position: { x: 770, y: 100 },
      data: {
        definitionId: 'machine:pin_toggle',
        label: 'Pin Toggle',
        color: '#06B6D4',
        icon: 'ToggleLeft',
        properties: {}
      }
    },
    {
      id: 'node_sleep',
      position: { x: 1030, y: 100 },
      data: {
        definitionId: 'time:sleep_ms',
        label: 'Sleep',
        color: '#10B981',
        icon: 'PauseCircle',
        properties: { duration: 500 }
      }
    }
  ],
  edges: [
    {
      id: 'e1',
      source: 'node_pin_init',
      sourceHandle: 'flow_out',
      target: 'node_while',
      targetHandle: 'flow_in'
    },
    {
      id: 'e2',
      source: 'node_pin_init',
      sourceHandle: 'pin',
      target: 'node_toggle',
      targetHandle: 'pin'
    },
    {
      id: 'e3',
      source: 'node_while',
      sourceHandle: 'body',
      target: 'node_toggle',
      targetHandle: 'flow_in'
    },
    {
      id: 'e4',
      source: 'node_toggle',
      sourceHandle: 'flow_out',
      target: 'node_sleep',
      targetHandle: 'flow_in'
    }
  ]
};

const { svg, width, height } = generateFlowSvg(flow as any);
console.log('SVG dimensions:', width, height);
fs.writeFileSync('test_output.svg', svg);
console.log('Successfully saved test_output.svg! Characters:', svg.length);
