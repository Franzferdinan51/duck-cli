/**
 * duck-cli v2 - Hybrid Orchestrator
 * Task Complexity Classifier
 * Scores tasks 1-10 based on multiple dimensions
 */

export interface TaskContext {
  sessionId?: string;
  userId?: string;
  history?: TaskHistoryItem[];
  metadata?: Record<string, unknown>;
  userPreferences?: Record<string, unknown>;
  domain?: string;
}

export interface TaskHistoryItem {
  task: string;
  success: boolean;
  timestamp: number;
  modelUsed?: string;
}

export interface TaskDimensions {
  multiStep: boolean;
  hasTradeoffs: boolean;
  ethicalDimension: boolean;
  highStakes: boolean;
  ambiguous: boolean;
  externalDeps: boolean;
}

export interface TaskAnalysis {
  complexity: number; // 1-10
  needsCouncil: boolean;
  recommendedModel: string;
  reasoning: string;
  dimensions: TaskDimensions;
  urgency: 'low' | 'normal' | 'high' | 'critical';
  estimatedTimeMs: number;
  keywords: string[];
}

// Keywords that indicate high complexity
const MULTI_STEP_KEYWORDS = [
  'build', 'create', 'setup', 'configure', 'install', 'deploy', 'migrate',
  'refactor', 'implement', 'develop', 'design', 'architect', 'integrate',
  'automate', 'orchestrate', 'coordinate', 'sequence', 'workflow', 'pipeline',
];

const TRADEOFF_KEYWORDS = [
  'should', 'should i', 'better', 'compare', 'versus', 'vs', 'tradeoff',
  '权衡', '选择', '决定', 'recommend', 'suggestion', 'advice', 'pros', 'cons',
  'advantage', 'disadvantage', 'alternative', 'option', 'approach', 'strategy',
];

const ETHICAL_KEYWORDS = [
  'ethical', 'moral', 'bias', 'fair', 'discriminat', 'privacy', 'surveill',
  'consent', 'transparenc', 'accountab', 'responsible', 'safe', 'harm',
  'manipulat', 'deceive', 'honest', 'truth', 'correct', 'right', 'wrong',
  'legal', 'illegal', 'permit', 'allow', 'forbidden', 'should i allow',
];

const HIGH_STAKES_KEYWORDS = [
  'money', 'cost', 'expensive', 'cheap', 'budget', 'financial', 'payment',
  'security', 'hack', 'breach', 'vulnerab', 'exploit', 'attack', 'threat',
  'critical', 'production', 'live', 'deploy', 'destroy', 'delete', 'rm',
  'password', 'secret', 'credential', 'token', 'api key', 'auth',
  'database', 'migration', 'rollback', 'backup', 'restore',
];

const AMBIGUOUS_KEYWORDS = [
  'maybe', 'perhaps', 'might', 'could be', 'unsure', 'unclear', 'confused',
  'help', 'what if', 'how do i', 'i want', 'something', 'stuff', 'things',
  'it broke', 'not working', 'fix', 'issue', 'problem', 'error', 'failed',
  'weird', 'strange', 'unexpected', 'weird behavior', 'edge case',
];

const EXTERNAL_DEPS_KEYWORDS = [
  'api', 'http', 'request', 'fetch', 'curl', 'network', 'internet',
  'database', 'sql', 'mongo', 'redis', 'cache', 'storage', 'file',
  'service', 'microservice', 'server', 'client', 'browser', 'device',
  'android', 'ios', 'phone', 'tablet', 'computer', 'system',
  'github', 'npm', 'pypi', 'package', 'dependency', 'import', 'require',
];

// Keywords that indicate task type (for model routing)
const TASK_TYPE_KEYWORDS: Record<string, string[]> = {
  android: ['android', 'tap', 'swipe', 'click', 'scroll', 'input text', 'adb'],
  vision: ['screenshot', 'image', 'photo', 'picture', 'capture', 'screen', 'visual'],
  coding: ['code', 'function', 'class', 'api', 'implement', 'bug', 'fix', 'refactor'],
  reasoning: ['why', 'how', 'think', 'reason', 'explain', 'analyze', 'evaluate'],
  creative: ['write', 'story', 'poem', 'song', 'creative', 'art', 'design'],
  research: ['search', 'find', 'lookup', 'research', 'investigate', 'query'],
  system: ['shell', 'bash', 'exec', 'run', 'command', 'process', 'system'],
};

/**
 * Extract keywords from task string
 */
function extractKeywords(task: string): string[] {
  const normalized = task.toLowerCase();
  const allKeywords = [
    ...MULTI_STEP_KEYWORDS,
    ...TRADEOFF_KEYWORDS,
    ...ETHICAL_KEYWORDS,
    ...HIGH_STAKES_KEYWORDS,
    ...AMBIGUOUS_KEYWORDS,
    ...EXTERNAL_DEPS_KEYWORDS,
  ];

  return allKeywords.filter((kw) => normalized.includes(kw));
}

