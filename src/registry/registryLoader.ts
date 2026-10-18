import { LibraryPackageJSON, PaletteCategory } from '../types/registry';
import { NodeDefinition } from '../types/nodes';

// Static imports of default JSON definitions
import coreLib from './definitions/core.json';
import machineLib from './definitions/machine.json';
import timeLib from './definitions/time.json';
import networkLib from './definitions/network.json';
import dhtLib from './definitions/dht.json';
import neopixelLib from './definitions/neopixel.json';
import ssd1306Lib from './definitions/ssd1306.json';
import bmp280Lib from './definitions/bmp280.json';
import servoLib from './definitions/servo.json';
import st7735Lib from './definitions/st7735.json';
import i2cLcdLib from './definitions/i2c_lcd.json';
import max7219Lib from './definitions/max7219.json';

const BUILTIN_LIBRARIES: LibraryPackageJSON[] = [
  coreLib as unknown as LibraryPackageJSON,
  machineLib as unknown as LibraryPackageJSON,
  timeLib as unknown as LibraryPackageJSON,
  networkLib as unknown as LibraryPackageJSON,
  dhtLib as unknown as LibraryPackageJSON,
  neopixelLib as unknown as LibraryPackageJSON,
  ssd1306Lib as unknown as LibraryPackageJSON,
  bmp280Lib as unknown as LibraryPackageJSON,
  servoLib as unknown as LibraryPackageJSON,
  st7735Lib as unknown as LibraryPackageJSON,
  i2cLcdLib as unknown as LibraryPackageJSON,
  max7219Lib as unknown as LibraryPackageJSON,
];

const STORAGE_KEY = 'node_teal_custom_libraries_v1';

export class LibraryRegistry {
  private static customLibraries: LibraryPackageJSON[] = [];

  static {
    this.loadCustomLibraries();
  }

