# 🦆 duck-cli

> **Desktop AI Agent** — Give a task, get a result. Smart routing across MiniMax, Gemma 4, Kimi, and OpenRouter — with 100+ tools for automation.

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

# 5. Telegram bot
./duck telegram start
# Then message @AgentSmithsbot on Telegram
```

---

## 🎯 What is duck-cli?

**A desktop AI agent.** Give it a task, it uses the best available model and tools to get it done.

**Smart routing** — picks the right model automatically:
```
MiniMax M2.7 (fast) → Gemma 4 26B (local) → Kimi → OpenRouter
```

**100+ tools** — shell, files, web search, memory, scheduling, subagents, Android control.

**Multi-provider** — uses MiniMax, LM Studio (local Gemma 4), Kimi, OpenRouter, OpenClaw Gateway.

**Desktop-first** — runs on Mac/Linux/Windows with full system access. Android support is optional.

---

## 💬 Provider Routing

| Priority | Provider | Model | Speed |
|----------|----------|-------|-------|
| 1st | **MiniMax** | M2.7 | Fastest (~2s) |
| 2nd | **LM Studio** | Gemma 4 26B (local) | Free, local |
| 3rd | **OpenRouter** | Various free | Free tier |
| 4th | **OpenClaw Gateway** | Kimi k2.5 | Via gateway |
| 5th | **Kimi direct** | K2.5 | API |

Override with `-p` flag:
```bash
./duck -p minimax run "task"   # Force MiniMax
./duck -p lmstudio run "task"  # Force local Gemma 4
```

---

## 🔧 Tool System

102 built-in tools across categories:

| Category | Tools |
|----------|-------|
| **Desktop** | screenshot, click, type, open, screen_read |
| **Shell** | shell, exec |
| **Files** | read, write, glob |
| **Web** | search, fetch |
| **Memory** | remember, recall, search |
| **Planning** | plan_create, plan_status, plan_list |
| **Scheduling** | cron_create, cron_list, cron_delete |
| **Agents** | spawn, spawn_team, list, cancel, wait |
| **Android** | devices, screenshot, tap, type, dump, agent |
| **AI systems** | council, kairos, subconscious |
| **Duck tools** | duck_status, duck_skills, duck_security |
| **Providers** | provider_list, provider_set |
| **Learning** | learn_from_feedback, context_memory |

---

## 🖥️ Desktop Agent Commands

```bash
# Run a task
./duck run "convert this image to PNG"

# Interactive TUI shell
./duck shell

# Status and diagnostics
./duck status
./duck doctor

# Provider info
./duck -p minimax provider_list

# Web UI
./duck web
```

---

## 📱 Android Support (Optional)

When you have an Android device connected via ADB, duck-cli can control it:

```bash
# Connect device (USB or WiFi)
adb devices
adb connect 192.168.1.251:5555

# Quick commands
./duck android screenshot
./duck android tap "Settings"
./duck android dump

# AI-powered agent (perceive → reason → act)
./duck android agent "open WhatsApp"
./duck android agent "go home"
./duck android agent "open settings and turn on WiFi"
```

The Android agent uses **Gemma 4** (via LM Studio on Mac) for reasoning — it reads the screen, decides what to do, and executes taps/types.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     duck run "task"                      │
└─────────────────────────┬───────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│              Hybrid Orchestrator v2                       │
│  ├── Task Complexity Classifier (1-10)                    │
│  ├── Model Router → MiniMax / Gemma 4 / Kimi           │
│  ├── AI Council Bridge (complex tasks)                   │
│  ├── Tool Registry → 102 tools                           │
│  └── Fallback Manager                                    │
└─────────────────────────┬───────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                    Result                               │
└─────────────────────────────────────────────────────────┘
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

---

**duck-cli — Your desktop AI agent. Android is optional.**
