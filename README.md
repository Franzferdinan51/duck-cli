# 🦆 Duck Agent System

> **A complete AI agent system** - autonomous reasoning, desktop control, multi-agent collaboration.

---

## ⚡ Quick Start

```bash
# Build
npm install && npm run build

# Run interactive shell
node dist/cli/main.js shell

# Run single task
node dist/cli/main.js run "open Safari"

# Check status
node dist/cli/main.js status
```

---

## ✅ Verified Working

| Component | Status | Details |
|-----------|--------|---------|
| **Core Agent** | ✅ Working | Reasoning, planning, execution |
| **Memory System** | ✅ Working | SOUL + persistent storage |
| **Tool Registry** | ✅ Working | 7 tools registered |
| **Skills Loader** | ✅ Working | 10 skills loaded |
| **TUI Shell** | ✅ Working | Interactive mode |
| **Desktop Control** | ✅ Ready | Needs ClawdCursor |
| **Agent Mesh** | ✅ Added | Multi-agent ready |

---

## 🤖 AI Providers

**Status: No API keys detected**

To enable AI providers, set environment variables:

```bash
# Option 1: MiniMax
export MINIMAX_API_KEY="your-key"

# Option 2: Anthropic
export ANTHROPIC_API_KEY="sk-ant-..."

# Option 3: OpenAI
export OPENAI_API_KEY="sk-..."

# Option 4: LM Studio (local, free)
export LMSTUDIO_URL="http://localhost:1234"
```

---

## 🧠 Memory System

### SOUL
Defines agent identity and personality:
```bash
cat .duck/memory/SOUL.md
```

### Memory Commands
```bash
node dist/cli/main.js memory add "User prefers dark mode"
node dist/cli/main.js memory search "preferences"
```

---

## 🔧 Tools

### Built-in Tools (7)
| Tool | Description |
|------|-------------|
| `desktop_open` | Open applications |
| `desktop_click` | Click at coordinates |
| `desktop_type` | Type text |
| `desktop_screenshot` | Take screenshot |
| `memory_search` | Search memory |
| `memory_add` | Add to memory |
| `execute` | Run shell commands |

---

## 📦 Skills (10 loaded)

| Skill | Purpose |
|-------|---------|
| `desktop-control-lobster` | AI drawing, app control, game playing |
| `desktop-control` | AI Agent automation |
| `clawd-cursor` | REST API desktop control |
| `computer-use` | Vision-based UI automation |
| `claude-code-mastery` | Employee-grade Claude overrides |
| `code-review` | Automated code review |
| `context-memory` | Semantic memory |
| `security-audit` | Vulnerability scanning |
| `git-workflow` | Smart git operations |
| `mcp-manager` | MCP server management |

---

## 🖥️ Desktop Control

### ClawdCursor (Recommended)
```bash
# Start ClawdCursor API
cd ~/.openclaw/workspace/clawd-cursor
nohup npx clawdcursor start > /tmp/clawdcursor.log 2>&1 &

# API available at http://127.0.0.1:3847
```

### Desktop Control (Lobster Edition)
Python-based AI agent for:
- Drawing in MS Paint
- Text entry in Notepad
- Application launching
- Game playing

---

## 📡 Agent Mesh

Multi-agent communication via [agent-mesh-api](https://github.com/Franzferdinan51/agent-mesh-api):

```bash
# Start mesh server
cd /path/to/agent-mesh-api
npm start

# Duck Agent connects
export MESH_SERVER=http://localhost:4000
```

---

## 💬 Commands

```bash
# Interactive shell
node dist/cli/main.js shell

# Run task
node dist/cli/main.js run "say hello"

# Desktop commands
node dist/cli/main.js desktop open Calculator

# Memory
node dist/cli/main.js memory add "note here"
node dist/cli/main.js memory search "query"

# Status
node dist/cli/main.js status
```

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Duck Agent                              │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐  │
│  │                   Agent Core                           │  │
│  │   Reasoning → Planning → Execution → Learning         │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │ Providers │ │  Memory  │ │  Tools   │ │  Skills  │       │
│  │  (API)   │ │   SOUL   │ │ Registry │ │ 10 loaded│       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐  │
│  │              Integrations                              │  │
│  │   Desktop Control • Agent Mesh • MCP                 │  │
│  └─────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 📁 Project Structure

```
duck-cli/
├── src/
│   ├── agent/core.ts         # Main agent logic
│   ├── providers/manager.ts   # AI provider support
│   ├── memory/system.ts      # SOUL + memory
│   ├── tools/registry.ts     # Tool execution
│   ├── skills/runner.ts      # Skill loading
│   ├── integrations/
│   │   └── desktop.ts       # ClawdCursor
│   ├── mesh/
│   │   └── client.ts       # Agent Mesh
│   └── cli/main.ts           # CLI/TUI
├── skills/                    # 10 loaded skills
├── .duck/memory/            # Persistent memory
├── docs/
│   └── ARCHITECTURE.md        # System design
└── dist/                    # Built output
```

---

## 🔗 GitHub Integration

Pulls features from:
- [AI-Bot-Council-Concensus](https://github.com/Franzferdinan51/AI-Bot-Council-Concensus)
- [agent-mesh-api](https://github.com/Franzferdinan51/agent-mesh-api)
- [agent-monitor-openclaw-dashboard](https://github.com/Franzferdinan51/agent-monitor-openclaw-dashboard)
- [desktop-control-lobster-edition](https://github.com/Franzferdinan51/desktop-control-lobster-edition)
- OpenClaw, Hermes-agent, BrowserOS

---

## 📄 License

Internal use only.

---

**🦆 v0.1.0** - Built for Ryan (Duckets)
