import React, { useState } from 'react';
import { useFlowStore } from '../../store/useFlowStore';
import { isDesktopApp } from '../../services/dashboardServer';

const chip = 'px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/30 text-rose-300 text-[10px] font-mono hover:bg-rose-500/20';

export const EndpointChips: React.FC<{ current: string; onPick: (path: string) => void }> = ({ current, onPick }) => {
  const flows = useFlowStore((s) => s.flows);
  const paths = [
    ...new Set(
      flows
        .filter((f) => f.mode === 'dashboard')
        .flatMap((f) => f.nodes)
        .filter((n) => n.data.definitionId === 'dashboard:http_endpoint')
        .map((n) => String(n.data.properties?.path || '/light'))
    ),
  ];
  if (paths.length === 0) {
    return <div className="text-[10px] text-gray-500">На вкладке дашборда нет ноды «HTTP Endpoint»: адрес не с чем связать</div>;
  }
  return (
    <div className="flex flex-wrap gap-1 items-center">
      <span className="text-[10px] text-gray-500">Из дашборда:</span>
      {paths.map((path) => (
        <button key={path} onClick={() => onPick(path)} className={`${chip} ${path === current ? 'ring-1 ring-rose-400' : ''}`}>
          {path}
        </button>
      ))}
    </div>
  );
};

export const LocalIpButton: React.FC<{ onPick: (ip: string) => void }> = ({ onPick }) => {
  const [error, setError] = useState('');
  if (!isDesktopApp()) return null;
  const detect = async () => {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      onPick(await invoke<string>('local_ip'));
      setError('');
    } catch (err) {
      setError(String(err));
    }
  };
  return (
    <div className="flex flex-col gap-1">
      <button onClick={detect} className={`${chip} self-start`}>IP этого компьютера</button>
      {error && <span className="text-[10px] text-rose-400">{error}</span>}
    </div>
  );
};
