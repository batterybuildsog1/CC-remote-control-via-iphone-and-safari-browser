import React from 'react';
import { Agent } from '../types/agent';

interface Props {
  agent: Agent;
  onViewLogs: (agent: Agent) => void;
  onReviewDiff: (agent: Agent) => void;
  onAction: (id: string, action: 'approve' | 'reject' | 'stop') => void;
}

const statusStyles = {
  running: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  pending: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  completed: 'bg-green-500/10 text-green-400 border-green-500/20',
  error: 'bg-red-500/10 text-red-400 border-red-500/20',
};

export const AgentCard: React.FC<Props> = ({ agent, onViewLogs, onReviewDiff, onAction }) => {
  return (
    <div className="glass rounded-xl p-5 hover:border-white/20 transition-all duration-300">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="font-bold text-lg text-white mb-1">{agent.name}</h3>
          <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full border ${statusStyles[agent.status]}`}>
            {agent.status}
          </span>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-slate-500 uppercase tracking-widest">Last Update</p>
          <p className="text-xs text-slate-300">{agent.lastUpdate}</p>
        </div>
      </div>

      <div className="mb-6">
        <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Current Task</p>
        <p className="text-sm text-slate-200 line-clamp-2 min-h-[40px] leading-relaxed">
          {agent.currentTask}
        </p>
      </div>

      <div className="flex flex-wrap gap-2 pt-4 border-t border-white/5">
        <button
          onClick={() => onViewLogs(agent)}
          className="flex-1 px-3 py-2 text-xs font-medium bg-white/5 hover:bg-white/10 rounded-lg transition-colors border border-white/5"
        >
          View Logs
        </button>

        {agent.status === 'pending' && (
          <>
            <button
              onClick={() => onReviewDiff(agent)}
              className="flex-1 px-3 py-2 text-xs font-medium bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 rounded-lg transition-colors border border-indigo-500/20"
            >
              Review
            </button>
            <div className="w-full flex gap-2">
              <button
                onClick={() => onAction(agent.id, 'approve')}
                className="flex-1 px-3 py-2 text-xs font-medium bg-green-500 hover:bg-green-600 text-black rounded-lg transition-colors"
              >
                Approve
              </button>
              <button
                onClick={() => onAction(agent.id, 'reject')}
                className="flex-1 px-3 py-2 text-xs font-medium bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors"
              >
                Reject
              </button>
            </div>
          </>
        )}

        {agent.status === 'running' && (
          <button
            onClick={() => onAction(agent.id, 'stop')}
            className="px-3 py-2 text-xs font-medium bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors"
          >
            Stop
          </button>
        )}
      </div>
    </div>
  );
};
