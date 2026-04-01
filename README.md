# 🦆 Duck Agent

> **Duck Agent v0.4.0** — Desktop UI, Sub-Conscious, CopilotKit/Pretext Canvas, KAIROS proactive AI, Agent Mesh networking, OpenClaw-RL self-improvement, 45-agent AI Council, unified headless protocols (MCP/ACP/WebSocket), Claude Code tools, autonomous cron automation, multi-agent orchestration, and OpenClaw v2026.3.31 compatibility.

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

# Start - pick your interface
duck shell              # Interactive TUI shell
duck web [port]         # Web UI (http://localhost:3001)
duck unified            # All protocols (MCP + ACP + WS + Gateway)
duck mcp                # MCP server only (port 3850)
duck gateway            # Gateway API (port 18792)
```

### Docker

```bash
docker-compose up -d
```

---

## 📍 Current Direction

Duck Agent keeps the full original plan, but the implementation direction is now clearer:
- **duck-cli is the main application**
- **OpenClaw is the base infrastructure** (sessions, gateway, MCP, memory, providers)
- **AI Council integration is a first-class priority**
- **openclaude / instructkr-style capabilities are additive bridges**, not destructive rewrites
- **server consolidation should reduce moving parts where safe without removing existing systems**

Fresh planning docs generated during the architecture pass:
- `IMPLEMENTATION_BACKLOG.md` — prioritized build roadmap
- `CONSOLIDATION_PLAN.md` — process/server unification strategy

## 🖥️ Desktop UI — NOW RUNNABLE

**v0.4.0 brings a fully functional desktop shell** built with Vite + React + CopilotKit + Pretext Canvas.

```bash
cd src/ui/desktop
npm install
npm run dev
```

Serves on **http://localhost:5173** — won't conflict with the web UI (port 3001) or gateway (18792).

### What's Included

| Feature | Description |
|---------|-------------|
| 🎨 **Pretext Canvas Toolkit** | Character-level canvas text measurement — AI controls every pixel |
| 💬 **CopilotKit Chat** | Streaming AI chat with generative UI components |
| 📊 **Canvas Metrics** | GPU-rendered charts and stats panels |
| 🌤️ **Animated Cards** | Weather and crypto cards with particle effects |
| 🗳️ **AI Council Votes** | Vote tally visualization on canvas |
| 🌊 **Streaming Messages** | Pre-measured text flowing through canvas |

### Tech Stack

```
src/ui/desktop/
├── Vite + React 19 + TypeScript
├── Tailwind CSS for layout
├── Pretext (@chenglou/pretext) for text measurement
├── CopilotKit (@copilotkit/react-core) for chat
└── Canvas API for generative UI rendering
```

### Run Commands

```bash
cd src/ui/desktop
npm run dev      # Development server (port 5173)
npm run build    # Production build
npm run preview  # Preview production build
```

---

## 👻 Sub-Conscious — Claude Subconscious-Style (No Letta)

**v0.4.0 introduces Sub-Conscious** — a lightweight self-reflection layer that runs whisper prompts through your own AI models. Zero external dependencies, no Letta server needed.

### How It Works

Sub-Conscious intercepts your conversations and silently runs reflection prompts through Duck Agent's own memory and models — surfacing insights, patterns, and nudges without interrupting your flow.

### 5 Rule-Based Whisper Triggers

| # | Trigger | Whisper Prompt Theme |
|---|---------|---------------------|
| 1 | **Long task completion** | What went well / what to remember |
| 2 | **Repeated errors** | Pattern detected — flag for review |
| 3 | **User correction** | Learning moment — update memory |
| 4 | **Multi-provider mix** | Efficiency note — optimize routing |
| 5 | **Idle too long** | Context stale — offer refresh |

### Sub-Conscious Commands

```bash
duck subconscious status   # Check enabled/disabled and stats
duck subconscious enable  # Turn on whisper triggers
duck subconscious disable # Turn off whisper triggers
duck subconscious stats   # Show whisper history and patterns
```

### Example Whisper Output

```
👻 Sub-Conscious whisper:
"Detected 3 corrections today about tone — consider adjusting SOUL.md"
```

### Memory Integration

Sub-Conscious writes its findings directly to Duck Agent's memory layer:
- SOUL.md adjustments → identity layer
- Provider patterns → AGENTS.md
- Learned preferences → MEMORY.md

---

## 🎨 Pretext Canvas — Generative UI Toolkit

**AI measures text → Canvas draws it → You control every pixel.**

Pretext is a text measurement library (no DOM, no CSS) that returns exact pixel positions for any string at any font size. Combined with Canvas, this enables true generative UI — AI controls layout and rendering at the pixel level.

### The Core Pattern

```js
import { prepare, layout, prepareWithSegments, layoutWithLines } from '@chenglou/pretext'

