# 🦆 duck-cli

> **Unified Super Agent** — Local AI + Android Control via ADB + OpenClaw Bridge + Orchestrator Core v2

[![GitHub](https://img.shields.io/github/stars/Franzferdinan51/duck-cli?style=social)](https://github.com/Franzferdinan51/duck-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)
[![Go](https://img.shields.io/badge/Go-1.21+-blue.svg)](https://go.dev/)

---

## 🎯 What is duck-cli?

**duck-cli** is a unified AI agent CLI that runs on Mac/Linux/Windows and controls Android devices via ADB, connects to OpenClaw gateway for ACP/MCP, and uses a smart **Orchestrator Core v2** to route tasks to the best available tool with automatic fallback.

Think of it as your AI-powered Android automation hub — with local LLM reasoning (Gemma 4 via LM Studio), multi-protocol bridges (ACP/MCP/WebSocket), and 40+ built-in tools.

```
┌──────────────────────────────────────────────────────────────┐
│                        duck-cli                               │
├──────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────┐ │
│  │              Orchestrator Core v2                        │ │
│  │  ├── Tool Registry (capability-based selection)         │ │
│  │  ├── Fallback Manager (tries alternatives on failure)   │ │
│  │  └── Task Router (routes to best tool)                 │ │
│  └─────────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │                   Bridge Layer                           │ │
│  │  ├── ACP Bridge ──► OpenClaw Gateway (ws://localhost:18789)│
│  │  ├── MCP Bridge ──► MCP Tools (stdio / HTTP)            │ │
│  │  └── WebSocket ───► Real-time streaming                 │ │
│  └─────────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │                 Execution Layer                          │ │
│  │  ├── 🤖 Android Agent (ADB automation + Gemma 4 vision)  │ │
│  │  ├── 💬 LLM Providers (LM Studio, OpenAI, Kimi, MiniMax)  │ │
│  │  └── 🔧 Tool Executors (40+ built-in tools)              │ │
│  └─────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

---

## ✨ Features

### 🤖 Android Agent
Control Android devices with AI-powered reasoning:
- **Gemma 4 Vision** — `gemma-4-e4b-it` model (specifically trained for Android tool-calling!)
- **Perceive → Reason → Act** loop — sees screen, thinks, acts
- **XML-based navigation** — no coordinate guessing, uses UI hierarchy
- **30-step loops** with automatic stuck detection
- Works via **ADB** (USB or WiFi)

```
Phone ←─────────────── ADB ───────────────→ duck-cli (Mac)
                                               │
                                               ▼
                                    LM Studio (gemma-4-e4b-it)
                                    or OpenClaw (kimi-k2.5)
```

### 🔗 OpenClaw Bridge
Connect duck-cli to OpenClaw gateway for full agent mesh:
```bash
duck bridge connect --gateway ws://localhost:18789
duck bridge register-tools
```
Then spawn duck-cli agents from OpenClaw:
```bash
openclaw acp spawn --agent duck-cli --task "control android"
```

### 🎯 Orchestrator Core v2
Intelligent tool routing with automatic fallback:
```typescript
// Tools auto-select based on capability + fallback
const tool = registry.selectTool({
  task: "Take a screenshot",
  requiredCapabilities: ["screenshot"]
});
// Returns best tool, tries fallbacks on failure
```

### 💬 Multi-Provider LLM
| Provider | Best For | Model |
|----------|----------|-------|
| **LM Studio** | Android control + local free | `gemma-4-e4b-it` |
| **Kimi** | Vision + coding | `kimi-k2.5` |
| **MiniMax** | Fast agents | `MiniMax-M2.7` |
| **OpenAI** | Premium reasoning | `gpt-5.4` |

---

## 🚀 Installation

### Mac/Linux
```bash
git clone https://github.com/Franzferdinan51/duck-cli.git
cd duck-cli
npm install
npm run build
go build -o duck ./cmd/duck/
```

### Termux (Android)

**Prerequisites:**
- [Termux from F-Droid](https://f-droid.org/en/packages/com.termux/) (NOT Google Play)
- [Termux:API app](https://f-droid.org/en/packages/com.termux.api/) from F-Droid

**One-command setup:**
```bash
pkg install -y git && git clone https://github.com/Franzferdinan51/duck-cli.git ~/duck-cli && cd ~/duck-cli && chmod +x setup.sh && ./setup.sh
```

**Or use OpenClaw-Android for a full OpenClaw installation on your phone:**
```bash
pkg install -y git && git clone https://github.com/irtiq7/OpenClaw-Android.git ~/openclaw-android-setup && cd ~/openclaw-android-setup && chmod +x *.sh && ./setup_claw.sh
```

---

## ⚡ Quick Start

### 1. Start duck-cli
```bash
# Interactive TUI shell
duck shell

# Or web UI
duck web

# Or single task
duck run "hello world"
```

### 2. Connect Android Device
```bash
# Via USB (enable USB debugging in Developer Options)
adb devices

# Via WiFi
adb tcpip 5555
adb connect <device-ip>:5555

# Verify connection
duck android devices
```

### 3. Control Android with AI
```bash
# Give it a goal — Gemma 4 handles the rest
duck android goal "open settings and turn on dark mode"

# Or step-by-step
duck android screenshot
duck android analyze
duck android tap 360 720
duck android type "hello"
```

### 4. Connect to OpenClaw
```bash
# Bridge to OpenClaw gateway
duck bridge connect --gateway ws://localhost:18789

# Register duck-cli tools with OpenClaw
duck bridge register-tools

# Spawn duck-cli agent from OpenClaw
openclaw acp spawn --agent duck-cli --task "automate android"
```

---

## 📱 Android Agent Commands

### Device Connection
```bash
duck android connect ZT4227P8NK        # Connect by serial
duck android devices                   # List connected devices
duck android disconnect               # Disconnect
```

### Screen Operations
```bash
duck android screenshot              # Capture screenshot
duck android screen                  # OCR read screen text
duck android analyze                 # AI analysis (sends to kimi-k2.5)
duck android dump                    # Full UI hierarchy XML
```

### Interactions
```bash
duck android tap 360 720             # Tap coordinates
duck android swipe up                # Swipe gestures
duck android type "hello"            # Type text
duck android key enter               # Press key
duck android launch com.android.settings  # Launch app
```

### Termux API (with Termux:API app)
```bash
duck android termux battery          # Battery info
duck android termux clip-get         # Get clipboard
duck android termux clip-set "hi"    # Set clipboard
duck android termux notif            # Notifications
duck android termux location        # GPS location
```

### AI Goal Mode
```bash
# The agent loops Perceive → Reason → Act up to 30 times
duck android goal "send a WhatsApp message to mom"

# Uses gemma-4-e4b-it via LM Studio (or kimi-k2.5 as fallback)
```

---

## 🏗️ Architecture Deep Dive

### Phone ↔ Mac Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                        Mac/Linux                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │                    duck-cli                             │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐  │  │
│  │  │  Android     │  │  OpenClaw     │  │ Orchestrator│  │  │
│  │  │  Agent       │  │  Bridge       │  │ Core v2     │  │  │
│  │  │  (Gemma 4)   │  │  (ACP/MCP)    │  │ (Tool Reg)  │  │  │
│  │  └──────┬───────┘  └──────┬───────┘  └──────┬──────┘  │  │
│  └─────────┼─────────────────┼─────────────────┼──────────┘  │
│            │                 │                 │             │
│  ┌─────────▼─────────────────▼─────────────────▼─────────┐ │
│  │              Tool Executors + Bridge Layer                │ │
│  └──────────────────────────────────────────────────────────┘ │
│                              │                                 │
└──────────────────────────────┼────────────────────────────────┘
                               │ ADB (USB or WiFi)
                               ▼
┌──────────────────────────────────────────────────────────────┐
│                     Android Device                           │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Termux + Termux:API (optional)                        │  │
│  │  ├── Screencap / UIAutomator                          │  │
│  │  ├── Input (tap/type/swipe)                           │  │
│  │  ├── Notifications / Battery / Clipboard             │  │
│  │  └── Camera / GPS / Sensors                           │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

### OpenClaw ↔ duck-cli Bridge

```
┌──────────────────────────────────────────────────────────────┐
│                   OpenClaw Gateway                            │
│  ws://localhost:18789                                        │
│  ├── ACP Protocol (agent spawning)                          │
│  ├── MCP Protocol (tool calls)                              │
│  └── WebSocket (real-time streaming)                        │
└─────────────────────────────┬────────────────────────────────┘
                              │ ACP / MCP
                              ▼
┌──────────────────────────────────────────────────────────────┐
│                    duck-cli Bridge                           │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  ACP Bridge ──► openclaw acp spawn duck-cli            │  │
│  │  MCP Bridge ──► duck tools as MCP tools                │  │
│  │  WS Bridge ───► Real-time streaming to OpenClaw UI    │  │
│  └────────────────────────────────────────────────────────┘  │
│                              │                                │
│  ┌──────────────────────────▼──────────────────────────────┐  │
│  │  Register duck-cli tools with OpenClaw:                │  │
│  │  duck bridge connect --gateway ws://localhost:18789    │  │
│  │  duck bridge register-tools                             │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

### Orchestrator Tool Registry Flow

```
Task: "Take a screenshot of the phone"

         ┌─────────────────────────────────────┐
         │       Orchestrator Core v2           │
         │  ┌───────────────────────────────┐  │
         │  │    Tool Registry               │  │
         │  │  capability: screenshot       │  │
         │  │  priority: [adb, scrot, native]│  │
         │  └───────────────┬───────────────┘  │
         └──────────────────┼──────────────────┘
                            │
         ┌──────────────────▼──────────────────┐
         │       Fallback Manager                │
         │                                       │
         │  1. Try: adb screencap ──► ✅ Success │
         │     └─► Return screenshot            │
         │                                       │
         │  If failed:                           │
         │  2. Try: scrot ──► fallback tool      │
         │  3. Try: native screenshot ──► last  │
         │     └─► Return error if all fail     │
         └───────────────────────────────────────┘
```

---

## 🛠️ Tool Registry

duck-cli uses a capability-based tool registry with automatic fallback:

```typescript
// Example: Tool registration
registry.register({
  name: "android_screenshot",
  capability: "screenshot",
  priority: 1,
  handler: async () => {
    // Use ADB screencap
    const screenshot = await adb.screencap();
    return screenshot;
  }
});

// Fallback tool
registry.register({
  name: "scrot_screenshot",
  capability: "screenshot",
  priority: 2,
  handler: async () => {
    // Use scrot command
    return exec("scrot /tmp/screen.png");
  }
});

// Select best tool for task
const tool = registry.selectTool({
  task: "capture phone screen",
  requiredCapabilities: ["screenshot"]
});
```

---

## 🔧 LM Studio Configuration

**Preferred model for Android control: `gemma-4-e4b-it`**

Gemma 4 is specifically trained on Android development (Android Studio Agent Mode) with vision + autonomous tool-calling — perfect for Android automation!

### Connect to LM Studio

```bash
# Via LM Link (remote GPU server)
export LM_STUDIO_URL="http://100.68.208.113:1234"
export LM_STUDIO_API_KEY="sk-lm-xWvfQHZF:L8P76SQakhEA95U8DDNf"
export LM_STUDIO_MODEL="google/gemma-4-e4b-it"

# Or use duck-cli's config
duck config set lmstudio.url http://100.68.208.113:1234
duck config set lmstudio.model google/gemma-4-e4b-it
```

### Available Models via LM Studio

| Model | Use For | Context |
|-------|---------|---------|
| `google/gemma-4-e4b-it` | **Android control (PREFERRED)** | 262K |
| `google/gemma-4-26b-a4b` | Large vision tasks | 262K |
| `qwen/qwen3.5-9b` | Fast local vision | 32K |
| `qwen/qwen3.5-27b` | Complex local reasoning | 50K |

---

## 📂 Project Structure

```
duck-cli/
├── cmd/duck/            # Go CLI entry point
├── src/                  # TypeScript source
│   ├── android/         # Android agent tools
│   ├── orchestrator/    # Core v2 registry
│   ├── bridge/          # OpenClaw/MCP bridges
│   └── tools/           # 40+ tool executors
├── tools/               # Shell/Python scripts
│   ├── android-agent.sh          # Shell agent (Mac-side)
│   ├── android-agent-phone.py    # Python agent (phone-side)
│   └── setup-android-agent.sh    # Setup script
├── skills/              # duck-cli skills
│   ├── android/         # Android skill
│   └── ...
├── docs/                # Documentation
│   ├── ANDROID-AGENT.md  # Full Android docs
│   ├── ORCHESTRATOR.md   # Orchestrator docs
│   ├── OPENCLAW-BRIDGE.md # Bridge docs
│   └── TERMUX-SETUP.md   # Termux installation
├── dist/                # Built output
└── duck                 # Compiled binary
```

---

## 📖 Documentation

| Doc | Description |
|-----|-------------|
| [docs/ANDROID-AGENT.md](docs/ANDROID-AGENT.md) | Complete Android agent guide |
| [docs/ORCHESTRATOR.md](docs/ORCHESTRATOR.md) | Orchestrator Core v2 reference |
| [docs/OPENCLAW-BRIDGE.md](docs/OPENCLAW-BRIDGE.md) | OpenClaw integration guide |
| [docs/TERMUX-SETUP.md](docs/TERMUX-SETUP.md) | Termux + duck-cli setup |
| [docs/COMMANDS.md](docs/COMMANDS.md) | Full CLI command reference |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System architecture |

---

## 🐛 Troubleshooting

### Android device not found
```bash
adb kill-server
adb start-server
duck android devices
```

### LM Studio connection fails
```bash
# Check LM Studio is running
curl http://100.68.208.113:1234/v1/models

# Test with a simple prompt
curl -X POST http://100.68.208.113:1234/v1/chat/completions \
  -H "Authorization: Bearer sk-lm-xWvfQHZF:L8P76SQakhEA95U8DDNf" \
  -d '{"model":"google/gemma-4-e4b-it","messages":[{"role":"user","content":"hi"}]}'
```

### Termux setup issues
```bash
# Use F-Droid Termux, NOT Google Play
# Install Termux:API from F-Droid too
pkg update
pkg install git
```

---

## 🤝 Contributing

1. Fork the repo
2. Create a feature branch
3. Add tests for new tools
4. Submit a PR

---

## 📜 License

MIT License — see [LICENSE](LICENSE)

---

## 🙏 Credits

- **OpenClaw** — https://github.com/Franzferdinan51/OpenClaw
- **OpenClaw-Android** — https://github.com/irtiq7/OpenClaw-Android
- **LM Studio** — Local LLM inference
- **Google Gemma 4** — Android development trained model
