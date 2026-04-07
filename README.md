# 🦆 duck-cli v0.8.0

> **Standalone AI Agent** — Smart multi-provider routing, AI Council deliberation, proactive KAIROS heartbeat, agent-mesh networking, and 50+ built-in commands. Runs standalone on Mac/PC/Linux/Android — or connect it to OpenClaw/ACP to let OTHER agents use its tools.

**OpenClaw compatible** — Can run standalone OR as an ACP/bridge endpoint that other agents invoke.

## 🧠 What duck-cli actually is

duck-cli is **not just a sidecar for OpenClaw**.

It is:
- a **standalone AI agent** people can talk to directly, especially through **Telegram**
- a **custom assistant/runtime** built on OpenClaw ideas and components
- a **bridge layer** with its own MCP, ACP, WebSocket, and meta-agent flows
- a tool/service that **other agents can call into** through the bridge

### Architecture — Layers & Access Points

```text
╔══════════════════════════════════════════════════════════════════════════════╗
║                              ACCESS LAYER                                     ║
║                                                                              ║
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────────────────────┐     ║
│   │  Telegram   │    │    CLI      │    │   Web UI / Gateway          │     ║
│   │  (PUBLIC)   │    │  (direct)   │    │   /v1/chat, /v1/status      │     ║
│   └──────┬──────┘    └──────┬──────┘    └────────────┬────────────────┘     ║
║          │                  │                          │                     ║
║          └──────────────────┴──────────────────────────┘                     ║
║                              │                                               ║
╚══════════════════════════════╪═══════════════════════════════════════════════╝
                               ↓
╔══════════════════════════════╪═══════════════════════════════════════════════╗
║                    STANDALONE AGENT CORE (Chat Agent)                         ║
║                                                                              ║
│   ┌─────────────────────────────────────────────────────────────────────┐   ║
│   │  Hybrid Orchestrator  ──►  AI Council (deliberation via mesh)      │   ║
│   │  Task Router  ──►  Subconscious Whispers  ──►  KAIROS              │   ║
│   │  40+ Tools  ──►  Tool Registry  ──►  Execution Engine               │   ║
│   │  Provider Manager  ──►  MiniMax / Kimi / LM Studio / OpenAI        │   ║
│   └─────────────────────────────────────────────────────────────────────┘   ║
║                              │                                               ║
║          ┌───────────────────┴───────────────────┐                           ║
║          ↓                                       ↓                            ║
║   ┌─────────────┐                        ┌─────────────────┐                ║
║   │   PUBLIC   │                        │  MESH BUS       │                ║
║   │   REPLIES  │                        │  (Required)     │                ║
║   │ (Telegram) │                        │  Port 4000      │                ║
║   └─────────────┘                        └────────┬────────┘                ║
║                                                    │                         ║
╚════════════════════════════════════════════════════╪════════════════════════╝
                                                     ↓
╔════════════════════════════════════════════════════╪════════════════════════╗
║                    BRIDGE LAYER (Two-Way)                                       ║
║                                                                              ║
│   ┌─────────────────────────────────────────────────────────────────────┐   ║
│   │                     BRIDGE SERVICE                                  │   ║
│   │                                                                     │   ║
│   │  ┌──────────┐  ┌──────────┐  ┌───────────┐  ┌──────────────────┐   │   ║
│   │  │   MCP    │  │   ACP    │  │WebSocket  │  │  Live Logger     │   │   ║
│   │  │ Server   │  │  Server  │  │  Server   │  │  (Port 3851)     │   │   ║
│   │  │ (3850)   │  │ (18794)  │  │ (18796)   │  │  Terminal + Text │   │   ║
│   │  └────┬─────┘  └────┬─────┘  └─────┬────┘  └────────┬─────────┘   │   ║
│   │       │             │               │                │              │   ║
│   │       └─────────────┴───────────────┴────────────────┘              │   ║
│   │                         │                                           │   ║
│   │  Bridge Meta-Agent ◄──► Mesh Bus ◄──► All Internal Agents          │   ║
│   │         │                    │                                      │   ║
│   │         └────────────────────┘                                      │   ║
│   │              Two-way coordination                                   │   ║
│   └─────────────────────────────────────────────────────────────────────┘   ║
║                              │                                               ║
╚══════════════════════════════╪═══════════════════════════════════════════════╝
                               ↓
╔══════════════════════════════╪═══════════════════════════════════════════════╗
║              INTERNAL AGENTS LAYER (All Connected to Mesh)                    ║
║                                                                              ║
│   ┌─────────────────────────────────────────────────────────────────────┐   ║
│   │                         AGENT MESH BUS (Port 4000)                  │   ║
│   │                         (Required for all agents)                   │   ║
│   │                                                                     │   ║
│   │  ┌─────────────────────────────────────────────────────────────┐   │   ║
│   │  │                    META AGENTS LAYER                        │   │   ║
│   │  │  (9 Internal Meta Agents - All Mesh-Connected)              │   │   ║
│   │  │                                                             │   │   ║
│   │  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │   │   ║
│   │  │  │Orchestrator │ │   Bridge    │ │Subconscious │           │   │   ║
│   │  │  │ (qwen-2b)   │ │(gemma-4e2b) │ │(qwen-0.8b)  │           │   │   ║
│   │  │  └──────┬──────┘ └──────┬──────┘ └──────┬──────┘           │   │   ║
│   │  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │   │   ║
│   │  │  │    Mesh     │ │   Council   │ │   Monitor   │           │   │   ║
│   │  │  │(gemma-4e2b) │ │ (qwen-2b)   │ │(qwen-0.8b)  │           │   │   ║
│   │  │  └──────┬──────┘ └──────┬──────┘ └──────┬──────┘           │   │   ║
│   │  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐           │   │   ║
│   │  │  │   Memory    │ │  Security   │ │  Scheduler  │           │   │   ║
│   │  │  │(qwen-0.8b)  │ │ (qwen-2b)   │ │(qwen-0.8b)  │           │   │   ║
│   │  │  └─────────────┘ └─────────────┘ └─────────────┘           │   │   ║
│   │  └─────────────────────────────────────────────────────────────┘   │   ║
│   │                              │                                      │   ║
│   │   ┌──────────────────────────┴──────────────────────────┐          │   ║
│   │   │              SPECIALIZED AGENTS                      │          │   ║
│   │   │                                                        │          │   ║
│   │   │   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │          │   ║
│   │   │   │ AI Council   │  │ Sub-Conscious│  │   KAIROS     │ │          │   ║
│   │   │   │ (Deliberate) │  │ (Whispers)   │  │ (Heartbeat)  │ │          │   ║
│   │   │   └──────┬───────┘  └──────┬───────┘  └──────┬───────┘ │          │   ║
│   │   │   ┌──────┴───────┐  ┌──────┴───────┐  ┌──────┴───────┐ │          │   ║
│   │   │   │ Skill Creator│  │  meshd       │  │  Live Logger │ │          │   ║
│   │   │   │ (Auto-skill) │  │  (Server)    │  │  (Errors)    │ │          │   ║
│   │   │   └──────────────┘  └──────────────┘  └──────────────┘ │          │   ║
│   │   │                                                        │          │   ║
│   │   │   All agents: subscribe to mesh, broadcast state       │          │   ║
│   │   │   Meta Agents: coordinate via mesh, manage system      │          │   ║
│   │   └────────────────────────────────────────────────────────┘          │   ║
│   └─────────────────────────────────────────────────────────────────────┘   ║
║                              │                                               ║
╚══════════════════════════════╪═══════════════════════════════════════════════╝
                               ↓
╔══════════════════════════════╪═══════════════════════════════════════════════╗
║                    EXTERNAL AGENTS & SERVICES                                 ║
║                                                                              ║
│   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐    ║
│   │   OpenClaw  │   │  External   │   │   Codex     │   │   Other     │    ║
│   │   Gateway   │   │  Agents     │   │  (ACP)      │   │   Agents    │    ║
│   │  (MCP/ACP)  │   │  (via Mesh) │   │             │   │  (Discord,  │    ║
│   └─────────────┘   └─────────────┘   └─────────────┘   │  Telegram)  │    ║
│                                                         └─────────────┘    ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

**Layer summary:**

| Layer | What it does | Who uses it |
|-------|-------------|-------------|
| **Access** | Telegram (public), CLI, Web UI | End users |
| **Agent Core** | Orchestration, tools, providers, council, KAIROS | All requests |
| **Bridge** | MCP (3850), ACP (18794), WS (18796), **Live Logger (3851)** | Two-way with mesh |
| **Meta Agents** | 9 internal agents with tools & time context | System coordination |
| **Mesh Bus** | **Required** internal communication layer | All internal agents |
| **Internal Agents** | AI Council, Sub-Conscious, KAIROS, Skill Creator | Mesh-connected |
| **External** | OpenClaw, CannaAI, Codex, other agents | Bridge/MCP/ACP |

### Key Design Principles

**1. Mesh is Required**
All internal agents MUST connect to the mesh bus (port 4000). This ensures:
- Every agent knows system state
- Errors propagate to Sub-Conscious
- AI Council can deliberate and broadcast verdicts
- No silent failures

**2. Two-Way Bridge**
The Bridge layer is fully bidirectional:
- **Inbound**: External agents → duck-cli tools
- **Outbound**: duck-cli → external agents (OpenClaw, CannaAI, etc.)
- Bridge Meta-Agent coordinates via mesh

**3. Live Logging**
Live Logger (port 3851) streams:
- Terminal output (real-time)
- Error logs (structured)
- Tool execution traces
All internal agents subscribe to error events via mesh.

**4. Sub-Conscious Integration**
Sub-Conscious daemon:
- Monitors Live Logger for errors
- Generates whispers (confidence-scored alerts)
- High-confidence whispers (≥0.7) route to AI Council
- Persists insights to SQLite + FTS search

**5. AI Council Deliberation**
AI Council operates via mesh:
- Receives complex/ethical tasks from Chat Agent
- Deliberates with multiple councilors
- Broadcasts verdict (approve/reject/conditional) to mesh
- All agents receive council decisions

### Internal Communication Flow

```
Error Occurs:
  Tool Execution ──► Live Logger ──► Mesh Broadcast ──► Sub-Conscious
                                                           ↓
                                                    Generate Whisper
                                                           ↓
                                              Confidence ≥ 0.7?
                                                    ↓ Yes
                                              AI Council Deliberation
                                                    ↓
                                              Broadcast Verdict
                                                    ↓
                                              All Agents Act