// 1. Pretext measures (fast!)
const prepared = prepare('Hello World', 'bold 64px Inter')
const { height } = layout(prepared, 400, 32) // ~0.09ms

// 2. Canvas draws (GPU!)
ctx.fillText('Hello World', x, y)

// 3. AI orchestrates everything
//    — positions, animations, particles
```

### Pretext Canvas Capabilities

| Feature | Example |
|---------|---------|
| 📊 **Metrics** | Live CPU/RAM/token gauges rendered on canvas |
| 💬 **Streaming Chat** | Pre-measured text blocks flowing into view |
| 🗳️ **Vote Visualization** | Animated approval/rejection bars |
| 🌤️ **Weather Cards** | Animated aurora backgrounds, bouncing icons |
| ₿ **Crypto Cards** | Price charts with particle effects |
| 🐉 **Theme Cards** | RPG-styled stat cards (OSRS, RS3) |

### Pretext Server (Optional)

```bash
node ~/.openclaw/workspace/skills/generative-ui/backend/pretext-server.js &
# Runs on http://localhost:3458

# API:
# POST /  — measure, lines, shrinkwrap, float
# GET  /health
```

### Canvas Generator

```bash
node ~/.openclaw/workspace/skills/generative-ui/backend/pretext-generator.js "weather 72F sunny Dayton"
# Generates /tmp/weather-test.html — animated canvas weather card
```

---

## 🤖 CopilotKit — Generative UI in React

**v0.4.0 integrates CopilotKit** for streaming chat with React-native generative UI components.

### What CopilotKit Enables

| Feature | Description |
|---------|-------------|
| 🔄 **Streaming Responses** | AI text streams into UI in real-time |
| 🎛️ **Shared State** | Agents and UI share reactive state |
| ✋ **Human-in-the-Loop** | UI buttons/sliders inject into agent context |
| 🧩 **Generative Components** | AI renders custom React components mid-stream |

### Desktop UI Integration

The `src/ui/desktop/` app uses `@copilotkit/react-core` and `@copilotkit/react-ui`:

```tsx
import { CopilotKit } from '@copilotkit/react-core'
import { CopilotSidebar } from '@copilotkit/react-ui'

<CopilotKit>
  <YourApp>
    <CopilotSidebar
      instructions="You are DuckBot — helpful, casual, never corporate."
    />
  </YourApp>
</CopilotKit>
```

### Shared State Example

```tsx
// UI shares state with agent
const [context, setContext] = useState({ meshStatus: 'offline' })

// Agent updates shared context
agent.updateContext({ meshStatus: 'connected', agents: 3 })

// UI re-renders reactively
{context.meshStatus === 'connected' && <MeshBadge agents={context.agents} />}
```

### Human-in-the-Loop

```tsx
// Agent can surface interactive controls mid-conversation
<copilotInstructions>
  When user asks about enabling KAIROS mode,
  render the KAIROSModes component with mode buttons.
</copilotInstructions>

