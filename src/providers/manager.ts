/**
 * Provider Manager - Multi-provider AI support + BrowserOS
 */

import { BrowserOSProvider } from './browseros';
import { KimiProvider } from './kimi';
import { OpenClawGatewayProvider } from './openclaw-gateway';

export interface Provider {
  name: string;
  complete(opts: { model?: string; messages: any[] }): Promise<{ text?: string; toolCalls?: any[]; error?: string }>;
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
    if (process.env.OPENROUTER_API_KEY) {
      this.providers.set('openrouter', new OpenRouterProvider(process.env.OPENROUTER_API_KEY));
      console.log('[Provider] OpenRouter loaded - free tier models available');
    }

    // BrowserOS - browser automation
    this.browserOS = new BrowserOSProvider({
      host: process.env.BROWSEROS_HOST || '127.0.0.1',
      port: parseInt(process.env.BROWSEROS_PORT || '9100'),
      
    });

    if (process.env.KIMI_API_KEY) {
      this.providers.set('kimi', new KimiProvider(process.env.KIMI_API_KEY));
      console.log('[Provider] Kimi loaded');
    }
    if (process.env.MOONSHOT_API_KEY) {
      this.providers.set('moonshot', new KimiProvider(process.env.MOONSHOT_API_KEY));
      console.log('[Provider] Moonshot loaded');
    }
        // OpenClaw Gateway - local gateway with Moonshot/kimi-k2.5 (free unlimited)
    this.providers.set('openclaw', new OpenClawGatewayProvider());
    console.log('[Provider] OpenClaw Gateway loaded (kimi-k2.5 free)');

    const first = Array.from(this.providers.keys())[0];
    if (first) this.active = this.providers.get(first);
  }

  /**
   * Smart router - tries providers in priority order until one succeeds.
   * Priority: kimi → minimax → openrouter (free tier)
   */
  async route(prompt: string, messages?: any[]): Promise<{ text: string; provider: string; model: string }> {
    // Build target list from DUCK_PRIORITY env var, or use default
    const priorityEnv = process.env.DUCK_PRIORITY;
    const providerOverride = process.env.DUCK_PROVIDER;  // from -p flag
    let targets = [
      { provider: 'openclaw',  model: 'kimi-k2.5',              label: 'OpenClaw (Moonshot kimi-k2.5)' },
      { provider: 'kimi',     model: 'k2p5',                    label: 'Kimi K2.5 (direct)' },
      { provider: 'minimax',  model: 'MiniMax-M2.7',            label: 'MiniMax M2.7' },
      { provider: 'openrouter',model: 'qwen/qwen3.6-plus-preview:free',label: 'OpenRouter Free' },
    ];

    if (providerOverride) {
      // -p flag: use that provider first, then fallback chain
      const overrideLabel = providerOverride.toUpperCase();
      const overrideModel = providerOverride === 'kimi' ? 'k2p5' :
                            providerOverride === 'minimax' ? 'MiniMax-M2.7' :
                            providerOverride === 'openclaw' ? 'kimi-k2.5' : undefined;
      targets = [
        { provider: providerOverride, model: overrideModel, label: overrideLabel + ' [PRIORITY]' },
        ...targets.filter(t => t.provider !== providerOverride)
      ];
      console.log(`[Router📡] Provider override: ${overrideLabel}`);
    } else if (priorityEnv) {
      const names = priorityEnv.split(',').map(s => s.trim());
      targets = names.map(name => {
        const isModelId = name.includes('/');
        return {
          provider: isModelId ? 'openrouter' : name,
          model: isModelId ? name : undefined,
          label: isModelId ? name : name.toUpperCase()
        };
      });
      console.log(`[Router📡] Custom priority: ${priorityEnv}`);
    }

    const msgList = messages || [{ role: 'user', content: prompt }];

    for (const target of targets) {
      const prov = this.providers.get(target.provider);
      if (!prov) {
        console.log(`[Router📡] ⚠️  ${target.provider} not configured, skipping`);
        continue;
      }

      const label = target.label!;
      console.log(`[Router📡] Trying ${label}...`);

      try {
        const result = await prov.complete({ model: target.model, messages: msgList });
        const err = result.error;
        if (result.text && !err) {
          console.log(`[Router📡] ✅  ${label} succeeded`);
          return { text: result.text, provider: target.provider, model: target.model! };
        }
        console.log(`[Router📡] ❌  ${label}: ${err || 'empty response'}`);
      } catch (e: any) {
        console.log(`[Router📡] ❌  ${label}: ${e.message}`);
      }
    }

    throw new Error('All router targets exhausted');
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
      // MiniMax only supports ONE system message - merge multiple into one
      let systemParts: string[] = [];
      const nonSystem: any[] = [];
      for (const m of opts.messages) {
        if (m.role === 'system') {
          const text = typeof m.content === 'string' ? m.content : JSON.stringify(m.content);
          systemParts.push(text);
        } else {
          nonSystem.push(m);
        }
      }
      const combinedSystem = systemParts.join('\n---\n');
      const msgs = [
        { role: 'system', content: combinedSystem },
        ...nonSystem.map((m: any) => ({
          role: m.role,
          content: typeof m.content === 'string' ? m.content.replace(/\n/g, ' ') : m.content
        }))
      ];
      const body = JSON.stringify({ model: 'MiniMax-M2.7', messages: msgs });
      
      const res = await fetch('https://api.minimax.io/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body
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

// OpenRouter - Duckets' personal free tier ($0.20/month cap, free models only)
class OpenRouterProvider implements Provider {
  name = 'openrouter';
  constructor(private apiKey: string) {}

  async complete(opts: { model?: string; messages: any[] }): Promise<{ text?: string; toolCalls?: any[] }> {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'HTTP-Referer': 'https://duck-agent.dev',
          'X-Title': 'Duck Agent'
        },
        body: JSON.stringify({
          model: opts.model || 'minimax/minimax-m2.5:free',  // Duckets' favorite free model
          messages: opts.messages
        })
      });

      const data: any = await res.json();
      if (data.error) {
        console.error('[OpenRouter] Error:', data.error.message);
        return { text: undefined };
      }
      const message = data.choices?.[0]?.message;
      return {
        text: message?.content,
        toolCalls: message?.tool_calls?.map((tc: any) => ({
          id: tc.id,
          name: tc.function?.name,
          input: tc.function?.arguments ? JSON.parse(tc.function.arguments) : {}
        }))
      };
    } catch (error) {
      console.error('[OpenRouter] Fetch error:', error);
      return { text: undefined };
    }
  }
}

export default ProviderManager;
