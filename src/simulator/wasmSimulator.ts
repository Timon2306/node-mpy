import { useFlowStore } from '../store/useFlowStore';
import { CodeGenerator } from '../compiler/codeGenerator';

class WasmSimulatorEngine {
  private worker: Worker | null = null;
  private isRunning: boolean = false;
  private isPaused: boolean = false;
  private controlBuffer: SharedArrayBuffer | null = null;
  private pinBuffer: SharedArrayBuffer | null = null;
  private controlArray: Int32Array | null = null;
  private pinArray: Int32Array | null = null;

  constructor() {
    this.initSharedBuffers();
  }

  private initSharedBuffers() {
    try {
      if (typeof SharedArrayBuffer !== 'undefined') {
        this.controlBuffer = new SharedArrayBuffer(16); // 4 ints: [paused, speed*100, step, reserved]
        this.pinBuffer = new SharedArrayBuffer(144); // 36 ints: pins 0..31, pin 32 is ADC
        this.controlArray = new Int32Array(this.controlBuffer);
        this.pinArray = new Int32Array(this.pinBuffer);
      }
    } catch (_) {
      this.controlBuffer = null;
      this.pinBuffer = null;
      this.controlArray = null;
      this.pinArray = null;
    }
  }

  public start() {
    this.stop();
    const store = useFlowStore.getState();
    const { nodes, edges, virtualPins, simSpeed } = store;

    if (!nodes || nodes.length === 0) {
      store.addSimLog('error', 'Холст пуст! Добавьте ноды для запуска симуляции.');
      return;
    }

    // Generate real MicroPython code from the canvas flow
    const { code, errors } = CodeGenerator.generateCode(nodes, edges);

    if (errors && errors.length > 0) {
      store.addSimLog('error', `Ошибка компиляции схемы: ${errors[0]}`);
      return;
    }

    this.isRunning = true;
    this.isPaused = false;
    store.setSimRunning(true);
    store.setSimPaused(false);
    store.setErrorSimNodeId(null);
    store.resetVirtualPins();

    store.addSimLog(
      'boot',
      'Запуск MicroPython v1.26 (WASM VM — Xtensa ESP8266 Emulation)...'
    );
    store.addSimLog(
      'boot',
      'Инициализация виртуальных шин GPIO 0..16, ADC, I2C, SPI, Web & urequests...'
    );

    // Sync initial pin state into shared memory
    if (this.pinArray) {
      for (let p = 0; p <= 16; p++) {
        const val = virtualPins[p]?.value ?? (p === 2 ? 1 : 0);
        Atomics.store(this.pinArray, p, val);
      }
      Atomics.store(this.pinArray, 32, 485); // Default photoresistor ADC
    }
    if (this.controlArray) {
      Atomics.store(this.controlArray, 0, 0); // paused = false
      Atomics.store(this.controlArray, 1, Math.round(simSpeed * 100));
    }

    try {
      // Spawn fresh worker
      this.worker = new Worker(new URL('./mpWorker.ts', import.meta.url), {
        type: 'module',
      });

      this.worker.onmessage = (e: MessageEvent) => {
        this.handleWorkerMessage(e.data);
      };

      this.worker.onerror = (err) => {
        store.addSimLog('error', `Критический сбой Worker: ${err.message || 'Unknown error'}`);
        this.stop();
      };

      // Send start payload to worker
      this.worker.postMessage({
        type: 'start',
        code,
        speed: simSpeed,
        controlBuffer: this.controlBuffer,
        pinBuffer: this.pinBuffer,
      });
    } catch (err: any) {
      store.addSimLog('error', `Не удалось инициализировать WebAssembly Worker: ${err?.message || err}`);
      this.stop();
    }
  }

