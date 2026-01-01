import { NextRequest, NextResponse } from 'next/server';
import { readFile, stat } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';

const AGENT_LOGS_DIR = join(homedir(), '.claude', 'agent-logs');

// GET /api/agents/log?port=7681&lines=100&offset=0
// Returns the last N lines of the agent's output log
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const port = searchParams.get('port');
    const lines = parseInt(searchParams.get('lines') || '200');
    const offset = parseInt(searchParams.get('offset') || '0');

    if (!port) {
      return NextResponse.json(
        { error: 'Port is required' },
        { status: 400 }
      );
    }

    const logFile = join(AGENT_LOGS_DIR, `${port}.log`);

    try {
      // Get file stats for size info
      const stats = await stat(logFile);

      // Read the log file
      const content = await readFile(logFile, 'utf-8');

      // Split into lines and get the requested portion
      const allLines = content.split('\n');
      const totalLines = allLines.length;

      // Get last N lines, optionally with offset for pagination
      const startIdx = Math.max(0, totalLines - lines - offset);
      const endIdx = totalLines - offset;
      const selectedLines = allLines.slice(startIdx, endIdx);

      return NextResponse.json({
        port,
        content: selectedLines.join('\n'),
        totalLines,
        returnedLines: selectedLines.length,
        fileSize: stats.size,
        lastModified: stats.mtime.toISOString(),
      });
    } catch (err) {
      // File doesn't exist yet - agent just started
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        return NextResponse.json({
          port,
          content: '',
          totalLines: 0,
          returnedLines: 0,
          fileSize: 0,
          lastModified: null,
        });
      }
      throw err;
    }
  } catch (error) {
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
