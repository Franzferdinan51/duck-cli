/**
 * duck-cli v2 - Tool Interface
 * Base interface for all tools with fallback support
 */

export interface ToolParams {
  [key: string]: unknown;
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
  toolName: string;
  executionTimeMs: number;
  metadata?: Record<string, unknown>;
}

export interface ToolCapability {
  name: string;
  description: string;
  keywords: string[];
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
}

export interface ToolConfig {
  name: string;
  description: string;
  version?: string;
  capabilities: ToolCapability[];
  fallbacks?: FallbackConfig[];
  retry?: RetryConfig;
  timeout?: number;
  enabled?: boolean;
}

export interface FallbackConfig {
  toolName: string;
  priority: number;
  reason?: string;
  condition?: (params: ToolParams) => boolean;
}

export interface RetryConfig {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

export interface FallbackChain {
  tools: Tool[];
  currentIndex: number;
  originalParams: ToolParams;
  errors: Array<{ toolName: string; error: Error }>;
}

export class AllToolsFailedError extends Error {
  constructor(
    public readonly lastError: Error,
    public readonly attemptedTools: string[],
    message = 'All tools in fallback chain failed'
  ) {
    super(message);
    this.name = 'AllToolsFailedError';
  }
}

export interface Tool {
  name: string;
  description: string;
  version?: string;
  capabilities: ToolCapability[];
  fallbacks: Tool[];
  retryConfig?: RetryConfig;
  timeout?: number;
  enabled: boolean;

  execute(params: ToolParams): Promise<ToolResult>;
  canHandle(task: Task): number;
  registerFallback(fallback: Tool): void;
  getFallbackChain(): Tool[];
}

export interface Task {
  id: string;
  type: string;
  description: string;
  intent: string;
  params: ToolParams;
  context?: Record<string, unknown>;
  priority?: number;
  timeout?: number;
}

export interface TaskResult {
  taskId: string;
  success: boolean;
  result?: ToolResult;
  error?: string;
  fallbackAttempted: boolean;
  toolsAttempted: string[];
  totalExecutionTimeMs: number;
  /** Optional metadata for recovery info, routing context, etc. */
  metadata?: Record<string, unknown>;
}

export type ToolHandler = (
  params: ToolParams,
  context?: ExecutionContext
) => Promise<ToolResult>;

export interface ExecutionContext {
  task: Task;
  orchestrator: unknown;
  sessionId: string;
  userId?: string;
  metadata: Record<string, unknown>;
}

export function createBaseTool(config: ToolConfig, handler: ToolHandler): Tool {
  return new BaseTool(config, handler);
}

class BaseTool implements Tool {
  public name: string;
  public description: string;
  public version?: string;
  public capabilities: ToolCapability[];
  public fallbacks: Tool[];
  public retryConfig?: RetryConfig;
  public timeout?: number;
  public enabled: boolean;

  private handler: ToolHandler;

  constructor(config: ToolConfig, handler: ToolHandler) {
    this.name = config.name;
    this.description = config.description;
    this.version = config.version;
    this.capabilities = config.capabilities;
    this.fallbacks = [];
    this.retryConfig = config.retry;
    this.timeout = config.timeout;
    this.enabled = config.enabled ?? true;
    this.handler = handler;

    // Initialize fallback tools from config
    if (config.fallbacks) {
      for (const fb of config.fallbacks) {
        // Note: actual fallback tools should be registered via registerFallback
        // This is just a placeholder for the chain building
      }
    }
  }

  async execute(params: ToolParams): Promise<ToolResult> {
    if (!this.enabled) {
      return {
        success: false,
        error: `Tool '${this.name}' is disabled`,
        toolName: this.name,
        executionTimeMs: 0,
      };
    }

    const startTime = Date.now();
    const timeout = this.timeout ?? 30000;

    try {
      const result = await Promise.race([
        this.handler(params),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Tool '${this.name}' timed out after ${timeout}ms`)), timeout)
        ),
      ]);

      return {
        ...result,
        toolName: this.name,
        executionTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        toolName: this.name,
        executionTimeMs: Date.now() - startTime,
      };
    }
  }

  canHandle(task: Task): number {
    // Default implementation: check if task type or intent matches capabilities
    let score = 0;

    const taskText = `${task.type} ${task.description} ${task.intent}`.toLowerCase();

    for (const capability of this.capabilities) {
      const capabilityText = `${capability.name} ${capability.description} ${capability.keywords.join(' ')}`.toLowerCase();

      // Direct keyword match
      for (const keyword of capability.keywords) {
        if (taskText.includes(keyword.toLowerCase())) {
          score += 10;
        }
      }

      // Description match
      if (taskText.includes(capability.description.toLowerCase())) {
        score += 5;
      }

      // Task type match
      if (task.type === capability.name) {
        score += 20;
      }
    }

    return score;
  }

  registerFallback(fallback: Tool): void {
    // Insert in priority order
    const insertIndex = this.fallbacks.findIndex(
      (fb) => (fb as FallbackTool).priority! > (fallback as FallbackTool).priority!
    );

    if (insertIndex === -1) {
      this.fallbacks.push(fallback);
    } else {
      this.fallbacks.splice(insertIndex, 0, fallback);
    }
  }

  getFallbackChain(): Tool[] {
    return [this, ...this.fallbacks];
  }
}

// Wrapper for fallback tools with priority
export interface FallbackTool extends Tool {
  priority: number;
  reason?: string;
  condition?: (params: ToolParams) => boolean;
}

export function createFallbackTool(
  name: string,
  description: string,
  priority: number,
  handler: ToolHandler,
  reason?: string,
  condition?: (params: ToolParams) => boolean
): FallbackTool {
  const tool = createBaseTool(
    {
      name,
      description,
      capabilities: [],
      enabled: true,
    },
    handler
  ) as FallbackTool;

  (tool as FallbackTool).priority = priority;
  (tool as FallbackTool).reason = reason;
  (tool as FallbackTool).condition = condition;

  return tool as FallbackTool;
}
