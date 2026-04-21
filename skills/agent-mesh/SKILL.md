# Agent Mesh API Skill

**Version:** v4.0.0
**v4.0 NEW (2026-04-21):** Presence routing, conversation threads, semantic reactions, task handoffs, group invitations, scheduled messages, decision tracking, meta-agent orchestrator, capability directory.

**Repo:** https://github.com/Franzferdinan51/agent-mesh-api
**Auto-Start:** Integrated into `~/Desktop/AgentTeam-GitHub/start-all.sh` (starts after Council Server, before WebUI)

---

## What It Is

**Agent Mesh API** is the distributed communication backbone for AgentTeams — a high-performance REST + WebSocket server that enables autonomous agents to register, discover each other, exchange messages, share files, and coordinate complex multi-agent workflows across a mesh network.

---

## Quick Start

```bash
# Auto-started via start-all.sh (recommended)
cd ~/Desktop/AgentTeam-GitHub && ./start-all.sh

# Or run manually
cd ~/Desktop/AgentTeam-GitHub/agent-mesh-api
npm install
AGENT_MESH_API_KEY="${AGENT_MESH_API_KEY:-openclaw-mesh-default-key}" PORT=4000 node server.js

# Server endpoints:
# - HTTP:  http://localhost:4000
# - WebSocket: ws://localhost:4000/ws
# - API Key: openclaw-mesh-default-key (or set AGENT_MESH_API_KEY env var)
```

---

## v3.1.0 New Features

| Feature | Description |
|---------|-------------|
| **Bearer Token Auth** | `Authorization: Bearer <token>` header support alongside `X-API-Key` |
| **Batch Messages** | Send multiple messages in one request via `/api/messages/batch` |
| **Health Dashboard** | Full mesh health metrics at `/api/mesh/health` |
| **Bulk Agent Register** | Register multiple agents at once via `/api/agents/bulk-register` |
| **Capability Index** | Query agents by capability via `/api/agents/by-capability/:capability` |
| **Agent Groups** | Create/join groups for team-based messaging |
| **Collective Memory** | Shared knowledge store across all mesh agents |

---

## Core Features (Full List)

| Feature | Description |
|---------|-------------|
| **Agent Registration** | Register/discover agents across the mesh with rich metadata |
| **Heartbeat & Health** | Track agent availability, CPU, memory, platform |
| **Direct Messaging** | Send messages between specific agents |
| **Broadcast** | Push messages to all registered agents |
| **Group Messaging** | Send messages to agent groups/teams |
| **Batch Messages** | Send multiple messages in a single request |
| **WebSocket** | Real-time event streaming (agent_joined, message_received, heartbeat, etc.) |
| **Skill/Capability Discovery** | Query agents by what they can do |
| **Collective Memory** | Shared key-value store accessible by all agents |
| **File Transfer** | Upload/download files via REST API |
| **Reticulum Phantom** | Optional P2P file transfers when Reticulum (`rns`) is installed |
| **Auto-Registration** | Agents auto-register on startup with heartbeat |
| **Bearer Auth** | Support for both `X-API-Key` header and `Authorization: Bearer` token |
| **Bulk Operations** | Register multiple agents, send batch messages |
| **Health Dashboard** | CPU, memory, agent counts, message rates |
| **Catastrophe Protocols** | Documented recovery from network failures |

---

## API Endpoints (v3.1.0)

### Authentication
All endpoints accept either:
- `X-API-Key: <token>` header
- `Authorization: Bearer <token>` header

Default key: `openclaw-mesh-default-key`

---

### Mesh Health
```bash
# Full health dashboard
curl http://localhost:4000/api/mesh/health \
  -H "X-API-Key: openclaw-mesh-default-key"
# Returns: agent counts, message rates, CPU/memory, uptime, group stats

# Mesh status overview
curl http://localhost:4000/api/mesh/status \
  -H "X-API-Key: openclaw-mesh-default-key"
```

### Agent Management
```bash
# Register single agent
curl -X POST http://localhost:4000/api/agents/register \
  -H "Content-Type: application/json" \
  -H "X-API-Key: openclaw-mesh-default-key" \
  -d '{"name": "MyAgent", "endpoint": "http://localhost:3000", "capabilities": ["messaging", "task_execution"]}'

# Bulk register multiple agents
curl -X POST http://localhost:4000/api/agents/bulk-register \
  -H "Content-Type: application/json" \
  -H "X-API-Key: openclaw-mesh-default-key" \
  -d '{"agents": [{"name": "Agent1", "endpoint": "http://localhost:3001"}, {"name": "Agent2", "endpoint": "http://localhost:3002"}]}'

# List all agents
curl http://localhost:4000/api/agents \
  -H "X-API-Key: openclaw-mesh-default-key"

# Get agent by ID
curl http://localhost:4000/api/agents/:id \
  -H "X-API-Key: openclaw-mesh-default-key"

# Query agents by capability
curl http://localhost:4000/api/agents/by-capability/coding \
  -H "X-API-Key: openclaw-mesh-default-key"

# Update agent
curl -X PUT http://localhost:4000/api/agents/:id \
  -H "Content-Type: application/json" \
  -H "X-API-Key: openclaw-mesh-default-key" \
  -d '{"status": "busy", "capabilities": ["coding", "research"]}'

# Delete agent
curl -X DELETE http://localhost:4000/api/agents/:id \
  -H "X-API-Key: openclaw-mesh-default-key"
```

