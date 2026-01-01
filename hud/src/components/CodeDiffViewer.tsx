import React from 'react';
import { CodeDiff } from '../types/agent';

interface Props {
  diff: CodeDiff;
  onClose: () => void;
}

export const CodeDiffViewer: React.FC<Props> = ({ diff, onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-4xl glass rounded-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-4 border-b border-white/10 flex justify-between items-center">
          <h3 className="font-mono text-sm text-slate-400">Reviewing: {diff.filename}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">✕</button>
        </div>

        <div className="flex-1 overflow-auto p-4 font-mono text-xs sm:text-sm grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <span className="text-red-400 block mb-2 px-2 py-1 bg-red-400/10 rounded w-fit">Original</span>
            <pre className="p-4 bg-red-900/10 text-red-200 rounded-lg whitespace-pre-wrap border border-red-900/20">
              {diff.previous}
            </pre>
          </div>
          <div className="space-y-2">
            <span className="text-green-400 block mb-2 px-2 py-1 bg-green-400/10 rounded w-fit">Proposed</span>
            <pre className="p-4 bg-green-900/10 text-green-200 rounded-lg whitespace-pre-wrap border border-green-900/20">
              {diff.current}
            </pre>
          </div>
        </div>

        <div className="p-4 border-t border-white/10 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors text-sm">
            Close Preview
          </button>
        </div>
      </div>
    </div>
  );
};
