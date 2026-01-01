"use client";

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface Agent {
  id: string;
  name: string;
  port: number;
  workdir: string;
  originalWorkdir: string;
  isWorktree: boolean;
  status: string;
  started: string;
  url: string;
}

const COMMON_WORKDIRS = [
  { label: 'Money Heaven', path: '/Users/alanknudson/Money_heaven' },
  { label: 'Agent HUD', path: '/Users/alanknudson/agent-hud' },
  { label: 'Home', path: '/Users/alanknudson' },
];

export const AgentDashboard = () => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [tailscaleIP, setTailscaleIP] = useState('localhost');
  const [isPolling, setIsPolling] = useState(true);
  const [showStartModal, setShowStartModal] = useState(false);
  const [newAgentName, setNewAgentName] = useState('');
  const [newAgentWorkdir, setNewAgentWorkdir] = useState(COMMON_WORKDIRS[0].path);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAgents = useCallback(async () => {
    try {
      const res = await fetch('/api/agents');
      if (res.ok) {
        const data = await res.json();
        setAgents(data.agents || []);
        setTailscaleIP(data.tailscaleIP || 'localhost');
      }
    } catch (error) {
      console.error('Failed to fetch agents:', error);
    }
  }, []);

  // Poll every 5 seconds
  useEffect(() => {
    fetchAgents();
    const interval = setInterval(() => {
      setIsPolling(false);
      fetchAgents().then(() => {
        setTimeout(() => setIsPolling(true), 100);
      });
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchAgents]);

  const startAgent = async () => {
    if (!newAgentName.trim()) {
      setError('Task name is required');
      return;
    }

    setIsStarting(true);
    setError(null);

    try {
      const res = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newAgentName.trim(),
          workdir: newAgentWorkdir,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to start agent');
      }

      // Success - close modal and refresh
      setShowStartModal(false);
      setNewAgentName('');
      await fetchAgents();
      // User can click "Open →" to access the new agent
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start agent');
    } finally {
      setIsStarting(false);
    }
  };

  const stopAgent = async (port: number, e: React.MouseEvent) => {
    e.stopPropagation();

    if (!confirm(`Stop agent on port ${port}?`)) return;

    try {
      const res = await fetch(`/api/agents?port=${port}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        await fetchAgents();
      }
    } catch (error) {
      console.error('Failed to stop agent:', error);
    }
  };

  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);

      if (diffMins < 1) return 'just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      return date.toLocaleDateString();
    } catch {
      return isoString;
    }
  };

  return (
    <div className="min-h-screen p-4 md:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mb-1">
            Agent HUD
          </h1>
          <p className="text-sm text-slate-400">
            {agents.length > 0
              ? `${agents.length} agent${agents.length !== 1 ? 's' : ''} running`
              : 'No agents running'}
            {tailscaleIP !== 'localhost' && (
              <span className="ml-2 text-slate-500">• {tailscaleIP}</span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Start Agent Button */}
          <button
            onClick={() => setShowStartModal(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            <span className="text-lg">+</span>
            <span>New Agent</span>
          </button>

          {/* Live indicator */}
          <div className="flex items-center gap-2 glass px-3 py-2 rounded-full">
            <div className={`w-2 h-2 rounded-full transition-all duration-300 ${isPolling ? 'bg-green-500' : 'bg-green-900'}`} />
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">Live</span>
          </div>
        </div>
      </header>

      {/* Agent Grid */}
      {agents.length === 0 ? (
        <div className="glass rounded-xl p-8 sm:p-12 text-center">
          <div className="text-5xl mb-4">🤖</div>
          <p className="text-lg text-slate-300 mb-2">No agents running</p>
          <p className="text-sm text-slate-500 mb-6">Start an agent to begin working on tasks</p>
          <button
            onClick={() => setShowStartModal(true)}
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-lg font-medium transition-colors"
          >
            <span className="text-xl">+</span>
            <span>Start Your First Agent</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {agents.map(agent => (
            <div
              key={agent.id}
              className="glass rounded-xl p-5 hover:border-white/30 transition-all duration-300 group"
            >
              {/* Header row */}
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-lg text-white truncate">
                    {agent.name}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
                      {agent.status}
                    </span>
                    {agent.isWorktree && (
                      <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        worktree
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right ml-3">
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest">Port</p>
                  <p className="text-sm font-mono text-slate-300">{agent.port}</p>
                </div>
              </div>

              {/* Workdir */}
              <div className="mb-4">
                <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">Directory</p>
                <p className="text-xs text-slate-400 font-mono truncate" title={agent.workdir}>
                  {agent.workdir.replace('/Users/alanknudson', '~')}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-3 border-t border-white/5">
                <span className="text-xs text-slate-500">
                  Started {formatTime(agent.started)}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => stopAgent(agent.port, e)}
                    className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded hover:bg-red-500/10 transition-colors"
                  >
                    Stop
                  </button>
                  <Link
                    href={`/agent/${agent.port}`}
                    className="text-xs text-green-400 hover:text-green-300 px-2 py-1 rounded hover:bg-green-500/10 transition-colors"
                  >
                    Control
                  </Link>
                  <a
                    href={agent.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-400 hover:text-blue-300 px-2 py-1 rounded hover:bg-blue-500/10 transition-colors"
                  >
                    Terminal →
                  </a>
                </div>
              </div>

              {/* Telegram hint */}
              <div className="mt-3 pt-3 border-t border-white/5">
                <p className="text-[10px] text-slate-500 font-mono">
                  Reply: <span className="text-slate-400">@{agent.port} &lt;response&gt;</span>
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Start Agent Modal */}
      {showStartModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="glass rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-white mb-4">Start New Agent</h2>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-3 rounded-lg mb-4">
                {error}
              </div>
            )}

            <div className="space-y-4">
              {/* Task Name */}
              <div>
                <label className="block text-sm text-slate-400 mb-2">Task Name</label>
                <input
                  type="text"
                  value={newAgentName}
                  onChange={(e) => setNewAgentName(e.target.value)}
                  placeholder="e.g., Fix photo enrichment"
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && startAgent()}
                />
              </div>

              {/* Working Directory */}
              <div>
                <label className="block text-sm text-slate-400 mb-2">Working Directory</label>
                <select
                  value={newAgentWorkdir}
                  onChange={(e) => setNewAgentWorkdir(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-blue-500 focus:outline-none"
                >
                  {COMMON_WORKDIRS.map((dir) => (
                    <option key={dir.path} value={dir.path}>
                      {dir.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowStartModal(false);
                  setNewAgentName('');
                  setError(null);
                }}
                className="flex-1 px-4 py-3 rounded-lg border border-white/10 text-slate-400 hover:text-white hover:border-white/20 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={startAgent}
                disabled={isStarting || !newAgentName.trim()}
                className="flex-1 px-4 py-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isStarting ? 'Starting...' : 'Start Agent'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
