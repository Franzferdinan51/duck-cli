#!/data/data/com.termux/files/usr/bin/bash

# ====================================================
#  OPENCLAW + DUCK-CLI: ANDROID SUPER AGENT SETUP
#  Target: Android (Non-Rooted)
#  Installs: OpenClaw + duck-cli as Solo Agent
# ====================================================

set -e  # Stop immediately if any command fails

# Colors for output
GREEN='\033[1;32m'
YELLOW='\033[1;33m'
RED='\033[1;31m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
OPENCLAW_GATEWAY="${OPENCLAW_GATEWAY:-ws://100.68.208.113:18789}"  # Your Mac's OpenClaw
LM_STUDIO_URL="${LM_STUDIO_URL:-http://100.68.208.113:1234}"
LM_STUDIO_KEY="${LM_STUDIO_KEY:-sk-lm-xWvfQHZF:L8P76SQakhEA95U8DDNf}"
GEMMA_MODEL="${GEMMA_MODEL:-google/gemma-4-e4b-it}"

echo -e "${GREEN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║       🦆 OPENCLAW + DUCK-CLI SUPER AGENT SETUP         ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""

# --- STEP 1: Dependencies & System Prep ---
echo -e "${YELLOW}[1/7] Updating system and installing dependencies...${NC}"
pkg update -y && pkg upgrade -y
pkg install -y nodejs-lts git build-essential python cmake clang ninja pkg-config binutils termux-api termux-services proot tmux nano

# --- STEP 2: Fix Environment Variables ---
echo -e "${YELLOW}[2/7] Configuring environment paths...${NC}"
mkdir -p "$PREFIX/tmp"
mkdir -p "$HOME/tmp"

touch ~/.bashrc

sed -i '/export TMPDIR=/d' ~/.bashrc
sed -i '/export TMP=/d' ~/.bashrc
sed -i '/export TEMP=/d' ~/.bashrc

echo 'export TMPDIR="$PREFIX/tmp"' >> ~/.bashrc
echo 'export TMP="$PREFIX/tmp"' >> ~/.bashrc
echo 'export TEMP="$PREFIX/tmp"' >> ~/.bashrc

export TMPDIR="$PREFIX/tmp"
export TMP="$PREFIX/tmp"
export TEMP="$PREFIX/tmp"

echo -e "${GREEN}    ✓ Environment configured${NC}"

# --- STEP 3: Fix Node-GYP Crash (Android NDK) ---
echo -e "${YELLOW}[3/7] Applying Node-GYP workaround...${NC}"
mkdir -p ~/.gyp
echo "{'variables':{'android_ndk_path':''}}" > ~/.gyp/include.gypi
echo -e "${GREEN}    ✓ Node-GYP workaround applied${NC}"

# --- STEP 4: Install OpenClaw ---
echo -e "${YELLOW}[4/7] Installing OpenClaw (5-10 mins)...${NC}"
npm install -g openclaw@latest 2>/dev/null || npm install -g openclaw
echo -e "${GREEN}    ✓ OpenClaw installed${NC}"

# --- STEP 5: Install duck-cli Super Agent ---
echo -e "${YELLOW}[5/7] Installing duck-cli Super Agent...${NC}"

# Clone duck-cli
cd ~
rm -rf duck-cli 2>/dev/null || true
git clone https://github.com/Franzferdinan51/duck-cli.git
cd duck-cli

# Build duck-cli
npm install 2>/dev/null || true
npm run build 2>/dev/null || npm run tsc 2>/dev/null || true

# Create duck configuration
cat > .env << EOF
# OpenClaw Gateway (connects to your Mac)
OPENCLAW_GATEWAY=${OPENCLAW_GATEWAY}

# LM Studio (your Mac's local AI)
LM_STUDIO_URL=${LM_STUDIO_URL}
LM_STUDIO_KEY=${LM_STUDIO_KEY}
GEMMA_MODEL=${GEMMA_MODEL}

# Phone mode
PHONE_MODE=true
EOF

# Create start-duck script
cat > ~/start-duck.sh << 'DUCKEOF'
#!/data/data/com.termux/files/usr/bin/bash
export HOME=/data/data/com.termux/files/home
export TERMUX_VERSION=1
export TMPDIR=$PREFIX/tmp
export TMP=$PREFIX/tmp
export TEMP=$PREFIX/tmp

# Load duck-cli configuration
cd ~/duck-cli
source .env 2>/dev/null || true

# Start duck-cli as solo agent
node dist/cli/main.js shell --agent
DUCKEOF
chmod +x ~/start-duck.sh

echo -e "${GREEN}    ✓ duck-cli Super Agent installed${NC}"

# --- STEP 6: Patch OpenClaw Hardcoded Paths ---
echo -e "${YELLOW}[6/7] Patching OpenClaw paths...${NC}"
TARGET_FILE="$PREFIX/lib/node_modules/openclaw/dist/entry.js"

if [ -f "$TARGET_FILE" ]; then
    sed -i "s|/tmp/openclaw|$PREFIX/tmp/openclaw|g" "$TARGET_FILE"
    echo -e "${GREEN}    ✓ OpenClaw patched${NC}"
else
    echo -e "${RED}    ⚠ WARNING: entry.js not found${NC}"
fi

# --- STEP 7: Service Setup ---
echo -e "${YELLOW}[7/7] Setting up background services...${NC}"

