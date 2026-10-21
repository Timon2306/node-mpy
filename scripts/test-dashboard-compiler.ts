import { LibraryRegistry } from '../src/registry/registryLoader';
import { DashboardCodeGenerator } from '../src/compiler/dashboardCodeGenerator';
import { generateFlowSvg } from '../src/services/exportService';
import { Node, Edge } from '@xyflow/react';
import { NodeInstanceData } from '../src/types/nodes';

console.log('=== RUNNING DASHBOARD COMPILER & REGISTRY TESTS ===\n');

// 1. Verify LibraryRegistry loads Dashboard nodes
console.log('--- TEST 1: Palette Categories & Dashboard nodes ---');
const dashboardCategories = LibraryRegistry.getPaletteCategories([], 'dashboard');
const dashboardCat = dashboardCategories.find(c => c.id === 'dashboard');

if (!dashboardCat) {
  console.error('FAIL: Dashboard category not found in dashboard mode');
  process.exit(1);
}
console.log(`✓ Dashboard category found with ${dashboardCat.nodes.length} nodes!`);

const micropythonCategories = LibraryRegistry.getPaletteCategories([], 'micropython');
const mpDashboardCat = micropythonCategories.find(c => c.id === 'dashboard');
if (mpDashboardCat) {
  console.error('FAIL: Dashboard category should be hidden in micropython mode');
  process.exit(1);
}
console.log('✓ Dashboard category successfully isolated from micropython mode!');

// 2. Build full Student Lab Dashboard Flow
console.log('\n--- TEST 2: Generate Student Lab Server (TypeScript) & HTML ---');
const testNodes: Node<NodeInstanceData>[] = [
  {
    id: 'ep_light',
    type: 'nodeMpy',
    position: { x: 50, y: 100 },
    data: {
      definitionId: 'dashboard:http_endpoint',
      label: 'HTTP Endpoint (In)',
      color: '#E11D48',
      icon: 'Radio',
      properties: {
        method: 'GET',
        path: '/light',
        param_name: 'value'
      }
    }
  },
  {
    id: 'gauge_light',
    type: 'nodeMpy',
    position: { x: 340, y: 50 },
    data: {
      definitionId: 'dashboard:gauge',
      label: 'Шкала света (Gauge)',
      color: '#E11D48',
      icon: 'Gauge',
      properties: {
        label: 'Освещённость (LDR)',
        min: 0,
        max: 1024,
        units: 'лк'
      }
    }
  },
  {
    id: 'chart_light',
    type: 'nodeMpy',
    position: { x: 340, y: 160 },
    data: {
      definitionId: 'dashboard:chart',
      label: 'График света (Chart)',
      color: '#E11D48',
      icon: 'BarChart2',
      properties: {
        label: 'Динамика света',
        points: 30
      }
    }
  },
  {
    id: 'btn_on',
    type: 'nodeMpy',
    position: { x: 50, y: 280 },
    data: {
      definitionId: 'dashboard:button',
      label: 'Вкл Свет (Button)',
      color: '#E11D48',
      icon: 'Square',
      properties: {
        label: 'Включить LED2',
        payload: 'CMD_ON',
        button_color: 'teal'
      }
    }
  },
  {
    id: 'resp_cmd',
    type: 'nodeMpy',
    position: { x: 340, y: 280 },
    data: {
      definitionId: 'dashboard:http_response',
      label: 'HTTP Response (Out)',
      color: '#E11D48',
      icon: 'Send',
      properties: {
        default_text: 'CMD_OFF',
        status_code: 200
      }
    }
  }
];

const testEdges: Edge[] = [
  {
    id: 'e1',
    source: 'ep_light',
    sourceHandle: 'value',
    target: 'gauge_light',
    targetHandle: 'value'
  },
  {
    id: 'e2',
    source: 'ep_light',
    sourceHandle: 'value',
    target: 'chart_light',
    targetHandle: 'value'
  },
  {
    id: 'e3',
    source: 'btn_on',
    sourceHandle: 'payload',
    target: 'resp_cmd',
    targetHandle: 'data'
  }
];

const result = DashboardCodeGenerator.generateCode(testNodes, testEdges);

if (!result.serverCode.includes('/light')) {
  console.error('FAIL: Generated server.ts missing /light endpoint route');
  process.exit(1);
}
if (!result.serverCode.includes('PORT = 1880')) {
  console.error('FAIL: Generated server.ts missing PORT = 1880');
  process.exit(1);
}
if (!result.htmlCode.includes('Node-MPY — Dashboard')) {
  console.error('FAIL: Generated dashboard.html missing title');
  process.exit(1);
}
console.log('✓ server.ts generated successfully with /light endpoint and PORT 1880!');
console.log(`✓ dashboard.html generated successfully (${result.htmlCode.length} characters)!`);

// 3. Test SVG export of Dashboard Flow
console.log('\n--- TEST 3: SVG Vector Export of Dashboard Flow ---');
const flowTab = {
  id: 'flow_dashboard',
  name: 'Dashboard Lab',
  mode: 'dashboard' as const,
  nodes: testNodes,
  edges: testEdges
};

const svgResult = generateFlowSvg(flowTab as any);
if (!svgResult.svg.includes('<svg') || !svgResult.svg.includes('HTTP Endpoint')) {
  console.error('FAIL: Dashboard SVG export failed');
  process.exit(1);
}
console.log(`✓ Dashboard SVG generated successfully (${svgResult.width}x${svgResult.height})!`);

// 4. Test Empty Dashboard Canvas Generation
console.log('\n--- TEST 4: Clean Starter for Empty Dashboard Canvas ---');
const emptyResult = DashboardCodeGenerator.generateCode([], []);
const lineCount = emptyResult.serverCode.split('\n').length;
if (lineCount > 35) {
  console.error(`FAIL: Empty dashboard should be clean and concise, got ${lineCount} lines`);
  process.exit(1);
}
if (!emptyResult.serverCode.includes('Полотно дашборда пока пусто')) {
  console.error('FAIL: Empty dashboard missing instructional comments');
  process.exit(1);
}
console.log(`✓ Empty dashboard generates clean ${lineCount}-line starter template!`);

console.log('\n======================================================');
console.log('ALL DASHBOARD TESTS PASSED WITH 100% SUCCESS!');
console.log('======================================================');
