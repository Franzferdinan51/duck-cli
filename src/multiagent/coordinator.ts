/**
 * 🦆 Duck Agent - Multi-Agent Coordinator
 * Based on Claude Code coordinator system
 */

import { EventEmitter } from 'events';
import { randomBytes } from 'crypto';

export type TaskType = 'worker' | 'verification' | 'research' | 'implementation';
export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'killed';

export interface AgentTask {
  id: string;
  type: TaskType;
  description: string;
  status: TaskStatus;
  prompt: string;
  result?: string;
  error?: string;
  usage?: {
    total_tokens: number;
    tool_uses: number;
    duration_ms: number;
  };
  startTime: number;
  endTime?: number;
}

export interface CoordinatorOptions {
  maxConcurrent?: number;
  defaultModel?: string;
  onTaskComplete?: (task: AgentTask) => void;
  onTaskFail?: (task: AgentTask, error: string) => void;
}

export interface WorkerResult {
  success: boolean;
  taskId: string;
  result?: string;
  error?: string;
  usage?: AgentTask['usage'];
}

// ============================================================================
// COORDINATOR SYSTEM PROMPT
// ============================================================================

export const COORDINATOR_SYSTEM_PROMPT = `You are a coordinator that orchestrates software engineering tasks across multiple workers.

## Your Role

You are a **coordinator**. Your job is to:
- Help the user achieve their goal
- Direct workers to research, implement and verify code changes
- Synthesize results and communicate with the user
- Answer questions directly when possible — don't delegate work that you can handle without tools

Every message you send is to the user. Worker results and system notifications are internal signals.

## Your Tools

- **spawnWorker** - Spawn a new worker agent
- **sendMessage** - Continue an existing worker
- **stopWorker** - Stop a running worker

## Worker Types

| Type | Purpose |
|------|---------|
| worker | General purpose agent |
| research | Investigation and analysis |
| verification | Test and verify changes |
| implementation | Make targeted changes |

## Task Workflow

| Phase | Who | Purpose |
|-------|-----|---------|
| Research | Workers (parallel) | Investigate codebase, find files, understand problem |
| Synthesis | You (coordinator) | Understand problem, craft implementation specs |
| Implementation | Workers | Make targeted changes per spec |
| Verification | Workers | Test changes work |

## Parallelism

**Launch independent workers concurrently whenever possible.** Don't serialize work that can run simultaneously.

- **Read-only tasks** (research) — run in parallel freely
- **Write-heavy tasks** (implementation) — one at a time per set of files
- **Verification** can run alongside implementation on different files

## Worker Prompts

**Workers can't see your conversation.** Every prompt must be self-contained with everything the worker needs.

### Always synthesize findings

When workers report research findings, **you must understand them before directing follow-up work**.

\`\`\`
// Good — specific file paths, line numbers, exact changes
Fix the null pointer in src/auth/validate.ts:42. Add a null check before user.id access.

// Bad — vague delegation
Based on your findings, fix the auth bug
\`\`\`

### Continue vs Spawn

| Situation | Mechanism | Why |
|-----------|-----------|-----|
| Research explored files that need editing | **Continue** (sendMessage) | Worker has context |
| Broad research, narrow implementation | **Spawn fresh** | Avoid dragging exploration noise |
| Correcting failure | **Continue** | Worker has error context |
| Verifying code another worker wrote | **Spawn fresh** | Fresh eyes |

## Example Session

User: "There's a null pointer in the auth module."

Coordinator:
  Let me investigate.

  spawnWorker({ type: "research", description: "Find auth null pointer", prompt: "Investigate src/auth/ for null pointer exceptions around session handling..." })

Coordinator:
  Investigating — I'll report back with findings.

Worker Result:
  Found null pointer in src/auth/validate.ts:42. User field undefined when session expires.

Coordinator:
  Found it. Let me fix it.

  sendMessage({ to: "worker-xxx", message: "Fix null pointer in src/auth/validate.ts:42. Add null check before user.id. Run tests, commit." })

## Verification

**Prove the code works, don't just confirm it exists.**
- Run tests with the feature enabled
- Investigate errors — don't dismiss as unrelated
- Test edge cases and error paths`;

// ============================================================================
// WORKER AGENT PROMPT
// ============================================================================

