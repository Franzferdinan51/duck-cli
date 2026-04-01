/**
 * Duck Agent - Subagent Manager
 * Spawn and manage parallel subagents for complex tasks
 * Enables multi-agent coordination
 */

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

export type SubagentStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
export type SubagentRole = 'general' | 'researcher' | 'coder' | 'reviewer' | 'qa' | 'writer' | 'planner';

export interface Subagent {
  id: string;
  name: string;
  role: SubagentRole;
  task: string;
  status: SubagentStatus;
  parentId?: string;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  duration?: number;
  result?: string;
  error?: string;
  progress: number;       // 0-100
  messages: SubagentMessage[];
  children: string[];     // child subagent IDs
  toolsUsed: string[];
  cost?: number;
  exitCode?: number;
}

export interface SubagentMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp?: number;
}

export interface SubagentConfig {
  name?: string;
  role?: SubagentRole;
  model?: string;
  provider?: string;
  timeout?: number;        // ms
  maxTokens?: number;
  tools?: string[];        // allowed tools
  memory?: string;          // context to inject
}

export interface TaskResult {
  subagentId: string;
  success: boolean;
  result?: string;
  error?: string;
  duration: number;
  toolsUsed: string[];
  cost?: number;
}

export class SubagentManager extends EventEmitter {
  private _handlers: Array<(event: SubagentEvent) => void> = [];
  private agents: Map<string, Subagent> = new Map();
  private processes: Map<string, ChildProcess> = new Map();
  private db: Database.Database;
  private subagentDir: string;
  private nextId = 1;

  constructor(subagentDir?: string) {
    super();
    this.subagentDir = subagentDir || join(homedir(), '.duck', 'subagents');
    mkdirSync(this.subagentDir, { recursive: true });
    
    const dbPath = join(this.subagentDir, 'subagents.db');
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    
    this.initialize();
  }

