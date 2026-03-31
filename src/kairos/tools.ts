/**
 * 🦆 Duck Agent - Tool System
 * Inspired by Claude Code's tool architecture
 */

import { EventEmitter } from 'events';

// ============================================================================
// TOOL DEFINITIONS
// ============================================================================

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, any>;
  dangerous?: boolean;
  requiresApproval?: boolean;
  category?: string;
}

export interface ToolUse {
  id: string;
  name: string;
  input: any;
  startedAt: number;
  completedAt?: number;
  result?: any;
  error?: string;
}

export interface ToolResult {
  success: boolean;
  output?: any;
  error?: string;
  metadata?: Record<string, any>;
}

// ============================================================================
// TOOL REGISTRY
// ============================================================================

export class ToolRegistry extends EventEmitter {
  private tools: Map<string, ToolDefinition> = new Map();
  private handlers: Map<string, (input: any) => Promise<ToolResult>> = new Map();
  private usageStats: Map<string, { count: number; totalDuration: number }> = new Map();
  
  /**
   * Register a tool
   */
  register(def: ToolDefinition, handler: (input: any) => Promise<ToolResult>): void {
    this.tools.set(def.name, def);
    this.handlers.set(def.name, handler);
    this.emit('registered', def);
  }
  
  /**
   * Get tool definition
   */
  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }
  
  /**
   * List all tools
   */
  list(category?: string): ToolDefinition[] {
    const all = Array.from(this.tools.values());
    if (category) {
      return all.filter(t => t.category === category);
    }
    return all;
  }
  
  /**
   * Check if tool exists
   */
  has(name: string): boolean {
    return this.tools.has(name);
  }
  
  /**
   * Execute a tool
   */
  async execute(name: string, input: any): Promise<ToolResult> {
    const tool = this.tools.get(name);
    const handler = this.handlers.get(name);
    
    if (!tool || !handler) {
      return { success: false, error: `Tool not found: ${name}` };
    }
    
    // Check if dangerous and needs approval
    if (tool.dangerous && tool.requiresApproval) {
      return { success: false, error: 'Tool requires approval before use' };
    }
    
    const use: ToolUse = {
      id: this.generateId(),
      name,
      input,
      startedAt: Date.now(),
    };
    
    this.emit('start', use);
    
    try {
      const result = await handler(input);
      use.completedAt = Date.now();
      use.result = result;
      
      // Update stats
      const stats = this.usageStats.get(name) || { count: 0, totalDuration: 0 };
      stats.count++;
      stats.totalDuration += use.completedAt - use.startedAt;
      this.usageStats.set(name, stats);
      
      this.emit('complete', use);
      return result;
    } catch (e: any) {
      use.completedAt = Date.now();
      use.error = e.message;
      this.emit('error', use);
      return { success: false, error: e.message };
    }
  }
  
  /**
   * Get usage statistics
   */
  getStats(): Record<string, { count: number; avgDuration: number }> {
    const stats: Record<string, { count: number; avgDuration: number }> = {};
    
    for (const [name, data] of this.usageStats) {
      stats[name] = {
        count: data.count,
        avgDuration: data.totalDuration / data.count,
      };
    }
    
    return stats;
  }
  
  /**
   * Get most used tools
   */
  getMostUsed(limit: number = 10): { name: string; count: number }[] {
    return Array.from(this.usageStats.entries())
      .map(([name, stats]) => ({ name, count: stats.count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }
  
  private generateId(): string {
    return `tool_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  }
}

// ============================================================================
// TOOL DEFINITIONS (BUILT-IN)
// ============================================================================

export const BUILTIN_TOOLS: ToolDefinition[] = [
  // File operations
  {
    name: 'Read',
    description: 'Read contents of a file',
    inputSchema: { path: 'string' },
    category: 'file',
  },
  {
    name: 'Write',
    description: 'Write content to a file',
    inputSchema: { path: 'string', content: 'string' },
    dangerous: true,
    category: 'file',
  },
  {
    name: 'Edit',
    description: 'Edit specific lines in a file',
    inputSchema: { path: 'string', old_string: 'string', new_string: 'string' },
    dangerous: true,
    category: 'file',
  },
  {
    name: 'Glob',
    description: 'Find files by pattern',
    inputSchema: { pattern: 'string' },
    category: 'file',
  },
  
  // Shell
  {
    name: 'Bash',
    description: 'Execute shell commands',
    inputSchema: { command: 'string', timeout: 'number' },
    dangerous: true,
    category: 'shell',
  },
  
  // Search
  {
    name: 'Grep',
    description: 'Search for patterns in files',
    inputSchema: { pattern: 'string', path: 'string' },
    category: 'search',
  },
  {
    name: 'WebSearch',
    description: 'Search the web',
    inputSchema: { query: 'string' },
    category: 'search',
  },
  
  // Tools
  {
    name: 'Task',
    description: 'Spawn a subagent',
    inputSchema: { prompt: 'string', description: 'string' },
    category: 'agent',
  },
  {
    name: 'TaskStop',
    description: 'Stop a running task',
    inputSchema: { task_id: 'string' },
    category: 'agent',
  },
];

// ============================================================================
// TOOL MATCHING
// ============================================================================

export function matchTool(toolName: string, availableTools: string[]): string | null {
  // Exact match
  if (availableTools.includes(toolName)) {
    return toolName;
  }
  
  // Case-insensitive match
  const lower = toolName.toLowerCase();
  for (const tool of availableTools) {
    if (tool.toLowerCase() === lower) {
      return tool;
    }
  }
  
  // Partial match
  for (const tool of availableTools) {
    if (tool.toLowerCase().includes(lower)) {
      return tool;
    }
  }
  
  return null;
}

// ============================================================================
// GLOBAL REGISTRY
// ============================================================================

let globalRegistry: ToolRegistry | null = null;

export function getToolRegistry(): ToolRegistry {
  if (!globalRegistry) {
    globalRegistry = new ToolRegistry();
    
    // Register built-in tools
    for (const tool of BUILTIN_TOOLS) {
      globalRegistry.register(tool, async () => ({ success: false, error: 'Not implemented' }));
    }
  }
  
  return globalRegistry;
}

export default {
  ToolRegistry,
  BUILTIN_TOOLS,
  matchTool,
  getToolRegistry,
};
