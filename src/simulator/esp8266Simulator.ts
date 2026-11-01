import { useFlowStore } from '../store/useFlowStore';
import { Node, Edge } from '@xyflow/react';
import { NodeInstanceData } from '../types/nodes';
import { LibraryRegistry } from '../registry/registryLoader';

class ESP8266SimulatorEngine {
  private timer: any = null;
  private isRunning: boolean = false;
  private isPaused: boolean = false;
  private currentNodeId: string | null = null;
  private currentHandle: string = 'flow_out';
  private loopCount: number = 0;
  private virtualTicks: number = 0;
  private visitedInStep: Set<string> = new Set();
  private forLoopCounters: Map<string, number> = new Map();
  private continuationStack: string[] = [];

  private virtualVariables: Record<string, any> = {};
  private nodeOutputs: Map<string, Record<string, any>> = new Map();

  public start() {
    this.stop();
    const store = useFlowStore.getState();
    const { nodes, edges } = store;

    if (!nodes || nodes.length === 0) {
      store.addSimLog('error', 'Холст пуст! Добавьте ноды для запуска симуляции.');
      return;
    }

    this.isRunning = true;
    this.isPaused = false;
    this.loopCount = 0;
    this.virtualTicks = Date.now();
    this.visitedInStep.clear();
    this.forLoopCounters.clear();
    this.continuationStack = [];
    this.virtualVariables = {};
    this.nodeOutputs.clear();

    store.setSimRunning(true);
    store.setSimPaused(false);
    store.setErrorSimNodeId(null);
    store.resetVirtualPins();

    store.addSimLog('boot', 'Запуск ESP8266 MicroPython v1.20 (Xtensa LX106 @ 80MHz, 4MB Flash)...');
    store.addSimLog('boot', 'Системные шины и порты GPIO 0..16 инициализированы.');

    this.runInitializations(nodes, edges);

    const setupNode = nodes.find((n) => n.data.definitionId === 'core:setup');
    const loopNode = nodes.find((n) => n.data.definitionId === 'core:while_loop');

    if (setupNode) {
      this.currentNodeId = setupNode.id;
      this.currentHandle = 'flow_out';
    } else if (loopNode) {
      this.currentNodeId = loopNode.id;
      this.currentHandle = 'loop_body';
    } else {
      const firstFlowNode = nodes.find((n) =>
        edges.some((e) => e.source === n.id && (e.sourceHandle === 'flow_out' || !e.sourceHandle))
      );
      if (firstFlowNode) {
        this.currentNodeId = firstFlowNode.id;
        this.currentHandle = 'flow_out';
      } else {
        store.addSimLog('info', 'Нет активных соединений Flow. Соедините ноды белыми портами Flow!');
        this.stop();
        return;
      }
    }

    this.scheduleNextStep(50);
  }

  public step() {
    if (!this.isRunning) {
      this.start();
      this.pause();
      return;
    }
    this.isPaused = true;
    useFlowStore.getState().setSimPaused(true);
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.executeStep();
  }

  public pause() {
    this.isPaused = true;
    useFlowStore.getState().setSimPaused(true);
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    useFlowStore.getState().addSimLog('info', 'Симуляция приостановлена (Пауза).');
  }

  public resume() {
    if (!this.isRunning) {
      this.start();
      return;
    }
    this.isPaused = false;
    useFlowStore.getState().setSimPaused(false);
    useFlowStore.getState().addSimLog('info', 'Симуляция возобновлена.');
    this.scheduleNextStep(50);
  }

  public stop() {
    this.isRunning = false;
    this.isPaused = false;
    this.currentNodeId = null;
    this.continuationStack = [];
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    const store = useFlowStore.getState();
    store.setSimRunning(false);
    store.setSimPaused(false);
    store.setActiveSimNodeId(null);
    store.setErrorSimNodeId(null);
  }

  private runInitializations(nodes: Node<NodeInstanceData>[], _edges: Edge[]) {
    const store = useFlowStore.getState();

    const importNodes = nodes.filter((n) => n.data.definitionId === 'core:import_module');
    if (importNodes.length > 0) {
      store.addSimLog('info', `Импортировано модулей: ${importNodes.length}`);
    }

    const pinInits = nodes.filter((n) => n.data.definitionId === 'machine:pin_init');
    for (const pNode of pinInits) {
      const pinNum = Number(pNode.data.properties?.pin ?? 2);
      const mode = String(pNode.data.properties?.mode ?? 'OUT') as 'IN' | 'OUT';
      store.updateVirtualPin(pinNum, { mode, value: mode === 'IN' ? 0 : 1 });
      store.addSimLog(
        'gpio',
        `GPIO ${pinNum} сконфигурирован как Pin.${mode}${pinNum === 2 ? ' (Встроенный LED)' : ''}`
      );
    }
  }

  private scheduleNextStep(delayMs: number) {
    if (!this.isRunning || this.isPaused) return;
    const speed = useFlowStore.getState().simSpeed || 1;
    const adjustedDelay = Math.max(20, Math.round(delayMs / speed));

    this.timer = setTimeout(() => {
      this.executeStep();
    }, adjustedDelay);
  }

  private resolvePinNumber(node: Node<NodeInstanceData>, edges: Edge[], nodes: Node<NodeInstanceData>[]): number {
    const pinEdge = edges.find((e) => e.target === node.id && e.targetHandle === 'pin');
    if (pinEdge) {
      const sourceNode = nodes.find((n) => n.id === pinEdge.source);
      if (sourceNode?.data.properties?.pin !== undefined) {
        return Number(sourceNode.data.properties.pin);
      }
    }
    if (node.data.properties?.pin !== undefined) {
      return Number(node.data.properties.pin);
    }
    return 2;
  }

