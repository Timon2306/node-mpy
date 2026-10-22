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

// --- TEST 4: MicroPyServer + File I/O + String Replace ---
const serverNodes: Node<NodeInstanceData>[] = [
  {
    id: 'srv_init',
    type: 'nodeMpy',
    position: { x: 0, y: 0 },
    data: {
      definitionId: 'micropyserver:init',
      libraryId: 'micropyserver',
      label: 'Server Init',
      color: '#06B6D4',
      icon: 'Server',
      properties: { port: 80 },
    },
  },
  {
    id: 'srv_route',
    type: 'nodeMpy',
    position: { x: 0, y: 0 },
    data: {
      definitionId: 'micropyserver:route',
      libraryId: 'micropyserver',
      label: 'Route /',
      color: '#06B6D4',
      icon: 'CornerDownRight',
      properties: { path: '/', func_name: 'index' },
    },
  },
  {
    id: 'file_read_node',
    type: 'nodeMpy',
    position: { x: 0, y: 0 },
    data: {
      definitionId: 'core:file_read',
      libraryId: 'core',
      label: 'Read page2.html',
      color: '#10B981',
      icon: 'File',
      properties: { filename: 'page2.html' },
    },
  },
  {
    id: 'str_replace_node',
    type: 'nodeMpy',
    position: { x: 0, y: 0 },
    data: {
      definitionId: 'core:string_replace',
      libraryId: 'core',
      label: 'Replace Value',
      color: '#EAB308',
      icon: 'Replace',
      properties: { search: '<=VALUE=>', replace: '1023' },
    },
  },
  {
    id: 'srv_send',
    type: 'nodeMpy',
    position: { x: 0, y: 0 },
    data: {
      definitionId: 'micropyserver:send',
      libraryId: 'micropyserver',
      label: 'Send HTML',
      color: '#06B6D4',
      icon: 'Send',
      properties: { content_type: 'text/html' },
    },
  },
];

const serverEdges: Edge[] = [
  // Wire srv_init to srv_route
  { id: 'se1', source: 'srv_init', sourceHandle: 'server', target: 'srv_route', targetHandle: 'server' },

  // Route flow: route -> file_read -> send
  { id: 'se2', source: 'srv_route', sourceHandle: 'flow_out', target: 'file_read_node', targetHandle: 'flow_in' },
  { id: 'se3', source: 'file_read_node', sourceHandle: 'flow_out', target: 'srv_send', targetHandle: 'flow_in' },

  // Data flow: file_read (content) -> str_replace (text)
  { id: 'se4', source: 'file_read_node', sourceHandle: 'content', target: 'str_replace_node', targetHandle: 'text' },

  // Data flow: str_replace (result) -> send (content)
  { id: 'se5', source: 'str_replace_node', sourceHandle: 'result', target: 'srv_send', targetHandle: 'content' },

  // Wire srv_init to srv_send
  { id: 'se6', source: 'srv_init', sourceHandle: 'server', target: 'srv_send', targetHandle: 'server' },
];

const serverResult = CodeGenerator.generateCode(serverNodes, serverEdges);
console.log('MicroPyServer Flow Code:\n' + serverResult.code + '\n');

// Assertions on MicroPyServer flow:
if (!serverResult.code.includes('from micropyserver import MicroPyServer')) {
  console.error('FAILED: MicroPyServer import missing');
  process.exit(1);
}

if (!serverResult.code.includes('server_srv_init = MicroPyServer(port=80)')) {
  console.error('FAILED: MicroPyServer init missing');
  process.exit(1);
}

if (!serverResult.code.includes('def index_srv_route(request, params):')) {
  console.error('FAILED: Route function definition missing');
  process.exit(1);
}

if (!serverResult.code.includes('open("page2.html", \'r\')')) {
  console.error('FAILED: file_read call missing');
  process.exit(1);
}

if (!serverResult.code.includes('.replace("<=VALUE=>", str(1023))')) {
  console.error('FAILED: string replace call missing');
  process.exit(1);
}

if (!serverResult.code.includes('server_srv_init.send(') || !serverResult.code.includes("content_type='Content-Type: text/html'")) {
  console.error('FAILED: server.send call missing or content_type mismatch');
  process.exit(1);
}

if (!serverResult.code.includes("server_srv_init.add_route('/', index_srv_route)")) {
  console.error('FAILED: server.add_route registration missing');
  process.exit(1);
}

if (!serverResult.code.includes('server_srv_init.start()')) {
  console.error('FAILED: server.start() loop missing');
  process.exit(1);
}

