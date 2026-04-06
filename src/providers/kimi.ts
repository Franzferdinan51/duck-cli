import { Provider } from './manager.js';

export class KimiProvider implements Provider {
  name = 'kimi';
  defaultModel = 'k2p5';
  // Kimi/Moonshot uses api.moonshot.cn - NOT api.kimi.com
  baseUrl = 'https://api.moonshot.cn/coding/v1';
  private retryDelays = [500, 1000, 2000, 4000]; // Exponential backoff for 429/connection

  constructor(private apiKey: string) {
    // Validate API key format (sk-kimi-... or sk-or-v1-...)
    if (!apiKey || apiKey.length < 10) {
      console.warn('[Kimi] ⚠️  API key appears invalid (too short)');
    }
  }

  async complete(opts: { model?: string; messages: any[] }): Promise<{ text?: string; error?: string }> {
    const makeRequest = async (): Promise<{ text?: string; error?: string; retry?: boolean }> => {
      try {
        const model = opts.model || this.defaultModel;

        const res = await fetch(`${this.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
            'User-Agent': 'duck-cli/1.0'
          },
          body: JSON.stringify({ model, messages: opts.messages, stream: false })
        });

        // Handle rate limiting (HTTP 429)
        if (res.status === 429) {
          const retryAfter = res.headers.get('Retry-After');
          const waitMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : undefined;
          console.warn(`[Kimi] ⚠️  Rate limited (429), ${waitMs ? `waiting ${waitMs}ms` : 'will retry with backoff'}`);
          return { error: '__RETRY__', retry: true };
        }

        if (!res.ok) {
          const err = await res.text();
          // 401 = bad key, don't retry
          if (res.status === 401) {
            return { error: `Kimi API auth failed (401): check your KIMI_API_KEY` };
          }
          // Connection/server errors are retryable
          const isRetryable = res.status >= 500 || res.status === 408 || res.status === 429;
          return { error: `Kimi API ${res.status}: ${err}`, retry: isRetryable };
        }

        const data: any = await res.json();
        return { text: data.choices?.[0]?.message?.content };
      } catch (e: any) {
        const isRetryable = e.message?.includes('Connection') ||
                           e.message?.includes('timeout') ||
                           e.message?.includes('ECONNRESET') ||
                           e.message?.includes('ETIMEDOUT') ||
                           e.message?.includes('socket');
        return { error: e.message, retry: isRetryable };
      }
    };

    // Retry with exponential backoff
    for (let attempt = 0; attempt <= this.retryDelays.length; attempt++) {
      if (attempt > 0) {
        const delay = this.retryDelays[attempt - 1];
        console.log(`[Kimi] Retry ${attempt}/${this.retryDelays.length} after ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      const result = await makeRequest();
      if (result.text !== undefined) {
        return { text: result.text };
      }
      // Don't retry on non-retryable errors (e.g., 401 auth failure)
      if (result.error && !result.retry) {
        return { error: result.error };
      }
      // Give up after all retries exhausted
      if (attempt === this.retryDelays.length) {
        return { error: result.error || 'Kimi request failed after retries' };
      }
    }

    return { error: 'Kimi request failed after retries' };
  }
}