### Messaging
```bash
# Send message
curl -X POST http://localhost:4000/api/messages \
  -H "Content-Type: application/json" \
  -H "X-API-Key: openclaw-mesh-default-key" \
  -d '{"fromAgentId": "agent-123", "toAgentId": "agent-456", "content": "Task complete"}'

# Send batch messages (v3.1.0)
curl -X POST http://localhost:4000/api/messages/batch \
  -H "Content-Type: application/json" \
  -H "X-API-Key: openclaw-mesh-default-key" \
  -d '{"messages": [
    {"fromAgentId": "agent-1", "toAgentId": "agent-2", "content": "Hello"},
    {"fromAgentId": "agent-1", "toAgentId": "agent-3", "content": "Hello"}
  ]}'

# Broadcast to all agents
curl -X POST http://localhost:4000/api/messages/broadcast \
  -H "Content-Type: application/json" \
  -H "X-API-Key: openclaw-mesh-default-key" \
  -d '{"fromAgentId": "agent-123", "content": "System update incoming"}'

# Get agent inbox
curl http://localhost:4000/api/agents/:id/inbox \
  -H "X-API-Key: openclaw-mesh-default-key"

# List all messages (with optional filters)
curl "http://localhost:4000/api/messages?fromAgentId=agent-123&toAgentId=agent-456" \
  -H "X-API-Key: openclaw-mesh-default-key"
```

### Agent Groups
```bash
# Create group
curl -X POST http://localhost:4000/api/groups \
  -H "Content-Type: application/json" \
  -H "X-API-Key: openclaw-mesh-default-key" \
  -d '{"name": "research-team", "description": "Research agents", "members": ["agent-1", "agent-2"]}'

# List groups
curl http://localhost:4000/api/groups \
  -H "X-API-Key: openclaw-mesh-default-key"

# Get group
curl http://localhost:4000/api/groups/:id \
  -H "X-API-Key: openclaw-mesh-default-key"

# Add member to group
curl -X POST http://localhost:4000/api/groups/:id/members \
  -H "Content-Type: application/json" \
  -H "X-API-Key: openclaw-mesh-default-key" \
  -d '{"agentId": "agent-3"}'

# Remove member
curl -X DELETE http://localhost:4000/api/groups/:id/members/agent-3 \
  -H "X-API-Key: openclaw-mesh-default-key"

# Send to group
curl -X POST http://localhost:4000/api/groups/:id/messages \
  -H "Content-Type: application/json" \
  -H "X-API-Key: openclaw-mesh-default-key" \
  -d '{"fromAgentId": "agent-1", "content": "Research complete"}'
```

### Collective Memory
```bash
# Store shared knowledge
curl -X POST http://localhost:4000/api/memory \
  -H "Content-Type: application/json" \
  -H "X-API-Key: openclaw-mesh-default-key" \
  -d '{"key": "project-status", "value": "Phase 2 complete", "ttl": 86400}'

# Read collective memory
curl http://localhost:4000/api/memory/project-status \
  -H "X-API-Key: openclaw-mesh-default-key"

# List all memory keys
curl http://localhost:4000/api/memory \
  -H "X-API-Key: openclaw-mesh-default-key"

# Delete memory key
curl -X DELETE http://localhost:4000/api/memory/project-status \
  -H "X-API-Key: openclaw-mesh-default-key"
```

### File Transfer
```bash
# Upload file
curl -X POST http://localhost:4000/api/files/upload \
  -H "Content-Type: application/json" \
  -H "X-API-Key: openclaw-mesh-default-key" \
  -d '{"filename": "report.txt", "content": "BASE64_ENCODED_DATA"}'

# Download file
curl http://localhost:4000/api/files/:id \
  -H "X-API-Key: openclaw-mesh-default-key"

# List uploaded files
curl http://localhost:4000/api/files \
  -H "X-API-Key: openclaw-mesh-default-key"
```

