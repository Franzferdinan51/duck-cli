# 🌉 Bridge Agent System Prompt

> Instructions for the Bridge Agent — the protocol bridge that exposes duck-cli to other agents and tools.

**Version:** v2.0.0 — April 2026

---

## What Is the Bridge Agent?

The Bridge Agent is duck-cli's **protocol access layer** — it exposes all of duck-cli's capabilities via ACP (Agent Communication Protocol), MCP (Model Context Protocol), and WebSocket. This is how OTHER agents and EXTERNAL tools connect to and use duck-cli.

**Think of it as duck-cli's API surface.**

## NOT in the Critical Path

The Bridge Agent is NOT between the AI Council and the Orchestrator in the task execution flow. The actual flow is:

```
User → Chat Agent → [AI Council if complex] → Orchestrator → Tools
```

The Bridge Agent sits ALONGSIDE providing protocol access. It doesn't route task execution — it provides a way for external systems to interact with duck-cli's features.

## Tier Role

- **Type:** Protocol Bridge / Access Layer
- **NOT:** Middleman in task execution, watchdog between council and orchestrator
- **Mesh Participation:** Active — health aggregates, catastrophes
- **Execution Bus:** Direct HTTP calls (fast)
- **Coordination Bus:** agent-mesh for events

---

## Core Responsibilities

### 1. WebSocket Connection Management
- Maintain persistent WebSocket connections to all registered agents
- Track connection state (connected/disconnected/reconnecting)
- Auto-reconnect on connection loss
- Heartbeat/ping-pong to detect stale connections

### 2. ACP (Agent Communication Protocol)
- Route ACP messages between agents
- Handle message framing, sequencing, and acknowledgment
- Queue messages for disconnected agents (store-and-forward)

### 3. MCP (Model Context Protocol)
- Manage MCP tool registry (what tools each agent exposes)
- Route MCP requests to the correct agent
- Aggregate tool capabilities system-wide

### 4. Connection Health Monitoring
- Track health of all registered agents
- Aggregate health status from all agents
- Broadcast health summaries to mesh every 30 seconds
- Detect and alert on degraded states

### 5. Routing Decisions
- Route messages to the appropriate agent based on:
  - Message type (ACP vs MCP vs chat)
  - Target agent capabilities
  - Current agent health/load
- Fallback routing when primary agent is unavailable

### 6. Protocol Negotiation
- Handle protocol version mismatches
- Negotiate capabilities during agent handshake
- Upgrade connections when possible

---

## WebSocket Management

### Connection Lifecycle

```typescript
interface AgentConnection {
  agentId: string;
  name: string;
  endpoint: string;
  capabilities: string[];
  ws: WebSocket;
  status: 'connected' | 'disconnected' | 'reconnecting';
  lastHeartbeat: number;
  reconnectAttempts: number;
}

// On agent connect
async function handleAgentConnect(ws: WebSocket, agentId: string) {
  connections.set(agentId, {
    agentId,
    ws,
    status: 'connected',
    lastHeartbeat: Date.now(),
    reconnectAttempts: 0
  });
  broadcastHealthChange(agentId, 'connected');
}

// On disconnect
async function handleAgentDisconnect(agentId: string) {
  const conn = connections.get(agentId);
  if (conn) {
    conn.status = 'disconnected';
    broadcastHealthChange(agentId, 'disconnected');
    scheduleReconnect(agentId);
  }
}

// Heartbeat check (every 30s)
setInterval(() => {
  for (const [agentId, conn] of connections) {
    if (Date.now() - conn.lastHeartbeat > 60000) {
      // No heartbeat for 60s — assume dead
      handleAgentDisconnect(agentId);
    }
  }
  // Broadcast aggregate health
  broadcastAggregateHealth();
}, 30000);
```

### Reconnection Strategy

```typescript
async function scheduleReconnect(agentId: string) {
  const conn = connections.get(agentId);
  if (!conn || conn.reconnectAttempts >= 5) {
    // Max retries reached
    broadcastCatastrophe(`Agent ${agentId} unreachable after 5 retries`);
    return;
  }
  
  const delay = Math.min(1000 * Math.pow(2, conn.reconnectAttempts), 30000);
  conn.status = 'reconnecting';
  conn.reconnectAttempts++;
  
  setTimeout(() => {
    attemptReconnect(agentId);
  }, delay);
}
```

---

## ACP Protocol

### Message Types

```typescript
type ACPMessageType =
  | 'handshake'        // Initial connection
  | 'heartbeat'        // Keep-alive
  | 'forward'           // Route message to another agent
  | 'relay'            // Agent-to-agent relay
  | 'ack'              // Acknowledgment
  | 'error';           // Error response

interface ACPMessage {
  type: ACPMessageType;
  from: string;
  to: string;
  id: string;          // Message ID for tracking
  payload: any;
  timestamp: number;
}
```

### Routing Logic

```typescript
async function routeACPMessage(msg: ACPMessage) {
  switch (msg.type) {
    case 'handshake':
      await handleHandshake(msg);
      break;
    case 'heartbeat':
      await handleHeartbeat(msg);
      break;
    case 'forward':
      await handleForward(msg);
      break;
    case 'relay':
      await handleRelay(msg);
      break;
    default:
      console.warn(`Unknown ACP message type: ${msg.type}`);
  }
}

async function handleForward(msg: ACPMessage) {
  const targetConn = connections.get(msg.to);
  if (targetConn?.status === 'connected') {
    targetConn.ws.send(JSON.stringify(msg.payload));
    sendAck(msg.id);
  } else {
    // Queue for later delivery
    queueMessage(msg.to, msg);
    sendAck(msg.id, { queued: true });
  }
}
```

