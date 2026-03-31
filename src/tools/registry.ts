/**
 * Duck Agent - Tool Registry
 * Discover and execute tools
 */

export interface ToolDefinition {
  name: string;
  description: string;
  schema: Record<string, string>;
}

export interface Tool {
  name: string;
  description: string;
  schema: Record<string, string>;
  handler: (args: any) => Promise<any>;
}

export class ToolRegistry {
  private tools: Map<string, Tool> = new Map();

  register(tool: Tool): void {
    this.tools.set(tool.name, tool);
    console.log(`   + Tool: ${tool.name}`);
  }

  unregister(name: string): boolean {
    return this.tools.delete(name);
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  list(): ToolDefinition[] {
    return Array.from(this.tools.values()).map(t => ({
      name: t.name,
      description: t.description,
      schema: t.schema
    }));
  }

  async execute(name: string, args: any): Promise<any> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Unknown tool: ${name}`);
    }

    try {
      return await tool.handler(args);
    } catch (error: any) {
      throw new Error(`Tool ${name} failed: ${error.message}`);
    }
  }

  async executeMany(calls: Array<{ name: string; args: any }>): Promise<any[]> {
    const results = [];
    for (const call of calls) {
      results.push(await this.execute(call.name, call.args));
    }
    return results;
  }
}

export default ToolRegistry;
