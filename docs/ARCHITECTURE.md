# 🦆 Duck Agent Architecture

> **Duck Agent v0.3.2** — Agent Mesh, OpenClaw-RL, 45-Agent Council, OpenClaw v2026.3.31 Compatibility

---

## System Overview

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           Duck Agent v0.3.2                                  │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │                        CLI / Shell Layer                                │  │
│  │       duck shell | duck run | duck web | duck unified | duck mesh     │  │
│  │                    duck rl | duck council | ...                        │  │
│  └───────────────────────────────┬────────────────────────────────────────┘  │
│                                  │                                           │
│  ┌──────────────────────────────▼────────────────────────────────────────┐  │
│  │                           Agent Core                                     │  │
│  │   • Reasoning Engine (chain-of-thought)                                  │  │
│  │   • Task Planner & Executor                                              │  │
│  │   • Tool Orchestrator                                                    │  │
│  │   • Memory Manager                                                       │  │
│  │   • Self-Improvement Loop (KAIROS + RL)                                 │  │
│  └───────────────────────────────┬────────────────────────────────────────┘  │
│                                  │                                           │
│  ┌──────────────┬───────────────┼──────────────┬────────────────────────┐   │
│  │   Providers  │    Memory     │    Skills    │       Channels         │   │
│  │   Manager    │    System      │    Runner    │   (Telegram/Discord)   │   │
│  └──────────────┴───────────────┴──────────────┴────────────────────────┘   │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │                    Headless Protocol Layer                              │  │
│  │                                                                          │  │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────────┐                 │  │
│  │  │   MCP   │  │   ACP   │  │   WS    │  │   Gateway   │                 │  │
│  │  │ Server  │  │ Client/ │  │ Manager │  │  API (REST) │                 │  │
│  │  │  3850   │  │ Server  │  │  18796  │  │    18792    │                 │  │
│  │  │         │  │  18794  │  │         │  │             │                 │  │
│  │  └────┬────┘  └────┬────┘  └────┬────┘  └──────┬──────┘                 │  │
│  └───────┼───────────┼────────────┼───────────────┼────────────────────────┘  │
└──────────┼───────────┼────────────┼───────────────┼────────────────────────────┘
           │           │            │               │
           ▼           ▼            ▼               ▼
    ┌───────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐
    │ MCP       │ │ OpenClaw │ │ WS Peers │ │ OpenAI-style │
    │ Clients   │ │ (spawn)  │ │          │ │   Clients    │
    └───────────┘ └──────────┘ └──────────┘ └──────────────┘
