/**
 * Duck CLI - OpenClaw Gateway ACP Client
 * 
 * Connect Duck CLI to OpenClaw gateway to:
 * - Use Telegram/Discord/Signal via gateway (NO conflicts!)
 * - Access OpenClaw's session management
 * - Share tools and skills with OpenClaw
 * - Multi-agent coordination
 * 
 * Architecture:
 *   Duck CLI ←→ OpenClaw Gateway ←→ Telegram/Discord/etc
 *                 (channels handled here)
 */

export interface ACPConfig {
  gatewayUrl: string;
  token: string;
  agentId?: string;
  reconnect?: boolean;
  heartbeatInterval?: number;
}

export interface ACPMessage {
  type: string;
  id: string;
  payload: any;
}

export class ACPClient {
  private ws: WebSocket | null = null;
  private config: ACPConfig;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private messageHandlers = new Map<string, (payload: any) => void>();
  private pendingRequests = new Map<string, { resolve: Function; reject: Function; timeout: NodeJS.Timeout }>();

  constructor(config: ACPConfig) {
    this.config = {
      gatewayUrl: config.gatewayUrl || 'ws://localhost:18789',
      token: config.token || process.env.OPENCLAW_TOKEN || '',
      agentId: config.agentId || 'duck-cli',
      reconnect: config.reconnect ?? true,
      heartbeatInterval: config.heartbeatInterval ?? 30000,
    };
  }

  async connect(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      try {
        const url = `${this.config.gatewayUrl}?token=${this.config.token}&agent=${this.config.agentId}`;
        this.ws = new WebSocket(url);

        this.ws.on('open', () => {
          console.log(`[ACP] Connected to ${this.config.gatewayUrl}`);
          this.startHeartbeat();
          this.reconnectAttempts = 0;
          resolve(true);
        });

        this.ws.on('message', (data) => {
          this.handleMessage(data.toString());
        });

        this.ws.on('close', () => {
          console.log('[ACP] Connection closed');
          this.stopHeartbeat();
          this.attemptReconnect();
        });

        this.ws.on('error', (error) => {
          console.error('[ACP] Error:', error.message);
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  private handleMessage(data: string): void {
    try {
      const msg: ACPMessage = JSON.parse(data);

      // Handle responses to our requests
      if (msg.id && this.pendingRequests.has(msg.id)) {
        const pending = this.pendingRequests.get(msg.id)!;
        clearTimeout(pending.timeout);
        pending.resolve(msg.payload);
        this.pendingRequests.delete(msg.id);
        return;
      }

      // Handle events
      if (msg.type && this.messageHandlers.has(msg.type)) {
        this.messageHandlers.get(msg.type)!(msg.payload);
      }
    } catch (e) {
      console.error('[ACP] Failed to parse message:', e);
    }
  }

  async request(type: string, payload: any, timeoutMs = 30000): Promise<any> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Not connected to gateway');
    }

    const id = `${Date.now()}_${Math.random().toString(36).slice(2)}`;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request ${type} timed out`));
      }, timeoutMs);

      this.pendingRequests.set(id, { resolve, reject, timeout });

      this.ws!.send(JSON.stringify({ type, id, payload }));
    });
  }

  on(event: string, handler: (payload: any) => void): void {
    this.messageHandlers.set(event, handler);
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      this.request('ping', { timestamp: Date.now() }).catch(() => {
        // Ignore ping failures
      });
    }, this.heartbeatInterval!);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private attemptReconnect(): void {
    if (!this.config.reconnect) return;
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('[ACP] Max reconnect attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);

    console.log(`[ACP] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    setTimeout(() => this.connect(), delay);
  }

  async disconnect(): void {
    this.config.reconnect = false;
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

// ============================================
// CONVENIENCE METHODS
// ============================================

export class DuckCLIviaGateway {
  private acp: ACPClient;

  constructor(config?: Partial<ACPConfig>) {
    this.acp = new ACPClient({
      gatewayUrl: config?.gatewayUrl || process.env.OPENCLAW_GATEWAY || 'ws://localhost:18789',
      token: config?.token || process.env.OPENCLAW_TOKEN || '',
    });
  }

  async connect(): Promise<boolean> {
    return this.acp.connect();
  }

  // Send a message to a chat channel (via OpenClaw gateway)
  async sendMessage(channel: 'telegram' | 'discord' | 'signal', chatId: string, text: string): Promise<void> {
    await this.acp.request('channel.send', {
      channel,
      chatId,
      text,
    });
  }

  // Run an agent task
  async runTask(prompt: string, options?: { model?: string; tools?: string[] }): Promise<string> {
    const result = await this.acp.request('agent.run', {
      prompt,
      model: options?.model,
      tools: options?.tools,
    });
    return result.output;
  }

  // Spawn a sub-agent
  async spawnAgent(name: string, task: string): Promise<string> {
    const result = await this.acp.request('agent.spawn', { name, task });
    return result.sessionId;
  }

  // List sessions
  async listSessions(): Promise<any[]> {
    return this.acp.request('sessions.list');
  }

  // Search memory
  async searchMemory(query: string): Promise<any[]> {
    return this.acp.request('memory.search', { query });
  }

  // Get tool result
  async executeTool(tool: string, args: any): Promise<any> {
    return this.acp.request('tool.execute', { tool, args });
  }

  // Access OpenClaw skills
  async useSkill(skillName: string, input: string): Promise<string> {
    return this.acp.request('skill.use', { name: skillName, input });
  }

  // Disconnect
  async disconnect(): Promise<void> {
    await this.acp.disconnect();
  }
}

// ============================================
// CLI INTEGRATION
// ============================================

export async function connectToOpenClaw(): Promise<DuckCLIviaGateway> {
  const client = new DuckCLIviaGateway();
  
  const connected = await client.connect();
  if (!connected) {
    throw new Error('Failed to connect to OpenClaw gateway');
  }

  return client;
}

// Example usage:
// const client = await connectToOpenClaw();
// await client.sendMessage('telegram', '588090613', 'Hello via OpenClaw!');
// const result = await client.runTask('Fix the auth bug');
// client.disconnect();
