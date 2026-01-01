import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { homedir } from 'os';
import { join } from 'path';

const execAsync = promisify(exec);
const AGENT_SCRIPT = join(homedir(), '.claude', 'scripts', 'agent-terminal.sh');

// Valid keys that can be sent
const VALID_KEYS = ['esc', 'escape', 'ctrl-b', 'c-b', 'ctrl-c', 'c-c', 'enter', 'up', 'down', 'left', 'right'];

// POST /api/agents/key
// Send a special key to an agent (without Enter)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { port, key } = body;

    if (!port) {
      return NextResponse.json(
        { error: 'Port is required' },
        { status: 400 }
      );
    }

    if (!key) {
      return NextResponse.json(
        { error: 'Key is required' },
        { status: 400 }
      );
    }

    const normalizedKey = key.toLowerCase();
    if (!VALID_KEYS.includes(normalizedKey)) {
      return NextResponse.json(
        { error: `Invalid key: ${key}. Valid keys: ${VALID_KEYS.join(', ')}` },
        { status: 400 }
      );
    }

    // Use the agent-terminal.sh key command
    const command = `"${AGENT_SCRIPT}" key "${port}" "${normalizedKey}"`;

    const { stdout, stderr } = await execAsync(command, {
      env: { ...process.env, HOME: homedir() },
    });

    return NextResponse.json({
      success: true,
      port,
      key: normalizedKey,
      output: stdout,
    });
  } catch (error) {
    const err = error as { stderr?: string; message?: string };
    return NextResponse.json(
      { error: err.stderr || err.message || 'Failed to send key' },
      { status: 500 }
    );
  }
}
