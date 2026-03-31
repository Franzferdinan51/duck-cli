/**
 * Provider Manager - Multi-provider AI support + BrowserOS
 */

import { BrowserOSProvider } from './browseros';

export interface Provider {
  name: string;
  complete(opts: { model?: string; messages: any[] }): Promise<{ text?: string; toolCalls?: any[] }>;
}

export class ProviderManager {
  private providers: Map<string, Provider> = new Map();
  private browserOS: BrowserOSProvider | undefined;
  private active: Provider | undefined;

  async load(): Promise<void> {
    if (process.env.MINIMAX_API_KEY) {
      this.providers.set('minimax', new MiniMaxProvider(process.env.MINIMAX_API_KEY));
    }
    if (process.env.LMSTUDIO_URL) {
      this.providers.set('lmstudio', new LMStudioProvider(process.env.LMSTUDIO_URL, process.env.LMSTUDIO_KEY));
    }
    if (process.env.ANTHROPIC_API_KEY) {
      this.providers.set('anthropic', new AnthropicProvider(process.env.ANTHROPIC_API_KEY));
    }
    if (process.env.OPENAI_API_KEY) {
      this.providers.set('openai', new OpenAIProvider(process.env.OPENAI_API_KEY));
    }

    // BrowserOS - browser automation
    this.browserOS = new BrowserOSProvider({
      host: process.env.BROWSEROS_HOST || '127.0.0.1',
      port: parseInt(process.env.BROWSEROS_PORT || '9100'),
      
    });

    const first = Array.from(this.providers.keys())[0];
    if (first) this.active = this.providers.get(first);
  }

  /**
   * Get BrowserOS for browser automation
   */
  getBrowserOS(): BrowserOSProvider | undefined {
    return this.browserOS;
  }

  /**
   * Check if BrowserOS is running
   */
  async isBrowserOSAvailable(): Promise<boolean> {
    return this.browserOS?.isAvailable() || false;
  }

  get(name?: string): Provider | undefined {
    return name ? this.providers.get(name) : this.active;
  }

  getActive(): Provider | undefined {
    return this.active;
  }

  setActive(name: string): boolean {
    const p = this.providers.get(name);
    if (p) { this.active = p; return true; }
    return false;
  }

  list(): string[] {
    return Array.from(this.providers.keys());
  }
}

class MiniMaxProvider implements Provider {
  name = 'minimax';
  constructor(private apiKey: string) {}

  async complete(opts: { model?: string; messages: any[] }): Promise<{ text?: string }> {
    try {
      const res = await fetch('https://api.minimax.io/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: 'MiniMax-M2.7',
          messages: opts.messages.map((m: any) => ({
            role: m.role,
            content: typeof m.content === 'string' ? m.content.replace(/\n/g, ' ') : m.content
          }))
        })
      });

      const data: any = await res.json();

      if (!res.ok) {
        console.error('MiniMax error:', data);
        return { text: undefined };
      }

      return { text: data.choices?.[0]?.message?.content };
    } catch (error) {
      console.error('MiniMax fetch error:', error);
      return { text: undefined };
    }
  }
}

class LMStudioProvider implements Provider {
  name = 'lmstudio';
  constructor(private url: string, private key: string = 'not-needed') {}

  async complete(opts: { model?: string; messages: any[] }): Promise<{ text?: string }> {
    try {
      const res = await fetch(`${this.url}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.key}`
        },
        body: JSON.stringify({
          model: opts.model || 'local-model',
          messages: opts.messages
        })
      });

      const data: any = await res.json();
      return { text: data.choices?.[0]?.message?.content };
    } catch (error) {
      return { text: undefined };
    }
  }
}

class AnthropicProvider implements Provider {
  name = 'anthropic';
  constructor(private apiKey: string) {}

  async complete(opts: { model?: string; messages: any[] }): Promise<{ text?: string }> {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: opts.model || 'claude-3-5-haiku-4-20250514',
          max_tokens: 1024,
          messages: opts.messages
        })
      });

      const data: any = await res.json();
      return { text: data.content?.[0]?.text };
    } catch (error) {
      return { text: undefined };
    }
  }
}

class OpenAIProvider implements Provider {
  name = 'openai';
  constructor(private apiKey: string) {}

  async complete(opts: { model?: string; messages: any[] }): Promise<{ text?: string }> {
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: opts.model || 'gpt-4o-mini',
          messages: opts.messages
        })
      });

      const data: any = await res.json();
      return { text: data.choices?.[0]?.message?.content };
    } catch (error) {
      return { text: undefined };
    }
  }
}

export default ProviderManager;
