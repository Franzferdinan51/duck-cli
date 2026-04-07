/**
 * 🦆 Duck Agent - Agent Mesh System
 * Multi-agent communication network for duck-cli
 * 
 * Features:
 * - Agent registration and discovery
 * - Agent-to-agent messaging (direct, broadcast, multicast)
 * - Health monitoring and dashboard
 * - File transfer between agents
 * - Catastrophe protocols and recovery
 * - External mesh federation (hive mind capability)
 * - WebSocket-based real-time communication
 * - Mesh-to-mesh bridging
 */

import { EventEmitter } from 'events';
import WebSocket from 'ws';
import { randomUUID } from 'crypto';

export interface MeshAgent {
  id: string;
  name: string;
  type: 'duck-cli' | 'openclaw' | 'external' | 'council' | 'swarm';
  capabilities: string[];
  status: 'online' | 'offline' | 'busy' | 'error';
  lastSeen: number;
  endpoint?: string;
  metadata: Record<string, any>;
  ws?: WebSocket;
}

export interface MeshMessage {
  id: string;
  from: string;
  to: string | string[] | 'broadcast' | 'multicast';
  type: 'direct' | 'broadcast' | 'multicast' | 'request' | 'response' | 'event';
  topic?: string;
  payload: any;
  timestamp: number;
  ttl: number; // Time to live (hops)
  priority: 'low' | 'normal' | 'high' | 'critical';
}

export interface MeshFileTransfer {
  id: string;
  from: string;
  to: string;
  filename: string;
  size: number;
  chunks: number;
  chunksReceived: number;
  status: 'pending' | 'transferring' | 'completed' | 'failed';
  data: Buffer[];
}

export interface MeshHealth {
  agentId: string;
  cpu: number;
  memory: number;
  disk: number;
  network: number;
  tasks: number;
  errors: number;
  uptime: number;
  timestamp: number;
}

export interface ExternalMesh {
  id: string;
  name: string;
  endpoint: string;
  status: 'connected' | 'disconnected' | 'error';
  agents: number;
  lastSync: number;
  ws?: WebSocket;
}

export interface CatastropheReport {
  id: string;
  agentId: string;
  type: 'crash' | 'oom' | 'network' | 'disk' | 'security' | 'unknown';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  timestamp: number;
  recovered: boolean;
  recoveryActions: string[];
}

/**
 * Agent Mesh - Multi-agent communication network
 */
export class AgentMesh extends EventEmitter {
  private agents: Map<string, MeshAgent> = new Map();
  private messages: Map<string, MeshMessage> = new Map();
  private fileTransfers: Map<string, MeshFileTransfer> = new Map();
  private healthData: Map<string, MeshHealth> = new Map();
  private externalMeshes: Map<string, ExternalMesh> = new Map();
  private catastrophes: Map<string, CatastropheReport> = new Map();
  private wss?: WebSocket.Server;
  private meshId: string;
  private meshName: string;

  constructor(meshName: string = 'duck-cli-mesh') {
    super();
    this.meshId = `mesh_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.meshName = meshName;
  }

  /**
   * Start mesh server
   */
  async startServer(port: number = 4000): Promise<void> {
    this.wss = new WebSocket.Server({ port });
    
    console.log(`[AgentMesh] Server started on port ${port}`);
    console.log(`[AgentMesh] Mesh ID: ${this.meshId}`);
    console.log(`[AgentMesh] Mesh Name: ${this.meshName}`);

    this.wss.on('connection', (ws, req) => {
      console.log(`[AgentMesh] New connection from ${req.socket.remoteAddress}`);
      
      ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());
          this.handleMessage(ws, msg);
        } catch (e) {
          console.error('[AgentMesh] Invalid message:', e);
        }
      });

      ws.on('close', () => {
        this.handleDisconnect(ws);
      });

      ws.on('error', (err) => {
        console.error('[AgentMesh] WebSocket error:', err);
      });
    });

    this.emit('server_started', { port, meshId: this.meshId });
  }

  /**
   * Handle incoming message
   */
  private handleMessage(ws: WebSocket, msg: any): void {
    switch (msg.type) {
      case 'register':
        this.handleRegister(ws, msg);
        break;
      case 'message':
        this.handleMeshMessage(msg);
        break;
      case 'health':
        this.handleHealthUpdate(msg);
        break;
      case 'file_start':
        this.handleFileStart(msg);
        break;
      case 'file_chunk':
        this.handleFileChunk(msg);
        break;
      case 'catastrophe':
        this.handleCatastrophe(msg);
        break;
      case 'discovery':
        this.handleDiscovery(ws, msg);
        break;
      default:
        console.log('[AgentMesh] Unknown message type:', msg.type);
    }
  }

  /**
   * Handle agent registration
   */
  private handleRegister(ws: WebSocket, msg: any): void {
    const agent: MeshAgent = {
      id: msg.agentId || `agent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: msg.name || 'Unknown Agent',
      type: msg.agentType || 'external',
      capabilities: msg.capabilities || [],
      status: 'online',
      lastSeen: Date.now(),
      endpoint: msg.endpoint,
      metadata: msg.metadata || {},
      ws
    };

