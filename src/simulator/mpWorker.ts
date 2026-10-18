import { loadMicroPython, MicroPythonInstance } from '@webreflection/micropython-webassembly-pyscript';
import wasmUrl from '@webreflection/micropython-webassembly-pyscript/wasm?url';

let mpInstance: MicroPythonInstance | null = null;
let controlArray: Int32Array | null = null;
let pinArray: Int32Array | null = null;

// Local fallback state if SharedArrayBuffer is not passed
const localPins: Record<number, number> = {
  0: 1,
  2: 1, // Builtin LED on ESP8266 (active-low, 1 = OFF)
  4: 0,
  5: 0,
  12: 0,
  13: 0,
  14: 0,
  15: 0,
  16: 0,
};
let localAdc = 485;
let localSpeed = 1;
let localPaused = 0;

function injectVirtualModules(mp: MicroPythonInstance) {
  // 1. machine.py
  mp.FS.writeFile(
    '/machine.py',
    `
import nt_bridge

class Pin:
    IN = 0
    OUT = 1
    OPEN_DRAIN = 2
    PULL_UP = 1
    PULL_DOWN = 2
    IRQ_RISING = 1
    IRQ_FALLING = 2
    WAKE_LOW = 4
    WAKE_HIGH = 5

    def __init__(self, pin, mode=0, pull=-1):
        self.pin = pin
        self.mode = mode
        self.pull = pull

    def value(self, val=None):
        if val is not None:
            v = 1 if val else 0
            nt_bridge.notifyPinChange(self.pin, v)
            return None
        return nt_bridge.getPinValue(self.pin)

    def on(self):
        self.value(1)

    def off(self):
        self.value(0)

    def irq(self, trigger=0, handler=None):
        pass

class ADC:
    def __init__(self, pin=0):
        self.pin = pin

    def read(self):
        return nt_bridge.getAdcValue()

    def read_u16(self):
        return nt_bridge.getAdcValue() * 64

class PWM:
    def __init__(self, pin, freq=50, duty=512):
        self.pin = pin.pin if hasattr(pin, 'pin') else pin
        self._freq = freq
        self._duty = duty

    def freq(self, f=None):
        if f is not None:
            self._freq = f
        return self._freq

    def duty(self, d=None):
        if d is not None:
            self._duty = d
            nt_bridge.notifyPwmChange(self.pin, d)
        return self._duty

    def duty_u16(self, d=None):
        if d is not None:
            self.duty(int(d / 64))
        return self._duty * 64

    def deinit(self):
        pass

class I2C:
    def __init__(self, id=-1, scl=None, sda=None, freq=400000):
        self.id = id
        self.scl = scl
        self.sda = sda
        self.freq = freq

    def scan(self):
        # Acknowledge virtual addresses for OLED (0x3C) and LCD1602 (0x27)
        return [0x3C, 0x27]

    def writeto(self, addr, data):
        return len(data)

    def readfrom(self, addr, nbytes):
        return bytes(nbytes)

    def writeto_mem(self, addr, memaddr, data):
        return len(data)

    def readfrom_mem(self, addr, memaddr, nbytes):
        return bytes(nbytes)

SoftI2C = I2C

class SPI:
    def __init__(self, id=-1, baudrate=10000000, polarity=0, phase=0, sck=None, mosi=None, miso=None):
        pass
    def init(self, **kwargs): pass
    def deinit(self): pass
    def write(self, data): return len(data)
    def read(self, nbytes): return bytes(nbytes)

SoftSPI = SPI

class Timer:
    ONE_SHOT = 0
    PERIODIC = 1
    def __init__(self, id=-1):
        self.id = id
    def init(self, period=1000, mode=PERIODIC, callback=None): pass
    def deinit(self): pass

def reset():
    print("[SYSTEM] ESP8266 Software Reset...")
`
  );

  // 2. network.py
  mp.FS.writeFile(
    '/network.py',
    `
STA_IF = 0
AP_IF = 1
STAT_IDLE = 0
STAT_CONNECTING = 1
STAT_WRONG_PASSWORD = 2
STAT_NO_AP_FOUND = 3
STAT_CONNECT_FAIL = 4
STAT_GOT_IP = 5

class WLAN:
    def __init__(self, interface=STA_IF):
        self.interface = interface
        self._active = False
        self._connected = False

    def active(self, is_active=None):
        if is_active is not None:
            self._active = bool(is_active)
        return self._active

    def connect(self, ssid, password=""):
        self._connected = True
        print(f"[WiFi] Подключение к точке доступа '{ssid}' успешно!")

    def disconnect(self):
        self._connected = False

    def isconnected(self):
        return self._connected

    def ifconfig(self, config=None):
        return ('192.168.1.105', '255.255.255.0', '192.168.1.1', '192.168.1.1')

    def status(self):
        return STAT_GOT_IP

    def scan(self):
        return [(b'Node-RED-AP', b'\\x00\\x11\\x22\\x33\\x44\\x55', 6, -42, 3, False)]
`
  );

  // 3. urequests.py & requests.py
  const urequestsPy = `
import nt_bridge
import ujson

class Response:
    def __init__(self, status_code, text):
        self.status_code = status_code
        self.text = text

    def json(self):
        return ujson.loads(self.text)

    def close(self):
        pass

def get(url, **kwargs):
    raw = nt_bridge.httpRequest("GET", url, "{}")
    data = ujson.loads(raw)
    return Response(data.get("status", 200), data.get("text", ""))

def post(url, data=None, json=None, **kwargs):
    payload_str = ""
    if json is not None:
        payload_str = ujson.dumps(json)
    elif data is not None:
        payload_str = str(data)
    raw = nt_bridge.httpRequest("POST", url, payload_str)
    res_data = ujson.loads(raw)
    return Response(res_data.get("status", 200), res_data.get("text", ""))
`;
  mp.FS.writeFile('/urequests.py', urequestsPy);
  mp.FS.writeFile('/requests.py', urequestsPy);

  // 4. dht.py
  mp.FS.writeFile(
    '/dht.py',
    `
class DHTBase:
    def __init__(self, pin):
        self.pin = pin
    def measure(self):
        pass
    def temperature(self):
        return 23.8
    def humidity(self):
        return 52.4

class DHT11(DHTBase): pass
class DHT22(DHTBase): pass
`
  );

  // 5. ssd1306.py
  mp.FS.writeFile(
    '/ssd1306.py',
    `
import nt_bridge

class SSD1306_I2C:
    def __init__(self, width, height, i2c, addr=0x3C, external_vcc=False):
        self.width = width
        self.height = height
        self.i2c = i2c
        self.addr = addr
        self._lines = []

    def fill(self, col):
        self._lines = []

    def text(self, s, x, y, col=1):
        self._lines.append(str(s))

    def show(self):
        if self._lines:
            nt_bridge.logDisplay("SSD1306", " | ".join(self._lines))

    def pixel(self, x, y, col=1): pass
    def hline(self, x, y, w, col): pass
    def vline(self, x, y, h, col): pass
    def line(self, x1, y1, x2, y2, col): pass
    def rect(self, x, y, w, h, col): pass
    def fill_rect(self, x, y, w, h, col): pass
    def contrast(self, c): pass
    def poweroff(self): pass
    def poweron(self): pass

SSD1306_SPI = SSD1306_I2C
`
  );

  // 6. i2c_lcd.py
  const lcdPy = `
import nt_bridge

class I2cLcd:
    def __init__(self, i2c, i2c_addr, num_lines, num_columns):
        self.i2c = i2c
        self.addr = i2c_addr
        self.lines = num_lines
        self.cols = num_columns
        self._buffer = []

    def putstr(self, s):
        nt_bridge.logDisplay("LCD1602", str(s))

    def clear(self):
        self._buffer = []

    def move_to(self, col, row):
        pass

    def backlight_on(self): pass
    def backlight_off(self): pass
`;
  mp.FS.writeFile('/i2c_lcd.py', lcdPy);
  mp.FS.writeFile('/esp8266_i2c_lcd.py', lcdPy);

  // 7. neopixel.py
  mp.FS.writeFile(
    '/neopixel.py',
    `
import nt_bridge

class NeoPixel:
    def __init__(self, pin, n):
        self.pin = pin
        self.n = n
        self.pixels = [(0, 0, 0)] * n

    def __setitem__(self, index, val):
        self.pixels[index] = val

    def __getitem__(self, index):
        return self.pixels[index]

    def write(self):
        nt_bridge.notifyNeoPixel(self.n)
`
  );

  // 8. bmp280.py
  mp.FS.writeFile(
    '/bmp280.py',
    `
class BMP280:
    def __init__(self, i2c, addr=0x76):
        self.i2c = i2c
        self.addr = addr
    @property
    def temperature(self):
        return 24.1
    @property
    def pressure(self):
        return 101325.0
`
  );

  // 9. Patch time module for speed and pause support
  mp.runPython(`
import time
import nt_bridge

_orig_sleep = time.sleep
_orig_sleep_ms = time.sleep_ms

def _scaled_sleep(s):
    while nt_bridge.isPaused():
        _orig_sleep(0.05)
    spd = nt_bridge.getSpeed()
    _orig_sleep(s / spd if spd > 0 else s)

def _scaled_sleep_ms(ms):
    while nt_bridge.isPaused():
        _orig_sleep_ms(50)
    spd = nt_bridge.getSpeed()
    _orig_sleep_ms(int(ms / spd) if spd > 0 else int(ms))

time.sleep = _scaled_sleep
time.sleep_ms = _scaled_sleep_ms
`);
}

