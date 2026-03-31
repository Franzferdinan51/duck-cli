/**
 * 🦆 Duck Agent - ACP Client (Agent Client Protocol)
 * Spawns and manages ACP sessions (Codex, Claude Code, Pi, etc.)
 */

import { EventEmitter } from 'events';
import { spawn, ChildProcess } from 'child_process';
import { WebSocket, WebSocketServer } from 'ws';
import http from 'http';
import { Agent } from '../agent/core.js';

export interface ACPConfig {
  backend?: 'acpx' | 'direct';
  defaultAgent?: string;
  allowedAgents?: string[];
  maxConcurrentSessions?: number;
  permissionMode?: 'approve-all' | 'approve-reads' | 'deny-all';
  nonInteractivePermissions?: 'fail' | 'deny';
  streamCoalesceMs?: number;
  maxChunkChars?: number;
  ttlMinutes?: number;
}

export interface ACPSession {
  id: string;
  agentId: string;
  mode: 'persistent' | 'oneshot';
  status: 'starting' | 'running' | 'completed' | 'failed' | 'cancelled';
  createdAt: number;
  threadId?: string;
  label?: string;
  cwd?: string;
  process?: ChildProcess;
  ws?: WebSocket;
  lastActivity?: number;
}

export interface ACPSpawnOptions {
  task: string;
  agentId?: string;
  mode?: 'persistent' | 'oneshot' | 'run';
  thread?: boolean | 'auto' | 'here' | 'off';
  bind?: 'here' | 'off';
  cwd?: string;
  label?: string;
  model?: string;
  permissions?: string;
  timeout?: number;
  resumeSessionId?: string;
  streamTo?: 'parent';
  env?: Record<string, string>;
}

interface ACPMessage {
  jsonrpc: '2.0';
  id?: string | number;
  method?: string;
  params?: any;
  result?: any;
  error?: { code: number; message: string; data?: any };
}

/**
 * ACP Client - Manages ACP sessions with external coding harnesses
 * 
 * Supported agents (via acpx backend):
 * - codex, claude, copilot, cursor, droid, gemini, iflow
 * - kilocode, kimi, kiro, openclaw, opencode, pi, qwen
 */
export class ACPClient extends EventEmitter {
  private config: Required<ACPConfig>;
  private sessions: Map<string, ACPSession> = new Map();
  private agent: Agent;
  private acpxPath: string = 'acpx';
  private httpServer?: http.Server;
  private wsServer?: WebSocketServer;
  private localWsPort: number = 18794;

  constructor(agent: Agent, config: ACPConfig = {}) {
    super();
    
    this.agent = agent;
    this.config = {
      backend: config.backend || 'acpx',
      defaultAgent: config.defaultAgent || 'codex',
      allowedAgents: config.allowedAgents || ['claude', 'codex', 'cursor', 'gemini', 'pi', 'openclaw', 'opencode'],
      maxConcurrentSessions: config.maxConcurrentSessions || 8,
      permissionMode: config.permissionMode || 'approve-all',
      nonInteractivePermissions: config.nonInteractivePermissions || 'deny',
      streamCoalesceMs: config.streamCoalesceMs || 300,
      maxChunkChars: config.maxChunkChars || 1200,
      ttlMinutes: config.ttlMinutes || 120,
    };

    this.registerCommands();
  }

  /**
   * Register ACP slash commands with the agent
   */
  private registerCommands(): void {
    // These would be registered with the command handler
    this.commandHandlers = {
      'spawn': this.handleSpawn.bind(this),
      'cancel': this.handleCancel.bind(this),
      'steer': this.handleSteer.bind(this),
      'close': this.handleClose.bind(this),
      'status': this.handleStatus.bind(this),
      'sessions': this.handleSessions.bind(this),
      'doctor': this.handleDoctor.bind(this),
      'model': this.handleModel.bind(this),
      'permissions': this.handlePermissions.bind(this),
      'timeout': this.handleTimeout.bind(this),
    };
  }

  private commandHandlers: Record<string, (args: any) => Promise<any>> = {};

