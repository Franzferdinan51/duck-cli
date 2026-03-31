/**
 * Duck CLI - Multi-Provider Manager
 * 
 * Full provider support:
 * - Anthropic (Claude)
 * - OpenAI (GPT)
 * - Google Gemini
 * - Moonshot/Kimi
 * - MiniMax
 * - ZAI/LM Studio local
 * - OpenClaw (agent mesh)
 * - Custom OpenAI-compatible APIs
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
  isAvailable(): Promise<boolean>;
}

export interface ProviderConfig {
  name: string;
  baseUrl?: string;
  apiKey?: string;
  models?: string[];
}

export class ProviderManager {
  private providers = new Map<string, ModelProvider>();
  private configs = new Map<string, ProviderConfig>();
  private defaultProvider = '';
  private availableProviders: string[] = [];

  async load(): Promise<void> {
    // Load all available providers

    // 1. LM Studio (local) - primary fallback
    const lmConfig: ProviderConfig = {
      name: 'lmstudio',
      baseUrl: process.env.LMSTUDIO_URL || 'http://localhost:1234',
      apiKey: process.env.LMSTUDIO_API_KEY,
      models: ['local-model']
    };
    this.configs.set('lmstudio', lmConfig);
    const lmProvider = new LMStudioProvider(lmConfig);
    this.providers.set('lmstudio', lmProvider);
    this.availableProviders.push('lmstudio');
    this.defaultProvider = 'lmstudio';

    // 2. Moonshot/Kimi - if API key provided
    if (process.env.MOONSHOT_API_KEY || process.env.KIMI_API_KEY) {
      const kimiConfig: ProviderConfig = {
        name: 'kimi',
        baseUrl: 'https://api.moonshot.cn/v1',
        apiKey: process.env.MOONSHOT_API_KEY || process.env.KIMI_API_KEY,
        models: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k', 'kimi-k2.5', 'kimi-k2']
      };
      this.configs.set('kimi', kimiConfig);
      this.providers.set('kimi', new MoonshotProvider(kimiConfig));
      this.availableProviders.push('kimi');
      if (process.env.DEFAULT_PROVIDER === 'kimi') this.defaultProvider = 'kimi';
    }

    // 3. MiniMax - if API key provided
    if (process.env.MINIMAX_API_KEY) {
      const miniConfig: ProviderConfig = {
        name: 'minimax',
        baseUrl: 'https://api.minimax.io/v1',
        apiKey: process.env.MINIMAX_API_KEY,
        models: ['MiniMax-Text-01', 'abab6.5s-chat', 'abab5.5s-chat']
      };
      this.configs.set('minimax', miniConfig);
      this.providers.set('minimax', new MiniMaxProvider(miniConfig));
      this.availableProviders.push('minimax');
      if (process.env.DEFAULT_PROVIDER === 'minimax') this.defaultProvider = 'minimax';
    }

    // 4. ZAI (zai.ai) - if API key provided
    if (process.env.ZAI_API_KEY) {
      const zaiConfig: ProviderConfig = {
        name: 'zai',
        baseUrl: 'https://api.zai.io/v1',
        apiKey: process.env.ZAI_API_KEY,
        models: ['qwen3.5-9b', 'qwen3.5-27b', 'glm-4.7-flash']
      };
      this.configs.set('zai', zaiConfig);
      this.providers.set('zai', new OpenAICompatibleProvider(zaiConfig));
      this.availableProviders.push('zai');
    }

    // 5. Anthropic (Claude) - if API key provided
    if (process.env.ANTHROPIC_API_KEY) {
      const anthropicConfig: ProviderConfig = {
        name: 'anthropic',
        baseUrl: process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com',
        apiKey: process.env.ANTHROPIC_API_KEY,
        models: ['claude-3-5-sonnet-20241022', 'claude-3-opus-4-20240229', 'claude-3-haiku-4-20240307']
      };
      this.configs.set('anthropic', anthropicConfig);
      this.providers.set('anthropic', new AnthropicProvider(anthropicConfig));
      this.availableProviders.push('anthropic');
      if (process.env.DEFAULT_PROVIDER === 'anthropic') this.defaultProvider = 'anthropic';
    }

    // 6. OpenAI - if API key provided
    if (process.env.OPENAI_API_KEY) {
      const openaiConfig: ProviderConfig = {
        name: 'openai',
        baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
        apiKey: process.env.OPENAI_API_KEY,
        models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo']
      };
      this.configs.set('openai', openaiConfig);
      this.providers.set('openai', new OpenAICompatibleProvider(openaiConfig));
      this.availableProviders.push('openai');
      if (process.env.DEFAULT_PROVIDER === 'openai') this.defaultProvider = 'openai';
    }

    // 7. Google Gemini - if API key provided
    if (process.env.GEMINI_API_KEY) {
      const geminiConfig: ProviderConfig = {
        name: 'gemini',
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
        apiKey: process.env.GEMINI_API_KEY,
        models: ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash']
      };
      this.configs.set('gemini', geminiConfig);
      this.providers.set('gemini', new GeminiProvider(geminiConfig));
      this.availableProviders.push('gemini');
    }

    // 8. DeepSeek - if API key provided
    if (process.env.DEEPSEEK_API_KEY) {
      const deepseekConfig: ProviderConfig = {
        name: 'deepseek',
        baseUrl: 'https://api.deepseek.com/v1',
        apiKey: process.env.DEEPSEEK_API_KEY,
        models: ['deepseek-chat', 'deepseek-coder']
      };
      this.configs.set('deepseek', deepseekConfig);
      this.providers.set('deepseek', new OpenAICompatibleProvider(deepseekConfig));
      this.availableProviders.push('deepseek');
    }

    // 9. Ollama (local) - if running
    if (process.env.OLLAMA_HOST || true) {
      const ollamaConfig: ProviderConfig = {
        name: 'ollama',
        baseUrl: process.env.OLLAMA_HOST || 'http://localhost:11434',
        models: []
      };
      this.configs.set('ollama', ollamaConfig);
      const ollamaProvider = new OllamaProvider(ollamaConfig);
      this.providers.set('ollama', ollamaProvider);
      // Only add if actually available
      if (await ollamaProvider.isAvailable()) {
        this.availableProviders.push('ollama');
      }
    }

    // 10. Custom providers from env
    if (process.env.CUSTOM_PROVIDER_URL) {
      const customConfig: ProviderConfig = {
        name: 'custom',
        baseUrl: process.env.CUSTOM_PROVIDER_URL,
        apiKey: process.env.CUSTOM_PROVIDER_KEY,
        models: process.env.CUSTOM_PROVIDER_MODELS?.split(',') || []
      };
      this.configs.set('custom', customConfig);
      this.providers.set('custom', new OpenAICompatibleProvider(customConfig));
      this.availableProviders.push('custom');
    }
  }

  // Add custom provider at runtime
  addProvider(config: ProviderConfig): void {
    this.configs.set(config.name, config);
    
    if (config.baseUrl?.includes('openai') || !config.baseUrl?.includes('anthropic')) {
      this.providers.set(config.name, new OpenAICompatibleProvider(config));
    } else {
      this.providers.set(config.name, new AnthropicProvider(config));
    }
    
    this.availableProviders.push(config.name);
    if (!this.defaultProvider) {
      this.defaultProvider = config.name;
    }
  }

  get(name?: string): ModelProvider | undefined {
    return this.providers.get(name || this.defaultProvider);
  }

  getDefault(): ModelProvider {
    const provider = this.providers.get(this.defaultProvider);
    if (!provider) {
      throw new Error('No AI provider available');
    }
    return provider;
  }

  list(): string[] {
    return Array.from(this.providers.keys());
  }

  listAvailable(): string[] {
    return this.availableProviders;
  }

  getConfig(name: string): ProviderConfig | undefined {
    return this.configs.get(name);
  }

  setDefault(name: string): void {
    if (this.providers.has(name)) {
      this.defaultProvider = name;
    }
  }

  getStatus(): ProviderStatus[] {
    const statuses: ProviderStatus[] = [];
    
    const allProviders = [
      { name: 'anthropic', envVar: 'ANTHROPIC_API_KEY', docs: 'anthropic.com/claude' },
      { name: 'openai', envVar: 'OPENAI_API_KEY', docs: 'platform.openai.com' },
      { name: 'gemini', envVar: 'GEMINI_API_KEY', docs: 'ai.google.dev' },
      { name: 'kimi', envVar: 'MOONSHOT_API_KEY', docs: 'platform.moonshot.cn' },
      { name: 'minimax', envVar: 'MINIMAX_API_KEY', docs: 'api.minimax.io' },
      { name: 'zai', envVar: 'ZAI_API_KEY', docs: 'zai.io' },
      { name: 'deepseek', envVar: 'DEEPSEEK_API_KEY', docs: 'api.deepseek.com' },
      { name: 'ollama', envVar: 'OLLAMA_HOST', docs: 'ollama.com (local)' },
      { name: 'lmstudio', envVar: 'LMSTUDIO_URL', docs: 'lmstudio.ai (local)' }
    ];

    for (const p of allProviders) {
      const config = this.configs.get(p.name);
      const available = this.availableProviders.includes(p.name);
      
      statuses.push({
        name: p.name,
        available,
        configured: !!process.env[p.envVar] || config?.baseUrl !== undefined,
        docs: p.docs,
        models: config?.models || []
      });
    }

    return statuses;
  }

  getSetupInstructions(): string {
    const status = this.getStatus();
    const unconfigured = status.filter(s => !s.configured);

    if (unconfigured.length === 0) {
      return 'All providers configured!';
    }

    let instructions = '\n🛠️  Configure a provider:\n\n';

    for (const s of unconfigured) {
      instructions += `  export ${s.name.toUpperCase()}_API_KEY=your_key   # ${s.docs}\n`;
    }

    instructions += `\nOr start a local provider:\n`;
    instructions += `  • LM Studio: https://lmstudio.ai\n`;
    instructions += `  • Ollama: https://ollama.com\n\n`;
    instructions += `Then re-run Duck CLI.\n`;

    return instructions;
  }
}

export interface ProviderStatus {
  name: string;
  available: boolean;
  configured: boolean;
  docs?: string;
  models: string[];
}

// ============= PROVIDER IMPLEMENTATIONS =============

// LM Studio (Local)
class LMStudioProvider implements ModelProvider {
  name = 'lmstudio';
  private config: ProviderConfig;

  constructor(config: ProviderConfig) {
    this.config = config;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.baseUrl}/v1/models`, {
        signal: AbortSignal.timeout(2000)
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async complete(request: CompletionRequest): Promise<ModelResponse> {
    const response = await fetch(`${this.config.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.config.apiKey ? { 'Authorization': `Bearer ${this.config.apiKey}` } : {})
      },
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
          function: { name: t.name, description: t.description, parameters: t.input_schema }
        }))
      })
    });

    if (!response.ok) {
      throw new Error(`LM Studio error: ${response.status}`);
    }

    const data: any = await response.json();
    return {
      text: data.choices?.[0]?.message?.content,
      toolCalls: data.choices?.[0]?.message?.tool_calls?.map((c: any) => ({
        id: c.id,
        name: c.function.name,
        arguments: typeof c.function.arguments === 'string' 
          ? JSON.parse(c.function.arguments) : c.function.arguments || {}
      }))
    };
  }
}

// Moonshot/Kimi
class MoonshotProvider implements ModelProvider {
  name = 'kimi';
  private config: ProviderConfig;

  constructor(config: ProviderConfig) {
    this.config = config;
  }

  async isAvailable(): Promise<boolean> {
    return !!this.config.apiKey;
  }

  async complete(request: CompletionRequest): Promise<ModelResponse> {
    const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`
      },
      body: JSON.stringify({
        model: request.model || 'moonshot-v1-32k',
        messages: [
          ...(request.systemPrompt ? [{ role: 'system' as const, content: request.systemPrompt }] : []),
          ...request.messages
        ],
        max_tokens: request.maxTokens || 4096,
        temperature: request.temperature || 0.7,
        tools: request.tools?.map(t => ({
          type: 'function',
          function: { name: t.name, description: t.description, parameters: t.input_schema }
        }))
      })
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Kimi/Moonshot error: ${response.status} - ${err}`);
    }

    const data: any = await response.json();
    return {
      text: data.choices?.[0]?.message?.content,
      toolCalls: data.choices?.[0]?.message?.tool_calls?.map((c: any) => ({
        id: c.id,
        name: c.function.name,
        arguments: typeof c.function.arguments === 'string' 
          ? JSON.parse(c.function.arguments) : c.function.arguments || {}
      }))
    };
  }
}

// MiniMax
class MiniMaxProvider implements ModelProvider {
  name = 'minimax';
  private config: ProviderConfig;

  constructor(config: ProviderConfig) {
    this.config = config;
  }

  async isAvailable(): Promise<boolean> {
    return !!this.config.apiKey;
  }

  async complete(request: CompletionRequest): Promise<ModelResponse> {
    const response = await fetch(`${this.config.baseUrl}/text/chatcompletion_v2`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`
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
      const err = await response.text();
      throw new Error(`MiniMax error: ${response.status} - ${err}`);
    }

    const data: any = await response.json();
    return {
      text: data.choices?.[0]?.message?.content
    };
  }
}

// OpenAI-Compatible (ZAI, DeepSeek, Custom, etc.)
class OpenAICompatibleProvider implements ModelProvider {
  name: string;
  private config: ProviderConfig;

  constructor(config: ProviderConfig) {
    this.name = config.name;
    this.config = config;
  }

  async isAvailable(): Promise<boolean> {
    return !!this.config.apiKey || !!this.config.baseUrl;
  }

  async complete(request: CompletionRequest): Promise<ModelResponse> {
    const url = `${this.config.baseUrl}/chat/completions`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.config.apiKey ? { 'Authorization': `Bearer ${this.config.apiKey}` } : {})
      },
      body: JSON.stringify({
        model: request.model || this.config.models?.[0] || 'default',
        messages: [
          ...(request.systemPrompt ? [{ role: 'system' as const, content: request.systemPrompt }] : []),
          ...request.messages
        ],
        max_tokens: request.maxTokens || 4096,
        temperature: request.temperature || 0.7,
        tools: request.tools?.map(t => ({
          type: 'function',
          function: { name: t.name, description: t.description, parameters: t.input_schema }
        }))
      })
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`${this.name} error: ${response.status} - ${err}`);
    }

    const data: any = await response.json();
    return {
      text: data.choices?.[0]?.message?.content,
      toolCalls: data.choices?.[0]?.message?.tool_calls?.map((c: any) => ({
        id: c.id,
        name: c.function.name,
        arguments: typeof c.function.arguments === 'string' 
          ? JSON.parse(c.function.arguments) : c.function.arguments || {}
      }))
    };
  }
}

// Anthropic (Claude)
class AnthropicProvider implements ModelProvider {
  name = 'anthropic';
  private config: ProviderConfig;

  constructor(config: ProviderConfig) {
    this.config = config;
  }

  async isAvailable(): Promise<boolean> {
    return !!this.config.apiKey;
  }

  async complete(request: CompletionRequest): Promise<ModelResponse> {
    const response = await fetch(`${this.config.baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey!,
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
      const err = await response.text();
      throw new Error(`Anthropic error: ${response.status} - ${err}`);
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

// Google Gemini
class GeminiProvider implements ModelProvider {
  name = 'gemini';
  private config: ProviderConfig;

  constructor(config: ProviderConfig) {
    this.config = config;
  }

  async isAvailable(): Promise<boolean> {
    return !!this.config.apiKey;
  }

  async complete(request: CompletionRequest): Promise<ModelResponse> {
    const model = request.model || 'gemini-2.0-flash';
    const contents = request.messages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

    const response = await fetch(
      `${this.config.baseUrl}/models/${model}:generateContent?key=${this.config.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          systemInstruction: request.systemPrompt ? { parts: [{ text: request.systemPrompt }] } : undefined,
          generationConfig: {
            maxOutputTokens: request.maxTokens || 4096,
            temperature: request.temperature || 0.7
          },
          tools: request.tools?.map(t => ({
            functionDeclarations: [{
              name: t.name,
              description: t.description,
              parameters: t.input_schema
            }]
          }))
        })
      }
    );

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Gemini error: ${response.status} - ${err}`);
    }

    const data: any = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.find((p: any) => p.text)?.text;
    const toolCalls = data.candidates?.[0]?.content?.parts?.filter((p: any) => p.functionCall);

    return {
      text,
      toolCalls: toolCalls?.map((c: any, i: number) => ({
        id: `call_${i}`,
        name: c.functionCall.name,
        arguments: c.functionCall.args || {}
      }))
    };
  }
}

// Ollama (Local)
class OllamaProvider implements ModelProvider {
  name = 'ollama';
  private config: ProviderConfig;

  constructor(config: ProviderConfig) {
    this.config = config;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(2000)
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async complete(request: CompletionRequest): Promise<ModelResponse> {
    const response = await fetch(`${this.config.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: request.model || 'llama3.2',
        messages: [
          ...(request.systemPrompt ? [{ role: 'system', content: request.systemPrompt }] : []),
          ...request.messages.map(m => ({ role: m.role, content: m.content }))
        ],
        stream: false
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama error: ${response.status}`);
    }

    const data: any = await response.json();
    return {
      text: data.message?.content
    };
  }
}
