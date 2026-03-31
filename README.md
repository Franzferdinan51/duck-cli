# 🦆 Duck Agent

> **Super AI Agent** - The ultimate personal AI assistant with KAIROS proactive AI, voice synthesis, web UI, and Claude Code-level tools.

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

- 💬 Chat interface
- 📊 Status dashboard
- 🛠️ Tool browser
- 🎤 Voice panel
- 🧠 KAIROS controls
- ⚙️ Settings

### 🛠️ Claude Code Tools
**58+ coding tools from instructkr**

| Category | Tools |
|----------|-------|
| **Files** | read, write, edit, glob |
| **Shell** | bash, powershell |
| **Search** | grep, find |
| **Code** | lsp, diagnostics |
| **Tasks** | create, list, update, stop |
| **REPL** | node, python, bash |

### 🌐 BrowserOS Integration
**45+ browser automation tools**

- Navigate, click, type
- Screenshot, content extraction
- Bookmarks, history
- Tab groups, windows

### 📱 Channels
**Telegram + Discord bots**

- Slash commands
- Direct messaging
- Multi-channel support

---

## 📦 Commands

```bash
duck shell              # Interactive TUI shell
duck web               # Web UI (port 3000)
duck gateway           # Gateway API (port 18789)
duck mcp [port]        # MCP Server (default 3848)
duck channels          # Telegram/Discord
duck status            # Show agent status
duck tools             # List all tools
duck think "?"         # Reasoning mode
duck speak "text"      # Text-to-speech
duck speak "text" casual  # Different voice
duck history           # Conversation history
duck memory add "x"   # Remember something
duck memory search "x" # Search memories
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
│  │   Think → Reason → Plan → Execute → Remember           │ │
│  └─────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐    │
│  │ Providers │ │  Memory  │ │  Tools   │ │  Skills  │    │
│  │ MiniMax   │ │ Context  │ │ 58+     │ │ 10       │    │
│  │ LM Studio │ │ Learning │ │ BrowserOS│ │ Registry │    │
│  │ OpenAI    │ │ Patterns │ │ Claude   │ │          │    │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘    │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐ │
│  │  Interfaces                                            │ │
│  │  🌐 Web UI  📱 Telegram/Discord  🖥️ CLI  📡 MCP      │ │
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

## 🛠️ Tools (58+)

### Coding Tools
| Tool | Description |
|------|-------------|
| `file_read` | Read file contents |
| `file_write` | Write content to file |
| `file_edit` | Edit specific lines |
| `bash` | Execute shell commands |
| `powershell` | Windows PowerShell |
| `grep` | Search patterns in files |
| `glob` | Find files by pattern |
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
│   │   ├── core.ts           # Main agent logic
│   │   ├── cost-tracker.ts   # Cost tracking
│   │   └── proactive/
│   │       └── kairos.ts     # KAIROS AI
│   ├── providers/
│   │   ├── manager.ts        # Multi-provider
│   │   ├── minimax.ts       # MiniMax
│   │   ├── browseros.ts      # BrowserOS
│   │   └── ...
│   ├── tools/
│   │   ├── registry.ts       # Tool registry
│   │   ├── tts.ts            # TTS service
│   │   └── coding/
│   │       ├── index.ts      # Claude Code tools
│   │       ├── extended-tools.ts
│   │       └── powershell.ts
│   ├── channels/
│   │   ├── manager.ts       # Channel coordinator
│   │   ├── telegram.ts
│   │   └── discord.ts
│   ├── memory/
│   │   ├── system.ts        # Memory + learning
│   │   └── context-manager.ts # Patterns
│   ├── gateway/
│   │   └── index.ts         # HTTP/WebSocket gateway
│   ├── integrations/
│   │   └── browseros.ts      # BrowserOS integration
│   ├── cli/
│   │   └── main.ts          # CLI commands
│   └── web-server.ts         # Web UI server
├── web-ui/
│   └── index.html            # Web interface
├── skills/                   # 10 loaded skills
├── data/                    # Persistent data
├── docker-compose.yml
├── Dockerfile
├── .env.example
├── start.sh                # Quick start script
└── package.json
```

---

## 🔧 Configuration

Copy `.env.example` to `.env`:

```bash
# Required
MINIMAX_API_KEY=sk-cp-your-key

# Optional
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
LMSTUDIO_URL=http://localhost:1234

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
| **Claude Code Tools** | ✅ 58+ tools |
| **BrowserOS** | ✅ 45+ tools |
| **Telegram** | ✅ Ready |
| **Discord** | ✅ Ready |
| **Cost Tracking** | ✅ Working |
| **Learning System** | ✅ Working |
| **Docker** | ✅ Ready |

---

## 🏆 Sources

This project combines the best from:

| Project | Contribution |
|---------|-------------|
| **instructkr-claude-code** | Claude Code tools, task system |
| **OpenClaw** | Gateway architecture, web UI |
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
