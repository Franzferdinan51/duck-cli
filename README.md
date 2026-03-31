# 🦆 Duck Agent

> **Duck Agent v0.3.1** — Super AI Agent with KAIROS proactive AI, unified headless protocols (MCP/ACP/WebSocket), Claude Code tools, autonomous cron automation, multi-agent orchestration, and OpenClaw compatibility.

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

# Start - pick your interface
duck shell              # Interactive TUI shell
duck web [port]         # Web UI (http://localhost:3001)
duck unified           # All protocols (MCP + ACP + WS + Gateway)
duck mcp               # MCP server only (port 3848)
duck gateway           # Gateway API (port 18789)
```

### Docker

```bash
docker-compose up -d
```

---

## ✨ Core Features

### 🧠 KAIROS Proactive AI
**Always-on AI that acts without being asked**

| Feature | Description |
|---------|-------------|
| 💭 Heartbeat | Periodic checks for "anything worth doing?" |
| 🎯 Decision Engine | Smart action decisions with pattern learning |
| 🌙 Auto-Dream | Nightly consolidation at 3 AM |
| 📝 Action Logs | Append-only audit trail |
| 🔔 Notifications | Push alerts to Telegram |
| 🧬 Modes | aggressive, balanced, conservative |

### 🎤 Voice / TTS
**MiniMax speech synthesis built-in**

```bash
duck voice "Hello world"           # Text-to-speech
duck voice --voice casual "Hi!"   # Different style
```

- 4,000 characters/day quota
- Multiple voice styles
- Auto-play on macOS

### 🌐 Web UI
**Full-featured control interface**

```
http://localhost:3000
```

| Panel | Features |
|-------|----------|
| 💬 Chat | Messages, code, typing indicators |
| 📊 Dashboard | Uptime, cost, tokens, providers |
| 🧠 KAIROS | Toggle, modes, actions log |
| 🐤 Buddy | Hatch, reroll, species preview |
| 👥 Teams | Templates, member cards |
| 🏛️ AI Council | Deliberation, councilors, output |
| ⏰ Cron | Job scheduler, enable/disable |
| 💾 Memory | View recent memories |
| ⚙️ Settings | Provider config, theme |
| 📋 Logs | Activity viewer |

---

## 🔌 Headless Protocols

Duck Agent is designed as a **headless-first** agent — run it as a server and connect via MCP, ACP, WebSocket, or HTTP.

### 🦆 Unified Server (Recommended)

```bash
duck unified
```

Starts all protocols simultaneously:

| Port | Protocol | Purpose |
|------|----------|---------|
| 3848 | MCP Server | Model Context Protocol |
| 18790 | ACP Gateway | Agent Client Protocol |
| 18791 | WebSocket | Bidirectional messaging |
| 18789 | Gateway API | OpenAI-compatible REST |

---

### 🔌 MCP Server (Model Context Protocol)

**Full MCP 2024-11-05 spec implementation**

```bash
# Start MCP server
duck mcp

# Connect to external MCP server
duck mcp-connect ws://remote-server:3848/ws
```

**Endpoints:**

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/mcp` | POST | MCP JSON-RPC |
| `/mcp/sse` | GET | Server-Sent Events |
| `/mcp/stream` | POST | Streamable HTTP |
| `/health` | GET | Health check |
| `/tools` | GET | List tools |
| `/capabilities` | GET | Server capabilities |
| `/ws` | WS | WebSocket |

**Built-in Tools (14+):**

```
execute          - Execute a task
think           - Reasoning mode
remember         - Store in memory
recall           - Search memory
kairos_status    - Get KAIROS state
kairos_action    - Trigger autonomous action
desktop_screenshot - Take screenshot
desktop_open     - Open application
desktop_click    - Click at coordinates
desktop_type     - Type text
get_status       - Agent metrics
list_tools      - List all tools
ping            - Latency check
spawn_agent      - Spawn sub-agent
```

**Example MCP Client Usage:**

