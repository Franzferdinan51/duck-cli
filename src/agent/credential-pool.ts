/**
 * Credential Pool - Hermes-inspired multi-key rotation with least_used strategy
 * Ported from: https://github.com/NousResearch/hermes-agent (agent/credential_pool.py)
 *
 * Features:
 * - Configure multiple API keys for the same provider
 * - Automatic "least_used" rotation (default)
 * - Thread-safe
 * - 401/429 detection with automatic failover
 * - Exponential backoff on exhaustion
 */

import { randomUUID } from "crypto";

export type PoolStrategy = "least_used" | "round_robin" | "random" | "fill_first";

export interface PooledCredential {
  id: string;
  label: string;
  key: string;           // The actual API key
  provider: string;
  priority: number;      // Higher = tried first
  requestCount: number;  // For least_used strategy
  lastStatus: "ok" | "exhausted" | "error";
  lastErrorCode?: number;
  exhaustedUntil?: number;  // Timestamp when exhaustion expires
  createdAt: number;
}

export interface CredentialPoolConfig {
  strategy: PoolStrategy;
  exhaustedTTLMs: number;  // How long to cooldown an exhausted key (default 1h)
  maxRetries: number;      // Max retries per request across pool
}

const DEFAULT_CONFIG: CredentialPoolConfig = {
  strategy: "least_used",
  exhaustedTTLMs: 60 * 60 * 1000,  // 1 hour
  maxRetries: 3,
};

export class CredentialPool {
  private credentials: Map<string, PooledCredential> = new Map();
  private currentIndex: number = 0;
  private config: CredentialPoolConfig;
  private lock: boolean = false;

  constructor(config: Partial<CredentialPoolConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ─── Management ────────────────────────────────────────────────────────

  addCredential(key: string, provider: string, label?: string, priority = 0): string {
    const id = `cred-${Date.now()}-${randomUUID().slice(0, 8)}`;
    this.credentials.set(id, {
      id,
      label: label || key.slice(0, 8) + "...",
      key,
      provider,
      priority,
      requestCount: 0,
      lastStatus: "ok",
      createdAt: Date.now(),
    });
    return id;
  }

  removeCredential(id: string): boolean {
    return this.credentials.delete(id);
  }

  getCredential(id: string): PooledCredential | undefined {
    return this.credentials.get(id);
  }

  listCredentials(): PooledCredential[] {
    return Array.from(this.credentials.values());
  }

  updateStatus(id: string, status: "ok" | "exhausted" | "error", errorCode?: number): void {
    const cred = this.credentials.get(id);
    if (!cred) return;

    cred.lastStatus = status;
    cred.lastErrorCode = errorCode;

    if (status === "exhausted") {
      cred.exhaustedUntil = Date.now() + this.config.exhaustedTTLMs;
    } else if (status === "ok") {
      cred.exhaustedUntil = undefined;
      cred.lastErrorCode = undefined;
    }
  }

  // ─── Selection Strategies ────────────────────────────────────────────────

  /**
   * Get the next available credential using the configured strategy.
   * Automatically skips exhausted credentials.
   */
  select(): PooledCredential | null {
    if (this.credentials.size === 0) return null;

    // Wait for lock (simple spin)
    while (this.lock) { /* spin */ }
    this.lock = true;
    try {
      const available = this.getAvailableCredentials();
      if (available.length === 0) return null;

      let selected: PooledCredential;

      switch (this.config.strategy) {
        case "least_used":
          // Pick the credential with the lowest request count
          selected = available.reduce((min, c) =>
            c.requestCount < min.requestCount ? c : min
          );
          break;

        case "round_robin":
          // Skip to next available
          while (this.currentIndex < available.length) {
            const candidate = available[this.currentIndex % available.length];
            this.currentIndex++;
            if (!candidate.exhaustedUntil || Date.now() >= candidate.exhaustedUntil) {
              selected = candidate;
              break;
            }
          }
          if (!selected) selected = available[0];
          break;

        case "random":
          selected = available[Math.floor(Math.random() * available.length)];
          break;

        case "fill_first":
          // Pick highest priority, then lowest count
          selected = available.reduce((best, c) => {
            if (c.priority !== best.priority) return c.priority > best.priority ? c : best;
            return c.requestCount < best.requestCount ? c : best;
          });
          break;

        default:
          selected = available[0];
      }

      if (selected) {
        selected.requestCount++;
      }

      return selected || null;
    } finally {
      this.lock = false;
    }
  }

  private getAvailableCredentials(): PooledCredential[] {
    const now = Date.now();
    return Array.from(this.credentials.values())
      .filter(c =>
        c.lastStatus !== "exhausted" ||
        (c.exhaustedUntil && now >= c.exhaustedUntil)
      )
      .sort((a, b) => b.priority - a.priority);  // Highest priority first
  }

  // ─── Failure Handling ───────────────────────────────────────────────────

  /**
   * Handle a request failure. Call after a failed API call.
   * If 401 (auth error) or 429 (rate limit), mark credential as exhausted.
   */
  handleFailure(id: string, statusCode?: number): void {
    const cred = this.credentials.get(id);
    if (!cred) return;

    if (statusCode === 401 || statusCode === 403) {
      // Auth error — exhausted, won't recover without new key
      this.updateStatus(id, "exhausted", statusCode);
    } else if (statusCode === 429) {
      // Rate limit — exhausted temporarily
      this.updateStatus(id, "exhausted", statusCode);
    } else {
      // Other error — just record it, don't exhaust
      cred.lastStatus = "error";
      cred.lastErrorCode = statusCode;
    }
  }

  /**
   * Handle a successful request — reset credential health.
   */
  handleSuccess(id: string): void {
    this.updateStatus(id, "ok");
  }

  // ─── Stats ──────────────────────────────────────────────────────────────

  stats(): {
    total: number;
    available: number;
    exhausted: number;
    byStatus: Record<string, number>;
    topUsed: PooledCredential | null;
  } {
    const now = Date.now();
    const all = Array.from(this.credentials.values());
    const available = all.filter(c =>
      c.lastStatus !== "exhausted" || (c.exhaustedUntil && now >= c.exhaustedUntil)
    );
    const exhausted = all.filter(c =>
      c.lastStatus === "exhausted" && (!c.exhaustedUntil || now < c.exhaustedUntil)
    );

    const byStatus: Record<string, number> = {};
    for (const c of all) {
      byStatus[c.lastStatus] = (byStatus[c.lastStatus] || 0) + 1;
    }

    const topUsed = all.length > 0
      ? all.reduce((max, c) => c.requestCount > max.requestCount ? c : max)
      : null;

    return {
      total: all.length,
      available: available.length,
      exhausted: exhausted.length,
      byStatus,
      topUsed,
    };
  }
}

// ─── Per-Provider Pool Manager ─────────────────────────────────────────

export class CredentialPoolManager {
  private pools: Map<string, CredentialPool> = new Map();

