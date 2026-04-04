/**
 * duck-cli v2 - Orchestrator Core
 * Main orchestrator with perceive → reason → act loop
 */

import {
  Tool,
  Task,
  TaskResult,
  ToolParams,
  ToolResult,
  ExecutionContext,
  createBaseTool,
  createFallbackTool,
  FallbackTool,
  AllToolsFailedError,
  ToolCapability,
} from './tool.js';
import { ToolRegistry, createRegistry, MatchResult } from './tool-registry.js';
import { FallbackManager, createFallbackManager } from './fallback-manager.js';
import { ExecutionEngine, createExecutionEngine } from './execution-engine.js';
import { TaskRouter, createRouter, RouterConfig, RouteResult } from './task-router.js';

export interface OrchestratorConfig {
  name?: string;
  version?: string;
  defaultTimeout?: number;
  maxConcurrentTasks?: number;
  enableMetrics?: boolean;
  routerConfig?: RouterConfig;
}

export interface OrchestratorMetrics {
  tasksProcessed: number;
  tasksSucceeded: number;
  tasksFailed: number;
  avgExecutionTimeMs: number;
  toolUsageCounts: Record<string, number>;
  fallbackUsageCounts: Record<string, number>;
  errorCounts: Record<string, number>;
}

export interface PerceptionResult {
  task: Task;
  confidence: number;
  matchedTools: MatchResult[];
  suggestedFallbacks: string[];
  context: Record<string, unknown>;
}

export interface ReasoningResult {
  selectedTool: Tool;
  selectedToolName: string;
  matchScore: number;
  fallbackChain: string[];
  executionPlan: string;
  reasoning: string;
}

export type OrchestratorPhase = 'idle' | 'perceiving' | 'reasoning' | 'acting' | 'recovering' | 'complete' | 'failed';

export type OrchestratorEventType =
  | 'phase_change'
  | 'task_start'
  | 'task_complete'
  | 'task_failed'
  | 'tool_selected'
  | 'fallback_triggered'
  | 'error';

export interface OrchestratorEvent {
  type: OrchestratorEventType;
  timestamp: number;
  phase?: OrchestratorPhase;
  taskId?: string;
  data?: Record<string, unknown>;
}

export type OrchestratorEventHandler = (event: OrchestratorEvent) => void;

export class OrchestratorCore {
  public name: string;
  public version: string;
  public phase: OrchestratorPhase;

  private registry: ToolRegistry;
  private fallbackManager: FallbackManager;
  private engine: ExecutionEngine;
  private router: TaskRouter;
  private config: Required<OrchestratorConfig>;

  private eventHandlers: Set<OrchestratorEventHandler>;
  private metrics: OrchestratorMetrics;
  private activeTasks: Map<string, Task>;

  constructor(config: OrchestratorConfig = {}) {
    this.name = config.name ?? 'duck-cli-orchestrator';
    this.version = config.version ?? '2.0.0';
    this.phase = 'idle';

    this.config = {
      name: this.name,
      version: this.version,
      defaultTimeout: config.defaultTimeout ?? 30000,
      maxConcurrentTasks: config.maxConcurrentTasks ?? 10,
      enableMetrics: config.enableMetrics ?? true,
      routerConfig: config.routerConfig ?? {},
    };

    this.registry = createRegistry();
    this.fallbackManager = createFallbackManager();
    this.engine = createExecutionEngine(this.fallbackManager);
    this.router = createRouter(this.registry, this.engine, this.config.routerConfig);

    this.eventHandlers = new Set();
    this.activeTasks = new Map();

    this.metrics = {
      tasksProcessed: 0,
      tasksSucceeded: 0,
      tasksFailed: 0,
      avgExecutionTimeMs: 0,
      toolUsageCounts: {},
      fallbackUsageCounts: {},
      errorCounts: {},
    };

    // Register built-in routing rules
    this.router.registerBuiltinRules();
  }

