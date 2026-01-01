#!/usr/bin/env python3
"""
Telegram Bot Library for Claude Code.

Send notifications and receive replies via Telegram.
No external dependencies - uses urllib only.

Library Usage:
    from telegram_lib import TelegramBot, send_message, get_replies

    # Quick send
    send_message("Build complete!")

    # Or use client
    bot = TelegramBot()
    bot.send("Deploy finished - check logs")

    # Check for replies
    replies = bot.get_updates(only_new=True)
    for msg in replies:
        print(f"{msg['from']}: {msg['text']}")

Environment Variables:
    TELEGRAM_BOT_TOKEN - Your bot token from @BotFather
    TELEGRAM_CHAT_ID - Your chat ID
"""

import os
import json
import urllib.request
import urllib.error
import urllib.parse
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, List, Dict, Any

# Configuration
USAGE_LOG = Path.home() / ".claude" / "telegram-usage.log"
STATE_FILE = Path.home() / ".claude" / "telegram-state.json"
API_BASE = "https://api.telegram.org/bot"


def load_state() -> Dict[str, Any]:
    """Load bot state (last update ID, etc.)."""
    if not STATE_FILE.exists():
        return {"last_update_id": 0}
    try:
        with open(STATE_FILE) as f:
            return json.load(f)
    except (json.JSONDecodeError, IOError):
        return {"last_update_id": 0}


def save_state(state: Dict[str, Any]):
    """Save bot state."""
    try:
        STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(STATE_FILE, "w") as f:
            json.dump(state, f, indent=2)
    except IOError:
        pass


def log_message(direction: str, text: str, chat_id: int = None):
    """Log message activity."""
    try:
        USAGE_LOG.parent.mkdir(parents=True, exist_ok=True)
        entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "direction": direction,
            "chat_id": chat_id,
            "text_preview": text[:100] + "..." if len(text) > 100 else text,
        }
        with open(USAGE_LOG, "a") as f:
            f.write(json.dumps(entry) + "\n")
    except IOError:
        pass


class TelegramBot:
    """
    Telegram Bot client for Claude Code notifications.

    Example:
        bot = TelegramBot()
        bot.send("Task complete!")

        # Check for user replies
        replies = bot.get_updates(only_new=True)
    """

    def __init__(self, token: str = None, chat_id: int = None):
        """
        Initialize Telegram bot.

        Args:
            token: Bot token from @BotFather (or TELEGRAM_BOT_TOKEN env)
            chat_id: Default chat ID to send to (or TELEGRAM_CHAT_ID env)
        """
        self.token = token or os.environ.get("TELEGRAM_BOT_TOKEN")
        self.chat_id = chat_id or os.environ.get("TELEGRAM_CHAT_ID")

        if not self.token:
            raise ValueError(
                "TELEGRAM_BOT_TOKEN not set. Get one from @BotFather on Telegram."
            )

        if self.chat_id:
            self.chat_id = int(self.chat_id)

        self.api_url = f"{API_BASE}{self.token}"
        self._state = load_state()

    def _request(self, method: str, data: dict = None) -> Dict[str, Any]:
        """Make API request."""
        url = f"{self.api_url}/{method}"

        if data:
            data = json.dumps(data).encode("utf-8")
            headers = {"Content-Type": "application/json"}
        else:
            data = None
            headers = {}

        req = urllib.request.Request(url, data=data, headers=headers)

        try:
            with urllib.request.urlopen(req, timeout=30) as response:
                result = json.loads(response.read().decode("utf-8"))
                if not result.get("ok"):
                    raise RuntimeError(f"Telegram API error: {result}")
                return result.get("result", {})
        except urllib.error.HTTPError as e:
            error_body = e.read().decode("utf-8") if e.fp else ""
            raise RuntimeError(f"Telegram API error {e.code}: {error_body}")
        except urllib.error.URLError as e:
            raise RuntimeError(f"Connection error: {e.reason}")

    def send(
        self,
        text: str,
        chat_id: int = None,
        parse_mode: str = None,
        log: bool = True,
    ) -> Dict[str, Any]:
        """
        Send a message.

        Args:
            text: Message text (supports Markdown if parse_mode="Markdown")
            chat_id: Override default chat ID
            parse_mode: "Markdown" or "HTML" for formatting
            log: Whether to log the message

        Returns:
            API response with message details
        """
        target_chat = chat_id or self.chat_id
        if not target_chat:
            raise ValueError("No chat_id specified. Set TELEGRAM_CHAT_ID or pass chat_id.")

        payload = {
            "chat_id": target_chat,
            "text": text,
        }
        if parse_mode:
            payload["parse_mode"] = parse_mode

        result = self._request("sendMessage", payload)

        if log:
            log_message("sent", text, target_chat)

        return result

    def get_updates(
        self,
        only_new: bool = True,
        limit: int = 100,
        log: bool = True,
    ) -> List[Dict[str, Any]]:
        """
        Get incoming messages/updates.

        Args:
            only_new: Only return messages since last check
            limit: Max messages to retrieve
            log: Whether to log received messages

        Returns:
            List of message dicts with 'text', 'from', 'date', 'message_id'
        """
        params = {"limit": limit}

        if only_new and self._state.get("last_update_id"):
            params["offset"] = self._state["last_update_id"] + 1

        # Build URL with params
        url = f"{self.api_url}/getUpdates"
        if params:
            url += "?" + urllib.parse.urlencode(params)

        req = urllib.request.Request(url)
        try:
            with urllib.request.urlopen(req, timeout=30) as response:
                result = json.loads(response.read().decode("utf-8"))
                if not result.get("ok"):
                    return []
                updates = result.get("result", [])
        except (urllib.error.HTTPError, urllib.error.URLError):
            return []

        messages = []
        max_update_id = self._state.get("last_update_id", 0)

        for update in updates:
            update_id = update.get("update_id", 0)
            max_update_id = max(max_update_id, update_id)

            msg = update.get("message", {})
            if not msg:
                continue

            parsed = {
                "message_id": msg.get("message_id"),
                "text": msg.get("text", ""),
                "from": msg.get("from", {}).get("first_name", "Unknown"),
                "from_id": msg.get("from", {}).get("id"),
                "chat_id": msg.get("chat", {}).get("id"),
                "date": msg.get("date"),
            }
            messages.append(parsed)

            if log and parsed["text"]:
                log_message("received", parsed["text"], parsed["chat_id"])

        # Update state
        if only_new and max_update_id > self._state.get("last_update_id", 0):
            self._state["last_update_id"] = max_update_id
            save_state(self._state)

        return messages

    def get_me(self) -> Dict[str, Any]:
        """Get bot info."""
        return self._request("getMe")


# Convenience functions

def send_message(text: str, **kwargs) -> Dict[str, Any]:
    """Quick send. See TelegramBot.send for details."""
    bot = TelegramBot()
    return bot.send(text, **kwargs)


def get_replies(only_new: bool = True) -> List[Dict[str, Any]]:
    """Get new replies. See TelegramBot.get_updates for details."""
    bot = TelegramBot()
    return bot.get_updates(only_new=only_new)


def notify(text: str) -> Dict[str, Any]:
    """Alias for send_message - for semantic clarity."""
    return send_message(text)