  /**
   * Start the local ACP gateway (for receiving connections)
   */
  async startGateway(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.httpServer = http.createServer((req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        
        if (req.method === 'OPTIONS') {
          res.writeHead(204);
          res.end();
          return;
        }

        const url = new URL(req.url || '/', `http://localhost:${this.localWsPort}`);
        
        if (url.pathname === '/health') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'ok', acp: 'active', sessions: this.sessions.size }));
        } else if (url.pathname === '/sessions') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ sessions: Array.from(this.sessions.values()).map(s => ({
            id: s.id,
            agentId: s.agentId,
            mode: s.mode,
            status: s.status,
            label: s.label,
            cwd: s.cwd,
            createdAt: s.createdAt,
            lastActivity: s.lastActivity,
          }))}));
        } else {
          res.writeHead(404);
          res.end('Not found');
        }
      });

      this.wsServer = new WebSocketServer({ server: this.httpServer, path: '/acp' });
      
      this.wsServer.on('connection', (ws: WebSocket, req: http.IncomingMessage) => {
        const clientId = `ext_${Date.now()}`;
        console.log(`[ACP] External client connected: ${clientId}`);
        
        ws.on('message', (data: Buffer) => {
          try {
            const msg = JSON.parse(data.toString()) as ACPMessage;
            this.handleExternalMessage(clientId, msg, ws);
          } catch (e) {
            console.error('[ACP] Failed to parse message:', e);
          }
        });

        ws.on('close', () => {
          console.log(`[ACP] External client disconnected: ${clientId}`);
        });
      });

      this.httpServer.listen(this.localWsPort, () => {
        console.log(`\n🦆 ACP Gateway running on http://localhost:${this.localWsPort}`);
        console.log(`   WebSocket: ws://localhost:${this.localWsPort}/acp`);
        console.log(`   Sessions: ${this.config.maxConcurrentSessions} max concurrent\n`);
        resolve();
      });

      this.httpServer.on('error', reject);
    });
  }

  private async handleExternalMessage(clientId: string, msg: ACPMessage, ws: WebSocket): Promise<void> {
    // Handle messages from external ACP clients
    if (msg.method === 'acp/spawn') {
      const result = await this.spawnSession({
        task: msg.params?.task || '',
        agentId: msg.params?.agentId,
        mode: msg.params?.mode,
        cwd: msg.params?.cwd,
        label: msg.params?.label,
      });
      ws.send(JSON.stringify({ jsonrpc: '2.0', id: msg.id, result }));
    } else if (msg.method === 'acp/status') {
      ws.send(JSON.stringify({ jsonrpc: '2.0', id: msg.id, result: { sessions: this.sessions.size, capabilities: this.getCapabilities() } }));
    } else if (msg.method === 'acp/cancel') {
      const result = await this.cancelSession(msg.params?.sessionId);
      ws.send(JSON.stringify({ jsonrpc: '2.0', id: msg.id, result }));
    }
  }

  /**
   * Spawn a new ACP session
   */
  async spawnSession(options: ACPSpawnOptions): Promise<{ sessionKey: string; sessionId: string; accepted: boolean }> {
    const agentId = options.agentId || this.config.defaultAgent;
    const sessionId = `acp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const sessionKey = `agent:${agentId}:acp:${sessionId}`;

    // Check if agent is allowed
    if (!this.config.allowedAgents.includes(agentId)) {
      throw new Error(`ACP agent "${agentId}" is not allowed. Allowed: ${this.config.allowedAgents.join(', ')}`);
    }

    // Check concurrent limit
    const activeSessions = Array.from(this.sessions.values()).filter(s => s.status === 'running' || s.status === 'starting');
    if (activeSessions.length >= this.config.maxConcurrentSessions) {
      throw new Error(`Max concurrent sessions (${this.config.maxConcurrentSessions}) reached`);
    }

    const session: ACPSession = {
      id: sessionId,
      agentId,
      mode: options.mode === 'oneshot' ? 'oneshot' : options.mode === 'persistent' ? 'persistent' : 'oneshot',
      status: 'starting',
      createdAt: Date.now(),
      threadId: typeof options.thread === 'string' ? options.thread : options.thread ? sessionId : undefined,
      label: options.label,
      cwd: options.cwd,
      lastActivity: Date.now(),
    };

    this.sessions.set(sessionKey, session);
    this.emit('session:created', session);

    // Spawn the actual process based on backend
    if (this.config.backend === 'acpx') {
      await this.spawnViaAcpx(session, options);
    } else {
      await this.spawnDirect(session, options);
    }

    session.status = 'running';
    this.emit('session:started', session);

    return {
      sessionKey,
      sessionId,
      accepted: true,
    };
  }

  private async spawnViaAcpx(session: ACPSession, options: ACPSpawnOptions): Promise<void> {
    const args = [
      'spawn',
      session.agentId,
      '--session', session.id,
      '--mode', session.mode,
    ];

    if (options.cwd) args.push('--cwd', options.cwd);
    if (options.label) args.push('--label', options.label);
    if (options.timeout) args.push('--timeout', String(options.timeout));
    if (options.task) args.push('--', options.task);

    // Set permission env vars
    const env = {
      ...process.env,
      ...options.env,
      ACPIX_PERMISSION_MODE: this.config.permissionMode,
      ACPIX_NONINTERACTIVE: this.config.nonInteractivePermissions,
    };

    return new Promise((resolve, reject) => {
      const proc = spawn(this.acpxPath, args, { env, stdio: ['pipe', 'pipe', 'pipe'] });
      session.process = proc;

      proc.stdout?.on('data', (data) => {
        const msg = data.toString().trim();
        console.log(`[${session.agentId}]`, msg);
        session.lastActivity = Date.now();
        this.emit('session:output', { session, output: msg });
      });

      proc.stderr?.on('data', (data) => {
        console.error(`[${session.agentId} stderr]`, data.toString().trim());
      });

      proc.on('exit', (code) => {
        session.status = code === 0 ? 'completed' : 'failed';
        this.emit('session:ended', { session, code });
        resolve();
      });

      proc.on('error', (err) => {
        session.status = 'failed';
        this.emit('session:error', { session, error: err });
        reject(err);
      });
    });
  }

  private async spawnDirect(session: ACPSession, options: ACPSpawnOptions): Promise<void> {
    // Direct spawning - uses built-in agents
    console.log(`[ACP] Spawning ${session.agentId} directly (mode: ${session.mode})`);
    
    // This would integrate with the actual agent binaries
    // For now, just log and mark as running
    setTimeout(() => {
      if (session.status === 'running') {
        this.emit('session:output', { session, output: `[ACP] ${session.agentId} session ${session.id} started` });
      }
    }, 100);
  }

  /**
   * Cancel an active ACP session
   */
  async cancelSession(sessionKeyOrId: string): Promise<{ cancelled: boolean }> {
    const session = this.findSession(sessionKeyOrId);
    if (!session) return { cancelled: false };

    if (session.process) {
      session.process.kill('SIGTERM');
      session.status = 'cancelled';
    } else {
      session.status = 'cancelled';
    }

    this.emit('session:cancelled', session);
    return { cancelled: true };
  }

  /**
   * Send a steer instruction to a running session
   */
  async steerSession(sessionKeyOrId: string, instruction: string): Promise<{ steered: boolean }> {
    const session = this.findSession(sessionKeyOrId);
    if (!session) return { steered: false };

    this.emit('session:steer', { session, instruction });
    session.lastActivity = Date.now();
    return { steered: true };
  }

  /**
   * Close and cleanup a session
   */
  async closeSession(sessionKeyOrId: string): Promise<{ closed: boolean }> {
    const session = this.findSession(sessionKeyOrId);
    if (!session) return { closed: false };

    if (session.process) {
      session.process.kill('SIGTERM');
    }
    if (session.ws) {
      session.ws.close();
    }

    this.sessions.delete(this.getSessionKey(session));
    this.emit('session:closed', session);
    return { closed: true };
  }

  /**
   * Get status of a session
   */
  getSessionStatus(sessionKeyOrId: string): any {
    const session = this.findSession(sessionKeyOrId);
    if (!session) return null;

    return {
      id: session.id,
      agentId: session.agentId,
      mode: session.mode,
      status: session.status,
      label: session.label,
      cwd: session.cwd,
      createdAt: session.createdAt,
      lastActivity: session.lastActivity,
      uptime: Date.now() - session.createdAt,
      capabilities: this.getCapabilities(),
    };
  }

  /**
   * List all ACP sessions
   */
  listSessions(): Array<{ id: string; agentId: string; mode: string; status: string; label?: string; uptime: number }> {
    return Array.from(this.sessions.values()).map(s => ({
      id: s.id,
      agentId: s.agentId,
      mode: s.mode,
      status: s.status,
      label: s.label,
      uptime: Date.now() - s.createdAt,
    }));
  }

  /**
   * Get ACP capabilities
   */
  getCapabilities(): any {
    return {
      backend: this.config.backend,
      agents: this.config.allowedAgents,
      maxConcurrent: this.config.maxConcurrentSessions,
      permissionMode: this.config.permissionMode,
      supportsStreaming: true,
      supportsSteer: true,
      supportsResume: true,
    };
  }

  // ============ COMMAND HANDLERS ============

  private async handleSpawn(args: any): Promise<any> {
    return this.spawnSession({
      task: args.task || args._?.join(' ') || '',
      agentId: args.agent,
      mode: args.mode,
      thread: args.thread,
      bind: args.bind,
      cwd: args.cwd,
      label: args.label,
    });
  }

  private async handleCancel(args: any): Promise<any> {
    return this.cancelSession(args.session || args._?.[0] || '');
  }

  private async handleSteer(args: any): Promise<any> {
    return this.steerSession(args.session || '', args.instruction || args._?.slice(1).join(' ') || '');
  }

  private async handleClose(args: any): Promise<any> {
    return this.closeSession(args.session || args._?.[0] || '');
  }

  private async handleStatus(args: any): Promise<any> {
    const session = args.session ? this.getSessionStatus(args.session) : null;
    return {
      session,
      capabilities: this.getCapabilities(),
      config: {
        backend: this.config.backend,
        defaultAgent: this.config.defaultAgent,
        maxConcurrent: this.config.maxConcurrentSessions,
      },
    };
  }

  private async handleSessions(): Promise<any> {
    return { sessions: this.listSessions() };
  }

  private async handleDoctor(): Promise<any> {
    // Health check
    const checks = {
      acpxInstalled: await this.checkAcpxInstalled(),
      backendHealthy: this.config.backend === 'acpx',
      gatewayRunning: !!this.httpServer,
      websocketReady: !!this.wsServer,
    };

    const allHealthy = Object.values(checks).every(v => v === true || typeof v === 'string');
    
    return {
      checks,
      healthy: allHealthy,
      recommendations: allHealthy ? [] : ['Fix failed checks above'],
    };
  }

  private async handleModel(args: any): Promise<any> {
    return { model: args.model || 'default', note: 'Model override for ACP sessions' };
  }

  private async handlePermissions(args: any): Promise<any> {
    return { permissions: args.profile || this.config.permissionMode };
  }

  private async handleTimeout(args: any): Promise<any> {
    return { timeout: args.seconds || this.config.ttlMinutes * 60 };
  }

  // ============ HELPERS ============

  private findSession(keyOrId: string): ACPSession | undefined {
    // Try exact key first
    if (this.sessions.has(keyOrId)) return this.sessions.get(keyOrId);
    
    // Try ID
    for (const session of this.sessions.values()) {
      if (session.id === keyOrId) return session;
    }
    return undefined;
  }

  private getSessionKey(session: ACPSession): string {
    for (const [key, s] of this.sessions.entries()) {
      if (s.id === session.id) return key;
    }
    return '';
  }

  private async checkAcpxInstalled(): Promise<boolean> {
    return new Promise((resolve) => {
      const proc = spawn('which', ['acpx']);
      proc.on('close', (code) => resolve(code === 0));
      proc.on('error', () => resolve(false));
    });
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<ACPConfig>): void {
    Object.assign(this.config, updates);
  }

  /**
   * Stop ACP client and cleanup
   */
  async stop(): Promise<void> {
    // Close all sessions
    for (const session of this.sessions.values()) {
      await this.closeSession(`agent:${session.agentId}:acp:${session.id}`);
    }

    // Stop gateway
    if (this.wsServer) {
      this.wsServer.close();
      this.wsServer = undefined;
    }

    if (this.httpServer) {
      await new Promise<void>((resolve) => {
        this.httpServer!.close(() => resolve());
      });
      this.httpServer = undefined;
    }

    console.log('[ACP] Client stopped');
  }
}

export default ACPClient;