/**
 * Check if task matches keyword list
 */
function matchesKeywords(task: string, keywords: string[]): boolean {
  const normalized = task.toLowerCase();
  return keywords.some((kw) => normalized.includes(kw));
}

/**
 * Detect task type from keywords
 */
function detectTaskType(task: string, keywords: string[]): string | null {
  for (const [type, typeKeywords] of Object.entries(TASK_TYPE_KEYWORDS)) {
    if (matchesKeywords(task, typeKeywords)) {
      return type;
    }
  }
  return null;
}

/**
 * Calculate complexity score based on dimensions
 */
function calculateComplexity(dimensions: TaskDimensions): number {
  let score = 0;

  // Multi-step tasks: +3
  if (dimensions.multiStep) score += 3;

  // Has tradeoffs: +3
  if (dimensions.hasTradeoffs) score += 3;

  // Ethical dimension: +2
  if (dimensions.ethicalDimension) score += 2;

  // High stakes (money/security): +2
  if (dimensions.highStakes) score += 2;

  // Ambiguous intent: +2
  if (dimensions.ambiguous) score += 2;

  // External dependencies: +1
  if (dimensions.externalDeps) score += 1;

  // Clamp to 1-10
  return Math.max(1, Math.min(10, score));
}

/**
 * Determine if council is needed
 */
function determineNeedsCouncil(
  complexity: number,
  dimensions: TaskDimensions,
  context?: TaskContext
): boolean {
  // Always engage council for complexity >= 7
  if (complexity >= 7) return true;

  // Always engage council for ethical dimension
  if (dimensions.ethicalDimension) return true;

  // Consider high stakes with context
  if (dimensions.highStakes && complexity >= 5) return true;

  // Check user preferences in context
  if (context?.userPreferences?.['alwaysUseCouncil'] === true) return true;

  // Check history for repeated failures
  if (context?.history) {
    const recentFails = context.history.filter(
      (h) => !h.success && Date.now() - h.timestamp < 3600000 // Last hour
    );
    if (recentFails.length >= 3) return true;
  }

  return false;
}

/**
 * Recommend model based on task type and complexity
 */
function recommendModel(
  taskType: string | null,
  complexity: number,
  dimensions: TaskDimensions
): string {
  // Android tasks → Gemma 4 (specifically trained for Android tool-calling)
  if (taskType === 'android') {
    return 'lmstudio/google/gemma-4-e4b-it';
  }

  // Vision tasks → Kimi K2.5
  if (taskType === 'vision') {
    return 'kimi/kimi-k2.5';
  }

  // High complexity reasoning → MiniMax M2.7
  if (complexity >= 7 || dimensions.hasTradeoffs) {
    return 'minimax/MiniMax-M2.7';
  }

  // Coding tasks → GLM-5
  if (taskType === 'coding') {
    return 'minimax/glm-5';
  }

  // Premium (high stakes) → GPT-5.4
  if (dimensions.highStakes && complexity >= 5) {
    return 'openai-codex/gpt-5.4';
  }

  // Fast path for simple tasks → Qwen3.5-plus
  return 'minimax/qwen3.5-plus';
}

/**
 * Estimate execution time based on complexity
 */
function estimateTimeMs(complexity: number, dimensions: TaskDimensions): number {
  const baseTime = 500; // 500ms base

  // Add time based on complexity
  const complexityMultiplier = 1 + (complexity - 1) * 0.5;

  // Add time for external deps
  const depsMultiplier = dimensions.externalDeps ? 1.5 : 1;

  // Add time for multi-step
  const stepMultiplier = dimensions.multiStep ? 1.3 : 1;

  return Math.round(baseTime * complexityMultiplier * depsMultiplier * stepMultiplier);
}

/**
 * Determine urgency
 */
function determineUrgency(
  complexity: number,
  dimensions: TaskDimensions,
  context?: TaskContext
): 'low' | 'normal' | 'high' | 'critical' {
  if (dimensions.highStakes && (dimensions.hasTradeoffs || complexity >= 6)) {
    return 'critical';
  }

  if (dimensions.highStakes || complexity >= 7) {
    return 'high';
  }

  if (context?.metadata?.['urgent'] === true) {
    return 'high';
  }

  if (complexity <= 3) {
    return 'low';
  }

  return 'normal';
}

/**
 * Main complexity analysis function
 */
