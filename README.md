# 🦆 duck-cli

> **🦸 Super Agent** — A rival to Claude Code, Letta Code, and OpenAI Codex. Desktop AI agent with LLM-powered Meta-Agent Orchestrator, AI Council deliberation, persistent memory, multi-provider routing (MiniMax/LM Studio/Kimi/GPT/OpenRouter), agent-mesh communication bus, and 102 built-in tools. Runs on Mac/PC/Linux/Android.

[![GitHub](https://img.shields.io/github/stars/Franzferdinan51/duck-cli?style=social)](https://github.com/Franzferdinan51/duck-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)
[![Go](https://img.shields.io/badge/Go-1.21+-blue.svg)](https://go.dev/)

---

## ⚡ Quick Start

```bash
# Install
git clone https://github.com/Franzferdinan51/duck-cli.git
cd duck-cli
npm install && npm run build

# Run a task
./duck run "what is the capital of Japan?"

# Meta-Agent planning (LLM-powered orchestration, qwen3.5-0.8b local free!)
./duck meta plan "build a REST API"
./duck meta run "build a REST API" --planner qwen3.5-0.8b --provider lmstudio

# Interactive shell
./duck shell

# Check status and providers
./duck status
./duck providers list

# Telegram bot (standalone — connects to @AgentSmithsbot)
./duck telegram start
```

---

## 🚀 Super Agent Setup

**Full setup for maximum capability:**

```bash
# 1. Clone and build duck-cli
git clone https://github.com/Franzferdinan51/duck-cli.git
cd duck-cli && npm install && npm run build

# 2. Clone agent-mesh-api (optional - for multi-agent communication)
git clone https://github.com/Franzferdinan51/agent-mesh-api.git ~/agent-mesh-api
cd ~/agent-mesh-api && npm install

# 3. Start mesh server (optional)
./duck mesh start
./duck mesh register

# 4. Start Chat Agent (conversational layer)
./duck chat-agent start --port 18797

# 5. Start Telegram bot (connects Chat Agent to Telegram)
./duck telegram start
```

**Or run everything together:**
```bash
# Terminal 1: Mesh server
./duck mesh start

# Terminal 2: Chat Agent
./duck chat-agent start --port 18797

# Terminal 3: Telegram bot
./duck telegram start
```

**Environment variables for Chat Agent:**
```bash
export MINIMAX_API_KEY=your_key          # Required for AI responses
export DUCK_CHAT_PROVIDER=minimax        # minimax | lmstudio | kimi | openai | openrouter
export DUCK_CHAT_MODEL=MiniMax-M2.7     # Model per provider
export MESH_DIR=~/agent-mesh-api         # Where mesh server is installed
export MESH_API_KEY=openclaw-mesh-default-key
export DUCK_MEMORY_BACKEND=local         # local (no Letta)
```

---

## 🎯 What is duck-cli?

**A desktop AI agent.** You give it a task, it decides how to accomplish it.

Unlike a chatbot, duck-cli is built for **autonomous execution** — it has memory, can spawn subagents, write and execute code, manage files, run scheduled tasks, control Android devices, delegate to AI Councils, and learn from feedback. It's designed to handle multi-step tasks while you do something else.

**The core loop:**

```
You: "build a REST API for my project"
  │
  ▼
Chat Agent (MiniMax) — conversational, friendly, maintains chat history
  │
  ▼
AI Council Deliberation (complex/ethical/high-stakes tasks only)
  │
  ▼
Bridge Agent (qwen3.5-0.8b local) — connection health, routing, protocol
  │
  ▼
Orchestrator (MetaAgent v3) — Plan → Critic → Healer → Learner
  │
  ▼
Tool Execution + Model Routing (MiniMax, LM Studio Gemma 4, Kimi)
```

---

## 💬 Provider Routing

Smart routing picks the right model automatically:

```bash
./duck -p minimax run "task"   # Force MiniMax (fastest)
./duck -p lmstudio run "task"  # Force local Gemma 4 (free)
./duck -p kimi run "task"      # Force Kimi k2.5 (vision)
```

| Provider | Models Available | Cost | Best For |
|----------|-----------------|------|----------|
| **MiniMax** | MiniMax-M2.7, glm-5, glm-4.7, qwen3.5-plus | API credits | Fast general, coding, reasoning |
| **LM Studio** | Gemma 4 26B, Gemma 4 e4b, qwen3.5-0.8b, qwen3.5-9b, qwen3.5-27b | Free (local) | Android, local free, fast tasks |
| **Kimi** | k2p5, k2 | Pay-per-use | Vision, top-tier coding |
| **OpenClaw Gateway** | Kimi k2.5 | Free via gateway | Vision + coding (no API key needed) |

---

## 🤖 Meta-Agent (v3)

The v3 orchestrator is **LLM-powered** — the orchestrator itself reasons about how to approach tasks.

> 📖 **Full system prompt:** See [`docs/META-AGENT-SYSTEM-PROMPT.md`](docs/META-AGENT-SYSTEM-PROMPT.md) for instructions on how to contact other agents (Chat Agent, Bridge, Subconscious, AI Council) and providers (MiniMax, LM Studio, Kimi, OpenAI, OpenRouter).

```bash
./duck meta plan "build a REST API"   # Preview plan (Planner LLM)
./duck meta run "build a REST API"     # Full execution with Planner→Critic→Healer→Learner
./duck meta learnings                   # Show lessons from past sessions
```

**How it works:**
```
Task → MetaPlanner (LLM) → Structured Plan
                          ↓
              MetaCritic (LLM) evaluates each step
                          ↓
              MetaHealer (LLM) diagnoses failures + recovery
                          ↓
              MetaLearner logs to ./experiences/
```

**10 v3 enhancements:**
1. **Adaptive complexity** — LLM scores dynamically (not static rules)
2. **Tool-chain sequences** — Planner generates custom tool chains per task
3. **Visual planning trace** — See the full plan before any execution
4. **Self-healing** — Healer LLM diagnoses failures and suggests fixes
5. **Proactive anticipation** — Planner predicts what comes next
6. **Multi-turn memory** — Experiences persist across sessions in `experiences/`
7. **Auto subagent spawning** — Planner identifies what can run in parallel
8. **Cost optimization** — Planner estimates cost/time for each step
9. **Sandboxed preview** — `duck meta plan` shows the plan without executing
10. **Cross-session learning** — MetaLearner accumulates lessons over time

**Model Selection:**
```bash
./duck meta plan "task"                          # MiniMax M2.7 (default)
./duck meta run "task" --planner qwen3.5-0.8b --provider lmstudio   # Free local!
./duck meta run "task" --planner MiniMax-M2.7 --provider minimax     # API
./duck meta run "task" --provider lmstudio                       # All components via LM Studio
```


---

## 🗣️ Chat Agent (v3) — Conversational Layer

The Chat Agent is the **conversational entry point** for duck-cli. It sits between user input and the orchestrator, handling chat history and deciding when to involve AI Council or the MetaAgent.

**Multi-provider support** — use any model you want:

```bash
# MiniMax (default)
DUCK_CHAT_PROVIDER=minimax DUCK_CHAT_MODEL=MiniMax-M2.7 ./duck chat-agent start

# LM Studio (free local!)
DUCK_CHAT_PROVIDER=lmstudio DUCK_CHAT_MODEL=qwen3.5-0.8b ./duck chat-agent start

# Kimi (Moonshot)
DUCK_CHAT_PROVIDER=kimi DUCK_CHAT_MODEL=k2p5 ./duck chat-agent start

# OpenAI (ChatGPT OAuth)
DUCK_CHAT_PROVIDER=openai DUCK_CHAT_MODEL=gpt-5.4 ./duck chat-agent start

# OpenRouter (free tier!)
DUCK_CHAT_PROVIDER=openrouter DUCK_CHAT_MODEL=qwen/qwen3.6-plus-preview:free ./duck chat-agent start
```

**Runtime switching** (via HTTP headers or body):
```bash
curl -X POST localhost:18797/chat \
  -H "X-Provider: lmstudio" \
  -H "X-Model: qwen3.5-0.8b" \
  -d '{"userId":"duck","message":"hello"}'
```

**HTTP Endpoints:**
```
POST /chat              — Send message, get response
POST /chat/stream       — Streaming response
GET  /providers         — List available providers + status
POST /providers/switch  — Switch provider at runtime
GET  /chat/:userId/history — Session history
DELETE /chat/:userId    — Clear session
GET  /sessions          — List all sessions
GET  /health            — Health check
```

**Chat flow:**
```
User message → Chat Agent
                   │
              AI Council? ───yes──→ Deliberate (complex/ethical/high-stakes)
                   │no                        │
                   ▼                          ▼
            Simple chat ←──APPROVE── AI Council
            (MiniMax)                           │
                   │                      REJECT/MODIFY
                   ▼                           ▼
             User response          Return council verdict
```

**Council triggers:**
- Complexity score >= 7
- Ethical keywords: "should i", "privacy", "hack", "illegal"
- High-stakes keywords: "money", "security", "delete everything"
- Explicit council request: "council", "debate", "discuss"

**Example:**
```bash
curl -X POST localhost:18797/chat \
  -H "Content-Type: application/json" \
  -d '{"userId":"duck","message":"should I invest in bitcoin?"}'
```

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                            duck run "task"                                │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     CHAT AGENT (MiniMax M2.7)                            │
│                 Conversational, friendly, session memory                  │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                    ┌────────────┴────────────┐
                    │                         │
           Simple chat                  Complex/High-stakes
                    │                         │
                    ▼                         ▼
         ┌──────────────────┐    ┌───────────────────────────────────┐
         │  Direct MiniMax  │    │       AI COUNCIL DELIBERATION     │
         │    Response      │    │  (Ethical/High-stakes/Complex)     │
         └──────────────────┘    │     Speaker + Technocrat +         │
                                │     Ethicist + Sentinel +            │
                                │     Pragmatist                      │
                                └──────────────┬────────────────────┘
                                               │ APPROVE / REJECT / MODIFY
                                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     🌉 BRIDGE AGENT (qwen3.5-0.8b)                    │
│            Connection health, routing, protocol negotiation              │
│              Intercepts ALL tasks after AI Council approval             │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                    ┌────────────┴────────────┐
                    │                         │
           Simple task                  Complex task
                    │                         │
                    ▼                         ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                   META-AGENT ORCHESTRATOR v3                          │
│              (LLM-powered: Planner → Critic → Healer → Learner)            │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │              TASK COMPLEXITY CLASSIFIER (1-10)                    │  │
│  │                                                                   │  │
│  │  Dimensions scored:                                               │  │
│  │  • Ambiguity (how vague is the task?)                            │  │
│  │  • Scope (how many steps/domains?)                              │  │
│  │  • Reversibility (can we undo mistakes?)                        │  │
│  │  • Ethical dimension (does it raise ethical flags?)             │  │
│  │  • Stakes (what's the worst case?)                             │  │
│  └──────────────────────────────┬───────────────────────────────────┘  │
│                                  │                                        │
│               ┌──────────────────┼──────────────────┐                   │
│               ▼                  ▼                  ▼                    │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────┐   │
│  │  SIMPLE (1-3)   │  │ MODERATE (4-6)  │  │  COMPLEX (7-10)    │   │
│  │  Fast path       │  │ Best model      │  │  AI Council first  │   │
│  │  No deliberation │  │ Optional council │  │  Then execute       │   │
│  └────────┬────────┘  └────────┬────────┘  └──────────┬──────────┘   │
│           │                    │                      │                │
│           └────────────────────┼──────────────────────┘                │
│                                ▼                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                      MODEL ROUTER                                  │  │
│  │                                                                   │  │
│  │  Task type → Best model:                                        │  │
│  │  • Android task → Gemma 4 e4b (tool-calling specialist)        │  │
│  │  • Vision task → Kimi k2.5 (top-tier vision)                   │  │
│  │  • Coding task → MiniMax M2.7 (fast, good at code)            │  │
│  │  • Reasoning → qwen3.5-plus (MiniMax)                         │  │
│  │  • Local free → qwen3.5-0.8b (LM Studio)                      │  │
│  └──────────────────────────────┬───────────────────────────────────┘  │
│                                  │                                        │
│  ┌──────────────────────────────▼───────────────────────────────────┐  │
│  │                    TOOL EXECUTION                                  │  │
│  │                                                                   │  │
│  │  Registry of 102 tools. Each tool has:                        │  │
│  │  • name, description, category                                  │  │
│  │  • capability flags (shell, file, network, etc.)              │  │
│  │  • safety level (normal ⚠️ warning, or safe)                 │  │
│  │  • retry count + fallback behavior                              │  │
│  │                                                                   │  │
│  │  Execution chain:                                                │  │
│  │  Tool → Execute → Success? → done                             │  │
│  │              ↓ fail                                              │  │
│  │         Fallback Manager → retry with same tool                 │  │
│  │              ↓ still fail                                        │  │
│  │         Fallback Manager → try alternative tool                 │  │
│  │              ↓ exhausted                                         │  │
│  │         Report failure + suggest alternatives                     │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                   PROVIDER MANAGER                                  │  │
│  │                                                                   │  │
│  │  Manages all provider connections:                               │  │
│  │  • MiniMax (API key from env)                                  │  │
│  │  • LM Studio (local server at 127.0.0.1:1234)                 │  │
│  │  • Kimi/Moonshot (API key)                                      │  │
│  │  • OpenRouter (API key)                                         │  │
│  │  • OpenClaw Gateway (WebSocket bridge)                          │  │
│  │                                                                   │  │
│  │  Each provider has:                                               │  │
│  │  • complete() — send messages, get response                     │  │
│  │  • capabilities — { supportsImages, supportsStreaming }         │  │
│  │  • rate limits + key rotation                                   │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────────┘
```

│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │              AGENT MESH (port 4000) - Optional                     │  │
│  │                                                                   │  │
│  │  Inter-agent communication bus:                                  │  │
│  │  ./duck mesh start      — Start mesh server                      │  │
│  │  ./duck mesh status     — Check mesh health                      │  │
│  │  ./duck mesh register   — Register with mesh                     │  │
│  │  ./duck mesh stop       — Stop mesh server                       │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                          │
**3 Meta Agents:**
| Agent | Model | Purpose |
|-------|-------|---------|
| **Bridge Agent** | qwen3.5-0.8b (LM Studio) | Connection health, routing decisions, protocol negotiation |
| **Orchestrator** | qwen3.5-0.8b or MiniMax-M2.7 | Plan→Critic→Healer→Learner loop |
| **Subconscious** | Pattern matching (no model) | Whisper monitoring, alerts, autonomous responses |

---

## 🧠 AI Council Integration

Complex tasks (score ≥ 7) trigger **AI Council deliberation** — multiple AI councilors debate the task and return a verdict before execution proceeds.

**How deliberation works:**

```
Orchestrator scores task → 8/10 (complex)
  │
  ▼
AI Council Bridge fires
  │
  ▼
Councilors deliberate (each sees the full context):
  • Speaker — moderates, summarizes, keeps debate on track
  • Technocrat — technical feasibility, risks, alternatives
  • Ethicist — moral/ethical implications, red lines
  • Pragmatist — practical tradeoffs, resource cost, timeline
  • Skeptic — challenges assumptions, worst-case scenarios
  • Sentinel — safety gates, security concerns
  │
  ▼
Each councilor returns: verdict + reasoning
  │
  ▼
Bridge aggregates → "APPROVE" / "REJECT" / "CONDITIONAL" / "MODIFY"
  │
  ▼
Orchestrator proceeds (or modifies task based on conditions)
```

**Direct council invocation:**
```bash
./duck council "should I upgrade all dependencies at once?"
```

---

## 🫀 KAIROS — Proactive Heartbeat

KAIROS is the proactive AI layer that runs continuous monitoring tasks even when you're not interacting.

```
Every N minutes (configurable):
  │
  ▼
KAIROS Heartbeat fires
  │
  ▼
Checks configured monitors:
  • System health (RAM, disk, services)
  • Crypto prices (if configured)
  • Grow monitoring (if phone connected)
  • News / OSINT feeds
  • Weather alerts
  • GitHub activity
  │
  ▼
Anomaly detected?
  │ no → log and sleep
  │ yes → alert + optional autonomous response
```

**KAIROS modes:**
```bash
./duck kairos status         # Check if running
./duck kairos enable         # Start heartbeat
./duck kairos disable        # Pause
./duck kairos aggressive    # Faster polling, more proactive
./duck kairos conservative   # Slower, less intrusive
```

---

## 🌊 Subconscious — Whisper Monitoring

The subconscious is a **background whisper layer** that monitors every model response and fires alerts based on pattern recognition.

```
Response comes in from model
  │
  ▼
Subconscious analyzes (no model call — pure pattern matching):
  │
  ├── Confidence < 0.5 → Log uncertainty whisper
  ├── Confidence ≥ 0.7 → Trigger AI Council deliberation
  ├── Pattern match (user corrected before) → Apply learned fix
  ├── Anomaly detected → Alert via Telegram
  └── Learned correction available → Apply silently
  │
  ▼
Whisper types:
  • correction — user previously fixed this
  • caution — confidence low, verify before acting
  • escalate — AI Council needed
  • learned — pattern match from feedback
  • security — potential security concern
  • resource — system resource warning
```

**The loop:**
```
User corrects duck-cli → Subconscious logs correction
Later task matches pattern → Whisper fires → Fix applied silently
Learning compounds over time → duck-cli gets smarter
```

```bash
./duck subconscious status   # Check whisper stats
./duck learn_from_feedback    # Force learning check
```

---

## 🛡️ Safety — Secret Scanner + Guardrails

Every tool execution is scanned for secrets and protected by guardrails:

**Secret Scanner:**
```
Tool output → Secret scanner
  │
  ├── API keys detected → Redact + alert
  ├── Passwords / tokens → Redact + alert
  ├── Private keys → Redact + alert
  └── Clean → Pass through
```

**Guard System:**
```
Before execution:
  • Shell commands → Guard checks for destructive patterns (rm -rf, etc.)
  • File writes → Guard checks for overwrite risks
  • External calls → Guard checks for data exfiltration
  • Internet calls → Guard checks for suspicious destinations

After execution:
  • Output scanned for secrets
  • Anomalies flagged
  • All events logged
```

---

## 🔧 102 Built-in Tools

| Category | Tools |
|----------|-------|
| **Desktop** | `screenshot`, `click`, `type`, `open`, `screen_read` |
| **Shell** | `shell` ⚠️, `exec` |
| **Files** | `read`, `write` ⚠️, `glob` |
| **Web** | `search`, `fetch` |
| **Memory** | `remember`, `recall`, `search`, `stats` |
| **Sessions** | `session_list`, `session_search`, `session_log` |
| **Planning** | `plan_create`, `plan_status`, `plan_list`, `plan_abort` |
| **Scheduling** | `cron_create`, `cron_list`, `cron_delete`, `cron_enable`, `cron_stats` |
| **Subagents** | `spawn`, `spawn_team`, `list`, `status`, `cancel`, `wait` |
| **Android** | `devices`, `screenshot`, `tap`, `type`, `dump`, `find_and_tap`, `swipe`, `press`, `app`, `screen`, `agent` ⚠️, `notifications` |
| **AI Systems** | `council`, `kairos`, `subconscious`, `think_parallel` |
| **Duck tools** | `duck_status`, `duck_skills`, `duck_security`, `duck_doctor`, `duck_agent` |
| **Providers** | `provider_list`, `provider_set` |
| **Learning** | `learn_from_feedback`, `context_memory`, `learning_stats` |
| **Safety** | `guard_check`, `guard_log`, `guard_stats` |
| **Tracing** | `trace_enable`, `trace_view`, `trace_list` |
| **Workflows** | `workflow_run`, `flow_run` ⚠️, `flow_run_ts`, `flow_list`, `flow_replay` |

⚠️ = flagged as powerful/unsafe — requires confirmation or runs with extra guardrails

---

## 🤖 Subagents — Parallel Task Execution

Spawn parallel subagents for complex multi-step tasks:

```bash
# Spawn a research subagent
./duck agent spawn "research quantum computing and summarize"

# Spawn a team
./duck agent spawn_team "build a web scraper"
# Team: planner agent + coder agent + tester agent

# Check status
./duck agent list

# Cancel
./duck agent cancel <agent-id>

# Wait for result
./duck agent wait <agent-id>
```

**Orchestrator delegates to subagents:**
- Long tasks → subagent spawned
- Parallel research → multiple subagents
- Complex coding → subagent with full tool access

---

## 💾 Sessions & Memory

Every interaction is logged and stored in SQLite:

```bash
# List recent sessions
./duck session list

# Search past sessions
./duck session search "python api"

# Get full log
./duck session_log <session-id>

# Remember a fact
./duck memory remember "project=duck-cli-v2, language=TypeScript"

# Recall a fact
./duck memory recall "project"

# Memory stats
./duck memory_stats
```

**Memory is persistent** — duck-cli remembers your preferences, past tasks, and corrections across sessions.

---

## ⏰ Scheduling — Cron Jobs

Schedule tasks to run automatically:

```bash
# Create a cron job
./duck cron create "*/5 * * * *" "run health check"
./duck cron create "0 9 * * *" "send morning summary"
./duck cron create "0 */6 * * *" "pull crypto prices"

# List all cron jobs
./duck cron list

# Enable/disable
./duck cron enable <job-id>
./duck cron disable <job-id>

# Delete
./duck cron delete <job-id>

# Stats
./duck cron_stats
```

---

## 🌐 Bridges — MCP, ACP, WebSocket, OpenClaw Gateway

**MCP (Model Context Protocol):**
```bash
./duck mcp connect -- python3 /path/to/mcp-server.py
```
Connect MCP tools — extends the tool registry dynamically.

**ACP (Agent Communication Protocol) — OpenClaw Gateway:**
```bash
./duck gateway  # Start OpenClaw gateway bridge
openclaw acp spawn --agent duck-cli --task "research topic"
```
Bridge lets OpenClaw agents spawn duck-cli subagents and vice versa.

**WebSocket — Real-time streaming:**
```bash
./duck web  # Start web UI with streaming
```

---

## 📱 Android Agent (Optional)

When connected via ADB, duck-cli can autonomously control your Android phone:

```bash
# Connect
adb connect 192.168.1.251:5555
./duck android devices

# Direct commands
./duck android screenshot
./duck android tap "Settings"
./duck android dump  # Accessibility tree

# AI agent — perceive→reason→act loop
./duck android agent "open WhatsApp"
./duck android agent "open settings and turn on WiFi"
./duck android agent "go home"
```

**How the Android agent works:**

```
Goal: "open WhatsApp"
  │
  ▼
Perceive — dump UI accessibility tree via ADB
  │
  ▼
Reason — send screen state + goal to Gemma 4 e4b
  │
  ▼
Act — Gemma 4 decides: tap WhatsApp icon
  │
  ▼
Execute — ADB tap at coordinates
  │
  ▼
Loop — Perceive again, check if goal met
  │
  ▼
Max 30 steps or goal achieved
```

Gemma 4 e4b is preferred for Android because it's **trained on Android Studio Agent Mode** — it has native tool-calling and vision for Android UI interpretation.

---

## 📂 Project Structure

```
duck-cli/
├── src/
│   ├── orchestrator/              # Hybrid Orchestrator v2
│   │   ├── task-complexity.ts       # 1-10 scoring across 5 dimensions
│   │   ├── model-router.ts         # Task type → best model
│   │   ├── council-bridge.ts      # AI Council deliberation
│   │   ├── hybrid-core.ts          # Main orchestration loop
│   │   └── fallback-manager.ts     # Retry + alternative chains
│   ├── providers/                  # LLM provider system
│   │   ├── manager.ts              # ProviderManager — load + route
│   │   ├── minimax.ts              # MiniMax provider
│   │   ├── lmstudio.ts            # LM Studio (local Gemma 4)
│   │   ├── kimi.ts                # Kimi/Moonshot provider
│   │   ├── openrouter.ts          # OpenRouter provider
│   │   └── openclaw-gateway.ts   # OpenClaw Gateway bridge
│   ├── agent/                     # Agent implementations
│   │   ├── core.ts                # Core Agent with tools + memory
│   │   ├── android-tools.ts       # Android ADB tools
│   │   └── session-store.ts       # SQLite session storage
│   ├── subconscious/              # Subconscious whisper system
│   │   ├── subconscious.ts        # Main whisper engine
│   │   ├── council-bridge.ts      # Triggers AI Council on high-confidence whispers
│   │   └── types.ts              # Whisper types + confidence
│   ├── kairos/                  # KAIROS proactive heartbeat
│   │   └── heartbeat.ts          # Continuous monitoring + alerts
│   ├── skills/                  # duck-cli skills
│   ├── tools/                    # Tool implementations
│   ├── commands/                 # CLI command handlers
│   │   ├── telegram-bot.ts        # Standalone Telegram bot
│   │   ├── council.ts             # AI Council commands
│   │   ├── cron.ts               # Cron scheduler
│   │   └── subconscious.ts       # Subconscious commands
│   ├── mesh/                    # Agent mesh networking
│   │   ├── agent-mesh.ts        # Mesh protocol
│   │   └── agent-card.ts        # Agent discovery
│   ├── rl/                      # Reinforcement learning
│   │   └── openclaw-rl.ts       # Learning from feedback
│   └── ui/                      # Web/desktop UI
│       └── desktop/              # React/Vite desktop-style UI
├── cmd/duck/                    # Go CLI layer
│   └── main.go                  # Go binary — wraps Node.js
├── tools/                      # Standalone tools
│   ├── telegram-bot.py          # Standalone Telegram bot (Python)
│   └── install-*.sh             # Install scripts per platform
├── skills/                     # duck-cli skills marketplace
└── docs/                      # Architecture docs
```

---

## 🚀 Installation

### Mac/Linux
```bash
git clone https://github.com/Franzferdinan51/duck-cli.git
cd duck-cli
npm install && npm run build
./duck status
```

### Telegram Bot (standalone)
```bash
# Token configured in .env — just start it:
./duck telegram start

# Message @AgentSmithsbot on Telegram
```

### Android (optional)
```bash
# Enable USB debugging on your phone
adb devices
./duck android agent "open settings"
```

---

## 🔗 Related Projects

| Repo | Purpose |
|------|---------|
| **[duck-cli](https://github.com/Franzferdinan51/duck-cli)** | **Main repo** — desktop AI agent |
| **[droidclaw](https://github.com/Franzferdinan51/droidclaw)** | Fork of [unitedbyai/droidclaw](https://github.com/unitedbyai/droidclaw) — Bun-based Android agent upstream |
| **[Open-WebUi-Lobster-Edition](https://github.com/Franzferdinan51/Open-WebUi-Lobster-Edition)** | OpenWebUI fork with OpenClaw + generative UI |
| **[AI-Bot-Council-Concensus](https://github.com/Franzferdinan51/AI-Bot-Council-Concensus)** | Multi-agent deliberation chamber |
| **[RS-Agent-Skill-Lobster-Edition](https://github.com/Franzferdinan51/RS-Agent-Skill-Lobster-Edition)** | RuneScape API toolkit + Discord bot |

---

## 🦆 Powered By

- **[OpenClaw](https://github.com/openclaw/openclaw)** — ACP/MCP protocols, Skills system, agent mesh
- **[Hermes-Agent](https://github.com/NousResearch/hermes-agent)** — Learning loops, proactive AI
- **[NeMoClaw](https://github.com/NVIDIA/NeMoClaw)** — Security sandboxing
- **[Gemma 4](https://ai.google.dev/)** — Android-trained local model
- **[MiniMax](https://www.minimax.io/)** — Fast reasoning API
- **[LM Studio](https://lmstudio.ai/)** — Local LLM inference
- **[Kimi/Moonshot](https://platform.moonshot.cn/)** — Vision + coding
- **[Pretext](https://github.com/chenglou/pretext)** — Canvas text measurement for generative UI

---

**duck-cli — Desktop AI agent. Autonomous. Multi-model. Self-improving.**
