# 🦆 duck-cli v0.8.0

> **OpenClaw Super Agent** — An agent for agents. duck-cli acts as a co-pilot wrapper around OpenClaw, exposing AI Council deliberation, agent mesh networking, plant monitoring (CannaAI), and Android phone control as ACP tools that any OpenClaw gateway can call.

[![GitHub](https://img.shields.io/github/stars/Franzferdinan51/duck-cli?style=social)](https://github.com/Franzferdinan51/duck-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)
[![Go](https://img.shields.io/badge/Go-1.21+-blue.svg)](https://go.dev/)

---

## 🏗️ Architecture — Super Agent for OpenClaw

duck-cli is NOT a standalone chat bot. It's a **super agent** that attaches to an OpenClaw gateway and provides backend services to whatever agent it's connected to.

```
┌──────────────────────────────────────────────────────────────┐
│                    TELEGRAM (Human)                          │
└─────────────────────────────┬────────────────────────────────┘
                              │
                     OpenClaw Gateway
                     (handles Telegram)
                              │
            ┌─────────────────┼─────────────────┐
            │                 │                 │
      delegates work    shares context    receives reports
            │                 │                 │
            ▼                 ▼                 ▼
┌─────────────────────────────────────────────────────────────┐
│              🦆 duck-cli — Super Agent                      │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  🤖 META-AGENT ORCHESTRATION                        │  │
│  │  ├── Orchestrator (task routing + planning)         │  │
│  │  ├── Subconscious (background reasoning daemon)     │  │
│  │  ├── Meta-Critic (quality assurance)                │  │
│  │  └── Meta-Learner (experience + improvements)       │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐          │
│  │ AI Council  │ │ Agent Mesh  │ │  CannaAI    │          │
│  │ :3003       │ │  :4000      │ │   :3000     │          │
│  │ 7-model     │ │  networking │ │  plant mon  │          │
│  └─────────────┘ └─────────────┘ └─────────────┘          │
│                                                             │
│  ┌─────────────┐ ┌─────────────────────────────────────┐  │
│  │Phone Control│ │ ACP Bridge (WebSocket)                │  │
│  │ADB :40835  │ │ ← connects to OpenClaw gateway       │  │
│  └─────────────┘ └─────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

**Key distinction:**
- **OpenClaw** handles the conversation, memory, and user relationship (Telegram)
- **duck-cli** handles the heavy backend: deliberation, plant analysis, Android control, mesh networking

---

## ⚡ Quick Start

### Attach to OpenClaw Gateway

```bash
# Attach to a local OpenClaw gateway
./duck attach ws://localhost:18789

# Attach to Mac's OpenClaw gateway (from Android/Termux)
./duck attach ws://100.68.208.113:18789

# Check connection status
./duck attach --status

# Detach
./duck attach --detach
```

### Standalone Mode (no gateway)

```bash
# Interactive shell
./duck shell

# Run a task
./duck run "what is the capital of Japan?"

# Quick inference
./duck infer "Explain quantum computing"
```

---

## 🧠 AI Council — Multi-Model Deliberation

Routes complex decisions through 7 specialist groups in parallel, then synthesizes a verdict.

**Server:** `http://localhost:3003` (shared with AgentTeams)

```bash
# Standard deliberation (single model)
./duck council "should I switch my cannabis plants to flower?"

# Multi-model deliberation (7 specialist groups)
./duck council "should I switch to flower?" --mode multi
```

**7 Specialist Groups:**
| Group | Model | Purpose |
|-------|-------|---------|
| Leadership | qwen3.6-35b | Strategic direction |
| Security | SuperGemma uncensored | Risk assessment |
| Technical | qwen3.5-0.8b | Implementation feasibility |
| Strategy | qwen3.5-9b | Long-term planning |
| Cannabis | qwen3.6-35b | Plant expertise |
| Analysts | qwen3.5-0.8b | Data review |
| Special | SuperGemma uncensored MLX | Edge cases |

---

## 🌿 Plant Monitoring — CannaAI

Plant health analysis via vision AI.

**Server:** `http://localhost:3000`

```bash
# Check CannaAI server health
./duck plant health

# Analyze plant (requires image)
# Coming: ./duck plant analyze <image>
```

---

## 📱 Android Phone Control — ADB

Control an Android phone via ADB wireless debugging.

**Connection:** `adb connect 100.91.33.100:40835`

```bash
# Connect to phone
adb connect 100.91.33.100:40835

# Screenshot
./duck android screenshot

# Tap at coordinates
./duck android tap 500 500

# Swipe
./duck android swipe up

# Type text
./duck android type "hello world"

# Launch app
./duck android app launch com.whatsapp

# Device info
./duck android devices
./duck android battery
./duck android status

# AI agent loop — describe what you want
./duck android agent "open settings and turn on WiFi"
```

---

## 🌐 Agent Mesh — Inter-Agent Communication

Connect to a mesh network of agents for distributed communication.

**Mesh API:** `http://localhost:4000`

```bash
# List connected agents
./duck mesh list

# Send message to specific agent
./duck mesh send <agent-id> "task complete"

# Broadcast to all agents
./duck mesh broadcast "system update incoming"

# Start mesh server
./duck meshd 4000
```

---

## 🦆 duck attach — Super Agent ACP Client

The `duck attach` command connects duck-cli to any OpenClaw gateway as a peer super-agent.

**Registered ACP Tools (when attached):**
| Tool | Purpose |
|------|---------|
| `duck_council` | AI Council deliberation |
| `duck_mesh_list` | List mesh agents |
| `duck_mesh_send` | Send message to agent |
| `duck_mesh_broadcast` | Broadcast to all agents |
| `duck_plant_analyze` | Plant health analysis |
| `duck_plant_health` | Plant server status |
| `duck_phone_screenshot` | Phone screenshot |
| `duck_phone_tap` | Tap at coordinates |
| `duck_phone_swipe` | Swipe gesture |
| `duck_phone_type` | Type text |
| `duck_phone_launch` | Launch app |
| `duck_status` | Agent status |

---

## 🔧 Configuration

```bash
# Copy and edit environment
cp .env.example .env

# Required keys in .env:
MINIMAX_API_KEY=your_key          # MiniMax API
LMSTUDIO_URL=http://localhost:1234  # LM Studio (local)
AI_COUNCIL_URL=http://localhost:3003  # AI Council
CANNAAI_URL=http://localhost:3000     # Plant monitoring
MESH_URL=http://localhost:4000        # Agent mesh
```

---

## 🗂️ All Commands

### Super Agent (OpenClaw Integration)
| Command | Description |
|---------|-------------|
| `./duck attach <ws://gateway>` | Attach to OpenClaw gateway as super agent |
| `./duck attach --status` | Show connection status |
| `./duck attach --detach` | Detach from gateway |

### Core
| Command | Description |
|---------|-------------|
| `./duck run "task"` | Run a task |
| `./duck shell` | Interactive TUI shell |
| `./duck infer "prompt"` | Quick inference |
| `./duck status` | Show agent status |
| `./duck providers` | List AI providers |

### AI Systems
| Command | Description |
|---------|-------------|
| `./duck council "question"` | AI Council deliberation |
| `./duck council "?" --mode multi` | Multi-model deliberation |
| `./duck subconscious [cmd]` | Subconscious daemon control |
| `./duck kairos [mode]` | Proactive heartbeat (enable/disable/balanced/aggressive) |
| `./duck rl [action]` | OpenClaw-RL self-improvement |

### Agent Mesh & Networking
| Command | Description |
|---------|-------------|
| `./duck mesh list` | List mesh agents |
| `./duck mesh send <id> <msg>` | Send message to agent |
| `./duck mesh broadcast <msg>` | Broadcast to all agents |
| `./duck meshd [port]` | Start mesh server (default 4000) |

### Android Control (ADB)
| Command | Description |
|---------|-------------|
| `./duck android devices` | List connected devices |
| `./duck android status` | Device info (model, battery, screen) |
| `./duck android screenshot` | Capture screen |
| `./duck android tap <x> <y>` | Tap at coordinates |
| `./duck android swipe <dir>` | Swipe (up/down/left/right) |
| `./duck android type "text"` | Type text |
| `./duck android press <key>` | Key (enter/back/home/power) |
| `./duck android app launch <pkg>` | Launch app |
| `./duck android app kill <pkg>` | Force-stop app |
| `./duck android battery` | Battery level |
| `./duck android notifications` | Recent notifications |
| `./duck android agent "task"` | AI agent loop (Perceive → Reason → Act) |
| `./duck android find "text"` | Find element and tap |
| `./duck android dump` | UI hierarchy (XML) |
| `./duck android screen` | OCR-style text reading |

### Plant Monitoring
| Command | Description |
|---------|-------------|
| `./duck plant health` | CannaAI server status |
| `./duck plant analyze <image>` | Analyze plant health (via CannaAI) |

### Memory & Sessions
| Command | Description |
|---------|-------------|
| `./duck memory remember "fact"` | Store in memory |
| `./duck memory recall "query"` | Search memory |
| `./duck memory stats` | Memory statistics |
| `./duck history` | Show conversation history |
| `./duck clear` | Clear history |

### Meta-Agent
| Command | Description |
|---------|-------------|
| `./duck meta plan "task"` | Preview plan (no execution) |
| `./duck meta run "task"` | Full execution with Planner → Critic → Healer → Learner |
| `./duck meta learnings` | Show lessons from past sessions |

### Subagents & Teams
| Command | Description |
|---------|-------------|
| `./duck agent list` | List active subagents |
| `./duck agent spawn "task"` | Spawn new subagent |
| `./duck buddy [action]` | Buddy companion (hatch/list/stats/reroll) |
| `./duck team [action]` | Multi-agent teams (create/spawn/status/list/swarm) |

### Protocol Servers
| Command | Description |
|---------|-------------|
| `./duck mcp [port]` | MCP server (default 3850) |
| `./duck mcp --stdio` | MCP with stdio transport |
| `./duck acp [type]` | Spawn ACP agent (codex/claude/pi/gemini) |
| `./duck acp-server [port]` | ACP server (default 18794) |
| `./duck ws [port]` | WebSocket server |
| `./duck unified` | All protocols: MCP + ACP + WS |

### Scheduling
| Command | Description |
|---------|-------------|
| `./duck cron list` | List cron jobs |
| `./duck cron enable <id>` | Enable job |
| `./duck cron disable <id>` | Disable job |
| `./duck cron run <id>` | Run immediately |

### Skills & Tools
| Command | Description |
|---------|-------------|
| `./duck skills list` | List skills |
| `./duck skills search <query>` | Search skills |
| `./duck skills install <name>` | Install skill |
| `./duck skills info <name>` | Show skill details |
| `./duck tools list` | List available tools |
| `./duck tools search <query>` | Search tools |

### Models & Inference
| Command | Description |
|---------|-------------|
| `./duck models list` | List configured models |
| `./duck models status` | Show model configuration |
| `./duck models set <model>` | Set default model |
| `./duck models scan` | Scan OpenRouter free models |

### MiniMax Platform
| Command | Description |
|---------|-------------|
| `./duck mmx` | Interactive MiniMax menu |
| `./duck mmx text chat --message "Hi"` | Text generation |
| `./duck mmx image "prompt"` | Image generation |
| `./duck mmx speech synthesize --text "Hi" --out hi.mp3` | Text-to-speech |
| `./duck mmx video generate --prompt "Sunset"` | Video generation |
| `./duck mmx music generate --prompt "Pop" --out song.mp3` | Music generation |
| `./duck mmx vision photo.jpg` | Image understanding |
| `./duck mmx search "query"` | Web search |
| `./duck mmx sync` | Sync API key to mmx config |

### System
| Command | Description |
|---------|-------------|
| `./duck health` | System health check |
| `./duck doctor` | Diagnostics |
| `./duck update` | Update duck-cli |
| `./duck backup [create\|verify]` | Backup management |
| `./duck secrets [set\|get\|list]` | Secrets management |
| `./duck config [key] [value]` | Configuration |
| `./duck trace [enable\|view]` | Execution traces |
| `./duck security audit` | Security audit |

### Other
| Command | Description |
|---------|-------------|
| `./duck web [port]` | Web UI (default 3001) |
| `./duck gateway [port]` | Gateway API (default 18792) |
| `./duck voice "text"` | Text-to-speech |
| `./duck sync [action]` | Sync & watch |
| `./duck souls` | SOUL registry (AI personas) |
| `./duck --version` | Show version |
| `./duck --help` | Show all commands |

---

## 🔌 Service Ports

| Service | Port | Description |
|---------|------|-------------|
| AI Council | 3003 | Multi-model deliberation (shared with AgentTeams) |
| CannaAI | 3000 | Plant monitoring server |
| Agent Mesh | 4000 | Inter-agent communication |
| MCP Server | 3850 | Model Context Protocol |
| ACP Server | 18794 | Agent Client Protocol |
| Gateway | 18792 | Duck Gateway API |
| Chat Agent | 18797 | Duck Chat Agent HTTP |
| Web UI | 3001 | Duck Web Interface |

---

## 📂 Project Structure

```
duck-cli/
├── src/
│   ├── cli/                    # CLI commands
│   │   ├── main.ts               # Command router
│   │   ├── attach-cmd.ts        # duck attach (super-agent ACP client)
│   │   └── mesh-cmd.ts         # duck mesh commands
│   ├── agent/                   # Core agent
│   │   └── core.ts              # Main agent implementation
│   ├── bridge/                  # ACP/MCP bridges
│   │   ├── acp-bridge.ts        # ACP protocol bridge
│   │   ├── websocket-bridge.ts  # WebSocket connection
│   │   └── bridge-manager.ts    # Bridge orchestration
│   ├── orchestrator/           # Meta-agent system
│   │   ├── core.ts              # Main orchestrator
│   │   ├── meta-agent.ts        # Meta-agent implementation
│   │   └── council-bridge.ts   # AI Council integration
│   ├── council/                # AI Council client
│   │   └── client.ts            # Council deliberation client
│   ├── providers/              # AI providers
│   │   ├── manager.ts           # Multi-provider routing
│   │   ├── lmstudio.ts         # LM Studio local models
│   │   └── minimax.ts          # MiniMax API
│   ├── mesh/                   # Agent mesh networking
│   ├── subconscious/           # Background reasoning daemon
│   ├── skills/                 # Skill marketplace
│   └── commands/               # CLI command implementations
├── cmd/duck/                   # Go CLI wrapper
│   └── main.go
└── duck-dist/                  # Built duck binary (Go)
```

---

## ⚠️ Known Notes

- **Super Agent mode**: `duck attach` connects duck-cli to OpenClaw as a peer agent — this is the primary mode for OpenClaw integration
- **Phone connection**: ADB wireless debugging on `100.91.33.100:40835`
- **AI Council**: Uses port 3003 (shared with AgentTeams), not the old port 3001
- **Services must be running**: CannaAI (:3000), AI Council (:3003), Agent Mesh (:4000) need to be started separately

---

## 🔗 Related Projects

| Repo | Purpose |
|------|---------|
| **[AgentTeams](https://github.com/Franzferdinan51/AgentTeams)** | Multi-agent orchestration framework (shares AI Council with duck-cli) |
| **[CannaAI](https://github.com/Franzferdinan51/CannaAI)** | Cannabis plant monitoring AI |
| **[OpenClaw](https://github.com/openclaw/openclaw)** | ACP/MCP protocols, Skills system |
| **[duck-cli](https://github.com/Franzferdinan51/duck-cli)** | This repo — Super Agent for OpenClaw |

---

## 🦆 Powered By

- **[OpenClaw](https://github.com/openclaw/openclaw)** — ACP/MCP protocols, Skills system
- **[MiniMax](https://www.minimax.io/)** — Fast reasoning API
- **[LM Studio](https://lmstudio.ai/)** — Local LLM inference
- **[Kimi/Moonshot](https://platform.moonshot.cn/)** — Vision + coding
- **[Gemma 4](https://ai.google.dev/)** — Android-trained local model

---

**🦆 duck-cli — Super Agent for OpenClaw. An agent for agents.**