  // ==================== Event System ====================

  /**
   * Subscribe to orchestrator events
   */
  onEvent(handler: OrchestratorEventHandler): () => void {
    this.eventHandlers.add(handler);
    return () => this.eventHandlers.delete(handler);
  }

  /**
   * Emit an event to all handlers
   */
  private emit(event: OrchestratorEvent): void {
    for (const handler of this.eventHandlers) {
      try {
        handler(event);
      } catch {
        // Ignore handler errors
      }
    }
  }

  /**
   * Set the current phase
   */
  private setPhase(phase: OrchestratorPhase, data?: Record<string, unknown>): void {
    this.phase = phase;
    this.emit({
      type: 'phase_change',
      timestamp: Date.now(),
      phase,
      data,
    });
  }

  // ==================== Tool Management ====================

  /**
   * Register a tool with the orchestrator
   */
  registerTool(
    name: string,
    description: string,
    capabilities: ToolCapability[],
    handler: (params: ToolParams) => Promise<ToolResult>,
    category?: string
  ): Tool {
    const tool = this.registry.registerTool(name, description, capabilities, handler, category);
    this.emit({
      type: 'tool_selected',
      timestamp: Date.now(),
      data: { toolName: name, action: 'registered' },
    });
    return tool;
  }

  /**
   * Register a tool with fallback chain
   */
  registerToolWithFallbacks(
    name: string,
    description: string,
    capabilities: ToolCapability[],
    primaryHandler: (params: ToolParams) => Promise<ToolResult>,
    fallbacks: Array<{
      name: string;
      priority: number;
      handler: (params: ToolParams) => Promise<ToolResult>;
      reason?: string;
    }>,
    category?: string
  ): Tool {
    const tool = this.registry.registerTool(name, description, capabilities, primaryHandler, category);

    for (const fb of fallbacks) {
      const fallbackTool = createFallbackTool(fb.name, fb.reason ?? fb.name, fb.priority, fb.handler);
      this.registry.addFallback(name, fallbackTool);
    }

    return tool;
  }

  /**
   * Register a fallback for a tool
   */
  registerFallback(
    toolName: string,
    fallbackName: string,
    priority: number,
    handler: (params: ToolParams) => Promise<ToolResult>,
    reason?: string
  ): FallbackTool {
    return this.registry.registerFallback(toolName, fallbackName, priority, handler, reason);
  }

  /**
   * Get a registered tool
   */
  getTool(name: string): Tool | undefined {
    return this.registry.get(name);
  }

  /**
   * List all registered tools
   */
  listTools(): string[] {
    return this.registry.listTools();
  }

  // ==================== Core Loop: Perceive → Reason → Act ====================

  /**
   * Execute the perceive → reason → act loop for a single task
   */
  async execute(task: Task, context?: Partial<ExecutionContext>): Promise<TaskResult> {
    this.setPhase('perceiving', { taskId: task.id });
    this.activeTasks.set(task.id, task);

    this.emit({
      type: 'task_start',
      timestamp: Date.now(),
      taskId: task.id,
    });

    try {
      // Phase 1: PERCEIVE - Understand the task
      const perception = await this.perceive(task);

      // Phase 2: REASON - Select the best tool
      this.setPhase('reasoning', { taskId: task.id });
      const reasoning = await this.reason(task, perception);

      // Phase 3: ACT - Execute the selected tool
      this.setPhase('acting', { taskId: task.id });
      const actionResult = await this.act(task, reasoning, context);

      this.setPhase('complete', { taskId: task.id });

      this.emit({
        type: 'task_complete',
        timestamp: Date.now(),
        taskId: task.id,
        data: { result: actionResult },
      });

      // Update metrics
      if (this.config.enableMetrics) {
        this.updateMetrics(task.id, actionResult);
      }

      return actionResult;
    } catch (error) {
      return this.handleError(task, error, context);
    } finally {
      this.activeTasks.delete(task.id);
    }
  }

