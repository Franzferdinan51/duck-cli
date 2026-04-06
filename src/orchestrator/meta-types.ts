/**
 * duck-cli v3 - Meta-Agent Orchestrator Types
 * The orchestrator is itself an LLM-powered agent
 */

export interface Task {
  id: string;
  prompt: string;
  context?: Record<string, any>;
  createdAt: number;
}

export interface PlanStep {
  step: number;
  action: 'planner' | 'tool' | 'subagent' | 'council' | 'wait' | 'done';
  description: string;
  tool?: string;
  provider?: string;
  model?: string;
  parallel?: boolean;  // can this run in parallel with other steps?
  dependsOn?: number[];  // step numbers this depends on
  estimatedCost?: number;
  estimatedTimeMs?: number;
  /** Tool-specific parameters, e.g. { path, content } for file_write */
  params?: Record<string, any>;
}

export interface Plan {
  taskId: string;
  complexity: number;
  approach: string;  // "multi-step coding" / "simple lookup" / "parallel research"
  steps: PlanStep[];
  provider: string;
  model: string;
  reasoning: string;  // why this approach
  estimatedTotalTimeMs: number;
  estimatedTotalCost: number;
  parallelizable: boolean;
  confidence: number;  // 0-1, how confident the planner is
}

export interface StepResult {
  step: number;
  action: PlanStep['action'];
  success: boolean;
  output?: string;
  error?: string;
  durationMs: number;
  toolUsed?: string;
  provider?: string;
}

export interface CriticFeedback {
  stepIndex: number;
  verdict: 'proceed' | 'replan' | 'abort' | 'expand';
  reasoning: string;
  suggestions?: string[];
  shouldRecover?: boolean;
  recoverySuggestion?: string;
}

export interface RecoveryAttempt {
  originalStep: number;
  attempt: number;
  action: string;
  success: boolean;
  error?: string;
}

export interface SessionExperience {
  taskPrompt: string;
  plan: Plan;
  steps: StepResult[];
  outcome: 'success' | 'partial' | 'failed';
  totalTimeMs: number;
  totalCost: number;
  lessonsLearned?: string;
  timestamp: number;
}

export interface MetaAgentConfig {
  plannerModel?: string;
  criticModel?: string;
  healerModel?: string;
  classifierModel?: string;   // Model for task complexity classification (e.g. 'qwen3.5-0.8b' for local free)
  orchestratorModel?: string;   // Model for orchestration decisions (defaults to plannerModel)
  classifierProvider?: string;   // Provider for classifier (e.g. 'lmstudio' for local free)
  orchestratorProvider?: string; // Provider for orchestrator
  plannerProvider?: string;
  maxRecoveryAttempts?: number;
  maxSteps?: number;
  enableLearning?: boolean;
  experiencePath?: string;
  enableTrace?: boolean;
  dryRun?: boolean;
}