export const WORKER_SYSTEM_PROMPT = `You are a worker agent executing tasks autonomously.

## Your Role

You execute tasks given by the coordinator. Be thorough, self-verify your work, and report completion clearly.

## Workflow

1. Read your prompt carefully
2. Execute the task
3. Verify the work
4. Report completion with:
   - What you did
   - Files modified
   - Test results
   - Commit hash (if applicable)

## Guidelines

- Be self-contained — you can't ask the coordinator clarifying questions
- If blocked, report the specific error
- Verify before reporting complete
- Run relevant tests
- Commit your changes

## Done Criteria

Always end with:
- What was accomplished
- Files changed
- Test results (pass/fail)
- Any remaining issues`;

// ============================================================================
// COORDINATOR CLASS
// ============================================================================

export class MultiAgentCoordinator extends EventEmitter {
  private tasks: Map<string, AgentTask> = new Map();
  private maxConcurrent: number;
  private defaultModel: string;
  private activeCount = 0;
  private queue: string[] = [];
  
  constructor(options: CoordinatorOptions = {}) {
    super();
    this.maxConcurrent = options.maxConcurrent || 5;
    this.defaultModel = options.defaultModel || 'MiniMax-M2.7';
  }
  
  /**
   * Generate a unique task ID
   */
  private generateTaskId(type: TaskType): string {
    const prefix = type.charAt(0);
    const bytes = randomBytes(8).toString('hex');
    return `${prefix}${bytes}`;
  }
  
  /**
   * Spawn a new worker
   */
  async spawnWorker(
    type: TaskType,
    description: string,
    prompt: string,
    options: {
      model?: string;
      tools?: string[];
      isolation?: 'worktree' | 'sandbox';
    } = {}
  ): Promise<string> {
    const taskId = this.generateTaskId(type);
    
    const task: AgentTask = {
      id: taskId,
      type,
      description,
      prompt,
      status: 'pending',
      startTime: Date.now(),
    };
    
    this.tasks.set(taskId, task);
    this.emit('taskSpawned', task);
    
    // Queue if at capacity
    if (this.activeCount >= this.maxConcurrent) {
      this.queue.push(taskId);
      this.emit('taskQueued', task);
      return taskId;
    }
    
    // Start immediately
    this.startTask(taskId, options);
    return taskId;
  }
  
