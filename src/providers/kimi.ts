import { Provider } from './manager.js';

export class KimiProvider implements Provider {
  name = 'kimi';
  defaultModel = 'k2p5';
  // Kimi/Moonshot uses api.moonshot.cn - NOT api.kimi.com
  baseUrl = 'https://api.moonshot.cn/coding/v1';
  private retryDelays = [500, 1000, 2000, 4000];
  private requestTimeoutMs = parseInt(process.env.DUCK_KIMI_TIMEOUT_MS || '45000', 10);

  constructor(private apiKey: string) {
    if (!apiKey || apiKey.length < 10) {
      console.warn('[Kimi] ⚠️ API key appears invalid (too short)');
    }
  }

  private parseRetryAfterMs(value: string | null): number | undefined {
    if (!value) return undefined;
    const seconds = Number(value);
    if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
    const dateMs = Date.parse(value);
    if (Number.isFinite(dateMs)) return Math.max(0, dateMs - Date.now());
    return undefined;
  }

  private trimErrorBody(text: string, limit = 300): string {
    const clean = String(text || '').replace(/\s+/g, ' ').trim();
    return clean.length > limit ? clean.slice(0, limit) + '…' : clean;
  }

  private isRetryableNetworkError(message: string): boolean {
    const m = String(message || '').toLowerCase();
    return m.includes('timeout') ||
      m.includes('timed out') ||
      m.includes('econnreset') ||
      m.includes('etimedout') ||
      m.includes('socket') ||
      m.includes('network') ||
      m.includes('fetch failed') ||
      m.includes('connection');
  }

  async complete(opts: { model?: string; messages: any[] }): Promise<{ text?: string; error?: string }> {
    const makeRequest = async (): Promise<{ text?: string; error?: string; retry?: boolean; waitMs?: number }> => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.requestTimeoutMs);
      try {
        const model = opts.model || this.defaultModel;
        const res = await fetch(`${this.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
            'User-Agent': 'duck-cli/1.0'
          },
          body: JSON.stringify({ model, messages: opts.messages, stream: false }),
          signal: controller.signal,
        });

        if (res.status === 429) {
          const waitMs = this.parseRetryAfterMs(res.headers.get('Retry-After'));
          console.warn(`[Kimi] ⚠️ Rate limited (429), ${waitMs ? `waiting ${waitMs}ms` : 'will retry with backoff'}`);
          return { error: 'Kimi API rate limited (429)', retry: true, waitMs };
        }

        if (!res.ok) {
          const err = this.trimErrorBody(await res.text());
          if (res.status === 401 || res.status === 403) {
            return { error: `Kimi API auth failed (${res.status}): check your KIMI_API_KEY / account access` };
          }
          const isRetryable = res.status >= 500 || res.status === 408 || res.status === 409 || res.status === 429;
          return { error: `Kimi API ${res.status}: ${err || 'request failed'}`, retry: isRetryable };
        }

        const data: any = await res.json();
        const text = data.choices?.[0]?.message?.content;
        if (!text) {
          return { error: 'Kimi returned no completion text', retry: false };
        }
        return { text };
      } catch (e: any) {
        const message = e?.name === 'AbortError'
          ? `Kimi request timed out after ${this.requestTimeoutMs}ms`
          : (e?.message || String(e));
        return { error: message, retry: this.isRetryableNetworkError(message) };
      } finally {
        clearTimeout(timeout);
      }
    };

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
      if (result.error && !result.retry) {
        return { error: result.error };
      }
      if (attempt === this.retryDelays.length) {
        return { error: result.error || 'Kimi request failed after retries' };
      }
      if (result.waitMs && result.waitMs > 0) {
        await new Promise(resolve => setTimeout(resolve, result.waitMs));
      }
    }

    return { error: 'Kimi request failed after retries' };
  }
}
