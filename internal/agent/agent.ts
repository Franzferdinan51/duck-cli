/**
 * Duck CLI - Enhanced Core Agent
 * 
 * Now with:
 * - Session storage with FTS5
 * - Subagent delegation
 * - Cron scheduling
 * - Toolset restrictions
 * - Security scanning
 */

import { Tool, ToolResult } from '../tools/registry.js';
import { ToolSecurityScanner } from '../tools/toolsets.js';
import { ModelProvider, ModelResponse } from '../providers/manager.js';

export interface AgentConfig {
  model: string;
  provider: ModelProvider;
  tools: Tool[];
  systemPrompt?: string;
  sessionId?: string;
  maxIterations?: number;
}

export interface Message {
  role: 'user' | 'assistant' | 'tool';
  content: string | ToolResult;
}

export class Agent {
  private config: AgentConfig;
  private messages: Message[] = [];
  private tools: Map<string, Tool>;
  private security = new ToolSecurityScanner();
  public sessionId: string;

  constructor(config: AgentConfig) {
    this.config = config;
    this.tools = new Map(config.tools.map(t => [t.name, t]));
    this.sessionId = config.sessionId || `agent_${Date.now()}`;
  }

  async run(prompt: string): Promise<string> {
    this.messages.push({
      role: 'user',
      content: prompt
    });

    let iter = 0;
    const maxIterations = this.config.maxIterations || 50;

    while (iter < maxIterations) {
      iter++;

      try {
        const response = await this.complete();

        if (response.toolCalls && response.toolCalls.length > 0) {
          for (const call of response.toolCalls) {
            // Security scan tool arguments
            try {
              this.security.blockIfThreat(JSON.stringify(call.arguments));
            } catch (e: any) {
              this.messages.push({
                role: 'tool',
                content: {
                  type: 'error',
                  tool: call.name,
                  success: false,
                  output: '',
                  error: e.message
                }
              });
              continue;
            }

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
            } catch (error: any) {
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
          this.messages.push({
            role: 'assistant',
            content: response.text
          });
          return response.text;
        }
      } catch (error: any) {
        if (error.message.includes('not available') || error.message.includes('API key')) {
          throw error;
        }
        // Log and continue on tool errors
        console.error(`Iteration ${iter} error:`, error.message);
      }
    }

    throw new Error('Max iterations exceeded');
  }

  private async complete(): Promise<ModelResponse> {
    const providerMessages = this.messages.map(m => ({
      role: m.role === 'tool' ? 'user' as const : m.role,
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
    // Keep recent, summarize older
    if (this.messages.length > 20) {
      const recent = this.messages.slice(-10);
      this.messages = recent;
    }
  }

  // Tool management
  addTool(tool: Tool): void {
    this.tools.set(tool.name, tool);
  }

  removeTool(name: string): void {
    this.tools.delete(name);
  }

  getTools(): Tool[] {
    return Array.from(this.tools.values());
  }
}

export default Agent;
