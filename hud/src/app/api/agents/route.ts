import { NextRequest, NextResponse } from 'next/server';
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const AGENT_STATE_DIR = join(homedir(), '.claude', 'agent-terminals');
const AGENT_SCRIPT = join(homedir(), '.claude', 'scripts', 'agent-terminal.sh');

interface AgentState {
  port: number;
  name: string;
  workdir: string;
  original_workdir?: string;
  session_name: string;
  started: string;
  ttyd_pid: number | null;
  is_worktree: boolean;
}

// Check if tmux session exists
async function isSessionRunning(sessionName: string): Promise<boolean> {
  try {
    await execAsync(`tmux has-session -t "${sessionName}" 2>/dev/null`);
    return true;
  } catch {
    return false;
  }
}

// Get Tailscale IP
async function getTailscaleIP(): Promise<string> {
  try {
    const { stdout } = await execAsync(
      'command -v tailscale >/dev/null && tailscale ip -4 || /Applications/Tailscale.app/Contents/MacOS/Tailscale ip -4 2>/dev/null'
    );
    return stdout.trim() || 'localhost';
  } catch {
    return 'localhost';
  }
}

// GET - List all agents
export async function GET() {
  try {
    const files = await readdir(AGENT_STATE_DIR).catch(() => []);
    const agents = [];
    const tailscaleIP = await getTailscaleIP();

    for (const file of files) {
      if (!file.endsWith('.json')) continue;

      try {
        const content = await readFile(join(AGENT_STATE_DIR, file), 'utf-8');
        const state: AgentState = JSON.parse(content);

        // Check if tmux session is actually running
        const isRunning = await isSessionRunning(state.session_name);

        if (isRunning) {
          agents.push({
            id: String(state.port),
            name: state.name,
            port: state.port,
            workdir: state.workdir,
            originalWorkdir: state.original_workdir || state.workdir,
            isWorktree: state.is_worktree || false,
            sessionName: state.session_name,
            status: 'running',
            started: state.started,
            url: `http://${tailscaleIP}:${state.port}`,
          });
        }
      } catch {
        // Skip invalid files
      }
    }

    return NextResponse.json({
      agents,
      tailscaleIP,
    });
  } catch (error) {
    return NextResponse.json({ agents: [], error: String(error) });
  }
}

// POST - Start a new agent
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, workdir } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Task name is required' },
        { status: 400 }
      );
    }

    // Build command
    const workdirArg = workdir ? `"${workdir}"` : '';
    const command = `"${AGENT_SCRIPT}" start "${name}" "" ${workdirArg}`;

    const { stdout, stderr } = await execAsync(command, {
      env: { ...process.env, HOME: homedir() },
    });

    // Extract port from output
    const portMatch = stdout.match(/Port (\d+)/);
    const port = portMatch ? parseInt(portMatch[1]) : null;

    const tailscaleIP = await getTailscaleIP();

    return NextResponse.json({
      success: true,
      port,
      url: port ? `http://${tailscaleIP}:${port}` : null,
      output: stdout,
    });
  } catch (error) {
    const err = error as { stderr?: string; message?: string };
    return NextResponse.json(
      { error: err.stderr || err.message || 'Failed to start agent' },
      { status: 500 }
    );
  }
}

// DELETE - Stop an agent
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const port = searchParams.get('port');

    if (!port) {
      return NextResponse.json(
        { error: 'Port is required' },
        { status: 400 }
      );
    }

    const command = `"${AGENT_SCRIPT}" stop "${port}"`;
    await execAsync(command, {
      env: { ...process.env, HOME: homedir() },
    });

    return NextResponse.json({ success: true, port });
  } catch (error) {
    const err = error as { stderr?: string; message?: string };
    return NextResponse.json(
      { error: err.stderr || err.message || 'Failed to stop agent' },
      { status: 500 }
    );
  }
}
