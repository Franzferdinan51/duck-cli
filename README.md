# 🦆 Duck CLI

> **⚠️ INTERNAL USE ONLY** - Personal AI coding agent. Build from source only.

A powerful CLI coding agent that integrates Claude Code, Claude API, LM Studio, AI Council, and more into a unified command-line experience.

**Does NOT require npm registry** - Build from source.

## ⚡ Quick Start

```bash
git clone https://github.com/Franzferdinan51/duck-cli.git
cd duck-cli
bun install  # or: npm install
bun run build  # or: npm run build
bun link  # or: npm link

# Configure
export ANTHROPIC_API_KEY=sk-ant-...

# Run
duck run "fix the authentication bug"
```

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│            OpenClaw Gateway (handles channels)            │
│    Telegram, Discord, Signal, WhatsApp                    │
│    Polling, message routing, sessions                     │
└─────────────────────────┬───────────────────────────────┘
                          │ ACP protocol (WebSocket)
                          ▼
┌─────────────────────────────────────────────────────────┐
│                  Duck CLI (build from source)              │
│   Code editing, tools, skills, memory, Claude Code       │
│   NO direct channel polling - uses OpenClaw gateway       │
└─────────────────────────────────────────────────────────┘
```

**Why this matters:** OpenClaw handles Telegram/Discord. Duck CLI connects via ACP to avoid conflicts.

## Features

### 🤖 AI Providers (10+ Supported)
- **Claude Code** - Full CLI agent with code editing, git workflows
- **Claude API** - Direct API access
- **MiniMax** - Fast, cheap inference
- **Kimi/Moonshot** - Long context windows
- **OpenAI/GPT** - GPT-4, GPT-3.5
- **Gemini** - Google's models
- **LM Studio** - Local models (no API cost)
- **Ollama** - Local models
- **DeepSeek** - Coding-focused
- **ZAI** - ZAI models

### 🧠 Memory & Context
- **SOUL.md** - Agent personality configuration
- **MEMORY.md** - Persistent facts and learnings
- **Session Search** - FTS5 full-text search across sessions
- **Frozen Snapshots** - Token-efficient context injection

### 🏛️ Multi-Agent
- **AI Council** - Deliberation, voting, consensus
- **Claude Code Mastery** - Employee-grade overrides
- **Delegate Tool** - Spawn subagents with restricted toolsets
- **Skill System** - Auto-create skills from workflows

### 🔒 Security
- **Auth Profiles** - Health checks, auto-rotation, cooldown
- **Tool Security** - Path traversal, injection scanning
- **DEFCON System** - Threat level monitoring

### 🌐 Integrations
- **OpenClaw Gateway** - ACP client (Telegram, Discord via gateway)
- **BrowserOS** - 53+ browser automation tools
- **MCP Servers** - Model Context Protocol support
- **Claude Code** - Premium code editing

## Commands

```bash
duck run "task"        # Run a task
duck -i               # Interactive shell
duck agent spawn <name> <task>  # Spawn subagent
duck mcp list         # List MCP servers
duck skills list      # List skills
duck security audit   # Run security scan
duck council "question" # Ask AI Council
duck soul             # Show personality
duck memory           # Manage memories
duck import <dir>    # Import OpenClaw setup
duck gateway connect  # Connect to OpenClaw
```

## Environment Variables

```bash
# AI Providers
ANTHROPIC_API_KEY=sk-ant-...    # Claude
OPENAI_API_KEY=sk-...           # GPT
MINIMAX_API_KEY=...             # MiniMax
MOONSHOT_API_KEY=...            # Kimi
GEMINI_API_KEY=...              # Gemini
DEEPSEEK_API_KEY=...            # DeepSeek

# Local Models
OLLAMA_HOST=http://localhost:11434
LMSTUDIO_URL=http://localhost:1234

# OpenClaw Gateway (RECOMMENDED - for channels)
OPENCLAW_GATEWAY=ws://localhost:18789
OPENCLAW_TOKEN=your_token

# Channels (via OpenClaw gateway - NO direct polling!)
# Don't set TELEGRAM_BOT_TOKEN or DISCORD_BOT_TOKEN in Duck CLI
# OpenClaw handles them
```

## Build from Source

See [docs/BUILD.md](docs/BUILD.md) for detailed instructions.

```bash
# Clone
git clone https://github.com/Franzferdinan51/duck-cli.git
cd duck-cli

# Build
bun install && bun run build

# Link
bun link

# Use
duck run "fix auth bug"
```

## Skills

| Skill | Purpose |
|-------|---------|
| `claude-code-mastery` | Employee-grade Claude Code overrides |
| `code-review` | Automated code review |
| `context-memory` | Persistent semantic memory |
| `git-workflow` | Smart git operations |
| `security-audit` | Vulnerability scanning |

## Claude Code Employee-Grade Overrides

Based on reverse-engineering by @iamfakeguru:

```markdown
# Employee-grade config (in CLAUDE.md):
- Forced verification (tsc + eslint before claiming success)
- Context decay awareness (re-read files after 10+ messages)
- File read chunking (>500 LOC)
- Sub-agent swarming (>5 files)
- Tool result verification (check for truncation)
```

## OpenClaw Gateway Integration

**Why:** Avoids Telegram/Discord polling conflicts.

```typescript
import { connectToOpenClaw } from './internal/gateway/acp-client';

const client = await connectToOpenClaw();

// Send via OpenClaw gateway (NO conflicts!)
await client.sendMessage('telegram', '588090613', 'Hello!');

// Run task via gateway
const result = await client.runTask('Fix the auth bug');
```

## GitHub

```
https://github.com/Franzferdinan51/duck-cli
```

---

**Built for Ryan's personal setup - Internal use only**