  private resolveNodeOutputValue(
    nodeId: string,
    portId: string,
    nodes: Node<NodeInstanceData>[],
    edges: Edge[],
    depth = 0
  ): any {
    if (depth > 15) return 0;

    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return 0;

    const defId = node.data.definitionId;
    const props = node.data.properties || {};

    if (defId === 'core:constant') {
      const type = props.data_type || 'number';
      let val: any = 0;
      if (type === 'number') {
        val = Number(props.num_val ?? 1);
      } else if (type === 'string') {
        val = String(props.str_val ?? 'Hello');
      } else if (type === 'boolean') {
        val = props.bool_val === 'False' || props.bool_val === false ? false : true;
      }
      return val;
    }

    if (defId === 'core:variable_get') {
      const name = String(props.var_name || 'x');
      return this.virtualVariables[name] ?? 0;
    }

    if (defId === 'core:variable_set') {
      const name = String(props.var_name || 'x');
      return this.virtualVariables[name] ?? (props.default_val ?? 0);
    }

    if (defId === 'machine:pin_read' || defId === 'machine:pin_is_active') {
      const pinNum = this.resolvePinNumber(node, edges, nodes);
      const pinVal = useFlowStore.getState().virtualPins[pinNum]?.value ?? 0;
      if (portId === 'is_active') return pinVal === 1;
      if (portId === 'is_low') return pinVal === 0;
      return pinVal;
    }

    if (this.nodeOutputs.has(nodeId) && this.nodeOutputs.get(nodeId)![portId] !== undefined) {
      return this.nodeOutputs.get(nodeId)![portId];
    }

    if (defId === 'core:comparison') {
      return this.evaluateComparison(node, nodes, edges, depth + 1);
    }

    if (defId === 'core:logic') {
      const op = props.operator || 'and';
      const edgeA = edges.find((e) => e.target === node.id && e.targetHandle === 'a');
      const edgeB = edges.find((e) => e.target === node.id && e.targetHandle === 'b');
      const valA = edgeA
        ? !!this.resolveNodeOutputValue(edgeA.source, edgeA.sourceHandle || 'result', nodes, edges, depth + 1)
        : (props.val_a === 'True' || props.val_a === true);

      let res = false;
      if (op === 'not') {
        res = !valA;
      } else {
        const valB = edgeB
          ? !!this.resolveNodeOutputValue(edgeB.source, edgeB.sourceHandle || 'result', nodes, edges, depth + 1)
          : (props.val_b === 'True' || props.val_b === true);
        res = op === 'and' ? (valA && valB) : (valA || valB);
      }
      this.nodeOutputs.set(nodeId, { result: res });
      return res;
    }

    if (defId === 'core:math') {
      const edgeA = edges.find((e) => e.target === node.id && e.targetHandle === 'a');
      const edgeB = edges.find((e) => e.target === node.id && e.targetHandle === 'b');
      const valA = edgeA ? Number(this.resolveNodeOutputValue(edgeA.source, edgeA.sourceHandle || 'val', nodes, edges, depth + 1)) : Number(props.val_a ?? 0);
      const valB = edgeB ? Number(this.resolveNodeOutputValue(edgeB.source, edgeB.sourceHandle || 'val', nodes, edges, depth + 1)) : Number(props.val_b ?? 1);
      const op = props.operator || '+';

      let result = 0;
      if (op === '+') result = valA + valB;
      else if (op === '-') result = valA - valB;
      else if (op === '*') result = valA * valB;
      else if (op === '/') result = valB !== 0 ? valA / valB : 0;
      else if (op === '%') result = valB !== 0 ? valA % valB : 0;

      this.nodeOutputs.set(nodeId, { result });
      return result;
    }

    if (defId === 'core:string_format') {
      const prefix = props.prefix !== undefined ? String(props.prefix) : 'Val: ';
      const suffix = props.suffix !== undefined ? String(props.suffix) : '';
      const valEdge = edges.find((e) => e.target === node.id && e.targetHandle === 'val');
      const val = valEdge ? this.resolveNodeOutputValue(valEdge.source, valEdge.sourceHandle || 'val', nodes, edges, depth + 1) : (props.default_val ?? 0);
      const result = `${prefix}${val}${suffix}`;
      this.nodeOutputs.set(nodeId, { result });
      return result;
    }

    if (defId === 'core:random') {
      const minVal = Number(props.min_val ?? 0);
      const maxVal = Number(props.max_val ?? 100);
      const result = Math.floor(Math.random() * (maxVal - minVal + 1)) + minVal;
      this.nodeOutputs.set(nodeId, { result });
      return result;
    }

    if (defId === 'core:map_range') {
      const edgeVal = edges.find((e) => e.target === node.id && e.targetHandle === 'val');
      const val = edgeVal ? Number(this.resolveNodeOutputValue(edgeVal.source, edgeVal.sourceHandle || 'val', nodes, edges, depth + 1)) : Number(props.default_val ?? 0);
      const inMin = Number(props.in_min ?? 0);
      const inMax = Number(props.in_max ?? 4095);
      const outMin = Number(props.out_min ?? 0);
      const outMax = Number(props.out_max ?? 100);
      const result = Math.round(((val - inMin) * (outMax - outMin)) / (inMax - inMin || 1) + outMin);
      this.nodeOutputs.set(nodeId, { result });
      return result;
    }

    if (defId === 'machine:adc_read') {
      const rawVal = Math.round(28000 + Math.sin(Date.now() / 2000) * 8000);
      this.nodeOutputs.set(nodeId, { val: rawVal });
      return rawVal;
    }

    if (defId === 'dht:read') {
      const temp = Math.round((23.0 + Math.sin(Date.now() / 5000) * 3.5) * 10) / 10;
      const hum = Math.round((50.0 + Math.cos(Date.now() / 6000) * 8.0) * 10) / 10;
      this.nodeOutputs.set(nodeId, { temperature: temp, humidity: hum });
      return portId === 'humidity' ? hum : temp;
    }

    if (defId === 'bmp280:read') {
      const temp = Math.round((24.2 + Math.sin(Date.now() / 7000) * 2.0) * 10) / 10;
      const press = Math.round(1013.25 + Math.sin(Date.now() / 10000) * 5.0);
      const alt = Math.round(150 + Math.sin(Date.now() / 8000) * 3);
      this.nodeOutputs.set(nodeId, { temperature: temp, pressure: press, altitude: alt });
      if (portId === 'pressure') return press;
      if (portId === 'altitude') return alt;
      return temp;
    }

    if (defId === 'core:math_func') {
      const func = props.func || 'round';
      const edgeVal = edges.find((e) => e.target === nodeId && e.targetHandle === 'val');
      const edgeVal2 = edges.find((e) => e.target === nodeId && e.targetHandle === 'val2');
      const val1 = edgeVal ? Number(this.resolveNodeOutputValue(edgeVal.source, edgeVal.sourceHandle || 'result', nodes, edges, depth + 1)) : Number(props.default_val ?? 0);
      const val2 = edgeVal2 ? Number(this.resolveNodeOutputValue(edgeVal2.source, edgeVal2.sourceHandle || 'result', nodes, edges, depth + 1)) : Number(props.default_val2 ?? 2);
      let res = 0;
      if (func === 'abs') res = Math.abs(val1);
      else if (func === 'round') res = Math.round(val1);
      else if (func === 'min') res = Math.min(val1, val2);
      else if (func === 'max') res = Math.max(val1, val2);
      else if (func === 'pow') res = Math.pow(val1, val2);
      else if (func === 'sqrt') res = Math.sqrt(Math.max(0, val1));
      this.nodeOutputs.set(nodeId, { result: res });
      return res;
    }

    if (defId === 'core:type_cast') {
      const targetType = props.target_type || 'int';
      const edgeVal = edges.find((e) => e.target === nodeId && e.targetHandle === 'val');
      const raw = edgeVal ? this.resolveNodeOutputValue(edgeVal.source, edgeVal.sourceHandle || 'result', nodes, edges, depth + 1) : (props.default_val ?? 0);
      let res: any = raw;
      if (targetType === 'int') res = Math.floor(Number(raw) || 0);
      else if (targetType === 'float') res = Number(raw) || 0.0;
      else if (targetType === 'str') res = String(raw ?? '');
      else if (targetType === 'bool') res = Boolean(raw);
      this.nodeOutputs.set(nodeId, { result: res });
      return res;
    }

    if (defId === 'time:ticks_us') {
      const elapsedUs = (Date.now() - this.virtualTicks) * 1000;
      this.nodeOutputs.set(nodeId, { ticks: elapsedUs });
      return elapsedUs;
    }

    if (defId === 'time:ticks_add') {
      const tEdge = edges.find((e) => e.target === nodeId && e.targetHandle === 'ticks');
      const dEdge = edges.find((e) => e.target === nodeId && e.targetHandle === 'delta');
      const base = tEdge ? Number(this.resolveNodeOutputValue(tEdge.source, tEdge.sourceHandle || 'ticks', nodes, edges, depth + 1)) : (Date.now() - this.virtualTicks);
      const delta = dEdge ? Number(this.resolveNodeOutputValue(dEdge.source, dEdge.sourceHandle || 'val', nodes, edges, depth + 1)) : Number(props.delta ?? 1000);
      const res = base + delta;
      this.nodeOutputs.set(nodeId, { result: res });
      return res;
    }

    if (defId === 'machine:i2c_scan') {
      const addrs = ['0x3c', '0x68', '0x76'];
      this.nodeOutputs.set(nodeId, { devices: addrs });
      return addrs;
    }

    if (defId === 'network:ifconfig') {
      return portId === 'ip' ? '192.168.1.105' : '255.255.255.0';
    }

    if (props[portId] !== undefined) return props[portId];
    if (props.default_val !== undefined) return props.default_val;
    if (props.val !== undefined) return props.val;
    if (props.text !== undefined) return props.text;
    if (props.result !== undefined) return props.result;

    return 0;
  }

