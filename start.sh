#!/bin/bash
# 🦆 Duck Agent - Quick Start Script

set -e

echo "🦆 Duck Agent Startup"
echo "==================="

# Check for required environment variables
if [ -z "$MINIMAX_API_KEY" ]; then
  echo "⚠️  MINIMAX_API_KEY not set"
  echo "   Set it with: export MINIMAX_API_KEY='your-key'"
  echo ""
fi

# Parse arguments
COMMAND=${1:-help}

case $COMMAND in
  shell)
    echo "🚀 Starting interactive shell..."
    node dist/cli/main.js shell
    ;;
    
  web)
    echo "🌐 Starting Web UI..."
    node dist/cli/main.js web
    ;;
    
  gateway)
    echo "🔗 Starting Gateway..."
    node dist/cli/main.js gateway
    ;;
    
  mcp)
    echo "📡 Starting MCP Server..."
    node dist/cli/main.js mcp
    ;;
    
  channels)
    echo "📱 Starting Channels..."
    node dist/cli/main.js channels
    ;;
    
  status)
    node dist/cli/main.js status
    ;;
    
  tools)
    node dist/cli/main.js tools
    ;;
    
  think)
    shift
    TEXT="$*"
    if [ -z "$TEXT" ]; then
      echo "Usage: duck think <prompt>"
    else
      node dist/cli/main.js think "$TEXT"
    fi
    ;;
    
  speak)
    shift
    TEXT="$*"
    if [ -z "$TEXT" ]; then
      echo "Usage: duck speak <text>"
    else
      node dist/cli/main.js speak "$TEXT"
    fi
    ;;
    
  docker)
    echo "🐳 Starting with Docker..."
    docker-compose up -d
    docker logs -f duck-agent
    ;;
    
  install)
    echo "📦 Installing dependencies..."
    npm install
    npm run build
    echo "✅ Installation complete!"
    ;;
    
  help|*)
    echo ""
    echo "🦆 Duck Agent Commands:"
    echo ""
    echo "  duck shell      - Interactive shell"
    echo "  duck web        - Start Web UI (port 3000)"
    echo "  duck gateway    - Start Gateway API (port 18789)"
    echo "  duck mcp        - Start MCP Server (port 3848)"
    echo "  duck channels   - Start Telegram/Discord"
    echo "  duck status     - Show agent status"
    echo "  duck tools      - List available tools"
    echo "  duck think <x>  - Reasoning mode"
    echo "  duck speak <x>  - Text-to-speech"
    echo "  duck docker     - Run with Docker"
    echo "  duck install    - Install dependencies"
    echo ""
    echo "Examples:"
    echo "  duck shell"
    echo "  duck think \"Why is the sky blue?\""
    echo "  duck speak \"Hello world!\""
    echo ""
    ;;
esac
