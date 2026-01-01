#!/usr/bin/env python3
"""
Telegram Responder Daemon for Claude Code Agent HUD

Polls Telegram for replies and routes them to the appropriate tmux session.

Message format:
  @7681 y           -> sends "y" to agent-7681
  @7681 yes please  -> sends "yes please" to agent-7681
  @all stop         -> sends "stop" to all agents

Run as daemon:
  nohup python3 telegram-responder.py > ~/.claude/telegram-responder.log 2>&1 &
"""

import os
import sys
import json
import time
import subprocess
import re
from pathlib import Path
from datetime import datetime

# Add scripts to path for telegram_lib
sys.path.insert(0, str(Path.home() / ".claude" / "scripts"))
from telegram_lib import TelegramBot

# Configuration
POLL_INTERVAL = 15  # seconds
AGENT_STATE_DIR = Path.home() / ".claude" / "agent-terminals"
LOG_FILE = Path.home() / ".claude" / "telegram-responder.log"


def log(message: str):
    """Log with timestamp."""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{timestamp}] {message}", flush=True)


def get_running_agents() -> dict:
    """Get dict of port -> agent info for running agents."""
    agents = {}

    if not AGENT_STATE_DIR.exists():
        return agents

    for state_file in AGENT_STATE_DIR.glob("*.json"):
        try:
            with open(state_file) as f:
                state = json.load(f)

            port = state.get("port")
            session_name = state.get("session_name")

            # Check if tmux session exists
            result = subprocess.run(
                ["tmux", "has-session", "-t", session_name],
                capture_output=True
            )

            if result.returncode == 0:
                agents[str(port)] = state
        except (json.JSONDecodeError, IOError):
            continue

    return agents


def send_to_agent(port: str, text: str) -> bool:
    """Send text to an agent's tmux session."""
    session_name = f"agent-{port}"

    try:
        # Check if session exists
        result = subprocess.run(
            ["tmux", "has-session", "-t", session_name],
            capture_output=True
        )

        if result.returncode != 0:
            log(f"Session {session_name} does not exist")
            return False

        # Handle ESC specially - send without Enter
        if text.strip().lower() in ('esc', 'escape'):
            subprocess.run(
                ["tmux", "send-keys", "-t", session_name, "Escape"],
                check=True
            )
            log(f"Sent ESC to {session_name}")
            return True

        # Regular text - send with Enter
        subprocess.run(
            ["tmux", "send-keys", "-t", session_name, text, "Enter"],
            check=True
        )
        log(f"Sent to {session_name}: {text}")
        return True

    except subprocess.CalledProcessError as e:
        log(f"Error sending to {session_name}: {e}")
        return False


def parse_message(text: str) -> tuple:
    """
    Parse a Telegram message for agent commands.

    Returns (port, command) or (None, None) if not a valid command.

    Formats:
      @7681 y           -> ("7681", "y")
      @7681 yes please  -> ("7681", "yes please")
      @all stop         -> ("all", "stop")
    """
    text = text.strip()

    # Match @<port> <command>
    match = re.match(r'^@(\d+|all)\s+(.+)$', text, re.IGNORECASE)
    if match:
        port = match.group(1).lower()
        command = match.group(2).strip()
        return (port, command)

    return (None, None)


def main():
    log("Telegram Responder starting...")

    try:
        bot = TelegramBot()
        log(f"Connected to Telegram bot")
    except Exception as e:
        log(f"Failed to connect to Telegram: {e}")
        sys.exit(1)

    # Send startup notification
    try:
        bot.send("🟢 *Telegram Responder Started*\n\nReply with `@<port> <response>` to send input to agents.", parse_mode="Markdown")
    except:
        pass

    log("Entering poll loop...")

    while True:
        try:
            # Get new messages
            messages = bot.get_updates(only_new=True)

            for msg in messages:
                text = msg.get("text", "").strip()
                sender = msg.get("from", "Unknown")

                if not text:
                    continue

                log(f"Received from {sender}: {text}")

                # Parse the message
                port, command = parse_message(text)

                if port is None:
                    # Not a valid command, ignore
                    log(f"Not a valid command, ignoring")
                    continue

                # Get running agents
                agents = get_running_agents()

                if port == "all":
                    # Send to all agents
                    if not agents:
                        bot.send("⚠️ No agents running")
                        continue

                    success_count = 0
                    for agent_port in agents.keys():
                        if send_to_agent(agent_port, command):
                            success_count += 1

                    bot.send(f"✅ Sent `{command}` to {success_count} agent(s)", parse_mode="Markdown")

                elif port in agents:
                    # Send to specific agent
                    if send_to_agent(port, command):
                        agent_name = agents[port].get("name", "Unknown")
                        bot.send(f"✅ Sent to Agent {port} ({agent_name}): `{command}`", parse_mode="Markdown")
                    else:
                        bot.send(f"❌ Failed to send to Agent {port}")

                else:
                    # Agent not found
                    available = ", ".join(agents.keys()) if agents else "none"
                    bot.send(f"⚠️ Agent {port} not found\n\nAvailable: {available}")

        except KeyboardInterrupt:
            log("Shutting down...")
            break

        except Exception as e:
            log(f"Error in poll loop: {e}")

        time.sleep(POLL_INTERVAL)

    # Send shutdown notification
    try:
        bot.send("🔴 Telegram Responder stopped")
    except:
        pass

    log("Responder stopped")


if __name__ == "__main__":
    main()
