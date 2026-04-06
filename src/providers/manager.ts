/**
 * Provider Manager - Multi-provider AI support + BrowserOS
 */

import { BrowserOSProvider } from './browseros';
import { KimiProvider } from './kimi';
import { OpenClawGatewayProvider } from './openclaw-gateway';

export interface Provider {
  name: string;
  complete(opts: { model?: string; messages: any[]; tools?: any[] }): Promise<{ text?: string; toolCalls?: any[]; error?: string }>;
}

export class ProviderManager {
  private providers: Map<string, Provider> = new Map();
  private browserOS: BrowserOSProvider | undefined;
  private active: Provider | undefined;

  async load(): Promise<void> {
    // LM Studio - local models (Mac/Windows PC with LM Studio running)
    // Auto-detect if LM Studio is running; try even if health check fails (may need auth)
    const lmstudioUrl = process.env.LMSTUDIO_URL || 'http://localhost:1234';
    const lmstudioKey = process.env.LMSTUDIO_KEY || process.env.LMSTUDIO_API_KEY || 'not-needed';
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      const testRes = await fetch(`${lmstudioUrl}/v1/models`, {
        signal: controller.signal,
        headers: lmstudioKey !== 'not-needed' ? { 'Authorization': `Bearer ${lmstudioKey}` } : {}
      });
      clearTimeout(timeoutId);
      if (testRes.ok || process.env.LMSTUDIO_URL) {
        // Add if running OR if URL is explicitly configured
        this.providers.set('lmstudio', new LMStudioProvider(lmstudioUrl, lmstudioKey));
        console.log(`[Provider] LM Studio loaded (${lmstudioUrl}, ${lmstudioKey === 'not-needed' ? 'no auth' : 'auth configured'})`);
      }
    } catch {
      // LM Studio not reachable, skip unless URL explicitly set
      if (process.env.LMSTUDIO_URL) {
        this.providers.set('lmstudio', new LMStudioProvider(lmstudioUrl, lmstudioKey));
        console.log(`[Provider] LM Studio loaded (explicit URL: ${lmstudioUrl})`);
      }
    }
    
    // MiniMax
    if (process.env.MINIMAX_API_KEY) {
      this.providers.set('minimax', new MiniMaxProvider(process.env.MINIMAX_API_KEY));
    }
    
