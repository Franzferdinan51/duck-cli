# 🤖 Android Agent

> Complete guide to controlling Android devices with duck-cli using AI-powered reasoning via Gemma 4.

## Overview

The Android Agent is a **Perceive → Reason → Act** loop that:
1. Captures the phone's screen state (screenshot + UI hierarchy)
2. Sends it to an LLM for reasoning (Gemma 4 `gemma-4-e4b-it` preferred)
3. Executes the decided action (tap/type/swipe/launch)
4. Repeats up to 30 times until goal is complete

```
┌─────────────────────────────────────────────────────────────┐
│                   ANDROID AGENT LOOP                         │
│                                                              │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐  │
│  │ PERCEIVE │───▶│ REASON  │───▶│   ACT   │───▶│ PERCEIVE│  │
│  │          │    │ (LLM)   │    │  (ADB)  │    │  again  │  │
│  └─────────┘    └─────────┘    └─────────┘    └─────────┘  │
│       │                                                   │
│       │  screenshot + UI.xml + foreground app            │
│       ▼                                                   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  LLM: gemma-4-e4b-it via LM Studio                  │   │
│  │  Prompt: "Goal: X, Screen: Y, What should I do?"  │   │
│  │  Response: {"think": "...", "action": "tap 360 720"}│   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Architecture Options

### Option 1: Mac Controls Phone (ADB)

```
┌──────────────────────────────────────────────────────────────┐
│  Mac                                                          │
│  duck-cli + LM Studio (gemma-4-e4b-it)                        │
│       │                                                       │
│       │ adb shell input tap 360 720                          │
│       │ adb shell screencap -p /sdcard/screen.png            │
│       ▼                                                       │
└──────────────────────────────────────────────────────────────┘
       │ USB/WiFi
       ▼
┌──────────────────────────────────────────────────────────────┐
│  Android Phone (passive — just accepts ADB commands)         │
└──────────────────────────────────────────────────────────────┘
```

**Use when:** You want to control your phone from your Mac using a powerful local LLM.

### Option 2: Phone Runs Agent (Termux)

```
┌──────────────────────────────────────────────────────────────┐
│  Android Phone (Termux)                                       │
│  python3 android-agent-phone.py --goal "open settings"        │
│       │                                                       │
│       │ adb shell (local)                                     │
│       │ HTTP → Mac LM Studio                                  │
│       ▼                                                       │
└──────────────────────────────────────────────────────────────┘
       │ HTTP
       ▼
┌──────────────────────────────────────────────────────────────┐
│  Mac (LM Studio server)                                       │
│  gemma-4-e4b-it                                               │
└──────────────────────────────────────────────────────────────┘
```

**Use when:** You want the agent to run entirely on your phone (turn old phone into AI robot).

## Prerequisites

### For Both Options
1. **Android device** with USB debugging enabled:
   - Settings → About Phone → tap "Build Number" 7 times
   - Settings → System → Developer Options → USB Debugging ON
   - Connect via USB and approve RSA key

2. **ADB installed on control machine:**
   ```bash
   # macOS
   brew install android-platform-tools
   
   # Linux
   sudo apt install adb
   
   # Termux (on phone)
   pkg install adb
   ```

### For Option 1 (Mac Controls)
3. **LM Studio running on Mac** with `gemma-4-e4b-it`:
   ```bash
   # Install LM Studio
   # Download from https://lmstudio.ai
   # Load model: google/gemma-4-e4b-it
   # Server on: http://localhost:1234
   ```

### For Option 2 (Phone Runs Agent)
3. **Termux + Termux:API** (from F-Droid only!):
   ```bash
   # Download from https://f-droid.org/
   # Both Termux AND Termux:API apps required
   ```

4. **LM Studio running on Mac** (reachable from phone):
   ```bash
   # Must be on same network or accessible IP
   # Default: http://100.68.208.113:1234
   ```

## Quick Start

### Mac Controls Phone

```bash
# 1. Verify ADB connection
adb devices

# 2. Test with duck-cli
duck android devices

# 3. Give it a goal!
duck android goal "open settings and turn on dark mode"
```

### Phone Runs Agent (Termux)

```bash
# On phone in Termux
cd ~/duck-cli
python3 tools/android-agent-phone.py --goal "open settings"

# Or use the shell version
bash tools/android-agent.sh "open settings"
```

## Commands Reference

### Connection Management

```bash
duck android devices              # List connected devices
duck android connect <serial>    # Connect to specific device
duck android disconnect           # Disconnect current device
```

### Screen Operations

```bash
# Capture screenshot
duck android screenshot                        # Saves to /tmp/screen.png
duck android screenshot /path/to/save.png      # Custom path

