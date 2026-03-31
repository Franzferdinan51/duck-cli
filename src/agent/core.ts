/**
 * 🦆 Duck Agent - Full-Featured AI Agent
 * Inspired by Hermes Agent + OpenClaw + Claude Code
 * 
 * Features:
 * - Multi-turn conversation with history
 * - Tool registry with approval system
 * - Context compression
 * - Memory with facts/interactions
 * - MCP integration
 * - Subagent delegation
 * - Desktop control
 */

import { EventEmitter } from 'events';
import { ProviderManager } from '../providers/manager.js';
import { MemorySystem } from '../memory/system.js';
import { ToolRegistry, ToolResult } from '../tools/registry.js';
import { SkillRunner } from '../skills/runner.js';
import { DesktopControl } from '../integrations/desktop.js';

export interface AgentConfig {
  name?: string;
  model?: string;
  provider?: string;
  maxIterations?: number;
  saveHistory?: boolean;
  autoApprove?: boolean;
  dangerousApproval?: boolean;
}

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

export interface ToolCall {
  name: string;
  args: any;
  result?: any;
  error?: string;
  approved?: boolean;
}

export interface ConversationTurn {
  user: string;
  assistant: string;
  toolCalls: ToolCall[];
  timestamp: number;
}

export class Agent extends EventEmitter {
  readonly id: string;
  name: string;
  
  private config: AgentConfig;
  private providers: ProviderManager;
  private memory: MemorySystem;
  private tools: ToolRegistry;
  private skills: SkillRunner;
  private desktop: DesktopControl;
  private initialized: boolean = false;
  private toolsRegistered: boolean = false;
  
  // Conversation
  private history: Message[] = [];
  private conversationTurns: ConversationTurn[] = [];
  private maxHistory: number = 50;
  
  // State
  private running: boolean = false;
  private iterationCount: number = 0;