    // LM Studio (explicit URL)
    if (process.env.LMSTUDIO_URL && !this.providers.has('lmstudio')) {
      this.providers.set('lmstudio', new LMStudioProvider(process.env.LMSTUDIO_URL, process.env.LMSTUDIO_KEY || 'not-needed'));
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
    
    // Smart default: prefer local (free) > API > paid
    // Use GEMMA_MODEL env var for LM Studio, or first available model
    const lmModel = process.env.GEMMA_MODEL || process.env.LMSTUDIO_MODEL || 'google/gemma-4-26b-a4b';
    let targets = [
      { provider: 'lmstudio',  model: lmModel,                label: 'LM Studio (Gemma 4 26B, local FREE)' },
      { provider: 'openrouter',model: 'qwen/qwen3.6-plus-preview:free', label: 'OpenRouter Free' },
      { provider: 'openclaw',  model: 'kimi-k2.5',          label: 'OpenClaw Gateway (Kimi k2.5)' },
      { provider: 'kimi',      model: 'k2p5',                label: 'Kimi K2.5 (direct)' },
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
        // Add timeout wrapper for each provider request
        const timeoutMs = 60000; // 60 second timeout per provider
        const result = await Promise.race([
          prov.complete({ model: target.model, messages: msgList }),
          new Promise<{ text?: string; toolCalls?: any[]; error?: string }>((_, reject) => 
            setTimeout(() => reject({ error: 'Request timed out' }), timeoutMs)
          )
        ]).catch((e: any) => ({ error: e?.error || e?.message || 'Unknown error' })) as { text?: string; toolCalls?: any[]; error?: string };
        const err = result?.error || (result?.text === undefined ? 'No response' : undefined);
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
   * Route to a specific model (provider/model ID).
   * Used by Meta-Agent for targeted model selection.
   * Examples: 'lmstudio/qwen3.5-0.8b', 'minimax/MiniMax-M2.7'
   */
  async routeWithModel(modelId: string, prompt: string, messages?: any[]): Promise<{ text: string; provider: string; model: string }> {
    // Parse provider from model ID or use default
    const [provider, ...modelParts] = modelId.includes('/') ? modelId.split('/') : ['', modelId];
    const model = modelParts.join('/'); // handles 'qwen/qwen3.5-9b' -> 'qwen3.5-9b' when provider='qwen'
    const resolvedProvider = provider || this.detectProvider(model);
    const resolvedModel = provider && !modelId.includes('/') ? model : (modelParts.length > 1 ? modelParts.join('/') : model);

    let prov = this.providers.get(resolvedProvider);
    let fallbackModel = resolvedModel;
    // Fallback: if requested provider unavailable, use first available with a capable model
    if (!prov) {
      const available = this.list();
      if (available.length === 0) {
        throw new Error(`No AI providers available. Set MINIMAX_API_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY, LMSTUDIO_URL, or OPENROUTER_API_KEY`);
      }
      // Prefer openclaw > lmstudio > openrouter > others
      const preferred = ['openclaw', 'lmstudio', 'openrouter', 'openai', 'anthropic', 'minimax', 'kimi'].find(p => available.includes(p)) || available[0];
      prov = this.providers.get(preferred)!;
      // Use a model this provider is likely to support
      if (preferred === 'openclaw') fallbackModel = 'kimi-k2.5';
      else if (preferred === 'lmstudio') fallbackModel = 'qwen3.5-9b';
      else if (preferred === 'openrouter') fallbackModel = 'minimax/minimax-m2.5:free';
      else fallbackModel = resolvedModel;
      console.log(`[Router📡] ${resolvedProvider}/${resolvedModel} unavailable, falling back to ${preferred}/${fallbackModel}`);
    }

    const msgList = messages || [{ role: 'user', content: prompt }];
    const actualModel = fallbackModel;
    const provKeys = [...this.providers.keys()];
    const actualProvider = prov ? (this.providers.get(resolvedProvider) ? resolvedProvider : provKeys.find(k => this.providers.get(k) === prov) || resolvedProvider) : resolvedProvider;
    console.log(`[Router📡] Routing: ${actualProvider}/${actualModel}`);

    // Add timeout wrapper (60 second max per call)
    const timeoutMs = 90000;
    const result = await Promise.race([
      prov.complete({ model: actualModel, messages: msgList }),
      new Promise<{ text?: string; toolCalls?: any[]; error?: string }>((_, reject) =>
        setTimeout(() => reject({ error: 'Request timed out after 90s' }), timeoutMs)
      )
    ]).catch((e: any) => ({ error: e?.error || e?.message || 'Unknown error' })) as { text?: string; toolCalls?: any[]; error?: string };

    if (result.error) throw new Error(`Model ${actualProvider}/${actualModel} failed: ${result.error}`);
    return { text: result.text || '', provider: actualProvider, model: actualModel };
  }

  /**
   * Detect which provider can serve a given model name
   */
  private detectProvider(model: string): string {
    if (model.includes('gemma')) return 'lmstudio';
    if (model.includes('qwen3.5') || model.includes('3.5') || model.includes('0.8b')) return 'lmstudio';
    if (model.includes('jan')) return 'lmstudio';
    if (model.includes('nvidia')) return 'openrouter';
    if (model.includes('minimax') || model.includes('MiniMax')) return 'minimax';
    if (model.includes('k2p5') || model.includes('kimi')) return 'kimi';
    if (model.includes('claude') || model.includes('anthropic')) return 'anthropic';
    return 'minimax'; // default
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

  /**
   * Analyze an image using a vision-capable model (Kimi k2.5, GPT-4o, etc.)
   */
  async analyzeImage(imageData: string, query: string): Promise<string> {
    // Try vision-capable providers in priority order
    const visionTargets = [
      { provider: 'kimi',      model: 'k2p5', label: 'Kimi K2.5 (vision)' },
      { provider: 'openclaw',  model: 'kimi-k2.5', label: 'OpenClaw Kimi k2.5' },
      { provider: 'lmstudio',  model: undefined, label: 'LM Studio (vision model)' },
    ];

    for (const target of visionTargets) {
      const prov = this.providers.get(target.provider);
      if (!prov) continue;

      try {
        // Build vision message in ContentPart format
        const messages = [
          {
            role: 'user',
            content: [
              { type: 'text', text: query },
              { type: 'image_url', image_url: { url: imageData, detail: 'low' } }
            ]
          }
        ];

        const result = await prov.complete({ model: target.model, messages });
        if (result.text) {
          return result.text;
        }
      } catch (err) {
        console.log(`[Vision] ${target.label} failed: ${(err as Error).message}`);
      }
    }

    return '[Vision] No vision provider available. Configure Kimi k2.5 or another vision-capable model.';
  }
}

class MiniMaxProvider implements Provider {
  name = 'minimax';
  private retryDelays = [500, 1000, 2000, 4000];

  constructor(private apiKey: string) {}

  async complete(opts: { model?: string; messages: any[]; tools?: any[] }): Promise<{ text?: string; toolCalls?: any[]; error?: string }> {
    const makeRequest = async (): Promise<{ text?: string; error?: string; retry?: boolean }> => {
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
        // Preserve newlines in message content - only trim trailing whitespace
        const msgs = [
          { role: 'system', content: combinedSystem },
          ...nonSystem.map((m: any) => ({
            role: m.role,
            content: typeof m.content === 'string' ? m.content.trimEnd() : (Array.isArray(m.content) ? JSON.stringify(m.content) : m.content)
          }))
        ];
        const model = opts.model || 'MiniMax-M2.7';
        const body = JSON.stringify({ model, messages: msgs });
        
        const res = await fetch('https://api.minimax.io/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          },
          body
        });

        // Handle rate limiting (HTTP 429) - check before parsing
        if (res.status === 429) {
          const retryAfter = res.headers.get('Retry-After');
          const waitMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : undefined;
          console.warn(`[MiniMax] ⚠️  Rate limited (429), ${waitMs ? `waiting ${waitMs}ms` : 'will retry with backoff'}`);
          return { error: '__RETRY__', retry: true };
        }

        if (!res.ok) {
          const data: any = await res.json().catch(() => ({}));
          const isRetryable = res.status >= 500 || res.status === 408;
          return { error: `HTTP ${res.status}: ${data.error?.message || res.statusText}`, retry: isRetryable };
        }

        const data: any = await res.json();
        return { text: data.choices?.[0]?.message?.content };
      } catch (error: any) {
        const isRetryable = error.message?.includes('Connection') ||
                           error.message?.includes('timeout') ||
                           error.message?.includes('ECONNRESET') ||
                           error.message?.includes('ETIMEDOUT');
        return { error: error.message, retry: isRetryable };
      }
    };

    // Retry with exponential backoff
    for (let attempt = 0; attempt <= this.retryDelays.length; attempt++) {
      if (attempt > 0) {
        const delay = this.retryDelays[attempt - 1];
        console.log(`[MiniMax] Retry ${attempt}/${this.retryDelays.length} after ${delay}ms...`);
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
        return { error: result.error || 'MiniMax request failed after retries' };
      }
    }

    return { error: 'MiniMax request failed after retries' };
  }
}

class LMStudioProvider implements Provider {
  name = 'lmstudio';
  private retryDelays = [500, 1000, 2000, 4000]; // Exponential backoff

