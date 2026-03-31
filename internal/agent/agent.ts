/**
 * Duck CLI - Complete Agent with All Features
 * 
 * Features:
 * - Multi-provider with fallback
 * - FTS5 session storage
 * - Frozen snapshot memory
 * - Self-creating skills
 * - Auth profiles with health checks
 * - Security scanning
 */

import { Tool, ToolResult } from '../tools/registry.js';
import { ToolSecurityScanner } from '../tools/toolsets.js';
import { ModelProvider, ModelResponse } from '../providers/manager.js';
import { SessionStore } from '../memory/sqlite-store.js';
import { FrozenSnapshotMemory } from '../memory/snapshot-memory.js';
import { SessionManager } from '../memory/session-manager.js';
import { SelfCreatingSkills } from '../skills/self-creator.js';

export interface AgentConfig {
  model: string;
  provider: ModelProvider;
  tools: Tool[];
  systemPrompt?: string;
  sessionId?: string;
  maxIterations?: number;
  enableMemory?: boolean;
  enableSkillsCreation?: boolean;
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
  
  // Features
  private sessionStore?: SessionStore;
  private memory?: FrozenSnapshotMemory;
  private sessionManager?: SessionManager;
  private selfCreatingSkills?: SelfCreatingSkills;

  constructor(config: AgentConfig) {
    this.config = config;
    this.tools = new Map(config.tools.map(t => [t.name, t]));
    this.sessionId = config.sessionId || `agent_${Date.now()}`;
  }

  async initialize(): Promise<void> {
    // Initialize session storage
    this.sessionStore = new SessionStore();
    this.sessionStore.createSession('cli', this.config.model);

    // Initialize memory
    this.memory = new FrozenSnapshotMemory();
    await this.memory.initialize();

    // Initialize session manager
    this.sessionManager = new SessionManager();
    await this.sessionManager.autoCleanup();

    // Initialize self-creating skills
    this.selfCreatingSkills = new SelfCreatingSkills();
    await this.selfCreatingSkills.initialize();

    // Add memory tools
    this.addMemoryTools();

    // Add skill creation tools
    this.addSkillTools();

    // Build system prompt with memory
    this.buildSystemPrompt();
  }

  private addMemoryTools(): void {
    if (!this.memory) return;

    const memoryTool: Tool = {
      name: 'Memory',
      description: 'Persistent memory storage. Actions: add, replace, remove, list, search',
      definition: {
        name: 'Memory',
        description: 'Manage persistent memory across sessions',
        schema: {
          type: 'object',
          properties: {
            action: { type: 'string', enum: ['add', 'replace', 'remove', 'list', 'search'] },
            content: { type: 'string', description: 'Content for add/replace' },
            find: { type: 'string', description: 'Pattern to find for replace/remove' },
            type: { type: 'string', enum: ['memory', 'user'], description: 'Type of memory' },
            query: { type: 'string', description: 'Search query' }
          },
          required: ['action']
        }
      },
      execute: async (args: any) => {
        const { action, content, find, type = 'memory', query } = args;

        switch (action) {
          case 'add':
            const addResult = await this.memory!.add(content, type);
            return { type: 'result', tool: 'Memory', success: addResult.success, output: JSON.stringify(addResult), error: addResult.error };

          case 'replace':
            const repResult = await this.memory!.replace(find, content, type);
            return { type: 'result', tool: 'Memory', success: repResult.success, output: JSON.stringify(repResult), error: repResult.error };

          case 'remove':
            const remResult = await this.memory!.remove(find, type);
            return { type: 'result', tool: 'Memory', success: remResult.success, output: JSON.stringify(remResult), error: remResult.error };

          case 'list':
            const entries = this.memory!.list(type);
            return { type: 'result', tool: 'Memory', success: true, output: JSON.stringify(entries) };

          case 'search':
            const results = this.memory!.search(query || '', type);
            return { type: 'result', tool: 'Memory', success: true, output: JSON.stringify(results) };

          default:
            return { type: 'error', tool: 'Memory', success: false, output: '', error: `Unknown action: ${action}` };
        }
      }
    };

    this.tools.set('Memory', memoryTool);
  }

