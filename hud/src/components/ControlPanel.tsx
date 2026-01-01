"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';

interface ControlPanelProps {
  port: number;
  name: string;
  onBack?: () => void;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({ port, name, onBack }) => {
  const [log, setLog] = useState('');
  const [input, setInput] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const logRef = useRef<HTMLPreElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch log content
  const fetchLog = useCallback(async () => {
    try {
      const res = await fetch(`/api/agents/log?port=${port}&lines=500`);
      if (res.ok) {
        const data = await res.json();
        setLog(data.content || '');
        setLastUpdate(data.lastModified);
      }
    } catch (error) {
      console.error('Failed to fetch log:', error);
    }
  }, [port]);

  // Poll for log updates every 2 seconds
  useEffect(() => {
    fetchLog();
    const interval = setInterval(fetchLog, 2000);
    return () => clearInterval(interval);
  }, [fetchLog]);

  // Auto-scroll to bottom when log updates
  useEffect(() => {
    if (autoScroll && logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [log, autoScroll]);

  // Send text input
  const sendInput = async () => {
    if (!input.trim()) return;

    setIsLoading(true);
    try {
      const res = await fetch('/api/agents/input', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ port, text: input }),
      });

      if (res.ok) {
        setInput('');
        // Fetch log immediately to show the sent input
        setTimeout(fetchLog, 100);
      }
    } catch (error) {
      console.error('Failed to send input:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Send special key
  const sendKey = async (key: string) => {
    setIsLoading(true);
    try {
      await fetch('/api/agents/key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ port, key }),
      });
      // Fetch log immediately
      setTimeout(fetchLog, 100);
    } catch (error) {
      console.error('Failed to send key:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Enter key in input
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendInput();
    }
  };

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="flex flex-col h-screen bg-black text-white">
      {/* Header */}
      <header className="flex items-center justify-between p-3 border-b border-white/10 bg-black/80 backdrop-blur shrink-0">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="text-slate-400 hover:text-white transition-colors p-1"
            >
              ← Back
            </button>
          )}
          <div>
            <h1 className="font-bold text-lg">{name}</h1>
            <p className="text-xs text-slate-500">Port {port}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Auto-scroll toggle */}
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`text-xs px-2 py-1 rounded transition-colors ${
              autoScroll
                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                : 'bg-slate-800 text-slate-400 border border-white/10'
            }`}
          >
            {autoScroll ? '⬇ Auto' : '⬇ Manual'}
          </button>

          {/* Open terminal link */}
          <a
            href={`http://${typeof window !== 'undefined' ? window.location.hostname : 'localhost'}:${port}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-400 hover:text-blue-300 px-2 py-1"
          >
            Terminal →
          </a>
        </div>
      </header>

      {/* Scrollable Log Output */}
      <pre
        ref={logRef}
        className="flex-1 overflow-y-auto p-4 font-mono text-sm leading-relaxed whitespace-pre-wrap break-words bg-black"
        style={{
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {log || <span className="text-slate-500">Waiting for output...</span>}
      </pre>

      {/* Input Controls */}
      <div className="shrink-0 border-t border-white/10 bg-black/90 backdrop-blur p-3 space-y-3">
        {/* Quick Action Buttons */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => sendKey('esc')}
            disabled={isLoading}
            className="shrink-0 px-4 py-2 bg-red-600/80 hover:bg-red-500 text-white rounded-lg font-medium text-sm transition-colors disabled:opacity-50"
          >
            ESC
          </button>
          <button
            onClick={() => sendKey('ctrl-b')}
            disabled={isLoading}
            className="shrink-0 px-4 py-2 bg-purple-600/80 hover:bg-purple-500 text-white rounded-lg font-medium text-sm transition-colors disabled:opacity-50"
          >
            Ctrl-B
          </button>
          <button
            onClick={() => sendKey('ctrl-c')}
            disabled={isLoading}
            className="shrink-0 px-4 py-2 bg-orange-600/80 hover:bg-orange-500 text-white rounded-lg font-medium text-sm transition-colors disabled:opacity-50"
          >
            Ctrl-C
          </button>
          <button
            onClick={() => sendInput()}
            disabled={isLoading || !input.trim()}
            className="shrink-0 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium text-sm transition-colors disabled:opacity-50"
          >
            y
          </button>
          <button
            onClick={() => { setInput('n'); sendInput(); }}
            disabled={isLoading}
            className="shrink-0 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium text-sm transition-colors disabled:opacity-50"
          >
            n
          </button>
        </div>

        {/* Text Input */}
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type response and press Enter..."
            disabled={isLoading}
            className="flex-1 bg-slate-900 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none disabled:opacity-50"
          />
          <button
            onClick={sendInput}
            disabled={isLoading || !input.trim()}
            className="shrink-0 px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
};
