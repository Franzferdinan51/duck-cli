# 🦆 Duck Agent System

> **A complete AI agent system** - autonomous reasoning, desktop control, multi-agent collaboration.

---

## ⚡ Quick Start

```bash
# Build
npm install && npm run build

# Run shell
node dist/cli/main.js shell

# Run task
node dist/cli/main.js run "open Safari"

# Status
node dist/cli/main.js status
```

---

## 🎯 What It Does

Duck Agent is a **standalone AI agent** that can:
- 🤖 **Think and reason** autonomously
- 🖥️ **Control your desktop** via ClawdCursor
- 🧠 **Remember context** across sessions (SOUL + memory)
- 📡 **Talk to other agents** via Agent Mesh
- 🔧 **Use tools** to accomplish tasks
- 📦 **Load skills** for specialized capabilities

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
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │ Providers │ │  Memory  │ │  Tools   │ │  Skills  │   │
│  │ MiniMax   │ │   SOUL   │ │ Desktop  │ │ 10 loaded│   │
│  │ LM Studio │ │  Facts   │ │ Execute  │ │          │   │
│  │ Anthropic │ │  Context │ │ Files    │ │          │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐  │
│  │              Integrations                              │  │
│  │   Agent Mesh (multi-agent) • ClawdCursor (desktop)    │  │
│  │   MCP Servers • OpenClaw Gateway                     │  │
│  └─────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 📁 Project Structure

```
duck-cli/
├── src/
│   ├── agent/core.ts         # Main agent logic
│   ├── providers/manager.ts   # AI providers
│   ├── memory/system.ts       # SOUL + memory
│   ├── tools/registry.ts      # Tool execution
│   ├── skills/runner.ts       # Skill loading
│   ├── integrations/
│   │   └── desktop.ts         # ClawdCursor
│   ├── mesh/
│   │   └── client.ts          # Agent Mesh
│   └── cli/main.ts            # CLI entry
├── skills/                    # Loaded skills
│   ├── desktop-control/       # AI drawing/automation
│   ├── clawd-cursor/         # Desktop control
│   ├── claude-code-mastery/   # Employee overrides
│   └── ...
├── docs/
│   └── ARCHITECTURE.md        # System design
└── dist/                     # Built output
```

---

## 🤖 AI Providers

Set API keys via environment variables:

| Provider | Env Variable | Status |
|----------|-------------|--------|
| **MiniMax** | `MINIMAX_API_KEY` | Ready |
| **LM Studio** | `LMSTUDIO_URL` | Local |
| **Anthropic** | `ANTHROPIC_API_KEY` | Ready |
| **OpenAI** | `OPENAI_API_KEY` | Ready |

---

## 🧠 Memory System

### SOUL
Defines who the agent is:
```
.duck/memory/SOUL.md
```

### Memory Types
- **facts** - Learned information
- **interactions** - Past tasks and results
- **learned** - Self-improvements

---

## 🔧 Tools

Built-in tools:
- `desktop_open` - Open applications
- `desktop_click` - Click at coordinates
- `desktop_type` - Type text
- `desktop_screenshot` - Take screenshot
- `memory_search` - Search memory
- `memory_add` - Add to memory
- `execute` - Run shell commands

---

## 📦 Skills

Loaded automatically from `skills/` directory:

| Skill | Purpose |
|-------|---------|
| **desktop-control** | AI drawing, app control |
| **clawd-cursor** | REST API desktop control |
| **claude-code-mastery** | Employee-grade overrides |
| **code-review** | Automated code review |
| **context-memory** | Semantic memory |
| **security-audit** | Vulnerability scanning |
| **git-workflow** | Smart git operations |
| **mcp-manager** | MCP server management |

---

## 📡 Agent Mesh

Multi-agent communication via [agent-mesh-api](https://github.com/Franzferdinan51/agent-mesh-api):

```bash
# Start mesh server (on mesh machine)
cd /path/to/agent-mesh-api
npm start

# Duck Agent connects to mesh
export MESH_SERVER=http://localhost:4000
export MESH_API_KEY=openclaw-mesh-default-key

# Agent can now:
# - Send messages to other agents
# - Delegate tasks
# - Share knowledge
# - Broadcast announcements
```

---

## 🖥️ Desktop Control

Uses ClawdCursor API (must be running):

```bash
# Start ClawdCursor
cd ~/.openclaw/workspace/clawd-cursor
nohup npx clawdcursor start > /tmp/clawdcursor.log 2>&1 &

# API available at http://127.0.0.1:3847
```

---

## 💬 Commands

```bash
# Interactive shell
duck shell

# Single task
duck run "open Safari"

# Desktop control
duck desktop open Calculator

# Memory
duck memory add "User prefers dark mode"
duck memory search "preferences"

# Status
duck status
```

---

## 🔐 Security

- DEFCON threat levels
- Path traversal protection
- Command injection detection
- Tool sandboxing

---

## 📝 GitHub Integration

Pulls features from:
- [AI-Bot-Council-Concensus](https://github.com/Franzferdinan51/AI-Bot-Council-Concensus)
- [agent-mesh-api](https://github.com/Franzferdinan51/agent-mesh-api)
- [agent-monitor-openclaw-dashboard](https://github.com/Franzferdinan51/agent-monitor-openclaw-dashboard)
- OpenClaw, Hermes-agent, BrowserOS

---

## 🚀 Status

```
Providers: 0 (need API keys)
Tools: 7 (all registered)
Skills: 10 (all loaded)
Memory: Working
Desktop: Waiting for ClawdCursor
Mesh: Ready to connect
```

---

## 📄 License

Internal use only.

---

**🦆 v0.1.0** - Built by Ryan (Duckets)
