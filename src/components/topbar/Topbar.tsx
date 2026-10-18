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
} from 'lucide-react';
import { useFlowStore } from '../../store/useFlowStore';
import { translations } from '../../i18n';
import { NodeMpyLogo } from '../brand/NodeMpyLogo';

export const Topbar: React.FC = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editingTabName, setEditingTabName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [savedNotification, setSavedNotification] = useState<{ path: string } | null>(null);

  const {
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
      if (typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__) {
        try {
          const { save } = await import('@tauri-apps/plugin-dialog');
          const { invoke } = await import('@tauri-apps/api/core');

          const filePath = await save({
            title: language === 'ru' ? 'Сохранить main.py' : 'Save main.py',
            defaultPath: 'main.py',
            filters: [{ name: 'MicroPython Source (*.py)', extensions: ['py'] }],
          });

          // User clicked Cancel in file dialog -> Abort without fake success
          if (!filePath) {
            return;
          }

          try {
            await invoke('save_main_py', { code: generatedCode, path: filePath });
          } catch {
            const { writeTextFile } = await import('@tauri-apps/plugin-fs');
            await writeTextFile(filePath, generatedCode);
          }

          setExportSuccess(true);
          setSavedNotification({ path: filePath });
          setTimeout(() => setExportSuccess(false), 2500);
          return;
        } catch (tauriError) {
          console.warn('Tauri save failed, falling back to browser download', tauriError);
        }
      }

      // Web fallback (only when running in regular browser)
      const blob = new Blob([generatedCode], { type: 'text/x-python;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'main.py';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 2000);
    } catch (e) {
      console.error('Error saving main.py:', e);
      alert(language === 'ru' ? 'Ошибка при сохранении файла main.py' : 'Error saving main.py');
    }
  };

  // Save Project as .nodempy.json
  const handleSaveProject = () => {
    const activeFlow = flows.find((f) => f.id === activeFlowId);
    const projectName = activeFlow?.name || 'nodempy_project';
    const project = exportProject(projectName);
    const jsonStr = JSON.stringify(project, null, 2);

    const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${projectName.toLowerCase().replace(/\s+/g, '_')}.nodempy.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
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

          {/* Add New Flow Tab Button (+) */}
          <button
            onClick={() => addFlow()}
            title={language === 'ru' ? 'Добавить новый Flow (+)' : 'Add new flow (+)'}
            className="flex items-center justify-center w-6 h-6 rounded-md text-gray-400 hover:text-teal-300 hover:bg-slate-hover border border-dashed border-slate-border hover:border-teal-500/50 transition-colors flex-shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
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

        <button
          onClick={handleSaveProject}
          title={t.saveTooltip}
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-gray-300 hover:text-white hover:bg-slate-hover rounded-md border border-slate-border transition-colors"
        >
          <Save className="w-3.5 h-3.5" />
          <span className="hidden md:inline">{t.saveButton}</span>
        </button>

        <button
          onClick={handleClear}
          title={t.clearTooltip}
          className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-slate-hover rounded-md border border-slate-border transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>

        {/* Main Export Button (Electric Teal / Emerald) */}
        <button
          onClick={handleExportMainPy}
          title={t.exportTooltip}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md font-semibold text-xs bg-teal-brand hover:bg-teal-hover text-slate-900 shadow-sm active:scale-95 transition-all"
        >
          {exportSuccess ? (
            <>
              <Check className="w-3.5 h-3.5 stroke-[3]" />
              <span>{t.exportSuccess}</span>
            </>
          ) : (
            <>
              <Download className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>{t.exportButton}</span>
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
              {language === 'ru' ? 'Файл main.py сохранен!' : 'main.py file saved!'}
            </span>
            <span className="text-[11px] text-gray-300 font-mono truncate max-w-[280px]">
              {savedNotification.path}
            </span>
          </div>
          <button
            onClick={() => handleOpenFileFolder(savedNotification.path)}
            className="px-2 py-1 rounded bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 border border-teal-500/40 text-[11px] font-medium transition-colors ml-1"
          >
            {language === 'ru' ? 'В папке' : 'In folder'}
          </button>
          <button
            onClick={() => setSavedNotification(null)}
            className="text-gray-400 hover:text-white p-0.5 rounded transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </header>
  );
};
