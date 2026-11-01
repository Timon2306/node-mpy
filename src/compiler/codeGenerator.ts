import { Edge, Node } from '@xyflow/react';
import { NodeInstanceData, extractImportsFromNode } from '../types/nodes';
import { LibraryRegistry } from '../registry/registryLoader';

export interface CompilerResult {
  code: string;
  importsCount: number;
  initsCount: number;
  errors: string[];
  nodeWarnings: Record<string, string>;
}

export class CodeGenerator {
  public static defaultServerIp = '192.168.1.100';

  private static idAliases = new Map<string, string>();

  private static assignIdAliases(nodes: Node<NodeInstanceData>[]) {
    this.idAliases = new Map();
    let counter = 1;
    for (const node of nodes) {
      if (/^node_\d+/.test(node.id)) this.idAliases.set(node.id, String(counter++));
    }
  }

  private static shortId(id: string): string {
    return this.idAliases.get(id) ?? id.replace(/[^a-zA-Z0-9]/g, '_');
  }

  public static generateCode(nodes: Node<NodeInstanceData>[], edges: Edge[]): CompilerResult {
    const errors: string[] = [];
    nodes = nodes.map(n =>
      n.data.definitionId === 'network:dashboard_client' && !String(n.data.properties?.server_ip || '').trim()
        ? { ...n, data: { ...n.data, properties: { ...n.data.properties, server_ip: this.defaultServerIp } } }
        : n
    );
    this.assignIdAliases(nodes);

    const nodeMap = new Map<string, Node<NodeInstanceData>>();
    nodes.forEach(n => nodeMap.set(n.id, n));

    const outputVarMap = new Map<string, string>();

    this.assignOutputVariables(nodes, outputVarMap);

    const generated = this.generateImports(nodes, outputVarMap);
    const { selectiveImports } = generated;
    const ownImports = nodes
      .filter(n => n.data.definitionId === 'core:python_block')
      .flatMap(n => this.splitBlock(String(n.data.properties?.code || '')).imports);
    const importsCode = [...new Set([...generated.importsCode.split('\n'), ...ownImports])].filter(l => l.trim()).join('\n');

    let initCode = this.generateInits(nodes, edges, nodeMap, outputVarMap, errors);

    let functionsCode = this.generateFunctions(nodes, edges, nodeMap, outputVarMap);

    let executionCode = this.generateExecution(nodes, edges, nodeMap, outputVarMap, errors);

    if (selectiveImports.size > 0) {
      initCode = this.applySelectiveImports(initCode, selectiveImports);
      functionsCode = this.applySelectiveImports(functionsCode, selectiveImports);
      executionCode = this.applySelectiveImports(executionCode, selectiveImports);
    }

    const sections = [
      '# Сгенерировано в Node-MPY',
      importsCode,
      initCode && `# --- Оборудование ---\n${initCode}`,
      functionsCode && `# --- Переменные и функции ---\n${functionsCode.trimEnd()}`,
      `# --- Программа ---\n${executionCode || 'while True:\n    pass'}`,
    ];
    const fullCode = sections.filter(Boolean).join('\n\n') + '\n';

    return {
      code: fullCode,
      importsCount: importsCode.split('\n').filter(Boolean).length,
      initsCount: initCode.split('\n').filter(Boolean).length,
      errors,
      nodeWarnings: this.collectNodeWarnings(nodes, edges),
    };
  }

  private static collectNodeWarnings(nodes: Node<NodeInstanceData>[], edges: Edge[]): Record<string, string> {
    const warnings: Record<string, string> = {};
    const defOf = (n: Node<NodeInstanceData>) => LibraryRegistry.getNodeDefinition(n.data.definitionId);
    const roots = nodes.filter(n => ['core:setup', 'core:while_loop', 'micropyserver:route'].includes(n.data.definitionId));

    const reached = new Set(roots.map(n => n.id));
    const queue = [...reached];
    while (queue.length > 0) {
      const id = queue.pop()!;
      const node = nodes.find(n => n.id === id);
      const flowPorts = (node && defOf(node)?.outputs.filter(o => o.type === 'flow').map(o => o.id)) || [];
      for (const edge of edges) {
        if (edge.source === id && flowPorts.includes(edge.sourceHandle || '') && !reached.has(edge.target)) {
          reached.add(edge.target);
          queue.push(edge.target);
        }
      }
    }

    const hasBus = nodes.some(n => ['machine:i2c_init', 'machine:spi_init'].includes(n.data.definitionId));
    for (const node of nodes) {
      const def = defOf(node);
      if (!def) continue;
      const takesFlow = def.inputs.some(i => i.type === 'flow');
      if (takesFlow && !reached.has(node.id)) {
        warnings[node.id] = 'Нода не подключена к потоку от Start или While True, в main.py её не будет';
      }
      const missingDevice = def.inputs.some(i => i.type === 'device' && !edges.some(e => e.target === node.id && e.targetHandle === i.id));
      const hasDevice = nodes.some(n => n.data.libraryId === node.data.libraryId && defOf(n)?.outputs.some(o => o.type === 'device'));
      if (missingDevice && !hasDevice) {
        warnings[node.id] = 'Устройство не подключено: добавьте и соедините ноду инициализации';
      }
      const needsBus = def.inputs.some(i => i.type === 'bus' && !edges.some(e => e.target === node.id && e.targetHandle === i.id));
      if (needsBus && !hasBus) {
        warnings[node.id] = 'Нет шины I2C или SPI: добавьте ноду инициализации шины';
      }
    }

    const loops = nodes.filter(n => n.data.definitionId === 'core:while_loop');
    for (const extra of loops.slice(1)) {
      warnings[extra.id] = 'В программе может быть только один While True, эта нода не сработает';
    }

    return warnings;
  }

  private static assignOutputVariables(
    nodes: Node<NodeInstanceData>[],
    outputVarMap: Map<string, string>
  ) {
    let pinCounter = 1;

    for (const node of nodes) {
      const def = LibraryRegistry.getNodeDefinition(node.data.definitionId);
      if (!def) continue;

      const cleanId = this.shortId(node.id);
      const props = node.data.properties || {};

      for (const out of def.outputs) {
        const key = `${node.id}:${out.id}`;

        if (out.type === 'flow') {
          continue;
        }

        if (node.data.definitionId === 'core:variable_set' || node.data.definitionId === 'core:variable_get') {
          outputVarMap.set(key, String(props.var_name || 'x'));
          continue;
        }

        if (node.data.definitionId === 'machine:pin_init') {
          const pinNum = props.pin ?? pinCounter++;
          outputVarMap.set(key, `pin_${pinNum}`);
          continue;
        }

        if (def.codeTemplate.outputVariables && def.codeTemplate.outputVariables[out.id]) {
          let varPattern = def.codeTemplate.outputVariables[out.id];
          varPattern = varPattern.replace(/\{\{id\}\}/g, cleanId);
          for (const pKey of Object.keys(props)) {
            varPattern = varPattern.replace(new RegExp(`\\{\\{props\\.${pKey}\\}\\}`, 'g'), String(props[pKey]));
          }
          for (const pDef of def.properties) {
            const val = props[pDef.id] !== undefined ? props[pDef.id] : pDef.defaultValue;
            varPattern = varPattern.replace(new RegExp(`\\{\\{props\\.${pDef.id}\\}\\}`, 'g'), String(val));
          }
          outputVarMap.set(key, varPattern);
          continue;
        }

        outputVarMap.set(key, `${out.id}_${cleanId}`);
      }
    }
  }