<KAIROSModes onSelect={(mode) => agent.updateContext({ kairosMode: mode })} />
```

---

## ✨ Features at a Glance

### ✅ REQUIRED (Always Available)

| Feature | Description |
|---------|-------------|
| 🧠 **KAIROS** | Proactive AI with heartbeat, decision engine, auto-dream |
| 👻 **Sub-Conscious** | Claude-style self-reflection with 5 whisper triggers |
| 🤖 **Agent Core** | Reasoning, task planning, tool orchestration |
| 🛠️ **Claude Code Tools** | 60+ coding tools (read, write, edit, bash, grep, LSP…) |
| 🌐 **MCP Server** | Full MCP 2024-11-05 spec, port 3850 |
| 🚪 **Gateway API** | OpenAI-compatible REST, port 18792 |
| 📡 **ACP Client** | Spawn Codex, Claude, Cursor, Gemini, Pi, OpenClaw |
| 🔗 **ACP Server** | Let OpenClaw connect TO you, port 18794 |
| 🗣️ **Voice / TTS** | MiniMax speech synthesis |
| ⏰ **Cron Automation** | 30+ predefined jobs |
| 💾 **Memory System** | 3-tier context + learned patterns |
| 📱 **Channels** | Telegram & Discord integration |
| 💻 **Desktop Control** | Native macOS/Windows via ClawdCursor |
| 🌐 **Multi-Provider** | MiniMax, Kimi, ChatGPT, LM Studio, Codex |
| 🔐 **Security** | SSRF validation, credential sanitization |
| 🔄 **Update System** | Multi-source pull with backup/restore |

### 🎁 OPTIONAL (Enable When Needed)

| Feature | Description | Setup |
|---------|-------------|-------|
| 🖥️ **Desktop UI** | Native desktop application (NOW RUNNABLE!) | `cd src/ui/desktop && npm run dev` |
| 🌐 **Agent Mesh** | Inter-agent communication network | Start mesh server, set env vars |
| 🧪 **OpenClaw-RL** | Reinforcement learning self-improvement | Run RL server, connect Duck Agent |
| 🏛️ **AI Council (45)** | 45-agent deliberative council | LM Studio models, council server |
| 🎨 **Pretext Canvas** | Generative UI toolkit | Integrated in Desktop UI |
| 🤖 **CopilotKit** | Streaming chat + generative UI | Integrated in Desktop UI |
| 🔧 **ClawHub** | Skill marketplace & sharing | ClawHub server + registry |
| 🦆 **Souls Registry** | SOUL.md personality sharing | ClawHub souls list/search/activate |
| 👥 **Teams** | Multi-agent coordinated execution | Templates pre-configured |
| 🐤 **Buddy** | AI companion with rarities | Pre-configured |

---

## 📡 Port Reference

| Protocol | Duck Agent | OpenClaw |
|----------|-----------|----------|
| **Gateway API** | 18792 | 18789 |
| **MCP Server** | 3850 | 3848 |
| **ACP Server** | 18794 | 18790 |
| **WebSocket** | 18796 | 18791 |
| **Web UI** | 3001 | 3000 |
| **Desktop UI** | 5173 | — |

> 💡 **No conflicts!** Run Duck Agent and OpenClaw simultaneously — all ports are separate.

---

## 🧠 KAIROS Proactive AI — REQUIRED

**Always-on AI that acts without being asked**

```bash
duck kairos                 # Check status
duck kairos aggressive      # Act frequently
duck kairos balanced        # Moderate (default)
duck kairos conservative    # Act rarely
duck kairos enable          # Enable KAIROS
duck kairos disable         # Disable KAIROS
```

| Feature | Description |
|---------|-------------|
| 💭 Heartbeat | Periodic checks for "anything worth doing?" |
| 🎯 Decision Engine | Smart action decisions with pattern learning |
| 🌙 Auto-Dream | Nightly consolidation at 3 AM |
| 📝 Action Logs | Append-only audit trail |
| 🔔 Notifications | Push alerts to Telegram |
| 🧬 Modes | aggressive, balanced, conservative |

---

## 👻 Sub-Conscious — REQUIRED

**Claude Subconscious-style self-reflection without external dependencies**

```bash
duck subconscious status   # Check enabled/disabled
duck subconscious enable  # Enable whisper triggers
duck subconscious disable # Disable whisper triggers
duck subconscious stats   # Show whisper history
```

| # | Trigger | Theme |
|---|---------|-------|
| 1 | Long task completion | What went well / remember |
| 2 | Repeated errors | Pattern detected — flag |
| 3 | User correction | Learning moment — update memory |
| 4 | Multi-provider mix | Efficiency note — optimize routing |
| 5 | Idle too long | Context stale — offer refresh |

---

## 🏛️ AI Council Chamber — OPTIONAL (45 Councilors)

**Deliberative decision making with 45 specialized AI perspectives**

```bash
duck council "Should we refactor the auth module?"
duck council list          # List all 45 councilors
duck council summon <role> # Call specific councilor
```

### The 45 Councilors

| # | Name | Role | Specialty |
|---|------|------|-----------|
| 1 | 🎤 **Speaker** | Facilitator | Orchestrates deliberation |
| 2 | 🔬 **Technocrat** | Technical | Systems, architecture, code |
| 3 | ⚖️ **Ethicist** | Moral | Ethics, privacy, fairness |
| 4 | 🎯 **Pragmatist** | Practical | Feasibility, resources, timelines |
| 5 | 🤔 **Skeptic** | Critical | Weaknesses, failure modes |
| 6 | 🛡️ **Sentinel** | Risk | Security, threats, worst-case |
| 7 | 📊 **Quant** | Math | Statistics, probabilities, ML |
| 8 | 🔮 **Futurist** | Long-term | Trends, predictions, 10-year view |
| 9 | ⚡ **Speedrunner** | Efficiency | Fastest path, shortcuts |
| 10 | 🔍 **Analyst** | Investigation | Deep dive, root cause |
| 11 | 💡 **Innovator** | Creative | Novel solutions, out-of-box |
| 12 | 📖 **Historian** | Context | Past patterns, lessons learned |
| 13 | 🎨 **Designer** | UX | User experience, accessibility |
| 14 | 💰 **Economist** | Cost/Benefit | ROI, tradeoffs, budget |
| 15 | 🌱 **Green** | Sustainability | Environmental impact |
| 16 | 🌍 **Globalist** | Geopolitics | International, cultural |
| 17 | ⚙️ **Engineer** | Implementation | Building, shipping, ops |
| 18 | 🧪 **Tester** | QA | Edge cases, stress testing |
| 19 | 📚 **Librarian** | Knowledge | Documentation, search |
| 20 | 🎭 **Devil's Advocate** | Opposition | Steelman the counter-argument |
| 21 | 🤝 **Mediator** | Conflict | Resolving disagreements |
| 22 | 📈 **Growth** | Scaling | User growth, retention |
| 23 | 🔒 **Privacy Officer** | Data | GDPR, data handling |
| 24 | 🚀 **Launch** | Release | Shipping, deployment |
| 25 | 🔧 **Maintainer** | Long-term | Tech debt, sustainability |
| 26 | 🎓 **Teacher** | Explaining | Simplicity, onboarding |
| 27 | 🎮 **Gamifier** | Engagement | Gamification, motivation |
| 28 | 🌊 **Flow** | UX | Cognitive load, simplicity |
| 29 | 🔔 **Alerts** | Monitoring | Metrics, observability |
| 30 | 🛠️ **Toolsmith** | Automation | Scripting, CI/CD |
| 31 | 🏗️ **Architect** | Design | System design, patterns |
| 32 | 🧬 **Evolution** | Change | Migration, upgrades |
| 33 | 🎪 **Circus** | Chaos | Testing, resilience |
| 34 | 📝 **Scribe** | Writing | Docs, comments, clarity |
| 35 | 🔀 **Refactorer** | Code Health | Clean code, simplicity |
| 36 | 🛡️ **Fortress** | Defense | Security hardening |
| 37 | 🌐 **Network** | Infra | Networking, distributed |
| 38 | 📦 **Package** | Dependencies | npm, libraries, versions |
| 39 | 🧩 **Integration** | APIs | REST, GraphQL, webhooks |
| 40 | 🗄️ **Storage** | Data | Databases, caching |
| 41 | 🔥 **Performance** | Speed | Profiling, optimization |
| 42 | 🧪 **Research** | R&D | Prototyping, experiments |
| 43 | 🏆 **Champion** | Advocacy | Stakeholder alignment |
| 44 | 🎯 **Success** | Outcomes | Goals, OKRs, impact |
| 45 | 🌟 **Sage** | Wisdom | Experience, intuition, judgment |

### Deliberation Modes

| Mode | Use For |
|------|---------|
| ⚖️ **Legislative** | Debate & vote on proposals |
| 🔬 **Deep Research** | Multi-vector investigation |
| 🐛 **Swarm Coding** | Parallel software engineering |
| 📊 **Prediction Market** | Probabilistic forecasting |
| ❓ **Inquiry** | Direct Q&A |
| 🗣️ **Deliberation** | Roundtable discussion |

---

## 🌐 Agent Mesh — OPTIONAL

**Inter-agent communication network**

### Setup

```bash
# 1. Start the mesh server (separate terminal)
cd /Users/duckets/Desktop/agent-mesh-api && npm start
```

```bash
# 2. Set environment variables
export AGENT_MESH_URL=http://localhost:4000
export AGENT_MESH_API_KEY=openclaw-mesh-default-key
```

### Mesh Commands

```bash
duck mesh register           # Join mesh, get agent ID
duck mesh list              # Discover all agents & capabilities
duck mesh status            # Ping mesh server health
duck mesh health            # View mesh health dashboard
duck mesh send <agent> <msg> # Send message to specific agent
duck mesh broadcast <msg>   # Send message to all agents
duck mesh inbox             # Check unread messages
duck mesh capabilities      # Map skills to agents
duck mesh catastrophe       # Check active catastrophe events
```

### Mesh Architecture

```
┌──────────────────────────────────────────────────────┐
│                   Agent Mesh Network                   │
│                  (port 4000 default)                   │
│                                                        │
│   ┌─────────┐      ┌─────────┐      ┌─────────┐      │
│   │  Duck   │◄────►│  Mesh   │◄────►│ Agent   │      │
│   │  Agent  │      │ Server  │      │ Smith   │      │
│   └────┬────┘      └────┬────┘      └────┬────┘      │
│        │                │                │            │
│   Register│         List │           Send │            │
│        │                │                │            │
│        └────────────────┼────────────────┘            │
│                         │                             │
│               ┌─────────▼─────────┐                   │
│               │    Capability     │                   │
│               │     Registry      │                   │
│               └───────────────────┘                   │
└──────────────────────────────────────────────────────┘
```

---

## 🛒 ClawHub Skill Marketplace — OPTIONAL

**clawhub.ai** — Browse, search, and install skills to extend Duck Agent.

```bash
duck clawhub explore              # Browse the skill catalog
duck clawhub search <query>        # Search for skills
duck clawhub install <name>       # Install a skill
duck clawhub list                 # List installed skills
duck clawhub info <name>          # Show skill details
duck clawhub update [name|--all]  # Update skills
duck clawhub uninstall <name>     # Remove a skill
```

---

## 👻 SOUL Registry — AI Personas

**onlycrabs.ai** — Download and activate AI persona files (SOUL.md).

```bash
duck souls featured               # Show featured SOULs
duck souls search <query>         # Search for SOULs
duck souls install <name>         # Install a SOUL
duck souls list                   # List installed SOULs
duck souls activate <name>        # Activate a SOUL
duck souls uninstall <name>       # Remove a SOUL
```

---

## 🧪 OpenClaw-RL — OPTIONAL

**Reinforcement learning-based self-improvement**

### Setup

```bash
# 1. Start the OpenClaw-RL server
cd OpenClaw-RL/slime
bash ../openclaw-rl/run_qwen3_4b_openclaw_rl.sh  # GRPO
# or
bash ../openclaw-opd/run_qwen3_4b_openclaw_opd.sh # OPD
```

```bash
# 2. Connect Duck Agent
duck rl connect http://<host>:30000
duck rl enable
```

### RL Commands

```bash
duck rl status        # Show RL on/off, server, training state
duck rl enable       # Turn on RL training
duck rl disable      # Turn off RL training
duck rl stats        # Show training statistics
duck rl connect <url> # Connect to an RL server
duck rl disconnect   # Remove RL server connection
```

---

## 🎤 Voice / TTS — REQUIRED

**MiniMax speech synthesis built-in**

```bash
duck voice "Hello world"           # Text-to-speech
duck voice --voice casual "Hi!"    # Different style
```

- 4,000 characters/day quota
- Multiple voice styles
- Auto-play on macOS

---

## 🌐 Web UI — REQUIRED

**Full-featured control interface at http://localhost:3001**

| Panel | Features |
|-------|----------|
| 💬 Chat | Messages, code, typing indicators |
| 📊 Dashboard | Uptime, cost, tokens, providers |
| 🧠 KAIROS | Toggle, modes, actions log |
| 🐤 Buddy | Hatch, reroll, species preview |
| 👥 Teams | Templates, member cards |
| 🏛️ AI Council | Deliberation, councilors, output |
| ⏰ Cron | Job scheduler, enable/disable |
| 💾 Memory | View recent memories |
| ⚙️ Settings | Provider config, theme |
| 📋 Logs | Activity viewer |

---

## 🔌 Headless Protocols — REQUIRED

### 🦆 Unified Server (Recommended)

```bash
duck unified
```

| Port | Protocol | Purpose |
|------|----------|---------|
| 3850 | MCP Server | Model Context Protocol |
| 18794 | ACP Gateway | Agent Client Protocol |
| 18796 | WebSocket | Bidirectional messaging |
| 18792 | Gateway API | OpenAI-compatible REST |

### 🔌 MCP Server

```bash
duck mcp
```

**Built-in Tools (14+):** execute, think, remember, recall, kairos_status, kairos_action, desktop_screenshot, desktop_open, desktop_click, desktop_type, get_status, list_tools, ping, spawn_agent

### 🔗 ACP Client — Spawn External Agents

```bash
duck acp codex "Fix the authentication bug"
duck acp claude "Review PR #123"
```

### 🦆 ACP Server — Let OpenClaw Connect TO You

```bash
duck acp-server
```

### 🚪 Gateway API

```bash
curl -X POST http://localhost:18792/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Hello"}]}'
```

---

## 🤖 Agent Systems

### 🐤 Buddy Companion — OPTIONAL

```bash
duck buddy hatch    # Hatch a new buddy
duck buddy list     # List your buddies
duck buddy stats    # View stats
```

| Attribute | Values |
|-----------|--------|
| Rarity | common, uncommon, rare, epic, legendary |
| Species | duck, blob, cat, dragon, owl, ghost, robot, rabbit, cactus, snail |
| Stats | DEBUGGING, PATIENCE, CHAOS, WISDOM, SNARK |

### 👥 Multi-Agent Teams — OPTIONAL

```bash
duck team create code-review    # Create team
duck team spawn research        # Spawn workers
duck team status               # Check progress
```

---

## ⏰ Cron Automation — REQUIRED

**30+ predefined jobs**

```bash
duck cron list              # List all jobs
duck cron enable grow-check # Enable a job
duck cron disable ai-news   # Disable a job
```

| Category | Jobs |
|----------|------|
| **System** | health-check, memory-check, auto-heal, backup, failure-recover |
| **Grow** | morning-check, evening-check, threshold-alert, watering, harvest, monthly-report |
| **Crypto** | portfolio, price-alert, whale-watch, defi-health, news-scan |
| **OSINT** | briefing, keyword-alert, account-watch, github-watch, reddit-digest |
| **News** | daily-brief |
| **Weather** | daily-weather |
| **Home** | equipment-monitor |

---

## 🌐 Multi-Provider Support — REQUIRED

| Provider | Models | Status |
|----------|--------|--------|
| **MiniMax** | M2.7, glm-5, glm-4.7, qwen3.5-plus | ✅ Active |
| **Kimi** | kimi-k2.5, kimi-k2 | ✅ Active |
| **ChatGPT** | gpt-5.4, gpt-5.4-mini | ✅ OAuth |
| **LM Studio** | qwen3-vl-8b, jan-v3-4b, glm-4.7-flash, +13 more | ✅ Local |
| **OpenAI Codex** | gpt-5.3-codex | ✅ Active |

---

## 🔄 OpenClaw Compatibility

| Protocol | Duck Agent | OpenClaw |
|----------|-----------|----------|
| **Gateway** | 18792 | 18789 |
| **MCP** | 3850 | 3848 |
| **ACP** | 18794 | 18790 |
| **WebSocket** | 18796 | 18791 |
| **Web UI** | 3001 | 3000 |
| **Desktop UI** | 5173 | — |

### Running Alongside OpenClaw

```bash
# Terminal 1: Duck Agent
duck unified

