export type PortType = 
  | 'flow' 
  | 'pin' 
  | 'bus' 
  | 'device' 
  | 'number' 
  | 'boolean' 
  | 'string' 
  | 'any';

export interface PortDefinition {
  id: string;
  name: string;
  type: PortType;
  label?: string;
  description?: string;
  defaultValue?: any;
}

export const PORT_COLORS: Record<PortType, string> = {
  flow: '#FFFFFF',
  pin: '#10B981',
  bus: '#8B5CF6',
  device: '#F59E0B',
  number: '#3B82F6',
  boolean: '#EC4899',
  string: '#EAB308',
  any: '#94A3B8',
};

export const PORT_LABELS: Record<PortType, string> = {
  flow: 'Flow (Execution)',
  pin: 'Pin (machine.Pin)',
  bus: 'Bus (I2C/SPI/UART)',
  device: 'Device Instance',
  number: 'Number (int/float)',
  boolean: 'Boolean (True/False)',
  string: 'String (Text)',
  any: 'Any Type',
};

/**
 * Validates whether an output port of type source can connect to an input port of type target
 */
export function arePortsCompatible(source: PortType, target: PortType): boolean {
  if (source === target) return true;
  // White Flow execution connections are strictly isolated: Flow only connects to Flow
  if (source === 'flow' || target === 'flow') return false;
  // 'any' socket accepts any non-flow data port, and 'any' output can feed any non-flow input
  if (target === 'any' || source === 'any') return true;
  // In MicroPython, numbers (0, 1) and booleans (False, True) are interchangeable in logic & conditions
  // e.g. Pin Read returns 0/1, which can connect directly to Boolean condition ports of If/Else or Comparison
  if ((source === 'number' && target === 'boolean') || (source === 'boolean' && target === 'number')) return true;
  // Strings can receive numbers or booleans for printing or formatting
  if (target === 'string' && (source === 'number' || source === 'boolean')) return true;
  return false;
}

/**
 * Returns clear, helpful hover connection hints for ports
 */
export function getPortTooltip(
  name: string,
  type: PortType,
  direction: 'input' | 'output',
  lang: 'ru' | 'en' = 'ru'
): string {
  if (lang === 'ru') {
    switch (type) {
      case 'flow':
        return direction === 'input'
          ? `[Flow In] Вход потока выполнения ➔ Соедините с Flow Out предыдущей ноды`
          : `[Flow Out] Выход потока выполнения ➔ Соедините с Flow In следующей ноды`;
      case 'pin':
        return direction === 'input'
          ? `[Pin In] Вход пина (machine.Pin) ➔ Подключите к пину (напр. Pin GPIO)`
          : `[Pin Out] Выход пина (machine.Pin) ➔ Подключите ко входу устройства`;
      case 'bus':
        return direction === 'input'
          ? `[Bus In] Вход шины (I2C/SPI/UART) ➔ Подключите к шине контроллера`
          : `[Bus Out] Выход шины (I2C/SPI/UART) ➔ Подключите к экранам или датчикам на шине`;
      case 'device':
        return direction === 'input'
          ? `[Device In] Вход устройства ➔ Подключите инициализированный объект датчика/экрана`
          : `[Device Out] Выход устройства ➔ Подключите к нодам чтения или управления устройством`;
      case 'number':
        return direction === 'input'
          ? `[Number In] Вход числа ➔ Принимает числовые данные (int/float)`
          : `[Number Out] Выход числа ➔ Выдает числовые данные (значение, температура, координата)`;
      case 'boolean':
        return direction === 'input'
          ? `[Boolean In] Вход логики ➔ Принимает True или False`
          : `[Boolean Out] Выход логики ➔ Выдает логический результат True или False`;
      case 'string':
        return direction === 'input'
          ? `[String In] Вход текста ➔ Принимает текстовую строку (str)`
          : `[String Out] Выход текста ➔ Выдает строку текста для вывода или передачи`;
      case 'any':
        return direction === 'input'
          ? `[Any In] Универсальный вход ➔ Принимает любые совместимые данные`
          : `[Any Out] Универсальный выход ➔ Выдает данные`;
      default:
        return `${name} (${type})`;
    }
  } else {
    switch (type) {
      case 'flow':
        return direction === 'input'
          ? `[Flow In] Execution In ➔ Connect to Flow Out of previous node`
          : `[Flow Out] Execution Out ➔ Connect to Flow In of next node`;
      case 'pin':
        return direction === 'input'
          ? `[Pin In] Pin In (machine.Pin) ➔ Connect to Pin object`
          : `[Pin Out] Pin Out (machine.Pin) ➔ Connect to device pin input`;
      case 'bus':
        return direction === 'input'
          ? `[Bus In] Bus In (I2C/SPI/UART) ➔ Connect to controller bus`
          : `[Bus Out] Bus Out (I2C/SPI/UART) ➔ Connect to sensors or displays on bus`;
      case 'device':
        return direction === 'input'
          ? `[Device In] Device In ➔ Connect to initialized device object`
          : `[Device Out] Device Out ➔ Connect to device read/write/display nodes`;
      case 'number':
        return direction === 'input'
          ? `[Number In] Number In ➔ Accepts numeric data (int/float)`
          : `[Number Out] Number Out ➔ Emits numeric value (measurement, coordinate)`;
      case 'boolean':
        return direction === 'input'
          ? `[Boolean In] Boolean In ➔ Accepts True or False`
          : `[Boolean Out] Boolean Out ➔ Emits True or False status`;
      case 'string':
        return direction === 'input'
          ? `[String In] String In ➔ Accepts text string (str)`
          : `[String Out] String Out ➔ Emits text string`;
      case 'any':
        return direction === 'input'
          ? `[Any In] Any Data In ➔ Accepts compatible data`
          : `[Any Out] Any Data Out ➔ Emits data`;
      default:
        return `${name} (${type})`;
    }
  }
}

/**
 * Explains clearly why two ports cannot be connected
 */
export function getIncompatibleConnectionReason(
  sourceType: PortType,
  targetType: PortType,
  lang: 'ru' | 'en' = 'ru'
): string {
  const sourceName = PORT_LABELS[sourceType] || sourceType;
  const targetName = PORT_LABELS[targetType] || targetType;

  if (lang === 'ru') {
    if (sourceType === 'flow' && targetType !== 'flow') {
      return `Нельзя соединить Flow (поток выполнения) с данными (${targetName}). Белые порты Flow соединяются только между собой!`;
    }
    if (sourceType !== 'flow' && targetType === 'flow') {
      return `Нельзя соединить порт данных (${sourceName}) с портом Flow (поток выполнения).`;
    }
    return `Несовместимые типы: выход "${sourceName}" нельзя подключить ко входу "${targetName}". Соединяйте порты одинакового типа и цвета!`;
  } else {
    if (sourceType === 'flow' && targetType !== 'flow') {
      return `Cannot connect Flow (execution) to data port (${targetName}). White Flow ports only connect to Flow!`;
    }
    if (sourceType !== 'flow' && targetType === 'flow') {
      return `Cannot connect data port (${sourceName}) to Flow execution port.`;
    }
    return `Incompatible socket types: "${sourceName}" cannot connect to "${targetName}". Connect ports of matching types and colors!`;
  }
}