async function getOrInitVM(): Promise<MicroPythonInstance> {
  if (mpInstance) return mpInstance;

  mpInstance = await loadMicroPython({
    url: wasmUrl || '/micropython.wasm',
    stdout: (line: string) => {
      self.postMessage({ type: 'log', logType: 'print', text: line });
    },
    stderr: (line: string) => {
      self.postMessage({ type: 'log', logType: 'error', text: line });
    },
  });

  // Register JS Bridge
  mpInstance.registerJsModule('nt_bridge', {
    notifyPinChange: (pin: number, value: number) => {
      if (pinArray) {
        Atomics.store(pinArray, pin, value);
      } else {
        localPins[pin] = value;
      }
      self.postMessage({ type: 'pin_change', pin, value });
    },
    getPinValue: (pin: number) => {
      if (pinArray) {
        return Atomics.load(pinArray, pin);
      }
      return localPins[pin] ?? 0;
    },
    getAdcValue: () => {
      if (pinArray) {
        return Atomics.load(pinArray, 32);
      }
      return localAdc;
    },
    getSpeed: () => {
      if (controlArray) {
        const val = Atomics.load(controlArray, 1);
        return val > 0 ? val / 100 : 1;
      }
      return localSpeed;
    },
    isPaused: () => {
      if (controlArray) {
        return Atomics.load(controlArray, 0) === 1;
      }
      return localPaused === 1;
    },
    notifyPwmChange: (pin: number, duty: number) => {
      self.postMessage({ type: 'pwm_change', pin, duty });
    },
    notifyNeoPixel: (count: number) => {
      self.postMessage({ type: 'display', driver: 'NeoPixel', text: `${count} RGB пикселей обновлены` });
    },
    logDisplay: (driver: string, text: string) => {
      self.postMessage({ type: 'display', driver, text });
    },
    httpRequest: (method: string, url: string, payloadStr: string) => {
      self.postMessage({
        type: 'log',
        logType: 'info',
        text: `[HTTP ${method}] ➔ ${url} ${payloadStr && payloadStr !== '{}' ? `| Payload: ${payloadStr}` : ''}`,
      });

      // Reverse Polling logic for Node-RED / College Lab
      let responseText = '/off';
      let payloadObj: any = null;
      try {
        if (payloadStr) payloadObj = JSON.parse(payloadStr);
      } catch (_) {}

      const reading =
        payloadObj?.adc ?? payloadObj?.value ?? (pinArray ? Atomics.load(pinArray, 32) : localAdc);

      if (typeof reading === 'number') {
        responseText = reading < 500 ? '/on' : '/off';
      } else {
        responseText = '/on';
      }

      if (url.includes('/status') || url.includes('/state')) {
        responseText = JSON.stringify({ status: 'ok', led: responseText === '/on' ? 1 : 0 });
      }

      self.postMessage({
        type: 'log',
        logType: 'info',
        text: `[HTTP 200] 🗲 Node-RED Ответ: "${responseText}"`,
      });

      return JSON.stringify({ status: 200, text: responseText });
    },
  });

  injectVirtualModules(mpInstance);
  return mpInstance;
}

