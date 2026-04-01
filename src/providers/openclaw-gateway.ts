/**
 * OpenClaw Gateway provider - routes through local OpenClaw gateway
 * Gives duck-cli access to OpenClaw's providers (Moonshot/kimi-k2.5, etc.)
 */
import { Provider } from './manager.js';

export class OpenClawGatewayProvider implements Provider {
  name = 'openclaw';
  defaultModel = 'kimi-k2.5';

  constructor(private gatewayUrl = 'http://localhost:18792') {}

  async complete(opts: { model?: string; messages: any[] }): Promise<{ text?: string; error?: string }> {
    try {
      const model = opts.model || this.defaultModel;

      const res = await fetch(`${this.gatewayUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages: opts.messages, stream: false })
      });

      if (!res.ok) {
        const err = await res.text();
        return { error: `Gateway ${res.status}: ${err}` };
      }

      const data: any = await res.json();
      const content = data.choices?.[0]?.message?.content;

      if (!content || content.includes('All providers failed')) {
        return { error: 'OpenClaw gateway: all upstream providers failed' };
      }

      return { text: content };
    } catch (e: any) {
      return { error: `Connection failed: ${e.message}` };
    }
  }
}