```

### Public vs Internal Traffic

**Public replies** → Clean assistant messages to Telegram/CLI/Web UI
**Internal coordination** → Mesh bus for agent-to-agent communication
**Bridge traffic** → Two-way with external agents (MCP/ACP/WebSocket)

[![GitHub](https://img.shields.io/github/stars/Franzferdinan51/duck-cli?style=social)](https://github.com/Franzferdinan51/duck-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)
[![Go](https://img.shields.io/badge/Go-1.21+-blue.svg)](https://go.dev/)

---

## ⚡ Quick Start

```bash
# Install
git clone https://github.com/Franzferdinan51/duck-cli.git
cd duck-cli
npm install && npm run build

# Run a task (auto-routes to best model)
./duck run "what is the capital of Japan?"

# Interactive shell
./duck shell

# Telegram bot (main public interface)
./duck telegram start

# Check system health
./duck health

# Android automation
./duck android devices

# Ask the AI Council
./duck council "should I upgrade all dependencies at once?"

# Start all protocols at once
./duck unified
```

---

## 📱 Telegram is a first-class interface

duck-cli ships with a built-in Telegram transport. It is intended to act like a real standalone assistant, not dump internal logs/tool chatter into the chat.

```bash
# Start the built-in Telegram bot
./duck telegram start

