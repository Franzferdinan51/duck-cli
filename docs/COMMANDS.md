# 🦆 Duck Agent CLI Commands

> **Duck Agent v0.3.1** — Complete CLI reference

---

## Table of Contents

- [Quick Reference](#quick-reference)
- [Core Commands](#core-commands)
- [Protocol Commands](#protocol-commands)
- [AI System Commands](#ai-system-commands)
- [Automation Commands](#automation-commands)
- [Integration Commands](#integration-commands)
- [Protocol Details](#protocol-details)
- [Examples](#examples)

---

## Quick Reference

```bash
# Start Duck Agent
duck shell              # Interactive TUI shell
duck run <task>         # Single task execution
duck web               # Web UI (http://localhost:3000)
duck unified           # All protocols (MCP + ACP + WS + Gateway)
duck mcp               # MCP server only (port 3848)
duck gateway           # Gateway API (port 18789)

# MCP as CLIENT
duck mcp-connect <url>  # Connect to external MCP server
duck acp <agent> [task] # Spawn external agent (Codex, Claude, etc.)

# MCP as SERVER (OpenClaw connects TO this)
duck acp-server         # ACP server (port 18790)
```

---

## Core Commands

### `duck shell` — Interactive TUI Shell

Start an interactive conversation with Duck Agent.

```bash
duck shell
duck i
duck chat
duck interactive
```

**Shell Commands (type during session):**

| Command | Description |
|---------|-------------|
| `/quit`, `/q` | Exit shell |
| `/help`, `/h` | Show help |
| `/status` | Show agent status |
| `/history` | Show conversation history |
| `/clear` | Clear history |
| `/tools` | List available tools |
| `/think <prompt>` | Reasoning mode |
| `/remember <text>` | Store in memory |
| `/recall <query>` | Search memory |
| `/model <name>` | Switch model |
| Type normally | Chat with agent |

---

### `duck run` — Single Task Execution

Execute a single task and exit.

```bash
duck run "open Safari"
duck run "fix the authentication bug"
duck run "analyze this code and suggest improvements"
duck exec
duck execute
```

**Aliases:** `run`, `exec`, `execute`

---

### `duck think` — Reasoning Mode

Ask Duck Agent to reason about something.

```bash
duck think "Why is the sky blue?"
duck think "What are the pros and cons of microservices?"
```

---

### `duck speak` / `duck voice` / `duck tts` — Text-to-Speech

Generate speech from text using MiniMax TTS.

```bash
duck speak "Hello, world!"
duck voice "What's up?"
duck tts "Duck Agent speaking!"

# With voice style
duck speak "Hello!" narrator
duck speak "Hey there!" casual
duck speak "I'm sad..." sad
```

**Voices:** `narrator`, `casual`, `sad` (or any MiniMax voice)

**Environment Variables:**
```bash
export MINIMAX_API_KEY="your-api-key"
```

---

### `duck think-speak` — Think + Speak

Reason about something and speak the result aloud.

```bash
duck think-speak "Explain quantum entanglement in simple terms"
```

---

### `duck status` — Show Status

Display agent status information.

```bash
duck status
duck info
```

**Output includes:**
- Agent name and ID
- Active providers
- Number of tools available
- Skills loaded
- Conversation history length

---

### `duck tools` — List Tools

Show all available tools.

```bash
duck tools
```

---

### `duck history` — Show History

View conversation history.

```bash
duck history
```

---

### `duck clear` — Clear History

Clear conversation history.

```bash
duck clear
```

---

## Protocol Commands

### `duck unified` — Unified Headless Server

Start all headless protocols simultaneously.

```bash
duck unified
duck headless
```

**Starts all of the following:**

| Port | Protocol | Endpoint |
|------|----------|----------|
| 3848 | MCP Server | http://localhost:3848/mcp |
| 18789 | Gateway API | http://localhost:18789 |
| 18790 | ACP Server | ws://localhost:18790/acp |
| 18791 | WebSocket | ws://localhost:18791 |

**Custom ports:**
```bash
# Not directly configurable via CLI, use the API
```

---

### `duck mcp` — MCP Server

Start the MCP (Model Context Protocol) server.

```bash
duck mcp
duck mcp 3848
duck server
```

**Default port:** 3848

**Endpoints:**

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/mcp` | POST | JSON-RPC 2.0 requests |
| `/mcp/sse` | GET | Server-Sent Events streaming |
| `/mcp/stream` | POST | Streaming HTTP |
| `/health` | GET | Health check |
| `/tools` | GET | List available tools |
| `/capabilities` | GET | Server capabilities |
| `/ws` | WS | WebSocket connection |

**Built-in Tools:**

```
execute           - Execute a task
think            - Reasoning mode
remember         - Store in memory
recall           - Search memory
kairos_status    - Get KAIROS autonomous state
kairos_action    - Trigger autonomous action
desktop_screenshot - Take screenshot
desktop_open     - Open application
desktop_click    - Click at coordinates
desktop_type     - Type text
get_status       - Agent metrics
list_tools       - List all available tools
ping             - Latency check
spawn_agent      - Spawn a sub-agent
```

**Example JSON-RPC Request:**

```bash
curl -X POST http://localhost:3848/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "think",
      "arguments": {
        "prompt": "Why is the sky blue?"
      }
    }
  }'
```

---

### `duck mcp-connect` — Connect to External MCP Server

Connect Duck Agent to an external MCP server as a client.

```bash
duck mcp-connect ws://remote-server:3848/ws
duck mcp-connect wss://mcp.example.com/mcp
```

**Usage:**
```bash
# Connect to local MCP server
duck mcp-connect ws://localhost:3848/ws

# Connect to remote MCP server
duck mcp-connect ws://100.68.208.113:3848/ws
```

---

### `duck acp-server` — ACP Server (for OpenClaw)

Start Duck Agent as an ACP server. OpenClaw connects TO this to spawn Duck Agent sessions.

```bash
duck acp-server
duck acp-server 3849
duck acpserver
```

**Default port:** 18790

**Features:**
- WebSocket endpoint: `ws://localhost:18790/acp`
- Session management: spawn, cancel, steer, send
- Max concurrent sessions: 8
- Session timeout: 30 minutes (configurable)
- JSON-RPC 2.0 protocol

**ACP Methods:**

| Method | Description |
|--------|-------------|
| `acp.spawn` | Spawn new session |
| `acp.cancel` | Cancel running session |
| `acp.steer` | Send steering instruction |
| `acp.send` | Send message to session |
| `acp.status` | Get server/session status |
| `acp.sessions` | List all active sessions |

**OpenClaw Configuration:**

In `openclaw.json`:

```json
{
  "agents": {
    "list": [
      {
        "id": "duck",
        "name": "Duck Agent",
        "workspace": "~/.duck-agent",
        "runtime": {
          "type": "acp",
          "acp": {
            "agent": "duck",
            "backend": "acpx",
            "mode": "persistent"
          }
        }
      }
    ]
  }
}
```

Then connect acpx:

```bash
acpx connect ws://localhost:18790/acp --agent duck
```

---

### `duck acp` — ACP Client (Spawn External Agents)

Spawn external coding agents (Codex, Claude, etc.) to handle tasks.

```bash
duck acp codex "fix the auth bug"
duck acp claude "review PR #123"
duck acp cursor "refactor the API layer"
duck acp-spawn
```

**Supported Agents:**

| Agent | Command | Description |
|-------|---------|-------------|
| `codex` | `duck acp codex` | OpenAI Codex |
| `claude` | `duck acp claude` | Claude Code |
| `cursor` | `duck acp cursor` | Cursor AI |
| `gemini` | `duck acp gemini` | Google Gemini CLI |
| `pi` | `duck acp pi` | Pi AI |
| `openclaw` | `duck acp openclaw` | OpenClaw agent |
| `opencode` | `duck acp opencode` | OpenCode |

**Modes:**
- `oneshot` — Fire and forget, get result when done
- `persistent` — Interactive session

**Examples:**

```bash
# Spawn codex for a single task
duck acp codex "Fix the login bug"

# Spawn claude for interactive session
duck acp claude

# Spawn gemini for code review
duck acp gemini "Review this PR: https://github.com/user/repo/pull/1"
```

---

### `duck ws` — WebSocket Manager

Manage bidirectional WebSocket connections.

```bash
# Connect to external WebSocket server
duck ws connect wss://remote-server.com/ws

# Check status
duck ws status
```

**Actions:**

| Action | Description |
|--------|-------------|
| `connect <url>` | Connect to WebSocket server |
| `status` | Show connection status |

**Features:**
- Auto-reconnection
- Channel-based routing
- Message queuing
- Binary/text support

---

### `duck gateway` — Gateway API

Start the OpenAI-compatible Gateway API server.

```bash
duck gateway
```

**Default port:** 18789

**Endpoints:**

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/v1/chat/completions` | POST | Chat completions (OpenAI-compatible) |
| `/v1/models` | GET | List available models |
| `/health` | GET | Health check |
| `/status` | GET | Server status |

**Example:**

```bash
# Chat completions
curl -X POST http://localhost:18789/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "Hello"}
    ],
    "model": "duck-agent"
  }'

# List models
curl http://localhost:18789/v1/models

# Health check
curl http://localhost:18789/health
```

---

## AI System Commands

### `duck kairos` — KAIROS Proactive AI

Control the KAIROS autonomous system.

```bash
duck kairos
duck kairos aggressive    # Aggressive mode
duck kairos balanced      # Balanced mode (default)
duck kairos conservative  # Conservative mode
duck kairos status        # Show KAIROS status
duck kairos enable        # Enable KAIROS
duck kairos disable       # Disable KAIROS
```

**KAIROS Modes:**

| Mode | Behavior |
|------|----------|
| `aggressive` | Acts frequently, higher autonomy |
| `balanced` | Moderate action frequency |
| `conservative` | Acts rarely, waits for clear signals |

**What KAIROS Does:**
- Heartbeat checks every N minutes
- Pattern learning from interactions
- Autonomous actions (3AM auto-dream)
- Notifications to Telegram

---

### `duck buddy` — Buddy Companion

Manage your AI companion.

```bash
duck buddy hatch    # Hatch a new buddy
duck buddy list     # List your buddies
duck buddy stats    # View buddy stats
duck buddy feed     # Feed your buddy
duck buddy play     # Play with your buddy
```

**Buddy Attributes:**

| Attribute | Values |
|-----------|--------|
| Rarity | common, uncommon, rare, epic, legendary |
| Species | duck, blob, cat, dragon, owl, ghost, robot, rabbit, cactus, snail |
| Stats | DEBUGGING, PATIENCE, CHAOS, WISDOM, SNARK |

---

### `duck team` — Multi-Agent Teams

Create and manage teams of agents.

```bash
duck team create <name>        # Create a team
duck team spawn <template>      # Spawn team members
duck team status              # Check team status
duck team list               # List all teams
duck team dispatch <msg>      # Send message to team
```

**Templates:**

| Template | Purpose |
|----------|---------|
| `code-review` | PR analysis, bug detection |
| `research` | Web search, summarization |
| `swarm` | Parallel task execution |

---

### `duck council` — AI Council

Deliberate on decisions with multiple AI perspectives.

```bash
duck council "Should we refactor the auth module?"
duck council "What technology stack should we use?"
```

**Councilors:**

| Councilor | Role |
|-----------|------|
| 🎤 Speaker | Facilitator |
| 🔬 Technocrat | Technical analysis |
| ⚖️ Ethicist | Moral reasoning |
| 🎯 Pragmatist | Practical focus |
| 🤔 Skeptic | Critical analysis |
| 🛡️ Sentinel | Risk assessment |

---

## Automation Commands

### `duck cron` — Cron Job Scheduler

Manage scheduled automation jobs.

```bash
duck cron list              # List all jobs
duck cron enable <job>     # Enable a job
duck cron disable <job>    # Disable a job
duck cron run <job>        # Run a job now
duck cron status           # Show cron status
```

**Predefined Jobs:**

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

### `duck update` — Update Management

Manage Duck Agent updates.

```bash
duck update check      # Check for updates
duck update install   # Install latest
duck update backup    # Backup first
duck update restore   # Rollback
duck update status    # Git status
```

---

## Integration Commands

### `duck channels` — Enable Channels

Start Telegram/Discord channels.

```bash
duck channels
duck channels ./channels.json
duck telegram
duck discord
```

**Configuration file (`channels.json`):**

```json
{
  "telegram": {
    "botToken": "YOUR_TELEGRAM_BOT_TOKEN",
    "allowedUsers": [123456789]
  },
  "discord": {
    "botToken": "YOUR_DISCORD_BOT_TOKEN",
    "applicationId": "123456789",
    "allowedRoles": ["Admin", "Moderator"]
  }
}
```

---

### `duck send` — Send Message

Send a message via a channel.

```bash
duck send telegram 123456789 "Hello!"
duck send discord #general "Message to Discord"
duck sendto telegram 123456789 "Hello from Duck Agent"
```

**Usage:** `duck send <channel> <chatId> <message>`

---

### `duck desktop` — Desktop Control

Control your desktop using ClawdCursor.

```bash
duck desktop open Safari          # Open an app
duck desktop click 100 200        # Click at coordinates
duck desktop type "hello world"   # Type text
duck desktop screenshot           # Take screenshot
```

**Actions:**

| Action | Description |
|--------|-------------|
| `open <app>` | Open an application |
| `click <x> <y>` | Click at coordinates |
| `type <text>` | Type text |
| `screenshot` | Take and save screenshot |

---

### `duck memory` — Memory Commands

Manage Duck Agent's memory.

```bash
duck memory add "User prefers dark mode"   # Remember something
duck memory search "preferences"           # Search memories
duck memory recall "dark mode"             # Recall memories
```

---

## Protocol Details

### MCP (Model Context Protocol)

Full MCP 2024-11-05 spec implementation.

**Connection:**

```bash
# HTTP POST
curl -X POST http://localhost:3848/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'

# WebSocket
ws://localhost:3848/ws

# SSE (streaming)
curl http://localhost:3848/mcp/sse
```

**JSON-RPC Methods:**

```javascript
// List tools
{"jsonrpc":"2.0","id":1,"method":"tools/list"}

// Call tool
{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{
  "name": "execute",
  "arguments": {"task": "open Safari"}
}}

// Get capabilities
{"jsonrpc":"2.0","id":3,"method":"server/capabilities"}
```

---

### ACP (Agent Client Protocol)

Two modes: **Server** (OpenClaw connects) and **Client** (Duck Agent spawns agents).

**Server Mode:**

```bash
duck acp-server 18790
# Listens for OpenClaw connections
```

**Client Mode:**

```bash
duck acp codex "fix bug"
# Spawns codex agent to handle task
```

---

### WebSocket Manager

```bash
# Start as server
duck ws

# Connect to peer
duck ws connect wss://peer.example.com/ws

# Check status
duck ws status
```

---

## Examples

### Basic Usage

```bash
# Chat with agent
duck shell

# Single task
duck run "What is the weather in Dayton Ohio?"

# Reasoning
duck think "How does blockchain consensus work?"

# Text-to-speech
duck speak "Duck Agent is awesome!"

# List tools
duck tools
```

### Headless Server

```bash
# Start all protocols
duck unified

# MCP server only
duck mcp

# Gateway API only
duck gateway

# ACP server (for OpenClaw)
duck acp-server

# WebSocket only
duck ws
```

### Connect External Agents

```bash
# Spawn Codex for a task
duck acp codex "Fix the authentication bug"

# Spawn Claude for code review
duck acp claude "Review PR #456"

# Connect to external MCP
duck mcp-connect ws://mcp-server:3848/ws
```

### Automation

```bash
# Start Telegram
duck channels ./channels.json

# Send a message
duck send telegram 123456 "Hello from Duck Agent!"

# Schedule jobs
duck cron list
duck cron enable grow-check
duck cron disable ai-news
```

### Desktop Control

```bash
# Open an app
duck desktop open Safari

# Take a screenshot
duck desktop screenshot

# Click at location
duck desktop click 500 300

# Type text
duck desktop type "Hello World"
```

### Docker

```bash
# Build image
npm run docker:build

# Run container
npm run docker:run

# View logs
npm run docker:logs
```

---

## Environment Variables

```bash
# AI Providers
MINIMAX_API_KEY=your-minimax-key
ANTHROPIC_API_KEY=your-anthropic-key
OPENAI_API_KEY=your-openai-key

# Local Models
LMSTUDIO_URL=http://localhost:1234

# Channels
TELEGRAM_BOT_TOKEN=your-telegram-token
DISCORD_BOT_TOKEN=your-discord-token

# Web UI
WEB_PORT=3000

# MCP Server
MCP_PORT=3848
```

---

## Troubleshooting

```bash
# Health checks
curl http://localhost:3848/health     # MCP
curl http://localhost:18789/health     # Gateway
curl http://localhost:18790/health     # ACP Server

# View status
duck status

# Check for updates
duck update status

# Backup before changes
duck update backup
```
