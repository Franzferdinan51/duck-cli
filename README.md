# 🦆 duck-cli

> **Unified Super Agent** — Local AI Agent with Android Integration via ADB + OpenClaw Bridge + Hybrid Orchestrator v2

[![GitHub](https://img.shields.io/github/stars/Franzferdinan51/duck-cli?style=social)](https://github.com/Franzferdinan51/duck-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)
[![Go](https://img.shields.io/badge/Go-1.21+-blue.svg)](https://go.dev/)

---

## ⚡ Quick Start — Download & Run (Recommended)

Everything you need in one download:

### 1. Install the Android App (for phone control)
**Download:** [DuckBot-New.apk](https://github.com/Franzferdinan51/duck-cli/releases/latest) *(attached to the latest release)*

The app gives you:
- 📱 Step-by-step Termux bootstrap installer
- 🔧 Tool browser (102+ tools)
- 🌐 Connection manager (local/remote/Tailscale)
- 💬 Chat interface
- ⚙️ Settings for Telegram, LM Studio, gateway

### 2. Install duck-cli on your Mac/PC
```bash
curl -sSL https://git.io/duck-install | bash
```

Or one-shot:
```bash
git clone https://github.com/Franzferdinan51/duck-cli.git
cd duck-cli
./tools/install-pc.sh
```

### 3. Start the Telegram bot (optional — chat with duck-cli from Telegram!)
```bash
duck telegram start
```
Now message @AgentSmithsbot on Telegram and get AI responses!

### 4. Connect from the Android app
Open DuckBot-New → Install tab → follow the Termux bootstrap steps

---

## 🎯 What is duck-cli?

**duck-cli** is not just a CLI anymore — it is a multi-surface agent stack with:
1. **CLI runtime** for shell/chat/automation flows on PC and Termux
2. **Desktop app / web UI** for chat + generative UI panels + canvas demos
3. **Android automation layer** for ADB + Termux + on-device agent workflows
4. **OpenClaw bridge** for ACP/MCP/gateway/agent-mesh integration
5. **Hybrid orchestrator** for routing between local models, gateway providers, tools, and council-style reasoning

Think of it as an AI-powered agent platform with a CLI, an app UI, Android control, OpenClaw interoperability, and local/remote model routing.

```
┌──────────────────────────────────────────────────────────────────────────┐
│                           duck-cli                                       │
├──────────────────────────────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │              Hybrid Orchestrator v2                                 │ │
│  │  ├── Task Complexity Classifier (1-10 scoring)                       │ │
│  │  ├── Model Router (auto-selects best model)                          │ │
│  │  ├── AI Council Bridge (deliberates on complex tasks)                │ │
│  │  ├── Tool Registry (capability-based selection)                       │ │
│  │  └── Fallback Manager (tries alternatives on failure)                │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                   Bridge Layer                                      │ │
│  │  ├── ACP Bridge ──► OpenClaw Gateway (ws://localhost:18789)         │ │
│  │  ├── MCP Bridge ──► MCP Tools (stdio / HTTP)                        │ │
│  │  └── WebSocket ───► Real-time streaming                             │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                 Execution Layer                                     │ │
│  │  ├── 🤖 Android Agent (runs ON phone + ADB control)                 │ │
│  │  ├── 🧠 AI Council (5+ councilors for complex decisions)           │ │
│  │  ├── 💬 LLM Providers (LM Studio, OpenAI, Kimi, MiniMax)            │ │
│  │  └── 🔧 Tool Executors (40+ built-in tools)                          │ │
│  └────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 🖥️ The App (Desktop / Web UI)

The app bundled with duck-cli is a React/Vite desktop-style UI under `src/ui/desktop/`.

What it currently includes:
- **Chat view** via `GenerativeChat`
- **Demo / showcase view** with Pretext canvas examples
- **Weather card** example
- **Crypto chart** example
- **AI Council vote display** example
- **Canvas / particle effects** demo
- **CopilotKit wrapper** via `DuckCopilot`

Important: the current app is better described as a **desktop/web UI for chat + generative UI experiments** than as a finished polished desktop product. It is part of the duck-cli system, not a separate random app.

Run it from the desktop UI project when available in your workflow:
```bash
cd src/ui/desktop
npm install
npm run dev
```

## ✨ Features

### 🤖 Android Agent (Runs ON + Controls Android)

**duck-cli operates in TWO modes:**

#### Mode 1: Run ON Android (Native Agent)
The agent runs natively on your Android phone inside Termux - NOT controlled remotely!

```
┌─────────────────────────────────────────────────────────────────┐
│                    Your Android Phone                            │
│                                                                 │
│   Termux                                                         │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │                    duck-cli                             │   │
│   │  ┌─────────────────────────────────────────────────────┐ │   │
│   │  │         Hybrid Orchestrator v2                     │ │   │
│   │  │  ├── Task Complexity Classifier                      │ │   │
│   │  │  ├── Model Router (Gemma 4 via HTTP to Mac)          │ │   │
│   │  │  └── AI Council Bridge                              │ │   │
│   │  └─────────────────────────────────────────────────────┘ │   │
│   │                         │                               │   │
│   │                         ▼                               │   │
│   │  ┌─────────────────────────────────────────────────────┐ │   │
│   │  │        Perceive → Reason → Act Loop                 │ │   │
│   │  │     (XML dump → Gemma 4 → tap/type/swipe)            │ │   │
│   │  └─────────────────────────────────────────────────────┘ │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│   Connects to: http://YOUR_MAC_IP:1234 (LM Studio)             │
└─────────────────────────────────────────────────────────────────┘
```

**How to run on Android:**
```bash
# On your phone (Termux)
cd ~/duck-cli
npm install && npm run build
node dist/cli/main.js shell

# Agent runs ON your phone!
# Connects to Mac's LM Studio for Gemma 4 reasoning
```

#### Mode 2: Control Android via ADB (Remote Control)
Control Android devices remotely from Mac/Linux/Windows

```
Mac/Windows/Linux                         Android Phone
┌────────────────────┐                   ┌────────────────────┐
│    duck-cli        │◄────── ADB ──────►│    Target Device   │
│                    │     USB/WiFi       │                    │
│  ┌──────────────┐  │                   │  duck-cli can      │
│  │  Orchestrator │  │                   │  run here too!     │
│  │  Core v2     │  │                   │                    │
│  └──────────────┘  │                   └────────────────────┘
│          │         │
│          ▼         │
│   LM Studio        │
│   (gemma-4-e4b-it)  │
└────────────────────┘
```

### 🧠 AI Council Integration

Complex tasks trigger AI Council deliberation (5+ councilors):

```typescript
// Task scored as complex (7+/10)
// → Engages AI Council
// → Council debates (Speaker + Technocrat + Ethicist + Pragmatist + Skeptic)
// → Returns verdict + recommendations
// → Hybrid Orchestrator proceeds with execution
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

### 🎯 Hybrid Orchestrator v2
Intelligent task routing with AI Council:
```typescript
// Simple task (1-3) → Fast path, no council
await orchestrator.execute("open settings");

// Complex task (7+) → AI Council deliberation first
await orchestrator.execute("should I upgrade this dependency?");
// → Council debates → Verdict → Execute

// Android task → Routes to Gemma 4
await orchestrator.execute("tap the settings button");
// → Routes to lmstudio/google/gemma-4-e4b-it
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
bash tools/install-pc.sh
duck status
```

### Termux (Android) — RUN ON YOUR PHONE!

**duck-cli runs NATIVELY on Android** via Termux. This is NOT just ADB control - the agent executes ON your phone!

**Prerequisites:**
- [Termux from F-Droid](https://f-droid.org/en/packages/com.termux/) (NOT Google Play)
- [Termux:API app](https://f-droid.org/en/packages/com.termux.api/) from F-Droid

**Setup:**
```bash
# In Termux on your phone:
pkg update && pkg upgrade
pkg install -y nodejs git
git clone https://github.com/Franzferdinan51/duck-cli.git ~/duck-cli
cd ~/duck-cli
bash tools/install-termux.sh

# Run the agent ON your phone!
duck run "Say hi"
```

**Phone connects to Mac's LM Studio:**
```bash
# On phone, set LM Studio endpoint + gateway in ~/duck-cli/.env:
LMSTUDIO_URL=http://192.168.1.X:1234
LMSTUDIO_KEY=sk-lm-xxx
LMSTUDIO_MODELS=gemma-4-e4b-it
OPENCLAW_GATEWAY=ws://192.168.1.X:18789
OPENCLAW_GATEWAY_HTTP=http://192.168.1.X:18789

# Now your phone's agent uses Gemma 4 / gateway from your Mac or PC.
```

### OpenClaw-Android (Alternative Full Installation)
For a complete OpenClaw installation on your phone:
```bash
pkg install -y git && git clone https://github.com/irtiq7/OpenClaw-Android.git ~/openclaw-android-setup && cd ~/openclaw-android-setup && chmod +x *.sh && ./setup_claw.sh
```

---

## ⚡ Quick Start

### 1. Start duck-cli
```bash
# Interactive TUI shell
duck shell

# Or single task
duck run "hello world"
```

### 2. Run ON Android or Control via ADB

**Option A: Run ON your phone (native)**
```bash
# On phone
cd ~/duck-cli
node dist/cli/main.js shell
```

**Option B: Control Android from Mac**
```bash
# Via USB (enable USB debugging in Developer Options)
adb devices

# Via WiFi
adb tcpip 5555
adb connect <device-ip>:5555

# Verify connection
duck android devices
```

### 3. Android Control Commands
```bash
# Take screenshot
duck android screenshot

# Tap element
duck android tap "Settings"

# Dump UI
duck android dump

# Run goal (one-shot)
duck android goal "Open Chrome and search for cats"

# 🤖 AI Agent (perceive→reason→act loop)
duck android agent "open settings"
duck android agent "open WhatsApp and send the message hi"
```

### 🤖 Android Agent (AI-Powered)

The android agent uses a **perceive→reason→act** loop powered by AI:

```bash
# Run AI agent with goal
duck android agent "open settings"
duck android agent "open WhatsApp and send the message hi"
duck android agent "go home"
```

**How it works:**
1. Perceive — dumps accessibility tree via ADB
2. Reason — sends state to LLM (Gemma 4 / Kimi / MiniMax)
3. Act — executes tap/type/launch commands
4. Repeats until goal is reached or max steps

**Model selection:**
- `gemma-4-e4b-it` — **PREFERRED** for Android (trained on Android Studio Agent Mode + vision + tool-calling)
- `minimax/MiniMax-M2.7` — fast fallback
- Falls back through provider chain automatically

**Also see:** [DroidClaw fork](https://github.com/Franzferdinan51/droidclaw) — Bun-based version with same duck-cli provider integration
```

---

## 🏗️ Architecture

### Hybrid Orchestrator Flow

```
User Task
    │
    ▼
┌─────────────────────────┐
│  Task Complexity        │  ← Scores 1-10
│  Classifier             │
└───────────┬─────────────┘
            │
    ┌───────┴───────┐
    │               │
 Complexity     isEthical?
 < 7              │
    │               │
    ▼               ▼
┌───────────┐  ┌───────────────┐
│ Fast Path │  │ AI Council    │
│ (No Delay)│  │ Deliberation  │
└───────────┘  └───────┬───────┘
                      │
                 Verdict: approve/reject/conditional
                      │
                      ▼
┌─────────────────────────┐
│  Model Router          │  ← Selects best model
│  (task → model)         │     Gemma 4 / Kimi / MiniMax
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│  Tool Executor          │  ← Runs with fallback
│  (registry + retry)     │
└─────────────────────────┘
```

### Perceive → Reason → Act Loop

For Android tasks, the agent:

1. **Perceive** — Captures screen, dumps UI XML, extracts elements
2. **Reason** — Sends context to Gemma 4 with goal + screen state
3. **Act** — Executes action (tap/type/swipe/launch/wait)
4. **Loop** — Repeats until goal reached or max steps (30)

```
Capture Screen → Parse UI → Gemma 4 reasons → Execute Action → Repeat
```

---

## 📁 Project Structure

```
duck-cli/
├── src/
│   ├── orchestrator/          # Hybrid Orchestrator v2
│   │   ├── task-complexity.ts    # 1-10 scoring
│   │   ├── model-router.ts       # Model selection
│   │   ├── council-bridge.ts     # AI Council integration
│   │   ├── hybrid-core.ts        # Main orchestrator
│   │   └── fallback-manager.ts    # Retry logic
│   ├── agent/                # Agent implementations
│   │   └── android-agent.ts       # Android control
│   ├── bridge/               # Protocol bridges
│   │   ├── acp-bridge.ts
│   │   ├── mcp-bridge.ts
│   │   └── websocket-bridge.ts
│   ├── subconscious/          # AI Council-enhanced subconscious
│   │   └── council-bridge.ts
│   └── tools/                 # Built-in tools
├── cmd/duck/                 # Go CLI layer
├── skills/                   # duck-cli skills
└── docs/                     # Documentation
```

---

## 📜 Documentation

- [Orchestrator Docs](docs/ORCHESTRATOR.md)
- [Android Integration](docs/ANDROID-INTEGRATION.md)
- [OpenClaw Bridge](docs/OPENCLAW-BRIDGE.md)
- [Termux Setup](docs/TERMUX-SETUP.md)

---

## 🦆 Powered By

- [OpenClaw](https://github.com/openclaw/openclaw) — ACP/MCP protocols, Skills system
- [Hermes-Agent](https://github.com/NousResearch/hermes-agent) — Learning loops
- [NeMoClaw](https://github.com/NVIDIA/NeMoClaw) — Security sandboxing
- [Gemma 4](https://ai.google.dev/) — Android-specific LLM training
- [LM Studio](https://lmstudio.ai/) — Local LLM inference

---

**🦆 duck-cli — Your AI Agent that runs ON and controls Android!**