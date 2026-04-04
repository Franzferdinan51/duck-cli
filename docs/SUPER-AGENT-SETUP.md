# 🦆 Duck-CLI Super Agent Setup

> **Complete setup guide for running OpenClaw + duck-cli as a Solo AI Agent on Android Termux.**

**Last Updated:** v0.6.1 — April 4, 2026

---

## What Is This?

A **Solo AI Agent** running entirely on your Android phone via Termux — no Mac/PC required for execution. The phone connects to your Mac's LM Studio for AI inference and OpenClaw gateway for additional capabilities.

```
┌─────────────────────────────────────────────────────────────┐
│  YOUR ANDROID PHONE (Solo Agent)                           │
│                                                             │
│  Termux                                                     │
│  ├── openclaw gateway  :18789  (AI gateway)               │
│  ├── duck-cli shell      (Hybrid Orchestrator)             │
│  │   ├── Task Complexity Classifier                        │
│  │   ├── Model Router (Gemma 4 → Kimi → MiniMax)          │
│  │   ├── AI Council Bridge                                 │
│  │   └── Tool Registry                                     │
│  └── termux-services    (background, survives app close)   │
└─────────────────────────────────────────────────────────────┘
         │                        │
         │ HTTP/LM Studio         │ ACP/WebSocket
         ▼                        ▼
┌──────────────────────┐  ┌──────────────────────────────┐
│  Mac (LM Studio)      │  │  Mac (OpenClaw Gateway)     │
│  gemma-4-e4b-it       │  │  ws://100.68.208.113:18789  │
│  kimi-k2.5            │  │                              │
│  qwen3.5-27b          │  │  duck-cli main agent        │
└──────────────────────┘  └──────────────────────────────┘
```

---

## Architecture Overview

### How It Works

1. **Phone runs duck-cli** in solo agent mode (`--agent` flag)
2. **Hybrid Orchestrator** scores task complexity (1-10)
3. **Model Router** selects the best available model
4. **AI Council** deliberates on complex tasks (complexity 7+)
5. **Tool Registry** executes via ADB, shell, or native APIs
6. **Phone uses Mac's LM Studio** for AI inference (HTTP)

### Solo Agent vs. Controlled Agent

| Mode | Where duck-cli runs | Who controls who |
|------|---------------------|------------------|
| **Solo Agent** (this guide) | On the phone itself | Phone is autonomous |
| **Controlled Agent** | On Mac, controls phone via ADB | Mac is the brain |

**Solo Agent** = Your phone IS the AI agent, running 24/7 as a background service.

---

## Prerequisites

### Required

1. **Android phone** (7.0+ recommended)
2. **Termux** from F-Droid — **CRITICAL: NOT Google Play!**
   - Download: https://f-droid.org/en/packages/com.termux/
   - Google Play version is outdated and broken
3. **Termux:API** from F-Droid (for battery, clipboard, etc.)
   - Download: https://f-droid.org/en/packages/com.termux.api/
4. **WiFi network** (phone and Mac on same network)

### Your Mac Setup (Already Done)

- LM Studio running at `http://100.68.208.113:1234`
- OpenClaw Gateway at `ws://100.68.208.113:18789`
- Models available: gemma-4-e4b-it, qwen3.5-27b, etc.

---

## One-Command Installation

Paste this entire block into Termux:

```bash
curl -sL https://raw.githubusercontent.com/Franzferdinan51/duck-cli/main/duck-cli-super-agent-setup.sh | bash
```

The script will:
1. Update Termux packages
2. Install Node.js, Git, Python, build tools, termux-api
3. Install OpenClaw globally
4. Clone and build duck-cli
5. Patch OpenClaw paths for Android
6. Create `start-duck.sh` launch script
7. Set up `sv up openclaw` and `sv up duck` background services

**Runtime:** 5-15 minutes depending on network speed.

---

## Manual Installation (Step-by-Step)

If the one-command script fails, follow these steps:

### Step 1: Update Termux

```bash
pkg update && pkg upgrade -y
pkg install -y nodejs-lts git build-essential python cmake clang ninja \
  pkg-config binutils termux-api termux-services proot tmux nano
```

### Step 2: Configure Paths

