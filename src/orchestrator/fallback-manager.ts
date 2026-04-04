/**
 * duck-cli v2 - Fallback Manager
 * Handles fallback chain execution with proper error recovery
 */

import {
  Tool,
  Task,
  ToolParams,
  ToolResult,
  FallbackChain,
  FallbackTool,
  AllToolsFailedError,
  ExecutionContext,
} from './tool.js';

export interface FallbackStrategy {
  name: string;
  description: string;
  selectNextFallback(
    chain: FallbackChain,
    currentError: Error,
    context: ExecutionContext
  ): Tool | null;
}

export interface FallbackEvent {
  type: 'attempt' | 'success' | 'failure' | 'exhausted';
  toolName: string;
  timestamp: number;
  error?: Error;
  result?: ToolResult;
}

export type FallbackEventHandler = (event: FallbackEvent) => void;

export class FallbackManager {
  private strategies: Map<string, FallbackStrategy> = new Map();
  private eventHandlers: Set<FallbackEventHandler> = new Set();
  private defaultStrategy: string = 'priority';

  constructor() {
    // Register default strategies
    this.registerStrategy({
      name: 'priority',
      description: 'Select next fallback by priority order',
      selectNextFallback: (chain, _currentError, _context) => {
        return chain.tools[chain.currentIndex] ?? null;
      },
    });

    this.registerStrategy({
      name: 'smart',
      description: 'Smart fallback selection based on error type and context',
      selectNextFallback: (chain, currentError, context) => {
        // Check for condition-based fallbacks first
        for (let i = chain.currentIndex; i < chain.tools.length; i++) {
          const tool = chain.tools[i] as FallbackTool;
          if (tool.condition && tool.condition(chain.originalParams)) {
            chain.currentIndex = i;
            return tool;
          }
        }

        // Fall back to priority order
        return chain.tools[chain.currentIndex] ?? null;
      },
    });

    this.registerStrategy({
      name: 'exhaustive',
      description: 'Try every tool in the chain regardless of errors',
      selectNextFallback: (chain, _currentError, _context) => {
        if (chain.currentIndex < chain.tools.length) {
          return chain.tools[chain.currentIndex];
        }
        return null;
      },
    });
  }

  /**
   * Register a fallback strategy
   */
  registerStrategy(strategy: FallbackStrategy): void {
    this.strategies.set(strategy.name, strategy);
  }

  /**
   * Set the default fallback strategy
   */
  setDefaultStrategy(name: string): void {
    if (!this.strategies.has(name)) {
      throw new Error(`Unknown strategy: ${name}`);
    }
    this.defaultStrategy = name;
  }

  /**
   * Subscribe to fallback events
   */
  onEvent(handler: FallbackEventHandler): () => void {
    this.eventHandlers.add(handler);
    return () => this.eventHandlers.delete(handler);
  }

  /**
   * Emit an event to all handlers
   */
  private emit(event: FallbackEvent): void {
    for (const handler of this.eventHandlers) {
      try {
        handler(event);
      } catch {
        // Ignore handler errors
      }
    }
  }

  /**
   * Create a fallback chain from a primary tool and its fallbacks
   */
  createChain(primaryTool: Tool, params: ToolParams): FallbackChain {
    const chain: FallbackChain = {
      tools: primaryTool.getFallbackChain(),
      currentIndex: 0,
      originalParams: params,
      errors: [],
    };

    // Sort fallbacks by priority if they have priorities
    if (chain.tools.length > 1) {
      const sorted = chain.tools.slice(1).sort((a, b) => {
        const aP = (a as FallbackTool).priority ?? 999;
        const bP = (b as FallbackTool).priority ?? 999;
        return aP - bP;
      });
      chain.tools = [chain.tools[0], ...sorted];
    }

    return chain;
  }

