/**
 * 🦆 Duck Agent - Agent Orchestrator
 * Multi-agent coordination and task decomposition
 */

import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';

export interface SubTask {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  successCriteria: string;
  result?: any;
  error?: string;
}

export interface OrchestratorOptions {
  maxConcurrent: number;
  workspace: string;
  onProgress: (task: SubTask) => void;
}

const DEFAULT_OPTIONS: OrchestratorOptions = {
  maxConcurrent: 3,
  workspace: '/tmp/duck-orchestrator',
  onProgress: () => {},
};

/**
 * Decompose a macro task into parallelizable subtasks
 */
export function decomposeTask(goal: string): SubTask[] {
  const tasks: SubTask[] = [];
  
  const taskKeywords = [
    'research', 'build', 'test', 'review', 'document',
    'analyze', 'create', 'update', 'fix', 'deploy'
  ];
  
  const parts = goal
    .replace(/\band\b/gi, '|')
    .replace(/,/g, '|')
    .split('|')
    .map(s => s.trim())
    .filter(s => s.length > 10);

  parts.forEach((part: string, idx: number) => {
    const keywords = taskKeywords.filter(k => part.toLowerCase().includes(k));
    const taskName = keywords[0] || 'task';
    
    tasks.push({
      id: `subtask_${idx + 1}`,
      name: `${taskName}: ${part.slice(0, 50)}`,
      description: part,
      status: 'pending',
      successCriteria: `Task "${part}" completed successfully`,
    });
  });
  
  return tasks.length > 0 ? tasks : [{
    id: 'subtask_1',
    name: 'main',
    description: goal,
    status: 'pending',
    successCriteria: 'Task completed successfully',
  }];
}

/**
 * Create agent workspace directory structure
 */
export function createAgentWorkspace(workspace: string, agentName: string): string {
  const agentDir = join(workspace, agentName);
  
  mkdirSync(join(agentDir, 'inbox'), { recursive: true });
  mkdirSync(join(agentDir, 'outbox'), { recursive: true });
  mkdirSync(join(agentDir, 'workspace'), { recursive: true });
  
  const statusPath = join(agentDir, 'status.json');
  if (!existsSync(statusPath)) {
    writeFileSync(statusPath, JSON.stringify({ state: 'pending', started: null }));
  }
  
  return agentDir;
}

/**
 * Write instructions for a subagent
 */
export function writeAgentInstructions(
  agentDir: string,
  task: SubTask,
  context?: string
): void {
  const instructions = `# Subagent Task

## Your Task
${task.description}

## Context
${context || 'No additional context provided.'}

## Success Criteria
${task.successCriteria}

## Instructions
1. Complete the task using available tools
2. Write your results to \`/outbox/result.md\`
3. Update \`/status.json\` with your final state
4. Be thorough but concise in your summary
`;

  writeFileSync(join(agentDir, 'inbox', 'instructions.md'), instructions);
}

/**
 * Read agent result
 */
export function readAgentResult(agentDir: string): { success: boolean; output?: string; error?: string } {
  const resultPath = join(agentDir, 'outbox', 'result.md');
  const statusPath = join(agentDir, 'status.json');
  
  if (!existsSync(resultPath)) {
    return { success: false, error: 'No result file found' };
  }
  
  const result = readFileSync(resultPath, 'utf-8');
  const status = existsSync(statusPath) ? JSON.parse(readFileSync(statusPath, 'utf-8')) : {};
  
  return {
    success: status.state === 'completed',
    output: result,
    error: status.error,
  };
}

/**
 * Orchestrate multiple subtasks
 */
export async function orchestrate(
  goal: string,
  options: Partial<OrchestratorOptions> = {}
): Promise<{ success: boolean; results: SubTask[] }> {
  const opts: OrchestratorOptions = { ...DEFAULT_OPTIONS, ...options };
  
  mkdirSync(opts.workspace, { recursive: true });
  
  const tasks = decomposeTask(goal);
  
  console.log(`🦆 Orchestrating ${tasks.length} subtasks...`);
  
  for (const task of tasks) {
    task.status = 'running';
    opts.onProgress(task);
    
    const agentDir = createAgentWorkspace(opts.workspace, task.id);
    writeAgentInstructions(agentDir, task);
    
    console.log(`  → ${task.name}`);
    
    task.status = 'completed';
    opts.onProgress(task);
  }
  
  return {
    success: tasks.every(t => t.status === 'completed'),
    results: tasks,
  };
}

export default { decomposeTask, createAgentWorkspace, writeAgentInstructions, readAgentResult, orchestrate };
