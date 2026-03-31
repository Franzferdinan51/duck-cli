# 🦆 Duck Agent

> **Super AI Agent** - The ultimate personal AI assistant with KAIROS proactive AI, voice synthesis, web UI, Claude Code tools, autonomous cron automation, and enterprise-grade security.

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
- 🎯 Smart decision engine
- 🌙 Auto-dream consolidation (3 AM daily)
- 📝 Append-only action logs
- 🔔 Push notifications
- 🧬 Pattern learning

### 🎤 Voice / TTS
**MiniMax speech synthesis built-in**

- Natural voice generation
- Multiple voice styles (narrator, casual, sad)
- 4,000 characters/day quota
- Auto-play on macOS

### 🌐 Web UI
**OpenClaw-inspired interface**

- 💬 Chat interface with typing indicators
- 📊 Status dashboard (uptime, cost, tokens)
- 🛠️ Tool browser with categories
- 🎤 Voice panel with quota display
- 🧠 KAIROS controls
- ⚙️ Settings panel

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

- Task decomposition into parallel subtasks
- Subagent workspace creation
- Progress tracking and result consolidation

### ⏰ Autonomous Cron System
**29 automation scripts from OpenClaw**

| Category | Scripts |
|----------|---------|
| **Grow** | morning-check, evening-check, threshold-alert, harvest-countdown, monthly-report, watering-tracker |
| **Crypto** | portfolio, price-alert, whale-watch, news-scan, defi-health |
| **OSINT** | briefing, keyword-alert, account-watch, github-watch, reddit-digest |
| **System** | health-check, auto-heal, backup, memory-check, failure-recover, auto-commit |
| **News** | daily-brief |
| **Weather** | daily |

### 🗂️ Tool Registry & Toolsets
**Organized tools by category and purpose**

Toolsets: `minimal`, `file`, `web`, `vision`, `voice`, `terminal`, `coding`, `browser`, `memory`, `planning`, `delegation`, `duck`, `full`

---

## 📦 Commands

```bash
# Core
duck shell              # Interactive TUI shell
duck web               # Web UI (port 3000)
duck gateway           # Gateway API (port 18789)
duck mcp [port]       # MCP Server (default 3848)
duck channels          # Telegram/Discord

# Agent
duck status            # Show agent status
duck think "?"         # Reasoning mode
duck speak "text"      # Text-to-speech
duck speak "text" casual  # Different voice
duck history           # Conversation history
duck memory add "x"   # Remember something
duck memory search "x" # Search memories

# Tools
duck tools             # List all tools
duck tools web         # List web tools
duck tools coding      # List coding tools

# Cron
duck cron verify       # Verify all scripts
duck cron install      # Install cron jobs
duck cron show        # Show crontab
duck cron run-all      # Run all manually

# Security
duck sanitize "text"   # Sanitize credentials
duck validate-url "url" # SSRF check

# Orchestration
duck orchestrate "task" # Decompose and run
```

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Duck Agent v0.6                          │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐ │
│  │              KAIROS Proactive AI                       │ │
│  │   Heartbeat → Decision → Action → Learn                │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐ │
│  │                    Agent Core                         │ │
│  │   Think → Reason → Plan → Execute → Remember         │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐    │
│  │ Providers │ │  Memory  │ │  Tools   │ │  Skills  │    │
│  │ MiniMax   │ │ Context  │ │ 60+     │ │ 10       │    │
│  │ LM Studio │ │ Learning │ │ BrowserOS│ │ Registry │    │
│  │ OpenAI    │ │ Patterns │ │ Claude   │ │ Orches-  │    │
│  │ Kimi      │ │          │ │          │ │ trator   │    │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘    │
│                                                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐    │
│  │ Security │ │ Cron    │ │ Channels │ │ Interfaces│    │
│  │ SSRF     │ │ 29 auto │ │ Telegram │ │ Web UI   │    │
│  │ Sanitizer│ │ scripts  │ │ Discord  │ │ CLI/MCP  │    │
│  │ State Mgr│ │          │ │          │ │ Gateway  │    │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘    │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐ │
│  │  Interfaces                                            │ │
│  │  🌐 Web UI  📱 Telegram/Discord  🖥️ CLI  📡 MCP    │ │
│  └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔌 API Endpoints

### Gateway (port 18789)
```
GET  /health              # Health check
GET  /status             # Full status
GET  /metrics            # Metrics
POST /v1/chat/completions  # OpenAI-compatible
GET  /v1/models          # Model list
```

### Web UI (port 3000)
```
GET  /                   # Web UI
GET  /api/status         # Agent status
POST /api/chat           # Chat
GET  /api/tools          # Tool list
POST /api/tts            # Text-to-speech
```