  /**
   * Execute multiple tasks concurrently
   */
  async executeBatch(
    tasks: Task[],
    context?: Partial<ExecutionContext>
  ): Promise<TaskResult[]> {
    const limitedTasks = tasks.slice(0, this.config.maxConcurrentTasks);
    return Promise.all(limitedTasks.map((task) => this.execute(task, context)));
  }

  /**
   * Phase 1: PERCEIVE - Understand and analyze the task
   */
  private async perceive(task: Task): Promise<PerceptionResult> {
    const matchedTools = this.registry.findBestTool(task, 10);

    // Calculate confidence based on match quality
    let confidence = 0;
    if (matchedTools.length > 0) {
      const topScore = matchedTools[0].score;
      const maxPossibleScore = 50; // Approximate max score
      confidence = Math.min(topScore / maxPossibleScore, 1);
    }

    // Suggest fallbacks based on top tool's fallbacks
    const suggestedFallbacks = matchedTools[0]?.tool.fallbacks.map((fb) => fb.name) ?? [];

    return {
      task,
      confidence,
      matchedTools,
      suggestedFallbacks,
      context: {
        matchCount: matchedTools.length,
        topScore: matchedTools[0]?.score ?? 0,
        hasExactMatch: matchedTools.some((m) => m.matchType === 'exact'),
      },
    };
  }

  /**
   * Phase 2: REASON - Select the best tool and plan execution
   */
  private async reason(task: Task, perception: PerceptionResult): Promise<ReasoningResult> {
    if (perception.matchedTools.length === 0) {
      throw new Error(`No tool found that can handle task: ${task.description}`);
    }

    const selected = perception.matchedTools[0];
    const fallbackChain = selected.tool.fallbacks.map((fb) => fb.name);

    const executionPlan = fallbackChain.length > 0
      ? `Execute ${selected.tool.name}, fallback to [${fallbackChain.join(' → ')}]`
      : `Execute ${selected.tool.name}`;

    const reasoning = `
Task: ${task.description}
Intent: ${task.intent}
Type: ${task.type}

Selected: ${selected.tool.name} (score: ${selected.score}, match: ${selected.matchType})
Matched capabilities: ${selected.matchedCapabilities.map((c) => c.name).join(', ') || 'none'}
${fallbackChain.length > 0 ? `Fallback chain: ${fallbackChain.join(' → ')}` : 'No fallbacks configured'}
Confidence: ${(perception.confidence * 100).toFixed(1)}%
`.trim();

    this.emit({
      type: 'tool_selected',
      timestamp: Date.now(),
      data: {
        taskId: task.id,
        toolName: selected.tool.name,
        score: selected.score,
        fallbackChain,
      },
    });

    return {
      selectedTool: selected.tool,
      selectedToolName: selected.tool.name,
      matchScore: selected.score,
      fallbackChain,
      executionPlan,
      reasoning,
    };
  }

  /**
   * Phase 3: ACT - Execute the selected tool with fallback support
   */
  private async act(
    task: Task,
    reasoning: ReasoningResult,
    context?: Partial<ExecutionContext>
  ): Promise<TaskResult> {
    const executionContext: ExecutionContext = {
      task,
      orchestrator: this,
      sessionId: context?.sessionId ?? this.generateSessionId(),
      userId: context?.userId,
      metadata: context?.metadata ?? {},
    };

    const routeResult = await this.router.routeAndExecute(task, executionContext);

    if (routeResult.success && routeResult.execution?.result) {
      return {
        taskId: task.id,
        success: true,
        result: routeResult.execution.result,
        fallbackAttempted: routeResult.execution.fallbackAttempted,
        toolsAttempted: routeResult.routedVia ?? [reasoning.selectedToolName],
        totalExecutionTimeMs: routeResult.execution.totalTimeMs,
      };
    }

    // Execution failed
    const errorMsg = routeResult.execution?.error ?? 'Tool execution failed';
    return {
      taskId: task.id,
      success: false,
      error: errorMsg,
      fallbackAttempted: routeResult.execution?.fallbackAttempted ?? false,
      toolsAttempted: routeResult.routedVia ?? [reasoning.selectedToolName],
      totalExecutionTimeMs: routeResult.execution?.totalTimeMs ?? 0,
    };
  }