# Terminal 2: OpenClaw
openclaw unified

# Both systems run independently — no conflicts!
```

---

## 🏗️ Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                         Duck Agent v0.4.0                        │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                    User Interfaces                          │  │
│  │  Shell (TUI) │ Web UI (:3001) │ Desktop UI (:5173) │ Chat │  │
│  └────────────────────────────────────────────────────────────┘  │
│                               │                                 │
│  ┌───────────────────────────▼──────────────────────────────┐  │
│  │                    KAIROS Core                             │  │
│  │  Heartbeat │ Decision Engine │ Auto-Dream │ Modes         │  │
│  └───────────────────────────────────────────────────────────┘  │
│                               │                                 │
│  ┌───────────┐  ┌─────────┐  ┌──────────┐  ┌─────────────┐    │
│  │  AI      │  │ Agent   │  │ Claude   │  │ Desktop     │    │
│  │  Council │  │ Mesh    │  │  Code    │  │ Control     │    │
│  │  45      │  │ (opt)   │  │ Tools    │  │ ClawdCursor │    │
│  └───────────┘  └─────────┘  └──────────┘  └─────────────┘    │
│                               │                                 │
│  ┌───────────────────────────▼──────────────────────────────┐  │
│  │              Headless Protocol Servers                     │  │
│  │  ┌────────┐  ┌────────┐  ┌────────┐  ┌──────────────┐    │  │
│  │  │  MCP   │  │  ACP   │  │   WS   │  │   Gateway   │    │  │
│  │  │  3850  │  │ 18794  │  │ 18796  │  │    18792    │    │  │
│  │  └────────┘  └────────┘  └────────┘  └──────────────┘    │  │
│  └───────────────────────────────────────────────────────────┘  │
│                               │                                 │
│  ┌───────────────────────────▼──────────────────────────────┐  │
│  │                  Multi-Provider AI Stack                  │  │
│  │  MiniMax │ Kimi │ ChatGPT │ LM Studio │ Codex            │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  OPTIONAL LAYERS:                                                │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Desktop UI (:5173)  │  Sub-Conscious  │  CopilotKit     │  │
│  │  Pretext Canvas      │  Agent Mesh     │  OpenClaw-RL    │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 📦 Directory Structure

```
Duck Agent/
├── src/
│   ├── agent/           # Core AI agent
│   ├── kairos/          # KAIROS autonomous system
│   ├── subconscious/    # Sub-Conscious whisper layer (v0.4.0 NEW)
│   ├── mesh/            # Agent Mesh networking 🌐
│   ├── rl/              # OpenClaw-RL integration 🧪
│   ├── buddy/           # Buddy companion
│   ├── council/         # 45-agent AI Council 🏛️
│   ├── multiagent/      # Team coordination
│   ├── cron/            # Cron scheduler
│   ├── commands/        # CLI commands
│   ├── providers/       # Multi-provider AI
│   ├── tools/           # Tool registry
│   ├── security/        # Security modules
│   ├── server/          # MCP + Unified servers
│   ├── gateway/         # ACP + WebSocket
│   ├── memory/          # Context manager
│   ├── channels/        # Telegram, Discord
│   ├── prompts/         # System prompts
│   ├── compat/          # OpenClaw v2026.3.31 compat layer
│   ├── clawhub/         # ClawHub skill marketplace 🔧
│   ├── souls/           # Souls registry 🦆
│   └── ui/
│       ├── pretext-canvas/  # Generative UI (Pretext + Canvas)
│       ├── a2ui/            # Canvas renderer
│       └── desktop/         # Desktop UI (Vite + React + CopilotKit) 🖥️
├── web-ui/              # Full Web UI
├── docs/                # Documentation
│   ├── ARCHITECTURE.md
│   ├── COMMANDS.md
│   ├── UPDATES.md
│   └── DESKTOP-UI.md
└── package.json
```

---

## 🔧 Commands Reference

```bash
# Core
duck shell              # Interactive TUI
duck run <task>         # Single task
duck think <prompt>     # Reasoning
duck status             # Show status
duck tools              # List tools

