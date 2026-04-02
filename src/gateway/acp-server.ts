/**
 * 🦆 Duck Agent - ACP Server (Agent Client Protocol Backend)
 * Allows OpenClaw to connect and spawn Duck Agent sessions
 * 
 * This is the SERVER side - OpenClaw connects TO this to spawn sessions
 * 
 * Protocol: https://agentclientprotocol.com/
 */

import { EventEmitter } from 'events';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer, Server as HTTPServer } from 'http';
import { Agent } from '../agent/core.js';

export interface ACPServerConfig {
  port?: number;
  host?: string;
  maxSessions?: number;
  sessionTimeout?: number; // minutes
  allowedClients?: string[]; // IP whitelist, empty = allow all
}

export interface ACPSession {
  id: string;
  agentId: string;
  mode: 'persistent' | 'oneshot' | 'run';
  status: 'starting' | 'running' | 'completed' | 'failed' | 'cancelled';
  createdAt: number;
  lastActivity: number;
  cwd?: string;
  messages: Array<{ role: string; content: string }>;
  result?: string;
  clientId: string;
  ws: WebSocket;
}

interface ACPMessage {
  jsonrpc: '2.0';
  id?: string | number;
  method?: string;
  params?: any;
  result?: any;
  error?: { code: number; message: string; data?: any };
}

interface ACPServerCapabilities {
  agents: string[];
  modes: string[];
  streaming: boolean;
  maxConcurrentSessions: number;
}

/**
 * ACP Server - OpenClaw connects TO this to spawn Duck Agent sessions
 * 
 * Usage:
 *   duck acp-server              # Start server on default port (18794)
 *   duck acp-server --port 3849 # Custom port
 * 
 * Then in OpenClaw config:
 *   agents.list[].runtime.acp.backend = "acpx"
 *   agents.list[].runtime.acp.agent = "duck"
 *   # Point acpx at this server
 */
export class ACPServer extends EventEmitter {
  private config: Required<ACPServerConfig>;
  private server: HTTPServer | null = null;
  private wss: WebSocketServer | null = null;
  private sessions: Map<string, ACPSession> = new Map();
  private agent: Agent;
  private port: number;
  private nextSessionId = 1;

  constructor(agent: Agent, config: ACPServerConfig = {}) {
    super();
    this.agent = agent;
    this.port = config.port || 18794;
    this.config = {
      port: this.port,
      host: config.host || '0.0.0.0',
      maxSessions: config.maxSessions || 8,
      sessionTimeout: config.sessionTimeout || 120,
      allowedClients: config.allowedClients || [],
    };
  }

  /**
   * Get server capabilities (for handshake)
   */
  getCapabilities(): ACPServerCapabilities {
    return {
      agents: ['duck', 'duck-agent', 'kairos'],
      modes: ['persistent', 'oneshot', 'run'],
      streaming: true,
      maxConcurrentSessions: this.config.maxSessions,
    };
  }

  /**
   * Start the ACP server
   */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = createServer();

      this.wss = new WebSocketServer({
        server: this.server,
        path: '/acp',
        maxPayload: 1024 * 1024, // 1MB for code files
      });

