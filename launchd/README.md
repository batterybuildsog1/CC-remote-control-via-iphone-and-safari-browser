# launchd Services

macOS launchd services to auto-start the agent system on login.

## Quick Setup

1. **Edit each plist file** to replace `YOUR_USERNAME` with your actual username
2. **Add Telegram credentials** to `com.claude.telegram-responder.plist`
3. **Copy to LaunchAgents** and load:

```bash
# Copy all plists
cp *.plist ~/Library/LaunchAgents/

# Load services
launchctl load ~/Library/LaunchAgents/com.claude.agent-hud.plist
launchctl load ~/Library/LaunchAgents/com.claude.telegram-responder.plist
launchctl load ~/Library/LaunchAgents/com.claude.caffeinate.plist
```

## Services

| Service | Purpose |
|---------|---------|
| `com.claude.agent-hud` | Web dashboard on port 7680 |
| `com.claude.telegram-responder` | Polls Telegram for replies |
| `com.claude.caffeinate` | Keeps Mac awake for long tasks |

## Management Commands

```bash
# Check status
launchctl list | grep claude

# View logs
tail -f ~/.claude/logs/agent-hud.log
tail -f ~/.claude/logs/telegram-responder.log

# Restart a service
launchctl unload ~/Library/LaunchAgents/com.claude.agent-hud.plist
launchctl load ~/Library/LaunchAgents/com.claude.agent-hud.plist

# Stop all
launchctl unload ~/Library/LaunchAgents/com.claude.*.plist
```

## Getting Telegram Credentials

1. **Bot Token**: Message [@BotFather](https://t.me/BotFather) → `/newbot`
2. **Chat ID**: Message [@userinfobot](https://t.me/userinfobot)
3. **Start chat**: Message your new bot (required before it can send to you)
