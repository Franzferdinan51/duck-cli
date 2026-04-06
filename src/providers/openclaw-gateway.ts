import { Provider } from './manager.js';

/**
 * OpenClaw Gateway provider - routes through local OpenClaw gateway
 * Gives duck-cli access to OpenClaw's providers (Moonshot/kimi-k2.5, etc.)
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
          console.warn(`[OpenClawGateway] ⚠️  Rate limited (429), ${waitMs ? `waiting ${waitMs}ms` : 'will retry with backoff'}`);
          return { error: '__RETRY__', retry: true };
        }

        if (!res.ok) {
          const err = await res.text();
          // 401 = auth failure, 403 = forbidden - don't retry
          if (res.status === 401 || res.status === 403) {
            return { error: `Gateway ${res.status}: ${err}` };
          }
          // Server errors are retryable
          const isRetryable = res.status >= 500 || res.status === 408;
          return { error: `Gateway ${res.status}: ${err}`, retry: isRetryable };
        }

        const data: any = await res.json();
        const content = data.choices?.[0]?.message?.content;

        if (!content || content.includes('All providers failed')) {
          return { error: 'OpenClaw gateway: all upstream providers failed' };
        }

        return { text: content };
      } catch (e: any) {
        const isRetryable = e.message?.includes('Connection') ||
                           e.message?.includes('timeout') ||
                           e.message?.includes('ECONNRESET') ||
                           e.message?.includes('ETIMEDOUT') ||
                           e.message?.includes('fetch') ||
                           e.message?.includes('ENOTFOUND');
        return { error: `Connection failed: ${e.message}`, retry: isRetryable };
      }
    };

    // Retry with exponential backoff
    for (let attempt = 0; attempt <= this.retryDelays.length; attempt++) {
      if (attempt > 0) {
        const delay = this.retryDelays[attempt - 1];
        console.log(`[OpenClawGateway] Retry ${attempt}/${this.retryDelays.length} after ${delay}ms...`);
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
        return { error: result.error || 'Gateway request failed after retries' };
      }
    }

    return { error: 'Gateway request failed after retries' };
  }
}