```

---

## New Module Structure (v0.3.2)

```
Duck Agent/
├── src/
│   ├── agent/                    # Core AI agent
│   │   ├── core.ts               # Main agent loop
│   │   └── proactive/
│   │       └── kairos.ts         # KAIROS autonomous AI
│   │
│   ├── mesh/                     # 🌐 Agent Mesh (NEW)
│   │   ├── client.ts             # Mesh client (register, list, send)
│   │   ├── inbox.ts              # Message inbox
│   │   ├── capabilities.ts       # Capability registry
│   │   └── catastrophe.ts        # Catastrophe event tracker
│   │
│   ├── rl/                       # 🧪 OpenClaw-RL (NEW)
│   │   ├── client.ts             # RL client
│   │   ├── trainer.ts            # Background trainer
│   │   ├── prm.ts                # Process Reward Model
│   │   └── stats.ts              # Training statistics
│   │
│   ├── council/                  # 🏛️ AI Council (45 councilors)
│   │   ├── deliberation-engine.ts # Council orchestrator
│   │   ├── councilors.ts         # 45 councilor definitions
│   │   ├── voting.ts             # Voting logic
│   │   ├── modes/
│   │   │   ├── legislative.ts    # Debate & vote
│   │   │   ├── research.ts        # Deep investigation
│   │   │   ├── swarm.ts           # Parallel coding
│   │   │   └── predict.ts         # Forecasting
│   │   └── lmstudio.ts           # LM Studio integration
│   │
│   ├── buddy/                    # Buddy companion
│   │   └── sprites.ts
│   │
│   ├── multiagent/               # Team coordination
│   │   ├── team.ts
│   │   └── coordinator.ts
│   │
│   ├── cron/                     # Cron scheduler
│   │
│   ├── providers/                # Multi-provider AI
│   │   ├── manager.ts
│   │   ├── minimax.ts
│   │   ├── kimi.ts
│   │   ├── chatgpt.ts
│   │   ├── lmstudio.ts
│   │   └── codex.ts
│   │
│   ├── tools/                    # Tool registry & execution
│   │   ├── registry.ts
│   │   ├── delegate.ts
│   │   ├── tts.ts
│   │   └── coding/
│   │       └── extended-tools.ts
│   │
│   ├── server/                   # MCP + Unified servers
│   │   ├── unified-server.ts
│   │   └── mcp-server.ts
│   │
│   ├── gateway/                  # ACP + WebSocket
│   │   ├── acp-server.ts         # OpenClaw connects TO us
│   │   ├── acp-client.ts         # We spawn external agents
│   │   └── websocket-manager.ts
│   │
│   ├── memory/                   # Context manager
│   │
│   ├── channels/                 # Telegram, Discord
│   │
│   ├── commands/                 # CLI commands
│   │   ├── mesh.ts               # duck mesh commands
│   │   ├── rl.ts                 # duck rl commands
│   │   ├── council.ts            # duck council commands
│   │   ├── kairos.ts
│   │   ├── buddy.ts
│   │   ├── team.ts
│   │   └── cron.ts
│   │
│   ├── security/                 # SSRF, credentials
│   │
│   ├── prompts/                  # System prompts
│   │
│   ├── compat/                   # 🔧 OpenClaw v2026.3.31 compat (NEW)
│   │   ├── v2026_3_31.ts         # Version-specific shims
│   │   ├── protocol.ts           # Protocol compatibility
│   │   └── types.ts              # Type adapters
│   │
│   ├── ui/                       # UI layer
│   │   ├── pretext-canvas/       # Generative UI
│   │   ├── a2ui/                 # Canvas renderer
│   │   └── desktop/              # 🖥️ Desktop UI (v0.4.0)
│   │       ├── main.ts           # Desktop entry point
│   │       ├── window.ts         # Window management
│   │       ├── tray.ts           # System tray
│   │       ├── dashboard.ts      # Real-time stats
│   │       ├── chat.ts           # Chat panel
│   │       ├── mesh-view.ts      # Mesh visualizer
│   │       └── council-panel.ts  # Council deliberation
│   │
│   └── web-server.ts             # Web UI server
│
├── web-ui/                        # Full web interface (SvelteKit)
├── docs/
│   ├── ARCHITECTURE.md
│   ├── COMMANDS.md
│   ├── UPDATES.md
│   └── DESKTOP-UI.md             # Desktop UI preview
└── package.json
```

---

## Protocol Stack

### Layer 1: MCP (Model Context Protocol) — Port 3850

Full MCP 2024-11-05 spec with JSON-RPC 2.0.

```
┌─────────────────────────────────────┐
│         MCP Server (3850)           │
│                                     │
│  POST /mcp         JSON-RPC 2.0     │
│  GET  /mcp/sse     SSE streams      │
│  POST /mcp/stream  Streaming HTTP   │
│  WS   /ws         WebSocket         │
│  GET  /health     Health check      │
│  GET  /tools      Tool list         │
│  GET  /capabilities Server caps     │
└─────────────────────────────────────┘
```

---

### Layer 2: ACP (Agent Client Protocol) — Port 18794

**Two modes: Server and Client**

```
┌─────────────────────────────────────┐
│    ACP Server ←── OpenClaw connects │
│         (18794)                     │
│                                     │
│  acp.spawn    → Spawn new session   │
│  acp.cancel   → Cancel session      │
│  acp.steer    → Steering input      │
│  acp.send     → Send message       │
│  acp.status   → Server/session info │
│  acp.sessions → List all sessions  │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│    ACP Client ←── Duck Agent spawns │
│     (external agents)               │
│                                     │
│  codex, claude, cursor, gemini       │
│  pi, openclaw, opencode             │
└─────────────────────────────────────┘
```

---

### Layer 3: WebSocket Manager — Port 18796

Bidirectional messaging for real-time communication.

---

### Layer 4: Gateway API — Port 18792

OpenAI-compatible REST API.

---

### Port Summary

| Port  | Protocol | Purpose                        |
|-------|----------|--------------------------------|
| 3850  | MCP      | Model Context Protocol         |
| 18792 | REST     | Gateway API (OpenAI-compatible)|
| 18794 | ACP      | Agent Client Protocol (server) |
| 18796 | WS       | Bidirectional WebSocket        |
| 4000  | HTTP     | Agent Mesh Network             |
| 30000 | HTTP     | OpenClaw-RL Server             |

---

## OpenClaw v2026.3.31 Compatibility Layer

Duck Agent implements a dedicated **compat layer** (`src/compat/`) to maintain compatibility with OpenClaw v2026.3.31 without breaking changes.

### Compatibility Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Duck Agent Core                           │
│                                                                 │
│  ┌─────────────────┐    ┌─────────────────┐    ┌────────────┐  │
│  │  Duck Native    │    │  compat/         │    │  OpenClaw  │  │
│  │  Features       │◄──►│  v2026_3_31/     │◄──►│  Plugins   │  │
│  │                 │    │                 │    │            │  │
│  │  • KAIROS       │    │  • type-adapters │    │  • Skills  │  │
│  │  • Buddy        │    │  • protocol-shims│    │  • Gateway │  │
│  │  • Mesh         │    │  • feature-gates │    │  • Channels│  │
│  │  • RL           │    │  • version-detect│    │            │  │
│  │  • Council(45) │    │                 │    │            │  │
│  └─────────────────┘    └────────┬────────┘    └─────┬──────┘  │
│                                 │                   │          │
│                        ┌────────▼────────┐   ┌───────▼──────┐    │
│                        │  OpenClaw       │   │  OpenClaw   │    │
│                        │  Gateway        │◄──│  MCP        │    │
│                        │  (port 18792)   │   │  (port 3850)│    │
│                        └─────────────────┘   └─────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

### Compat Layer Components

| File | Purpose |
|------|---------|
| `compat/v2026_3_31.ts` | Main compatibility module, feature flags |
| `compat/protocol.ts` | Protocol-level adapters (WS format, JSON-RPC variants) |
| `compat/types.ts` | Type adapters between Duck and OpenClaw type systems |
| `compat/gateway-shim.ts` | OpenClaw Gateway API compatibility |
| `compat/skill-adapters.ts` | Skill format translation |

### OpenClaw Configuration

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

---

## Data Flow Diagrams

### 1. Single Task Execution

```
User: "Fix the auth bug"
         │
         ▼