  private static loadCustomLibraries(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.customLibraries = JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Failed to load custom libraries from localStorage', e);
      this.customLibraries = [];
    }
  }

  private static saveCustomLibraries(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.customLibraries));
    } catch (e) {
      console.error('Failed to save custom libraries to localStorage', e);
    }
  }

  public static getAllLibraries(): LibraryPackageJSON[] {
    return [...BUILTIN_LIBRARIES, ...this.customLibraries];
  }

  public static getBuiltinLibraries(): LibraryPackageJSON[] {
    return [...BUILTIN_LIBRARIES];
  }

  public static getCustomLibraries(): LibraryPackageJSON[] {
    return [...this.customLibraries];
  }

  public static getLibraryById(id: string): LibraryPackageJSON | undefined {
    return this.getAllLibraries().find((lib) => lib.id === id);
  }

  public static getNodeDefinition(definitionId: string): NodeDefinition | undefined {
    for (const lib of this.getAllLibraries()) {
      const node = lib.nodes.find((n) => n.id === definitionId);
      if (node) return node;
    }
    return undefined;
  }

  public static importCustomLibrary(jsonInput: string): { success: boolean; library?: LibraryPackageJSON; error?: string } {
    try {
      const parsed: LibraryPackageJSON = JSON.parse(jsonInput);
      
      // Basic schema validations
      if (!parsed.id || !parsed.name || !Array.isArray(parsed.nodes)) {
        return { success: false, error: 'Неверная структура JSON: отсутствуют обязательные поля id, name или массив nodes' };
      }

      // Check for collision with builtin
      if (BUILTIN_LIBRARIES.some(b => b.id === parsed.id)) {
        return { success: false, error: `Библиотека с id "${parsed.id}" является системной встроенной библиотекой и не может быть перезаписана.` };
      }

      // Filter out existing custom with same id or replace
      this.customLibraries = this.customLibraries.filter(lib => lib.id !== parsed.id);
      this.customLibraries.push(parsed);
      this.saveCustomLibraries();

      return { success: true, library: parsed };
    } catch (e: any) {
      return { success: false, error: `Ошибка парсинга JSON: ${e.message || e}` };
    }
  }

  public static deleteCustomLibrary(id: string): boolean {
    const prevLen = this.customLibraries.length;
    this.customLibraries = this.customLibraries.filter(lib => lib.id !== id);
    if (this.customLibraries.length !== prevLen) {
      this.saveCustomLibraries();
      return true;
    }
    return false;
  }

  /**
   * Builds the categorized palette for the left sidebar based on unlocked/imported libraries
   */
  public static getPaletteCategories(unlockedLibraryIds: string[]): PaletteCategory[] {
    const allLibs = this.getAllLibraries();
    const categoriesMap: Map<string, PaletteCategory> = new Map();

    for (const lib of allLibs) {
      const isCore = lib.id === 'core';
      const isUnlocked = isCore || unlockedLibraryIds.includes(lib.id);

      if (!categoriesMap.has(lib.category)) {
        categoriesMap.set(lib.category, {
          id: lib.category.toLowerCase().replace(/\s+/g, '_'),
          name: lib.category,
          color: lib.color,
          icon: lib.icon,
          isUnlocked,
          nodes: [],
        });
      }

      const cat = categoriesMap.get(lib.category)!;
      // Category is unlocked if at least one of its member libraries is unlocked
      if (isUnlocked) {
        cat.isUnlocked = true;
      }

      for (const node of lib.nodes) {
        // Only include node in palette if its parent library is unlocked
        if (isUnlocked) {
          cat.nodes.push(node);
        }
      }
    }

    return Array.from(categoriesMap.values()).filter(cat => cat.nodes.length > 0 || cat.name === 'Core');
  }

  /**
   * Ready-to-copy Prompt template for AI (ChatGPT / Claude / DeepSeek)
   */
  public static getAiPromptTemplate(): string {
    return `# ИНСТРУКЦИЯ ДЛЯ НЕЙРОСЕТИ: СОЗДАНИЕ ПАКЕТА НОД ДЛЯ Node-TEAL

Ты — специализированный генератор конфигурационных JSON-пакетов для среды визуального программирования "Node-TEAL" (визуальная среда MicroPython в стиле Node-RED).

## ТВОЯ ЗАДАЧА:
Ниже прикреплен исходный код драйвера/библиотеки MicroPython (.py файл).
Проанализируй методы, конструктор (__init__) и параметры класса в этой библиотеке и сгенерируй ГОТОВЫЙ JSON-пакет нод для импорта в Node-TEAL.

---

## ПРАВИЛА И СХЕМА JSON:
1. Выходной формат должен быть СТРОГО валидным JSON объектом (без пояснений, только JSON).
2. Типы портов (сокетов) строго типизированы:
   - "flow"    — белый порт очередности выполнения программы.
   - "pin"     — объект аппаратного пина machine.Pin.
   - "bus"     — объект шины (I2C, SPI, UART, OneWire).
   - "device"  — объект экземпляра драйвера (дисплей, датчик, мотор).
   - "number"  — числовые данные (int/float, например температура, расстояние).
   - "boolean" — логические данные (True/False).
   - "string"  — строки текста.
   - "any"     — универсальный вход для печати или выражений.
3. Секции генерации кода ("section"):
   - "init"    — создание объектов (экран, сенсор, шина). Выполняется в секции "# --- 2. HARDWARE & OBJECTS INIT ---".
   - "flow"    — действие (чтение датчика, вывод текста, движение). Выполняется по очереди в секции "# --- 4. MAIN EXECUTION & LOOP ---".
   - "functions" — кастомные функции.

---

## ЭТАЛОННЫЙ ПРИМЕР JSON (ДЛЯ ДРАЙВЕРА СЕРВОПРИВОДА):

{
  "id": "my_servo",
  "name": "MyServo Driver",
  "version": "1.0.0",
  "description": "Управление сервоприводом через PWM",
  "isNative": false,
  "category": "Actuators",
  "color": "#F59E0B",
  "icon": "RotateCw",
  "importSnippet": "from servo import Servo",
  "nodes": [
    {
      "id": "my_servo:init",
      "libraryId": "my_servo",
      "label": "Servo Init",
      "category": "Actuators",
      "color": "#F59E0B",
      "icon": "RotateCw",
      "description": "Инициализация сервопривода на пине",
      "inputs": [
        { "id": "pin", "name": "pin", "type": "pin", "label": "Pin" }
      ],
      "outputs": [
        { "id": "servo_obj", "name": "servo_obj", "type": "device", "label": "Servo" }
      ],
      "properties": [
        { "id": "freq", "name": "freq", "type": "number", "label": "PWM Частота (Hz)", "defaultValue": 50 }
      ],
      "codeTemplate": {
        "section": "init",
        "template": "servo_{{id}} = Servo({{inputs.pin}}, freq={{props.freq}})",
        "outputVariables": {
          "servo_obj": "servo_{{id}}"
        }
      }
    },
    {
      "id": "my_servo:write_angle",
      "libraryId": "my_servo",
      "label": "Servo Write Angle",
      "category": "Actuators",
      "color": "#F59E0B",
      "icon": "Compass",
      "description": "Поворот вала на угол (0-180)",
      "inputs": [
        { "id": "flow_in", "name": "flow_in", "type": "flow", "label": "Flow" },
        { "id": "servo", "name": "servo", "type": "device", "label": "Servo" },
        { "id": "angle", "name": "angle", "type": "number", "label": "Angle" }
      ],
      "outputs": [
        { "id": "flow_out", "name": "flow_out", "type": "flow", "label": "Flow" }
      ],
      "properties": [
        { "id": "def_angle", "name": "def_angle", "type": "number", "label": "Угол по умолч.", "defaultValue": 90 }
      ],
      "codeTemplate": {
        "section": "flow",
        "template": "{{inputs.servo}}.write_angle({{inputs.angle || props.def_angle}})"
      }
    }
  ]
}

---
СКОПИРУЙ ЭТОТ ПРОМПТ В СТОРОННЮЮ НЕЙРОСЕТЬ ВМЕСТЕ С КОДОМ СВОЕЙ БИБЛИОТЕКИ!`;
  }
}