  /**
   * Handle errors and attempt recovery
   */
  private async handleError(
    task: Task,
    error: unknown,
    context?: Partial<ExecutionContext>
  ): Promise<TaskResult> {
    this.setPhase('recovering', { taskId: task.id });

    const err = error instanceof Error ? error : new Error(String(error));

    this.emit({
      type: 'error',
      timestamp: Date.now(),
      taskId: task.id,
      data: { error: err.message },
    });

    // Check if this is an AllToolsFailedError
    if (error instanceof AllToolsFailedError) {
      return {
        taskId: task.id,
        success: false,
        error: `All tools failed: ${error.lastError.message}. Attempted: ${error.attemptedTools.join(', ')}`,
        fallbackAttempted: true,
        toolsAttempted: error.attemptedTools,
        totalExecutionTimeMs: 0,
      };
    }

    this.setPhase('failed', { taskId: task.id });

    this.emit({
      type: 'task_failed',
      timestamp: Date.now(),
      taskId: task.id,
      data: { error: err.message },
    });

    return {
      taskId: task.id,
      success: false,
      error: err.message,
      fallbackAttempted: false,
      toolsAttempted: [],
      totalExecutionTimeMs: 0,
    };
  }

  // ==================== Metrics & Monitoring ====================

  /**
   * Update metrics after task completion
   */
  private updateMetrics(taskId: string, result: TaskResult): void {
    this.metrics.tasksProcessed++;

    if (result.success) {
      this.metrics.tasksSucceeded++;
    } else {
      this.metrics.tasksFailed++;
    }

    // Track tool usage
    for (const toolName of result.toolsAttempted) {
      this.metrics.toolUsageCounts[toolName] =
        (this.metrics.toolUsageCounts[toolName] ?? 0) + 1;
    }

    // Track fallback usage
    if (result.fallbackAttempted && result.toolsAttempted.length > 1) {
      for (let i = 1; i < result.toolsAttempted.length; i++) {
        const fbTool = result.toolsAttempted[i];
        this.metrics.fallbackUsageCounts[fbTool] =
          (this.metrics.fallbackUsageCounts[fbTool] ?? 0) + 1;
      }
    }

    // Calculate running average
    const totalTime = this.metrics.avgExecutionTimeMs * (this.metrics.tasksProcessed - 1) +
      result.totalExecutionTimeMs;
    this.metrics.avgExecutionTimeMs = totalTime / this.metrics.tasksProcessed;
  }

  /**
   * Get current metrics
   */
  getMetrics(): OrchestratorMetrics {
    return { ...this.metrics };
  }

  /**
   * Get active task count
   */
  getActiveTaskCount(): number {
    return this.activeTasks.size;
  }

  // ==================== Utility ====================

  /**
   * Generate a session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  }

  /**
   * Get registry info
   */
  getRegistryInfo(): { toolCount: number; categoryCount: number; aliasCount: number } {
    return this.registry.getInfo();
  }

  /**
   * Get router stats
   */
  getRouterStats() {
    return this.router.getRoutingStats();
  }

  /**
   * Shutdown the orchestrator
   */
  async shutdown(): Promise<void> {
    this.activeTasks.clear();
    this.emit({
      type: 'phase_change',
      timestamp: Date.now(),
      phase: 'idle',
    });
  }
}

// ==================== Factory Functions ====================

let defaultOrchestrator: OrchestratorCore | null = null;

