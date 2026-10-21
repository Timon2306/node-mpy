import { FlowTab, NodeMpyProject } from '../types/project';
import { PORT_COLORS, PortType } from '../types/ports';
import { extractImportsFromNode } from '../types/nodes';
import { LibraryRegistry } from '../registry/registryLoader';
import { LUCIDE_ICON_PATHS } from './lucideIconPaths';

/**
 * Result of a file save operation
 */
export interface SaveResult {
  success: boolean;
  canceled?: boolean;
  path?: string;
  error?: string;
}

/**
 * Robust Cross-Platform File Saver
 * Uses Tauri native dialog + Rust filesystem in desktop app (Linux, Windows, macOS).
 * Falls back to standard browser Blob download in Web environment.
 */
export async function saveFileCrossPlatform(options: {
  filename: string;
  title?: string;
  content: string | Uint8Array;
  filterName: string;
  extensions: string[];
  mimeType: string;
}): Promise<SaveResult> {
  const { filename, title, content, filterName, extensions, mimeType } = options;

  // 1. Desktop Mode (Tauri)
  const isDesktop =
    typeof window !== 'undefined' &&
    (Boolean((window as any).__TAURI_INTERNALS__) ||
      Boolean((window as any).isTauri) ||
      Boolean((window as any).__TAURI__));

  if (isDesktop) {
    try {
      const { save } = await import('@tauri-apps/plugin-dialog');
      const { invoke } = await import('@tauri-apps/api/core');

      const filePath = await save({
        title: title || `Сохранить ${filename}`,
        defaultPath: filename,
        filters: [{ name: filterName, extensions }],
      });

      // User clicked "Cancel" in the native GTK / Windows / Cocoa file dialog
      if (!filePath) {
        return { success: false, canceled: true };
      }

      if (typeof content === 'string') {
        try {
          await invoke('save_file_content', { content, path: filePath });
        } catch {
          // Fallback to save_project or plugin-fs
          try {
            await invoke('save_project', { json: content, path: filePath });
          } catch {
            const { writeTextFile } = await import('@tauri-apps/plugin-fs');
            await writeTextFile(filePath, content);
          }
        }
      } else {
        // Binary content (PNG / Images)
        try {
          await invoke('save_file_bytes', { bytes: Array.from(content), path: filePath });
        } catch {
          const { writeFile } = await import('@tauri-apps/plugin-fs');
          await writeFile(filePath, content);
        }
      }

      return { success: true, path: filePath };
    } catch (err: any) {
      console.warn('Tauri save failed, falling back to browser download:', err);
    }
  }

  // 2. Web Mode (Browser fallback)
  try {
    const blob =
      typeof content === 'string'
        ? new Blob([content], { type: `${mimeType};charset=utf-8` })
        : new Blob([content as BlobPart], { type: mimeType });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    return { success: true, path: filename };
  } catch (err: any) {
    console.error('Browser download failed:', err);
    return { success: false, error: err.message || String(err) };
  }
}

/**
 * Escapes XML/SVG special characters
 */