  private static generateImports(
    nodes: Node<NodeInstanceData>[],
    _outputVarMap: Map<string, string>
  ): { importsCode: string; selectiveImports: Map<string, Set<string>> } {
    const importSet = new Set<string>();
    const selectiveImports = new Map<string, Set<string>>();
    const explicitlyImportedModules = new Set<string>();

    for (const node of nodes) {
      if (node.data.definitionId === 'core:import_module') {
        const importList = extractImportsFromNode(node.data.properties);
        for (const item of importList) {
          const mod = item.module?.trim();
          if (!mod) continue;
          explicitlyImportedModules.add(mod);

          if (!item.import_all && item.classes) {
            const classSet = selectiveImports.get(mod) || new Set<string>();
            item.classes.split(',').forEach((c) => {
              const trimmed = c.trim();
              if (trimmed) classSet.add(trimmed);
            });
            selectiveImports.set(mod, classSet);
          }
        }
      }
    }

    for (const node of nodes) {
      const defId = node.data.definitionId;
      const libId = node.data.libraryId;

      if (selectiveImports.has(libId)) {
        const classSet = selectiveImports.get(libId)!;
        if (libId === 'machine') {
          if (defId.includes('pin')) classSet.add('Pin');
          if (defId.includes('pwm') || defId === 'machine:tone') {
            classSet.add('PWM');
            if (defId === 'machine:tone') classSet.add('Pin');
          }
          if (defId.includes('adc')) classSet.add('ADC');
          if (defId.includes('i2c')) {
            classSet.add('I2C');
            classSet.add('Pin');
          }
          if (defId.includes('spi')) {
            classSet.add('SPI');
            classSet.add('Pin');
          }
          if (defId.includes('timer')) classSet.add('Timer');
          if (defId.includes('reset')) classSet.add('reset');
          if (defId.includes('deep_sleep')) classSet.add('deepsleep');
        } else if (libId === 'dht') {
          if (node.data.properties?.model === 'DHT11') classSet.add('DHT11');
          else classSet.add('DHT22');
        } else if (libId === 'time') {
          if (defId === 'time:sleep_ms') classSet.add('sleep_ms');
          if (defId === 'time:sleep_s') classSet.add('sleep');
          if (defId === 'time:sleep_us') classSet.add('sleep_us');
          if (defId === 'time:ticks_ms') classSet.add('ticks_ms');
          if (defId === 'time:ticks_diff') classSet.add('ticks_diff');
        }
      }
    }

    for (const [mod, classSet] of selectiveImports.entries()) {
      if (classSet.size > 0) {
        const sorted = Array.from(classSet).sort().join(', ');
        importSet.add(`from ${mod} import ${sorted}`);
      }
    }

    for (const node of nodes) {
      const def = LibraryRegistry.getNodeDefinition(node.data.definitionId);
      if (def?.codeTemplate?.imports) {
        for (const imp of def.codeTemplate.imports) {
          if (imp.trim()) {
            const isForSelective = Array.from(selectiveImports.keys()).some(
              (mod) => imp.trim() === `import ${mod}` || imp.trim().startsWith(`from ${mod} import`)
            );
            if (!isForSelective) {
              importSet.add(imp.trim());
            }
          }
        }
      }

      if (node.data.definitionId === 'core:import_module') {
        const importList = extractImportsFromNode(node.data.properties);
        for (const item of importList) {
          const mod = item.module?.trim();
          if (!mod) continue;

          if (item.import_all !== false) {
            const lib = LibraryRegistry.getLibraryById(mod);
            if (lib && lib.importSnippet) {
              this.addImportSnippet(importSet, lib.importSnippet);
            } else {
              importSet.add(`import ${mod}`);
            }
          }
        }
      } else {
        const libId = node.data.libraryId;
        if (!selectiveImports.has(libId) && !explicitlyImportedModules.has(libId)) {
          const lib = LibraryRegistry.getLibraryById(libId);
          if (lib && lib.id !== 'core' && lib.importSnippet) {
            this.addImportSnippet(importSet, lib.importSnippet);
          }
        }
      }

      if (node.data.definitionId === 'network:http_get' || node.data.definitionId === 'network:http_post') {
        importSet.add('import urequests');
        if (node.data.properties?.payload_format === 'json') {
          importSet.add('import ujson');
        }
      }
    }

    const all = Array.from(importSet);
    const plain = all.filter(i => !i.includes('\n')).sort((a, b) => {
      const kind = Number(a.startsWith('from ')) - Number(b.startsWith('from '));
      return kind || a.localeCompare(b);
    });
    const blocks = all.filter(i => i.includes('\n'));

    return {
      importsCode: [...plain, ...blocks].join('\n'),
      selectiveImports,
    };
  }

  private static addImportSnippet(importSet: Set<string>, snippet: string) {
    if (/^\s/m.test(snippet.trim())) {
      importSet.add(snippet.trim());
      return;
    }
    snippet.split('\n').forEach((line) => {
      if (line.trim()) importSet.add(line.trim());
    });
  }

  private static applySelectiveImports(
    code: string,
    selectiveImports: Map<string, Set<string>>
  ): string {
    let result = code;
    for (const [mod, classSet] of selectiveImports.entries()) {
      for (const cls of classSet) {
        const reg = new RegExp(`\\b${mod}\\.${cls}\\b`, 'g');
        result = result.replace(reg, cls);
      }
    }
    return result;
  }