# Protocols
duck unified           # All protocols
duck mcp [port]        # MCP server (port 3850)
duck acp <agent> [task]# Spawn ACP
duck acp-server [port] # ACP server (port 18794)
duck gateway           # REST API (port 18792)

# AI Systems
duck kairos [mode]     # KAIROS control
duck subconscious [cmd] # Sub-Conscious (status/enable/disable/stats)
duck buddy [action]     # Buddy system
duck team [action]      # Teams
duck council [query]    # AI Council
duck council list       # List 45 councilors

# Optional: Mesh 🌐
duck mesh register      # Join mesh
duck mesh list          # Discover agents
duck mesh send <id> <m> # Send message
duck mesh broadcast <m> # Broadcast
duck mesh inbox         # Check inbox

# Optional: OpenClaw-RL 🧪
duck rl status          # RL status
duck rl enable          # Enable RL
duck rl disable         # Disable RL
duck rl connect <url>   # Connect RL server

# Optional: ClawHub 🔧
duck clawhub search <q> # Search skills
duck clawhub install <s> # Install skill
duck clawhub list       # List installed

# Optional: Souls 🦆
duck souls list         # Browse souls
duck souls activate <n> # Activate a SOUL

# Automation
duck cron [action]     # Cron jobs
duck update [action]   # Updates

