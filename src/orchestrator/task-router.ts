/**
 * duck-cli v2 - Task Router
 * Routes tasks to appropriate tools based on capabilities and context
 */

import {
  Tool,
  Task,
  ToolParams,
  ToolResult,
  ExecutionContext,
  createBaseTool,
  createFallbackTool,
  FallbackTool,
} from './tool.js';
import { ToolRegistry, MatchResult } from './tool-registry.js';
import { ExecutionEngine, ExecutionOptions } from './execution-engine.js';

export interface RouterConfig {
  defaultTimeout?: number;
  maxRoutingDepth?: number;
  enableContextAware?: boolean;
  fallbackOnNoMatch?: boolean;
}

export interface RouteResult {
  taskId: string;
  success: boolean;
  toolName: string;
  tool?: Tool;
  matchScore: number;
  execution?: {
    result?: ToolResult;
    error?: string;
    totalTimeMs: number;
    fallbackAttempted: boolean;
  };
  routedVia?: string[];
  routingTimeMs: number;
}

export interface RoutingRule {
  name: string;
  match: {
    taskType?: string;
    intentContains?: string[];
    intentExcludes?: string[];
    contextKeys?: string[];
  };
  routeTo: {
    toolName?: string;
    toolPattern?: string;
    fallbackChain?: string[];
  };
  priority: number;
  enabled?: boolean;
}

export class TaskRouter {
  private registry: ToolRegistry;
  private engine: ExecutionEngine;
  private config: Required<RouterConfig>;
  private rules: RoutingRule[];
  private routingLog: Array<{
    taskId: string;
    timestamp: number;
    matches: MatchResult[];
    selected: string;
    reason: string;
  }>;

  constructor(
    registry: ToolRegistry,
    engine?: ExecutionEngine,
    config: RouterConfig = {}
  ) {
    this.registry = registry;
    this.engine = engine ?? new ExecutionEngine();
    this.config = {
      defaultTimeout: config.defaultTimeout ?? 30000,
      maxRoutingDepth: config.maxRoutingDepth ?? 5,
      enableContextAware: config.enableContextAware ?? true,
      fallbackOnNoMatch: config.fallbackOnNoMatch ?? true,
    };
    this.rules = [];
    this.routingLog = [];
  }