self.onmessage = async (e: MessageEvent) => {
  const { type, code, speed, pin, value, adc, controlBuffer, pinBuffer } = e.data;

  if (controlBuffer && pinBuffer) {
    controlArray = new Int32Array(controlBuffer);
    pinArray = new Int32Array(pinBuffer);
  }

  if (type === 'start') {
    try {
      const vm = await getOrInitVM();
      self.postMessage({ type: 'ready' });
      // Execute the user flow Python code
      vm.runPython(code);
      self.postMessage({ type: 'done' });
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      self.postMessage({ type: 'error', error: errMsg });
    }
  } else if (type === 'pin_input') {
    if (pinArray) {
      Atomics.store(pinArray, pin, value);
    } else {
      localPins[pin] = value;
    }
  } else if (type === 'adc_input') {
    if (pinArray) {
      Atomics.store(pinArray, 32, adc);
    } else {
      localAdc = adc;
    }
  } else if (type === 'speed') {
    if (controlArray) {
      Atomics.store(controlArray, 1, Math.round(speed * 100));
    } else {
      localSpeed = speed;
    }
  } else if (type === 'pause') {
    if (controlArray) {
      Atomics.store(controlArray, 0, 1);
    } else {
      localPaused = 1;
    }
  } else if (type === 'resume') {
    if (controlArray) {
      Atomics.store(controlArray, 0, 0);
    } else {
      localPaused = 0;
    }
  }
};
