/**
 * 🦆 Duck Agent - Rate Limiter
 * Per-tool rate limiting with environment variable configuration
 * 
 * Usage: DUCK_RATE_LIMIT_<TOOL>=60 (calls per minute)
 */

export interface RateLimitConfig {
  maxCalls: number;     // max calls per window
  windowMs: number;      // window in milliseconds
}

export interface RateLimitResult {
  allowed: boolean;
  waitMs?: number;
  remaining: number;
  resetMs: number;
}

interface ToolBucket {
  calls: number[];
  lastReset: number;
}

export class RateLimiter {
  private buckets: Map<string, ToolBucket> = new Map();
  private defaultConfig: RateLimitConfig = { maxCalls: 60, windowMs: 60000 };
  private toolConfigs: Map<string, RateLimitConfig> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    this.loadFromEnv();
    // Cleanup old buckets every 5 minutes
    this.cleanupInterval = setInterval(() => this.cleanup(), 300000);
  }

  /**
   * Load rate limits from environment variables
   * Format: DUCK_RATE_LIMIT_<TOOL>=60 (calls per minute)
   */
  private loadFromEnv() {
    for (const [key, value] of Object.entries(process.env)) {
      const match = key.match(/^DUCK_RATE_LIMIT_(.+)$/);
      if (match) {
        const toolName = match[1].toLowerCase();
        const calls = parseInt(value || '60', 10);
        if (!isNaN(calls) && calls > 0) {
          this.toolConfigs.set(toolName, {
            maxCalls: calls,
            windowMs: 60000, // 1 minute window
          });
        }
      }
    }
  }

  /**
   * Get config for a specific tool (or default)
   */
  getConfig(toolName: string): RateLimitConfig {
    return this.toolConfigs.get(toolName.toLowerCase()) || this.defaultConfig;
  }

  /**
   * Update rate limit for a tool at runtime
   */
  setLimit(toolName: string, maxCalls: number, windowMs: number = 60000) {
    this.toolConfigs.set(toolName.toLowerCase(), { maxCalls, windowMs });
  }

  /**
   * Check if a call to a tool is allowed
   */
  checkLimit(toolName: string): RateLimitResult {
    const config = this.getConfig(toolName);
    const bucket = this.getOrCreateBucket(toolName, config);
    const now = Date.now();

    // Reset if window has passed
    if (now - bucket.lastReset >= config.windowMs) {
      bucket.calls = [];
      bucket.lastReset = now;
    }

    // Count calls in current window
    const activeCalls = bucket.calls.filter(t => now - t < config.windowMs).length;
    bucket.calls = bucket.calls.filter(t => now - t < config.windowMs);

    if (activeCalls >= config.maxCalls) {
      const oldestCall = Math.min(...bucket.calls);
      const waitMs = config.windowMs - (now - oldestCall);
      return {
        allowed: false,
        waitMs: Math.max(0, waitMs),
        remaining: 0,
        resetMs: bucket.lastReset + config.windowMs,
      };
    }

    return {
      allowed: true,
      remaining: config.maxCalls - activeCalls - 1,
      resetMs: bucket.lastReset + config.windowMs,
    };
  }

  /**
   * Record a tool call (call after checkLimit returns allowed)
   */
  record(toolName: string): void {
    const config = this.getConfig(toolName);
    const bucket = this.getOrCreateBucket(toolName, config);
    bucket.calls.push(Date.now());
  }

  /**
   * Get current usage stats for a tool
   */
  getStats(toolName: string): { used: number; limit: number; remaining: number; resetIn: number } {
    const config = this.getConfig(toolName);
    const bucket = this.getOrCreateBucket(toolName, config);
    const now = Date.now();
    const activeCalls = bucket.calls.filter(t => now - t < config.windowMs).length;
    const oldestCall = bucket.calls.length > 0 ? Math.min(...bucket.calls) : now;

    return {
      used: activeCalls,
      limit: config.maxCalls,
      remaining: Math.max(0, config.maxCalls - activeCalls),
      resetIn: Math.max(0, config.windowMs - (now - oldestCall)),
    };
  }

  /**
   * List all tools with configured limits
   */
  listTools(): Map<string, RateLimitConfig> {
    return new Map(this.toolConfigs);
  }

  private getOrCreateBucket(toolName: string, config: RateLimitConfig): ToolBucket {
    let bucket = this.buckets.get(toolName.toLowerCase());
    if (!bucket) {
      bucket = { calls: [], lastReset: Date.now() };
      this.buckets.set(toolName.toLowerCase(), bucket);
    }
    return bucket;
  }

  private cleanup() {
    const now = Date.now();
    for (const [name, bucket] of Array.from(this.buckets.entries())) {
      const config = this.getConfig(name);
      // Remove calls outside the window
      bucket.calls = bucket.calls.filter(t => now - t < config.windowMs);
      // Remove empty buckets
      if (bucket.calls.length === 0 && now - bucket.lastReset > config.windowMs * 2) {
        this.buckets.delete(name);
      }
    }
  }

  destroy() {
    clearInterval(this.cleanupInterval);
  }
}

// Singleton instance
let rateLimiterInstance: RateLimiter | null = null;

export function getRateLimiter(): RateLimiter {
  if (!rateLimiterInstance) {
    rateLimiterInstance = new RateLimiter();
  }
  return rateLimiterInstance;
}
