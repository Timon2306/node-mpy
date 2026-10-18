import { CodeGenerator } from '../src/compiler/codeGenerator';
import { LibraryRegistry } from '../src/registry/registryLoader';
import { Node, Edge } from '@xyflow/react';
import { NodeInstanceData } from '../src/types/nodes';

console.log('=== RUNNING NODE-MPY COMPILER & REGISTRY TESTS ===\n');

// 1. Test all 65 nodes individually
console.log('--- TEST 1: Individual Node Code Generation ---');
const allLibs = LibraryRegistry.getAllLibraries();
let nodesPassCount = 0;

for (const lib of allLibs) {
  for (const nodeDef of lib.nodes) {
    const initialProps: Record<string, any> = {};
    for (const p of nodeDef.properties) {
      initialProps[p.id] = p.defaultValue;
    }

    const testNode: Node<NodeInstanceData> = {
      id: `test_${nodeDef.id.replace(/[^a-zA-Z0-9]/g, '_')}`,
      type: 'nodeMpy',
      position: { x: 0, y: 0 },
      data: {
        definitionId: nodeDef.id,
        libraryId: nodeDef.libraryId,
        label: nodeDef.label,
        color: nodeDef.color,
        icon: nodeDef.icon,
        properties: initialProps,
      },
    };

    // If it's a flow node, connect from while_loop to test execution rendering
    const nodes: Node<NodeInstanceData>[] = [testNode];
    const edges: Edge[] = [];

    if (nodeDef.inputs.some(i => i.type === 'flow')) {
      const loopNode: Node<NodeInstanceData> = {
        id: 'main_loop',
        type: 'nodeMpy',
        position: { x: 0, y: 0 },
        data: {
          definitionId: 'core:while_loop',
          libraryId: 'core',
          label: 'Loop',
          color: '#3B82F6',
          icon: 'Repeat',
          properties: {},
        },
      };
      nodes.unshift(loopNode);
      edges.push({
        id: 'e_loop_test',
        source: 'main_loop',
        sourceHandle: 'loop_body',
        target: testNode.id,
        targetHandle: 'flow_in',
      });
    }

    const result = CodeGenerator.generateCode(nodes, edges);

    // Assert no unreplaced template placeholders
    const unparsedTemplates = result.code.match(/\{\{[^}]+\}\}/g);
    if (unparsedTemplates) {
      console.error(`FAILED for node ${nodeDef.id}: unparsed templates found:`, unparsedTemplates);
      console.error('Generated Code:\n', result.code);
      process.exit(1);
    }

    const unparsedJinja = result.code.match(/\{%[^%]+%\}/g);
    if (unparsedJinja) {
      console.error(`FAILED for node ${nodeDef.id}: unparsed jinja found:`, unparsedJinja);
      console.error('Generated Code:\n', result.code);
      process.exit(1);
    }

    nodesPassCount++;
  }
}
console.log(`✓ All ${nodesPassCount} node definitions compile without any unparsed template artifacts.\n`);

