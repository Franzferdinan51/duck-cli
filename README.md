# 🦆 Duck Agent

> **Duck Agent v0.3.1** — Super AI Agent with KAIROS proactive AI, Agent Mesh networking, OpenClaw-RL self-improvement, 45-agent AI Council, unified headless protocols (MCP/ACP/WebSocket), Claude Code tools, autonomous cron automation, multi-agent orchestration, and OpenClaw v2026.3.31 compatibility.

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
duck unified            # All protocols (MCP + ACP + WS + Gateway)
duck mcp                # MCP server only (port 3850)
duck gateway            # Gateway API (port 18792)
```

### Docker

```bash
docker-compose up -d
```

---

## ✨ Features at a Glance

### ✅ REQUIRED (Always Available)

These features are built-in and always operational:

| Feature | Description |
|---------|-------------|
| 🧠 **KAIROS** | Proactive AI with heartbeat, decision engine, auto-dream |
| 🤖 **Agent Core** | Reasoning, task planning, tool orchestration |
| 🛠️ **Claude Code Tools** | 60+ coding tools (read, write, edit, bash, grep, LSP…) |
| 🌐 **MCP Server** | Full MCP 2024-11-05 spec, port 3850 |
| 🚪 **Gateway API** | OpenAI-compatible REST, port 18792 |
| 📡 **ACP Client** | Spawn Codex, Claude, Cursor, Gemini, Pi, OpenClaw |
| 🔗 **ACP Server** | Let OpenClaw connect TO you, port 18790 |
| 🗣️ **Voice / TTS** | MiniMax speech synthesis |
| ⏰ **Cron Automation** | 30+ predefined jobs |
| 💾 **Memory System** | 3-tier context + learned patterns |
| 📱 **Channels** | Telegram & Discord integration |
| 💻 **Desktop Control** | Native macOS/Windows via ClawdCursor |
| 🌐 **Multi-Provider** | MiniMax, Kimi, ChatGPT, LM Studio, Codex |
| 🔐 **Security** | SSRF validation, credential sanitization |
| 🔄 **Update System** | Multi-source pull with backup/restore |

### 🎁 OPTIONAL (Enable When Needed)

These features require extra setup and are disabled by default:

| Feature | Description | Setup |
|---------|-------------|-------|
| 🌐 **Agent Mesh** | Inter-agent communication network | Start mesh server, set env vars |
| 🧪 **OpenClaw-RL** | Reinforcement learning self-improvement | Run RL server, connect Duck Agent |
| 🏛️ **AI Council (45)** | 45-agent deliberative council | LM Studio models, council server |
| 🖥️ **Desktop UI** | Native desktop application | Build from `src/ui/desktop/` |
| 👥 **Teams** | Multi-agent coordinated execution | Templates pre-configured |
| 🐤 **Buddy** | AI companion with rarities | Pre-configured |

---

## 🧠 KAIROS Proactive AI — REQUIRED

**Always-on AI that acts without being asked**

```bash
duck kairos                 # Check status
duck kairos aggressive      # Act frequently
duck kairos balanced        # Moderate (default)
duck kairos conservative    # Act rarely
duck kairos enable          # Enable KAIROS
duck kairos disable         # Disable KAIROS
```

| Feature | Description |
|---------|-------------|
| 💭 Heartbeat | Periodic checks for "anything worth doing?" |
| 🎯 Decision Engine | Smart action decisions with pattern learning |
| 🌙 Auto-Dream | Nightly consolidation at 3 AM |
| 📝 Action Logs | Append-only audit trail |
| 🔔 Notifications | Push alerts to Telegram |
| 🧬 Modes | aggressive, balanced, conservative |

---

## 🌐 Agent Mesh — OPTIONAL

**Inter-agent communication network** — Join a mesh of AI agents, discover capabilities, send messages, and coordinate tasks across agent boundaries.

### Setup

```bash
# 1. Start the mesh server (in a separate terminal)
cd /Users/duckets/Desktop/agent-mesh-api
npm install
npm start
```

```bash
# 2. Set environment variables
export AGENT_MESH_URL=http://localhost:4000
export AGENT_MESH_API_KEY=openclaw-mesh-default-key
```

### Mesh Commands

```bash
duck mesh register           # Join mesh, get agent ID
duck mesh list              # Discover all agents & capabilities
duck mesh status            # Ping mesh server health
duck mesh send <agent> <msg> # Send message to specific agent
duck mesh broadcast <msg>   # Send message to all agents
duck mesh inbox             # Check unread messages
duck mesh capabilities      # Map skills to agents
duck mesh catastrophe       # Check active catastrophe events
```

### Mesh Usage Examples

```bash
# Register your agent on the mesh
duck mesh register
# Returns: Registered as agent_id=duck-abc123 on mesh