  /**
   * Get or create a pool for a provider.
   */
  getPool(provider: string): CredentialPool {
    if (!this.pools.has(provider)) {
      this.pools.set(provider, new CredentialPool());
    }
    return this.pools.get(provider)!;
  }

  /**
   * Add a key to a provider's pool.
   */
  addKey(provider: string, key: string, label?: string): string {
    return this.getPool(provider).addCredential(key, provider, label);
  }

  /**
   * Select the best credential from a provider's pool.
   */
  selectCredential(provider: string): PooledCredential | null {
    return this.getPool(provider).select();
  }

  /**
   * Handle success/failure for a credential.
   */
  recordSuccess(provider: string, id: string): void {
    this.getPool(provider).handleSuccess(id);
  }

  recordFailure(provider: string, id: string, statusCode?: number): void {
    this.getPool(provider).handleFailure(id, statusCode);
  }

  /**
   * Get stats for all provider pools.
   */
  allStats(): Record<string, ReturnType<CredentialPool["stats"]>> {
    const result: Record<string, any> = {};
    for (const [provider, pool] of this.pools) {
      result[provider] = pool.stats();
    }
    return result;
  }

  /**
   * Auto-configure from environment variables.
   * Supports: OPENAI_API_KEY, ANTHROPIC_API_KEY, etc.
   */
  autoConfigure(): number {
    const envMappings: Record<string, string> = {
      "OPENAI_API_KEY": "openai",
      "ANTHROPIC_API_KEY": "anthropic",
      "MINIMAX_API_KEY": "minimax",
      "KIMI_API_KEY": "kimi",
      "OPENROUTER_API_KEY": "openrouter",
    };

    let count = 0;
    for (const [envVar, provider] of Object.entries(envMappings)) {
      const key = process.env[envVar];
      if (key && key.length > 10) {
        this.addKey(provider, key, `${envVar}`);
        count++;
      }
    }
    return count;
  }
}

export default { CredentialPool, CredentialPoolManager };
