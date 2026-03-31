# 🦆 Duck CLI

> **⚠️ INTERNAL USE ONLY** - This is a personal AI coding agent for Ryan's setup. Not maintained for public use.

A powerful CLI coding agent that integrates Claude Code, Claude API, Claude SSH, LM Studio, BrowserOS, AI Council, and more into a unified command-line experience.

## Features

### 🤖 AI Providers (10+ Supported)
- **Claude Code** - Full CLI agent with code editing, git workflows, multi-file refactoring
- **Claude API** - Direct API access
- **Claude SSH** - Remote Claude via SSH
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
- **USER.md** - User preferences
- **Session Search** - FTS5 full-text search across all sessions
- **Frozen Snapshots** - Token-efficient context injection

### 🏛️ Multi-Agent
- **AI Council** - Deliberation, voting, consensus
- **Delegate Tool** - Spawn subagents with restricted toolsets
- **Skill System** - Auto-create skills from workflows

### 🔒 Security
- **Auth Profiles** - Health checks, auto-rotation, cooldown
- **Tool Security** - Path traversal, injection scanning
- **DEFCON System** - Threat level monitoring

### 🌐 Integrations
- **BrowserOS** - 53+ browser automation tools
- **MCP Servers** - Model Context Protocol support
- **Git Workflows** - Smart commits, PR workflows

## Quick Start

```bash
# Install
npm install -g @anthropic-ai/claude-code

# Configure API keys
export ANTHROPIC_API_KEY=sk-ant-...
export OPENAI_API_KEY=sk-...

# Run a task
duck run "fix the authentication bug"

# Interactive mode
duck -i
```

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
```

## Architecture

```
Duck CLI/
├── internal/
│   ├── agent/         # Agent core
│   ├── auth/          # Auth profiles
│   ├── cli/           # CLI commands
│   ├── council/        # AI Council
│   ├── integrations/   # External integrations
│   ├── memory/        # SOUL, MEMORY, sessions
│   ├── mcp/           # MCP server management
│   ├── providers/     # AI provider management
│   ├── skills/        # Self-creating skills
│   └── soul/          # Personality system
├── tools/             # Integrated tools
└── skills/            # Duck CLI skills
```

## Environment Variables

```bash
# API Keys
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=...
MINIMAX_API_KEY=...
MOONSHOT_API_KEY=...

# Local Models
OLLAMA_HOST=http://localhost:11434
LMSTUDIO_URL=http://localhost:1234

# MCP Servers
MCP_SERVERS=...  # JSON config for MCP
```

## Status

🟢 **DEFCON 5** - All clear

---

**Built for Ryan's personal setup - Not for public distribution**
