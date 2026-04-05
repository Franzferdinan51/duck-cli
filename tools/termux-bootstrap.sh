#!/data/data/com.termux/files/usr/bin/bash
#===============================================================================
# duck-cli Termux Bootstrap Script
# Run this ONCE in Termux to install and configure duck-cli natively on Android
#
# What it does:
#   1. Installs Node.js and git in Termux
#   2. Clones (or updates) duck-cli from GitHub
#   3. Builds the TypeScript source
#   4. Creates ~/bin/duck wrapper (auto-loads .env)
#   5. Installs termux-mcp-server.sh to ~/.termux/boot/ for auto-start
#
# Usage (run this in Termux on your phone):
#   curl -fsSL https://raw.githubusercontent.com/Franzferdinan51/duck-cli/main/tools/termux-bootstrap.sh | bash
#   # OR copy this file to Termux and run:
#   bash ~/storage/shared/termux-bootstrap.sh
#===============================================================================
set -euo pipefail

# Termux bash shebang
SCRIPT_VERSION="1.0.0"
DUCK_CLI_REPO="https://github.com/Franzferdinan51/duck-cli.git"
DUCK_CLI_DIR="$HOME/duck-cli"
MCP_SERVER_PATH="$HOME/.termux/boot/termux-mcp-server.sh"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

log() { printf "${GREEN}[bootstrap]${NC} %s\n" "$1"; }
warn() { printf "${YELLOW}[bootstrap] WARNING:${NC} %s\n" "$1"; }
info() { printf "${CYAN}[bootstrap]${NC} %s\n" "$1"; }
error() { printf "${RED}[bootstrap] ERROR:${NC} %s\n" "$1" >&2; }

section() {
    printf "\n${BOLD}━━━ %s ━━━${NC}\n" "$1"
}

#-------------------------------------------------------------------------------
# Step 1: Detect if running in Termux
#-------------------------------------------------------------------------------
section "Step 1: Environment Check"

if [ ! -d "/data/data/com.termux/files/usr" ]; then
    error "This script must be run in Termux on Android!"
    error "Download Termux from F-Droid: https://f-droid.org/en/packages/com.termux/"
    exit 1
fi

if [ "$(uname -m)" = "aarch64" ] || [ "$(uname -m)" = "arm64" ]; then
    ARCH="arm64"
elif [ "$(uname -m)" = "arm" ]; then
    ARCH="arm"
else
    ARCH="$(uname -m)"
fi

info "Running on: $(uname -n) ($(uname -m))"
info "Termux version: bootstrap script v${SCRIPT_VERSION}"

#-------------------------------------------------------------------------------
# Step 2: Install system dependencies
#-------------------------------------------------------------------------------
section "Step 2: Installing Dependencies"

# Update Termux package list
info "Updating Termux packages..."
pkg update -y

# Install Node.js, git, and rsync
info "Installing nodejs, git, rsync, openssh..."
pkg install -y nodejs git rsync openssh

# Verify Node.js
NODE_VERSION=$(node --version 2>/dev/null || echo "NOT FOUND")
info "Node.js version: ${NODE_VERSION}"

#-------------------------------------------------------------------------------
# Step 3: Clone or update duck-cli
#-------------------------------------------------------------------------------
section "Step 3: Cloning / Updating duck-cli"

if [ -d "$DUCK_CLI_DIR/.git" ]; then
    info "duck-cli already cloned — pulling latest..."
    cd "$DUCK_CLI_DIR"
    git pull origin main
    info "Updated to latest version"
elif [ -d "$DUCK_CLI_DIR" ]; then
    warn "duck-cli directory exists but is not a git repo."
    warn "Skipping clone. To re-clone: rm -rf $DUCK_CLI_DIR"
else
    info "Cloning duck-cli from GitHub..."
    git clone "$DUCK_CLI_REPO" "$DUCK_CLI_DIR"
    info "Cloned successfully"
fi

cd "$DUCK_CLI_DIR"

#-------------------------------------------------------------------------------
# Step 4: Install npm dependencies and build
#-------------------------------------------------------------------------------
section "Step 4: Building duck-cli"

info "Installing npm dependencies..."
npm install

info "Building TypeScript..."
npm run build

# Verify build output
if [ ! -f "dist/cli/main.js" ]; then
    error "Build failed — dist/cli/main.js not found"
    error "Check for TypeScript errors above"
    exit 1
fi

info "✅ Build successful!"

#-------------------------------------------------------------------------------
# Step 5: Create ~/bin/duck wrapper
#-------------------------------------------------------------------------------
section "Step 5: Creating duck launcher"

mkdir -p "$HOME/bin"

# Create the wrapper that auto-loads .env
cat > "$HOME/bin/duck" <<'WRAPPER_EOF'
#!/data/data/com.termux/files/usr/bin/bash
# duck launcher — auto-loads .env and runs the TypeScript CLI
set -euo pipefail

DUCK_DIR="$HOME/duck-cli"
cd "$DUCK_DIR"

# Auto-load .env if present (for API keys, tokens, etc.)
if [ -f "$DUCK_DIR/.env" ]; then
    set -a
    source "$DUCK_DIR/.env"
    set +a
fi

