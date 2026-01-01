import React from 'react';
import { LogEntry } from '../types/agent';

interface Props {
  logs: LogEntry[];
  agentName: string;
  onClose: () => void;
}

export const LogViewer: React.FC<Props> = ({ logs, agentName, onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-2xl glass rounded-2xl overflow-hidden flex flex-col h-[70vh]">
        <div className="p-4 border-b border-white/10 flex justify-between items-center">
          <h3 className="font-semibold">{agentName} Execution Logs</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">✕</button>
        </div>
        <div className="flex-1 overflow-auto p-4 font-mono text-xs bg-black/40">
          {logs.map((log, i) => (
            <div key={i} className="mb-1 flex gap-3">
              <span className="text-slate-500 whitespace-nowrap">[{log.timestamp}]</span>
              <span className={
                log.level === 'error' ? 'text-red-400' :
                log.level === 'warn' ? 'text-yellow-400' : 'text-slate-300'
              }>
                {log.message}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