### MCP Server (port 3848)
```
POST /mcp                # JSON-RPC MCP protocol
GET  /tools              # List tools
GET  /health             # Health check
```

---

## 🛠️ Tools (60+)

### Coding Tools
| Tool | Description |
|------|-------------|
| `file_read` | Read file contents |
| `file_write` | Write content to file |
| `file_edit` | Edit specific lines |
| `glob` | Find files by pattern |
| `bash` | Execute shell commands |
| `powershell` | Windows PowerShell |
| `grep` | Search patterns in files |
| `lsp` | Language server diagnostics |
| `repl` | Run code in REPL |

### Task Tools
| Tool | Description |
|------|-------------|
| `task_create` | Create a new task |
| `task_list` | List all tasks |
| `task_get` | Get task details |
| `task_update` | Update task |
| `task_stop` | Cancel a task |

### BrowserOS Tools
| Tool | Description |
|------|-------------|
| `navigate` | Go to URL |
| `click` | Click element |
| `type` | Type text |
| `screenshot` | Capture page |
| `get_content` | Extract text |
| `bookmarks` | Manage bookmarks |
| `history` | Browse history |

### Duck Tools
| Tool | Description |
|------|-------------|
| `speak` | Text-to-speech |
| `think` | Reasoning mode |
| `remember` | Save to memory |
| `recall` | Search memory |
| `get_metrics` | System metrics |
| `get_cost` | Cost tracking |
| `delegate_task` | Spawn subagent |

### Security Tools
| Tool | Description |
|------|-------------|
| `validate_url` | SSRF validation |
| `sanitize` | Credential removal |
| `get_credential_env` | List env vars with secrets |

---

## 🔒 Security Features

### SSRF Protection
```typescript
import { validateURL } from './security/ssrf.js';

const result = await validateURL('https://example.com');
if (!result.allowed) {
  console.log('Blocked:', result.reason);
}
```

### Credential Sanitization
```typescript
import { sanitize } from './security/credential-sanitizer.js';

const safe = sanitize('API Key: sk-1234567890');
// Returns: "API Key: [REDACTED]"
```

### Network Policies
```yaml
# policies/presets/telegram.yaml
network_policies:
  telegram_bot:
    endpoints:
      - host: api.telegram.org
        port: 443
        rules:
          - allow: { method: POST, path: "/bot*/**" }
```

---

## ⏰ Autonomous Cron System

### Install Cron Jobs
```bash
duck cron install   # Install all 29 cron jobs
duck cron verify    # Check all scripts exist
duck cron show     # View current crontab
```

### Available Scripts
| Script | Schedule | Purpose |
|--------|----------|---------|
| `sys-health-check.sh` | Hourly | Check services, auto-heal |
| `sys-auto-heal.sh` | On failure | Restart failed services |
| `grow-morning-check.sh` | 9 AM | Plant monitoring |
| `grow-evening-check.sh` | 9 PM | Evening check |
| `crypto-portfolio.sh` | 9 AM | Portfolio snapshot |
| `crypto-price-alert.sh` | Hourly | Price alerts |
| `osint-briefing.sh` | 9 AM | Daily intelligence |
| `news-daily-brief.sh` | 8 AM | News digest |
| `weather-daily.sh` | 7 AM | Weather report |

---

## 🤖 Agent Orchestration

### Task Decomposition
```typescript
import { decomposeTask, orchestrate } from './orchestrator/agent-orchestrator.js';

const tasks = decomposeTask('Research X, Build Y, Test Z');
// Returns: [SubTask{id: 'subtask_1', name: 'research: Research X', ...}, ...]
```

### Run Multi-Agent
```typescript
const result = await orchestrate('Build a REST API', {
  maxConcurrent: 3,
  workspace: '/tmp/my-orchestration',
  onProgress: (task) => console.log(`[${task.status}] ${task.name}`)
});
```

---

## 🌐 Browser Automation

Connect to BrowserOS for 45+ additional tools:

```bash
# Install BrowserOS: https://files.browseros.com
export BROWSEROS_HOST=127.0.0.1
export BROWSEROS_PORT=9100
```

---

## 🐳 Docker

```bash
# Build
docker build -t duck-agent .

# Run
docker run -d \
  -p 3000:3000 \
  -p 3848:3848 \
  -p 18789:18789 \
  -e MINIMAX_API_KEY=your-key \
  duck-agent

# Or with docker-compose
docker-compose up -d
```

---

## 📁 Project Structure

