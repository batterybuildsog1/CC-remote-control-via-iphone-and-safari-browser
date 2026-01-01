# Claude Code Remote Control via iPhone & Safari

**Control Claude Code agents from your iPhone** using Safari browser and Telegram.

Run autonomous coding agents on your Mac, monitor them via a web dashboard, and respond to prompts from anywhere using Telegram.

## Why This Exists

Claude Code is powerful but designed for local terminal use. This system solves:

1. **iOS Safari Compatibility**: Safari on iOS has WebSocket bugs that break modern terminal emulators (ttyd). We use shellinabox which uses AJAX polling instead.

2. **Remote Access**: Control agents over Tailscale VPN from anywhere in the world.

3. **Asynchronous Work**: Start a coding task, leave your desk, get notified on Telegram when Claude needs input, reply from your phone.

4. **Multi-Agent Support**: Run multiple isolated agents simultaneously, each with their own git worktree.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         YOUR MAC                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐          │
│  │  Agent 7681  │    │  Agent 7682  │    │  Agent 768X  │          │
│  │  (tmux)      │    │  (tmux)      │    │  (tmux)      │          │
│  │      │       │    │      │       │    │      │       │          │
│  │      ▼       │    │      ▼       │    │      ▼       │          │
│  │ shellinabox  │    │ shellinabox  │    │ shellinabox  │          │
│  │   :7681      │    │   :7682      │    │   :768X      │          │
│  └──────────────┘    └──────────────┘    └──────────────┘          │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    Agent HUD (:7680)                          │   │
│  │  - Dashboard to view all agents                               │   │
│  │  - Start/stop agents via web UI                               │   │
│  │  - Links to each agent's terminal                             │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                 Telegram Integration                          │   │
│  │                                                               │   │
│  │  telegram-hook.sh    →  Sends notifications when Claude       │   │
│  │                         needs input                           │   │
│  │                                                               │   │
│  │  telegram-responder  ←  Polls for replies, routes to agents   │   │
│  │                         via tmux send-keys                    │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              │ Tailscale VPN
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        YOUR IPHONE                                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Safari                          Telegram                            │
│  ┌────────────────┐              ┌────────────────┐                 │
│  │ Agent HUD      │              │ 🔐 Permission  │                 │
│  │ http://x:7680  │              │ Request        │                 │
│  │                │              │                │                 │
│  │ [Agent 7681]   │              │ Claude needs   │                 │
│  │ [Agent 7682]   │              │ to run: npm    │                 │
│  │                │              │                │                 │
│  │ Click → opens  │              │ Reply:         │                 │
│  │ terminal in    │              │ @7681 y        │                 │
│  │ Safari         │              │                │                 │
│  └────────────────┘              └────────────────┘                 │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## Components

| Component | Purpose | Port |
|-----------|---------|------|
| **Agent HUD** | Web dashboard to manage agents | 7680 |
| **Agent Terminals** | shellinabox instances for each agent | 7681+ |
| **telegram-hook.sh** | Sends notifications when Claude needs input | - |
| **telegram-responder.py** | Polls Telegram, routes replies to agents | - |
| **telegram_lib.py** | Python library for Telegram API | - |
| **notify.py** | CLI tool to send Telegram messages | - |
| **shellinabox-dark.css** | Dark terminal theme | - |
| **agent-terminal.sh** | Main script to start/stop/manage agents | - |

## Prerequisites

- **macOS** (tested on Ventura/Sonoma)
- **Claude Code** installed (`npm install -g @anthropic-ai/claude-code` or via Homebrew)
- **Tailscale** for remote access
- **Telegram** account and bot token
- **Homebrew** packages:
  ```bash
  brew install tmux jq shellinabox
  ```

## Installation

### 1. Clone This Repository

```bash
git clone https://github.com/batterybuildsog1/CC-remote-control-via-iphone-and-safari-browser.git
cd CC-remote-control-via-iphone-and-safari-browser
```

### 2. Set Up Directory Structure

```bash
# Create required directories
mkdir -p ~/.claude/scripts
mkdir -p ~/.claude/agent-terminals
mkdir -p ~/.claude/logs
mkdir -p ~/.claude/worktrees

# Copy scripts
cp scripts/* ~/.claude/scripts/
chmod +x ~/.claude/scripts/*.sh
chmod +x ~/.claude/scripts/*.py
```

### 3. Install Agent HUD

