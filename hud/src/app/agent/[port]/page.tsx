"use client";

import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { ControlPanel } from '../../../components/ControlPanel';

interface AgentInfo {
  name: string;
  port: number;
  status: string;
}

export default function AgentPage() {
  const params = useParams();
  const router = useRouter();
  const port = parseInt(params.port as string);

  const [agent, setAgent] = useState<AgentInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch agent info
  useEffect(() => {
    const fetchAgent = async () => {
      try {
        const res = await fetch('/api/agents');
        if (res.ok) {
          const data = await res.json();
          const found = data.agents?.find((a: AgentInfo) => a.port === port);
          if (found) {
            setAgent(found);
          } else {
            setError(`No agent found on port ${port}`);
          }
        }
      } catch (err) {
        setError('Failed to fetch agent info');
      }
    };

    fetchAgent();
  }, [port]);

  if (error) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={() => router.push('/')}
            className="text-blue-400 hover:text-blue-300"
          >
            ← Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-slate-400">Loading agent...</div>
      </div>
    );
  }

  return (
    <ControlPanel
      port={agent.port}
      name={agent.name}
      onBack={() => router.push('/')}
    />
  );
}
