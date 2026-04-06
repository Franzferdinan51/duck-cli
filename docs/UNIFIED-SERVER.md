# Unified Server Architecture Plan

**Date:** 2026-04-06  
**Version:** 0.1.0 (initial analysis)

---

## Current Architecture

duck-cli currently has **4 separate server entry points** across multiple files:

### Server Inventory

| Entry Point | File | Port | Protocol | Purpose |
|-------------|------|------|----------|---------|
| **Chat Agent** | `src/agent/chat-agent.ts` | 18797 | HTTP | Conversational AI, multi-provider, AI Council integration |
| **Mesh Server** | `src/daemons/mesh-server.ts` | 4000 | HTTP + WS | Agent registration, messaging, heartbeat, health dashboard |
| **Unified Server** | `src/server/unified-server.ts` | MCP:3850, ACP:18794, WS:18796, GW:18792 | Multi | MCP + ACP + WebSocket + Gateway in ONE process |
| **Telegram Bot** | `src/plugins/telegram.ts` | N/A (polling) | HTTP polling | Telegram message gateway via Long Polling |
| **MCP Server** | `src/server/mcp-server.ts` | 3850 (default) | WS (WebSocket) | Model Context Protocol tools |
| **REST Bridge** | `src/bridge/rest-bridge.ts` | (configurable) | HTTP | REST API for duck-cli tools |
| **MCP Bridge** | `src/bridge/mcp-bridge.ts` | (configurable) | HTTP | MCP protocol bridge |
| **A2A Server** | `src/a2a/server.ts` | (configurable) | HTTP | Agent-to-Agent protocol |

### What Each Server Does

#### 1. Chat Agent (`src/agent/chat-agent.ts`, 804 lines)
- **Port:** 18797 (env: `DUCK_CHAT_PORT`)
- **Protocol:** HTTP REST API
- **Role:** Conversational AI server with multi-provider support (MiniMax, LM Studio, Kimi, OpenAI, OpenRouter)
- **Features:** Chat sessions, AI Council deliberation, mesh registration (optional)
- **Standalone:** Can run without mesh (`MESH_ENABLED=false`)
- **Entry:** `duck chat-agent start`

#### 2. Mesh Server (`src/daemons/mesh-server.ts`, 740 lines)
- **Port:** 4000 (env: `MESH_PORT`)
- **Protocol:** HTTP REST + WebSocket
- **Role:** Agent Mesh communication bus — registration, messaging, heartbeat, health
- **Features:** Agent registry, inbox, broadcast, WebSocket events, health dashboard
- **Entry:** `duck meshd`

#### 3. Unified Server (`src/server/unified-server.ts`, 553 lines) ⚡ ALREADY UNIFIED
- **Ports:** MCP:3850, ACP:18794, WS:18796, Gateway:18792
- **Protocols:** MCP (WS), ACP (WS), WebSocket, Gateway (HTTP)
- **Role:** All headless protocols in ONE process
- **Components:** MCPServer + ACPClient + WebSocketManager + Gateway API
- **Entry:** `duck unified`

#### 4. Telegram Bot (`src/plugins/telegram.ts`)
- **Protocol:** HTTP Long Polling (Telegram Bot API)
- **Role:** Telegram message gateway — receives messages, sends responses
- **Features:** Send, receive, chat actions (typing), reply, topic support
- **Entry:** `duck telegram start`

#### 5. MCP Server (`src/server/mcp-server.ts`, 784 lines)
- **Port:** 3850 (env: `DUCK_MCP_PORT`)
- **Protocol:** WebSocket (STDIO also supported)
- **Role:** Exposes duck-cli tools via MCP protocol
- **Entry:** `duck mcp`
- **Note:** Integrated INTO UnifiedServer as `enableMCP`

#### 6. REST/MCP Bridges (`src/bridge/`)
- **REST Bridge:** HTTP API for tool management
- **MCP Bridge:** HTTP MCP protocol implementation
- **Note:** These are separate HTTP servers, not yet integrated into UnifiedServer

### Architecture Diagram (Current)

```
User
  │
  ├─► CLI (duck run/shell)
  ├─► Telegram ──────────────────────► Telegram Bot (separate process)
  │
  └─► duck unified ─┬─► MCP Server (ws://:3850)
                    ├─► ACP Gateway (ws://:18794)
                    ├─► WebSocket (ws://:18796)
                    └─► Gateway API (http://:18792)

duck chat-agent start ──► Chat Agent HTTP (http://:18797)
                           │
                           └─► [optional] Mesh Server (http://:4000)

duck meshd ──► Mesh Server (http://:4000) ──► WebSocket (ws://:4000/ws)
```

