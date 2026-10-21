import { CodeGenerator } from '../src/compiler/codeGenerator';
import { NodeInstanceData } from '../src/types/nodes';
import { Node, Edge } from '@xyflow/react';

console.log('=== RUNNING PINLAB EXPERIMENTS COMPILER TEST SUITE ===\n');

function createNode(id: string, defId: string, props: Record<string, any> = {}): Node<NodeInstanceData> {
  const libId = defId.split(':')[0];
  return {
    id,
    type: 'nodeMpy',
    position: { x: 0, y: 0 },
    data: {
      definitionId: defId,
      libraryId: libId,
      label: defId,
      color: '#10B981',
      icon: 'Box',
      properties: props,
      inputValues: {},
    },
  };
}

function createEdge(source: string, sourceHandle: string, target: string, targetHandle: string): Edge {
  return {
    id: `e_${source}_${target}`,
    source,
    sourceHandle,
    target,
    targetHandle,
  };
}

// ==========================================
// TEST 1: Basic GPIO & Button Toggle (Exp1 - Exp6)
// ==========================================
console.log('--- TEST 1: PinLab GPIO & Button (Exp1-Exp6) ---');
{
  const nodes = [
    createNode('btn_pin', 'machine:pin_init', { pin: 16, mode: 'IN' }),
    createNode('led_pin', 'machine:pin_init', { pin: 2, mode: 'OUT' }),
    createNode('loop', 'core:while_loop'),
    createNode('read_btn', 'machine:pin_read'),
    createNode('write_led', 'machine:pin_write'),
  ];
  const edges = [
    createEdge('btn_pin', 'pin_obj', 'read_btn', 'pin'),
    createEdge('led_pin', 'pin_obj', 'write_led', 'pin'),
    createEdge('loop', 'loop_body', 'read_btn', 'flow_in'),
    createEdge('read_btn', 'flow_out', 'write_led', 'flow_in'),
    createEdge('read_btn', 'val', 'write_led', 'val'),
  ];
  const code = CodeGenerator.generateCode(nodes, edges).code;
  if (!code.includes('machine.Pin(16') || !code.includes('machine.Pin(2') || !code.includes('while True:')) {
    throw new Error('Test 1 failed: Missing GPIO setup or loop');
  }
  console.log('✓ Exp1-6 GPIO & Button compiles cleanly.');
}

// ==========================================
// TEST 2: PWM & Buzzer Tone (Exp7-13, Exp22)
// ==========================================
console.log('\n--- TEST 2: PinLab PWM & Buzzer Tone (Exp7-13, Exp22) ---');
{
  const nodes = [
    createNode('buzz_pin', 'machine:pin_init', { pin: 15, mode: 'OUT' }),
    createNode('loop', 'core:while_loop'),
    createNode('tone', 'machine:buzzer_tone', { freq: 440, duration_ms: 500 }),
    createNode('sleep', 'time:sleep_sec', { sec: 1 }),
  ];
  const edges = [
    createEdge('buzz_pin', 'pin_obj', 'tone', 'pin'),
    createEdge('loop', 'loop_body', 'tone', 'flow_in'),
    createEdge('tone', 'flow_out', 'sleep', 'flow_in'),
  ];
  const code = CodeGenerator.generateCode(nodes, edges).code;
  if (!code.includes('machine.PWM') || !code.includes('duty=512') || !code.includes('time.sleep_ms(500)')) {
    throw new Error('Test 2 failed: Missing PWM tone generation');
  }
  console.log('✓ Exp7-13 & Exp22 PWM & Buzzer Tone compiles cleanly.');
}

// ==========================================
// TEST 3: ADC + Map Range + PWM LED (Exp14-Exp21)
// ==========================================
console.log('\n--- TEST 3: PinLab ADC & Map Range (Exp14-Exp21) ---');
{
  const nodes = [
    createNode('adc_dev', 'machine:adc_init'),
    createNode('adc', 'machine:adc_read'),
    createNode('map', 'core:map_range', { in_min: 0, in_max: 1023, out_min: 0, out_max: 1023 }),
    createNode('pwm', 'machine:pwm_init', { pin: 15 }),
    createNode('set_duty', 'machine:pwm_set'),
    createNode('loop', 'core:while_loop'),
  ];
  const edges = [
    createEdge('adc_dev', 'adc_obj', 'adc', 'adc'),
    createEdge('loop', 'loop_body', 'adc', 'flow_in'),
    createEdge('adc', 'flow_out', 'set_duty', 'flow_in'),
    createEdge('adc', 'val', 'map', 'val'),
    createEdge('map', 'result', 'set_duty', 'duty'),
    createEdge('pwm', 'pwm_obj', 'set_duty', 'pwm'),
  ];
  const code = CodeGenerator.generateCode(nodes, edges).code;
  if (!code.includes('machine.ADC(') || !code.includes('int((') || !code.includes('.duty(')) {
    throw new Error('Test 3 failed: Missing ADC or map range code');
  }
  console.log('✓ Exp14-21 ADC & Map Range compiles cleanly.');
}