  private static generateInits(
    nodes: Node<NodeInstanceData>[],
    edges: Edge[],
    nodeMap: Map<string, Node<NodeInstanceData>>,
    outputVarMap: Map<string, string>,
    _errors: string[]
  ): string {
    const initNodes = nodes.filter(n => {
      const def = LibraryRegistry.getNodeDefinition(n.data.definitionId);
      return def && def.codeTemplate.section === 'init';
    });

    const initializedPins = new Set<number>();
    for (const node of nodes) {
      if (node.data.definitionId === 'machine:pin_init') {
        const p = Number(node.data.properties?.pin ?? 2);
        initializedPins.add(p);
      }
    }

    const implicitPinLines: string[] = [];
    for (const node of nodes) {
      if (node.data.properties?.pin !== undefined && node.data.definitionId !== 'machine:pin_init' && node.data.definitionId !== 'machine:adc_init') {
        const pinNum = Number(node.data.properties.pin);
        const pinEdge = edges.find(e => e.target === node.id && e.targetHandle === 'pin');
        if (!pinEdge && !initializedPins.has(pinNum)) {
          initializedPins.add(pinNum);
          implicitPinLines.push(`pin_${pinNum} = machine.Pin(${pinNum}, machine.Pin.OUT)`);
        }
      }
    }

    if (initNodes.length === 0 && implicitPinLines.length === 0) return '';

    const dependencies = new Map<string, Set<string>>();
    initNodes.forEach(n => dependencies.set(n.id, new Set()));

    for (const edge of edges) {
      if (dependencies.has(edge.target) && dependencies.has(edge.source)) {
        dependencies.get(edge.target)!.add(edge.source);
      }
    }

    const sortedNodeIds: string[] = [];
    const visited = new Set<string>();

    const visit = (id: string, path = new Set<string>()) => {
      if (visited.has(id)) return;
      if (path.has(id)) return;
      path.add(id);

      const deps = dependencies.get(id);
      if (deps) {
        deps.forEach(depId => visit(depId, new Set(path)));
      }

      visited.add(id);
      sortedNodeIds.push(id);
    };

    initNodes.forEach(n => visit(n.id));

    const lines: string[] = [...implicitPinLines];
    for (const id of sortedNodeIds) {
      const node = nodeMap.get(id);
      if (!node) continue;
      const rendered = this.renderNodeTemplate(node, edges, outputVarMap, nodeMap, nodes);
      if (rendered) {
        lines.push(rendered);
      }
    }

    const referencedPins = new Set<number>();
    for (const l of lines) {
      const matches = l.matchAll(/\bpin_(\d+)\b/g);
      for (const m of matches) {
        referencedPins.add(Number(m[1]));
      }
    }
    const missingPins: string[] = [];
    for (const p of referencedPins) {
      if (!initializedPins.has(p)) {
        initializedPins.add(p);
        missingPins.push(`pin_${p} = machine.Pin(${p}, machine.Pin.OUT)`);
      }
    }
    lines.unshift(...missingPins);

    return lines.join('\n');
  }

  private static splitBlock(code: string): { imports: string[]; rest: string } {
    const imports: string[] = [];
    const rest: string[] = [];
    for (const line of code.split('\n')) {
      (/^(import|from)\s+\S/.test(line) ? imports : rest).push(line.trimEnd());
    }
    return { imports, rest: rest.join('\n').trim() };
  }

  private static generateFunctions(
    nodes: Node<NodeInstanceData>[],
    edges: Edge[],
    nodeMap: Map<string, Node<NodeInstanceData>>,
    outputVarMap: Map<string, string>
  ): string {
    const lines: string[] = [];

    const helpers = new Set<string>();
    for (const node of nodes) {
      LibraryRegistry.getNodeDefinition(node.data.definitionId)?.codeTemplate.helpers?.forEach(h => helpers.add(h.trimEnd()));
    }
    helpers.forEach(h => lines.push(`${h}\n`));

    const fnNodes = nodes.filter(n => n.data.definitionId === 'core:custom_function');
    for (const node of fnNodes) {
      const name = node.data.properties?.func_name || 'custom_fn';
      const params = node.data.properties?.params || '';
      const rawCode = node.data.properties?.code || '    pass';

      const formattedBody = rawCode
        .split('\n')
        .map((l: string) => (l.startsWith('    ') ? l : `    ${l}`))
        .join('\n');

      lines.push(`def ${name}(${params}):\n${formattedBody}\n`);
    }

    for (const node of nodes.filter(n => n.data.definitionId === 'core:python_block')) {
      const code = this.splitBlock(String(node.data.properties?.code || '')).rest;
      if (code) lines.push(`${code}
`);
    }

    const routeNodes = nodes.filter(n => n.data.definitionId === 'micropyserver:route');
    for (const node of routeNodes) {
      const cleanId = this.shortId(node.id);
      const funcName = `${node.data.properties?.func_name || 'handle_route'}_${cleanId}`;
      const paramsVar = outputVarMap.get(`${node.id}:params`) || `params_${cleanId}`;
      const reqVar = outputVarMap.get(`${node.id}:request`) || `req_${cleanId}`;

      const routeFlow = this.traverseFlow(node.id, 'flow_out', edges, nodeMap, outputVarMap, 1, new Set());
      const bodyLines = [
        `    ${reqVar} = request`,
        `    ${paramsVar} = params`,
        ...(routeFlow.length > 0 ? routeFlow : ['    pass'])
      ];
      lines.push(`def ${funcName}(request, params):\n${bodyLines.join('\n')}\n`);
    }

    return lines.join('\n');
  }

  private static generateExecution(
    nodes: Node<NodeInstanceData>[],
    edges: Edge[],
    nodeMap: Map<string, Node<NodeInstanceData>>,
    outputVarMap: Map<string, string>,
    errors: string[]
  ): string {
    const lines: string[] = [];

    const routeNodes = nodes.filter(n => n.data.definitionId === 'micropyserver:route');
    if (routeNodes.length > 0) {
      lines.push('# Маршруты веб-сервера');
      for (const rNode of routeNodes) {
        const cleanId = this.shortId(rNode.id);
        const funcName = `${rNode.data.properties?.func_name || 'handle_route'}_${cleanId}`;
        const path = rNode.data.properties?.path || '/';

        const srvEdge = edges.find(e => e.target === rNode.id && e.targetHandle === 'server');
        let srvVar = '';
        if (srvEdge) {
          srvVar = outputVarMap.get(`${srvEdge.source}:${srvEdge.sourceHandle}`) || '';
        }
        if (!srvVar) {
          const srvNode = nodes.find(n => n.data.definitionId === 'micropyserver:init');
          if (srvNode) {
            srvVar = outputVarMap.get(`${srvNode.id}:server`) || `server_${this.shortId(srvNode.id)}`;
          } else {
            srvVar = 'server';
          }
        }
        lines.push(`${srvVar}.add_route('${path}', ${funcName})`);
      }
      lines.push('');
    }

    const startNode = nodes.find(n => n.data.definitionId === 'core:setup');
    if (startNode) {
      const startFlow = this.traverseFlow(startNode.id, 'flow_out', edges, nodeMap, outputVarMap, 0, new Set());
      if (startFlow.length > 0) {
        lines.push('# Запуск');
        lines.push(...startFlow);
        lines.push('');
      }
    }

    const loopNode = nodes.find(n => n.data.definitionId === 'core:while_loop');
    if (loopNode) {
      lines.push('while True:');
      const loopBody = this.traverseFlow(loopNode.id, 'loop_body', edges, nodeMap, outputVarMap, 1, new Set());
      if (loopBody.length > 0) {
        lines.push(...loopBody);
      } else {
        lines.push('    pass');
      }
    } else {
      const hasServerInit = nodes.some(n => n.data.definitionId === 'micropyserver:init');
      const hasServerStartInFlow = nodes.some(n => n.data.definitionId === 'micropyserver:start');
      if (hasServerInit && !hasServerStartInFlow) {
        const srvNode = nodes.find(n => n.data.definitionId === 'micropyserver:init')!;
        const srvVar = outputVarMap.get(`${srvNode.id}:server`) || `server_${this.shortId(srvNode.id)}`;
        lines.push('# Запуск MicroPyServer');
        lines.push(`${srvVar}.start()`);
      } else {
        lines.push('while True:\n    pass');
      }
    }

    return lines.join('\n');
  }

