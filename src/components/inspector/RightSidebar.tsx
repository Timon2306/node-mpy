import React, { useState } from 'react';
import {
  Sliders,
  Code2,
  Copy,
  Check,
  Trash2,
  AlertTriangle,
  Info,
  Layers,
  ArrowRight,
  ArrowLeft,
  Plus,
  Package,
} from 'lucide-react';
import { useFlowStore } from '../../store/useFlowStore';
import { LibraryRegistry } from '../../registry/registryLoader';
import { PORT_COLORS, getPortTooltip } from '../../types/ports';
import { extractImportsFromNode, ImportEntry } from '../../types/nodes';
import { translations } from '../../i18n';

const POPULAR_MODULES = [
  { value: 'machine', label: 'machine (Pin, PWM, ADC, I2C, SPI)' },
  { value: 'time', label: 'time (sleep_ms, ticks_ms)' },
  { value: 'network', label: 'network (Wi-Fi, WLAN)' },
  { value: 'neopixel', label: 'neopixel (WS2812 ленты)' },
  { value: 'dht', label: 'dht (DHT11, DHT22)' },
  { value: 'ssd1306', label: 'ssd1306 (OLED экран I2C)' },
  { value: 'st7735', label: 'st7735 (TFT экран SPI)' },
  { value: 'bmp280', label: 'bmp280 (Давление / Температура)' },
  { value: 'servo', label: 'servo (Сервоприводы)' },
  { value: 'max7219', label: 'max7219 (LED матрица)' },
  { value: 'i2c_lcd', label: 'i2c_lcd (Символьный LCD)' },
  { value: 'onewire', label: 'onewire (DS18B20 1-Wire)' },
  { value: 'math', label: 'math (Математика)' },
  { value: 'ujson', label: 'ujson (JSON)' },
  { value: 'urequests', label: 'urequests (HTTP)' },
  { value: 'uasyncio', label: 'uasyncio (Асинхронность)' },
  { value: 'urandom', label: 'urandom (Случайные числа)' },
];

