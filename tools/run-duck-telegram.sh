#!/bin/bash
set -euo pipefail

DUCK_DIR="/Users/duckets/.openclaw/workspace/duck-cli-src"
NODE_BIN="/usr/local/bin/node"
MAIN_JS="$DUCK_DIR/dist/cli/main.js"
DUCK_BIN="$DUCK_DIR/duck"

export DUCK_SOURCE_DIR="$DUCK_DIR"
export DUCK_CLI_PATH="$DUCK_BIN"
export PATH="/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin"

cd "$DUCK_DIR"
exec "$NODE_BIN" "$MAIN_JS" telegram start
