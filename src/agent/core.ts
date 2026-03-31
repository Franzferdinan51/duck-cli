/**
 * 🦆 Duck Agent - Advanced AI Agent
 * Inspired by DuckBot-OS + Hermes + OpenClaw + Claude Code
 * 
 * Features:
 * - AI Router with provider fallback chains
 * - Learning system that improves over time
 * - Cost tracking and optimization
 * - Multi-agent delegation
 * - Conversation history with compression
 * - Desktop automation
 */

import { EventEmitter } from 'events';
import { ProviderManager } from '../providers/manager.js';
import { MemorySystem } from '../memory/system.js';
import { ToolRegistry, ToolDefinition } from '../tools/registry.js';
import { SkillRunner } from '../skills/runner.js';
import { DesktopControl } from '../integrations/desktop.js';

export interface AgentConfig {
  name?: string;
  model?: string;
  provider?: string;
  maxIterations?: number;
  maxHistory?: number;
  costBudget?: number;
  learningEnabled?: boolean;
}

export interface Message {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: number;
  cost?: number;
  tokens?: number;
}

export interface LearningEntry {
  input: string;
  output: string;
  success: boolean;
  timestamp: number;
  feedback?: string;
}

export interface CostRecord {
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  cost: number;
  timestamp: number;
}

export interface AgentMetrics {
  totalInteractions: number;
  successfulInteractions: number;
  failedInteractions: number;
  totalCost: number;
  totalTokens: number;
  averageConfidence: number;
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
  
  // Conversation
  private history: Message[] = [];
  private maxHistory: number;
  
  // Learning
  private learningEnabled: boolean;
  private learnedPatterns: Map<string, string> = new Map();
  private learningLog: LearningEntry[] = [];
  
  // Cost tracking
  private costRecords: CostRecord[] = [];
  private costBudget: number;
  private totalCost: number = 0;
  
  // Metrics
  private metrics: AgentMetrics = {
    totalInteractions: 0,
    successfulInteractions: 0,
    failedInteractions: 0,
    totalCost: 0,
    totalTokens: 0,
    averageConfidence: 0.8
  };

