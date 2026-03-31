/**
 * Duck CLI - Simple Provider System
 */

export interface Provider {
  name: string;
  complete(opts: { model: string; messages: any[]; tools?: any[] }): Promise<{ text?: string; toolCalls?: any[] }>;
}

export class MiniMaxProvider implements Provider {
  name = 'minimax';
  private apiKey: string;
  
  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }
  
  async complete(opts: { model: string; messages: any[]; tools?: any[] }): Promise<{ text?: string; toolCalls?: any[] }> {
    const response = await fetch('https://api.minimax.io/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: opts.model || 'abab6.5s-chat',
        messages: opts.messages,
        tools: opts.tools
      })
    });
    
    const data: any = await response.json();
    return {
      text: data.choices?.[0]?.message?.content,
      toolCalls: data.choices?.[0]?.message?.tool_calls
    };
  }
}

export class LMStudioProvider implements Provider {
  name = 'lmstudio';
  private url: string;
  private apiKey: string;
  
  constructor(url: string, apiKey: string = 'not-needed') {
    this.url = url;
    this.apiKey = apiKey;
  }
  
  async complete(opts: { model: string; messages: any[]; tools?: any[] }): Promise<{ text?: string; toolCalls?: any[] }> {
    const response = await fetch(`${this.url}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: opts.model || 'local-model',
        messages: opts.messages
      })
    });
    
    const data: any = await response.json();
    return {
      text: data.choices?.[0]?.message?.content
    };
  }
}

export function createProvider(type: string): Provider | null {
  switch (type) {
    case 'minimax':
      if (process.env.MINIMAX_API_KEY) {
        return new MiniMaxProvider(process.env.MINIMAX_API_KEY);
      }
      break;
    case 'lmstudio':
      if (process.env.LMSTUDIO_URL) {
        return new LMStudioProvider(process.env.LMSTUDIO_URL, process.env.LMSTUDIO_KEY);
      }
      break;
  }
  return null;
}
