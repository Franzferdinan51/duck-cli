/**
 * 🦆 Duck Agent - Super Agent Core
 * SQLite memory, streaming, planning, cron, subagents, learning loop
 */

import { EventEmitter } from 'events';
import { ProviderManager } from '../providers/manager.js';
import { MemorySystem } from '../memory/system.js';
import { ToolRegistry, ToolDefinition } from '../tools/registry.js';
import { SkillRunner } from '../skills/runner.js';
import { DesktopControl } from '../integrations/desktop.js';
import { DangerousToolGuard, ToolRisk, ApprovalCallback } from '../tools/approval.js';
import { Planner, Plan, PlanStep } from './planner.js';
import { SessionStore } from './session-store.js';
import { StreamManager, streamManager } from './stream-manager.js';
import { CronScheduler } from './cron-scheduler.js';
import { SubagentManager } from './subagent-manager.js';
import { LearningLoop } from './learning-loop.js';

export { Planner, Plan, PlanStep };
export { DangerousToolGuard, ToolRisk };
export { SessionStore };
export { StreamManager, streamManager };
export { CronScheduler };
export { SubagentManager };
export { LearningLoop };

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
  streamEnabled?: boolean;
  planningEnabled?: boolean;
  cronEnabled?: boolean;
  subagentEnabled?: boolean;
  memoryDir?: string;
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
  private sessions: SessionStore;
  private streams: StreamManager;
  private cron: CronScheduler;
  private subagents: SubagentManager;
  private learning: LearningLoop;
  private initialized: boolean = false;
  
  // Conversation
  private history: Message[] = [];
  private maxHistory: number;
  private sessionId: string;
  
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
    this.sessionId = config.sessionId || `session_${Date.now()}`;
    this.config = {
      maxIterations: config.maxIterations || 10,
      maxHistory: config.maxHistory || 50,
      costBudget: config.costBudget || 10,
      learningEnabled: config.learningEnabled !== false,
      quietMode: config.quietMode !== undefined ? config.quietMode : true,
      streamEnabled: config.streamEnabled !== false,
      planningEnabled: config.planningEnabled !== false,
      cronEnabled: config.cronEnabled !== false,
      subagentEnabled: config.subagentEnabled !== false,
      ...config
    };
    
    this.maxHistory = this.config.maxHistory!;
    this.learningEnabled = this.config.learningEnabled!;
    this.costBudget = this.config.costBudget!;
    
    // Initialize all systems
    const memDir = this.config.memoryDir || undefined;
    this.providers = new ProviderManager();
    this.memory = new MemorySystem(memDir);
    this.tools = new ToolRegistry();
    this.skills = new SkillRunner();
    this.desktop = new DesktopControl();
    this.guard = new DangerousToolGuard(this.sessionId);
    this.planner = new Planner(this.memory);
    this.sessions = new SessionStore(memDir);
    this.streams = streamManager;
    this.cron = new CronScheduler();
    this.subagents = new SubagentManager();
    this.learning = new LearningLoop(memDir);
    
    this.guard.setQuietMode(this.config.quietMode!);
    
    // Subscribe to learning nudges
    this.learning.on('nudge', (nudge: any) => {
      this.emit('nudge', nudge);
    });
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
    
    console.log(`🦆 ${this.name} initializing...`);
    
    await this.providers.load();
    await this.memory.initialize();
    await this.skills.load();
    this.registerTools();
    
    const stats = this.memory.stats();
    console.log(`   + Memory: ${stats.memories} entries`);
    console.log(`   + Sessions: ${this.sessions.stats().totalSessions} stored`);
    console.log(`   + Learned skills: ${this.learning.stats().learnedSkills}`);
    console.log(`   + Cron jobs: ${this.cron.stats().totalJobs}`);
    
    console.log(`✅ ${this.name} ready!`);
    console.log(`   Providers: ${this.providers.list().length}`);
    console.log(`   Tools: ${this.tools.list().length}`);
    console.log(`   Skills: ${this.skills.list().length}`);
    console.log(`   Memory: SQLite-backed`);
    console.log(`   Streaming: ${this.config.streamEnabled ? 'enabled' : 'disabled'}`);
    console.log(`   Planning: ${this.config.planningEnabled ? 'enabled' : 'disabled'}`);
    console.log(`   Cron: ${this.config.cronEnabled ? 'enabled' : 'disabled'}`);
    console.log(`   Subagents: ${this.config.subagentEnabled ? 'enabled' : 'disabled'}`);
    console.log(`   Learning: ${this.learningEnabled ? 'enabled' : 'disabled'}`);
    console.log(`   Guard: ${this.config.quietMode ? 'quiet' : 'interactive'}`);
  }

  setApprovalCallback(callback: ApprovalCallback): void {
    this.guard.setApprovalCallback(callback);
    this.guard.setQuietMode(false);
  }

  // ─── Tools ────────────────────────────────────────────────

  private registerTools(): void {
    // ─── Desktop ──────────────────────────────────────────
    this.registerTool({ name: 'desktop_open', description: 'Open an application', schema: { app: { type: 'string' } }, dangerous: false,
      handler: async (args: any) => { await this.desktop.openApp(args.app); return `Opened ${args.app}`; }
    });
    this.registerTool({ name: 'desktop_click', description: 'Click at coordinates', schema: { x: { type: 'number' }, y: { type: 'number' } }, dangerous: false,
      handler: async (args: any) => { await this.desktop.click(args.x, args.y); return `Clicked at ${args.x}, ${args.y}`; }
    });
    this.registerTool({ name: 'desktop_type', description: 'Type text', schema: { text: { type: 'string' } }, dangerous: false,
      handler: async (args: any) => { await this.desktop.type(args.text); return `Typed: ${args.text}`; }
    });
    this.registerTool({ name: 'desktop_screenshot', description: '📸 Take screenshot and return as base64 image for vision analysis',
      schema: { mode: { type: 'string', optional: true, description: 'Return mode: path (file path) or base64 (image data for vision)' } }, dangerous: false,
      handler: async (args: any) => {
        try {
          const result = await this.desktop.screenshot();
          
          if (args.mode === 'path') {
            return result; // Return file path
          }
          
          // Default: return base64 image data for vision
          const fs = await import('fs');
          const path = await import('path');
          
          // If result is a file path, read and encode it
          if (typeof result === 'string' && (result.startsWith('/') || result.startsWith('~') || result.includes('screenshot'))) {
            const filePath = result.startsWith('~') ? result.replace('~', process.env.HOME || '') : result;
            if (fs.existsSync(filePath)) {
              const imageBuffer = fs.readFileSync(filePath);
              const base64 = imageBuffer.toString('base64');
              const ext = path.extname(filePath).toLowerCase().slice(1) || 'png';
              const mimeType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'png' ? 'image/png' : 'image/png';
              return `data:${mimeType};base64,${base64}`;
            }
          }
          
          // If result is already base64 or data URL, return as-is
          if (typeof result === 'string' && (result.startsWith('data:') || result.length > 1000)) {
            return result;
          }
          
          // Otherwise return path and let user know
          return result;
        } catch (e: any) {
          return { success: false, error: e.message };
        }
      }
    });

    // ─── Memory ────────────────────────────────────────────
    this.registerTool({ name: 'memory_remember', description: 'Remember information permanently', 
      schema: { content: { type: 'string' }, type: { type: 'string', optional: true }, tags: { type: 'string', optional: true } }, dangerous: false,
      handler: async (args: any) => {
        const tags = args.tags ? args.tags.split(',').map((t: string) => t.trim()) : [];
        const id = await this.memory.add(args.content, args.type || 'fact', tags);
        this.streams.memorySave(this.sessionId, id, args.content);
        return `Remembered [${id}]: ${args.content}`;
      }
    });
    this.registerTool({ name: 'memory_recall', description: 'Search persistent memories', 
      schema: { query: { type: 'string' }, limit: { type: 'number', optional: true } }, dangerous: false,
      handler: async (args: any) => {
        const results = await this.memory.recall(args.query, args.limit || 10);
        if (results.length === 0) return 'No memories found';
        return results.map(r => `[${r.type}] ${r.content}`).join('\n---\n');
      }
    });
    this.registerTool({ name: 'memory_list', description: 'List memories', 
      schema: { type: { type: 'string', optional: true }, limit: { type: 'number', optional: true } }, dangerous: false,
      handler: async (args: any) => {
        const entries = await this.memory.list(args.type as any, args.limit || 50);
        if (entries.length === 0) return 'No memories stored';
        return entries.map(e => `[${e.type}] ${e.content}`).join('\n---\n');
      }
    });
    this.registerTool({ name: 'memory_stats', description: 'Show memory statistics', schema: {}, dangerous: false,
      handler: async () => {
        const stats = this.memory.stats();
        const toolStats = await this.memory.getToolStats();
        const failing = await this.memory.getFailingTools();
        return { ...stats, toolStats, failingTools: failing, approvalStats: this.guard.stats() };
      }
    });

    // ─── Shell (GUARDED) ─────────────────────────────────
    this.registerTool({ name: 'shell', description: 'Execute shell command ⚠️', 
      schema: { command: { type: 'string' }, timeout: { type: 'number', optional: true } }, dangerous: true,
      handler: async (args: any) => {
        const start = Date.now();
        this.streams.toolStart(this.sessionId, 'shell', { command: args.command });
        
        const approved = await this.guard.checkApproval('shell', { command: args.command });
        if (!approved) {
          this.streams.toolEnd(this.sessionId, 'shell', false, undefined, 'Command denied by guard', Date.now() - start);
          this.streams.guardBlock(this.sessionId, 'shell', { command: args.command }, 'blocked', ['Denied by user/system']);
          return { error: 'Command denied by dangerous tool guard', risk: 'blocked' };
        }

        const risk = this.guard.analyzeRisk(args.command, 'shell', {});
        if (risk.level === 'critical') {
          this.streams.guardBlock(this.sessionId, 'shell', { command: args.command }, 'critical', risk.reasons);
          this.streams.toolEnd(this.sessionId, 'shell', false, undefined, `CRITICAL risk: ${risk.reasons.join(', ')}`, Date.now() - start);
          return { error: `CRITICAL risk command blocked: ${risk.reasons.join(', ')}`, risk: 'critical' };
        }

        const { exec } = await import('child_process');
        const timeout = args.timeout || 30000;
        
        return new Promise((resolve) => {
          exec(args.command, { timeout, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
            const duration = Date.now() - start;
            const success = !error;
            this.memory.logTool('shell', args.command, success, error?.message, duration).catch(() => {});
            
            if (risk.level === 'high') {
              this.streams.guardWarn(this.sessionId, 'shell', { command: args.command }, risk.level, risk.reasons);
            }
            
            if (error) {
              this.streams.toolEnd(this.sessionId, 'shell', false, undefined, error.message, duration);
              resolve({ error: error.message, stderr, duration, risk: risk.level });
            } else {
              this.streams.toolEnd(this.sessionId, 'shell', true, stdout.slice(0, 5000), undefined, duration);
              resolve({ stdout, stderr, duration, risk: risk.level });
            }
          });
        });
      }
    });

    // ─── File ──────────────────────────────────────────────
    this.registerTool({ name: 'file_read', description: 'Read a file', 
      schema: { path: { type: 'string' }, limit: { type: 'number', optional: true } }, dangerous: false,
      handler: async (args: any) => {
        const { readFile } = await import('fs/promises');
        try {
          const content = await readFile(args.path, 'utf-8');
          const limit = args.limit || 0;
          if (limit > 0 && content.length > limit) {
            return content.slice(0, limit) + `\n... [truncated, ${content.length} total]`;
          }
          return content;
        } catch (e: any) { return `Error: ${e.message}`; }
      }
    });
    this.registerTool({ name: 'file_write', description: 'Write to a file ⚠️', 
      schema: { path: { type: 'string' }, content: { type: 'string' } }, dangerous: true,
      handler: async (args: any) => {
        const start = Date.now();
        this.streams.toolStart(this.sessionId, 'file_write', args);
        
        const approved = await this.guard.checkApproval('file_write', args);
        if (!approved) {
          this.streams.toolEnd(this.sessionId, 'file_write', false, undefined, 'Write denied', Date.now() - start);
          return { error: 'Write denied by guard', risk: 'blocked' };
        }

        const { writeFile, mkdir } = await import('fs/promises');
        try {
          const dir = args.path.substring(0, args.path.lastIndexOf('/'));
          if (dir) await mkdir(dir, { recursive: true }).catch(() => {});
          await writeFile(args.path, args.content);
          const duration = Date.now() - start;
          this.memory.logTool('file_write', args.path, true, undefined, duration).catch(() => {});
          this.streams.toolEnd(this.sessionId, 'file_write', true, `${args.path} (${args.content.length}B)`, undefined, duration);
          return { written: args.path, bytes: args.content.length, duration };
        } catch (e: any) {
          const duration = Date.now() - start;
          this.memory.logTool('file_write', args.path, false, e.message, duration).catch(() => {});
          this.streams.toolEnd(this.sessionId, 'file_write', false, undefined, e.message, duration);
          return { error: e.message };
        }
      }
    });

    // ─── Web ──────────────────────────────────────────────
    this.registerTool({ name: 'web_search', description: 'Search the web', 
      schema: { query: { type: 'string' } }, dangerous: false,
      handler: async (args: any) => `Searching web for: ${args.query}`
    });

    // ─── Learning ──────────────────────────────────────────
    this.registerTool({ name: 'learn_from_feedback', description: 'Learn from feedback', 
      schema: { success: { type: 'boolean' }, feedback: { type: 'string', optional: true } }, dangerous: false,
      handler: async (args: any) => {
        if (this.learningEnabled) {
          this.learn(args.success, args.feedback);
          await this.memory.learnFromFeedback(args.success, args.feedback);
        }
        return 'Learned from feedback';
      }
    });

    // ─── Metrics ─────────────────────────────────────────
    this.registerTool({ name: 'get_metrics', description: 'Get agent metrics', schema: {}, dangerous: false,
      handler: async () => this.getMetrics()
    });
    this.registerTool({ name: 'get_cost', description: 'Get cost info', schema: {}, dangerous: false,
      handler: async () => ({ totalCost: this.totalCost, budget: this.costBudget, remaining: this.costBudget - this.totalCost })
    });

    // ─── Planning ─────────────────────────────────────────
    if (this.config.planningEnabled) {
      this.registerTool({ name: 'plan_create', description: 'Create autonomous plan', 
        schema: { goal: { type: 'string' }, context: { type: 'string', optional: true } }, dangerous: false,
        handler: async (args: any) => {
          const context = args.context ? JSON.parse(args.context) : {};
          const plan = await this.planner.createPlan(args.goal, context, this.tools.list().map(t => t.name));
          this.streams.sessionStart(this.sessionId, args.goal);
          return this.planner.formatProgress(plan);
        }
      });
      this.registerTool({ name: 'plan_status', description: 'Show plan progress', 
        schema: { planId: { type: 'string', optional: true } }, dangerous: false,
        handler: async (args: any) => {
          const plan = args.planId ? this.planner.getPlan(args.planId) : this.planner.listActivePlans()[0];
          if (!plan) return 'No active plan';
          return this.planner.formatProgress(plan);
        }
      });
      this.registerTool({ name: 'plan_list', description: 'List active plans', schema: {}, dangerous: false,
        handler: async () => {
          const active = this.planner.listActivePlans();
          const history = this.planner.listHistory(5);
          return `Active: ${active.length}\nHistory: ${history.length}\n\n` +
            active.map(p => `• ${p.id}: ${p.goal} (${p.status})`).join('\n');
        }
      });
      this.registerTool({ name: 'plan_abort', description: 'Abort a plan', 
        schema: { planId: { type: 'string' }, reason: { type: 'string' } }, dangerous: false,
        handler: async (args: any) => {
          const plan = this.planner.abortPlan(args.planId, args.reason);
          return plan ? `Aborted: ${plan.goal}` : 'Plan not found';
        }
      });
    }

    // ─── Session Search ───────────────────────────────────
    this.registerTool({ name: 'session_search', description: 'Search past conversations', 
      schema: { query: { type: 'string' }, limit: { type: 'number', optional: true } }, dangerous: false,
      handler: async (args: any) => {
        const results = this.sessions.search(args.query, args.limit || 10);
        if (results.length === 0) return 'No past conversations found';
        return results.map(r => `[${r.role}] ${r.content}`).join('\n---\n');
      }
    });
    this.registerTool({ name: 'session_list', description: 'List recent conversations', 
      schema: { limit: { type: 'number', optional: true } }, dangerous: false,
      handler: async (args: any) => {
        const sessions = this.sessions.getRecentSessions(args.limit || 10);
        if (sessions.length === 0) return 'No past conversations';
        return sessions.map(s => 
          `[${new Date(s.timestamp).toLocaleString()}] ${s.topic}: "${s.lastMessage.slice(0, 80)}..." (${s.messageCount} msgs)`
        ).join('\n');
      }
    });

    // ─── Cron ─────────────────────────────────────────────
    if (this.config.cronEnabled) {
      this.registerTool({ name: 'cron_create', description: 'Create scheduled task from natural language', 
        schema: { name: { type: 'string' }, schedule: { type: 'string' }, task: { type: 'string' }, taskType: { type: 'string', optional: true } }, dangerous: false,
        handler: async (args: any) => {
          const job = this.cron.createJob(args.name, args.schedule, args.task, (args.taskType || 'shell') as any);
          return `Scheduled: "${args.name}" — ${job.schedule}\nNext run: ${job.nextRun ? new Date(job.nextRun!).toLocaleString() : 'N/A'}`;
        }
      });
      this.registerTool({ name: 'cron_list', description: 'List scheduled tasks', schema: {}, dangerous: false,
        handler: async () => {
          const jobs = this.cron.listJobs();
          if (jobs.length === 0) return 'No scheduled tasks';
          return jobs.map(j => 
            `[${j.enabled ? 'ON' : 'OFF'}] ${j.name} — ${j.schedule}\n   Task: ${j.task}\n   Last: ${j.lastRun ? new Date(j.lastRun).toLocaleString() : 'never'} | Next: ${j.nextRun ? new Date(j.nextRun).toLocaleString() : 'N/A'}`
          ).join('\n\n');
        }
      });
      this.registerTool({ name: 'cron_enable', description: 'Enable/disable a task', 
        schema: { jobId: { type: 'string' }, enabled: { type: 'boolean' } }, dangerous: false,
        handler: async (args: any) => {
          this.cron.setEnabled(args.jobId, args.enabled);
          return `${args.enabled ? 'Enabled' : 'Disabled'} job ${args.jobId}`;
        }
      });
      this.registerTool({ name: 'cron_delete', description: 'Delete a task', 
        schema: { jobId: { type: 'string' } }, dangerous: false,
        handler: async (args: any) => {
          this.cron.deleteJob(args.jobId);
          return `Deleted job ${args.jobId}`;
        }
      });
      this.registerTool({ name: 'cron_stats', description: 'Show cron statistics', schema: {}, dangerous: false,
        handler: async () => this.cron.stats()
      });
    }

    // ─── Subagents ────────────────────────────────────────
    if (this.config.subagentEnabled) {
      this.registerTool({ name: 'agent_spawn', description: 'Spawn a subagent', 
        schema: { task: { type: 'string' }, role: { type: 'string', optional: true }, name: { type: 'string', optional: true } }, dangerous: false,
        handler: async (args: any) => {
          const agent = this.subagents.spawn(args.task, { role: (args.role || 'general') as any, name: args.name });
          return `Spawned ${agent.role} subagent ${agent.id}: ${agent.name}\nTask: ${agent.task}`;
        }
      });
      this.registerTool({ name: 'agent_spawn_team', description: 'Spawn multiple subagents in parallel', 
        schema: { tasks: { type: 'string' /* JSON array */ } }, dangerous: false,

        handler: async (args: any) => {
          const tasks = JSON.parse(args.tasks);
          const agents = this.subagents.spawnTeam(tasks);
          return {
            agentIds: agents.map(a => a.id),
            count: agents.length,
            summary: 'Spawned ' + agents.length + ' subagents:\n' + agents.map(a => '• ' + a.id + ' [' + a.role + ']: ' + a.name).join('\n')
          };
        }
      });

      // think_parallel: spawn N agents to think about the same prompt from different angles
      this.registerTool({
        name: 'think_parallel',
        description: 'Think about something using MULTIPLE parallel agents, each with a different perspective. Use for complex decisions, research, architecture, debugging. Agents spawn in parallel, you wait for all results.',
        schema: {
          prompt: { type: 'string', description: 'The question or task' },
          perspectives: { type: 'number', optional: true, description: 'Number of perspectives (default 3, max 5)' }
        },
        dangerous: false,
        handler: async (args: any) => {
          const n = Math.min(args.perspectives || 3, 5);
          const prompt = args.prompt;
          const roles = ['researcher', 'critic', 'creator', 'analyst', 'strategist'].slice(0, n);
          const tasks = roles.map((role, i) => ({
            task: prompt + '\n\n[Angle ' + (i+1) + '/' + n + ' as ' + role + '. Be specific.]',
            role: role as any,
            name: 'angle_' + role
          }));
          this.streams.thinking(this.sessionId, 'Spawning ' + n + ' parallel thinking agents...');
          const agents = this.subagents.spawnTeam(tasks);
          const agentIds = agents.map(a => a.id);
          const results = await Promise.all(agentIds.map(id => this.subagents.waitFor(id, 300000)));
          return {
            prompt: prompt,
            perspectives: roles.map((role, i) => ({ role: role, result: results[i] })),
            synthesis: 'Synthesized ' + n + ' perspectives on: ' + prompt
          };
        }
      });


      this.registerTool({ name: 'agent_list', description: 'List active subagents', schema: {}, dangerous: false,
        handler: async () => {
          const active = this.subagents.listActive();
          const stats = this.subagents.stats();
          if (active.length === 0) return `No active subagents\nStats: ${stats.total} total, ${stats.completed} completed, ${stats.failed} failed`;
          return active.map(a => 
            `[${a.status.toUpperCase()}] ${a.id} [${a.role}]: ${a.progress}% — ${a.task.slice(0, 60)}...`
          ).join('\n');
        }
      });
      this.registerTool({ name: 'agent_status', description: 'Get subagent status', 
        schema: { agentId: { type: 'string' } }, dangerous: false,
        handler: async (args: any) => {
          const agent = this.subagents.get(args.agentId);
          if (!agent) return `Subagent not found: ${args.agentId}`;
          return `[${agent.status.toUpperCase()}] ${agent.name} [${agent.role}]\nTask: ${agent.task}\nProgress: ${agent.progress}%\n` +
            (agent.result ? `\nResult:\n${agent.result.slice(0, 500)}` : '') +
            (agent.error ? `\nError: ${agent.error}` : '');
        }
      });
      this.registerTool({ name: 'agent_cancel', description: 'Cancel a subagent', 
        schema: { agentId: { type: 'string' } }, dangerous: false,
        handler: async (args: any) => {
          const ok = this.subagents.cancel(args.agentId);
          return ok ? `Cancelled ${args.agentId}` : `Failed to cancel ${args.agentId} (not running?)`;
        }
      });
      this.registerTool({ name: 'agent_wait', description: 'Wait for subagent to complete', 
        schema: { agentId: { type: 'string' }, timeout: { type: 'number', optional: true } }, dangerous: false,
        handler: async (args: any) => {
          try {
            const agent = await this.subagents.waitFor(args.agentId, args.timeout || 300000);
            return `[${agent.status.toUpperCase()}] ${agent.id}\n` +
              (agent.result ? `Result:\n${agent.result.slice(0, 500)}` : '') +
              (agent.error ? `Error: ${agent.error}` : '');
          } catch (e: any) {
            return `Wait failed: ${e.message}`;
          }
        }
      });
    }

    // ─── Guard ────────────────────────────────────────────
    this.registerTool({ name: 'guard_check', description: 'Check risk level', 
      schema: { tool: { type: 'string' }, args: { type: 'string' } }, dangerous: false,
      handler: async (args: any) => {
        const parsedArgs = JSON.parse(args.args || '{}');
        const risk = this.guard.analyzeRisk(args.args, args.tool, parsedArgs);
        return this.guard.formatRisk(risk);
      }
    });
    this.registerTool({ name: 'guard_log', description: 'Show approval log', 
      schema: { limit: { type: 'number', optional: true } }, dangerous: false,
      handler: async (args: any) => {
        const log = this.guard.getLog(args.limit || 20);
        if (log.length === 0) return 'No approval decisions yet';
        return log.map(l => 
          `${l.decision === 'approved' ? '✅' : l.decision === 'denied' ? '❌' : l.decision === 'always' ? '🔓' : '🔒'} ` +
          `${l.toolName} [${l.risk.level}] - ${l.decision} @ ${new Date(l.timestamp).toLocaleTimeString()}`
        ).join('\n');
      }
    });
    this.registerTool({ name: 'guard_stats', description: 'Show guard statistics', schema: {}, dangerous: false,
      handler: async () => this.guard.stats()
    });

    // ─── Learning ──────────────────────────────────────────
    this.registerTool({ name: 'learning_stats', description: 'Show learning statistics', schema: {}, dangerous: false,
      handler: async () => {
        const ls = this.learning.stats();
        const cs = this.cron.stats();
        const ss = this.sessions.stats();
        return { learning: ls, cron: cs, sessions: ss };
      }
    });
    this.registerTool({ name: 'learning_context', description: 'Get context for current session', schema: {}, dangerous: false,
      handler: async () => {
        const prompt = this.learning.buildContextPrompt(this.sessionId);
        return prompt || 'No learning context yet';
      }
    });
    this.registerTool({ name: 'user_model', description: 'Get/update user model', 
      schema: { updates: { type: 'string', optional: true } }, dangerous: false,
      handler: async (args: any) => {
        if (args.updates) {
          const updates = JSON.parse(args.updates);
          this.learning.updateUserModel(updates);
          return `Updated user model: ${JSON.stringify(updates)}`;
        }
        return JSON.stringify(this.learning.getUserModel(), null, 2);
      }
    });

    // ─── Skill Runner Tools ─────────────────────────────────
    this.registerTool({ name: 'skill_git_workflow', description: 'Run git workflow skill',
      schema: { action: { type: 'string', optional: true }, repo: { type: 'string', optional: true } }, dangerous: false,
      handler: async (args: any) => {
        const input = JSON.stringify({ action: args.action, repo: args.repo });
        return await this.skills.execute('git-workflow', input);
      }
    });
    this.registerTool({ name: 'skill_code_review', description: 'Run code review skill',
      schema: { code: { type: 'string' }, language: { type: 'string', optional: true } }, dangerous: false,
      handler: async (args: any) => {
        const input = JSON.stringify({ code: args.code, language: args.language });
        return await this.skills.execute('code-review', input);
      }
    });
    this.registerTool({ name: 'skill_security_audit', description: 'Run security audit skill',
      schema: { target: { type: 'string', optional: true }, level: { type: 'string', optional: true } }, dangerous: false,
      handler: async (args: any) => {
        const input = JSON.stringify({ target: args.target, level: args.level });
        return await this.skills.execute('security-audit', input);
      }
    });
    this.registerTool({ name: 'skill_claude_code_mastery', description: 'Claude Code mastery skill',
      schema: { topic: { type: 'string', optional: true }, level: { type: 'string', optional: true } }, dangerous: false,
      handler: async (args: any) => {
        const input = JSON.stringify({ topic: args.topic, level: args.level });
        return await this.skills.execute('claude-code-mastery', input);
      }
    });
    this.registerTool({ name: 'skill_clawd_cursor', description: 'Clawd Cursor desktop control',
      schema: { task: { type: 'string' } }, dangerous: false,
      handler: async (args: any) => {
        const input = JSON.stringify({ task: args.task });
        return await this.skills.execute('clawd-cursor', input);
      }
    });
    this.registerTool({ name: 'skill_computer_use', description: 'Computer use skill',
      schema: { task: { type: 'string' }, mode: { type: 'string', optional: true } }, dangerous: false,
      handler: async (args: any) => {
        const input = JSON.stringify({ task: args.task, mode: args.mode });
        return await this.skills.execute('computer-use', input);
      }
    });
    this.registerTool({ name: 'skill_context_memory', description: 'Context memory skill',
      schema: { action: { type: 'string' }, query: { type: 'string', optional: true } }, dangerous: false,
      handler: async (args: any) => {
        const input = JSON.stringify({ action: args.action, query: args.query });
        return await this.skills.execute('context-memory', input);
      }
    });
    this.registerTool({ name: 'skill_desktop_control', description: 'Desktop control skill',
      schema: { action: { type: 'string' }, target: { type: 'string', optional: true } }, dangerous: false,
      handler: async (args: any) => {
        const input = JSON.stringify({ action: args.action, target: args.target });
        return await this.skills.execute('desktop-control', input);
      }
    });
    this.registerTool({ name: 'skill_mcp_manager', description: 'MCP manager skill',
      schema: { action: { type: 'string', optional: true }, server: { type: 'string', optional: true } }, dangerous: false,
      handler: async (args: any) => {
        const input = JSON.stringify({ action: args.action, server: args.server });
        return await this.skills.execute('mcp-manager', input);
      }
    });

    // ─── Duck CLI Command Tools ─────────────────────────────────
    this.registerTool({ name: 'duck_run', description: '💻 Run a task with Duck CLI (auto-routes through smart provider chain)',
      schema: { prompt: { type: 'string' }, interactive: { type: 'boolean', optional: true } }, dangerous: false,
      handler: async (args: any) => {
        const { exec } = await import('child_process');
        const interactive = args.interactive ? '-i' : '';
        return new Promise((resolve) => {
          exec(`~/.local/bin/duck run ${interactive} "${args.prompt}"`, { timeout: 120000 }, (e, stdout, stderr) => {
            resolve(e ? `Error: ${e.message}` : stdout);
          });
        });
      }
    });
    this.registerTool({ name: 'duck_council', description: '🏛️ Ask the AI Council (45 deliberative agents)',
      schema: { question: { type: 'string' }, mode: { type: 'string', optional: true } }, dangerous: false,
      handler: async (args: any) => {
        const { exec } = await import('child_process');
        const mode = args.mode ? `--mode ${args.mode}` : '';
        return new Promise((resolve) => {
          exec(`~/.local/bin/duck council "${args.question}" ${mode}`, { timeout: 180000 }, (e, stdout, stderr) => {
            resolve(e ? `Error: ${e.message}` : stdout);
          });
        });
      }
    });
    this.registerTool({ name: 'duck_kairos', description: '⏰ KAIROS proactive AI control',
      schema: { mode: { type: 'string', optional: true } }, dangerous: false,
      handler: async (args: any) => {
        const { exec } = await import('child_process');
        return new Promise((resolve) => {
          exec(`~/.local/bin/duck kairos ${args.mode || 'status'}`, (e, stdout, stderr) => {
            resolve(e ? `Error: ${e.message}` : stdout);
          });
        });
      }
    });
    this.registerTool({ name: 'duck_status', description: '📊 Show Duck CLI status', schema: {}, dangerous: false,
      handler: async () => {
        const { exec } = await import('child_process');
        return new Promise((resolve) => {
          exec('~/.local/bin/duck status', (e, stdout, stderr) => resolve(e ? `Error: ${e.message}` : stdout));
        });
      }
    });
    this.registerTool({ name: 'duck_skills', description: '🛒 Skills marketplace',
      schema: { action: { type: 'string' }, name: { type: 'string', optional: true } }, dangerous: false,
      handler: async (args: any) => {
        const { exec } = await import('child_process');
        return new Promise((resolve) => {
          exec(`~/.local/bin/duck skills ${args.action} ${args.name || ''}`, (e, stdout, stderr) => {
            resolve(e ? `Error: ${e.message}` : stdout);
          });
        });
      }
    });
    this.registerTool({ name: 'duck_security', description: '🛡️ Security operations (audit, defcon <level>, status)',
      schema: { action: { type: 'string', description: 'Action: audit|defcon|status' }, level: { type: 'string', optional: true, description: 'For defcon: 1-5' } }, dangerous: false,
      handler: async (args: any) => {
        const { exec } = await import('child_process');
        return new Promise((resolve) => {
          const cmd = args.action === 'defcon' && args.level ? `defcon ${args.level}` : args.action;
          exec(`~/.local/bin/duck security ${cmd}`, (e, stdout, stderr) => {
            resolve(e ? `Error: ${e.message}` : stdout);
          });
        });
      }
    });
    this.registerTool({ name: 'duck_cron', description: '⏱️ Cron automation (list|enable|disable|run)',
      schema: { action: { type: 'string' }, jobId: { type: 'string', optional: true }, task: { type: 'string', optional: true } }, dangerous: false,
      handler: async (args: any) => {
        const { exec } = await import('child_process');
        return new Promise((resolve) => {
          exec(`~/.local/bin/duck cron ${args.action} ${args.jobId || ''} ${args.task || ''}`, (e, stdout, stderr) => {
            resolve(e ? `Error: ${e.message}` : stdout);
          });
        });
      }
    });
    this.registerTool({ name: 'duck_team', description: '👥 Multi-agent teams (create|spawn|status <team-id>|list)',
      schema: { action: { type: 'string' }, teamId: { type: 'string', optional: true, description: 'Team ID (required for status command)' } }, dangerous: false,
      handler: async (args: any) => {
        const { exec } = await import('child_process');
        return new Promise((resolve) => {
          const teamId = args.teamId || args.action === 'list' || args.action === 'create' ? '' : 'YOUR_TEAM_ID';
          exec(`~/.local/bin/duck team ${args.action} ${teamId}`, (e, stdout, stderr) => {
            resolve(e ? `Error: ${e.message}` : stdout);
          });
        });
      }
    });
    this.registerTool({ name: 'duck_mesh', description: '🌐 Agent Mesh networking (register|list|send|broadcast)',
      schema: { action: { type: 'string' }, target: { type: 'string', optional: true }, message: { type: 'string', optional: true } }, dangerous: false,
      handler: async (args: any) => {
        const { exec } = await import('child_process');
        return new Promise((resolve) => {
          exec(`~/.local/bin/duck mesh ${args.action} ${args.target || ''} ${args.message || ''}`, (e, stdout, stderr) => {
            resolve(e ? `Error: ${e.message}` : stdout);
          });
        });
      }
    });
    this.registerTool({ name: 'duck_update', description: '🔄 Update Duck CLI (check|install|backup|restore)',
      schema: { action: { type: 'string', optional: true } }, dangerous: false,
      handler: async (args: any) => {
        const { exec } = await import('child_process');
        return new Promise((resolve) => {
          exec(`~/.local/bin/duck update ${args.action || ''}`, (e, stdout, stderr) => {
            resolve(e ? `Error: ${e.message}` : stdout);
          });
        });
      }
    });
    this.registerTool({ name: 'duck_doctor', description: '🩺 Run system diagnostics', 
      schema: {}, dangerous: false,
      handler: async () => {
        const { exec } = await import('child_process');
        return new Promise((resolve) => {
          exec('cd /tmp/duck-cli-main-sync && ~/.local/bin/duck doctor', (e, stdout, stderr) => resolve(e ? `Error: ${e.message}` : stdout));
        });
      }
    });
    this.registerTool({ name: 'duck_agent', description: '🤖 Manage agents and sub-agents',
      schema: { action: { type: 'string' }, agentId: { type: 'string', optional: true }, params: { type: 'string', optional: true } }, dangerous: false,
      handler: async (args: any) => {
        const { exec } = await import('child_process');
        return new Promise((resolve) => {
          exec(`~/.local/bin/duck agent ${args.action} ${args.agentId || ''} ${args.params || ''}`, (e, stdout, stderr) => {
            resolve(e ? `Error: ${e.message}` : stdout);
          });
        });
      }
    });

    // ─── Stress Test Tool (Registry Check + Lightweight Execution) ─────────────
    this.registerTool({ name: 'duck_stress_test', description: '🧪 Test MCP server stability - checks tool registry',
      schema: { mode: { type: 'string', optional: true, description: 'Mode: registry (fast) or exec (full test, slower)' } }, dangerous: false,
      handler: async (args: any) => {
        const mode = args.mode || 'registry';
        const results: any = { timestamp: new Date().toISOString(), mode, tools: [], summary: { pass: 0, fail: 0, total: 0 } };
        
        // Get all registered tools from the tool registry
        const registeredTools = this.tools.list();
        const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
        
        // Group tools by prefix
        const groups: any = {};
        for (const tool of registeredTools) {
          const prefix = tool.name.split('_')[0];
          const groupName = prefix === 'duck' ? 'Duck CLI' : 
                           ['memory', 'session', 'agent', 'plan', 'cron', 'guard', 'skill', 'desktop', 'file', 'web', 'shell', 'learn'].includes(prefix) ? 
                           prefix.charAt(0).toUpperCase() + prefix.slice(1) : 'Other';
          if (!groups[groupName]) groups[groupName] = { name: groupName, tools: [], pass: 0, fail: 0 };
          
          if (mode === 'registry') {
            // Fast check: verify tool exists (name is present)
            await sleep(10); // Small delay between checks
            const valid = tool.name && tool.name.length > 0;
            groups[groupName].tools.push({ name: tool.name, status: valid ? 'REGISTERED' : 'BROKEN' });
            if (valid) { groups[groupName].pass++; results.summary.pass++; }
            else { groups[groupName].fail++; results.summary.fail++; }
            results.summary.total++;
          }
        }
        
        if (mode === 'exec') {
          // Execute only lightweight status tools - SEQUENTIALLY with delays
          const safeTools = ['duck_status', 'duck_doctor', 'memory_stats', 'agent_list', 'cron_list', 'guard_stats', 'plan_list'];
          
          for (const toolName of safeTools) {
            const tool = registeredTools.find((t: any) => t.name === toolName);
            if (!tool) continue;
            
            const prefix = toolName.split('_')[0];
            const groupName = prefix === 'duck' ? 'Duck CLI' : prefix.charAt(0).toUpperCase() + prefix.slice(1);
            if (!groups[groupName]) groups[groupName] = { name: groupName, tools: [], pass: 0, fail: 0 };
            
            try {
              // Execute and wait for completion before next tool
              const r: any = await this.executeTool(toolName, {});
              const success = r && r.success === true;
              groups[groupName].tools.push({ name: toolName, status: success ? 'PASS' : 'FAIL', error: success ? null : (r?.error || 'Failed') });
              if (success) { groups[groupName].pass++; results.summary.pass++; }
              else { groups[groupName].fail++; results.summary.fail++; }
              results.summary.total++;
            } catch (e: any) {
              groups[groupName].tools.push({ name: toolName, status: 'ERROR', error: e.message });
              groups[groupName].fail++; results.summary.fail++; results.summary.total++;
            }
            
            // Wait for previous tool to fully clean up before next
            await sleep(1000);
          }
        }
        
        results.tools = Object.values(groups);
        const allPass = results.summary.fail === 0;
        results.summary.status = allPass ? '✅ ALL PASSING' : '⚠️ SOME FAILING';
        results.summary.passRate = results.summary.total > 0 
          ? Math.round((results.summary.pass / results.summary.total) * 100) + '%' 
          : '0%';
        results.note = mode === 'registry' ? 'Fast registry check - run with mode:"exec" for full execution test' : 'Execution test of safe tools only';
        
        return JSON.stringify(results, null, 2);
      }
    });
  }

  private registerTool(def: ToolDefinition): void {
    this.tools.register(def);
    console.log(`   + Tool: ${def.name}${def.dangerous ? ' ⚠️' : ''}`);
  }

  // ─── Chat Loop ─────────────────────────────────────────

  async chat(message: string): Promise<string> {
    await this.ensureInitialized();
    this.metrics.totalInteractions++;
    const startTime = Date.now();

    this.sessions.addMessage({
      sessionId: this.sessionId,
      role: 'user',
      content: message,
      timestamp: startTime
    });

    if (this.totalCost >= this.costBudget) {
      return "⚠️ Cost budget exceeded.";
    }

    this.history.push({ role: 'user', content: message, timestamp: startTime });
    
    // Build context with learning loop context
    const context = await this.buildContext();
    
    // Emit thinking
    this.streams.thinking(this.sessionId, 'Building context...');

    // Smart router: tries providers in priority order (kimi → minimax → openrouter)
    let response: string | null = null;
    let lastProvider = '';
    try {
      const routeResult = await this.providers.route('', context);
      response = routeResult.text;
      lastProvider = routeResult.provider;
      this.trackCost(routeResult.provider, this.estimateTokens(JSON.stringify(context)), this.estimateTokens(response));
    } catch (e: any) {
      // fall through to error
    }

    if (!response) {
      this.metrics.failedInteractions++;
      const errMsg = `❌ All router targets failed`;
      this.sessions.addMessage({ sessionId: this.sessionId, role: 'assistant', content: errMsg, timestamp: Date.now() });
      return errMsg;
    }

    // Parse and execute tools in PARALLEL
    const toolCalls = this.parseToolCalls(response);
    const toolsUsed: string[] = [];
    if (toolCalls.length > 0) {
      const results = await Promise.all(toolCalls.map(async (call) => {
        const tStart = Date.now();
        this.streams.toolStart(this.sessionId, call.name, call.args);
        toolsUsed.push(call.name);
        try {
          let result: any = await this.tools.execute(call.name, call.args);
          const tDuration = Date.now() - tStart;
          if (call.name === 'agent_spawn_team' && result && typeof result === 'object') {
            const agentIds: string[] = result.agentIds || [];
            if (agentIds.length > 0) {
              this.streams.thinking(this.sessionId, 'Waiting for ' + agentIds.length + ' parallel agents...');
              const agentResults = await Promise.all(agentIds.map(id => this.subagents.waitFor(id, 300000)));
              result = { agents: agentIds, results: agentResults };
            }
          }
          this.streams.toolEnd(this.sessionId, call.name, true, JSON.stringify(result).slice(0, 200), undefined, tDuration);
          return '\n\n🔧 ' + call.name + ': ' + JSON.stringify(result);
        } catch (e: any) {
          const tDuration = Date.now() - tStart;
          this.streams.toolEnd(this.sessionId, call.name, false, undefined, e.message, tDuration);
          return '\n\n❌ ' + call.name + ' failed: ' + e.message;
        }
      }));
      response += results.join('');
    }

    // Track interaction for learning
    if (this.learningEnabled) {
      const duration = Date.now() - startTime;
      this.learning.trackInteraction({
        sessionId: this.sessionId,
        input: message,
        output: response,
        outcome: this.metrics.failedInteractions === 0 ? 'success' : 'partial',
        toolsUsed,
        duration,
        timestamp: Date.now()
      });
    }

    // Learn from interaction
    if (this.learningEnabled) {
      this.learnFromInteraction(message, response);
    }

    this.history.push({ role: 'assistant', content: response, timestamp: Date.now() });
    this.metrics.successfulInteractions++;

    // Save to session
    this.sessions.addMessage({
      sessionId: this.sessionId,
      role: 'assistant',
      content: response,
      timestamp: Date.now()
    });

    // Trim history
    if (this.history.length > this.maxHistory) {
      this.history = this.history.slice(-this.maxHistory);
    }

    // Emit session end
    this.streams.sessionEnd(this.sessionId, 'success', Date.now() - startTime, toolsUsed);

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
    const words = input.toLowerCase().split(/\s+/).filter(w => w.length > 4);
    if (words.length > 0 && output.length > 20) {
      const key = words.slice(0, 3).join(' ');
      if (!this.learnedPatterns.has(key)) {
        this.learnedPatterns.set(key, output.slice(0, 200));
      }
    }
    this.learningLog.push({ input, output, success: true, timestamp: Date.now() });
  }

  learn(success: boolean, feedback?: string): void {
    const last = this.learningLog[this.learningLog.length - 1];
    if (last) {
      last.success = success;
      last.feedback = feedback;
    }
  }

  private async buildContext(): Promise<any[]> {
    const messages: any[] = [];
    
    const systemPrompt = this.buildSystemPrompt();
    messages.push({ role: 'system', content: systemPrompt });

    // Learning context
    if (this.learningEnabled) {
      const learningContext = this.learning.buildContextPrompt(this.sessionId);
      if (learningContext) {
        messages.push({ role: 'system', content: learningContext });
      }
    }

    // Memory SOUL
    const soul = this.memory.getSoul();
    if (soul) messages.push({ role: 'system', content: soul });

    // Learned patterns
    if (this.learnedPatterns.size > 0) {
      const patterns = Array.from(this.learnedPatterns.entries())
        .map(([k, v]) => `When asked about "${k}": ${v}`)
        .join('\n');
      messages.push({ role: 'system', content: `Learned responses:\n${patterns}` });
    }

    // Recent history
    const recent = this.history.slice(-20);
    messages.push(...recent);

    return messages;
  }

  private buildSystemPrompt(): string {
    const tools = this.tools.list().map(t => `- ${t.name}: ${t.description}`).join('\n');
    const capabilities: string[] = ['Be helpful, practical, concise'];
    
    if (this.config.planningEnabled) capabilities.push('Use plan_create for complex multi-step tasks');
    if (this.config.cronEnabled) capabilities.push('Use cron_create to schedule recurring tasks');
    if (this.config.subagentEnabled) capabilities.push('Use agent_spawn_team to run multiple agents in PARALLEL');
    capabilities.push('For tasks with independent parts, ALWAYS consider spawning parallel agents');
    if (this.learningEnabled) capabilities.push('Use memory_remember to save important information');
    capabilities.push('Use learn_from_feedback after completing tasks');

    return `You are ${this.name}, an advanced AI assistant with autonomous planning, subagent orchestration, and self-improvement.

Capabilities:
${tools}

Guidelines:
${capabilities.join('\n')}`;
  }

  private parseToolCalls(text: string): Array<{ name: string; args: any }> {
    const calls: Array<{ name: string; args: any }> = [];
    const pattern1 = /\[TOOL:\s*(\w+)\s*\|\s*args:\s*(\{[^}]+\})\]/g;
    let match;
    while ((match = pattern1.exec(text)) !== null) {
      try { calls.push({ name: match[1], args: JSON.parse(match[2]) }); } catch {}
    }
            const pattern2 = /(\w+)\s*\(\s*(\{[^}]+\})\s*\)/g;
        let match2;
        while ((match2 = pattern2.exec(text)) !== null) {
          if (this.tools.has(match2[1])) {
            try { calls.push({ name: match2[1], args: JSON.parse(match2[2]) }); } catch {}
          }
        }
        return calls;
      }

      private estimateTokens(text: string): number {
        return Math.ceil(text.length / 4);
      }

      private trackCost(provider: string, promptTokens: number, completionTokens: number): void {
        const costs: Record<string, number> = {
          'minimax': 0.5, 'openai': 2.0, 'anthropic': 3.0, 'lmstudio': 0
        };
        const rate = costs[provider] || 1;
        const cost = (promptTokens + completionTokens) / 1_000_000 * rate;
        this.totalCost += cost;
        this.costRecords.push({ provider, model: this.config.model || 'default', promptTokens, completionTokens, cost, timestamp: Date.now() });
      }

      getMetrics(): AgentMetrics {
        return { ...this.metrics, totalCost: this.totalCost };
      }

      getCostInfo(): { total: number; budget: number; remaining: number } {
        return { total: this.totalCost, budget: this.costBudget, remaining: this.costBudget - this.totalCost };
      }

      private async ensureInitialized(): Promise<void> {
        if (!this.initialized) await this.initialize();
      }

      async think(input: string): Promise<string> { return this.chat(input); }
      async execute(input: string): Promise<string> { return this.chat(input); }
      async remember(content: string): Promise<void> { await this.memory.add(content, 'fact'); }
      async recall(query: string): Promise<string[]> { return this.memory.search(query); }
      async openApp(app: string): Promise<void> { await this.desktop.openApp(app); }
      async click(x: number, y: number): Promise<void> { await this.desktop.click(x, y); }
      async type(text: string): Promise<void> { await this.desktop.type(text); }
      async screenshot(): Promise<string> { return this.desktop.screenshot(); }

      getHistory(): Message[] { return [...this.history]; }
      clearHistory(): void { this.history = []; }

      getStatus() {
        const activePlans = this.planner.listActivePlans();
        const memoryStats = this.memory.stats();
        const sessionStats = this.sessions.stats();
        const learningStats = this.learning.stats();
        const cronStats = this.cron.stats();
        const subagentStats = this.subagents.stats();

        return {
          id: this.id,
          name: this.name,
          sessionId: this.sessionId,
          providers: this.providers.list().length,
          tools: this.tools.list().length,
          toolList: this.tools.list().map(t => ({ name: t.name, dangerous: t.dangerous })),
          skills: this.skills.list(),
          historyLength: this.history.length,
          learnedPatterns: this.learnedPatterns.size,
          cost: this.getCostInfo(),
          metrics: this.getMetrics(),
          memory: memoryStats,
          sessions: sessionStats,
          learning: learningStats,
          cron: cronStats,
          subagents: subagentStats,
          planning: { activePlans: activePlans.length, plans: activePlans.map(p => ({ id: p.id, goal: p.goal, status: p.status })) },
          guard: this.guard.stats()
        };
    }

    // MCP tool access - expose tools for MCP server
    getTools() {
      return this.tools.list();
    }

    async executeTool(name: string, args: any) {
      return await this.tools.execute(name, args);
    }

    async shutdown(): Promise<void> {
        console.log(`\n🦆 ${this.name} shutting down...`);
        try { this.memory.close(); } catch {}
        try { this.sessions.endSession(this.sessionId, 'success'); } catch {}
        try { this.sessions.close(); } catch {}
        try { this.cron.close(); } catch {}
        try { this.subagents.close(); } catch {}
        try { this.learning.close(); } catch {}
        try { this.streams.sessionEnd(this.sessionId, 'success', 0, []); } catch {}
        console.log(`   Total cost: $${this.totalCost.toFixed(4)}`);
        console.log(`   Interactions: ${this.metrics.totalInteractions}`);
        console.log(`   Success rate: ${this.metrics.totalInteractions > 0 ? (this.metrics.successfulInteractions / this.metrics.totalInteractions * 100).toFixed(1) : 0}%`);
        try { console.log(`   Sessions: ${this.sessions.stats().totalSessions}`); } catch {}
        try { console.log(`   Learned skills: ${this.learning.stats().learnedSkills}`); } catch {}
        try { console.log(`   Cron jobs: ${this.cron.stats().totalJobs}`); } catch {}
        try { console.log(`   Active subagents: ${this.subagents.stats().active}`); } catch {}
        console.log(`✅ ${this.name} stopped`);
      }
    }

    export default Agent;
    