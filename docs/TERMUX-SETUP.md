# 📱 Termux Setup Guide

> Install and run duck-cli + OpenClaw on Android via Termux.

**v0.6.1 Note:** For a complete **Solo Agent** setup (both OpenClaw AND duck-cli together with background services), see [SUPER-AGENT-SETUP.md](SUPER-AGENT-SETUP.md). This guide covers individual installations.

## Three Options

| Option | What You Get | Complexity | Use Case |
|--------|-------------|------------|----------|
| **Option A: duck-cli on Termux** | duck-cli CLI + agent scripts | Easy | Control your phone programmatically |
| **Option B: OpenClaw-Android** | Full OpenClaw agent with gateway | Medium | Turn phone into AI assistant |
| **Option C: SOLO AGENT** | OpenClaw + duck-cli together | Medium | Full Hybrid Orchestrator on phone (see SUPER-AGENT-SETUP.md) |

---

## Option A: duck-cli on Termux

Run duck-cli on your phone to control it via scripts.

### Prerequisites

1. **Termux** from F-Droid (NOT Google Play!)
   - Download: https://f-droid.org/en/packages/com.termux/
   - Google Play version is outdated and won't work

2. **Termux:API** from F-Droid (optional but recommended)
   - Download: https://f-droid.org/en/packages/com.termux.api/
   - Enables: battery info, clipboard, notifications, etc.

### Installation

```bash
# 1. Update Termux packages
pkg update && pkg upgrade -y

# 2. Install dependencies
pkg install -y git python nodejs adb

# 3. Clone duck-cli
git clone https://github.com/Franzferdinan51/duck-cli.git ~/duck-cli

# 4. Navigate to directory
cd ~/duck-cli

# 5. Install npm packages (if needed)
npm install

# 6. Make scripts executable
chmod +x tools/*.sh
chmod +x tools/*.py

# 7. Connect ADB (phone controls itself)
#    Enable USB debugging on phone, then:
adb devices                    # Should show device
adb tcpip 5555                # Enable TCP mode
adb connect 127.0.0.1:5555   # Connect to self
```

### Usage

```bash
cd ~/duck-cli

# Run Python agent
python3 tools/android-agent-phone.py --goal "open settings"

# Run shell agent
bash tools/android-agent.sh "open settings"

# Test connection
python3 tools/android-agent-phone.py --test
```

### Setup Script (Automated)

```bash
# Run the automated setup
cd ~/duck-cli
./tools/setup-android-agent.sh --test

# Should output:
# [DuckAgent] Testing Android Agent setup...
# [DuckAgent] ✓ ADB available
# [DuckAgent] ✓ Device connected
# [DuckAgent] ✓ LM Studio connected
# [DuckAgent] ✓ Screenshot captured
# ✅ All tests passed!
```

### Configure LM Studio Connection

Edit the agent or set environment variables:

```bash
# Set LM Studio URL (Mac's IP on network)
export LM_STUDIO_URL="http://100.68.208.113:1234"
export LM_STUDIO_API_KEY="sk-lm-xWvfQHZF:L8P76SQakhEA95U8DDNf"
export LM_STUDIO_MODEL="google/gemma-4-e4b-it"

# Test connection
curl -s $LM_STUDIO_URL/v1/models \
  -H "Authorization: Bearer $LM_STUDIO_API_KEY"
```

### Troubleshooting Termux

```bash
# Storage permission (needed for some operations)
termux-setup-storage

# Fix WiFi on some devices
# Settings → Apps → Termux → Battery → Unrestricted

# Reinstall if broken
# (Uninstall, download fresh from F-Droid, reinstall)
```

---

## Option B: OpenClaw-Android (Full Installation)

Turn your Android phone into a full AI agent with OpenClaw gateway.

### What You Get

- Full OpenClaw agent running on phone
- Web UI accessible from browser
- MCP server for tool calls
- Background service (runs even when app closed)
- Access to phone sensors: camera, mic, GPS, battery, clipboard

### Prerequisites

1. **Termux** from F-Droid
   - Download: https://f-droid.org/en/packages/com.termux/

2. **Termux:API** from F-Droid
   - Download: https://f-droid.org/en/packages/com.termux.api/

⚠️ **CRITICAL:** You MUST use F-Droid versions. Google Play Termux is outdated and broken.

### Installation

```bash
# 1. Clone OpenClaw-Android setup repo
pkg install -y git
git clone https://github.com/irtiq7/OpenClaw-Android.git ~/openclaw-android-setup
cd ~/openclaw-android-setup

# 2. Make scripts executable
chmod +x *.sh

# 3. Run the setup
./setup_claw.sh
```

