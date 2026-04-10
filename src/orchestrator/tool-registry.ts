/**
 * duck-cli v2 - Tool Registry
 * Central registry for all tools with capability-based matching
 */

import {
  Tool,
  Task,
  ToolCapability,
  ToolParams,
  createBaseTool,
  createFallbackTool,
  FallbackTool,
  ToolResult,
} from './tool.js';

export interface RegistryConfig {
  enableAutoRefresh?: boolean;
  refreshIntervalMs?: number;
  maxToolsPerCategory?: number;
}

export interface MatchResult {
  tool: Tool;
  score: number;
  matchType: 'exact' | 'partial' | 'fuzzy';
  matchedCapabilities: ToolCapability[];
}

export interface CategoryStats {
  category: string;
  toolCount: number;
  enabledCount: number;
  totalExecutions: number;
  successRate: number;
  avgExecutionTimeMs: number;
}

export class ToolRegistry {
  private tools: Map<string, Tool> = new Map();
  private categories: Map<string, Set<string>> = new Map();
  private toolAliases: Map<string, string> = new Map();
  private executionStats: Map<string, { total: number; successes: number; totalTime: number }> = new Map();
  private config: Required<RegistryConfig>;

  constructor(config: RegistryConfig = {}) {
    this.config = {
      enableAutoRefresh: config.enableAutoRefresh ?? false,
      refreshIntervalMs: config.refreshIntervalMs ?? 60000,
      maxToolsPerCategory: config.maxToolsPerCategory ?? 100,
    };
  }

