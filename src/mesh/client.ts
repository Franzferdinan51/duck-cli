/**
 * 🦆 Duck Agent - Agent Mesh Client
 * Deep integration with agent-mesh-api for inter-agent communication
 */

import { EventEmitter } from 'events';
import { logger } from '../server/logger.js';

// ============ Types ============

export interface MeshAgent {
  id: string;
  name: string;
  endpoint: string;
  capabilities: string[];
  status: 'online' | 'offline' | 'degraded';
  lastSeen: number;
  version?: string;
}

export interface MeshMessage {
  id: string;
  from: string;
  to: string;
  content: string;
  timestamp: number;
  type: 'direct' | 'broadcast' | 'skill-request' | 'task-delegate';
  read?: boolean;
}

export interface MeshHealthStatus {
  healthy: number;
  degraded: number;
  unhealthy: number;
  offline: number;
  totalAgents: number;
  criticalEvents: number;
}

export interface HealthReport {
  agentId: string;
  cpuUsage?: number;
  memoryUsage?: number;
  uptime?: number;
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: number;
}

export interface CatastropheEvent {
  id: string;
  eventType: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  status: 'active' | 'resolved';
  reportedBy: string;
  timestamp: number;
}

export interface MeshOptions {
  serverUrl?: string;
  apiKey?: string;
  agentName?: string;
  agentEndpoint?: string;
  capabilities?: string[];
  version?: string;
  heartbeatInterval?: number;
  reconnectInterval?: number;
}

// ============ WebSocket Events ============

export type MeshEventType =
  | 'agent_joined'
  | 'agent_left'
  | 'agent_updated'
  | 'message_received'
  | 'heartbeat'
  | 'system_update'
  | 'catastrophe_alert'
  | 'agent_health_change'
  | 'file_available'
  | 'connected'
  | 'disconnected'
  | 'error';

export interface MeshEvent {
  type: MeshEventType;
  data: any;
  timestamp: number;
}

// ============ AgentMeshClient ============

export class AgentMeshClient extends EventEmitter {
  private serverUrl: string;
  private apiKey: string;
  private agentId: string = '';
  private agentName: string;
  private agentEndpoint: string;
  private capabilities: string[];
  private version: string;
  private ws: WebSocket | null = null;
  private connected: boolean = false;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private heartbeatInterval: number;
  private reconnectInterval: number;
  private messageHandlers: Map<string, (msg: MeshMessage) => void> = new Map();
  private eventHistory: MeshEvent[] = [];
  private maxHistorySize: number = 100;

  constructor(options: MeshOptions = {}) {
    super();
    this.serverUrl = options.serverUrl || process.env.AGENT_MESH_URL || 'http://localhost:4000';
    this.apiKey = options.apiKey || process.env.AGENT_MESH_API_KEY || 'openclaw-mesh-default-key';
    this.agentName = options.agentName || 'Duck Agent';
    this.agentEndpoint = options.agentEndpoint || 'http://localhost:3000';
    this.capabilities = options.capabilities || ['reasoning', 'coding', 'messaging', 'desktop'];
    this.version = options.version || '1.0.0';
    this.heartbeatInterval = options.heartbeatInterval || 30000;
    this.reconnectInterval = options.reconnectInterval || 5000;
    // Suppress console.log spam in bot/mesh contexts
    this._quiet = (process.env.DUCK_QUIET_MESH === '1' || process.env.DUCK_BOT_MODE === '1');
  }

  // Lightweight logger that can be silenced — delegates to structured logger
  private _quiet: boolean = false;
  private _log(...args: any[]): void {
    if (!this._quiet) {
      const msg = args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ');
      logger.debug('system', 'AgentMeshClient', msg);
    }
  }

  // ============ HTTP Helpers ============