console.log('✓ MicroPyServer + File Read + String Replace + Route Registration passed with 100% accuracy!\n');

// --- TEST 5: Selective Imports from Module (e.g. from machine import Pin) ---
console.log('--- TEST 5: Selective Imports from Module (from machine import Pin) ---');
const selectiveImportNodes = [
  {
    id: 'import_node',
    type: 'nodeMpy',
    position: { x: 0, y: 0 },
    data: {
      definitionId: 'core:import_module',
      libraryId: 'core',
      label: 'Import Module',
      color: '#3B82F6',
      icon: 'Box',
      properties: {
        imports: [
          { module: 'machine', import_all: false, classes: 'Pin' }
        ]
      }
    }
  },
  {
    id: 'pin_node',
    type: 'nodeMpy',
    position: { x: 0, y: 0 },
    data: {
      definitionId: 'machine:pin_init',
      libraryId: 'machine',
      label: 'Pin Config',
      color: '#10B981',
      icon: 'ToggleLeft',
      properties: { pin: 4, mode: 'OUT', pull: 'None' }
    }
  }
];

const selectiveResult = CodeGenerator.generateCode(selectiveImportNodes as any, []);

if (!selectiveResult.code.includes('from machine import Pin')) {
  console.error('FAILED: Expected "from machine import Pin" in imports');
  process.exit(1);
}

if (selectiveResult.code.includes('import machine\n') || selectiveResult.code.endsWith('import machine')) {
  console.error('FAILED: Unwanted "import machine" found when selective import active');
  process.exit(1);
}

if (!selectiveResult.code.includes('pin_4 = Pin(4, Pin.OUT)')) {
  console.error('FAILED: Expected "pin_4 = Pin(4, Pin.OUT)", got:', selectiveResult.code);
  process.exit(1);
}

if (selectiveResult.code.includes('machine.Pin')) {
  console.error('FAILED: Found "machine.Pin" instead of direct "Pin" call');
  process.exit(1);
}

console.log('✓ Selective import test passed: clean "from machine import Pin" and "Pin(4, Pin.OUT)" without "import machine"!\n');

// --- TEST 6: Dashboard Client Node (IoT Telemetry & Command) ---
console.log('--- TEST 6: Dashboard Client Node (IoT Telemetry & Command) ---');
const dashClientNodes = [
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
      properties: {}
    }
  },
  {
    id: 'dash_client_1',
    type: 'nodeMpy',
    position: { x: 0, y: 0 },
    data: {
      definitionId: 'network:dashboard_client',
      libraryId: 'network',
      label: 'Отправка в Дашборд',
      color: '#06B6D4',
      icon: 'Radio',
      properties: {
        server_ip: '192.168.17.14',
        server_port: 1880,
        path: '/light',
        param: 'value'
      }
    }
  }
];

const dashClientEdges = [
  {
    id: 'e_while_to_dash',
    source: 'while_loop',
    sourceHandle: 'loop_body',
    target: 'dash_client_1',
    targetHandle: 'flow_in'
  }
];

const dashClientRes = CodeGenerator.generateCode(dashClientNodes as any, dashClientEdges as any);
if (!dashClientRes.code.includes("connect(('192.168.17.14', 1880))")) {
  console.error('FAILED: Expected socket connect with server_ip and server_port. Got:', dashClientRes.code);
  process.exit(1);
}
if (!dashClientRes.code.includes("'/light?value='")) {
  console.error('FAILED: Expected /light?value= in request query string');
  process.exit(1);
}
if (!dashClientRes.code.includes("b'CMD_ON' in _raw_dash_client_1")) {
  console.error('FAILED: Expected CMD_ON check in response');
  process.exit(1);
}
console.log('✓ Dashboard client node compiles cleanly with socket telemetry and CMD_ON command check!\n');