  /**
   * Register a tool with the registry
   */
  register(tool: Tool, category?: string): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool '${tool.name}' is already registered`);
    }

    this.tools.set(tool.name, tool);

    // Track by category
    if (category) {
      this.addToCategory(tool.name, category);
    }

    // Initialize stats
    this.executionStats.set(tool.name, { total: 0, successes: 0, totalTime: 0 });

    // Auto-register fallbacks
    for (const fallback of tool.fallbacks) {
      if (!this.tools.has(fallback.name)) {
        this.tools.set(fallback.name, fallback);
      }
    }
  }

  /**
   * Register a tool by name with a handler function
   */
  registerTool(
    name: string,
    description: string,
    capabilities: ToolCapability[],
    handler: (params: ToolParams) => Promise<ToolResult>,
    category?: string
  ): Tool {
    const tool = createBaseTool(
      {
        name,
        description,
        capabilities,
        enabled: true,
      },
      handler
    );

    this.register(tool, category);
    return tool;
  }

  /**
   * Add a fallback to a registered tool
   */
  addFallback(toolName: string, fallback: FallbackTool): void {
    const tool = this.tools.get(toolName);
    if (!tool) {
      throw new Error(`Tool '${toolName}' not found in registry`);
    }

    tool.registerFallback(fallback);
  }

  /**
   * Register a fallback for a tool by name
   */
  registerFallback(
    toolName: string,
    fallbackName: string,
    priority: number,
    handler: (params: ToolParams) => Promise<ToolResult>,
    reason?: string
  ): FallbackTool {
    const fallback = createFallbackTool(
      fallbackName,
      `Fallback: ${fallbackName}`,
      priority,
      handler,
      reason
    );

    this.addFallback(toolName, fallback);
    return fallback;
  }

  /**
   * Unregister a tool
   */
  unregister(name: string): boolean {
    const tool = this.tools.get(name);
    if (!tool) return false;

    // Remove from all categories
    for (const [, tools] of this.categories) {
      tools.delete(name);
    }

    // Remove aliases
    for (const [alias, original] of this.toolAliases) {
      if (original === name) {
        this.toolAliases.delete(alias);
      }
    }

    return this.tools.delete(name);
  }

  /**
   * Get a tool by name
   */
  get(name: string): Tool | undefined {
    const actualName = this.toolAliases.get(name) ?? name;
    return this.tools.get(actualName);
  }

  /**
   * Get all registered tool names
   */
  listTools(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Get all enabled tools
   */
  getEnabledTools(): Tool[] {
    return Array.from(this.tools.values()).filter((t) => t.enabled);
  }

  /**
   * Add alias for a tool
   */
  addAlias(alias: string, toolName: string): void {
    if (!this.tools.has(toolName)) {
      throw new Error(`Tool '${toolName}' not found`);
    }
    this.toolAliases.set(alias, toolName);
  }

  /**
   * Find the best tool for a task based on capability matching
   */
  findBestTool(task: Task, maxResults = 5): MatchResult[] {
    const candidates: MatchResult[] = [];

    for (const tool of this.getEnabledTools()) {
      const score = tool.canHandle(task);
      if (score > 0) {
        const matchedCapabilities = tool.capabilities.filter((cap) => {
          const capText = `${cap.name} ${cap.description} ${cap.keywords.join(' ')}`.toLowerCase();
          const taskText = `${task.type} ${task.description} ${task.intent}`.toLowerCase();
          return cap.keywords.some((k) => taskText.includes(k.toLowerCase()));
        });

        candidates.push({
          tool,
          score,
          matchType: score >= 20 ? 'exact' : score >= 10 ? 'partial' : 'fuzzy',
          matchedCapabilities,
        });
      }
    }

    // Sort by score descending
    candidates.sort((a, b) => b.score - a.score);

    return candidates.slice(0, maxResults);
  }

  /**
   * Find tools by capability keyword
   */
  findByCapability(keyword: string): Tool[] {
    const keywordLower = keyword.toLowerCase();
    const results: Array<{ tool: Tool; relevance: number }> = [];

    for (const tool of this.getEnabledTools()) {
      for (const capability of tool.capabilities) {
        if (capability.keywords.some((k) => k.toLowerCase().includes(keywordLower))) {
          results.push({ tool, relevance: 1 });
          break;
        }
        if (capability.description.toLowerCase().includes(keywordLower)) {
          results.push({ tool, relevance: 0.5 });
          break;
        }
      }
    }

    return results.map((r) => r.tool);
  }

  /**
   * Find tools by category
   */
  getByCategory(category: string): Tool[] {
    const toolNames = this.categories.get(category);
    if (!toolNames) return [];

    return Array.from(toolNames)
      .map((name) => this.tools.get(name))
      .filter((t): t is Tool => t !== undefined);
  }

  /**
   * Add tool to category
   */
  addToCategory(toolName: string, category: string): void {
    if (!this.categories.has(category)) {
      this.categories.set(category, new Set());
    }
    this.categories.get(category)!.add(toolName);
  }

  /**
   * Get all categories
   */
  listCategories(): string[] {
    return Array.from(this.categories.keys());
  }

  /**
   * Record tool execution result
   */
  recordExecution(toolName: string, success: boolean, executionTimeMs: number): void {
    const stats = this.executionStats.get(toolName);
    if (stats) {
      stats.total++;
      if (success) stats.successes++;
      stats.totalTime += executionTimeMs;
    }
  }

  /**
   * Get execution statistics for a tool
   */
  getStats(toolName: string): { total: number; successes: number; totalTime: number; avgTime: number; successRate: number } | null {
    const stats = this.executionStats.get(toolName);
    if (!stats) return null;

    return {
      total: stats.total,
      successes: stats.successes,
      totalTime: stats.totalTime,
      avgTime: stats.total > 0 ? stats.totalTime / stats.total : 0,
      successRate: stats.total > 0 ? stats.successes / stats.total : 0,
    };
  }

  /**
   * Get statistics for all categories
   */
  getCategoryStats(): CategoryStats[] {
    const results: CategoryStats[] = [];

    for (const [category, toolNames] of this.categories) {
      let totalExecutions = 0;
      let totalSuccesses = 0;
      let totalTime = 0;
      let enabledCount = 0;

      for (const name of toolNames) {
        const tool = this.tools.get(name);
        if (!tool) continue;

        if (tool.enabled) enabledCount++;

        const stats = this.executionStats.get(name);
        if (stats) {
          totalExecutions += stats.total;
          totalSuccesses += stats.successes;
          totalTime += stats.totalTime;
        }
      }

      results.push({
        category,
        toolCount: toolNames.size,
        enabledCount,
        totalExecutions,
        successRate: totalExecutions > 0 ? totalSuccesses / totalExecutions : 0,
        avgExecutionTimeMs: totalExecutions > 0 ? totalTime / totalExecutions : 0,
      });
    }

    return results;
  }

  /**
   * Enable/disable a tool
   */
  setEnabled(name: string, enabled: boolean): boolean {
    const tool = this.tools.get(name);
    if (!tool) return false;
    tool.enabled = enabled;
    return true;
  }

  /**
   * Clear all registered tools
   */
  clear(): void {
    this.tools.clear();
    this.categories.clear();
    this.toolAliases.clear();
    this.executionStats.clear();
  }

  /**
   * Get registry info
   */
  getInfo(): { toolCount: number; categoryCount: number; aliasCount: number } {
    return {
      toolCount: this.tools.size,
      categoryCount: this.categories.size,
      aliasCount: this.toolAliases.size,
    };
  }

  /**
   * Build a tool with automatic fallback chain
   */
  buildToolWithFallbacks(
    primaryName: string,
    fallbacks: Array<{
      name: string;
      priority: number;
      handler: (params: ToolParams) => Promise<ToolResult>;
      reason?: string;
    }>
  ): Tool | null {
    const primary = this.get(primaryName);
    if (!primary) return null;

    // Sort fallbacks by priority
    fallbacks.sort((a, b) => a.priority - b.priority);

    for (const fb of fallbacks) {
      const fallbackTool = createFallbackTool(
        fb.name,
        `Fallback: ${fb.name} - ${fb.reason ?? 'N/A'}`,
        fb.priority,
        fb.handler,
        fb.reason
      );
      primary.registerFallback(fallbackTool);
    }

    return primary;
  }
}

// Singleton instance
let defaultRegistry: ToolRegistry | null = null;

export function getRegistry(): ToolRegistry {
  if (!defaultRegistry) {
    defaultRegistry = new ToolRegistry();
  }
  return defaultRegistry;
}

export function setRegistry(registry: ToolRegistry): void {
  defaultRegistry = registry;
}

export function createRegistry(config?: RegistryConfig): ToolRegistry {
  return new ToolRegistry(config);
}
