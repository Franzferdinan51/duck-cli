/**
 * Duck CLI - Tool Registry
 * 
 * Based on Claude Code's tool system:
 * - Zod schemas
 * - Permission system
 * - Progress streaming
 */

import { z } from 'zod';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface ToolDefinition {
  name: string;
  description: string;
  schema: z.ZodType;
}

export interface ToolResult {
  type: 'result' | 'error';
  tool: string;
  success: boolean;
  output: string;
  error?: string;
}

export interface Tool {
  name: string;
  description: string;
  definition: ToolDefinition;
  execute: (args: unknown) => Promise<ToolResult>;
  permissions?: string[];
}

export class ToolRegistry {
  private tools = new Map<string, Tool>();

  async load(): Promise<void> {
    // Built-in tools
    this.register({
      name: 'Read',
      description: 'Read file contents',
      definition: {
        name: 'Read',
        description: 'Read file contents',
        schema: z.object({
          path: z.string(),
          offset: z.number().optional(),
          limit: z.number().optional()
        })
      },
      execute: async (args) => {
        try {
          const { path, offset, limit } = args as { path: string; offset?: number; limit?: number };
          let content = await readFile(path, 'utf-8');
          
          if (offset !== undefined) {
            const lines = content.split('\n');
            content = lines.slice(offset, limit ? offset + limit : undefined).join('\n');
          }
          
          return {
            type: 'result',
            tool: 'Read',
            success: true,
            output: content
          };
        } catch (error) {
          return {
            type: 'error',
            tool: 'Read',
            success: false,
            output: '',
            error: String(error)
          };
        }
      }
    });

    this.register({
      name: 'Write',
      description: 'Write content to file',
      definition: {
        name: 'Write',
        description: 'Write content to file',
        schema: z.object({
          path: z.string(),
          content: z.string()
        })
      },
      execute: async (args) => {
        try {
          const { path, content } = args as { path: string; content: string };
          
          // Ensure directory exists
          const dir = path.split('/').slice(0, -1).join('/');
          if (dir) await mkdir(dir, { recursive: true });
          
          await writeFile(path, content, 'utf-8');
          
          return {
            type: 'result',
            tool: 'Write',
            success: true,
            output: `Written to ${path}`
          };
        } catch (error) {
          return {
            type: 'error',
            tool: 'Write',
            success: false,
            output: '',
            error: String(error)
          };
        }
      }
    });

    this.register({
      name: 'Bash',
      description: 'Execute shell commands',
      definition: {
        name: 'Bash',
        description: 'Execute shell commands',
        schema: z.object({
          command: z.string(),
          cwd: z.string().optional(),
          timeout: z.number().optional()
        })
      },
      permissions: ['exec'],
      execute: async (args) => {
        try {
          const { command, cwd, timeout = 30000 } = args as { 
            command: string; 
            cwd?: string; 
            timeout?: number 
          };
          
          const { stdout, stderr } = await execAsync(command, {
            cwd,
            timeout,
            killSignal: 'SIGTERM'
          });
          
          return {
            type: 'result',
            tool: 'Bash',
            success: true,
            output: stdout + stderr
          };
        } catch (error: any) {
          return {
            type: 'error',
            tool: 'Bash',
            success: false,
            output: '',
            error: error.message || String(error)
          };
        }
      }
    });

    this.register({
      name: 'Grep',
      description: 'Search for patterns in files',
      definition: {
        name: 'Grep',
        description: 'Search for patterns in files',
        schema: z.object({
          pattern: z.string(),
          path: z.string().optional(),
          recursive: z.boolean().optional()
        })
      },
      execute: async (args) => {
        try {
          const { pattern, path = '.', recursive = true } = args as {
            pattern: string;
            path?: string;
            recursive?: boolean;
          };
          
          const flag = recursive ? '-r' : '';
          const { stdout } = await execAsync(`grep ${flag} -n "${pattern}" ${path}`);
          
          return {
            type: 'result',
            tool: 'Grep',
            success: true,
            output: stdout || 'No matches found'
          };
        } catch (error: any) {
          return {
            type: 'error',
            tool: 'Grep',
            success: false,
            output: '',
            error: error.message || 'No matches found'
          };
        }
      }
    });

    this.register({
      name: 'Glob',
      description: 'Find files by pattern',
      definition: {
        name: 'Glob',
        description: 'Find files by pattern',
        schema: z.object({
          pattern: z.string(),
          cwd: z.string().optional()
        })
      },
      execute: async (args) => {
        try {
          const { pattern, cwd = '.' } = args as { pattern: string; cwd?: string };
          const { stdout } = await execAsync(`find ${cwd} -name "${pattern}" -type f`, { 
            timeout: 5000 
          });
          
          return {
            type: 'result',
            tool: 'Glob',
            success: true,
            output: stdout || 'No matches found'
          };
        } catch (error: any) {
          return {
            type: 'error',
            tool: 'Glob',
            success: false,
            output: '',
            error: 'No matches found'
          };
        }
      }
    });
  }

  register(tool: Tool): void {
    this.tools.set(tool.name, tool);
  }

  registerExternal(tool: any): void {
    // Register tools from MCP or other sources
    this.tools.set(tool.name, {
      name: tool.name,
      description: tool.description || '',
      definition: {
        name: tool.name,
        description: tool.description || '',
        schema: z.any()
      },
      execute: async (args) => {
        return {
          type: 'result',
          tool: tool.name,
          success: true,
          output: JSON.stringify(args)
        };
      }
    });
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  list(): Tool[] {
    return Array.from(this.tools.values());
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }
}
