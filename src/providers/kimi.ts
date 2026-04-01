import { Provider } from './manager.js';

export class KimiProvider implements Provider {
  name = 'kimi';
  defaultModel = 'k2p5';
  baseUrl = 'https://api.kimi.com/coding/v1';

  constructor(private apiKey: string) {}

  async complete(opts: { model?: string; messages: any[] }): Promise<{ text?: string; error?: string }> {
    try {
      const model = opts.model || this.defaultModel;

      const res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'User-Agent': 'claude-code/0.1.0'  // Required for sk-kimi- keys
        },
        body: JSON.stringify({ model, messages: opts.messages, stream: false })
      });

      if (!res.ok) {
        const err = await res.text();
        return { error: `Kimi API ${res.status}: ${err}` };
      }

      const data: any = await res.json();
      return { text: data.choices?.[0]?.message?.content };
    } catch (e: any) {
      return { error: e.message };
    }
  }
}
