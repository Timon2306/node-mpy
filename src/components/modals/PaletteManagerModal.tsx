import React, { useState } from 'react';
import {
  X,
  Package,
  Upload,
  Sparkles,
  Copy,
  Check,
  Trash2,
  AlertCircle,
} from 'lucide-react';
import { useFlowStore } from '../../store/useFlowStore';
import { LibraryRegistry } from '../../registry/registryLoader';
import { translations } from '../../i18n';

export const PaletteManagerModal: React.FC = () => {
  const { isPaletteModalOpen, setPaletteModalOpen, recalculate, language } = useFlowStore();
  const [activeTab, setActiveTab] = useState<'libraries' | 'import' | 'ai_prompt'>('libraries');
  const [jsonInput, setJsonInput] = useState('');
  const [importMessage, setImportMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  const t = translations[language].modals;

  if (!isPaletteModalOpen) return null;

  const allLibraries = LibraryRegistry.getAllLibraries();
  const customLibraries = LibraryRegistry.getCustomLibraries();

  const handleImportJson = () => {
    if (!jsonInput.trim()) {
      setImportMessage({ type: 'error', text: language === 'ru' ? 'Пожалуйста, вставьте JSON библиотеки' : 'Please paste library JSON' });
      return;
    }

    const res = LibraryRegistry.importCustomLibrary(jsonInput);
    if (res.success && res.library) {
      setImportMessage({
        type: 'success',
        text: language === 'ru' 
          ? `Библиотека "${res.library.name}" (${res.library.nodes.length} нод) успешно добавлена в палитру!`
          : `Library "${res.library.name}" (${res.library.nodes.length} nodes) successfully added to palette!`,
      });
      setJsonInput('');
      recalculate();
    } else {
      setImportMessage({
        type: 'error',
        text: res.error || (language === 'ru' ? 'Неизвестная ошибка импорта JSON' : 'Unknown JSON import error'),
      });
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setJsonInput(content);
    };
    reader.readAsText(file);
  };

  const handleDeleteCustom = (libId: string) => {
    if (window.confirm(t.deleteCustomConfirm)) {
      LibraryRegistry.deleteCustomLibrary(libId);
      recalculate();
    }
  };

  const handleCopyPrompt = () => {
    const promptText = LibraryRegistry.getAiPromptTemplate();
    navigator.clipboard.writeText(promptText);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl bg-slate-panel border border-slate-border rounded-lg shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-border bg-slate-panelHeader">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-blue-400" />
            <h2 className="text-sm font-bold text-gray-200">
              {t.paletteTitle}
            </h2>
          </div>
          <button
            onClick={() => setPaletteModalOpen(false)}
            className="p-1 text-gray-400 hover:text-white rounded hover:bg-slate-hover transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-border bg-slate-panel px-4">
          <button
            onClick={() => { setActiveTab('libraries'); setImportMessage(null); }}
            className={`py-2.5 px-3 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'libraries'
                ? 'border-blue-400 text-blue-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            {t.tabLibraries} ({allLibraries.length})
          </button>

          <button
            onClick={() => { setActiveTab('import'); setImportMessage(null); }}
            className={`py-2.5 px-3 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'import'
                ? 'border-blue-400 text-blue-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>{t.tabImport}</span>
          </button>

          <button
            onClick={() => { setActiveTab('ai_prompt'); setImportMessage(null); }}
            className={`py-2.5 px-3 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'ai_prompt'
                ? 'border-blue-400 text-blue-400'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>{t.tabAiPrompt}</span>
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-5 select-text">
          {/* Tab 1: Libraries list */}
          {activeTab === 'libraries' && (
            <div className="space-y-3">
              <p className="text-xs text-gray-400">
                {t.librariesDesc}
              </p>

              <div className="space-y-2 mt-3">
                {allLibraries.map((lib) => {
                  const isCustom = customLibraries.some((c) => c.id === lib.id);
                  return (
                    <div
                      key={lib.id}
                      className="p-3 bg-slate-card rounded-md border border-slate-border flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-3 h-8 rounded-sm"
                          style={{ backgroundColor: lib.color }}
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-xs font-semibold text-gray-200">
                              {lib.name}
                            </h4>
                            <span className="text-[10px] font-mono text-gray-400">
                              v{lib.version}
                            </span>
                            {lib.isNative ? (
                              <span className="px-1.5 py-0.2 bg-emerald-950/60 text-emerald-400 border border-emerald-800/40 rounded text-[9px] font-medium">
                                {t.nativeBadge}
                              </span>
                            ) : isCustom ? (
                              <span className="px-1.5 py-0.2 bg-blue-500/10 text-blue-400 border border-blue-500/30 rounded text-[9px] font-medium">
                                {t.customBadge}
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.2 bg-purple-950/60 text-purple-300 border border-purple-800/40 rounded text-[9px] font-medium">
                                {t.driverBadge}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-gray-400 mt-0.5">
                            {lib.description} • Nodes: {lib.nodes.length}
                          </p>
                        </div>
                      </div>

                      {isCustom && (
                        <button
                          onClick={() => handleDeleteCustom(lib.id)}
                          title="Delete custom library"
                          className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-slate-hover rounded transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tab 2: Import Custom JSON */}
          {activeTab === 'import' && (
            <div className="space-y-4">
              <div className="p-3 bg-slate-card border border-slate-border rounded-md text-xs text-gray-300 space-y-2">
                <p className="font-semibold text-blue-400">
                  {t.importJsonHeader}
                </p>
                <p>
                  {t.importJsonDesc}
                </p>
              </div>

              {/* File upload input */}
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  {t.uploadFileLabel}
                </label>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleFileUpload}
                  className="w-full text-xs text-gray-400 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-500 cursor-pointer"
                />
              </div>

              {/* Paste textarea */}
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  {t.pasteJsonLabel}
                </label>
                <textarea
                  value={jsonInput}
                  onChange={(e) => setJsonInput(e.target.value)}
                  rows={9}
                  placeholder='{\n  "id": "my_sensor",\n  "name": "My Sensor",\n  "version": "1.0.0",\n  "nodes": [...]\n}'
                  className="w-full bg-slate-canvas text-gray-200 font-mono text-xs p-3 rounded-md border border-slate-border focus:border-blue-400 focus:outline-none"
                />
              </div>

              {importMessage && (
                <div
                  className={`p-3 rounded-md text-xs flex items-center gap-2 ${
                    importMessage.type === 'success'
                      ? 'bg-emerald-950/50 border border-emerald-600/50 text-emerald-300'
                      : 'bg-red-950/50 border border-red-600/50 text-red-300'
                  }`}
                >
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{importMessage.text}</span>
                </div>
              )}

              <button
                onClick={handleImportJson}
                className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs rounded-md shadow transition-all active:scale-[0.99]"
              >
                {t.importButton}
              </button>
            </div>
          )}

          {/* Tab 3: AI Prompt Generator */}
          {activeTab === 'ai_prompt' && (
            <div className="space-y-4">
              <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-md text-xs text-gray-200 space-y-1">
                <p className="font-semibold text-blue-400 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  {t.aiPromptHeader}
                </p>
                <p className="text-[11px] text-gray-300">
                  {t.aiPromptStep1}<br />
                  {t.aiPromptStep2}<br />
                  {t.aiPromptStep3}
                </p>
              </div>

              <div className="relative">
                <div className="flex items-center justify-between pb-1">
                  <span className="text-xs font-medium text-gray-300">
                    {language === 'ru' ? 'Готовый текст системного промпта:' : 'Ready-to-use system prompt text:'}
                  </span>
                  <button
                    onClick={handleCopyPrompt}
                    className="flex items-center gap-1.5 px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded transition-colors"
                  >
                    {copiedPrompt ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>{t.promptCopied}</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>{t.copyPromptButton}</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="max-h-[220px] overflow-y-auto bg-slate-canvas p-3 rounded-md border border-slate-border font-mono text-[11px] text-gray-400 whitespace-pre leading-relaxed">
                  {LibraryRegistry.getAiPromptTemplate()}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
