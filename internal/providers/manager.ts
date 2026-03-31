/**
 * Duck CLI - Multi-Provider Manager
 * 
 * Gracefully handles missing API keys:
 * - Checks for available providers
 * - Falls back to LM Studio local
 * - Provides helpful setup instructions
 */

export interface ModelResponse {
  text?: string;
  toolCalls?: ToolCall[];
  reasoning?: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface CompletionRequest {
  model: string;
  messages: Message[];
  tools?: ToolDefinition[];
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
}

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface ModelProvider {
  name: string;
  complete(request: CompletionRequest): Promise<ModelResponse>;
  isAvailable(): boolean;
}

export interface ProviderStatus {
  name: string;
  available: boolean;
  requiresKey: boolean;
  keyConfigured: boolean;
}

export class ProviderManager {
  private providers = new Map<string, ModelProvider>();
  private defaultProvider = '';
  private availableProviders: string[] = [];

  async load(): Promise<void> {
    // LM Studio (local) - always available if running
    const lmstudio = new LMStudioProvider(
      process.env.LMSTUDIO_URL || 'http://localhost:1234',
      process.env.LMSTUDIO_API_KEY
    );
    this.providers.set('lmstudio', lmstudio);
    
    const lmAvailable = await lmstudio.isAvailable(); if (lmAvailable) {
      this.availableProviders.push('lmstudio');
    } else {
      this.availableProviders.push('lmstudio'); // Still add - can be started later
      this.defaultProvider = 'lmstudio';
      this.availableProviders.push('lmstudio');
    }

    // Anthropic (if key provided)
    if (process.env.ANTHROPIC_API_KEY) {
      const anthropic = new AnthropicProvider(
        process.env.ANTHROPIC_API_KEY,
        process.env.ANTHROPIC_BASE_URL
      );
      this.providers.set('anthropic', anthropic);
      this.defaultProvider = 'anthropic';
      this.availableProviders.push('anthropic');
    }

    // OpenAI (if key provided)
    if (process.env.OPENAI_API_KEY) {
      const openai = new OpenAIProvider(
        process.env.OPENAI_API_KEY,
        process.env.OPENAI_BASE_URL
      );
      this.providers.set('openai', openai);
      if (!this.defaultProvider) {
        this.defaultProvider = 'openai';
      }
      this.availableProviders.push('openai');
    }

    // MiniMax (if key provided)
    if (process.env.MINIMAX_API_KEY) {
      const minimax = new MiniMaxProvider(process.env.MINIMAX_API_KEY);
      this.providers.set('minimax', minimax);
      this.availableProviders.push('minimax');
    }

    // Set default to first available
    if (!this.defaultProvider && this.availableProviders.length > 0) {
      this.defaultProvider = this.availableProviders[0];
    }
  }

  get(name?: string): ModelProvider | undefined {
    return this.providers.get(name || this.defaultProvider);
  }

  getDefault(): ModelProvider {
    const provider = this.providers.get(this.defaultProvider);
    if (!provider) {
      throw new Error('No AI provider available. Please configure an API key or start LM Studio.');
    }
    return provider;
  }

  list(): string[] {
    return Array.from(this.providers.keys());
  }

  listAvailable(): string[] {
    return this.availableProviders;
  }

  getStatus(): ProviderStatus[] {
    const statuses: ProviderStatus[] = [];
    
    const configs = [
      { name: 'anthropic', requiresKey: true, envVar: 'ANTHROPIC_API_KEY' },
      { name: 'openai', requiresKey: true, envVar: 'OPENAI_API_KEY' },
      { name: 'minimax', requiresKey: true, envVar: 'MINIMAX_API_KEY' },
      { name: 'lmstudio', requiresKey: false, envVar: 'LMSTUDIO_URL' }
    ];

    for (const config of configs) {
      const provider = this.providers.get(config.name);
      statuses.push({
        name: config.name,
        available: provider ? true : false,
        requiresKey: config.requiresKey,
        keyConfigured: !!process.env[config.envVar]
      });
    }

    return statuses;
  }

  getSetupInstructions(): string {
    const status = this.getStatus();
    const missing: string[] = [];

    for (const s of status) {
      if (!s.available && s.requiresKey && !s.keyConfigured) {
        missing.push(s.name);
      }
    }

    if (missing.length === 0) {
      return 'All configured!';
    }

    return `
No API keys configured for: ${missing.join(', ')}
    
To fix:
  export ANTHROPIC_API_KEY=sk-ant-...    # For Claude
  export OPENAI_API_KEY=sk-...          # For GPT
  export MINIMAX_API_KEY=...            # For MiniMax
  
Or start LM Studio locally:
  - Download from https://lmstudio.ai
  - Start the server on http://localhost:1234
`;
  }
}

// LM Studio Provider (Local) - Always try first
class LMStudioProvider implements ModelProvider {
  name = 'lmstudio';
  private baseUrl: string;
  private apiKey?: string;
  private _available: boolean | null = null;

