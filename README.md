# 🦆 Duck Agent System

> **A complete AI agent system** - standalone agent + MCP server for OpenClaw.

---

## ⚡ Quick Start

```bash
# Build
npm install && npm run build

# Interactive TUI shell
node dist/cli/main.js shell

# Run single task
node dist/cli/main.js run "say hello"

# Check status
node dist/cli/main.js status

# Think about something
node dist/cli/main.js think "Why is the sky blue"

# Remember something
node dist/cli/main.js remember "User prefers dark mode"

# Search memory
node dist/cli/main.js recall "preferences"
```

---

## 🎯 Two Modes in One

### 1️⃣ Standalone Agent
```bash
# Interactive shell
node dist/cli/main.js shell

# Single task
node dist/cli/main.js run "open Safari"

# Reasoning
node dist/cli/main.js think "Should I learn Rust or Go?"
```

### 2️⃣ MCP Server (for OpenClaw)
```bash
# Start MCP server
node dist/cli/main.js mcp

# Or specify port
node dist/cli/main.js mcp 3848

# OpenClaw connects via:
# POST http://localhost:3848/mcp
```

---

## ✅ Verified Working

| Component | Status |
|-----------|--------|
| **Core Agent** | ✅ Working |
| **TUI Shell** | ✅ Working |
| **Memory (remember/recall)** | ✅ Working |
| **Reasoning (think)** | ✅ Working |
| **Skills (10 loaded)** | ✅ Working |
| **Tools (7 registered)** | ✅ Working |
| **MCP Server Mode** | ✅ Working |
| **Desktop Control** | ✅ Ready |

---

## 🤖 AI Providers

**Status: No API keys detected**

Set environment variables for AI-powered reasoning:

```bash
export MINIMAX_API_KEY="your-key"
export ANTHROPIC_API_KEY="sk-ant-..."
export OPENAI_API_KEY="sk-..."
export LMSTUDIO_URL="http://localhost:1234"
```

---

## 🧠 Memory Commands

```bash
# Remember something
node dist/cli/main.js remember "API docs are in /docs"

# Search memory
node dist/cli/main.js recall "API docs"

# In shell mode
/remember User likes coffee
/recall coffee
```

---

## 📦 Skills (10 loaded)

| Skill | Purpose |
|-------|---------|
| `desktop-control-lobster` | AI drawing, automation |
| `desktop-control` | AI Agent automation |
| `clawd-cursor` | REST API desktop control |
| `computer-use` | Vision-based UI automation |
| `claude-code-mastery` | Employee-grade overrides |
| `code-review` | Automated code review |
| `context-memory` | Semantic memory |
| `security-audit` | Vulnerability scanning |
| `git-workflow` | Smart git operations |
| `mcp-manager` | MCP server management |

---

## 🖥️ Desktop Control

```bash
# Open app
node dist/cli/main.js desktop open Calculator

# Click
node dist/cli/main.js desktop click 100 200

# Type
node dist/cli/main.js desktop type "Hello"

# Screenshot
node dist/cli/main.js desktop screenshot
```

Requires ClawdCursor running:
```bash
cd ~/.openclaw/workspace/clawd-cursor
nohup npx clawdcursor start > /tmp/clawdcursor.log 2>&1 &
```

---

## 📡 MCP Server Integration

Duck Agent can run as an MCP server that OpenClaw can connect to:

```bash
# Start server
node dist/cli/main.js mcp 3848

# Available endpoints:
POST /mcp     - JSON-RPC MCP protocol
GET  /sse     - Server-Sent Events
GET  /tools   - List available tools
GET  /health  - Health check
```

### MCP Tools Available
- `execute` - Run a task
- `think` - Reasoning
- `remember` - Add to memory
- `recall` - Search memory
- `status` - Get agent status
- `desktop` - Control desktop

---

## 💬 Shell Commands

```bash
node dist/cli/main.js shell

# Inside shell:
/help           Show help
/status         Show status
/skills         List skills
/think <prompt> Think about something
/remember <txt> Remember something
/recall <query> Search memory
/clear          Clear screen
/quit           Exit

# Or just type what you want:
open Calculator
remember my name is Ryan
what is machine learning
```

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Duck Agent                                │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Agent Core                              │   │
│  │   Think → Reason → Plan → Execute → Remember          │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│  │ Providers │ │  Memory  │ │  Tools   │ │  Skills  │      │
│  │  (API)   │ │ SOUL+Facts│ │ Registry │ │ 10 loaded│      │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘      │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Dual Mode                                           │   │
│  │  🖥️ Standalone (shell, CLI)                         │   │
│  │  📡 MCP Server (for OpenClaw)                       │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## 📁 Project Structure

```
duck-cli/
├── src/
│   ├── agent/core.ts         # Main agent
│   ├── providers/manager.ts   # AI providers
│   ├── memory/system.ts      # SOUL + memory
│   ├── tools/registry.ts     # Tool execution
│   ├── skills/runner.ts      # Skill loading
│   ├── integrations/
│   │   └── desktop.ts        # ClawdCursor
│   ├── server/
│   │   └── mcp-server.ts    # MCP server mode
│   └── cli/
│       └── main.ts          # CLI/TUI
├── skills/                   # 10 skills
├── .duck/memory/           # Persistent memory
└── dist/                    # Built output
```

---

## 🔗 GitHub

```
https://github.com/Franzferdinan51/duck-cli
```

---

**🦆 v0.1.0** - Built for Ryan (Duckets)
