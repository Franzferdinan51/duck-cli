/**
 * duck-cli v3 - MetaHealer
 * When a tool fails, the Healer LLM diagnoses and suggests recovery.
 */

import { PlanStep, RecoveryAttempt } from './meta-types.js';
import { ProviderManager } from '../providers/manager.js';

const HEALER_SYSTEM = `You are duck-cli's Self-Healer. A tool failed.

Output JSON:
{
  "diagnosis": "why it likely failed",
  "recoveryAction": "what to try next",
  "tool": "alternative tool",
  "confidence": 0.5,
  "maxAttempts": 2
}`;

export class MetaHealer {
  private pm: ProviderManager;
  private model: string;
  private provider: string;

  constructor(pm: ProviderManager, model?: string, provider?: string) {
    this.pm = pm;
    this.model = model || 'MiniMax-M2.7';
    this.provider = provider || 'minimax';
  }

  async diagnose(
    taskPrompt: string,
    failedStep: PlanStep,
    error: string,
    attempts: RecoveryAttempt[]
  ): Promise<{ diagnosis: string; recoveryAction: string; tool?: string; confidence: number; maxAttempts: number }> {
    const history = attempts.map(a =>
      `Attempt ${a.attempt}: ${a.action} → ${a.success ? 'SUCCESS' : 'FAILED: ' + a.error}`
    ).join('\n');

    const prompt = HEALER_SYSTEM +
      '\n\nTask: ' + taskPrompt +
      '\nFailed step: ' + failedStep.description +
      '\nTool: ' + (failedStep.tool || 'N/A') +
      '\nError: ' + error +
      (history ? '\nAttempts:\n' + history : '');

    let response: { text: string };
    try {
      response = await this.pm.route(prompt);
    } catch {
      return { diagnosis: 'Unknown', recoveryAction: 'Try again', confidence: 0.1, maxAttempts: 1 };
    }

    try {
      return JSON.parse(this.extractJSON(response.text));
    } catch {
      return { diagnosis: 'Unknown', recoveryAction: 'Try again', confidence: 0.1, maxAttempts: 1 };
    }
  }

  private extractJSON(text: string): string {
    const block = text.match(/```(?:json)?\s*(\{[\s\S]*?})\s*```/);
    if (block) return block[1];
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start >= 0 && end > start) return text.substring(start, end + 1);
    throw new Error('No JSON found');
  }
}