```bash
# Using curl
curl -X POST http://localhost:3848/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"think","arguments":{"prompt":"Why is the sky blue?"}}}'

# Using WebSocket
ws://localhost:3848/ws
```

---

### 🔗 ACP Client (Agent Client Protocol)

**Spawn external coding agents (Codex, Claude, Pi, etc.)**

```bash
# Spawn agent for task
duck acp codex "Fix the authentication bug"
duck acp claude "Review PR #123"
duck acp pi "Analyze this code"

# Interactive session
duck acp claude
```

**Supported Agents:**

| Agent | Command | Description |
|-------|---------|-------------|
| codex | `duck acp codex` | OpenAI Codex |
| claude | `duck acp claude` | Claude Code |
| cursor | `duck acp cursor` | Cursor AI |
| gemini | `duck acp gemini` | Google Gemini CLI |
| pi | `duck acp pi` | Pi AI |
| openclaw | `duck acp openclaw` | OpenClaw agent |
| opencode | `duck acp opencode` | OpenCode |

**ACP Features:**
- Session spawn/cancel/steer/send
- Fire-and-forget with result delivery
- Persistent sessions
- Output streaming

---

### 🦆 ACP Server (Be Used BY OpenClaw)

**Duck Agent can act as an ACP backend that OpenClaw connects TO**

```bash
# Start ACP server (OpenClaw will connect to this)
duck acp-server

# Custom port
duck acp-server 3849
```

**OpenClaw Configuration:**

In your OpenClaw config (`openclaw.json`), add Duck Agent as an ACP runtime agent:

```json
{
  "agents": {
    "list": [
      {
        "id": "duck",
        "name": "Duck Agent",
        "workspace": "~/.duck-agent",
        "runtime": {
          "type": "acp",
          "acp": {
            "agent": "duck",
            "backend": "acpx",
            "mode": "persistent"
          }
        }
      }
    ]
  }
}
```

Then point acpx at your Duck Agent:

```bash
# acpx connects to Duck Agent's ACP server
acpx connect ws://localhost:18790/acp --agent duck
```

**ACP Server Features:**
- WebSocket endpoint: `ws://localhost:18790/acp`
- Session management: spawn, cancel, steer, send
- Supports agents: `duck`, `duck-agent`, `kairos`
- Max concurrent sessions: 8
- JSON-RPC 2.0 protocol

---

### 🌐 Bidirectional WebSocket

**Connect IN (server) and OUT (client) simultaneously**

```bash
# Connect to external WebSocket
duck ws connect wss://remote-server.com/ws

# Check status
duck ws status
```

**Features:**
- Server mode: Accept incoming connections
- Client mode: Connect to external servers
- Auto-reconnection
- Channel-based routing
- Message queuing

---

### 🚪 Gateway API

**OpenAI-compatible REST API**

```bash
# Chat completions
curl -X POST http://localhost:18789/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Hello"}]}'

# List models
curl http://localhost:18789/v1/models

# Health check
curl http://localhost:18789/health
```

---

## 🤖 Agent Systems

### 🐤 Buddy Companion
**AI companion with rarities**

```bash
duck buddy hatch    # Hatch a new buddy
duck buddy list     # List your buddies
duck buddy stats   # View stats
```

| Attribute | Values |
|-----------|--------|
| Rarity | common, uncommon, rare, epic, legendary |
| Species | duck, blob, cat, dragon, owl, ghost, robot, rabbit, cactus, snail |
| Stats | DEBUGGING, PATIENCE, CHAOS, WISDOM, SNARK |

### 👥 Multi-Agent Teams
**Coordinated parallel execution**

```bash
duck team create code-review    # Create team
duck team spawn research        # Spawn workers
duck team status               # Check progress
```

| Template | Purpose |
|----------|---------|
| code-review | PR analysis, bug detection |
| research | Web search, summarization |
| swarm | Parallel task execution |

### 🏛️ AI Council
**Deliberative decision making**

```bash
duck council "Should we refactor the auth module?"
```

