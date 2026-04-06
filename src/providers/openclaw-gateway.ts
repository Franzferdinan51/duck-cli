import { Provider } from './manager.js';

/**
 * Duck Gateway provider - routes through duck-cli's built-in gateway (port 18792).
 * The built-in gateway proxies to external LLMs (kimi-k2.5, etc.).
 * Named 'openclaw' for historical/backward-compatibility reasons —
 * this does NOT require an external OpenClaw installation.
 */
export class OpenClawGatewayProvider implements Provider {
  name = 'openclaw';
  defaultModel = 'kimi-k2.5';
  private retryDelays = [500, 1000, 2000]; // Shorter delays for local gateway

  constructor(private gatewayUrl = 'http://localhost:18792') {}

  async complete(opts: { model?: string; messages: any[] }): Promise<{ text?: string; error?: string }> {
    const makeRequest = async (): Promise<{ text?: string; error?: string; retry?: boolean }> => {
      try {
        const model = opts.model || this.defaultModel;

        const res = await fetch(`${this.gatewayUrl}/v1/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model, messages: opts.messages, stream: false })
        });

        // Handle rate limiting (HTTP 429)
        if (res.status === 429) {
          const retryAfter = res.headers.get('Retry-After');
          const waitMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : undefined;
          console.warn(`[DuckGateway] ⚠️  Rate limited (429), ${waitMs ? `waiting ${waitMs}ms` : 'will retry with backoff'}`);
          return { error: '__RETRY__', retry: true };
        }

        if (!res.ok) {
          const err = await res.text();
          // 401 = auth failure, 403 = forbidden - don't retry
          if (res.status === 401 || res.status === 403) {
            return { error: `Duck Gateway ${res.status}: ${err}` };
          }
          // Server errors are retryable
          const isRetryable = res.status >= 500 || res.status === 408;
          return { error: `Gateway ${res.status}: ${err}`, retry: isRetryable };
        }

        const data: any = await res.json();
        const content = data.choices?.[0]?.message?.content;

        if (!content || content.includes('All providers failed')) {
          return { error: 'Duck Gateway: all upstream providers failed' };
        }

        return { text: content };
      } catch (e: any) {
        const isRetryable = e.message?.includes('Connection') ||
                           e.message?.includes('timeout') ||
                           e.message?.includes('ECONNRESET') ||
                           e.message?.includes('ETIMEDOUT') ||
                           e.message?.includes('fetch') ||
                           e.message?.includes('ENOTFOUND');
        return { error: `Duck Gateway connection failed: ${e.message}`, retry: isRetryable };
      }
    };

    // Retry with exponential backoff
    for (let attempt = 0; attempt <= this.retryDelays.length; attempt++) {
      if (attempt > 0) {
        const delay = this.retryDelays[attempt - 1];
        console.log(`[DuckGateway] Retry ${attempt}/${this.retryDelays.length} after ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      const result = await makeRequest();
      if (result.text !== undefined) {
        return { text: result.text };
      }
      if (result.error && !result.retry) {
        return { error: result.error };
      }
      if (attempt === this.retryDelays.length) {
        return { error: result.error || 'Duck Gateway request failed after retries' };
      }
    }

    return { error: 'Gateway request failed after retries' };
  }
}