export function analyzeTask(task: string, context?: TaskContext): TaskAnalysis {
  const normalizedTask = task.toLowerCase();
  const keywords = extractKeywords(task);
  const taskType = detectTaskType(task, keywords);

  // Analyze each dimension
  const dimensions: TaskDimensions = {
    multiStep: matchesKeywords(task, MULTI_STEP_KEYWORDS),
    hasTradeoffs: matchesKeywords(task, TRADEOFF_KEYWORDS) || normalizedTask.includes('?'),
    ethicalDimension: matchesKeywords(task, ETHICAL_KEYWORDS),
    highStakes: matchesKeywords(task, HIGH_STAKES_KEYWORDS),
    ambiguous: matchesKeywords(task, AMBIGUOUS_KEYWORDS) || normalizedTask.includes('?'),
    externalDeps: matchesKeywords(task, EXTERNAL_DEPS_KEYWORDS),
  };

  // Calculate complexity score
  const complexity = calculateComplexity(dimensions);

  // Determine council need
  const needsCouncil = determineNeedsCouncil(complexity, dimensions, context);

  // Recommend model
  const recommendedModel = recommendModel(taskType, complexity, dimensions);

  // Estimate time
  const estimatedTimeMs = estimateTimeMs(complexity, dimensions);

  // Determine urgency
  const urgency = determineUrgency(complexity, dimensions, context);

  // Build reasoning string
  const dimensionReasons = Object.entries(dimensions)
    .filter(([, value]) => value)
    .map(([key]) => key)
    .join(', ');

  const reasoning = [
    `Task: "${task}"`,
    `Detected type: ${taskType ?? 'unknown'}`,
    `Dimensions: ${dimensionReasons || 'none'}`,
    `Complexity score: ${complexity}/10`,
    `Council needed: ${needsCouncil ? 'YES' : 'no'}`,
    `Recommended model: ${recommendedModel}`,
    `Estimated time: ${estimatedTimeMs}ms`,
  ].join('\n');

  return {
    complexity,
    needsCouncil,
    recommendedModel,
    reasoning,
    dimensions,
    urgency,
    estimatedTimeMs,
    keywords,
  };
}

/**
 * Quick complexity check (returns just the score)
 */
export function quickComplexity(task: string): number {
  return analyzeTask(task).complexity;
}

/**
 * Check if task needs council (fast path)
 */
export function needsCouncilQuick(task: string): boolean {
  return analyzeTask(task).needsCouncil;
}

/**
 * Get recommended model for task (fast path)
 */
export function getRecommendedModel(task: string): string {
  return analyzeTask(task).recommendedModel;
}

// ==================== Task Complexity Classifier Class ====================

export class TaskComplexityClassifier {
  private contextCache: Map<string, TaskContext> = new Map();
  private analysisHistory: Array<{ task: string; analysis: TaskAnalysis; timestamp: number }> = [];

  constructor(defaultContext?: TaskContext) {
    if (defaultContext) {
      this.contextCache.set('default', defaultContext);
    }
  }

  /**
   * Analyze a task with optional context
   */
  analyze(task: string, context?: TaskContext): TaskAnalysis {
    const mergedContext: TaskContext | undefined = context
      ? {
          ...this.contextCache.get('default'),
          ...context,
        }
      : this.contextCache.get('default');

    const analysis = analyzeTask(task, mergedContext);

    // Cache analysis
    this.analysisHistory.push({
      task,
      analysis,
      timestamp: Date.now(),
    });

    // Keep last 100 analyses
    if (this.analysisHistory.length > 100) {
      this.analysisHistory.shift();
    }

    return analysis;
  }

  /**
   * Quick complexity score
   */
  score(task: string): number {
    return this.analyze(task).complexity;
  }

  /**
   * Check if council is needed
   */
  shouldEngageCouncil(task: string, context?: TaskContext): boolean {
    return this.analyze(task, context).needsCouncil;
  }

  /**
   * Get recommended model
   */
  getModel(task: string, context?: TaskContext): string {
    return this.analyze(task, context).recommendedModel;
  }

  /**
   * Update default context
   */
  setDefaultContext(context: TaskContext): void {
    this.contextCache.set('default', context);
  }

  /**
   * Get analysis history
   */
  getHistory(count = 10): TaskAnalysis[] {
    return this.analysisHistory.slice(-count).map((h) => h.analysis);
  }

  /**
   * Clear history
   */
  clearHistory(): void {
    this.analysisHistory = [];
  }
}

// ==================== Factory ====================

let defaultClassifier: TaskComplexityClassifier | null = null;

export function getClassifier(): TaskComplexityClassifier {
  if (!defaultClassifier) {
    defaultClassifier = new TaskComplexityClassifier();
  }
  return defaultClassifier;
}

export function createClassifier(defaultContext?: TaskContext): TaskComplexityClassifier {
  return new TaskComplexityClassifier(defaultContext);
}
