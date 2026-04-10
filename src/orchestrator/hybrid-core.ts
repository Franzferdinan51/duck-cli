/**
 * duck-cli v2 - Hybrid Orchestrator
 * Hybrid Core - Smart routing orchestrator with complexity analysis, model selection, and council integration
 */

import {
  TaskComplexityClassifier,
  TaskAnalysis,
  TaskContext,
  analyzeTask,
  createClassifier,
  getClassifier,
} from './task-complexity.js';

import {
  ModelRouter,
  RouteResult,
  selectModel,
  createRouter,
  getRouter,
  isAndroidTask,
  isVisionTask,
} from './model-router.js';

import {
  CouncilBridge,
  CouncilRequest,
  CouncilResponse,
  createCouncilBridge,
  getCouncilBridge,
} from './council-bridge.js';

import {
  Tool,
  Task,
  TaskResult,
  ToolParams,
  ToolResult,
  ExecutionContext,
  createBaseTool,
  createFallbackTool,
  AllToolsFailedError,
} from './tool.js';

import { FallbackManager, createFallbackManager, getFallbackManager } from './fallback-manager.js';
import { getSkillCreator, SkillExecution } from '../skills/skill-creator.js';
import { getSkillImprover } from '../skills/skill-improver.js';

// ==================== Hybrid Orchestrator Types ====================

export interface HybridOrchestratorConfig {
  name?: string;
  version?: string;
  defaultTimeout?: number;
  maxConcurrentTasks?: number;
  enableCouncil?: boolean;
  councilTimeout?: number;
  enableMetrics?: boolean;
  fastPath?: boolean;
  routerConfig?: {
    preferLocal?: boolean;
    preferFree?: boolean;
    costSensitive?: boolean;
    latencySensitive?: boolean;
  };
}

export interface HybridResult {
  taskId: string;
  success: boolean;
  result?: ToolResult;
  error?: string;
  model: string;
  modelReason: string;
  councilVerdict?: 'approve' | 'reject' | 'conditional';
  councilReasoning?: string;
  complexity: number;
  executionTimeMs: number;
  fallbackAttempted: boolean;
  toolsAttempted: string[];
  fastPath: boolean;
  routingConfidence: number;
}

export interface HybridMetrics {
  tasksProcessed: number;
  tasksSucceeded: number;
  tasksFailed: number;
  councilEngagements: number;
  councilApprovals: number;
  councilRejections: number;
  fastPathCount: number;
  fallbackCount: number;
  avgExecutionTimeMs: number;
  modelUsageCounts: Record<string, number>;
  complexityDistribution: Record<number, number>;
}

// ==================== Hybrid Orchestrator Class ====================

export class HybridOrchestrator {
  public readonly name: string;
  public readonly version: string;

  private classifier: TaskComplexityClassifier;
  private modelRouter: ModelRouter;
  private councilBridge: CouncilBridge;
  private fallbackManager: FallbackManager;

  private config: Required<HybridOrchestratorConfig>;
  private metrics: HybridMetrics;
  private tools: Map<string, Tool>;
  private toolHandlers: Map<string, (params: ToolParams) => Promise<ToolResult>>;

  // Task history for autonomous skill creation (tracks recent tool sequences)
  private recentTasks: Array<{ task: string; toolName?: string; success: boolean; timestamp: number }> = [];
  private maxTaskHistory = 20;

  constructor(config: HybridOrchestratorConfig = {}) {
    this.name = config.name ?? 'duck-cli-hybrid';
    this.version = config.version ?? '2.0.0';

    this.config = {
      name: this.name,
      version: this.version,
      // DUCK_TIMEOUT_MS env var cascades to orchestrator so Telegram-triggered
      // tasks get enough time for complex operations (AI Council, multi-step agents).
      defaultTimeout: config.defaultTimeout ?? parseInt(process.env.DUCK_TIMEOUT_MS || '120000', 10),
      maxConcurrentTasks: config.maxConcurrentTasks ?? 10,
      enableCouncil: config.enableCouncil ?? true,
      councilTimeout: config.councilTimeout ?? parseInt(process.env.DUCK_TIMEOUT_MS || '120000', 10),
      enableMetrics: config.enableMetrics ?? true,
      fastPath: config.fastPath ?? true,
      routerConfig: config.routerConfig ?? {},
    };

    // Initialize components
    this.classifier = createClassifier();
    this.modelRouter = createRouter(this.config.routerConfig);
    this.councilBridge = createCouncilBridge({
      enabled: this.config.enableCouncil,
      timeout: this.config.councilTimeout,
    });
    this.fallbackManager = createFallbackManager();

    this.tools = new Map();
    this.toolHandlers = new Map();

    // Initialize metrics
    this.metrics = {
      tasksProcessed: 0,
      tasksSucceeded: 0,
      tasksFailed: 0,
      councilEngagements: 0,
      councilApprovals: 0,
      councilRejections: 0,
      fastPathCount: 0,
      fallbackCount: 0,
      avgExecutionTimeMs: 0,
      modelUsageCounts: {},
      complexityDistribution: {},
    };
  }