# Pass through to Node.js CLI
exec node "$DUCK_DIR/dist/cli/main.js" "$@"
WRAPPER_EOF

chmod +x "$HOME/bin/duck"
log "Created ~/bin/duck wrapper"

# Add ~/bin to PATH if not already there
if ! grep -q 'export PATH="\$HOME/bin:\$PATH"' "$HOME/.bashrc" 2>/dev/null; then
    echo '' >> "$HOME/.bashrc"
    echo 'export PATH="$HOME/bin:$PATH"' >> "$HOME/.bashrc"
    info "Added ~/bin to PATH in ~/.bashrc"
else
    info "~/bin already in PATH"
fi

#-------------------------------------------------------------------------------
# Step 6: Setup .env from example (if not exists)
#-------------------------------------------------------------------------------
section "Step 6: Configuring .env"

if [ ! -f "$DUCK_CLI_DIR/.env" ]; then
    if [ -f "$DUCK_CLI_DIR/.env.example" ]; then
        cp "$DUCK_CLI_DIR/.env.example" "$DUCK_CLI_DIR/.env"
        info "Created .env from .env.example"
        info "⚠️  IMPORTANT: Edit $DUCK_CLI_DIR/.env and add your API keys!"
        info "   Required: MINIMAX_API_KEY, TELEGRAM_BOT_TOKEN (if using Telegram)"
    else
        warn ".env.example not found — create $DUCK_CLI_DIR/.env manually"
    fi
else
    info ".env already exists — skipping"
fi

#-------------------------------------------------------------------------------
# Step 7: Install MCP server auto-start script
#-------------------------------------------------------------------------------
section "Step 7: MCP Server Auto-Start"

if [ -f "$HOME/../usr/bin/bash" ]; then
    # termux-services directory
    mkdir -p "$HOME/.termux/boot"

    MCP_SCRIPT="$HOME/.termux/boot/termux-mcp-server.sh"

    cat > "$MCP_SCRIPT" <<'MCPEOF'
#!/data/data/com.termux/files/usr/bin/bash
# Auto-start MCP server on Termux boot
# Installed by duck-cli termux-bootstrap.sh

TERMUX_MCP_LOG="$HOME/.termux/mcp-server.log"
TERMUX_MCP_PID="$HOME/.termux/mcp-server.pid"

# Only start if not already running
if [ -f "$TERMUX_MCP_PID" ] && kill -0 "$(cat "$TERMUX_MCP_PID")" 2>/dev/null; then
    echo "[mcp] Already running (PID $(cat "$TERMUX_MCP_PID"))" >> "$TERMUX_MCP_LOG"
    exit 0
fi

DUCK_DIR="$HOME/duck-cli"
cd "$DUCK_DIR"

# Load .env
if [ -f "$DUCK_DIR/.env" ]; then
    set -a
    source "$DUCK_DIR/.env"
    set +a
fi

echo "[mcp] Starting duck MCP server at $(date)" >> "$TERMUX_MCP_LOG"

# Start in background, log to file
nohup node "$DUCK_DIR/dist/cli/main.js" mcp --stdio \
    >> "$TERMUX_MCP_LOG" 2>&1 &

echo $! > "$TERMUX_MCP_PID"
echo "[mcp] Started with PID $(cat "$TERMUX_MCP_PID")" >> "$TERMUX_MCP_LOG"
MCPEOF

    chmod +x "$MCP_SCRIPT"
    log "Installed MCP server auto-start at $MCP_SCRIPT"
    info "MCP server will start automatically when Termux boots"
else
    warn "termux-services not available — MCP auto-start not installed"
    info "To manually start MCP server:"
    info "  bash $HOME/.termux/boot/termux-mcp-server.sh"
fi

#-------------------------------------------------------------------------------
# Done
#-------------------------------------------------------------------------------
section "✅ Installation Complete!"

log "🦆 duck-cli is installed and ready!"
echo ""
echo "  ${BOLD}Quick Start:${NC}"
echo "  1. ${CYAN}source ~/.bashrc${NC}  (or restart Termux)"
echo "  2. ${CYAN}duck run \"Say hello\"${NC}  (first run — takes a moment)"
echo "  3. ${CYAN}duck mcp${NC}          (start MCP server)"
echo ""
echo "  ${BOLD}Configuration:${NC}"
echo "  • Edit: ${YELLOW}$DUCK_CLI_DIR/.env${NC}"
echo "  • Required: MINIMAX_API_KEY"
echo "  • Optional: TELEGRAM_BOT_TOKEN, LM_STUDIO_URL, OPENCLAW_GATEWAY"
echo ""
echo "  ${BOLD}LM Studio (for local AI on your Mac):${NC}"
echo "  • Set: LM_STUDIO_URL=http://YOUR_MAC_IP:1234"
echo "  • Set: LM_STUDIO_KEY=your-lm-studio-api-key"
echo "  • Model: google/gemma-4-e4b-it (Android-native, tool-calling trained)"
echo ""
echo "  ${BOLD}Files:${NC}"
echo "  • CLI:       ~/bin/duck"
echo "  • Source:    $DUCK_CLI_DIR"
echo "  • MCP log:   ~/.termux/mcp-server.log"
echo ""
