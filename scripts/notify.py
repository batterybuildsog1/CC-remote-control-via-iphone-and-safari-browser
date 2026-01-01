#!/usr/bin/env python3
"""
Telegram Notification Tool for Claude Code.

Simple CLI to send messages and check replies via Telegram.

Usage:
  # Send a notification
  python notify.py "Build complete! All tests passed."
  python notify.py "Deploy finished" --quiet

  # Check for replies
  python notify.py --replies
  python notify.py --replies --all

  # Send with markdown formatting
  python notify.py "*Bold* and _italic_" --markdown

Examples:
  python notify.py "Task finished!"
  python notify.py --replies
"""

import sys
import json
import argparse
from pathlib import Path

# Add scripts directory to path
sys.path.insert(0, str(Path(__file__).parent))

from telegram_lib import TelegramBot


def main():
    parser = argparse.ArgumentParser(
        description="Send Telegram notifications from Claude Code",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s "Build complete!"
  %(prog)s "Error in deployment"
  %(prog)s --replies
"""
    )

    parser.add_argument(
        "message",
        nargs="?",
        help="Message to send"
    )
    parser.add_argument(
        "--replies", "-r",
        action="store_true",
        help="Check for new replies instead of sending"
    )
    parser.add_argument(
        "--all", "-a",
        action="store_true",
        help="Show all messages (not just new ones)"
    )
    parser.add_argument(
        "--markdown", "-m",
        action="store_true",
        help="Parse message as Markdown"
    )
    parser.add_argument(
        "--quiet", "-q",
        action="store_true",
        help="Minimal output"
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="JSON output"
    )

    args = parser.parse_args()

    try:
        bot = TelegramBot()

        if args.replies:
            # Check for replies
            messages = bot.get_updates(only_new=not args.all)

            if args.json:
                print(json.dumps({"replies": messages}, indent=2))
            elif not messages:
                if not args.quiet:
                    print("No new replies.")
            else:
                if not args.quiet:
                    print(f"{len(messages)} reply(ies):\n")
                for msg in messages:
                    print(f"{msg['from']}: {msg['text']}")

        elif args.message:
            # Send message
            parse_mode = "Markdown" if args.markdown else None
            result = bot.send(args.message, parse_mode=parse_mode)

            if args.json:
                print(json.dumps({"sent": True, "message_id": result.get("message_id")}, indent=2))
            elif not args.quiet:
                print(f"Sent: {args.message}")

        else:
            parser.print_help()
            sys.exit(1)

    except ValueError as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)
    except RuntimeError as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
