/**
 * Duck CLI - Claude Code Integration
 * 
 * Integrates with Claude Code CLI for:
 * - Code editing and file operations
 * - Git workflows
 * - Terminal command execution
 * - Multi-file refactoring
 */

import { spawn } from 'child_process';
import { promisify } from 'util';

const exec = promisify(spawn);

export interface ClaudeCodeOptions {
  model?: string;
  maxTokens?: number;
  claudePath?: string;
  projectDir?: string;
}

export interface ClaudeCodeResult {
  success: boolean;
  output: string;
  error?: string;
}

export class ClaudeCodeIntegration {
  private claudePath: string;
  private projectDir: string;

  constructor(options: ClaudeCodeOptions = {}) {
    this.claudePath = options.claudePath || 'claude';
    this.projectDir = options.projectDir || process.cwd();
  }

  async run(prompt: string, options: { model?: string } = {}): Promise<ClaudeCodeResult> {
    const args = [];
    
    if (options.model) {
      args.push('--model', options.model);
    }
    
    args.push(prompt);

    try {
      const result = await exec(this.claudePath, args, {
        cwd: this.projectDir,
        timeout: 300000, // 5 min timeout
      });

      return {
        success: true,
        output: result.stdout.toString(),
        error: result.stderr.toString() || undefined
      };
    } catch (error: any) {
      return {
        success: false,
        output: '',
        error: error.message || String(error)
      };
    }
  }

  async edit(file: string, instruction: string): Promise<ClaudeCodeResult> {
    return this.run(`/edit ${file}\n\n${instruction}`);
  }

  async read(file: string): Promise<ClaudeCodeResult> {
    return this.run(`/read ${file}`);
  }

  async bash(command: string): Promise<ClaudeCodeResult> {
    return this.run(`/bash ${command}`);
  }

  async multiEdit(edits: { file: string; instruction: string }[]): Promise<ClaudeCodeResult[]> {
    const results: ClaudeCodeResult[] = [];
    for (const edit of edits) {
      const result = await this.edit(edit.file, edit.instruction);
      results.push(result);
    }
    return results;
  }
}

export default ClaudeCodeIntegration;