# Discover what other agents can do
duck mesh list
# Shows: agent_id, name, capabilities[], status

# Send a message to a specific agent
duck mesh send duck-xyz789 "Hey, can you check the grow tent?"

# Broadcast to all agents
duck mesh broadcast "System health check starting in 5 minutes"

# Check your inbox for messages
duck mesh inbox
# Shows: sender, message, timestamp, read/unread

# See what each agent specializes in
duck mesh capabilities
# Maps: agent_id → [coding, research, grow-monitor, ...]
```

### Mesh Architecture

```
┌──────────────────────────────────────────────────────┐
│                   Agent Mesh Network                   │
│                  (port 4000 default)                  │
│                                                       │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐              │
│  │ Duck    │  │ OpenClaw│  │ Agent   │              │
│  │ Agent   │◄─►│ Mesh    │◄─►│ Smith   │              │
│  │         │  │ Server  │  │         │              │
│  └────┬────┘  └────┬────┘  └────┬────┘              │
│       │            │            │                     │
│  Register│      List │      Send │                   │
│       │            │            │                     │
│       └────────────┼────────────┘                   │
│                    │                                  │
│            ┌───────▼───────┐                         │
│            │  Capability    │                         │
│            │  Registry      │                         │
│            └───────────────┘                         │
└──────────────────────────────────────────────────────┘
```

---

## 🧪 OpenClaw-RL — OPTIONAL

**Reinforcement learning-based self-improvement** — Turns every conversation into a training signal. Runs entirely on your own infrastructure. **Disabled by default.**

> ⚠️ **RL is 100% optional and OFF by default.** Duck Agent works identically with or without it.

### What is OpenClaw-RL?

OpenClaw-RL is a fully asynchronous RL framework that turns conversations into training signals. Two learning methods:

| Method | Signal | Best For |
|--------|--------|----------|
| **Binary RL (GRPO)** | +1/-1/0 scores | Implicit feedback, task success/failure |
| **On-Policy Distillation (OPD)** | Token-level hints | Rich textual feedback, directional improvement |

### Setup

```bash
# 1. Start the OpenClaw-RL server (choose one method)
cd OpenClaw-RL/slime

# Method A: Binary RL (GRPO)
bash ../openclaw-rl/run_qwen3_4b_openclaw_rl.sh

# Method B: On-Policy Distillation (OPD)
bash ../openclaw-opd/run_qwen3_4b_openclaw_opd.sh
```

```bash
# 2. Connect Duck Agent to the RL server
duck rl connect http://<host>:30000

# 3. Enable RL training
duck rl enable
```

### RL Commands

```bash
duck rl status        # Show RL on/off, server, training state
duck rl enable       # Turn on RL training
duck rl disable      # Turn off RL training
duck rl stats        # Show training statistics
duck rl connect <url> # Connect to an RL server
duck rl disconnect   # Remove RL server connection
```

### RL Usage Examples

```bash
# Check status (RL is off by default)
duck rl status
# Output: RL enabled: false | RL server: none | Training: idle

# Connect to your RL server
duck rl connect http://192.168.1.100:30000

# Enable training and chat normally
duck rl enable
duck shell
# Chat normally — training happens in background

# Check training progress
duck rl stats
# Output: Sessions: 42 | Turns trained: 847 | Avg reward: +0.73

# Done? Turn it off
duck rl disable
```

### How RL Works

```
User Message
     │
     ▼
┌─────────────────────┐
│  Duck Agent Core    │
│  - session_id       │
│  - turn_type (main) │
└──────────┬──────────┘
           │ (turn sent to RL server)
           ▼
┌─────────────────────┐
│  PRM (Process       │
│  Reward Model)      │
│  Scores: +1/-1/0   │
└──────────┬──────────┘
           │ (reward signal)
           ▼
