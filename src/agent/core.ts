/**
 * 🦆 Duck Agent - Advanced AI Agent
 * With SQLite memory, autonomous planning, and dangerous tool guardrails
 */

import { EventEmitter } from 'events';
import { ProviderManager } from '../providers/manager.js';
import { MemorySystem } from '../memory/system.js';
import { ToolRegistry, ToolDefinition } from '../tools/registry.js';
import { SkillRunner } from '../skills/runner.js';
import { DesktopControl } from '../integrations/desktop.js';
import { Planner, Plan, PlanStep } from './planner.js';
import { DangerousToolGuard, ToolRisk, ApprovalCallback } from '../tools/approval.js';

export { Planner, Plan, PlanStep };
export { DangerousToolGuard, ToolRisk };

export interface AgentConfig {
  name?: string;
  model?: string;
  provider?: string;
  maxIterations?: number;
  maxHistory?: number;
  costBudget?: number;
  learningEnabled?: boolean;
  quietMode?: boolean;
  sessionId?: string;
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
  private guard: DangerousToolGuard;
  private planner: Planner;
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
      costBudget: config.costBudget || 10,
      learningEnabled: config.learningEnabled !== false,
      quietMode: config.quietMode !== undefined ? config.quietMode : true,
      sessionId: config.sessionId || `session_${Date.now()}`,
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
    this.guard = new DangerousToolGuard(this.config.sessionId);
    this.planner = new Planner(this.memory);
    
    // Set quiet mode (auto-approve low risk, prompt for high)
    this.guard.setQuietMode(this.config.quietMode!);
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
    
    console.log(`🦆 ${this.name} initializing...`);
    
    await this.providers.load();
    await this.memory.initialize();
    await this.skills.load();
    this.registerTools();
    
    // Tool telemetry: log tool stats to memory periodically
    const stats = this.memory.stats();
    console.log(`   + Memory: ${stats.memories} entries`);
    