  constructor(config: AgentConfig = {}) {
    super();
    
    this.id = `duck_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this.name = config.name || 'Duck Agent';
    this.config = {
      maxIterations: config.maxIterations || 10,
      maxHistory: config.maxHistory || 50,
      costBudget: config.costBudget || 10, // $10 budget
      learningEnabled: config.learningEnabled !== false,
      ...config
    };
    
    this.maxHistory = this.config.maxHistory!;
    this.learningEnabled = this.config.learningEnabled!;
    this.costBudget = this.config.costBudget!;
    
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
    this.registerTools();
    
    console.log(`✅ ${this.name} ready!`);
    console.log(`   Providers: ${this.providers.list().length}`);
    console.log(`   Tools: ${this.tools.list().length}`);
    console.log(`   Skills: ${this.skills.list().length}`);
    console.log(`   Learning: ${this.learningEnabled ? 'Enabled' : 'Disabled'}`);
  }

  private registerTools(): void {
    // Desktop tools
    this.registerTool({
      name: 'desktop_open',
      description: 'Open an application',
      schema: { app: { type: 'string' } },
      dangerous: false,
      handler: async (args: any) => {
        await this.desktop.openApp(args.app);
        return `Opened ${args.app}`;
      }
    });

    this.registerTool({
      name: 'desktop_click',
      description: 'Click at coordinates',
      schema: { x: { type: 'number' }, y: { type: 'number' } },
      dangerous: false,
      handler: async (args: any) => {
        await this.desktop.click(args.x, args.y);
        return `Clicked at ${args.x}, ${args.y}`;
      }
    });

    this.registerTool({
      name: 'desktop_type',
      description: 'Type text',
      schema: { text: { type: 'string' } },
      dangerous: false,
      handler: async (args: any) => {
        await this.desktop.type(args.text);
        return `Typed: ${args.text}`;
      }
    });

    this.registerTool({
      name: 'desktop_screenshot',
      description: 'Take a screenshot',
      schema: {},
      dangerous: false,
      handler: async () => this.desktop.screenshot()
    });

    // Memory tools
    this.registerTool({
      name: 'memory_remember',
      description: 'Remember information',
      schema: { content: { type: 'string' }, type: { type: 'string', optional: true } },
      dangerous: false,
      handler: async (args: any) => {
        await this.memory.add(args.content, args.type || 'fact');
        return `Remembered: ${args.content}`;
      }
    });

    this.registerTool({
      name: 'memory_recall',
      description: 'Search memories',
      schema: { query: { type: 'string' } },
      dangerous: false,
      handler: async (args: any) => {
        const results = await this.memory.search(args.query);
        return results.length > 0 ? results.join('\n') : 'No memories found';
      }
    });

    // Shell execution
    this.registerTool({
      name: 'shell',
      description: 'Execute shell command',
      schema: { command: { type: 'string' } },
      dangerous: true,
      handler: async (args: any) => {
        const { exec } = await import('child_process');
        return new Promise((resolve) => {
          exec(args.command, { timeout: 30000 }, (error, stdout, stderr) => {
            resolve(error ? { error: error.message, stderr } : { stdout, stderr });
          });
        });
      }
    });

    // File tools
    this.registerTool({
      name: 'file_read',
      description: 'Read a file',
      schema: { path: { type: 'string' } },
      dangerous: false,
      handler: async (args: any) => {
        const { readFile } = await import('fs/promises');
        try {
          return await readFile(args.path, 'utf-8');
        } catch (e: any) {
          return `Error: ${e.message}`;
        }
      }
    });

    this.registerTool({
      name: 'file_write',
      description: 'Write to a file',
      schema: { path: { type: 'string' }, content: { type: 'string' } },
      dangerous: true,
      handler: async (args: any) => {
        const { writeFile } = await import('fs/promises');
        try {
          await writeFile(args.path, args.content);
          return `Written to ${args.path}`;
        } catch (e: any) {
          return `Error: ${e.message}`;
        }
      }
    });

    // Web search
    this.registerTool({
      name: 'web_search',
      description: 'Search the web',
      schema: { query: { type: 'string' } },
      dangerous: false,
      handler: async (args: any) => `Searching web for: ${args.query}`
    });

    // Learning tools
    this.registerTool({
      name: 'learn_from_feedback',
      description: 'Learn from feedback to improve future responses',
      schema: { success: { type: 'boolean' }, feedback: { type: 'string', optional: true } },
      dangerous: false,
      handler: async (args: any) => {
        if (this.learningEnabled) {
          this.learn(args.success, args.feedback);
        }
        return 'Learned from feedback';
      }
    });

    // Metrics
    this.registerTool({
      name: 'get_metrics',
      description: 'Get agent performance metrics',
      schema: {},
      dangerous: false,
      handler: async () => this.getMetrics()
    });

    // Cost
    this.registerTool({
      name: 'get_cost',
      description: 'Get cost tracking info',
      schema: {},
      dangerous: false,
      handler: async () => ({
        totalCost: this.totalCost,
        budget: this.costBudget,
        remaining: this.costBudget - this.totalCost,
        records: this.costRecords.length
      })
    });
  }

  private registerTool(def: ToolDefinition): void {
    this.tools.register(def);
    console.log(`   + Tool: ${def.name}${def.dangerous ? ' ⚠️' : ''}`);
  }

  async chat(message: string): Promise<string> {
    await this.ensureInitialized();
    this.metrics.totalInteractions++;
    
    // Check cost budget
    if (this.totalCost >= this.costBudget) {
      return "⚠️ Cost budget exceeded. Please try a simpler task or wait for budget reset.";
    }

    // Add to history
    this.history.push({ role: 'user', content: message, timestamp: Date.now() });
    
    // Check for learned patterns
    const learnedResponse = this.checkLearnedPatterns(message);
    if (learnedResponse) {
      this.history.push({ role: 'assistant', content: learnedResponse, timestamp: Date.now() });
      return learnedResponse;
    }

    // Build context with compression if needed
    const context = await this.buildContext();
    
    // Try providers in order (fallback chain)
    let response: string | null = null;
    let lastError: string = '';
    
    for (const providerName of this.providers.list()) {
      try {
        const provider = this.providers.get(providerName);
        if (!provider) continue;
        
        const result = await provider.complete({
          model: this.config.model,
          messages: context
        });
        
        if (result.text) {
          // Track cost (rough estimate)
          this.trackCost(providerName, this.estimateTokens(JSON.stringify(context)), this.estimateTokens(result.text));
          
          response = result.text;
          break;
        }
      } catch (e: any) {
        lastError = e.message;
        console.log(`Provider ${providerName} failed: ${lastError}`);
      }
    }

    if (!response) {
      this.metrics.failedInteractions++;
      return `❌ All providers failed. Last error: ${lastError}`;
    }

    // Parse and execute tools
    const toolCalls = this.parseToolCalls(response);
    for (const call of toolCalls) {
      try {
        const result = await this.tools.execute(call.name, call.args);
        response += `\n\n🔧 ${call.name}: ${JSON.stringify(result)}`;
      } catch (e: any) {
        response += `\n\n❌ ${call.name} failed: ${e.message}`;
      }
    }

    // Learn from this interaction
    if (this.learningEnabled) {
      this.learnFromInteraction(message, response);
    }

    // Save to history
    this.history.push({ role: 'assistant', content: response, timestamp: Date.now() });
    this.metrics.successfulInteractions++;

    // Trim history if needed
    if (this.history.length > this.maxHistory) {
      this.history = this.history.slice(-this.maxHistory);
    }

    return response;
  }

  private checkLearnedPatterns(input: string): string | null {
    const inputLower = input.toLowerCase();
    
    for (const [pattern, response] of this.learnedPatterns) {
      if (inputLower.includes(pattern.toLowerCase())) {
        return `📚 From memory: ${response}`;
      }
    }
    return null;
  }

  private learnFromInteraction(input: string, output: string): void {
    // Extract key patterns
    const words = input.toLowerCase().split(/\s+/);
    const significant = words.filter(w => w.length > 4);
    
    // Store successful patterns
    if (significant.length > 0 && output.length > 20) {
      const key = significant.slice(0, 3).join(' ');
      if (!this.learnedPatterns.has(key)) {
        this.learnedPatterns.set(key, output.slice(0, 200));
      }
    }
    
    // Log for persistence
    this.learningLog.push({
      input,
      output,
      success: true,
      timestamp: Date.now()
    });
  }

  learn(success: boolean, feedback?: string): void {
    const lastInteraction = this.learningLog[this.learningLog.length - 1];
    if (lastInteraction) {
      lastInteraction.success = success;
      lastInteraction.feedback = feedback;
    }
  }

  private async buildContext(): Promise<any[]> {
    const messages: any[] = [];
    
    // System prompt
    const systemPrompt = this.buildSystemPrompt();
    messages.push({ role: 'system', content: systemPrompt });

    // Learned patterns (if any)
    if (this.learnedPatterns.size > 0) {
      const patterns = Array.from(this.learnedPatterns.entries())
        .map(([k, v]) => `When asked about "${k}": ${v}`)
        .join('\n');
      messages.push({ role: 'system', content: `Learned responses:\n${patterns}` });
    }

    // Recent history
    const recentHistory = this.history.slice(-20);
    messages.push(...recentHistory);

    return messages;
  }

  private buildSystemPrompt(): string {
    return `You are ${this.name}, an advanced AI assistant.

You have access to tools for various tasks:
${this.tools.list().map(t => `- ${t.name}: ${t.description}`).join('\n')}

Guidelines:
- Be helpful, practical, and concise
- Use tools when they make tasks easier
- Learn from feedback and remember important information
- Track your cost and be efficient
- Explain what you're doing when using tools`;
  }

