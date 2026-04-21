/**
 * duck-cli AI Doctor - Claude Code / Codex Harness
 * Uses Claude Code or Codex CLI as the repair agent for code fixes.
 *
 * Claude Code: claude --permission-mode bypassPermissions --print 'task'
 * Codex:       codex exec --full-auto 'task'  (requires PTY + git repo)
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';

export type Harness = 'claude' | 'codex' | 'auto';

export interface HarnessResult {
  success: boolean;
  output: string;
  error?: string;
}

export class CodeHarness {
  private harness: Harness;
  private workdir: string;

  constructor(harness: Harness = 'auto', workdir?: string) {
    this.harness = harness;
    this.workdir = workdir || process.cwd();
  }

  /**
   * Detect available harness
   */
  static detect(): Harness {
    if (existsSync('/data/data/com.termux/files/usr/bin/claude')) return 'claude';
    if (existsSync('/usr/local/bin/codex') || existsSync('/data/data/com.termux/files/usr/bin/codex')) return 'codex';
    return 'claude'; // fallback assume claude
  }

  /**
   * Run a repair task through Claude Code or Codex
   */
  async repair(error: string, context?: { file?: string; code?: string; cwd?: string }): Promise<HarnessResult> {
    const workdir = context?.cwd || this.workdir;
    const harness = this.harness === 'auto' ? CodeHarness.detect() : this.harness;

    const prompt = this.buildPrompt(error, context);

    if (harness === 'claude') {
      return this.runClaude(prompt, workdir);
    } else {
      return this.runCodex(prompt, workdir);
    }
  }

  /**
   * Diagnose + fix using coding harness
   */
  async diagnoseAndFix(error: string, context?: { file?: string; code?: string; cwd?: string }): Promise<HarnessResult> {
    const workdir = context?.cwd || this.workdir;
    const harness = this.harness === 'auto' ? CodeHarness.detect() : this.harness;

    const prompt = `You are an expert debugging AI.

ERROR:
${error}

${context?.file ? `FILE: ${context.file}` : ''}
${context?.code ? `CODE:\n\`\`\`\n${context.code}\n\`\`\`` : ''}

Tasks:
1. Identify the root cause of the error
2. Provide the corrected code (if applicable)
3. Explain what was wrong in 1-2 sentences

Format your response:
ROOT_CAUSE: <brief explanation>
FIX: <corrected code or "NO_FIX" if not code-related>
EXPLANATION: <1-2 sentences on what was wrong>`;

    if (harness === 'claude') {
      return this.runClaude(prompt, workdir);
    } else {
      return this.runCodex(prompt, workdir);
    }
  }

  /**
   * Apply a code patch to a file
   */
  async patch(file: string, original: string, replacement: string, description?: string): Promise<HarnessResult> {
    const workdir = this.workdir;
    const prompt = `Apply this fix to ${file}.

REASON: ${description || 'Bug fix from AI Doctor diagnosis'}

ORIGINAL CODE (replace this):
\`\`\`
${original}
\`\`\`

REPLACEMENT CODE:
\`\`\`
${replacement}
\`\`\`

Use sed or a text editor to make this change. Write the result back to ${file}.`;

    const harness = this.harness === 'auto' ? CodeHarness.detect() : this.harness;
    if (harness === 'claude') {
      return this.runClaude(prompt, workdir);
    } else {
      return this.runCodex(prompt, workdir);
    }
  }

  // ---- Private ----

  private buildPrompt(error: string, context?: { file?: string; code?: string; cwd?: string }): string {
    return `You are an expert debugging AI. Fix this error.

ERROR:
${error}

${context?.file ? `TARGET FILE: ${context.file}` : ''}
${context?.code ? `CURRENT CODE:\n\`\`\`\n${context.code}\n\`\`\`` : ''}

Respond with the minimal fix needed:
1. Root cause (1 line)
2. Corrected code (if applicable, in a code block)
3. One sentence explaining the fix

If no code fix needed, respond:
ROOT_CAUSE: <cause>
FIX: NO_FIX
EXPLANATION: <explanation>`;
  }

  private async runClaude(prompt: string, workdir: string): Promise<HarnessResult> {
    try {
      // Escape single quotes in prompt for shell
      const escaped = prompt.replace(/'/g, "'\\''");

      const output = execSync(
        `cd '${workdir}' && claude --permission-mode bypassPermissions --print '${escaped}'`,
        {
          encoding: 'utf-8',
          timeout: 120000,
          shell: '/data/data/com.termux/files/usr/bin/bash',
          maxBuffer: 1024 * 1024,
        }
      );

      return { success: true, output: output.trim() };
    } catch (e: any) {
      return {
        success: false,
        output: e.stdout || '',
        error: e.stderr || e.message,
      };
    }
  }

  private async runCodex(prompt: string, workdir: string): Promise<HarnessResult> {
    try {
      // Codex needs a git repo — init temp one if needed
      const isGit = execSync('git rev-parse --is-inside-work-tree 2>/dev/null', {
        encoding: 'utf-8',
        cwd: workdir,
        timeout: 5000,
      }).trim() === 'true';

      if (!isGit) {
        return {
          success: false,
          output: '',
          error: 'Codex requires a git repository. Initialize with: git init',
        };
      }

      const escaped = prompt.replace(/'/g, "'\\''");
      const output = execSync(`cd '${workdir}' && codex exec --full-auto '${escaped}'`, {
        encoding: 'utf-8',
        timeout: 120000,
        shell: '/data/data/com.termux/files/usr/bin/bash',
        maxBuffer: 1024 * 1024,
      });

      return { success: true, output: output.trim() };
    } catch (e: any) {
      return {
        success: false,
        output: e.stdout || '',
        error: e.stderr || e.message,
      };
    }
  }
}
