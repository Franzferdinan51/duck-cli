# 🦆 Duck Agent CLI

**An agent for agents** — a unified AI agent command center with multi-agent orchestration, built-in security, and cross-platform capabilities.

> *"An agent's toolbelt — standardized MCP/ACP tools, multi-agent coordination, and a 137-skill marketplace, all in one binary."*

## Core Philosophy

Duck Agent runs as a **standalone binary** (Mac/Linux/Windows) that wraps AI models with tool access, memory, scheduling, and agent orchestration. It's designed primarily as a **backend system that AI agents call** — but also works great from CLI.

## Quick Start

```bash
# Install
git clone https://github.com/Franzferdinan51/duck-cli.git && cd duck-cli
go build -o duck ./cmd/duck/ && sudo mv duck /usr/local/bin/

# Run
duck run "fix my authentication bug"
duck council "Should we use PostgreSQL or MongoDB?"
duck kairos aggressive  # make it proactive
duck web              # spin up web UI
```

## Provider Setup

```bash
export MINIMAX_API_KEY=sk-...          # Kimi/MiniMax
export OPENROUTER_API_KEY=sk-or-...    # OpenRouter
export KIMI_API_KEY=sk-...           # Kimi direct
export DUCK_PROVIDER=minimax          # Default provider
```

## Commands

### 🧠 AI Models & Routing
| Command | Description |
|---------|-------------|
| `duck run [task]` | Smart routing — picks best model automatically |
| `duck status` | Show 137 skills, 39 tools, 4 providers |
| `duck model [name]` | Switch model mid-session |
| `duck think [prompt]` | Reasoning mode (no tool use) |

### 🏛️ AI Council
| Command | Description |
|---------|-------------|
| `duck council [mode] [topic]` | Local deliberation (no server needed) |
| `duck council legislative "motion"` | Vote-based decision |
| `duck council research "topic"` | Investigation mode |
| `duck council prediction "event"` | Probability estimate |

### 🤖 Agent Systems
| Command | Description |
|---------|-------------|
| `duck agent list` | List running agents |
| `duck agent spawn [type]` | Spawn new agent |
| `duck agent spawn_team [n] [type]` | Spawn N agents in parallel |
| `duck buddy hatch` | Initialize AI buddy system |
| `duck buddy list` | List AI buddies |
| `duck team create [name]` | Create agent team |
| `duck mesh status` | Agent Mesh network status |
| `duck rl status` | Reinforcement learning status |

### 🔧 MCP & Protocols
| Command | Description |
|---------|-------------|
| `duck mcp` | Start MCP server (39 tools) |
| `duck gateway` | Start REST API gateway |
| `duck unified` | Start all protocols at once |
| `duck acp-server` | ACP agent server |

### 🌐 Web & UI
| Command | Description |
|---------|-------------|
| `duck web` | DuckWebAgent web UI (port 3001) |
| `duck kairos [mode]` | KAIROS proactive AI engine |
| `duck kairos aggressive` | Aggressive monitoring mode |
| `duck subconscious` | Self-reflection system |

### 🎙️ Voice & TTS
| Command | Description |
|---------|-------------|
| `duck voice [text]` | Text-to-speech (MiniMax) |
| `duck speak [text]` | Alias for voice |
| `duck tts [text]` | Alias for voice |

### 🔍 Diagnostics & Security
| Command | Description |
|---------|-------------|
| `duck doctor` | System diagnostics (API keys, services, deps) |
| `duck security defcon` | DEFCON security mode |
| `duck security audit` | Security audit |
| `duck cron list` | List scheduled jobs |
| `duck cron add [spec] [cmd]` | Add cron job |

### 💾 Memory & Context
| Command | Description |
|---------|-------------|
| `duck memory status` | Memory system status |
| `duck remember [text]` | Store in memory |
| `duck recall [query]` | Search memory |

### 📦 Skills & Tools
| Command | Description |
|---------|-------------|
| `duck skills list` | List 137 installed skills |
| `duck skills search [query]` | Search skill marketplace |
| `duck clawhub install [name]` | Install from ClawHub |
| `duck skills scan [path]` | Security scan skill code |

### 🐳 Execution & Sandboxing
| Command | Description |
|---------|-------------|
| `duck exec [cmd]` | Execute shell command |
| `duck sandbox [cmd]` | Run in Docker container (isolated) |
| `duck docker build` | Build Docker image |
| `duck desktop [action]` | Desktop control |

### 💬 Channels
| Command | Description |
|---------|-------------|
| `duck channels` | Start all channels |
| `duck channels telegram` | Start Telegram |
| `duck channels discord` | Start Discord |
| `duck telegram` | Alias for channels telegram |
| `duck discord` | Alias for channels discord |