---

## Proposed Unified Architecture

**Goal:** ONE process that handles everything — no separate entry points.

### Unified Entry Point: `duck unified`

The `UnifiedServer` class is already built (`src/server/unified-server.ts`) but needs:

1. **Integrate Telegram Bot** into UnifiedServer
2. **Integrate Chat Agent** (or replace with Agent core)
3. **Integrate Mesh Server** as optional component
4. **Consolidate port configuration**

### Proposed Architecture

```
                         ┌─────────────────────────────────────────┐
                         │           UNIFIED SERVER                 │
                         │        (single process, one port)        │
                         │                                         │
                         │  ┌─────────────────────────────────┐    │
                         │  │         UNIFIED AGENT            │    │
                         │  │     (Agent core orchestrator)    │    │
                         │  └──────────────┬──────────────────┘    │
                         │                 │                        │
                         │  ┌──────────────▼──────────────────┐    │
                         │  │      BRIDGE MANAGER             │    │
                         │  │  (spawns protocol bridges)      │    │
                         │  └──────────────┬──────────────────┘    │
                         │                 │                        │
                         │  ┌──────────────┼──────────────────┐    │
                         │  │              │                    │    │
                         │  ▼              ▼                    ▼    │
                         │ MCP Bridge  ACP Bridge  WebSocket    REST │
                         │                Bridge   Bridge       API  │
                         │                 │         │          │    │
                         │                 ▼         ▼          ▼    │
                         │          (subagents)  (clients) (tools) │
                         └─────────────────────────────────────────┘
                                          │
                          ┌───────────────┼───────────────┐
                          │               │               │
                      Telegram          Mesh*         External
                      (polling)     (optional)       MCP/WS
                      
* Mesh = optional coordination bus
```

### Ports After Unification

| Service | Current Port | Proposed Port | Notes |
|---------|-------------|---------------|-------|
| Unified API | 18792 | 18792 | Keep as primary |
| MCP (WS) | 3850 | 3850 | Keep |
| ACP Gateway | 18794 | 18794 | Keep |
| WebSocket | 18796 | 18796 | Keep |
| Chat Agent | 18797 | **MERGED** | Replaced by unified agent |
| Mesh Server | 4000 | **OPTIONAL** | Off by default, enable via flag |
| Telegram | N/A | Built-in | No port, just polling |

### Single Entry Command

```bash
# Primary unified command
duck unified

# With all features
duck unified --telegram --mesh --mcp --ws --gateway

# Minimal (just core agent + gateway)
duck unified --minimal

# With mesh coordination
duck unified --with-mesh
```

---

## Implementation Plan

### Phase 1: Consolidate UnifiedServer (lowest risk)

**Status:** UnifiedServer already exists with MCP + ACP + WS + Gateway.

**Missing:** Chat Agent features (sessions, multi-provider, AI Council).

**Action:** Extend UnifiedServer to include Chat Agent capabilities OR integrate Chat Agent as a sub-component.

**Code changes:**
- `src/server/unified-server.ts` — add chat session support, AI Council bridge
- OR refactor `src/agent/chat-agent.ts` to use UnifiedServer internally

### Phase 2: Integrate Telegram Bot

**Action:** Add Telegram polling to UnifiedServer lifecycle.

```typescript
// In unified-server.ts
import { telegramStart } from '../plugins/telegram.js';

async startTelegram() {
  await telegramStart();
}
```

**Code changes:**
- `src/server/unified-server.ts` — add `enableTelegram` config option, start Telegram polling
- `src/plugins/telegram.ts` — export for programmatic use (already has `telegramStart()`)

### Phase 3: Integrate Mesh Server (optional)

**Action:** Add Mesh Server as optional component in UnifiedServer.

```typescript
// In unified-server.ts
if (this.config.enableMesh) {
  const { MeshServer } = await import('../daemons/mesh-server.js');
  this.meshServer = new MeshServer({ port: this.config.meshPort });
}
```

**Code changes:**
- `src/server/unified-server.ts` — add `enableMesh` config option, instantiate MeshServer
- `src/daemons/mesh-server.ts` — add programmatic class API (already exists via CLI)

### Phase 4: Deprecate Old Entry Points

After testing unified server, deprecate:
- `duck chat-agent start` → `duck unified` (chat is built-in)
- `duck meshd` → `duck unified --with-mesh`

---

## Components to Merge

