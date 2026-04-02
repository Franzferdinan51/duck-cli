/**
 * 🦆 Duck Agent - Mesh Server Daemon
 * Built-in Agent Mesh API server — no external dependency
 * 
 * Provides: Agent registration, messaging, WebSocket events, heartbeat, health
 * Port: 4000 (configurable via MESH_PORT env)
 * 
 * Usage:
 *   duck meshd              # Start server on port 4000
 *   duck meshd --port 5000  # Custom port
 * 
 * API Endpoints:
 *   POST /api/agents/register    Register agent
 *   GET  /api/agents            List all agents
 *   GET  /api/agents/:id         Get agent details
 *   POST /api/agents/:id/heartbeat  Heartbeat
 *   POST /api/messages           Send message
 *   GET  /api/messages/:agentId  Get messages for agent
 *   GET  /api/inbox/:agentId     Get agent inbox (unread)
 *   POST /api/broadcast          Broadcast to all
 *   GET  /api/health/dashboard   Health dashboard
 *   WS   /ws                     WebSocket for real-time events
 */

import express, { Request, Response } from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import cors from 'cors';

// ============ Config ============
const MESH_PORT = parseInt(process.env.MESH_PORT || process.env.PORT || '4000');
const MESH_HOST = process.env.MESH_HOST || '0.0.0.0';
const API_KEY = process.env.MESH_API_KEY || process.env.AGENT_MESH_API_KEY || 'openclaw-mesh-default-key';
const DATA_DIR = join(process.env.HOME || '/tmp', '.duckagent', 'mesh');
const DB_PATH = join(DATA_DIR, 'mesh.db');

// Ensure data dir exists
if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
}

// ============ In-Memory Store (no SQLite needed for basic version) ============
interface Agent {
  id: string;
  name: string;
  endpoint: string;
  capabilities: string[];
  status: 'online' | 'offline' | 'degraded';
  lastSeen: number;
  version?: string;
  registeredAt: number;
}

interface Message {
  id: string;
  fromAgentId: string;
  fromName: string;
  toAgentId: string;
  toName: string;
  content: string;
  timestamp: number;
  read: boolean;
  type: 'direct' | 'broadcast';
}

interface BroadcastEvent {
  type: string;
  data?: any;
  agent?: Partial<Agent>;
  message?: Message;
  timestamp: number;
}

const agents: Map<string, Agent> = new Map();
const messages: Message[] = [];
const wsClients: Map<string, WebSocket> = new Map(); // agentId -> WS

// ============ Express App ============
const app = express();
app.use(cors());
app.use(express.json());

// Optional: serve embedded web UI
try {
  const webuiDist = join(DATA_DIR, '..', 'mesh-webui', 'dist');
  if (existsSync(webuiDist)) {
    app.use(express.static(webuiDist));
  }
} catch (e) {
  // ignore
}

// ============ Auth Middleware ============
function requireApiKey(req: Request, res: Response, next: Function) {
  const key = req.headers['x-api-key'] as string || 
               req.query['apiKey'] as string ||
               (req.headers['authorization'] as string)?.replace('Bearer ', '');
  
  if (!key || key.trim() !== API_KEY) {
    return res.status(401).json({ 
      error: 'Invalid or missing API key',
      expected: API_KEY.substring(0, 3) + '...'
    });
  }
  next();
}

// ============ Helpers ============
function broadcast(event: BroadcastEvent) {
  const payload = JSON.stringify(event);
  for (const ws of wsClients.values()) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  }
}

function saveMessage(msg: Message) {
  messages.push(msg);
  // Keep max 1000 messages in memory
  if (messages.length > 1000) {
    messages.splice(0, messages.length - 1000);
  }
}

function getAgent(id: string): Agent | undefined {
  return agents.get(id);
}

function findAgentIdByName(name: string): string | undefined {
  for (const [id, agent] of agents) {
    if (agent.name.toLowerCase() === name.toLowerCase() ||
        agent.name.toLowerCase().includes(name.toLowerCase())) {
      return id;
    }
  }
  return undefined;
}

