#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

printf '🦆 duck-cli Termux install\n'

pkg update -y
pkg install -y nodejs git rsync

npm install
npm run build

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

if ! grep -q 'export PATH="$HOME/bin:$PATH"' "$HOME/.bashrc" 2>/dev/null; then
  echo 'export PATH="$HOME/bin:$PATH"' >> "$HOME/.bashrc"
fi

if [ ! -f "$ROOT_DIR/.env" ] && [ -f "$ROOT_DIR/.env.example" ]; then
  cp "$ROOT_DIR/.env.example" "$ROOT_DIR/.env"
fi

echo
echo '✅ Installed duck-cli for Termux'
echo 'Launcher: ~/bin/duck'
echo 'Next:'
echo '  1. Edit ~/duck-cli/.env with LM Studio + gateway settings'
echo '  2. source ~/.bashrc'
echo '  3. duck run "Say hi"'