# OpenClaw Service
SERVICE_DIR="$PREFIX/var/service/openclaw"
LOG_DIR="$PREFIX/var/log/openclaw"
mkdir -p "$SERVICE_DIR/log"
mkdir -p "$LOG_DIR"

cat <<EOF > "$SERVICE_DIR/run"
#!/data/data/com.termux/files/usr/bin/sh
export PATH=$PREFIX/bin:\$PATH
export TMPDIR=$PREFIX/tmp
exec openclaw gateway 2>&1
EOF

cat <<EOF > "$SERVICE_DIR/log/run"
#!/data/data/com.termux/files/usr/bin/sh
exec svlogd -tt $LOG_DIR
EOF

chmod +x "$SERVICE_DIR/run"
chmod +x "$SERVICE_DIR/log/run"

# Duck-cli Service (Solo Agent Mode)
DUCK_SERVICE_DIR="$PREFIX/var/service/duck"
DUCK_LOG_DIR="$PREFIX/var/log/duck"
mkdir -p "$DUCK_SERVICE_DIR/log"
mkdir -p "$DUCK_LOG_DIR"

cat <<EOF > "$DUCK_SERVICE_DIR/run"
#!/data/data/com.termux/files/usr/bin/sh
export HOME=/data/data/com.termux/files/home
export TERMUX_VERSION=1
export TMPDIR=$PREFIX/tmp
export TMP=$PREFIX/tmp
export TEMP=$PREFIX/tmp
export PATH=$PREFIX/bin:\$PATH
cd ~/duck-cli
source .env 2>/dev/null || true
exec node dist/cli/main.js shell --agent 2>&1
EOF

cat <<EOF > "$DUCK_SERVICE_DIR/log/run"
#!/data/data/com.termux/files/usr/bin/sh
exec svlogd -tt $DUCK_LOG_DIR
EOF

chmod +x "$DUCK_SERVICE_DIR/run"
chmod +x "$DUCK_SERVICE_DIR/log/run"

# Enable runit services
sed -i '/export SVDIR=/d' ~/.bashrc
echo 'export SVDIR="$PREFIX/var/service"' >> ~/.bashrc
export SVDIR="$PREFIX/var/service"

service-daemon stop >/dev/null 2>&1 || true
service-daemon start >/dev/null 2>&1 || true

for i in 1 2 3 4 5; do
  [ -e "$PREFIX/var/service/openclaw/supervise/ok" ] && break
  sleep 1
done

sv-enable openclaw 2>/dev/null || true
sv-enable duck 2>/dev/null || true

echo -e "${GREEN}    ✓ Services configured${NC}"

# --- CREATE CONFIGURATION SCRIPT ---
cat > ~/configure-agent.sh << 'CONFIGEOF'
#!/data/data/com.termux/files/usr/bin/bash
# Configure your duck-cli agent

echo "🦆 Duck-CLI Agent Configuration"
echo ""

# Get Mac IP (or set manually)
echo "Enter your Mac's IP address (leave empty for default 100.68.208.113):"
read -r MAC_IP
MAC_IP=${MAC_IP:-100.68.208.113}

echo "Enter OpenClaw Gateway port (leave empty for default 18789):"
read -r GATEWAY_PORT
GATEWAY_PORT=${GATEWAY_PORT:-18789}

# Update .env
cd ~/duck-cli
cat > .env << EOF
OPENCLAW_GATEWAY=ws://${MAC_IP}:${GATEWAY_PORT}
LM_STUDIO_URL=http://${MAC_IP}:1234
LM_STUDIO_KEY=sk-lm-xWvfQHZF:L8P76SQakhEA95U8DDNf
GEMMA_MODEL=google/gemma-4-e4b-it
PHONE_MODE=true
EOF

echo ""
echo "✅ Configuration updated!"
echo ""
echo "To start duck-cli agent:"
echo "  bash ~/start-duck.sh"
echo ""
echo "Or start as a background service:"
echo "  sv up duck"
CONFIGEOF
chmod +x ~/configure-agent.sh

# --- FINAL INSTRUCTIONS ---
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║              ✅ SETUP COMPLETE!                         ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}Installed:${NC}"
echo -e "  • ${CYAN}OpenClaw${NC} - AI gateway server"
echo -e "  • ${CYAN}duck-cli${NC} - Super Agent with Hybrid Orchestrator"
echo ""
echo -e "${YELLOW}Quick Start:${NC}"
echo -e "  1. Configure: ${GREEN}bash ~/configure-agent.sh${NC}"
echo -e "  2. Start duck: ${GREEN}bash ~/start-duck.sh${NC}"
echo ""
echo -e "${YELLOW}Background Services (optional):${NC}"
echo -e "  • OpenClaw gateway: ${GREEN}sv up openclaw${NC}"
echo -e "  • duck-cli agent: ${GREEN}sv up duck${NC}"
echo ""
echo -e "${YELLOW}To keep running when app closed:${NC}"
echo -e "  • ${GREEN}termux-wake-lock${NC} (before starting services)"
echo ""
echo -e "${CYAN}Connect from your Mac via OpenClaw ACP:${NC}"
echo -e "  openclaw agents list  (should see phone as node)"
echo ""
echo -e "${GREEN}🦆 Your phone is now a Solo AI Agent!${NC}"