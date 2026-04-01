#!/bin/bash
# 🦆 Duck Agent - AI Council Server Launcher

set -e

COUNCIL_DIR="${COUNCIL_DIR:-/Users/duckets/.openclaw/workspace/ai-council-webui-new}"
PORT="${COUNCIL_PORT:-3003}"

echo "🦆 Starting AI Council Server..."
echo "   Directory: $COUNCIL_DIR"
echo "   Port: $PORT"
echo ""

# Check if already running
if curl -s "http://localhost:$PORT/api/health" > /dev/null 2>&1; then
    echo "✅ Council server already running on port $PORT"
    exit 0
fi

# Start the server
cd "$COUNCIL_DIR"
nohup node server.cjs > /tmp/council-server.log 2>&1 &
SERVER_PID=$!

echo "🚀 Council server starting (PID: $SERVER_PID)"
sleep 2

# Verify it's running
if curl -s "http://localhost:$PORT/api/health" > /dev/null 2>&1; then
    echo "✅ Council server running on http://localhost:$PORT"
    echo "   Health: http://localhost:$PORT/api/health"
    echo "   Sessions: http://localhost:$PORT/api/session"
else
    echo "❌ Failed to start council server"
    echo "   Log: /tmp/council-server.log"
    exit 1
fi
