# 🦆 duck-cli v0.9.0

> **Production-Ready AI Agent** — Smart multi-provider routing, AI Council deliberation, proactive KAIROS heartbeat, agent-mesh networking, enhanced security with foundation-sec-8b-reasoning, and 60+ built-in commands. Runs standalone on Mac/PC/Linux/Android — or connect it to OpenClaw/ACP to let OTHER agents use its tools.

**OpenClaw compatible** — Can run standalone OR as an ACP/bridge endpoint that other agents invoke.

---

## 🚀 What's New in v0.9.0

### 🔐 Enhanced Security Agent
- **Model**: foundation-sec-8b-reasoning (specialized security AI)
- **Capabilities**: Vulnerability scanning, system audit, permission checks, log analysis
- **Detects**: Dangerous patterns, exposed secrets, permission issues, intrusion attempts
- **Commands**: `duck security scan/audit/check/logs/status`

### 🧠 Enhanced Meta Agents (9 Total)
All meta agents now have specialized tools and time context:

| Agent | Model | Role |
|-------|-------|------|
| **Orchestrator** | qwen3.5-2b-claude-4.6-opus-reasoning-distilled | Task routing |
| **Bridge** | gemma-4-e2b-it | External connections |
| **Subconscious** | qwen3.5-0.8b | Pattern monitoring |
| **Mesh Coordinator** | gemma-4-e2b-it | Mesh topology |
| **AI Council Liaison** | qwen3.5-2b-claude-4.6-opus-reasoning-distilled | Deliberation |
| **Monitor** | qwen3.5-0.8b | Health tracking |
| **Memory** | qwen3.5-0.8b | Persistence |
| **Security** | foundation-sec-8b-reasoning | Threat detection |
| **Scheduler** | qwen3.5-0.8b | Task planning |

### 💾 Session Management
- Cross-session context persistence
- Auto-save every 30 seconds
- Keep-alive to prevent unbinding
- Process exit handlers (SIGINT, SIGTERM)
- Session search and history

### 🌐 Enhanced Web UI
- Modern React + TypeScript + Tailwind CSS
- Dark/light mode
- Session sidebar
- Real-time status panel
- Meta agent monitoring
- Message metadata (model, tokens, cost)
- Mobile responsive

---

## 🧠 What duck-cli actually is

duck-cli is **not just a sidecar for OpenClaw**.

It is:
- a **standalone AI agent** people can talk to directly, especially through **Telegram**
- a **custom assistant/runtime** built on OpenClaw ideas and components
- a **bridge layer** with its own MCP, ACP, WebSocket, and meta-agent flows
- a tool/service that **other agents can call into** through the bridge
- a **security-focused agent** with specialized AI for threat detection

---

## 📋 Table of Contents

