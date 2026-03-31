/**
 * src/rl/rl-client.ts
 * OpenClaw-RL Client
 *
 * Connects Duck Agent to the OpenClaw-RL server.
 * Handles session tracking, turn classification, and chat completions.
 *
 * This is the integration layer between Duck Agent and OpenClaw-RL's
 * OpenAI-compatible API server.
 */

import type { RLConfig } from './config.js';
import { buildRLHeaders, getRLEndpoint, getRLHealthEndpoint, loadRLConfig } from './config.js';

export interface RLMessage {
  role: 'system' | 'user' | 'assistant' | 'tool' | 'developer';
  content: string;
  name?: string;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
}

export interface RLChatOptions {
  messages: RLMessage[];
  model?: string;
  sessionId?: string;
  turnType?: 'main' | 'side';
  sessionDone?: boolean;
  stream?: boolean;
  tools?: unknown[];
  temperature?: number;
  maxTokens?: number;
}

export interface RLChatResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: RLMessage;
    finish_reason: string;
    logprobs?: {
      content: Array<{ logprob: number; token: string }>;
    };
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  session_id?: string;
}

export interface RLTurnScore {
  sessionId: string;
  turnNumber: number;
  score: number;      // +1 (good), -1 (bad), 0 (neutral)
  votes: string[];
  representative?: string;
  timestamp: string;
}

export interface RLStats {
  enabled: boolean;
  serverUrl: string;
  method: string;
  connected: boolean;
  sessionsSeen: number;
  turnsSubmitted: number;
  lastScore: number | null;
  averageScore: number;
  recentScores: number[];
}

export class RLClient {
  private config: RLConfig;
  private sessionId: string = '';
  private turnCount: number = 0;
  private sessionsSeen: number = 0;
  private turnsSubmitted: number = 0;
  private recentScores: number[] = [];
  private lastHealthCheck: number = 0;
  private healthCache: Map<string, { ok: boolean; ts: number }> = new Map();

  constructor(config?: Partial<RLConfig>) {
    this.config = { ...config } as RLConfig;
  }

  /**
   * Load config from disk and return a new RLClient instance.
   */
  static async fromConfig(configPath?: string): Promise<RLClient> {
    const config = await loadRLConfig(configPath);
    return new RLClient(config);
  }

  /** Get current config */
  getConfig(): RLConfig {
    return { ...this.config };
  }

