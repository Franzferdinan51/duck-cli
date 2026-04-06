/**
 * duck-cli v2 - Hybrid Orchestrator
 * Model Router - Routes tasks to appropriate models based on task type and analysis
 */

import { TaskAnalysis } from './task-complexity.js';

// Re-export Task from tool.js for convenience
export interface Task {
  id: string;
  type: string;
  description: string;
  intent: string;
  params?: Record<string, unknown>;
}

// ==================== Model Map ====================

export const MODEL_MAP = {
  // Android control - use the local LM Studio Gemma 4 path on this machine.
  // This keeps duck-cli's Android/control stack aligned with the standalone local runtime.
  android: 'lmstudio/gemma-4-e4b-it',

  // Vision tasks - Kimi K2.5 has best vision
  vision: 'kimi/kimi-k2.5',

  // Complex reasoning - MiniMax M2.7 is fast with good context
  reasoning: 'minimax/MiniMax-M2.7',

  // Fast tasks - Qwen3.5-plus for quick execution
  fast: 'minimax/qwen3.5-plus',

  // Premium reasoning - GPT-5.4 for highest quality
  premium: 'openai-codex/gpt-5.4',

  // Local fallback - Qwen 9B for local inference
  local: 'lmstudio/qwen/qwen3.5-9b',

  // Coding tasks - GLM-5 is optimized for code
  coding: 'minimax/glm-5',

  // Large context tasks - 1M context model
  longContext: 'minimax/qwen3.5-plus',

  // OpenRouter free tier
  free: 'qwen/qwen3.6-plus-preview:free',
} as const;

export type ModelType = keyof typeof MODEL_MAP;

// ==================== Routing Rules ====================

export interface RoutingRule {
  name: string;
  priority: number;
  match: (task: string, analysis: TaskAnalysis) => boolean;
  model: string;
  reason: string;
}

// Keyword-based routing rules
const KEYWORD_RULES: RoutingRule[] = [
  // Android rules (highest priority for Android tasks)
  {
    name: 'android_tap',
    priority: 100,
    match: (task) =>
      task.includes('android') ||
      task.includes('tap ') ||
      task.includes('swipe') ||
      task.includes('click ') ||
      (task.includes('adb') && !task.includes('screen')),
    model: MODEL_MAP.android,
    reason: 'Android control task - Gemma 4 has Android tool-calling training',
  },
  {
    name: 'android_screenshot',
    priority: 95,
    match: (task) =>
      (task.includes('android') || task.includes('adb')) && task.includes('screenshot'),
    model: MODEL_MAP.android,
    reason: 'Android screenshot - Gemma 4 vision + Android',
  },

  // Vision rules
  {
    name: 'vision_screenshot',
    priority: 90,
    match: (task) =>
      task.includes('screenshot') ||
      task.includes('screen cap') ||
      (task.includes('screen') && task.includes('capture')),
    model: MODEL_MAP.vision,
    reason: 'Screenshot analysis - Kimi K2.5 best for vision',
  },
  {
    name: 'vision_image',
    priority: 85,
    match: (task) =>
      task.includes('image') ||
      task.includes('photo') ||
      task.includes('picture') ||
      task.includes('visual'),
    model: MODEL_MAP.vision,
    reason: 'Image analysis - Kimi K2.5 vision',
  },

  // High complexity reasoning
  {
    name: 'complex_reasoning',
    priority: 80,
    match: (_, analysis) => analysis.complexity >= 8,
    model: MODEL_MAP.reasoning,
    reason: 'Complex reasoning task - MiniMax M2.7',
  },

  // Tradeoff decisions
  {
    name: 'tradeoff_decision',
    priority: 75,
    match: (_, analysis) => analysis.dimensions.hasTradeoffs,
    model: MODEL_MAP.reasoning,
    reason: 'Tradeoff analysis - MiniMax M2.7 for reasoning',
  },

  // High stakes tasks
  {
    name: 'high_stakes',
    priority: 70,
    match: (_, analysis) => analysis.dimensions.highStakes && analysis.complexity >= 5,
    model: MODEL_MAP.premium,
    reason: 'High stakes task - GPT-5.4 for best quality',
  },

  // Ethical dimension
  {
    name: 'ethical',
    priority: 65,
    match: (_, analysis) => analysis.dimensions.ethicalDimension,
    model: MODEL_MAP.premium,
    reason: 'Ethical task - GPT-5.4 for nuanced reasoning',
  },

  // Coding tasks
  {
    name: 'coding',
    priority: 60,
    match: (task) =>
      task.includes('code') ||
      task.includes('function') ||
      task.includes('class ') ||
      task.includes('api') ||
      task.includes('bug') ||
      task.includes('fix') ||
      task.includes('refactor'),
    model: MODEL_MAP.coding,
    reason: 'Coding task - GLM-5 optimized for code',
  },

  // Multi-step build tasks
  {
    name: 'build_task',
    priority: 55,
    match: (task) =>
      task.includes('build') ||
      task.includes('create') ||
      task.includes('implement') ||
      task.includes('develop'),
    model: MODEL_MAP.coding,
    reason: 'Build task - GLM-5 for code generation',
  },

  // Research tasks
  {
    name: 'research',
    priority: 50,
    match: (task) =>
      task.includes('research') ||
      task.includes('search') ||
      task.includes('find') ||
      task.includes('lookup') ||
      task.includes('investigate'),
    model: MODEL_MAP.reasoning,
    reason: 'Research task - MiniMax M2.7 for analysis',
  },

  // Ambiguous tasks need better reasoning
  {
    name: 'ambiguous',
    priority: 45,
    match: (_, analysis) => analysis.dimensions.ambiguous,
    model: MODEL_MAP.reasoning,
    reason: 'Ambiguous task - MiniMax M2.7 for clarification reasoning',
  },

  // External dependencies - might need better context handling
  {
    name: 'external_deps',
    priority: 40,
    match: (_, analysis) => analysis.dimensions.externalDeps,
    model: MODEL_MAP.fast,
    reason: 'External dependencies - Qwen3.5-plus for fast execution',
  },

  // Medium complexity
  {
    name: 'medium_complexity',
    priority: 30,
    match: (_, analysis) => analysis.complexity >= 5 && analysis.complexity < 8,
    model: MODEL_MAP.fast,
    reason: 'Medium complexity - Qwen3.5-plus balanced',
  },

  // Simple tasks - fast path
  {
    name: 'simple_task',
    priority: 10,
    match: (_, analysis) => analysis.complexity <= 3,
    model: MODEL_MAP.fast,
    reason: 'Simple task - Qwen3.5-plus for speed',
  },
];

