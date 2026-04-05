#!/data/data/com.termux/files/usr/bin/bash
#===============================================================================
# duck-cli Termux MCP Server Script
# Runs the MCP server using Node.js stdio transport
#
# Usage:
#   bash ~/duck-cli/tools/termux-mcp-server.sh          # Run MCP server
#   bash ~/duck-cli/tools/termux-mcp-server.sh --stdio  # Explicit stdio mode
#   bash ~/duck-cli/tools/termux-mcp-server.sh start    # Daemon mode
#   bash ~/duck-cli/tools/termux-mcp-server.sh stop     # Stop daemon
#   bash ~/duck-cli/tools/termux-mcp-server.sh status   # Check status
#   bash ~/duck-cli/tools/termux-mcp-server.sh logs     # View logs
#===============================================================================
set -euo pipefail

DUCK_DIR="${DUCK_DIR:-$HOME/duck-cli}"
MCP_LOG="$HOME/.termux/mcp-server.log"
MCP_PID="$HOME/.termux/mcp-server.pid"
MCP_PORT="${MCP_PORT:-3850}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

log()  { printf "${GREEN}[mcp]${NC} %s\n" "$1"; }
warn() { printf "${YELLOW}[mcp] WARNING:${NC} %s\n" "$1"; }
info() { printf "${CYAN}[mcp]${NC} %s\n" "$1"; }
error(){ printf "${RED}[mcp] ERROR:${NC} %s\n" "$1" >&2; }

#-------------------------------------------------------------------------------
# Load .env if present
#-------------------------------------------------------------------------------
load_env() {
    if [ -f "$DUCK_DIR/.env" ]; then
        set -a
        source "$DUCK_DIR/.env"
        set +a
    fi
}

#-------------------------------------------------------------------------------
# Check prerequisites
#-------------------------------------------------------------------------------
check_prereqs() {
    if [ ! -d "$DUCK_DIR" ]; then
        error "duck-cli not found at $DUCK_DIR"
        error "Run termux-bootstrap.sh first to install"
        exit 1
    fi

    if [ ! -f "$DUCK_DIR/dist/cli/main.js" ]; then
        error "duck-cli not built. Run: npm run build"
        exit 1
    fi

    if ! command -v node &>/dev/null; then
        error "Node.js not found. Run: pkg install nodejs"
        exit 1
    fi
}

#-------------------------------------------------------------------------------
# Start MCP server
#-------------------------------------------------------------------------------
do_start() {
    check_prereqs
    load_env

    # Check if already running
    if [ -f "$MCP_PID" ] && kill -0 "$(cat "$MCP_PID")" 2>/dev/null; then
        log "MCP server already running (PID $(cat "$MCP_PID"))"
        return 0
    fi

    mkdir -p "$(dirname "$MCP_LOG")"
    mkdir -p "$(dirname "$MCP_PID")"

    cd "$DUCK_DIR"

    log "Starting duck MCP server..."
    log "CLI: node $DUCK_DIR/dist/cli/main.js mcp --stdio"
    log "Log: $MCP_LOG"
    log "Port: $MCP_PORT (stdio mode)"

    # Start in background
    nohup node "$DUCK_DIR/dist/cli/main.js" mcp --stdio \
        >> "$MCP_LOG" 2>&1 &

    SERVER_PID=$!
    echo $SERVER_PID > "$MCP_PID"

    sleep 1

    if kill -0 "$SERVER_PID" 2>/dev/null; then
        log "✅ MCP server started (PID $SERVER_PID)"
        info "Logs: tail -f $MCP_LOG"
    else
        error "MCP server failed to start. Check $MCP_LOG"
        cat "$MCP_LOG" | tail -20 >&2
        exit 1
    fi
}

#-------------------------------------------------------------------------------
# Stop MCP server
#-------------------------------------------------------------------------------
do_stop() {
    if [ ! -f "$MCP_PID" ]; then
        warn "MCP server not running (no PID file)"
        return 0
    fi

    PID=$(cat "$MCP_PID")

    if kill -0 "$PID" 2>/dev/null; then
        log "Stopping MCP server (PID $PID)..."
        kill "$PID" 2>/dev/null || true
        sleep 1
        if kill -0 "$PID" 2>/dev/null; then
            warn "Force-killing..."
            kill -9 "$PID" 2>/dev/null || true
        fi
        rm -f "$MCP_PID"
        log "✅ MCP server stopped"
    else
        warn "MCP server not running (stale PID file)"
        rm -f "$MCP_PID"
    fi
}

#-------------------------------------------------------------------------------
# Status
#-------------------------------------------------------------------------------
do_status() {
    if [ -f "$MCP_PID" ]; then
        PID=$(cat "$MCP_PID")
        if kill -0 "$PID" 2>/dev/null; then
            log "✅ MCP server running (PID $PID)"
            if [ -f "$MCP_LOG" ]; then
                info "Last log lines:"
                tail -3 "$MCP_LOG" | sed 's/^/   /'
            fi
        else
            warn "Stale PID file (process dead)"
            rm -f "$MCP_PID"
            info "Run 'mcp-server start' to start"
        fi
    else
        info "MCP server not running"
        info "Run 'mcp-server start' to start"
    fi
}

#-------------------------------------------------------------------------------
# View logs
#-------------------------------------------------------------------------------
do_logs() {
    if [ -f "$MCP_LOG" ]; then
        tail -50 "$MCP_LOG"
    else
        info "No log file found at $MCP_LOG"
    fi
}

#-------------------------------------------------------------------------------
# Run MCP server (blocking/stdio mode)
#-------------------------------------------------------------------------------
do_run() {
    check_prereqs
    load_env

    cd "$DUCK_DIR"

    info "Starting duck MCP server in stdio mode..."
    info "Press Ctrl+C to stop"
    info ""

    # Run in foreground (stdio mode — for LM Studio, Claude Desktop, etc.)
    exec node "$DUCK_DIR/dist/cli/main.js" mcp --stdio
}

#-------------------------------------------------------------------------------
# Main dispatcher
#-------------------------------------------------------------------------------
case "${1:-start}" in
    start)
        do_start
        ;;
    stop)
        do_stop
        ;;
    restart)
        do_stop
        sleep 1
        do_start
        ;;
    status)
        do_status
        ;;
    logs)
        do_logs
        ;;
    run|--run)
        do_run
        ;;
    --stdio|-s|stdio)
        do_run
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status|logs|run}"
        echo ""
        echo "  start   - Start MCP server in background (daemon)"
        echo "  stop    - Stop the MCP server daemon"
        echo "  restart - Stop and start again"
        echo "  status  - Check if MCP server is running"
        echo "  logs    - View recent MCP server logs"
        echo "  run     - Run MCP server in foreground (stdio, blocking)"
        echo ""
        echo "Examples:"
        echo "  $0 start              # Start daemon"
        echo "  $0 stop               # Stop daemon"
        echo "  $0 run                # Run in foreground (stdio)"
        echo "  node dist/cli/main.js mcp --stdio  # Direct (from duck-cli dir)"
        exit 1
        ;;
esac