| Councilor | Role |
|-----------|------|
| 🎤 Speaker | Facilitator |
| 🔬 Technocrat | Technical analysis |
| ⚖️ Ethicist | Moral reasoning |
| 🎯 Pragmatist | Practical focus |
| 🤔 Skeptic | Critical analysis |
| 🛡️ Sentinel | Risk assessment |


### 🌐 Agent Mesh
**Inter-agent communication network**

```bash
duck mesh register          # Join the mesh network
duck mesh list             # Discover all agents
duck mesh send <agent> <msg>  # Send message
duck mesh inbox            # Check messages
duck mesh health           # Health dashboard
duck mesh broadcast <msg>  # Send to all agents
duck mesh capabilities     # Discover skills
```

| Command | Description |
|---------|------------|
| `register` | Join mesh, get agent ID, connect WebSocket |
| `list` | Discover all agents and their capabilities |
| `send <id> <msg>` | Send message to specific agent |
| `inbox` | Check unread messages |
| `health` | View mesh health dashboard |
| `broadcast <msg>` | Send to all mesh agents |
| `capabilities` | Map skills to agents |
| `catastrophe` | Check active catastrophe events |
| `status` | Ping mesh server |

**Requirements:**
```bash
cd /Users/duckets/Desktop/agent-mesh-api
npm install
npm start
```