// ==================== Model Router Class ====================

export interface RouterConfig {
  preferLocal?: boolean;
  preferFree?: boolean;
  costSensitive?: boolean;
  latencySensitive?: boolean;
  customRules?: RoutingRule[];
}

export interface RouteResult {
  model: string;
  reason: string;
  confidence: number;
  matchedRule: string | null;
  alternatives: Array<{ model: string; reason: string }>;
}

export class ModelRouter {
  private rules: RoutingRule[];
  private config: Required<RouterConfig>;

  constructor(config: RouterConfig = {}) {
    this.config = {
      preferLocal: config.preferLocal ?? false,
      preferFree: config.preferFree ?? false,
      costSensitive: config.costSensitive ?? false,
      latencySensitive: config.latencySensitive ?? false,
      customRules: config.customRules ?? [],
    };

    // Merge built-in rules with custom rules
    this.rules = [...this.config.customRules, ...KEYWORD_RULES].sort(
      (a, b) => b.priority - a.priority
    );
  }

  /**
   * Select the best model for a task
   */
  selectModel(task: string, analysis: TaskAnalysis): string {
    return this.route(task, analysis).model;
  }

  /**
   * Route task and get detailed result
   */
  route(task: string, analysis: TaskAnalysis): RouteResult {
    const normalizedTask = task.toLowerCase();
    const matchedRules: RoutingRule[] = [];

    // Find all matching rules
    for (const rule of this.rules) {
      if (rule.match(normalizedTask, analysis)) {
        matchedRules.push(rule);
      }
    }

    // No matches - use fast default
    if (matchedRules.length === 0) {
      return {
        model: MODEL_MAP.fast,
        reason: 'No matching rules - using fast default',
        confidence: 0.5,
        matchedRule: null,
        alternatives: [],
      };
    }

    // Get top match
    const topMatch = matchedRules[0];

    // Apply config modifiers
    let selectedModel = topMatch.model;

    // If preferLocal, try to use local model
    if (this.config.preferLocal && !selectedModel.includes('lmstudio')) {
      // Check if there's a local alternative
      const localAlternative = matchedRules.find((r) => r.model.includes('lmstudio'));
      if (localAlternative && analysis.complexity <= 5) {
        selectedModel = localAlternative.model;
      }
    }

    // If preferFree, try to use free tier
    if (this.config.preferFree && !selectedModel.includes('free')) {
      const freeAlternative = matchedRules.find((r) => r.model.includes('free'));
      if (freeAlternative && analysis.complexity <= 6) {
        selectedModel = freeAlternative.model;
      }
    }

    // Build alternatives list
    const alternatives = matchedRules
      .slice(1, 4)
      .map((r) => ({ model: r.model, reason: r.reason }));

    // Calculate confidence based on rule count and priority spread
    const confidence = this.calculateConfidence(matchedRules, analysis);

    return {
      model: selectedModel,
      reason: topMatch.reason,
      confidence,
      matchedRule: topMatch.name,
      alternatives,
    };
  }