```bash
mkdir -p "$PREFIX/tmp"
mkdir -p "$HOME/tmp"

cat >> ~/.bashrc << 'EOF'
export TMPDIR="$PREFIX/tmp"
export TMP="$PREFIX/tmp"
export TEMP="$PREFIX/tmp"
export SVDIR="$PREFIX/var/service"
EOF

export TMPDIR="$PREFIX/tmp"
export TMP="$PREFIX/tmp"
export TEMP="$PREFIX/tmp"
```

### Step 3: Fix Node-GYP for Android NDK

```bash
mkdir -p ~/.gyp
echo "{'variables':{'android_ndk_path':''}}" > ~/.gyp/include.gypi
```

### Step 4: Install OpenClaw

```bash
npm install -g openclaw@latest
```

### Step 5: Install duck-cli

```bash
# Clone
git clone https://github.com/Franzferdinan51/duck-cli.git ~/duck-cli
cd ~/duck-cli

# Build
npm install
npm run build

# Configure
cat > .env << 'EOF'
OPENCLAW_GATEWAY=ws://100.68.208.113:18789
LM_STUDIO_URL=http://100.68.208.113:1234
LM_STUDIO_KEY=sk-lm-xWvfQHZF:L8P76SQakhEA95U8DDNf
GEMMA_MODEL=google/gemma-4-e4b-it
PHONE_MODE=true
EOF
```

### Step 6: Create Launch Script

```bash
cat > ~/start-duck.sh << 'EOF'
#!/data/data/com.termux/files/usr/bin/bash
export HOME=/data/data/com.termux/files/home
export TERMUX_VERSION=1
export TMPDIR=$PREFIX/tmp
export TMP=$PREFIX/tmp
export TEMP=$PREFIX/tmp

cd ~/duck-cli
source .env 2>/dev/null || true
node dist/cli/main.js shell --agent
EOF
chmod +x ~/start-duck.sh
```

### Step 7: Patch OpenClaw Paths

```bash
TARGET_FILE="$PREFIX/lib/node_modules/openclaw/dist/entry.js"
if [ -f "$TARGET_FILE" ]; then
    sed -i "s|/tmp/openclaw|$PREFIX/tmp/openclaw|g" "$TARGET_FILE"
    echo "OpenClaw patched"
fi
```

### Step 8: Setup Background Services

```bash
# OpenClaw Service
SERVICE_DIR="$PREFIX/var/service/openclaw"
LOG_DIR="$PREFIX/var/log/openclaw"
mkdir -p "$SERVICE_DIR/log"
mkdir -p "$LOG_DIR"

cat > "$SERVICE_DIR/run" << 'EOF'
#!/data/data/com.termux/files/usr/bin/sh
export PATH=$PREFIX/bin:$PATH
export TMPDIR=$PREFIX/tmp
exec openclaw gateway 2>&1
EOF

cat > "$SERVICE_DIR/log/run" << 'EOF'
#!/data/data/com.termux/files/usr/bin/sh
exec svlogd -tt $LOG_DIR
EOF

chmod +x "$SERVICE_DIR/run"
chmod +x "$SERVICE_DIR/log/run"

# duck-cli Service
DUCK_SERVICE_DIR="$PREFIX/var/service/duck"
DUCK_LOG_DIR="$PREFIX/var/log/duck"
mkdir -p "$DUCK_SERVICE_DIR/log"
mkdir -p "$DUCK_LOG_DIR"

cat > "$DUCK_SERVICE_DIR/run" << 'EOF'
#!/data/data/com.termux/files/usr/bin/sh
export HOME=/data/data/com.termux/files/home
export TERMUX_VERSION=1
export TMPDIR=$PREFIX/tmp
export TMP=$PREFIX/tmp
export TEMP=$PREFIX/tmp
export PATH=$PREFIX/bin:$PATH
cd ~/duck-cli
source .env 2>/dev/null || true
exec node dist/cli/main.js shell --agent 2>&1
EOF

cat > "$DUCK_SERVICE_DIR/log/run" << 'EOF'
#!/data/data/com.termux/files/usr/bin/sh
exec svlogd -tt $DUCK_LOG_DIR
EOF

chmod +x "$DUCK_SERVICE_DIR/run"
chmod +x "$DUCK_SERVICE_DIR/log/run"

# Enable services
service-daemon start 2>/dev/null || true
sv-enable openclaw 2>/dev/null || true
sv-enable duck 2>/dev/null || true
```

