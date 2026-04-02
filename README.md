# 🦆 Duck Agent CLI

**An AI sidekick for humans and agents** — unified command center with multi-agent orchestration, voice, canvas, and skills.

> *"Your AI sidekick — just type `duck` and start chatting."*

## Quick Start

```bash
# Install
git clone https://github.com/Franzferdinan51/duck-cli.git && cd duck-cli
npm install && npm run build
go build -o duck ./cmd/duck/
cp duck ~/.local/bin/duck && cp -r dist/* ~/.local/bin/dist/

# Run (standalone — for humans)
duck                  # interactive chat
duck setup            # configure API keys
duck help             # all commands

# Run (as tool — for AI agents)
duck run "fix my authentication bug"
duck council "Should we use PostgreSQL or MongoDB?"
duck status           # show providers, skills, tools
```

## Provider Setup

```bash
# Auto-reads from ~/.duck/.env or current directory .env
# Keys: MINIMAX_API_KEY, OPENROUTER_API_KEY, KIMI_API_KEY
# Provider: DUCK_PROVIDER=minimax (default)

duck setup            # guided interactive setup
```

## All Commands

### 💬 Chat & Run
| Command | Description |
|---------|-------------|
| `duck` | Interactive shell (welcome + chat) |
| `duck run [task]` | Execute single task (smart routing) |
| `duck setup` | Guided API key configuration |
| `duck help` | Show all commands |
| `duck --version` | Show version |

### 🧠 AI Models & Routing
| Command | Description |
|---------|-------------|
| `duck status` | Show providers, tools, skills |
| `duck think [prompt]` | Reasoning mode (no tools) |
| `duck think-speak [text]` | Think and speak aloud |

### 🏛️ AI Council
| Command | Description |
|---------|-------------|
| `duck council [topic]` | Local deliberation (MiniMax) |
| `duck council legislative "motion"` | Vote-based decisions |
| `duck council research "topic"` | Investigation mode |
| `duck council prediction "event"` | Probability estimate |

### 🤖 Agent Systems
| Command | Description |
|---------|-------------|
| `duck agent list` | List running agents |
| `duck buddy hatch` | Initialize AI companion |
| `duck buddy list` | List companions |
| `duck team create [name]` | Create agent team |
| `duck mesh status` | Agent Mesh network |
| `duck rl status` | OpenClaw-RL status |

### 🔧 Protocols
| Command | Description |
|---------|-------------|
| `duck mcp` | Start MCP server (port 3850) |
| `duck gateway` | Start REST API (port 18792) |
| `duck unified` | All protocols at once |
| `duck acp-server` | ACP agent server (port 18794) |

### 🌐 Web & Automation
| Command | Description |
|---------|-------------|
| `duck web` | Web UI (port 3001) |
| `duck kairos aggressive` | Proactive monitoring |
| `duck subconscious` | Self-reflection system |
| `duck cron list` | List scheduled jobs |
| `duck cron enable/disable` | Toggle cron |

### 🎙️ Voice & TTS
| Command | Description |
|---------|-------------|
| `duck voice [text]` | Text-to-speech (MiniMax) |
| `duck speak [text]` | Same as voice |

### 🔍 Diagnostics & Security
| Command | Description |
|---------|-------------|
| `duck doctor` | System diagnostics |
| `duck security-defcon` | DEFCON security mode |
| `duck security audit` | Security audit |

### 💾 Memory & Skills
| Command | Description |
|---------|-------------|
| `duck memory` | Memory system |
| `duck skills list` | List installed skills |
| `duck skills search [q]` | Search ClawHub |
| `duck clawhub install [name]` | Install from ClawHub |

### 💬 Channels
| Command | Description |
|---------|-------------|
| `duck channels` | Start all channels |
| `duck channels telegram` | Telegram only |
| `duck channels discord` | Discord only |

### 🖥️ Desktop & Tools
| Command | Description |
|---------|-------------|
| `duck desktop [action]` | Desktop control |
| `duck exec [cmd]` | Execute shell command |
| `duck tools` | List all MCP tools |

