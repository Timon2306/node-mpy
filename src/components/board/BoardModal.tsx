import React, { useEffect, useRef } from 'react';
import { RefreshCw, Upload, X, Usb } from 'lucide-react';
import { closeBoardPanel, flashBoard, refreshPorts, useBoard } from '../../services/boardService';
import { isDesktopApp } from '../../services/dashboardServer';

export const BoardModal: React.FC = () => {
  const { open, ports, port, busy, log, output, error } = useBoard();
  const outputRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight;
  }, [output]);

  if (!open) return null;
  const desktop = isDesktopApp();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="bg-[#12161F] border border-[#2D3748] rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden text-gray-200">
        <div className="h-14 px-6 border-b border-[#2D3748] bg-[#181C24] flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2 text-sm font-bold text-white">
            <Usb className="w-4 h-4 text-teal-400" />
            Залить на плату по USB
          </div>
          <button onClick={closeBoardPanel} className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#242832]">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto text-xs">
          {!desktop && (
            <div className="px-3 py-2 rounded bg-amber-500/10 border border-amber-500/20 text-amber-300">
              Заливка работает только в приложении, а не в браузере.
            </div>
          )}

          <div className="flex items-center gap-2">
            <span className="text-gray-400">Порт:</span>
            <select
              value={port}
              onChange={(e) => useBoard.setState({ port: e.target.value })}
              disabled={busy || !desktop}
              className="flex-1 bg-[#0F1115] border border-[#2D3748] rounded px-2 py-1.5 text-gray-200"
            >
              {ports.length === 0 && <option value="">Платы не найдены. Подключите кабель USB</option>}
              {ports.map((p) => (
                <option key={p.name} value={p.name}>
                  {p.name} {p.description && `— ${p.description}`} {p.likely_board ? '(плата)' : ''}
                </option>
              ))}
            </select>
            <button
              onClick={refreshPorts}
              disabled={busy || !desktop}
              title="Обновить список портов"
              className="p-1.5 rounded border border-[#2D3748] text-gray-300 hover:bg-[#242832] disabled:opacity-40"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={flashBoard}
              disabled={busy || !desktop || !port}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded bg-teal-600 hover:bg-teal-500 text-white font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Upload className="w-3.5 h-3.5" />
              {busy ? 'Заливаю...' : 'Залить main.py'}
            </button>
          </div>

          <p className="text-gray-400 leading-relaxed">
            Приложение запишет main.py и нужные драйверы (экраны, датчики) и перезапустит плату. Порт должен быть свободен: закройте
            BoardyPy и Thonny.
          </p>

          {error && <div className="px-3 py-2 rounded bg-rose-500/10 border border-rose-500/20 text-rose-300">{error}</div>}

          {log.length > 0 && (
            <div className="px-3 py-2 rounded bg-[#161A22] border border-[#252B38] space-y-0.5 font-mono text-gray-300">
              {log.map((line, i) => (
                <div key={i}>{line}</div>
              ))}
            </div>
          )}

          <div>
            <div className="text-gray-400 mb-1">Вывод платы (print):</div>
            <pre
              ref={outputRef}
              className="h-56 overflow-y-auto bg-[#0B0D12] border border-[#252B38] rounded p-3 font-mono text-[11px] text-emerald-300 whitespace-pre-wrap"
            >
              {output || 'Пока пусто. Здесь появится всё, что плата печатает через print().'}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