  constructor(config: AgentConfig = {}) {
    super();
    
    this.id = `duck_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this.name = config.name || 'Duck Agent';
    this.config = {
      maxIterations: config.maxIterations || 10,
      saveHistory: config.saveHistory !== false,
      autoApprove: config.autoApprove || false,
      dangerousApproval: config.dangerousApproval !== false,
      ...config
    };
    
    this.providers = new ProviderManager();
    this.memory = new MemorySystem();
    this.tools = new ToolRegistry();
    this.skills = new SkillRunner();
    this.desktop = new DesktopControl();
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
    
    console.log(`🦆 ${this.name} initializing...`);
    
    await this.providers.load();
    await this.memory.initialize();
    await this.skills.load();
    
    if (!this.toolsRegistered) {
      this.registerTools();
      this.toolsRegistered = true;
    }
    
    console.log(`✅ ${this.name} ready!`);
    console.log(`   Providers: ${this.providers.list().length}`);
    console.log(`   Tools: ${this.tools.list().length}`);
    console.log(`   Skills: ${this.skills.list().length}`);
  }

  private registerTools(): void {
    // Desktop tools
    this.tools.register({
      name: 'desktop_open',
      description: 'Open an application on the desktop',
      schema: { app: { type: 'string', description: 'Application name to open' } },
      dangerous: false,
      handler: async (args: any) => {
        await this.desktop.openApp(args.app);
        return `Opened ${args.app}`;
      }
    });

    this.tools.register({
      name: 'desktop_click',
      description: 'Click at screen coordinates',
      schema: { x: { type: 'number' }, y: { type: 'number' } },
      dangerous: false,
      handler: async (args: any) => {
        await this.desktop.click(args.x, args.y);
        return `Clicked at ${args.x}, ${args.y}`;
      }
    });

    this.tools.register({
      name: 'desktop_type',
      description: 'Type text on the desktop',
      schema: { text: { type: 'string' } },
      dangerous: false,
      handler: async (args: any) => {
        await this.desktop.type(args.text);
        return `Typed: ${args.text}`;
      }
    });

    this.tools.register({
      name: 'desktop_screenshot',
      description: 'Take a screenshot of the desktop',
      schema: {},
      dangerous: false,
      handler: async () => {
        return await this.desktop.screenshot();
      }
    });

    // Memory tools
    this.tools.register({
      name: 'memory_remember',
      description: 'Remember important information for later',
      schema: { content: { type: 'string' }, type: { type: 'string', optional: true } },
      dangerous: false,
      handler: async (args: any) => {
        await this.memory.add(args.content, args.type || 'fact');
        return `Remembered: ${args.content}`;
      }
    });

    this.tools.register({
      name: 'memory_recall',
      description: 'Search through memories',
      schema: { query: { type: 'string' } },
      dangerous: false,
      handler: async (args: any) => {
        const results = await this.memory.search(args.query);
        return results.length > 0 ? results.join('\n') : 'No memories found';
      }
    });

    // Shell execution
    this.tools.register({
      name: 'shell',
      description: 'Execute a shell command',
      schema: { command: { type: 'string' } },
      dangerous: true,
      handler: async (args: any) => {
        const { exec } = await import('child_process');
        return new Promise((resolve) => {
          exec(args.command, { timeout: 30000 }, (error, stdout, stderr) => {
            if (error) {
              resolve({ error: error.message, stderr });
            } else {
              resolve({ stdout, stderr });
            }
          });
        });
      }
    });

    // File operations
    this.tools.register({
      name: 'file_read',
      description: 'Read contents of a file',
      schema: { path: { type: 'string' } },
      dangerous: false,
      handler: async (args: any) => {
        const { readFile } = await import('fs/promises');
        try {
          const content = await readFile(args.path, 'utf-8');
          return content.slice(0, 10000); // Limit output
        } catch (e: any) {
          return `Error reading file: ${e.message}`;
        }
      }
    });

    this.tools.register({
      name: 'file_write',
      description: 'Write content to a file',
      schema: { path: { type: 'string' }, content: { type: 'string' } },
      dangerous: true,
      handler: async (args: any) => {
        const { writeFile } = await import('fs/promises');
        try {
          await writeFile(args.path, args.content);
          return `Written to ${args.path}`;
        } catch (e: any) {
          return `Error writing file: ${e.message}`;
        }
      }
    });

    // Web search
    this.tools.register({
      name: 'web_search',
      description: 'Search the web for information',
      schema: { query: { type: 'string' } },
      dangerous: false,
      handler: async (args: any) => {
        // Placeholder - would integrate with search API
        return `Web search for: ${args.query}`;
      }
    });

    // Delegate to subagent
    this.tools.register({
      name: 'delegate',
      description: 'Delegate a task to a subagent',
      schema: { task: { type: 'string' }, agent: { type: 'string', optional: true } },
      dangerous: false,
      handler: async (args: any) => {
        // Placeholder for subagent delegation
        return `Delegating task: ${args.task}`;
      }
    });
  }

  async chat(message: string): Promise<string> {
    await this.ensureInitialized();
    
    // Add to history
    this.history.push({ role: 'user', content: message, timestamp: Date.now() });
    
    // Build context
    const context = await this.buildContext();
    
    // Get AI response
    const provider = this.providers.getActive();
    if (!provider) {
      return "No AI provider available. Please configure an API key.";
    }

    const response = await provider.complete({
      model: this.config.model,
      messages: context
    });

    const assistantMessage = response.text || 'No response';
    
    // Parse and execute tools
    const toolCalls = this.parseToolCalls(assistantMessage);
    let finalResponse = assistantMessage;
    
    for (const call of toolCalls) {
      if (this.iterationCount >= (this.config.maxIterations || 10)) {
        finalResponse += `\n\n⚠️ Max iterations reached.`;
        break;
      }

      this.iterationCount++;
      
      // Check if tool is dangerous and needs approval
      const tool = this.tools.get(call.name);
      if (tool?.dangerous && !this.config.autoApprove) {
        this.emit('tool:approval-required', call);
        call.approved = false;
        finalResponse += `\n\n🔒 Tool "${call.name}" requires approval.`;
        continue;
      }

      // Execute tool
      try {
        call.result = await this.tools.execute(call.name, call.args);
        finalResponse += `\n\n🔧 ${call.name}: ${JSON.stringify(call.result)}`;
      } catch (e: any) {
        call.error = e.message;
        finalResponse += `\n\n❌ ${call.name} failed: ${e.message}`;
      }
    }

    // Save to history
    this.history.push({ role: 'assistant', content: finalResponse, timestamp: Date.now() });
    
    // Save turn
    if (this.config.saveHistory) {
      this.conversationTurns.push({
        user: message,
        assistant: finalResponse,
        toolCalls,
        timestamp: Date.now()
      });
    }

    // Learn from interaction
    await this.memory.add(`${message} → ${finalResponse}`, 'interaction');

    return finalResponse;
  }

  private async buildContext(): Promise<any[]> {
    const messages: any[] = [];
    
    // System prompt with identity and capabilities
    const systemPrompt = this.buildSystemPrompt();
    messages.push({ role: 'system', content: systemPrompt });

    // Recent history (keep context window manageable)
    const recentHistory = this.history.slice(-this.maxHistory);
    messages.push(...recentHistory);

    return messages;
  }

  private buildSystemPrompt(): string {
    const parts: string[] = [];
    
    // Identity
    parts.push(`You are ${this.name}, an advanced AI assistant powered by Duck Agent.`);
    
    // Core capabilities
    parts.push(`
Capabilities:
- You can think, reason, and plan
- You have access to tools for various tasks
- You maintain memory across conversations
- You can learn from interactions

Available Tools:
${this.tools.list().map(t => `- ${t.name}: ${t.description}`).join('\n')}

Guidelines:
- Be helpful, concise, and practical
- Use tools when they make tasks easier
- Learn from feedback and remember important information
- Ask clarifying questions when needed
`.trim());

    return parts.join('\n\n');
  }

  private parseToolCalls(text: string): ToolCall[] {
    const calls: ToolCall[] = [];
    
    // Pattern 1: [TOOL: name | args: {...}]
    const pattern1 = /\[TOOL:\s*(\w+)\s*\|\s*args:\s*(\{[^}]+\})\]/g;
    let match;
    while ((match = pattern1.exec(text)) !== null) {
      try {
        calls.push({ name: match[1], args: JSON.parse(match[2]) });
      } catch {}
    }

    // Pattern 2: tool_name({...})
    const pattern2 = /(\w+)\s*\(\s*(\{[^}]+\})\s*\)/g;
    while ((match = pattern2.exec(text)) !== null) {
      if (this.tools.has(match[1])) {
        try {
          calls.push({ name: match[1], args: JSON.parse(match[2]) });
        } catch {}
      }
    }

    return calls;
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  // Legacy think() method
  async think(input: string): Promise<string> {
    return this.chat(input);
  }

  // Legacy execute() method  
  async execute(input: string): Promise<string> {
    return this.chat(input);
  }

  // Direct tool execution
  async useTool(name: string, args: any): Promise<any> {
    return this.tools.execute(name, args);
  }

  // Memory shortcuts
  async remember(content: string): Promise<void> {
    await this.memory.add(content, 'fact');
  }

  async recall(query: string): Promise<string[]> {
    return this.memory.search(query);
  }

  // Desktop shortcuts
  async openApp(app: string): Promise<void> {
    await this.desktop.openApp(app);
  }

  async click(x: number, y: number): Promise<void> {
    await this.desktop.click(x, y);
  }

  async type(text: string): Promise<void> {
    await this.desktop.type(text);
  }

  async screenshot(): Promise<string> {
    return this.desktop.screenshot();
  }

  // History management
  getHistory(): Message[] {
    return [...this.history];
  }

  clearHistory(): void {
    this.history = [];
  }

  // Status
  isRunning(): boolean {
    return this.running;
  }

  getStatus() {
    return {
      id: this.id,
      name: this.name,
      running: this.running,
      providers: this.providers.list().length,
      tools: this.tools.list(),
      skills: this.skills.list(),
      historyLength: this.history.length,
      iterations: this.iterationCount
    };
  }

  async shutdown(): Promise<void> {
    console.log(`\n🦆 ${this.name} shutting down...`);
    this.running = false;
    await this.memory.save();
    console.log(`✅ ${this.name} stopped`);
  }
}

export default Agent;
