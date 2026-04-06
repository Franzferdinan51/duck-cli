# 🦆 duck-cli

> **Desktop AI Agent** — Give a task, get a result. Powered by a hybrid orchestrator that routes to MiniMax, Gemma 4, Kimi, and OpenRouter — with 100+ built-in tools, AI Council deliberation, autonomous subagents, memory, scheduling, and optional Android control.

[![GitHub](https://img.shields.io/github/stars/Franzferdinan51/duck-cli?style=social)](https://github.com/Franzferdinan51/duck-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)
[![Go](https://img.shields.io/badge/Go-1.21+-blue.svg)](https://go.dev/)

---

## ⚡ Quick Start

```bash
# 1. Install
git clone https://github.com/Franzferdinan51/duck-cli.git
cd duck-cli
npm install && npm run build

# 2. Run a task
./duck run "what is the capital of Japan?"

# 3. Interactive shell
./duck shell

# 4. Check status
./duck status

# 5. Telegram bot (standalone, connects to @AgentSmithsbot)
./duck telegram start
# Then message @AgentSmithsbot on Telegram
```

---

## 🎯 What is duck-cli?

**A desktop AI agent on Mac/PC/Linux.** Give it a task, it orchestrates models, tools, memory, and subagents to get it done.

**The core idea:** Smart routing — each task goes through a Hybrid Orchestrator that scores complexity, picks the right model, optionally triggers AI Council deliberation, executes with fallback chains, and learns from feedback.

**Desktop-first.** Android support is optional — connect via ADB when you want phone control.

---

## 💬 Smart Provider Routing

Automatically picks the best model. You can also override:

```bash
./duck -p minimax run "task"   # Force MiniMax (fastest)
./duck -p lmstudio run "task"  # Force local Gemma 4 (free)
```

| Priority | Provider | Model | Speed | Best For |
|----------|----------|-------|-------|----------|
| 1st | **MiniMax** | M2.7 | ~2s | Fast general tasks |
| 2nd | **LM Studio** | Gemma 4 26B (local) | Free, local | High quality, free |
| 3rd | **OpenRouter** | Various free | Free tier | Budget |
| 4th | **OpenClaw Gateway** | Kimi k2.5 | Via gateway | Vision + coding |
| 5th | **Kimi direct** | K2.5 | API | Vision |

---

## 🧠 Hybrid Orchestrator v2

The brain. Routes every task through:

```
Task → Complexity Score (1-10)
   │
   ├─ Simple (1-6) → Fast path → Model Router → Execute
   │
   ├─ Complex (7+) → AI Council deliberation → Verdict → Execute
   │
   └─ Android task → Gemma 4 (tool-calling specialist) → Perceive→Reason→Act loop
```

**Components:**
- **Task Complexity Classifier** — scores every task 1-10
- **Model Router** — picks best model for the job
- **AI Council Bridge** — triggers multi-councilor deliberation for complex tasks
- **Tool Registry** — 102 tools with capability-based selection
- **Fallback Manager** — retries with alternative providers on failure

---

## 🏛️ AI Council

Complex tasks (score ≥ 7) trigger deliberation by multiple AI councilors:

- **Speaker** — moderates debate
- **Technocrat** — technical feasibility
- **Ethicist** — right/wrong analysis
- **Pragmatist** — practical tradeoffs
- **Skeptic** — challenges assumptions
- **Sentinel** — safety and risk

Example deliberation triggers:
```
"should I upgrade this dependency?"        → 8/10 → Council debates
"write a security audit for this code"   → 9/10 → Council debates
"what is 2+2?"                          → 1/10 → Fast path
"open settings"                          → 3/10 → Fast path
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
| **Duck tools** | `duck_status`, `duck_skills`, `duck_security`, `duck_doctor` |
| **Providers** | `provider_list`, `provider_set` |
| **Learning** | `learn_from_feedback`, `context_memory` |
| **Safety** | `guard_check`, `guard_log`, `guard_stats` |
| **Tracing** | `trace_enable`, `trace_view`, `trace_list` |
| **Workflows** | `workflow_run`, `flow_run` ⚠️, `flow_run_ts`, `flow_list`, `flow_replay` |

⚠️ = safety-reviewed tool

---

## 🖥️ Commands Reference

```bash
# Core
./duck run "task"                    # Run a task
./duck shell                         # Interactive TUI shell
./duck status                        # Agent status + diagnostics
./duck doctor                        # Full health check

# Provider control
./duck -p minimax run "task"        # Force provider
./duck -m gemma-4-e4b-it run "task" # Force model

# AI systems
./duck council "should I refactor?" # Direct AI Council deliberation
./duck kairos status                # KAIROS proactive AI heartbeat
./duck subconscious status           # Subconscious whisper system

# Scheduling
./duck cron create "*/5 * * * *" "say hi"  # Cron job
./duck cron list                              # List cron jobs

# Subagents
./duck agent spawn "research topic"           # Spawn subagent
./duck agent list                            # List running agents
./duck agent cancel <id>                      # Cancel agent

# Web UI
./duck web                                    # Start web UI (port 3001)
./duck gateway                                # Start OpenClaw gateway

# Telegram bot (standalone)
./duck telegram start                         # Start @AgentSmithsbot bot

# Android (optional — requires ADB)
./duck android devices                         # List connected devices
./duck android screenshot                     # Screenshot
./duck android dump                          # UI accessibility tree
./duck android tap "Settings"               # Tap element
./duck android agent "open WhatsApp"         # AI agent — perceive→reason→act
```

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                     duck run "task"                           │
└──────────────────────────────┬───────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────┐
│              Hybrid Orchestrator v2                           │
│                                                               │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Task Complexity Classifier (1-10)                   │    │
│  │  Model Router ──► MiniMax / Gemma 4 / Kimi / etc.  │    │
│  │  AI Council Bridge (triggers on score ≥ 7)         │    │
│  │  Tool Registry (102 tools)                          │    │
│  │  Fallback Manager (retry on failure)                 │    │
│  └────────────────────────────────────────────────────┘    │
└──────────────────────────────┬───────────────────────────────┘
                               │
          ┌────────────────────┼────────────────────┐
          ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│   MiniMax M2.7  │  │  Gemma 4 26B   │  │  Kimi k2.5      │
│   (API)         │  │  (LM Studio)   │  │  (API)          │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

---

## 🧠 Subconscious System

A whisper layer that monitors every response and fires alerts:

```
User message → Subconscious whisper engine
      │
      ├─ Low confidence (< 0.5) → Log observation
      │
      ├─ High confidence (≥ 0.7) → AI Council deliberation
      │
      └─ Threshold breach → Immediate alert + autonomous response
```

Whispers trigger on: anomalous patterns, resource issues, security concerns, learned corrections.

---

## 📊 Sessions & Memory

Every interaction is logged and searchable:

```bash
./duck session list              # Recent sessions
./duck session search "python"   # Search past sessions
./duck memory remember "key=val"  # Store fact
./duck memory recall "key"        # Retrieve fact
./duck learn_from_feedback        # Learn from corrections
```

**SQLite-backed** session storage with semantic search.

---

## 📱 Android Agent (Optional)

When connected via ADB, duck-cli can autonomously control your phone:

```bash
# Connect
adb connect 192.168.1.251:5555

# AI agent — perceive→reason→act loop
./duck android agent "open WhatsApp"
./duck android agent "open settings and turn on WiFi"
./duck android agent "go home"

# Direct commands
./duck android screenshot
./duck android tap "Settings"
./duck android dump  # Accessibility tree
```

**How it works:** Dumps UI accessibility tree → sends to Gemma 4 (tool-calling specialist) → executes tap/type/swipe → repeats until goal reached.

---

## 🌐 Protocols & Bridges

**MCP (Model Context Protocol)** — connect MCP tools:
```bash
./duck mcp connect <server-command>
```

**ACP (Agent Communication Protocol)** — OpenClaw gateway bridge:
```bash
./duck gateway           # Start gateway
openclaw acp spawn --agent duck-cli --task "task"
```

**WebSocket** — real-time streaming:
```bash
./duck web              # Web UI + streaming
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
# Token already configured in .env
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

- [OpenClaw](https://github.com/openclaw/openclaw) — ACP/MCP protocols, Skills
- [MiniMax](https://www.minimax.io/) — Fast reasoning API
- [LM Studio](https://lmstudio.ai/) — Local LLM inference
- [Gemma 4](https://ai.google.dev/) — Android-trained local model
- [Kimi](https://platform.moonshot.cn/) — Vision + coding
- [Pretext](https://github.com/chenglou/pretext) — Canvas text measurement

---

**duck-cli — Desktop AI agent. Android is optional.**
