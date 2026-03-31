/**
 * 🦆 Duck Agent - Delegate Tool
 * Spawns subagents with isolated context for parallel task execution
 */

import { spawn } from 'child_process';
import { writeFileSync, mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// Tools that subagents must never access
const BLOCKED_TOOLS = new Set([
  'delegate_task',   // No recursive delegation
  'clarify',         // No user interaction
  'remember',        // No writes to shared memory
  'send_message',    // No cross-platform side effects
  'execute_code',    // Children should reason step-by-step
]);

const MAX_CONCURRENT = 3;
const MAX_DEPTH = 2;
const DEFAULT_MAX_ITERATIONS = 50;

// Toolset definitions for subagents
const SUBSAGENT_TOOLSETS = {
  'minimal': ['file_read', 'bash', 'grep'],
  'file': ['file_read', 'file_write', 'file_edit', 'glob', 'grep'],
  'web': ['file_read', 'bash', 'web_search', 'web_fetch'],
  'coding': ['file_read', 'file_write', 'file_edit', 'glob', 'grep', 'bash'],
  'research': ['file_read', 'bash', 'web_search', 'web_fetch', 'remember', 'recall'],
};

export interface DelegateOptions {
  task: string;
  context?: string;
  toolset?: string;
  maxIterations?: number;
  model?: string;
  timeout?: number;
}

export interface DelegateResult {
  success: boolean;
  summary?: string;
  error?: string;
  duration: number;
}

/**
 * Spawn a child agent to work on a specific task
 */
export async function delegateTask(options: DelegateOptions): Promise<DelegateResult> {
  const startTime = Date.now();
  
  const {
    task,
    context = '',
    toolset = 'minimal',
    maxIterations = DEFAULT_MAX_ITERATIONS,
    timeout = 300000, // 5 min default
  } = options;
  
  // Create temp directory for this task
  const taskDir = mkdtempSync(join(tmpdir(), 'duck-delegate-'));
  
  try {
    // Build system prompt
    const systemPrompt = buildSystemPrompt(task, context, toolset);
    
    // Create task config
    const taskConfig = {
      id: `delegate_${Date.now()}`,
      task,
      context,
      toolset,
      maxIterations,
      systemPrompt,
      parentAgent: 'DuckAgent',
    };
    
    const configPath = join(taskDir, 'task.json');
    writeFileSync(configPath, JSON.stringify(taskConfig, null, 2));
    
    // Spawn child agent
    const result = await spawnChildAgent(taskDir, timeout);
    
    return {
      success: result.success,
      summary: result.output,
      error: result.error,
      duration: Date.now() - startTime,
    };
  } finally {
    // Cleanup temp directory
    try {
      rmSync(taskDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Spawn multiple child agents in parallel
 */
export async function delegateBatch(
  tasks: DelegateOptions[],
  options?: { maxConcurrent?: number; onProgress?: (index: number, result: DelegateResult) => void }
): Promise<DelegateResult[]> {
  const maxConcurrent = options?.maxConcurrent || MAX_CONCURRENT;
  const results: DelegateResult[] = [];
  
  // Process in chunks
  for (let i = 0; i < tasks.length; i += maxConcurrent) {
    const chunk = tasks.slice(i, i + maxConcurrent);
    const chunkResults = await Promise.all(
      chunk.map((task, idx) => delegateTask(task))
    );
    
    chunkResults.forEach((result, idx) => {
      results.push(result);
      options?.onProgress?.(i + idx, result);
    });
  }
  
  return results;
}

function buildSystemPrompt(task: string, context: string, toolset: string): string {
  const tools = SUBSAGENT_TOOLSETS[toolset as keyof typeof SUBSAGENT_TOOLSETS] || SUBSAGENT_TOOLSETS['minimal'];
  
  return `You are a focused subagent working on a specific delegated task.

YOUR TASK:
${task}

${context ? `CONTEXT:\n${context}` : ''}

AVAILABLE TOOLS:
${tools.map(t => `  - ${t}`).join('\n')}

INSTRUCTIONS:
1. Complete this task using the tools available to you
2. When finished, provide a clear, concise summary of:
   - What you did
   - What you found or accomplished
   - Any files you created or modified
   - Any issues encountered
3. Be thorough but concise -- your response is returned to the parent agent as a summary

Remember: You are a subagent. Focus only on your assigned task.`;
}

function spawnChildAgent(taskDir: string, timeout: number): Promise<{ success: boolean; output?: string; error?: string }> {
  return new Promise((resolve) => {
    // Use Duck Agent itself as the child agent
    const child = spawn('node', [
      'dist/cli/main.js',
      'think',
      `Task from delegate: ${JSON.parse(require('fs').readFileSync(join(taskDir, 'task.json'), 'utf-8')).task}`
    ], {
      cwd: process.cwd(),
      timeout,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    
    let output = '';
    let error = '';
    
    child.stdout?.on('data', (data) => {
      output += data.toString();
    });
    
    child.stderr?.on('data', (data) => {
      error += data.toString();
    });
    
    child.on('close', (code) => {
      resolve({
        success: code === 0,
        output: output.slice(-2000), // Last 2000 chars
        error: error.slice(-500),
      });
    });
    
    child.on('error', (err) => {
      resolve({
        success: false,
        error: err.message,
      });
    });
    
    // Timeout
    setTimeout(() => {
      child.kill();
      resolve({
        success: false,
        error: 'Task timed out',
      });
    }, timeout);
  });
}

export default { delegateTask, delegateBatch, BLOCKED_TOOLS };