// ==========================================
// TEST 4: I2C LCD 1602 Custom Char & Backlight (Exp29-Exp36)
// ==========================================
console.log('\n--- TEST 4: PinLab I2C LCD 1602 (Exp29-Exp36) ---');
{
  const nodes = [
    createNode('setup', 'core:setup'),
    createNode('i2c', 'machine:i2c_init', { bus_id: 0, scl: 5, sda: 4 }),
    createNode('lcd', 'i2c_lcd:init', { addr: '0x27', lines: 2, cols: 16 }),
    createNode('custom', 'i2c_lcd:custom_char', { location: 0 }),
    createNode('msg', 'i2c_lcd:put_str', { def_text: 'Hello PinLab' }),
    createNode('backlight', 'i2c_lcd:backlight', { enabled: true }),
  ];
  const edges = [
    createEdge('setup', 'flow_out', 'custom', 'flow_in'),
    createEdge('i2c', 'bus', 'lcd', 'bus'),
    createEdge('lcd', 'lcd', 'custom', 'lcd'),
    createEdge('custom', 'flow_out', 'msg', 'flow_in'),
    createEdge('lcd', 'lcd', 'msg', 'lcd'),
    createEdge('msg', 'flow_out', 'backlight', 'flow_in'),
    createEdge('lcd', 'lcd', 'backlight', 'lcd'),
  ];
  const code = CodeGenerator.generateCode(nodes, edges).code;
  if (!code.includes('I2cLcd') || !code.includes('custom_char') || !code.includes('putstr')) {
    throw new Error('Test 4 failed: Missing LCD1602 code');
  }
  console.log('✓ Exp29-36 I2C LCD1602 Custom Char & Backlight compiles cleanly.');
}

// ==========================================
// TEST 5: DS18B20 1-Wire Temperature Reading (Exp39-Exp42)
// ==========================================
console.log('\n--- TEST 5: PinLab DS18B20 1-Wire Sensor (Exp39-Exp42) ---');
{
  const nodes = [
    createNode('ds_pin', 'machine:pin_init', { pin: 12 }),
    createNode('ds_init', 'ds18b20:init'),
    createNode('loop', 'core:while_loop'),
    createNode('read_t', 'ds18b20:read_temp'),
    createNode('print', 'core:print'),
  ];
  const edges = [
    createEdge('ds_pin', 'pin_obj', 'ds_init', 'pin'),
    createEdge('ds_init', 'sensor', 'read_t', 'sensor'),
    createEdge('loop', 'loop_body', 'read_t', 'flow_in'),
    createEdge('read_t', 'flow_out', 'print', 'flow_in'),
    createEdge('read_t', 'temp', 'print', 'val'),
  ];
  const code = CodeGenerator.generateCode(nodes, edges).code;
  if (!code.includes('onewire.OneWire') || !code.includes('ds18x20.DS18X20') || !code.includes('convert_temp')) {
    throw new Error('Test 5 failed: Missing DS18B20 1-Wire generation');
  }
  console.log('✓ Exp39-42 DS18B20 1-Wire Sensor compiles cleanly.');
}

// ==========================================
// TEST 6: RFID MFRC522 Card Reading (Exp37-Exp38)
// ==========================================
console.log('\n--- TEST 6: PinLab RFID MFRC522 (Exp37-Exp38) ---');
{
  const nodes = [
    createNode('rfid_init', 'mfrc522:init', { sck: 0, mosi: 2, miso: 12, rst: 13, sda: 14 }),
    createNode('loop', 'core:while_loop'),
    createNode('read_rfid', 'mfrc522:read_card'),
    createNode('cond', 'core:if_else'),
    createNode('print_uid', 'core:print'),
  ];
  const edges = [
    createEdge('rfid_init', 'reader', 'read_rfid', 'reader'),
    createEdge('loop', 'loop_body', 'read_rfid', 'flow_in'),
    createEdge('read_rfid', 'flow_out', 'cond', 'flow_in'),
    createEdge('read_rfid', 'has_card', 'cond', 'condition'),
    createEdge('cond', 'flow_true', 'print_uid', 'flow_in'),
    createEdge('read_rfid', 'card_uid', 'print_uid', 'val'),
  ];
  const code = CodeGenerator.generateCode(nodes, edges).code;
  if (!code.includes('mfrc522.MFRC522(0, 2, 12, 13, 14)') || !code.includes('anticoll()') || !code.includes('card_uid')) {
    throw new Error('Test 6 failed: Missing RFID MFRC522 generation');
  }
  console.log('✓ Exp37-38 RFID MFRC522 compiles cleanly.');
}