## Tool System

Duck Agent exposes **40 MCP tools** to agents:

```
file_read        - Read file contents
file_write       - Write/edit files
glob             - Find files by pattern
bash             - Execute shell commands
grep             - Search file contents
web_search       - Web search
web_fetch        - Fetch URL content
vision_analyze   - Analyze images
image_generate   - Generate images
speak            - Text-to-speech
remember         - Save to memory
recall           - Search memory
session_search   - Search conversations
todo             - Task planning
delegate_task    - Spawn subagent
browser_navigate - Navigate browser
browser_click    - Click element
browser_type     - Type text
browser_screenshot - Screenshot
```

## Architecture

```
duck (Go binary)
├── cmd/duck/main.go         # CLI wrapper, cobra commands
├── dist/cli/main.js         # TypeScript CLI handler
│   ├── src/agent/core.ts        # Agent brain
│   ├── src/agent/proactive/    # KAIROS proactive AI
│   ├── src/agent/learning-loop.ts  # Self-improvement
│   ├── src/agent/session-store.ts  # SQLite + FTS5 memory
│   ├── src/council/             # AI Council deliberation
│   ├── src/server/mcp-server.ts  # MCP server (40 tools)
│   ├── src/providers/            # Model routing
│   ├── dist/skills/             # Installed skills
│   ├── src/voice/              # Voice wake + talk
│   ├── src/canvas/             # Live Canvas renderer
│   ├── src/security/           # Scanner + Docker sandbox
│   └── src/tools/              # Tool implementations
└── ~/.duck/                   # User data dir
```

## Models

| Provider | Model | Best For |
|----------|-------|----------|
| **MiniMax** | MiniMax-M2.7 | Default, agents, research |
| **Kimi** | kimi-k2.5 | Vision, coding |
| **OpenRouter** | qwen3.6-plus (free) | Free tier |
| **ChatGPT OAuth** | gpt-5.4 | Premium reasoning |
| **LM Studio** | qwen3-vl-8b (local) | Free local vision |

Smart router picks the best for each task automatically.

## Key Features

### 🏛️ AI Council
Local deliberation with 3 councilors (Speaker, Technocrat, Ethicist). No server needed. Vote-based decisions in ~15s.

### 🛰️ Multi-Protocol
- **MCP** — 40 built-in tools via `duck mcp`
- **ACP** — multi-agent coordination via `duck acp-server`
- **REST Gateway** — HTTP API via `duck gateway`
- **WebSocket** — real-time via unified server

### 🛡️ Security
- **Skills Code Scanner** — scans skill code for dangerous patterns
- **Docker Sandbox** — isolated container execution for untrusted tools
- **DEFCON Mode** — threat-level security system

### 📈 Self-Improving
- **Learning Loop** — tracks errors and corrections
- **Memory** — SQLite + FTS5 full-text search
- **Buddy System** — persistent AI companion
- **KAIROS** — proactive monitoring

### 🎨 Live Canvas
- Real-time Canvas rendering via pretext measurement
- AI Council vote panels, consensus meters
- Streaming messages pre-measured for perfect fit

### 🗣️ Voice
- Wake word detection (platform-aware: macOS/Linux/Windows)
- Voice conversation mode
- MiniMax TTS integration

## Configuration

```bash
# ~/.duck/.env (created by `duck setup`)
MINIMAX_API_KEY=sk-cp-...
OPENROUTER_API_KEY=sk-or-...
KIMI_API_KEY=sk-kimi-...
DUCK_PROVIDER=minimax        # default provider
DUCK_MODEL=MiniMax-M2.7      # default model
```

## Data & Logs

```
~/.duck/
├── .env                    # API keys (created by duck setup)
└── memory/
    └── sessions.db         # SQLite + FTS5 session memory
```

## Version

**v0.4.0** — See `CHANGELOG.md` for full release history.