  private evaluateComparison(
    node: Node<NodeInstanceData>,
    nodes: Node<NodeInstanceData>[],
    edges: Edge[],
    depth = 0
  ): boolean {
    const props = node.data.properties || {};
    const op = props.operator || '==';

    const edgeA = edges.find((e) => e.target === node.id && e.targetHandle === 'a');
    const edgeB = edges.find((e) => e.target === node.id && e.targetHandle === 'b');

    let valA: any = edgeA
      ? this.resolveNodeOutputValue(edgeA.source, edgeA.sourceHandle || 'val', nodes, edges, depth)
      : (props.val_a ?? 0);

    let valB: any = edgeB
      ? this.resolveNodeOutputValue(edgeB.source, edgeB.sourceHandle || 'val', nodes, edges, depth)
      : (props.val_b ?? 1);

    if (typeof valA === 'string' && /^-?\d+(\.\d+)?$/.test(valA)) valA = Number(valA);
    if (typeof valB === 'string' && /^-?\d+(\.\d+)?$/.test(valB)) valB = Number(valB);
    if (valA === 'True') valA = true;
    if (valA === 'False') valA = false;
    if (valB === 'True') valB = true;
    if (valB === 'False') valB = false;

    let res = false;
    switch (op) {
      case '==':
        res = valA == valB;
        break;
      case '!=':
        res = valA != valB;
        break;
      case '>':
        res = Number(valA) > Number(valB);
        break;
      case '<':
        res = Number(valA) < Number(valB);
        break;
      case '>=':
        res = Number(valA) >= Number(valB);
        break;
      case '<=':
        res = Number(valA) <= Number(valB);
        break;
      default:
        res = valA == valB;
    }

    this.nodeOutputs.set(node.id, { result: res });
    useFlowStore.getState().addSimLog('info', `Сравнение: (${valA} ${op} ${valB}) ➔ ${res ? 'True' : 'False'}`);
    return res;
  }

