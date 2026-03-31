# 🦆 Duck CLI

> **⚠️ INTERNAL USE ONLY** - Personal AI coding agent for Ryan's setup. Not maintained for public distribution.

**The ultimate CLI coding agent** combining Claude Code, OpenClaw, Hermes-agent, and BrowserOS into one powerful tool.

---

## ⚡ Quick Start

```bash
# Clone & build
git clone https://github.com/Franzferdinan51/duck-cli.git
cd duck-cli
npm install && npm run build

# Link globally
npm link

# Configure API keys
export ANTHROPIC_API_KEY=sk-ant-...
export MINIMAX_API_KEY=...

# Run
duck run "fix the authentication bug"
duck -i
```

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    OpenClaw Gateway                          │
│         (handles all chat channels)                         │
│    Telegram · Discord · Signal · WhatsApp · WebChat          │
└────────────────────────────┬────────────────────────────────┘
                             │ ACP WebSocket
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                        Duck CLI                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Go CLI (cmd/duck/) → TypeScript Agent (internal/)    │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐        │
│  │ Providers│ │ Memory  │ │ Skills  │ │ Council │        │
│  │ Manager  │ │ System  │ │ Runner  │ │ Runner  │        │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘        │
│                                                              │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐        │
│  │   MCP   │ │Security │ │ Channels│ │ Gateway │        │
│  │ Manager │ │ Monitor │ │  (stub) │ │   ACP   │        │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘        │
└─────────────────────────────────────────────────────────────┘
```

**Key principle:** Duck CLI uses OpenClaw for channels (Telegram, Discord). No direct polling = no conflicts.

---

## 🤖 AI Providers

**10+ providers** - use the best for each job:

| Provider | Env Variable | Best For |
|----------|--------------|----------|
| **Claude Code** | `ANTHROPIC_API_KEY` | Premium coding |
| **Claude API** | `ANTHROPIC_API_KEY` | Direct API |
| **MiniMax** | `MINIMAX_API_KEY` | Fast, cheap |
| **Kimi/Moonshot** | `MOONSHOT_API_KEY` | Long context |
| **OpenAI** | `OPENAI_API_KEY` | GPT-4 |
| **Gemini** | `GEMINI_API_KEY` | Google models |
| **DeepSeek** | `DEEPSEEK_API_KEY` | Coding |
| **ZAI** | `ZAI_API_KEY` | ZAI models |
| **LM Studio** | `LMSTUDIO_URL` | Local (free) |
| **Ollama** | `OLLAMA_HOST` | Local (free) |

---

## 🧠 Memory & Identity

| System | File | Purpose |
|--------|------|---------|
| **SOUL** | `SOUL.md` | Personality, tone, rules |
| **MEMORY** | `MEMORY.md` | Facts, learnings, context |
| **USER** | `USER.md` | User preferences |
| **FTS5 Search** | SQLite | Full-text session search |
| **Frozen Snapshots** | Memory | Token-efficient context |

### SOUL.md Example
```markdown
## My Personality
- Tone: casual
- Swearing: allowed when appropriate
- Homie mode: true
- Emoji: yes, but not excessive

## Rules
- Be direct, no padding
- Call out bullshit
- Get the job done
```

---

## 🏛️ Multi-Agent System

### AI Council
Multi-agent deliberation and voting system:
```bash
duck council "Should we refactor the auth system?"
```

### Delegate Tool
Spawn subagents with restricted toolsets:
```bash
duck agent spawn fix-auth "fix the auth bug"
```

### Self-Creating Skills
Agent learns from workflows and creates SKILL.md:
```bash
# Agent detects pattern → creates skill automatically
# Edit skill: ~/.duck/skills/[skill-name]/SKILL.md
```

---

## 🛡️ Security

### DEFCON System
Threat level monitoring:
```bash
duck security defcon     # Show current level
duck security audit     # Run security scan
```

### Auth Profiles
Health checks and auto-rotation:
- Per-provider credential stores
- Failure tracking and cooldown
- Automatic rotation on failure

### Tool Security
- Path traversal detection
- Command injection scanning
- Unsafe execution blocking

---

## 🌐 Integrations

### OpenClaw Gateway (Recommended)
Connect to OpenClaw for channels:
```bash
export OPENCLAW_GATEWAY=ws://localhost:18789
export OPENCLAW_TOKEN=your_token
duck gateway connect
```

### MCP Servers
```bash
duck mcp list           # List configured servers
duck mcp add <name> <cmd>  # Add server
duck mcp remove <name>    # Remove server
```

### Claude Code Integration
```typescript
import { ClaudeCodeIntegration } from './integrations/claude-code';
const claude = new ClaudeCodeIntegration();
const result = await claude.run("fix this bug");
```

### BrowserOS Integration
53+ browser automation tools:
```bash
duck browser nav https://example.com
duck browser click "#submit"
duck browser screenshot
```

### AI Council
```bash
duck council "What features should we add?"
```

---

## 📁 Project Structure

```
duck-cli/
├── cmd/duck/           # Go CLI wrapper
│   └── main.go
├── internal/            # TypeScript agent core
│   ├── agent/          # Agent core, args, delegate
│   ├── auth/           # Auth profiles
│   ├── channels/       # Channel integrations (stub)
│   ├── cli/            # CLI commands
│   ├── council/        # AI Council
│   ├── cron/           # Cron scheduler
│   ├── gateway/        # ACP client
│   ├── integrations/    # Claude Code, BrowserOS
│   ├── memory/         # SOUL, MEMORY, sessions, FTS5
│   ├── mcp/            # MCP manager
│   ├── providers/      # AI provider management
│   ├── security/       # Security monitor
│   ├── skills/         # Skills runner, self-creator
│   └── tools/          # Tool registry, toolsets
├── sources/            # Cloned research repos
│   ├── claude-code/
│   ├── gemini-cli/
│   └── hermes-agent/
├── skills/             # Duck CLI skills
│   └── claude-code-mastery/
├── tools/              # Integrated tools
│   └── SKILL.md
├── docs/
│   └── BUILD.md
├── package.json
└── README.md
```

---

## 🚀 Commands

```bash
# Core
duck run "task"              # Run a task
duck -i                       # Interactive shell