    this.agents.set(agent.id, agent);
    console.log(`[AgentMesh] Agent registered: ${agent.name} (${agent.id})`);

    // Send acknowledgment
    ws.send(JSON.stringify({
      type: 'registered',
      agentId: agent.id,
      meshId: this.meshId,
      meshName: this.meshName,
      timestamp: Date.now()
    }));

    this.emit('agent_registered', agent);
  }

  /**
   * Handle mesh message routing
   */
  private handleMeshMessage(msg: MeshMessage): void {
    this.messages.set(msg.id, msg);

    // Route based on destination
    if (msg.to === 'broadcast') {
      this.broadcast(msg);
    } else if (msg.to === 'multicast' && msg.topic) {
      this.multicast(msg.topic, msg);
    } else if (Array.isArray(msg.to)) {
      // Multiple recipients
      for (const agentId of msg.to) {
        this.sendToAgent(agentId, msg);
      }
    } else {
      // Single recipient
      this.sendToAgent(msg.to as string, msg);
    }

    this.emit('message_routed', msg);
  }

  /**
   * Send message to specific agent
   */
  private sendToAgent(agentId: string, msg: MeshMessage): boolean {
    const agent = this.agents.get(agentId);
    if (agent && agent.ws && agent.status === 'online') {
      agent.ws.send(JSON.stringify(msg));
      return true;
    }

    // Try external meshes
    for (const [meshId, mesh] of this.externalMeshes) {
      if (mesh.status === 'connected' && mesh.ws) {
        mesh.ws.send(JSON.stringify({
          type: 'forward',
          targetAgent: agentId,
          message: msg
        }));
        return true;
      }
    }

    return false;
  }

  /**
   * Broadcast message to all agents
   */
  broadcast(msg: MeshMessage): void {
    for (const [agentId, agent] of this.agents) {
      if (agent.ws && agent.status === 'online') {
        agent.ws.send(JSON.stringify(msg));
      }
    }
    this.emit('broadcast', msg);
  }

  /**
   * Multicast message to agents subscribed to topic
   */
  multicast(topic: string, msg: MeshMessage): void {
    for (const [agentId, agent] of this.agents) {
      if (agent.metadata.subscribedTopics?.includes(topic)) {
        if (agent.ws && agent.status === 'online') {
          agent.ws.send(JSON.stringify(msg));
        }
      }
    }
    this.emit('multicast', { topic, msg });
  }

  /**
   * Handle health update
   */
  private handleHealthUpdate(msg: any): void {
    const health: MeshHealth = {
      agentId: msg.agentId,
      cpu: msg.cpu,
      memory: msg.memory,
      disk: msg.disk,
      network: msg.network,
      tasks: msg.tasks,
      errors: msg.errors,
      uptime: msg.uptime,
      timestamp: Date.now()
    };

    this.healthData.set(msg.agentId, health);
    this.emit('health_update', health);
  }

  /**
   * Handle file transfer start
   */
  private handleFileStart(msg: any): void {
    const transfer: MeshFileTransfer = {
      id: msg.transferId,
      from: msg.from,
      to: msg.to,
      filename: msg.filename,
      size: msg.size,
      chunks: msg.chunks,
      chunksReceived: 0,
      status: 'transferring',
      data: []
    };

    this.fileTransfers.set(transfer.id, transfer);
    console.log(`[AgentMesh] File transfer started: ${transfer.filename} (${transfer.size} bytes)`);
    this.emit('file_transfer_started', transfer);
  }

  /**
   * Handle file chunk
   */
  private handleFileChunk(msg: any): void {
    const transfer = this.fileTransfers.get(msg.transferId);
    if (!transfer) return;

    transfer.data.push(Buffer.from(msg.chunk, 'base64'));
    transfer.chunksReceived++;

    if (transfer.chunksReceived >= transfer.chunks) {
      transfer.status = 'completed';
      this.emit('file_transfer_completed', transfer);
    }
  }

  /**
   * Handle catastrophe report
   */
  private handleCatastrophe(msg: any): void {
    const report: CatastropheReport = {
      id: msg.reportId || `cat_${Date.now()}`,
      agentId: msg.agentId,
      type: msg.catastropheType,
      severity: msg.severity,
      description: msg.description,
      timestamp: Date.now(),
      recovered: false,
      recoveryActions: []
    };

    this.catastrophes.set(report.id, report);
    console.log(`[AgentMesh] 🚨 Catastrophe reported: ${report.type} (${report.severity})`);

    // Trigger recovery
    this.triggerRecovery(report);
    this.emit('catastrophe', report);
  }

  /**
   * Trigger recovery actions
   */
  private async triggerRecovery(report: CatastropheReport): Promise<void> {
    const actions: string[] = [];

    switch (report.type) {
      case 'crash':
        actions.push('Restart agent process');
        actions.push('Check logs for errors');
        break;
      case 'oom':
        actions.push('Free memory');
        actions.push('Restart with more memory');
        break;
      case 'network':
        actions.push('Check network connectivity');
        actions.push('Reconnect to mesh');
        break;
      case 'disk':
        actions.push('Free disk space');
        actions.push('Clean temp files');
        break;
      case 'security':
        actions.push('Isolate agent');
        actions.push('Security audit');
        break;
    }

    report.recoveryActions = actions;

    // Notify all agents
    this.broadcast({
      id: `msg_${Date.now()}`,
      from: 'mesh',
      to: 'broadcast',
      type: 'event',
      topic: 'catastrophe',
      payload: report,
      timestamp: Date.now(),
      ttl: 10,
      priority: 'critical'
    });

    this.emit('recovery_triggered', report);
  }

  /**
   * Handle discovery from external mesh
   */
  private handleDiscovery(ws: WebSocket, msg: any): void {
    const mesh: ExternalMesh = {
      id: msg.meshId,
      name: msg.meshName,
      endpoint: msg.endpoint,
      status: 'connected',
      agents: msg.agents || 0,
      lastSync: Date.now(),
      ws
    };

    this.externalMeshes.set(mesh.id, mesh);
    console.log(`[AgentMesh] External mesh discovered: ${mesh.name} (${mesh.id})`);

    // Send our mesh info back
    ws.send(JSON.stringify({
      type: 'discovery_response',
      meshId: this.meshId,
      meshName: this.meshName,
      agents: this.agents.size,
      timestamp: Date.now()
    }));

    this.emit('mesh_discovered', mesh);
  }

  /**
   * Connect to external mesh (hive mind!)
   */
  async connectToExternalMesh(endpoint: string, name: string): Promise<ExternalMesh> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(endpoint);

      ws.on('open', () => {
        // Send discovery message
        ws.send(JSON.stringify({
          type: 'discovery',
          meshId: this.meshId,
          meshName: this.meshName,
          endpoint: `ws://localhost:${this.wss?.options.port}`,
          agents: this.agents.size,
          timestamp: Date.now()
        }));
      });

      ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'discovery_response') {
            const mesh: ExternalMesh = {
              id: msg.meshId,
              name: msg.meshName,
              endpoint,
              status: 'connected',
              agents: msg.agents,
              lastSync: Date.now(),
              ws
            };

            this.externalMeshes.set(mesh.id, mesh);
            console.log(`[AgentMesh] ✅ Connected to external mesh: ${mesh.name}`);
            this.emit('external_mesh_connected', mesh);
            resolve(mesh);
          }
        } catch (e) {
          reject(e);
        }
      });

      ws.on('error', (err) => {
        reject(err);
      });
    });
  }

  /**
   * Handle agent disconnect
   */
  private handleDisconnect(ws: WebSocket): void {
    for (const [agentId, agent] of this.agents) {
      if (agent.ws === ws) {
        agent.status = 'offline';
        agent.lastSeen = Date.now();
        console.log(`[AgentMesh] Agent disconnected: ${agent.name} (${agentId})`);
        this.emit('agent_disconnected', agent);
        break;
      }
    }
  }

  /**
   * Register this agent with the mesh
   */
  async registerAgent(
    name: string,
    type: MeshAgent['type'],
    capabilities: string[],
    endpoint?: string,
    metadata?: Record<string, any>
  ): Promise<MeshAgent> {
    const agent: MeshAgent = {
      id: `agent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      type,
      capabilities,
      status: 'online',
      lastSeen: Date.now(),
      endpoint,
      metadata: metadata || {}
    };

    this.agents.set(agent.id, agent);
    this.emit('agent_registered', agent);
    return agent;
  }

  /**
   * Send message to another agent
   */
  sendMessage(
    from: string,
    to: string | string[] | 'broadcast' | 'multicast',
    payload: any,
    options: {
      type?: MeshMessage['type'];
      topic?: string;
      priority?: MeshMessage['priority'];
      ttl?: number;
    } = {}
  ): MeshMessage {
    const msg: MeshMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      from,
      to,
      type: options.type || 'direct',
      topic: options.topic,
      payload,
      timestamp: Date.now(),
      ttl: options.ttl || 10,
      priority: options.priority || 'normal'
    };

    this.handleMeshMessage(msg);
    return msg;
  }

  /**
   * Get mesh dashboard data
   */
  getDashboard(): {
    meshId: string;
    meshName: string;
    agents: MeshAgent[];
    health: MeshHealth[];
    messages: number;
    fileTransfers: number;
    externalMeshes: ExternalMesh[];
    catastrophes: CatastropheReport[];
  } {
    return {
      meshId: this.meshId,
      meshName: this.meshName,
      agents: Array.from(this.agents.values()),
      health: Array.from(this.healthData.values()),
      messages: this.messages.size,
      fileTransfers: this.fileTransfers.size,
      externalMeshes: Array.from(this.externalMeshes.values()),
      catastrophes: Array.from(this.catastrophes.values())
    };
  }

  /**
   * Get agent by ID
   */
  getAgent(agentId: string): MeshAgent | undefined {
    return this.agents.get(agentId);
  }

  /**
   * List all agents
   */
  listAgents(): MeshAgent[] {
    return Array.from(this.agents.values());
  }

  /**
   * Subscribe agent to topic
   */
  subscribeToTopic(agentId: string, topic: string): void {
    const agent = this.agents.get(agentId);
    if (agent) {
      if (!agent.metadata.subscribedTopics) {
        agent.metadata.subscribedTopics = [];
      }
      if (!agent.metadata.subscribedTopics.includes(topic)) {
        agent.metadata.subscribedTopics.push(topic);
      }
    }
  }

  /**
   * Stop mesh server
   */
  stop(): void {
    // Close all agent connections
    for (const [agentId, agent] of this.agents) {
      if (agent.ws) {
        agent.ws.close();
      }
    }

    // Close external mesh connections
    for (const [meshId, mesh] of this.externalMeshes) {
      if (mesh.ws) {
        mesh.ws.close();
      }
    }

    // Close server
    if (this.wss) {
      this.wss.close();
    }

    console.log('[AgentMesh] Server stopped');
    this.emit('server_stopped');
  }
}

export default AgentMesh;
