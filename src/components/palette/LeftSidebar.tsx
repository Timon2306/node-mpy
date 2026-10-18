import React, { useState, useMemo } from 'react';
import {
  Search,
  ChevronDown,
  ChevronRight,
  Layers,
  Cpu,
  Zap,
  Tv,
  Thermometer,
  RotateCw,
  Clock,
  Wifi,
  Sun,
  Grid,
  Monitor,
  Box,
  Play,
  Repeat,
  GitFork,
  CheckSquare,
  Calculator,
  Maximize2,
  Terminal,
  Code2,
  ToggleLeft,
  ArrowUpRight,
  Eye,
  RefreshCw,
  Activity,
  Sliders,
  Type,
  Hash,
  Plus,
  Gauge,
  Compass,
  Slash,
  Sparkles,
  Palette,
  Disc,
  BarChart2,
  Radio,
  Power,
  PauseCircle,
  Watch,
  GitCommit,
  Square,
  CheckCircle,
  LucideIcon,
} from 'lucide-react';
import { useFlowStore } from '../../store/useFlowStore';
import { NodeDefinition } from '../../types/nodes';
import { translations } from '../../i18n';

const ICON_MAP: Record<string, LucideIcon> = {
  Cpu,
  Zap,
  Tv,
  Thermometer,
  RotateCw,
  Clock,
  Wifi,
  Sun,
  Grid,
  Monitor,
  Box,
  Play,
  Repeat,
  GitFork,
  CheckSquare,
  Calculator,
  Maximize2,
  Terminal,
  Code2,
  ToggleLeft,
  ArrowUpRight,
  Eye,
  RefreshCw,
  Activity,
  Sliders,
  Type,
  Hash,
  Gauge,
  Compass,
  Slash,
  Sparkles,
  Palette,
  Disc,
  BarChart2,
  Radio,
  Power,
  PauseCircle,
  Watch,
  GitCommit,
  Square,
  CheckCircle,
};

export const LeftSidebar: React.FC = () => {
  const { categories, activeLibraryIds, language, addNode, setDraggedDefinitionId } = useFlowStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});

  const t = translations[language].palette;

  const toggleCategory = (categoryId: string) => {
    setCollapsedCategories((prev) => ({
      ...prev,
      [categoryId]: !prev[categoryId],
    }));
  };

  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return categories;

    const q = searchQuery.toLowerCase();
    return categories
      .map((cat) => ({
        ...cat,
        nodes: cat.nodes.filter(
          (node) =>
            node.label.toLowerCase().includes(q) ||
            node.description.toLowerCase().includes(q) ||
            cat.name.toLowerCase().includes(q)
        ),
      }))
      .filter((cat) => cat.nodes.length > 0);
  }, [categories, searchQuery]);

  const onDragStart = (e: React.DragEvent, node: NodeDefinition) => {
    e.dataTransfer.setData('application/node-mpy-definition', node.id);
    e.dataTransfer.setData('application/node-teal-definition', node.id);
    e.dataTransfer.setData('text/plain', node.id);
    e.dataTransfer.setData('text', node.id);
    e.dataTransfer.effectAllowed = 'copyMove';
    setDraggedDefinitionId(node.id);
  };

  const onDragEnd = () => {
    setDraggedDefinitionId(null);
  };

  return (
    <aside className="w-[270px] h-full flex flex-col bg-slate-panel border-r border-slate-border select-none z-10 flex-shrink-0">
      {/* Search Bar */}
      <div className="p-3 border-b border-slate-border">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder={t.searchPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-canvas text-gray-200 text-xs rounded-md pl-8 pr-3 py-1.5 border border-slate-border focus:border-slate-subtle focus:outline-none placeholder-gray-500"
          />
        </div>
      </div>

      {/* Dynamic modules banner */}
      <div className="px-3 py-2 bg-slate-panelHeader border-b border-slate-border flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
          <Layers className="w-3.5 h-3.5 text-teal-brand" />
          <span>{t.activeModules}</span>
          <span className="font-mono text-xs text-gray-200 font-semibold">
            {activeLibraryIds.length}
          </span>
        </div>
      </div>

      {/* Categories Accordion */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {filteredCategories.map((cat) => {
          const isCollapsed = !!collapsedCategories[cat.id];
          const CategoryIcon = ICON_MAP[cat.icon] || Cpu;
          const translatedCategoryName = t.categories[cat.name] || cat.name;

          return (
            <div key={cat.id} className="rounded-md overflow-hidden border border-slate-border">
              {/* Category Header */}
              <button
                onClick={() => toggleCategory(cat.id)}
                className="w-full flex items-center justify-between px-2.5 py-1.5 bg-slate-panelHeader hover:bg-slate-hover transition-colors text-left"
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: cat.color }}
                  />
                  <span className="text-xs font-semibold text-gray-200">
                    {translatedCategoryName}
                  </span>
                  <span className="text-[10px] text-gray-500 font-mono">
                    ({cat.nodes.length})
                  </span>
                </div>
                {isCollapsed ? (
                  <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                )}
              </button>

              {/* Nodes list inside category */}
              {!isCollapsed && (
                <div className="p-1.5 bg-[#181B20] space-y-1">
                  {cat.nodes.map((node) => {
                    const NodeIcon = ICON_MAP[node.icon] || CategoryIcon;
                    const hasOutputs = node.outputs && node.outputs.length > 0;

                    return (
                      <div
                        key={node.id}
                        draggable
                        onDragStart={(e) => onDragStart(e, node)}
                        onDragEnd={onDragEnd}
                        onDoubleClick={() => addNode(node.id)}
                        className="group relative flex items-center justify-between h-[30px] rounded-[4px] bg-[#22272E] border border-[#374151] hover:border-gray-400 cursor-grab active:cursor-grabbing transition-colors overflow-hidden select-none"
                        title={node.description}
                      >
                        {/* Left icon badge */}
                        <div
                          className="w-7 h-full flex items-center justify-center bg-[#1A1D24] border-r border-[#374151] flex-shrink-0 pointer-events-none"
                          style={{
                            borderLeft: `3px solid ${node.color || '#3B82F6'}`,
                          }}
                        >
                          <NodeIcon
                            className="w-3.5 h-3.5 flex-shrink-0"
                            style={{ color: node.color || '#94A3B8' }}
                          />
                        </div>

                        {/* Node Label */}
                        <div className="flex-1 px-2 truncate pointer-events-none">
                          <span className="text-[11px] text-gray-300 group-hover:text-white font-medium truncate leading-tight">
                            {node.label}
                          </span>
                        </div>

                        {/* Plus button to add directly to canvas */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            addNode(node.id);
                          }}
                          title={language === 'ru' ? 'Добавить на холст' : 'Add to canvas'}
                          className="pointer-events-auto opacity-0 group-hover:opacity-100 p-0.5 mr-1 text-gray-400 hover:text-white rounded hover:bg-slate-hover transition-opacity flex-shrink-0"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>

                        {/* Right Socket Tab indicator (like Node-RED palette) */}
                        {hasOutputs && (
                          <div
                            className="w-1.5 h-2.5 rounded-l-[2px] bg-slate-500 group-hover:bg-slate-300 flex-shrink-0 transition-colors mr-0.5 pointer-events-none"
                            title={`${node.outputs.length} output(s)`}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {filteredCategories.length === 0 && (
          <div className="p-4 text-center text-xs text-gray-500">
            {t.noNodesFound}
          </div>
        )}
      </div>
    </aside>
  );
};