  private addSkillTools(): void {
    if (!this.selfCreatingSkills) return;

    // Skill create tool
    const createSkillTool: Tool = {
      name: 'CreateSkill',
      description: 'Create a reusable skill from current workflow',
      definition: {
        name: 'CreateSkill',
        description: 'Save current workflow as a reusable skill',
        schema: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            description: { type: 'string' },
            triggers: { type: 'array', items: { type: 'string' } },
            content: { type: 'string' }
          },
          required: ['name', 'description']
        }
      },
      execute: async (args: any) => {
        const result = await this.selfCreatingSkills!.createSkill(args);
        return { type: 'result', tool: 'CreateSkill', success: result.success, output: JSON.stringify(result), error: result.error };
      }
    };

    // Skill patch tool
    const patchSkillTool: Tool = {
      name: 'PatchSkill',
      description: 'Update an existing skill',
      definition: {
        name: 'PatchSkill',
        description: 'Update skill content by finding and replacing text',
        schema: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            find: { type: 'string' },
            replace: { type: 'string' }
          },
          required: ['name', 'find', 'replace']
        }
      },
      execute: async (args: any) => {
        const result = await this.selfCreatingSkills!.patchSkill(args.name, args.find, args.replace);
        return { type: 'result', tool: 'PatchSkill', success: result.success, output: JSON.stringify(result), error: result.error };
      }
    };

    // List skills tool
    const listSkillsTool: Tool = {
      name: 'ListSkills',
      description: 'List all available skills',
      definition: {
        name: 'ListSkills',
        description: 'Show all skills including auto-created ones',
        schema: {
          type: 'object',
          properties: {}
        }
      },
      execute: async () => {
        const skills = this.selfCreatingSkills!.listSkills();
        return { type: 'result', tool: 'ListSkills', success: true, output: JSON.stringify(skills, null, 2) };
      }
    };

    this.tools.set('CreateSkill', createSkillTool);
    this.tools.set('PatchSkill', patchSkillTool);
    this.tools.set('ListSkills', listSkillsTool);
  }

  private buildSystemPrompt(): void {
    if (!this.memory) return;

    const snapshot = this.memory.getFrozenSnapshot();
    const usage = this.memory.getUsageStats();

    const memoryBlock = snapshot.memory
      ? `\n\n## MEMORY (${usage.memory.percent}% — ${usage.memory.chars}/${usage.memory.max} chars)\n${snapshot.memory}\n`
      : '';

    const userBlock = snapshot.user
      ? `\n\n## USER CONTEXT (${usage.user.percent}% — ${usage.user.chars}/${usage.user.max} chars)\n${snapshot.user}\n`
      : '';

    // Prepend to system prompt
    if (this.config.systemPrompt) {
      this.config.systemPrompt = `## PERSISTENT MEMORY${memoryBlock}${userBlock}\n\n${this.config.systemPrompt}`;
    } else {
      this.config.systemPrompt = `## PERSISTENT MEMORY${memoryBlock}${userBlock}\n\nYou are Duck CLI, an expert coding assistant.`;
    }
  }

  async run(prompt: string): Promise<string> {
    this.messages.push({ role: 'user', content: prompt });

    // Track for skill creation
    if (this.selfCreatingSkills) {
      // Extract tool calls from message for tracking
    }

    let iter = 0;
    const maxIterations = this.config.maxIterations || 50;

    while (iter < maxIterations) {
      iter++;

      try {
        const response = await this.complete();

        if (response.toolCalls && response.toolCalls.length > 0) {
          // Track tool calls for self-creating skills
          for (const call of response.toolCalls) {
            this.selfCreatingSkills?.trackToolCall(call.name, call.arguments);

            // Security scan
            try {
              this.security.blockIfThreat(JSON.stringify(call.arguments));
            } catch (e: any) {
              this.messages.push({
                role: 'tool',
                content: { type: 'error', tool: call.name, success: false, output: '', error: e.message }
              });
              continue;
            }

            const tool = this.tools.get(call.name);
            if (!tool) {
              this.messages.push({
                role: 'tool',
                content: { type: 'error', tool: call.name, success: false, output: '', error: `Unknown tool: ${call.name}` }
              });
              continue;
            }

            try {
              const result = await tool.execute(call.arguments || {});
              this.messages.push({ role: 'tool', content: result });

              // Mark skill as used if applicable
              if (this.selfCreatingSkills) {
                this.selfCreatingSkills.markUsed(call.name);
              }
            } catch (error: any) {
              this.messages.push({
                role: 'tool',
                content: { type: 'error', tool: call.name, success: false, output: '', error: String(error) }
              });
            }
          }
        } else if (response.text) {
          this.messages.push({ role: 'assistant', content: response.text });
          
          // Store in session
          this.sessionStore?.addMessage(this.sessionId, 'assistant', response.text);
          
          return response.text;
        }
      } catch (error: any) {
        if (error.message.includes('not available') || error.message.includes('API key')) {
          throw error;
        }
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

  // Cleanup
  cleanup(): void {
    this.sessionStore?.close();
    this.sessionManager?.close();
  }
}

export default Agent;