---

## Service Management

### Start/Stop Services

```bash
# Start services
sv up openclaw   # OpenClaw gateway
sv up duck       # duck-cli agent

# Stop services
sv down openclaw
sv down duck

# Restart
sv restart openclaw
sv restart duck

# Check status
sv status openclaw
sv status duck
```

### View Logs

```bash
# Real-time logs
tail -f ~/openclaw/logs/openclaw.log
tail -f ~/duck/logs/duck.log

# Last 50 lines
tail -50 ~/openclaw/logs/openclaw.log
```

### Keep Phone Awake

To prevent Android from killing Termux services:

```bash
termux-wake-lock   # Keep CPU awake
termux-wake-unlock # Release when done
```

Also set: **Settings → Apps → Termux → Battery → Unrestricted**

---

## Configuration

### Configure Script

```bash
# Interactive configuration
bash ~/configure-agent.sh
```

This will prompt for:
- Your Mac's IP address
- OpenClaw Gateway port
- LM Studio URL

### Manual Configuration

Edit `~/duck-cli/.env`:

```bash
cd ~/duck-cli
nano .env
```

```env
# Mac connection
OPENCLAW_GATEWAY=ws://100.68.208.113:18789
LM_STUDIO_URL=http://100.68.208.113:1234
LM_STUDIO_KEY=sk-lm-xWvfQHZF:L8P76SQakhEA95U8DDNf
GEMMA_MODEL=google/gemma-4-e4b-it

# Agent mode
PHONE_MODE=true
```

### Find Your Mac's IP

On your Mac terminal:
```bash
ipconfig getifaddr en0   # For ethernet/WiFi
# Or
ifconfig | grep "inet " | grep -v 127.0.0.1
```

---

## Quick Commands

### Start duck-cli Manually

```bash
bash ~/start-duck.sh
```

### Test Connection to Mac

```bash
# Test LM Studio
curl -s http://100.68.208.113:1234/v1/models \
  -H "Authorization: Bearer sk-lm-xWvfQHZF:L8P76SQakhEA95U8DDNf"

# Test OpenClaw Gateway
curl -s http://100.68.208.113:18789/health 2>/dev/null || echo "Gateway check"
```

### Test Phone Sensors

```bash
# Battery
termux-battery-status

# Clipboard
termux-clipboard-get
termux-clipboard-set "Hello from Termux!"

# Notifications
termux-notification -c "Duck-CLI is running!"

# Location
termux-location
```

### Control Phone from Itself

```bash
# Take screenshot
 screencap /sdcard/screen.png

# View UI hierarchy
uiautomator dump /sdcard/view.xml
cat /sdcard/view.xml

# Tap
input tap 360 720

# Type
input text "Hello"

# Swipe
input swipe 360 720 360 300 500
```

---

## Solo Agent Mode: How It Works

When running in solo agent mode, duck-cli on the phone:

```
User message → Hybrid Orchestrator → Complexity Score → Decision
                                                           │
                                          ┌────────────────┴────────────────┐
                                          │                                 │
                                    Complexity < 7                    Complexity >= 7
                                          │                                 │
                                          ▼                                 ▼
                               Direct model routing              AI Council deliberation
                               (Gemma 4 for Android,                         │
                                Kimi for vision, etc.)                       │
                                          │                                 │
                                          └────────────┬────────────────────┘
                                                       │
                                                       ▼
                                              Tool Registry
                                                       │
                               ┌────────────────────────┼────────────────────────┐
                               │                        │                        │
                               ▼                        ▼                        ▼
                         ADB/Shell              Termux API              LM Studio HTTP
                      (local control)          (sensors/etc)           (AI inference)
```

### Example: Phone Controls Itself

**User on Telegram:** "Open camera and take a photo"

**Phone (solo agent) processes:**
1. Orchestrator scores complexity = 3 (simple)
2. Fast path: direct execution
3. ADB command: `input tap 360 720` (camera app button)
4. ADB command: `screencap /sdcard/photo.png`
5. Send photo back to user

---

## Solo Agent Use Cases

### 24/7 Phone Automation

