/**
 * duck-cli v2 - Execution Engine
 * Handles tool execution with retries, timeouts, and error recovery
 */

import {
  Tool,
  Task,
  ToolParams,
  ToolResult,
  RetryConfig,
  ExecutionContext,
  AllToolsFailedError,
  FallbackChain,
} from './tool.js';
import { FallbackManager } from './fallback-manager.js';
import { getFailureReporter } from './failure-reporter.js';

export interface ExecutionOptions {
  timeout?: number;
  retries?: RetryConfig;
  fallbackEnabled?: boolean;
  fallbackStrategy?: string;
  onProgress?: (progress: ExecutionProgress) => void;
}

export interface ExecutionProgress {
  phase: 'preparing' | 'executing' | 'retrying' | 'fallback' | 'completed' | 'failed';
  toolName: string;
  attempt: number;
  maxAttempts: number;
  error?: string;
  result?: ToolResult;
}

export interface ExecutionSummary {
  success: boolean;
  toolName: string;
  result?: ToolResult;
  error?: string;
  totalAttempts: number;
  totalTimeMs: number;
  fallbackAttempted: boolean;
  fallbackChain?: string[];
  retryAttempts: number;
  lastError?: string;
}

export class ExecutionEngine {
  private fallbackManager: FallbackManager;
  private defaultTimeout: number;
  private defaultRetries: RetryConfig;

  constructor(fallbackManager?: FallbackManager) {
    this.fallbackManager = fallbackManager ?? new FallbackManager();
    // Allow DUCK_TIMEOUT_MS env var to override default (for Telegram/long tasks).
    // Default 120s gives complex orchestrated tasks (AI Council, multi-step agents)
    // enough time without hitting Telegram's 5-min outer timeout.
    const envTimeout = parseInt(process.env.DUCK_TIMEOUT_MS || '0', 10);
    this.defaultTimeout = envTimeout > 0 ? envTimeout : 120000;
    this.defaultRetries = {
      maxAttempts: 3,
      initialDelayMs: 1000,
      maxDelayMs: 10000,
      backoffMultiplier: 2,
    };
  }

  /**
   * Execute a tool with retries and fallback support
   */
  async execute(
    tool: Tool,
    params: ToolParams,
    context: ExecutionContext,
    options: ExecutionOptions = {}
  ): Promise<ExecutionSummary> {
    const startTime = Date.now();
    const timeout = options.timeout ?? tool.timeout ?? this.defaultTimeout;
    const retries = options.retries ?? tool.retryConfig ?? this.defaultRetries;
    const useFallback = options.fallbackEnabled ?? true;
    const fallbackStrategy = options.fallbackStrategy ?? 'priority';

    let totalAttempts = 0;
    let retryAttempts = 0;
    let lastError: Error | undefined;
    let fallbackAttempted = false;
    let fallbackChain: string[] = [];

    const reportProgress = (progress: ExecutionProgress) => {
      options.onProgress?.(progress);
    };

    // Try with retries first
    let attempt = 0;
    let delay = retries.initialDelayMs;

    while (attempt < retries.maxAttempts) {
      totalAttempts++;
      attempt++;

      reportProgress({
        phase: attempt > 1 ? 'retrying' : 'executing',
        toolName: tool.name,
        attempt,
        maxAttempts: retries.maxAttempts,
      });

      try {
        const result = await Promise.race([
          tool.execute(params),
          this.createTimeout(tool.name, timeout),
        ]);

        if (result.success) {
          reportProgress({
            phase: 'completed',
            toolName: tool.name,
            attempt,
            maxAttempts: retries.maxAttempts,
            result,
          });

          return {
            success: true,
            toolName: tool.name,
            result,
            totalAttempts,
            totalTimeMs: Date.now() - startTime,
            fallbackAttempted,
            fallbackChain: fallbackChain.length > 0 ? fallbackChain : undefined,
            retryAttempts,
          };
        }

        // Non-success result
        lastError = new Error(result.error ?? 'Tool execution failed');
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
      }

      // Check if we should retry
      if (attempt < retries.maxAttempts) {
        retryAttempts++;
        await this.sleep(delay);
        delay = Math.min(delay * retries.backoffMultiplier, retries.maxDelayMs);

        reportProgress({
          phase: 'retrying',
          toolName: tool.name,
          attempt,
          maxAttempts: retries.maxAttempts,
          error: lastError?.message,
        });
      }
    }

    // All retries exhausted, try fallback if enabled
    if (useFallback && tool.fallbacks.length > 0) {
      reportProgress({
        phase: 'fallback',
        toolName: tool.name,
        attempt,
        maxAttempts: retries.maxAttempts,
        error: lastError?.message,
      });

      try {
        fallbackChain = tool.fallbacks.map((fb) => fb.name);

        const fallbackResult = await this.fallbackManager.executeWithFallback(
          tool,
          params,
          context,
          fallbackStrategy
        );

        fallbackAttempted = true;

        reportProgress({
          phase: 'completed',
          toolName: fallbackResult.toolName,
          attempt,
          maxAttempts: retries.maxAttempts,
          result: fallbackResult,
        });

        return {
          success: true,
          toolName: fallbackResult.toolName,
          result: fallbackResult,
          totalAttempts,
          totalTimeMs: Date.now() - startTime,
          fallbackAttempted: true,
          fallbackChain,
          retryAttempts,
        };
      } catch (error) {
        // Fallback also failed
        const allFailedError =
          error instanceof AllToolsFailedError
            ? error
            : new AllToolsFailedError(
                error instanceof Error ? error : new Error(String(error)),
                [tool.name, ...fallbackChain]
              );

        lastError = allFailedError;
        fallbackChain = allFailedError.attemptedTools;
      }
    }

    // Everything failed
    reportProgress({
      phase: 'failed',
      toolName: tool.name,
      attempt,
      maxAttempts: retries.maxAttempts,
      error: lastError?.message,
    });

    // Report to FailureReporter so failures feed into learning/healing pipeline
    try {
      const reporter = getFailureReporter();
      reporter.reportTool(
        tool.name,
        lastError?.message ?? 'Unknown error',
        context?.task?.description,
        fallbackAttempted
          ? `Fallback chain: [${fallbackChain.join(' → ')}]. Total attempts: ${totalAttempts}`
          : `Retries: ${retryAttempts}/${retries.maxAttempts}`
      );
    } catch { /* non-fatal */ }

    return {
      success: false,
      toolName: tool.name,
      error: lastError?.message ?? 'Unknown error',
      totalAttempts,
      totalTimeMs: Date.now() - startTime,
      fallbackAttempted,
      fallbackChain: fallbackChain.length > 0 ? fallbackChain : undefined,
      retryAttempts,
      lastError: lastError?.message,
    };
  }