      this.wss.on('connection', (ws: WebSocket, req) => {
        const clientIp = req.socket.remoteAddress || 'unknown';
        console.log(`[ACP Server] Client connected: ${clientIp}`);
        
        // Check IP allowlist
        if (this.config.allowedClients.length > 0 && 
            !this.config.allowedClients.includes(clientIp)) {
          console.log(`[ACP Server] Rejected: ${clientIp} not in allowlist`);
          ws.close(1008, 'Not allowed');
          return;
        }

        const clientId = `client_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        this.handleConnection(ws, clientId);
      });

      this.wss.on('error', (err) => {
        console.error('[ACP Server] WebSocket error:', err.message);
        this.emit('error', err);
      });

      this.server.on('error', reject);

      this.server.listen(this.port, this.config.host, () => {
        console.log(`\n🦆 Duck Agent ACP Server`);
        console.log(`   URL: ws://${this.config.host}:${this.port}/acp`);
        console.log(`   Agents: ${this.getCapabilities().agents.join(', ')}`);
        console.log(`   Max sessions: ${this.config.maxSessions}`);
        console.log(`   Ready for OpenClaw connections\n`);
        this.emit('ready');
        resolve();
      });
    });
  }

  private handleConnection(ws: WebSocket, clientId: string): void {
    let clientInfo: any = null;
    let authenticated = false;

    ws.on('message', async (data: Buffer) => {
      try {
        const msg: ACPMessage = JSON.parse(data.toString());
        
        // Handle initialize first
        if (msg.method === 'initialize') {
          clientInfo = msg.params?.clientInfo || msg.params;
          authenticated = true;
          
          ws.send(JSON.stringify({
            jsonrpc: '2.0',
            id: msg.id,
            result: {
              protocolVersion: '2024-11-05',
              capabilities: this.getCapabilities(),
              serverInfo: {
                name: 'duck-agent-acp',
                version: '0.4.0',
                description: 'Duck Agent ACP Backend'
              }
            }
          }));
          console.log(`[ACP Server] ${clientId} initialized as ${clientInfo?.name || 'unknown'}`);
          return;
        }

        if (!authenticated) {
          ws.send(JSON.stringify({
            jsonrpc: '2.0',
            id: msg.id,
            error: { code: -32000, message: 'Not initialized' }
          }));
          return;
        }

        // Route message
        const response = await this.handleMessage(msg, ws, clientId);
        if (response && msg.id !== undefined) {
          ws.send(JSON.stringify(response));
        }
      } catch (err: any) {
        console.error('[ACP Server] Message error:', err.message);
        ws.send(JSON.stringify({
          jsonrpc: '2.0',
          id: null,
          error: { code: -32603, message: err.message }
        }));
      }
    });

    ws.on('close', () => {
      console.log(`[ACP Server] Client disconnected: ${clientId}`);
      // Clean up sessions
      for (const [id, session] of this.sessions) {
        if (session.clientId === clientId) {
          this.sessions.delete(id);
          console.log(`[ACP Server] Cleaned up session: ${id}`);
        }
      }
    });

    ws.on('error', (err) => {
      console.error(`[ACP Server] Client ${clientId} error:`, err.message);
    });
  }

  private async handleMessage(msg: ACPMessage, ws: WebSocket, clientId: string): Promise<ACPMessage | null> {
    const { method, params, id } = msg;

    switch (method) {
      case 'acp.spawn':
        return await this.handleSpawn(params, ws, clientId, id);
      
      case 'acp.cancel':
        return this.handleCancel(params, id);
      
      case 'acp.steer':
        return this.handleSteer(params, id);
      
      case 'acp.status':
        return this.handleStatus(params, id);
      
      case 'acp.sessions':
        return this.handleSessionsList(id);
      
      case 'acp.send':
        return await this.handleSend(params, id);
      
      case 'ping':
        return { jsonrpc: '2.0', id, result: { pong: true, timestamp: Date.now() } };
      
      default:
        return { jsonrpc: '2.0', id, error: { code: -32601, message: `Unknown method: ${method}` } };
    }
  }

  private async handleSpawn(params: any, ws: WebSocket, clientId: string, id?: string | number): Promise<ACPMessage> {
    const { agent: requestedAgent, task, mode, cwd, timeout } = params;

    // Validate agent
    const capabilities = this.getCapabilities();
    const agentId = requestedAgent || 'duck';
    if (!capabilities.agents.includes(agentId)) {
      return {
        jsonrpc: '2.0',
        id,
        error: { code: -32002, message: `Unknown agent: ${agentId}` }
      };
    }

    // Check session limit
    if (this.sessions.size >= this.config.maxSessions) {
      return {
        jsonrpc: '2.0',
        id,
        error: { code: -32003, message: `Max sessions (${this.config.maxSessions}) reached` }
      };
    }

    // Create session
    const sessionId = `session_${this.nextSessionId++}`;
    const effectiveMode = mode || (task ? 'run' : 'persistent');
    
    const session: ACPSession = {
      id: sessionId,
      agentId,
      mode: effectiveMode,
      status: 'starting',
      createdAt: Date.now(),
      lastActivity: Date.now(),
      cwd,
      messages: task ? [{ role: 'user', content: task }] : [],
      clientId,
      ws,
    };

    this.sessions.set(sessionId, session);
    console.log(`[ACP Server] Spawned ${agentId} session: ${sessionId}`);

    this.emit('session:created', session);

    // Execute task if provided
    if (task) {
      session.status = 'running';
      
      try {
        const result = await this.executeSession(session, task);
        session.result = result;
        session.status = 'completed';
        
        // Send result back
        this.sendToClient(ws, {
          jsonrpc: '2.0',
          method: 'acp.session.result',
          params: { sessionId, result, status: 'completed' }
        });
      } catch (err: any) {
        session.status = 'failed';
        session.result = `Error: ${err.message}`;
        
        this.sendToClient(ws, {
          jsonrpc: '2.0',
          method: 'acp.session.error',
          params: { sessionId, error: err.message, status: 'failed' }
        });
      }
    } else {
      session.status = 'running';
    }

    return {
      jsonrpc: '2.0',
      id,
      result: {
        sessionId,
        agentId,
        status: session.status,
        message: task ? 'Task started' : 'Session ready'
      }
    };
  }

  private async executeSession(session: ACPSession, task: string): Promise<string> {
    try {
      // Use Duck Agent to process the task
      const result = await this.agent.think(task);
      return result;
    } catch (err: any) {
      throw new Error(err.message);
    }
  }

  private handleCancel(params: any, id?: string | number): ACPMessage {
    const { sessionId } = params;
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      return {
        jsonrpc: '2.0',
        id,
        error: { code: -32004, message: `Session not found: ${sessionId}` }
      };
    }

    session.status = 'cancelled';
    session.lastActivity = Date.now();
    
    // Notify client
    this.sendToClient(session.ws, {
      jsonrpc: '2.0',
      method: 'acp.session.cancelled',
      params: { sessionId }
    });

    console.log(`[ACP Server] Cancelled session: ${sessionId}`);

    return {
      jsonrpc: '2.0',
      id,
      result: { sessionId, cancelled: true }
    };
  }

  private handleSteer(params: any, id?: string | number): ACPMessage {
    const { sessionId, instruction } = params;
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      return {
        jsonrpc: '2.0',
        id,
        error: { code: -32004, message: `Session not found: ${sessionId}` }
      };
    }

    session.lastActivity = Date.now();
    
    // Add instruction as message
    session.messages.push({ role: 'user', content: instruction });

    console.log(`[ACP Server] Steered session ${sessionId}: "${instruction.slice(0, 50)}..."`);

    return {
      jsonrpc: '2.0',
      id,
      result: { sessionId, steered: true }
    };
  }

  private handleStatus(params: any, id?: string | number): ACPMessage {
    const { sessionId } = params;
    
    if (sessionId) {
      const session = this.sessions.get(sessionId);
      if (!session) {
        return {
          jsonrpc: '2.0',
          id,
          error: { code: -32004, message: `Session not found: ${sessionId}` }
        };
      }

      return {
        jsonrpc: '2.0',
        id,
        result: {
          sessionId,
          agentId: session.agentId,
          mode: session.mode,
          status: session.status,
          createdAt: session.createdAt,
          lastActivity: session.lastActivity,
          cwd: session.cwd,
          messageCount: session.messages.length
        }
      };
    }

    // Overall status
    return {
      jsonrpc: '2.0',
      id,
      result: {
        capabilities: this.getCapabilities(),
        activeSessions: this.sessions.size,
        maxSessions: this.config.maxSessions,
        sessions: Array.from(this.sessions.values()).map(s => ({
          sessionId: s.id,
          agentId: s.agentId,
          status: s.status
        }))
      }
    };
  }

  private handleSessionsList(id?: string | number): ACPMessage {
    return {
      jsonrpc: '2.0',
      id,
      result: {
        sessions: Array.from(this.sessions.values()).map(s => ({
          id: s.id,
          agentId: s.agentId,
          mode: s.mode,
          status: s.status,
          createdAt: s.createdAt,
          lastActivity: s.lastActivity
        }))
      }
    };
  }

  private async handleSend(params: any, id?: string | number): Promise<ACPMessage> {
    const { sessionId, message } = params;
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      return {
        jsonrpc: '2.0',
        id,
        error: { code: -32004, message: `Session not found: ${sessionId}` }
      };
    }

    session.lastActivity = Date.now();
    session.messages.push({ role: 'user', content: message });

    try {
      // Get the last message and process
      const lastMessage = session.messages[session.messages.length - 1].content;
      const result = await this.executeSession(session, lastMessage);
      
      session.messages.push({ role: 'assistant', content: result });

      return {
        jsonrpc: '2.0',
        id,
        result: {
          sessionId,
          response: result,
          status: session.status
        }
      };
    } catch (err: any) {
      return {
        jsonrpc: '2.0',
        id,
        result: {
          sessionId,
          error: err.message,
          status: session.status
        }
      };
    }
  }

  private sendToClient(ws: WebSocket, msg: any): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }

  /**
   * Get all active sessions
   */
  getSessions(): ACPSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): ACPSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**

  /**
   * Create a session directly (programmatic API)
   */
  async createSession(config: { agentId?: string; task?: string; mode?: string; cwd?: string }): Promise<ACPSession> {
    const agentId = config.agentId || 'duck';
    const effectiveMode = config.mode || (config.task ? 'run' : 'persistent');
    
    const sessionId = `session_${this.nextSessionId++}`;
    const session: ACPSession = {
      id: sessionId,
      agentId,
      mode: effectiveMode as 'persistent' | 'oneshot' | 'run',
      status: 'starting',
      createdAt: Date.now(),
      lastActivity: Date.now(),
      cwd: config.cwd,
      messages: config.task ? [{ role: 'user', content: config.task }] : [],
      clientId: 'internal',
      ws: null as any,
    };

    this.sessions.set(sessionId, session);
    this.emit('session:created', session);

    if (config.task) {
      session.status = 'running';
      try {
        session.result = await this.executeSession(session, config.task);
        session.status = 'completed';
      } catch (err: any) {
        session.status = 'failed';
        session.result = `Error: ${err.message}`;
      }
    } else {
      session.status = 'running';
    }

    return session;
  }

  /**
   * Send a message to an existing session
   */
  async sendSessionMessage(sessionId: string, message: string): Promise<string> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    session.lastActivity = Date.now();
    session.messages.push({ role: 'user', content: message });

    const result = await this.executeSession(session, message);
    session.messages.push({ role: 'assistant', content: result });
    return result;
  }

  /**
   * Cancel a session
   */
  cancelSessionById(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);
    session.status = 'cancelled';
    session.lastActivity = Date.now();
    if (session.ws) session.ws.close();
    this.emit('session:cancelled', session);
  }

  /**
   * Stop the server
   */
  async stop(): Promise<void> {
    // Close all sessions
    for (const session of this.sessions.values()) {
      session.status = 'cancelled';
      this.sendToClient(session.ws, {
        jsonrpc: '2.0',
        method: 'acp.server.shutdown',
        params: { reason: 'Server stopping' }
      });
      session.ws.close();
    }
    this.sessions.clear();

    // Stop server
    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }

    if (this.server) {
      await new Promise<void>((resolve) => {
        this.server!.close(() => resolve());
      });
      this.server = null;
    }

    console.log('[ACP Server] Stopped');
    this.emit('stopped');
  }
}

export default ACPServer;