  private static isDataNode(node: Node<NodeInstanceData>): boolean {
    const def = LibraryRegistry.getNodeDefinition(node.data.definitionId);
    if (!def) return false;
    if (def.codeTemplate.section === 'init' || def.codeTemplate.section === 'imports' || def.codeTemplate.section === 'functions') {
      return false;
    }
    if (
      node.data.definitionId === 'core:setup' ||
      node.data.definitionId === 'core:while_loop' ||
      node.data.definitionId === 'core:if_else' ||
      node.data.definitionId === 'core:if_elif_else' ||
      node.data.definitionId === 'core:try_except' ||
      node.data.definitionId === 'core:for_range'
    ) {
      return false;
    }
    return !def.outputs.some(o => o.type === 'flow');
  }

  private static emitDataDependencies(
    node: Node<NodeInstanceData>,
    edges: Edge[],
    nodeMap: Map<string, Node<NodeInstanceData>>,
    outputVarMap: Map<string, string>,
    emittedDataNodes: Set<string>,
    indent: string
  ): string[] {
    const lines: string[] = [];
    const incomingEdges = edges.filter(e => e.target === node.id);

    for (const inEdge of incomingEdges) {
      const srcNode = nodeMap.get(inEdge.source);
      if (!srcNode) continue;

      if (this.isDataNode(srcNode) && !emittedDataNodes.has(srcNode.id)) {
        const subPrereqs = this.emitDataDependencies(srcNode, edges, nodeMap, outputVarMap, emittedDataNodes, indent);
        lines.push(...subPrereqs);

        const rendered = this.renderNodeTemplate(srcNode, edges, outputVarMap, nodeMap);
        if (rendered) {
          rendered.split('\n').forEach(l => {
            if (l.trim()) lines.push(`${indent}${l}`);
          });
        }
        emittedDataNodes.add(srcNode.id);
      }
    }

    return lines;
  }

  private static findConvergenceNode(
    startNodeId: string,
    branchHandles: string[],
    edges: Edge[]
  ): string | undefined {
    const branchPaths: string[][] = [];

    for (const handle of branchHandles) {
      const startEdge = edges.find(e => e.source === startNodeId && e.sourceHandle === handle);
      if (!startEdge) continue;

      const path: string[] = [];
      const visited = new Set<string>();
      let curr = startEdge.target;

      while (curr && !visited.has(curr)) {
        visited.add(curr);
        path.push(curr);
        const nextEdge = edges.find(e => e.source === curr && (!e.sourceHandle || e.sourceHandle === 'flow_out' || e.sourceHandle === 'flow_next'));
        if (!nextEdge) break;
        curr = nextEdge.target;
      }

      if (path.length > 0) {
        branchPaths.push(path);
      }
    }

    if (branchPaths.length < 2) {
      return undefined;
    }

    for (const nodeId of branchPaths[0]) {
      const inAll = branchPaths.slice(1).every(p => p.includes(nodeId));
      if (inAll) {
        return nodeId;
      }
    }

    return undefined;
  }

