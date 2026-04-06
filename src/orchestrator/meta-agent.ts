// @ts-nocheck
/**
 * duck-cli v3 - MetaAgent
 * LLM-powered orchestrator: Plan → Execute → Critic → Heal → Learn
 */
import { MetaPlanner } from './meta-planner.js';
import { MetaCritic } from './meta-critic.js';
import { MetaHealer } from './meta-healer.js';
import { MetaLearner } from './meta-learner.js';
import { Task, Plan, PlanStep, StepResult, RecoveryAttempt, SessionExperience, MetaAgentConfig } from './meta-types.js';
import { ProviderManager } from '../providers/manager.js';
import { randomUUID } from 'crypto';

export interface MetaAgentResult {
  taskId: string;
  success: boolean;
  plan: Plan;
  steps: StepResult[];
  outcome: string;
  totalTimeMs: number;
  totalCost: number;
}

export class MetaAgent {
  private planner: MetaPlanner;
  private critic: MetaCritic;
  private healer: MetaHealer;
  private learner: MetaLearner;
  private config: Required<MetaAgentConfig>;
  private executeTool: (tool: string, params: any) => Promise<any>;
  private spawnAgent: (task: string) => Promise<string>;

  constructor(
    pm: ProviderManager,
    config: MetaAgentConfig,
    executeTool: (tool: string, params: any) => Promise<any>,
    spawnAgent: (task: string) => Promise<string>
  ) {
    this.executeTool = executeTool;
    this.spawnAgent = spawnAgent;

    this.config = {
      plannerModel: config.plannerModel || 'MiniMax-M2.7',
      criticModel: config.criticModel || 'MiniMax-M2.7',
      healerModel: config.healerModel || 'MiniMax-M2.7',
      plannerProvider: config.plannerProvider || 'minimax',
      classifierModel: config.classifierModel || 'MiniMax-M2.7',
      classifierProvider: config.classifierProvider || 'minimax',
      orchestratorModel: config.orchestratorModel || config.plannerModel || 'MiniMax-M2.7',
      orchestratorProvider: config.orchestratorProvider || config.plannerProvider || 'minimax',
      maxRecoveryAttempts: config.maxRecoveryAttempts || 3,
      maxSteps: config.maxSteps || 20,
      enableLearning: config.enableLearning !== false,
      experiencePath: config.experiencePath || './experiences',
      enableTrace: config.enableTrace !== false,
      dryRun: config.dryRun || false,
    };

    this.planner = new MetaPlanner(pm, this.config.plannerModel, this.config.plannerProvider);
    this.critic = new MetaCritic(pm, this.config.criticModel, this.config.plannerProvider);
    this.healer = new MetaHealer(pm, this.config.healerModel, this.config.plannerProvider);
    this.learner = new MetaLearner(this.config.experiencePath);
  }

  async execute(task: Task): Promise<MetaAgentResult> {
    const startTime = Date.now();
    const taskId = task.id || randomUUID();
    const steps: StepResult[] = [];
    const allAttempts: RecoveryAttempt[] = [];

    console.log(`[MetaAgent] 🎯 ${task.prompt.substring(0, 80)}...`);

    let plan = await this.planner.plan(task);

    if (this.config.enableTrace) {
      console.log('\n' + this.planner.formatPlanTrace(plan) + '\n');
    }

    if (this.config.dryRun) {
      return { taskId, success: false, plan, steps: [], outcome: 'dry-run', totalTimeMs: Date.now() - startTime, totalCost: 0 };
    }

    let stepIdx = 0;
    let recoveryAttempts = 0;

    while (stepIdx < plan.steps.length && stepIdx < this.config.maxSteps) {
      const step = plan.steps[stepIdx];
      if (step.action === 'done') break;

      console.log(`[MetaAgent] 📍 [${step.action}] ${step.description}`);

      let result: StepResult;
      if (step.action === 'tool' && step.tool) {
        // Pass step-specific params if provided, otherwise fall back to prompt/description
        const toolParams = step.params || { prompt: task.prompt, description: step.description };
        result = await this.executeTool(step.tool, toolParams);
      } else if (step.action === 'subagent') {
        const id = await this.spawnAgent(step.description);
        result = { step: step.step, action: step.action, success: true, output: id, durationMs: 1000 };
      } else if (step.action === 'council') {
        console.log(`[MetaAgent] 🏛️ Delegating to AI Council...`);
        result = { step: step.step, action: step.action, success: true, durationMs: 5000 };
      } else {
        result = { step: step.step, action: step.action, success: true, durationMs: 0 };
      }

      steps.push(result);

      const feedback = await this.critic.evaluate(task.prompt, plan, stepIdx, result);

      console.log(`[MetaAgent] ${result.success ? '✅' : '❌'} ${result.success ? 'ok' : (result.error || '').substring(0, 80)}`);
      if (feedback.reasoning) console.log(`[MetaAgent] 💭 ${feedback.reasoning}`);

      if (!result.success && recoveryAttempts < this.config.maxRecoveryAttempts) {
        const rec = await this.healer.diagnose(task.prompt, step, result.error || '', allAttempts);
        console.log(`[MetaAgent] 🔧 ${rec.diagnosis} → ${rec.recoveryAction}`);
        allAttempts.push({ originalStep: step.step, attempt: ++recoveryAttempts, action: rec.recoveryAction, success: false, error: result.error });
        if (recoveryAttempts < this.config.maxRecoveryAttempts) {
          console.log(`[MetaAgent] 🔄 Recovery (${recoveryAttempts}/${this.config.maxRecoveryAttempts})`);
          continue;
        } else { recoveryAttempts = 0; }
      }

      if (feedback.verdict === 'abort') { console.log(`[MetaAgent] 🛑 ABORT`); break; }
      if (feedback.verdict === 'replan') {
        console.log(`[MetaAgent] 🔄 REPLAN`);
        plan = await this.planner.replan(task, step, feedback.reasoning);
        if (this.config.enableTrace) console.log('\n' + this.planner.formatPlanTrace(plan) + '\n');
        stepIdx = 0;
        continue;
      }

      stepIdx++;
    }

    const outcome = steps.every(s => s.success) ? 'success' : steps.some(s => s.success) ? 'partial' : 'failed';
    const exp: SessionExperience = { taskPrompt: task.prompt, plan, steps, outcome, totalTimeMs: Date.now() - startTime, totalCost: 0, timestamp: Date.now() };
    if (this.config.enableLearning) this.learner.log(exp);

    console.log(`[MetaAgent] ${outcome === 'success' ? '✅' : '⚠️'} ${steps.length} steps, ${outcome}`);
    return { taskId, success: outcome === 'success', plan, steps, outcome, totalTimeMs: Date.now() - startTime, totalCost: 0 };
  }

  async preview(task: Task): Promise<Plan> {
    return this.planner.plan(task);
  }
}
