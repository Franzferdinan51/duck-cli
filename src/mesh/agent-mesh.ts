/**
 * 🦆 Duck Agent - Agent Mesh Client
 * Deep integration with agent-mesh-api for inter-agent communication
 */

import { EventEmitter } from 'events';

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

  /**
   * Register this agent with the mesh
   */
  async register(): Promise<string | null> {
    console.log(`[Mesh] Registering as "${this.agentName}"...`);

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
      console.log(`[Mesh] ✅ Registered: ${this.agentName} (${this.agentId})`);
      this.emit('registered', { agentId: this.agentId });
      return this.agentId;
    }

    console.log(`[Mesh] ❌ Registration failed: ${result?.error || 'Unknown error'}`);
    return null;
  }

  /**
   * Update agent info
   */
  async updateInfo(updates: Partial<{
    endpoint: string;
    capabilities: string[];
    version: string;
  }>): Promise<boolean> {
    if (!this.agentId) {
      console.log('[Mesh] Not registered');
      return false;
    }

    const result = await this.request<{ success: boolean }>(
      'PUT',
      `/api/agents/${this.agentId}`,
      updates
    );

    return result?.success || false;
  }

  /**
   * Unregister from mesh
   */
  async unregister(): Promise<boolean> {
    if (!this.agentId) return false;

    const result = await this.request<{ success: boolean }>(
      'DELETE',
      `/api/agents/${this.agentId}`
    );

    if (result?.success) {
      this.agentId = '';
      this.disconnect();
      console.log('[Mesh] Unregistered from mesh');
      return true;
    }

    return false;
  }

  // ============ WebSocket Connection ============

  /**
   * Connect to mesh WebSocket for real-time events
   */
  async connect(): Promise<boolean> {
    if (!this.agentId) {
      console.log('[Mesh] Not registered - call register() first');
      return false;
    }

    const wsUrl = this.serverUrl.replace('http', 'ws') + '/ws';

    return new Promise((resolve) => {
      try {
        this.ws = new WebSocket(`${wsUrl}?agentId=${this.agentId}`);

        this.ws.onopen = () => {
          console.log('[Mesh] ✅ WebSocket connected');
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
            console.log('[Mesh] Failed to parse WS message:', e);
          }
        };

        this.ws.onclose = () => {
          console.log('[Mesh] ⚠️ WebSocket disconnected');
          this.connected = false;
          this.emit('disconnected', {});
          this.stopHeartbeat();
        };

        this.ws.onerror = (error) => {
          console.log('[Mesh] WebSocket error:', error);
          this.emitError('websocket_error', error);
        };

        resolve(true);
      } catch (error) {
        console.log('[Mesh] Failed to connect WebSocket:', error);
        resolve(false);
      }
    });
  }

  /**
   * Disconnect WebSocket
   */
  disconnect(): void {
    this.stopHeartbeat();
    this.stopReconnect();

    // Clear message handlers
    this.messageHandlers.clear();

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.connected = false;
  }

  /**
   * Setup graceful shutdown handlers
   */
  setupShutdownHandlers(): void {
    const cleanup = () => {
      console.log('[Mesh] Shutting down...');
      this.disconnect();
    };

    // Use once to auto-remove after first trigger (exit handler auto-removes)
    process.once('SIGINT', cleanup);
    process.once('SIGTERM', cleanup);
  }

  private handleEvent(event: { type: string; data?: any; agentId?: string }): void {
    const meshEvent: MeshEvent = {
      type: event.type as MeshEventType,
      data: event.data || event,
      timestamp: Date.now(),
    };

    // Store in history
    this.eventHistory.push(meshEvent);
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }

    // Emit specific events
    this.emit(event.type, event.data || event);

    // Also emit generic 'event'
    this.emit('event', meshEvent);

    // Handle specific event types
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
        console.log(`[Mesh] 🤝 Agent joined: ${event.data?.name || event.agentId}`);
        break;

      case 'agent_left':
        console.log(`[Mesh] 👋 Agent left: ${event.data?.name || event.agentId}`);
        break;
    }
  }

  private emitError(type: string, error: any): void {
    this.emit('error', { type, error, timestamp: Date.now() });
  }

  // ============ Heartbeat ============

  private startHeartbeat(): void {
    this.stopHeartbeat();

    // Send initial heartbeat
    this.sendHeartbeat();

    // Then every interval
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

    await this.request('POST', `/api/agents/${this.agentId}/heartbeat`);
  }

  private scheduleReconnect(): void {
    this.stopReconnect();

    this.reconnectTimer = setTimeout(async () => {
      if (!this.connected && this.agentId) {
        console.log('[Mesh] Attempting reconnect...');
        await this.connect();
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

  /**
   * Send a message to another agent
   */
  async sendMessage(toAgentId: string, content: string, fromName?: string): Promise<string | null> {
    // Auto-register if not registered
    if (!this.agentId) {
      const regResult = await this.register();
      if (!regResult) {
        console.log('[Mesh] Not registered and auto-register failed');
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
      console.log(`[Mesh] Message sent to ${toAgentId}: ${result.messageId}`);
      return result.messageId;
    }

    console.log(`[Mesh] Failed to send message: ${result?.error}`);
    return null;
  }

  /**
   * Send a message and wait for reply
   */
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

  /**
   * Broadcast to all agents
   */
  async broadcast(content: string): Promise<number> {
    // Auto-register if not registered
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

  /**
   * Get messages for this agent
   */
  async getMessages(unreadOnly: boolean = false): Promise<MeshMessage[]> {
    if (!this.agentId) return [];

    const params = unreadOnly ? '?unreadOnly=true' : '';
    const result = await this.request<MeshMessage[]>(
      'GET',
      `/api/agents/${this.agentId}/messages${params}`
    );

    return result || [];
  }

  /**
   * Get agent's inbox
   */
  async getInbox(unreadOnly: boolean = false): Promise<MeshMessage[]> {
    if (!this.agentId) return [];

    const params = unreadOnly ? '?unreadOnly=true' : '';
    const result = await this.request<MeshMessage[]>(
      'GET',
      `/api/agents/${this.agentId}/inbox${params}`
    );

    return result || [];
  }

  /**
   * Mark message as read
   */
  async markRead(messageId: string): Promise<boolean> {
    const result = await this.request<{ success: boolean }>(
      'POST',
      `/api/messages/${messageId}/read`
    );
    return result?.success || false;
  }

  // ============ Agent Discovery ============

  /**
   * List all agents on the mesh
   */
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

  /**
   * Find agents with specific capability
   */
  async findAgentsByCapability(capability: string): Promise<MeshAgent[]> {
    const agents = await this.discoverAgents();
    return agents.filter((agent) =>
      agent.capabilities?.includes(capability)
    );
  }

  /**
   * Get a specific agent by ID
   */
  async getAgent(agentId: string): Promise<MeshAgent | null> {
    const result = await this.request<MeshAgent>('GET', `/api/agents/${agentId}`);
    return result || null;
  }

  // ============ Health Monitoring ============

  /**
   * Report health status
   */
  async reportHealth(report: HealthReport): Promise<boolean> {
    if (!this.agentId) return false;

    const result = await this.request<{ success: boolean }>(
      'POST',
      `/api/agents/${this.agentId}/health`,
      report
    );

    return result?.success || false;
  }

  /**
   * Get health dashboard
   */
  async getHealth(): Promise<MeshHealthStatus | null> {
    const result = await this.request<MeshHealthStatus>('GET', '/api/health/dashboard');
    return result;
  }

  /**
   * Get health for specific agent
   */
  async getAgentHealth(agentId: string): Promise<HealthReport | null> {
    const result = await this.request<HealthReport>('GET', `/api/agents/${agentId}/health`);
    return result;
  }

  // ============ Catastrophe Protocols ============

  /**
   * Report a catastrophe event
   */
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

  /**
   * List catastrophe events
   */
  async listCatastrophes(status?: 'active' | 'resolved'): Promise<CatastropheEvent[]> {
    const params = status ? `?status=${status}` : '';
    const result = await this.request<{ catastrophes: CatastropheEvent[]; total: number }>('GET', `/api/catastrophe${params}`);
    return (result?.catastrophes || []) as CatastropheEvent[];
  }

  /**
   * Resolve a catastrophe
   */
  async resolveCatastrophe(catastropheId: string): Promise<boolean> {
    const result = await this.request<{ success: boolean }>(
      'POST',
      `/api/catastrophe/${catastropheId}/resolve`
    );
    return result?.success || false;
  }

  /**
   * Get catastrophe recovery protocols
   */
  async getRecoveryProtocols(): Promise<any> {
    const result = await this.request('GET', '/api/catastrophe/protocols');
    return result;
  }

  // ============ Utilities ============

  /**
   * Check if mesh server is available
   */
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

  /**
   * Get event history
   */
  getEventHistory(type?: MeshEventType): MeshEvent[] {
    if (type) {
      return this.eventHistory.filter((e) => e.type === type);
    }
    return [...this.eventHistory];
  }

  /**
   * Check connection status
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Get agent ID
   */
  getAgentId(): string {
    return this.agentId;
  }

  /**
   * Get agent name
   */
  getAgentName(): string {
    return this.agentName;
  }

  /**
   * Set agent name
   */
  setAgentName(name: string): void {
    this.agentName = name;
  }

  /**
   * Update capabilities
   */
  setCapabilities(capabilities: string[]): void {
    this.capabilities = capabilities;
  }

  /**
   * Get capabilities
   */
  getCapabilities(): string[] {
    return [...this.capabilities];
  }

  /**
   * Set agent endpoint
   */
  setEndpoint(endpoint: string): void {
    this.agentEndpoint = endpoint;
  }
}

// ============ Default export ============

export default AgentMeshClient;
