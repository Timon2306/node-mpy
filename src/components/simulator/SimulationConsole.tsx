import React, { useRef, useEffect } from 'react';
import {
  Play,
  Pause,
  StepForward,
  Square,
  Trash2,
  X,
  Cpu,
  Zap,
  Activity,
  ChevronDown,
} from 'lucide-react';
import { useFlowStore } from '../../store/useFlowStore';
import { esp8266Simulator } from '../../simulator/esp8266Simulator';

export const SimulationConsole: React.FC = () => {
  const {
    isSimulationOpen,
    setSimulationOpen,
    isSimRunning,
    isSimPaused,
    simSpeed,
    setSimSpeed,
    simLogs,
    clearSimLogs,
    virtualPins,
    language,
  } = useFlowStore();

  const logContainerRef = useRef<HTMLDivElement>(null);
  const isRu = language === 'ru';

  // Autoscroll to bottom when new logs arrive
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [simLogs]);

  if (!isSimulationOpen) return null;

  const handlePlayPause = () => {
    if (!isSimRunning) {
      esp8266Simulator.start();
    } else if (isSimPaused) {
      esp8266Simulator.resume();
    } else {
      esp8266Simulator.pause();
    }
  };

  const handleStep = () => {
    esp8266Simulator.step();
  };

  const handleStop = () => {
    esp8266Simulator.stop();
  };

  const ledPin = virtualPins[2];
  // On ESP8266, builtin LED is connected between VCC and GPIO 2 (active-low: value 0 = LED ON!)
  const isLedLit = ledPin?.value === 0;

  return (
    <div className="absolute bottom-0 left-0 right-0 z-30 bg-[#161920] border-t border-[#2E3646] shadow-2xl flex flex-col h-[220px] max-h-[45vh] select-none animate-in slide-in-from-bottom-4 duration-150">
      {/* Top Toolbar */}
      <div className="h-9 px-3 bg-[#1C202A] border-b border-[#2E3646] flex items-center justify-between text-xs flex-shrink-0">
        {/* Left: Board Name & Simulation Controls */}
        <div className="flex items-center gap-2">
          {/* Board Badge */}
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-blue-950/60 border border-blue-500/40 text-blue-300 font-semibold text-[11px]">
            <Cpu className="w-3.5 h-3.5 text-blue-400" />
            <span>{isRu ? 'Симуляция' : 'Simulation'}</span>
          </div>

          <div className="h-4 w-[1px] bg-[#2E3646] mx-1" />

          {/* Play / Pause Button */}
          <button
            onClick={handlePlayPause}
            className={`flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-semibold transition-all ${
              isSimRunning && !isSimPaused
                ? 'bg-amber-600 hover:bg-amber-500 text-white'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white'
            }`}
          >
            {isSimRunning && !isSimPaused ? (
              <>
                <Pause className="w-3 h-3" />
                <span>{isRu ? 'Пауза' : 'Pause'}</span>
              </>
            ) : (
              <>
                <Play className="w-3 h-3 fill-current" />
                <span>{isRu ? 'Запуск' : 'Run'}</span>
              </>
            )}
          </button>

          {/* Step Button */}
          <button
            onClick={handleStep}
            title={isRu ? 'Выполнить один шаг' : 'Execute one step'}
            className="flex items-center gap-1 px-2 py-1 rounded bg-[#242936] hover:bg-[#2F3647] text-gray-200 text-[11px] border border-[#3A4458] transition-colors"
          >
            <StepForward className="w-3 h-3 text-blue-400" />
            <span>{isRu ? 'Шаг' : 'Step'}</span>
          </button>

          {/* Stop Button */}
          <button
            onClick={handleStop}
            disabled={!isSimRunning}
            title={isRu ? 'Остановить симуляцию' : 'Stop simulation'}
            className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] transition-colors ${
              isSimRunning
                ? 'bg-red-950/50 hover:bg-red-900/60 text-red-300 border border-red-500/40'
                : 'bg-[#1C202A] text-gray-600 cursor-not-allowed border border-transparent'
            }`}
          >
            <Square className="w-3 h-3 fill-current" />
            <span>{isRu ? 'Стоп' : 'Stop'}</span>
          </button>

          {/* Speed Selector */}
          <div className="flex items-center gap-1 bg-[#12141A] rounded p-0.5 border border-[#2E3646] ml-1">
            {[0.5, 1, 2, 5].map((spd) => (
              <button
                key={spd}
                onClick={() => setSimSpeed(spd)}
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors ${
                  simSpeed === spd
                    ? 'bg-teal-500 text-slate-900 font-bold'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                {spd}x
              </button>
            ))}
          </div>
        </div>

        {/* Center: Live Virtual Pins (Interactive Buttons) */}
        <div className="hidden lg:flex items-center gap-1.5 px-2 py-0.5 bg-[#12141A] rounded border border-[#2E3646]">
          <span className="text-[10px] text-gray-400 font-mono flex items-center gap-1">
            <Zap className="w-3 h-3 text-amber-400" />
            GPIO:
          </span>

          {/* Pin 2 (Built-in LED) */}
          <button
            type="button"
            onClick={() => {
              const currentVal = ledPin?.value ?? 1;
              const nextVal: 0 | 1 = currentVal === 1 ? 0 : 1;
              useFlowStore.getState().updateVirtualPin(2, { value: nextVal });
              useFlowStore.getState().addSimLog(
                'gpio',
                isRu
                  ? `[Интерактив] GPIO 2 переключен вручную ➔ ${nextVal ? '1 (ВЫКЛ)' : '0 (💡 LED ГОРИТ!)'}`
                  : `[Interactive] GPIO 2 toggled manually ➔ ${nextVal ? '1 (OFF)' : '0 (💡 LED ON!)'}`
              );
            }}
            title={
              isRu
                ? `GPIO 2 (LED): ${ledPin?.value ?? 1}. Кликните для переключения!`
                : `GPIO 2 (LED): ${ledPin?.value ?? 1}. Click to toggle!`
            }
            className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono border transition-all cursor-pointer hover:scale-105 ${
              isLedLit
                ? 'bg-blue-500/20 border-blue-400 text-blue-300 shadow-[0_0_8px_rgba(56,189,248,0.5)]'
                : 'bg-[#1A1E27] border-gray-700 text-gray-400 hover:border-gray-500'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isLedLit ? 'bg-blue-400 shadow-[0_0_6px_#38BDF8]' : 'bg-gray-600'
              }`}
            />
            <span>D4(LED): {ledPin?.value ?? 1}</span>
          </button>

          {/* Key GPIOs */}
          {[0, 4, 5, 12, 14].map((pinNum) => {
            const p = virtualPins[pinNum];
            const isHigh = p?.value === 1;
            return (
              <button
                key={pinNum}
                type="button"
                onClick={() => {
                  const currentVal = p?.value ?? 0;
                  const nextVal: 0 | 1 = currentVal === 1 ? 0 : 1;
                  useFlowStore.getState().updateVirtualPin(pinNum, { value: nextVal });
                  useFlowStore.getState().addSimLog(
                    'gpio',
                    isRu
                      ? `[Интерактив] GPIO ${pinNum} переключен вручную ➔ ${nextVal ? 'HIGH (1 / Активен)' : 'LOW (0 / Неактивен)'}`
                      : `[Interactive] GPIO ${pinNum} toggled manually ➔ ${nextVal ? 'HIGH (1)' : 'LOW (0)'}`
                  );
                }}
                title={
                  isRu
                    ? `GPIO ${pinNum}: ${p?.value ?? 0} (${isHigh ? 'HIGH' : 'LOW'}). Кликните для переключения уровня!`
                    : `GPIO ${pinNum}: ${p?.value ?? 0}. Click to toggle!`
                }
                className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono border transition-all cursor-pointer hover:scale-105 ${
                  isHigh
                    ? 'bg-teal-500/20 border-teal-400 text-teal-300 shadow-[0_0_6px_rgba(20,184,166,0.4)]'
                    : 'bg-[#1A1E27] border-gray-700/80 text-gray-400 hover:border-gray-500'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isHigh ? 'bg-teal-400 shadow-[0_0_4px_#2DD4BF]' : 'bg-gray-600'
                  }`}
                />
                <span>G{pinNum}:{p?.value ?? 0}</span>
              </button>
            );
          })}
        </div>

        {/* Right: Clear & Close */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={clearSimLogs}
            title={isRu ? 'Очистить лог' : 'Clear console'}
            className="p-1 text-gray-400 hover:text-gray-200 hover:bg-[#242936] rounded transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setSimulationOpen(false)}
            title={isRu ? 'Свернуть консоль' : 'Close console'}
            className="p-1 text-gray-400 hover:text-white hover:bg-[#242936] rounded transition-colors"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Terminal Log Output */}
      <div
        ref={logContainerRef}
        className="flex-1 overflow-y-auto p-2.5 font-mono text-[11px] leading-relaxed space-y-1 select-text bg-[#0E1015]"
      >
        {simLogs.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-500 gap-1.5">
            <Activity className="w-5 h-5 text-gray-600 animate-pulse" />
            <span>
              {isRu
                ? 'Консоль симуляции готова. Нажмите [Запуск] для исполнения схемы.'
                : 'Simulation ready. Click [Run] to execute flow.'}
            </span>
          </div>
        ) : (
          simLogs.map((log) => {
            let badgeClass = 'bg-gray-800 text-gray-400';
            let textClass = 'text-gray-300';

            if (log.type === 'boot') {
              badgeClass = 'bg-blue-900/40 text-blue-300 border border-blue-500/30';
              textClass = 'text-blue-200 font-semibold';
            } else if (log.type === 'gpio') {
              badgeClass = 'bg-emerald-900/40 text-emerald-300 border border-emerald-500/30';
              textClass = 'text-emerald-200';
            } else if (log.type === 'time') {
              badgeClass = 'bg-amber-900/40 text-amber-300 border border-amber-500/30';
              textClass = 'text-amber-200';
            } else if (log.type === 'print') {
              badgeClass = 'bg-purple-900/40 text-purple-300 border border-purple-500/30';
              textClass = 'text-white font-medium';
            } else if (log.type === 'error') {
              badgeClass = 'bg-red-900/50 text-red-300 border border-red-500/50';
              textClass = 'text-red-300 font-semibold';
            }

            return (
              <div key={log.id} className="flex items-start gap-2 hover:bg-white/[0.02] px-1 py-0.5 rounded">
                <span className="text-gray-600 text-[10px] select-none flex-shrink-0 mt-0.5">
                  [{log.time}]
                </span>
                <span className={`px-1.5 py-0.2 rounded text-[9px] uppercase font-bold flex-shrink-0 mt-0.5 ${badgeClass}`}>
                  {log.type}
                </span>
                <span className={`flex-1 break-all ${textClass}`}>{log.text}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
