"use client";

import React from 'react';

interface Props {
  port: number;
  name: string;
  onClose: () => void;
}

export const TerminalEmbed: React.FC<Props> = ({ port, name, onClose }) => {
  // Determine the host - use window.location.hostname for Tailscale access
  const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-zinc-900 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
          <span className="font-mono text-sm text-white">{name}</span>
          <span className="text-xs text-zinc-500">port {port}</span>
        </div>
        <button
          onClick={onClose}
          className="px-3 py-1 text-sm bg-zinc-800 hover:bg-zinc-700 rounded transition-colors"
        >
          Close
        </button>
      </div>

      {/* Terminal iframe */}
      <iframe
        src={`http://${host}:${port}`}
        className="flex-1 w-full border-0"
        title={`Terminal: ${name}`}
      />
    </div>
  );
};