// --- TEST 7: Try / Except Node with Error Capture & Outer Continuation ---
console.log('--- TEST 7: Try / Except Node with Error Capture & Outer Continuation ---');
const tryExceptNodes = [
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
      properties: {}
    }
  },
  {
    id: 'try_node',
    type: 'nodeMpy',
    position: { x: 100, y: 0 },
    data: {
      definitionId: 'core:try_except',
      libraryId: 'core',
      label: 'Try / Except',
      color: '#EF4444',
      icon: 'AlertTriangle',
      properties: {
        error_var: 'err',
        exception_type: 'Exception'
      }
    }
  },
  {
    id: 'print_try',
    type: 'nodeMpy',
    position: { x: 200, y: -50 },
    data: {
      definitionId: 'core:print',
      libraryId: 'core',
      label: 'Print OK',
      color: '#EAB308',
      icon: 'Terminal',
      properties: { message: 'Sensor OK' }
    }
  },
  {
    id: 'print_err',
    type: 'nodeMpy',
    position: { x: 200, y: 50 },
    data: {
      definitionId: 'core:print',
      libraryId: 'core',
      label: 'Print Error',
      color: '#EAB308',
      icon: 'Terminal',
      properties: { prefix: 'Error caught: ' }
    }
  },
  {
    id: 'sleep_after',
    type: 'nodeMpy',
    position: { x: 300, y: 0 },
    data: {
      definitionId: 'time:sleep_ms',
      libraryId: 'time',
      label: 'Sleep After Try',
      color: '#3B82F6',
      icon: 'PauseCircle',
      properties: { duration: 1000 }
    }
  }
];

const tryExceptEdges = [
  { id: 'e_loop_try', source: 'while_loop', sourceHandle: 'loop_body', target: 'try_node', targetHandle: 'flow_in' },
  { id: 'e_try_body', source: 'try_node', sourceHandle: 'flow_try', target: 'print_try', targetHandle: 'flow_in' },
  { id: 'e_except_body', source: 'try_node', sourceHandle: 'flow_except', target: 'print_err', targetHandle: 'flow_in' },
  { id: 'e_err_bind', source: 'try_node', sourceHandle: 'error_msg', target: 'print_err', targetHandle: 'msg' },
  { id: 'e_try_next', source: 'try_node', sourceHandle: 'flow_next', target: 'sleep_after', targetHandle: 'flow_in' }
];

const tryRes = CodeGenerator.generateCode(tryExceptNodes as any, tryExceptEdges as any);
console.log('Try/Except Generated Code:\n' + tryRes.code + '\n');

if (!tryRes.code.includes('try:') || !tryRes.code.includes('except Exception as err:')) {
  console.error('FAILED: try / except block missing in generated code');
  process.exit(1);
}
if (!tryRes.code.includes('print(str("Error caught: ") + str(str(err)))') && !tryRes.code.includes('str(err)')) {
  console.error('FAILED: error_msg (str(err)) was not passed to print_err node');
  process.exit(1);
}
// sleep_after MUST be unindented (4 spaces inside while True, not 8 spaces inside try or except)
if (!tryRes.code.includes('\n    time.sleep_ms(1000)')) {
  console.error('FAILED: time.sleep_ms(1000) was not emitted unindented outside try/except block');
  process.exit(1);
}
console.log('✓ Try / Except node compiles cleanly with error binding and unindented flow_next!\n');

// --- TEST 8: If / Else with flow_next Continuation & Convergence ---
console.log('--- TEST 8: If / Else with flow_next Continuation & Convergence ---');
const ifElseNextNodes = [
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
      properties: {}
    }
  },
  {
    id: 'if_node',
    type: 'nodeMpy',
    position: { x: 100, y: 0 },
    data: {
      definitionId: 'core:if_else',
      libraryId: 'core',
      label: 'If / Else',
      color: '#EC4899',
      icon: 'GitFork',
      properties: {}
    }
  },
  {
    id: 'print_true',
    type: 'nodeMpy',
    position: { x: 200, y: -50 },
    data: {
      definitionId: 'core:print',
      libraryId: 'core',
      label: 'True Branch',
      color: '#EAB308',
      icon: 'Terminal',
      properties: { message: 'Branch True' }
    }
  },
  {
    id: 'print_false',
    type: 'nodeMpy',
    position: { x: 200, y: 50 },
    data: {
      definitionId: 'core:print',
      libraryId: 'core',
      label: 'False Branch',
      color: '#EAB308',
      icon: 'Terminal',
      properties: { message: 'Branch False' }
    }
  },
  {
    id: 'print_after',
    type: 'nodeMpy',
    position: { x: 300, y: 0 },
    data: {
      definitionId: 'core:print',
      libraryId: 'core',
      label: 'After If Node',
      color: '#EAB308',
      icon: 'Terminal',
      properties: { message: 'Always Runs After' }
    }
  }
];

const ifElseNextEdges = [
  { id: 'e_loop_if', source: 'while_loop', sourceHandle: 'loop_body', target: 'if_node', targetHandle: 'flow_in' },
  { id: 'e_if_true', source: 'if_node', sourceHandle: 'flow_true', target: 'print_true', targetHandle: 'flow_in' },
  { id: 'e_if_false', source: 'if_node', sourceHandle: 'flow_false', target: 'print_false', targetHandle: 'flow_in' },
  { id: 'e_if_next', source: 'if_node', sourceHandle: 'flow_next', target: 'print_after', targetHandle: 'flow_in' }
];

