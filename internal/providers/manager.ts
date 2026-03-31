/**
 * Duck CLI - Multi-Provider Manager
 * 
 * Supports:
 * - Anthropic (Claude)
 * - OpenAI (GPT)
 * - Google (Gemini)
 * - LM Studio (local)
 * - MiniMax
 * - OpenAI-compatible APIs
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
}

export class ProviderManager {
  private providers = new Map<string, ModelProvider>();
  private defaultProvider = 'anthropic';

  async load(): Promise<void> {
    // Anthropic
    if (process.env.ANTHROPIC_API_KEY) {
      this.providers.set('anthropic', new AnthropicProvider(
        process.env.ANTHROPIC_API_KEY,
        process.env.ANTHROPIC_BASE_URL
      ));
    }

    // OpenAI
    if (process.env.OPENAI_API_KEY) {
      this.providers.set('openai', new OpenAIProvider(
        process.env.OPENAI_API_KEY,
        process.env.OPENAI_BASE_URL
      ));
    }

    // LM Studio (local)
    this.providers.set('lmstudio', new LMStudioProvider(
      process.env.LMSTUDIO_URL || 'http://localhost:1234',
      process.env.LMSTUDIO_API_KEY
    ));

    // MiniMax
    if (process.env.MINIMAX_API_KEY) {
      this.providers.set('minimax', new MiniMaxProvider(
        process.env.MINIMAX_API_KEY
      ));
    }

    // Set default based on available
    if (this.providers.has('anthropic')) {
      this.defaultProvider = 'anthropic';
    }
  }

  get(name?: string): ModelProvider | undefined {
    return this.providers.get(name || this.defaultProvider);
  }

  getDefault(): ModelProvider {
    return this.providers.get(this.defaultProvider)!;
  }

  list(): string[] {
    return Array.from(this.providers.keys());
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
        model: request.model,
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
      throw new Error(`Anthropic API error: ${response.status}`);
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

  async complete(request: CompletionRequest): Promise<ModelResponse> {
    const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: request.model,
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
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data: any = await response.json();
    
    return {
      text: data.choices?.[0]?.message?.content,
      toolCalls: data.choices?.[0]?.message?.tool_calls?.map((c: any) => ({
        id: c.id,
        name: c.function.name,
        arguments: JSON.parse(c.function.arguments)
      }))
    };
  }
}

// LM Studio Provider (Local)
class LMStudioProvider implements ModelProvider {
  name = 'lmstudio';
  private baseUrl: string;
  private apiKey?: string;

  constructor(baseUrl: string, apiKey?: string) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
  }

  async complete(request: CompletionRequest): Promise<ModelResponse> {
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
        model: request.model,
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
      throw new Error(`LM Studio error: ${response.status}`);
    }

    const data: any = await response.json();
    
    return {
      text: data.choices?.[0]?.message?.content,
      toolCalls: data.choices?.[0]?.message?.tool_calls?.map((c: any) => ({
        id: c.id,
        name: c.function.name,
        arguments: JSON.parse(c.function.arguments)
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

  async complete(request: CompletionRequest): Promise<ModelResponse> {
    // MiniMax uses OpenAI-compatible API
    const response = await fetch('https://api.minimax.io/v1/text/chatcompletion_v2', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: request.model,
        messages: [
          ...(request.systemPrompt ? [{ role: 'system' as const, content: request.systemPrompt }] : []),
          ...request.messages
        ],
        max_tokens: request.maxTokens || 4096,
        temperature: request.temperature || 0.7
      })
    });

    if (!response.ok) {
      throw new Error(`MiniMax error: ${response.status}`);
    }

    const data: any = await response.json();
    
    return {
      text: data.choices?.[0]?.message?.content
    };
  }
}