function escapeXml(unsafe: string): string {
  return (unsafe || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Returns crisp Lucide SVG element matching application icons
 */
function getLucideIconSvg(iconName: string, color: string, x: number, y: number, size = 16): string {
  const inner = LUCIDE_ICON_PATHS[iconName] || LUCIDE_ICON_PATHS['Cpu'] || '';
  return `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
}

/**
 * Extract node labels, subtitles, import statements, ports, and layout dimensions
 * identical to how NodeMpyNode renders inside the application canvas.
 */
export function getNodeVisualDetails(node: any) {
  const def = LibraryRegistry.getNodeDefinition(node.data?.definitionId);
  const nodeData = node.data || {};
  const props = nodeData.properties || {};
  const icon = nodeData.icon || def?.icon || 'Cpu';
  const nodeColor = nodeData.color || def?.color || '#3B82F6';

  let displayLabel = nodeData.label || def?.label || node.id;
  let subtitle = '';
  let importLines: string[] = [];

  const defId = nodeData.definitionId;

  if (defId === 'machine:pin_init') {
    subtitle = `GPIO ${props.pin ?? 2} (${props.mode ?? 'OUT'})`;
  } else if (defId === 'core:import_module') {
    const imps = extractImportsFromNode(props);
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
  } else if (defId === 'time:sleep_ms') {
    subtitle = `${props.duration ?? 500} ms`;
  } else if (defId === 'ssd1306:init_i2c') {
    subtitle = `${props.width ?? 128}x${props.height ?? 64}`;
  } else if (defId === 'dht:init') {
    subtitle = `${props.model ?? 'DHT22'}`;
  } else if (defId === 'servo:write_angle') {
    subtitle = `${props.def_angle ?? 90}°`;
  } else if (defId === 'core:print') {
    const text = props.message || props.prefix;
    if (text) {
      subtitle = `"${text.length > 18 ? text.slice(0, 16) + '…' : text}"`;
    }
  } else if (defId === 'core:comparison') {
    const op = props.operator || '==';
    const valB = props.val_b !== undefined ? String(props.val_b) : '1';
    subtitle = `${op} ${valB}`;
  } else if (defId === 'core:variable_set') {
    const name = props.var_name || 'x';
    const val = props.default_val !== undefined ? String(props.default_val) : '0';
    subtitle = `${name} = ${val}`;
  } else if (defId === 'core:variable_get') {
    subtitle = `${props.var_name || 'x'}`;
  } else if (defId === 'core:constant') {
    const type = props.data_type || 'number';
    if (type === 'number') subtitle = `${props.num_val ?? 1}`;
    else if (type === 'string') subtitle = `"${props.str_val ?? 'Hello'}"`;
    else subtitle = `${props.bool_val ?? 'True'}`;
  } else if (defId === 'machine:pin_read') {
    subtitle = `Read GPIO (0/1)`;
  } else if (defId === 'machine:pin_is_active') {
    subtitle = `Is Active (1/HIGH)`;
  } else if (defId === 'core:math') {
    const op = props.operator || '+';
    const valB = props.val_b !== undefined ? String(props.val_b) : '';
    subtitle = `${op} ${valB}`;
  } else if (defId === 'core:logic') {
    subtitle = `${String(props.operator || 'and').toUpperCase()}`;
  } else if (defId === 'core:string_format') {
    const pre = props.prefix ?? 'Val: ';
    subtitle = `"${pre}…"`;
  } else if (defId === 'core:random') {
    subtitle = `${props.min_val ?? 0}..${props.max_val ?? 100}`;
  } else if (defId === 'core:comment') {
    const txt = props.text || '';
    subtitle = txt.length > 20 ? txt.slice(0, 18) + '…' : txt;
  } else if (defId === 'time:sleep_s') {
    subtitle = `${props.duration ?? 1} s`;
  } else if (defId === 'time:sleep_us') {
    subtitle = `${props.duration ?? 100} µs`;
  } else if (defId === 'machine:pwm_freq') {
    subtitle = `${props.freq ?? 1000} Hz`;
  } else if (defId === 'machine:tone') {
    subtitle = `${props.freq ?? 440} Hz (${props.state ?? 'ON'})`;
  } else if (defId === 'machine:adc_read') {
    subtitle = `Read U16`;
  } else if (defId === 'network:wlan_connect') {
    subtitle = `SSID: ${props.ssid ?? 'WiFi'}`;
  } else if (defId === 'network:is_connected') {
    subtitle = `isconnected()`;
  } else if (defId === 'network:ifconfig') {
    subtitle = `IP Config`;
  } else if (defId === 'i2c_lcd:put_str') {
    const txt = props.def_text ?? '';
    subtitle = `"${txt.length > 15 ? txt.slice(0, 13) + '…' : txt}"`;
  } else if (defId === 'i2c_lcd:move_to') {
    subtitle = `Col:${props.col ?? 0}, Row:${props.row ?? 0}`;
  } else if (defId === 'max7219:text') {
    const txt = props.def_text ?? '';
    subtitle = `"${txt.length > 15 ? txt.slice(0, 13) + '…' : txt}"`;
  } else if (defId === 'core:for_range') {
    subtitle = `Count: ${props.count ?? 5}`;
  } else if (defId === 'core:math_func') {
    subtitle = `${props.func ?? 'round'}()`;
  } else if (defId === 'core:type_cast') {
    subtitle = `➔ ${props.target_type ?? 'int'}`;
  } else if (defId === 'time:ticks_us') {
    subtitle = `Ticks µs`;
  } else if (defId === 'time:ticks_add') {
    subtitle = `+ ${props.delta ?? 1000} ms`;
  } else if (defId === 'machine:timer') {
    subtitle = `${props.period ?? 1000} ms (${props.mode ?? 'PERIODIC'})`;
  } else if (defId === 'machine:timer_deinit') {
    subtitle = `Stop Timer`;
  } else if (defId === 'machine:i2c_scan') {
    subtitle = `Scan I2C Bus`;
  } else if (defId === 'machine:pwm_deinit') {
    subtitle = `Stop PWM`;
  } else if (defId === 'machine:deep_sleep') {
    subtitle = `${props.duration ?? 10000} ms`;
  } else if (defId === 'network:ap_active') {
    subtitle = `AP: ${props.ssid ?? 'ESP-AccessPoint'}`;
  } else if (defId === 'network:disconnect') {
    subtitle = `Disconnect`;
  } else if (defId === 'network:http_get') {
    const url = String(props.url || '/api');
    subtitle = `GET ${url.replace(/^https?:\/\/[^/]+/, '') || url}`;
  } else if (defId === 'network:http_post') {
    const url = String(props.url || '/sensor');
    const fmt = props.payload_format === 'json' ? 'JSON' : 'RAW';
    subtitle = `POST (${fmt}) ${url.replace(/^https?:\/\/[^/]+/, '') || url}`;
  } else if (defId === 'network:dashboard_client') {
    const ip = props.server_ip || '192.168.1.100';
    const port = props.server_port || 1880;
    const path = props.path || '/api/data';
    subtitle = `${ip}:${port}${path}`;
  } else if (defId === 'network:dashboard_command') {
    subtitle = `Команда: "${props.target_cmd ?? 'CMD_ON'}"`;
  } else if (defId === 'ssd1306:line') {
    subtitle = `Line (${props.x0 ?? 0},${props.y0 ?? 0})➔(${props.x1 ?? 127},${props.y1 ?? 63})`;
  } else if (defId === 'ssd1306:pixel') {
    subtitle = `Pixel (${props.x ?? 64}, ${props.y ?? 32})`;
  } else if (defId === 'dashboard:gauge') {
    subtitle = `${props.min ?? 0}..${props.max ?? 1024} ${props.units ?? 'лк'}`;
  } else if (defId === 'dashboard:chart') {
    subtitle = `${props.points ?? 30} pts`;
  } else if (defId === 'dashboard:button') {
    subtitle = `Payload: ${props.payload ?? 'CMD_ON'}`;
  } else if (defId === 'dashboard:switch') {
    subtitle = `${props.on_payload ?? 'CMD_ON'} / ${props.off_payload ?? 'CMD_OFF'}`;
  } else if (defId === 'dashboard:slider') {
    subtitle = `${props.min ?? 0}..${props.max ?? 1023}`;
  } else if (defId === 'dashboard:http_endpoint') {
    subtitle = `${props.method ?? 'GET'} ${props.path ?? '/light'}`;
  } else if (defId === 'dashboard:http_response') {
    subtitle = `Send: ${props.default_text ?? 'OK'}`;
  }

  const inputs = def?.inputs || [];
  const outputs = def?.outputs || [];
  const isMultiPort = inputs.length > 1 || outputs.length > 1;
  const maxPorts = Math.max(inputs.length, outputs.length);

  // Exact sizing calculation matching application canvas
  let width = 190;
  let height = 38;

  if (isMultiPort) {
    width = 220;
    height = 34 + 12 + maxPorts * 22;
  } else if (defId === 'core:import_module') {
    if (importLines.length > 1) {
      width = Math.max(200, Math.min(320, 50 + Math.max(...importLines.map((l) => l.length)) * 7.5));
      height = 24 + importLines.length * 15 + 8;
    } else {
      width = 210;
      height = 38;
    }
  } else if (subtitle) {
    const maxLen = Math.max(displayLabel.length, subtitle.length);
    width = Math.max(180, Math.min(260, 48 + maxLen * 7.5));
    height = 38;
  } else {
    width = Math.max(170, Math.min(240, 48 + displayLabel.length * 8));
    height = 38;
  }

  return {
    def,
    displayLabel,
    subtitle,
    importLines,
    inputs,
    outputs,
    isMultiPort,
    maxPorts,
    nodeColor,
    icon,
    width,
    height,
  };
}

/**
 * Generates clean, crisp, standalone Vector SVG of the current flow canvas.
 * - 100% Transparent background (NO background rect, NO grid, NO watermark)
 * - Identical visual appearance to the application canvas (dark node box, Lucide icons, exact subtitles & multi-line imports, dashed flow wires, colored handles)
 */
export function generateFlowSvg(flow: FlowTab): { svg: string; width: number; height: number } {
  const nodes = flow.nodes || [];
  const edges = flow.edges || [];

  if (nodes.length === 0) {
    const width = 400;
    const height = 200;
    const emptySvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <text x="${width / 2}" y="${height / 2}" fill="#9CA3AF" font-family="Inter, -apple-system, sans-serif" font-size="14" text-anchor="middle">
    ${escapeXml(flow.name || 'Flow')} — Холст пуст
  </text>
</svg>`;
    return { svg: emptySvg, width, height };
  }

  // 1. Calculate node layout and bounding box
  const nodeLayoutMap = new Map<
    string,
    ReturnType<typeof getNodeVisualDetails> & { x: number; y: number }
  >();

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  nodes.forEach((n) => {
    const details = getNodeVisualDetails(n);
    const x = n.position.x;
    const y = n.position.y;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + details.width);
    maxY = Math.max(maxY, y + details.height);
  });

  const padding = 36;
  const svgWidth = Math.max(300, Math.ceil(maxX - minX + padding * 2));
  const svgHeight = Math.max(200, Math.ceil(maxY - minY + padding * 2));
  const offsetX = -minX + padding;
  const offsetY = -minY + padding;

  nodes.forEach((n) => {
    const details = getNodeVisualDetails(n);
    nodeLayoutMap.set(n.id, {
      x: n.position.x + offsetX,
      y: n.position.y + offsetY,
      ...details,
    });
  });

  // 2. Build SVG: NO background rectangle, 100% transparent root
  let svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}">
  <defs>
    <filter id="nodeShadow" x="-10%" y="-10%" width="130%" height="130%">
      <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#000000" flood-opacity="0.35" />
    </filter>
  </defs>
