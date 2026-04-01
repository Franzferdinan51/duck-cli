# 🦆 Duck Agent — Installation Guide

**For OpenClaw agents and AI assistants setting up duck-cli**

---

## Prerequisites

| Dependency | Version | Why |
|------------|---------|-----|
| **Node.js** | 20+ | TypeScript agent runtime |
| **Go** | 1.21+ | CLI wrapper |
| **Git** | any | Clone repo |
| **npm** | 10+ | Install Node deps |

---

## Quick Install (5 minutes)

```bash
# 1. Clone
git clone https://github.com/Franzferdinan51/duck-cli.git
cd duck-cli

# 2. Install Node dependencies
npm install

# 3. Build TypeScript → JavaScript
npm run build

# 4. Build Go CLI wrapper
go build -o duck ./cmd/duck/

# 5. Configure API key (REQUIRED for AI features)
cp .env.example .env
# Edit .env and add: MINIMAX_API_KEY=your_key_here

# 6. Test it works
./duck status
```

---

## What Gets Built

| File | What it is |
|------|-----------|
| `duck` (binary) | Go CLI wrapper — the command you run |
| `dist/cli/main.js` | Node.js TypeScript compiled output |
| `dist/tools/*.js` | Compiled tool modules |
| `dist/web-server.js` | Web UI server |
| `dist/agent/core.js` | Core agent engine |

The Go binary (`duck`) calls `dist/cli/main.js` automatically. Keep them together.

---

## Configuration

### Required: `.env` file

Create `.env` in the same directory as the `duck` binary:

```bash
# Required for AI features
MINIMAX_API_KEY=sk-your-key-here

# Optional providers (all work without these)
# OPENAI_API_KEY=sk-...
# ANTHROPIC_API_KEY=sk-ant-...
# LMSTUDIO_URL=http://localhost:1234
# LMSTUDIO_KEY=local
```

The binary auto-loads `.env` from:
1. `./.env` (next to the `duck` binary)
2. `~/.duck-cli/env`
3. `.env` in current working directory

---

## Commands Reference

```bash
# Status check (no API key needed for this)
./duck status

# Run a task (requires MINIMAX_API_KEY)
./duck run "explain this code"

# Interactive shell (requires TTY)
./duck shell

# Web UI
./duck web           # port 3000
./duck web 8080      # custom port

# AI Council deliberation
./duck council decision "should we add caching?"

# Skills
./duck skills list
./duck skills search <topic>

# MCP server
./duck mcp           # port 3850
./duck mcp 4000      # custom port

# Security
./duck security defcon
./duck security audit

# Help
./duck --help
```

---

## Skills System

Duck CLI has 10 built-in skills that extend its capabilities. Each skill is auto-discovered from `skills/` directory.

| Skill | Trigger | What it does |
|-------|---------|-------------|
| `code-review` | `/review`, "code review" | Multi-agent code verification |
| `git-workflow` | `/git`, "git workflow" | Worktree isolation, smart commits |
| `context-memory` | automatic | Persistent semantic memory |
| `mcp-manager` | `/mcp` | MCP server lifecycle |
| `security-audit` | `/audit` | Vulnerability scanning |
| `desktop-control` | automatic | Desktop automation tools |
| `clawd-cursor` | automatic | Cursor-based GUI control |
| `claude-code-mastery` | automatic | Claude Code patterns |
| `computer-use` | automatic | Computer use protocols |
| `desktop-control-lobster` | automatic | Lobster-specific controls |

---

## Troubleshooting

### "Providers: 0" — API key not loaded
```bash
# Check if .env exists and has the key
cat .env | grep MINIMAX

# Or set manually
export MINIMAX_API_KEY=your_key
./duck status
```

### "Node.js not found"
```bash
# Install Node.js 20+
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
sudo apt install nodejs

# Or via nvm
nvm install 20
nvm use 20
```

### Go build fails
```bash
# Install Go 1.21+
brew install go    # macOS
# or: https://go.dev/doc/install
```

### Web UI returns 404
```bash
# Make sure you built first
npm run build

# Start on specific port
./duck web 3001
```

### Skills not loading
```bash
# Rebuild TypeScript
npm run build

# Should show "Skills: 10" in status
./duck status
```

---

## Development

```bash
# Watch mode (auto-rebuild on changes)
npm run watch

# Type check only
npm run typecheck

# Run tests
npm test

# Lint
npm run lint
```

---

## Architecture (for agents)

```
duck (Go binary)
└── dist/cli/main.js (Node.js entry)
    ├── dist/agent/core.js (Agent engine)
    │   ├── dist/providers/*.js (AI provider integration)
    │   ├── dist/tools/*.js (Tool implementations)
    │   └── dist/skills/*.js (Skill runners)
    └── dist/web-server.js (Web UI server)
```

**Key paths:**
- Source: `src/`
- Compiled: `dist/`
- Skills: `skills/`
- Config: `.env`