┌─────────────────────┐
│  Background Policy  │
│  Update (async)     │
│  No latency added   │
└─────────────────────┘
```

---

## 🏛️ AI Council — OPTIONAL (45 Councilors)

**Deliberative decision making with 45 specialized AI perspectives**

```bash
duck council "Should we refactor the auth module?"
duck council list          # List all 45 councilors
duck council summon <role> # Call specific councilor
```

### The 45 Councilors

| # | Name | Role | Specialty |
|---|------|------|-----------|
| 1 | 🎤 **Speaker** | Facilitator | Orchestrates deliberation |
| 2 | 🔬 **Technocrat** | Technical | Systems, architecture, code |
| 3 | ⚖️ **Ethicist** | Moral | Ethics, privacy, fairness |
| 4 | 🎯 **Pragmatist** | Practical | Feasibility, resources, timelines |
| 5 | 🤔 **Skeptic** | Critical | Weaknesses, failure modes |
| 6 | 🛡️ **Sentinel** | Risk | Security, threats, worst-case |
| 7 | 📊 **Quant** | Math | Statistics, probabilities, ML |
| 8 | 🔮 **Futurist** | Long-term | Trends, predictions, 10-year view |
| 9 | ⚡ **Speedrunner** | Efficiency | Fastest path, shortcuts |
| 10 | 🔍 **Analyst** | Investigation | Deep dive, root cause |
| 11 | 💡 **Innovator** | Creative | Novel solutions, out-of-box |
| 12 | 📖 **Historian** | Context | Past patterns, lessons learned |
| 13 | 🎨 **Designer** | UX | User experience, accessibility |
| 14 | 💰 **Economist** | Cost/Benefit | ROI, tradeoffs, budget |
| 15 | 🌱 **Green** | Sustainability | Environmental impact |
| 16 | 🌍 **Globalist** | Geopolitics | International, cultural |
| 17 | ⚙️ **Engineer** | Implementation | Building, shipping, ops |
| 18 | 🧪 **Tester** | QA | Edge cases, stress testing |
| 19 | 📚 **Librarian** | Knowledge | Documentation, search |
| 20 | 🎭 **Devil's Advocate** | Opposition | Steelman the counter-argument |
| 21 | 🤝 **Mediator** | Conflict | Resolving disagreements |
| 22 | 📈 **Growth** | Scaling | User growth, retention |
| 23 | 🔒 **Privacy Officer** | Data | GDPR, data handling |
| 24 | 🚀 **Launch** | Release | Shipping, deployment |
| 25 | 🔧 **Maintainer** | Long-term | Tech debt, sustainability |
| 26 | 🎓 **Teacher** | Explaining | Simplicity, onboarding |
| 27 | 🎮 **Gamifier** | Engagement | Gamification, motivation |
| 28 | 🌊 **Flow** | UX | Cognitive load, simplicity |
| 29 | 🔔 **Alerts** | Monitoring | Metrics, observability |
| 30 | 🛠️ **Toolsmith** | Automation | Scripting, CI/CD |
| 31 | 🏗️ **Architect** | Design | System design, patterns |
| 32 | 🧬 **Evolution** | Change | Migration, upgrades |
| 33 | 🎪 **Circus** | Chaos | Testing, resilience |
| 34 | 📝 **Scribe** | Writing | Docs, comments, clarity |
| 35 | 🔀 **Refactorer** | Code Health | Clean code, simplicity |
| 36 | 🛡️ **Fortress** | Defense | Security hardening |
| 37 | 🌐 **Network** | Infra | Networking, distributed |
| 38 | 📦 **Package** | Dependencies | npm, libraries, versions |
| 39 | 🧩 **Integration** | APIs | REST, GraphQL, webhooks |
| 40 | 🗄️ **Storage** | Data | Databases, caching |
| 41 | 🔥 **Performance** | Speed | Profiling, optimization |
| 42 | 🧪 **Research** | R&D | Prototyping, experiments |
| 43 | 🏆 **Champion** | Advocacy | Stakeholder alignment |
| 44 | 🎯 **Success** | Outcomes | Goals, OKRs, impact |
| 45 | 🌟 **Sage** | Wisdom | Experience, intuition, judgment |

### Deliberation Modes

| Mode | Use For |
|------|---------|
| ⚖️ **Legislative** | Debate & vote on proposals |
| 🔬 **Deep Research** | Multi-vector investigation |
| 🐛 **Swarm Coding** | Parallel software engineering |
| 📊 **Prediction Market** | Probabilistic forecasting |
| ❓ **Inquiry** | Direct Q&A |
| 🗣️ **Deliberation** | Roundtable discussion |

---

## 🎤 Voice / TTS — REQUIRED

**MiniMax speech synthesis built-in**

```bash
duck voice "Hello world"           # Text-to-speech
duck voice --voice casual "Hi!"    # Different style
```

- 4,000 characters/day quota
- Multiple voice styles
- Auto-play on macOS

---

## 🌐 Web UI — REQUIRED

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

## 🖥️ Desktop UI — OPTIONAL (Planned for v0.4.0)

> **Coming in v0.4.0** — Native desktop application built from `src/ui/desktop/`

See [DESKTOP-UI.md](docs/DESKTOP-UI.md) for the full design preview.

**Preview features:**
- Native window with system tray
- Real-time agent dashboard
- Live chat interface
- Mesh network visualizer
- Council deliberation panel
- Desktop control widget
- Notification center

---

## 🔌 Headless Protocols — REQUIRED

Duck Agent is **headless-first** — run it as a server and connect via MCP, ACP, WebSocket, or HTTP.

### 🦆 Unified Server (Recommended)

```bash
duck unified
```

| Port | Protocol | Purpose |
|------|----------|---------|
| 3850 | MCP Server | Model Context Protocol |
| 18794 | ACP Gateway | Agent Client Protocol |
| 18796 | WebSocket | Bidirectional messaging |
| 18792 | Gateway API | OpenAI-compatible REST |

### 🔌 MCP Server (Model Context Protocol)

```bash
duck mcp
```

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

### 🔗 ACP Client — Spawn External Agents

```bash
duck acp codex "Fix the authentication bug"
duck acp claude "Review PR #123"
```

### 🦆 ACP Server — Let OpenClaw Connect TO You

```bash
duck acp-server
```

OpenClaw configuration:

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

### 🚪 Gateway API

```bash
curl -X POST http://localhost:18792/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Hello"}]}'
```

---

## 🤖 Agent Systems

### 🐤 Buddy Companion — OPTIONAL

```bash
duck buddy hatch    # Hatch a new buddy
duck buddy list     # List your buddies
duck buddy stats    # View stats
```

| Attribute | Values |
|-----------|--------|
| Rarity | common, uncommon, rare, epic, legendary |
| Species | duck, blob, cat, dragon, owl, ghost, robot, rabbit, cactus, snail |
| Stats | DEBUGGING, PATIENCE, CHAOS, WISDOM, SNARK |

### 👥 Multi-Agent Teams — OPTIONAL

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

---

## ⏰ Cron Automation — REQUIRED

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

## 🛠️ Tools & Integrations — REQUIRED

### Claude Code Tools (60+)

| Category | Tools |
|----------|-------|
| **Files** | read, write, edit, glob, copy, move, delete |
| **Shell** | bash, powershell, cmd |
| **Search** | grep, find, findstr |
| **Code** | lsp, diagnostics, eslint, typescript |
| **Tasks** | create, list, get, update, stop |
| **REPL** | node, python, bash, typescript |

### Desktop Control

```bash
duck desktop open Safari
duck desktop click 100 200
duck desktop screenshot
```

### BrowserOS Integration (45+ tools)

```bash
browser_navigate url="https://github.com"
browser_click selector="#submit-button"
browser_screenshot
```

---

## 🌐 Multi-Provider Support — REQUIRED

**Use the best model for each job**

| Provider | Models | Status |
|----------|--------|--------|
| **MiniMax** | M2.7, glm-5, glm-4.7, qwen3.5-plus | ✅ Active |
| **Kimi** | kimi-k2.5, kimi-k2 | ✅ Active |
| **ChatGPT** | gpt-5.4, gpt-5.4-mini | ✅ OAuth |
| **LM Studio** | qwen3-vl-8b, jan-v3-4b, glm-4.7-flash, +13 more | ✅ Local |
| **OpenAI Codex** | gpt-5.3-codex | ✅ Active |

---

## 📦 Architecture

```
Duck Agent/
├── src/
│   ├── agent/           # Core AI agent with learning
│   ├── kairos/         # KAIROS autonomous system
│   ├── mesh/            # Agent Mesh networking 🌐
│   ├── rl/              # OpenClaw-RL integration 🧪
│   ├── buddy/           # Buddy companion
│   ├── council/         # 45-agent AI Council 🏛️
│   ├── multiagent/      # Team coordination
│   ├── cron/            # Cron scheduler
│   ├── commands/        # CLI commands
│   ├── providers/       # Multi-provider AI
│   ├── tools/           # Tool registry
│   ├── security/        # Security modules
│   ├── server/          # MCP + Unified servers
│   ├── gateway/         # ACP + WebSocket
│   ├── memory/          # Context manager
│   ├── channels/        # Telegram, Discord
│   ├── prompts/         # System prompts
│   ├── compat/          # OpenClaw v2026.3.31 compat layer
│   └── ui/
│       ├── pretext-canvas/  # Generative UI
│       ├── a2ui/            # Canvas renderer
│       └── desktop/         # Desktop UI (v0.4.0) 🖥️
├── web-ui/              # Full Web UI
├── docs/                # Documentation
│   ├── ARCHITECTURE.md
│   ├── COMMANDS.md
│   ├── UPDATES.md
│   └── DESKTOP-UI.md    # NEW — Desktop UI preview
└── package.json
```

---

## 🔧 Commands Reference

```bash
# Core
duck shell              # Interactive TUI
duck run <task>         # Single task
duck think <prompt>     # Reasoning
duck status             # Show status
duck tools              # List tools
duck history            # View history