┌─────────────────┐
│  CLI (main.ts)  │
│  duck run "..." │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Agent Core     │
│  chat(task)     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Reasoner       │
│  Chain-of-thought│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Tool Executor  │
│  registry.call()│
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌───────┐ ┌────────┐
│ Files │ │ Shell  │
│  API  │ │  CLI   │
└───┬───┘ └───┬────┘
    │         │
    └────┬────┘
         │
         ▼
┌─────────────────┐
│  Response       │
│  assembled      │
└─────────────────┘
```

### 2. MCP Request Flow

```
MCP Client                MCP Server              Agent Core
──────────                ──────────              ──────────
    │                         │                       │
    │ POST /mcp               │                       │
    │ {method: "tools/call",  │                       │
    │  params: {name, args}}  │                       │
    ├────────────────────────►                       │
    │                         │                       │
    │                         │ agent.execute()       │
    │                         ├──────────────────────►
    │                         │                       │
    │                         │        (executes)     │
    │                         │                       │
    │  JSON-RPC response      │     result            │
    │ ◄────────────────────────┤◄─────────────────────┘
```

### 3. Agent Mesh Message Flow

```
Agent A                     Mesh Server                Agent B
───────                     ───────────                ────────
    │                            │                          │
    │ POST /register             │                          │
    │ {name: "Duck Agent",        │                          │
    │  capabilities: [...]}       │                          │
    ├────────────────────────────►                          │
    │                            │                          │
    │                            │ POST /register            │
    │                            │ {name: "Agent Smith",     │
    │                            │  capabilities: [...]}   │
    │                            ├──────────────────────────►
    │                            │                          │
    │ GET /agents                │                          │
    ├────────────────────────────►                          │
    │  [list of all agents]       │                          │
    │ ◄───────────────────────────┤                          │
    │                            │                          │
    │ POST /send                  │                          │
    │ {to: "smith-xyz",           │                          │
    │  message: "Check tent?"}   │                          │
    ├────────────────────────────►                          │
    │                            │                          │
    │                            │ POST /send               │
    │                            │ {to: "duck-abc",         │
    │                            │  message: "Done!"}       │
    │                            ├──────────────────────────►
    │                            │                          │
    │ GET /inbox                 │                          │
    ├────────────────────────────►                          │
    │  [{from: "smith", msg: "Done!"}]                       │
    │ ◄───────────────────────────┤                          │