  private async request<T = any>(
    method: string,
    path: string,
    body?: object,
    timeoutMs: number = 30000
  ): Promise<T | null> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(`${this.serverUrl}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey,
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const data = await response.json();
      return data;
    } catch (error) {
      clearTimeout(timeout);
      this.emitError('http_error', error);
      return null;
    }
  }

  // ============ Registration ============

  async register(): Promise<string | null> {
    this._log(`[Mesh] Registering as "${this.agentName}"...`);

    const result = await this.request<{
      success: boolean;
      agentId?: string;
      message?: string;
      error?: string;
    }>('POST', '/api/agents/register', {
      name: this.agentName,
      endpoint: this.agentEndpoint,
      capabilities: this.capabilities,
      version: this.version,
    });

    if (result?.success && result.agentId) {
      this.agentId = result.agentId;
      this._log(`[Mesh] ✅ Registered: ${this.agentName} (${this.agentId})`);
      logger.info('system', 'AgentMeshClient', `Registered as "${this.agentName}" (${this.agentId})`, { agentId: this.agentId, name: this.agentName });
      this.emit('registered', { agentId: this.agentId });
      return this.agentId;
    }

    this._log(`[Mesh] ❌ Registration failed: ${result?.error || 'Unknown error'}`);
    logger.error('system', 'AgentMeshClient', `Registration failed: ${result?.error || 'Unknown error'}`);
    return null;
  }

  async updateInfo(updates: Partial<{
    endpoint: string;
    capabilities: string[];
    version: string;
  }>): Promise<boolean> {
    if (!this.agentId) {
      this._log('[Mesh] Not registered');
      return false;
    }

    const result = await this.request<{ success: boolean }>(
      'PUT',
      `/api/agents/${this.agentId}`,
      updates
    );

    return result?.success || false;
  }

  async unregister(): Promise<boolean> {
    if (!this.agentId) return false;

    const result = await this.request<{ success: boolean }>(
      'DELETE',
      `/api/agents/${this.agentId}`
    );

    if (result?.success) {
      this.agentId = '';
      this.disconnect();
      this._log('[Mesh] Unregistered from mesh');
      logger.info('system', 'AgentMeshClient', 'Unregistered from mesh');
      return true;
    }

    return false;
  }

  // ============ WebSocket Connection ============

  async connect(): Promise<boolean> {
    if (!this.agentId) {
      this._log('[Mesh] Not registered - call register() first');
      return false;
    }

    const wsUrl = this.serverUrl.replace('http', 'ws') + '/ws';

    return new Promise((resolve) => {
      try {
        this.ws = new WebSocket(`${wsUrl}?agentId=${this.agentId}`);

        this.ws.onopen = () => {
          this._log('[Mesh] ✅ WebSocket connected');
          logger.info('system', 'AgentMeshClient', 'WebSocket connected');
          this.connected = true;
          this.emit('connected', {});
          this.startHeartbeat();
          this.scheduleReconnect();
        };

        this.ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            this.handleEvent(msg);
          } catch (e) {
            this._log('[Mesh] Failed to parse WS message:', e);
          }
        };

        this.ws.onclose = () => {
          this._log('[Mesh] ⚠️ WebSocket disconnected');
          logger.warn('system', 'AgentMeshClient', 'WebSocket disconnected');
          this.connected = false;
          this.emit('disconnected', {});
          this.stopHeartbeat();
        };

        this.ws.onerror = (error) => {
          this._log('[Mesh] WebSocket error:', error);
          this.emitError('websocket_error', error);
        };

        resolve(true);
      } catch (error) {
        this._log('[Mesh] Failed to connect WebSocket:', error);
        resolve(false);
      }
    });
  }

  disconnect(): void {
    this.stopHeartbeat();
    this.stopReconnect();
    this.messageHandlers.clear();

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.connected = false;
  }

  setupShutdownHandlers(): void {
    const cleanup = () => {
      this._log('[Mesh] Shutting down...');
      logger.info('system', 'AgentMeshClient', 'Shutting down mesh client');
      this.disconnect();
    };

    process.once('SIGINT', cleanup);
    process.once('SIGTERM', cleanup);
  }

  private handleEvent(event: { type: string; data?: any; agentId?: string }): void {
    const meshEvent: MeshEvent = {
      type: event.type as MeshEventType,
      data: event.data || event,
      timestamp: Date.now(),
    };

    this.eventHistory.push(meshEvent);
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }

    this.emit(event.type, event.data || event);
    this.emit('event', meshEvent);

    switch (event.type) {
      case 'message_received':
      case 'message':
        const msg = event.data as MeshMessage;
        const handler = this.messageHandlers.get(msg.id);
        if (handler) {
          handler(msg);
          this.messageHandlers.delete(msg.id);
        }
        break;

      case 'agent_joined':
        this._log(`[Mesh] 🤝 Agent joined: ${event.data?.name || event.agentId}`);
        logger.info('system', 'AgentMeshClient', `Agent joined: ${event.data?.name || event.agentId}`, { agentId: event.agentId });
        break;

      case 'agent_left':
        this._log(`[Mesh] 👋 Agent left: ${event.data?.name || event.agentId}`);
        logger.info('system', 'AgentMeshClient', `Agent left: ${event.data?.name || event.agentId}`, { agentId: event.agentId });
        break;
    }
  }

  private emitError(type: string, error: any): void {
    logger.error('system', 'AgentMeshClient', `${type}: ${error?.message || error}`, error);
    this.emit('error', { type, error, timestamp: Date.now() });
  }

  // ============ Heartbeat ============

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.sendHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat();
    }, this.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private async sendHeartbeat(): Promise<void> {
    if (!this.agentId) return;

    try {
      await this.request('POST', `/api/agents/${this.agentId}/heartbeat`);
    } catch (error) {
      this._log('[Mesh] Heartbeat failed:', error);
      this.emitError('heartbeat_failed', error);
    }
  }

  private scheduleReconnect(): void {
    this.stopReconnect();

    this.reconnectTimer = setTimeout(async () => {
      if (!this.connected && this.agentId) {
        this._log('[Mesh] Attempting reconnect...');
        try {
          await this.connect();
        } catch (error) {
          this._log('[Mesh] Reconnect failed:', error);
          this.emitError('reconnect_failed', error);
        }
      }
    }, this.reconnectInterval);
  }

  private stopReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  // ============ Messaging ============

  async sendMessage(toAgentId: string, content: string, fromName?: string): Promise<string | null> {
    if (!this.agentId) {
      const regResult = await this.register();
      if (!regResult) {
        this._log('[Mesh] Not registered and auto-register failed');
        return null;
      }
    }

    const result = await this.request<{
      success: boolean;
      messageId?: string;
      error?: string;
    }>('POST', '/api/messages', {
      fromAgentId: this.agentId,
      fromName: fromName || this.agentName,
      toAgentId,
      content,
    });

    if (result?.success && result.messageId) {
      this._log(`[Mesh] Message sent to ${toAgentId}: ${result.messageId}`);
      return result.messageId;
    }

    this._log(`[Mesh] Failed to send message: ${result?.error}`);
    return null;
  }

  async sendMessageWithReply(
    toAgentId: string,
    content: string,
    timeoutMs: number = 30000
  ): Promise<MeshMessage | null> {
    const messageId = await this.sendMessage(toAgentId, content);
    if (!messageId) return null;

    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.messageHandlers.delete(messageId);
        resolve(null);
      }, timeoutMs);

      this.messageHandlers.set(messageId, (msg) => {
        clearTimeout(timer);
        resolve(msg);
      });
    });
  }

  async broadcast(content: string): Promise<number> {
    if (!this.agentId) {
      const regResult = await this.register();
      if (!regResult) return 0;
    }

    const result = await this.request<{
      success: boolean;
      recipientCount?: number;
    }>('POST', '/api/messages/broadcast', {
      fromAgentId: this.agentId,
      fromName: this.agentName,
      message: content,
    });

    return result?.recipientCount || 0;
  }

  async getMessages(unreadOnly: boolean = false): Promise<MeshMessage[]> {
    if (!this.agentId) return [];

    const params = unreadOnly ? '?unreadOnly=true' : '';
    const result = await this.request<MeshMessage[]>(
      'GET',
      `/api/agents/${this.agentId}/messages${params}`
    );

    return result || [];
  }

  async getInbox(unreadOnly: boolean = false): Promise<MeshMessage[]> {
    if (!this.agentId) return [];

    const params = unreadOnly ? '?unreadOnly=true' : '';
    const result = await this.request<MeshMessage[]>(
      'GET',
      `/api/agents/${this.agentId}/inbox${params}`
    );

    return result || [];
  }

  async markRead(messageId: string): Promise<boolean> {
    const result = await this.request<{ success: boolean }>(
      'POST',
      `/api/messages/${messageId}/read`
    );
    return result?.success || false;
  }

  // ============ Agent Discovery ============

  async discoverAgents(): Promise<MeshAgent[]> {
    const result = await this.request<{
      success?: boolean;
      agents?: any[];
    }>('GET', '/api/agents');

    if (Array.isArray(result)) {
      return result;
    }

    if (result?.agents) {
      return result.agents;
    }

    return [];
  }

  async findAgentsByCapability(capability: string): Promise<MeshAgent[]> {
    const agents = await this.discoverAgents();
    return agents.filter((agent) =>
      agent.capabilities?.includes(capability)
    );
  }

  async getAgent(agentId: string): Promise<MeshAgent | null> {
    const result = await this.request<MeshAgent>('GET', `/api/agents/${agentId}`);
    return result || null;
  }

  // ============ Health Monitoring ============

  async reportHealth(report: HealthReport): Promise<boolean> {
    if (!this.agentId) return false;

    const result = await this.request<{ success: boolean }>(
      'POST',
      `/api/agents/${this.agentId}/health`,
      report
    );

    return result?.success || false;
  }

  async getHealth(): Promise<MeshHealthStatus | null> {
    const result = await this.request<MeshHealthStatus>('GET', '/api/health/dashboard');
    return result;
  }

  async getAgentHealth(agentId: string): Promise<HealthReport | null> {
    const result = await this.request<HealthReport>('GET', `/api/agents/${agentId}/health`);
    return result;
  }

  // ============ Catastrophe Protocols ============

  async reportCatastrophe(event: Omit<CatastropheEvent, 'id' | 'status' | 'timestamp'>): Promise<string | null> {
    if (!this.agentId) return null;

    const result = await this.request<{
      success: boolean;
      id?: string;
    }>('POST', '/api/catastrophe', {
      ...event,
      reportedBy: this.agentId,
    });

    return result?.id || null;
  }

  async listCatastrophes(status?: 'active' | 'resolved'): Promise<CatastropheEvent[]> {
    const params = status ? `?status=${status}` : '';
    const result = await this.request<{ catastrophes: CatastropheEvent[]; total: number }>('GET', `/api/catastrophe${params}`);
    return (result?.catastrophes || []) as CatastropheEvent[];
  }

  async resolveCatastrophe(catastropheId: string): Promise<boolean> {
    const result = await this.request<{ success: boolean }>(
      'POST',
      `/api/catastrophe/${catastropheId}/resolve`
    );
    return result?.success || false;
  }

  async getRecoveryProtocols(): Promise<any> {
    const result = await this.request('GET', '/api/catastrophe/protocols');
    return result;
  }

  // ============ Utilities ============

  async ping(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const response = await fetch(`${this.serverUrl}/api/health/dashboard`, {
        method: 'GET',
        headers: { 'X-API-Key': this.apiKey },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      return response.ok;
    } catch (error) {
      this.emitError('ping_failed', error);
      return false;
    }
  }

  getEventHistory(type?: MeshEventType): MeshEvent[] {
    if (type) {
      return this.eventHistory.filter((e) => e.type === type);
    }
    return [...this.eventHistory];
  }

  isConnected(): boolean {
    return this.connected;
  }

  getAgentId(): string {
    return this.agentId;
  }

  getAgentName(): string {
    return this.agentName;
  }

  setAgentName(name: string): void {
    this.agentName = name;
  }

  setCapabilities(capabilities: string[]): void {
    this.capabilities = capabilities;
  }

  getCapabilities(): string[] {
    return [...this.capabilities];
  }

  setEndpoint(endpoint: string): void {
    this.agentEndpoint = endpoint;
  }
}

// ============ Default export ============

export default AgentMeshClient;