  private static traverseFlow(
    startNodeId: string,
    sourceHandle: string,
    edges: Edge[],
    nodeMap: Map<string, Node<NodeInstanceData>>,
    outputVarMap: Map<string, string>,
    indentLevel: number,
    visited: Set<string>,
    emittedDataNodes: Set<string> = new Set(),
    stopNodeId?: string
  ): string[] {
    const result: string[] = [];
    const indent = '    '.repeat(indentLevel);

    let currentHandle = sourceHandle;
    let currentNodeId = startNodeId;

    while (true) {
      const outgoing = edges.filter(e => e.source === currentNodeId && (!e.sourceHandle || e.sourceHandle === currentHandle));

      if (outgoing.length > 1) {
        const byPosition = [...outgoing].sort((a, b) => (nodeMap.get(a.target)?.position?.y ?? 0) - (nodeMap.get(b.target)?.position?.y ?? 0));
        for (const branch of byPosition) {
          const onlyThisBranch = edges.filter(e => e === branch || !outgoing.includes(e));
          result.push(...this.traverseFlow(currentNodeId, currentHandle, onlyThisBranch, nodeMap, outputVarMap, indentLevel, new Set(visited), emittedDataNodes, stopNodeId));
        }
        break;
      }

      const edge = outgoing[0];
      if (!edge) break;

      const nextNode = nodeMap.get(edge.target);
      if (!nextNode) break;

      if (stopNodeId && nextNode.id === stopNodeId) {
        break;
      }

      if (nextNode.data.definitionId === 'core:while_loop') {
        break;
      }

      if (visited.has(`${nextNode.id}:${edge.targetHandle}`)) {
        break;
      }
      visited.add(`${nextNode.id}:${edge.targetHandle}`);

      const prereqs = this.emitDataDependencies(nextNode, edges, nodeMap, outputVarMap, emittedDataNodes, indent);
      result.push(...prereqs);

      if (nextNode.data.definitionId === 'core:if_else') {
        const condEdge = edges.find(e => e.target === nextNode.id && (e.targetHandle === 'condition' || e.targetHandle === 'cond_if'));
        const condVar = condEdge ? (outputVarMap.get(`${condEdge.source}:${condEdge.sourceHandle}`) || 'True') : 'True';

        let nextEdge = edges.find(e => e.source === nextNode.id && (e.sourceHandle === 'flow_next' || e.sourceHandle === 'flow_out'));
        let branchStopNodeId = nextEdge ? nextEdge.target : undefined;

        if (!branchStopNodeId) {
          const commonTarget = this.findConvergenceNode(nextNode.id, ['flow_true', 'flow_elif', 'flow_false'], edges);
          if (commonTarget) {
            branchStopNodeId = commonTarget;
          }
        }

        result.push(`${indent}if ${condVar}:`);
        const trueBranch = this.traverseFlow(nextNode.id, 'flow_true', edges, nodeMap, outputVarMap, indentLevel + 1, new Set(visited), new Set(emittedDataNodes), branchStopNodeId);
        result.push(...(trueBranch.length ? trueBranch : [`${indent}    pass`]));

        const hasElifEdge = edges.some(e => e.source === nextNode.id && e.sourceHandle === 'flow_elif');
        if (hasElifEdge) {
          const elifCondEdge = edges.find(e => e.target === nextNode.id && e.targetHandle === 'cond_elif');
          const elifCondVar = elifCondEdge ? (outputVarMap.get(`${elifCondEdge.source}:${elifCondEdge.sourceHandle}`) || 'True') : 'True';
          result.push(`${indent}elif ${elifCondVar}:`);
          const elifBranch = this.traverseFlow(nextNode.id, 'flow_elif', edges, nodeMap, outputVarMap, indentLevel + 1, new Set(visited), new Set(emittedDataNodes), branchStopNodeId);
          result.push(...(elifBranch.length ? elifBranch : [`${indent}    pass`]));
        }

        const hasFalseEdge = edges.some(e => e.source === nextNode.id && e.sourceHandle === 'flow_false');
        if (hasFalseEdge) {
          result.push(`${indent}else:`);
          const falseBranch = this.traverseFlow(nextNode.id, 'flow_false', edges, nodeMap, outputVarMap, indentLevel + 1, new Set(visited), new Set(emittedDataNodes), branchStopNodeId);
          result.push(...(falseBranch.length ? falseBranch : [`${indent}    pass`]));
        }

        if (nextEdge) {
          currentNodeId = nextNode.id;
          currentHandle = nextEdge.sourceHandle || 'flow_next';
          continue;
        }

        if (branchStopNodeId) {
          const convergeEdge = edges.find(e => e.target === branchStopNodeId);
          if (convergeEdge) {
            currentNodeId = convergeEdge.source;
            currentHandle = convergeEdge.sourceHandle || 'flow_out';
            continue;
          }
        }

        break;
      }

      if (nextNode.data.definitionId === 'core:if_elif_else') {
        const condIfEdge = edges.find(e => e.target === nextNode.id && (e.targetHandle === 'cond_if' || e.targetHandle === 'condition'));
        const condIfVar = condIfEdge ? (outputVarMap.get(`${condIfEdge.source}:${condIfEdge.sourceHandle}`) || 'True') : 'True';

        let nextEdge = edges.find(e => e.source === nextNode.id && (e.sourceHandle === 'flow_next' || e.sourceHandle === 'flow_out'));
        let branchStopNodeId = nextEdge ? nextEdge.target : undefined;

        const branchList = ['flow_if', 'flow_elif1', 'flow_elif2', 'flow_elif3', 'flow_else'];
        if (!branchStopNodeId) {
          const commonTarget = this.findConvergenceNode(nextNode.id, branchList, edges);
          if (commonTarget) {
            branchStopNodeId = commonTarget;
          }
        }

        result.push(`${indent}if ${condIfVar}:`);
        const ifBranch = this.traverseFlow(nextNode.id, 'flow_if', edges, nodeMap, outputVarMap, indentLevel + 1, new Set(visited), new Set(emittedDataNodes), branchStopNodeId);
        result.push(...(ifBranch.length ? ifBranch : [`${indent}    pass`]));

        const elifBranches = [
          { handle: 'flow_elif1', cond: 'cond_elif1' },
          { handle: 'flow_elif2', cond: 'cond_elif2' },
          { handle: 'flow_elif3', cond: 'cond_elif3' },
        ];

        for (const eb of elifBranches) {
          const hasBranch = edges.some(e => e.source === nextNode.id && e.sourceHandle === eb.handle);
          if (hasBranch) {
            const ebCondEdge = edges.find(e => e.target === nextNode.id && e.targetHandle === eb.cond);
            const ebCondVar = ebCondEdge ? (outputVarMap.get(`${ebCondEdge.source}:${ebCondEdge.sourceHandle}`) || 'True') : 'True';
            result.push(`${indent}elif ${ebCondVar}:`);
            const ebBranch = this.traverseFlow(nextNode.id, eb.handle, edges, nodeMap, outputVarMap, indentLevel + 1, new Set(visited), new Set(emittedDataNodes), branchStopNodeId);
            result.push(...(ebBranch.length ? ebBranch : [`${indent}    pass`]));
          }
        }

        const hasElseBranch = edges.some(e => e.source === nextNode.id && e.sourceHandle === 'flow_else');
        if (hasElseBranch) {
          result.push(`${indent}else:`);
          const elseBranch = this.traverseFlow(nextNode.id, 'flow_else', edges, nodeMap, outputVarMap, indentLevel + 1, new Set(visited), new Set(emittedDataNodes), branchStopNodeId);
          result.push(...(elseBranch.length ? elseBranch : [`${indent}    pass`]));
        }

        if (nextEdge) {
          currentNodeId = nextNode.id;
          currentHandle = nextEdge.sourceHandle || 'flow_next';
          continue;
        }

        if (branchStopNodeId) {
          const convergeEdge = edges.find(e => e.target === branchStopNodeId);
          if (convergeEdge) {
            currentNodeId = convergeEdge.source;
            currentHandle = convergeEdge.sourceHandle || 'flow_out';
            continue;
          }
        }

        break;
      }

      if (nextNode.data.definitionId === 'core:try_except') {
        const errorVar = String(nextNode.data.properties?.error_var || 'err');
        const excType = String(nextNode.data.properties?.exception_type || 'Exception');
        outputVarMap.set(`${nextNode.id}:error_msg`, `str(${errorVar})`);

        let nextEdge = edges.find(e => e.source === nextNode.id && (e.sourceHandle === 'flow_next' || e.sourceHandle === 'flow_out'));
        let branchStopNodeId = nextEdge ? nextEdge.target : undefined;

        if (!branchStopNodeId) {
          const commonTarget = this.findConvergenceNode(nextNode.id, ['flow_try', 'flow_except'], edges);
          if (commonTarget) {
            branchStopNodeId = commonTarget;
          }
        }

        result.push(`${indent}try:`);
        const tryBranch = this.traverseFlow(nextNode.id, 'flow_try', edges, nodeMap, outputVarMap, indentLevel + 1, new Set(visited), new Set(emittedDataNodes), branchStopNodeId);
        result.push(...(tryBranch.length ? tryBranch : [`${indent}    pass`]));

        result.push(`${indent}except ${excType} as ${errorVar}:`);
        const exceptBranch = this.traverseFlow(nextNode.id, 'flow_except', edges, nodeMap, outputVarMap, indentLevel + 1, new Set(visited), new Set(emittedDataNodes), branchStopNodeId);
        result.push(...(exceptBranch.length ? exceptBranch : [`${indent}    pass`]));

        if (nextEdge) {
          currentNodeId = nextNode.id;
          currentHandle = nextEdge.sourceHandle || 'flow_next';
          continue;
        }

        if (branchStopNodeId) {
          const convergeEdge = edges.find(e => e.target === branchStopNodeId);
          if (convergeEdge) {
            currentNodeId = convergeEdge.source;
            currentHandle = convergeEdge.sourceHandle || 'flow_out';
            continue;
          }
        }

        break;
      }

      if (nextNode.data.definitionId === 'core:for_range') {
        const countEdge = edges.find(e => e.target === nextNode.id && e.targetHandle === 'count');
        const countVal = countEdge ? (outputVarMap.get(`${countEdge.source}:${countEdge.sourceHandle}`) || '5') : String(nextNode.data.properties?.count ?? 5);
        const varName = String(nextNode.data.properties?.var_name || 'i');
        outputVarMap.set(`${nextNode.id}:index`, varName);

        const nextEdge = edges.find(e => e.source === nextNode.id && e.sourceHandle === 'flow_out');
        const loopStopNodeId = nextEdge ? nextEdge.target : undefined;

        result.push(`${indent}for ${varName} in range(${countVal}):`);
        const loopBody = this.traverseFlow(nextNode.id, 'loop_body', edges, nodeMap, outputVarMap, indentLevel + 1, new Set(visited), new Set(emittedDataNodes), loopStopNodeId);
        result.push(...(loopBody.length ? loopBody : [`${indent}    pass`]));

        currentNodeId = nextNode.id;
        currentHandle = 'flow_out';
        continue;
      }

      const rendered = this.renderNodeTemplate(nextNode, edges, outputVarMap, nodeMap);
      if (rendered) {
        rendered.split('\n').forEach(line => {
          if (line.trim()) result.push(`${indent}${line}`);
        });
      }
      emittedDataNodes.add(nextNode.id);

      currentNodeId = nextNode.id;
      currentHandle = 'flow_out';
    }

    return result;
  }