  constructor(private url: string, private key: string = 'not-needed') {}

  /**
   * Normalize a bare model name to its fully-qualified LM Studio model ID.
   * LM Studio uses namespaced IDs like 'qwen/qwen3.5-9b' but duck-cli often
   * references models as bare names like 'qwen3.5-9b'.
   */
  private normalizeModel(model?: string): string {
    const raw = model || process.env.GEMMA_MODEL || 'google/gemma-4-26b-a4b';
    // Already namespaced - use as-is
    if (raw.includes('/')) return raw;
    // Map bare model names to their LM Studio namespaced IDs
    if (raw.startsWith('qwen3.5-') || raw.startsWith('qwen2.5-')) return `qwen/${raw}`;
    if (raw.startsWith('gemma-4-') || raw.startsWith('gemma4-')) return `google/${raw}`;
    // Unknown format - try as-is
    return raw;
  }

  async complete(opts: { model?: string; messages: any[]; tools?: any[] }): Promise<{ text?: string; toolCalls?: any[] }> {
    const makeRequest = async (): Promise<{ text?: string; toolCalls?: any[]; error?: string }> => {
      try {
        // Use OpenAI-compatible endpoint (/v1/chat/completions) - works perfectly
        const endpoint = this.url.includes('/v1/chat/completions') ? this.url : `${this.url.replace('/api/v1', '').replace('/v1', '')}/v1/chat/completions`;
        const lmModel = this.normalizeModel(opts.model);

        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.key}`
          },
          body: JSON.stringify({
            model: lmModel,
            messages: opts.messages,
            tools: opts.tools,
            stream: false
          })
        });

        if (!res.ok) {
          const errorText = await res.text().catch(() => 'Unknown error');
          return { error: `HTTP ${res.status}: ${errorText}` };
        }

        const data: any = await res.json();
        
        // Handle OpenAI-compatible response format
        const message = data.message || data.choices?.[0]?.message || {};
        const content = message.content || '';
        const toolCalls = message.tool_calls || message.toolCalls || [];
        
        return { 
          text: content, 
          toolCalls: toolCalls.length > 0 ? toolCalls : undefined 
        };
      } catch (error: any) {
        // Detect connection errors that are retryable
        const isRetryable = error.message?.includes('Connection') ||
                           error.message?.includes('timeout') ||
                           error.message?.includes('ECONNRESET') ||
                           error.message?.includes('ETIMEDOUT');
        return { error: isRetryable ? '__RETRY__' : error.message };
      }
    };

    // Retry with exponential backoff for connection issues
    for (let attempt = 0; attempt <= this.retryDelays.length; attempt++) {
      if (attempt > 0) {
        const delay = this.retryDelays[attempt - 1];
        console.log(`[LMStudio] Retry ${attempt}/${this.retryDelays.length} after ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      
      const result = await makeRequest();
      if (!result.error || result.error === '__RETRY__' && attempt === this.retryDelays.length) {
        if (result.text !== undefined || result.toolCalls !== undefined) {
          return { text: result.text, toolCalls: result.toolCalls };
        }
        if (result.error && result.error !== '__RETRY__') {
          console.log('[LMStudio] Error:', result.error);
          return { text: undefined };
        }
      }
      if (result.error && result.error !== '__RETRY__') {
        console.log('[LMStudio] Error:', result.error);
        return { text: undefined };
      }
    }
    
    console.log('[LMStudio] Failed after retries');
    return { text: undefined };
  }
}

class AnthropicProvider implements Provider {
  name = 'anthropic';
  private retryDelays = [500, 1000, 2000, 4000];