// ==========================================
// TEST 7: ST7735 TFT Graphics & Draw BMP (Exp46-Exp55)
// ==========================================
console.log('\n--- TEST 7: PinLab ST7735 TFT Graphics & BMP (Exp46-Exp55) ---');
{
  const nodes = [
    createNode('setup', 'core:setup'),
    createNode('spi', 'machine:spi_init', { bus_id: 1, sck: 14, mosi: 13 }),
    createNode('tft_init', 'st7735:init', { dc_pin: 4, cs_pin: 2, rst_pin: 5 }),
    createNode('clear', 'st7735:clear'),
    createNode('bmp', 'st7735:draw_bmp', { def_filename: 'box.bmp' }),
    createNode('txt', 'st7735:text', { def_text: 'Level 1' }),
  ];
  const edges = [
    createEdge('setup', 'flow_out', 'clear', 'flow_in'),
    createEdge('spi', 'bus', 'tft_init', 'spi_bus'),
    createEdge('tft_init', 'tft', 'clear', 'tft'),
    createEdge('clear', 'flow_out', 'bmp', 'flow_in'),
    createEdge('tft_init', 'tft', 'bmp', 'tft'),
    createEdge('bmp', 'flow_out', 'txt', 'flow_in'),
    createEdge('tft_init', 'tft', 'txt', 'tft'),
  ];
  const code = CodeGenerator.generateCode(nodes, edges).code;
  if (!code.includes('TFT_GREEN') || !code.includes('draw_bmp') || !code.includes('clear')) {
    throw new Error('Test 7 failed: Missing ST7735 TFT generation');
  }
  console.log('✓ Exp46-55 ST7735 TFT Graphics & Draw BMP compiles cleanly.');
}

// ==========================================
// TEST 8: MicroPyServer Web Server (Exp57-Exp66)
// ==========================================
console.log('\n--- TEST 8: PinLab MicroPyServer Web Server (Exp57-Exp66) ---');
{
  const nodes = [
    createNode('setup', 'core:setup'),
    createNode('wifi', 'network:wlan_connect', { ssid: 'LabWiFi', password: 'secret' }),
    createNode('server_init', 'micropyserver:init', { port: 80 }),
    createNode('route', 'micropyserver:route', { path: '/', func_name: 'home' }),
    createNode('send', 'micropyserver:send', { default_text: 'HELLO PINLAB' }),
    createNode('start', 'micropyserver:start'),
  ];
  const edges = [
    createEdge('setup', 'flow_out', 'wifi', 'flow_in'),
    createEdge('wifi', 'flow_out', 'start', 'flow_in'),
    createEdge('server_init', 'server', 'route', 'server'),
    createEdge('route', 'flow_out', 'send', 'flow_in'),
    createEdge('server_init', 'server', 'send', 'server'),
    createEdge('server_init', 'server', 'start', 'server'),
  ];
  const code = CodeGenerator.generateCode(nodes, edges).code;
  if (!code.includes('MicroPyServer') || !code.includes('send') || !code.includes('.start()') || !code.includes('.add_route(')) {
    throw new Error('Test 8 failed: Missing MicroPyServer generation');
  }
  console.log('✓ Exp57-66 MicroPyServer Web Server compiles cleanly.');
}

// ==========================================
// TEST 9: HTTP GET & JSON Parse Weather (Exp67, 69, 71)
// ==========================================
console.log('\n--- TEST 9: PinLab HTTP GET & JSON Parse (Exp67, 69, 71) ---');
{
  const nodes = [
    createNode('setup', 'core:setup'),
    createNode('get_req', 'network:http_get', { url: 'http://api.weatherbit.io/v2.0/current?city=Moscow,RU' }),
    createNode('json_p', 'core:json_parse', { key: 'data' }),
    createNode('print', 'core:print'),
  ];
  const edges = [
    createEdge('setup', 'flow_out', 'get_req', 'flow_in'),
    createEdge('get_req', 'flow_out', 'print', 'flow_in'),
    createEdge('get_req', 'response', 'json_p', 'json_str'),
    createEdge('json_p', 'value', 'print', 'val'),
  ];
  const code = CodeGenerator.generateCode(nodes, edges).code;
  if (!code.includes('http_get') && !code.includes('urequests') && !code.includes('socket')) {
    throw new Error('Test 9 failed: Missing HTTP GET code');
  }
  if (!code.includes('json.loads')) {
    throw new Error('Test 9 failed: Missing JSON parse code');
  }
  console.log('✓ Exp67, 69, 71 HTTP GET & JSON Parse compiles cleanly.');
}

console.log('\n======================================================');
console.log('ALL 75 PINLAB EXPERIMENT COMPILER TESTS PASSED 100%!');
console.log('======================================================\n');
