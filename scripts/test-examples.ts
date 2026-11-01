import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CodeGenerator } from '../src/compiler/codeGenerator';
import { DashboardCodeGenerator } from '../src/compiler/dashboardCodeGenerator';
import { createDashboardEngine } from '../src/compiler/dashboardEngine';
import { EXAMPLES, buildExampleProject } from '../src/store/examples';

const dir = mkdtempSync(join(tmpdir(), 'nodempy-examples-'));
let failures = 0;
const fail = (msg: string) => { console.log(`✗ ${msg}`); failures++; };

for (const example of EXAMPLES) {
  const project = buildExampleProject(example.id);
  for (const flow of project.flows) {
    const label = `${example.id} / ${flow.name}`;
    if (flow.mode === 'dashboard') {
      const result = DashboardCodeGenerator.generateCode(flow.nodes as any, flow.edges);
      const warnings = Object.values(result.nodeWarnings || {});
      if (warnings.length) fail(`${label}: ${warnings.join('; ')}`);
      const config = DashboardCodeGenerator.buildConfig(flow.nodes as any, flow.edges);
      const engine = createDashboardEngine(config);
      const reply = config.endpoints[0] && engine.request(config.endpoints[0].path, { value: '42' });
      if (!reply) fail(`${label}: сервер не отвечает на путь из дашборда`);
      else if (!warnings.length) console.log(`✓ ${label}`);
      continue;
    }
    const result = CodeGenerator.generateCode(flow.nodes as any, flow.edges);
    const warnings = Object.values(result.nodeWarnings);
    if (warnings.length) { fail(`${label}: ${warnings.join('; ')}`); continue; }
    const file = join(dir, `${example.id}.py`);
    writeFileSync(file, result.code);
    const py = spawnSync('python', ['-m', 'py_compile', file]);
    if (py.error) console.log(`- ${label}: Python не найден, синтаксис не проверен`);
    else if (py.status !== 0) fail(`${label}: ${py.stderr}`);
    else console.log(`✓ ${label}`);
    if (!result.code.includes('dashboard_sync(')) fail(`${label}: нет обмена с дашбордом`);
  }
}

rmSync(dir, { recursive: true, force: true });
if (failures) process.exit(1);
console.log('\nВСЕ ПРИМЕРЫ СОБИРАЮТСЯ');
