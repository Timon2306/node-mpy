import React, { useEffect } from 'react';
import { X, Keyboard } from 'lucide-react';
import { useFlowStore } from '../../store/useFlowStore';
import { translations } from '../../i18n';

export const ShortcutsModal: React.FC = () => {
  const { isShortcutsModalOpen, setShortcutsModalOpen, language } = useFlowStore();

  useEffect(() => {
    if (!isShortcutsModalOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShortcutsModalOpen(false);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isShortcutsModalOpen, setShortcutsModalOpen]);

  if (!isShortcutsModalOpen) return null;

  const t = translations[language];

  return (
    <div
      onClick={() => setShortcutsModalOpen(false)}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-slate-panel border border-slate-border rounded-lg shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-border bg-slate-panelHeader">
          <div className="flex items-center gap-2">
            <Keyboard className="w-4 h-4 text-blue-400" />
            <h2 className="text-sm font-bold text-gray-200">
              {t.modals.shortcutsTitle}
            </h2>
          </div>
          <button
            onClick={() => setShortcutsModalOpen(false)}
            className="p-1 text-gray-400 hover:text-white rounded hover:bg-slate-hover transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-2.5 max-h-[70vh] overflow-y-auto">
          {t.shortcuts.map((sc) => (
            <div
              key={sc.key}
              className="flex items-center justify-between p-2 rounded bg-slate-canvas border border-slate-border/50 text-xs"
            >
              <span className="text-gray-300">{sc.desc}</span>
              <kbd className="px-2 py-0.5 rounded bg-slate-card border border-slate-border font-mono text-blue-400 text-[11px] font-semibold">
                {sc.key}
              </kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