# Test Telegram send
./duck telegram send "hello from duck-cli"
```

For launchd/macOS automation, use:
- `tools/run-duck-telegram.sh`
- `tools/ai.duckbot.telegram.plist`

Useful Telegram env vars:
- `DUCK_TELEGRAM_REPLY_TIMEOUT_MS=300000` (default 5 min)
- `TELEGRAM_BOT_TOKEN=...`
- `TELEGRAM_CHAT_ID=...`

The built-in Telegram transport is buffered and sanitized, so it should send a clean final assistant reply instead of internal orchestration chatter.

---

## 🏃 Run a Task

```bash
./duck run "build a REST API"
./duck run "analyze this screenshot" -p kimi       # Vision task → Kimi
./duck run "control my Android phone" -p lmstudio   # Android → Gemma 4
./duck run "research topic" -p minimax              # Fast general → MiniMax
```

---

## 🌐 Provider Routing

Smart routing picks the right model automatically. Override with `-p`:

| Provider | Models | Cost | Best For |
|----------|--------|------|----------|
| `minimax` | M2.7, glm-5, qwen3.5-plus | API credits | Fast general, coding, reasoning |
| `lmstudio` | Gemma 4 26B, Gemma 4 e4b, qwen3.5-9b, qwen3.5-27b | Free (local) | Android, free local tasks |
| `kimi` | k2p5, k2 | Pay-per-use | Vision, top-tier coding |
| `openrouter` | qwen/qwen3.6-plus-preview:free | Free tier | Free reasoning |
| `openai` | gpt-5.4, gpt-5.4-mini | ChatGPT subscription | Premium reasoning |

```bash
./duck -p minimax run "task"    # Force MiniMax
./duck -p lmstudio run "task"   # Force local Gemma 4
./duck -p kimi run "task"       # Force Kimi k2.5
```

---

## 📱 Android Automation

Control your Android phone via ADB — tap, swipe, screenshot, dump UI, install apps, run Termux commands, or let the AI agent loop handle everything.

```bash
# List devices
./duck android devices