The setup script will:

1. **System Prep** — Installs Node.js, Git, Python, Cmake, Ninja, Build-Essentials
2. **Environment Fixes** — Configures TMPDIR/TEMP for Termux paths
3. **NDK Workaround** — Applies dummy .gyp configuration for native modules
4. **Path Patches** — Redirects `/tmp/openclaw` to Termux-accessible path
5. **Service Setup** — Configures runit service for background running

### After Setup

```bash
# 1. Run OpenClaw onboarding
openclaw onboard

# ⚠️ IMPORTANT: When asked about Daemon/System Service, say NO
# The script already handles this via termux-services

# 2. Apply environment
source ~/.bashrc

# 3. Start the service
sv up openclaw

# 4. Keep CPU awake (prevents OpenClaw from being killed)
termux-wake-lock
```

### Service Management

```bash
# Start OpenClaw
sv up openclaw

# Stop OpenClaw
sv down openclaw

# Restart OpenClaw
sv restart openclaw

# Check status
sv status openclaw

# View logs
tail -f ~/.termux/services/openclaw.log
```

### Update OpenClaw

```bash
cd ~/openclaw-android-setup

# Run update script (safely stops, updates, re-patches, restarts)
./update_claw.sh
```

### Uninstall

```bash
cd ~/openclaw-android-setup
./uninstall.sh

# Or manual:
sv down openclaw
rm -rf ~/.termux/services/openclaw
rm -rf ~/openclaw-android-setup
npm uninstall -g openclaw
```

---

## Architecture Comparison

### Option A: duck-cli on Termux (Phone-Side Agent)

```
┌──────────────────────────────────────────────────────────────┐
│  Android Phone (Termux)                                       │
│                                                               │
│  python3 android-agent-phone.py                              │
│       │                                                       │
│       ├── adb shell (local - controls phone)                │
│       └── HTTP → LM Studio on Mac                            │
│               (gemma-4-e4b-it for reasoning)                 │
└──────────────────────────────────────────────────────────────┘
       │
       │ HTTP
       ▼
┌──────────────────────────────────────────────────────────────┐
│  Mac (LM Studio server)                                      │
│  gemma-4-e4b-it running                                      │
└──────────────────────────────────────────────────────────────┘
```

**Use this when:** You want the agent to run on the phone but reasoning happens on your Mac.

### Option B: OpenClaw-Android (Full Agent on Phone)

```
┌──────────────────────────────────────────────────────────────┐
│  Android Phone (Termux)                                       │
│                                                               │
│  openclaw gateway :18789                                      │
│       │                                                       │
│       ├── 🤖 Full OpenClaw agent                             │
│       ├── 🌐 Web UI on port 3000                             │
│       ├── 🔧 MCP tools (camera, mic, GPS, etc.)              │
│       └── 📱 termux-services (background)                    │
└──────────────────────────────────────────────────────────────┘
       │
       │ ACP/MCP
       ▼
┌──────────────────────────────────────────────────────────────┐
│  Other devices (Mac/PC)                                       │
│  Can connect to phone's OpenClaw gateway                       │
│  ws://<phone-ip>:18789                                        │
└──────────────────────────────────────────────────────────────┘
```

**Use this when:** You want the phone to BE an AI assistant (like a ChatGPT app on your phone).

### Option C: Mac Controls Phone (duck-cli from Mac)

```
┌──────────────────────────────────────────────────────────────┐
│  Mac                                                          │
│  duck-cli (full)                                              │
│       │                                                       │
│       ├── LM Studio (gemma-4-e4b-it)                         │
│       └── adb connect <phone-ip>:5555                       │
└──────────────────────────────────────────────────────────────┘
       │
       │ ADB (WiFi)
       ▼
┌──────────────────────────────────────────────────────────────┐
│  Android Phone (passive - just accepts ADB commands)          │
└──────────────────────────────────────────────────────────────┘
```

**Use this when:** You want to control your phone from your Mac with a powerful local LLM.

---

## Termux Tips & Tricks

### Keep Termux Running in Background

```bash
# Install termux-services for background processes
pkg install termux-services

# Start OpenClaw as service (survives app close)
sv up openclaw

# Check service status
sv status openclaw
```

### Battery Optimization

```bash
# Disable battery optimization for Termux
# Settings → Apps → Termux → Battery → Unrestricted

# Keep CPU awake
termux-wake-lock

# Release wake lock when done
termux-wake-unlock
```

### Network Access

