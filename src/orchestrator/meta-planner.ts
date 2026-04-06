/**
 * duck-cli v3 - MetaPlanner
 * LLM-powered task planning. Given a task, the Planner LLM generates a structured execution plan.
 * Uses MiniMax M2.7 (fast, cheap) for reasoning calls.
 */

import { Task, Plan, PlanStep } from './meta-types.js';
import { ProviderManager } from '../providers/manager.js';

const PLANNER_SYSTEM = `You are duck-cli's Meta-Planner. Given a task, output a JSON execution plan.

Providers: minimax (fast), lmstudio/gemma-4-26b (local free), kimi (vision)
Tools: shell, file_read, file_write, web_search, desktop_screenshot/click/type, android_*, memory_*, spawn

Output JSON with fields:
{
  "complexity": 1-10,
  "approach": "single-step" | "multi-step" | "parallel" | "deliberate",
  "steps": [{step, action, description, tool, provider, model, parallel, dependsOn, estimatedTimeMs}],
  "provider": "minimax" | "lmstudio",
  "model": "MiniMax-M2.7" | "gemma-4-26b",
  "reasoning": "why this approach",
  "estimatedTotalTimeMs": 5000,
  "confidence": 0.8
}

Rules:
- complexity 1-3: single-step, minimax
- complexity 4-6: multi-step
- complexity 7+: parallel subagents or lmstudio
- parallel steps must NOT depend on each other
- NEVER plan more than 10 steps
- Output ONLY valid JSON, no markdown or explanation`;

export class MetaPlanner {
  private pm: ProviderManager;

  constructor(pm: ProviderManager) {
    this.pm = pm;
  }

  async plan(task: Task): Promise<Plan> {
    const context = this.buildContext(task);
    const fullPrompt = PLANNER_SYSTEM + '\n\nTask: ' + task.prompt + (context ? '\n\nContext: ' + context : '');

    let response: { text: string; provider: string; model: string };
    try {
      response = await this.pm.route(fullPrompt);
    } catch (e) {
      console.log('[MetaPlanner] ⚠️  Route failed:', e);
      return this.fallbackPlan(task);
    }

    try {
      const plan = JSON.parse(this.extractJSON(response.text)) as Plan;
      return this.validateAndEnrich(plan, task.id || 'unknown');
    } catch (e) {
      console.log('[MetaPlanner] ⚠️  Parse failed, using fallback');
      return this.fallbackPlan(task);
    }
  }

  async replan(task: Task, failedStep: PlanStep, feedback: string): Promise<Plan> {
    const prompt = PLANNER_SYSTEM +
      '\n\nTask: ' + task.prompt +
      '\nPrevious step failed: ' + failedStep.description +
      '\nFeedback: ' + feedback +
      '\n\nGenerate a NEW plan.';

    let response: { text: string; provider: string; model: string };
    try {
      response = await this.pm.route(prompt);
    } catch {
      return this.fallbackPlan(task);
    }

    try {
      const plan = JSON.parse(this.extractJSON(response.text)) as Plan;
      return this.validateAndEnrich(plan, task.id || 'unknown');
    } catch {
      return this.fallbackPlan(task);
    }
  }

  formatPlanTrace(plan: Plan): string {
    const lines: string[] = [
      '📋 EXECUTION PLAN (duck-cli v3 Meta-Agent)',
      `   Complexity: ${plan.complexity}/10 | Approach: ${plan.approach}`,
      `   Model: ${plan.provider}/${plan.model}`,
      `   Confidence: ${((plan.confidence || 0.8) * 100).toFixed(0)}%`,
      '',
      'Steps:',
    ];

    for (const step of plan.steps) {
      const prefix = step.parallel ? '  ↳' : `  ${step.step}.`;
      const depNote = step.dependsOn?.length ? ` (waits for ${step.dependsOn.join(', ')})` : '';
      const parNote = step.parallel ? ' [PARALLEL]' : '';
      lines.push(`${prefix} [${step.action}] ${step.description}${depNote}${parNote}`);
      if (step.tool) lines.push(`     tool: ${step.tool}`);
      if (step.provider) lines.push(`     provider: ${step.provider}`);
    }

    lines.push('');
    lines.push(`Reasoning: ${plan.reasoning}`);
    return lines.join('\n');
  }

  private buildContext(task: Task): string {
    if (!task.context) return '';
    const ctx = task.context;
    const parts: string[] = [];
    if (ctx.recentTask) parts.push(`Recent: "${ctx.recentTask}"`);
    if (ctx.memory) parts.push(`Memory: ${JSON.stringify(ctx.memory)}`);
    if (ctx.platform) parts.push(`Platform: ${ctx.platform}`);
    return parts.join('\n');
  }

  private extractJSON(text: string): string {
    const block = text.match(/```(?:json)?\s*(\{[\s\S]*?})\s*```/);
    if (block) return block[1];
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start >= 0 && end > start) return text.substring(start, end + 1);
    throw new Error('No JSON found');
  }

  private validateAndEnrich(plan: Plan, taskId: string): Plan {
    plan.taskId = taskId;
    plan.steps.forEach((s, i) => { s.step = i + 1; });
    plan.estimatedTotalTimeMs = plan.steps.reduce((sum, s) => sum + (s.estimatedTimeMs || 0), 0);
    plan.confidence = plan.confidence || 0.8;
    plan.complexity = Math.max(1, Math.min(10, plan.complexity || 5));
    return plan;
  }

  private fallbackPlan(task: Task): Plan {
    return {
      taskId: task.id || 'fallback',
      complexity: 5,
      approach: 'single-step',
      steps: [{ step: 1, action: 'tool', description: 'Run with MiniMax', provider: 'minimax', model: 'MiniMax-M2.7', estimatedTimeMs: 5000 }],
      provider: 'minimax',
      model: 'MiniMax-M2.7',
      reasoning: 'Fallback - simple single-step',
      estimatedTotalTimeMs: 5000,
      estimatedTotalCost: 0.001,
      parallelizable: false,
      confidence: 0.5,
    };
  }
}