  private initialize(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS subagents (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        role TEXT NOT NULL,
        task TEXT NOT NULL,
        status TEXT NOT NULL,
        parent_id TEXT,
        created_at INTEGER NOT NULL,
        started_at INTEGER,
        completed_at INTEGER,
        duration INTEGER,
        result TEXT,
        error TEXT,
        progress INTEGER NOT NULL DEFAULT 0,
        tools_used TEXT NOT NULL DEFAULT '[]',
        cost REAL,
        exit_code INTEGER
      )
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS subagent_messages (
        id TEXT PRIMARY KEY,
        subagent_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        timestamp INTEGER NOT NULL
      )
    `);

    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_parent ON subagents(parent_id)`);
  }

  /**
   * Spawn a new subagent
   */
  spawn(task: string, config: SubagentConfig = {}, parentId?: string): Subagent {
    const id = `agent_${Date.now()}_${String(this.nextId++).padStart(3, '0')}`;
    const now = Date.now();
    
    const agent: Subagent = {
      id,
      name: config.name || `${config.role || 'general'}-${this.nextId - 1}`,
      role: config.role || 'general',
      task,
      status: 'pending',
      parentId,
      createdAt: now,
      progress: 0,
      messages: [],
      children: [],
      toolsUsed: [],
    };

    this.agents.set(id, agent);
    
    // Persist
    this.db.prepare(`
      INSERT INTO subagents (id, name, role, task, status, parent_id, created_at, progress, tools_used)
      VALUES (?, ?, ?, ?, 'pending', ?, ?, 0, '[]')
    `).run(id, agent.name, agent.role, task, parentId || null, now);

    this.notify({ type: 'spawned', agent });

    // Auto-start
    this.start(id, config);

    return agent;
  }

  /**
   * Start a subagent's execution
   */
  async start(agentId: string, config: SubagentConfig = {}): Promise<void> {
    const agent = this.agents.get(agentId);
    if (!agent) throw new Error(`Subagent not found: ${agentId}`);
    if (agent.status === 'running') return;

    agent.status = 'running';
    agent.startedAt = Date.now();
    this.updateStatus(agentId, 'running');

    this.emit('start', { type: 'start', agent, timestamp: Date.now() });
    this.notify({ type: 'start', agent });

    try {
      const result = await this.executeAgent(agent, config);
      
      agent.status = 'completed';
      agent.result = result.output;
      agent.progress = 100;
      agent.cost = result.cost || 0;
      agent.toolsUsed = result.toolsUsed || [];
      agent.completedAt = Date.now();
      agent.duration = agent.completedAt - (agent.startedAt || agent.createdAt);

      this.updateAgent(agent);
      this.emit('complete', { type: 'complete', agent, timestamp: Date.now() });
      this.notify({ type: 'complete', agent, result: result.output, timestamp: Date.now() });

      // Notify parent
      if (agent.parentId) {
        this.onChildComplete(agent.parentId, agentId, result.output);
      }
    } catch (err: any) {
      agent.status = 'failed';
      agent.error = err.message;
      agent.completedAt = Date.now();
      agent.duration = agent.completedAt - (agent.startedAt || agent.createdAt);
      agent.progress = 0;

      this.updateAgent(agent);
      this.emit('error', { type: 'error', agent, error: err?.message, timestamp: Date.now() });
      this.notify({ type: 'error', agent, error: err.message });

      if (agent.parentId) {
        this.onChildComplete(agent.parentId, agentId, undefined, err.message);
      }
    }
  }

  /**
   * Execute agent via duck CLI (spawns as subprocess)
   */
  private async executeAgent(
    agent: Subagent, 
    config: SubagentConfig
  ): Promise<{ output: string; cost?: number; toolsUsed: string[] }> {
    const timeout = config.timeout || 300000; // 5 min default
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      // Build command: run the duck CLI with the agent task
      const args = ['run', `--model=${config.model || 'minimax'}`, `--provider=${config.provider || 'minimax'}`];
      
      // Build a system prompt that sets the agent's role
      const rolePrompt = this.buildRolePrompt(agent.role, agent.task, config.memory);
      
      const child = spawn('node', [
        'dist/cli/main.js', 
        'run',
        '--model', config.model || 'minimax',
        '--provider', config.provider || 'minimax',
        '--timeout', String(timeout),
        rolePrompt
      ], {
        cwd: process.cwd(),
        env: { ...process.env },
        timeout,
      });

      this.processes.set(agent.id, child);

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data: Buffer) => {
        const chunk = data.toString();
        stdout += chunk;
        
        // Parse streaming output
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (line.startsWith('[TOOL:')) {
            const toolMatch = line.match(/\[TOOL:\s*(\w+)/);
            if (toolMatch && !agent.toolsUsed.includes(toolMatch[1])) {
              agent.toolsUsed.push(toolMatch[1]);
            }
          }
        }

        // Update progress based on output length
        if (stdout.length > 100) {
          agent.progress = Math.min(90, agent.progress + 10);
          this.emit('output', { type: 'output', agent, timestamp: Date.now() });
        }
      });

      child.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        this.processes.delete(agent.id);
        agent.exitCode = code || undefined;

        if (code === 0) {
          const duration = Date.now() - startTime;
          resolve({
            output: stdout || 'Task completed',
            cost: duration / 60000 * 0.01, // rough estimate
            toolsUsed: agent.toolsUsed
          });
        } else {
          reject(new Error(stderr || `Exit code: ${code}`));
        }
      });

      child.on('error', (err) => {
        this.processes.delete(agent.id);
        reject(err);
      });
    });
  }

  private buildRolePrompt(role: SubagentRole, task: string, memory?: string): string {
    const roleDescriptions: Record<SubagentRole, string> = {
      general: 'You are a helpful assistant.',
      researcher: `You are a research specialist. Focus on gathering information, analyzing sources, and providing comprehensive answers. Your task: ${task}`,
      coder: `You are an expert programmer. Write clean, efficient code. Follow best practices. Your task: ${task}`,
      reviewer: `You are a code reviewer. Critically analyze code for bugs, security issues, style, and improvements. Your task: ${task}`,
      qa: `You are a QA engineer. Test thoroughly, find edge cases, verify functionality. Your task: ${task}`,
      writer: `You are a technical writer. Write clear, concise documentation. Your task: ${task}`,
      planner: `You are a planning specialist. Break down complex goals into actionable steps. Your task: ${task}`,
    };

    let prompt = roleDescriptions[role] || roleDescriptions.general;
    
    if (memory) {
      prompt += `\n\nContext from parent:\n${memory}`;
    }

    return prompt;
  }

  /**
   * Spawn multiple subagents in parallel for a task
   */
  spawnTeam(
    tasks: Array<{ task: string; role: SubagentRole; name?: string }>,
    parentId?: string
  ): Subagent[] {
    const agents: Subagent[] = [];

    for (const { task, role, name } of tasks) {
      const agent = this.spawn(task, { role, name }, parentId);
      agents.push(agent);
      
      // Track as children of parent
      if (parentId) {
        const parent = this.agents.get(parentId);
        if (parent) {
          parent.children.push(agent.id);
        }
      }
    }

    return agents;
  }

  /**
   * Handle child completion notification
   */
  private onChildComplete(parentId: string, childId: string, result?: string, error?: string): void {
    const parent = this.agents.get(parentId);
    if (!parent) return;

    const child = this.agents.get(childId);
    if (!child) return;

    // Update parent progress
    const completed = parent.children.filter(id => {
      const c = this.agents.get(id);
      return c && (c.status === 'completed' || c.status === 'failed');
    }).length;
    
    parent.progress = Math.round((completed / parent.children.length) * 100);

    // Check if all children done
    if (completed === parent.children.length) {
      // Aggregate results from all children
      const childResults = parent.children.map(id => {
        const c = this.agents.get(id);
        return c ? { id: c.id, role: c.role, result: c.result, error: c.error } : null;
      }).filter(Boolean);

      const allSucceeded = childResults.every(c => !c?.error);
      
      if (allSucceeded) {
        parent.result = this.aggregateResults(childResults as any[]);
        parent.status = 'completed';
        parent.progress = 100;
        this.emit('complete', { type: 'complete', agent: parent, result: parent.result, timestamp: Date.now() });
        this.notify({ type: 'complete', agent: parent, result: parent.result, timestamp: Date.now() });
      } else {
        parent.status = 'failed';
        parent.error = 'One or more child agents failed';
        this.emit('error', parent, new Error(parent.error));
        this.notify({ type: 'error', agent: parent, error: parent.error });
      }

      parent.completedAt = Date.now();
      parent.duration = parent.completedAt - (parent.startedAt || parent.createdAt);
      this.updateAgent(parent);
    }
  }

  private aggregateResults(children: Array<{ id: string; role: string; result?: string; error?: string }>): string {
    const lines = ['## Subagent Results\n'];
    
    for (const child of children) {
      lines.push(`\n### ${child.role} (${child.id})\n`);
      if (child.error) {
        lines.push(`❌ Error: ${child.error}`);
      } else {
        lines.push(child.result || '(no output)');
      }
    }
    
    return lines.join('\n');
  }

  /**
   * Cancel a running subagent
   */
  cancel(agentId: string): boolean {
    const agent = this.agents.get(agentId);
    if (!agent) return false;
    if (agent.status !== 'running') return false;

    // Kill process
    const proc = this.processes.get(agentId);
    if (proc) {
      proc.kill('SIGTERM');
      this.processes.delete(agentId);
    }

    // Cancel children too
    for (const childId of agent.children) {
      this.cancel(childId);
    }

    agent.status = 'cancelled';
    agent.completedAt = Date.now();
    agent.duration = agent.completedAt - (agent.startedAt || agent.createdAt);
    this.updateStatus(agentId, 'cancelled');
    this.emit('cancelled', { type: 'cancelled', agent, timestamp: Date.now() });
    this.notify({ type: 'cancelled', agent });

    return true;
  }

  // ─── Query ──────────────────────────────────────────────────

  get(id: string): Subagent | undefined {
    return this.agents.get(id);
  }

  list(status?: SubagentStatus): Subagent[] {
    const agents = [...this.agents.values()];
    if (status) {
      return agents.filter(a => a.status === status);
    }
    return agents;
  }

  listActive(): Subagent[] {
    return [...this.agents.values()].filter(a => a.status === 'running' || a.status === 'pending');
  }

  listByParent(parentId: string): Subagent[] {
    return [...this.agents.values()].filter(a => a.parentId === parentId);
  }

  waitFor(id: string, timeoutMs: number = 300000): Promise<Subagent> {
    return new Promise((resolve, reject) => {
      const agent = this.agents.get(id);
      if (!agent) {
        reject(new Error(`Subagent not found: ${id}`));
        return;
      }

      if (agent.status === 'completed' || agent.status === 'failed' || agent.status === 'cancelled') {
        resolve(agent);
        return;
      }

      const timeout = setTimeout(() => {
        this.off('complete', onComplete);
        this.off('error', onError);
        reject(new Error(`Timeout waiting for subagent ${id}`));
      }, timeoutMs);

      const onComplete = (a: Subagent) => {
        if (a.id === id) {
          clearTimeout(timeout);
          resolve(a);
        }
      };

      const onError = (a: Subagent) => {
        if (a.id === id) {
          clearTimeout(timeout);
          resolve(a); // Still resolves, check status
        }
      };

      // (removed once listener)
      // (removed once listener)
    });
  }

  // ─── Persistence ────────────────────────────────────────────

  private updateStatus(id: string, status: SubagentStatus): void {
    this.db.prepare(`UPDATE subagents SET status = ? WHERE id = ?`).run(status, id);
  }

  private updateAgent(agent: Subagent): void {
    this.db.prepare(`
      UPDATE subagents SET 
        status = ?, started_at = ?, completed_at = ?, duration = ?,
        result = ?, error = ?, progress = ?, tools_used = ?, cost = ?, exit_code = ?
      WHERE id = ?
    `).run(
      agent.status,
      agent.startedAt || null,
      agent.completedAt || null,
      agent.duration || null,
      agent.result || null,
      agent.error || null,
      agent.progress,
      JSON.stringify(agent.toolsUsed),
      agent.cost || null,
      agent.exitCode || null,
      agent.id
    );
  }

  // ─── Event System ──────────────────────────────────────────

  onSubagentEvent(cb: (event: SubagentEvent) => void): void {
    this._handlers.push(cb);
  }

  private notify(event: SubagentEvent): void {
    for (const cb of this._handlers) {
      try { cb(event); } catch {}
    }
  }

  // ─── Stats ────────────────────────────────────────────────

  stats(): { total: number; active: number; completed: number; failed: number; avgDuration: number } {
    const agents = [...this.agents.values()];
    const completed = agents.filter(a => a.status === 'completed');
    const failed = agents.filter(a => a.status === 'failed');
    const durations = completed.map(a => a.duration || 0).filter(d => d > 0);
    const avgDuration = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;

    return {
      total: agents.length,
      active: agents.filter(a => a.status === 'running' || a.status === 'pending').length,
      completed: completed.length,
      failed: failed.length,
      avgDuration: Math.round(avgDuration)
    };
  }

  close(): void {
    // Cancel all running agents
    for (const [id, proc] of this.processes) {
      proc.kill('SIGTERM');
    }
    this.processes.clear();
    try { if (this.db.open) this.db.close(); } catch {}
  }
}

// ─── Event Types ──────────────────────────────────────────────

export type SubagentEventType = 'spawned' | 'start' | 'complete' | 'error' | 'cancelled' | 'output';

export interface SubagentEvent {
  type: SubagentEventType;
  agent: Subagent;
  result?: string;
  error?: string;
  timestamp?: number;
}

export default SubagentManager;
