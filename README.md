# 🦆 Duck Agent

> **Super AI Agent v0.3.0** — The ultimate personal AI assistant with KAIROS proactive AI, unified gateway, Claude Code tools, autonomous cron automation, multi-agent orchestration, and enterprise-grade security.

[![GitHub](https://img.shields.io/github/stars/Franzferdinan51/duck-cli?style=social)](https://github.com/Franzferdinan51/duck-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)

---

## 🚀 Quick Start

```bash
# Install
git clone https://github.com/Franzferdinan51/duck-cli.git
cd duck-cli
npm install && npm run build

# Start
./start.sh shell        # Interactive shell
./start.sh web          # Web UI (http://localhost:3000)
./start.sh gateway      # Gateway API
./start.sh mcp          # MCP Server
./start.sh cron         # Show cron jobs
./start.sh cron install # Install cron jobs

# Or with Docker
docker-compose up -d
```

---

## ✨ Features

### 🧠 KAIROS Proactive AI
**Always-on AI that acts without being asked**

- 💭 Heartbeat system (checks "anything worth doing?")
- 🎯 Smart decision engine with pattern learning
- 🌙 Auto-dream consolidation (3 AM daily)
- 📝 Append-only action logs
- 🔔 Push notifications
- 🧬 Proactive modes: aggressive, balanced, conservative

### 🚪 Unified Gateway
**Multi-source gateway architecture inspired by OpenClaw, Hermes, NemoClaw**

- 🌐 WebSocket control plane (port 18789)
- 📡 Multi-channel support (Telegram, Discord ready)
- 🔗 Device nodes (macOS, iOS, Android)
- 🛠️ First-class tools: exec, browser, canvas, nodes, cron, sessions

### 🎤 Voice / TTS
**MiniMax speech synthesis built-in**

- Natural voice generation
- Multiple voice styles (narrator, casual, sad)
- 4,000 characters/day quota
- Auto-play on macOS

### 🌐 Web UI
**Full-featured control interface**

- 💬 Chat interface with typing indicators
- 📊 Status dashboard (uptime, cost, tokens)
- 🛠️ Tool browser with categories
- 🎤 Voice panel with quota display
- 🧠 KAIROS controls
- 👥 Team management
- 🏛️ AI Council
- ⏰ Cron scheduler
- 💾 Memory viewer
- ⚙️ Settings panel
- 📋 Log viewer

### 🔌 Deep MCP Server (Streamable HTTP + WebSocket)
**Full MCP 2024-11-05 spec with bidirectional communication**

```bash
duck mcp [port]        # Start MCP server (default: 3848)
duck mcp-connect <url> # Connect to external MCP server
```

**Features:**
- Streamable HTTP (MCP 2024-11-05)
- WebSocket bidirectional
- SSE for server→client push
- 14+ built-in tools (execute, think, remember, recall, desktop_*, kairos_*)
- External MCP server federation

### 🔗 ACP Client (Agent Client Protocol)
**Spawn external coding agents via acpx**

```bash
duck acp codex "fix the bug"  # Spawn Codex session
duck acp claude "review PR"   # Spawn Claude Code
```

**Supports:** codex, claude, cursor, gemini, pi, openclaw, opencode

### 🌐 Bidirectional WebSocket Manager
**Connect IN and OUT**

```bash
duck ws connect <url>  # Connect to external WebSocket
duck ws status        # Show connection status
```

**Features:**
- Server mode (accept connections)
- Client mode (connect externally)
- Auto-reconnection
- Channel-based message routing

### 🦆 Unified Headless Server
**All protocols in one**

```bash
duck unified  # Start MCP + ACP + WebSocket + Gateway
```

Ports:
- MCP: 3848
- ACP Gateway: 18790
- WebSocket: 18791
- Gateway API: 18789

### 🐤 Buddy Companion
**AI companion system with rarities**

- 🥚 Hatch buddies with unique species
- ⭐ Rarity tiers: common, uncommon, rare, epic, legendary
- 🎨 10 species: duck, blob, cat, dragon, owl, ghost, robot, rabbit, cactus, snail
- 💫 Stats: DEBUGGING, PATIENCE, CHAOS, WISDOM, SNARK

### 👥 Multi-Agent Teams
**Coordinated agent groups**

- 🎯 Role-based teams (code review, research, swarm)
- 🤖 Spawn workers for parallel execution
- 📊 Task coordination and result aggregation
- 🔄 Session management

### 🏛️ AI Council
**Deliberative decision making**

- ⚖️ Multiple councilors with specializations
- 🎤 Speaker (facilitator)
- 🔬 Technocrat (technical analysis)
- ⚖️ Ethicist (moral reasoning)
- 🎯 Pragmatist (practical focus)
- 🤔 Skeptic (critical analysis)
- 🛡️ Sentinel (risk assessment)

### ⏰ Cron Automation
**30+ predefined automation jobs**

| Category | Jobs |
|---------|------|
| **System** | health-check, memory-check, auto-heal, backup, failure-recover |
| **Grow** | morning/evening-check, threshold-alert, watering, harvest, monthly-report |
| **Crypto** | portfolio, price-alert, whale-watch, defi-health, news-scan |
| **OSINT** | briefing, keyword-alert, account-watch, github-watch, reddit-digest |
| **News** | daily-brief |
| **Weather** | daily-weather |
| **Home** | equipment-monitor |

### 🔄 Update System
**Multi-source update compatibility**

```bash
duck update check     # Check for updates
duck update install  # Install latest
duck update backup   # Create backup
duck update restore  # Restore from backup
duck update status  # Git status
```

Sources: OpenClaw (primary), Claude Code, Hermes-Agent, NemoClaw, Codex

### 🛠️ Claude Code Tools
**60+ coding tools from instructkr**

| Category | Tools |
|----------|-------|
| **Files** | read, write, edit, glob, copy, move, delete |
| **Shell** | bash, powershell, cmd |
| **Search** | grep, find, findstr |
| **Code** | lsp, diagnostics, eslint, typescript |
| **Tasks** | create, list, get, update, stop |
| **REPL** | node, python, bash, typescript |

### 🌐 BrowserOS Integration
**45+ browser automation tools**

- Navigate, click, type, scroll
- Screenshot, content extraction
- Bookmarks, history, tabs
- Tab groups, windows

### 📱 Channels
**Telegram + Discord bots**

- Slash commands (`/duck help`, `/duck status`, `/duck cost`)
- Direct messaging
- Multi-channel support

### 🔒 Security (NVIDIA NemoClaw)
**Enterprise-grade security features**

- **SSRF Validation** - Blocks private IPs, DNS rebinding
- **Credential Sanitizer** - Prevents API key leaks
- **State Manager** - Persistent encrypted state
- **Network Policies** - YAML-based access control

### 🤖 Agent Orchestration
**Multi-agent task coordination**

---

## 📦 Architecture

```
Duck Agent
├── src/
│   ├── agent/         # Core AI agent with learning
│   ├── kairos/        # KAIROS autonomous system
│   ├── buddy/         # Buddy companion
│   ├── council/       # AI Council deliberation
│   ├── multiagent/    # Team coordination
│   ├── cron/          # Cron scheduler
│   ├── commands/      # CLI commands
│   ├── providers/     # Multi-provider AI
│   ├── tools/         # Tool registry + TTS
│   ├── security/      # Security modules
│   ├── ui/            # Pretext Canvas, A2UI
│   ├── server/        # MCP server
│   ├── memory/        # Context manager
│   ├── channels/      # Telegram, Discord
│   ├── gateway/       # Gateway integration
│   ├── integrations/   # Desktop, BrowserOS
│   └── prompts/       # System prompts
├── web-ui/           # Full Web UI (1996 lines)
└── tools/            # CLI tools
```

---

## 🔧 Commands

```bash
# Core
duck shell           # Interactive TUI shell
duck run <task>     # Execute a single task
duck think <prompt> # Reasoning mode
duck status         # Show agent status
duck tools         # List available tools
duck history       # Show conversation history

# Headless Protocols
duck mcp [port]         # Start MCP server (default: 3848)
duck mcp-connect <url>  # Connect to external MCP
duck acp <agent> <task># Spawn ACP session (codex/claude/etc)
duck ws connect <url>  # Connect to WebSocket server
duck unified           # All protocols + Gateway API

# Advanced
duck memory          # Memory commands
duck channels       # Start Telegram/Discord
duck desktop        # Desktop control

# AI Systems
duck kairos         # KAIROS autonomous mode
duck buddy          # Buddy companion
duck team           # Multi-agent teams
duck council        # AI Council

# Automation
duck cron           # Cron job management
duck update         # Update system
```

---

## 🔄 Update Strategy

Duck Agent pulls features from multiple sources to stay current:

| Source | Contribution |
|--------|-------------|
| **OpenClaw** | Gateway protocol, multi-channel, device nodes, skills |
| **Claude Code** | KAIROS, buddy, multi-agent, code review |
| **Hermes-Agent** | Gateway patterns |
| **NemoClaw** | Security (SSRF, credentials) |
| **Codex CLI** | Exec mode, approval layers, MCP server |
| **DroidClaw** | Phone control patterns, workflow/macro separation |
| **OpenCrabs** | Local voice (whisper.cpp, Piper), hybrid memory |
| **TrinityClaw** | ChromaDB memory, identity system |
| **FlowlyAI** | @mention routing, skills hub |

---

## 🧠 Memory System

Duck Agent has a sophisticated 3-tier memory:

1. **SOUL.md / IDENTITY.md** - Core personality and identity
2. **AGENTS.md / TOOLS.md** - Agent configuration and tools
3. **KANBAN.md / HEARTBEAT.md** - Task tracking and automation
4. **Session memory** - Conversation context
5. **Learned patterns** - From interactions

---

## 🌐 Multi-Provider Support

| Provider | Models | Status |
|----------|--------|--------|
| **MiniMax** | M2.7, glm-5, glm-4.7 | ✅ Active |
| **Kimi** | kimi-k2.5, kimi-k2 | ✅ Active |
| **ChatGPT** | gpt-5.4, gpt-5.4-mini | ✅ OAuth |
| **LM Studio** | qwen3-vl-8b, jan-v3-4b | ✅ Local |
| **OpenAI Codex** | gpt-5.3-codex | ✅ Active |

---

## 📚 Documentation

- [ARCHITECTURE.md](docs/ARCHITECTURE.md) - System architecture
- [COMMANDS.md](docs/COMMANDS.md) - CLI reference
- [UPDATES.md](docs/UPDATES.md) - Update strategy

---

## 🐛 Troubleshooting

```bash
# Build
npm run build

# Check status
duck update status

# Create backup
duck update backup

# View logs
duck logs

# Health check
curl http://localhost:18789/health
```

---

## 📄 License

MIT License - Ryan (Duckets) 2026

---

## 🙏 Credits

Inspired by: OpenClaw, Claude Code, Hermes-Agent, NemoClaw, Codex CLI, DroidClaw, OpenCrabs, TrinityClaw, FlowlyAI
