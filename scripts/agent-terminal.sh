#!/bin/bash
# agent-terminal.sh - Launch Claude Code agents with Telegram integration
#
# Uses tmux for session management so we can:
# 1. Attach ttyd for web access
# 2. Route Telegram replies via tmux send-keys
#
# Usage:
#   agent-terminal.sh start "Task Name" [port]   # Start new agent terminal
#   agent-terminal.sh list                        # List running agents
#   agent-terminal.sh stop [port|all]            # Stop agent(s)
#   agent-terminal.sh send <port> <text>         # Send input to agent
#   agent-terminal.sh responder start            # Start Telegram responder daemon
#   agent-terminal.sh responder stop             # Stop Telegram responder daemon

AGENT_STATE_DIR="$HOME/.claude/agent-terminals"
AGENT_LOGS_DIR="$HOME/.claude/agent-logs"
RESPONDER_PID_FILE="$HOME/.claude/telegram-responder.pid"
HUD_PORT=7680
BASE_PORT=7681
DEFAULT_WORKDIR="$HOME/Money_heaven"

mkdir -p "$AGENT_STATE_DIR"
mkdir -p "$AGENT_LOGS_DIR"

# Get Tailscale IP dynamically
get_tailscale_ip() {
    # Try CLI in PATH first, then Mac app location
    if command -v tailscale &>/dev/null; then
        tailscale ip -4 2>/dev/null | head -1
    elif [ -x "/Applications/Tailscale.app/Contents/MacOS/Tailscale" ]; then
        /Applications/Tailscale.app/Contents/MacOS/Tailscale ip -4 2>/dev/null | head -1
    else
        echo "localhost"
    fi
}

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

get_next_port() {
    local port=$BASE_PORT
    while [ -f "$AGENT_STATE_DIR/$port.json" ] || \
          tmux has-session -t "agent-$port" 2>/dev/null || \
          lsof -i :$port > /dev/null 2>&1; do
        port=$((port + 1))
    done
    echo $port
}

get_session_name() {
    echo "agent-$1"
}