  /**
   * Execute a fallback chain
   */
  async executeChain(
    chain: FallbackChain,
    context: ExecutionContext,
    strategyName?: string
  ): Promise<ToolResult> {
    const strategy = this.strategies.get(strategyName ?? this.defaultStrategy);
    if (!strategy) {
      throw new Error(`Unknown fallback strategy: ${strategyName ?? this.defaultStrategy}`);
    }

    let lastError: Error | null = null;

    while (chain.currentIndex < chain.tools.length) {
      const tool = chain.tools[chain.currentIndex];

      this.emit({
        type: 'attempt',
        toolName: tool.name,
        timestamp: Date.now(),
      });

      try {
        const result = await tool.execute(chain.originalParams);

        if (result.success) {
          this.emit({
            type: 'success',
            toolName: tool.name,
            timestamp: Date.now(),
            result,
          });
          return result;
        }

        // Tool returned failure but didn't throw
        const error = new Error(result.error ?? 'Tool execution failed');
        chain.errors.push({ toolName: tool.name, error });
        lastError = error;

        this.emit({
          type: 'failure',
          toolName: tool.name,
          timestamp: Date.now(),
          error,
          result,
        });

        // Try next fallback
        chain.currentIndex++;
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        chain.errors.push({ toolName: tool.name, error: err });
        lastError = err;

        this.emit({
          type: 'failure',
          toolName: tool.name,
          timestamp: Date.now(),
          error: err,
        });

        // Try next fallback
        chain.currentIndex++;
      }
    }

    // All tools failed
    this.emit({
      type: 'exhausted',
      toolName: chain.tools[chain.tools.length - 1]?.name ?? 'unknown',
      timestamp: Date.now(),
    });

    throw new AllToolsFailedError(
      lastError ?? new Error('Unknown error in fallback chain'),
      chain.tools.map((t) => t.name),
      `All ${chain.tools.length} tools in fallback chain failed`
    );
  }

  /**
   * Execute with automatic fallback chain creation
   */
  async executeWithFallback(
    primaryTool: Tool,
    params: ToolParams,
    context: ExecutionContext,
    strategyName?: string
  ): Promise<ToolResult> {
    const chain = this.createChain(primaryTool, params);
    return this.executeChain(chain, context, strategyName);
  }

  /**
   * Execute multiple tools in parallel, use first success
   */
  async executeFirstSuccess(
    tools: Tool[],
    params: ToolParams,
    context: ExecutionContext,
    timeoutMs = 30000
  ): Promise<ToolResult> {
    const results = await Promise.race([
      Promise.all(
        tools.map(async (tool) => {
          try {
            return await tool.execute(params);
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : String(error),
              toolName: tool.name,
              executionTimeMs: 0,
            } as ToolResult;
          }
        })
      ),
      new Promise<ToolResult[]>((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs)
      ),
    ]);

    // Find first success
    const success = results.find((r) => r.success);
    if (success) {
      return success;
    }

    // All failed
    throw new AllToolsFailedError(
      new Error('All tools failed'),
      tools.map((t) => t.name)
    );
  }

  /**
   * Get chain status
   */
  getChainStatus(chain: FallbackChain): {
    total: number;
    attempted: number;
    remaining: number;
    currentTool: string | null;
    errors: Array<{ toolName: string; error: string }>;
  } {
    return {
      total: chain.tools.length,
      attempted: chain.currentIndex,
      remaining: chain.tools.length - chain.currentIndex,
      currentTool: chain.tools[chain.currentIndex]?.name ?? null,
      errors: chain.errors.map((e) => ({
        toolName: e.toolName,
        error: e.error.message,
      })),
    };
  }

  /**
   * Reset chain to beginning
   */
  resetChain(chain: FallbackChain): void {
    chain.currentIndex = 0;
    chain.errors = [];
  }
}

// Singleton instance
let defaultManager: FallbackManager | null = null;

export function getFallbackManager(): FallbackManager {
  if (!defaultManager) {
    defaultManager = new FallbackManager();
  }
  return defaultManager;
}

export function createFallbackManager(): FallbackManager {
  return new FallbackManager();
}