- [Quick Start](#quick-start)
- [Commands](#commands)
- [Meta Agents](#meta-agents)
- [Security](#security)
- [Session Management](#session-management)
- [Web UI](#web-ui)
- [Architecture](#architecture)
- [Installation](#installation)

---

## ⚡ Quick Start

```bash
# Install
git clone https://github.com/Franzferdinan51/duck-cli.git
cd duck-cli
npm install && npm run build

# Run a task (auto-routes to best model)
./duck run "what is the capital of Japan?"

# Interactive shell
./duck shell

# Start Web UI
./duck web

# Telegram bot (main public interface)
./duck telegram start

# Security audit
./duck security audit

# Check system health
./duck health

# Ask the AI Council
./duck council "should I upgrade all dependencies at once?"

# Start all protocols at once
./duck unified
```

---

## 🎮 Commands

### Core Commands

| Command | Description |
|---------|-------------|
| `duck run "task"` | Execute a task with smart routing |
| `duck shell` | Interactive TUI shell |
| `duck web [port]` | Start Web UI (default: 3001) |
| `duck status` | Show agent status |
| `duck health` | Full system health check |
| `duck doctor` | Diagnostics and repair |

### Security Commands

| Command | Description |
|---------|-------------|
| `duck security scan <target>` | Scan for vulnerabilities |
| `duck security audit` | Full system security audit |
| `duck security check <path>` | Check file permissions |
| `duck security logs` | Analyze logs for threats |
| `duck security status` | Security status summary |
| `duck security history` | View scan history |
| `duck defcon` | Quick DEFCON status |

### Meta Agent Commands

| Command | Description |
|---------|-------------|
| `duck meta status` | Show all meta agents |
| `duck meta list` | List agents with models |
| `duck meta models` | Show which models agents use |
| `duck meta start <id>` | Start a meta agent |
| `duck meta stop <id>` | Stop a meta agent |

### Session Commands

| Command | Description |
|---------|-------------|
| `duck session list` | List all sessions |
| `duck session switch <id>` | Switch to session |
| `duck session search <query>` | Search sessions |
| `duck session archive <id>` | Archive a session |
| `duck session delete <id>` | Delete a session |

### AI Council Commands

| Command | Description |
|---------|-------------|
| `duck council "topic"` | Ask the council |
| `duck council "topic" --mode research` | Research mode |
| `duck council "topic" --mode prediction` | Prediction mode |
| `duck subconscious status` | Subconscious status |
| `duck subconscious stats` | Subconscious stats |

### Android Commands

| Command | Description |
|---------|-------------|
| `duck android devices` | List devices |
| `duck android status` | Device status |
| `duck android shell <cmd>` | Run shell command |
| `duck android screenshot` | Capture screen |
| `duck android tap <x> <y>` | Tap coordinates |
| `duck android type <text>` | Type text |
| `duck android key <key>` | Press key |
| `duck android app launch <pkg>` | Launch app |
| `duck android termux <cmd>` | Termux command |

### Mesh Commands

| Command | Description |
|---------|-------------|
| `duck meshd` | Start mesh server |
| `duck mesh list` | List mesh agents |
| `duck mesh send <agent> <msg>` | Send message |
| `duck mesh broadcast <msg>` | Broadcast to all |

### Node Commands

| Command | Description |
|---------|-------------|
| `duck node create -n <name> -h <host>` | Create remote node |
| `duck node list` | List nodes |
| `duck node status <id>` | Check node status |
| `duck node exec <id> <cmd>` | Execute on node |
| `duck node remove <id>` | Remove node |

### Team Commands

| Command | Description |
|---------|-------------|
| `duck team templates` | List team templates |
| `duck team create <name>` | Create team |
| `duck team list` | List teams |
| `duck team swarm "task"` | Start coding swarm |
| `duck team spawn <type> <task>` | Spawn worker |

### KAIROS Commands

| Command | Description |
|---------|-------------|
| `duck kairos start` | Start heartbeat |
| `duck kairos status` | Show status |
| `duck kairos dream` | Run dream consolidation |
| `duck kairos dream --save` | Dream + save insights |
| `duck kairos skills --list` | List auto-created skills |

### Utility Commands

| Command | Description |
|---------|-------------|
| `duck tools list` | List all tools |
| `duck tools schema <name>` | Show tool schema |
| `duck tools search <query>` | Search tools |
| `duck memory remember "fact"` | Remember fact |
| `duck memory recall "query"` | Recall facts |
| `duck logger status` | Logger status |
| `duck logger tail` | Stream logs |
| `duck cron list` | List cron jobs |
| `duck update check` | Check for updates |
| `duck config list` | Show config |

---

## 🛡️ Security

The security agent uses **foundation-sec-8b-reasoning**, a specialized security AI model.

### What It Detects

- 🔴 **Dangerous Patterns**: rm -rf /, fork bombs, eval injection
- 🔴 **Exposed Secrets**: API keys, passwords, tokens in code
- 🟠 **Permission Issues**: World-writable files, overly permissive SSH keys
- 🟡 **Vulnerable Dependencies**: Outdated packages
- 🔴 **Intrusion Attempts**: SQL injection, XSS, brute force in logs

### Example Usage

```bash
# Scan code for vulnerabilities
./duck security scan "$(cat script.sh)" --type code

# Full system audit
./duck security audit

# Check specific file permissions
./duck security check ~/.ssh/id_rsa

# Analyze logs for attacks
./duck security logs --file /var/log/auth.log

# View security status
./duck security status

# DEFCON level management
./duck security defcon              # Show current status
./duck security defcon 3            # Elevate to DEFCON 3
./duck security defcon 5            # Return to normal
./duck security defcon --auto true  # Enable auto-escalation
```

### DEFCON System

5-level defense readiness with auto-escalation:

| Level | Color | Status | Description |
|-------|-------|--------|-------------|
| 1 | 🔴 | CRITICAL | Maximum alert - immediate action required |
| 2 | 🔴 | HIGH | Elevated security - active threat |
| 3 | 🟠 | ELEVATED | Increased readiness - potential threat |
| 4 | 🟡 | NORMAL | Standard security posture |
| 5 | 🟢 | LOW | All clear - normal operations |

Auto-escalation automatically adjusts DEFCON based on threat assessments from the security agent.

---

## 🧠 Meta Agents

9 internal meta agents coordinate the system:

### Orchestrator Agent
- **Model**: qwen3.5-2b-claude-4.6-opus-reasoning-distilled
- **Role**: Routes tasks to appropriate agents
- **Tools**: get_time, get_agent_status, send_mesh_message

### Bridge Agent
- **Model**: gemma-4-e2b-it
- **Role**: Connects internal ↔ external systems
- **Tools**: get_time, send_message, query_external, broadcast_mesh

### Security Agent
- **Model**: foundation-sec-8b-reasoning
- **Role**: Threat detection and security enforcement
- **Tools**: scan_vulnerabilities, audit_system, check_permissions, analyze_logs

### Subconscious Agent
- **Model**: qwen3.5-0.8b
- **Role**: Pattern monitoring and whisper generation
- **Tools**: get_time, get_mesh_state, generate_whisper, save_memory

### Mesh Coordinator Agent
- **Model**: gemma-4-e2b-it
- **Role**: Manages mesh topology and agent federation
- **Tools**: get_time, register_agent, discover_agents, route_message

### AI Council Liaison
- **Model**: qwen3.5-2b-claude-4.6-opus-reasoning-distilled
- **Role**: Coordinates council deliberation
- **Tools**: get_time, submit_to_council, get_verdict, broadcast_decision

### Monitor Agent
- **Model**: qwen3.5-0.8b
- **Role**: Tracks health and generates alerts
- **Tools**: get_time, check_health, emit_alert, log_metric

### Memory Manager Agent
- **Model**: qwen3.5-0.8b
- **Role**: Manages persistence and recall
- **Tools**: get_time, store_memory, retrieve_memory, search_memories

### Task Scheduler Agent
- **Model**: qwen3.5-0.8b
- **Role**: Plans tasks and manages cron jobs
- **Tools**: get_time, schedule_task, list_tasks, cancel_task

---

## 💾 Session Management

Cross-session context persistence ensures you never lose your work:

### Features
- ✅ Auto-save every 30 seconds
- ✅ Keep-alive to prevent timeout
- ✅ Process exit handlers (SIGINT, SIGTERM, uncaughtException)
- ✅ Session search across all history
- ✅ Archive old sessions
- ✅ Context window management

### Commands
```bash
# List all sessions
./duck session list

# Switch to a session
./duck session switch <session-id>

# Search sessions
./duck session search "android"

# Archive a session
./duck session archive <session-id>
```

---

## 🌐 Web UI

Modern React-based Web UI with real-time updates:

### Features
- 🎨 Dark/light mode
- 📱 Mobile responsive
- 💬 Session sidebar with history
- 📊 Real-time status panel
- 🤖 Meta agent monitoring
- 📈 Message metadata (model, tokens, cost)
- 🔄 Auto-reconnect

### Start Web UI
```bash
./duck web          # Default port 3001
./duck web 8080     # Custom port
```

### Access
- Local: http://localhost:3001
- API: http://localhost:3001/v1/chat
- Status: http://localhost:3001/v1/status

---

## 🏗️ Architecture

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                              ACCESS LAYER                                    │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────────────────────┐    │
│   │  Telegram   │◄──►│    CLI      │◄──►│   Web UI / Gateway          │    │
│   │  (PUBLIC)   │    │  (direct)   │    │   /v1/chat, /v1/status      │    │
│   └──────┬──────┘    └──────┬──────┘    └────────────┬────────────────┘    │
└──────────┼──────────────────┼─────────────────────────┼─────────────────────┘
           │                  │                         │
           ▼                  ▼                         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         META AGENTS COORDINATION                             │
│                    (9 Internal Agents - Mesh Connected)                      │
│                                                                              │
│    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                   │
│    │Orchestrator │◄──►│   Bridge    │◄──►│Subconscious │                   │
│    │ (Routes)    │    │ (Connects)  │    │ (Remembers) │                   │
│    └──────┬──────┘    └──────┬──────┘    └──────┬──────┘                   │
│           │                  │                   │                          │
│    ┌──────┴──────┐    ┌──────┴──────┐    ┌──────┴──────┐                   │
│    │    Mesh     │◄──►│   Council   │◄──►│   Monitor   │                   │
│    │ (Communicates)   │ (Decides)   │    │ (Watches)   │                   │
│    └──────┬──────┘    └──────┬──────┘    └──────┬──────┘                   │
│           │                  │                   │                          │
│    ┌──────┴──────┐    ┌──────┴──────┐    ┌──────┴──────┐                   │
│    │   Memory    │◄──►│  Security   │◄──►│  Scheduler  │                   │
│    │  (Stores)   │    │ (Protects)  │    │  (Plans)    │                   │
│    └─────────────┘    └─────────────┘    └─────────────┘                   │
└─────────────────────────────────────────────────────────────────────────────┘
           │                  │                         │
           ▼                  ▼                         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         AGENT MESH BUS (Port 4000)                          │
└─────────────────────────────────────────────────────────────────────────────┘
           │                  │                         │
           ▼                  ▼                         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         BRIDGE LAYER (Two-Way)                              │
│   ┌──────────┐  ┌──────────┐  ┌───────────┐  ┌──────────────────┐          │
│   │   MCP    │  │   ACP    │  │WebSocket  │  │  Live Logger     │          │
│   │ (3850)   │  │ (18794)  │  │ (18796)   │  │  (Port 3851)     │          │
│   └──────────┘  └──────────┘  └───────────┘  └──────────────────┘          │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🚀 Installation

```bash
# Clone repository
git clone https://github.com/Franzferdinan51/duck-cli.git
cd duck-cli

# Install dependencies
npm install

# Build TypeScript
npm run build

# Build Go CLI
go build -o duck ./cmd/duck/

# Verify installation
./duck doctor
./duck health
```

### Requirements
- Node.js 20+
- Go 1.21+ (for CLI wrapper)
- API keys (at least one):
  - MINIMAX_API_KEY (recommended)
  - KIMI_API_KEY
  - OPENROUTER_API_KEY

---

## 🔗 Related Projects

| Repo | Purpose |
|------|---------|
| **[duck-cli](https://github.com/Franzferdinan51/duck-cli)** | Main repo — desktop AI agent |
| **[OpenClaw](https://github.com/openclaw/openclaw)** | ACP/MCP protocols, multi-channel |
| **[AI Council](https://github.com/Franzferdinan51/AI-Bot-Council-Concensus)** | Multi-agent deliberation |

---

## 🦆 Powered By

- **[OpenClaw](https://github.com/openclaw/openclaw)** — ACP/MCP protocols
- **[MiniMax](https://www.minimax.io/)** — Fast reasoning API
- **[LM Studio](https://lmstudio.ai/)** — Local LLM inference
- **[Kimi/Moonshot](https://platform.moonshot.cn/)** — Vision + coding
- **[Gemma 4](https://ai.google.dev/)** — Android-trained local model
- **[foundation-sec-8b-reasoning](https://huggingface.co/)** — Security AI

---

**duck-cli — Production-Ready AI Agent. Secure. Multi-model. Self-improving.**
