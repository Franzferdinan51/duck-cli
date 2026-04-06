/**
 * duck-cli v3 - MetaCritic
 * After each step, the Critic LLM evaluates: proceed, replan, or abort.
 */

import { Plan, StepResult, CriticFeedback } from './meta-types.js';
import { ProviderManager } from '../providers/manager.js';

const CRITIC_SYSTEM = `You are duck-cli's Meta-Critic. Evaluate each step's result.

Output JSON:
{
  "verdict": "proceed" | "replan" | "abort",
  "reasoning": "why this verdict",
  "suggestions": ["optional: next steps"],
  "shouldRecover": true/false,
  "recoverySuggestion": "what to try if shouldRecover"
}`;

export class MetaCritic {
  private pm: ProviderManager;
  private model: string;
  private provider: string;

  constructor(pm: ProviderManager, model?: string, provider?: string) {
    this.pm = pm;
    this.model = model || 'MiniMax-M2.7';
    this.provider = provider || 'minimax';
  }

  async evaluate(taskPrompt: string, plan: Plan, stepIndex: number, result: StepResult): Promise<CriticFeedback> {
    const prompt = CRITIC_SYSTEM +
      '\n\nTask: ' + taskPrompt +
      '\nStep ' + plan.steps[stepIndex]?.step + ': ' + plan.steps[stepIndex]?.description +
      '\nResult: success=' + result.success + ', output=' + (result.output || result.error || '').substring(0, 200);

    let response: { text: string };
    try {
      response = await this.pm.route(prompt);
    } catch {
      return { stepIndex, verdict: 'proceed', reasoning: 'Route failed, defaulting to proceed' };
    }

    try {
      const fb = JSON.parse(this.extractJSON(response.text));
      return { ...fb, stepIndex } as CriticFeedback;
    } catch {
      return { stepIndex, verdict: 'proceed', reasoning: 'Parse failed, defaulting to proceed' };
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