  constructor(private apiKey: string) {
    if (!apiKey || apiKey.length < 10) {
      console.warn('[Anthropic] ⚠️  API key appears invalid (too short)');
    }
  }

  async complete(opts: { model?: string; messages: any[] }): Promise<{ text?: string; error?: string }> {
    const makeRequest = async (): Promise<{ text?: string; error?: string; retry?: boolean }> => {
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

        // Handle rate limiting (HTTP 429)
        if (res.status === 429) {
          const retryAfter = res.headers.get('retry-after');
          const waitMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : undefined;
          console.warn(`[Anthropic] ⚠️  Rate limited (429), ${waitMs ? `waiting ${waitMs}ms` : 'will retry with backoff'}`);
          return { error: '__RETRY__', retry: true };
        }

        if (!res.ok) {
          const err = await res.text();
          // 401 = bad key, don't retry
          if (res.status === 401) {
            return { error: `Anthropic auth failed (401): check your ANTHROPIC_API_KEY` };
          }
          // Server errors are retryable
          const isRetryable = res.status >= 500 || res.status === 408;
          return { error: `Anthropic API ${res.status}: ${err}`, retry: isRetryable };
        }

        const data: any = await res.json();
        return { text: data.content?.[0]?.text };
      } catch (e: any) {
        const isRetryable = e.message?.includes('Connection') ||
                           e.message?.includes('timeout') ||
                           e.message?.includes('ECONNRESET') ||
                           e.message?.includes('ETIMEDOUT');
        return { error: e.message, retry: isRetryable };
      }
    };

