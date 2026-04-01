/**
 * Duck Agent - Autonomous Planning System
 * Goal decomposition + progress tracking + self-correction
 */

import { MemorySystem } from '../memory/system.js';

export interface PlanStep {
  id: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
  result?: string;
  error?: string;
  attempts: number;
  maxAttempts: number;
  dependencies: string[];  // step IDs that must complete first
  tools: string[];          // suggested tools for this step
  estimatedDuration?: number; // ms
  actualDuration?: number;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
}

export interface Plan {
  id: string;
  goal: string;
  steps: PlanStep[];
  status: 'planning' | 'executing' | 'completed' | 'failed' | 'aborted';
  currentStepIndex: number;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  totalDuration?: number;
  selfCorrectionCount: number;
  originalGoal: string;      // preserved for context
  context: Record<string, any>;
}

export interface PlanResult {
  success: boolean;
  plan: Plan;
  summary: string;
  stepsCompleted: number;
  stepsFailed: number;
}

export class Planner {
  private memory: MemorySystem;
  private activePlans: Map<string, Plan> = new Map();
  private planHistory: Plan[] = [];

  constructor(memory: MemorySystem) {
    this.memory = memory;
  }

  /**
   * Create a plan from a high-level goal
   * Uses the AI to decompose the goal into steps
   */
  async createPlan(
    goal: string,
    context: Record<string, any> = {},
    availableTools: string[] = []
  ): Promise<Plan> {
    const planId = `plan_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    
    const plan: Plan = {
      id: planId,
      goal,
      steps: [],
      status: 'planning',
      currentStepIndex: 0,
      createdAt: Date.now(),
      selfCorrectionCount: 0,
      originalGoal: goal,
      context,
    };

    this.activePlans.set(planId, plan);

    // Decompose goal into steps
    plan.steps = await this.decompose(goal, availableTools);

    return plan;
  }

  /**
   * Decompose a goal into executable steps
   * Simple pattern-based decomposition + memory lookup
   */
  private async decompose(goal: string, availableTools: string[]): Promise<PlanStep[]> {
    const goalLower = goal.toLowerCase();
    const steps: PlanStep[] = [];

    // Check memory for similar tasks and their step patterns
    const similar = await this.memory.recall(goal, 3);
    if (similar.length > 0) {
      // Found similar tasks - use their patterns
      // (In production, would parse the memory for step structures)
    }

    // Pattern-based decomposition
    if (goalLower.includes('build') || goalLower.includes('create') || goalLower.includes('make')) {
      steps.push({ id: 'step_1', description: 'Understand requirements and scope', status: 'pending', attempts: 0, maxAttempts: 2, dependencies: [], tools: ['shell', 'file_read'], createdAt: Date.now() });
      steps.push({ id: 'step_2', description: 'Design solution architecture', status: 'pending', attempts: 0, maxAttempts: 2, dependencies: ['step_1'], tools: ['shell'], createdAt: Date.now() });
      steps.push({ id: 'step_3', description: 'Set up project structure', status: 'pending', attempts: 0, maxAttempts: 2, dependencies: ['step_2'], tools: ['shell', 'file_write'], createdAt: Date.now() });
      steps.push({ id: 'step_4', description: 'Implement core functionality', status: 'pending', attempts: 0, maxAttempts: 3, dependencies: ['step_3'], tools: ['shell', 'file_write', 'file_read'], createdAt: Date.now() });
      steps.push({ id: 'step_5', description: 'Test and verify', status: 'pending', attempts: 0, maxAttempts: 2, dependencies: ['step_4'], tools: ['shell'], createdAt: Date.now() });
    }
    else if (goalLower.includes('fix') || goalLower.includes('debug') || goalLower.includes('repair')) {
      steps.push({ id: 'step_1', description: 'Identify the problem', status: 'pending', attempts: 0, maxAttempts: 2, dependencies: [], tools: ['shell', 'file_read'], createdAt: Date.now() });
      steps.push({ id: 'step_2', description: 'Analyze root cause', status: 'pending', attempts: 0, maxAttempts: 2, dependencies: ['step_1'], tools: ['shell', 'memory_recall'], createdAt: Date.now() });
      steps.push({ id: 'step_3', description: 'Implement fix', status: 'pending', attempts: 0, maxAttempts: 3, dependencies: ['step_2'], tools: ['file_write', 'shell'], createdAt: Date.now() });
      steps.push({ id: 'step_4', description: 'Verify fix works', status: 'pending', attempts: 0, maxAttempts: 2, dependencies: ['step_3'], tools: ['shell'], createdAt: Date.now() });
    }
    else if (goalLower.includes('review') || goalLower.includes('analyze') || goalLower.includes('audit')) {
      steps.push({ id: 'step_1', description: 'Gather information', status: 'pending', attempts: 0, maxAttempts: 2, dependencies: [], tools: ['shell', 'file_read'], createdAt: Date.now() });
      steps.push({ id: 'step_2', description: 'Perform analysis', status: 'pending', attempts: 0, maxAttempts: 2, dependencies: ['step_1'], tools: ['shell'], createdAt: Date.now() });
      steps.push({ id: 'step_3', description: 'Document findings', status: 'pending', attempts: 0, maxAttempts: 2, dependencies: ['step_2'], tools: ['file_write', 'memory_remember'], createdAt: Date.now() });
    }
    else if (goalLower.includes('deploy') || goalLower.includes('release')) {
      steps.push({ id: 'step_1', description: 'Verify build is clean', status: 'pending', attempts: 0, maxAttempts: 2, dependencies: [], tools: ['shell'], createdAt: Date.now() });
      steps.push({ id: 'step_2', description: 'Run tests', status: 'pending', attempts: 0, maxAttempts: 2, dependencies: ['step_1'], tools: ['shell'], createdAt: Date.now() });
      steps.push({ id: 'step_3', description: 'Deploy to target', status: 'pending', attempts: 0, maxAttempts: 2, dependencies: ['step_2'], tools: ['shell'], createdAt: Date.now() });
      steps.push({ id: 'step_4', description: 'Verify deployment', status: 'pending', attempts: 0, maxAttempts: 2, dependencies: ['step_3'], tools: ['shell', 'web_search'], createdAt: Date.now() });
    }
    else if (goalLower.includes('research') || goalLower.includes('investigate') || goalLower.includes('explore')) {
      steps.push({ id: 'step_1', description: 'Define research scope', status: 'pending', attempts: 0, maxAttempts: 1, dependencies: [], tools: [], createdAt: Date.now() });
      steps.push({ id: 'step_2', description: 'Search and gather sources', status: 'pending', attempts: 0, maxAttempts: 3, dependencies: ['step_1'], tools: ['web_search', 'shell'], createdAt: Date.now() });
      steps.push({ id: 'step_3', description: 'Synthesize findings', status: 'pending', attempts: 0, maxAttempts: 2, dependencies: ['step_2'], tools: ['memory_remember'], createdAt: Date.now() });
    }
    else {
      // Generic decomposition
      steps.push({ id: 'step_1', description: 'Understand the goal', status: 'pending', attempts: 0, maxAttempts: 2, dependencies: [], tools: [], createdAt: Date.now() });
      steps.push({ id: 'step_2', description: 'Execute plan', status: 'pending', attempts: 0, maxAttempts: 3, dependencies: ['step_1'], tools: ['shell', 'file_write', 'file_read'], createdAt: Date.now() });
      steps.push({ id: 'step_3', description: 'Verify result', status: 'pending', attempts: 0, maxAttempts: 2, dependencies: ['step_2'], tools: ['shell'], createdAt: Date.now() });
    }

    return steps;
  }

  /**
   * Get the next executable step (respects dependencies)
   */
  getNextStep(plan: Plan): PlanStep | null {
    for (const step of plan.steps) {
      if (step.status !== 'pending') continue;
      
      // Check dependencies
      const depsMet = step.dependencies.every(depId => {
        const dep = plan.steps.find(s => s.id === depId);
        return dep && (dep.status === 'completed' || dep.status === 'skipped');
      });

      if (depsMet) return step;
    }
    return null;
  }

  /**
   * Mark a step as in progress
   */
  startStep(plan: Plan, stepId: string): PlanStep | null {
    const step = plan.steps.find(s => s.id === stepId);
    if (!step || step.status !== 'pending') return null;

    step.status = 'in_progress';
    step.startedAt = Date.now();
    plan.status = 'executing';
    plan.startedAt = plan.startedAt || Date.now();

    return step;
  }

  /**
   * Complete a step successfully
   */
  completeStep(plan: Plan, stepId: string, result: string): PlanStep | null {
    const step = plan.steps.find(s => s.id === stepId);
    if (!step || step.status !== 'in_progress') return null;

    step.status = 'completed';
    step.result = result;
    step.completedAt = Date.now();
    step.actualDuration = step.completedAt - (step.startedAt || step.completedAt);

    // Update current step index
    const completedIndex = plan.steps.findIndex(s => s.id === stepId);
    plan.currentStepIndex = Math.max(plan.currentStepIndex, completedIndex + 1);

    // Check if plan is complete
    const pending = plan.steps.filter(s => s.status === 'pending');
    if (pending.length === 0) {
      this.finishPlan(plan, 'completed');
    }

    return step;
  }

  /**
   * Mark a step as failed
   */
  failStep(plan: Plan, stepId: string, error: string): PlanStep | null {
    const step = plan.steps.find(s => s.id === stepId);
    if (!step) return null;

    step.attempts++;
    step.error = error;

    if (step.attempts >= step.maxAttempts) {
      step.status = 'failed';
      step.completedAt = Date.now();

      // Try to self-correct: skip this step and continue if possible
      plan.selfCorrectionCount++;
      
      // Find next available step
      const next = this.getNextExecutableAfter(plan, stepId);
      if (next) {
        next.status = 'pending'; // Make it available
      }
    } else {
      // Retry: put back to pending
      step.status = 'pending';
      step.startedAt = undefined;
    }

    // If too many failures, abort
    const failedCount = plan.steps.filter(s => s.status === 'failed').length;
    if (failedCount > Math.ceil(plan.steps.length * 0.3)) {
      this.finishPlan(plan, 'failed');
    }

    return step;
  }

  /**
   * Skip a step (when it's not applicable)
   */
  skipStep(plan: Plan, stepId: string, reason: string): PlanStep | null {
    const step = plan.steps.find(s => s.id === stepId);
    if (!step || step.status !== 'pending') return null;

    step.status = 'skipped';
    step.result = `Skipped: ${reason}`;
    step.completedAt = Date.now();

    return step;
  }

  private getNextExecutableAfter(plan: Plan, afterStepId: string): PlanStep | null {
    const afterIndex = plan.steps.findIndex(s => s.id === afterStepId);
    
    for (let i = afterIndex + 1; i < plan.steps.length; i++) {
      const step = plan.steps[i];
      if (step.status !== 'pending') continue;
      
      const depsMet = step.dependencies.every(depId => {
        const dep = plan.steps.find(s => s.id === depId);
        return dep && (dep.status === 'completed' || dep.status === 'skipped');
      });

      if (depsMet) return step;
    }
    return null;
  }

  /**
   * Finish a plan
   */
  private finishPlan(plan: Plan, status: Plan['status']): void {
    plan.status = status;
    plan.completedAt = Date.now();
    plan.totalDuration = plan.completedAt - (plan.startedAt || plan.createdAt);

    this.planHistory.push(plan);
    this.activePlans.delete(plan.id);

    // Save to memory
    const outcome = status === 'completed' ? 'success' : status === 'failed' ? 'failed' : 'partial';
    const toolsUsed = plan.steps
      .filter(s => s.tools.length > 0)
      .flatMap(s => s.tools);

    this.memory.saveSession(
      plan.id,
      plan.goal,
      plan.steps.filter(s => s.result).map(s => s.result || ''),
      [...new Set(toolsUsed)],
      outcome,
      plan.totalDuration || 0
    );
  }

  /**
   * Get plan progress as a string
   */
  formatProgress(plan: Plan): string {
    const completed = plan.steps.filter(s => s.status === 'completed').length;
    const total = plan.steps.length;
    const pct = Math.round((completed / total) * 100);
    const bar = '█'.repeat(Math.floor(pct / 10)) + '░'.repeat(10 - Math.floor(pct / 10));

    let lines = [
      `Plan: ${plan.goal}`,
      `Progress: [${bar}] ${pct}% (${completed}/${total})`,
      `Status: ${plan.status}${plan.selfCorrectionCount > 0 ? ` (${plan.selfCorrectionCount} self-corrections)` : ''}`,
      '',
    ];

    for (const step of plan.steps) {
      const icon = step.status === 'completed' ? '✅' 
        : step.status === 'failed' ? '❌' 
        : step.status === 'in_progress' ? '🔄' 
        : step.status === 'skipped' ? '⏭️' : '⏳';
      
      const indent = step.status === 'in_progress' ? '  → ' : '    ';
      lines.push(`${indent}${icon} ${step.description}`);
      
      if (step.error && step.attempts > 0) {
        lines.push(`      ⚠️ Attempt ${step.attempts}/${step.maxAttempts}: ${step.error}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Abort an active plan
   */
  abortPlan(planId: string, reason: string): Plan | null {
    const plan = this.activePlans.get(planId);
    if (!plan) return null;

    plan.context.abortReason = reason;
    this.finishPlan(plan, 'aborted');
    return plan;
  }

  getPlan(planId: string): Plan | undefined {
    return this.activePlans.get(planId);
  }

  listActivePlans(): Plan[] {
    return [...this.activePlans.values()];
  }

  listHistory(limit: number = 20): Plan[] {
    return this.planHistory.slice(-limit);
  }
}

export default Planner;