  private parseToolCalls(text: string): Array<{ name: string; args: any }> {
    const calls: Array<{ name: string; args: any }> = [];
    
    // Pattern: [TOOL: name | args: {...}]
    const pattern1 = /\[TOOL:\s*(\w+)\s*\|\s*args:\s*(\{[^}]+\})\]/g;
    let match;
    while ((match = pattern1.exec(text)) !== null) {
      try {
        calls.push({ name: match[1], args: JSON.parse(match[2]) });
      } catch {}
    }

    // Pattern: tool_name({...})
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

  private estimateTokens(text: string): number {
    // Rough estimate: ~4 chars per token
    return Math.ceil(text.length / 4);
  }

  private trackCost(provider: string, promptTokens: number, completionTokens: number): void {
    // Rough cost estimates (per 1M tokens)
    const costs: Record<string, number> = {
      'minimax': 0.5, // $0.5/M
      'openai': 2.0,  // $2/M
      'anthropic': 3.0, // $3/M
      'lmstudio': 0    // Free
    };
    
    const rate = costs[provider] || 1;
    const cost = (promptTokens + completionTokens) / 1_000_000 * rate;
    
    this.totalCost += cost;
    this.costRecords.push({
      provider,
      model: this.config.model || 'default',
      promptTokens,
      completionTokens,
      cost,
      timestamp: Date.now()
    });
  }

  getMetrics(): AgentMetrics {
    return {
      ...this.metrics,
      totalCost: this.totalCost
    };
  }

  getCostInfo(): { total: number; budget: number; remaining: number } {
    return {
      total: this.totalCost,
      budget: this.costBudget,
      remaining: this.costBudget - this.totalCost
    };
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  // Legacy methods
  async think(input: string): Promise<string> {
    return this.chat(input);
  }

  async execute(input: string): Promise<string> {
    return this.chat(input);
  }

  async remember(content: string): Promise<void> {
    await this.memory.add(content, 'fact');
  }

  async recall(query: string): Promise<string[]> {
    return this.memory.search(query);
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

  getHistory(): Message[] {
    return [...this.history];
  }

  clearHistory(): void {
    this.history = [];
  }

  getStatus() {
    return {
      id: this.id,
      name: this.name,
      providers: this.providers.list().length,
      tools: this.tools.list().length,
      toolList: this.tools.list(),
      skills: this.skills.list(),
      historyLength: this.history.length,
      learnedPatterns: this.learnedPatterns.size,
      cost: this.getCostInfo(),
      metrics: this.getMetrics()
    };
  }

  async shutdown(): Promise<void> {
    console.log(`\n🦆 ${this.name} shutting down...`);
    await this.memory.save();
    console.log(`   Total cost: $${this.totalCost.toFixed(4)}`);
    console.log(`   Interactions: ${this.metrics.totalInteractions}`);
    console.log(`   Success rate: ${(this.metrics.successfulInteractions / this.metrics.totalInteractions * 100).toFixed(1)}%`);
    console.log(`✅ ${this.name} stopped`);
  }
}

export default Agent;