  /**
   * Add a routing rule
   */
  addRule(rule: RoutingRule): void {
    if (rule.enabled !== false) {
      rule.enabled = true;
    }
    this.rules.push(rule);
    this.rules.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Remove a routing rule
   */
  removeRule(name: string): boolean {
    const index = this.rules.findIndex((r) => r.name === name);
    if (index === -1) return false;
    this.rules.splice(index, 1);
    return true;
  }

  /**
   * Route a task to the appropriate tool and execute it
   */
  async routeAndExecute(
    task: Task,
    context: ExecutionContext,
    options: ExecutionOptions = {}
  ): Promise<RouteResult> {
    const startTime = Date.now();
    const routingStart = startTime;

    // Find best matching tool(s)
    const matches = this.registry.findBestTool(task);

    if (matches.length === 0) {
      // No match found - try to create a fallback or return error
      if (this.config.fallbackOnNoMatch) {
        return this.routeWithFallback(task, context, options, startTime);
      }

      return {
        taskId: task.id,
        success: false,
        toolName: 'none',
        matchScore: 0,
        routedVia: [],
        routingTimeMs: Date.now() - routingStart,
      };
    }

    const primaryMatch = matches[0];
    const routedVia: string[] = [primaryMatch.tool.name];

    // Check for routing rules that might override
    const ruleOverride = this.findRuleOverride(task);
    if (ruleOverride && ruleOverride.routeTo.toolName) {
      const ruleTool = this.registry.get(ruleOverride.routeTo.toolName);
      if (ruleTool) {
        const execution = await this.engine.execute(
          ruleTool,
          task.params,
          context,
          options
        );

        return {
          taskId: task.id,
          success: execution.success,
          toolName: ruleTool.name,
          tool: ruleTool,
          matchScore: 100, // Rule match is highest priority
          execution: {
            result: execution.result,
            error: execution.error,
            totalTimeMs: execution.totalTimeMs,
            fallbackAttempted: execution.fallbackAttempted,
          },
          routedVia: [ruleTool.name],
          routingTimeMs: Date.now() - routingStart,
        };
      }
    }

    // Execute primary tool
    const execution = await this.engine.execute(
      primaryMatch.tool,
      task.params,
      context,
      options
    );

    if (execution.success) {
      // Log successful route
      this.logRouting(task.id, matches, primaryMatch.tool.name, 'matched by capability score');

      return {
        taskId: task.id,
        success: true,
        toolName: primaryMatch.tool.name,
        tool: primaryMatch.tool,
        matchScore: primaryMatch.score,
        execution: {
          result: execution.result,
          totalTimeMs: execution.totalTimeMs,
          fallbackAttempted: execution.fallbackAttempted,
        },
        routedVia,
        routingTimeMs: Date.now() - routingStart,
      };
    }

    // Primary failed - try next best match if fallback is enabled
    if (options.fallbackEnabled !== false && matches.length > 1) {
      for (let i = 1; i < matches.length; i++) {
        routedVia.push(matches[i].tool.name);

        const altExecution = await this.engine.execute(
          matches[i].tool,
          task.params,
          context,
          { ...options, fallbackEnabled: false }
        );

        if (altExecution.success) {
          this.logRouting(
            task.id,
            matches,
            matches[i].tool.name,
            `fallback after ${primaryMatch.tool.name} failed`
          );

          return {
            taskId: task.id,
            success: true,
            toolName: matches[i].tool.name,
            tool: matches[i].tool,
            matchScore: matches[i].score,
            execution: {
              result: altExecution.result,
              totalTimeMs: altExecution.totalTimeMs,
              fallbackAttempted: true,
            },
            routedVia,
            routingTimeMs: Date.now() - routingStart,
          };
        }
      }
    }

    // All failed
    return {
      taskId: task.id,
      success: false,
      toolName: primaryMatch.tool.name,
      tool: primaryMatch.tool,
      matchScore: primaryMatch.score,
      execution: {
        result: execution.result,
        error: execution.error ?? 'All routes failed',
        totalTimeMs: execution.totalTimeMs,
        fallbackAttempted: execution.fallbackAttempted,
      },
      routedVia,
      routingTimeMs: Date.now() - routingStart,
    };
  }

  /**
   * Route a task without executing
   */
  route(task: Task): MatchResult[] {
    return this.registry.findBestTool(task);
  }

  /**
   * Find a rule that matches the task
   */
  private findRuleOverride(task: Task): RoutingRule | null {
    for (const rule of this.rules) {
      if (!rule.enabled) continue;

      // Check task type
      if (rule.match.taskType && rule.match.taskType !== task.type) {
        continue;
      }

      // Check intent includes
      if (rule.match.intentContains) {
        const intentLower = task.intent.toLowerCase();
        if (!rule.match.intentContains.some((kw) => intentLower.includes(kw.toLowerCase()))) {
          continue;
        }
      }

      // Check intent excludes
      if (rule.match.intentExcludes) {
        const intentLower = task.intent.toLowerCase();
        if (rule.match.intentExcludes.some((kw) => intentLower.includes(kw.toLowerCase()))) {
          continue;
        }
      }

      // Check context keys
      if (rule.match.contextKeys && task.context) {
        const hasAll = rule.match.contextKeys.every((key) => key in task.context!);
        if (!hasAll) continue;
      }

      return rule;
    }

    return null;
  }

  /**
   * Route with fallback when no match found
   */
  private async routeWithFallback(
    task: Task,
    context: ExecutionContext,
    options: ExecutionOptions,
    startTime: number
  ): Promise<RouteResult> {
    // Try to find any tool that can handle generic tasks
    const allTools = this.registry.getEnabledTools();
    const genericTools = allTools.filter(
      (t) =>
        t.capabilities.some(
          (c) =>
            c.keywords.some((k) => k.toLowerCase().includes('generic')) ||
            c.keywords.some((k) => k.toLowerCase().includes('fallback')) ||
            c.keywords.some((k) => k.toLowerCase().includes('default'))
        )
    );

    if (genericTools.length > 0) {
      const execution = await this.engine.execute(
        genericTools[0],
        task.params,
        context,
        options
      );

      return {
        taskId: task.id,
        success: execution.success,
        toolName: genericTools[0].name,
        tool: genericTools[0],
        matchScore: 0,
        execution: {
          result: execution.result,
          error: execution.error,
          totalTimeMs: execution.totalTimeMs,
          fallbackAttempted: true,
        },
        routedVia: [genericTools[0].name, 'fallback'],
        routingTimeMs: Date.now() - startTime,
      };
    }

    return {
      taskId: task.id,
      success: false,
      toolName: 'none',
      matchScore: 0,
      routedVia: [],
      routingTimeMs: Date.now() - startTime,
    };
  }

  /**
   * Log routing decision
   */
  private logRouting(
    taskId: string,
    matches: MatchResult[],
    selected: string,
    reason: string
  ): void {
    this.routingLog.push({
      taskId,
      timestamp: Date.now(),
      matches,
      selected,
      reason,
    });

    // Keep log size bounded
    if (this.routingLog.length > 1000) {
      this.routingLog.shift();
    }
  }

  /**
   * Get routing log
   */
  getRoutingLog(limit = 100): typeof this.routingLog {
    return this.routingLog.slice(-limit);
  }

  /**
   * Clear routing log
   */
  clearRoutingLog(): void {
    this.routingLog = [];
  }

  /**
   * Get routing statistics
   */
  getRoutingStats(): {
    totalRoutes: number;
    topTools: Array<{ name: string; count: number }>;
    avgMatchScore: number;
    fallbackRate: number;
  } {
    const toolCounts = new Map<string, number>();
    let totalScore = 0;
    let fallbackCount = 0;

    for (const entry of this.routingLog) {
      toolCounts.set(entry.selected, (toolCounts.get(entry.selected) ?? 0) + 1);
      totalScore += entry.matches[0]?.score ?? 0;
      if (entry.reason.includes('fallback')) {
        fallbackCount++;
      }
    }

    const topTools = Array.from(toolCounts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalRoutes: this.routingLog.length,
      topTools,
      avgMatchScore:
        this.routingLog.length > 0 ? totalScore / this.routingLog.length : 0,
      fallbackRate:
        this.routingLog.length > 0 ? fallbackCount / this.routingLog.length : 0,
    };
  }

  /**
   * Register built-in routing rules for common patterns
   */
  registerBuiltinRules(): void {
    // Android screenshot rule
    this.addRule({
      name: 'android_screenshot',
      match: {
        taskType: 'screenshot',
        intentContains: ['screenshot', 'screen capture', 'screen cap'],
      },
      routeTo: {
        toolName: 'android_screenshot',
      },
      priority: 100,
    });

    // LLM reasoning rule
    this.addRule({
      name: 'llm_reasoning',
      match: {
        taskType: 'reasoning',
        intentContains: ['reason', 'think', 'analyze', 'reasoning'],
      },
      routeTo: {
        toolPattern: 'llm_*',
      },
      priority: 90,
    });

    // File operation rules
    this.addRule({
      name: 'file_read',
      match: {
        taskType: 'read',
        intentContains: ['read', 'file', 'open', 'load'],
      },
      routeTo: {
        toolPattern: 'file_*',
      },
      priority: 80,
    });

    this.addRule({
      name: 'file_write',
      match: {
        taskType: 'write',
        intentContains: ['write', 'save', 'create', 'file'],
      },
      routeTo: {
        toolPattern: 'file_*',
      },
      priority: 80,
    });
  }
}

// Singleton factory
let defaultRouter: TaskRouter | null = null;

export function getRouter(): TaskRouter {
  if (!defaultRouter) {
    const registry = new ToolRegistry();
    defaultRouter = new TaskRouter(registry);
  }
  return defaultRouter;
}

export function createRouter(
  registry: ToolRegistry,
  engine?: ExecutionEngine,
  config?: RouterConfig
): TaskRouter {
  return new TaskRouter(registry, engine, config);
}