  /**
   * Calculate routing confidence
   */
  private calculateConfidence(matchedRules: RoutingRule[], analysis: TaskAnalysis): number {
    if (matchedRules.length === 0) return 0.3;

    const topPriority = matchedRules[0].priority;
    const secondPriority = matchedRules[1]?.priority ?? 0;

    // High confidence if top rule has much higher priority
    const priorityGap = topPriority - secondPriority;
    let confidence = 0.7;

    if (priorityGap >= 30) confidence += 0.2;
    else if (priorityGap >= 15) confidence += 0.1;

    // Boost for clear dimension signals
    if (analysis.dimensions.multiStep) confidence += 0.05;
    if (analysis.dimensions.hasTradeoffs) confidence += 0.05;

    // Clamp to 0-1
    return Math.min(1, Math.max(0, confidence));
  }

  /**
   * Add custom routing rule
   */
  addRule(rule: RoutingRule): void {
    this.rules.push(rule);
    this.rules.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Get all matching rules for a task
   */
  getMatchingRules(task: string, analysis: TaskAnalysis): RoutingRule[] {
    const normalizedTask = task.toLowerCase();
    return this.rules.filter((rule) => rule.match(normalizedTask, analysis));
  }

  /**
   * Get model for a specific type
   */
  getModelForType(type: ModelType): string {
    return MODEL_MAP[type];
  }

  /**
   * Check if model is available
   */
  isModelAvailable(model: string): boolean {
    // In real implementation, would check model registry
    return Object.values(MODEL_MAP).includes(model as typeof MODEL_MAP[keyof typeof MODEL_MAP]);
  }

  /**
   * Get routing statistics
   */
  getStats(): {
    ruleCount: number;
    modelCount: number;
    topModels: Array<{ model: string; count: number }>;
  } {
    const modelCounts: Record<string, number> = {};
    for (const rule of this.rules) {
      modelCounts[rule.model] = (modelCounts[rule.model] ?? 0) + 1;
    }

    const topModels = Object.entries(modelCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([model, count]) => ({ model, count }));

    return {
      ruleCount: this.rules.length,
      modelCount: Object.keys(MODEL_MAP).length,
      topModels,
    };
  }
}

// ==================== Factory Functions ====================

let defaultRouter: ModelRouter | null = null;

export function getRouter(): ModelRouter {
  if (!defaultRouter) {
    defaultRouter = new ModelRouter();
  }
  return defaultRouter;
}

export function createRouter(config?: RouterConfig): ModelRouter {
  return new ModelRouter(config);
}

// ==================== Convenience Functions ====================

/**
 * Quick model selection
 */
export function selectModel(task: string, analysis: TaskAnalysis): string {
  return getRouter().selectModel(task, analysis);
}

/**
 * Get model by type
 */
export function getModel(type: ModelType): string {
  return MODEL_MAP[type];
}

/**
 * Check if task matches Android
 */
export function isAndroidTask(task: string): boolean {
  const normalized = task.toLowerCase();
  return (
    normalized.includes('android') ||
    normalized.includes('tap ') ||
    normalized.includes('swipe') ||
    normalized.includes('adb')
  );
}

/**
 * Check if task matches vision
 */
export function isVisionTask(task: string): boolean {
  const normalized = task.toLowerCase();
  return (
    normalized.includes('screenshot') ||
    normalized.includes('image') ||
    normalized.includes('photo') ||
    normalized.includes('visual')
  );
}
