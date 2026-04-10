# 🦆 duck-cli v0.6.1

> **Desktop AI Agent** — A rival to Claude Code, Letta Code, and OpenAI Codex. Desktop AI agent with LLM-powered Meta-Agent Orchestrator, AI Council deliberation, persistent memory, multi-provider routing (MiniMax/LM Studio/Kimi/GPT/OpenRouter), agent-mesh communication bus, and 16 built-in tools. Runs on Mac/PC/Linux/Android.

[![GitHub](https://img.shields.io/github/stars/Franzferdinan51/duck-cli?style=social)](https://github.com/Franzferdinan51/duck-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)
[![Go](https://img.shields.io/badge/Go-1.21+-blue.svg)](https://go.dev/)
[![Version](https://img.shields.io/badge/version-0.6.1-yellow.svg)]()

---

## ⚡ Quick Start

```bash
# 1. Clone and build
git clone https://github.com/Franzferdinan51/duck-cli.git
cd duck-cli && npm install && npm run build

# 2. Configure (add your API keys)
cp .env.example .env
# Edit .env → MINIMAX_API_KEY=your_key

# 3. Run a task
./duck run "what is the capital of Japan?"

# 4. Check status
./duck status
./duck providers

# 5. Interactive shell
./duck shell

# 6. Start web UI
./duck web 3001
```

**Android (optional):**
```bash
adb connect 192.168.1.251:5555   # Your Android phone
./duck android devices
./duck android agent "open settings"
```

---

## 🗂️ All Commands

### Core
| Command | Description |
|---------|-------------|
| `./duck run "task"` | Run a task (auto-routes to best provider) |
| `./duck shell` | Interactive TUI shell |
| `./duck status` | Show agent status and providers |
| `./duck providers` | List available AI providers |
| `./duck setup` | Interactive API key configuration wizard |
| `./duck think` | Reasoning mode |
| `./duck stats` | Show usage statistics |
| `./duck tools [list\|schema\|search]` | List and search tool registry |

### Meta-Agent v3 (LLM-Powered Orchestration)
| Command | Description |
|---------|-------------|
| `./duck meta plan "task"` | Preview what duck-cli would do (no execution) |
| `./duck meta run "task"` | Full execution with Planner → Critic → Healer → Learner |
| `./duck meta learnings` | Show lessons from past sessions |

### AI Systems
| Command | Description |
|---------|-------------|
| `./duck council "question"` | Ask the AI Council (deliberation) |
| `./duck kairos [mode]` | KAIROS proactive AI (enable/disable/aggressive/balanced/conservative) |
| `./duck subconscious [cmd]` | Sub-Conscious control (daemon/status/stats/whisper/recall/council) |

### Agent Mesh & Networking
| Command | Description |
|---------|-------------|
| `./duck mesh [action]` | Agent Mesh networking (list/register/broadcast/send/inbox) |
| `./duck meshd [port]` | Start built-in mesh server daemon (default port 4000) |
| `./duck chat-agent start` | Start Duck Chat Agent HTTP server (default port 18797) |
| `./duck gateway [port]` | Start Duck Gateway API (default port 18792) |

### Protocol Servers
| Command | Description |
|---------|-------------|
| `./duck mcp [port]` | Start MCP server (default port 3850) |
| `./duck mcp --stdio` | MCP with stdio transport (LM Studio / Claude Desktop) |
| `./duck acp [type]` | Spawn ACP agent (codex/claude/pi/gemini) |
| `./duck acp-server [port]` | Start ACP server (default port 18794) |
| `./duck unified` | Start all protocols: MCP + ACP + WS + Gateway |

### Scheduling & Automation
| Command | Description |
|---------|-------------|
| `./duck cron list` | List all cron jobs |
| `./duck cron enable <id>` | Enable a cron job |
| `./duck cron disable <id>` | Disable a cron job |
| `./duck cron run <id>` | Run a cron job immediately |

### Memory & Sessions
| Command | Description |
|---------|-------------|
| `./duck memory` | Memory system commands |
| `./duck memory remember "fact"` | Store a fact in memory |
| `./duck memory recall "query"` | Search memory |

### Subagents
| Command | Description |
|---------|-------------|
| `./duck agent list` | List active subagents |
| `./duck agent spawn "task"` | Spawn a new subagent |
| `./duck buddy [action]` | Buddy companion (hatch/list/stats/reroll) |
| `./duck team [action]` | Multi-agent teams (create/spawn/status/list) |

### Android Control (ADB)
| Command | Description |
|---------|-------------|
| `./duck android devices` | List connected Android devices |
| `./duck android status` | Device status (model, battery, screen) |
| `./duck android screenshot` | Capture screen |
| `./duck android screen` | Read visible text (OCR-style) |
| `./duck android dump` | Dump UI hierarchy (XML) |
| `./duck android find "text"` | Find element and tap |
| `./duck android tap <x> <y>` | Tap at coordinates |
| `./duck android swipe <dir>` | Swipe (up/down/left/right) |
| `./duck android type "text"` | Type text |
| `./duck android press <key>` | Key (enter/back/home/recent/power) |
| `./duck android app launch <pkg>` | Launch app |
| `./duck android app kill <pkg>` | Force-stop app |
| `./duck android battery` | Battery level |
| `./duck android notifications` | Recent notifications |
| `./duck android agent "task"` | 🦆 AI agent loop (Perceive → Reason → Act) |
| `./duck android analyze` | Full vision pipeline: screenshot + UI + app + battery |

### Web & Desktop
| Command | Description |
|---------|-------------|
| `./duck web [port]` | Start Duck Web UI (default port 3001) |
| `./duck desktop` | Desktop control |
| `./duck voice "text"` | Text-to-speech with MiniMax |
| `./duck speak "text"` | Text-to-speech with MiniMax |

### Browser & Sandbox
| Command | Description |
|---------|-------------|
| `./duck browser status` | Check BrowserOS status |
| `./duck browser start` | Start BrowserOS |
| `./duck browser open <url>` | Open tab |
| `./duck browser navigate <url>` | Navigate current tab |
| `./duck browser click <element>` | Click element |
| `./duck browser type <text>` | Type text |
| `./duck browser screenshot` | Take screenshot |
| `./duck browser snapshot` | Take accessibility snapshot |
| `./duck sandbox list` | List sandboxes |
| `./duck sandbox explain <url>` | Summarize page elements |
| `./duck sandbox open <url>` | Open URL in sandbox |

### Models & Inference
| Command | Description |
|---------|-------------|
| `./duck models list` | List configured models |
| `./duck models status` | Show model state |
| `./duck models set <model>` | Set default model |
| `./duck models scan` | Scan OpenRouter free models |
| `./duck models aliases` | Manage model aliases |
| `./duck models fallbacks` | Manage fallback chains |
| `./duck models auth` | Manage auth profiles |
| `./duck infer "<prompt>"` | Quick inference |
| `./duck capability list` | List inference capabilities |
| `./duck capability test <model>` | Test a model |

### Security & System
| Command | Description |
|---------|-------------|
| `./duck security audit` | Run security audit |
| `./duck security defcon` | Show DEFCON level |
| `./duck health` | Check system health |
| `./duck doctor` | Run system diagnostics |
| `./duck update [check\|install]` | Update Duck CLI |
| `./duck trace [enable\|view]` | Execution traces |
| `./duck backup [create\|verify\|restore\|list\|prune]` | Backup management |
| `./duck secrets [set\|get\|list\|show\|delete\|tags]` | Secure secrets management |
| `./duck config [key] [value]` | Manage Duck CLI configuration |

### Workflows & Flows
| Command | Description |
|---------|-------------|
| `./duck workflow <file>` | Execute JSON workflow |
| `./duck workflow <file> --flow` | Execute YAML flow (deterministic, no LLM) |
| `./duck flow <file>` | Execute JSON flow |

### Skills & Marketplace
| Command | Description |
|---------|-------------|
| `./duck skills list` | List all skills |
| `./duck skills search <query>` | Search skills |
| `./duck skills install <name>` | Install a skill |
| `./duck skills info <name>` | Show skill details |
| `./duck skills update` | Update all skills |
| `./duck skills uninstall <name>` | Uninstall a skill |
| `./duck clawhub` | ClawHub skill marketplace |

### Sync & Integrations
| Command | Description |
|---------|-------------|
| `./duck sync [action]` | Sync & watch (watch/status/openclaw/github/tandem) |
| `./duck rl [action]` | OpenClaw-RL self-improvement |
| `./duck channels` | Start Telegram/Discord channels |
| `./duck souls` | SOUL registry — AI personas |

### Other
| Command | Description |
|---------|-------------|
| `./duck config [key] [value]` | Manage Duck CLI configuration |
| `./duck trace list` | List execution traces |
| `./duck trace view <id>` | View a trace |
| `./duck --version` | Show version |
| `./duck --help` | Show all commands |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────┐
│              You (CLI / Telegram / Web)              │
└──────────────────────────┬──────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────┐
│              CHAT AGENT (port 18797)                 │
│         MiniMax M2.7 · Session memory                │
│    HTTP API: /chat, /chat/stream, /providers         │
└──────────────────────────┬──────────────────────────┘
                           │
              ┌────────────┴────────────┐
              │                         │
        Simple task              Complex task
              │                         │
              ▼                         ▼
      Direct Response          ┌───────────────────────────┐
                                │        AI COUNCIL         │
                                │  (45 deliberative agents) │
                                │  mode: decision/research/  │
                                │         prediction/swarm  │
                                └─────────────┬─────────────┘
                                              │ APPROVE / REJECT
                                              ▼
                              ┌───────────────────────────────┐
                              │     META-AGENT ORCHESTRATOR    │
                              │   plan → run → learnings       │
                              │   Planner → Critic → Healer   │
                              └─────────────┬─────────────────┘
                                            │
                                            ▼
                              ┌───────────────────────────────┐
                              │           TOOLS (16)           │
                              │  exec · file · desktop · web   │
                              │  memory · android · shell ⚠️  │
                              └───────────────────────────────┘
```

**Model Assignments by Component:**
| Component | Model | Provider | Purpose |
|-----------|-------|----------|---------|
| **Chat Agent** | MiniMax-M2.7 | MiniMax | Primary user-facing chat |
| **Orchestrator** | qwen3.5-0.8b | LM Studio | Fast task routing (complexity ≤2) |
| **Bridge** | qwen3.5-0.8b | LM Studio | ACP/MCP protocol handling |
| **Subconscious** | qwen3.5-9b | LM Studio | Whisper generation & analysis |
| **Security** | N/A | N/A | RegExp-based scanning (no LLM) |

**Provider routing:**
| Provider | Best For | Models |
|----------|----------|--------|
| **LM Studio** | Free local, fast | qwen3.5-0.8b, qwen3.5-9b |
| **MiniMax** | Fast general, coding | MiniMax-M2.7, glm-5 |
| **OpenRouter** | Free tier | qwen/qwen3.6-plus-preview:free |
| **Kimi** | Vision, coding | kimi-k2.5 |
| **OpenClaw Gateway** | Free vision | kimi-k2.5 (via WebSocket) |

**Architecture model assignments:**
| Component | Model | Notes |
|-----------|-------|-------|
| Chat Agent | MiniMax-M2.7 | Primary conversational layer |
| Orchestrator | qwen3.5-0.8b | LM Studio, fast local planning |
| Bridge | qwen3.5-0.8b | LM Studio, inter-service communication |
| Subconscious | qwen3.5-9b | LM Studio, whisper monitoring daemon |
| Security | N/A | RegExp-based pattern matching, no LLM |
| AI Council | MiniMax-M2.7 / qwen3.5-9b | Deliberative agents on-demand |

**Notes:**
- SecurityAgent is **on-demand only** (not auto-spawned) to save RAM
- qwen3.5-0.8b auto-spawns for fast tasks when LM Studio is available
- ACP Server currently ignores `model` parameter from spawn messages (known issue)

---

## 🚀 Full Setup

```bash
# 1. Clone and build
git clone https://github.com/Franzferdinan51/duck-cli.git
cd duck-cli && npm install && npm run build

# 2. Configure API keys
cp .env.example .env
# Edit .env → MINIMAX_API_KEY=your_key

# 3. Start the mesh server (optional, for multi-agent)
./duck meshd 4000

# 4. Start Chat Agent (conversational layer)
./duck chat-agent start --port 18797

# 5. Start Telegram bot (connects to @AgentSmithsbot)
./duck telegram start

# Or run everything together:
# Terminal 1: Mesh server     → ./duck meshd 4000
# Terminal 2: Chat Agent     → ./duck chat-agent start --port 18797
# Terminal 3: Telegram bot    → ./duck telegram start
# Terminal 4: Duck CLI        → ./duck shell
```

**Environment variables for Chat Agent:**
```bash
export MINIMAX_API_KEY=your_key          # Required
export DUCK_CHAT_PROVIDER=minimax        # minimax | lmstudio | kimi | openai | openrouter
export DUCK_CHAT_MODEL=MiniMax-M2.7     # Model per provider
export MESH_API_KEY=openclaw-mesh-default-key
```

---

## 🧠 Meta-Agent v3

LLM-powered orchestration — the orchestrator itself reasons about how to approach tasks.

```bash
# Preview plan (Planner LLM)
./duck meta plan "build a REST API"

# Full execution
./duck meta run "build a REST API"

# Use free local model
./duck meta run "task" --provider lmstudio

# Show lessons from past sessions
./duck meta learnings
```

**How it works:**
```
Task → MetaPlanner (LLM) → Structured Plan
                          ↓
              MetaCritic evaluates each step
                          ↓
              MetaHealer diagnoses failures + recovery
                          ↓
              MetaLearner logs to ./experiences/
```

---

## 🤖 AI Council

Complex decisions trigger **AI Council deliberation** — multiple AI agents debate and return a verdict.

```bash
# Ask a question
./duck council "should I upgrade all dependencies at once?"

# Modes: decision (default) | research | prediction | swarm
./duck council "what are the risks?" --mode research
```

**Council triggers automatically:**
- Complexity score >= 7
- Ethical keywords: "should i", "privacy", "hack", "illegal"
- High-stakes keywords: "money", "security", "delete everything"

---

## 🌊 KAIROS — Proactive Heartbeat

Continuous monitoring even when you're not interacting.

```bash
./duck kairos status         # Check if running
./duck kairos enable        # Start heartbeat
./duck kairos disable       # Pause
./duck kairos aggressive    # Faster polling
./duck kairos conservative  # Slower, less intrusive
./duck kairos balanced      # Default balanced mode
```

---

## 💾 Memory & Sessions

Every interaction is stored in SQLite and persists across sessions.

```bash
# Remember a fact
./duck memory remember "project=duck-cli, language=TypeScript"

# Recall a fact
./duck memory recall "project"

# Memory stats
./duck memory stats
```

### Lossless Context Management (LCM)

LCM preserves every message using DAG-based summarization, so no context is ever truly lost.

```bash
# LCM is automatic when enabled via environment:
export LCM_ENABLED=true
export LCM_FRESH_TAIL_COUNT=64
export LCM_LEAF_CHUNK_TOKENS=20000
```

**How it works:**
- Older messages are compacted into summaries (DAG nodes)
- Recent messages stay in the fresh tail
- Model always gets summaries + fresh tail within token budget
- Summaries are searchable with `grepSummaries()`

---

## ⏰ Scheduling

```bash
./duck cron list            # Show all jobs
./duck cron enable <id>     # Enable a job
./duck cron disable <id>    # Disable a job
./duck cron run <id>        # Run immediately
```

**Built-in cron jobs:** health-check, memory-check, auto-heal, backup, morning-check, evening-check, portfolio, price-alert, briefing, daily-weather, and more.

---

## 📱 Android Agent

Control your Android phone via ADB.

```bash
# Connect
adb connect 192.168.1.251:5555
./duck android devices

# AI agent loop — perceive → reason → act
./duck android agent "open WhatsApp"
./duck android agent "go home"
./duck android agent "open settings and turn on WiFi"

# Direct control
./duck android screenshot
./duck android screen          # OCR-style text reading
./duck android dump            # UI hierarchy
./duck android find "Settings" # Find + tap
./duck android tap 500 300
./duck android swipe up
./duck android type "hello"
```

---

## 🌐 Protocol Servers

**MCP (Model Context Protocol):**
```bash
./duck mcp 3850                   # Start on port 3850
./duck mcp --stdio                # stdio transport (LM Studio, Claude Desktop)
./duck mcp connect -- python3 /path/to/mcp-server.py
```

**WebSocket / Gateway:**
```bash
./duck gateway 18792              # Duck Gateway API
./duck web 3001                   # Web UI
```

**All protocols at once:**
```bash
./duck unified                    # MCP + ACP + WS + Gateway
```

---

## 📂 Project Structure

```
duck-cli/
├── src/
│   ├── agent/                     # Core agent, tools, session store
│   ├── orchestrator/             # Hybrid Orchestrator v2
│   │   ├── task-complexity.ts      # 1-10 scoring
│   │   ├── model-router.ts          # Task → best model
│   │   ├── council-bridge.ts        # AI Council
│   │   └── hybrid-core.ts           # Main loop
│   ├── providers/                # MiniMax, LM Studio, Kimi, OpenRouter, OpenClaw
│   ├── subconscious/             # Whisper monitoring
│   ├── kairos/                   # Proactive heartbeat
│   ├── mesh/                     # Agent mesh networking
│   ├── skills/                   # Skill marketplace
│   ├── tools/                    # Tool implementations
│   └── commands/                 # CLI command handlers
├── cmd/duck/                    # Go CLI wrapper
│   └── main.go
├── docs/                        # Architecture docs
│   ├── META-AGENT-SYSTEM-PROMPT.md
│   ├── ARCHITECTURE.md
│   ├── COUNCIL-INTEGRATION.md
│   ├── MODEL-ROUTING.md
│   └── ... (21 docs total)
└── tools/                       # Standalone tools
```

---

## ⚠️ Known Architecture Notes

- **SecurityAgent is on-demand only** — not auto-spawned; triggered by specific keywords
- **Three complexity scoring systems exist:** `scoreComplexity()` (chat-agent.ts:640), `classifyTaskForOrchestration()` (chat-agent-orchestrator.ts:183), and `analyzeTask()` (task-complexity.ts:278)
- **ACP Server ignores model parameter** — passes model to provider but provider ignores it (uses default model)
- **Duplicate fast-path code in chat-agent.ts** — both the orchestration path and direct path have overlapping fast-path logic that could be consolidated

---

## 🔗 Related Projects

| Repo | Purpose |
|------|---------|
| **[duck-cli](https://github.com/Franzferdinan51/duck-cli)** | **Main repo** — desktop AI agent |
| **[droidclaw](https://github.com/Franzferdinan51/droidclaw)** | Bun-based Android agent |
| **[Open-WebUi-Lobster-Edition](https://github.com/Franzferdinan51/Open-WebUi-Lobster-Edition)** | OpenWebUI fork with generative UI |
| **[AI-Bot-Council-Concensus](https://github.com/Franzferdinan51/AI-Bot-Council-Concensus)** | Multi-agent deliberation |
| **[RS-Agent-Skill-Lobster-Edition](https://github.com/Franzferdinan51/RS-Agent-Skill-Lobster-Edition)** | RuneScape API toolkit |

---

## 🦆 Powered By

- **[OpenClaw](https://github.com/openclaw/openclaw)** — ACP/MCP protocols, Skills system
- **[MiniMax](https://www.minimax.io/)** — Fast reasoning API
- **[LM Studio](https://lmstudio.ai/)** — Local LLM inference
- **[Kimi/Moonshot](https://platform.moonshot.cn/)** — Vision + coding
- **[Gemma 4](https://ai.google.dev/)** — Android-trained local model
- **[Pretext](https://github.com/chenglou/pretext)** — Canvas text measurement

---

**🦆 duck-cli — Desktop AI agent. Autonomous. Multi-model. Self-improving.**