# Agents
duck agent list              # List agents
duck agent spawn <name> <task>  # Spawn subagent

# Memory
duck memory list             # List memories
duck memory add <text>      # Add memory
duck memory search <query>   # Search memories

# Skills
duck skills list             # List skills
duck skills create <name>   # Create skill

# Council
duck council "question"      # Ask AI Council

# Security
duck security audit         # Run audit
duck security defcon        # Show DEFCON level

# MCP
duck mcp list               # List MCP servers
duck mcp add <name> <cmd>   # Add server

# Gateway
duck gateway connect        # Connect to OpenClaw

# Import
duck import <dir>           # Import OpenClaw/Hermes setup

# Channels (via OpenClaw gateway)
duck channels list          # List configured channels
duck channels send <ch> <msg>  # Send message
```

---

## 🔧 Environment Variables

```bash
# AI Providers (pick your combination)
ANTHROPIC_API_KEY=sk-ant-...    # Claude
OPENAI_API_KEY=sk-...           # OpenAI
MINIMAX_API_KEY=...             # MiniMax
MOONSHOT_API_KEY=...            # Kimi
GEMINI_API_KEY=...              # Gemini
DEEPSEEK_API_KEY=...            # DeepSeek

# Local Models
OLLAMA_HOST=http://localhost:11434
LMSTUDIO_URL=http://localhost:1234

# OpenClaw Gateway (for channels)
OPENCLAW_GATEWAY=ws://localhost:18789
OPENCLAW_TOKEN=your_token

# MCP Servers
MCP_SERVERS='{"servers":{"name":{"command":"..."}}}'
```

---

## 🛠️ Build from Source

```bash
git clone https://github.com/Franzferdinan51/duck-cli.git
cd duck-cli

# Install dependencies
npm install

# Build TypeScript
npm run build

# Build Go (optional)
npm run build:go

# Link
npm link

# Use
duck run "fix auth bug"
```

See [docs/BUILD.md](docs/BUILD.md) for details.

---

## 🦆 Claude Code Employee-Grade Overrides

Based on @iamfakeguru's reverse-engineering:

### The 7 Hidden Problems
1. **Success metric is broken** - bytes hit disk ≠ code compiles
2. **Context compaction** - loses context at 167K tokens
3. **Briefness mandate** - fights perfect code
4. **Swarm unused** - 5 agents = 835K tokens available
5. **2K line cap** - files silently truncated
6. **50K result cap** - tool results truncated
7. **grep ≠ AST** - misses dynamic imports

### Override Checklist
```bash
# BEFORE claiming "done":
npx tsc --noEmit && npx eslint . --quiet

# File >500 LOC? Chunk reads.
# >5 files? Launch 5-8 parallel agents.
# 10+ messages? Re-read everything.
```

Full override in `skills/claude-code-mastery/SKILL.md`

---

## 📦 What's Integrated

### From OpenClaw
- SOUL.md personality system
- MEMORY.md / USER.md
- Session pruning
- Auth profiles
- MCP registry
- Security scanner
- Multi-provider fallback

### From Hermes-Agent
- FTS5 session search
- Frozen snapshot memory
- Self-creating skills
- Delegate tool
- Cron scheduler
- Toolset distributions

### From BrowserOS
- 53+ browser automation tools
- OAuth app integrations
- Tab management
- JavaScript execution

---

## ⚠️ Common Issues

### "getUpdates conflict" on Telegram
→ Multiple processes polling same bot
→ Use OpenClaw gateway instead of direct polling

### "Provider not available"
→ API key not set
→ Check `duck run` with `--list-providers`

### Build errors
```bash
rm -rf node_modules package-lock.json
npm install && npm run build
```

---

## 📝 License

Internal use only. Not for public distribution.

---

## 🔗 Links

- **GitHub:** https://github.com/Franzferdinan51/duck-cli
- **OpenClaw:** https://github.com/openclaw/openclaw
- **Hermes-agent:** https://github.com/nousresearch/hermes-agent

---

**Built for Ryan's setup · 🦆 Duck CLI v0.1.0**
