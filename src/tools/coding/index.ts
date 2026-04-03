/**
 * 🦆 Duck Agent - Claude Code Tools
 * Coding tools from instructkr-claude-code
 */

import { execSync, exec } from 'child_process';
import { readFileSync, writeFileSync, existsSync, statSync, mkdirSync } from 'fs';
import { join, dirname, basename, extname } from 'path';
import { mkdirp, expandPath } from '../../utils/cross-platform.js';

export interface ToolResult {
  success: boolean;
  output?: string;
  error?: string;
  path?: string;
}

/**
 * FileReadTool - Read file contents
 */
export class FileReadTool {
  name = 'file_read';
  description = 'Read contents of a file';

  async execute(filePath: string, options?: { limit?: number; offset?: number }): Promise<ToolResult> {
    try {
      if (!existsSync(filePath)) {
        return { success: false, error: `File not found: ${filePath}` };
      }

      let content = readFileSync(filePath, 'utf-8');
      
      if (options?.offset) {
        const lines = content.split('\n');
        content = lines.slice(options.offset).join('\n');
      }
      
      if (options?.limit) {
        const lines = content.split('\n');
        content = lines.slice(0, options.limit).join('\n');
      }

      return { success: true, output: content, path: filePath };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
}

/**
 * FileWriteTool - Write content to a file
 */
export class FileWriteTool {
  name = 'file_write';
  description = 'Write content to a file (WARNING: overwrites existing content)';

  async execute(filePath: string, content: string): Promise<ToolResult> {
    try {
      // Ensure directory exists (cross-platform)
      const dir = dirname(expandPath(filePath));
      if (!existsSync(dir)) {
        mkdirp(dir);
      }

      writeFileSync(expandPath(filePath), content, 'utf-8');
      return { success: true, path: filePath };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
}

/**
 * FileEditTool - Edit specific parts of a file
 */
export class FileEditTool {
  name = 'file_edit';
  description = 'Edit a file by replacing specific text or inserting at line';

  async execute(
    filePath: string, 
    operation: 'replace' | 'insert' | 'delete',
    params: { 
      oldText?: string;
      newText?: string;
      line?: number;
      endLine?: number;
    }
  ): Promise<ToolResult> {
    try {
      if (!existsSync(filePath)) {
        return { success: false, error: `File not found: ${filePath}` };
      }

      let content = readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');

      switch (operation) {
        case 'replace':
          if (!params.oldText) {
            return { success: false, error: 'oldText required for replace' };
          }
          if (!content.includes(params.oldText)) {
            return { success: false, error: 'Text to replace not found' };
          }
          content = content.replace(params.oldText, params.newText || '');
          break;

        case 'insert':
          if (params.line === undefined) {
            return { success: false, error: 'line required for insert' };
          }
          const insertLine = Math.max(0, Math.min(params.line, lines.length));
          lines.splice(insertLine, 0, params.newText || '');
          content = lines.join('\n');
          break;

        case 'delete':
          if (params.line === undefined) {
            return { success: false, error: 'line required for delete' };
          }
          const endLine = params.endLine || params.line;
          lines.splice(params.line, (endLine - params.line + 1));
          content = lines.join('\n');
          break;
      }

      writeFileSync(filePath, content, 'utf-8');
      return { success: true, path: filePath, output: `Edited ${operation} at line ${params.line}` };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
}

/**
 * BashTool - Execute shell commands
 */
export class BashTool {
  name = 'bash';
  description = 'Execute shell commands (DANGEROUS: requires approval)';

  async execute(command: string, options?: { cwd?: string; timeout?: number }): Promise<ToolResult> {
    try {
      const output = execSync(command, {
        cwd: options?.cwd || process.cwd(),
        timeout: options?.timeout || 30000,
        encoding: 'utf-8',
        maxBuffer: 10 * 1024 * 1024,
      });
      return { success: true, output };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        output: error instanceof Error && 'stdout' in error ? (error as any).stdout : undefined,
      };
    }
  }
}

/**
 * GrepTool - Search for patterns in files
 */
export class GrepTool {
  name = 'grep';
  description = 'Search for text patterns in files';

  async execute(
    pattern: string, 
    options?: { 
      path?: string; 
      recursive?: boolean; 
      ignoreCase?: boolean;
      files?: string[];
    }
  ): Promise<ToolResult> {
    try {
      const flags = (options?.ignoreCase ? 'i' : '') + 'n';
      let cmd = `grep -${flags} "${pattern}"`;
      
      if (options?.recursive) cmd += ' -r';
      if (options?.path) cmd += ` "${options.path}"`;
      if (options?.files) cmd += ` ${options.files.join(' ')}`;
      
      const output = execSync(cmd, { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });
      return { success: true, output };
    } catch (error) {
      // grep returns exit code 1 if no matches
      if (error instanceof Error && 'status' in error && (error as any).status === 1) {
        return { success: true, output: '' };
      }
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
}

/**
 * GlobTool - Find files matching patterns
 */
export class GlobTool {
  name = 'glob';
  description = 'Find files matching glob patterns';

  async execute(pattern: string, options?: { cwd?: string }): Promise<ToolResult> {
    try {
      const { globSync } = await import('glob');
      const files = globSync(pattern, { 
        cwd: options?.cwd || process.cwd(),
        absolute: false,
      });
      return { success: true, output: files.join('\n') };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
}

/**
 * LSPTool - Language Server Protocol integration
 */
export class LSPTool {
  name = 'lsp';
  description = 'Get language server suggestions and diagnostics';

  async execute(action: 'diagnostics' | 'completions' | 'definitions', filePath: string): Promise<ToolResult> {
    try {
      // Basic LSP simulation - real implementation would use LSP protocol
      if (action === 'diagnostics') {
        // Run basic syntax check
        const ext = extname(filePath).toLowerCase();
        let cmd = '';
        
        switch (ext) {
          case '.ts':
          case '.tsx':
            cmd = `npx tsc --noEmit "${filePath}" 2>&1 || true`;
            break;
          case '.js':
          case '.jsx':
            cmd = `node --check "${filePath}" 2>&1 || true`;
            break;
          case '.py':
            cmd = `python3 -m py_compile "${filePath}" 2>&1 || true`;
            break;
          default:
            return { success: true, output: 'No LSP for this file type' };
        }
        
        const output = execSync(cmd, { encoding: 'utf-8', timeout: 10000 });
        return { success: true, output };
      }
      
      return { success: true, output: `LSP ${action} not implemented` };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
}

/**
 * TaskCreateTool - Create and track tasks
 */
export class TaskCreateTool {
  name = 'task_create';
  description = 'Create a task to track';

  private tasks: Map<string, any> = new Map();

  async execute(title: string, description?: string, priority?: 'low' | 'medium' | 'high'): Promise<ToolResult> {
    const id = `task_${Date.now()}`;
    const task = {
      id,
      title,
      description,
      priority: priority || 'medium',
      status: 'pending',
      created: new Date().toISOString(),
    };
    
    this.tasks.set(id, task);
    
    return { 
      success: true, 
      output: `Created task ${id}: ${title}`,
      path: id,
    };
  }

  list(): any[] {
    return Array.from(this.tasks.values());
  }
}

/**
 * REPLTool - Run code in REPL
 */
export class REPLTool {
  name = 'repl';
  description = 'Execute code in a REPL environment';

  async execute(code: string, language: 'node' | 'python' | 'bash' = 'node'): Promise<ToolResult> {
    try {
      let cmd: string;
      let tempFile: string;

      switch (language) {
        case 'node':
          cmd = `node -e "${code.replace(/"/g, '\\"')}"`;
          break;
        case 'python':
          cmd = `python3 -c "${code.replace(/"/g, '\\"')}"`;
          break;
        case 'bash':
          cmd = code;
          break;
      }

      const output = execSync(cmd, { encoding: 'utf-8', timeout: 10000 });
      return { success: true, output };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
}

/**
 * NotebookEditTool - Edit Jupyter notebooks
 */
export class NotebookEditTool {
  name = 'notebook_edit';
  description = 'Edit Jupyter notebook cells';

  async execute(notebookPath: string, cellIndex: number, newContent: string): Promise<ToolResult> {
    try {
      if (!existsSync(notebookPath)) {
        return { success: false, error: 'Notebook not found' };
      }

      const content = JSON.parse(readFileSync(notebookPath, 'utf-8'));
      
      if (!content.cells || !content.cells[cellIndex]) {
        return { success: false, error: 'Cell not found' };
      }

      content.cells[cellIndex].source = newContent;
      writeFileSync(notebookPath, JSON.stringify(content, null, 2), 'utf-8');
      
      return { success: true, output: `Updated cell ${cellIndex}` };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
}

// Export all tools
export const codingTools = [
  new FileReadTool(),
  new FileWriteTool(),
  new FileEditTool(),
  new BashTool(),
  new GrepTool(),
  new GlobTool(),
  new LSPTool(),
  new TaskCreateTool(),
  new REPLTool(),
  new NotebookEditTool(),
];

export default codingTools;
