#!/bin/bash
# telegram-hook.sh - Claude Code notification hook that sends to Telegram
#
# This hook is called by Claude Code when it needs user input.
# It reads JSON from stdin and sends a Telegram notification.
#
# Hook input example:
# {
#   "session_id": "abc123",
#   "cwd": "/path/to/project",
#   "notification_type": "permission_prompt",
#   "message": "Claude needs permission to edit file.ts"
# }

set -e

# Read JSON from stdin
HOOK_JSON=$(cat)

# Debug: log the raw JSON
echo "[$(date)] Raw JSON: $HOOK_JSON" >> ~/.claude/logs/telegram-hook-debug.log

# Parse the notification
NOTIFICATION_TYPE=$(echo "$HOOK_JSON" | python3 -c "import sys, json; print(json.load(sys.stdin).get('notification_type', 'unknown'))" 2>/dev/null || echo "unknown")
MESSAGE=$(echo "$HOOK_JSON" | python3 -c "import sys, json; print(json.load(sys.stdin).get('message', 'Claude needs your input'))" 2>/dev/null || echo "Claude needs your input")
CWD=$(echo "$HOOK_JSON" | python3 -c "import sys, json; print(json.load(sys.stdin).get('cwd', ''))" 2>/dev/null || echo "")

# Debug: log parsed values
echo "[$(date)] Type: $NOTIFICATION_TYPE, Message: $MESSAGE" >> ~/.claude/logs/telegram-hook-debug.log

# Try to determine which agent this is
# First check AGENT_PORT env var (set by agent-terminal.sh)
AGENT_PORT="${AGENT_PORT:-}"
AGENT_NAME=""

# If no AGENT_PORT, try matching cwd to worktrees
if [ -z "$AGENT_PORT" ]; then
    for state_file in ~/.claude/agent-terminals/*.json; do
        [ -f "$state_file" ] || continue

        WORKDIR=$(jq -r '.workdir' "$state_file" 2>/dev/null)
        if [ "$WORKDIR" = "$CWD" ] || [[ "$CWD" == "$WORKDIR"* ]]; then
            AGENT_PORT=$(jq -r '.port' "$state_file" 2>/dev/null)
            AGENT_NAME=$(jq -r '.name' "$state_file" 2>/dev/null)
            break
        fi
    done
fi

# Get agent name if we have a port but no name
if [ -n "$AGENT_PORT" ] && [ -z "$AGENT_NAME" ]; then
    state_file="$HOME/.claude/agent-terminals/$AGENT_PORT.json"
    if [ -f "$state_file" ]; then
        AGENT_NAME=$(jq -r '.name' "$state_file" 2>/dev/null)
    fi
fi

# Map notification types to emojis
case "$NOTIFICATION_TYPE" in
    permission_prompt)
        EMOJI="🔐"
        TYPE_LABEL="Permission Request"
        ;;
    idle_prompt)
        EMOJI="⏳"
        TYPE_LABEL="Waiting for Input"
        ;;
    elicitation_dialog)
        EMOJI="❓"
        TYPE_LABEL="Question"
        ;;
    *)
        EMOJI="🔔"
        TYPE_LABEL="Notification"
        ;;
esac

# Get Tailscale IP (try CLI in PATH, then Mac app location)
if command -v tailscale &>/dev/null; then
    TAILSCALE_IP=$(tailscale ip -4 2>/dev/null | head -1)
elif [ -x "/Applications/Tailscale.app/Contents/MacOS/Tailscale" ]; then
    TAILSCALE_IP=$(/Applications/Tailscale.app/Contents/MacOS/Tailscale ip -4 2>/dev/null | head -1)
else
    TAILSCALE_IP="localhost"
fi

# Build the Telegram message
if [ -n "$AGENT_PORT" ]; then
    TELEGRAM_MSG="$EMOJI *[$TYPE_LABEL] Agent $AGENT_PORT: $AGENT_NAME*

$MESSAGE

*Reply:* \`@$AGENT_PORT <response>\`
*Web:* http://$TAILSCALE_IP:$AGENT_PORT"
else
    TELEGRAM_MSG="$EMOJI *[$TYPE_LABEL]*

$MESSAGE

(Could not determine agent port)"
fi

# Send to Telegram (suppress errors to not block Claude)
python3 ~/.claude/scripts/notify.py "$TELEGRAM_MSG" --markdown 2>/dev/null || true

exit 0