  /**
   * Start a task
   */
  private async startTask(
    taskId: string,
    options: {
      model?: string;
      tools?: string[];
      isolation?: 'worktree' | 'sandbox';
    } = {}
  ): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) return;
    
    task.status = 'running';
    this.activeCount++;
    this.emit('taskStarted', task);
    
    try {
      // Execute the worker (would integrate with actual agent system)
      const result = await this.executeWorker(task, options);
      
      task.status = 'completed';
      task.result = result.output;
      task.usage = result.usage;
      task.endTime = Date.now();
      
      this.emit('taskCompleted', task);
    } catch (e: any) {
      task.status = 'failed';
      task.error = e.message;
      task.endTime = Date.now();
      
      this.emit('taskFailed', task);
    }
    
    this.activeCount--;
    this.processQueue();
  }
  
  /**
   * Execute a worker task via MiniMax API
   */
  private async executeWorker(
    task: AgentTask,
    options: any
  ): Promise<{ output: string; usage: AgentTask['usage'] }> {
    const apiKey = process.env.MINIMAX_API_KEY || process.env.MINIMAX_API_KEY_2 || '';
    const model = options.model || 'MiniMax-M2.7';
    const start = Date.now();

    if (!apiKey) {
      throw new Error(`No MINIMAX_API_KEY set. Worker cannot execute.`);
    }

    try {
      const response = await fetch('https://api.minimax.io/v1/text/chatcompletion_v2', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: model.includes('/') ? model : `${
            model === 'MiniMax-M2.7' ? 'MiniMax/MiniMax-M2.7' :
            model === 'glm-5' ? 'zhipuai/glm-5' :
            model === 'glm-4.7' ? 'zhipuai/glm-4.7' :
            model
          }`,
          messages: [
            {
              role: 'user',
              content: task.prompt,
            },
          ],
          max_tokens: 4096,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        throw new Error(`MiniMax API error ${response.status}: ${err}`);
      }

      const json = await response.json() as any;
      const output = json.choices?.[0]?.message?.content || '';
      const tokens = json.usage?.total_tokens || output.length / 4;
      const duration = Date.now() - start;

      return {
        output,
        usage: {
          total_tokens: tokens,
          tool_uses: 0,
          duration_ms: duration,
        },
      };
    } catch (e: any) {
      throw new Error(`Worker execution failed: ${e.message}`);
    }
  }
  
  /**
   * Process queued tasks
   */
  private processQueue(): void {
    while (this.queue.length > 0 && this.activeCount < this.maxConcurrent) {
      const taskId = this.queue.shift()!;
      const task = this.tasks.get(taskId);
      if (task && task.status === 'pending') {
        this.startTask(taskId, {});
      }
    }
  }
  
  /**
   * Send message to a running worker
   */
  async sendMessage(taskId: string, message: string): Promise<boolean> {
    const task = this.tasks.get(taskId);
    if (!task) return false;
    
    this.emit('messageSent', { taskId, message });
    
    // If task is pending/running, we'd append to its context
    // For now, just acknowledge
    return true;
  }
  
  /**
   * Stop a running worker
   */
  async stopWorker(taskId: string): Promise<boolean> {
    const task = this.tasks.get(taskId);
    if (!task) return false;
    
    if (task.status === 'pending' || task.status === 'running') {
      task.status = 'killed';
      task.endTime = Date.now();
      this.activeCount--;
      this.processQueue();
      this.emit('taskKilled', task);
      return true;
    }
    
    return false;
  }
  
  /**
   * Get task by ID
   */
  getTask(taskId: string): AgentTask | undefined {
    return this.tasks.get(taskId);
  }
  
  /**
   * Get all tasks
   */
  getAllTasks(): AgentTask[] {
    return Array.from(this.tasks.values());
  }
  
  /**
   * Get tasks by status
   */
  getTasksByStatus(status: TaskStatus): AgentTask[] {
    return this.getAllTasks().filter(t => t.status === status);
  }
  
  /**
   * Get active tasks
   */
  getActiveTasks(): AgentTask[] {
    return this.getTasksByStatus('running').concat(this.getTasksByStatus('pending'));
  }
  
  /**
   * Get completed tasks
   */
  getCompletedTasks(): AgentTask[] {
    return this.getTasksByStatus('completed');
  }
  
  /**
   * Wait for a single task to complete
   */
  async waitForTask(taskId: string, timeoutMs = 120000): Promise<AgentTask | null> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const task = this.tasks.get(taskId);
      if (!task) return null;
      if (task.status === 'completed' || task.status === 'failed') return task;
      await new Promise(r => setTimeout(r, 100));
    }
    return this.tasks.get(taskId) || null;
  }

  /**
   * Wait for all tasks to complete
   */
  async waitForAll(timeout?: number): Promise<AgentTask[]> {
    const startTime = Date.now();
    
    while (this.getActiveTasks().length > 0) {
      if (timeout && Date.now() - startTime > timeout) {
        throw new Error('Timeout waiting for tasks');
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    return this.getAllTasks();
  }
  
  /**
   * Get coordinator statistics
   */
  getStats(): {
    total: number;
    pending: number;
    running: number;
    completed: number;
    failed: number;
    killed: number;
    totalTokens: number;
    totalDuration: number;
  } {
    const tasks = this.getAllTasks();
    const stats = {
      total: tasks.length,
      pending: 0,
      running: 0,
      completed: 0,
      failed: 0,
      killed: 0,
      totalTokens: 0,
      totalDuration: 0,
    };
    
    for (const task of tasks) {
      switch (task.status) {
        case 'pending': stats.pending++; break;
        case 'running': stats.running++; break;
        case 'completed': stats.completed++; break;
        case 'failed': stats.failed++; break;
        case 'killed': stats.killed++; break;
      }
      if (task.usage) stats.totalTokens += task.usage.total_tokens;
      if (task.endTime) stats.totalDuration += task.endTime - task.startTime;
    }
    
    return stats;
  }
  
  /**
   * Clear all tasks
   */
  clear(): void {
    this.tasks.clear();
    this.queue = [];
    this.activeCount = 0;
  }
  
  /**
   * Format task as XML notification
   */
  formatTaskNotification(task: AgentTask): string {
    return `<task-notification>
<task-id>${task.id}</task-id>
<status>${task.status}${task.error ? ': ' + task.error : ''}</status>
<summary>Agent "${task.description}" ${task.status}</summary>
${task.result ? `<result>${task.result}</result>` : ''}
${task.usage ? `<usage>
  <total_tokens>${task.usage.total_tokens}</total_tokens>
  <tool_uses>${task.usage.tool_uses}</tool_uses>
  <duration_ms>${task.usage.duration_ms}</duration_ms>
</usage>` : ''}
</task-notification>`;
  }
}

export default MultiAgentCoordinator;