  // ==================== Tool Registration ====================

  /**
   * Register a tool with the orchestrator
   */
  registerTool(
    name: string,
    description: string,
    handler: (params: ToolParams) => Promise<ToolResult>
  ): void {
    const tool = createBaseTool({ name, description, capabilities: [], enabled: true }, handler);
    this.tools.set(name, tool);
    this.toolHandlers.set(name, handler);
  }

  /**
   * Register a tool with fallback chain
   */
  registerToolWithFallbacks(
    name: string,
    description: string,
    primaryHandler: (params: ToolParams) => Promise<ToolResult>,
    fallbacks: Array<{
      name: string;
      priority: number;
      handler: (params: ToolParams) => Promise<ToolResult>;
      reason?: string;
    }>
  ): void {
    const primaryTool = createBaseTool({ name, description, capabilities: [], enabled: true }, primaryHandler);

    // Add fallbacks
    for (const fb of fallbacks) {
      const fallbackTool = createFallbackTool(
        fb.name,
        fb.reason ?? fb.name,
        fb.priority,
        fb.handler
      );
      primaryTool.registerFallback(fallbackTool);
    }

    this.tools.set(name, primaryTool);
    this.toolHandlers.set(name, primaryHandler);
  }

  /**
   * Get a registered tool
   */
  getTool(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  /**
   * List all registered tools
   */
  listTools(): string[] {
    return Array.from(this.tools.keys());
  }

  // ==================== Main Execute Loop ====================

  /**
   * Execute a task with smart routing
   */
  async execute(
    task: string,
    context?: TaskContext & { params?: ToolParams }
  ): Promise<HybridResult> {
    const startTime = Date.now();
    const taskId = `hybrid_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // Step 1: Analyze complexity
    const analysis = this.classifier.analyze(task, context);

    // Track complexity distribution
    if (this.config.enableMetrics) {
      this.metrics.complexityDistribution[analysis.complexity] =
        (this.metrics.complexityDistribution[analysis.complexity] ?? 0) + 1;
    }

    let fastPath = false;
    let councilVerdict: 'approve' | 'reject' | 'conditional' | undefined;
    let councilReasoning: string | undefined;
    let model = analysis.recommendedModel;
    let modelReason = 'Based on task analysis';
    let routingConfidence = 0.7;

    // Step 2: Fast path for simple tasks
    if (this.config.fastPath && analysis.complexity <= 3 && !analysis.needsCouncil) {
      fastPath = true;
      if (this.config.enableMetrics) {
        this.metrics.fastPathCount++;
      }
    }

    // Step 3: Engage council for complex/ethical tasks
    if (analysis.needsCouncil && !fastPath) {
      if (this.config.enableMetrics) {
        this.metrics.councilEngagements++;
      }

      const councilResponse = await this.councilBridge.engage({
        task,
        context: context ?? {},
        perspectives: [],
        mode: analysis.urgency === 'critical' ? 'legislative' : 'deliberation',
        urgency: analysis.urgency,
      });

      councilVerdict = councilResponse.verdict;
      councilReasoning = councilResponse.reasoning;
      routingConfidence = councilResponse.confidence;

      // Track council metrics
      if (this.config.enableMetrics) {
        if (councilVerdict === 'approve') this.metrics.councilApprovals++;
        if (councilVerdict === 'reject') this.metrics.councilRejections++;
      }

      // If council rejects, fail fast
      if (councilVerdict === 'reject') {
        return {
          taskId,
          success: false,
          error: `Council rejected: ${councilReasoning}`,
          model,
          modelReason: 'Council rejection - no execution',
          councilVerdict,
          councilReasoning,
          complexity: analysis.complexity,
          executionTimeMs: Date.now() - startTime,
          fallbackAttempted: false,
          toolsAttempted: [],
          fastPath,
          routingConfidence,
        };
      }

      // If conditional, add council recommendations to context
      if (councilVerdict === 'conditional' && councilResponse.recommendations.length > 0) {
        context = {
          ...context,
          metadata: {
            ...context?.metadata,
            councilRecommendations: councilResponse.recommendations,
          },
        };
      }
    }

    // Step 4: Route to appropriate model
    if (!fastPath) {
      const routeResult = this.modelRouter.route(task, analysis);
      model = routeResult.model;
      modelReason = routeResult.reason;
      routingConfidence = routeResult.confidence;
    }

    // Track model usage
    if (this.config.enableMetrics) {
      this.metrics.modelUsageCounts[model] = (this.metrics.modelUsageCounts[model] ?? 0) + 1;
    }

    // Step 5: Execute with selected model (simulated execution)
    // In real implementation, this would call the model via provider API
    let result: ToolResult;
    let fallbackAttempted = false;
    let toolsAttempted: string[] = [];

    try {
      // Find appropriate tool handler
      const handler = this.findBestToolHandler(task);

      if (handler) {
        const execContext: ExecutionContext = {
          task: {
            id: taskId,
            type: this.detectTaskType(task),
            description: task,
            intent: task,
            params: context?.params,
          },
          orchestrator: this as unknown as Tool,
          sessionId: context?.sessionId ?? taskId,
          userId: context?.userId,
          metadata: {
            model,
            modelReason,
            analysis,
            ...context?.metadata,
          },
        };

        // Execute with fallback support
        const primaryTool = handler.tool;
        try {
          result = await this.fallbackManager.executeWithFallback(
            primaryTool,
            context?.params ?? {},
            execContext
          );
          toolsAttempted = [primaryTool.name];
          fallbackAttempted = result.toolName !== primaryTool.name;
        } catch (error) {
          // All fallbacks failed
          if (error instanceof AllToolsFailedError) {
            throw error;
          }
          throw error;
        }
      } else {
        // No tool found - simulate execution with selected model
        result = await this.simulateExecution(task, model, context?.params);
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));

      if (error instanceof AllToolsFailedError) {
        return {
          taskId,
          success: false,
          error: `All tools failed: ${err.message}`,
          model,
          modelReason,
          councilVerdict,
          councilReasoning,
          complexity: analysis.complexity,
          executionTimeMs: Date.now() - startTime,
          fallbackAttempted: true,
          toolsAttempted: error.attemptedTools,
          fastPath,
          routingConfidence,
        };
      }

      return {
        taskId,
        success: false,
        error: err.message,
        model,
        modelReason,
        councilVerdict,
        councilReasoning,
        complexity: analysis.complexity,
        executionTimeMs: Date.now() - startTime,
        fallbackAttempted,
        toolsAttempted,
        fastPath,
        routingConfidence,
      };
    }

    // Update metrics
    if (this.config.enableMetrics) {
      this.metrics.tasksProcessed++;
      if (result.success) {
        this.metrics.tasksSucceeded++;
      } else {
        this.metrics.tasksFailed++;
      }
      if (fallbackAttempted) {
        this.metrics.fallbackCount++;
      }

      // Running average
      const execTime = Date.now() - startTime;
      const totalTime =
        this.metrics.avgExecutionTimeMs * (this.metrics.tasksProcessed - 1) + execTime;
      this.metrics.avgExecutionTimeMs = totalTime / this.metrics.tasksProcessed;

      // Record for autonomous skill creation & improvement
      if (result.success) {
        const toolName = typeof result.toolName === 'string' ? result.toolName : undefined;
        if (toolName) {
          // Add to recent task history
          this.recentTasks.push({ task, toolName, success: true, timestamp: Date.now() });
          if (this.recentTasks.length > this.maxTaskHistory) {
            this.recentTasks.shift();
          }

          // Check for skill creation opportunity (every 5 successful tool tasks)
          const toolTasks = this.recentTasks.filter(t => t.toolName);
          if (toolTasks.length >= 5 && toolTasks.length % 5 === 0) {
            const sequence = toolTasks.slice(-10).map(t => t.toolName!);
            const skillCreator = getSkillCreator();
            skillCreator.recordExecution(task, sequence, true, execTime);

            // Check if any patterns are ready
            const ready = skillCreator.getReadyPatterns();
            if (ready.length > 0) {
              console.log(`\n🎯 SkillCreator: ${ready.length} pattern(s) ready for skill creation`);
              // Async - don't await, let it run in background
              ready.forEach(p => skillCreator.createSkillForPattern(p.pattern).catch(() => {}));
            }
          }

          // Record for skill improvement
          const improver = getSkillImprover();
          improver.recordExecution(toolName, task, true, execTime);
        }
      } else if (result.toolName) {
        // Record failure for skill improvement
        const improver = getSkillImprover();
        improver.recordExecution(result.toolName, task, false, execTime, result.error);
      }
    }

    return {
      taskId,
      success: result.success,
      result,
      model,
      modelReason,
      councilVerdict,
      councilReasoning,
      complexity: analysis.complexity,
      executionTimeMs: Date.now() - startTime,
      fallbackAttempted,
      toolsAttempted,
      fastPath,
      routingConfidence,
    };
  }

  /**
   * Execute batch of tasks
   */
  async executeBatch(
    tasks: Array<{ task: string; context?: TaskContext }>,
    maxConcurrency = 5
  ): Promise<HybridResult[]> {
    const limited = tasks.slice(0, maxConcurrency);
    return Promise.all(limited.map(({ task, context }) => this.execute(task, context)));
  }

  // ==================== Helper Methods ====================

  /**
   * Find the best tool handler for a task
   */
  private findBestToolHandler(task: string): { tool: Tool; score: number } | null {
    const normalizedTask = task.toLowerCase();
    let bestMatch: { tool: Tool; score: number } | null = null;

    for (const [name, tool] of this.tools) {
      const score = this.calculateToolMatchScore(name, tool, normalizedTask);
      if (score > 0 && (!bestMatch || score > bestMatch.score)) {
        bestMatch = { tool, score };
      }
    }

    return bestMatch;
  }

  /**
   * Calculate tool match score
   */
  private calculateToolMatchScore(name: string, tool: Tool, task: string): number {
    let score = 0;
    const normalizedName = name.toLowerCase();
    const normalizedDesc = tool.description.toLowerCase();

    // Exact name match
    if (normalizedName === task) {
      score += 50;
    } else if (normalizedName.includes(task) || task.includes(normalizedName)) {
      score += 25;
    }

    // Description contains task keywords
    const taskWords = task.split(/\s+/);
    for (const word of taskWords) {
      if (word.length > 3 && normalizedDesc.includes(word)) {
        score += 5;
      }
    }

    // Android-specific scoring
    if (isAndroidTask(task)) {
      if (normalizedName.includes('android') || normalizedName.includes('tap')) {
        score += 20;
      }
    }

    // Vision-specific scoring
    if (isVisionTask(task)) {
      if (normalizedName.includes('screenshot') || normalizedName.includes('image')) {
        score += 20;
      }
    }

    return score;
  }

  /**
   * Detect task type
   */
  private detectTaskType(task: string): string {
    const normalized = task.toLowerCase();

    if (isAndroidTask(normalized)) return 'android';
    if (isVisionTask(normalized)) return 'vision';
    if (normalized.includes('code') || normalized.includes('function')) return 'coding';
    if (normalized.includes('?')) return 'reasoning';

    return 'general';
  }

  /**
   * Simulate execution with selected model
   */
  private async simulateExecution(
    task: string,
    model: string,
    params?: ToolParams
  ): Promise<ToolResult> {
    // In real implementation, this would call the actual model API
    // For now, simulate execution time based on model
    const baseTime = model.includes('lmstudio') ? 100 : 500;
    const variance = Math.random() * 200;
    await new Promise((resolve) => setTimeout(resolve, baseTime + variance));

    return {
      success: true,
      data: {
        model,
        task,
        params,
        simulated: true,
        message: `Executed with ${model}`,
      },
      toolName: 'simulated',
      executionTimeMs: baseTime + variance,
    };
  }

  // ==================== Metrics & Monitoring ====================

  /**
   * Get current metrics
   */
  getMetrics(): HybridMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      tasksProcessed: 0,
      tasksSucceeded: 0,
      tasksFailed: 0,
      councilEngagements: 0,
      councilApprovals: 0,
      councilRejections: 0,
      fastPathCount: 0,
      fallbackCount: 0,
      avgExecutionTimeMs: 0,
      modelUsageCounts: {},
      complexityDistribution: {},
    };
  }

  /**
   * Get component status
   */
  getStatus(): {
    name: string;
    version: string;
    tools: number;
    councilEnabled: boolean;
    fastPathEnabled: boolean;
    metrics: HybridMetrics;
  } {
    return {
      name: this.name,
      version: this.version,
      tools: this.tools.size,
      councilEnabled: this.councilBridge.isEnabled(),
      fastPathEnabled: this.config.fastPath,
      metrics: this.getMetrics(),
    };
  }

  // ==================== Configuration ====================

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<HybridOrchestratorConfig>): void {
    Object.assign(this.config, updates);

    // Update council bridge if needed
    if (updates.enableCouncil !== undefined) {
      this.councilBridge.setEnabled(updates.enableCouncil);
    }

    if (updates.councilTimeout !== undefined) {
      this.councilBridge.updateConfig({ timeout: updates.councilTimeout });
    }
  }

  /**
   * Get configuration
   */
  getConfig(): Readonly<Required<HybridOrchestratorConfig>> {
    return { ...this.config };
  }

  /**
   * Enable/disable fast path
   */
  setFastPath(enabled: boolean): void {
    this.config.fastPath = enabled;
  }

  /**
   * Enable/disable council
   */
  setCouncilEnabled(enabled: boolean): void {
    this.councilBridge.setEnabled(enabled);
  }
}

// ==================== Factory Functions ====================

let defaultOrchestrator: HybridOrchestrator | null = null;

export function getHybridOrchestrator(): HybridOrchestrator {
  if (!defaultOrchestrator) {
    defaultOrchestrator = new HybridOrchestrator();
  }
  return defaultOrchestrator;
}

export function createHybridOrchestrator(config?: HybridOrchestratorConfig): HybridOrchestrator {
  return new HybridOrchestrator(config);
}

// ==================== Convenience Functions ====================

/**
 * Quick execute with default orchestrator
 */
export async function executeHybrid(
  task: string,
  context?: TaskContext
): Promise<HybridResult> {
  return getHybridOrchestrator().execute(task, context);
}

/**
 * Quick complexity analysis
 */
export function analyze(task: string, context?: TaskContext): TaskAnalysis {
  return analyzeTask(task, context);
}

/**
 * Quick model selection
 */
export function route(task: string): { model: string; reason: string; confidence: number } {
  const analysis = analyzeTask(task);
  const router = getRouter();
  const result = router.route(task, analysis);
  return {
    model: result.model,
    reason: result.reason,
    confidence: result.confidence,
  };
}

// ==================== Usage Example ====================

/**
 * Example usage:
 *
 * ```typescript
 * import {
 *   createHybridOrchestrator,
 *   HybridOrchestrator,
 *   HybridResult,
 * } from './hybrid-core';
 *
 * // Create orchestrator
 * const orchestrator = createHybridOrchestrator({
 *   enableCouncil: true,
 *   fastPath: true,
 * });
 *
 * // Register tools
 * orchestrator.registerTool(
 *   'android_tap',
 *   'Tap on Android screen',
 *   async (params) => ({
 *     success: true,
 *     data: { x: params.x, y: params.y },
 *     toolName: 'android_tap',
 *     executionTimeMs: 200,
 *   })
 * );
 *
 * // Simple task - fast path
 * const result1 = await orchestrator.execute('open settings');
 * // Result: { fastPath: true, model: 'minimax/qwen3.5-plus', ... }
 *
 * // Android task - routes to Gemma 4
 * const result2 = await orchestrator.execute('tap the settings button');
 * // Result: { model: 'lmstudio/google/gemma-4-e4b-it', ... }
 *
 * // Complex task - engages council
 * const result3 = await orchestrator.execute('should I upgrade this dependency?');
 * // Result: { needsCouncil: true, councilVerdict: 'approve', ... }
 *
 * // Get metrics
 * console.log(orchestrator.getMetrics());
 * ```
 */

// ==================== Backward Compatibility ====================

// Export types for easier consumption
export type {
  TaskComplexityClassifier,
  TaskAnalysis,
  TaskContext,
} from './task-complexity.js';

export type {
  ModelRouter,
  RouteResult,
  RouterConfig,
  ModelType,
} from './model-router.js';

export type {
  CouncilBridge,
  CouncilRequest,
  CouncilResponse,
  CouncilMode,
  CouncilPerspective,
  CouncilVote,
  CouncilBridgeConfig,
} from './council-bridge.js';