start_agent() {
    local name="$1"
    local port="${2:-$(get_next_port)}"
    local workdir="${3:-$DEFAULT_WORKDIR}"
    local session_name=$(get_session_name $port)

    if [ -z "$name" ]; then
        echo -e "${RED}Error: Task name required${NC}"
        echo "Usage: agent-terminal.sh start \"Task Name\" [port] [workdir]"
        exit 1
    fi

    # Check if port is already in use
    if lsof -i :$port > /dev/null 2>&1; then
        echo -e "${RED}Error: Port $port is already in use${NC}"
        exit 1
    fi

    # Check if tmux session already exists
    if tmux has-session -t "$session_name" 2>/dev/null; then
        echo -e "${RED}Error: Session $session_name already exists${NC}"
        exit 1
    fi

    # Create git worktree for isolation (if in a git repo)
    local worktree_path="$workdir"
    if [ -d "$workdir/.git" ] || git -C "$workdir" rev-parse --git-dir > /dev/null 2>&1; then
        local branch_name="agent-$port-$(date +%Y%m%d-%H%M%S)"
        worktree_path="$HOME/.claude/worktrees/$branch_name"

        echo -e "${BLUE}Creating git worktree: $worktree_path${NC}"
        mkdir -p "$HOME/.claude/worktrees"

        # Create worktree from current HEAD
        git -C "$workdir" worktree add -b "$branch_name" "$worktree_path" HEAD 2>/dev/null || {
            echo -e "${YELLOW}Warning: Could not create worktree, using main directory${NC}"
            worktree_path="$workdir"
        }
    fi

    # Create log file path
    local log_file="$AGENT_LOGS_DIR/$port.log"

    # Create state file
    cat > "$AGENT_STATE_DIR/$port.json" << EOF
{
    "port": $port,
    "name": "$name",
    "workdir": "$worktree_path",
    "original_workdir": "$workdir",
    "session_name": "$session_name",
    "started": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "ttyd_pid": null,
    "log_file": "$log_file",
    "is_worktree": $([ "$worktree_path" != "$workdir" ] && echo "true" || echo "false")
}
EOF

    echo -e "${GREEN}Starting agent '$name' on port $port...${NC}"

    # Start tmux session with Claude Code
    # Set AGENT_PORT so hooks can identify which agent needs input
    # Enable mouse mode for potential touch scrolling
    tmux new-session -d -s "$session_name" -c "$worktree_path" \
        "export AGENT_PORT=$port; echo '🤖 Agent: $name'; echo 'Port: $port'; echo 'Working in: $worktree_path'; echo ''; echo 'Reply via Telegram: @$port <response>'; echo ''; claude"

    # Give tmux a moment to start
    sleep 1

    # Enable output logging via pipe-pane for the control panel
    # This streams all output to a log file that can be read by the HUD
    : > "$log_file"  # Create/truncate log file
    tmux pipe-pane -t "$session_name" -o "cat >> '$log_file'"

    # Start shellinabox attached to the tmux session
    # Using shellinabox instead of ttyd because Safari has WebSocket compression bugs
    # shellinabox uses AJAX polling which works reliably on iOS Safari
    # Must use full paths because shellinabox doesn't inherit PATH
    shellinaboxd -p $port -t --no-beep \
        --css="$HOME/.claude/scripts/shellinabox-dark.css" \
        -s "/:$(whoami):staff:HOME:/usr/bin/script -q /dev/null /opt/homebrew/bin/tmux attach-session -t $session_name" &

    local ttyd_pid=$!

    # Update state with ttyd PID
    local tmp_file=$(mktemp)
    jq --arg pid "$ttyd_pid" '.ttyd_pid = ($pid | tonumber)' "$AGENT_STATE_DIR/$port.json" > "$tmp_file" && mv "$tmp_file" "$AGENT_STATE_DIR/$port.json"

    sleep 1

    local tailscale_ip=$(get_tailscale_ip)

    if tmux has-session -t "$session_name" 2>/dev/null; then
        echo -e "${GREEN}✓ Agent started!${NC}"
        echo -e "  Local:     http://localhost:$port"
        echo -e "  Tailscale: http://$tailscale_ip:$port"
        echo -e "  Telegram:  Reply with @$port <text>"
        echo -e "  Session:   $session_name"
        echo -e "  Workdir:   $worktree_path"

        # Send Telegram notification (async - don't block API response)
        python3 ~/.claude/scripts/notify.py "🤖 *Agent Started: $name*

Port: $port
Reply: \`@$port <response>\`

Web: http://$tailscale_ip:$port" --markdown 2>/dev/null &
    else
        echo -e "${RED}✗ Failed to start agent${NC}"
        rm -f "$AGENT_STATE_DIR/$port.json"
        exit 1
    fi
}

list_agents() {
    echo -e "${GREEN}Running Agents:${NC}"
    echo ""

    local tailscale_ip=$(get_tailscale_ip)
    local count=0
    for state_file in "$AGENT_STATE_DIR"/*.json; do
        [ -f "$state_file" ] || continue

        local port=$(basename "$state_file" .json)
        local name=$(jq -r '.name' "$state_file" 2>/dev/null)
        local session_name=$(jq -r '.session_name' "$state_file" 2>/dev/null)
        local workdir=$(jq -r '.workdir' "$state_file" 2>/dev/null)
        local started=$(jq -r '.started' "$state_file" 2>/dev/null)
        local is_worktree=$(jq -r '.is_worktree' "$state_file" 2>/dev/null)

        # Check if tmux session is still running
        if tmux has-session -t "$session_name" 2>/dev/null; then
            echo -e "  ${GREEN}●${NC} Port $port: $name"
            echo -e "    Web:      http://$tailscale_ip:$port"
            echo -e "    Telegram: @$port <response>"
            echo -e "    Session:  $session_name"
            echo -e "    Workdir:  $workdir"
            [ "$is_worktree" = "true" ] && echo -e "    ${BLUE}(isolated worktree)${NC}"
            echo -e "    Started:  $started"
            count=$((count + 1))
        else
            # Clean up dead agent
            cleanup_agent "$port"
        fi
        echo ""
    done

    if [ $count -eq 0 ]; then
        echo -e "  ${YELLOW}No agents running${NC}"
        echo ""
        echo "  Start one with: agent-terminal.sh start \"Task Name\""
    fi

    # Check responder status
    echo ""
    if [ -f "$RESPONDER_PID_FILE" ] && kill -0 "$(cat $RESPONDER_PID_FILE)" 2>/dev/null; then
        echo -e "  ${GREEN}●${NC} Telegram responder: running"
    else
        echo -e "  ${YELLOW}○${NC} Telegram responder: stopped (start with: agent-terminal.sh responder start)"
    fi
}

cleanup_agent() {
    local port="$1"
    local state_file="$AGENT_STATE_DIR/$port.json"
    local log_file="$AGENT_LOGS_DIR/$port.log"

    if [ -f "$state_file" ]; then
        local is_worktree=$(jq -r '.is_worktree' "$state_file" 2>/dev/null)
        local worktree_path=$(jq -r '.workdir' "$state_file" 2>/dev/null)
        local original_workdir=$(jq -r '.original_workdir' "$state_file" 2>/dev/null)

        # Clean up worktree if it was created
        if [ "$is_worktree" = "true" ] && [ -d "$worktree_path" ]; then
            echo -e "${YELLOW}Removing worktree: $worktree_path${NC}"
            git -C "$original_workdir" worktree remove "$worktree_path" --force 2>/dev/null || true
        fi

        rm -f "$state_file"
        rm -f "$log_file"
    fi
}

stop_agent() {
    local target="$1"

    if [ "$target" = "all" ]; then
        for state_file in "$AGENT_STATE_DIR"/*.json; do
            [ -f "$state_file" ] || continue
            local port=$(basename "$state_file" .json)
            stop_single_agent "$port"
        done
    elif [ -n "$target" ]; then
        stop_single_agent "$target"
    else
        echo "Usage: agent-terminal.sh stop [port|all]"
    fi
}

stop_single_agent() {
    local port="$1"
    local state_file="$AGENT_STATE_DIR/$port.json"
    local session_name=$(get_session_name $port)

    if [ -f "$state_file" ]; then
        local ttyd_pid=$(jq -r '.ttyd_pid' "$state_file" 2>/dev/null)

        # Kill ttyd
        if [ "$ttyd_pid" != "null" ] && [ -n "$ttyd_pid" ]; then
            kill "$ttyd_pid" 2>/dev/null || true
        fi

        # Kill tmux session
        tmux kill-session -t "$session_name" 2>/dev/null || true

        # Clean up
        cleanup_agent "$port"

        echo -e "${YELLOW}Stopped agent on port $port${NC}"
    else
        echo -e "${RED}No agent found on port $port${NC}"
    fi
}

send_to_agent() {
    local port="$1"
    local text="$2"
    local session_name=$(get_session_name $port)

    if [ -z "$port" ] || [ -z "$text" ]; then
        echo "Usage: agent-terminal.sh send <port> <text>"
        exit 1
    fi

    if ! tmux has-session -t "$session_name" 2>/dev/null; then
        echo -e "${RED}No agent session found for port $port${NC}"
        exit 1
    fi

    # Send keys to tmux session
    tmux send-keys -t "$session_name" "$text" Enter
    echo -e "${GREEN}Sent to agent $port: $text${NC}"
}

send_key_to_agent() {
    local port="$1"
    local key="$2"
    local session_name=$(get_session_name $port)

    if [ -z "$port" ] || [ -z "$key" ]; then
        echo "Usage: agent-terminal.sh key <port> <key>"
        echo ""
        echo "Available keys:"
        echo "  esc, escape    - Send Escape key"
        echo "  ctrl-b, C-b    - Send Ctrl-B (tmux prefix)"
        echo "  ctrl-c, C-c    - Send Ctrl-C (interrupt)"
        echo "  enter          - Send Enter key"
        echo "  up, down       - Send arrow keys"
        echo "  left, right    - Send arrow keys"
        exit 1
    fi

    if ! tmux has-session -t "$session_name" 2>/dev/null; then
        echo -e "${RED}No agent session found for port $port${NC}"
        exit 1
    fi

    # Map key names to tmux key codes
    local tmux_key=""
    case "${key,,}" in  # lowercase the key
        esc|escape)
            tmux_key="Escape"
            ;;
        ctrl-b|c-b|ctrlb)
            tmux_key="C-b"
            ;;
        ctrl-c|c-c|ctrlc)
            tmux_key="C-c"
            ;;
        enter|return)
            tmux_key="Enter"
            ;;
        up)
            tmux_key="Up"
            ;;
        down)
            tmux_key="Down"
            ;;
        left)
            tmux_key="Left"
            ;;
        right)
            tmux_key="Right"
            ;;
        *)
            echo -e "${RED}Unknown key: $key${NC}"
            echo "Use 'agent-terminal.sh key' to see available keys"
            exit 1
            ;;
    esac

    # Send the key (without Enter)
    tmux send-keys -t "$session_name" "$tmux_key"
    echo -e "${GREEN}Sent key to agent $port: $key${NC}"
}

get_agent_log() {
    local port="$1"
    local lines="${2:-100}"
    local log_file="$AGENT_LOGS_DIR/$port.log"

    if [ -z "$port" ]; then
        echo "Usage: agent-terminal.sh log <port> [lines]"
        exit 1
    fi

    if [ ! -f "$log_file" ]; then
        echo -e "${RED}No log file found for port $port${NC}"
        exit 1
    fi

    tail -n "$lines" "$log_file"
}

start_responder() {
    if [ -f "$RESPONDER_PID_FILE" ] && kill -0 "$(cat $RESPONDER_PID_FILE)" 2>/dev/null; then
        echo -e "${YELLOW}Telegram responder already running (PID: $(cat $RESPONDER_PID_FILE))${NC}"
        return
    fi

    echo -e "${GREEN}Starting Telegram responder daemon...${NC}"
    nohup python3 ~/.claude/scripts/telegram-responder.py > ~/.claude/telegram-responder.log 2>&1 &
    echo $! > "$RESPONDER_PID_FILE"
    sleep 1

    if kill -0 "$(cat $RESPONDER_PID_FILE)" 2>/dev/null; then
        echo -e "${GREEN}✓ Telegram responder started (PID: $(cat $RESPONDER_PID_FILE))${NC}"
        echo -e "  Log: ~/.claude/telegram-responder.log"
    else
        echo -e "${RED}✗ Failed to start responder${NC}"
        rm -f "$RESPONDER_PID_FILE"
    fi
}

stop_responder() {
    if [ -f "$RESPONDER_PID_FILE" ]; then
        local pid=$(cat "$RESPONDER_PID_FILE")
        if kill -0 "$pid" 2>/dev/null; then
            kill "$pid"
            echo -e "${YELLOW}Stopped Telegram responder (PID: $pid)${NC}"
        fi
        rm -f "$RESPONDER_PID_FILE"
    else
        echo -e "${YELLOW}Telegram responder not running${NC}"
    fi
}

merge_agent() {
    local port="$1"
    local state_file="$AGENT_STATE_DIR/$port.json"

    if [ ! -f "$state_file" ]; then
        echo -e "${RED}No agent found for port $port${NC}"
        exit 1
    fi

    local is_worktree=$(jq -r '.is_worktree' "$state_file" 2>/dev/null)
    local worktree_path=$(jq -r '.workdir' "$state_file" 2>/dev/null)
    local original_workdir=$(jq -r '.original_workdir' "$state_file" 2>/dev/null)
    local name=$(jq -r '.name' "$state_file" 2>/dev/null)

    if [ "$is_worktree" != "true" ]; then
        echo -e "${YELLOW}Agent $port is not using a worktree, nothing to merge${NC}"
        exit 0
    fi

    echo -e "${BLUE}Merging agent $port work into main...${NC}"
    echo -e "  Worktree: $worktree_path"
    echo -e "  Target:   $original_workdir"

    # Get the branch name
    local branch_name=$(git -C "$worktree_path" rev-parse --abbrev-ref HEAD)

    # Check if there are uncommitted changes
    if ! git -C "$worktree_path" diff --quiet || ! git -C "$worktree_path" diff --cached --quiet; then
        echo -e "${YELLOW}Uncommitted changes in worktree. Committing...${NC}"
        git -C "$worktree_path" add -A
        git -C "$worktree_path" commit -m "Agent work: $name

🤖 Generated with Claude Code Agent HUD"
    fi

    # Merge into main (use subshell to avoid changing parent shell's directory)
    (
        cd "$original_workdir" || exit 1
        local current_branch=$(git rev-parse --abbrev-ref HEAD)

        echo -e "${BLUE}Merging $branch_name into $current_branch...${NC}"
        if git merge "$branch_name" --no-edit; then
            echo -e "${GREEN}✓ Merged successfully!${NC}"
            echo -e "  You may want to stop the agent: agent-terminal.sh stop $port"
        else
            echo -e "${RED}Merge conflict! Resolve manually:${NC}"
            echo -e "  cd $original_workdir"
            echo -e "  git status"
            echo -e "  # resolve conflicts"
            echo -e "  git merge --continue"
        fi
    )
}

case "$1" in
    start)
        start_agent "$2" "$3" "$4"
        ;;
    list|ls)
        list_agents
        ;;
    stop)
        stop_agent "$2"
        ;;
    send)
        send_to_agent "$2" "$3"
        ;;
    key)
        send_key_to_agent "$2" "$3"
        ;;
    log)
        get_agent_log "$2" "$3"
        ;;
    merge)
        merge_agent "$2"
        ;;
    responder)
        case "$2" in
            start)
                start_responder
                ;;
            stop)
                stop_responder
                ;;
            *)
                echo "Usage: agent-terminal.sh responder [start|stop]"
                ;;
        esac
        ;;
    *)
        echo "Agent Terminal Manager (with Telegram integration)"
        echo ""
        echo "Usage:"
        echo "  agent-terminal.sh start \"Task\" [port]     - Start new agent (creates git worktree)"
        echo "  agent-terminal.sh list                     - List running agents"
        echo "  agent-terminal.sh stop [port|all]          - Stop agent(s)"
        echo "  agent-terminal.sh send <port> <text>       - Send input to agent"
        echo "  agent-terminal.sh key <port> <key>         - Send special key (esc, ctrl-b, etc.)"
        echo "  agent-terminal.sh log <port> [lines]       - View agent output log"
        echo "  agent-terminal.sh merge <port>             - Merge agent's work into main"
        echo "  agent-terminal.sh responder start          - Start Telegram responder daemon"
        echo "  agent-terminal.sh responder stop           - Stop Telegram responder daemon"
        echo ""
        echo "Special keys for 'key' command:"
        echo "  esc, ctrl-b, ctrl-c, enter, up, down, left, right"
        echo ""
        echo "Telegram commands (when responder is running):"
        echo "  @7681 y                                    - Send 'y' to agent on port 7681"
        echo "  @7681 your response here                   - Send custom text"
        echo ""
        echo "Examples:"
        echo "  agent-terminal.sh start \"Fix photo enrichment\""
        echo "  agent-terminal.sh start \"USDA display bug\" 7682"
        echo "  agent-terminal.sh send 7681 \"y\""
        echo "  agent-terminal.sh key 7681 esc"
        echo "  agent-terminal.sh key 7681 ctrl-b"
        echo "  agent-terminal.sh log 7681 50"
        echo "  agent-terminal.sh merge 7681"
        echo "  agent-terminal.sh stop all"
        ;;
esac