### 🦆 Duck Utilities
| Command | Description |
|---------|-------------|
| `duck update check` | Check for updates |
| `duck shell` | Interactive shell mode |
| `duck --version` | Show version |
| `duck --help` | Show this help |

## Tool System

Duck Agent exposes **39 MCP tools** to agents:

```
execute          - Run shell commands
spawn_agent      - Spawn sub-agent with model/router
spawn_team       - Spawn N agents in parallel  
think_parallel   - Multi-model reasoning
cron_schedule    - Schedule recurring tasks
cron_run_now    - Run job immediately
memory_search   - Search DuckDB memory
memory_write    - Write to memory
mcp_delegate    - Delegate to MCP server
http_request    - Make HTTP requests
browser_navigate - Navigate browser
browser_screenshot - Take screenshot
browser_click   - Click element
tts_generate    - Generate speech
```

## Architecture

```
duck (Go binary)
├── node dist/cli/main.js  ← CLI handler
│   ├── src/agent/core.ts       ← Agent brain
│   ├── src/agent/kairos.ts    ← Proactive AI
│   ├── src/agent/proactive/   ← Automation engine
│   ├── src/agent/learning-loop.ts ← Self-improvement
│   ├── src/council/           ← AI Council deliberation
│   ├── src/mcp/server.ts      ← MCP server (39 tools)
│   ├── src/memory/            ← SQLite + FTS5
│   ├── src/skills/            ← 137 skills
│   └── src/providers/          ← Model routing
├── src/voice/                ← Voice wake + talk
├── src/canvas/               ← Live canvas rendering  
├── src/security/              ← Skill scanner + Docker sandbox
└── src/tools/                 ← MCP tool implementations
```

## Models

| Provider | Model | Best For |
|----------|-------|----------|
| **MiniMax** | MiniMax-M2.7 | Agents, research |
| **Kimi** | kimi-k2.5 | Vision, coding |
| **OpenRouter** | qwen3.6-plus (free) | Budget inference |
| **ChatGPT OAuth** | gpt-5.4 | Premium reasoning |
| **LM Studio** | qwen3-vl-8b (local) | Free vision |

## Key Features

### 🧠 Native AI Council
Local deliberation with 3 councilors (~15s). No external server needed. Vote-based decisions, research, prediction modes.

### 🛰️ Multi-Protocol Support
- **MCP** (Model Context Protocol) — 39 built-in tools
- **ACP** (Agent Communication Protocol) — multi-agent coordination  
- **REST Gateway** — HTTP API for any client
- **WebSocket** — real-time streaming

### 🛡️ Security-First
- **Skills Code Scanner** — scans for dangerous patterns before install
- **Docker Sandbox** — run untrusted tools in isolated containers
- **DEFCON Mode** — threat-level security system
- **Approval Queue** — human-in-the-loop for sensitive ops

### 📈 Self-Improving
- **Learning Loop** — tracks errors, corrections, patterns
- **Memory** — SQLite + FTS5 full-text search
- **Buddy System** — persistent AI companion
- **KAIROS** — proactive monitoring and automation

### 🎨 Live Canvas
- Real-time Canvas rendering via pretext measurement
- AI Council vote panels, consensus meters
- Streaming message pre-measured for perfect fit

### 🗣️ Voice Native
- Wake word detection (platform-aware)
- Voice conversation mode
- MiniMax TTS integration

## Files

```
duck-cli/
├── cmd/duck/main.go          # Go binary wrapper
├── src/
│   ├── agent/               # Agent brain + KAIROS + proactive
│   ├── council/              # AI Council deliberation
│   ├── mcp/                 # MCP server + 39 tools
│   ├── memory/               # SQLite + FTS5 memory
│   ├── providers/            # Model routing
│   ├── skills/               # 137 skills
│   ├── channels/             # Telegram + Discord
│   ├── voice/               # Voice wake + conversation
│   ├── canvas/               # Live Canvas renderer
│   ├── security/            # Scanner + Docker sandbox
│   └── tools/                # Tool implementations
├── web-ui/                  # DuckWebAgent UI
└── duck/                    # Built binary
```

## Configuration

```bash
# Environment variables
MINIMAX_API_KEY=sk-...           # Primary model key
MINIMAX_API_KEY_2=sk-...          # Fallback key  
OPENROUTER_API_KEY=sk-or-...      # OpenRouter
KIMI_API_KEY=sk-...              # Kimi direct
DUCK_PROVIDER=minimax            # Default provider
DUCK_MODEL=MiniMax-M2.7          # Default model
DUCK_MESH_URL=http://...          # Mesh network URL
```

## Status

✅ **Production Ready** — All core features implemented and tested
