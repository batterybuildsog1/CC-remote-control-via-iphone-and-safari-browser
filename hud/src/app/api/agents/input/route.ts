import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { homedir } from 'os';
import { join } from 'path';

const execAsync = promisify(exec);
const AGENT_SCRIPT = join(homedir(), '.claude', 'scripts', 'agent-terminal.sh');

// POST /api/agents/input
// Send text input to an agent (with Enter key)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { port, text } = body;

    if (!port) {
      return NextResponse.json(
        { error: 'Port is required' },
        { status: 400 }
      );
    }

    if (typeof text !== 'string') {
      return NextResponse.json(
        { error: 'Text is required' },
        { status: 400 }
      );
    }

    // Use the agent-terminal.sh send command
    const command = `"${AGENT_SCRIPT}" send "${port}" "${text.replace(/"/g, '\\"')}"`;

    const { stdout, stderr } = await execAsync(command, {
      env: { ...process.env, HOME: homedir() },
    });

    return NextResponse.json({
      success: true,
      port,
      text,
      output: stdout,
    });
  } catch (error) {
    const err = error as { stderr?: string; message?: string };
    return NextResponse.json(
      { error: err.stderr || err.message || 'Failed to send input' },
      { status: 500 }
    );
  }
}