| Component | Status | Merge Into | Effort |
|-----------|--------|-----------|--------|
| Chat Agent | ✅ Exists | UnifiedServer | Medium — needs session + council integration |
| Mesh Server | ✅ Exists | UnifiedServer (optional) | Low — already HTTP, just wrap |
| Telegram Bot | ✅ Exists | UnifiedServer | Low — just start polling |
| MCP Server | ✅ Integrated | UnifiedServer | Already integrated |
| REST Bridge | ⚠️ Standalone | UnifiedServer | Low — already HTTP |
| MCP Bridge | ⚠️ Standalone | UnifiedServer | Low — already HTTP |
| A2A Server | ⚠️ Standalone | UnifiedServer | Low — already HTTP |

---

## Code Changes Needed

### 1. `src/server/unified-server.ts` — Add Telegram + Mesh

```typescript
// Add to config interface
export interface UnifiedServerConfig {
  // ... existing fields ...
  enableTelegram?: boolean;
  enableMesh?: boolean;
  meshPort?: number;
}

// Add to start()
if (this.config.enableTelegram) {
  const { telegramStart } = await import('../plugins/telegram.js');
  await telegramStart();
}

// Add mesh server
if (this.config.enableMesh) {
  const { MeshServer } = await import('../daemons/mesh-server.js');
  this.meshServer = new MeshServer({ port: this.config.meshPort });
}
```

### 2. `src/plugins/telegram.ts` — Add programmatic start/stop

```typescript
export let isRunning = false;

export async function telegramStart(): Promise<void> {
  if (isRunning) return;
  isRunning = true;
  // existing polling logic...
}
```

### 3. `src/cli/main.ts` — Simplify unified command

Update the `unified` case to pass all config options:

```typescript
const server = new UnifiedServer(agent, {
  mcpPort: parseInt(process.env.DUCK_MCP_PORT || '3850'),
  acpPort: parseInt(process.env.DUCK_ACP_PORT || '18794'),
  wsPort: parseInt(process.env.DUCK_WS_PORT || '18796'),
  gatewayPort: parseInt(process.env.DUCK_GATEWAY_PORT || '18792'),
  enableMCP: process.env.ENABLE_MCP !== 'false',
  enableACP: process.env.ENABLE_ACP !== 'false',
  enableWebSocket: process.env.ENABLE_WS !== 'false',
  enableGateway: process.env.ENABLE_GW !== 'false',
  enableTelegram: process.env.ENABLE_TELEGRAM === 'true',
  enableMesh: process.env.ENABLE_MESH === 'true',
  meshPort: parseInt(process.env.MESH_PORT || '4000'),
});
```

### 4. New unified startup banner

Update the startup banner in `unified-server.ts` to show Telegram/Mesh status.

---

## Key Insight Confirmed

The "unified agent" concept is correct:

- **Chat Agent → UnifiedServer** — conversational capabilities are built-in, port 18797 absorbed
- **Bridge Agent → BridgeManager** — protocol access (MCP/ACP/WS/REST) via Bridge Manager
- **Mesh → Optional** — coordination bus off by default, enable via `--with-mesh` flag
- **Telegram → Built-in** — polling starts with unified server, no separate process

**The foundation is already 70% built.** UnifiedServer exists with all protocol bridges. The remaining 30% is:
1. Adding Telegram polling (low effort)
2. Adding Mesh as optional component (low effort)
3. Integrating Chat Agent sessions/council (medium effort)
4. Deprecating old entry points

---

## Files Summary

| File | Lines | Role |
|------|-------|------|
| `src/server/unified-server.ts` | 553 | Central hub — needs Telegram + Mesh integration |
| `src/agent/chat-agent.ts` | 804 | Chat server — needs to merge INTO unified |
| `src/daemons/mesh-server.ts` | 740 | Mesh daemon — needs optional integration |
| `src/plugins/telegram.ts` | ~350 | Telegram bot — needs programmatic API |
| `src/server/mcp-server.ts` | 784 | MCP server — already in unified ✓ |
| `src/bridge/rest-bridge.ts` | ~516 | REST bridge — standalone, consider integration |
| `src/bridge/mcp-bridge.ts` | ~473 | MCP bridge — standalone, consider integration |
| `src/a2a/server.ts` | ~239 | A2A server — standalone, consider integration |
| `src/cli/main.ts` | ~3000+ | CLI — update unified command options |

---

**Next Steps:**
1. Add Telegram polling to `UnifiedServer.start()` — ~20 lines
2. Add Mesh optional component to `UnifiedServer` — ~30 lines
3. Add `telegramStart()` programmatic export to `telegram.ts` — ~5 lines
4. Update CLI `unified` command with new flags — ~20 lines
5. Test with `duck unified --with-telegram`
6. Deprecate `duck chat-agent start` and `duck meshd`