function getHealthyCounts() {
  const now = Date.now();
  let healthy = 0, degraded = 0, unhealthy = 0, offline = 0;
  
  for (const agent of agents.values()) {
    const stale = now - agent.lastSeen > 60000; // 60s
    if (!stale) {
      if (agent.status === 'degraded') degraded++;
      else healthy++;
    } else {
      offline++;
    }
  }
  
  return { healthy, degraded, unhealthy, offline, totalAgents: agents.size, criticalEvents: 0 };
}

// ============ Routes ============

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'duck-meshd', version: '1.0.0', port: MESH_PORT });
});

// Register agent (POST /api/agents/register)
app.post('/api/agents/register', requireApiKey, async (req: Request, res: Response) => {
  try {
    const { name, endpoint, capabilities, version } = req.body as {
      name?: string;
      endpoint?: string;
      capabilities?: string[];
      version?: string;
    };

    if (!name) {
      return res.status(400).json({ error: 'name is required' });
    }

    // Check existing (name-based identity)
    const existing = Array.from(agents.values()).find(a => a.name === name);
    const now = Date.now();

    if (existing) {
      // Re-register — preserve ID
      existing.endpoint = endpoint || existing.endpoint;
      existing.capabilities = capabilities || existing.capabilities;
      existing.lastSeen = now;
      existing.status = 'online';
      existing.version = version || existing.version;

      // Re-connect WebSocket if provided
      if (req.headers['x-websocket-id'] as string) {
        wsClients.set(existing.id, wsClients.get(req.headers['x-websocket-id'] as string) || wsClients.values().next().value!);
      }

      console.log(`[Mesh] Agent "${name}" re-registered (ID: ${existing.id})`);

      return res.json({
        success: true,
        agentId: existing.id,
        message: 'Agent re-registered with existing ID',
        existed: true
      });
    }

    // New registration
    const id = uuidv4();
    const agent: Agent = {
      id,
      name,
      endpoint: endpoint || '',
      capabilities: capabilities || [],
      status: 'online',
      lastSeen: now,
      version,
      registeredAt: now
    };

    agents.set(id, agent);

    // Broadcast new agent
    broadcast({ type: 'agent_joined', agent, timestamp: now });

    console.log(`[Mesh] New agent "${name}" registered (ID: ${id})`);

    res.json({
      success: true,
      agentId: id,
      message: 'Agent registered successfully',
      existed: false
    });
  } catch (error: any) {
    console.error('[Mesh] Register error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// List all agents (GET /api/agents)
app.get('/api/agents', requireApiKey, async (req: Request, res: Response) => {
  try {
    const capability = req.query['capability'] as string || '';
    const status = req.query['status'] as string || '';
    let result = Array.from(agents.values());

    if (capability) {
      result = result.filter(a => 
        a.capabilities.some(c => 
          c.toLowerCase().includes(capability.toLowerCase())
        )
      );
    }

    // Mark stale agents as offline
    const now = Date.now();
    for (const agent of result) {
      if (now - agent.lastSeen > 60000 && agent.status !== 'offline') {
        agent.status = 'offline';
      }
    }

    if (status) {
      result = result.filter(a => a.status === status);
    }

    res.json({ agents: result, total: result.length });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get agent details (GET /api/agents/:id)
app.get('/api/agents/:id', requireApiKey, async (req: Request, res: Response) => {
  const agent = getAgent(req.params['id'] as string);
  if (!agent) return res.status(404).json({ error: 'Agent not found' });
  res.json(agent);
});

// Heartbeat (POST /api/agents/:id/heartbeat)
app.post('/api/agents/:id/heartbeat', requireApiKey, async (req: Request, res: Response) => {
  const agent = getAgent(req.params['id'] as string);
  if (!agent) return res.status(404).json({ error: 'Agent not found' });
  
  agent.lastSeen = Date.now();
  agent.status = 'online';
  
  broadcast({ type: 'heartbeat', agent: { id: agent.id, name: agent.name, lastSeen: agent.lastSeen }, timestamp: Date.now() });
  
  res.json({ success: true, lastSeen: agent.lastSeen });
});

// Send message (POST /api/messages)
app.post('/api/messages', requireApiKey, async (req: Request, res: Response) => {
  try {
    let { fromAgentId, fromName, toAgentId, toName, content, type } = req.body as {
      fromAgentId?: string;
      fromName?: string;
      toAgentId?: string;
      toName?: string;
      content?: string;
      type?: 'direct' | 'broadcast';
    };

    if (!content) return res.status(400).json({ error: 'content is required' });

    let targetIds: string[] = [];

    if (type === 'broadcast') {
      // Broadcast to all agents except sender
      targetIds = Array.from(agents.keys()).filter(id => id !== fromAgentId);
    } else {
      // Direct message — resolve toAgentId
      if (!toAgentId && toName) {
        const found = findAgentIdByName(toName);
        if (!found) return res.status(404).json({ error: `Agent not found: ${toName}` });
        toAgentId = found;
      }
      if (!toAgentId) return res.status(400).json({ error: 'toAgentId or toName is required for direct messages' });
      targetIds = [toAgentId];
    }

    const now = Date.now();
    const deliveredTo: string[] = [];
    let firstMsgId = '';

    for (const tid of targetIds) {
      const msg: Message = {
        id: uuidv4(),
        fromAgentId: fromAgentId || 'unknown',
        fromName: fromName || 'Unknown',
        toAgentId: tid,
        toName: agents.get(tid)?.name || toName || tid,
        content,
        timestamp: now,
        read: false,
        type: type || 'direct'
      };

      if (!firstMsgId) firstMsgId = msg.id;
      saveMessage(msg);
      deliveredTo.push(tid);

      // Deliver via WebSocket if connected
      const ws = wsClients.get(tid);
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'message_received', message: msg, timestamp: now }));
      }

      console.log(`[Mesh] Message from ${fromName} → ${msg.toName}: "${content.slice(0, 50)}"`);
    }

    res.json({ success: true, messageId: firstMsgId, deliveredTo });
  } catch (error: any) {
    console.error('[Mesh] Send message error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Get messages for agent (GET /api/messages/:agentId)
app.get('/api/messages/:agentId', requireApiKey, async (req: Request, res: Response) => {
  const agentId = req.params['agentId'] as string;
  const unreadOnly = (req.query['unreadOnly'] as string) || '';
  
  const agentMessages = messages.filter(m => m.toAgentId === agentId);
  const filtered = (unreadOnly as string) === 'true' 
    ? agentMessages.filter(m => !m.read)
    : agentMessages;

  res.json({ messages: filtered.slice(-50), total: filtered.length });
});

// Alias routes for agent-mesh client compatibility
app.get('/api/agents/:agentId/messages', requireApiKey, async (req: Request, res: Response) => {
  const { agentId } = { agentId: req.params['agentId'] as string };
  const { unreadOnly } = { unreadOnly: (req.query['unreadOnly'] as string) || '' };
  const agentMessages = messages.filter(m => m.toAgentId === agentId);
  const filtered = unreadOnly === 'true'
    ? agentMessages.filter(m => !m.read)
    : agentMessages;
  res.json({ messages: filtered.slice(-50), total: filtered.length });
});

app.get('/api/agents/:agentId/inbox', requireApiKey, async (req: Request, res: Response) => {
  const { agentId } = { agentId: req.params['agentId'] as string };
  const inbox = messages.filter(m => m.toAgentId === agentId && !m.read);
  res.json({ messages: inbox, total: inbox.length });
});

app.get('/api/agents/:agentId/health', requireApiKey, async (req: Request, res: Response) => {
  const { agentId } = { agentId: req.params['agentId'] as string };
  const agent = agents.get(agentId);
  if (!agent) return res.status(404).json({ error: 'Agent not found' });
  res.json({ status: agent.status, lastSeen: agent.lastSeen });
});

// Get inbox (GET /api/inbox/:agentId) — unread only
app.get('/api/inbox/:agentId', requireApiKey, async (req: Request, res: Response) => {
  const agentId = req.params['agentId'] as string;
  const inbox = messages.filter(m => m.toAgentId === agentId && !m.read);
  res.json({ messages: inbox, total: inbox.length });
});

// Mark message read (POST /api/messages/:id/read)
app.post('/api/messages/:id/read', requireApiKey, async (req: Request, res: Response) => {
  const msg = messages.find(m => m.id === req.params['id']);
  if (!msg) return res.status(404).json({ error: 'Message not found' });
  msg.read = true;
  res.json({ success: true });
});

// Broadcast (POST /api/messages/broadcast) - alias for compatibility
app.post('/api/messages/broadcast', requireApiKey, async (req: Request, res: Response) => {
  req.body['type'] = 'broadcast';
  // Fall through to the main broadcast logic by calling it
  try {
    const { fromAgentId, fromName, content } = req.body as {
      fromAgentId?: string;
      fromName?: string;
      content?: string;
    };

    if (!content) return res.status(400).json({ error: 'content is required' });

    const now = Date.now();
    let count = 0;

    for (const [id, agent] of agents) {
      if (id === fromAgentId) continue;

      const msg: Message = {
        id: uuidv4(),
        fromAgentId: fromAgentId || 'unknown',
        fromName: fromName || 'Unknown',
        toAgentId: id,
        toName: agent.name,
        content,
        timestamp: now,
        read: false,
        type: 'broadcast'
      };

      saveMessage(msg);
      count++;

      const ws = wsClients.get(id);
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'message_received', message: msg, timestamp: now }));
      }
    }

    console.log(`[Mesh] Broadcast from ${fromName}: "${content.slice(0, 50)}" → ${count} agents`);

    res.json({ success: true, recipientCount: count });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Broadcast (POST /api/broadcast)
app.post('/api/broadcast', requireApiKey, async (req: Request, res: Response) => {
  try {
    const { fromAgentId, fromName, content } = req.body as {
      fromAgentId?: string;
      fromName?: string;
      content?: string;
    };

    if (!content) return res.status(400).json({ error: 'content is required' });

    const now = Date.now();
    let count = 0;

    for (const [id, agent] of agents) {
      if (id === fromAgentId) continue;

      const msg: Message = {
        id: uuidv4(),
        fromAgentId: fromAgentId || 'unknown',
        fromName: fromName || 'Unknown',
        toAgentId: id,
        toName: agent.name,
        content,
        timestamp: now,
        read: false,
        type: 'broadcast'
      };

      saveMessage(msg);
      count++;

      const ws = wsClients.get(id);
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'message_received', message: msg, timestamp: now }));
      }
    }

    console.log(`[Mesh] Broadcast from ${fromName}: "${content.slice(0, 50)}" → ${count} agents`);

    res.json({ success: true, deliveredTo: count });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Catastrophe events - stub implementation
interface Catastrophe {
  id: string;
  eventType: string;
  severity: string;
  title: string;
  description: string;
  status: 'active' | 'resolved';
  reportedBy: string;
  timestamp: number;
}
const catastrophes: Catastrophe[] = [];

app.post('/api/catastrophe', requireApiKey, async (req: Request, res: Response) => {
  const { eventType, severity, title, description } = req.body as {
    eventType?: string; severity?: string; title?: string; description?: string;
  };
  const cat: Catastrophe = {
    id: uuidv4(),
    eventType: eventType || 'unknown',
    severity: severity || 'medium',
    title: title || 'Unknown catastrophe',
    description: description || '',
    status: 'active',
    reportedBy: (req.body as any)?.fromAgentId || 'unknown',
    timestamp: Date.now()
  };
  catastrophes.push(cat);
  broadcast({ type: 'catastrophe_alert', data: cat, timestamp: cat.timestamp });
  res.json({ success: true, catastrophe: cat });
});

app.get('/api/catastrophe', requireApiKey, async (req: Request, res: Response) => {
  const { status } = req.query as { status?: string };
  let result = catastrophes;
  if (status === 'active') result = result.filter(c => c.status === 'active');
  if (status === 'resolved') result = result.filter(c => c.status === 'resolved');
  res.json({ catastrophes: result.slice(-20), total: result.length });
});

app.get('/api/catastrophe/protocols', requireApiKey, async (req: Request, res: Response) => {
  res.json({
    protocols: [
      { step: 1, action: 'Identify the catastrophe type and severity' },
      { step: 2, action: 'Alert all connected agents via WebSocket' },
      { step: 3, action: 'Attempt automatic recovery if possible' },
      { step: 4, action: 'Log the event for post-mortem analysis' },
    ]
  });
});

app.post('/api/catastrophe/:id/resolve', requireApiKey, async (req: Request, res: Response) => {
  const cat = catastrophes.find(c => c.id === req.params['id']);
  if (!cat) return res.status(404).json({ error: 'Catastrophe not found' });
  cat.status = 'resolved';
  res.json({ success: true, catastrophe: cat });
});

// Health dashboard (GET /api/health/dashboard)
app.get('/api/health/dashboard', requireApiKey, async (req: Request, res: Response) => {
  const counts = getHealthyCounts();
  const agentsList = Array.from(agents.values()).map(a => ({
    id: a.id,
    name: a.name,
    status: Date.now() - a.lastSeen > 60000 ? 'offline' : a.status,
    lastSeen: a.lastSeen
  }));
  res.json({ ...counts, agents: agentsList });
});

// Unregister agent (DELETE /api/agents/:id)
app.delete('/api/agents/:id', requireApiKey, async (req: Request, res: Response) => {
  const id = req.params['id'] as string;
  const agent = agents.get(id);
  if (!agent) return res.status(404).json({ error: 'Agent not found' });

  agents.delete(id);
  wsClients.delete(id);

  broadcast({ type: 'agent_left', agent: { id: agent.id, name: agent.name }, timestamp: Date.now() });

  console.log(`[Mesh] Agent "${agent.name}" (${id}) left the mesh`);

  res.json({ success: true });
});

// Capabilities (GET /api/skills — alias)
app.get('/api/skills', requireApiKey, async (req: Request, res: Response) => {
  const capabilityMap = new Map<string, { name: string; id: string }[]>();
  for (const agent of agents.values()) {
    for (const cap of agent.capabilities) {
      if (!capabilityMap.has(cap)) capabilityMap.set(cap, []);
      capabilityMap.get(cap)!.push({ name: agent.name, id: agent.id });
    }
  }
  const skills = Array.from(capabilityMap.entries()).map(([name, agents]) => ({ name, agents }));
  res.json({ skills, total: skills.length });
});

// ============ HTTP Server + WebSocket ============
const server = createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws, req) => {
  const url = new URL(req.url || '/', `http://${req.headers.host}`);
  const agentId = url.searchParams.get('agentId') || url.searchParams.get('agent_id') || '';
  const agentName = url.searchParams.get('name') || 'Anonymous';

  console.log(`[Mesh WS] Client connected: ${agentName} (${agentId || 'unregistered'})`);

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      
      // Handle registration via WS
      if (msg.type === 'register' && msg.name) {
        const existing = Array.from(agents.values()).find(a => a.name === msg.name);
        const id = existing?.id || uuidv4();
        
        if (existing) {
          existing.lastSeen = Date.now();
          existing.status = 'online';
        } else {
          agents.set(id, {
            id, name: msg.name, endpoint: msg.endpoint || '',
            capabilities: msg.capabilities || [], status: 'online',
            lastSeen: Date.now(), registeredAt: Date.now()
          });
          broadcast({ type: 'agent_joined', agent: { id, name: msg.name }, timestamp: Date.now() });
        }

        wsClients.set(id, ws);
        ws.send(JSON.stringify({ type: 'registered', agentId: id, name: msg.name }));
        console.log(`[Mesh WS] Agent "${msg.name}" registered via WS (${id})`);
      }

      // Handle heartbeat via WS
      if (msg.type === 'heartbeat' && msg.agentId) {
        const agent = agents.get(msg.agentId);
        if (agent) {
          agent.lastSeen = Date.now();
          agent.status = 'online';
        }
      }

      // Handle message via WS
      if (msg.type === 'message' && msg.toAgentId && msg.content) {
        const msgId = uuidv4();
        const fromAgent = agents.get(msg.fromAgentId);
        const toAgent = agents.get(msg.toAgentId);
        const newMsg: Message = {
          id: msgId,
          fromAgentId: msg.fromAgentId || '',
          fromName: fromAgent?.name || msg.fromName || 'Unknown',
          toAgentId: msg.toAgentId,
          toName: toAgent?.name || msg.toName || msg.toAgentId,
          content: msg.content,
          timestamp: Date.now(),
          read: false,
          type: 'direct'
        };
        saveMessage(newMsg);

        // Deliver to recipient if online
        const recipientWs = wsClients.get(msg.toAgentId);
        if (recipientWs?.readyState === WebSocket.OPEN) {
          recipientWs.send(JSON.stringify({ type: 'message_received', message: newMsg, timestamp: Date.now() }));
        }
      }

      // Handle broadcast via WS
      if (msg.type === 'broadcast' && msg.content) {
        const fromAgent = agents.get(msg.fromAgentId);
        for (const [id] of agents) {
          if (id === msg.fromAgentId) continue;
          const agentWs = wsClients.get(id);
          if (agentWs?.readyState === WebSocket.OPEN) {
            const bMsg: Message = {
              id: uuidv4(),
              fromAgentId: msg.fromAgentId || '',
              fromName: fromAgent?.name || 'Unknown',
              toAgentId: id,
              toName: agents.get(id)?.name || id,
              content: msg.content,
              timestamp: Date.now(),
              read: false,
              type: 'broadcast'
            };
            agentWs.send(JSON.stringify({ type: 'message_received', message: bMsg, timestamp: Date.now() }));
          }
        }
      }
    } catch (e) {
      // Ignore malformed messages
    }
  });

  ws.on('close', () => {
    console.log(`[Mesh WS] Client disconnected: ${agentName}`);
    // Mark agent offline
    if (agentId) {
      const agent = agents.get(agentId);
      if (agent) {
        agent.status = 'offline';
        wsClients.delete(agentId);
        broadcast({ type: 'agent_left', agent: { id: agent.id, name: agent.name }, timestamp: Date.now() });
      }
    }
  });

  ws.on('error', () => {
    if (agentId) wsClients.delete(agentId);
  });
});

// ============ Start Server ============
export function startMeshServer(port = MESH_PORT): Promise<void> {
  return new Promise((resolve) => {
    server.listen(port, MESH_HOST, () => {
      console.log(`\n🌐 Duck Mesh Server started`);
      console.log(`   🌐 Listening: http://${MESH_HOST === '0.0.0.0' ? 'localhost' : MESH_HOST}:${port}`);
      console.log(`   🔌 WebSocket: ws://localhost:${port}/ws`);
      console.log(`   🔑 API Key: ${API_KEY.substring(0, 3)}...`);
      console.log(`   📁 Data: ${DATA_DIR}`);
      console.log(`   📊 Health: GET http://localhost:${port}/api/health/dashboard`);
      console.log(`   👥 Agents: GET http://localhost:${port}/api/agents`);
      console.log('');
      resolve();
    });
  });
}

// Run if executed directly
startMeshServer().catch(console.error);
