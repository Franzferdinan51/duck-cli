/**
 * 🦆 Duck Agent - Enhanced Tool Registry
 * With dangerous tool detection and approval system
 */

export interface ToolDefinition {
  name: string;
  description: string;
  schema: Record<string, any>;
  dangerous?: boolean;
  requiresApproval?: boolean;
  handler: Function;
}

export interface ToolResult {
  success?: boolean;
  result?: any;
  error?: string;
  output?: string;
}

export interface ToolInfo {
  name: string;
  description: string;
  schema: Record<string, any>;
  dangerous: boolean;
}

export class ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map();
  private approvalCallback: ((name: string, args: any) => Promise<boolean>) | null = null;

  register(def: ToolDefinition): void {
    // Validate schema
    if (!def.schema || typeof def.schema !== 'object') {
      throw new Error(`Tool ${def.name}: invalid schema`);
    }

    this.tools.set(def.name, {
      ...def,
      dangerous: def.dangerous || false,
      requiresApproval: def.requiresApproval !== false
    });

    console.log(`   + Tool: ${def.name}${def.dangerous ? ' ⚠️' : ''}`);
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  async execute(name: string, args: any): Promise<ToolResult> {
    const tool = this.tools.get(name);
    
    if (!tool) {
      return { success: false, error: `Unknown tool: ${name}` };
    }

    // Check approval for dangerous tools
    if (tool.dangerous && this.approvalCallback) {
      const approved = await this.approvalCallback(name, args);
      if (!approved) {
        return { success: false, error: `Tool ${name} requires approval` };
      }
    }

    try {
      const result = await tool.handler(args);
      return { success: true, result, output: String(result) };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  list(): ToolInfo[] {
    return Array.from(this.tools.values()).map(t => ({
      name: t.name,
      description: t.description,
      schema: t.schema,
      dangerous: t.dangerous || false
    }));
  }

  listDangerous(): ToolInfo[] {
    return this.list().filter(t => t.dangerous);
  }

  setApprovalCallback(callback: (name: string, args: any) => Promise<boolean>): void {
    this.approvalCallback = callback;
  }

  validateArgs(name: string, args: any): { valid: boolean; error?: string } {
    const tool = this.tools.get(name);
    if (!tool) {
      return { valid: false, error: `Unknown tool: ${name}` };
    }

    // Basic schema validation
    for (const [key, spec] of Object.entries(tool.schema)) {
      if ((spec as any).required && !(key in args)) {
        return { valid: false, error: `Missing required argument: ${key}` };
      }
    }

    return { valid: true };
  }
}

export default ToolRegistry;
