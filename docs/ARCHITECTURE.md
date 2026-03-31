# 🦆 Duck Agent Architecture

> **Duck Agent v0.3.1** — Super AI Agent with KAIROS, Unified Gateway, Claude Code Tools, Multi-Agent, Voice, Web UI

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Duck Agent v0.3.1                             │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                      CLI / Shell Layer                        │   │
│  │    duck shell | duck run | duck web | duck unified | ...     │   │
│  └────────────────────────────┬─────────────────────────────────┘   │
│                               │                                      │
│  ┌────────────────────────────▼─────────────────────────────────┐   │
│  │                      Agent Core                                │   │
│  │   • Reasoning Engine (chain-of-thought)                       │   │
│  │   • Task Planner & Executor                                  │   │
│  │   • Tool Orchestrator                                        │   │
│  │   • Memory Manager                                           │   │
│  │   • Self-Improvement Loop                                    │   │
│  └────────────────────────────┬─────────────────────────────────┘   │
│                               │                                      │
│  ┌──────────────┬─────────────┼──────────────┬──────────────────┐    │
│  │   Providers  │   Memory    │    Skills    │     Channels     │    │
│  │  Manager     │   System    │    Runner    │   (Telegram/     │    │
│  │              │             │              │    Discord)      │    │
│  └──────────────┴─────────────┴──────────────┴──────────────────┘    │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │               Headless Protocol Layer                         │   │
│  │                                                              │   │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────────┐      │   │
│  │  │   MCP   │  │   ACP   │  │   WS    │  │   Gateway   │      │   │
│  │  │ Server  │  │ Client/ │  │ Manager │  │  API (REST) │      │   │
│  │  │  3848   │  │ Server  │  │  18791  │  │    18789    │      │   │
│  │  │         │  │  18790  │  │         │  │             │      │   │
│  │  └────┬────┘  └────┬────┘  └────┬────┘  └──────┬──────┘      │   │
│  │       │            │            │               │              │   │
│  └───────┼────────────┼────────────┼───────────────┼──────────────┘   │
│          │            │            │               │                  │
└──────────┼────────────┼────────────┼───────────────┼──────────────────┘
           │            │            │               │
           ▼            ▼            ▼               ▼
    ┌────────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐
    │ MCP Clients│ │ OpenClaw │ │ WS Peers │ │ OpenAI-style │
    │ (Claude,  │ │ (spawn)  │ │          │ │   Clients    │
    │ Codex...) │ │          │ │          │ │              │
    └───────────┘ └──────────┘ └──────────┘ └──────────────┘
```

---

## Protocol Stack

### Layer 1: MCP (Model Context Protocol) — Port 3848

**Full MCP 2024-11-05 spec with JSON-RPC 2.0**

```
┌─────────────────────────────────────┐
│         MCP Server (3848)           │
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

**Protocol Flow:**
1. Client sends JSON-RPC request (tools/call, tools/list, etc.)
2. Server routes to Agent Core
3. Agent executes tool, returns result
4. Support for SSE streaming and WebSocket

---

### Layer 2: ACP (Agent Client Protocol) — Port 18790

**Bidirectional protocol for spawning and controlling sessions**

```
┌─────────────────────────────────────┐
│    ACP Server ←── OpenClaw connects │
│         (18790)                     │
│                                     │
│  acp.spawn    → Spawn new session   │
│  acp.cancel   → Cancel session      │
│  acp.steer    → Steering input      │
│  acp.send     → Send message        │
│  acp.status   → Server/session info │
│  acp.sessions → List all sessions   │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│    ACP Client ←── Duck Agent spawns │
│     (external agents)               │
│                                     │
│  codex, claude, cursor, gemini      │
│  pi, openclaw, opencode             │
│                                     │
│  Fire-and-forget / persistent       │
└─────────────────────────────────────┘
```

---

### Layer 3: WebSocket Manager — Port 18791

**Bidirectional messaging for real-time communication**

```
┌─────────────────────────────────────┐
│    WebSocket Manager (18791)         │
│                                     │
│  Server Mode: Accept connections     │
│  Client Mode: Connect to peers      │
│                                     │
│  • Auto-reconnection                │
│  • Channel-based routing            │
│  • Message queuing                  │
│  • Binary/text support              │
└─────────────────────────────────────┘
```

---

### Layer 4: Gateway API — Port 18789

**OpenAI-compatible REST API**

```
┌─────────────────────────────────────┐
│    Gateway API (18789)              │
│                                     │
│  POST /v1/chat/completions          │
│  GET  /v1/models                    │
│  GET  /health                       │
│  GET  /status                       │
│                                     │
│  OpenAI-compatible request/response │
└─────────────────────────────────────┘
```