    for (let attempt = 0; attempt <= this.retryDelays.length; attempt++) {
      if (attempt > 0) {
        const delay = this.retryDelays[attempt - 1];
        console.log(`[Anthropic] Retry ${attempt}/${this.retryDelays.length} after ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      const result = await makeRequest();
      if (result.text !== undefined) return { text: result.text };
      if (result.error && !result.retry) return { error: result.error };
      if (attempt === this.retryDelays.length) {
        return { error: result.error || 'Anthropic request failed after retries' };
      }
    }
    return { error: 'Anthropic request failed after retries' };
  }
}

class OpenAIProvider implements Provider {
  name = 'openai';
  private retryDelays = [500, 1000, 2000, 4000];

  constructor(private apiKey: string) {
    if (!apiKey || apiKey.length < 10) {
      console.warn('[OpenAI] ⚠️  API key appears invalid (too short)');
    }
  }

  async complete(opts: { model?: string; messages: any[] }): Promise<{ text?: string; error?: string }> {
    const makeRequest = async (): Promise<{ text?: string; error?: string; retry?: boolean }> => {
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

        // Handle rate limiting (HTTP 429)
        if (res.status === 429) {
          const retryAfter = res.headers.get('Retry-After');
          const waitMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : undefined;
          console.warn(`[OpenAI] ⚠️  Rate limited (429), ${waitMs ? `waiting ${waitMs}ms` : 'will retry with backoff'}`);
          return { error: '__RETRY__', retry: true };
        }

        if (!res.ok) {
          const err = await res.text();
          // 401 = bad key, don't retry
          if (res.status === 401) {
            return { error: `OpenAI auth failed (401): check your OPENAI_API_KEY` };
          }
          // Server errors are retryable
          const isRetryable = res.status >= 500 || res.status === 408;
          return { error: `OpenAI API ${res.status}: ${err}`, retry: isRetryable };
        }

        const data: any = await res.json();
        return { text: data.choices?.[0]?.message?.content };
      } catch (e: any) {
        const isRetryable = e.message?.includes('Connection') ||
                           e.message?.includes('timeout') ||
                           e.message?.includes('ECONNRESET') ||
                           e.message?.includes('ETIMEDOUT');
        return { error: e.message, retry: isRetryable };
      }
    };

    for (let attempt = 0; attempt <= this.retryDelays.length; attempt++) {
      if (attempt > 0) {
        const delay = this.retryDelays[attempt - 1];
        console.log(`[OpenAI] Retry ${attempt}/${this.retryDelays.length} after ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      const result = await makeRequest();
      if (result.text !== undefined) return { text: result.text };
      if (result.error && !result.retry) return { error: result.error };
      if (attempt === this.retryDelays.length) {
        return { error: result.error || 'OpenAI request failed after retries' };
      }
    }
    return { error: 'OpenAI request failed after retries' };
  }
}

// OpenRouter - Duckets' personal free tier ($0.20/month cap, free models only)
class OpenRouterProvider implements Provider {
  name = 'openrouter';
  private retryDelays = [500, 1000, 2000, 4000];

  constructor(private apiKey: string) {
    if (!apiKey || apiKey.length < 10) {
      console.warn('[OpenRouter] ⚠️  API key appears invalid (too short)');
    }
  }

  async complete(opts: { model?: string; messages: any[] }): Promise<{ text?: string; toolCalls?: any[]; error?: string }> {
    const makeRequest = async (): Promise<{ text?: string; toolCalls?: any[]; error?: string; retry?: boolean }> => {
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
            model: opts.model || 'qwen/qwen3.6-plus-preview:free',  // Duckets' favorite free model
            messages: opts.messages
          })
        });

        // Handle rate limiting (HTTP 429)
        if (res.status === 429) {
          const retryAfter = res.headers.get('retry-after');
          const waitMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : undefined;
          console.warn(`[OpenRouter] ⚠️  Rate limited (429), ${waitMs ? `waiting ${waitMs}ms` : 'will retry with backoff'}`);
          return { error: '__RETRY__', retry: true };
        }

        if (!res.ok) {
          const err = await res.text();
          // 401 = bad key, don't retry
          if (res.status === 401) {
            return { error: `OpenRouter auth failed (401): check your OPENROUTER_API_KEY` };
          }
          // Server errors are retryable
          const isRetryable = res.status >= 500 || res.status === 408;
          return { error: `OpenRouter API ${res.status}: ${err}`, retry: isRetryable };
        }

        const data: any = await res.json();
        if (data.error) {
          // OpenRouter returns errors in data.error object
          const isRateLimit = data.error?.code === 'rate_limit_exceeded' ||
                             data.error?.message?.includes('rate limit');
          return { error: data.error?.message || JSON.stringify(data.error), retry: isRateLimit };
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
      } catch (e: any) {
        const isRetryable = e.message?.includes('Connection') ||
                           e.message?.includes('timeout') ||
                           e.message?.includes('ECONNRESET') ||
                           e.message?.includes('ETIMEDOUT');
        return { error: e.message, retry: isRetryable };
      }
    };

    for (let attempt = 0; attempt <= this.retryDelays.length; attempt++) {
      if (attempt > 0) {
        const delay = this.retryDelays[attempt - 1];
        console.log(`[OpenRouter] Retry ${attempt}/${this.retryDelays.length} after ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      const result = await makeRequest();
      if (result.text !== undefined || result.toolCalls !== undefined) {
        return { text: result.text, toolCalls: result.toolCalls };
      }
      if (result.error && !result.retry) {
        return { error: result.error };
      }
      if (attempt === this.retryDelays.length) {
        return { error: result.error || 'OpenRouter request failed after retries' };
      }
    }
    return { error: 'OpenRouter request failed after retries' };
  }
}

export default ProviderManager;