# Dump UI hierarchy (for finding elements)
duck android dump                              # Saves to /tmp/ui.xml
duck android dump > elements.txt               # View immediately

# Read text from screen (requires OCR or AI)
duck android screen                           # Uses aipCapture or screencap

# AI analysis (sends screenshot + UI to LLM)
duck android analyze                          # Returns AI analysis
```

### Interactions

```bash
# Tap at coordinates
duck android tap 360 720                      # Tap center of screen
duck android tap 100 200                      # Tap specific point

# Type text
duck android type "hello world"              # Types text (no special chars)
duck android type "https://example.com"       # URL

# Press keys
duck android key back                        # Back button
duck android key home                        # Home button
duck android key enter                       # Enter/Return
duck android key recent                      # Recent apps
duck android key power                       # Power button

# Swipe gestures
duck android swipe up                        # Swipe up
duck android swipe down                      # Swipe down
duck android swipe left                      # Swipe left
duck android swipe right                     # Swipe right

# App control
duck android launch com.android.settings     # Launch app by package
duck android kill com.android.settings       # Force-stop app
duck android foreground                      # Current app package
duck android packages                        # List installed packages
```

### Termux API (requires Termux:API app)

```bash
duck android termux battery                  # Battery status
duck android termux battery set <n>          # Set battery level
duck android termux clip-get                 # Get clipboard
duck android termux clip-set "text"         # Set clipboard
duck android termux notif                    # Recent notifications
duck android termux location                 # GPS coordinates
duck android termux sensors                 # Sensor list
duck android termux toast "message"         # Show toast
duck android termux vibrate                  # Vibrate
```

### AI Goal Mode

```bash
# The main agent loop — Perceive → Reason → Act (up to 30 times)
duck android goal "send a message on WhatsApp"

# Uses environment variables for LLM config:
#   LLM_PROVIDER=lmstudio
#   LLM_MODEL=google/gemma-4-e4b-it
#   LLM_BASE_URL=http://100.68.208.113:1234
#   LLM_API_KEY=sk-lm-xWvfQHZF:L8P76SQakhEA95U8DDNf
```

## Finding Elements

The most reliable way to interact with UI is using the **UI hierarchy dump** to find element coordinates:

```bash
# 1. Dump the current UI
duck android dump > /tmp/ui.xml

# 2. Find your element
grep "text=\"Settings\"" /tmp/ui.xml
# Output: <node text="Settings" bounds="[0,84][720,168]" clickable="true" .../>

# 3. Calculate center: x=(0+720)/2=360, y=(84+168)/2=126
duck android tap 360 126
```

### Element Discovery Patterns

```bash
# Find clickable elements
grep 'clickable="true"' /tmp/ui.xml | head -20

# Find by package
grep 'package="com.android.settings"' /tmp/ui.xml

# Find edit fields
grep 'class="android.widget.EditText"' /tmp/ui.xml

# Find buttons with text
grep -E 'text="[A-Z].*"' /tmp/ui.xml | head -10

# Find by content description
grep 'content-desc="Settings"' /tmp/ui.xml
```

## Python Script Usage (Phone-Side Agent)

The Python script `tools/android-agent-phone.py` runs **on the phone** in Termux:

```bash
# Basic usage
python3 tools/android-agent-phone.py --goal "open settings"

# With device serial
python3 tools/android-agent-phone.py --goal "open WhatsApp" --serial R52T509H1YL

# Test mode (checks everything works)
python3 tools/android-agent-phone.py --test

# Interactive mode
python3 tools/android-agent-phone.py --interactive
```

### Environment Variables

```bash
# LM Studio connection (default values shown)
export LM_STUDIO_URL="http://100.68.208.113:1234"
export LM_STUDIO_API_KEY="sk-lm-xWvfQHZF:L8P76SQakhEA95U8DDNf"
export LM_STUDIO_MODEL="google/gemma-4-e4b-it"
export MAX_STEPS=30
```

## Workflow Examples

### Example 1: Open Settings and Toggle Dark Mode

```bash
# Option A: AI goal (Gemma 4 figures it out)
duck android goal "open settings and turn on dark mode"

# Option B: Manual steps
duck android launch com.android.settings
sleep 2
duck android dump > /tmp/ui.xml
duck android tap 360 126  # Tap "Display" (found from dump)
sleep 1
duck android tap 360 200  # Tap "Dark theme"
```

### Example 2: Send WhatsApp Message

```bash
# AI does it all
duck android goal "send a message to John saying 'Running late' on WhatsApp"

# Or manual
duck android launch com.whatsapp
sleep 3
duck android tap 360 200  # Tap chat
sleep 2
duck android tap 360 720  # Tap message field
duck android type "Running late"
duck android key enter
```

### Example 3: Grow Monitoring (Plant Care)

```bash
# Capture grow tent photo
duck android launch com.motorola.camera5
sleep 2
duck android tap 360 1353  # Camera shutter
sleep 3

