# 🦆 Duck Agent CLI Commands

> **Duck Agent v0.3.2** — Complete CLI reference with Agent Mesh, OpenClaw-RL, ClawHub, Souls Registry, and 45-agent AI Council

---

## Table of Contents

- [Quick Reference](#quick-reference)
- [Core Commands](#core-commands)
- [Protocol Commands](#protocol-commands)
- [Agent Mesh Commands](#agent-mesh-commands)
- [OpenClaw-RL Commands](#openclaw-rl-commands)
- [ClawHub Commands](#clawhub-commands)
- [Souls Commands](#souls-commands)
- [AI Council Commands](#ai-council-commands)
- [AI System Commands](#ai-system-commands)
- [Automation Commands](#automation-commands)
- [Integration Commands](#integration-commands)
- [System Commands](#system-commands)
- [Examples](#examples)

---

## Quick Reference

```bash
# REQUIRED: Start Duck Agent
duck shell              # Interactive TUI shell
duck run <task>         # Single task execution
duck web [port]         # Web UI (http://localhost:3001)
duck unified            # All protocols (MCP + ACP + WS + Gateway)
duck mcp                # MCP server only (port 3850)
duck gateway            # Gateway API (port 18792)

# OPTIONAL: Mesh (requires mesh server running)
duck mesh register      # Join mesh network
duck mesh list          # Discover agents

# OPTIONAL: RL (requires RL server running)
duck rl connect <url>   # Connect to RL server
duck rl enable          # Enable training

# OPTIONAL: Council (requires council server + LM Studio)
duck council list       # List 45 councilors
duck council summon <r> # Summon specific councilor

# OPTIONAL: ClawHub (skill marketplace)
duck clawhub search <query>   # Search skills
duck clawhub install <skill>  # Install a skill

# OPTIONAL: Souls (SOUL.md sharing)
# duck souls publish          # Share SOUL.md (use ClawHub CLI instead)
duck souls list               # Browse souls

# ACP client (spawn external agents)
duck acp <agent> [task] # Spawn external agent (Codex, Claude, etc.)

# ACP server (let OpenClaw connect TO this)
duck acp-server         # ACP server (port 18794)
```

---

## Port Reference

Duck Agent uses different ports than OpenClaw so both can run side-by-side.

| Protocol | Duck Agent | OpenClaw |
|----------|-----------|----------|
| **Gateway API** | 18792 | 18789 |
| **MCP Server** | 3850 | 3848 |
| **ACP Server** | 18794 | 18790 |
| **WebSocket** | 18796 | 18791 |
| **Web UI** | 3001 | 3000 |

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
| 3850 | MCP Server | http://localhost:3850/mcp |
| 18792 | Gateway API | http://localhost:18792 |
| 18794 | ACP Server | ws://localhost:18794/acp |
| 18796 | WebSocket | ws://localhost:18796 |

---

### `duck mcp` — MCP Server

Start the MCP (Model Context Protocol) server.

```bash
duck mcp
duck mcp 3850
duck server
```

**Default port:** 3850

**Built-in Tools:**

```
execute             - Execute a task
think              - Reasoning mode
remember           - Store in memory
recall             - Search memory
kairos_status      - Get KAIROS autonomous state
kairos_action      - Trigger autonomous action
desktop_screenshot - Take screenshot
desktop_open       - Open application
desktop_click      - Click at coordinates
desktop_type       - Type text
get_status         - Agent metrics
list_tools         - List all available tools
ping               - Latency check
spawn_agent        - Spawn a sub-agent
```

---

### `duck mcp-connect` — Connect to External MCP Server

Connect Duck Agent to an external MCP server as a client.

```bash
duck mcp-connect ws://remote-server:3848/ws
duck mcp-connect wss://mcp.example.com/mcp
```

---

### `duck acp-server` — ACP Server (for OpenClaw)

Start Duck Agent as an ACP server. OpenClaw connects TO this to spawn Duck Agent sessions.

```bash
duck acp-server
duck acp-server 18794
duck acpserver
```

**Default port:** 18794

**Features:**
- WebSocket endpoint: `ws://localhost:18794/acp`
- Session management: spawn, cancel, steer, send
- Max concurrent sessions: 8
- JSON-RPC 2.0 protocol

---

### `duck acp` — ACP Client (Spawn External Agents)

Spawn external coding agents (Codex, Claude, etc.) to handle tasks.

```bash
duck acp codex "fix the auth bug"
duck acp claude "review PR #123"
duck acp cursor "refactor the API layer"
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

---

### `duck ws` — WebSocket Manager

Manage bidirectional WebSocket connections.

```bash
# Connect to external WebSocket server
duck ws connect wss://remote-server.com/ws

# Check status
duck ws status
```

---

### `duck gateway` — Gateway API

Start the OpenAI-compatible Gateway API server.

```bash
duck gateway
```

**Default port:** 18792

---

### `duck web` — Web UI

Start the Web UI server.

```bash
duck web
duck web 3001
```

**Default port:** 3001

---

## Agent Mesh Commands

> 🌐 **OPTIONAL** — Requires Agent Mesh server running at `AGENT_MESH_URL`

```bash
# Prerequisites
# 1. Start mesh server:
#    cd /Users/duckets/Desktop/agent-mesh-api && npm start
#
# 2. Set environment:
#    export AGENT_MESH_URL=http://localhost:4000
#    export AGENT_MESH_API_KEY=openclaw-mesh-default-key
```

### `duck mesh register` — Register on Mesh

Join the agent mesh network and get a unique agent ID.

```bash
duck mesh register
```

**Output:**
```
Registered as agent_id=duck-abc123 on mesh
Mesh URL: http://localhost:4000
Capabilities: [coding, reasoning, desktop-control, ...]
```

---

### `duck mesh list` — Discover Agents

List all agents currently connected to the mesh.

```bash
duck mesh list
duck mesh list --verbose
```

**Output:**
```
┌─────────────────┬────────────────┬──────────────────────────────┐
│ Agent ID        │ Name           │ Capabilities                 │
├─────────────────┼────────────────┼──────────────────────────────┤
│ duck-abc123     │ Duck Agent     │ coding, reasoning, desktop   │
│ smith-xyz789    │ Agent Smith    │ coding, research, windows     │
│ openclaw-123    │ OpenClaw       │ gateway, skills, channels   │
└─────────────────┴────────────────┴──────────────────────────────┘
```

---

### `duck mesh send` — Send Message

Send a direct message to a specific agent on the mesh.

```bash
duck mesh send <agent_id> <message>
duck mesh send duck-xyz789 "Can you check the grow tent?"
duck mesh send openclaw-123 "Sync request: 42 tasks pending"
```

**Arguments:**
- `agent_id` — Target agent's ID (from `duck mesh list`)
- `message` — Message to send (quote if contains spaces)

---

### `duck mesh broadcast` — Broadcast to All

Send a message to all agents on the mesh.

```bash
duck mesh broadcast <message>
duck mesh broadcast "System health check starting in 5 minutes"
duck mesh broadcast "Update available: please restart"
```

---

### `duck mesh inbox` — Check Messages

View messages sent to you by other agents.

```bash
duck mesh inbox
duck mesh inbox --unread
```

**Output:**
```
┌──────────┬────────────────┬──────────────────────────┬────────┐
│ From     │ Message        │ Timestamp                │ Read   │
├──────────┼────────────────┼──────────────────────────┼────────┤
│ smith    │ Grow check done│ 2026-03-31 18:00:00 UTC  │ true   │
│ openclaw │ Sync request   │ 2026-03-31 18:05:00 UTC  │ false  │
└──────────┴────────────────┴──────────────────────────┴────────┘
```

---

### `duck mesh status` — Ping Mesh Server

Check mesh server health and connectivity.

```bash
duck mesh status
duck mesh health
```

**Output:**
```
Mesh Server:  http://localhost:4000
Status:      ✅ Online
Latency:     12ms
Registered:  duck-abc123
Last Ping:   2026-03-31 18:30:00 UTC
```

---

### `duck mesh capabilities` — Map Agent Skills

Show which agents have which capabilities.

```bash
duck mesh capabilities
```

**Output:**
```
┌─────────────┬────────────────────────────────────────────────┐
│ Capability  │ Agents                                        │
├─────────────┼────────────────────────────────────────────────┤
│ coding      │ duck-abc123, smith-xyz789, openclaw-123       │
│ research    │ smith-xyz789, openclaw-123                    │
│ desktop     │ duck-abc123                                   │
│ windows     │ smith-xyz789                                  │
│ gateway     │ openclaw-123                                  │
│ channels    │ openclaw-123, duck-abc123                     │
└─────────────┴────────────────────────────────────────────────┘
```

---

### `duck mesh catastrophe` — Check Catastrophe Events

View active catastrophe events across the mesh.

```bash
duck mesh catastrophe
```

**Output:**
```
Active Catastrophes: 2
┌────┬────────────────┬──────────────┬─────────────────────────┐
│ ID │ Type           │ Severity     │ Description             │
├────┼────────────────┼──────────────┼─────────────────────────┤
│ 1  │ service-down   │ HIGH         │ LM Studio unreachable   │
│ 2  │ token-low      │ MEDIUM       │ MiniMax quota at 80%    │
└────┴────────────────┴──────────────┴─────────────────────────┘
```

---

## OpenClaw-RL Commands

> 🧪 **OPTIONAL** — Requires OpenClaw-RL server running

```bash
# Prerequisites
# 1. Start RL server:
#    cd OpenClaw-RL/slime
#    bash ../openclaw-rl/run_qwen3_4b_openclaw_rl.sh   # GRPO
#    # or
#    bash ../openclaw-opd/run_qwen3_4b_openclaw_opd.sh  # OPD
```

### `duck rl status` — Show RL Status

Display current RL state (enabled/disabled, server, training).

```bash
duck rl status
```

**Output (RL disabled):**
```
RL Enabled:   false
RL Server:    none
Training:     idle
Method:       none
```

**Output (RL enabled):**
```
RL Enabled:   true
RL Server:    http://192.168.1.100:30000
Training:     active
Method:       GRPO
Sessions:     42 trained
Avg Reward:  +0.73
```

---

### `duck rl enable` — Enable RL Training

Turn on reinforcement learning. Conversations will now train the model in background.

```bash
duck rl enable
```

**Output:**
```
RL training enabled.
All main-turn conversations will be sent to the RL server.
Use `duck rl stats` to monitor progress.
```

---

### `duck rl disable` — Disable RL Training

Turn off reinforcement learning. Conversations return to normal (no training).

```bash
duck rl disable
```

**Output:**
```
RL training disabled.
Conversations will no longer train the model.
```

---

### `duck rl connect` — Connect to RL Server

Connect Duck Agent to an OpenClaw-RL server.

```bash
duck rl connect <url>
duck rl connect http://192.168.1.100:30000
duck rl connect http://localhost:30000
```

**Arguments:**
- `url` — RL server URL (from RL server startup output)

---

### `duck rl disconnect` — Disconnect from RL Server

Remove the RL server connection.

```bash
duck rl disconnect
```

---

### `duck rl stats` — Show Training Statistics

View RL training metrics and progress.

```bash
duck rl stats
```

**Output:**
```
OpenClaw-RL Training Statistics
═══════════════════════════════════
Sessions Trained:    42
Total Turns:        847
Main Turns:          612
Side Turns:          235 (skipped)
Avg Reward:         +0.73
Latest Reward:       +0.89
Loss (last batch):   0.12
Policy Updated:      2026-03-31 18:00:00 UTC
Next Update:         ~5 minutes
═══════════════════════════════════
Method:              GRPO (Binary RL)
PRM Model:           qwen3_4b_openclaw_rl
RL Server:           http://192.168.1.100:30000
Status:              ✅ Training active
```

---

## ClawHub Commands

> 🔧 **OPTIONAL** — Requires ClawHub server and registry

### `duck clawhub search` — Search Skills

Search the skill marketplace for available skills.

```bash
duck clawhub search <query>
duck clawhub search "image generation"
duck clawhub search "web scraping"
duck clawhub search "code review"
```

**Output:**
```
┌──────────────────────┬─────────────────────────────────┬─────────┬───────────┐
│ Skill                │ Description                     │ Author  │ Downloads │
├──────────────────────┼─────────────────────────────────┼─────────┼───────────┤
│ minimax-image       │ Image generation via MiniMax    │ DuckBot │ 1,234     │
│ weather-api         │ Weather alerts and forecasts    │ DuckBot │ 856       │
│ github-clone        │ Clone and setup GitHub repos    │ DuckBot │ 432       │
└──────────────────────┴─────────────────────────────────┴─────────┴───────────┘
```

---

### `duck clawhub explore` — Browse Skill Catalog

Browse the full skill marketplace catalog.

```bash
duck clawhub explore
```

**Output:**
```
🦆 ClawHub Skill Marketplace
clawhub.ai - OpenClaw skill registry

⭐ Featured Skills:
  github-clone       - Clone and setup GitHub repos
  minimax-image     - Image generation via MiniMax
  browser-automation - Full browser control

📚 Latest Skills:
  security-audit     - Security vulnerability scanner
  web-scraper       - Advanced web scraping toolkit
  data-visualizer   - Charts and graphs generator
```

---

### `duck clawhub install` — Install a Skill

Install a skill from the marketplace.

```bash
duck clawhub install <skill_name>
duck clawhub install minimax-image
duck clawhub install weather-api
```

---

### `duck clawhub publish` — Publish a Skill

Publish your custom skill to the marketplace.

```bash
duck clawhub publish <skill_name>
duck clawhub publish my-custom-skill
```

---

### `duck clawhub list` — List Installed Skills

Show all skills currently installed.

```bash
duck clawhub list
```

**Output:**
```
Installed Skills:
✅ minimax-image      - Image generation
✅ weather-api        - Weather integration
✅ github-clone       - GitHub repository setup
✅ minimax-speech     - Text-to-speech
✅ desktop-control    - ClawdCursor integration
```

---

### `duck clawhub info` — Show Skill Details

View detailed information about a skill.

```bash
duck clawhub info <skill_name>
duck clawhub info minimax-image
```

---

### `duck clawhub update` — Update a Skill

Update a skill to the latest version.

```bash
duck clawhub update <skill_name>
duck clawhub update minimax-image
```

---

### `duck clawhub uninstall` — Remove a Skill

Uninstall a skill from your agent.

```bash
duck clawhub uninstall <skill_name>
duck clawhub uninstall weather-api
```

---

## Souls Commands

> 🦆 **OPTIONAL** — Requires ClawHub souls registry

### `duck souls list` — Browse Available Souls

View all shared agent personalities (SOUL.md) in the registry.

```bash
duck souls list
duck souls list --popular
duck souls list --recent
```

**Output:**
```
┌──────────────────────────┬─────────────────────────────────┬─────────┐
│ Soul ID                  │ Description                     │ Author  │
├──────────────────────────┼─────────────────────────────────┼─────────┤
│ duckbot-standard         │ Standard DuckBot personality    │ DuckBot │
│ duckbot-researcher       │ Deep research focus             │ DuckBot │
│ duckbot-coder            │ Coding-optimized persona       │ DuckBot │
│ agent-smith-production    │ Production agent persona       │ Smith   │
└──────────────────────────┴─────────────────────────────────┴─────────┘
```

---

### `duck souls featured` — Show Featured SOULs

View featured AI personas from the registry.

```bash
duck souls featured
```

---

### `duck souls search` — Search for SOULs

Search for AI personas in the registry.

```bash
duck souls search <query>
duck souls search "helpful"
duck souls search "research"
```

---

### `duck souls activate` — Activate a SOUL

Activate an installed SOUL as your agent's persona.

```bash
duck souls activate <soul_name>
duck souls activate duckbot-researcher
```

**Note:** Restart the agent for changes to take effect.

---

---







## AI Council Commands

> 🏛️ **OPTIONAL** — Requires council server with LM Studio models

### `duck council` — Ask the Council

Pose a question or proposal to the 45-agent AI Council.

```bash
duck council "Should we refactor the auth module?"
duck council "What technology stack should we use for the new service?"
duck council "Analyze this security vulnerability: SQL injection in /api/users"
```

**Deliberation Modes:**

| Mode | Trigger | Use For |
|------|---------|---------|
| Legislative | Default | Debate & vote on proposals |
| Deep Research | `--research` | Multi-vector investigation |
| Swarm Coding | `--swarm` | Parallel software engineering |
| Prediction Market | `--predict` | Probabilistic forecasting |
| Inquiry | `--query` | Direct Q&A |
| Deliberation | `--discuss` | Roundtable discussion |

**Examples:**
```bash
# Standard deliberation
duck council "Should we switch from REST to GraphQL?"

# Deep research mode
duck council --research "What are the long-term risks of AI alignment?"

# Swarm coding
duck council --swarm "Implement a new authentication system"
```

---

### `duck council list` — List All 45 Councilors

Show all 45 councilors with their roles and specialties.

```bash
duck council list
duck council list --verbose
```

**Output (abbreviated):**
```
┌────┬────────────────────┬─────────────┬──────────────────────────────┐
│ #  │ Name               │ Role        │ Specialty                    │
├────┼────────────────────┼─────────────┼──────────────────────────────┤
│  1 │ 🎤 Speaker         │ Facilitator │ Orchestrates deliberation   │
│  2 │ 🔬 Technocrat      │ Technical   │ Systems, architecture      │
│  3 │ ⚖️ Ethicist         │ Moral       │ Ethics, privacy, fairness   │
│  4 │ 🎯 Pragmatist      │ Practical   │ Feasibility, resources      │
│  5 │ 🤔 Skeptic          │ Critical    │ Weaknesses, failure modes   │
│  6 │ 🛡️ Sentinel         │ Risk        │ Security, threats           │
│  7 │ 📊 Quant            │ Math        │ Statistics, probabilities   │
│  8 │ 🔮 Futurist         │ Long-term   │ Trends, predictions         │
│ ...│ ...                │ ...         │ ...                          │
│ 45 │ 🌟 Sage             │ Wisdom      │ Experience, intuition       │
└────┴────────────────────┴─────────────┴──────────────────────────────┘
```

---

### `duck council summon` — Summon Specific Councilor

Call a specific councilor to the deliberation.

```bash
duck council summon Technocrat
duck council summon Skeptic "Review this code: ..."
duck council summon --role Security "Assess this vulnerability"
```

**Summonable Roles:**
```
Speaker, Technocrat, Ethicist, Pragmatist, Skeptic, Sentinel,
Quant, Futurist, Speedrunner, Analyst, Innovator, Historian,
Designer, Economist, Green, Globalist, Engineer, Tester,
Librarian, Devil's Advocate, Mediator, Growth, Privacy Officer,
Launch, Maintainer, Teacher, Gamifier, Flow, Alerts, Toolsmith,
Architect, Evolution, Circus, Scribe, Refactorer, Fortress,
Network, Package, Integration, Storage, Performance, Research,
Champion, Success, Sage
```

---

### `duck council mode` — Set Deliberation Mode

Change the council's deliberation approach.

```bash
duck council mode legislative    # Debate & vote (default)
duck council mode research       # Deep investigation
duck council mode swarm          # Parallel coding
duck council mode predict        # Probabilistic forecasting
duck council mode inquiry        # Direct Q&A
duck council mode discuss        # Roundtable
```

---

### `duck council members` — Show Active Councilors

View which councilors are participating in the current deliberation.

```bash
duck council members
duck council members --verbose
```

---

### `duck council vote` — Vote on Outcome

Cast a vote on the council's recommendation.

```bash
duck council vote approve
duck council vote reject
duck council vote abstain
duck council vote abstain --reason "Need more data"
```

---

### `duck council history` — View Past Deliberations

Show history of council decisions.

```bash
duck council history
duck council history --limit 10
duck council history --query "authentication"
```

---

## AI System Commands

### `duck kairos` — KAIROS Proactive AI

Control the KAIROS autonomous system.

```bash
duck kairos
duck kairos aggressive    # Act frequently
duck kairos balanced      # Moderate (default)
duck kairos conservative  # Act rarely
duck kairos enable        # Enable KAIROS
duck kairos disable       # Disable KAIROS
duck kairos status        # Show status
duck kairos actions       # Show recent actions
```

**KAIROS Modes:**

| Mode | Behavior |
|------|----------|
| `aggressive` | Acts frequently, higher autonomy |
| `balanced` | Moderate action frequency |
| `conservative` | Acts rarely, waits for clear signals |

---

### `duck buddy` — Buddy Companion

Manage your AI companion.

```bash
duck buddy hatch    # Hatch a new buddy
duck buddy list     # List your buddies
duck buddy stats    # View buddy stats
duck buddy feed     # Feed your buddy
duck buddy play     # Play with your buddy
duck buddy rename   # Rename buddy
duck buddy release  # Release buddy
```

---

### `duck team` — Multi-Agent Teams

Create and manage teams of agents.

```bash
duck team create <name>        # Create a team
duck team spawn <template>     # Spawn team members
duck team status               # Check team status
duck team list                 # List all teams
duck team dispatch <msg>       # Send message to team
duck team disband <name>       # Disband team
duck team join <name>          # Join existing team
```

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
duck cron log <job>        # View job logs
duck cron edit <job>       # Edit job schedule
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

## Integration Commands

### `duck channels` — Enable Channels

Start Telegram/Discord channels.

```bash
duck channels
duck channels ./channels.json
duck telegram
duck discord
```

---

### `duck send` — Send Message

Send a message via a channel.

```bash
duck send telegram 123456789 "Hello!"
duck send discord #general "Message to Discord"
```

---

### `duck desktop` — Desktop Control

Control your desktop using ClawdCursor.

```bash
duck desktop open Safari          # Open an app
duck desktop click 100 200         # Click at coordinates
duck desktop type "hello world"    # Type text
duck desktop screenshot           # Take screenshot
duck desktop drag 100 200 300 400  # Drag from A to B
duck desktop scroll 100           # Scroll
duck desktop key "Enter"          # Press key
```

---

### `duck memory` — Memory Commands

Manage Duck Agent's memory.

```bash
duck memory add "User prefers dark mode"   # Remember something
duck memory search "preferences"            # Search memories
duck memory recall "dark mode"              # Recall memories
duck memory list                            # List all memories
duck memory delete <id>                    # Delete memory
duck memory clear                           # Clear all memories
```

---

## System Commands

### `duck update` — Update Management

Manage Duck Agent updates.

```bash
duck update check      # Check for updates
duck update install    # Install latest
duck update backup     # Backup first
duck update restore    # Rollback
duck update status     # Git status
duck update diff       # Show changes
```

---

### `duck compat` — OpenClaw Compatibility

Check and manage OpenClaw compatibility layer.

```bash
duck compat             # Check compatibility status
duck compat status      # Show detailed status
duck compat sync        # Sync with OpenClaw
duck compat version    # Show version info
```

---

### `duck sync` — Sync with External Systems

Sync with various external systems.

```bash
duck sync              # Sync all systems
duck sync openclaw     # Sync with OpenClaw
duck sync clawhub      # Sync ClawHub
duck sync souls        # Sync Souls registry
```

---

## Protocol Details

### MCP (Model Context Protocol) — Port 3850

```bash
# HTTP POST
curl -X POST http://localhost:3850/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'

# WebSocket
ws://localhost:3850/ws

# SSE (streaming)
curl http://localhost:3850/mcp/sse
```

---

### ACP (Agent Client Protocol) — Port 18794

**Server Mode (OpenClaw connects TO Duck Agent):**
```bash
duck acp-server 18794
```

**Client Mode (Duck Agent spawns agents):**
```bash
duck acp codex "fix bug"
```

---

### Gateway API — Port 18792

```bash
# Chat completions
curl -X POST http://localhost:18792/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Hello"}],"model":"duck-agent"}'

# List models
curl http://localhost:18792/v1/models

# Health check
curl http://localhost:18792/health
```

---

### WebSocket — Port 18796

```bash
# Connect via wscat
wscat -c ws://localhost:18796

# Or via browser JavaScript
const ws = new WebSocket('ws://localhost:18796');
ws.send(JSON.stringify({type: 'message', content: 'Hello!'}));
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

### Agent Mesh (Optional)

```bash
# Register on mesh
duck mesh register

# Discover agents
duck mesh list

# Send message to agent
duck mesh send duck-xyz789 "Check the grow tent"

# Broadcast to all
duck mesh broadcast "Health check starting"

# Check inbox
duck mesh inbox
```

### OpenClaw-RL (Optional)

```bash
# Check status (off by default)
duck rl status

# Connect to RL server
duck rl connect http://192.168.1.100:30000

# Enable training
duck rl enable

# Chat normally — training happens in background
duck shell

# Check stats
duck rl stats

# Disable when done
duck rl disable
```

### ClawHub Skill Marketplace (Optional)

```bash
# Search for skills
duck clawhub search "image generation"

# Install a skill
duck clawhub install minimax-image

# List installed skills
duck clawhub list

# Publish your own skill
duck clawhub publish my-custom-skill

# Update a skill
duck clawhub update minimax-image

# Uninstall a skill
duck clawhub uninstall weather-api
```

### Souls Registry (Optional)

```bash
# Browse available souls
duck souls list

# Show featured SOULs
duck souls featured

# Search for a specific persona
duck souls search "helpful assistant"

# Install a SOUL
duck souls install duckbot-researcher

# Activate a SOUL
duck souls activate duckbot-researcher
```

### AI Council (Optional)

```bash
# Ask the council
duck council "Should we refactor the auth module?"

# List all 45 councilors
duck council list

# Summon specific councilor
duck council summon Skeptic

# Set deliberation mode
duck council mode research

# View history
duck council history --limit 5
```

### Connect External Agents

```bash
# Spawn Codex for a task
duck acp codex "Fix the authentication bug"

# Spawn Claude for code review
duck acp claude "Review PR #456"
```

### Automation

```bash
# Start Telegram
duck channels ./channels.json

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
```

### OpenClaw Compatibility

```bash
# Check compatibility
duck compat status

# Sync with OpenClaw
duck compat sync

# Show version info
duck compat version
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

# Agent Mesh (Optional)
AGENT_MESH_URL=http://localhost:4000
AGENT_MESH_API_KEY=openclaw-mesh-default-key

# OpenClaw-RL (Optional)
OPENCLAW_RL_URL=http://localhost:30000

# ClawHub (Optional)
CLAWHUB_URL=http://localhost:5000
CLAWHUB_API_KEY=your-clawhub-key

# Souls Registry (Optional)
SOULS_REGISTRY_URL=http://localhost:5000

# Channels
TELEGRAM_BOT_TOKEN=your-telegram-token
DISCORD_BOT_TOKEN=your-discord-token

# Web UI
WEB_PORT=3001

# MCP Server
MCP_PORT=3850

# Gateway
GATEWAY_PORT=18792

# ACP Server
ACP_PORT=18794

# WebSocket
WS_PORT=18796
```

---

## Troubleshooting

```bash
# Health checks (Duck Agent ports)
curl http://localhost:3850/health     # MCP
curl http://localhost:18792/health     # Gateway
curl http://localhost:18794/health     # ACP Server
curl http://localhost:18796/health     # WebSocket
curl http://localhost:3001/health      # Web UI

# View status
duck status

# Check for updates
duck update status

# Backup before changes
duck update backup
```
