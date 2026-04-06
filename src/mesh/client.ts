/**
 * Duck Agent - Agent Mesh Integration
 * Multi-agent communication and collaboration
 */

export interface MeshAgent {
  id: string;
  name: string;
  endpoint: string;
  capabilities: string[];
  status: 'online' | 'offline';
  lastSeen: number;
}

export interface MeshMessage {
  id: string;
  from: string;
  to: string;
  content: string;
  timestamp: number;
  type: 'direct' | 'broadcast' | 'skill-request' | 'task-delegate';
}

export class AgentMesh {
  private serverUrl: string;
  private apiKey: string;
  private agentId: string = '';
  private agentName: string;
  private ws: WebSocket | null = null;
  private connected: boolean = false;
  private messageHandlers: ((msg: MeshMessage) => void)[] = [];

  constructor(serverUrl: string = 'http://localhost:4000', apiKey: string = 'openclaw-mesh-default-key') {
    this.serverUrl = serverUrl;
    this.apiKey = apiKey;
    this.agentName = 'Duck Agent';
  }

  async register(name: string, capabilities: string[] = ['reasoning', 'coding', 'desktop']): Promise<string | null> {
    this.agentName = name;
    
    try {
      const response = await fetch(`${this.serverUrl}/api/agents/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey
        },
        body: JSON.stringify({
          name,
          endpoint: 'http://localhost:3000',
          capabilities
        })
      });

      const data = await response.json() as any;
      
      if (data.success) {
        this.agentId = data.agentId;
        console.log(`✅ Agent registered: ${name} (${this.agentId})`);
        return this.agentId;
      }
      
      console.log(`❌ Registration failed:`, data);
      return null;
    } catch (error) {
      console.log(`❌ Mesh server not available:`, error);
      return null;
    }
  }

  async connect(): Promise<boolean> {
    if (!this.agentId) {
      console.log('❌ Not registered yet');
      return false;
    }

    try {
      this.ws = new WebSocket(`${this.serverUrl.replace('http', 'ws')}/ws?agentId=${this.agentId}`);

      this.ws.onopen = () => {
        console.log('✅ Connected to mesh');
        this.connected = true;
      };

      this.ws.onmessage = (event) => {
        const msg: MeshMessage = JSON.parse(event.data);
        this.messageHandlers.forEach(handler => handler(msg));
      };

      this.ws.onclose = () => {
        console.log('⚠️ Disconnected from mesh');
        this.connected = false;
      };

      return true;
    } catch (error) {
      console.log('❌ WebSocket failed:', error);
      return false;
    }
  }

  async sendMessage(to: string, content: string, type: MeshMessage['type'] = 'direct'): Promise<boolean> {
    if (!this.agentId) {
      console.log('❌ Not registered');
      return false;
    }

    try {
      const response = await fetch(`${this.serverUrl}/api/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey
        },
        body: JSON.stringify({
          fromAgentId: this.agentId,
          toAgentId: to,
          message: content,
          type
        })
      });

      const data = await response.json() as any;
      return data.success || false;
    } catch (error) {
      console.log('❌ Send failed:', error);
      return false;
    }
  }

  async broadcast(content: string): Promise<boolean> {
    if (!this.agentId) return false;

    try {
      const response = await fetch(`${this.serverUrl}/api/messages/broadcast`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey
        },
        body: JSON.stringify({
          fromAgentId: this.agentId,
          message: content
        })
      });

      const data = await response.json() as any;
      return data.success || false;
    } catch (error) {
      return false;
    }
  }

  async listAgents(): Promise<MeshAgent[]> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const response = await fetch(`${this.serverUrl}/api/agents`, {
        headers: { 'X-API-Key': this.apiKey },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const data = await response.json() as any;
      return data.agents || [];
    } catch (e) {
      console.error('[MeshClient] listAgents failed:', e instanceof Error ? e.message : e);
      return [];
    }
  }

  async findAgentByCapability(capability: string): Promise<MeshAgent | null> {
    const agents = await this.listAgents();
    return agents.find(a => 
      a.capabilities.includes(capability) && a.status === 'online'
    ) || null;
  }

  onMessage(handler: (msg: MeshMessage) => void): () => void {
    this.messageHandlers.push(handler);
    // Return unsubscribe function for cleanup
    return () => {
      const idx = this.messageHandlers.indexOf(handler);
      if (idx !== -1) this.messageHandlers.splice(idx, 1);
    };
  }

  removeMessageHandler(handler: (msg: MeshMessage) => void): void {
    const idx = this.messageHandlers.indexOf(handler);
    if (idx !== -1) this.messageHandlers.splice(idx, 1);
  }

  clearMessageHandlers(): void {
    this.messageHandlers = [];
  }

  isConnected(): boolean {
    return this.connected;
  }

  getAgentId(): string {
    return this.agentId;
  }

  async disconnect(): Promise<void> {
    this.clearMessageHandlers();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected = false;
  }
}

export default AgentMesh;