```

### 4. OpenClaw-RL Training Flow

```
User Message
     │
     ▼
┌─────────────────────┐
│  Duck Agent Core    │
│                     │
│  session_id: "abc"  │
│  turn_type: "main" │◄── Sub-turns (meta) are SKIPPED
│  user_message: "..."│
└──────────┬──────────┘
           │ (async, no latency)
           ▼
┌─────────────────────┐
│  RL Client          │
│  POST /train        │
│  {session, turn,    │
│   user_msg, resp}   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  RL Server         │
│  (qwen3_4b or      │
│   other model)     │
│                     │
│  ┌────────────────┐ │
│  │ PRM (Process   │ │
│  │ Reward Model)  │ │
│  │ Scores:        │ │
│  │ +1 (good)      │ │
│  │ -1 (bad)       │ │
│  │  0 (neutral)   │ │
│  └───────┬────────┘ │
│          │          │
│  ┌───────▼────────┐ │
│  │ Policy Update  │ │
│  │ (GRPO or OPD)  │ │
│  └───────┬────────┘ │
└──────────┼──────────┘
           │
           ▼
┌─────────────────────┐
│  Training Stats     │
│  (Sessions: 42,     │
│   Avg Reward: 0.73)│
└─────────────────────┘
```

### 5. AI Council Deliberation Flow

```
User: "Should we refactor auth?"
         │
         ▼
┌─────────────────────┐
│  Council Engine     │
│  Mode: Legislative  │
└──────────┬──────────┘
           │
    ┌──────┼──────┬────────┬────────┐
    │      │      │        │        │
    ▼      ▼      ▼        ▼        ▼
┌──────┐ ┌──────┐ ┌────┐ ┌──────┐ ┌──────┐
│Techno-│ │Ethic-│ │Skeptic│ │Prag- │ │Senti-│
│crat   │ │ist   │ │     │ │matist│ │nel   │
│       │ │      │ │     │ │      │ │      │
│"Yes,  │ │"Check│ │"Risky│ │"Cost:│ │"Check│
│ benefits│ │privacy"│ │— avoid"│ │6 weeks"│ │security"│
└───┬───┘ └──┬───┘ └──┬──┘ └──┬───┘ └──┬───┘
    │        │        │       │        │
    └────────┴────────┼───────┴────────┘
                      │
                      ▼
             ┌─────────────────┐
             │  Vote Tally     │
             │  Approve: 3     │
             │  Reject: 1      │
             │  Abstain: 1     │
             └────────┬────────┘
                      │
                      ▼
             ┌─────────────────┐
             │  Recommendation│
             │  "YES — with    │
             │   security      │
             │   review first" │
             └─────────────────┘
