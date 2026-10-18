import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import {
  Cpu,
  Zap,
  Clock,
  Tv,
  Thermometer,
  RotateCw,
  Sun,
  Activity,
  Box,
  Repeat,
  GitFork,
  CheckSquare,
  Calculator,
  Maximize2,
  Terminal,
  Code2,
  Play,
  ToggleLeft,
  ArrowUpRight,
  Eye,
  RefreshCw,
  Sliders,
  BarChart2,
  Radio,
  Wifi,
  Power,
  PauseCircle,
  Watch,
  GitCommit,
  Square,
  Type,
  CheckCircle,
  Gauge,
  Compass,
  Slash,
  Monitor,
  Grid,
  AlertTriangle,
  Hash,
  Sparkles,
  Palette,
  Disc,
  LucideIcon,
} from 'lucide-react';
import { NodeInstanceData, extractImportsFromNode } from '../../types/nodes';
import { PORT_COLORS, getPortTooltip } from '../../types/ports';
import { LibraryRegistry } from '../../registry/registryLoader';
import { useFlowStore } from '../../store/useFlowStore';

const ICON_MAP: Record<string, LucideIcon> = {
  Cpu,
  Zap,
  Clock,
  Tv,
  Thermometer,
  RotateCw,
  Sun,
  Activity,
  Box,
  Repeat,
  GitFork,
  CheckSquare,
  Calculator,
  Maximize2,
  Terminal,
  Code2,
  Play,
  ToggleLeft,
  ArrowUpRight,
  Eye,
  RefreshCw,
  Sliders,
  BarChart2,
  Radio,
  Wifi,
  Power,
  PauseCircle,
  Watch,
  GitCommit,
  Square,
  Type,
  Hash,
  CheckCircle,
  Gauge,
  Compass,
  Slash,
  Monitor,
  Grid,
  Sparkles,
  Palette,
  Disc,
};

