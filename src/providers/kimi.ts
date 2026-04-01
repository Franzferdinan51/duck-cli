import { Provider } from './manager.js';

export class KimiProvider implements Provider {
  name = 'kimi';
  defaultModel = 'moonshot-v1-32k';

  constructor(private apiKey: string, private baseUrl = 'https://api.moonshot.cn/v1') {}

  async complete(opts: { model?: string; messages: any[] }): Promise<{ text?: string; error?: string }> {
    try {
      const model = opts.model || this.defaultModel;
      const res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
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
