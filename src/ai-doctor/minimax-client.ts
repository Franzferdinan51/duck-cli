/**
 * duck-cli AI Doctor - MiniMax API Client
 * Uses MiniMax for diagnosis and fix reasoning
 */

import { ProviderManager } from '../providers/manager.js';

export interface MiniMaxResponse {
  text: string;
  error?: string;
}

export class MiniMaxClient {
  private providerManager: ProviderManager;
  private model: string;

  constructor(model = 'MiniMax-M2.7') {
    this.providerManager = new ProviderManager();
    this.model = model;
  }

  async initialize(): Promise<void> {
    await this.providerManager.load();
  }

  /**
   * Diagnose an error using MiniMax
   */
  async diagnose(error: string, context?: string): Promise<string> {
    const prompt = `You are an expert debugging AI doctor. Analyze this error and identify the root cause.

ERROR:
${error}

${context ? `CONTEXT:\n${context}` : ''}

Respond with a concise diagnosis:
1. Root cause (1 sentence)
2. Category: network|auth|memory|code|config|dependency|timeout|unknown
3. Severity: critical|high|medium|low
4. Confidence: 0.0-1.0

Format:
ROOT_CAUSE: <brief explanation>
CATEGORY: <category>
SEVERITY: <severity>
CONFIDENCE: <0.0-1.0>`;

    return this.complete(prompt);
  }

  /**
   * Propose fixes using MiniMax
   */
  async proposeFix(error: string, diagnosis: string): Promise<string> {
    const prompt = `You are an expert debugging AI doctor. Based on the diagnosis, propose concrete fixes.

ERROR:
${error}

DIAGNOSIS:
${diagnosis}

Respond with specific fix steps:

1. Step description (action type: restart|reinstall|patch|config|clear_cache|rebuild|noop)
2. Command to run (if applicable)
3. Risk level: low|medium|high
4. Auto-fixable: true|false

Format:
STEP 1: <description> | <action> | <command or N/A> | <risk> | <auto>
STEP 2: ...

If no fix needed: NO_FIX_NEEDED`;

    return this.complete(prompt);
  }

  /**
   * Explain a fix in plain English
   */
  async explainFix(error: string, fix: string): Promise<string> {
    const prompt = `You are a friendly AI doctor. Explain this fix in plain English to a developer.

ERROR:
${error}

PROPOSED FIX:
${fix}

Give a brief, clear explanation of what went wrong and what the fix does. Max 2 sentences.`;

    return this.complete(prompt);
  }

  /**
   * Auto-repair code or config
   */
  async autoRepair(code: string, error: string): Promise<string> {
    const prompt = `You are an expert programmer AI. The following code has an error. Provide the corrected version.

ERROR:
${error}

CURRENT CODE:
\`\`\`
${code}
\`\`\`

Respond with ONLY the corrected code, no explanation. Use the same language/format as the input.`;

    return this.complete(prompt);
  }

  private async complete(prompt: string, timeoutMs = 30000): Promise<string> {
    try {
      const provider = this.providerManager.getProvider('minimax');
      if (!provider) {
        return `Error: MiniMax provider not available. Configure MINIMAX_API_KEY.`;
      }

      const result = await Promise.race([
        provider.complete({
          model: this.model,
          messages: [{ role: 'user', content: prompt }],
        }),
        new Promise<{ error?: string }>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), timeoutMs)
        ),
      ]) as MiniMaxResponse;

      if (result.error) {
        return `Error: ${result.error}`;
      }

      return result.text || 'No response from MiniMax';
    } catch (e: any) {
      return `MiniMax error: ${e.message}`;
    }
  }
}