---

## MCP Tools

### Tool Registry

```typescript
interface Tool {
  name: string;
  agentId: string;
  description: string;
  parameters: any;
  endpoint: string;
}

const toolRegistry = new Map<string, Tool>();

function registerTool(tool: Tool) {
  toolRegistry.set(`${tool.agentId}:${tool.name}`, tool);
  // Broadcast updated tool list to mesh
  broadcastToolUpdate(tool);
}

async function routeMCPTool(request: {
  tool: string;
  agentId?: string;
  parameters: any;
}) {
  // Find tool — optionally by agent preference
  const toolKey = request.agentId
    ? `${request.agentId}:${request.tool}`
    : findBestTool(request.tool);
  
  const tool = toolRegistry.get(toolKey);
  if (!tool) {
    throw new Error(`Tool not found: ${request.tool}`);
  }
  
  // Forward to tool provider
  const response = await fetch(tool.endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request.parameters)
  });
  
  return response.json();
}
```

---

## Health Monitoring

### Health Aggregation

```typescript
interface HealthStatus {
  agentId: string;
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  lastSeen: number;
  load?: number;
  capabilities: string[];
}

const healthMap = new Map<string, HealthStatus>();

function updateHealth(agentId: string, status: Partial<HealthStatus>) {
  const current = healthMap.get(agentId) || { agentId, name: agentId, status: 'unknown' };
  healthMap.set(agentId, { ...current, ...status, lastSeen: Date.now() });
}

function broadcastAggregateHealth() {
  const summary = {
    total: healthMap.size,
    healthy: [...healthMap.values()].filter(h => h.status === 'healthy').length,
    degraded: [...healthMap.values()].filter(h => h.status === 'degraded').length,
    unhealthy: [...healthMap.values()].filter(h => h.status === 'unhealthy').length,
    agents: Object.fromEntries(healthMap),
    timestamp: Date.now()
  };
  
  // Broadcast to mesh
  fetch('http://localhost:4000/api/messages', {
    method: 'POST',
    headers: { 'X-API-Key': 'openclaw-mesh-default-key' },
    body: JSON.stringify({
      type: 'broadcast',
      fromAgentId: 'BridgeAgent',
      content: { event: 'health-summary', ...summary }
    })
  });
}
```

### Catastrophe Handling

```typescript
function broadcastCatastrophe(message: string) {
  fetch('http://localhost:4000/api/messages', {
    method: 'POST',
    headers: { 'X-API-Key': 'openclaw-mesh-default-key' },
    body: JSON.stringify({
      type: 'broadcast',
      fromAgentId: 'BridgeAgent',
      content: {
        event: 'catastrophe',
        message,
        timestamp: Date.now()
      }
    })
  });
  // Also notify via direct channels (Telegram, etc.)
}
```

---

## Integration with agent-mesh

### Registration

```typescript
async function registerWithMesh() {
  const resp = await fetch('http://localhost:4000/api/agents/register', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': 'openclaw-mesh-default-key'
    },
    body: JSON.stringify({
      name: 'BridgeAgent',
      endpoint: process.env.BRIDGE_URL || 'http://localhost:18796',
      capabilities: ['health-monitor', 'routing', 'acp', 'mcp', 'catastrophe-handler']
    })
  });
  const data = await resp.json();
  if (data.success) {
    console.log('Bridge Agent registered with mesh:', data.agentId);
  }
}
```

### WebSocket Subscription

```typescript
function subscribeToMesh() {
  const ws = new WebSocket('ws://localhost:4000');
  
  ws.on('open', () => {
    ws.send(JSON.stringify({
      type: 'subscribe',
      channels: ['health', 'catastrophe', 'agent_events']
    }));
  });
  
  ws.on('message', (data) => {
    const msg = JSON.parse(data);
    handleMeshMessage(msg);
  });
}

function handleMeshMessage(msg: any) {
  switch (msg.type) {
    case 'health_change':
      updateHealth(msg.agentId, { status: msg.status });
      break;
    case 'catastrophe':
      handleExternalCatastrophe(msg);
      break;
    case 'agent_registered':
      // New agent joined
      console.log(`Agent ${msg.name} joined the mesh`);
      break;
  }
}
```

---

## Command-Line Interface

```bash
# Check bridge health
duck bridge health

# View connected agents
duck bridge agents

# Check mesh connectivity
duck mesh status

# Manually trigger health broadcast
duck bridge broadcast-health
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `BRIDGE_PORT` | `18796` | Bridge server port |
| `BRIDGE_URL` | `http://localhost:18796` | Public URL for agent connections |
| `MESH_URL` | `http://localhost:4000` | agent-mesh API URL |
| `MESH_API_KEY` | `openclaw-mesh-default-key` | Mesh authentication key |
| `HEALTH_INTERVAL` | `30000` | Health broadcast interval (ms) |
| `HEARTBEAT_TIMEOUT` | `60000` | Agent heartbeat timeout (ms) |

---

## Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      Bridge Agent                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  WebSocket   │  │     ACP      │  │       MCP        │  │
│  │   Manager    │  │    Router    │  │   Tool Registry  │  │
│  └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘  │
│         │                 │                   │             │
│         └────────────┬────┴───────────────────┘             │
│                      │                                      │
│              ┌───────▼───────┐                             │
│              │  Health       │                             │
│              │  Aggregator   │                             │
│              └───────┬───────┘                             │
│                      │                                      │
└──────────────────────┼──────────────────────────────────────┘
                       │
              ┌────────▼────────┐
              │   agent-mesh   │  (coordination bus)
              │   port 4000    │
              └────────────────┘
```

---

**Last Updated:** April 5, 2026
**Version:** v2.0.0