```

### 6. Desktop UI (v0.4.0) Data Flow

```
┌──────────────────────────────────────────────────────────────────┐
│                    Desktop UI (src/ui/desktop/)                   │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │   Window     │  │   Tray       │  │   Dashboard          │  │
│  │   Manager    │  │   (menu)     │  │   (realtime stats)   │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘  │
│         │                  │                     │               │
│         └──────────────────┼────────────────────┘               │
│                            │                                    │
│         ┌───────────────────▼───────────────────┐               │
│         │            IPC Bridge                   │               │
│         │   (main process ↔ renderer process)    │               │
│         └───────────────────┬───────────────────┘               │
│                             │                                    │
│  ┌──────────────────────────▼──────────────────────────────┐   │
│  │                   Renderer Process                         │   │
│  │                                                          │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │   │
│  │  │   Chat      │  │   Mesh      │  │   Council       │  │   │
│  │  │   Panel     │  │   Visualizer│  │   Panel         │  │   │
│  │  │             │  │             │  │                 │  │   │
│  │  │  messages   │  │  agent map  │  │  deliberation   │  │   │
│  │  │  input      │  │  status     │  │  voting         │  │   │
│  │  └─────────────┘  └─────────────┘  └─────────────────┘  │   │
│  │                                                          │   │
│  └──────────────────────────┬──────────────────────────────┘   │
│                             │                                    │
│         ┌───────────────────▼───────────────────┐               │
│         │         Duck Agent Core (Local)       │               │
│         │                                          │               │
│         │  ┌──────────┐  ┌──────────┐  ┌───────┐ │               │
│         │  │ Mesh     │  │ RL       │  │Council│ │               │
│         │  │ Client   │  │ Client   │  │Engine │ │               │
│         │  └──────────┘  └──────────┘  └───────┘ │               │
│         │                                          │               │
│         └──────────────────────────────────────────┘               │
└──────────────────────────────────────────────────────────────────┘
```

---

## Core Components

### Agent Core (`src/agent/`)

| File | Purpose |
|------|---------|
| `core.ts` | Main agent loop, chat, think, remember, recall |
| `proactive/kairos.ts` | KAIROS autonomous system |
| `cost-tracker.ts` | Token/cost tracking |

### Providers (`src/providers/`)

Multi-provider AI with automatic fallback:

| Provider | Models | Use Case |
|----------|--------|----------|
| MiniMax | M2.7, glm-5, glm-4.7, qwen3.5-plus | Fast inference, agents |
| Kimi | kimi-k2.5, kimi-k2 | Vision, coding |
| ChatGPT | gpt-5.4, gpt-5.4-mini | Premium reasoning |
| LM Studio | qwen3-vl-8b, jan-v3-4b, glm-4.7-flash, +13 | Local, private |
| OpenAI Codex | gpt-5.3-codex | Legacy coding agent |

### Memory System (`src/memory/`)

```
Identity Files (SOUL.md, IDENTITY.md)
       ↓
 Config Files (AGENTS.md, TOOLS.md, KANBAN.md)
       ↓
 Session Memory (conversation context)
       ↓
 Learned Patterns (from interactions)
```

### Tools (`src/tools/`)

| Category | Tools |
|----------|-------|
| **Files** | read, write, edit, glob, copy, move, delete |
| **Shell** | bash, powershell, cmd |
| **Search** | grep, find, findstr |
| **Code** | lsp, diagnostics, eslint, typescript |
| **Desktop** | open, click, type, screenshot |
| **Browser** | navigate, click, screenshot (BrowserOS) |
| **Agent** | spawn, cancel, steer, send |

### Server Layer (`src/server/` + `src/gateway/`)

| Server | Purpose |
|--------|---------|
| `unified-server.ts` | All protocols in one |
| `mcp-server.ts` | MCP 2024-11-05 spec |
| `acp-server.ts` | ACP server for OpenClaw |
| `websocket-manager.ts` | Bidirectional WS |

---

## Security

| Module | Purpose |
|--------|---------|
| `ssrf.ts` | Block private IPs, DNS rebinding |
| `credential-sanitizer.ts` | Prevent API key leaks |
| `state-manager.ts` | Encrypted persistent state |
| `network-policies.ts` | YAML-based access control |

---

## Status

✅ **Production Ready** — v0.3.2 with Agent Mesh networking, OpenClaw-RL self-improvement, 45-agent AI Council, full headless protocol support, and OpenClaw v2026.3.31 compatibility.

See [COMMANDS.md](COMMANDS.md) for full CLI reference.
See [DESKTOP-UI.md](DESKTOP-UI.md) for the v0.4.0 Desktop UI preview.