  /** Update config */
  updateConfig(updates: Partial<RLConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  /** Is RL enabled? */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /** Generate or continue a session ID */
  getSessionId(): string {
    if (!this.sessionId) {
      this.sessionId = this.generateSessionId();
    }
    return this.sessionId;
  }

  /** Start a new conversation session */
  startSession(): string {
    this.sessionId = this.generateSessionId();
    this.turnCount = 0;
    this.sessionsSeen++;
    return this.sessionId;
  }

  /** Mark current session as done */
  endSession(): void {
    this.sessionId = '';
    this.turnCount = 0;
  }

  private generateSessionId(): string {
    return `duck-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  }

  private get turnNumber(): number {
    return ++this.turnCount;
  }

  /**
   * Check if the RL server is healthy.
   * Uses a 30-second cache to avoid hammering the server.
   */
  async checkHealth(): Promise<boolean> {
    if (!this.config.enabled || !this.config.serverUrl) {
      return false;
    }

    const now = Date.now();
    const cached = this.healthCache.get(this.config.serverUrl);
    if (cached && now - cached.ts < 30_000) {
      return cached.ok;
    }

    try {
      const response = await fetch(getRLHealthEndpoint(this.config), {
        method: 'GET',
        signal: AbortSignal.timeout(5_000),
      });
      const ok = response.status === 200;
      this.healthCache.set(this.config.serverUrl, { ok, ts: now });
      this.lastHealthCheck = now;
      return ok;
    } catch {
      this.healthCache.set(this.config.serverUrl, { ok: false, ts: now });
      return false;
    }
  }

  /**
   * Send a chat completion request through the RL server.
   * This is the main integration point - wraps the OpenAI-compatible API
   * with RL-specific headers and session tracking.
   *
   * @param options.chat - Chat messages
   * @param options.sessionId - Override session ID (auto-generated if not provided)
   * @param options.turnType - 'main' = trainable, 'side' = non-trainable
   * @param options.sessionDone - True if this is the final turn of the session
   */
  async chat(options: RLChatOptions): Promise<RLChatResponse> {
    const {
      messages,
      sessionId,
      turnType = 'main',
      sessionDone = false,
      stream = false,
      tools,
      temperature,
      maxTokens,
    } = options;

    const sid = sessionId || this.getSessionId();
    const endpoint = getRLEndpoint(this.config);
    const headers: Record<string, string> = {
      ...buildRLHeaders(sid, turnType, sessionDone),
    };

    // Add auth header if API key is set
    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    const body: Record<string, unknown> = {
      model: 'qwen3-8b', // Default model served by OpenClaw-RL
      messages,
      stream,
    };

    if (tools) body.tools = tools;
    if (temperature !== undefined) body.temperature = temperature;
    if (maxTokens) body.max_tokens = maxTokens;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(120_000),
      });

      if (response.status !== 200) {
        const text = await response.text();
        throw new Error(`RL server returned ${response.status}: ${text}`);
      }

      const data = await response.json() as RLChatResponse;
      data.session_id = sid;

      // Track turn submission for stats
      if (turnType === 'main') {
        this.turnsSubmitted++;
      }

      return data;
    } catch (err) {
      // If RL fails, surface the error clearly
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`[RL] Chat failed: ${message}. Is the RL server running at ${endpoint}?`);
    }
  }

  /**
   * Record a turn score from PRM evaluation.
   * Called by TrainingManager when PRM scores come back.
   */
  recordScore(sessionId: string, turnNumber: number, score: number, votes?: string[], representative?: string): void {
    this.recentScores.push(score);
    // Keep last 100 scores
    if (this.recentScores.length > 100) {
      this.recentScores.shift();
    }
  }

  /**
   * Get current RL stats.
   */
  getStats(): RLStats {
    const avg = this.recentScores.length > 0
      ? this.recentScores.reduce((a, b) => a + b, 0) / this.recentScores.length
      : 0;

    return {
      enabled: this.config.enabled,
      serverUrl: this.config.serverUrl || '(not connected)',
      method: this.config.method,
      connected: this.config.enabled && this.config.serverUrl !== '',
      sessionsSeen: this.sessionsSeen,
      turnsSubmitted: this.turnsSubmitted,
      lastScore: this.recentScores.length > 0 ? this.recentScores[this.recentScores.length - 1] : null,
      averageScore: Math.round(avg * 100) / 100,
      recentScores: [...this.recentScores],
    };
  }

  /**
   * Reset stats (useful after a training run).
   */
  resetStats(): void {
    this.sessionsSeen = 0;
    this.turnsSubmitted = 0;
    this.recentScores = [];
  }

  /**
   * Classify a turn for RL training eligibility.
   *
   * Main-line turns (return 'main'):
   *   - Direct user/assistant conversation exchanges
   *   - Task-oriented conversations that can be learned from
   *
   * Side turns (return 'side'):
   *   - System commands, heartbeats, meta-queries
   *   - Non-trainable interactions (tool use for infra ops, etc.)
   *
   * Override via explicit parameter when calling chat().
   */
  classifyTurn(messages: RLMessage[]): 'main' | 'side' {
    if (messages.length === 0) return 'side';

    const lastMsg = messages[messages.length - 1];
    if (lastMsg.role !== 'user') return 'main';

    const content = (lastMsg.content || '').toLowerCase();

    // Meta/system patterns that should not be trained on
    const sidePatterns = [
      '/',                              // CLI commands
      'heartbeat',                      // System heartbeats
      'status',                         // Status checks
      'are you there',                  // Presence checks
      'ping',                           // Connectivity pings
      'health',                         // Health checks
    ];

    for (const pattern of sidePatterns) {
      if (content.startsWith(pattern) || content === pattern) {
        return 'side';
      }
    }

    return 'main';
  }
}
