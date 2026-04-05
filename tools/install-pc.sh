#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

mkdir -p "$HOME/.local/bin"

printf '🦆 duck-cli PC install\n'

if ! command -v node >/dev/null 2>&1; then
  echo '❌ Node.js is required (20+)'
  exit 1
fi

if ! command -v go >/dev/null 2>&1; then
  echo '❌ Go is required (1.21+)'
  exit 1
fi

npm install
npm run build
go build -o duck ./cmd/duck/

cp duck "$HOME/.local/bin/duck"
mkdir -p "$HOME/.local/share/duck-cli"
rsync -a --delete dist/ "$HOME/.local/share/duck-cli/dist/"

if [ ! -f "$ROOT_DIR/.env" ] && [ -f "$ROOT_DIR/.env.example" ]; then
  cp "$ROOT_DIR/.env.example" "$ROOT_DIR/.env"
fi

echo
echo '✅ Installed duck-cli'
echo 'Binary: ~/.local/bin/duck'
echo 'Runtime: ~/.local/share/duck-cli/dist'
echo 'Next:'
echo '  1. Edit .env with LM Studio / gateway settings'
echo '  2. Run: duck status'
echo '  3. Run: duck run "Say hi"'
