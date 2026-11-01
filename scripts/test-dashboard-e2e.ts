import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DashboardCodeGenerator } from '../src/compiler/dashboardCodeGenerator';
import { CodeGenerator } from '../src/compiler/codeGenerator';
import { LibraryRegistry } from '../src/registry/registryLoader';

const BASE = 'http://localhost:1880';
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

let failures = 0;
function check(name: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${ok ? '✓' : '✗'} ${name}${ok ? '' : `\n    ожидалось ${JSON.stringify(expected)}, получено ${JSON.stringify(actual)}`}`);
  if (!ok) failures++;
}

const node = (id: string, definitionId: string, properties: Record<string, unknown> = {}, y = 0) => ({
  id,
  type: 'nodeMpy',
  position: { x: 0, y },
  data: { definitionId, libraryId: definitionId.split(':')[0], label: id, color: '', icon: '', properties },
}) as any;
const wire = (source: string, sourceHandle: string, target: string, targetHandle: string) =>
  ({ id: `${source}.${sourceHandle}-${target}.${targetHandle}`, source, sourceHandle, target, targetHandle }) as any;

const nodes = [
  node('ep_temp', 'dashboard:http_endpoint', { path: '/temp', param_name: 'value' }),
  node('ep_light', 'dashboard:http_endpoint', { path: '/light', param_name: 'value' }),
  node('ep_light2', 'dashboard:http_endpoint', { path: '/light', param_name: 'val2' }),
  node('ep_custom', 'dashboard:http_endpoint', { path: '/custom', param_name: 'value' }),
  node('fn_double', 'dashboard:function', { code: 'return msg * 2;' }),
  node('g_temp', 'dashboard:gauge', { min: -20, max: 50 }),
  node('g_light', 'dashboard:gauge', {}),
  node('g_second', 'dashboard:gauge', {}),
  node('ch_light', 'dashboard:chart', { points: 3 }),
  node('txt', 'dashboard:text_display', { prefix: 'T: ' }),
  node('led', 'dashboard:led_indicator', {}),
  node('sw', 'dashboard:switch', { channel: 'relay', on_payload: 'RELAY_ON', off_payload: 'RELAY_OFF' }),
  node('sl', 'dashboard:slider', { channel: 'pwm', min: 0, max: 1023 }),
  node('btn_on', 'dashboard:button', { payload: 'START' }),
  node('btn_off', 'dashboard:button', { payload: 'STOP' }),
  node('resp', 'dashboard:http_response', { default_text: 'HELLO', status_code: 201 }),
];
const edges = [
  wire('ep_temp', 'value', 'fn_double', 'msg'),
  wire('fn_double', 'result', 'g_temp', 'value'),
  wire('ep_temp', 'value', 'txt', 'text'),
  wire('ep_light', 'value', 'g_light', 'value'),
  wire('ep_light', 'value', 'ch_light', 'value'),
  wire('ep_light2', 'value', 'g_second', 'value'),
  wire('sw', 'state', 'led', 'state'),
  wire('ep_custom', 'flow_out', 'resp', 'flow_in'),
];

async function testServer() {
  console.log('--- Настоящий сервер ---');
  const dir = mkdtempSync(join(tmpdir(), 'nodempy-e2e-'));
  const generated = DashboardCodeGenerator.generateCode(nodes, edges);
  writeFileSync(join(dir, 'server.ts'), generated.serverCode);
  writeFileSync(join(dir, 'dashboard.html'), generated.htmlCode);

  const server = spawn(process.execPath, ['--experimental-strip-types', '--no-warnings', 'server.ts'], { cwd: dir, stdio: ['ignore', 'ignore', 'pipe'] });
  let stderr = '';
  server.stderr.on('data', (chunk) => (stderr += chunk));

  try {
    let up = false;
    for (let i = 0; i < 40 && !up; i++) {
      try {
        await fetch(BASE + '/');
        up = true;
      } catch {
        await wait(250);
      }
    }
    if (!up) throw new Error(`Сервер не запустился: ${stderr}`);

    const esp = async (path: string) => {
      const res = await fetch(BASE + path);
      return { status: res.status, body: await res.text() };
    };
    const press = (id: string, value?: unknown) =>
      fetch(BASE + '/api/action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, value }) });
    const readState = async () => {
      const ctl = new AbortController();
      const res = await fetch(BASE + '/api/events', { signal: ctl.signal });
      const reader = res.body!.getReader();
      const { value } = await reader.read();
      ctl.abort();
      return JSON.parse(new TextDecoder().decode(value).replace(/^data: /, ''));
    };

    check('страница дашборда отдаётся', (await fetch(BASE + '/')).status, 200);
    await fetch(BASE + '/favicon.ico');
    check('запрос иконки браузером не считается запросом от ESP', (await readState()).unknownPath, null);

    await esp('/temp?value=25');
    await esp('/light?value=700&val2=42');
    let state = await readState();
    check('Function меняет значение по проводу (25 * 2)', state.widgets.g_temp, 50);
    check('второй эндпоинт попадает в свою шкалу', state.widgets.g_light, 700);
    check('второй параметр того же пути в свою шкалу', state.widgets.g_second, 42);
    check('текст подключён к температуре', state.widgets.txt, 25);
    check('неподключённых значений нет', Object.keys(state.widgets).includes('fn_double'), false);

    await esp('/light?value=1');
    await esp('/light?value=2');
    await esp('/light?value=3');
    state = await readState();
    check('график хранит заданное число точек', state.history.ch_light, [1, 2, 3]);

    check('неизвестный путь даёт 404', (await esp('/nonsense?value=1')).status, 404);
    state = await readState();
    check('неизвестный путь виден на странице', state.unknownPath, '/nonsense');

    check('до нажатий ESP получает начальные значения', JSON.parse((await esp('/temp?value=1')).body), { relay: 'RELAY_OFF', pwm: 0 });

    await press('sw', true);
    await press('sl', 500);
    check('реле и ШИМ не затирают друг друга', JSON.parse((await esp('/temp?value=1')).body), { relay: 'RELAY_ON', pwm: 500 });
    state = await readState();
    check('тумблер зажёг LED по проводу', state.widgets.led, true);

    await press('btn_on');
    await press('btn_off');
    check('последняя нажатая кнопка побеждает', JSON.parse((await esp('/temp?value=1')).body).buttons, 'STOP');

    const custom = await esp('/custom?value=1');
    check('нода HTTP Response задаёт ответ и код', custom, { status: 201, body: 'HELLO' });

    const post = await fetch(BASE + '/temp', { method: 'POST', body: JSON.stringify({ value: 10 }) });
    state = await readState();
    check('POST с JSON от http_post', [post.status, state.widgets.g_temp], [200, 20]);
    await fetch(BASE + '/temp', { method: 'POST', body: '7' });
    state = await readState();
    check('POST с простым числом от http_post', state.widgets.g_temp, 14);
  } finally {
    server.kill();
    await wait(200);
    rmSync(dir, { recursive: true, force: true });
  }
}

function testWarnings() {
  console.log('\n--- Предупреждения на холсте ---');
  const warnings = DashboardCodeGenerator.generateCode(
    [node('g', 'dashboard:gauge'), node('a', 'dashboard:switch', { channel: 'x' }), node('b', 'dashboard:slider', { channel: 'x' }), node('r', 'dashboard:http_response')],
    []
  ).nodeWarnings;
  check('шкала без провода', 'g' in warnings, true);
  check('занятый канал', 'b' in warnings, true);
  check('ответ без запроса', 'r' in warnings, true);

  const firmware = CodeGenerator.generateCode(
    [node('s', 'core:setup'), node('lost', 'core:print'), node('w1', 'core:while_loop'), node('w2', 'core:while_loop')],
    []
  ).nodeWarnings;
  check('нода без потока', 'lost' in firmware, true);
  check('второй While True', 'w2' in firmware, true);
}

function testFlowNext() {
  console.log('\n--- Порт «Далее» и генерация main.py ---');
  const constant = node('node_1000_1', 'core:constant', { data_type: 'number', num_val: 7 });
  const loop = node('node_1000_2', 'core:while_loop');
  const branch = node('node_1000_3', 'core:if_else');
  const inTrue = node('node_1000_4', 'core:print', { prefix: 'T' });
  const after = node('node_1000_5', 'core:print', { prefix: 'A' });
  const shared = CodeGenerator.generateCode([constant, loop, branch, inTrue, after], [
    wire(loop.id, 'loop_body', branch.id, 'flow_in'),
    wire(branch.id, 'flow_true', inTrue.id, 'flow_in'),
    wire(branch.id, 'flow_next', after.id, 'flow_in'),
    wire(constant.id, 'val', inTrue.id, 'msg'),
    wire(constant.id, 'val', after.id, 'msg'),
  ]).code;
  check('значение существует и после «Далее»', /\n {4}const_1 = 7\n {4}print\("A", const_1\)/.test(shared), true);
  check('в коде нет длинных id', shared.includes('node_1000'), false);

  const first = node('node_2000_2', 'core:print', { message: 'one' }, 10);
  const second = node('node_2000_3', 'core:print', { message: 'two' }, 20);
  const fan = CodeGenerator.generateCode([loop, first, second], [
    wire(loop.id, 'loop_body', second.id, 'flow_in'),
    wire(loop.id, 'loop_body', first.id, 'flow_in'),
  ]).code;
  check('один выход на две ноды: обе выполняются сверху вниз', fan.indexOf('"one"') > 0 && fan.indexOf('"one"') < fan.indexOf('"two"'), true);
}

function testTemplateConditions() {
  console.log('\n--- Условия в шаблонах нод ---');
  const code = (definitionId: string, props: Record<string, unknown>) =>
    CodeGenerator.generateCode([node('start', 'core:setup'), node('n', definitionId, props)], [wire('start', 'flow_out', 'n', 'flow_in')]).code;
  check('elif выбирает один вариант', code('st7735:clear', { color_preset: 'RED' }).match(/\.clear\(\w+\)/g), ['.clear(0xF800)']);
  check('else срабатывает', code('i2c_lcd:backlight', { enabled: false }).match(/hal_backlight_\w+/g), ['hal_backlight_off']);
  check('if срабатывает', code('i2c_lcd:backlight', { enabled: true }).match(/hal_backlight_\w+/g), ['hal_backlight_on']);
}

function testPythonSyntax() {
  console.log('\n--- Синтаксис main.py для всех нод ---');
  if (spawnSync('python', ['--version']).error) {
    console.log('Python не найден, проверка пропущена');
    return;
  }
  const dir = mkdtempSync(join(tmpdir(), 'nodempy-py-'));
  const file = join(dir, 'main.py');
  let total = 0;
  const broken: string[] = [];
  for (const lib of LibraryRegistry.getAllLibraries()) {
    if (lib.id === 'dashboard') continue;
    for (const def of lib.nodes) {
      total++;
      const props: Record<string, unknown> = {};
      def.properties.forEach((p) => (props[p.id] = p.defaultValue));
      const edge = def.inputs.some((i) => i.id === 'flow_in') ? [wire('start', 'flow_out', 'n', 'flow_in')] : [];
      writeFileSync(file, CodeGenerator.generateCode([node('start', 'core:setup'), { ...node('n', def.id, props), data: { ...node('n', def.id, props).data, libraryId: lib.id } }], edge).code);
      const result = spawnSync('python', ['-m', 'py_compile', file]);
      if (result.status !== 0) broken.push(def.id);
    }
  }
  rmSync(dir, { recursive: true, force: true });
  check(`все ${total} нод дают корректный Python`, broken, []);
}

await testServer();
testWarnings();
testFlowNext();
testTemplateConditions();
testPythonSyntax();

if (failures > 0) {
  console.error(`\nПРОВАЛЕНО ПРОВЕРОК: ${failures}`);
  process.exit(1);
}
console.log('\nВСЕ ПРОВЕРКИ ДАШБОРДА ПРОЙДЕНЫ');
