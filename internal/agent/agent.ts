/**
 * Duck CLI - Core Agent
 * 
 * Based on Claude Code's agent architecture:
 * - Tool execution loop
 * - Context management
 * - Streaming responses
 */

import { Tool, ToolResult } from '../tools/registry.js';
import { ModelProvider, ModelResponse } from '../providers/manager.js';

export interface AgentConfig {
  model: string;
  provider: ModelProvider;
  tools: Tool[];
  systemPrompt?: string;
}

export interface Message {
  role: 'user' | 'assistant' | 'tool';
  content: string | ToolResult;
}

export class Agent {
  private config: AgentConfig;
  private messages: Message[] = [];
  private tools: Map<string, Tool>;

  constructor(config: AgentConfig) {
    this.config = config;
    this.tools = new Map(config.tools.map(t => [t.name, t]));
  }

  async run(prompt: string): Promise<string> {
    // Add user message
    this.messages.push({
      role: 'user',
      content: prompt
    });

    // Main loop
    let iter = 0;
    const maxIterations = 50;

    while (iter < maxIterations) {
      iter++;

      // Get completion
      const response = await this.complete();

      // Handle response
      if (response.toolCalls && response.toolCalls.length > 0) {
        // Execute tools
        for (const call of response.toolCalls) {
          const tool = this.tools.get(call.name);
          
          if (!tool) {
            this.messages.push({
              role: 'tool',
              content: {
                type: 'error',
                tool: call.name,
                success: false,
                output: '',
                error: `Unknown tool: ${call.name}`
              }
            });
            continue;
          }

          try {
            const result = await tool.execute(call.arguments || {});
            this.messages.push({
              role: 'tool',
              content: result
            });
          } catch (error) {
            this.messages.push({
              role: 'tool',
              content: {
                type: 'error',
                tool: call.name,
                success: false,
                output: '',
                error: String(error)
              }
            });
          }
        }
      } else if (response.text) {
        // Final response
        this.messages.push({
          role: 'assistant',
          content: response.text
        });
        return response.text;
      }
    }

    throw new Error('Max iterations exceeded');
  }

  private async complete(): Promise<ModelResponse> {
    // Build messages for provider
    const providerMessages = this.messages.map(m => ({
      role: m.role === 'tool' ? 'user' : m.role,
      content: typeof m.content === 'string' 
        ? m.content 
        : `Tool: ${m.content.tool}\nResult: ${m.content.output}`
    }));

    return this.config.provider.complete({
      model: this.config.model,
      messages: providerMessages,
      tools: Array.from(this.tools.values()).map(t => t.definition),
      systemPrompt: this.config.systemPrompt
    });
  }

  // Context management
  getMessages(): Message[] {
    return this.messages;
  }

  clear(): void {
    this.messages = [];
  }

  compress(): void {
    // Keep recent messages, summarize older ones
    if (this.messages.length > 20) {
      const recent = this.messages.slice(-10);
      const older = this.messages.slice(0, -10);
      
      // TODO: Implement summarization
      // For now, just keep recent
      this.messages = recent;
    }
  }
}

export default Agent;