export function getOrchestrator(): OrchestratorCore {
  if (!defaultOrchestrator) {
    defaultOrchestrator = new OrchestratorCore();
  }
  return defaultOrchestrator;
}

export function createOrchestrator(config?: OrchestratorConfig): OrchestratorCore {
  return new OrchestratorCore(config);
}

// ==================== Example: Android Screenshot Tool ====================

export function createAndroidScreenshotTool(orchestrator: OrchestratorCore): void {
  // Primary: screencap
  const screencapHandler = async (params: ToolParams): Promise<ToolResult> => {
    // Simulated ADB screencap
    return {
      success: true,
      data: { method: 'screencap', path: '/sdcard/screen.png' },
      toolName: 'android_screencap',
      executionTimeMs: 500,
    };
  };

  // Fallback 1: screenrecord dump
  const screenrecordDumpHandler = async (params: ToolParams): Promise<ToolResult> => {
    // Simulated screenrecord
    return {
      success: true,
      data: { method: 'screenrecord_dump', path: '/sdcard/screen.png' },
      toolName: 'android_screenrecord_dump',
      executionTimeMs: 800,
    };
  };

  // Fallback 2: termux camera
  const termuxCameraHandler = async (params: ToolParams): Promise<ToolResult> => {
    // Simulated termux camera capture
    return {
      success: true,
      data: { method: 'termux_camera', path: '/sdcard/screen.png' },
      toolName: 'android_termux_camera',
      executionTimeMs: 1200,
    };
  };

  orchestrator.registerToolWithFallbacks(
    'android_screenshot',
    'Capture screenshot from Android device',
    [
      {
        name: 'screenshot',
        description: 'Capture screen from Android device',
        keywords: ['screenshot', 'screen capture', 'screen cap', 'android'],
      },
    ],
    screencapHandler,
    [
      { name: 'android_screenrecord_dump', priority: 2, handler: screenrecordDumpHandler, reason: 'screencap failed' },
      { name: 'android_termux_camera', priority: 3, handler: termuxCameraHandler, reason: 'screenrecord failed' },
    ],
    'android'
  );
}

// ==================== Example: LLM Reasoning Tool ====================

export function createLLMReasoningTool(orchestrator: OrchestratorCore): void {
  // Primary: LM Studio Gemma 4
  const gemmaHandler = async (params: ToolParams): Promise<ToolResult> => {
    return {
      success: true,
      data: { provider: 'lm_studio_gemma4', model: 'gemma-4-e4b-it' },
      toolName: 'llm_gemma4',
      executionTimeMs: 2000,
    };
  };

  // Fallback 1: LM Studio Qwen
  const qwenHandler = async (params: ToolParams): Promise<ToolResult> => {
    return {
      success: true,
      data: { provider: 'lm_studio_qwen', model: 'qwen3.5-9b' },
      toolName: 'llm_qwen',
      executionTimeMs: 1500,
    };
  };

  // Fallback 2: OpenAI
  const openaiHandler = async (params: ToolParams): Promise<ToolResult> => {
    return {
      success: true,
      data: { provider: 'openai', model: 'gpt-5.4' },
      toolName: 'llm_openai',
      executionTimeMs: 3000,
    };
  };

  orchestrator.registerToolWithFallbacks(
    'llm_reasoning',
    'Complex reasoning using LLM with fallback providers',
    [
      {
        name: 'reasoning',
        description: 'Complex reasoning and analysis',
        keywords: ['reason', 'think', 'analyze', 'reasoning', 'llm', 'ai', 'gemma', 'qwen', 'openai'],
      },
    ],
    gemmaHandler,
    [
      { name: 'llm_qwen', priority: 2, handler: qwenHandler, reason: 'Gemma 4 unavailable' },
      { name: 'llm_openai', priority: 3, handler: openaiHandler, reason: 'Qwen unavailable' },
    ],
    'llm'
  );
}