```
┌─────────────────────────────────────────────────────────────┐
│  Phone runs duck-cli as background service                 │
│                                                             │
│  • Morning briefing (weather, calendar, news)               │
│  • Automated plant monitoring (camera + AC Infinity)        │
│  • SMS auto-responses while driving                         │
│  • Location-based reminders                                 │
│  • Smart home control via termux+ADB                       │
└─────────────────────────────────────────────────────────────┘
```

### Remote Eyes & Ears

- Access phone camera remotely
- Use phone as security camera
- Stream location data
- Run speech synthesis aloud

### Autonomous Task Execution

- Background cron jobs running on phone
- Periodic data collection (sensors, photos)
- Proactive notifications based on conditions

---

## Troubleshooting

### Service Won't Start

```bash
# Check what's wrong
sv logs openclaw
sv logs duck

# Common fixes:
# 1. Restart service daemon
service-daemon stop
service-daemon start

# 2. Check file permissions
chmod +x ~/start-duck.sh
ls -la ~/duck-cli/dist/cli/main.js

# 3. Verify Node works
node --version
node ~/duck-cli/dist/cli/main.js --version
```

### LM Studio Connection Refused

```bash
# On Mac: ensure LM Studio is running
# Look for "Server running on http://localhost:1234"

# On phone: test connection
curl -v http://100.68.208.113:1234/v1/models

# If timeout: Mac firewall might be blocking
# macOS: System Settings → Firewall → Allow LM Studio
```

### OpenClaw Gateway Issues

```bash
# Check gateway is running on Mac
curl http://100.68.208.113:18789/health

# If phone can't connect:
# 1. Check Mac's firewall
# 2. Ensure OpenClaw is binding to network interface
# 3. Try WebSocket URL instead of HTTP
```

### Permission Denied Errors

```bash
# Ensure TMPDIR is set correctly
export TMPDIR="$PREFIX/tmp"

# Grant storage permission
termux-setup-storage

# Check termux-services directory
ls -la "$PREFIX/var/service/"
```

### Termux App Freezes

```bash
# Force stop
am force-stop com.termux

# Reinstall (backup first!)
# Settings → Apps → Termux → Uninstall
# Download fresh from F-Droid
# Re-run setup
```

---

## Updating

### Update duck-cli

```bash
cd ~/duck-cli
git pull
npm install
npm run build
sv restart duck
```

### Update OpenClaw

```bash
npm update -g openclaw
sv restart openclaw
```

---

## Uninstall

```bash
# Stop services
sv down openclaw
sv down duck

# Remove services
rm -rf "$PREFIX/var/service/openclaw"
rm -rf "$PREFIX/var/service/duck"

# Remove files
rm -rf ~/duck-cli
rm -f ~/start-duck.sh
rm -f ~/configure-agent.sh

# Remove OpenClaw
npm uninstall -g openclaw
```

---

## Quick Reference Card

```
╔════════════════════════════════════════════════════════════════╗
║         🦆 SOLO AGENT QUICK REFERENCE                        ║
╠════════════════════════════════════════════════════════════════╣
║                                                                ║
║  INSTALL:                                                      ║
║  curl -sL <setup-url> | bash                                  ║
║                                                                ║
║  START:                                                        ║
║  bash ~/start-duck.sh                                          ║
║  sv up openclaw && sv up duck                                  ║
║                                                                ║
║  SERVICES:                                                     ║
║  sv up|down|restart|status openclaw                           ║
║  sv up|down|restart|status duck                              ║
║                                                                ║
║  LOGS:                                                        ║
║  tail -f ~/openclaw/logs/openclaw.log                        ║
║  tail -f ~/duck/logs/duck.log                                ║
║                                                                ║
║  CONFIGURE:                                                   ║
║  bash ~/configure-agent.sh                                     ║
║                                                                ║
║  KEEP AWAKE:                                                   ║
║  termux-wake-lock                                             ║
║                                                                ║
║  TEST CONNECTION:                                              ║
║  curl http://100.68.208.113:1234/v1/models                    ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝
```

---

## Resources

- **duck-cli Repo:** https://github.com/Franzferdinan51/duck-cli
- **OpenClaw-Android:** https://github.com/irtiq7/OpenClaw-Android
- **Termux:** https://termux.com/
- **F-Droid Termux:** https://f-droid.org/en/packages/com.termux/
- **LM Studio:** https://lmstudio.ai/

---

**🦆 Your phone is now a Solo AI Agent!**