  private handleWorkerMessage(data: any) {
    const store = useFlowStore.getState();
    const isRu = store.language === 'ru';

    switch (data.type) {
      case 'ready':
        store.addSimLog(
          'boot',
          isRu
            ? '✓ MicroPython WebAssembly ядро готово к исполнению.'
            : '✓ MicroPython WebAssembly engine ready.'
        );
        break;

      case 'log':
        store.addSimLog(data.logType || 'print', data.text);
        break;

      case 'pin_change': {
        const pin = data.pin;
        const value: 0 | 1 = data.value ? 1 : 0;
        store.updateVirtualPin(pin, { value });

        if (pin === 2) {
          // ESP8266 Builtin LED is active-low (0 = ON, 1 = OFF)
          const ledOn = value === 0;
          store.addSimLog(
            'gpio',
            isRu
              ? `[GPIO 2] ${ledOn ? '💡 Встроенный светодиод ЗАЖЖЕН (LOW / 0)' : 'Погашен (HIGH / 1)'}`
              : `[GPIO 2] Built-in LED ${ledOn ? '💡 LIT (LOW / 0)' : 'OFF (HIGH / 1)'}`
          );
        } else {
          store.addSimLog(
            'gpio',
            isRu
              ? `[GPIO ${pin}] Уровень изменен ➔ ${value ? 'HIGH (1)' : 'LOW (0)'}`
              : `[GPIO ${pin}] Level changed ➔ ${value ? 'HIGH (1)' : 'LOW (0)'}`
          );
        }
        break;
      }

      case 'pwm_change': {
        store.addSimLog(
          'gpio',
          isRu
            ? `[PWM GPIO ${data.pin}] ШИМ заполнение ➔ ${data.duty}/1023`
            : `[PWM GPIO ${data.pin}] Duty cycle ➔ ${data.duty}/1023`
        );
        break;
      }

      case 'display': {
        store.addSimLog('print', `[${data.driver}] ${data.text}`);
        break;
      }

      case 'done': {
        store.addSimLog(
          'info',
          isRu
            ? '[MicroPython WASM] Скрипт успешно завершил выполнение.'
            : '[MicroPython WASM] Flow script execution finished.'
        );
        this.stop();
        break;
      }

      case 'error': {
        store.addSimLog('error', `[MicroPython Исключение] ${data.error}`);
        this.stop();
        break;
      }
    }
  }

  public pause() {
    if (!this.isRunning) return;
    this.isPaused = true;
    useFlowStore.getState().setSimPaused(true);

    if (this.controlArray) {
      Atomics.store(this.controlArray, 0, 1);
    }
    this.worker?.postMessage({ type: 'pause' });
  }

  public resume() {
    if (!this.isRunning) return;
    this.isPaused = false;
    useFlowStore.getState().setSimPaused(false);

    if (this.controlArray) {
      Atomics.store(this.controlArray, 0, 0);
    }
    this.worker?.postMessage({ type: 'resume' });
  }

  public step() {
    if (!this.isRunning) {
      this.start();
      return;
    }
    // Step: briefly unpause, then re-pause
    this.resume();
    setTimeout(() => {
      this.pause();
    }, 200);
  }

  public stop() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.isRunning = false;
    this.isPaused = false;
    useFlowStore.getState().setSimRunning(false);
    useFlowStore.getState().setSimPaused(false);
    useFlowStore.getState().setActiveSimNodeId(null);
  }

  public setSpeed(speed: number) {
    if (this.controlArray) {
      Atomics.store(this.controlArray, 1, Math.round(speed * 100));
    }
    this.worker?.postMessage({ type: 'speed', speed });
  }

  public updatePinInput(pin: number, value: 0 | 1) {
    if (this.pinArray) {
      Atomics.store(this.pinArray, pin, value);
    }
    this.worker?.postMessage({ type: 'pin_input', pin, value });
  }

  public updateAdc(adc: number) {
    if (this.pinArray) {
      Atomics.store(this.pinArray, 32, adc);
    }
    this.worker?.postMessage({ type: 'adc_input', adc });
  }
}

export const wasmSimulator = new WasmSimulatorEngine();
