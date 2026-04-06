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
  criticProvider?: string;     // Provider for critic (defaults to plannerProvider)
  healerProvider?: string;     // Provider for healer (defaults to plannerProvider)
  maxRecoveryAttempts?: number;
  maxSteps?: number;
  enableLearning?: boolean;
  experiencePath?: string;
  enableTrace?: boolean;
  dryRun?: boolean;
}

/**
 * FailureReport - unified failure record for duck-cli's self-healing pipeline.
 * All failure sources (tools, providers, channels, bridge, council, auto-heal)
 * feed into this type so they can be persisted, analyzed, and acted upon.
 */
export type FailureSource =
  | 'tool'           // Tool execution failed (shell, file_write, screenshot, etc.)
  | 'provider'        // AI provider failed (MiniMax, OpenAI, LM Studio, etc.)
  | 'telegram'        // Telegram channel error (polling, webhook, send failed)
  | 'bridge'          // Bridge/MCP/websocket error
  | 'council'         // AI Council deliberation failed
  | 'auto_heal'       // MetaHealer/MetaLearner recovery attempt failed
  | 'mesh'            // Mesh agent communication failure
  | 'internal';       // Unexpected internal error

export type FailureSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface FailureReport {
  /** Unique identifier for this failure */
  id: string;
  /** Which subsystem produced the failure */
  source: FailureSource;
  /** Human-readable error message */
  message: string;
  /** Stack trace or full error details */
  details?: string;
  /** Tool name if source === 'tool' */
  toolName?: string;
  /** Provider name if source === 'provider' */
  providerName?: string;
  /** Channel/target if applicable */
  channel?: string;
  /** Task prompt or context that triggered the failure */
  taskPrompt?: string;
  /** Severity level */
  severity: FailureSeverity;
  /** Whether auto-heal attempted and succeeded */
  autoHealed?: boolean;
  /** Healer diagnosis if MetaHealer was invoked */
  diagnosis?: string;
  /** Recovery action taken */
  recoveryAction?: string;
  /** Unix ms timestamp */
  timestamp: number;
  /** How many times this exact failure has occurred */
  occurrenceCount: number;
  /** Session or interaction ID if available */
  sessionId?: string;
  /** Tags for categorization */
  tags?: string[];
}
