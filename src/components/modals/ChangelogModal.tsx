import React, { useEffect } from 'react';
import { X, Sparkles, Cpu, Layers, Bug, CheckCircle2, ShieldCheck } from 'lucide-react';
import { useFlowStore } from '../../store/useFlowStore';

export const ChangelogModal: React.FC = () => {
  const { isChangelogModalOpen, setChangelogModalOpen, language } = useFlowStore();

  useEffect(() => {
    if (!isChangelogModalOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setChangelogModalOpen(false);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isChangelogModalOpen, setChangelogModalOpen]);

  if (!isChangelogModalOpen) return null;

  const isRu = language === 'ru';

  return (
    <div
      onClick={() => setChangelogModalOpen(false)}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[480px] bg-[#1E222B] border border-[#374151] rounded-xl shadow-2xl overflow-hidden flex flex-col text-xs"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#374151] bg-[#171A21]">
          <div className="flex items-center gap-2">
            <span className="text-base">📋</span>
            <h3 className="font-bold text-gray-100 text-sm">
              {isRu ? 'Патчлог релиза (Patchlog)' : "Release Changelog"}
            </h3>
          </div>
          <button
            onClick={() => setChangelogModalOpen(false)}
            className="p-1 text-gray-400 hover:text-white rounded-md hover:bg-[#2A313E] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Changelog Body */}
        <div className="p-4 space-y-4 overflow-y-auto max-h-[440px] scrollbar-thin scrollbar-thumb-gray-600 select-text">
          {/* Version 1.0.0 Official Release */}
          <div className="space-y-3 p-3.5 rounded-lg bg-[#161920] border border-[#2B3240]">
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-0.5 rounded text-[11px] font-mono font-bold bg-teal-500/20 text-teal-300 border border-teal-500/40">
                v1.0.0 — Official First Release
              </span>
              <span className="text-[10px] text-gray-500">18.10.2026</span>
            </div>

            <p className="text-[11px] text-gray-300 leading-relaxed">
              {isRu
                ? 'Первый официальный релиз визуальной среды Node-TEAL для микроконтроллеров MicroPython (ESP8266, ESP32) в строгой эстетике Node-RED.'
                : 'Initial official release of Node-TEAL — a visual flow programming studio for MicroPython (ESP8266, ESP32) with a calm Node-RED aesthetic.'}
            </p>

            <div className="space-y-2 text-gray-300">
              <div className="space-y-1">
                <span className="text-[11px] font-semibold text-teal-400 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-teal-400" />
                  {isRu ? '81 нода и 12 библиотек MicroPython' : '81 Nodes & 12 MicroPython Libraries'}
                </span>
                <p className="text-[11px] text-gray-400 pl-5 leading-snug">
                  {isRu
                    ? 'Полный набор нод: Core (19 нод), Hardware GPIO/I2C/SPI/PWM (19 нод), Timing (7 нод), Sensors DHT/BMP280, Displays OLED/TFT/LCD/MAX7219, Network Wi-Fi + HTTP GET/POST для IoT-лабораторных, Actuators, Addressable LEDs.'
                    : 'Comprehensive library: Core (19 nodes), Hardware GPIO/I2C/SPI/PWM (19 nodes), Timing (7 nodes), Sensors DHT/BMP280, Displays OLED/TFT/LCD/MAX7219, Network Wi-Fi + HTTP GET/POST for IoT lab reverse polling, Actuators, Lighting.'}
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-[11px] font-semibold text-blue-400 flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-blue-400" />
                  {isRu ? 'Двухрежимный симулятор: Visual Flow + MicroPython WASM VM' : 'Dual-Mode Simulator: Visual Flow + MicroPython WASM VM'}
                </span>
                <p className="text-[11px] text-gray-400 pl-5 leading-snug">
                  {isRu
                    ? 'Переключатель 1 кликом: визуальный пошаговый обход графа или реальная виртуальная машина MicroPython v1.26 в WebAssembly без зависаний, с интерактивными GPIO, симуляцией Node-RED reverse polling и виртуальным I2C ACK без сбоев железа.'
                    : 'One-click toggle: Visual step-by-step flow traversal or real MicroPython v1.26 WebAssembly VM execution, with interactive live GPIO, Node-RED reverse polling simulation, and crash-proof virtual I2C ACK.'}
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                  {isRu ? 'Переменные, логика и математика' : 'Variables, Logic & Math'}
                </span>
                <p className="text-[11px] text-gray-400 pl-5 leading-snug">
                  {isRu
                    ? 'Ноды Value/Constant (числа/строки/булево), Set Variable, Get Variable, Logic Gate (AND/OR/NOT), Math Func (abs/round/sqrt/min/max), Type Cast и Random Number.'
                    : 'Nodes for Value/Constant, Set Variable, Get Variable, Logic Gates (AND/OR/NOT), Math Functions, Type Cast, and Random numbers.'}
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-[11px] font-semibold text-purple-400 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
                  {isRu ? 'Детерминированный компилятор main.py' : 'Deterministic main.py Compiler'}
                </span>
                <p className="text-[11px] text-gray-400 pl-5 leading-snug">
                  {isRu
                    ? 'Сортировка инициализаций по графу зависимостей (Kahn), предварительное разрешение выражений, авто-отступы 4 пробела и валидный чистый код без мусора.'
                    : 'Dependency-sorted hardware inits (Kahn algorithm), recursive data expression resolution, strict 4-space indentation, and clean MicroPython output.'}
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-[11px] font-semibold text-amber-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />
                  {isRu ? 'Кроссплатформенный десктоп (Tauri v2)' : 'Cross-Platform Desktop (Tauri v2)'}
                </span>
                <p className="text-[11px] text-gray-400 pl-5 leading-snug">
                  {isRu
                    ? 'Нативный интерфейс для Windows (автономный .exe + NSIS setup), Linux (.AppImage, .deb) и macOS (.dmg).'
                    : 'Native desktop app for Windows (standalone .exe + NSIS setup), Linux (.AppImage, .deb), and macOS (.dmg).'}
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-[11px] font-semibold text-rose-400 flex items-center gap-1.5">
                  <Bug className="w-3.5 h-3.5 text-rose-400" />
                  {isRu ? 'Исправления и оптимизации' : 'Bug Fixes & Refinements'}
                </span>
                <p className="text-[11px] text-gray-400 pl-5 leading-snug">
                  {isRu
                    ? 'Исправлена печать в консоль (message vs prefix), добавлены прямые значения val_a/val_b в Comparison, совместимость портов number <-> boolean, автосохранение.'
                    : 'Fixed Print to Console property mapping, fallback values in Comparison, number <-> boolean port compatibility, and autosave.'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-[#374151] bg-[#171A21] flex justify-end">
          <button
            onClick={() => setChangelogModalOpen(false)}
            className="px-4 py-1.5 rounded-lg bg-[#2A313E] hover:bg-[#374151] text-gray-200 font-semibold text-xs transition-colors"
          >
            {isRu ? 'Закрыть' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
};