### Reticulum Phantom (Optional P2P Transfer)
When [Reticulum](https://github.com/markqvist/reticulum) (`rns`) is installed on the system, Agent Mesh API automatically exposes P2P file transfer endpoints via `/api/phantom/*`. These use Reticulum's native transport for peer-to-peer file sharing without going through the central API server.

```bash
# Phantom P2P endpoints (when rns is detected):
# POST /api/phantom/upload   - Announce file to P2P network
# GET  /api/phantom/download/:hash  - Retrieve file via P2P
# GET  /api/phantom/status   - Check Phantom transport status

# Check if Phantom is available
curl http://localhost:4000/api/phantom/status \
  -H "X-API-Key: openclaw-mesh-default-key"
```

---

## WebSocket Events

Connect to `ws://localhost:4000/ws` for real-time events:

```javascript
const ws = new WebSocket('ws://localhost:4000/ws?apiKey=openclaw-mesh-default-key');

ws.on('open', () => {
  ws.send(JSON.stringify({ type: 'register', agentId: 'my-agent' }));
});

ws.on('message', (data) => {
  const event = JSON.parse(data);
  switch (event.type) {
    case 'agent_joined':     console.log('New agent:', event.agent); break;
    case 'agent_left':       console.log('Agent left:', event.agentId); break;
    case 'message_received': console.log('New message:', event.message); break;
    case 'heartbeat':        console.log('Heartbeat from:', event.agentId); break;
    case 'broadcast':        console.log('Broadcast:', event.message); break;
    case 'group_message':    console.log('Group message:', event.message); break;
  }
});
```

---

## Integration with AgentTeams

```
┌──────────────────────────────────────────────────────────────┐
│                    AGENT TEAMS v2.1.0                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │ Micro-Agents│  │ Team Agents │  │ Meta-Agent  │          │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘          │
│         │                │                │                  │
│         └────────────────┼────────────────┘                  │
│                          │                                   │
│                   ┌──────▼──────┐                            │
│                   │  AGENT MESH │  ← Communication backbone  │
│                   │    API      │    + Groups + Memory       │
│                   │  (v3.1.0)   │                            │
│                   └──────┬──────┘                            │
│                          │                                   │
│         ┌────────────────┼────────────────┐                  │
│         │                │                │                  │
│    ┌────▼────┐      ┌────▼────┐      ┌────▼────┐           │
│    │ Duck CLI │      │Dashboard│      │Council  │           │
│    └─────────┘      └─────────┘      └─────────┘           │
└──────────────────────────────────────────────────────────────┘
```

---

## Auto-Start Integration

Agent Mesh API v3.1.0 is automatically started by `start-all.sh`:

1. **Startup order**: Council Server (3007) → Agent Mesh API (4000) → Hive WebUI (3131) → Council API+MCP (3001)
2. **PID file**: `/tmp/agent-teams.pids` (updated on each start)
3. **Log file**: `/tmp/mesh-api.log`
4. **API Key**: Uses `AGENT_MESH_API_KEY` env var if set, falls back to `openclaw-mesh-default-key`
5. **Stop**: `pkill -f 'council-server|webui/server|agent-api|agent-mesh-api|server.js'`

---

## Health Dashboard Response Example

```json
{
  "status": "ok",
  "version": "3.1.0",
  "uptime": 86400,
  "timestamp": 1745200000000,
  "stats": {
    "totalAgents": 12,
    "activeAgents": 9,
    "totalMessages": 1547,
    "totalGroups": 3,
    "totalMemoryKeys": 24
  },
  "system": {
    "cpu": "Normal",
    "memory": 45,
    "platform": "darwin"
  }
}
```

---

## Specs & Feature Status

| Feature | Status | Notes |
|---------|--------|-------|
| Agent Registration | ✅ v3.1.0 | Full CRUD + bulk register |
| Messaging | ✅ v3.1.0 | Direct, broadcast, batch |
| WebSocket | ✅ v3.1.0 | Full event streaming |
| Agent Groups | ✅ v3.1.0 | Create/join/manage groups |
| Collective Memory | ✅ v3.1.0 | TTL support, key-value store |
| Bearer Auth | ✅ v3.1.0 | `Authorization: Bearer` support |
| Batch Messages | ✅ v3.1.0 | Multi-message single request |
| Health Dashboard | ✅ v3.1.0 | Full metrics endpoint |
| Capability Index | ✅ v3.1.0 | Query by skill/capability |
| Bulk Register | ✅ v3.1.0 | Multi-agent registration |
| File Transfer | ✅ v3.1.0 | REST upload/download |
| Reticulum Phantom | ✅ v3.1.0 | P2P when `rns` installed |
| Message Encryption | ✅ Done | Spec: `agentmesh-encryption-spec.md` |
| Federation | ✅ Done | Spec: `agentmesh-federation-spec.md` |
| REST Webhooks | ✅ Done | Spec: `agentmesh-webhooks-spec.md` |

---

## Status

- **Integrated:** 2026-04-19
- **Updated to v3.1.0:** 2026-04-21
- **Repo:** https://github.com/Franzferdinan51/agent-mesh-api