# Integrations
duck channels          # Telegram/Discord
duck desktop           # Desktop control
duck memory            # Memory commands
```

---

## 🔐 Security — REQUIRED

- **SSRF Validation** — Blocks private IPs, DNS rebinding
- **Credential Sanitizer** — Prevents API key leaks
- **State Manager** — Persistent encrypted state
- **Network Policies** — YAML-based access control

---

## 🔄 Update Strategy — REQUIRED

**Multi-source integration from OpenClaw, Claude Code, Hermes, NemoClaw, Codex CLI, and more.**

```bash
duck update check      # Check for updates
duck update install   # Install latest
duck update backup    # Backup first
duck update restore   # Rollback
```

---

## 🛤️ Roadmap

| Version | Milestone | Description |
|---------|-----------|-------------|
| **v0.4.0** | ✅ Desktop UI + Sub-Conscious | Vite+React Desktop UI, CopilotKit, Pretext Canvas, Sub-Conscious |
| **v0.5.0** | 🔧 ClawHub Integration | Full skill marketplace, SOUL.md sharing, community ratings |
| **v1.0.0** | 🏆 Production Ready | Stabilized APIs, comprehensive tests, full documentation |

---

## 📚 Documentation

| Doc | Description |
|-----|-------------|
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | System architecture |
| [COMMANDS.md](docs/COMMANDS.md) | CLI reference |
| [UPDATES.md](docs/UPDATES.md) | Version history & roadmap |
| [DESKTOP-UI.md](docs/DESKTOP-UI.md) | Desktop UI guide (v0.4.0) |

---

## 🐛 Troubleshooting

```bash
# Build from source
npm run build