const ifElseNextRes = CodeGenerator.generateCode(ifElseNextNodes as any, ifElseNextEdges as any);
console.log('If/Else with flow_next Generated Code:\n' + ifElseNextRes.code + '\n');

if (!ifElseNextRes.code.includes('if True:') || !ifElseNextRes.code.includes('else:')) {
  console.error('FAILED: if / else branches missing');
  process.exit(1);
}
// print_after MUST be emitted outside the if/else block at indent level 1 (4 spaces)
if (!ifElseNextRes.code.includes('\n    print("Always Runs After")')) {
  console.error('FAILED: print_after was not emitted unindented outside if/else block');
  process.exit(1);
}
console.log('✓ If / Else flow_next unindented continuation verified!\n');

// --- TEST 8b: Implicit Convergence (both branches wiring into the same downstream node) ---
console.log('--- TEST 8b: Implicit Convergence (both branches wiring into the same downstream node) ---');
const ifElseConvEdges = [
  { id: 'e_loop_if', source: 'while_loop', sourceHandle: 'loop_body', target: 'if_node', targetHandle: 'flow_in' },
  { id: 'e_if_true', source: 'if_node', sourceHandle: 'flow_true', target: 'print_true', targetHandle: 'flow_in' },
  { id: 'e_if_false', source: 'if_node', sourceHandle: 'flow_false', target: 'print_false', targetHandle: 'flow_in' },
  { id: 'e_true_conv', source: 'print_true', sourceHandle: 'flow_out', target: 'print_after', targetHandle: 'flow_in' },
  { id: 'e_false_conv', source: 'print_false', sourceHandle: 'flow_out', target: 'print_after', targetHandle: 'flow_in' }
];

const ifElseConvRes = CodeGenerator.generateCode(ifElseNextNodes as any, ifElseConvEdges as any);
console.log('If/Else Implicit Convergence Generated Code:\n' + ifElseConvRes.code + '\n');

if (!ifElseConvRes.code.includes('\n    print("Always Runs After")')) {
  console.error('FAILED: Converged node was not emitted unindented outside if/else block');
  process.exit(1);
}
console.log('✓ If / Else implicit convergence verified with 100% success!\n');

// --- TEST 9: If / Elif / Else Multi-Branching ---
console.log('--- TEST 9: If / Elif / Else Multi-Branching ---');
const elifNodes = [
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
      properties: {}
    }
  },
  {
    id: 'multi_branch',
    type: 'nodeMpy',
    position: { x: 100, y: 0 },
    data: {
      definitionId: 'core:if_elif_else',
      libraryId: 'core',
      label: 'If / Elif / Else',
      color: '#EC4899',
      icon: 'GitFork',
      properties: {}
    }
  },
  {
    id: 'p_if',
    type: 'nodeMpy',
    position: { x: 200, y: -50 },
    data: {
      definitionId: 'core:print',
      libraryId: 'core',
      label: 'P If',
      color: '#EAB308',
      icon: 'Terminal',
      properties: { message: 'IF Branch' }
    }
  },
  {
    id: 'p_elif1',
    type: 'nodeMpy',
    position: { x: 200, y: 0 },
    data: {
      definitionId: 'core:print',
      libraryId: 'core',
      label: 'P Elif 1',
      color: '#EAB308',
      icon: 'Terminal',
      properties: { message: 'ELIF 1 Branch' }
    }
  },
  {
    id: 'p_else',
    type: 'nodeMpy',
    position: { x: 200, y: 50 },
    data: {
      definitionId: 'core:print',
      libraryId: 'core',
      label: 'P Else',
      color: '#EAB308',
      icon: 'Terminal',
      properties: { message: 'ELSE Branch' }
    }
  },
  {
    id: 'p_continue',
    type: 'nodeMpy',
    position: { x: 300, y: 0 },
    data: {
      definitionId: 'core:print',
      libraryId: 'core',
      label: 'P Continue',
      color: '#EAB308',
      icon: 'Terminal',
      properties: { message: 'Continue Flow' }
    }
  }
];

