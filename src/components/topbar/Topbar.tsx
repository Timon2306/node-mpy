import React, { useState, useRef } from 'react';
import {
  Download,
  FolderOpen,
  Save,
  RotateCcw,
  Undo2,
  Redo2,
  Menu,
  Package,
  Keyboard,
  Info,
  Check,
  Plus,
  X,
  FileCode,
  Cpu,
  Settings,
  ChevronDown,
  Image,
  Code2,
  Copy,
  Layout,
  Zap,
  Radio,
  Globe,
} from 'lucide-react';
import { useFlowStore } from '../../store/useFlowStore';
import { translations } from '../../i18n';
import { NodeMpyLogo } from '../brand/NodeMpyLogo';
import { FlowTab } from '../../types/project';
import {
  exportProjectSchema,
  exportFlowAsSvg,
  exportFlowAsPng,
  exportMainPyCode,
  exportDashboardBundle,
  exportDashboardServer,
  exportDashboardHtml,
  copyProjectToClipboard,
} from '../../services/exportService';
import { DashboardCodeGenerator } from '../../compiler/dashboardCodeGenerator';

export const Topbar: React.FC = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [saveMenuOpen, setSaveMenuOpen] = useState(false);
  const [addFlowMenuOpen, setAddFlowMenuOpen] = useState(false);
  const [addFlowMenuPos, setAddFlowMenuPos] = useState<{ top: number; left: number } | null>(null);
  const addBtnRef = useRef<HTMLButtonElement>(null);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editingTabName, setEditingTabName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [savedNotification, setSavedNotification] = useState<{ path: string; label?: string } | null>(null);

  const {
    nodes,
    edges,
    language,
    setLanguage,
    generatedCode,
    clearCanvas,
    loadProject,
    exportProject,
    setPaletteModalOpen,
    setShortcutsModalOpen,
    setAboutModalOpen,
    setSettingsModalOpen,
    isSimulationOpen,
    toggleSimulation,
    isSimRunning,
    setDashboardModalOpen,
    flows,
    activeFlowId,
    addFlow,
    deleteFlow,
    switchFlow,
    renameFlow,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useFlowStore();

  const t = translations[language].topbar;
  const currentFlow = flows.find((f) => f.id === activeFlowId);

  const handleStartRename = (flowId: string, currentName: string) => {
    setEditingTabId(flowId);
    setEditingTabName(currentName);
  };

  const handleFinishRename = () => {
    if (editingTabId && editingTabName.trim()) {
      renameFlow(editingTabId, editingTabName.trim());
    }
    setEditingTabId(null);
  };

  // Open saved file's folder in Windows Explorer
  const handleOpenFileFolder = async (path: string) => {
    try {
      if (typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__) {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('open_file_folder', { path });
      }
    } catch (e) {
      console.warn('Could not open folder:', e);
    }
  };

  // Export main.py file
  const handleExportMainPy = async () => {
    try {
      const result = await exportMainPyCode(
        generatedCode,
        language === 'ru' ? 'Сохранить main.py' : 'Save main.py'
      );

      if (result.success && result.path) {
        setExportSuccess(true);
        setSavedNotification({
          path: result.path,
          label: language === 'ru' ? 'Файл main.py сохранен!' : 'main.py file saved!',
        });
        setTimeout(() => {
          setExportSuccess(false);
          setSavedNotification(null);
        }, 3500);
      }
    } catch (e) {
      console.error('Error saving main.py:', e);
      alert(language === 'ru' ? 'Ошибка при сохранении файла main.py' : 'Error saving main.py');
    }
  };

  // Export Full Dashboard Bundle (server.ts + dashboard.html)
  const handleExportDashboardBundle = async () => {
    setSaveMenuOpen(false);
    try {
      const res = DashboardCodeGenerator.generateCode(nodes, edges);
      const result = await exportDashboardBundle({
        serverCode: res.serverCode,
        htmlCode: res.htmlCode,
        title: language === 'ru' ? 'Экспорт комплекта дашборда (server.ts + dashboard.html)' : 'Export Dashboard (server.ts + dashboard.html)',
      });
      if (result.success && result.path) {
        setExportSuccess(true);
        setSavedNotification({
          path: result.path,
          label: language === 'ru' ? 'Дашборд сохранён (server.ts + HTML)!' : 'Dashboard saved (server.ts + HTML)!',
        });
        setTimeout(() => {
          setExportSuccess(false);
          setSavedNotification(null);
        }, 3500);
      }
    } catch (err) {
      console.error('Error saving dashboard bundle:', err);
      alert(language === 'ru' ? 'Ошибка при экспорте дашборда' : 'Error exporting dashboard');
    }
  };

  // Export Dashboard Server as server.ts
  const handleExportDashboardServer = async () => {
    setSaveMenuOpen(false);
    try {
      const activeFlow = flows.find((f) => f.id === activeFlowId);
      const res = DashboardCodeGenerator.generateCode(nodes, edges);
      const result = await exportDashboardServer(
        res.serverCode,
        language === 'ru' ? 'Сохранить сервер дашборда (server.ts)' : 'Save Dashboard Server (server.ts)'
      );
      if (result.success && result.path) {
        setExportSuccess(true);
        setSavedNotification({
          path: result.path,
          label: language === 'ru' ? 'Сервер дашборда (server.ts) сохранён!' : 'Dashboard Server (server.ts) saved!',
        });
        setTimeout(() => {
          setExportSuccess(false);
          setSavedNotification(null);
        }, 3500);
      }
    } catch (err) {
      console.error('Error saving server.ts:', err);
      alert(language === 'ru' ? 'Ошибка при сохранении server.ts' : 'Error saving server.ts');
    }
  };

  // Export Dashboard HTML as dashboard.html
  const handleExportDashboardHtml = async () => {
    setSaveMenuOpen(false);
    try {
      const activeFlow = flows.find((f) => f.id === activeFlowId);
      const res = DashboardCodeGenerator.generateCode(nodes, edges);
      const result = await exportDashboardHtml(
        res.htmlCode,
        language === 'ru' ? 'Сохранить веб-интерфейс дашборда (dashboard.html)' : 'Save Dashboard HTML (dashboard.html)'
      );
      if (result.success && result.path) {
        setSavedNotification({
          path: result.path,
          label: language === 'ru' ? 'Веб-интерфейс дашборда (dashboard.html) сохранён!' : 'Dashboard HTML saved!',
        });
        setTimeout(() => setSavedNotification(null), 3500);
      }
    } catch (err) {
      console.error('Error saving dashboard.html:', err);
      alert(language === 'ru' ? 'Ошибка при сохранении dashboard.html' : 'Error saving dashboard.html');
    }
  };

  // Save Project as .nodempy.json
  const handleSaveSchema = async () => {
    setSaveMenuOpen(false);
    try {
      const activeFlow = flows.find((f) => f.id === activeFlowId);
      const projectName = activeFlow?.name || 'nodempy_project';
      const project = exportProject(projectName);

      const result = await exportProjectSchema(
        project,
        projectName,
        language === 'ru' ? 'Сохранить схему проекта (.nodempy.json)' : 'Save project schema (.nodempy.json)'
      );

      if (result.success && result.path) {
        setSavedNotification({
          path: result.path,
          label: language === 'ru' ? 'Схема проекта сохранена!' : 'Project schema saved!',
        });
        setTimeout(() => setSavedNotification(null), 3500);
      }
    } catch (e) {
      console.error('Error saving schema:', e);
      alert(language === 'ru' ? 'Ошибка при сохранении схемы проекта' : 'Error saving project schema');
    }
  };

  // Export Flow as SVG
  const handleSaveSvg = async () => {
    setSaveMenuOpen(false);
    try {
      const activeFlow = flows.find((f) => f.id === activeFlowId);
      const currentFlow: FlowTab = {
        id: activeFlowId,
        name: activeFlow?.name || 'flow',
        nodes,
        edges,
      };

      const result = await exportFlowAsSvg(
        currentFlow,
        currentFlow.name,
        language === 'ru' ? 'Сохранить векторную схему (.svg)' : 'Save vector diagram (.svg)'
      );

      if (result.success && result.path) {
        setSavedNotification({
          path: result.path,
          label: language === 'ru' ? 'Векторная схема (.svg) сохранена!' : 'Vector SVG diagram saved!',
        });
        setTimeout(() => setSavedNotification(null), 3500);
      }
    } catch (e) {
      console.error('Error saving SVG:', e);
      alert(language === 'ru' ? 'Ошибка при сохранении SVG' : 'Error saving SVG');
    }
  };

  // Export Flow as PNG
  const handleSavePng = async () => {
    setSaveMenuOpen(false);
    try {
      const activeFlow = flows.find((f) => f.id === activeFlowId);
      const currentFlow: FlowTab = {
        id: activeFlowId,
        name: activeFlow?.name || 'flow',
        nodes,
        edges,
      };

      const result = await exportFlowAsPng(
        currentFlow,
        currentFlow.name,
        language === 'ru' ? 'Сохранить изображение схемы (.png)' : 'Save diagram snapshot (.png)'
      );

      if (result.success && result.path) {
        setSavedNotification({
          path: result.path,
          label: language === 'ru' ? 'Изображение схемы (.png) сохранено!' : 'Diagram snapshot (.png) saved!',
        });
        setTimeout(() => setSavedNotification(null), 3500);
      }
    } catch (err) {
      console.error('PNG export failed:', err);
      alert(language === 'ru' ? 'Ошибка при экспорте PNG' : 'Error exporting PNG');
    }
  };

  // Copy Schema JSON to clipboard
  const handleCopyClipboard = async () => {
    setSaveMenuOpen(false);
    try {
      const activeFlow = flows.find((f) => f.id === activeFlowId);
      const projectName = activeFlow?.name || 'nodempy_project';
      const project = exportProject(projectName);

      const ok = await copyProjectToClipboard(project);
      if (ok) {
        setSavedNotification({
          path: language === 'ru' ? 'Схема готова для вставки (Ctrl+V)' : 'Schema ready to paste (Ctrl+V)',
          label: t.schemaCopied,
        });
        setTimeout(() => setSavedNotification(null), 3000);
      }
    } catch (e) {
      console.error('Clipboard copy failed:', e);
    }
  };

  // Open Project (.nodempy.json or .nodeteal.json)
  const handleOpenProjectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);
        if (parsed.nodes || parsed.flows) {
          loadProject(parsed);
        } else {
          alert(language === 'ru' ? 'Файл не содержит корректной структуры схемы Node-MPY' : 'File does not contain valid Node-MPY schema');
        }
      } catch (err: any) {
        alert((language === 'ru' ? 'Ошибка чтения файла проекта: ' : 'Error reading project file: ') + (err.message || err));
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleClear = () => {
    if (window.confirm(t.clearConfirm)) {
      clearCanvas();
    }
  };

  return (
    <header className="h-[48px] bg-slate-topbar border-b border-slate-border px-3 sm:px-4 flex items-center justify-between z-20 flex-shrink-0 gap-2">
      {/* Hidden file input for opening projects */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.nodempy.json,.nodeteal.json"
        className="hidden"
        onChange={handleOpenProjectFile}
      />

      {/* Left section: Distinct Brand Logo & Node-RED style Flow Tabs */}
      <div className="flex items-center gap-3 overflow-hidden flex-1 max-w-[65%]">
        {/* Brand Logo & Name */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <NodeMpyLogo size={24} className="flex-shrink-0" />
          <span className="text-sm font-bold tracking-tight text-white hidden sm:flex items-center select-none">
            Node<span className="text-teal-brand">-MPY</span>
          </span>
        </div>

        <div className="h-4 w-[1px] bg-slate-border flex-shrink-0 mx-0.5" />

        {/* Node-RED Style Flow Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none py-1 flex-1">
          {flows.map((flow) => {
            const isActive = flow.id === activeFlowId;
            const isEditing = editingTabId === flow.id;

            return (
              <div
                key={flow.id}
                onClick={() => switchFlow(flow.id)}
                onDoubleClick={() => handleStartRename(flow.id, flow.name)}
                title={language === 'ru' ? 'Двойной клик для переименования' : 'Double click to rename'}
                className={`group relative flex items-center gap-1.5 px-3 py-1 text-xs rounded-md transition-all cursor-pointer select-none border flex-shrink-0 ${
                  isActive
                    ? 'bg-[#1C2534] text-white border-teal-500/50 shadow-sm font-semibold'
                    : 'bg-slate-panel/70 text-gray-400 hover:text-gray-200 hover:bg-slate-hover border-transparent'
                }`}
              >
                {/* Active indicator dot */}
                {isActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse flex-shrink-0" />
                )}

                {/* Mode Icon */}
                {flow.mode === 'dashboard' ? (
                  <Layout className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
                ) : (
                  <Cpu className="w-3.5 h-3.5 text-teal-400 flex-shrink-0" />
                )}

                {isEditing ? (
                  <input
                    autoFocus
                    type="text"
                    value={editingTabName}
                    onChange={(e) => setEditingTabName(e.target.value)}
                    onBlur={handleFinishRename}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleFinishRename();
                      if (e.key === 'Escape') setEditingTabId(null);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="bg-[#12161F] text-xs text-white px-1.5 py-0.5 rounded border border-teal-400 outline-none w-24"
                  />
                ) : (
                  <span className="truncate max-w-[110px]">{flow.name}</span>
                )}

                {/* Close Tab Button */}
                {flows.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteFlow(flow.id);
                    }}
                    title={language === 'ru' ? 'Удалить вкладку' : 'Close flow'}
                    className={`p-0.5 rounded text-gray-400 hover:text-red-400 hover:bg-slate-hover transition-opacity ${
                      isActive ? 'opacity-80 group-hover:opacity-100' : 'opacity-0 group-hover:opacity-100'
                    }`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })}

          {/* Add New Flow Tab Button (+) with Dropdown Menu */}
          <div className="relative flex-shrink-0">
            <button
              ref={addBtnRef}
              onClick={(e) => {
                e.stopPropagation();
                if (addFlowMenuOpen) {
                  setAddFlowMenuOpen(false);
                } else {
                  const rect = addBtnRef.current?.getBoundingClientRect();
                  if (rect) {
                    setAddFlowMenuPos({
                      top: rect.bottom + 6,
                      left: Math.max(10, Math.min(rect.left, window.innerWidth - 270)),
                    });
                  }
                  setAddFlowMenuOpen(true);
                }
              }}
              title={language === 'ru' ? 'Добавить новый Flow (+)' : 'Add new flow (+)'}
              className="flex items-center justify-center w-6 h-6 rounded-md text-gray-400 hover:text-teal-300 hover:bg-slate-hover border border-dashed border-slate-border hover:border-teal-500/50 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Center & Right sections */}
      <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
        {/* Undo / Redo Toolbar buttons */}
        <div className="flex items-center gap-0.5 bg-slate-panel border border-slate-border rounded-md p-0.5">
          <button
            onClick={undo}
            disabled={!canUndo}
            title={language === 'ru' ? 'Отменить (Ctrl+Z)' : 'Undo (Ctrl+Z)'}
            className={`p-1.5 rounded transition-colors ${
              canUndo
                ? 'text-gray-300 hover:text-white hover:bg-slate-hover'
                : 'text-gray-600 cursor-not-allowed'
            }`}
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={redo}
            disabled={!canRedo}
            title={language === 'ru' ? 'Повторить (Ctrl+Y)' : 'Redo (Ctrl+Y)'}
            className={`p-1.5 rounded transition-colors ${
              canRedo
                ? 'text-gray-300 hover:text-white hover:bg-slate-hover'
                : 'text-gray-600 cursor-not-allowed'
            }`}
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Project Open / Save / Clear */}
        <button
          onClick={() => fileInputRef.current?.click()}
          title={t.openTooltip}
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-gray-300 hover:text-white hover:bg-slate-hover rounded-md border border-slate-border transition-colors"
        >
          <FolderOpen className="w-3.5 h-3.5" />
          <span className="hidden md:inline">{t.openButton}</span>
        </button>

        {/* Launch Dashboard Button (Visible when on Dashboard flow) */}
        {currentFlow?.mode === 'dashboard' && (
          <button
            onClick={() => setDashboardModalOpen(true)}
            title={language === 'ru' ? 'Запустить интерактивную панель дашборда' : 'Launch interactive dashboard'}
            className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 active:bg-rose-700 rounded-md transition-all shadow-md shadow-rose-950/40"
          >
            <Zap className="w-3.5 h-3.5 text-rose-200 animate-pulse" />
            <span className="hidden sm:inline">{language === 'ru' ? 'Запустить дашборд' : 'Launch Dashboard'}</span>
          </button>
        )}

        {/* Project Save Dropdown Menu */}
        <div className="relative">
          <button
            onClick={() => setSaveMenuOpen(!saveMenuOpen)}
            title={t.saveTooltip}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md border transition-colors ${
              saveMenuOpen
                ? 'bg-slate-hover text-white border-teal-500/50'
                : 'text-gray-300 hover:text-white hover:bg-slate-hover border-slate-border'
            }`}
          >
            <Save className="w-3.5 h-3.5 text-teal-400" />
            <span className="hidden md:inline">{t.saveButton}</span>
            <ChevronDown className={`w-3 h-3 text-gray-400 transition-transform duration-150 ${saveMenuOpen ? 'rotate-180' : ''}`} />
          </button>

          {saveMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-30"
                onClick={() => setSaveMenuOpen(false)}
              />
              <div className="absolute right-0 top-full mt-1.5 w-72 bg-slate-panel border border-slate-border rounded-lg shadow-2xl py-1.5 z-40 text-xs animate-in fade-in zoom-in-95 duration-150">
                <div className="px-3 py-1.5 text-[10px] uppercase font-bold tracking-wider text-gray-400 border-b border-slate-border/60">
                  {language === 'ru' ? 'Формат экспорта и сохранения' : 'Export & Save Formats'}
                </div>

                {/* Dashboard-specific Export options */}
                {currentFlow?.mode === 'dashboard' ? (
                  <>
                    <button
                      onClick={handleExportDashboardBundle}
                      className="w-full px-3 py-2 text-left text-gray-200 hover:bg-slate-hover flex items-start gap-2.5 transition-colors group"
                    >
                      <div className="p-1 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 group-hover:border-rose-500/50 mt-0.5">
                        <Zap className="w-4 h-4 text-rose-400" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-100 flex items-center gap-1.5">
                          {language === 'ru' ? 'Комплект дашборда (server.ts + HTML)' : 'Full Dashboard (server.ts + HTML)'}
                          <span className="text-[10px] px-1 py-0.2 rounded bg-rose-500/20 text-rose-300 font-mono">ALL</span>
                        </p>
                        <p className="text-[11px] text-gray-400 leading-tight mt-0.5">
                          {language === 'ru'
                            ? 'Сервер TypeScript и веб-интерфейс в одну папку (готов к запуску)'
                            : 'Save both server.ts and dashboard.html ready to run'}
                        </p>
                      </div>
                    </button>

                    <button
                      onClick={handleExportDashboardServer}
                      className="w-full px-3 py-2 text-left text-gray-200 hover:bg-slate-hover flex items-start gap-2.5 transition-colors group opacity-80 hover:opacity-100"
                    >
                      <div className="p-1 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 group-hover:border-rose-500/50 mt-0.5">
                        <Code2 className="w-4 h-4 text-rose-400" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-100 flex items-center gap-1.5">
                          {language === 'ru' ? 'Только сервер (server.ts)' : 'Server Only (server.ts)'}
                          <span className="text-[10px] px-1 py-0.2 rounded bg-rose-500/20 text-rose-300 font-mono">TS</span>
                        </p>
                        <p className="text-[11px] text-gray-400 leading-tight mt-0.5">
                          {language === 'ru'
                            ? 'Чистый серверный код TypeScript (~80 строк)'
                            : 'Clean TypeScript server code (~80 lines)'}
                        </p>
                      </div>
                    </button>

                    <button
                      onClick={handleExportDashboardHtml}
                      className="w-full px-3 py-2 text-left text-gray-200 hover:bg-slate-hover flex items-start gap-2.5 transition-colors group opacity-80 hover:opacity-100"
                    >
                      <div className="p-1 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 group-hover:border-amber-500/50 mt-0.5">
                        <Globe className="w-4 h-4 text-amber-400" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-100 flex items-center gap-1.5">
                          {language === 'ru' ? 'Только HTML (dashboard.html)' : 'HTML Only (dashboard.html)'}
                          <span className="text-[10px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 font-mono">HTML</span>
                        </p>
                        <p className="text-[11px] text-gray-400 leading-tight mt-0.5">
                          {language === 'ru'
                            ? 'Отдельная статическая веб-страница без сервера'
                            : 'Standalone static web page without server'}
                        </p>
                      </div>
                    </button>
                  </>
                ) : null}

                {/* 1. Project Schema (.nodempy.json) */}
                <button
                  onClick={handleSaveSchema}
                  className="w-full px-3 py-2 text-left text-gray-200 hover:bg-slate-hover flex items-start gap-2.5 transition-colors group"
                >
                  <div className="p-1 rounded bg-teal-500/10 text-teal-400 border border-teal-500/20 group-hover:border-teal-500/50 mt-0.5">
                    <FileCode className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-100 flex items-center gap-1.5">
                      {t.saveSchema}
                      <span className="text-[10px] px-1 py-0.2 rounded bg-teal-500/20 text-teal-300 font-mono">JSON</span>
                    </p>
                    <p className="text-[11px] text-gray-400 leading-tight mt-0.5">{t.saveSchemaDesc}</p>
                  </div>
                </button>

                {/* 2. Vector Diagram (.svg) */}
                <button
                  onClick={handleSaveSvg}
                  className="w-full px-3 py-2 text-left text-gray-200 hover:bg-slate-hover flex items-start gap-2.5 transition-colors group"
                >
                  <div className="p-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 group-hover:border-emerald-500/50 mt-0.5">
                    <FileCode className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-100 flex items-center gap-1.5">
                      {t.saveSvg}
                      <span className="text-[10px] px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-mono">SVG</span>
                    </p>
                    <p className="text-[11px] text-gray-400 leading-tight mt-0.5">{t.saveSvgDesc}</p>
                  </div>
                </button>

                {/* 3. Image Snapshot (.png) */}
                <button
                  onClick={handleSavePng}
                  className="w-full px-3 py-2 text-left text-gray-200 hover:bg-slate-hover flex items-start gap-2.5 transition-colors group"
                >
                  <div className="p-1 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 group-hover:border-blue-500/50 mt-0.5">
                    <Image className="w-4 h-4 text-blue-400" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-100 flex items-center gap-1.5">
                      {t.savePng}
                      <span className="text-[10px] px-1 py-0.2 rounded bg-blue-500/20 text-blue-300 font-mono">PNG</span>
                    </p>
                    <p className="text-[11px] text-gray-400 leading-tight mt-0.5">{t.savePngDesc}</p>
                  </div>
                </button>

                {/* 4. MicroPython Script (.py) - For MicroPython flows */}
                {currentFlow?.mode !== 'dashboard' && (
                  <button
                    onClick={() => {
                      setSaveMenuOpen(false);
                      handleExportMainPy();
                    }}
                    className="w-full px-3 py-2 text-left text-gray-200 hover:bg-slate-hover flex items-start gap-2.5 transition-colors group"
                  >
                    <div className="p-1 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 group-hover:border-amber-500/50 mt-0.5">
                      <Code2 className="w-4 h-4 text-amber-400" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-100 flex items-center gap-1.5">
                        {t.savePy}
                        <span className="text-[10px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 font-mono">PY</span>
                      </p>
                      <p className="text-[11px] text-gray-400 leading-tight mt-0.5">{t.savePyDesc}</p>
                    </div>
                  </button>
                )}

                <div className="h-[1px] bg-slate-border my-1" />

                {/* 5. Copy JSON to Clipboard */}
                <button
                  onClick={handleCopyClipboard}
                  className="w-full px-3 py-2 text-left text-gray-200 hover:bg-slate-hover flex items-start gap-2.5 transition-colors group"
                >
                  <div className="p-1 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20 group-hover:border-purple-500/50 mt-0.5">
                    <Copy className="w-4 h-4 text-purple-400" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-100">{t.copyJson}</p>
                    <p className="text-[11px] text-gray-400 leading-tight mt-0.5">{t.copyJsonDesc}</p>
                  </div>
                </button>
              </div>
            </>
          )}
        </div>

        <button
          onClick={handleClear}
          title={t.clearTooltip}
          className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-slate-hover rounded-md border border-slate-border transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>

        {/* Main Export Button (Mode-aware: main.py for MicroPython, Dashboard bundle for Dashboard) */}
        <button
          onClick={currentFlow?.mode === 'dashboard' ? handleExportDashboardBundle : handleExportMainPy}
          title={
            currentFlow?.mode === 'dashboard'
              ? language === 'ru'
                ? 'Экспортировать дашборд (server.ts + dashboard.html)'
                : 'Export Dashboard (server.ts + dashboard.html)'
              : t.exportTooltip
          }
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md font-semibold text-xs shadow-sm active:scale-95 transition-all ${
            currentFlow?.mode === 'dashboard'
              ? 'bg-rose-600 hover:bg-rose-500 text-white'
              : 'bg-teal-brand hover:bg-teal-hover text-slate-900'
          }`}
        >
          {exportSuccess ? (
            <>
              <Check className="w-3.5 h-3.5 stroke-[3]" />
              <span>
                {currentFlow?.mode === 'dashboard'
                  ? language === 'ru'
                    ? 'Дашборд сохранён!'
                    : 'Dashboard saved!'
                  : t.exportSuccess}
              </span>
            </>
          ) : (
            <>
              <Download className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>
                {currentFlow?.mode === 'dashboard'
                  ? language === 'ru'
                    ? 'Экспорт дашборда'
                    : 'Export Dashboard'
                  : t.exportButton}
              </span>
            </>
          )}
        </button>

        {/* Burger Dropdown Menu (Node-RED style) */}
        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-1.5 text-gray-300 hover:text-white hover:bg-slate-hover rounded-md transition-colors relative"
          >
            <Menu className="w-4 h-4" />
            {isSimRunning && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
            )}
          </button>

          {menuOpen && (
            <>
              <div
                className="fixed inset-0 z-30"
                onClick={() => setMenuOpen(false)}
              />
              <div className="absolute right-0 top-full mt-1.5 w-60 bg-slate-panel border border-slate-border rounded-lg shadow-xl py-1.5 z-40 text-xs">
                {/* Simulation Toggle */}
                <button
                  onClick={() => {
                    toggleSimulation();
                    setMenuOpen(false);
                  }}
                  className="w-full px-3 py-2 text-left text-gray-200 hover:bg-slate-hover flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-emerald-400" />
                    <div>
                      <p className="font-semibold">{language === 'ru' ? 'Симуляция' : 'Simulation'}</p>
                      <p className="text-[10px] text-gray-400">
                        {isSimulationOpen
                          ? (language === 'ru' ? 'Скрыть консоль' : 'Hide console')
                          : (language === 'ru' ? 'Запуск и проверка схемы' : 'Run flow & check')}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isSimRunning ? 'bg-teal-400 animate-pulse' : isSimulationOpen ? 'bg-emerald-500' : 'bg-gray-600'
                    }`}
                  />
                </button>

                <div className="h-[1px] bg-slate-border my-1" />

                {/* Settings & Updates */}
                <button
                  onClick={() => {
                    setSettingsModalOpen(true);
                    setMenuOpen(false);
                  }}
                  className="w-full px-3 py-2 text-left text-gray-200 hover:bg-slate-hover flex items-center gap-2"
                >
                  <Settings className="w-4 h-4 text-teal-400" />
                  <div>
                    <p className="font-semibold">{language === 'ru' ? 'Настройки' : 'Settings'}</p>
                    <p className="text-[10px] text-gray-400">
                      {language === 'ru' ? 'Обновления, язык, параметры' : 'Updates, language, preferences'}
                    </p>
                  </div>
                </button>

                <div className="h-[1px] bg-slate-border my-1" />

                {/* Palette Manager */}
                <button
                  onClick={() => {
                    setPaletteModalOpen(true);
                    setMenuOpen(false);
                  }}
                  className="w-full px-3 py-2 text-left text-gray-200 hover:bg-slate-hover flex items-center gap-2"
                >
                  <Package className="w-4 h-4 text-teal-400" />
                  <div>
                    <p className="font-semibold">{t.managePalette}</p>
                    <p className="text-[10px] text-gray-400">{t.managePaletteDesc}</p>
                  </div>
                </button>

                <div className="h-[1px] bg-slate-border my-1" />

                {/* Shortcuts */}
                <button
                  onClick={() => {
                    setShortcutsModalOpen(true);
                    setMenuOpen(false);
                  }}
                  className="w-full px-3 py-2 text-left text-gray-200 hover:bg-slate-hover flex items-center gap-2"
                >
                  <Keyboard className="w-4 h-4 text-gray-400" />
                  <span>{t.shortcuts}</span>
                </button>

                {/* About Modal */}
                <button
                  onClick={() => {
                    setAboutModalOpen(true);
                    setMenuOpen(false);
                  }}
                  className="w-full px-3 py-2 text-left text-gray-200 hover:bg-slate-hover flex items-center gap-2"
                >
                  <Info className="w-4 h-4 text-teal-400" />
                  <span>{language === 'ru' ? 'О программе' : 'About Node-MPY'}</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* File Saved Notification Toast */}
      {savedNotification && (
        <div className="fixed top-14 right-4 z-50 flex items-center gap-3 px-4 py-2.5 bg-[#1C202A] border border-teal-500/60 text-white text-xs rounded-lg shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-200">
          <Check className="w-4 h-4 text-teal-400 flex-shrink-0" />
          <div className="flex flex-col">
            <span className="font-semibold text-teal-300">
              {savedNotification.label || (language === 'ru' ? 'Файл сохранен!' : 'File saved!')}
            </span>
            <span className="text-[11px] text-gray-300 font-mono truncate max-w-[280px]">
              {savedNotification.path}
            </span>
          </div>
          {savedNotification.path && (savedNotification.path.includes('/') || savedNotification.path.includes('\\')) && (
            <button
              onClick={() => handleOpenFileFolder(savedNotification.path)}
              className="px-2 py-1 rounded bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 border border-teal-500/40 text-[11px] font-medium transition-colors ml-1"
            >
              {language === 'ru' ? 'В папке' : 'In folder'}
            </button>
          )}
          <button
            onClick={() => setSavedNotification(null)}
            className="text-gray-400 hover:text-white p-0.5 rounded transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Add New Flow Mode Picker Dropdown (Rendered fixed to avoid overflow clipping) */}
      {addFlowMenuOpen && addFlowMenuPos && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setAddFlowMenuOpen(false)}
          />
          <div
            style={{ top: addFlowMenuPos.top, left: addFlowMenuPos.left }}
            className="fixed w-64 bg-slate-panel border border-slate-border rounded-lg shadow-2xl py-1 z-50 text-xs animate-in fade-in zoom-in-95 duration-100"
          >
            <div className="px-3 py-1.5 text-[10px] uppercase font-bold tracking-wider text-gray-400 border-b border-slate-border/60 flex items-center justify-between">
              <span>{language === 'ru' ? 'Новая вкладка (Flow)' : 'New Flow Tab'}</span>
              <button
                onClick={() => setAddFlowMenuOpen(false)}
                className="text-gray-500 hover:text-gray-300"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
            <button
              onClick={() => {
                setAddFlowMenuOpen(false);
                addFlow(undefined, 'micropython');
              }}
              className="w-full px-3 py-2 text-left hover:bg-slate-hover flex items-center gap-2.5 text-gray-200 transition-colors group"
            >
              <div className="p-1.5 rounded bg-teal-500/10 text-teal-400 border border-teal-500/20 group-hover:border-teal-500/50 flex-shrink-0">
                <Cpu className="w-4 h-4" />
              </div>
              <div>
                <div className="font-semibold text-gray-100 flex items-center gap-1.5">
                  <span>MicroPython Flow</span>
                  <span className="text-[9px] px-1 py-0.2 rounded bg-teal-500/20 text-teal-300 font-mono">Python</span>
                </div>
                <div className="text-[10px] text-gray-400 leading-tight">
                  {language === 'ru' ? 'Прошивка платы ESP32 / ESP8266 (main.py)' : 'ESP32 / ESP8266 firmware (main.py)'}
                </div>
              </div>
            </button>
            <button
              onClick={() => {
                setAddFlowMenuOpen(false);
                addFlow(undefined, 'dashboard');
              }}
              className="w-full px-3 py-2 text-left hover:bg-slate-hover flex items-center gap-2.5 text-gray-200 transition-colors group"
            >
              <div className="p-1.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 group-hover:border-rose-500/50 flex-shrink-0">
                <Layout className="w-4 h-4 text-rose-400" />
              </div>
              <div>
                <div className="font-semibold text-gray-100 flex items-center gap-1.5">
                  <span>TypeScript Flow</span>
                  <span className="text-[9px] px-1 py-0.2 rounded bg-rose-500/20 text-rose-300 font-mono">TypeScript</span>
                </div>
                <div className="text-[10px] text-gray-400 leading-tight">
                  {language === 'ru' ? 'Дашборд и веб-сервер (server.ts / HTML)' : 'Web Dashboard UI & Server (server.ts / HTML)'}
                </div>
              </div>
            </button>
          </div>
        </>
      )}
    </header>
  );
};
