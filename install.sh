#!/bin/bash
# Quick install script for Claude Code Remote Control
# Run: ./install.sh

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}Claude Code Remote Control - Installer${NC}"
echo ""

# Check prerequisites
echo "Checking prerequisites..."

if ! command -v tmux &>/dev/null; then
    echo -e "${RED}❌ tmux not found. Install with: brew install tmux${NC}"
    exit 1
fi

if ! command -v jq &>/dev/null; then
    echo -e "${RED}❌ jq not found. Install with: brew install jq${NC}"
    exit 1
fi

if ! command -v shellinaboxd &>/dev/null; then
    echo -e "${RED}❌ shellinabox not found. Install with: brew install shellinabox${NC}"
    exit 1
fi

if ! command -v claude &>/dev/null; then
    echo -e "${RED}❌ Claude Code not found. Install from: https://claude.ai/claude-code${NC}"
    exit 1
fi

echo -e "${GREEN}✓ All prerequisites found${NC}"
echo ""

# Create directories
echo "Creating directories..."
mkdir -p ~/.claude/scripts
mkdir -p ~/.claude/agent-terminals
mkdir -p ~/.claude/logs
mkdir -p ~/.claude/worktrees
echo -e "${GREEN}✓ Directories created${NC}"

# Copy scripts
echo "Copying scripts..."
cp scripts/* ~/.claude/scripts/
chmod +x ~/.claude/scripts/*.sh
chmod +x ~/.claude/scripts/*.py
echo -e "${GREEN}✓ Scripts installed${NC}"

# Check for HUD
if [ -d ~/agent-hud ]; then
    echo -e "${YELLOW}⚠ ~/agent-hud already exists. Skipping HUD install.${NC}"
else
    echo "Installing Agent HUD..."
    cp -r hud ~/agent-hud
    cd ~/agent-hud
    npm install
    cd - >/dev/null
    echo -e "${GREEN}✓ Agent HUD installed${NC}"
fi

echo ""
echo -e "${GREEN}Installation complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Set up Telegram bot (see README.md)"
echo "2. Add environment variables to ~/.zshrc:"
echo "   export TELEGRAM_BOT_TOKEN=\"your_token\""
echo "   export TELEGRAM_CHAT_ID=\"your_chat_id\""
echo ""
echo "3. Edit and install launchd services:"
echo "   cd launchd/"
echo "   # Edit plists with your username and credentials"
echo "   cp *.plist ~/Library/LaunchAgents/"
echo "   launchctl load ~/Library/LaunchAgents/com.claude.*.plist"
echo ""
echo "4. Add notification hook to ~/.claude/settings.json"
echo "   (see config/settings.json.example)"
echo ""
echo "5. Test with:"
echo "   ~/.claude/scripts/agent-terminal.sh start \"Test Task\""
