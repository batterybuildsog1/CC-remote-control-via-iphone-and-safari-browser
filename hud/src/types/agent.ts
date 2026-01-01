export type AgentStatus = 'running' | 'pending' | 'completed' | 'error';

export interface LogEntry {
  timestamp: string;
  message: string;
  level: 'info' | 'warn' | 'error';
}

export interface CodeDiff {
  previous: string;
  current: string;
  filename: string;
}

export interface Agent {
  id: string;
  name: string;
  status: AgentStatus;
  currentTask: string;
  lastUpdate: string;
  logs: LogEntry[];
  pendingDiff?: CodeDiff;
  // Additional fields for database
  projectId?: string;
  terminalId?: string;
  approvalResponse?: string;
  createdAt?: string;
}