**Environment:**
- `AGENT_MESH_URL` - Server URL (default: http://localhost:4000)
- `AGENT_MESH_API_KEY` - API key (default: openclaw-mesh-default-key)

---

## ⏰ Cron Automation

**30+ predefined jobs**

```bash
duck cron list              # List all jobs
duck cron enable grow-check # Enable a job
duck cron disable ai-news   # Disable a job
```

| Category | Jobs |
|----------|------|
| **System** | health-check, memory-check, auto-heal, backup, failure-recover |
| **Grow** | morning-check, evening-check, threshold-alert, watering, harvest, monthly-report |
| **Crypto** | portfolio, price-alert, whale-watch, defi-health, news-scan |
| **OSINT** | briefing, keyword-alert, account-watch, github-watch, reddit-digest |
| **News** | daily-brief |
| **Weather** | daily-weather |
| **Home** | equipment-monitor |

---

## 🛠️ Tools & Integrations

### Claude Code Tools
**60+ coding tools**

| Category | Tools |
|----------|-------|
| **Files** | read, write, edit, glob, copy, move, delete |
| **Shell** | bash, powershell, cmd |
| **Search** | grep, find, findstr |
| **Code** | lsp, diagnostics, eslint, typescript |
| **Tasks** | create, list, get, update, stop |
| **REPL** | node, python, bash, typescript |

### Desktop Control
**Native macOS/Windows control**

```bash
duck desktop open Safari
duck desktop click 100 200
duck desktop screenshot
```

### BrowserOS Integration
**45+ browser automation tools**

```bash
# via MCP tools
browser_navigate url="https://github.com"
browser_click selector="#submit-button"
browser_screenshot
```

---

## 🌐 Multi-Provider Support

**Use the best model for each job**

| Provider | Models | Status |
|----------|--------|--------|
| **MiniMax** | M2.7, glm-5, glm-4.7 | ✅ Active |
| **Kimi** | kimi-k2.5, kimi-k2 | ✅ Active |
| **ChatGPT** | gpt-5.4, gpt-5.4-mini | ✅ OAuth |
| **LM Studio** | qwen3-vl-8b, jan-v3-4b | ✅ Local |
| **OpenAI Codex** | gpt-5.3-codex | ✅ Active |

---

## 📦 Architecture

```
Duck Agent/
├── src/
│   ├── agent/           # Core AI agent with learning
│   ├── kairos/         # KAIROS autonomous system
│   ├── buddy/          # Buddy companion
│   ├── council/        # AI Council deliberation
│   ├── multiagent/     # Team coordination
│   ├── cron/           # Cron scheduler
│   ├── commands/       # CLI commands
│   ├── providers/      # Multi-provider AI
│   ├── tools/          # Tool registry
│   ├── security/       # Security modules
│   ├── server/         # MCP + Unified servers
│   ├── gateway/        # ACP + WebSocket
│   ├── memory/         # Context manager
│   ├── channels/       # Telegram, Discord
│   └── prompts/        # System prompts
├── web-ui/              # Full Web UI
├── docs/               # Documentation
└── package.json
```

---

## 🔧 Commands Reference

```bash
# Core
duck shell              # Interactive TUI
duck run <task>         # Single task
duck think <prompt>     # Reasoning
duck status            # Show status
duck tools             # List tools
duck history           # View history

# Protocols
duck unified           # All protocols
duck mcp [port]        # MCP server
duck mcp-connect <url> # Connect MCP
duck acp <agent> [task]# Spawn ACP (as CLIENT)
duck acp-server [port] # ACP server (let OpenClaw connect TO you)
duck ws connect <url>  # Connect WS
duck gateway           # REST API

# AI Systems
duck kairos [mode]     # KAIROS control
duck buddy [action]    # Buddy system
duck team [action]     # Teams
duck council [query]  # AI Council

# Automation
duck cron [action]    # Cron jobs
duck update [action]   # Updates

# Integrations
duck channels         # Telegram/Discord
duck desktop         # Desktop control
duck memory          # Memory commands
```

---

## 🔐 Security

**Enterprise-grade features (from NVIDIA NemoClaw)**

- **SSRF Validation** — Blocks private IPs, DNS rebinding
- **Credential Sanitizer** — Prevents API key leaks
- **State Manager** — Persistent encrypted state
- **Network Policies** — YAML-based access control

---

## 🔄 Update Strategy

**Multi-source integration**

Duck Agent pulls from:

| Source | Features Integrated |
|--------|-------------------|
| **OpenClaw** | Gateway protocol, multi-channel, skills |
| **Claude Code** | KAIROS, buddy, multi-agent |
| **Hermes-Agent** | Gateway patterns, FTS5 search |
| **NemoClaw** | Security (SSRF, credentials) |
| **Codex CLI** | Exec mode, approval layers |
| **DroidClaw** | Phone control, workflow/macro |
| **OpenCrabs** | Local voice, hybrid memory |
| **TrinityClaw** | ChromaDB, identity system |
| **FlowlyAI** | @mention routing, skills hub |

```bash
duck update check      # Check for updates
duck update install    # Install latest
duck update backup     # Backup first
duck update restore    # Rollback
duck update status    # Git status
```

---

## 🧠 Memory System

**3-tier architecture**

1. **Identity Files** — SOUL.md, IDENTITY.md
2. **Config Files** — AGENTS.md, TOOLS.md, KANBAN.md
3. **Session Memory** — Conversation context
4. **Learned Patterns** — From interactions

---

## 📚 Documentation

| Doc | Description |
|-----|-------------|
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | System architecture |
| [COMMANDS.md](docs/COMMANDS.md) | CLI reference |
| [CHANGELOG.md](CHANGELOG.md) | Version history |

---

## 🐛 Troubleshooting

```bash
# Build from source
npm run build

# Check for issues
duck update status

# Backup before changes
duck update backup

# Health check (various ports)
curl http://localhost:18789/health  # Gateway
curl http://localhost:3848/health     # MCP

# View logs
tail -f ~/.duck-agent/logs/*.log
```

---

## 📄 License

MIT License — Ryan (Duckets) 2026

---

## 🙏 Credits

Inspired by and integrating features from:

[OpenClaw](https://github.com/openclaw/openclaw) · [Claude Code](https://github.com/anthropics/claude-code) · [Hermes-Agent](https://github.com/Franzferdinan51/hermes-agent) · [NemoClaw](https://github.com/NVIDIA/NemoClaw) · [Codex CLI](https://github.com/openai/codex) · [DroidClaw](https://github.com/unitedbyai/droidclaw) · [OpenCrabs](https://github.com/adolfousier/opencrabs) · [TrinityClaw](https://github.com/TrinityClaw/trinity-claw) · [FlowlyAI](https://github.com/Nocetic/flowlyai) · [ClawX](https://github.com/ValueCell-ai/ClawX)