    console.log(`✅ ${this.name} ready!`);
    console.log(`   Providers: ${this.providers.list().length}`);
    console.log(`   Tools: ${this.tools.list().length}`);
    console.log(`   Skills: ${this.skills.list().length}`);
    console.log(`   Memory: SQLite-backed`);
    console.log(`   Planning: Autonomous`);
    console.log(`   Guard: ${this.config.quietMode ? 'Quiet mode (auto-approve low risk)' : 'Interactive (confirm all)'}`);
  }

  /**
   * Set dangerous tool approval callback (for interactive mode)
   */
  setApprovalCallback(callback: ApprovalCallback): void {
    this.guard.setApprovalCallback(callback);
    this.guard.setQuietMode(false);
  }

  /**
   * Get the dangerous tool guard for configuration
   */
  getGuard(): DangerousToolGuard {
    return this.guard;
  }

  /**
   * Get the planner
   */
  getPlanner(): Planner {
    return this.planner;
  }

  private registerTools(): void {
    // ─── Desktop tools ───────────────────────────────────────
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

    // ─── Memory tools ────────────────────────────────────────
    this.registerTool({
      name: 'memory_remember',
      description: 'Remember information permanently (SQLite-backed)',
      schema: { 
        content: { type: 'string' }, 
        type: { type: 'string', optional: true },
        tags: { type: 'string', optional: true }
      },
      dangerous: false,
      handler: async (args: any) => {
        const tags = args.tags ? args.tags.split(',').map((t: string) => t.trim()) : [];
        const id = await this.memory.add(args.content, args.type || 'fact', tags);
        return `Remembered [${id}]: ${args.content}`;
      }
    });

    this.registerTool({
      name: 'memory_recall',
      description: 'Search persistent memories (semantic search)',
      schema: { query: { type: 'string' }, limit: { type: 'number', optional: true } },
      dangerous: false,
      handler: async (args: any) => {
        const results = await this.memory.recall(args.query, args.limit || 10);
        if (results.length === 0) return 'No memories found';
        return results.map(r => `[${r.type}] ${r.content}`).join('\n---\n');
      }
    });

    this.registerTool({
      name: 'memory_list',
      description: 'List all memories, optionally filtered by type',
      schema: { type: { type: 'string', optional: true }, limit: { type: 'number', optional: true } },
      dangerous: false,
      handler: async (args: any) => {
        const entries = await this.memory.list(args.type as any, args.limit || 50);
        if (entries.length === 0) return 'No memories stored';
        return entries.map(e => `[${e.type}] ${e.content}`).join('\n---\n');
      }
    });

    this.registerTool({
      name: 'memory_stats',
      description: 'Show memory statistics',
      schema: {},
      dangerous: false,
      handler: async () => {
        const stats = this.memory.stats();
        const toolStats = await this.memory.getToolStats();
        const failing = await this.memory.getFailingTools();
        return {
          ...stats,
          toolStats,
          failingTools: failing,
          approvalStats: this.guard.stats()
        };
      }
    });

    // ─── Shell (GUARDED) ─────────────────────────────────────
    this.registerTool({
      name: 'shell',
      description: 'Execute shell command ⚠️ (dangerous, risk-evaluated)',
      schema: { command: { type: 'string' }, timeout: { type: 'number', optional: true } },
      dangerous: true,
      handler: async (args: any) => {
        const start = Date.now();
        
        // Dangerous tool guard check
        const approved = await this.guard.checkApproval('shell', { command: args.command });
        if (!approved) {
          return { error: 'Command denied by dangerous tool guard', risk: 'blocked' };
        }

        // Also check dangerous patterns directly
        const risk = this.guard.analyzeRisk(args.command, 'shell', {});
        if (risk.level === 'critical') {
          return { error: `CRITICAL risk command blocked: ${risk.reasons.join(', ')}`, risk: 'critical' };
        }
        
        const { exec } = await import('child_process');
        const timeout = args.timeout || 30000;
        
        return new Promise((resolve) => {
          exec(args.command, { timeout, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
            const duration = Date.now() - start;
            const success = !error;
            
            // Log to memory telemetry
            this.memory.logTool('shell', args.command, success, error?.message, duration).catch(() => {});
            
            if (error) {
              resolve({ error: error.message, stderr, duration, risk: risk.level });
            } else {
              resolve({ stdout, stderr, duration, risk: risk.level });
            }
          });
        });
      }
    });

    // ─── File tools ──────────────────────────────────────────
    this.registerTool({
      name: 'file_read',
      description: 'Read a file',
      schema: { path: { type: 'string' }, limit: { type: 'number', optional: true } },
      dangerous: false,
      handler: async (args: any) => {
        const { readFile } = await import('fs/promises');
        try {
          const content = await readFile(args.path, 'utf-8');
          const limit = args.limit || 0;
          if (limit > 0 && content.length > limit) {
            return content.slice(0, limit) + `\n... [truncated, ${content.length} total bytes]`;
          }
          return content;
        } catch (e: any) {
          return `Error: ${e.message}`;
        }
      }
    });

    this.registerTool({
      name: 'file_write',
      description: 'Write to a file ⚠️ (dangerous, risk-evaluated)',
      schema: { path: { type: 'string' }, content: { type: 'string' } },
      dangerous: true,
      handler: async (args: any) => {
        const start = Date.now();
        
        // Dangerous tool guard check
        const approved = await this.guard.checkApproval('file_write', args);
        if (!approved) {
          return { error: 'Write denied by dangerous tool guard', risk: 'blocked' };
        }

        const risk = this.guard.analyzeRisk(args.path, 'file_write', args);
        if (risk.level === 'critical') {
          return { error: `CRITICAL risk write blocked: ${risk.reasons.join(', ')}`, risk: 'critical' };
        }
        
        const { writeFile, mkdir } = await import('fs/promises');
        try {
          // Ensure directory exists
          const dir = args.path.substring(0, args.path.lastIndexOf('/'));
          if (dir) await mkdir(dir, { recursive: true }).catch(() => {});
          
          await writeFile(args.path, args.content);
          const duration = Date.now() - start;
          this.memory.logTool('file_write', args.path, true, undefined, duration).catch(() => {});
          return { written: args.path, bytes: args.content.length, duration, risk: risk.level };
        } catch (e: any) {
          const duration = Date.now() - start;
          this.memory.logTool('file_write', args.path, false, e.message, duration).catch(() => {});
          return { error: e.message, risk: risk.level };
        }
      }
    });

    // ─── Web search ───────────────────────────────────────────
    this.registerTool({
      name: 'web_search',
      description: 'Search the web',
      schema: { query: { type: 'string' } },
      dangerous: false,
      handler: async (args: any) => `Searching web for: ${args.query}`
    });

    // ─── Learning / feedback ─────────────────────────────────
    this.registerTool({
      name: 'learn_from_feedback',
      description: 'Learn from feedback to improve future responses',
      schema: { success: { type: 'boolean' }, feedback: { type: 'string', optional: true } },
      dangerous: false,
      handler: async (args: any) => {
        if (this.learningEnabled) {
          this.learn(args.success, args.feedback);
          await this.memory.learnFromFeedback(args.success, args.feedback);
        }
        return 'Learned from feedback';
      }
    });

    // ─── Metrics ─────────────────────────────────────────────
    this.registerTool({
      name: 'get_metrics',
      description: 'Get agent performance metrics',
      schema: {},
      dangerous: false,
      handler: async () => this.getMetrics()
    });

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

    // ─── Planning tools ───────────────────────────────────────
    this.registerTool({
      name: 'plan_create',
      description: 'Create an autonomous plan from a goal',
      schema: { goal: { type: 'string' }, context: { type: 'string', optional: true } },
      dangerous: false,
      handler: async (args: any) => {
        const context = args.context ? JSON.parse(args.context) : {};
        const plan = await this.planner.createPlan(args.goal, context, this.tools.list().map(t => t.name));
        return this.planner.formatProgress(plan);
      }
    });

    this.registerTool({
      name: 'plan_status',
      description: 'Get status of the current plan',
      schema: { planId: { type: 'string', optional: true } },
      dangerous: false,
      handler: async (args: any) => {
        const plan = args.planId 
          ? this.planner.getPlan(args.planId) 
          : this.planner.listActivePlans()[0];
        if (!plan) return 'No active plan';
        return this.planner.formatProgress(plan);
      }
    });

    this.registerTool({
      name: 'plan_list',
      description: 'List all active plans',
      schema: {},
      dangerous: false,
      handler: async () => {
        const active = this.planner.listActivePlans();
        const history = this.planner.listHistory(5);
        return `Active: ${active.length}\nHistory: ${history.length}\n\n` +
          active.map(p => `• ${p.id}: ${p.goal} (${p.status})`).join('\n');
      }
    });

    this.registerTool({
      name: 'plan_abort',
      description: 'Abort an active plan',
      schema: { planId: { type: 'string' }, reason: { type: 'string' } },
      dangerous: false,
      handler: async (args: any) => {
        const plan = this.planner.abortPlan(args.planId, args.reason);
        return plan ? `Aborted: ${plan.goal}` : 'Plan not found';
      }
    });

    // ─── Guard tools ──────────────────────────────────────────
    this.registerTool({
      name: 'guard_check',
      description: 'Check risk level of a command without executing',
      schema: { tool: { type: 'string' }, args: { type: 'string' } },
      dangerous: false,
      handler: async (args: any) => {
        const parsedArgs = JSON.parse(args.args || '{}');
        const risk = this.guard.analyzeRisk(args.args, args.tool, parsedArgs);
        return this.guard.formatRisk(risk);
      }
    });

    this.registerTool({
      name: 'guard_log',
      description: 'Show dangerous tool approval log',
      schema: { limit: { type: 'number', optional: true } },
      dangerous: false,
      handler: async (args: any) => {
        const log = this.guard.getLog(args.limit || 20);
        if (log.length === 0) return 'No approval decisions yet';
        return log.map(l => 
          `${l.decision === 'approved' ? '✅' : l.decision === 'denied' ? '❌' : l.decision === 'always' ? '🔓' : '🔒'} ` +
          `${l.toolName} [${l.risk.level}] - ${l.decision} @ ${new Date(l.timestamp).toLocaleTimeString()}`
        ).join('\n');
      }
    });

    this.registerTool({
      name: 'guard_stats',
      description: 'Show dangerous tool guard statistics',
      schema: {},
      dangerous: false,
      handler: async () => this.guard.stats()
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
          this.trackCost(providerName, this.estimateTokens(JSON.stringify(context)), this.estimateTokens(result.text));
          response = result.text;
          break;
        }
      } catch (e: any) {
        lastError = e.message;
      }
    }

    if (!response) {
      this.metrics.failedInteractions++;
      return `❌ All providers failed. Last error: ${lastError}`;
    }

    // Parse and execute tools
    const toolCalls = this.parseToolCalls(response);
    for (const call of toolCalls) {
      const start = Date.now();
      try {
        const result = await this.tools.execute(call.name, call.args);
        const duration = Date.now() - start;
        this.memory.logTool(call.name, JSON.stringify(call.args), true, undefined, duration).catch(() => {});
        response += `\n\n🔧 ${call.name}: ${JSON.stringify(result)}`;
      } catch (e: any) {
        const duration = Date.now() - start;
        this.memory.logTool(call.name, JSON.stringify(call.args), false, e.message, duration).catch(() => {});
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
    const words = input.toLowerCase().split(/\s+/);
    const significant = words.filter(w => w.length > 4);
    
    if (significant.length > 0 && output.length > 20) {
      const key = significant.slice(0, 3).join(' ');
      if (!this.learnedPatterns.has(key)) {
        this.learnedPatterns.set(key, output.slice(0, 200));
      }
    }
    
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
    
    // System prompt with SOUL
    const soul = this.memory.getSoul();
    const patterns = Array.from(this.learnedPatterns.entries())
      .map(([k, v]) => `When asked about "${k}": ${v}`)
      .join('\n');
    
    const systemPrompt = this.buildSystemPrompt();
    messages.push({ role: 'system', content: systemPrompt });

    if (soul) {
      messages.push({ role: 'system', content: soul });
    }

    if (patterns) {
      messages.push({ role: 'system', content: `Learned responses:\n${patterns}` });
    }

    // Recent history
    const recentHistory = this.history.slice(-20);
    messages.push(...recentHistory);

    return messages;
  }

  private buildSystemPrompt(): string {
    const tools = this.tools.list().map(t => `- ${t.name}: ${t.description}`).join('\n');
    return `You are ${this.name}, an advanced AI assistant with autonomous planning and dangerous tool guardrails.

Capabilities:
${tools}

Guidelines:
- Be helpful, practical, and concise
- Use tools when they make tasks easier
- Use plan_create for complex multi-step tasks
- Check guard_check before running suspicious commands
- Remember important information with memory_remember
- Learn from feedback with learn_from_feedback`;
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
    return Math.ceil(text.length / 4);
  }

  private trackCost(provider: string, promptTokens: number, completionTokens: number): void {
    const costs: Record<string, number> = {
      'minimax': 0.5,
      'openai': 2.0,
      'anthropic': 3.0,
      'lmstudio': 0
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
    const activePlans = this.planner.listActivePlans();
    const memoryStats = this.memory.stats();
    
    return {
      id: this.id,
      name: this.name,
      providers: this.providers.list().length,
      tools: this.tools.list().length,
      toolList: this.tools.list().map(t => ({ name: t.name, dangerous: t.dangerous })),
      skills: this.skills.list(),
      historyLength: this.history.length,
      learnedPatterns: this.learnedPatterns.size,
      cost: this.getCostInfo(),
      metrics: this.getMetrics(),
      memory: memoryStats,
      planning: {
        activePlans: activePlans.length,
        plans: activePlans.map(p => ({ id: p.id, goal: p.goal, status: p.status }))
      },
      guard: this.guard.stats()
    };
  }

  async shutdown(): Promise<void> {
    console.log(`\n🦆 ${this.name} shutting down...`);
    if (this.initialized) {
      this.memory.close();
    }
    console.log(`   Total cost: $${this.totalCost.toFixed(4)}`);
    console.log(`   Interactions: ${this.metrics.totalInteractions}`);
    console.log(`   Success rate: ${this.metrics.totalInteractions > 0 ? (this.metrics.successfulInteractions / this.metrics.totalInteractions * 100).toFixed(1) : 0}%`);
    try {
      console.log(`   Memories: ${this.memory.stats().memories}`);
    } catch {}
    console.log(`   Active plans: ${this.planner.listActivePlans().length}`);
    console.log(`✅ ${this.name} stopped`);
  }
}

export default Agent;