  private executeStep() {
    if (!this.isRunning) return;
    const store = useFlowStore.getState();
    const { nodes, edges } = store;

    if (!this.currentNodeId) {
      store.addSimLog('info', 'Поток выполнения завершен.');
      this.stop();
      return;
    }

    const currentNode = nodes.find((n) => n.id === this.currentNodeId);
    if (!currentNode) {
      this.stop();
      return;
    }

    store.setActiveSimNodeId(currentNode.id);
    store.setErrorSimNodeId(null);

    let nextStepDelay = 300;
    let nextHandle = 'flow_out';
    let targetNodeId: string | null = null;

    try {
      const defId = currentNode.data.definitionId;
      const props = currentNode.data.properties || {};

      if (defId === 'core:while_loop') {
        this.loopCount++;
        store.addSimLog('info', `--- Цикл While True (Итерация #${this.loopCount}) ---`);
        nextHandle = 'loop_body';
      }

      else if (defId === 'core:for_range') {
        const countEdge = edges.find((e) => e.target === currentNode.id && e.targetHandle === 'count');
        const count = countEdge ? Number(this.resolveNodeOutputValue(countEdge.source, countEdge.sourceHandle || 'result', nodes, edges)) : Number(props.count ?? 5);
        const varName = String(props.var_name || 'i');

        const currentIdx = this.forLoopCounters.get(currentNode.id) ?? 0;
        if (currentIdx < count) {
          this.virtualVariables[varName] = currentIdx;
          this.nodeOutputs.set(currentNode.id, { index: currentIdx });
          store.addSimLog('info', `Цикл For (${varName} = ${currentIdx} из ${count}) ➔ Тело цикла`);
          this.forLoopCounters.set(currentNode.id, currentIdx + 1);
          nextHandle = 'loop_body';
        } else {
          this.forLoopCounters.delete(currentNode.id);
          store.addSimLog('info', `Цикл For завершен (${count} итераций) ➔ Выход`);
          nextHandle = 'flow_out';
        }
      }

      else if (defId === 'machine:pin_toggle') {
        const pinNum = this.resolvePinNumber(currentNode, edges, nodes);
        const currentPin = store.virtualPins[pinNum] || { mode: 'OUT', value: 0 };
        const newVal: 0 | 1 = currentPin.value === 1 ? 0 : 1;
        store.updateVirtualPin(pinNum, { value: newVal });

        const isLed = pinNum === 2;
        store.addSimLog(
          'gpio',
          `GPIO ${pinNum} переключен: ${newVal ? 'HIGH (1)' : 'LOW (0)'}${
            isLed ? (newVal === 0 ? ' 💡 LED ГОРИТ!' : ' ⭕ LED ВЫКЛ') : ''
          }`
        );
      }

      else if (defId === 'machine:pin_write' || defId === 'machine:pin_set') {
        const pinNum = this.resolvePinNumber(currentNode, edges, nodes);
        const valEdge = edges.find((e) => e.target === currentNode.id && e.targetHandle === 'val');
        let val: 0 | 1 = 1;

        if (valEdge) {
          const rawVal = this.resolveNodeOutputValue(valEdge.source, valEdge.sourceHandle || 'val', nodes, edges);
          val = rawVal === 1 || rawVal === true || rawVal === '1' ? 1 : 0;
        } else {
          val = props.level === 0 || props.level === '0' || props.level === false ? 0 : 1;
        }

        store.updateVirtualPin(pinNum, { value: val });
        const isLed = pinNum === 2;
        store.addSimLog(
          'gpio',
          `GPIO ${pinNum}.value(${val})${isLed ? (val === 0 ? ' 💡 LED ГОРИТ!' : ' ⭕ LED ВЫКЛ') : ''}`
        );
      }

      else if (defId === 'machine:pin_read') {
        const pinNum = this.resolvePinNumber(currentNode, edges, nodes);
        const pinVal = store.virtualPins[pinNum]?.value ?? 0;
        this.nodeOutputs.set(currentNode.id, {
          val: pinVal,
          is_active: pinVal === 1,
        });
        store.addSimLog(
          'gpio',
          `GPIO ${pinNum} прочитан ➔ ${pinVal} (${pinVal === 1 ? 'HIGH / 3.3V (Активен)' : 'LOW / 0V'})`
        );
      }

      else if (defId === 'time:sleep_ms') {
        const msEdge = edges.find((e) => e.target === currentNode.id && e.targetHandle === 'ms');
        const duration = msEdge
          ? Number(this.resolveNodeOutputValue(msEdge.source, msEdge.sourceHandle || 'val', nodes, edges))
          : Number(props.duration ?? 500);
        store.addSimLog('time', `time.sleep_ms(${duration} мс) — пауза контроллера`);
        nextStepDelay = duration;
      }

      else if (defId === 'time:sleep_s') {
        const sEdge = edges.find((e) => e.target === currentNode.id && e.targetHandle === 's');
        const duration = sEdge
          ? Number(this.resolveNodeOutputValue(sEdge.source, sEdge.sourceHandle || 'val', nodes, edges))
          : Number(props.duration ?? 1);
        store.addSimLog('time', `time.sleep(${duration} с) — пауза контроллера`);
        nextStepDelay = duration * 1000;
      }

      else if (defId === 'time:sleep_us') {
        const usEdge = edges.find((e) => e.target === currentNode.id && e.targetHandle === 'us');
        const duration = usEdge
          ? Number(this.resolveNodeOutputValue(usEdge.source, usEdge.sourceHandle || 'val', nodes, edges))
          : Number(props.duration ?? 100);
        store.addSimLog('time', `time.sleep_us(${duration} мкс) — микросекундная пауза`);
        nextStepDelay = 30;
      }

      else if (defId === 'time:ticks_ms') {
        const elapsed = Date.now() - this.virtualTicks;
        this.nodeOutputs.set(currentNode.id, { ticks: elapsed });
        store.addSimLog('time', `time.ticks_ms() ➔ ${elapsed} мс (отметка времени)`);
      }

      else if (defId === 'time:ticks_diff') {
        const t1Edge = edges.find((e) => e.target === currentNode.id && e.targetHandle === 't1');
        const t2Edge = edges.find((e) => e.target === currentNode.id && e.targetHandle === 't2');
        const t1 = t1Edge ? Number(this.resolveNodeOutputValue(t1Edge.source, t1Edge.sourceHandle || 'ticks', nodes, edges)) : Date.now() - this.virtualTicks;
        const t2 = t2Edge ? Number(this.resolveNodeOutputValue(t2Edge.source, t2Edge.sourceHandle || 'ticks', nodes, edges)) : 0;
        const diff = t1 - t2;
        this.nodeOutputs.set(currentNode.id, { diff });
        store.addSimLog('time', `time.ticks_diff(${t1}, ${t2}) ➔ ${diff} мс`);
      }

      else if (defId === 'core:print') {
        const msgEdge = edges.find((e) => e.target === currentNode.id && e.targetHandle === 'msg');
        const prefix = (props.prefix !== undefined ? String(props.prefix) : '').trim();
        const rawMsg = (props.message !== undefined ? String(props.message) : '').trim();

        if (msgEdge) {
          const val = this.resolveNodeOutputValue(msgEdge.source, msgEdge.sourceHandle || 'val', nodes, edges);
          const label = prefix || rawMsg;
          if (label) {
            store.addSimLog('print', `print: "${label}: ${val}"`);
          } else {
            store.addSimLog('print', `print: ${typeof val === 'object' ? JSON.stringify(val) : val}`);
          }
        } else {
          const textToPrint = rawMsg || prefix || 'Hello from MicroPython ESP8266!';
          store.addSimLog('print', `print: "${textToPrint}"`);
        }
      }

      else if (defId === 'core:variable_set') {
        const varName = String(props.var_name || 'x');
        const valEdge = edges.find((e) => e.target === currentNode.id && e.targetHandle === 'val');
        let val: any = 0;
        if (valEdge) {
          val = this.resolveNodeOutputValue(valEdge.source, valEdge.sourceHandle || 'val', nodes, edges);
        } else {
          val = props.default_val ?? 0;
        }
        this.virtualVariables[varName] = val;
        this.nodeOutputs.set(currentNode.id, { val });
        store.addSimLog('info', `Задана переменная: ${varName} = ${JSON.stringify(val)}`);
      }

      else if (defId === 'core:variables_multi') {
        const raw = String(props.assignments || '');
        const lines = raw.split('\n');
        const assigned: string[] = [];
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) continue;
          if (trimmed.includes('=')) {
            const [k, v] = trimmed.split('=').map(s => s.trim());
            let val: any = v;
            if (v === 'True') val = true;
            else if (v === 'False') val = false;
            else if (!isNaN(Number(v))) val = Number(v);
            else if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
              val = v.slice(1, -1);
            }
            this.virtualVariables[k] = val;
            assigned.push(`${k}=${val}`);
          }
        }
        store.addSimLog('info', `Заданы переменные: ${assigned.join(', ')}`);
      }

      else if (defId === 'core:if_else') {
        const condEdge = edges.find((e) => e.target === currentNode.id && (e.targetHandle === 'condition' || e.targetHandle === 'cond_if'));
        let condVal = true;

        if (condEdge) {
          const raw = this.resolveNodeOutputValue(condEdge.source, condEdge.sourceHandle || 'result', nodes, edges);
          condVal = raw === 1 || raw === true || raw === '1' || raw === 'True';
        }

        if (condVal) {
          nextHandle = 'flow_true';
        } else {
          const elifEdge = edges.find(e => e.target === currentNode.id && e.targetHandle === 'cond_elif');
          const hasElifBranch = edges.some(e => e.source === currentNode.id && e.sourceHandle === 'flow_elif');
          if (elifEdge && hasElifBranch) {
            const rawElif = this.resolveNodeOutputValue(elifEdge.source, elifEdge.sourceHandle || 'result', nodes, edges);
            const elifVal = rawElif === 1 || rawElif === true || rawElif === '1' || rawElif === 'True';
            if (elifVal) {
              nextHandle = 'flow_elif';
            } else {
              nextHandle = 'flow_false';
            }
          } else {
            nextHandle = 'flow_false';
          }
        }

        const nextContEdge = edges.find(e => e.source === currentNode.id && (e.sourceHandle === 'flow_next' || e.sourceHandle === 'flow_out'));

        const hasChosenEdge = edges.some(e => e.source === currentNode.id && e.sourceHandle === nextHandle);
        if (!hasChosenEdge) {
          if (nextContEdge) {
            nextHandle = nextContEdge.sourceHandle || 'flow_next';
          }
        } else if (nextContEdge) {
          this.continuationStack.push(nextContEdge.target);
        }

        store.addSimLog(
          'info',
          `Условие IF (${condVal ? 'True' : 'False'}) ➔ переход в ветку ${nextHandle}`
        );
      }

      else if (defId === 'core:if_elif_else') {
        const condIfEdge = edges.find(e => e.target === currentNode.id && (e.targetHandle === 'cond_if' || e.targetHandle === 'condition'));
        let condVal = true;
        if (condIfEdge) {
          const raw = this.resolveNodeOutputValue(condIfEdge.source, condIfEdge.sourceHandle || 'result', nodes, edges);
          condVal = raw === 1 || raw === true || raw === '1' || raw === 'True';
        }

        if (condVal) {
          nextHandle = 'flow_if';
        } else {
          let matched = false;
          for (let i = 1; i <= 3; i++) {
            const elifEdge = edges.find(e => e.target === currentNode.id && e.targetHandle === `cond_elif${i}`);
            if (elifEdge) {
              const rawElif = this.resolveNodeOutputValue(elifEdge.source, elifEdge.sourceHandle || 'result', nodes, edges);
              const elifVal = rawElif === 1 || rawElif === true || rawElif === '1' || rawElif === 'True';
              if (elifVal) {
                nextHandle = `flow_elif${i}`;
                matched = true;
                break;
              }
            }
          }
          if (!matched) {
            nextHandle = 'flow_else';
          }
        }

        const nextContEdge = edges.find(e => e.source === currentNode.id && (e.sourceHandle === 'flow_next' || e.sourceHandle === 'flow_out'));
        const hasChosenEdge = edges.some(e => e.source === currentNode.id && e.sourceHandle === nextHandle);
        if (!hasChosenEdge) {
          if (nextContEdge) {
            nextHandle = nextContEdge.sourceHandle || 'flow_next';
          }
        } else if (nextContEdge) {
          this.continuationStack.push(nextContEdge.target);
        }

        store.addSimLog('info', `If / Elif / Else ➔ переход в ветку ${nextHandle}`);
      }

      else if (defId === 'core:try_except') {
        this.nodeOutputs.set(currentNode.id, { error_msg: 'None' });
        nextHandle = 'flow_try';
        const nextContEdge = edges.find(e => e.source === currentNode.id && (e.sourceHandle === 'flow_next' || e.sourceHandle === 'flow_out'));
        const hasTryEdge = edges.some(e => e.source === currentNode.id && e.sourceHandle === 'flow_try');
        if (!hasTryEdge) {
          if (nextContEdge) {
            nextHandle = nextContEdge.sourceHandle || 'flow_next';
          }
        } else if (nextContEdge) {
          this.continuationStack.push(nextContEdge.target);
        }
        store.addSimLog('info', `Try / Except ➔ безопасное исполнение блока try`);
      }

      else if (defId === 'core:string_format') {
        const valEdge = edges.find((e) => e.target === currentNode.id && e.targetHandle === 'val');
        const val = valEdge ? this.resolveNodeOutputValue(valEdge.source, valEdge.sourceHandle || 'val', nodes, edges) : (props.default_val ?? 0);
        const prefix = props.prefix !== undefined ? String(props.prefix) : 'Val: ';
        const suffix = props.suffix !== undefined ? String(props.suffix) : '';
        const formatted = `${prefix}${val}${suffix}`;
        this.nodeOutputs.set(currentNode.id, { result: formatted });
        store.addSimLog('info', `Сформирована строка ➔ "${formatted}"`);
      }

      else if (defId === 'core:random') {
        const minEdge = edges.find((e) => e.target === currentNode.id && e.targetHandle === 'min');
        const maxEdge = edges.find((e) => e.target === currentNode.id && e.targetHandle === 'max');
        const minVal = minEdge ? Number(this.resolveNodeOutputValue(minEdge.source, minEdge.sourceHandle || 'result', nodes, edges)) : Number(props.min_val ?? 0);
        const maxVal = maxEdge ? Number(this.resolveNodeOutputValue(maxEdge.source, maxEdge.sourceHandle || 'result', nodes, edges)) : Number(props.max_val ?? 100);
        const rnd = Math.floor(Math.random() * (maxVal - minVal + 1)) + minVal;
        this.nodeOutputs.set(currentNode.id, { result: rnd });
        store.addSimLog('info', `urandom.randint(${minVal}, ${maxVal}) ➔ ${rnd}`);
      }

      else if (defId === 'core:comment') {
        if (props.text) {
          store.addSimLog('info', `# ${props.text}`);
        }
      }

      else if (defId === 'machine:pwm_set') {
        const dutyEdge = edges.find((e) => e.target === currentNode.id && e.targetHandle === 'duty');
        const duty = dutyEdge ? Number(this.resolveNodeOutputValue(dutyEdge.source, dutyEdge.sourceHandle || 'val', nodes, edges)) : Number(props.default_duty ?? 512);
        store.addSimLog('gpio', `PWM Duty установлен: ${duty} / 1023`);
      }

      else if (defId === 'machine:pwm_freq') {
        const freqEdge = edges.find((e) => e.target === currentNode.id && e.targetHandle === 'freq');
        const freq = freqEdge ? Number(this.resolveNodeOutputValue(freqEdge.source, freqEdge.sourceHandle || 'val', nodes, edges)) : Number(props.freq ?? 1000);
        store.addSimLog('gpio', `PWM Частота установлена: ${freq} Гц`);
      }

      else if (defId === 'machine:tone') {
        const freqEdge = edges.find((e) => e.target === currentNode.id && e.targetHandle === 'freq');
        const freq = freqEdge ? Number(this.resolveNodeOutputValue(freqEdge.source, freqEdge.sourceHandle || 'val', nodes, edges)) : Number(props.freq ?? 440);
        const state = props.state || 'ON';
        store.addSimLog('gpio', `Зуммер / Тон: ${freq} Гц (${state === 'ON' ? '🔊 ЗВУЧИТ' : '🔇 ТИШИНА'})`);
      }

      else if (defId === 'machine:adc_read') {
        const adcVal = Math.round(28000 + Math.sin(Date.now() / 2000) * 8000);
        this.nodeOutputs.set(currentNode.id, { val: adcVal });
        store.addSimLog('gpio', `АЦП read_u16() ➔ ${adcVal} (~${((adcVal / 65535) * 3.3).toFixed(2)}V)`);
      }

      else if (defId === 'machine:reset') {
        store.addSimLog('boot', 'machine.reset() ➔ Перезагрузка контроллера...');
        this.stop();
        return;
      }

      else if (defId === 'network:wlan_connect') {
        const ssid = props.ssid || 'WiFi';
        store.addSimLog('boot', `Wi-Fi: Подключение к "${ssid}"... Подключено! (IP: 192.168.1.105)`);
        this.virtualVariables['wlan_connected'] = true;
      }

      else if (defId === 'network:is_connected') {
        const connected = this.virtualVariables['wlan_connected'] ?? true;
        this.nodeOutputs.set(currentNode.id, { status: connected });
        store.addSimLog('info', `Wi-Fi isconnected() ➔ ${connected ? 'True' : 'False'}`);
      }

      else if (defId === 'network:ifconfig') {
        const ip = '192.168.1.105';
        this.nodeOutputs.set(currentNode.id, { ip, subnet: '255.255.255.0', gateway: '192.168.1.1', dns: '8.8.8.8' });
        store.addSimLog('info', `wlan.ifconfig() ➔ IP: ${ip}, Mask: 255.255.255.0, GW: 192.168.1.1`);
      }

      else if (defId === 'dht:read') {
        const temp = Math.round((23.0 + Math.sin(Date.now() / 5000) * 3.5) * 10) / 10;
        const hum = Math.round((50.0 + Math.cos(Date.now() / 6000) * 8.0) * 10) / 10;
        this.nodeOutputs.set(currentNode.id, { temperature: temp, humidity: hum });
        store.addSimLog('info', `DHT sensor.measure() ➔ Температура: ${temp}°C, Влажность: ${hum}%`);
      }

      else if (defId === 'bmp280:read') {
        const temp = Math.round((24.2 + Math.sin(Date.now() / 7000) * 2.0) * 10) / 10;
        const press = Math.round(1013.25 + Math.sin(Date.now() / 10000) * 5.0);
        const alt = Math.round(150 + Math.sin(Date.now() / 8000) * 3);
        this.nodeOutputs.set(currentNode.id, { temperature: temp, pressure: press, altitude: alt });
        store.addSimLog('info', `BMP280 ➔ ${temp}°C, ${press} гПа, ${alt} м`);
      }

      else if (defId === 'ssd1306:clear') {
        store.addSimLog('print', 'OLED: Буфер очищен (fill 0)');
      }

      else if (defId === 'ssd1306:text') {
        const textEdge = edges.find((e) => e.target === currentNode.id && e.targetHandle === 'text');
        const textVal = textEdge ? this.resolveNodeOutputValue(textEdge.source, textEdge.sourceHandle || 'val', nodes, edges) : (props.def_text ?? 'Node-MPY');
        const x = props.def_x ?? 0;
        const y = props.def_y ?? 0;
        store.addSimLog('print', `OLED.text("${textVal}", ${x}, ${y})`);
      }

      else if (defId === 'ssd1306:rect') {
        store.addSimLog('print', `OLED.fill_rect(${props.x ?? 0}, ${props.y ?? 0}, ${props.w ?? 32}, ${props.h ?? 16}, ${props.fill ?? 1})`);
      }

      else if (defId === 'ssd1306:show') {
        store.addSimLog('print', 'OLED: Данные отправлены на дисплей (oled.show())');
      }

      else if (defId === 'i2c_lcd:put_str') {
        const textEdge = edges.find((e) => e.target === currentNode.id && e.targetHandle === 'text');
        const textVal = textEdge ? this.resolveNodeOutputValue(textEdge.source, textEdge.sourceHandle || 'val', nodes, edges) : (props.def_text ?? 'Hello');
        store.addSimLog('print', `LCD 1602: "${textVal}"`);
      }

      else if (defId === 'i2c_lcd:move_to') {
        store.addSimLog('print', `LCD 1602: move_to(колонка: ${props.col ?? 0}, строка: ${props.row ?? 0})`);
      }

      else if (defId === 'i2c_lcd:clear') {
        store.addSimLog('print', 'LCD 1602: Экран очищен (clear)');
      }

      else if (defId === 'servo:write_angle') {
        const angleEdge = edges.find((e) => e.target === currentNode.id && e.targetHandle === 'angle');
        const angleVal = angleEdge ? Number(this.resolveNodeOutputValue(angleEdge.source, angleEdge.sourceHandle || 'val', nodes, edges)) : Number(props.def_angle ?? 90);
        store.addSimLog('gpio', `Сервопривод: Поворот вала на ${angleVal}°`);
      }

      else if (defId === 'servo:detach') {
        store.addSimLog('gpio', 'Сервопривод: Сигнал ШИМ отключен (detach)');
      }

      else if (defId === 'neopixel:set_pixel') {
        const idx = props.def_index ?? 0;
        const r = props.def_r ?? 255;
        const g = props.def_g ?? 0;
        const b = props.def_b ?? 0;
        store.addSimLog('gpio', `NeoPixel: [${idx}] = RGB(${r}, ${g}, ${b})`);
      }

      else if (defId === 'neopixel:fill') {
        const r = props.def_r ?? 0;
        const g = props.def_g ?? 255;
        const b = props.def_b ?? 128;
        store.addSimLog('gpio', `NeoPixel: Заливка ленты RGB(${r}, ${g}, ${b})`);
      }

      else if (defId === 'neopixel:clear') {
        store.addSimLog('gpio', 'NeoPixel: Лента погашена (0, 0, 0)');
      }

      else if (defId === 'neopixel:write') {
        store.addSimLog('gpio', 'NeoPixel: Кадр отправлен на ленту (write)');
      }

      else if (defId === 'max7219:text') {
        const textEdge = edges.find((e) => e.target === currentNode.id && e.targetHandle === 'text');
        const textVal = textEdge ? this.resolveNodeOutputValue(textEdge.source, textEdge.sourceHandle || 'val', nodes, edges) : (props.def_text ?? 'MPY');
        store.addSimLog('print', `MAX7219 Матрица: Вывод "${textVal}" (яркость ${props.brightness ?? 5})`);
      }

      else if (defId === 'max7219:clear') {
        store.addSimLog('print', 'MAX7219 Матрица: Очистка (fill 0)');
      }

      else if (defId === 'machine:pwm_deinit') {
        store.addSimLog('gpio', 'PWM / Зуммер отключен (pwm.deinit())');
      }

      else if (defId === 'machine:timer') {
        const period = Number(props.period ?? 1000);
        const mode = props.mode || 'PERIODIC';
        const cb = props.callback || 'on_timer';
        store.addSimLog('time', `machine.Timer(-1) инициализирован: ${period} мс (${mode}), callback='${cb}'`);
      }

      else if (defId === 'machine:timer_deinit') {
        store.addSimLog('time', 'machine.Timer(-1) остановлен (deinit)');
      }

      else if (defId === 'machine:i2c_scan') {
        const addrs = ['0x3c', '0x68', '0x76'];
        this.nodeOutputs.set(currentNode.id, { devices: addrs });
        store.addSimLog('gpio', `i2c.scan() ➔ Найдено устройств: ${addrs.join(', ')}`);
      }

      else if (defId === 'machine:deep_sleep') {
        const ms = Number(props.duration ?? 10000);
        store.addSimLog('boot', `machine.deepsleep(${ms} мс) ➔ Контроллер перешел в режим глубокого сна.`);
        this.stop();
        return;
      }

      else if (defId === 'time:ticks_add') {
        const tEdge = edges.find((e) => e.target === currentNode.id && e.targetHandle === 'ticks');
        const dEdge = edges.find((e) => e.target === currentNode.id && e.targetHandle === 'delta');
        const base = tEdge ? Number(this.resolveNodeOutputValue(tEdge.source, tEdge.sourceHandle || 'ticks', nodes, edges)) : (Date.now() - this.virtualTicks);
        const delta = dEdge ? Number(this.resolveNodeOutputValue(dEdge.source, dEdge.sourceHandle || 'val', nodes, edges)) : Number(props.delta ?? 1000);
        const res = base + delta;
        this.nodeOutputs.set(currentNode.id, { result: res });
        store.addSimLog('time', `time.ticks_add(${base}, ${delta}) ➔ ${res} мс`);
      }

      else if (defId === 'network:ap_active') {
        const ssid = props.ssid || 'ESP-AccessPoint';
        store.addSimLog('boot', `Точка доступа Wi-Fi AP запущена: SSID="${ssid}" (IP: 192.168.4.1)`);
      }

      else if (defId === 'network:disconnect') {
        store.addSimLog('info', 'Wi-Fi отключен (wlan.disconnect())');
      }

      else if (defId === 'network:http_get') {
        const urlEdge = edges.find((e) => e.target === currentNode.id && e.targetHandle === 'url');
        const urlVal = urlEdge ? String(this.resolveNodeOutputValue(urlEdge.source, urlEdge.sourceHandle || 'val', nodes, edges)) : (props.url || 'http://192.168.1.100:1880/api');
        const simulatedText = '{"status": "ok", "cmd": "/on"}';
        this.nodeOutputs.set(currentNode.id, { response: simulatedText, status_code: 200 });
        store.addSimLog('info', `HTTP GET ${urlVal} ➔ 200 OK (${simulatedText})`);
      }

      else if (defId === 'network:http_post') {
        const urlEdge = edges.find((e) => e.target === currentNode.id && e.targetHandle === 'url');
        const dataEdge = edges.find((e) => e.target === currentNode.id && e.targetHandle === 'data');
        const urlVal = urlEdge ? String(this.resolveNodeOutputValue(urlEdge.source, urlEdge.sourceHandle || 'val', nodes, edges)) : (props.url || 'http://192.168.1.100:1880/sensor');
        const dataVal = dataEdge ? this.resolveNodeOutputValue(dataEdge.source, dataEdge.sourceHandle || 'val', nodes, edges) : 512;
        const isHigh = Number(dataVal) > 500;
        const simulatedResponse = isHigh ? '/on' : '/off';
        this.nodeOutputs.set(currentNode.id, { response: simulatedResponse, status_code: 200 });
        store.addSimLog('info', `HTTP POST ${urlVal} [Data: ${dataVal}] ➔ Ответ сервера: "${simulatedResponse}" (200 OK)`);
      }

      else if (defId === 'ssd1306:line') {
        store.addSimLog('print', `OLED.line(${props.x0 ?? 0}, ${props.y0 ?? 0}, ${props.x1 ?? 127}, ${props.y1 ?? 63}, ${props.color ?? 1})`);
      }

      else if (defId === 'ssd1306:pixel') {
        store.addSimLog('print', `OLED.pixel(${props.x ?? 64}, ${props.y ?? 32}, ${props.color ?? 1})`);
      }

      else if (defId === 'core:custom_function') {
        const fnName = props.name || 'custom_fn';
        const params = props.params || '';
        store.addSimLog('info', `Вызов функции def ${fnName}(${params})`);
        const body = String(props.body || '');
        for (const line of body.split('\n')) {
          const trimmed = line.trim();
          if (trimmed.startsWith('print(')) {
            const match = trimmed.match(/print\((.*)\)/);
            if (match) {
              store.addSimLog('print', match[1].replace(/['"]/g, ''));
            }
          }
        }
      }

      else {
        const label = currentNode.data.label || defId;
        const def = LibraryRegistry.getNodeDefinition(defId);
        if (def && def.outputs) {
          const outputs: Record<string, any> = {};
          for (const out of def.outputs) {
            if (out.type !== 'flow') {
              outputs[out.id] = props[out.id] ?? props.default_val ?? 1;
            }
          }
          this.nodeOutputs.set(currentNode.id, outputs);
        }
        store.addSimLog('info', `Исполнение [${label}]`);
      }

      const outEdge = edges.find(
        (e) => e.source === currentNode.id && (!e.sourceHandle || e.sourceHandle === nextHandle || e.sourceHandle === 'flow_out')
      );

      if (outEdge) {
        targetNodeId = outEdge.target;

        const siblings = edges.filter((e) => e !== outEdge && e.source === currentNode.id && e.sourceHandle === outEdge.sourceHandle && outEdge.sourceHandle === nextHandle);
        siblings.reverse().forEach((e) => this.continuationStack.push(e.target));

        if (this.continuationStack[this.continuationStack.length - 1] === targetNodeId) {
          this.continuationStack.pop();
        }
      } else {
        if (this.continuationStack.length > 0) {
          targetNodeId = this.continuationStack.pop()!;
          nextHandle = 'flow_in';
          store.addSimLog('info', 'Продолжение потока [Далее (После)]');
        } else {
          const activeForRangeId = Array.from(this.forLoopCounters.keys()).pop();
          const activeForRangeNode = activeForRangeId ? nodes.find((n) => n.id === activeForRangeId) : null;

          if (activeForRangeNode && activeForRangeNode.id !== currentNode.id) {
            targetNodeId = activeForRangeNode.id;
            nextHandle = 'loop_body';
          } else {
            const loopNode = nodes.find((n) => n.data.definitionId === 'core:while_loop');
            if (loopNode && loopNode.id !== currentNode.id) {
              targetNodeId = loopNode.id;
              nextHandle = 'loop_body';
            } else {
              targetNodeId = null;
            }
          }
        }
      }

      this.currentNodeId = targetNodeId;
      this.currentHandle = nextHandle;

      if (this.isRunning && !this.isPaused) {
        this.scheduleNextStep(nextStepDelay);
      }
    } catch (err: any) {
      store.setErrorSimNodeId(currentNode.id);
      store.addSimLog('error', `Ошибка в ноде [${currentNode.data.label}]: ${err?.message || err}`);
      this.stop();
    }
  }
}

export const esp8266Simulator = new ESP8266SimulatorEngine();