```bash
# Find phone's IP address
ifconfig | grep wlan

# Or use:
ip addr show wlan0

# Ping Mac to verify connectivity
ping -c 3 100.68.208.113

# Test LM Studio connection from phone
curl -s http://100.68.208.113:1234/v1/models
```

### Storage Access

```bash
# Grant storage permission (for file access)
termux-setup-storage

# Access shared storage at
~/storage/shared

# Or external SD card
~/storage/external-1
```

### Keyboard Shortcuts

```
# In Termux:
Volume Up + L      → Clear screen
Volume Up + W      → Force close current session
Volume Up + S      → Go to beginning of line
Volume Up + E      → Go to end of line
Volume Up + K      → Delete from cursor to end of line
Volume Up + C      → Send Ctrl+C
Volume Up + V      → Paste
Volume Up + N      → Next page of output
Volume Up + P      → Previous page of output
Volume Up + +      → Text size increase
Volume Up + -      → Text size decrease
```

### Extra Packages

```bash
# Useful packages for Android development
pkg install -y vim git curl wget openssh adb
pkg install -y python nodejs ruby perl php
pkg install -y clang cmake make ninja
pkg install -y termux-api  # CLI access to Termux:API features

# Use termux-api commands
termux-battery-status
termux-clipboard-get
termux-clipboard-set "Hello"
termux-notification -c "This is a notification"
termux-location
termux-vibrate
```

---

## Common Issues

### Issue: "Permission Denied" Errors

```bash
# Fix: Set correct TMPDIR for Termux
export TMPDIR=/data/data/com.termux/files/usr/tmp
export TEMP=$TMPDIR
export TMP=$TMPDIR

# Or add to ~/.bashrc
echo 'export TMPDIR=$PREFIX/tmp' >> ~/.bashrc
```

### Issue: LM Studio Connection Refused

```bash
# On Mac, check LM Studio is running
# Look for "Server running on http://localhost:1234"

# Check firewall
# macOS: System Settings → Firewall → Allow LM Studio

# From phone, test:
curl -v http://100.68.208.113:1234/v1/models

# If timeout, LM Studio might need --network sharing enabled
# In LM Studio: Settings → Server → Allow CORS → Enable
```

### Issue: ADB Connection Drops

```bash
# Keep ADB running
adb tcpip 5555

# Reconnect
adb connect <phone-ip>:5555

# Or use USB (more stable)
# Enable USB debugging, connect USB cable
```

### Issue: OpenClaw Service Won't Start

```bash
# Check logs
logcat | grep openclaw

# Or:
cat ~/.termux/services/openclaw.log

# Reinstall service
sv down openclaw
cd ~/openclaw-android-setup
./setup_claw.sh
```

### Issue: Termux App Freezes

```bash
# Force stop
# Settings → Apps → Termux → Force Stop

# Or use:
am force-stop com.termux

# Reopen Termux
```

---

## Security Notes

### What to be aware of:

1. **ADB debugging** — Anyone with physical access can control your phone
   - Disable USB debugging when not in use
   - Revoke USB debugging authorizations: Settings → Developer Options → Revoke USB debug authorizations

2. **Termux SuperUser** — Don't grant su to untrusted scripts

3. **Network access** — Phone is accessible over WiFi
   - Use on trusted networks only
   - Consider firewall rules

4. **API keys in env vars** — Anyone with Termux access can read them
   - Don't store production API keys on phone
   - Use read-only tokens when possible

---

## Resources

- **OpenClaw-Android GitHub:** https://github.com/irtiq7/OpenClaw-Android
- **Termux:** https://termux.com/
- **F-Droid Termux:** https://f-droid.org/en/packages/com.termux/
- **Termux:API:** https://f-droid.org/en/packages/com.termux.api/
- **duck-cli GitHub:** https://github.com/Franzferdinan51/duck-cli

---

## Automated Setup with Bootstrap Script

The easiest way to install duck-cli on Termux is using the bootstrap script. This handles everything in one step.

### One-Line Install (in Termux)

```bash
curl -fsSL https://raw.githubusercontent.com/Franzferdinan51/duck-cli/main/tools/termux-bootstrap.sh | bash
```

Or if you prefer to copy the file manually:

```bash
# On Mac: copy bootstrap script to phone
adb push tools/termux-bootstrap.sh /sdcard/Download/

# In Termux:
bash ~/storage/shared/termux-bootstrap.sh
```

### What the Bootstrap Script Does