  /**
   * Execute a fallback chain directly
   */
  async executeChain(
    chain: FallbackChain,
    context: ExecutionContext,
    options: ExecutionOptions = {}
  ): Promise<ExecutionSummary> {
    const startTime = Date.now();
    const strategy = options.fallbackStrategy ?? 'priority';

    try {
      const result = await this.fallbackManager.executeChain(chain, context, strategy);

      return {
        success: true,
        toolName: result.toolName,
        result,
        totalAttempts: chain.currentIndex + 1,
        totalTimeMs: Date.now() - startTime,
        fallbackAttempted: chain.currentIndex > 0,
        fallbackChain: chain.tools.map((t) => t.name),
        retryAttempts: 0,
      };
    } catch (error) {
      const allFailedError =
        error instanceof AllToolsFailedError
          ? error
          : new AllToolsFailedError(
              error instanceof Error ? error : new Error(String(error)),
              chain.tools.map((t) => t.name)
            );

      return {
        success: false,
        toolName: chain.tools[0]?.name ?? 'unknown',
        error: allFailedError.message,
        totalAttempts: chain.tools.length,
        totalTimeMs: Date.now() - startTime,
        fallbackAttempted: true,
        fallbackChain: allFailedError.attemptedTools,
        retryAttempts: 0,
        lastError: allFailedError.lastError.message,
      };
    }
  }

  /**
   * Execute multiple tools and return the first success
   */
  async executeFirstSuccess(
    tools: Tool[],
    params: ToolParams,
    context: ExecutionContext,
    options: ExecutionOptions = {}
  ): Promise<ExecutionSummary> {
    const startTime = Date.now();

    for (const tool of tools) {
      const summary = await this.execute(tool, params, context, {
        ...options,
        fallbackEnabled: false, // Don't use fallback for first-success pattern
      });

      if (summary.success) {
        return summary;
      }
    }

    // All tools failed
    return {
      success: false,
      toolName: tools[0]?.name ?? 'unknown',
      error: 'All tools failed',
      totalAttempts: tools.length,
      totalTimeMs: Date.now() - startTime,
      fallbackAttempted: false,
      retryAttempts: 0,
    };
  }

  /**
   * Execute multiple tools in parallel
   */
  async executeAll(
    tools: Tool[],
    params: ToolParams,
    context: ExecutionContext,
    options: ExecutionOptions = {}
  ): Promise<ExecutionSummary[]> {
    return Promise.all(
      tools.map((tool) => this.execute(tool, params, context, options))
    );
  }

  /**
   * Create a timeout promise
   */
  private createTimeout(toolName: string, ms: number): Promise<never> {
    return new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Tool '${toolName}' timed out after ${ms}ms`)), ms)
    );
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Set default timeout
   */
  setDefaultTimeout(ms: number): void {
    this.defaultTimeout = ms;
  }

  /**
   * Set default retry config
   */
  setDefaultRetries(config: RetryConfig): void {
    this.defaultRetries = config;
  }

  /**
   * Get fallback manager
   */
  getFallbackManager(): FallbackManager {
    return this.fallbackManager;
  }
}

// Singleton instance
let defaultEngine: ExecutionEngine | null = null;

export function getExecutionEngine(): ExecutionEngine {
  if (!defaultEngine) {
    defaultEngine = new ExecutionEngine();
  }
  return defaultEngine;
}

export function createExecutionEngine(fallbackManager?: FallbackManager): ExecutionEngine {
  return new ExecutionEngine(fallbackManager);
}