# Pull photo to Mac
adb pull /sdcard/DCIM/Camera/latest.jpg /tmp/grow-photo.jpg

# Analyze with vision AI
duck android analyze  # → sends to kimi-k2.5 for analysis
```

### Example 4: Phone Automation Script

```bash
#!/bin/bash
# automate.sh — Example automation script

set -e

GOAL="$1"
[ -z "$GOAL" ] && echo "Usage: $0 <goal>" && exit 1

echo "🦆 Duck CLI Android Agent"
echo "Goal: $GOAL"
echo ""

# Verify connection
duck android devices || { echo "No devices!"; exit 1; }

# Execute
duck android goal "$GOAL"

echo ""
echo "✅ Done!"
```

## LM Studio Configuration

### Why Gemma 4 for Android?

**`gemma-4-e4b-it` is specifically trained for Android development!**

- Trained on Android Studio Agent Mode code
- Has vision + autonomous tool-calling built in
- 4B params = fast inference, runs on Mac mini
- 262K context window = handles long UI dumps

### Setup LM Studio

```bash
# 1. Download LM Studio from https://lmstudio.ai

# 2. Download the model:
#    - Search: "google/gemma-4-e4b-it"
#    - Or use LM Studio CLI:
lmstudio pull google/gemma-4-e4b-it

# 3. Start local server:
lmstudio server

# 4. Verify:
curl http://localhost:1234/v1/models
```

### Alternative: Remote LM Studio (LM Link)

If LM Studio runs on another machine:

```bash
# Connect to remote GPU server
export LM_STUDIO_URL="http://100.68.208.113:1234"
export LM_STUDIO_API_KEY="sk-lm-xWvfQHZF:L8P76SQakhEA95U8DDNf"
```

## Troubleshooting

### Device Not Found
```bash
# Restart ADB server
adb kill-server
adb start-server

# Check devices
adb devices -l

# If WiFi mode failed, switch back to USB:
adb usb
```

### Tap Misses Element
```bash
# Always use UI dump first to get accurate coordinates!
duck android dump > /tmp/ui.xml

# Find the element
grep 'text="Target Button"' /tmp/ui.xml
# Bounds: [2274,1296][2416,1364]
# Center: x=(2274+2416)/2=2345, y=(1296+1364)/2=1330

duck android tap 2345 1330
```

### LM Studio Not Responding
```bash
# Test connection
curl http://100.68.208.113:1234/v1/models \
  -H "Authorization: Bearer sk-lm-xWvfQHZF:L8P76SQakhEA95U8DDNf"

# Check LM Studio is running
# Look for "Server running on http://localhost:1234"
```

### Termux API Not Working
```bash
# MUST use F-Droid version of Termux + Termux:API
# Google Play versions are outdated and broken

# Reinstall from F-Droid:
# 1. Uninstall Termux + Termux:API
# 2. Download from https://f-droid.org/
# 3. Install both APKs
```

### Goal Never Completes
```bash
# Check for stuck loop — agent retries different approaches
# Max 30 steps, then exits with warning

# Try more specific goals:
duck android goal "tap the search bar"       # ✅ specific
duck android goal "find information"         # ❌ vague

# Help the agent by being precise about:
# - Which app
# - What element to find
# - What action to take
```

## Files Reference

| File | Purpose | Runs On |
|------|---------|---------|
| `tools/android-agent.sh` | Shell-based agent | Mac |
| `tools/android-agent-phone.py` | Python agent | Phone (Termux) |
| `tools/setup-android-agent.sh` | Setup + test script | Mac |
| `src/android-automation.ts` | 25+ automation tools | duck-cli |
| `src/android-vision.ts` | AI screen analysis | duck-cli |
| `skills/android/SKILL.md` | Skill documentation | duck-cli |

## Advanced: Custom LLM Provider

The agent supports multiple LLM backends:

```bash
# LM Studio (OpenAI-compatible)
export LLM_PROVIDER=lmstudio
export LLM_BASE_URL=http://100.68.208.113:1234
export LLM_MODEL=google/gemma-4-e4b-it
export LLM_API_KEY=sk-lm-xxx

# Ollama
export LLM_PROVIDER=ollama
export LLM_BASE_URL=http://localhost:11434
export LLM_MODEL=llama3

# OpenAI
export LLM_PROVIDER=openai
export LLM_API_KEY=sk-xxx
export LLM_MODEL=gpt-4o

# Groq
export LLM_PROVIDER=groq
export LLM_API_KEY=gsk_xxx
export LLM_MODEL=llama3-70b-8192
```