# Device status
./duck android status
./duck android info

# Control
./duck android tap 500 800
./duck android swipe up
./duck android type "hello"
./duck android screenshot

# Read screen
./duck android screen        # OCR-style text read
./duck android dump           # Full UI hierarchy (XML)
./duck android find "Settings"

# Apps
./duck android app launch com.whatsapp
./duck android app kill com.example
./duck android install app.apk

# AI agent loop — perceive → reason → act (Gemma 4)
./duck android agent "open WhatsApp"
./duck android agent "open settings and turn on WiFi"

# Termux API
./duck android termux battery
./duck android termux notif
```

---

## 🧠 AI Council — Deliberation

Complex tasks trigger multi-agent deliberation before execution.

```bash
# Ask the council
./duck council "should I upgrade all dependencies at once?"
./duck council "should I invest in crypto?" --mode prediction

# Subconscious — background whisper monitoring
./duck subconscious status
./duck subconscious stats
./duck subconscious daemon
```

---

## 💓 KAIROS — Proactive Heartbeat

Continuous background monitoring — alerts you when something needs attention.

```bash
./duck kairos status         # Show current state, idle/sleep, last tick
./duck kairos start         # Start autonomous heartbeat (fire first tick immediately)
./duck kairos stop          # Pause
./duck kairos dream         # Manually trigger dream consolidation
./duck kairos dream --save  # Dream + save insights to Sub-Conscious daemon
./duck kairos history       # Recent action history

