/**
 * 🦆 Duck Agent - Core Agent System
 */

import { EventEmitter } from 'events';
import { ProviderManager } from '../providers/manager.js';
import { MemorySystem } from '../memory/system.js';
import { ToolRegistry } from '../tools/registry.js';
import { SkillRunner } from '../skills/runner.js';
import { DesktopControl } from '../integrations/desktop.js';

export interface AgentConfig {
  name?: string;
  model?: string;
  provider?: string;
  tools?: string[];
  soul?: string;
  memoryDir?: string;
}

export interface Task {
  id: string;
  input: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: string;
  error?: string;
  steps: TaskStep[];
  createdAt: number;
  completedAt?: number;
}

export interface TaskStep {
  tool?: string;
  input?: any;
  output?: any;
  error?: string;
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
  private running: boolean = false;
  private currentTask: Task | null = null;
  private initialized: boolean = false;
  private toolsRegistered: boolean = false;

  constructor(config: AgentConfig = {}) {
    super();
    
    this.id = `agent_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this.name = config.name || 'Duck Agent';
    this.config = {
      name: this.name,
      model: 'default',
      provider: 'auto',
      ...config
    };
    
    this.providers = new ProviderManager();
    this.memory = new MemorySystem(this.config.memoryDir);
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
    this.tools.register({
      name: 'desktop_open',
      description: 'Open an application',
      schema: { app: 'string' },
      handler: async (args: any) => this.desktop.openApp(args.app)
    });

    this.tools.register({
      name: 'desktop_click',
      description: 'Click at coordinates',
      schema: { x: 'number', y: 'number' },
      handler: async (args: any) => this.desktop.click(args.x, args.y)
    });

    this.tools.register({
      name: 'desktop_type',
      description: 'Type text',
      schema: { text: 'string' },
      handler: async (args: any) => this.desktop.type(args.text)
    });

    this.tools.register({
      name: 'desktop_screenshot',
      description: 'Take a screenshot',
      schema: {},
      handler: async () => this.desktop.screenshot()
    });

    this.tools.register({
      name: 'memory_search',
      description: 'Search memory',
      schema: { query: 'string' },
      handler: async (args: any) => this.memory.search(args.query)
    });

    this.tools.register({
      name: 'memory_add',
      description: 'Add to memory',
      schema: { content: 'string', type: 'string' },
      handler: async (args: any) => this.memory.add(args.content, args.type)
    });

    this.tools.register({
      name: 'execute',
      description: 'Execute shell command',
      schema: { command: 'string' },
      handler: async (args: any) => {
        const { exec } = await import('child_process');
        return new Promise((resolve) => {
          exec(args.command, (error, stdout, stderr) => {
            resolve({ stdout, stderr, error: error?.message });
          });
        });
      }
    });
  }

  async think(input: string): Promise<string> {
    const provider = this.providers.getActive();
    if (!provider) {
      // Fallback to reasoning without AI
      return `Thinking about: ${input}\n\nWithout an AI provider, I can still reason through this...\n\nKey considerations:\n1. Context: ${input}\n2. This requires analysis and planning\n3. I need more information to provide a complete answer`;
    }

    const context = await this.buildContext(input);
    const response = await provider.complete({
      model: this.config.model || 'default',
      messages: context
    });

    return response.text || 'No response';
  }

  private async buildContext(input: string): Promise<any[]> {
    const messages: any[] = [];
    
    const soul = this.memory.getSoul();
    messages.push({ role: 'system', content: soul });

    const relevantMemory = await this.memory.getRelevant(input);
    if (relevantMemory.length > 0) {
      messages.push({
        role: 'system',
        content: `Relevant memory:\n${relevantMemory.join('\n')}`
      });
    }

    const tools = this.tools.list();
    if (tools.length > 0) {
      messages.push({
        role: 'system',
        content: `Tools: ${tools.map(t => `- ${t.name}: ${t.description}`).join('\n')}`
      });
    }

    messages.push({ role: 'user', content: input });
    return messages;
  }

  async execute(input: string): Promise<string> {
    console.log(`\n🦆 Executing: "${input}"`);
    
    const task: Task = {
      id: `task_${Date.now()}`,
      input,
      status: 'running',
      steps: [],
      createdAt: Date.now()
    };

    this.currentTask = task;
    this.emit('task:start', task);

    try {
      // If no AI provider, just return reasoning
      if (this.providers.list().length === 0) {
        const result = await this.think(input);
        task.result = result;
        task.status = 'completed';
        task.completedAt = Date.now();
        this.emit('task:complete', task);
        await this.memory.add(`${input} → ${result}`, 'interaction');
        return result;
      }

      const thought = await this.think(input);
      this.emit('thought', thought);
      
      const toolCalls = this.parseToolCalls(thought);
      let result = thought;
      
      for (const call of toolCalls) {
        const step: TaskStep = {
          tool: call.name,
          input: call.args,
          timestamp: Date.now()
        };

        try {
          const output = await this.tools.execute(call.name, call.args);
          step.output = output;
          result = typeof output === 'string' ? output : JSON.stringify(output);
        } catch (error: any) {
          step.error = error.message;
        }

        task.steps.push(step);
      }

      task.result = result;
      task.status = 'completed';
      task.completedAt = Date.now();
      this.emit('task:complete', task);
      
      await this.memory.add(`${input} → ${result}`, 'interaction');
      
      return result;

    } catch (error: any) {
      task.status = 'failed';
      task.error = error.message;
      task.completedAt = Date.now();
      this.emit('task:error', task, error);
      return `Error: ${error.message}`;
    }
  }

  private parseToolCalls(text: string): Array<{ name: string; args: any }> {
    const calls: Array<{ name: string; args: any }> = [];
    const regex = /\[TOOL:\s*(\w+)\s*\|\s*args:\s*(\{[^}]+\})\]/g;
    let match;
    
    while ((match = regex.exec(text)) !== null) {
      try {
        calls.push({ name: match[1], args: JSON.parse(match[2]) });
      } catch {}
    }

    return calls;
  }

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

  async remember(content: string): Promise<void> {
    await this.memory.add(content, 'fact');
  }

  async recall(query: string): Promise<string[]> {
    return this.memory.search(query);
  }

  isRunning(): boolean {
    return this.running;
  }

  getStatus() {
    return {
      id: this.id,
      name: this.name,
      running: this.running,
      providers: this.providers.list().length,
      tools: this.tools.list().length,
      skills: this.skills.list()
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