```bash
# Copy HUD to home directory (or wherever you prefer)
cp -r hud ~/agent-hud
cd ~/agent-hud
npm install
```

### 4. Set Up Telegram Bot

1. Message [@BotFather](https://t.me/BotFather) on Telegram
2. Send `/newbot` and follow prompts
3. Save the bot token (looks like `123456789:ABCdefGHI...`)
4. Message [@userinfobot](https://t.me/userinfobot) to get your chat ID
5. Start a chat with your new bot (required before it can message you)

### 5. Configure Environment Variables

Add to your `~/.zshrc` or `~/.bashrc`:

```bash
export TELEGRAM_BOT_TOKEN="your_bot_token_here"
export TELEGRAM_CHAT_ID="your_chat_id_here"
```

### 6. Install launchd Services

```bash
# Edit plist files to replace YOUR_USERNAME with your actual username
# and add your Telegram credentials

cp launchd/*.plist ~/Library/LaunchAgents/

# Edit each file:
nano ~/Library/LaunchAgents/com.claude.agent-hud.plist
nano ~/Library/LaunchAgents/com.claude.telegram-responder.plist
nano ~/Library/LaunchAgents/com.claude.caffeinate.plist

# Load the services
launchctl load ~/Library/LaunchAgents/com.claude.agent-hud.plist
launchctl load ~/Library/LaunchAgents/com.claude.telegram-responder.plist
launchctl load ~/Library/LaunchAgents/com.claude.caffeinate.plist
```

### 7. Configure Claude Code Hooks

Add to `~/.claude/settings.json`:

```json
{
  "hooks": {
    "Notification": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "~/.claude/scripts/telegram-hook.sh"
          }
        ]
      }
    ]
  }
}
```

See `config/settings.json.example` for a complete example with recommended permissions.

### 8. Set Up Tailscale

1. Install Tailscale: https://tailscale.com/download
2. Sign in and enable MagicDNS
3. Note your Tailscale IP: `tailscale ip -4`

## Usage

### Starting an Agent

**From Command Line:**
```bash
~/.claude/scripts/agent-terminal.sh start "Fix authentication bug"
~/.claude/scripts/agent-terminal.sh start "Add dark mode" 7682 ~/my-project
```

**From Web Dashboard:**
1. Open `http://YOUR_TAILSCALE_IP:7680` in Safari
2. Click "New Agent"
3. Enter task name and select working directory

### Viewing Agents

**List all agents:**
```bash
~/.claude/scripts/agent-terminal.sh list
```

**Web dashboard:** `http://YOUR_TAILSCALE_IP:7680`

### Responding to Prompts

When Claude needs input, you'll receive a Telegram message:

```
🔐 [Permission Request] Agent 7681: Fix auth bug

Claude needs your permission to use Bash

Reply: @7681 <response>
Web: http://100.x.x.x:7681
```

**Reply via Telegram:**
```
@7681 y           # Send "y" to agent 7681
@7681 yes please  # Send "yes please"
@all stop         # Send "stop" to ALL agents
@7681 esc         # Send ESC key (cancels current operation)
```

**Or open the web terminal** in Safari and type directly.

### Stopping Agents

```bash
~/.claude/scripts/agent-terminal.sh stop 7681    # Stop specific agent
~/.claude/scripts/agent-terminal.sh stop all     # Stop all agents
```

### Merging Agent Work

Agents run in isolated git worktrees. To merge work back:

```bash
~/.claude/scripts/agent-terminal.sh merge 7681
```

## How It Works (Technical Deep Dive)

### Why shellinabox Instead of ttyd?

Modern terminal emulators like ttyd use WebSockets with compression. iOS Safari has known bugs with WebSocket compression that cause:
- Connection drops
- Garbled output
- Complete failures

shellinabox uses AJAX long-polling, which works reliably on all browsers including iOS Safari.

### tmux Session Architecture

Each agent runs in a tmux session:
```
tmux new-session -d -s "agent-7681" -c "/path/to/worktree" \
    "export AGENT_PORT=7681; claude"
```

This enables:
1. **Persistent sessions** - survive disconnects
2. **Remote input** - `tmux send-keys -t agent-7681 "y" Enter`
3. **Multiple viewers** - web terminal + local attach
4. **Session capture** - for logging/debugging

### Git Worktree Isolation

When you start an agent on a git repository:
1. Creates a new branch: `agent-7681-20260101-102213`
2. Creates a worktree: `~/.claude/worktrees/agent-7681-20260101-102213`
3. Agent works in isolation
4. Use `merge` command to integrate changes

### Notification Flow

```
Claude needs input
       │
       ▼
Claude Code calls Notification hook
       │
       ▼
telegram-hook.sh receives JSON:
{
  "notification_type": "permission_prompt",
  "message": "Claude needs permission to use Bash",
  "cwd": "/path/to/project"
}
       │
       ▼
Hook matches cwd to agent state files
       │
       ▼
Sends Telegram message with port number
       │
       ▼
User replies: @7681 y
       │
       ▼
telegram-responder.py parses reply
       │
       ▼
tmux send-keys -t agent-7681 "y" Enter
```

### State Files

Each agent has a state file at `~/.claude/agent-terminals/{port}.json`:

```json
{
  "port": 7681,
  "name": "Fix authentication bug",
  "workdir": "/Users/alan/.claude/worktrees/agent-7681-20260101-102213",
  "original_workdir": "/Users/alan/my-project",
  "session_name": "agent-7681",
  "started": "2026-01-01T10:22:13Z",
  "ttyd_pid": 12345,
  "is_worktree": true
}
```

## Troubleshooting

### Agent HUD Not Loading

```bash
# Check if service is running
launchctl list | grep agent-hud

# Check logs
cat ~/.claude/logs/agent-hud.log
cat ~/.claude/logs/agent-hud.err

# Restart service
launchctl unload ~/Library/LaunchAgents/com.claude.agent-hud.plist
launchctl load ~/Library/LaunchAgents/com.claude.agent-hud.plist
```

### Telegram Messages Not Sending

```bash
# Test manually
python3 ~/.claude/scripts/notify.py "Test message"

# Check responder logs
cat ~/.claude/logs/telegram-responder.log

# Verify environment variables
echo $TELEGRAM_BOT_TOKEN
echo $TELEGRAM_CHAT_ID
```

### Terminal White Background on iOS

Ensure shellinabox-dark.css is in place:
```bash
ls -la ~/.claude/scripts/shellinabox-dark.css
```

And agent-terminal.sh references it:
```bash
shellinaboxd ... --css="$HOME/.claude/scripts/shellinabox-dark.css" ...
```

### Can't Send ESC Key

The telegram-responder handles this specially:
```
@7681 esc      # Sends Escape key
@7681 escape   # Also works
```

## Known Limitations & Future Improvements

### Current Gaps

1. **Telegram message content**: Notifications show generic messages like "Claude needs permission to use Bash" instead of the actual command. The command details are in the transcript file but not easily extracted.

2. **No real-time log streaming**: HUD polls every 5 seconds. Could use WebSocket for real-time updates (but would need a proxy for Safari compatibility).

3. **Single user**: No authentication on HUD. Anyone on your Tailscale network can control agents.

4. **Manual Tailscale setup**: Could auto-configure Tailscale funnel for external access.

### Potential Improvements

- [ ] Extract actual command from transcript for richer Telegram notifications
- [ ] Add authentication to Agent HUD
- [ ] Implement log tailing in HUD
- [ ] Add agent task progress tracking
- [ ] Support for continuing stopped agents
- [ ] Mobile-optimized HUD UI
- [ ] Voice control via Telegram voice messages

## File Structure

```
CC-remote-control-via-iphone-and-safari-browser/
├── README.md                  # This file
├── scripts/
│   ├── agent-terminal.sh      # Main agent management script
│   ├── telegram-hook.sh       # Claude Code notification hook
│   ├── telegram-responder.py  # Telegram polling daemon
│   ├── telegram_lib.py        # Telegram API library
│   ├── notify.py              # CLI notification tool
│   └── shellinabox-dark.css   # Terminal dark theme
├── hud/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx       # Main page
│   │   │   ├── layout.tsx     # App layout
│   │   │   └── api/agents/    # REST API for agents
│   │   ├── components/
│   │   │   ├── AgentDashboard.tsx
│   │   │   ├── TerminalEmbed.tsx
│   │   │   └── ...
│   │   └── types/
│   ├── package.json
│   ├── tailwind.config.ts
│   └── tsconfig.json
├── launchd/
│   ├── com.claude.agent-hud.plist
│   ├── com.claude.telegram-responder.plist
│   └── com.claude.caffeinate.plist
└── config/
    └── settings.json.example
```

## License

MIT License - Use freely, contributions welcome.

## Credits

Built for remote Claude Code control on iOS Safari when WebSockets fail you.