  private static renderNodeTemplate(
    node: Node<NodeInstanceData>,
    edges: Edge[],
    outputVarMap: Map<string, string>,
    nodeMap?: Map<string, Node<NodeInstanceData>>,
    allNodes?: Node<NodeInstanceData>[]
  ): string {
    const def = LibraryRegistry.getNodeDefinition(node.data.definitionId);
    if (!def) return '';

    const cleanId = this.shortId(node.id);
    const props = node.data.properties || {};

    if (node.data.definitionId === 'core:print') {
      const msgEdge = edges.find(e => e.target === node.id && e.targetHandle === 'msg');
      const prefix = (props.prefix !== undefined ? String(props.prefix) : '').trim();
      const rawMsg = (props.message !== undefined ? String(props.message) : '').trim();

      if (msgEdge) {
        const incomingVar = outputVarMap.get(`${msgEdge.source}:${msgEdge.sourceHandle}`) || 'None';
        if (prefix) {
          return `print(${JSON.stringify(prefix)}, ${incomingVar})`;
        }
        return `print(${incomingVar})`;
      } else {
        const textToPrint = rawMsg || prefix || 'Hello from MicroPython ESP8266!';
        return `print(${JSON.stringify(textToPrint)})`;
      }
    }

    if (node.data.definitionId === 'core:comparison') {
      const varName = outputVarMap.get(`${node.id}:result`) || `cmp_${cleanId}`;
      const op = props.operator || '==';

      const edgeA = edges.find(e => e.target === node.id && e.targetHandle === 'a');
      const edgeB = edges.find(e => e.target === node.id && e.targetHandle === 'b');

      const formatOperand = (edge: Edge | undefined, fallbackProp: any, defVal: string) => {
        if (edge) {
          return outputVarMap.get(`${edge.source}:${edge.sourceHandle}`) || 'None';
        }
        const raw = fallbackProp !== undefined && String(fallbackProp).trim() !== '' ? String(fallbackProp).trim() : defVal;
        if (/^-?\d+(\.\d+)?$/.test(raw)) return raw;
        if (raw === 'True' || raw === 'False') return raw;
        if (/^[a-zA-Z_]\w*$/.test(raw)) return raw;
        return JSON.stringify(raw);
      };

      const valA = formatOperand(edgeA, props.val_a, '0');
      const valB = formatOperand(edgeB, props.val_b, '1');
      return `${varName} = (${valA} ${op} ${valB})`;
    }

    if (node.data.definitionId === 'core:constant') {
      const varName = outputVarMap.get(`${node.id}:val`) || `const_${cleanId}`;
      const dataType = props.data_type || 'number';
      let valStr = '0';
      if (dataType === 'number') {
        valStr = String(props.num_val !== undefined && props.num_val !== '' ? props.num_val : 1);
      } else if (dataType === 'string') {
        valStr = JSON.stringify(props.str_val !== undefined ? String(props.str_val) : 'Hello');
      } else if (dataType === 'boolean') {
        valStr = props.bool_val === 'False' || props.bool_val === false ? 'False' : 'True';
      }
      return `${varName} = ${valStr}`;
    }

    if (node.data.definitionId === 'core:variable_get') {
      const varName = String(props.var_name || 'x');
      const outVar = outputVarMap.get(`${node.id}:val`) || `var_${cleanId}`;
      if (outVar === varName) {
        return '';
      }
      return `${outVar} = ${varName}`;
    }

    if (node.data.definitionId === 'core:math') {
      const varName = outputVarMap.get(`${node.id}:result`) || `math_${cleanId}`;
      const op = props.operator || '+';
      const edgeA = edges.find(e => e.target === node.id && e.targetHandle === 'a');
      const edgeB = edges.find(e => e.target === node.id && e.targetHandle === 'b');
      const valA = edgeA ? outputVarMap.get(`${edgeA.source}:${edgeA.sourceHandle}`) || '0' : (props.val_a !== undefined && String(props.val_a).trim() !== '' ? String(props.val_a) : '0');
      const valB = edgeB ? outputVarMap.get(`${edgeB.source}:${edgeB.sourceHandle}`) || '1' : (props.val_b !== undefined && String(props.val_b).trim() !== '' ? String(props.val_b) : (op === '/' || op === '%' ? '1' : '0'));
      return `${varName} = (${valA} ${op} ${valB})`;
    }

    if (node.data.definitionId === 'core:math_func') {
      const varName = outputVarMap.get(`${node.id}:result`) || `mfunc_${cleanId}`;
      const func = props.func || 'round';
      const edgeVal = edges.find(e => e.target === node.id && e.targetHandle === 'val');
      const edgeVal2 = edges.find(e => e.target === node.id && e.targetHandle === 'val2');
      const val1 = edgeVal ? outputVarMap.get(`${edgeVal.source}:${edgeVal.sourceHandle}`) || '0' : String(props.default_val ?? 0);
      const val2 = edgeVal2 ? outputVarMap.get(`${edgeVal2.source}:${edgeVal2.sourceHandle}`) || '2' : String(props.default_val2 ?? 2);
      if (func === 'min' || func === 'max' || func === 'pow') {
        return `${varName} = ${func}(${val1}, ${val2})`;
      }
      if (func === 'sqrt') {
        return `${varName} = math.sqrt(${val1})`;
      }
      return `${varName} = ${func}(${val1})`;
    }

    if (node.data.definitionId === 'core:type_cast') {
      const varName = outputVarMap.get(`${node.id}:result`) || `cast_${cleanId}`;
      const targetType = props.target_type || 'int';
      const edgeVal = edges.find(e => e.target === node.id && e.targetHandle === 'val');
      let val = '0';
      if (edgeVal) {
        val = outputVarMap.get(`${edgeVal.source}:${edgeVal.sourceHandle}`) || '0';
      } else {
        const raw = String(props.default_val ?? '0');
        val = targetType === 'str' ? JSON.stringify(raw) : raw;
      }
      return `${varName} = ${targetType}(${val})`;
    }

    if (node.data.definitionId === 'core:logic') {
      const varName = outputVarMap.get(`${node.id}:result`) || `logic_${cleanId}`;
      const op = props.operator || 'and';
      const edgeA = edges.find(e => e.target === node.id && e.targetHandle === 'a');
      const edgeB = edges.find(e => e.target === node.id && e.targetHandle === 'b');
      const valA = edgeA ? outputVarMap.get(`${edgeA.source}:${edgeA.sourceHandle}`) || 'False' : (props.val_a === 'False' || props.val_a === false ? 'False' : 'True');
      if (op === 'not') {
        return `${varName} = (not ${valA})`;
      }
      const valB = edgeB ? outputVarMap.get(`${edgeB.source}:${edgeB.sourceHandle}`) || 'False' : (props.val_b === 'False' || props.val_b === false ? 'False' : 'True');
      return `${varName} = (${valA} ${op} ${valB})`;
    }

    if (node.data.definitionId === 'core:string_format') {
      const varName = outputVarMap.get(`${node.id}:result`) || `str_${cleanId}`;
      const valEdge = edges.find(e => e.target === node.id && e.targetHandle === 'val');
      const prefix = JSON.stringify(props.prefix !== undefined ? String(props.prefix) : 'Val: ');
      const suffix = JSON.stringify(props.suffix !== undefined ? String(props.suffix) : '');
      const valExpr = valEdge ? outputVarMap.get(`${valEdge.source}:${valEdge.sourceHandle}`) || 'None' : JSON.stringify(String(props.default_val ?? '0'));
      return `${varName} = ${prefix} + str(${valExpr}) + ${suffix}`;
    }

    if (node.data.definitionId === 'core:random') {
      const varName = outputVarMap.get(`${node.id}:result`) || `rnd_${cleanId}`;
      const minEdge = edges.find(e => e.target === node.id && e.targetHandle === 'min');
      const maxEdge = edges.find(e => e.target === node.id && e.targetHandle === 'max');
      const minVal = minEdge ? outputVarMap.get(`${minEdge.source}:${minEdge.sourceHandle}`) || '0' : String(props.min_val ?? 0);
      const maxVal = maxEdge ? outputVarMap.get(`${maxEdge.source}:${maxEdge.sourceHandle}`) || '100' : String(props.max_val ?? 100);
      return `${varName} = urandom.randint(${minVal}, ${maxVal})`;
    }

    if (node.data.definitionId === 'core:comment') {
      const text = props.text !== undefined ? String(props.text) : '';
      return `# ${text}`;
    }

    if (node.data.definitionId === 'network:http_get') {
      const resVar = outputVarMap.get(`${node.id}:response`) || `http_res_${cleanId}`;
      const codeVar = outputVarMap.get(`${node.id}:status_code`) || `http_code_${cleanId}`;
      const urlEdge = edges.find(e => e.target === node.id && e.targetHandle === 'url');
      const urlVal = urlEdge ? (outputVarMap.get(`${urlEdge.source}:${urlEdge.sourceHandle}`) || `'${props.url}'`) : JSON.stringify(props.url || 'http://192.168.1.100:1880/api');
      const timeout = Number(props.timeout ?? 5);

      return `try:\n    _res_${cleanId} = urequests.get(${urlVal}, timeout=${timeout})\n    ${resVar} = _res_${cleanId}.text\n    ${codeVar} = _res_${cleanId}.status_code\n    _res_${cleanId}.close()\nexcept Exception as _e_${cleanId}:\n    ${resVar} = ""\n    ${codeVar} = -1`;
    }

    if (node.data.definitionId === 'network:http_post') {
      const resVar = outputVarMap.get(`${node.id}:response`) || `post_res_${cleanId}`;
      const codeVar = outputVarMap.get(`${node.id}:status_code`) || `post_code_${cleanId}`;
      const urlEdge = edges.find(e => e.target === node.id && e.targetHandle === 'url');
      const dataEdge = edges.find(e => e.target === node.id && e.targetHandle === 'data');
      const urlVal = urlEdge ? (outputVarMap.get(`${urlEdge.source}:${urlEdge.sourceHandle}`) || `'${props.url}'`) : JSON.stringify(props.url || 'http://192.168.1.100:1880/sensor');
      const dataVal = dataEdge ? (outputVarMap.get(`${dataEdge.source}:${dataEdge.sourceHandle}`) || '0') : '0';
      const timeout = Number(props.timeout ?? 5);
      const isJson = props.payload_format === 'json';
      const jsonKey = props.json_key || 'value';

      if (isJson) {
        return `try:\n    _res_${cleanId} = urequests.post(${urlVal}, json={${JSON.stringify(jsonKey)}: ${dataVal}}, timeout=${timeout})\n    ${resVar} = _res_${cleanId}.text\n    ${codeVar} = _res_${cleanId}.status_code\n    _res_${cleanId}.close()\nexcept Exception as _e_${cleanId}:\n    ${resVar} = ""\n    ${codeVar} = -1`;
      } else {
        return `try:\n    _res_${cleanId} = urequests.post(${urlVal}, data=str(${dataVal}), timeout=${timeout})\n    ${resVar} = _res_${cleanId}.text\n    ${codeVar} = _res_${cleanId}.status_code\n    _res_${cleanId}.close()\nexcept Exception as _e_${cleanId}:\n    ${resVar} = ""\n    ${codeVar} = -1`;
      }
    }

    let template = def.codeTemplate.template;

    template = template.replace(/\{\{id\}\}/g, cleanId);

    const resolveProp = (propKey: string) => {
      const pDef = def.properties.find(p => p.id === propKey || p.name === propKey);
      const rawVal = props[propKey] !== undefined ? props[propKey] : pDef?.defaultValue;
      if (pDef?.type === 'text') {
        const str = String(rawVal ?? '');
        if (/^-?\d+(\.\d+)?$/.test(str) || str === 'True' || str === 'False' || str === 'None') {
          return str;
        }
        return JSON.stringify(str);
      }
      if (pDef?.type === 'boolean') {
        return rawVal ? 'True' : 'False';
      }
      return rawVal !== undefined ? String(rawVal) : '0';
    };

    for (const out of def.outputs) {
      const varName = outputVarMap.get(`${node.id}:${out.id}`) || `${out.id}_${cleanId}`;
      const regex = new RegExp(`\\{\\{output\\.${out.id}\\}\\}`, 'g');
      template = template.replace(regex, varName);
    }

    const candidateNodes = allNodes || (nodeMap ? Array.from(nodeMap.values()) : []);

    for (const input of def.inputs) {
      const edge = edges.find(e => e.target === node.id && e.targetHandle === input.id);
      let incomingVal = '';
      if (edge) {
        incomingVal = outputVarMap.get(`${edge.source}:${edge.sourceHandle}`) || '';
      }

      const fallbackRegex = new RegExp(`\\{\\{inputs\\.${input.id}\\s*\\|\\|\\s*([^\\}]+)\\}\\}`, 'g');
      template = template.replace(fallbackRegex, (_match, fallback) => {
        if (incomingVal) return incomingVal;
        const trimmed = fallback.trim();
        if (input.type === 'pin') {
          if (node.data.definitionId === 'machine:adc_init') {
            const pinVal = trimmed.startsWith('props.') ? props[trimmed.substring(6)] : trimmed;
            return String(pinVal ?? props.pin ?? 0);
          }
          const pinVal = trimmed.startsWith('props.') ? props[trimmed.substring(6)] : trimmed;
          return `pin_${pinVal ?? props.pin ?? 2}`;
        }
        if (trimmed.startsWith('props.')) {
          return resolveProp(trimmed.substring(6));
        }
        return trimmed;
      });

      const directRegex = new RegExp(`\\{\\{inputs\\.${input.id}\\}\\}`, 'g');
      let fallbackDirect = incomingVal;
      if (!fallbackDirect) {
        if (input.type === 'pin' && props.pin !== undefined) {
          fallbackDirect = `pin_${props.pin}`;
        } else if (input.type === 'bus') {
          const busNode = candidateNodes.find(n => n.data.definitionId === 'machine:i2c_init' || n.data.definitionId === 'machine:spi_init');
          if (busNode) {
            fallbackDirect = outputVarMap.get(`${busNode.id}:bus`) || (busNode.data.definitionId === 'machine:i2c_init' ? `i2c_${this.shortId(busNode.id)}` : `spi_${this.shortId(busNode.id)}`);
          } else {
            fallbackDirect = 'None';
          }
        } else if (input.type === 'device') {
          const matchingNode = candidateNodes.find(n => {
            const nDef = LibraryRegistry.getNodeDefinition(n.data.definitionId);
            return nDef && nDef.outputs.some(o => o.type === 'device' && (o.id === input.id || input.id.includes(o.id) || o.id.includes(input.id) || nDef.libraryId === def.libraryId));
          });
          if (matchingNode) {
            const devPort = LibraryRegistry.getNodeDefinition(matchingNode.data.definitionId)?.outputs.find(o => o.type === 'device');
            if (devPort) {
              fallbackDirect = outputVarMap.get(`${matchingNode.id}:${devPort.id}`) || `${devPort.id}_${this.shortId(matchingNode.id)}`;
            } else {
              fallbackDirect = 'None';
            }
          } else {
            fallbackDirect = 'None';
          }
        } else {
          fallbackDirect = 'None';
        }
      }
      template = template.replace(directRegex, fallbackDirect);
    }

    const conditionHolds = (condition: string): boolean => {
      const inputMatch = condition.match(/^inputs\.(\w+)$/);
      if (inputMatch) return edges.some(e => e.target === node.id && e.targetHandle === inputMatch[1]);

      const propMatch = condition.match(/^props\.(\w+)(?:\s*(==|!=)\s*['"]([^'"]*)['"])?$/);
      if (!propMatch) return false;
      const [, propKey, op, expected] = propMatch;
      const actual = props[propKey] !== undefined ? props[propKey] : def.properties.find(p => p.id === propKey)?.defaultValue;
      if (op === '==') return String(actual ?? '') === expected;
      if (op === '!=') return String(actual ?? '') !== expected;
      return actual === true || actual === 'true' || actual === 1 || actual === '1';
    };
    template = template.replace(/\{%\s*if\s+([\s\S]*?)%\}([\s\S]*?)\{%\s*endif\s*%\}/g, (_m, firstCondition: string, body: string) => {
      const parts = body.split(/\{%\s*(elif|else)\s*([\s\S]*?)%\}/);
      if (conditionHolds(firstCondition.trim())) return parts[0];
      for (let i = 1; i < parts.length; i += 3) {
        if (parts[i] === 'else' || conditionHolds(parts[i + 1].trim())) return parts[i + 2];
      }
      return '';
    });
    template = template.replace(/\{%[\s\S]*?%\}/g, '');

    for (const key of Object.keys(props)) {
      const regex = new RegExp(`\\{\\{props\\.${key}\\}\\}`, 'g');
      template = template.replace(regex, String(props[key]));
    }
    for (const propDef of def.properties) {
      const val = props[propDef.id] !== undefined ? props[propDef.id] : propDef.defaultValue;
      const regex = new RegExp(`\\{\\{props\\.${propDef.id}\\}\\}`, 'g');
      template = template.replace(regex, String(val));
    }

    for (const propDef of def.properties) {
      const val = props[propDef.id] !== undefined ? props[propDef.id] : propDef.defaultValue;
      const regex = new RegExp(`props\\.${propDef.id}\\b`, 'g');
      template = template.replace(regex, String(val));
    }

    return template;
  }
}