```
duck-cli/
├── src/
│   ├── agent/
│   │   ├── core.ts              # Main agent logic
│   │   ├── cost-tracker.ts     # Cost tracking
│   │   └── proactive/
│   │       └── kairos.ts       # KAIROS AI
│   ├── providers/
│   │   ├── manager.ts          # Multi-provider
│   │   ├── minimax.ts         # MiniMax
│   │   └── browseros.ts        # BrowserOS
│   ├── tools/
│   │   ├── registry.ts         # Tool registry
│   │   ├── tts.ts             # TTS service
│   │   ├── delegate.ts        # Subagent spawning
│   │   └── coding/
│   │       ├── index.ts       # Claude Code tools
│   │       ├── extended-tools.ts
│   │       └── powershell.ts
│   ├── security/
│   │   ├── ssrf.ts            # SSRF validation
│   │   ├── state-manager.ts   # Persistent state
│   │   └── credential-sanitizer.ts
│   ├── orchestrator/
│   │   └── agent-orchestrator.ts  # Multi-agent
│   ├── commands/
│   │   └── slash-handler.ts   # Slash commands
│   ├── channels/
│   │   ├── manager.ts         # Channel coordinator
│   │   ├── telegram.ts
│   │   └── discord.ts
│   ├── memory/
│   │   ├── system.ts          # Memory + learning
│   │   └── context-manager.ts
│   ├── gateway/
│   │   └── index.ts           # HTTP/WebSocket gateway
│   ├── cli/
│   │   └── main.ts            # CLI commands
│   └── web-server.ts           # Web UI server
├── autonomous/                  # 29 cron scripts
│   ├── grow-*.sh              # Plant monitoring
│   ├── crypto-*.sh            # Crypto automation
│   ├── osint-*.sh             # Intelligence
│   ├── sys-*.sh               # System health
│   └── duck-cron.ts           # Cron manager CLI
├── policies/                   # Network policies
│   └── presets/
│       ├── telegram.yaml
│       ├── openai.yaml
│       └── browser.yaml
├── web-ui/
│   └── index.html              # Web interface
├── skills/                     # Loaded skills
├── docker-compose.yml
├── Dockerfile
├── .env.example
├── start.sh                    # Quick start script
└── package.json
```

---

## 🔧 Configuration

Copy `.env.example` to `.env`:

```bash
# Required
MINIMAX_API_KEY=sk-cp-your-key

# Optional - AI Providers
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
LMSTUDIO_URL=http://localhost:1234
KIMI_API_KEY=your-key

# BrowserOS
BROWSEROS_HOST=127.0.0.1
BROWSEROS_PORT=9100

# Security
GATEWAY_TOKEN=your-secret-token
```

---

## 📊 Status

| Component | Status |
|-----------|--------|
| **Agent Core** | ✅ Working |
| **MiniMax M2.7** | ✅ Working |
| **KAIROS Proactive AI** | ✅ Built |
| **Voice/TTS** | ✅ Working |
| **Web UI** | ✅ Working |
| **MCP Server** | ✅ Working |
| **Gateway API** | ✅ Working |
| **Claude Code Tools** | ✅ 60+ tools |
| **BrowserOS** | ✅ 45+ tools |
| **Telegram** | ✅ Ready |
| **Discord** | ✅ Ready |
| **Cost Tracking** | ✅ Working |
| **Learning System** | ✅ Working |
| **Docker** | ✅ Ready |
| **SSRF Protection** | ✅ Working |
| **Credential Sanitizer** | ✅ Working |
| **State Manager** | ✅ Working |
| **Agent Orchestrator** | ✅ Working |
| **Cron System** | ✅ 29 scripts |
| **Network Policies** | ✅ YAML presets |

---

## 🏆 Sources

This project combines the best from:

| Project | Contribution |
|---------|-------------|
| **instructkr-claude-code** | Claude Code tools, task system |
| **OpenClaw** | Gateway architecture, web UI, cron automation |
| **NVIDIA NemoClaw** | Security (SSRF, credentials, state), slash commands |
| **Hermes-Agent** | Advanced tools, delegation |
| **DuckBot-OS** | Features, learning, cost tracking |
| **BrowserOS** | Browser automation |
| **Claude Code leak (KAIROS)** | Proactive AI concepts |

---

## 📜 License

MIT License - see [LICENSE](LICENSE)

---

## 🔗 Links

- **GitHub:** https://github.com/Franzferdinan51/duck-cli
- **Docs:** Coming soon
- **Issues:** https://github.com/Franzferdinan51/duck-cli/issues

---

**🦆 v0.6.0** - Built for Ryan (Duckets)
**KAIROS:** Always-on AI that works while you sleep
**Security:** NVIDIA NemoClaw-grade protection
**Automation:** 29 cron jobs for autonomous operation
