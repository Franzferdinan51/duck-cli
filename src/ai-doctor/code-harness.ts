/**
 * duck-cli AI Doctor - Claude Code / Codex / Crush Harness
 * Uses Claude Code, Codex, or Crush CLI as the repair agent for code fixes.
 *
 * Claude Code: claude --permission-mode bypassPermissions --print 'task'
 * Codex:       codex exec --full-auto 'task'  (requires PTY + git repo)
 * Crush:       crush exec 'task'  (charmbracelet crush, Glamorous agentic coding)
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';

export type Harness = 'claude' | 'codex' | 'crush' | 'openclaude' | 'auto';

export interface HarnessResult {
  success: boolean;
  output: string;
  error?: string;
}

export class CodeHarness {
  private harness: Harness;
  private workdir: string;
  private model: string;
  private baseUrl: string;
  private apiKey: string;

  constructor(
    harness: Harness = 'auto',
    workdir?: string,
    config?: { model?: string; baseUrl?: string; apiKey?: string }
  ) {
    this.harness = harness;
    this.workdir = workdir || process.cwd();
    this.model = config?.model || process.env.OPENAI_MODEL || 'MiniMax-M2.7';
    this.baseUrl = config?.baseUrl || process.env.OPENAI_BASE_URL || 'https://api.minimax.chat/v1';
    this.apiKey = config?.apiKey || process.env.OPENAI_API_KEY || '';
  }

  /**
   * Detect available harness (priority: claude > crush > codex)
   */
  static detect(): Harness {
    if (existsSync('/data/data/com.termux/files/usr/bin/claude')) return 'claude';
    if (existsSync('/data/data/com.termux/files/usr/bin/openclaude')) return 'openclaude';
    if (existsSync('/data/data/com.termux/files/usr/bin/crush-arm64')) return 'crush';
    if (existsSync('/usr/local/bin/codex') || existsSync('/data/data/com.termux/files/usr/bin/codex')) return 'codex';
    return 'claude'; // fallback
  }

  /**
   * Run a repair task through Claude Code, Codex, or Crush
   */
  async repair(error: string, context?: { file?: string; code?: string; cwd?: string }): Promise<HarnessResult> {
    const workdir = context?.cwd || this.workdir;
    const harness = this.harness === 'auto' ? CodeHarness.detect() : this.harness;

    const prompt = this.buildPrompt(error, context);

    switch (harness) {
      case 'claude':     return this.runClaude(prompt, workdir);
      case 'openclaude': return this.runOpenClaude(prompt, workdir);
      case 'crush':      return this.runCrush(prompt, workdir);
      case 'codex':      return this.runCodex(prompt, workdir);
      default:           return this.runClaude(prompt, workdir);
    }
  }

  /**
   * Diagnose + fix using coding harness
   */
  async diagnoseAndFix(error: string, context?: { file?: string; code?: string; cwd?: string }): Promise<HarnessResult> {
    const workdir = context?.cwd || this.workdir;
    const harness = this.harness === 'auto' ? CodeHarness.detect() : this.harness;

    const prompt = `You are an expert debugging AI. The following error occurred:

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

    switch (harness) {
      case 'claude':     return this.runClaude(prompt, workdir);
      case 'openclaude': return this.runOpenClaude(prompt, workdir);
      case 'crush':      return this.runCrush(prompt, workdir);
      case 'codex':      return this.runCodex(prompt, workdir);
      default:           return this.runClaude(prompt, workdir);
    }
  }

  /**
   * Apply a code patch to a file
   */
  async patch(file: string, original: string, replacement: string, description?: string): Promise<HarnessResult> {
    const workdir = this.workdir;
    const harness = this.harness === 'auto' ? CodeHarness.detect() : this.harness;

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

    switch (harness) {
      case 'claude':     return this.runClaude(prompt, workdir);
      case 'openclaude': return this.runOpenClaude(prompt, workdir);
      case 'crush':      return this.runCrush(prompt, workdir);
      case 'codex':      return this.runCodex(prompt, workdir);
      default:           return this.runClaude(prompt, workdir);
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

  private async runOpenClaude(prompt: string, workdir: string): Promise<HarnessResult> {
    try {
      // OpenClaude is model-agnostic — set model via env vars
      // Uses MiniMax by default, or any OpenAI-compatible API
      const envSetup = [
        `OPENAI_BASE_URL='${this.baseUrl}'`,
        `OPENAI_API_KEY='${this.apiKey}'`,
        `OPENAI_MODEL='${this.model}'`,
      ].join(' ');

      const escaped = prompt.replace(/'/g, "'\\''");

      const output = execSync(
        `${envSetup} cd '${workdir}' && openclaude exec '${escaped}'`,
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

  private async runCrush(prompt: string, workdir: string): Promise<HarnessResult> {
    try {
      // Crush needs a git repo — init temp one if needed
      let isGit = false;
      try {
        isGit = execSync('git rev-parse --is-inside-work-tree 2>/dev/null', {
          encoding: 'utf-8',
          cwd: workdir,
          timeout: 5000,
        }).trim() === 'true';
      } catch {
        isGit = false;
      }

      if (!isGit) {
        return {
          success: false,
          output: '',
          error: 'Crush requires a git repository. Initialize with: git init',
        };
      }

      const escaped = prompt.replace(/'/g, "'\\''");
      const output = execSync(
        `cd '${workdir}' && /data/data/com.termux/files/usr/bin/crush-arm64 exec '${escaped}'`,
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
      // Codex needs a git repo
      let isGit = false;
      try {
        isGit = execSync('git rev-parse --is-inside-work-tree 2>/dev/null', {
          encoding: 'utf-8',
          cwd: workdir,
          timeout: 5000,
        }).trim() === 'true';
      } catch {
        isGit = false;
      }

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