# Health check (Duck Agent ports)
curl http://localhost:18792/health  # Gateway
curl http://localhost:3850/health  # MCP
curl http://localhost:18794/health # ACP
curl http://localhost:3001/health  # Web UI

# Desktop UI
cd src/ui/desktop && npm run build

# View logs
tail -f ~/.duck-agent/logs/*.log
```

---

## 📄 License

MIT License — Ryan (Duckets) 2026

---

## 🙏 Credits

Inspired by and integrating features from:

[OpenClaw](https://github.com/openclaw/openclaw) · [Claude Code](https://github.com/anthropics/claude-code) · [Hermes-Agent](https://github.com/Franzferdinan51/hermes-agent) · [NemoClaw](https://github.com/NVIDIA/NemoClaw) · [Codex CLI](https://github.com/openai/codex) · [DroidClaw](https://github.com/unitedbyai/droidclaw) · [OpenCrabs](https://github.com/adolfousier/opencrabs) · [TrinityClaw](https://github.com/TrinityClaw/trinity-claw) · [FlowlyAI](https://github.com/Nocetic/flowlyai) · [ClawX](https://github.com/ValueCell-ai/ClawX) · [OpenClaw-RL](https://github.com/Franzferdinan51/OpenClaw-RL) · [agent-mesh-api](https://github.com/Franzferdinan51/agent-mesh-api) · [Pretext](https://github.com/chenglou/pretext) · [CopilotKit](https://github.com/CopilotKit/CopilotKit)