# Skill management (autonomous skill creation)
./duck kairos skills --list         # List auto-created skills
./duck kairos skills --stats       # Creator + improver stats
./duck kairos skills --patterns    # Patterns ready for skill creation
./duck kairos skills --create <p>  # Manually create skill from pattern
./duck kairos skills --improve <s>  # Improve a specific skill
./duck kairos skills --improve-all # Fix skills with poor health
```


### How KAIROS Works

- **Tick loop** — Fires every 5 min (configurable), monitors terminal focus & idle
- **Proactive mode** — `aggressive`/`balanced`/`conservative` controls how often it acts when idle
- **Dream consolidation** — At `dreamTime` (default 03:00), enters sleep, runs pattern analysis
- **Dream → Sub-Conscious** — `dream_complete` event saves insights to the Sub-Conscious daemon (`/dream` endpoint)
- **Autonomous skill creation** — Tracks repeated tool sequences, auto-creates skills after 3+ occurrences

### Dream Phases (OpenClaw v2026.4.5 compatible)

KAIROS dream events map to OpenClaw's 3-phase dreaming architecture:

| Phase | KAIROS Event | OpenClaw Mapping |
|-------|-------------|-----------------|
| Light sleep | `idle` state while `isAsleep=true` | Light dreaming |
| Deep processing | `consolidateLearnings()` running | Deep consolidation |
| REM complete | `dream_complete` emitted → POST `/dream` | REM → Sub-Conscious save |


### OpenClaw ACPX Runtime (v2026.4.5+)


duck-cli spawns ACP agents (Codex, Claude Code, Pi, etc.) via the ACPX embedded runtime. ACPX path resolution uses `process.execPath` to locate the acpx binary — works even when PATH is minimal (e.g., inside OpenClaw subprocess).


```bash
# ACP client starts automatically with duck-cli
./duck acp spawn codex "build a feature"
./duck acp sessions
./duck acp cancel <session>
```

---

## 🔗 Agent Mesh — Multi-Agent Networking

```bash
./duck meshd                  # Start mesh server (port 4000)
./duck mesh register          # Register with mesh
./duck mesh list             # Discover other agents
./duck mesh send <agent> <msg>
./duck mesh broadcast <msg>
./duck mesh inbox
./duck mesh capabilities
```

---

## 🛠️ Automation & Scheduling

### Cron Jobs
```bash
./duck cron list
./duck cron create "*/5 * * * *" "run health check"
./duck cron enable <job-id>
./duck cron disable <job-id>
./duck cron delete <job-id>
./duck cron run <job-id>
```

### Sessions & Memory
```bash
./duck session list          # List past sessions
./duck session search "python"  # Search history
./duck memory remember "project=duck-cli"  # Store fact
./duck memory recall "project"  # Retrieve fact
```

---

## 🗂️ Logger

```bash
./duck logger status         # Protocol health + stats
./duck logger logs            # Recent logs
./duck logger errors          # Error log
./duck logger tail            # Stream logs real-time
```

---

## 🛡️ Security & Health

```bash
./duck security audit        # Scan for exposed secrets
./duck security defcon       # DEFCON threat level
./duck health                 # Full system health check
./duck doctor                 # Diagnostics — API keys, services, deps
./duck stats                  # Usage stats (runs, success, tokens)
```

---

## 🛠️ Skills Marketplace

```bash
./duck skills list            # Browse available skills
./duck skills search <query>  # Find a skill
./duck skills install <name>  # Install
./duck skills info <name>     # Details
./duck skills update <name>   # Update
./duck skills uninstall <name>
```

---

## 🦊 ClawHub Marketplace

```bash
./duck clawhub search <query>
```

---

## 🧪 Tools Registry

```bash
./duck tools list             # All available tools
./duck tools search <name>    # Find specific tool
./duck tools schema <name>    # JSON schema for a tool
./duck tools categories        # Grouped by category
```

---

## ⚙️ Configuration & Setup

```bash
./duck setup                  # Interactive API key setup
./duck config list            # Show all config
./duck config get <key>       # Get value
./duck config set <key> <val> # Set value
./duck config reset           # Reset to defaults
```

---

## 🔧 MCP Server — Extend Tool Registry

```bash
./duck mcp                    # Start MCP server (port 3850)
./duck mcp 3840               # Custom port
./duck mcp --stdio            # stdio transport (for Claude Desktop)
```

---

## 🌐 Web UI & Gateway

```bash
./duck web                    # Start Web UI (port 3001)
./duck web 8080              # Custom port
./duck gateway                # Start Gateway API (port 18792)
./duck unified                # All protocols at once:
                              # MCP (3850) + ACP (18794) + WS (18796) + Gateway (18792)