export const RightSidebar: React.FC = () => {
  const [copied, setCopied] = useState(false);

  const {
    nodes,
    selectedNodeId,
    generatedCode,
    language,
    inspectorTab,
    setInspectorTab,
    updateNodeProperties,
    deleteSelectedNode,
    setFunctionModalOpen,
  } = useFlowStore();

  const t = translations[language].inspector;

  const selectedNodes = nodes.filter((n) => n.selected);
  const activeSelectedNode =
    (selectedNodeId ? nodes.find((n) => n.id === selectedNodeId) : null) ||
    (selectedNodes.length === 1 ? selectedNodes[0] : null);

  const selectedDef = activeSelectedNode
    ? LibraryRegistry.getNodeDefinition(activeSelectedNode.data.definitionId)
    : null;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(generatedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePropertyChange = (propId: string, val: any) => {
    if (!activeSelectedNode) return;
    updateNodeProperties(activeSelectedNode.id, { [propId]: val });
  };

  return (
    <aside className="w-[340px] h-full flex flex-col bg-slate-panel border-l border-slate-border select-none z-10 flex-shrink-0">
      {/* Top Tabs */}
      <div className="flex border-b border-slate-border bg-slate-panelHeader">
        <button
          onClick={() => setInspectorTab('properties')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-colors border-b-2 ${
            inspectorTab === 'properties'
              ? 'border-blue-400 text-blue-400 bg-slate-panel'
              : 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-slate-hover'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>{t.propertiesTab}</span>
        </button>

        <button
          onClick={() => setInspectorTab('code')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-colors border-b-2 ${
            inspectorTab === 'code'
              ? 'border-blue-400 text-blue-400 bg-slate-panel'
              : 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-slate-hover'
          }`}
        >
          <Code2 className="w-3.5 h-3.5" />
          <span>{t.codeTab}</span>
        </button>
      </div>

      {/* Tab 1: Properties Inspector */}
      {inspectorTab === 'properties' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-4 select-text">
          {selectedNodes.length > 1 ? (
            /* Multi-node selection panel */
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-border">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 font-semibold text-xs">
                    {selectedNodes.length}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-200">
                      {language === 'ru' ? 'Выбрано узлов' : 'Selected Nodes'}
                    </h3>
                    <p className="text-[11px] text-gray-400 font-mono">
                      {selectedNodes.length} {language === 'ru' ? 'объектов выделено' : 'items selected'}
                    </p>
                  </div>
                </div>

                <button
                  onClick={deleteSelectedNode}
                  title={language === 'ru' ? 'Удалить выбранные' : 'Delete selected'}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded bg-red-950/40 border border-red-500/40 text-red-300 hover:bg-red-900/60 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{language === 'ru' ? 'Удалить' : 'Delete'}</span>
                </button>
              </div>

              <div className="space-y-1.5">
                {selectedNodes.map((n) => (
                  <div
                    key={n.id}
                    className="flex items-center gap-2 p-2 rounded bg-slate-card border border-slate-border text-xs"
                  >
                    <div
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: n.data.color || '#00D4B2' }}
                    />
                    <span className="text-gray-200 font-medium truncate flex-1">
                      {n.data.label}
                    </span>
                    <span className="text-[10px] text-gray-500 font-mono">
                      {n.data.definitionId}
                    </span>
                  </div>
                ))}
              </div>

              <p className="text-[11px] text-gray-500 italic text-center pt-2">
                {language === 'ru'
                  ? 'Используйте Delete или Backspace для удаления выделенных узлов'
                  : 'Press Delete or Backspace to remove selected nodes'}
              </p>
            </div>
          ) : activeSelectedNode && selectedDef ? (
            <>
              {/* Node Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-border">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: selectedDef.color }}
                  />
                  <div>
                    <h3 className="text-sm font-semibold text-gray-200">
                      {selectedDef.label}
                    </h3>
                    <p className="text-[11px] text-gray-400 font-mono">
                      {selectedDef.id}
                    </p>
                  </div>
                </div>

                <button
                  onClick={deleteSelectedNode}
                  title="Удалить ноду (Delete)"
                  className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-950/30 rounded transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Warning alert if module not imported */}
              {activeSelectedNode.data.hasWarning && (
                <div className="p-2.5 bg-amber-950/40 border border-amber-600/50 rounded-md flex items-start gap-2 text-xs text-amber-300">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 text-amber-400 mt-0.5" />
                  <div>
                    <p className="font-semibold">{t.warningTitle}</p>
                    <p className="text-[11px] text-amber-200/90 mt-0.5">
                      {t.warningDesc}
                    </p>
                  </div>
                </div>
              )}

              {/* Node Description */}
              <div className="p-2 bg-slate-canvas rounded text-xs text-gray-400">
                {selectedDef.description}
              </div>

              {/* Dynamic Property Fields or Multi-Import Manager */}
              <div className="space-y-3 pt-1">
                <h4 className="text-xs font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-blue-400" />
                  {t.parametersHeader}
                </h4>

                {activeSelectedNode.data.definitionId === 'core:import_module' ? (
                  /* Dedicated Multi-Import Manager */
                  <div className="space-y-3">
                    <div className="flex items-center justify-between pb-1 border-b border-slate-border">
                      <span className="text-xs font-semibold text-gray-200 flex items-center gap-1.5">
                        <Package className="w-3.5 h-3.5 text-blue-400" />
                        {language === 'ru' ? 'Список импортов' : 'Import List'}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const current = extractImportsFromNode(activeSelectedNode.data.properties);
                          const next = [
                            ...current,
                            { id: `imp_${Date.now()}`, module: 'time', import_all: true, classes: '' },
                          ];
                          updateNodeProperties(activeSelectedNode.id, {
                            imports: next,
                            module: next[0]?.module || 'machine',
                          });
                        }}
                        className="flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300 font-medium px-2 py-0.5 rounded bg-blue-950/40 border border-blue-500/30 hover:border-blue-400 transition-colors"
                      >
                        <Plus className="w-3 h-3" />
                        <span>{language === 'ru' ? 'Добавить модуль' : 'Add Module'}</span>
                      </button>
                    </div>

                    <div className="space-y-2.5">
                      {extractImportsFromNode(activeSelectedNode.data.properties).map((item, idx, arr) => {
                        const isKnown = POPULAR_MODULES.some((m) => m.value === item.module);

                        return (
                          <div
                            key={item.id || idx}
                            className="p-2.5 rounded bg-[#1C2027] border border-[#374151] space-y-2"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-mono font-semibold text-gray-300 flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-blue-400" />
                                #{idx + 1}: {item.module}
                              </span>

                              {arr.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const next = arr.filter((_, i) => i !== idx);
                                    updateNodeProperties(activeSelectedNode.id, {
                                      imports: next,
                                      module: next[0]?.module || 'machine',
                                    });
                                  }}
                                  title={language === 'ru' ? 'Удалить этот модуль' : 'Remove module'}
                                  className="text-gray-400 hover:text-red-400 p-0.5 transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>

                            {/* Select / Input */}
                            <div className="space-y-1">
                              <label className="text-[10px] text-gray-400 block">
                                {language === 'ru' ? 'Модуль' : 'Module'}
                              </label>
                              <select
                                value={isKnown ? item.module : '__custom__'}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  const nextModule = val === '__custom__' ? 'custom_mod' : val;
                                  const next = arr.map((it, i) => (i === idx ? { ...it, module: nextModule } : it));
                                  updateNodeProperties(activeSelectedNode.id, {
                                    imports: next,
                                    module: next[0]?.module || 'machine',
                                  });
                                }}
                                className="w-full bg-slate-canvas text-gray-200 text-xs rounded px-2.5 py-1.5 border border-slate-border focus:border-blue-400 focus:outline-none"
                              >
                                {POPULAR_MODULES.map((opt) => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                                <option value="__custom__">
                                  {language === 'ru' ? '✏️ Другой модуль (ввести вручную)' : '✏️ Custom Module'}
                                </option>
                              </select>

                              {!isKnown && (
                                <input
                                  type="text"
                                  value={item.module}
                                  placeholder="e.g. ubinascii"
                                  onChange={(e) => {
                                    const next = arr.map((it, i) => (i === idx ? { ...it, module: e.target.value } : it));
                                    updateNodeProperties(activeSelectedNode.id, {
                                      imports: next,
                                      module: next[0]?.module || 'machine',
                                    });
                                  }}
                                  className="w-full bg-slate-canvas text-gray-200 text-xs rounded px-2.5 py-1 border border-slate-border focus:border-blue-400 focus:outline-none mt-1 font-mono"
                                />
                              )}
                            </div>

                            {/* Checkbox Import All vs From ... Import */}
                            <div className="space-y-1.5 pt-1 border-t border-[#2A303C]">
                              <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-300">
                                <input
                                  type="checkbox"
                                  checked={item.import_all !== false}
                                  onChange={(e) => {
                                    const next = arr.map((it, i) =>
                                      i === idx ? { ...it, import_all: e.target.checked } : it
                                    );
                                    updateNodeProperties(activeSelectedNode.id, {
                                      imports: next,
                                      module: next[0]?.module || 'machine',
                                    });
                                  }}
                                  className="rounded border-slate-border text-blue-500 bg-slate-canvas w-3.5 h-3.5 cursor-pointer"
                                />
                                <span className="text-[11px]">
                                  {language === 'ru' ? 'Весь модуль (import ...)' : 'Full module (import ...)'}
                                </span>
                              </label>

                              {item.import_all === false && (
                                <div className="space-y-1 pl-5">
                                  <label className="text-[10px] text-gray-400 block">
                                    {language === 'ru' ? 'Классы (через запятую)' : 'Classes (comma separated)'}
                                  </label>
                                  <input
                                    type="text"
                                    value={item.classes || ''}
                                    placeholder="Pin, PWM, ADC"
                                    onChange={(e) => {
                                      const next = arr.map((it, i) =>
                                        i === idx ? { ...it, classes: e.target.value } : it
                                      );
                                      updateNodeProperties(activeSelectedNode.id, {
                                        imports: next,
                                        module: next[0]?.module || 'machine',
                                      });
                                    }}
                                    className="w-full bg-slate-canvas text-gray-200 text-xs rounded px-2.5 py-1 border border-slate-border focus:border-blue-400 focus:outline-none font-mono"
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        const current = extractImportsFromNode(activeSelectedNode.data.properties);
                        const next = [
                          ...current,
                          { id: `imp_${Date.now()}`, module: 'time', import_all: true, classes: '' },
                        ];
                        updateNodeProperties(activeSelectedNode.id, {
                          imports: next,
                          module: next[0]?.module || 'machine',
                        });
                      }}
                      className="w-full py-1.5 flex items-center justify-center gap-1.5 text-xs text-gray-300 hover:text-white rounded bg-slate-panelHeader border border-slate-border hover:border-slate-subtle transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{language === 'ru' ? '+ Добавить еще модуль' : '+ Add another module'}</span>
                    </button>
                  </div>
                ) : (
                  /* Standard property fields */
                  selectedDef.properties.map((prop) => {
                    const isConstantNode = activeSelectedNode.data.definitionId === 'core:constant';
                    const currentDataType = activeSelectedNode.data.properties?.data_type || 'number';

                    if (isConstantNode) {
                      if (prop.id === 'num_val' && currentDataType !== 'number') return null;
                      if (prop.id === 'str_val' && currentDataType !== 'string') return null;
                      if (prop.id === 'bool_val' && currentDataType !== 'boolean') return null;
                    }

                    if (activeSelectedNode.data.definitionId === 'core:logic') {
                      const currentOp = activeSelectedNode.data.properties?.operator || 'and';
                      if (prop.id === 'val_b' && currentOp === 'not') return null;
                    }

                    if (activeSelectedNode.data.definitionId === 'core:math_func') {
                      const currentFunc = activeSelectedNode.data.properties?.func || 'round';
                      if (prop.id === 'default_val2' && (currentFunc === 'abs' || currentFunc === 'round' || currentFunc === 'sqrt')) return null;
                    }

                    const currentValue =
                      activeSelectedNode.data.properties?.[prop.id] !== undefined
                        ? activeSelectedNode.data.properties[prop.id]
                        : prop.defaultValue;

                    return (
                      <div key={prop.id} className="space-y-1">
                        <label className="text-xs text-gray-300 flex items-center justify-between">
                          <span>{prop.label}</span>
                          {prop.description && (
                            <span
                              title={prop.description}
                              className="cursor-help text-[10px] text-gray-500"
                            >
                              <Info className="w-3 h-3" />
                            </span>
                          )}
                        </label>

                        {prop.type === 'select' && prop.options && (
                          <select
                            value={String(currentValue)}
                            onChange={(e) =>
                              handlePropertyChange(prop.id, e.target.value)
                            }
                            className="w-full bg-slate-canvas text-gray-200 text-xs rounded-md px-2.5 py-1.5 border border-slate-border focus:border-blue-400 focus:outline-none"
                          >
                            {prop.options.map((opt) => (
                              <option key={String(opt.value)} value={String(opt.value)}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        )}

                        {prop.type === 'number' && (
                          <input
                            type="number"
                            value={currentValue ?? 0}
                            min={prop.min}
                            max={prop.max}
                            step={prop.step || 1}
                            onChange={(e) =>
                              handlePropertyChange(
                                prop.id,
                                parseFloat(e.target.value) || 0
                              )
                            }
                            className="w-full bg-slate-canvas text-gray-200 text-xs rounded-md px-2.5 py-1.5 border border-slate-border focus:border-blue-400 focus:outline-none font-mono"
                          />
                        )}

                        {prop.type === 'text' && (
                          <input
                            type="text"
                            value={currentValue ?? ''}
                            placeholder={prop.placeholder}
                            onChange={(e) =>
                              handlePropertyChange(prop.id, e.target.value)
                            }
                            className="w-full bg-slate-canvas text-gray-200 text-xs rounded-md px-2.5 py-1.5 border border-slate-border focus:border-blue-400 focus:outline-none"
                          />
                        )}

                        {prop.type === 'boolean' && (
                          <label className="flex items-center gap-2 cursor-pointer mt-1">
                            <input
                              type="checkbox"
                              checked={!!currentValue}
                              onChange={(e) =>
                                handlePropertyChange(prop.id, e.target.checked)
                              }
                              className="rounded border-slate-border text-blue-500 focus:ring-0 bg-slate-canvas w-4 h-4 cursor-pointer"
                            />
                            <span className="text-xs text-gray-400">
                              {currentValue ? 'True' : 'False'}
                            </span>
                          </label>
                        )}

                        {prop.type === 'code' && (
                          <div className="space-y-1.5">
                            <textarea
                              value={currentValue ?? ''}
                              rows={5}
                              onChange={(e) =>
                                handlePropertyChange(prop.id, e.target.value)
                              }
                              className="w-full bg-slate-canvas text-gray-100 font-mono text-xs rounded-md p-2 border border-slate-border focus:border-blue-400 focus:outline-none"
                            />
                            <button
                              onClick={() => setFunctionModalOpen(true)}
                              className="w-full py-1 text-xs bg-slate-hover text-gray-300 rounded border border-slate-border hover:border-slate-subtle transition-colors"
                            >
                              {t.openFullEditor}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}

                {activeSelectedNode.data.definitionId !== 'core:import_module' &&
                  selectedDef.properties.length === 0 && (
                    <p className="text-xs text-gray-500 italic">
                      {t.noProperties}
                    </p>
                  )}
              </div>

              {/* Sockets Information Guide */}
              <div className="pt-3 border-t border-slate-border space-y-2">
                <h4 className="text-xs font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-blue-400" />
                  {t.socketsHeader}
                </h4>

                <div className="space-y-2 text-[11px]">
                  {selectedDef.inputs.map((inp) => (
                    <div
                      key={inp.id}
                      className="p-2 rounded bg-slate-canvas border border-slate-border/50 space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <ArrowRight className="w-3.5 h-3.5 text-gray-400" />
                          <span className="text-gray-200 font-semibold">
                            {inp.label || inp.name}
                          </span>
                        </div>
                        <span
                          className="text-[10px] font-mono px-1.5 py-0.5 rounded font-semibold"
                          style={{
                            color: PORT_COLORS[inp.type],
                            backgroundColor: `${PORT_COLORS[inp.type]}20`,
                          }}
                        >
                          {inp.type}
                        </span>
                      </div>
                      <p className="text-[10px] text-gray-400 leading-tight">
                        {getPortTooltip(inp.label || inp.name, inp.type, 'input', language)}
                      </p>
                    </div>
                  ))}

                  {selectedDef.outputs.map((out) => (
                    <div
                      key={out.id}
                      className="p-2 rounded bg-slate-canvas border border-slate-border/50 space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <ArrowLeft className="w-3.5 h-3.5 text-teal-400" />
                          <span className="text-gray-200 font-semibold">
                            {out.label || out.name}
                          </span>
                        </div>
                        <span
                          className="text-[10px] font-mono px-1.5 py-0.5 rounded font-semibold"
                          style={{
                            color: PORT_COLORS[out.type],
                            backgroundColor: `${PORT_COLORS[out.type]}20`,
                          }}
                        >
                          {out.type}
                        </span>
                      </div>
                      <p className="text-[10px] text-gray-400 leading-tight">
                        {getPortTooltip(out.label || out.name, out.type, 'output', language)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-gray-500">
              <Sliders className="w-10 h-10 mb-2 text-slate-subtle" />
              <p className="text-xs font-medium text-gray-400">
                {t.noNodeSelected}
              </p>
              <p className="text-[11px] text-gray-500 mt-1">
                {t.noNodeSelectedSub}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Live Code Preview */}
      {inspectorTab === 'code' && (
        <div className="flex-1 flex flex-col overflow-hidden select-text">
          {/* Action Header */}
          <div className="flex items-center justify-between p-2.5 bg-slate-panel border-b border-slate-border">
            <span className="text-xs text-gray-300 font-mono flex items-center gap-1.5">
              <Code2 className="w-3.5 h-3.5 text-blue-400" />
              main.py (MicroPython)
            </span>

            <button
              onClick={handleCopyCode}
              className="flex items-center gap-1 px-2.5 py-1 text-xs rounded bg-slate-hover border border-slate-border hover:border-slate-subtle text-gray-200 hover:text-white transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400 font-medium">{t.copied}</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>{t.copyCode}</span>
                </>
              )}
            </button>
          </div>

          {/* Code Viewer with Lines */}
          <div className="flex-1 overflow-auto bg-[#14171C] p-3 font-mono text-[11px] leading-relaxed">
            <pre className="text-gray-200 whitespace-pre">
              <code>{generatedCode}</code>
            </pre>
          </div>

          {/* Footer stats */}
          <div className="px-3 py-1.5 bg-slate-panelHeader border-t border-slate-border text-[10px] text-gray-400 flex items-center justify-between font-mono">
            <span>{generatedCode.split('\n').length} {t.linesCount}</span>
            <span className="text-blue-400">{t.cleanMicropython}</span>
          </div>
        </div>
      )}
    </aside>
  );
};