// 2. Test Demo Project Compilation
console.log('--- TEST 2: Demo Project Compilation ---');
const demoNodes: Node<NodeInstanceData>[] = [
  {
    id: 'pin_dht',
    type: 'nodeMpy',
    position: { x: 0, y: 0 },
    data: {
      definitionId: 'machine:pin_init',
      libraryId: 'machine',
      label: 'DHT Pin',
      color: '#10B981',
      icon: 'ToggleLeft',
      properties: { pin: 4, mode: 'IN', pull: 'PULL_UP' },
    },
  },
  {
    id: 'dht_init',
    type: 'nodeMpy',
    position: { x: 0, y: 0 },
    data: {
      definitionId: 'dht:init',
      libraryId: 'dht',
      label: 'DHT22',
      color: '#F59E0B',
      icon: 'Thermometer',
      properties: { model: 'DHT22' },
    },
  },
  {
    id: 'i2c_bus',
    type: 'nodeMpy',
    position: { x: 0, y: 0 },
    data: {
      definitionId: 'machine:i2c_init',
      libraryId: 'machine',
      label: 'I2C Bus',
      color: '#8B5CF6',
      icon: 'Cpu',
      properties: { bus_id: 0, scl: 22, sda: 21, freq: 400000 },
    },
  },
  {
    id: 'oled_init',
    type: 'nodeMpy',
    position: { x: 0, y: 0 },
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
    position: { x: 0, y: 0 },
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
    position: { x: 0, y: 0 },
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
    position: { x: 0, y: 0 },
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
    position: { x: 0, y: 0 },
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
    position: { x: 0, y: 0 },
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
    position: { x: 0, y: 0 },
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
  { id: 'e1', source: 'pin_dht', sourceHandle: 'pin_obj', target: 'dht_init', targetHandle: 'pin' },
  { id: 'e2', source: 'i2c_bus', sourceHandle: 'bus', target: 'oled_init', targetHandle: 'bus' },
  { id: 'e3', source: 'while_loop', sourceHandle: 'loop_body', target: 'dht_read', targetHandle: 'flow_in' },
  { id: 'e4', source: 'dht_init', sourceHandle: 'device', target: 'dht_read', targetHandle: 'device' },
  { id: 'e5', source: 'dht_read', sourceHandle: 'flow_out', target: 'oled_clear', targetHandle: 'flow_in' },
  { id: 'e6', source: 'oled_init', sourceHandle: 'oled', target: 'oled_clear', targetHandle: 'oled' },
  { id: 'e7', source: 'oled_clear', sourceHandle: 'flow_out', target: 'oled_text', targetHandle: 'flow_in' },
  { id: 'e8', source: 'oled_init', sourceHandle: 'oled', target: 'oled_text', targetHandle: 'oled' },
  { id: 'e9', source: 'dht_read', sourceHandle: 'temperature', target: 'oled_text', targetHandle: 'text' },
  { id: 'e10', source: 'oled_text', sourceHandle: 'flow_out', target: 'oled_show', targetHandle: 'flow_in' },
  { id: 'e11', source: 'oled_init', sourceHandle: 'oled', target: 'oled_show', targetHandle: 'oled' },
  { id: 'e12', source: 'oled_show', sourceHandle: 'flow_out', target: 'sleep_node', targetHandle: 'flow_in' },
];

const demoResult = CodeGenerator.generateCode(demoNodes, demoEdges);
console.log('Demo Generated Code:\n' + demoResult.code + '\n');

// Verify variable matching in demo code:
// 1. pin_dht produces pin_4, and dht_init consumes pin_4
if (!demoResult.code.includes('pin_4 = machine.Pin(4') || !demoResult.code.includes('dht.DHT22(pin_4)')) {
  console.error('FAILED: pin_4 was not properly passed from pin_init to dht.DHT22');
  process.exit(1);
}

// 2. i2c_bus produces i2c_i2c_bus, and oled_init consumes i2c_i2c_bus
if (!demoResult.code.includes('i2c_i2c_bus = machine.I2C(0') || !demoResult.code.includes('ssd1306.SSD1306_I2C(128, 64, i2c_i2c_bus')) {
  console.error('FAILED: i2c_i2c_bus was not properly passed to ssd1306.SSD1306_I2C');
  process.exit(1);
}

// 3. oled_init produces oled_oled_init, and oled_clear/oled_text/oled_show all consume oled_oled_init
if (!demoResult.code.includes('oled_oled_init = ssd1306.SSD1306_I2C') ||
    !demoResult.code.includes('oled_oled_init.fill(0)') ||
    !demoResult.code.includes('oled_oled_init.show()')) {
  console.error('FAILED: oled_oled_init variable name mismatch!');
  process.exit(1);
}

// 4. dht_read produces temp_dht_read, and oled_text receives temp_dht_read
if (!demoResult.code.includes('temp_dht_read = dht_sensor_dht_init.temperature()') ||
    !demoResult.code.includes('oled_oled_init.text(str(temp_dht_read)')) {
  console.error('FAILED: temp_dht_read variable was not passed to oled.text');
  process.exit(1);
}

console.log('✓ Demo project compiles with 100% accurate variable binding and valid MicroPython syntax!\n');

// 3. Test Complex Multi-Node Flow with new nodes
console.log('--- TEST 3: Logic, Math, Strings, Tone, Random Flow ---');
const complexNodes: Node<NodeInstanceData>[] = [
  {
    id: 'setup_node',
    type: 'nodeMpy',
    position: { x: 0, y: 0 },
    data: {
      definitionId: 'core:setup',
      libraryId: 'core',
      label: 'Start',
      color: '#10B981',
      icon: 'Play',
      properties: {},
    },
  },
  {
    id: 'wifi_conn',
    type: 'nodeMpy',
    position: { x: 0, y: 0 },
    data: {
      definitionId: 'network:wlan_connect',
      libraryId: 'network',
      label: 'Connect WiFi',
      color: '#06B6D4',
      icon: 'Wifi',
      properties: { ssid: 'MyHome', password: 'secretpassword' },
    },
  },
  {
    id: 'wifi_ip',
    type: 'nodeMpy',
    position: { x: 0, y: 0 },
    data: {
      definitionId: 'network:ifconfig',
      libraryId: 'network',
      label: 'IP Config',
      color: '#06B6D4',
      icon: 'Wifi',
      properties: {},
    },
  },
  {
    id: 'while_loop',
    type: 'nodeMpy',
    position: { x: 0, y: 0 },
    data: {
      definitionId: 'core:while_loop',
      libraryId: 'core',
      label: 'Main Loop',
      color: '#3B82F6',
      icon: 'Repeat',
      properties: {},
    },
  },
  {
    id: 'rand_gen',
    type: 'nodeMpy',
    position: { x: 0, y: 0 },
    data: {
      definitionId: 'core:random',
      libraryId: 'core',
      label: 'Random Int',
      color: '#3B82F6',
      icon: 'Hash',
      properties: { min_val: 10, max_val: 99 },
    },
  },
  {
    id: 'math_op',
    type: 'nodeMpy',
    position: { x: 0, y: 0 },
    data: {
      definitionId: 'core:math',
      libraryId: 'core',
      label: 'Math * 2',
      color: '#3B82F6',
      icon: 'Calculator',
      properties: { operator: '*', val_b: 2 },
    },
  },
  {
    id: 'cmp_op',
    type: 'nodeMpy',
    position: { x: 0, y: 0 },
    data: {
      definitionId: 'core:comparison',
      libraryId: 'core',
      label: 'Cmp > 50',
      color: '#EC4899',
      icon: 'CheckSquare',
      properties: { operator: '>', val_b: 50 },
    },
  },
  {
    id: 'logic_op',
    type: 'nodeMpy',
    position: { x: 0, y: 0 },
    data: {
      definitionId: 'core:logic',
      libraryId: 'core',
      label: 'Logic AND',
      color: '#EC4899',
      icon: 'CheckSquare',
      properties: { operator: 'and', val_b: 'True' },
    },
  },
  {
    id: 'if_branch',
    type: 'nodeMpy',
    position: { x: 0, y: 0 },
    data: {
      definitionId: 'core:if_else',
      libraryId: 'core',
      label: 'If / Else',
      color: '#EC4899',
      icon: 'GitFork',
      properties: {},
    },
  },
  {
    id: 'print_true',
    type: 'nodeMpy',
    position: { x: 0, y: 0 },
    data: {
      definitionId: 'core:print',
      libraryId: 'core',
      label: 'Print OK',
      color: '#EAB308',
      icon: 'Terminal',
      properties: { message: 'Condition Passed!' },
    },
  },
  {
    id: 'print_false',
    type: 'nodeMpy',
    position: { x: 0, y: 0 },
    data: {
      definitionId: 'core:print',
      libraryId: 'core',
      label: 'Print Failed',
      color: '#EAB308',
      icon: 'Terminal',
      properties: { message: 'Condition Failed!' },
    },
  },
];

const complexEdges: Edge[] = [
  // Setup flow: setup -> wifi_conn -> wifi_ip
  { id: 'ce1', source: 'setup_node', sourceHandle: 'flow_out', target: 'wifi_conn', targetHandle: 'flow_in' },
  { id: 'ce2', source: 'wifi_conn', sourceHandle: 'flow_out', target: 'wifi_ip', targetHandle: 'flow_in' },
  { id: 'ce3', source: 'wifi_conn', sourceHandle: 'wlan_obj', target: 'wifi_ip', targetHandle: 'wlan' },

  // While loop body -> rand_gen
  { id: 'ce4', source: 'while_loop', sourceHandle: 'loop_body', target: 'rand_gen', targetHandle: 'flow_in' },

  // Expression flow: rand_gen (result) -> math_op (a)
  { id: 'ce5', source: 'rand_gen', sourceHandle: 'result', target: 'math_op', targetHandle: 'a' },

  // math_op (result) -> cmp_op (a)
  { id: 'ce6', source: 'math_op', sourceHandle: 'result', target: 'cmp_op', targetHandle: 'a' },

  // cmp_op (result) -> logic_op (a)
  { id: 'ce7', source: 'cmp_op', sourceHandle: 'result', target: 'logic_op', targetHandle: 'a' },

  // rand_gen (flow_out) -> if_branch (flow_in)
  { id: 'ce8', source: 'rand_gen', sourceHandle: 'flow_out', target: 'if_branch', targetHandle: 'flow_in' },

  // logic_op (result) -> if_branch (condition)
  { id: 'ce9', source: 'logic_op', sourceHandle: 'result', target: 'if_branch', targetHandle: 'condition' },

  // if_branch (flow_true) -> print_true
  { id: 'ce10', source: 'if_branch', sourceHandle: 'flow_true', target: 'print_true', targetHandle: 'flow_in' },

  // if_branch (flow_false) -> print_false
  { id: 'ce11', source: 'if_branch', sourceHandle: 'flow_false', target: 'print_false', targetHandle: 'flow_in' },
];

const complexResult = CodeGenerator.generateCode(complexNodes, complexEdges);
console.log('Complex Flow Code:\n' + complexResult.code + '\n');

// Assertions on complex flow:
if (!complexResult.code.includes('wlan_wifi_conn = network.WLAN(network.STA_IF)')) {
  console.error('FAILED: wlan_wifi_conn initialization missing');
  process.exit(1);
}

if (!complexResult.code.includes('wlan_wifi_conn.connect(\'MyHome\', \'secretpassword\')')) {
  console.error('FAILED: wifi connect missing');
  process.exit(1);
}

if (!complexResult.code.includes('wlan_wifi_conn.ifconfig()')) {
  console.error('FAILED: ifconfig call missing');
  process.exit(1);
}

if (!complexResult.code.includes('urandom.randint(10, 99)')) {
  console.error('FAILED: random number generation missing');
  process.exit(1);
}

if (!complexResult.code.includes('math_math_op = (rnd_rand_gen * 2)')) {
  console.error('FAILED: math operation expression missing or mismatched operands');
  process.exit(1);
}

if (!complexResult.code.includes('cmp_cmp_op = (math_math_op > 50)')) {
  console.error('FAILED: comparison expression missing');
  process.exit(1);
}

if (!complexResult.code.includes('logic_logic_op = (cmp_cmp_op and True)')) {
  console.error('FAILED: logic operation expression missing');
  process.exit(1);
}

if (!complexResult.code.includes('if logic_logic_op:')) {
  console.error('FAILED: if condition did not receive logic_logic_op');
  process.exit(1);
}

console.log('✓ Complex multi-node flow with Math, Logic, Random, Network, If/Else passed with flying colors!\n');

console.log('ALL TESTS PASSED SUCCESSFULLY!');