# Protocols
duck unified           # All protocols
duck mcp [port]        # MCP server
duck mcp-connect <url> # Connect MCP
duck acp <agent> [task]# Spawn ACP (CLIENT)
duck acp-server [port] # ACP server (let OpenClaw connect TO you)
duck ws connect <url>  # Connect WS
duck gateway           # REST API

# AI Systems
duck kairos [mode]     # KAIROS control
duck buddy [action]     # Buddy system
duck team [action]      # Teams
duck council [query]    # AI Council
duck council list       # List 45 councilors
duck council summon <r> # Summon specific councilor

# OPTIONAL: Mesh & RL
duck mesh register      # Join mesh network 🌐
duck mesh list          # Discover agents
duck mesh send <id> <m> # Send message
duck mesh broadcast <m> # Broadcast
duck mesh inbox          # Check inbox
duck mesh status        # Ping mesh
duck mesh capabilities  # Map skills
duck mesh catastrophe   # Check events
duck rl status          # RL status 🧪
duck rl enable          # Enable RL
duck rl disable         # Disable RL
duck rl connect <url>   # Connect RL server
duck rl disconnect      # Disconnect
duck rl stats           # Training stats

# Automation
duck cron [action]     # Cron jobs
duck update [action]   # Updates

# Integrations
duck channels          # Telegram/Discord
duck desktop           # Desktop control
duck memory            # Memory commands
```

---

## 🔐 Security — REQUIRED

**Enterprise-grade features (from NVIDIA NemoClaw)**

- **SSRF Validation** — Blocks private IPs, DNS rebinding
- **Credential Sanitizer** — Prevents API key leaks
- **State Manager** — Persistent encrypted state
- **Network Policies** — YAML-based access control

---

## 🔄 Update Strategy — REQUIRED

**Multi-source integration**

| Source | Features Integrated |
|--------|-------------------|
| **OpenClaw** | Gateway protocol, multi-channel, skills, compat/v2026.3.31 |
| **Claude Code** | KAIROS, buddy, multi-agent |
| **Hermes-Agent** | Gateway patterns, FTS5 search |
| **NemoClaw** | Security (SSRF, credentials) |
| **Codex CLI** | Exec mode, approval layers |
| **DroidClaw** | Phone control, workflow/macro |
| **OpenCrabs** | Local voice, hybrid memory |
| **TrinityClaw** | ChromaDB, identity system |
| **FlowlyAI** | @mention routing, skills hub |
| **OpenClaw-RL** | Reinforcement learning self-improvement |

```bash
duck update check      # Check for updates
duck update install   # Install latest
duck update backup    # Backup first
duck update restore   # Rollback
duck update status    # Git status
```

---

## 🧠 Memory System — REQUIRED

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
| [UPDATES.md](docs/UPDATES.md) | Version history & roadmap |
| [DESKTOP-UI.md](docs/DESKTOP-UI.md) | Desktop UI preview (v0.4.0) |

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
curl http://localhost:18792/health  # Gateway
curl http://localhost:3850/health     # MCP
curl http://localhost:4000/health     # Mesh

# View logs
tail -f ~/.duck-agent/logs/*.log
```

---

## 📄 License

MIT License — Ryan (Duckets) 2026

---

## 🙏 Credits

Inspired by and integrating features from:

[OpenClaw](https://github.com/openclaw/openclaw) · [Claude Code](https://github.com/anthropics/claude-code) · [Hermes-Agent](https://github.com/Franzferdinan51/hermes-agent) · [NemoClaw](https://github.com/NVIDIA/NemoClaw) · [Codex CLI](https://github.com/openai/codex) · [DroidClaw](https://github.com/unitedbyai/droidclaw) · [OpenCrabs](https://github.com/adolfousier/opencrabs) · [TrinityClaw](https://github.com/TrinityClaw/trinity-claw) · [FlowlyAI](https://github.com/Nocetic/flowlyai) · [ClawX](https://github.com/ValueCell-ai/ClawX) · [OpenClaw-RL](https://github.com/Franzferdinan51/OpenClaw-RL) · [agent-mesh-api](https://github.com/Franzferdinan51/agent-mesh-api)
