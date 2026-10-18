import React, { useEffect } from 'react';
import { X, HelpCircle, Send } from 'lucide-react';
import { useFlowStore } from '../../store/useFlowStore';
import { NodeTealLogo } from '../brand/NodeTealLogo';

export const AboutModal: React.FC = () => {
  const {
    isAboutModalOpen,
    setAboutModalOpen,
    setChangelogModalOpen,
    setShortcutsModalOpen,
    language,
  } = useFlowStore();

  useEffect(() => {
    if (!isAboutModalOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAboutModalOpen(false);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isAboutModalOpen, setAboutModalOpen]);

  if (!isAboutModalOpen) return null;

  const isRu = language === 'ru';

  return (
    <div
      onClick={() => setAboutModalOpen(false)}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[390px] bg-[#1A1D24] border border-[#2E3544] rounded-xl shadow-2xl overflow-hidden flex flex-col text-xs select-none"
      >
        {/* Title Bar (Windows window header style) */}
        <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-[#2E3544] bg-[#14171E]">
          <div className="flex items-center gap-2">
            <NodeTealLogo size={18} />
            <span className="text-[12px] font-medium text-gray-200">
              {isRu ? 'О программе Node-TEAL' : 'About Node-TEAL'}
            </span>
          </div>

          <div className="flex items-center gap-1">
            {/* Help / Shortcuts (?) */}
            <button
              onClick={() => {
                setAboutModalOpen(false);
                setShortcutsModalOpen(true);
              }}
              title={isRu ? 'Горячие клавиши' : 'Shortcuts'}
              className="p-1 text-gray-400 hover:text-white rounded hover:bg-[#252B38] transition-colors"
            >
              <HelpCircle className="w-3.5 h-3.5" />
            </button>

            {/* Close Button (X) */}
            <button
              onClick={() => setAboutModalOpen(false)}
              className="p-1 text-gray-400 hover:text-white rounded hover:bg-[#252B38] transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 text-gray-300">
          {/* Main Title & Subtitle */}
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-1.5">
              Node<span className="text-teal-400">-TEAL</span>
            </h2>
            <p className="text-[12px] text-gray-400 mt-1 leading-snug">
              {isRu
                ? 'Визуальная нодная среда для MicroPython.'
                : 'Visual flow-based environment for MicroPython.'}
            </p>
          </div>

          {/* Version */}
          <div>
            <span className="text-[12px] font-semibold text-gray-200">
              {isRu ? 'Версия: ' : 'Version: '}
            </span>
            <span className="font-mono text-teal-300 font-bold text-[12px]">1.0.1</span>
          </div>

          {/* Author & Student Group Attribution */}
          <div className="space-y-0.5 text-[12px] text-gray-300 border-l-2 border-teal-500/50 pl-3 py-0.5">
            <p className="font-semibold text-gray-100">
              {isRu ? 'Создатель: ' : 'Creator: '}
              <a
                href="https://t.me/Timon2306"
                target="_blank"
                rel="noreferrer"
                className="text-teal-400 hover:underline"
              >
                @Timon2306
              </a>
            </p>
            <p className="text-gray-400">Студент группы И24-11</p>
            <p className="text-gray-400">ГПОУ ПК г. Новокузнецка</p>
            <p className="text-gray-400">им. Кучерявенко Т.А.</p>
          </div>

          {/* Telegram Support Link */}
          <div>
            <a
              href="https://t.me/Timon2306"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-blue-400 hover:text-blue-300 transition-colors text-[12px] font-medium"
            >
              <Send className="w-3.5 h-3.5 text-blue-400" />
              <span>{isRu ? 'Поддержка — Telegram' : 'Support — Telegram'}</span>
            </a>
          </div>
        </div>

        {/* Footer Buttons */}
        <div className="px-5 py-3 border-t border-[#2E3544] bg-[#14171E] flex items-center justify-between">
          {/* Patchlog / What's New Button */}
          <button
            onClick={() => {
              setAboutModalOpen(false);
              setChangelogModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#252B38] hover:bg-[#30384A] text-gray-200 hover:text-white border border-[#3A4458] transition-colors text-xs font-medium"
          >
            <span>📋</span>
            <span>{isRu ? 'Что нового' : "What's New"}</span>
          </button>

          {/* OK Button */}
          <button
            onClick={() => setAboutModalOpen(false)}
            className="px-5 py-1.5 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs transition-colors shadow-sm"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
};