export const NodeTealNode = memo(({ id, data, selected }: NodeProps) => {
  const language = useFlowStore((s) => s.language);
  const activeSimNodeId = useFlowStore((s) => s.activeSimNodeId);
  const errorSimNodeId = useFlowStore((s) => s.errorSimNodeId);

  const isSimActive = activeSimNodeId === id;
  const isSimError = errorSimNodeId === id;

  const nodeData = data as unknown as NodeInstanceData;
  const def = LibraryRegistry.getNodeDefinition(nodeData?.definitionId);
  const IconComponent = (nodeData?.icon && ICON_MAP[nodeData.icon]) || Cpu;

  // Subtitle and label calculation based on properties
  let subtitle = '';
  let displayLabel = nodeData.label;
  let importLines: string[] = [];

  if (nodeData.definitionId === 'machine:pin_init') {
    subtitle = `GPIO ${nodeData.properties?.pin ?? 2} (${nodeData.properties?.mode ?? 'OUT'})`;
  } else if (nodeData.definitionId === 'core:import_module') {
    const imps = extractImportsFromNode(nodeData.properties);
    if (imps.length === 0) {
      displayLabel = 'Import: machine';
      importLines = ['import machine'];
    } else if (imps.length === 1) {
      const first = imps[0];
      displayLabel = `Import: ${first.module}`;
      const line = !first.import_all && first.classes
        ? `from ${first.module} import ${first.classes}`
        : `import ${first.module}`;
      importLines = [line];
    } else {
      displayLabel = `Imports (${imps.length})`;
      importLines = imps.map((item) => {
        if (!item.import_all && item.classes) {
          return `from ${item.module} import ${item.classes}`;
        }
        return `import ${item.module}`;
      });
    }
  } else if (nodeData.definitionId === 'time:sleep_ms') {
    subtitle = `${nodeData.properties?.duration ?? 500} ms`;
  } else if (nodeData.definitionId === 'ssd1306:init_i2c') {
    subtitle = `${nodeData.properties?.width ?? 128}x${nodeData.properties?.height ?? 64}`;
  } else if (nodeData.definitionId === 'dht:init') {
    subtitle = `${nodeData.properties?.model ?? 'DHT22'}`;
  } else if (nodeData.definitionId === 'servo:write_angle') {
    subtitle = `${nodeData.properties?.def_angle ?? 90}°`;
  } else if (nodeData.definitionId === 'core:print') {
    const text = nodeData.properties?.message || nodeData.properties?.prefix;
    if (text) {
      subtitle = `"${text.length > 18 ? text.slice(0, 16) + '…' : text}"`;
    }
  } else if (nodeData.definitionId === 'core:comparison') {
    const op = nodeData.properties?.operator || '==';
    const valB = nodeData.properties?.val_b !== undefined ? String(nodeData.properties.val_b) : '1';
    subtitle = `${op} ${valB}`;
  } else if (nodeData.definitionId === 'core:variable_set') {
    const name = nodeData.properties?.var_name || 'x';
    const val = nodeData.properties?.default_val !== undefined ? String(nodeData.properties.default_val) : '0';
    subtitle = `${name} = ${val}`;
  } else if (nodeData.definitionId === 'core:variable_get') {
    subtitle = `${nodeData.properties?.var_name || 'x'}`;
  } else if (nodeData.definitionId === 'core:constant') {
    const type = nodeData.properties?.data_type || 'number';
    if (type === 'number') subtitle = `${nodeData.properties?.num_val ?? 1}`;
    else if (type === 'string') subtitle = `"${nodeData.properties?.str_val ?? 'Hello'}"`;
    else subtitle = `${nodeData.properties?.bool_val ?? 'True'}`;
  } else if (nodeData.definitionId === 'machine:pin_read') {
    subtitle = `Read GPIO (0/1)`;
  } else if (nodeData.definitionId === 'machine:pin_is_active') {
    subtitle = `Is Active (1/HIGH)`;
  } else if (nodeData.definitionId === 'core:math') {
    const op = nodeData.properties?.operator || '+';
    const valB = nodeData.properties?.val_b !== undefined ? String(nodeData.properties.val_b) : '';
    subtitle = `${op} ${valB}`;
  } else if (nodeData.definitionId === 'core:logic') {
    subtitle = `${String(nodeData.properties?.operator || 'and').toUpperCase()}`;
  } else if (nodeData.definitionId === 'core:string_format') {
    const pre = nodeData.properties?.prefix ?? 'Val: ';
    subtitle = `"${pre}…"`;
  } else if (nodeData.definitionId === 'core:random') {
    subtitle = `${nodeData.properties?.min_val ?? 0}..${nodeData.properties?.max_val ?? 100}`;
  } else if (nodeData.definitionId === 'core:comment') {
    const txt = nodeData.properties?.text || '';
    subtitle = txt.length > 20 ? txt.slice(0, 18) + '…' : txt;
  } else if (nodeData.definitionId === 'time:sleep_s') {
    subtitle = `${nodeData.properties?.duration ?? 1} s`;
  } else if (nodeData.definitionId === 'time:sleep_us') {
    subtitle = `${nodeData.properties?.duration ?? 100} µs`;
  } else if (nodeData.definitionId === 'machine:pwm_freq') {
    subtitle = `${nodeData.properties?.freq ?? 1000} Hz`;
  } else if (nodeData.definitionId === 'machine:tone') {
    subtitle = `${nodeData.properties?.freq ?? 440} Hz (${nodeData.properties?.state ?? 'ON'})`;
  } else if (nodeData.definitionId === 'machine:adc_read') {
    subtitle = `Read U16`;
  } else if (nodeData.definitionId === 'network:wlan_connect') {
    subtitle = `SSID: ${nodeData.properties?.ssid ?? 'WiFi'}`;
  } else if (nodeData.definitionId === 'network:is_connected') {
    subtitle = `isconnected()`;
  } else if (nodeData.definitionId === 'network:ifconfig') {
    subtitle = `IP Config`;
  } else if (nodeData.definitionId === 'i2c_lcd:put_str') {
    const txt = nodeData.properties?.def_text ?? '';
    subtitle = `"${txt.length > 15 ? txt.slice(0, 13) + '…' : txt}"`;
  } else if (nodeData.definitionId === 'i2c_lcd:move_to') {
    subtitle = `Col:${nodeData.properties?.col ?? 0}, Row:${nodeData.properties?.row ?? 0}`;
  } else if (nodeData.definitionId === 'max7219:text') {
    const txt = nodeData.properties?.def_text ?? '';
    subtitle = `"${txt.length > 15 ? txt.slice(0, 13) + '…' : txt}"`;
  } else if (nodeData.definitionId === 'core:for_range') {
    subtitle = `Count: ${nodeData.properties?.count ?? 5}`;
  } else if (nodeData.definitionId === 'core:math_func') {
    subtitle = `${nodeData.properties?.func ?? 'round'}()`;
  } else if (nodeData.definitionId === 'core:type_cast') {
    subtitle = `➔ ${nodeData.properties?.target_type ?? 'int'}`;
  } else if (nodeData.definitionId === 'time:ticks_us') {
    subtitle = `Ticks µs`;
  } else if (nodeData.definitionId === 'time:ticks_add') {
    subtitle = `+ ${nodeData.properties?.delta ?? 1000} ms`;
  } else if (nodeData.definitionId === 'machine:timer') {
    subtitle = `${nodeData.properties?.period ?? 1000} ms (${nodeData.properties?.mode ?? 'PERIODIC'})`;
  } else if (nodeData.definitionId === 'machine:timer_deinit') {
    subtitle = `Stop Timer`;
  } else if (nodeData.definitionId === 'machine:i2c_scan') {
    subtitle = `Scan I2C Bus`;
  } else if (nodeData.definitionId === 'machine:pwm_deinit') {
    subtitle = `Stop PWM`;
  } else if (nodeData.definitionId === 'machine:deep_sleep') {
    subtitle = `${nodeData.properties?.duration ?? 10000} ms`;
  } else if (nodeData.definitionId === 'network:ap_active') {
    subtitle = `AP: ${nodeData.properties?.ssid ?? 'ESP-AccessPoint'}`;
  } else if (nodeData.definitionId === 'network:disconnect') {
    subtitle = `Disconnect`;
  } else if (nodeData.definitionId === 'ssd1306:line') {
    subtitle = `Line (${nodeData.properties?.x0 ?? 0},${nodeData.properties?.y0 ?? 0})➔(${nodeData.properties?.x1 ?? 127},${nodeData.properties?.y1 ?? 63})`;
  } else if (nodeData.definitionId === 'ssd1306:pixel') {
    subtitle = `Pixel (${nodeData.properties?.x ?? 64}, ${nodeData.properties?.y ?? 32})`;
  }

  const inputs = def?.inputs || [];
  const outputs = def?.outputs || [];
  const isMultiPort = inputs.length > 1 || outputs.length > 1;
  const maxPorts = Math.max(inputs.length, outputs.length);
  const nodeColor = nodeData.color || '#3B82F6';

  const isImportNode = nodeData.definitionId === 'core:import_module';
  const isImportMulti = isImportNode && importLines.length > 1;

  let sizeClasses = '';
  if (isMultiPort) {
    sizeClasses = 'min-w-[210px] max-w-[260px]';
  } else if (isImportMulti) {
    sizeClasses = 'min-w-[190px] max-w-[340px] min-h-[38px] flex items-stretch';
  } else if (isImportNode) {
    sizeClasses = 'min-w-[170px] max-w-[280px] h-[38px] flex items-stretch';
  } else {
    sizeClasses = 'min-w-[170px] max-w-[240px] h-[38px] flex items-stretch';
  }

  let borderColor = '#374151';
  let boxShadow = '0 2px 4px rgba(0,0,0,0.3)';

  if (isSimError) {
    borderColor = '#EF4444';
    boxShadow = '0 0 0 2.5px #EF4444, 0 0 16px rgba(239, 68, 68, 0.7)';
  } else if (isSimActive) {
    borderColor = '#00D4B2';
    boxShadow = '0 0 0 2.5px #00D4B2, 0 0 16px rgba(0, 212, 178, 0.7)';
  } else if (selected) {
    borderColor = '#38BDF8';
    boxShadow = '0 0 0 1.5px #38BDF8, 0 4px 12px rgba(0,0,0,0.4)';
  } else if (nodeData.hasWarning) {
    borderColor = '#F59E0B';
  }

  const containerStyle: React.CSSProperties = {
    backgroundColor: isSimActive ? '#1A2930' : '#242832', // 100% solid, fully opaque
    borderColor,
    boxShadow,
  };

  return (
    <div
      style={containerStyle}
      className={`relative rounded-[6px] border select-none transition-colors duration-150 ${sizeClasses} ${
        !selected && !nodeData.hasWarning && !isSimActive && !isSimError ? 'hover:border-gray-500' : ''
      }`}
    >
      {/* Simulation Active Indicator Pulse Badge */}
      {isSimActive && (
        <div className="absolute -top-3 -left-1 px-1.5 py-0.5 rounded-full bg-teal-500 text-slate-950 font-bold font-mono text-[9px] shadow-md z-30 animate-pulse flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-950" />
          <span>RUNNING</span>
        </div>
      )}

      {/* Simulation Error Badge */}
      {isSimError && (
        <div className="absolute -top-3 -left-1 px-1.5 py-0.5 rounded-full bg-red-600 text-white font-bold font-mono text-[9px] shadow-lg z-30 animate-bounce flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" />
          <span>ERROR</span>
        </div>
      )}

      {/* Warning badge if library is not imported */}
      {nodeData.hasWarning && !isSimError && (
        <div
          title={nodeData.warningMessage}
          className="absolute -top-2.5 -right-2.5 w-5 h-5 bg-amber-500 text-black rounded-full flex items-center justify-center shadow-md z-20 cursor-help"
        >
          <AlertTriangle className="w-3.5 h-3.5" />
        </div>
      )}

      {isMultiPort ? (
        /* Multi-port Node (Header + Port Rows) */
        <div className="w-full">
          {/* Header */}
          <div className="h-[34px] flex items-center justify-between border-b border-[#374151] bg-[#1C2027] rounded-t-[5px]">
            <div className="flex items-center gap-2 h-full overflow-hidden">
              <div
                className="w-8 h-full flex items-center justify-center bg-[#181B21] border-r border-[#374151] rounded-tl-[5px] flex-shrink-0"
                style={{ borderLeft: `3.5px solid ${nodeColor}` }}
              >
                <IconComponent
                  className="w-4 h-4"
                  style={{ color: nodeColor }}
                />
              </div>
              <div className="flex flex-col px-1.5 overflow-hidden leading-tight">
                <span className="text-[12px] font-semibold text-gray-100 truncate">
                  {displayLabel}
                </span>
                {subtitle && (
                  <span className="text-[10px] text-gray-400 font-mono truncate">
                    {subtitle}
                  </span>
                )}
              </div>
            </div>

            <div
              className="w-2 h-2 rounded-full mr-2.5 flex-shrink-0"
              style={{ backgroundColor: nodeColor }}
            />
          </div>

          {/* Port Rows */}
          <div className="py-1.5 space-y-1">
            {Array.from({ length: maxPorts }).map((_, idx) => {
              const inp = inputs[idx];
              const out = outputs[idx];

              return (
                <div
                  key={idx}
                  className="relative h-[22px] flex items-center justify-between px-2 text-[10px] font-mono"
                >
                  {/* Left Port */}
                  {inp ? (
                    <div className="flex items-center gap-1.5 overflow-hidden mr-2">
                      <Handle
                        id={inp.id}
                        type="target"
                        position={Position.Left}
                        title={getPortTooltip(inp.label || inp.name, inp.type, 'input', language)}
                        className="transition-transform duration-100 hover:scale-125 cursor-crosshair"
                        style={{
                          top: '50%',
                          transform: 'translateY(-50%)',
                          backgroundColor: PORT_COLORS[inp.type] || '#FFFFFF',
                          borderColor: '#242832',
                        }}
                      />
                      <span
                        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: PORT_COLORS[inp.type] }}
                      />
                      <span className="text-gray-300 font-medium truncate">
                        {inp.label || inp.name}
                      </span>
                    </div>
                  ) : (
                    <div />
                  )}

                  {/* Right Port */}
                  {out ? (
                    <div className="flex items-center gap-1.5 overflow-hidden ml-auto">
                      <span className="text-gray-300 font-medium truncate text-right">
                        {out.label || out.name}
                      </span>
                      <span
                        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: PORT_COLORS[out.type] }}
                      />
                      <Handle
                        id={out.id}
                        type="source"
                        position={Position.Right}
                        title={getPortTooltip(out.label || out.name, out.type, 'output', language)}
                        className="transition-transform duration-100 hover:scale-125 cursor-crosshair"
                        style={{
                          top: '50%',
                          transform: 'translateY(-50%)',
                          backgroundColor: PORT_COLORS[out.type] || '#FFFFFF',
                          borderColor: '#242832',
                        }}
                      />
                    </div>
                  ) : (
                    <div />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Compact Single-Port Node */
        <>
          {/* Left Icon Square with solid colored accent line */}
          <div
            className="w-8 flex items-center justify-center bg-[#1C2027] border-r border-[#374151] rounded-l-[5px] flex-shrink-0 self-stretch"
            style={{ borderLeft: `3.5px solid ${nodeColor}` }}
          >
            <IconComponent
              className="w-4 h-4"
              style={{ color: nodeColor }}
            />
          </div>

          {/* Node content: Title + Subtitle or Import Lines Column */}
          <div className="flex flex-col px-2.5 py-1.5 overflow-hidden w-full leading-tight justify-center">
            <span className="text-[12px] font-semibold text-gray-100 truncate">
              {displayLabel}
            </span>
            {importLines.length > 0 ? (
              <div className="flex flex-col gap-0.5 mt-0.5">
                {importLines.map((line, idx) => (
                  <span
                    key={idx}
                    className="text-[10px] text-gray-400 font-mono truncate"
                    title={line}
                  >
                    {line}
                  </span>
                ))}
              </div>
            ) : (
              subtitle && (
                <span className="text-[10px] text-gray-400 font-mono truncate mt-0.5">
                  {subtitle}
                </span>
              )
            )}
          </div>

          {/* Single Input Socket (Left) */}
          {inputs.length === 1 && (
            <Handle
              id={inputs[0].id}
              type="target"
              position={Position.Left}
              title={getPortTooltip(inputs[0].label || inputs[0].name, inputs[0].type, 'input', language)}
              className="transition-transform duration-100 hover:scale-125 cursor-crosshair"
              style={{
                top: '50%',
                transform: 'translateY(-50%)',
                backgroundColor: PORT_COLORS[inputs[0].type] || '#FFFFFF',
                borderColor: '#242832',
              }}
            />
          )}

          {/* Single Output Socket (Right) */}
          {outputs.length === 1 && (
            <Handle
              id={outputs[0].id}
              type="source"
              position={Position.Right}
              title={getPortTooltip(outputs[0].label || outputs[0].name, outputs[0].type, 'output', language)}
              className="transition-transform duration-100 hover:scale-125 cursor-crosshair"
              style={{
                top: '50%',
                transform: 'translateY(-50%)',
                backgroundColor: PORT_COLORS[outputs[0].type] || '#FFFFFF',
                borderColor: '#242832',
              }}
            />
          )}
        </>
      )}
    </div>
  );
});

NodeTealNode.displayName = 'NodeTealNode';