`;

  // 3. Render Wires (Edges)
  svgContent += `  <!-- Wires (Edges) -->\n  <g class="edges">\n`;

  edges.forEach((edge) => {
    const src = nodeLayoutMap.get(edge.source);
    const tgt = nodeLayoutMap.get(edge.target);
    if (!src || !tgt) return;

    // Calculate source handle coordinate
    let srcX = src.x + src.width;
    let srcY = src.y + src.height / 2;
    let outPort: any = null;

    if (src.isMultiPort) {
      let idx = src.outputs.findIndex((p: any) => p.id === edge.sourceHandle);
      if (idx === -1) idx = 0;
      srcY = src.y + 34 + 6 + idx * 22 + 11;
      outPort = src.outputs[idx];
    } else {
      outPort = src.outputs[0];
    }

    // Calculate target handle coordinate
    let tgtX = tgt.x;
    let tgtY = tgt.y + tgt.height / 2;

    if (tgt.isMultiPort) {
      let idx = tgt.inputs.findIndex((p: any) => p.id === edge.targetHandle);
      if (idx === -1) idx = 0;
      tgtY = tgt.y + 34 + 6 + idx * 22 + 11;
    }

    const portType = (outPort?.type as PortType) || 'flow';
    const isFlow = portType === 'flow';
    const wireColor = PORT_COLORS[portType] || '#38BDF8';

    const dx = Math.abs(tgtX - srcX);
    const offset = Math.max(dx * 0.45, 36);
    const pathD = `M ${srcX} ${srcY} C ${srcX + offset} ${srcY}, ${tgtX - offset} ${tgtY}, ${tgtX} ${tgtY}`;

    // Under-layer shadow for crisp separation
    svgContent += `    <path d="${pathD}" fill="none" stroke="#12161F" stroke-width="4.5" stroke-opacity="0.6" stroke-linecap="round" />\n`;
    if (isFlow) {
      svgContent += `    <path d="${pathD}" fill="none" stroke="#FFFFFF" stroke-width="2.5" stroke-dasharray="6, 4" stroke-linecap="round" />\n`;
    } else {
      svgContent += `    <path d="${pathD}" fill="none" stroke="${wireColor}" stroke-width="2.2" stroke-linecap="round" />\n`;
    }
  });

  svgContent += `  </g>\n`;

  // 4. Render Nodes
  svgContent += `\n  <!-- Nodes -->\n  <g class="nodes">\n`;

  nodes.forEach((node) => {
    const layout = nodeLayoutMap.get(node.id);
    if (!layout) return;

    const {
      x,
      y,
      width,
      height,
      displayLabel,
      subtitle,
      importLines,
      inputs,
      outputs,
      isMultiPort,
      maxPorts,
      nodeColor,
      icon,
    } = layout;

    svgContent += `    <g transform="translate(${x}, ${y})" filter="url(#nodeShadow)">\n`;

    if (isMultiPort) {
      // Multi-port Node (Header + Port Rows)
      svgContent += `      <!-- Multi-port Container -->\n`;
      svgContent += `      <rect width="${width}" height="${height}" rx="6" fill="#242832" stroke="#374151" stroke-width="1" />\n`;

      // Header Background
      svgContent += `      <path d="M 0 6 A 6 6 0 0 1 6 0 L ${width - 6} 0 A 6 6 0 0 1 ${width} 6 L ${width} 34 L 0 34 Z" fill="#1C2027" />\n`;
      svgContent += `      <line x1="0" y1="34" x2="${width}" y2="34" stroke="#374151" stroke-width="1" />\n`;

      // Header Left Icon Square
      svgContent += `      <path d="M 0 6 A 6 6 0 0 1 6 0 L 32 0 L 32 34 L 0 34 Z" fill="#181B21" />\n`;
      svgContent += `      <line x1="32" y1="0" x2="32" y2="34" stroke="#374151" stroke-width="1" />\n`;
      svgContent += `      <line x1="1.75" y1="3" x2="1.75" y2="31" stroke="${nodeColor}" stroke-width="3.5" stroke-linecap="round" />\n`;
      svgContent += `      ${getLucideIconSvg(icon, nodeColor, 8, 9, 16)}\n`;

      // Header Title & Subtitle
      if (subtitle) {
        svgContent += `      <text x="40" y="16" fill="#F3F4F6" font-family="Inter, -apple-system, BlinkMacSystemFont, sans-serif" font-size="12" font-weight="600">${escapeXml(displayLabel)}</text>\n`;
        svgContent += `      <text x="40" y="28" fill="#9CA3AF" font-family="'Fira Code', monospace" font-size="9.5">${escapeXml(subtitle)}</text>\n`;
      } else {
        svgContent += `      <text x="40" y="21" fill="#F3F4F6" font-family="Inter, -apple-system, BlinkMacSystemFont, sans-serif" font-size="12" font-weight="600">${escapeXml(displayLabel)}</text>\n`;
      }

      // Header Right Accent Dot
      svgContent += `      <circle cx="${width - 12}" cy="17" r="3.5" fill="${nodeColor}" />\n`;

      // Port Rows
      for (let idx = 0; idx < maxPorts; idx++) {
        const inp = inputs[idx];
        const out = outputs[idx];
        const rowY = 34 + 6 + idx * 22 + 11;

        if (inp) {
          const portColor = PORT_COLORS[inp.type as PortType] || '#FFFFFF';
          svgContent += `      <circle cx="0" cy="${rowY}" r="4" fill="${portColor}" stroke="#242832" stroke-width="1.5" />\n`;
          svgContent += `      <circle cx="10" cy="${rowY}" r="2.5" fill="${portColor}" />\n`;
          svgContent += `      <text x="18" y="${rowY + 3.5}" fill="#D1D5DB" font-family="Inter, -apple-system, BlinkMacSystemFont, sans-serif" font-size="10">${escapeXml(inp.label || inp.name)}</text>\n`;
        }

        if (out) {
          const portColor = PORT_COLORS[out.type as PortType] || '#FFFFFF';
          svgContent += `      <circle cx="${width}" cy="${rowY}" r="4" fill="${portColor}" stroke="#242832" stroke-width="1.5" />\n`;
          svgContent += `      <circle cx="${width - 10}" cy="${rowY}" r="2.5" fill="${portColor}" />\n`;
          svgContent += `      <text x="${width - 18}" y="${rowY + 3.5}" fill="#D1D5DB" font-family="Inter, -apple-system, BlinkMacSystemFont, sans-serif" font-size="10" text-anchor="end">${escapeXml(out.label || out.name)}</text>\n`;
        }
      }
    } else {
      // Compact Single-Port Node
      svgContent += `      <!-- Compact Node Container -->\n`;
      svgContent += `      <rect width="${width}" height="${height}" rx="6" fill="#242832" stroke="#374151" stroke-width="1" />\n`;

      // Left Column with Colored Accent Line
      svgContent += `      <path d="M 0 6 A 6 6 0 0 1 6 0 L 32 0 L 32 ${height} L 6 ${height} A 6 6 0 0 1 0 ${height - 6} Z" fill="#1C2027" />\n`;
      svgContent += `      <line x1="32" y1="0" x2="32" y2="${height}" stroke="#374151" stroke-width="1" />\n`;
      svgContent += `      <line x1="1.75" y1="3" x2="1.75" y2="${height - 3}" stroke="${nodeColor}" stroke-width="3.5" stroke-linecap="round" />\n`;

      const iconY = Math.round((height - 16) / 2);
      svgContent += `      ${getLucideIconSvg(icon, nodeColor, 8, iconY, 16)}\n`;

      // Content Area: Multi-line Imports OR Subtitle OR Centered Title
      if (importLines.length > 0) {
        svgContent += `      <text x="40" y="16" fill="#F3F4F6" font-family="Inter, -apple-system, BlinkMacSystemFont, sans-serif" font-size="12" font-weight="600">${escapeXml(displayLabel)}</text>\n`;
        importLines.forEach((line, i) => {
          const lineY = 32 + i * 15;
          svgContent += `      <text x="40" y="${lineY}" fill="#9CA3AF" font-family="'Fira Code', monospace" font-size="10">${escapeXml(line)}</text>\n`;
        });
      } else if (subtitle) {
        svgContent += `      <text x="40" y="16" fill="#F3F4F6" font-family="Inter, -apple-system, BlinkMacSystemFont, sans-serif" font-size="12" font-weight="600">${escapeXml(displayLabel)}</text>\n`;
        svgContent += `      <text x="40" y="29" fill="#9CA3AF" font-family="'Fira Code', monospace" font-size="10">${escapeXml(subtitle)}</text>\n`;
      } else {
        svgContent += `      <text x="40" y="${Math.round(height / 2 + 4)}" fill="#F3F4F6" font-family="Inter, -apple-system, BlinkMacSystemFont, sans-serif" font-size="12" font-weight="600">${escapeXml(displayLabel)}</text>\n`;
      }

      // Input Port Handle (if any)
      if (inputs.length === 1) {
        const portColor = PORT_COLORS[inputs[0].type as PortType] || '#FFFFFF';
        svgContent += `      <circle cx="0" cy="${height / 2}" r="4" fill="${portColor}" stroke="#242832" stroke-width="1.5" />\n`;
      }

      // Output Port Handle (if any)
      if (outputs.length === 1) {
        const portColor = PORT_COLORS[outputs[0].type as PortType] || '#FFFFFF';
        svgContent += `      <circle cx="${width}" cy="${height / 2}" r="4" fill="${portColor}" stroke="#242832" stroke-width="1.5" />\n`;
      }
    }

    svgContent += `    </g>\n`;
  });

  svgContent += `  </g>\n`;
  svgContent += `</svg>`;

  return { svg: svgContent, width: svgWidth, height: svgHeight };
}

/**
 * Renders an SVG string into high-resolution 2x PNG binary bytes with 100% transparent background
 */
export async function generateFlowPng(
  svgString: string,
  width: number,
  height: number
): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      const scale = 2; // 2x retina clarity
      canvas.width = width * scale;
      canvas.height = height * scale;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas 2D context unavailable'));
        return;
      }

      // 100% Transparent background (no fillRect)
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0);

      canvas.toBlob(
        async (blob) => {
          if (!blob) {
            reject(new Error('Failed to create PNG blob'));
            return;
          }
          const arrayBuffer = await blob.arrayBuffer();
          resolve(new Uint8Array(arrayBuffer));
        },
        'image/png',
        1.0
      );
    };

    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(new Error(`Failed to load SVG into image: ${err}`));
    };

    img.src = url;
  });
}

/**
 * Saves Project as .nodempy.json
 */
export async function exportProjectSchema(
  project: NodeMpyProject,
  defaultName = 'project',
  title?: string
): Promise<SaveResult> {
  const jsonStr = JSON.stringify(project, null, 2);
  const cleanName = defaultName.toLowerCase().replace(/\s+/g, '_');
  const filename = `${cleanName}.nodempy.json`;

  return saveFileCrossPlatform({
    filename,
    title: title || 'Сохранить схему проекта (.nodempy.json)',
    content: jsonStr,
    filterName: 'Node-MPY Project (*.nodempy.json)',
    extensions: ['nodempy.json', 'json'],
    mimeType: 'application/json',
  });
}

/**
 * Saves Vector Diagram as .svg
 */
export async function exportFlowAsSvg(
  flow: FlowTab,
  defaultName = 'flow',
  title?: string
): Promise<SaveResult> {
  const { svg } = generateFlowSvg(flow);
  const cleanName = (flow.name || defaultName).toLowerCase().replace(/\s+/g, '_');
  const filename = `${cleanName}.svg`;

  return saveFileCrossPlatform({
    filename,
    title: title || 'Сохранить векторную схему (.svg)',
    content: svg,
    filterName: 'Scalable Vector Graphics (*.svg)',
    extensions: ['svg'],
    mimeType: 'image/svg+xml',
  });
}

/**
 * Saves Flow Snapshot as .png
 */
export async function exportFlowAsPng(
  flow: FlowTab,
  defaultName = 'flow',
  title?: string
): Promise<SaveResult> {
  const { svg, width, height } = generateFlowSvg(flow);
  const pngBytes = await generateFlowPng(svg, width, height);
  const cleanName = (flow.name || defaultName).toLowerCase().replace(/\s+/g, '_');
  const filename = `${cleanName}.png`;

  return saveFileCrossPlatform({
    filename,
    title: title || 'Сохранить изображение схемы (.png)',
    content: pngBytes,
    filterName: 'Portable Network Graphics (*.png)',
    extensions: ['png'],
    mimeType: 'image/png',
  });
}

/**
 * Saves MicroPython source code as main.py
 */
export async function exportMainPyCode(code: string, title?: string): Promise<SaveResult> {
  return saveFileCrossPlatform({
    filename: 'main.py',
    title: title || 'Сохранить MicroPython скрипт (main.py)',
    content: code,
    filterName: 'MicroPython Script (*.py)',
    extensions: ['py'],
    mimeType: 'text/x-python',
  });
}

/**
 * Saves complete Dashboard Bundle: server.ts + dashboard.html in one operation!
 */
export async function exportDashboardBundle(options: {
  serverCode: string;
  htmlCode: string;
  title?: string;
}): Promise<SaveResult> {
  const isDesktop =
    typeof window !== 'undefined' &&
    (Boolean((window as any).__TAURI_INTERNALS__) ||
      Boolean((window as any).isTauri) ||
      Boolean((window as any).__TAURI__));

  if (isDesktop) {
    try {
      const { save } = await import('@tauri-apps/plugin-dialog');
      const { invoke } = await import('@tauri-apps/api/core');

      const serverPath = await save({
        title: options.title || 'Сохранить комплект дашборда (server.ts + dashboard.html)',
        defaultPath: 'server.ts',
        filters: [{ name: 'TypeScript Source (*.ts)', extensions: ['ts'] }],
      });

      if (!serverPath) return { success: false, canceled: true };

      // Save server.ts
      await invoke('save_file_content', { content: options.serverCode, path: serverPath });

      // Automatically save dashboard.html alongside server.ts
      const dirSeparator = serverPath.includes('\\') ? '\\' : '/';
      const lastSlash = serverPath.lastIndexOf(dirSeparator);
      const dir = lastSlash !== -1 ? serverPath.substring(0, lastSlash) : '';
      const htmlPath = dir ? `${dir}${dirSeparator}dashboard.html` : 'dashboard.html';

      await invoke('save_file_content', { content: options.htmlCode, path: htmlPath });

      return { success: true, path: serverPath };
    } catch (err: any) {
      console.warn('Desktop export bundle failed, falling back:', err);
    }
  }

  // Web Browser fallback
  await saveFileCrossPlatform({
    filename: 'server.ts',
    content: options.serverCode,
    filterName: 'TypeScript Source (*.ts)',
    extensions: ['ts'],
    mimeType: 'text/typescript',
  });

  await saveFileCrossPlatform({
    filename: 'dashboard.html',
    content: options.htmlCode,
    filterName: 'HTML Document (*.html)',
    extensions: ['html'],
    mimeType: 'text/html',
  });

  return { success: true, path: 'server.ts + dashboard.html' };
}

/**
 * Saves Dashboard TypeScript Server source code as server.ts
 */
export async function exportDashboardServer(code: string, title?: string): Promise<SaveResult> {
  return saveFileCrossPlatform({
    filename: 'server.ts',
    title: title || 'Сохранить сервер дашборда (server.ts)',
    content: code,
    filterName: 'TypeScript Source (*.ts)',
    extensions: ['ts'],
    mimeType: 'text/typescript',
  });
}

/**
 * Saves Dashboard Standalone HTML file as dashboard.html
 */
export async function exportDashboardHtml(html: string, title?: string): Promise<SaveResult> {
  return saveFileCrossPlatform({
    filename: 'dashboard.html',
    title: title || 'Сохранить веб-интерфейс дашборда (dashboard.html)',
    content: html,
    filterName: 'HTML Document (*.html)',
    extensions: ['html', 'htm'],
    mimeType: 'text/html',
  });
}

/**
 * Copies Project JSON to system clipboard
 */
export async function copyProjectToClipboard(project: NodeMpyProject): Promise<boolean> {
  try {
    const jsonStr = JSON.stringify(project, null, 2);
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(jsonStr);
      return true;
    }
    return false;
  } catch (err) {
    console.error('Clipboard copy failed:', err);
    return false;
  }
}