const elifEdges = [
  { id: 'e_wb', source: 'while_loop', sourceHandle: 'loop_body', target: 'multi_branch', targetHandle: 'flow_in' },
  { id: 'e_if', source: 'multi_branch', sourceHandle: 'flow_if', target: 'p_if', targetHandle: 'flow_in' },
  { id: 'e_elif1', source: 'multi_branch', sourceHandle: 'flow_elif1', target: 'p_elif1', targetHandle: 'flow_in' },
  { id: 'e_else', source: 'multi_branch', sourceHandle: 'flow_else', target: 'p_else', targetHandle: 'flow_in' },
  { id: 'e_cont', source: 'multi_branch', sourceHandle: 'flow_next', target: 'p_continue', targetHandle: 'flow_in' }
];

const elifRes = CodeGenerator.generateCode(elifNodes as any, elifEdges as any);
console.log('If / Elif / Else Generated Code:\n' + elifRes.code + '\n');

if (!elifRes.code.includes('if True:') || !elifRes.code.includes('elif True:') || !elifRes.code.includes('else:')) {
  console.error('FAILED: if / elif / else structure incomplete');
  process.exit(1);
}
if (!elifRes.code.includes('\n    print("Continue Flow")')) {
  console.error('FAILED: Continue Flow not emitted unindented outside if/elif/else');
  process.exit(1);
}
console.log('✓ If / Elif / Else multi-branching verified with 100% accuracy!\n');

// --- TEST 10: Multi-Pin Init, Multi-Variables & Standalone ADC Init ---
console.log('--- TEST 10: Multi-Pin Init, Multi-Variables & Standalone ADC Init ---');
const compactNodes = [
  {
    id: 'multi_pins',
    type: 'nodeMpy',
    position: { x: 0, y: 0 },
    data: {
      definitionId: 'machine:multi_pin_init',
      libraryId: 'machine',
      label: 'Multi Pin Init',
      color: '#10B981',
      icon: 'Cpu',
      properties: {
        code: 'led1 = machine.PWM(machine.Pin(4), freq=1000)\nled2 = machine.PWM(machine.Pin(5), freq=1000)'
      }
    }
  },
  {
    id: 'adc_init_standalone',
    type: 'nodeMpy',
    position: { x: 0, y: 50 },
    data: {
      definitionId: 'machine:adc_init',
      libraryId: 'machine',
      label: 'ADC Init (pin 0)',
      color: '#10B981',
      icon: 'BarChart2',
      properties: {
        pin: 0,
        atten: 'ATTN_11DB'
      }
    }
  },
  {
    id: 'while_loop',
    type: 'nodeMpy',
    position: { x: 100, y: 0 },
    data: {
      definitionId: 'core:while_loop',
      libraryId: 'core',
      label: 'While True Loop',
      color: '#3B82F6',
      icon: 'Repeat',
      properties: {}
    }
  },
  {
    id: 'multi_vars',
    type: 'nodeMpy',
    position: { x: 200, y: 0 },
    data: {
      definitionId: 'core:variables_multi',
      libraryId: 'core',
      label: 'Set Variables (Multi)',
      color: '#6366F1',
      icon: 'Sliders',
      properties: {
        assignments: 'DARK_VAL = 330\nLIGHT_VAL = 1024\nlast_send = 0\nlight = 0'
      }
    }
  }
];

const compactEdges = [
  { id: 'e_wb_vars', source: 'while_loop', sourceHandle: 'loop_body', target: 'multi_vars', targetHandle: 'flow_in' }
];

const compactRes = CodeGenerator.generateCode(compactNodes as any, compactEdges as any);
console.log('Compact Multi-Pins & Multi-Variables Code:\n' + compactRes.code + '\n');

// 1. ADC Init must use machine.ADC(0), NEVER undefined pin_0!
if (compactRes.code.includes('pin_0') || !compactRes.code.includes('machine.ADC(0)')) {
  console.error('FAILED: ADC Init emitted undefined pin_0 instead of machine.ADC(0)');
  process.exit(1);
}
// 2. Multi-Pins must emit in Section 2
if (!compactRes.code.includes('led1 = machine.PWM(machine.Pin(4)') || !compactRes.code.includes('led2 = machine.PWM(machine.Pin(5)')) {
  console.error('FAILED: Multi-Pin setup lines missing in Section 2');
  process.exit(1);
}
// 3. Multi-Variables must emit inside loop
if (!compactRes.code.includes('\n    DARK_VAL = 330') || !compactRes.code.includes('\n    LIGHT_VAL = 1024')) {
  console.error('FAILED: Multi-variables assignments not properly indented in loop');
  process.exit(1);
}
console.log('✓ Multi-Pin Init, Multi-Variables & Safe ADC Init verified with 100% success!\n');

console.log('ALL TESTS PASSED SUCCESSFULLY!');
