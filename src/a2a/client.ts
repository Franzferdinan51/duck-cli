/**
 * 🦆 Duck Agent - A2A Client
 * Connect to and interact with remote A2A agents
 */

import { AgentCard, A2AMessage, A2AResponse, TaskPayload, TaskResult } from './types.js';
import { randomUUID } from 'crypto';

export class A2AClient {
  private agentUrl: string;
  private authHeader?: string;

  constructor(agentUrl: string, apiKey?: string) {
    this.agentUrl = agentUrl.replace(/\/$/, '');
    if (apiKey) {
      this.authHeader = `Bearer ${apiKey}`;
    }
  }

  private async request<T>(method: string, params?: any): Promise<T> {
    const id = randomUUID();
    const message: A2AMessage = { id, method, params };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(this.authHeader && { Authorization: this.authHeader })
    };

    const response = await fetch(`${this.agentUrl}/a2a`, {
      method: 'POST',
      headers,
      body: JSON.stringify(message)
    });

    if (!response.ok) {
      throw new Error(`A2A request failed: ${response.status} ${response.statusText}`);
    }

    const result: A2AResponse = await response.json();
    if (result.error) {
      throw new Error(`A2A error: ${result.error.message}`);
    }

    return result.result;
  }

  /**
   * Get the agent's capabilities (Agent Card)
   */
  async getAgentCard(): Promise<AgentCard> {
    return this.request<AgentCard>('agent.getCard');
  }

  /**
   * Send a task to the agent
   */
  async sendTask(payload: TaskPayload): Promise<TaskResult> {
    return this.request<TaskResult>('tasks.send', { payload });
  }

  /**
   * Get task status/result
   */
  async getTask(taskId: string): Promise<TaskResult> {
    return this.request<TaskResult>('tasks.get', { taskId });
  }

  /**
   * Cancel a task
   */
  async cancelTask(taskId: string): Promise<TaskResult> {
    return this.request<TaskResult>('tasks.cancel', { taskId });
  }

  /**
   * Subscribe to task updates (SSE)
   */
  subscribeToTask(taskId: string, onUpdate: (result: TaskResult) => void): () => void {
    // Note: Simple URL-based subscription. Auth would require server-side proxy.
    const eventSource = new EventSource(`${this.agentUrl}/a2a/subscribe/${taskId}`);

    eventSource.onmessage = (event) => {
      try {
        const result: TaskResult = JSON.parse(event.data);
        onUpdate(result);
        if (result.status === 'completed' || result.status === 'failed') {
          eventSource.close();
        }
      } catch {}
    };

    return () => eventSource.close();
  }

  /**
   * Discover agents - get Agent Card from URL
   */
  static async discover(url: string): Promise<AgentCard | null> {
    try {
      const client = new A2AClient(url);
      return await client.getAgentCard();
    } catch (e) {
      console.error('[A2A] Agent discover failed:', e instanceof Error ? e.message : e);
      return null;
    }
  }
}

/**
 * A2A Client Registry - manage multiple agent connections
 */
export class A2AClientRegistry {
  private clients: Map<string, A2AClient> = new Map();
  private cards: Map<string, AgentCard> = new Map();

  /**
   * Add an agent by URL
   */
  async addAgent(name: string, url: string, apiKey?: string): Promise<AgentCard | null> {
    const client = new A2AClient(url, apiKey);
    try {
      const card = await client.getAgentCard();
      this.clients.set(name, client);
      this.cards.set(name, card);
      return card;
    } catch (error) {
      console.error(`[A2A] Failed to connect to ${name} at ${url}:`, error);
      return null;
    }
  }

  /**
   * Get an agent's card
   */
  getAgentCard(name: string): AgentCard | undefined {
    return this.cards.get(name);
  }

  /**
   * Get all agent cards
   */
  getAllCards(): Map<string, AgentCard> {
    return new Map(this.cards);
  }

  /**
   * Find agents by skill
   */
  findBySkill(skillName: string): Array<{ name: string; card: AgentCard }> {
    const results: Array<{ name: string; card: AgentCard }> = [];
    for (const [name, card] of this.cards) {
      if (card.skills.some(s => s.name === skillName)) {
        results.push({ name, card });
      }
    }
    return results;
  }

  /**
   * Send task to specific agent
   */
  async sendTo(name: string, payload: TaskPayload): Promise<TaskResult | null> {
    const client = this.clients.get(name);
    if (!client) return null;
    return client.sendTask(payload);
  }

  /**
   * Broadcast task to all agents
   */
  async broadcast(payload: TaskPayload): Promise<Map<string, TaskResult>> {
    const results = new Map<string, TaskResult>();
    for (const [name, client] of this.clients) {
      try {
        const result = await client.sendTask(payload);
        results.set(name, result);
      } catch (error) {
        results.set(name, {
          taskId: '',
          status: 'failed',
          error: (error as Error).message
        });
      }
    }
    return results;
  }

  /**
   * Remove an agent
   */
  removeAgent(name: string): void {
    this.clients.delete(name);
    this.cards.delete(name);
  }
}

export const a2aRegistry = new A2AClientRegistry();
