/**
 * SmartRouter - Auto-failover model router
 * Tries each provider/model in priority order until one succeeds
 */

export interface RouterTarget {
  provider: string;   // 'kimi', 'minimax', 'openrouter', 'lmstudio', etc.
  model?: string;      // Optional model override (uses provider default if not set)
  label?: string;      // Human-readable name for logging
}

export interface RouterOptions {
  targets: RouterTarget[];
  timeout?: number;    // Per-request timeout in ms (default: 60000)
  verbose?: boolean;   // Log which providers are being tried
}

export class SmartRouter {
  private providers: Map<string, Provider> = new Map();

  constructor(private opts: RouterOptions) {}

  /**
   * Register a provider instance to use for routing
   */
  register(provider: Provider) {
    this.providers.set(provider.name, provider);
  }

  /**
   * Try each target in order until one succeeds
   */
  async complete(prompt: string, messages?: any[]): Promise<{ text: string; provider: string; model: string }> {
    const { targets, timeout = 60000, verbose = false } = this.opts;

    const msgList = messages || [{ role: 'user', content: prompt }];

    for (const target of targets) {
      const prov = this.providers.get(target.provider);
      if (!prov) {
        if (verbose) console.log(`[Router] ${target.provider} not available, skipping`);
        continue;
      }

      const model = target.model || (prov as any).defaultModel || 'default';
      const label = target.label || `${target.provider}/${model}`;

      // Guard: ensure provider has complete method
      if (typeof prov.complete !== 'function') {
        if (verbose) console.log(`[Router] ${target.provider} has no complete method, skipping`);
        continue;
      }

      if (verbose) console.log(`[Router] Trying ${label}...`);

      try {
        const result = await this.withTimeout(
          prov.complete({ model, messages: msgList }),
          timeout
        );

        // Handle empty string as valid response (check !== undefined, not falsy)
        if (result.text !== undefined && !result.error) {
          if (verbose) console.log(`[Router] ✅ ${label} succeeded`);
          return { text: result.text, provider: target.provider, model };
        }

        if (verbose) console.log(`[Router] ❌ ${label} failed: ${result.error}`);
      } catch (e: any) {
        if (verbose) console.log(`[Router] ❌ ${label} threw: ${e.message}`);
      }
    }

    throw new Error('All router targets failed');
  }

  private withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms);
      promise.then(r => { clearTimeout(timer); resolve(r); }, e => { clearTimeout(timer); reject(e); });
    });
  }
}

export interface Provider {
  name: string;
  complete(opts: { model?: string; messages: any[] }): Promise<{ text?: string; error?: string }>;
}