---

## Unified Server

The **Unified Server** (`duck unified`) starts all protocols simultaneously:

```typescript
const server = new UnifiedServer(agent, {
  mcpPort:       3848,    // MCP Server
  acpPort:       18790,   // ACP Server
  wsPort:        18791,   // WebSocket
  gatewayPort:   18789,   // Gateway API
  enableMCP:     true,
  enableACP:     true,
  enableWebSocket: true,
  enableGateway: true,
});
```

### Port Summary

| Port  | Protocol | Purpose                        |
|-------|----------|--------------------------------|
| 3848  | MCP      | Model Context Protocol         |
| 18789 | REST     | Gateway API (OpenAI-compatible)|
| 18790 | ACP      | Agent Client Protocol (server) |
| 18791 | WS       | Bidirectional WebSocket        |

---

## OpenClaw Compatibility Layer

Duck Agent implements the **ACP (Agent Client Protocol)** server, allowing OpenClaw to connect and spawn Duck Agent sessions as if Duck Agent were a native OpenClaw agent.

### How It Works

```
OpenClaw                              Duck Agent
────────                              ──────────
    │                                     │
    │  1. Connect to ws://localhost:18790  │
    ├────────────────────────────────────►│
    │                                     │
    │  2. acp.spawn { agent: "duck",       │
    │                  task: "fix bug" }   │
    ├────────────────────────────────────►│
    │                                     │  Agent Core
    │  3. Session created, output streams  │  executes task
    │  ◄─────────────────────────────────┤
    │                                     │
    │  4. acp.steer { instruction: "..." }│
    ├────────────────────────────────────►│
    │                                     │
    │  5. Session ends, result returned   │
    ◄─────────────────────────────────────┤
```

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

### ACP Server Features

| Feature | Value |
|---------|-------|
| Max Concurrent Sessions | 8 |
| Session Timeout | 30 minutes (configurable) |
| Protocol | JSON-RPC 2.0 over WebSocket |
| Supported Agents | `duck`, `duck-agent`, `kairos` |

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
| MiniMax | M2.7, glm-5, glm-4.7 | Fast inference, agents |
| Kimi | kimi-k2.5, kimi-k2 | Vision, coding |
| ChatGPT | gpt-5.4, gpt-5.4-mini | Premium reasoning |
| LM Studio | qwen3-vl-8b, jan-v3-4b | Local, private |
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

## Directory Structure

```
Duck Agent/
├── src/
│   ├── agent/
│   │   ├── core.ts           # Main agent
│   │   └── proactive/
│   │       └── kairos.ts     # KAIROS autonomous AI
│   ├── providers/
│   │   ├── manager.ts        # Multi-provider routing
│   │   └── browseros.ts      # BrowserOS integration
│   ├── memory/
│   │   ├── context-manager.ts
│   │   └── system.ts
│   ├── tools/
│   │   ├── registry.ts       # Tool discovery
│   │   ├── delegate.ts       # Tool execution
│   │   ├── tts.ts           # Text-to-speech
│   │   └── coding/
│   │       └── extended-tools.ts  # 60+ coding tools
│   ├── server/
│   │   ├── unified-server.ts # All protocols
│   │   └── mcp-server.ts    # MCP spec
│   ├── gateway/
│   │   ├── acp-server.ts    # ACP for OpenClaw
│   │   ├── acp-client.ts    # Spawn external agents
│   │   └── websocket-manager.ts
│   ├── cli/
│   │   └── main.ts          # CLI entry point (998 lines)
│   ├── commands/
│   │   ├── kairos.ts
│   │   ├── buddy.ts
│   │   ├── team.ts
│   │   ├── council.ts
│   │   └── cron.ts
│   ├── council/
│   │   └── deliberation-engine.ts
│   ├── multiagent/
│   │   ├── team.ts
│   │   └── coordinator.ts
│   ├── buddy/
│   │   └── sprites.ts
│   ├── integrations/
│   │   ├── desktop.ts        # ClawdCursor
│   │   └── browseros.ts
│   ├── ui/
│   │   ├── pretext-canvas/  # Generative UI
│   │   └── a2ui/            # Canvas renderer
│   └── web-server.ts        # Web UI server
├── web-ui/                   # Full web interface
├── docs/
│   ├── ARCHITECTURE.md      # This file
│   └── COMMANDS.md          # CLI reference
└── package.json
```

---

## Data Flow

### Single Task Execution

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

### MCP Request Flow

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

✅ **Production Ready** — v0.3.1 with full headless protocol support, OpenClaw compatibility, and comprehensive tooling.

See [COMMANDS.md](COMMANDS.md) for full CLI reference.
