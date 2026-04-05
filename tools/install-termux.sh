#!/data/data/com.termux/files/usr/bin/bash
#===============================================================================
# duck-cli Termux Install Script
# Run this in Termux to install duck-cli + MCP server
#
# For a complete bootstrap with MCP auto-start, use termux-bootstrap.sh instead.
# This script is the lightweight version.
#
# Usage:
#   bash <(curl -fsSL https://raw.githubusercontent.com/Franzferdinan51/duck-cli/main/tools/install-termux.sh)
#   # OR copy this file to Termux and run:
#   bash install-termux.sh
#===============================================================================
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

printf '🦆 duck-cli Termux install\n'

# Install dependencies
pkg update -y
pkg install -y nodejs git rsync

# Build
npm install
npm run build

# Create ~/bin/duck wrapper (auto-loads .env)
mkdir -p "$HOME/bin"
cat > "$HOME/bin/duck" <<'EOF'
#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail
cd "$HOME/duck-cli"
if [ -f .env ]; then
  set -a
  . ./.env
  set +a
fi
exec node dist/cli/main.js "$@"
EOF
chmod +x "$HOME/bin/duck"

# Add ~/bin to PATH
if ! grep -q 'export PATH="$HOME/bin:$PATH"' "$HOME/.bashrc" 2>/dev/null; then
  echo 'export PATH="$HOME/bin:$PATH"' >> "$HOME/.bashrc"
fi

# Copy .env.example to .env if not present
if [ ! -f "$ROOT_DIR/.env" ] && [ -f "$ROOT_DIR/.env.example" ]; then
  cp "$ROOT_DIR/.env.example" "$ROOT_DIR/.env"
fi

# Install MCP server auto-start (termux-services)
if [ -d "/data/data/com.termux/files/usr/bin" ]; then
  mkdir -p "$HOME/.termux/boot"
  cat > "$HOME/.termux/boot/termux-mcp-server.sh" <<'MCPEOF'
#!/data/data/com.termux/files/usr/bin/bash
# Auto-start MCP server on Termux boot
TERMUX_MCP_LOG="$HOME/.termux/mcp-server.log"
TERMUX_MCP_PID="$HOME/.termux/mcp-server.pid"

if [ -f "$TERMUX_MCP_PID" ] && kill -0 "$(cat "$TERMUX_MCP_PID")" 2>/dev/null; then
  echo "[mcp] Already running (PID $(cat "$TERMUX_MCP_PID"))" >> "$TERMUX_MCP_LOG"
  exit 0
fi

DUCK_DIR="$HOME/duck-cli"
cd "$DUCK_DIR"
if [ -f "$DUCK_DIR/.env" ]; then
  set -a
  source "$DUCK_DIR/.env"
  set +a
fi

echo "[mcp] Starting duck MCP server at $(date)" >> "$TERMUX_MCP_LOG"
nohup node "$DUCK_DIR/dist/cli/main.js" mcp --stdio \
    >> "$TERMUX_MCP_LOG" 2>&1 &
echo $! > "$TERMUX_MCP_PID"
echo "[mcp] Started with PID $(cat "$TERMUX_MCP_PID")" >> "$TERMUX_MCP_LOG"
MCPEOF
  chmod +x "$HOME/.termux/boot/termux-mcp-server.sh"
  echo "✅ MCP auto-start installed (~/.termux/boot/termux-mcp-server.sh)"
fi

echo
echo '✅ Installed duck-cli for Termux'
echo ''
echo 'Launcher: ~/bin/duck'
echo ''
echo 'Next steps:'
echo '  1. Edit ~/duck-cli/.env with your API keys'
echo '     - MINIMAX_API_KEY (required)'
echo '     - TELEGRAM_BOT_TOKEN (optional, for Telegram channel)'
echo '     - LM_STUDIO_URL (optional, for local AI on your Mac)'
echo '  2. source ~/.bashrc'
echo '  3. duck run "Say hi"'
echo ''
echo 'MCP server:'
echo '  ~/bin/duck mcp --stdio   # stdio mode (for LM Studio, Claude Desktop)'
echo '  ~/bin/duck mcp           # HTTP mode (default port 3850)'
echo '  bash tools/termux-mcp-server.sh start   # daemon mode'