1. **Installs dependencies** — `nodejs`, `git`, `rsync`, `openssh`
2. **Clones duck-cli** from GitHub (or updates if already cloned)
3. **Builds the TypeScript source** — `npm install && npm run build`
4. **Creates `~/bin/duck`** wrapper that auto-loads `.env`
5. **Installs MCP auto-start** in `~/.termux/boot/termux-mcp-server.sh`
6. **Generates `.env`** from `.env.example` with guidance

### After Bootstrap

```bash
source ~/.bashrc           # Reload PATH
duck run "Say hello"      # First run
```

### MCP Server Management

The bootstrap installs `tools/termux-mcp-server.sh` which handles the MCP server:

```bash
# From ~/duck-cli directory:
bash tools/termux-mcp-server.sh start    # Start daemon
bash tools/termux-mcp-server.sh status   # Check running?
bash tools/termux-mcp-server.sh logs     # View logs
bash tools/termux-mcp-server.sh stop      # Stop daemon
bash tools/termux-mcp-server.sh run       # Run in foreground (stdio mode)
```

Or use `duck mcp` directly:

```bash
duck mcp          # Start MCP server (HTTP, default port 3850)
duck mcp --stdio  # Start MCP server with stdio transport
duck mcp 4000     # Start on custom port
```

### MCP Server Auto-Start

The bootstrap script installs `~/.termux/boot/termux-mcp-server.sh` which starts the MCP server automatically every time Termux boots. This uses termux-services (runit).

To enable:
```bash
pkg install termux-services
sv up termux-mcp-server  # Start now
```

## Go Binary: duck (Native Executable)

A pre-built Go binary (`duck`) is available in `/data/local/tmp/duck` on your phone. This is pushed from your Mac using `duck android push`. It wraps the Node.js TypeScript CLI.

**Important:** The Go binary requires Node.js to be installed in Termux. Use the bootstrap script above to install Node.js.

```bash
# The Go binary delegates to the Node.js CLI
/data/local/tmp/duck mcp --stdio
```

## Environment Variables (IMPORTANT)

**⚠️ NEVER commit `.env` to GitHub!** The `.env` file contains sensitive tokens.

The `.gitignore` already excludes `.env`. If you have a `.env` on your phone, it will not be pushed to GitHub.

Required variables in `~/duck-cli/.env`:

```bash
# Required
MINIMAX_API_KEY=your_minimax_api_key

# Optional: Telegram (if using the Telegram channel)
TELEGRAM_BOT_TOKEN=123456:ABC-DEF
TELEGRAM_CHAT_ID=588090613

# Optional: LM Studio (local AI on your Mac)
LM_STUDIO_URL=http://100.68.208.113:1234
LM_STUDIO_KEY=sk-lm-xxx
LM_STUDIO_MODEL=google/gemma-4-e4b-it

# Optional: OpenClaw gateway
OPENCLAW_GATEWAY=ws://localhost:18789
OPENCLAW_GATEWAY_HTTP=http://localhost:18789

# Optional: MCP
MCP_SERVER_PORT=3850
```

## Quick Reference Card

```
╔════════════════════════════════════════════════════════════════╗
║              TERMUX + duck-cli QUICK REFERENCE                 ║
╠════════════════════════════════════════════════════════════════╣
║                                                                ║
║  ONE-LINE INSTALL (in Termux):                                 ║
║  curl -fsSL .../termux-bootstrap.sh | bash                     ║
║                                                                ║
║  MANUAL INSTALL:                                               ║
║  pkg update && pkg install -y nodejs git                       ║
║  git clone https://github.com/Franzferdinan51/duck-cli.git    ║
║  cd duck-cli && npm install && npm run build                   ║
║                                                                ║
║  DUCK LAUNCHER:                                                ║
║  ~/bin/duck run "Say hello"   # Run a task                     ║
║  ~/bin/duck mcp --stdio       # MCP server (stdio)            ║
║  ~/bin/duck mcp               # MCP server (HTTP port 3850)   ║
║  ~/bin/duck status            # Check status                   ║
║                                                                ║
║  MCP SERVER:                                                   ║
║  bash tools/termux-mcp-server.sh start  # Daemon               ║
║  bash tools/termux-mcp-server.sh run    # Foreground           ║
║                                                                ║
║  CONNECT MAC LM STUDIO:                                        ║
║  export LM_STUDIO_URL="http://100.68.208.113:1234"             ║
║  export LM_STUDIO_KEY="sk-lm-xxx"                              ║
║  export LM_STUDIO_MODEL="google/gemma-4-e4b-it"                ║
║                                                                ║
║  OPENCLAW GATEWAY:                                             ║
║  openclaw gateway start                                        ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝
```
