/**
 * Duck Agent Sub-Conscious - Daemon Client
 * Communicates with the Sub-Conscious daemon (subconsciousd)
 * NO external Letta dependency
 */

import { EventEmitter } from 'events';

export interface TranscriptSegment {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
}

export interface StoredMemory {
  id: string;
  content: string;
  context: string;
  tags: string[];
  importance: number;
  source: string;
  sessionId?: string;
  topic?: string;
  createdAt: string;
  accessedAt: string;
  accessCount: number;
}

export interface WhisperResponse {
  whisper: string | null;
  memories: Pick<StoredMemory, 'id' | 'content' | 'source' | 'importance'>[];
}

export interface CouncilMemory {
  id: string;
  councilor_id: string;
  topic: string;
  deliberation: string;
  insight: string;
  tags: string[];
  created_at: string;
}

const DEFAULT_PORT = 4001;
const BASE_URL = `http://localhost:${DEFAULT_PORT}`;

/**
 * Sub-Conscious Client
 * Used by CLI commands to interact with the daemon
 */
export class SubconsciousClient extends EventEmitter {
  private port: number;
  private baseUrl: string;
  private daemonUrl: string;

  constructor(port = DEFAULT_PORT) {
    super();
    this.port = port;
    this.baseUrl = `http://localhost:${port}`;
    this.daemonUrl = process.env.SUBCONSCIOUS_URL || this.baseUrl;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.daemonUrl}${path}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    if (!response.ok) {
      throw new Error(`Sub-Conscious daemon error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Check if daemon is running
   */
  async ping(): Promise<boolean> {
    try {
      await this.request<{ status: string }>('/health');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Send session transcript for async LLM analysis
   */
  async sendSession(sessionId: string, transcript: TranscriptSegment[], cwd?: string): Promise<void> {
    await this.request('/session', {
      method: 'POST',
      body: JSON.stringify({ sessionId, transcript, cwd })
    });
  }

  /**
   * Get whisper for current context (called before prompts)
   */
  async getWhisper(
    message?: string,
    recentTopics?: string[],
    count = 5
  ): Promise<WhisperResponse> {
    const params = new URLSearchParams();
    if (message) params.set('message', message);
    if (recentTopics?.length) params.set('topics', recentTopics.join(','));
    params.set('count', String(count));

    return this.request<WhisperResponse>(`/whisper?${params.toString()}`);
  }

  /**
   * Recall relevant memories
   */
  async recall(query: string, limit = 20): Promise<{ memories: StoredMemory[]; count: number }> {
    const params = new URLSearchParams({ q: query, limit: String(limit) });
    return this.request(`/recall?${params.toString()}`);
  }

  /**
   * Get recent memories
   */
  async getRecent(limit = 20): Promise<{ memories: StoredMemory[]; count: number }> {
    return this.request<any>(`/recent?limit=${limit}`);
  }

  /**
   * Get council-specific memories
   */
  async getCouncilMemories(topic: string, limit = 10): Promise<{ memories: CouncilMemory[]; count: number }> {
    const params = new URLSearchParams({ topic, limit: String(limit) });
    return this.request<any>(`/council?${params.toString()}`);
  }

  /**
   * Store council deliberation memory
   */
  async storeCouncilMemory(
    sessionId: string,
    topic: string,
    councilorId: string,
    deliberation: string
  ): Promise<{ insight: string; tags: string[] }> {
    return this.request('/council', {
      method: 'POST',
      body: JSON.stringify({ sessionId, topic, councilorId, deliberation })
    });
  }

  /**
   * Get daemon stats
   */
  async getStats(): Promise<{ 
    stats: { total: number; bySource: Record<string, number>; oldest: string | null; newest: string | null };
    recentMemories: number;
  }> {
    return this.request('/stats');
  }

  /**
   * Delete a memory
   */
  async deleteMemory(id: string): Promise<void> {
    await this.request(`/memory/${id}`, { method: 'DELETE' });
  }

  /**
   * Clear all memories
   */
  async clear(): Promise<void> {
    await this.request('/clear', { method: 'POST' });
  }

  /**
   * Get daemon URL
   */
  getDaemonUrl(): string {
    return this.daemonUrl;
  }
}

// Singleton instance
let instance: SubconsciousClient | null = null;

export function getSubconsciousClient(port = DEFAULT_PORT): SubconsciousClient {
  if (!instance) {
    instance = new SubconsciousClient(port);
  }
  return instance;
}