```

---

## 🤖 Subagents — Parallel Execution

```bash
./duck agent spawn "research quantum computing"
./duck agent list             # Active agents
./duck agent cancel <id>      # Cancel agent
```

---

## 📊 Meta-Agent — LLM-Powered Orchestration

```bash
./duck meta                   # Plan, execute, and learn from tasks
./duck meta learnings         # Show lessons from past sessions
```

---

## 🔄 Updates & Backup

```bash
./duck update check           # Check for new version
./duck update install         # Install update
./duck update backup          # Backup before update
./duck update restore         # Restore from backup
```

---

## 🎭 Other Commands

```bash
./duck think <prompt>         # Reasoning mode
./duck trace list             # List execution traces
./duck trace show <id>        # View trace
./duck flow <file.json>       # Run ACPX-style flow graph
./duck rl status             # OpenClaw-RL self-improvement
./duck souls list            # Browse SOUL registry
./duck sync openclaw         # Sync with OpenClaw
./duck buddy hatch           # Hatch buddy companion
./duck desktop               # Desktop control
./duck speak "hello"         # Text-to-speech (MiniMax)
./duck voice "hello"         # Text-to-speech (alias)
./duck acp <agent> [task]   # Spawn ACP agent (codex/claude/pi/gemini)
./duck acp-server            # ACP server (port 18794)
./duck channels              # Start Telegram/Discord channels
./duck team create <name>   # Create multi-agent team
./duck team spawn <team>    # Spawn team
./duck completion bash       # Bash autocompletion
./duck --version             # Show version
```

---

## 📂 Project Structure

```
duck-cli/
├── src/
│   ├── orchestrator/          # Task routing + execution
│   ├── providers/              # MiniMax, LM Studio, Kimi, OpenRouter, OpenAI
│   ├── agent/                  # Core agent + Android tools
│   ├── subconscious/           # Whisper monitoring system
│   ├── kairos/                 # Proactive heartbeat
│   ├── commands/               # CLI command handlers
│   ├── mesh/                   # Agent mesh networking
│   ├── skills/                 # duck-cli skills
│   └── tools/                  # Tool implementations
├── cmd/duck/                   # Go CLI entry point
├── tools/                      # Standalone tools
└── docs/                       # Architecture docs
```

---

## 🚀 Installation

```bash
git clone https://github.com/Franzferdinan51/duck-cli.git
cd duck-cli
npm install && npm run build
./duck doctor                  # Verify setup
./duck health                  # Check system health
```

---

## 🔗 Related Projects

| Repo | Purpose |
|------|---------|
| **[duck-cli](https://github.com/Franzferdinan51/duck-cli)** | Main repo — desktop AI agent |
| **[droidclaw](https://github.com/Franzferdinan51/droidclaw)** | Bun-based Android agent |
| **[Open-WebUi-Lobster-Edition](https://github.com/Franzferdinan51/Open-WebUi-Lobster-Edition)** | OpenWebUI fork with OpenClaw + generative UI |
| **[AI-Bot-Council-Concensus](https://github.com/Franzferdinan51/AI-Bot-Council-Concensus)** | Multi-agent deliberation chamber |

---

## 🦆 Powered By

- **[OpenClaw](https://github.com/openclaw/openclaw)** — ACP/MCP protocols, Skills, agent mesh
- **[MiniMax](https://www.minimax.io/)** — Fast reasoning API
- **[LM Studio](https://lmstudio.ai/)** — Local LLM inference
- **[Kimi/Moonshot](https://platform.moonshot.cn/)** — Vision + coding
- **[Gemma 4](https://ai.google.dev/)** — Android-trained local model
- **[Pretext](https://github.com/chenglou/pretext)** — Canvas text measurement

---

**duck-cli — Desktop AI agent. Autonomous. Multi-model. Self-improving.**