  constructor(baseUrl: string, apiKey?: string) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
  }

  async isAvailable(): Promise<boolean> {
    if (this._available !== null) return this._available;
    
    try {
      const response = await fetch(`${this.baseUrl}/v1/models`, {
        method: 'GET',
        signal: AbortSignal.timeout(2000)
      });
      this._available = response.ok;
    } catch {
      this._available = false;
    }
    return this._available;
  }

  async complete(request: CompletionRequest): Promise<ModelResponse> {
    // Check availability first
    if (!await this.isAvailable()) {
      throw new Error('LM Studio not available. Start it from https://lmstudio.ai or configure an API key.');
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: request.model || 'local-model',
        messages: [
          ...(request.systemPrompt ? [{ role: 'system' as const, content: request.systemPrompt }] : []),
          ...request.messages
        ],
        max_tokens: request.maxTokens || 4096,
        temperature: request.temperature || 0.7,
        tools: request.tools?.map(t => ({
          type: 'function',
          function: {
            name: t.name,
            description: t.description,
            parameters: t.input_schema
          }
        }))
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`LM Studio error: ${response.status} - ${error}`);
    }

    const data: any = await response.json();
    
    return {
      text: data.choices?.[0]?.message?.content,
      toolCalls: data.choices?.[0]?.message?.tool_calls?.map((c: any) => ({
        id: c.id,
        name: c.function.name,
        arguments: typeof c.function.arguments === 'string' 
          ? JSON.parse(c.function.arguments) 
          : c.function.arguments || {}
      }))
    };
  }
}

// Anthropic Provider
class AnthropicProvider implements ModelProvider {
  name = 'anthropic';
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, baseUrl?: string) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl || 'https://api.anthropic.com';
  }

  isAvailable(): boolean {
    return !!this.apiKey;
  }

  async complete(request: CompletionRequest): Promise<ModelResponse> {
    const response = await fetch(`${this.baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'tool'
      },
      body: JSON.stringify({
        model: request.model || 'claude-3-5-sonnet-20241022',
        max_tokens: request.maxTokens || 4096,
        temperature: request.temperature || 0.7,
        system: request.systemPrompt,
        messages: request.messages.map(m => ({
          role: m.role === 'system' ? 'user' : m.role,
          content: m.content
        })),
        tools: request.tools?.map(t => ({
          name: t.name,
          description: t.description,
          input_schema: t.input_schema
        }))
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API error: ${response.status} - ${error}`);
    }

    const data: any = await response.json();
    
    return {
      text: data.content?.[0]?.text,
      toolCalls: data.content?.filter((c: any) => c.type === 'tool_use').map((c: any) => ({
        id: c.id,
        name: c.name,
        arguments: c.input
      })),
      reasoning: data.content?.filter((c: any) => c.type === 'thinking')?.[0]?.thinking
    };
  }
}

// OpenAI Provider
class OpenAIProvider implements ModelProvider {
  name = 'openai';
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string, baseUrl?: string) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl || 'https://api.openai.com';
  }

  isAvailable(): boolean {
    return !!this.apiKey;
  }

  async complete(request: CompletionRequest): Promise<ModelResponse> {
    const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: request.model || 'gpt-4o',
        messages: [
          ...(request.systemPrompt ? [{ role: 'system' as const, content: request.systemPrompt }] : []),
          ...request.messages
        ],
        max_tokens: request.maxTokens || 4096,
        temperature: request.temperature || 0.7,
        tools: request.tools?.map(t => ({
          type: 'function',
          function: {
            name: t.name,
            description: t.description,
            parameters: t.input_schema
          }
        }))
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${error}`);
    }

    const data: any = await response.json();
    
    return {
      text: data.choices?.[0]?.message?.content,
      toolCalls: data.choices?.[0]?.message?.tool_calls?.map((c: any) => ({
        id: c.id,
        name: c.function.name,
        arguments: typeof c.function.arguments === 'string' 
          ? JSON.parse(c.function.arguments) 
          : c.function.arguments || {}
      }))
    };
  }
}

// MiniMax Provider
class MiniMaxProvider implements ModelProvider {
  name = 'minimax';
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  isAvailable(): boolean {
    return !!this.apiKey;
  }

  async complete(request: CompletionRequest): Promise<ModelResponse> {
    const response = await fetch('https://api.minimax.io/v1/text/chatcompletion_v2', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: request.model || 'MiniMax-Text-01',
        messages: [
          ...(request.systemPrompt ? [{ role: 'system' as const, content: request.systemPrompt }] : []),
          ...request.messages
        ],
        max_tokens: request.maxTokens || 4096,
        temperature: request.temperature || 0.7
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`MiniMax error: ${response.status} - ${error}`);
    }

    const data: any = await response.json();
    
    return {
      text: data.choices?.[0]?.message?.content
    };
  }
}
