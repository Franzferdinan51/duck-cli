/**
 * 🦆 Duck Agent - Speculative Execution
 * Run multiple approaches in parallel, use the best result
 */

import { ProviderManager } from '../providers/manager.js';

export interface SpeculativeResult {
  branchId: number;
  approach: string;
  result: any;
  score?: number;
  latencyMs: number;
  error?: string;
}

export interface SpeculativeOptions {
  branches?: number;
  timeoutMs?: number;
  scorer?: (result: any) => number | Promise<number>;
}

export class SpeculativeExecutor {
  private providerManager: ProviderManager;

  constructor(providerManager: ProviderManager) {
    this.providerManager = providerManager;
  }

  /**
   * Execute a task with multiple approaches in parallel
   * Returns the best result based on scoring
   */
  async speculate(
    task: string,
    options: SpeculativeOptions = {}
  ): Promise<SpeculativeResult> {
    const branches = options.branches || 3;
    const timeoutMs = options.timeoutMs || 60000;

    // Define different approaches
    const approaches = this.getApproaches(branches);

    // Execute all branches in parallel
    const results = await Promise.allSettled(
      approaches.map((approach, index) =>
        this.executeBranch(index, task, approach, timeoutMs)
      )
    );

    // Convert to SpeculativeResult array
    const speculationResults: SpeculativeResult[] = results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      }
      return {
        branchId: index,
        approach: approaches[index],
        result: null,
        error: result.reason?.message || 'Unknown error',
        latencyMs: 0
      };
    });

    // Score and rank results
    const scored = await Promise.all(
      speculationResults.map(async (r) => ({
        ...r,
        score: r.error ? 0 : await this.scoreResult(r.result, options.scorer)
      }))
    );

    // Sort by score (highest first)
    scored.sort((a, b) => (b.score || 0) - (a.score || 0));

    return scored[0];
  }

  /**
   * Execute all branches and return ranked results
   */
  async speculateAll(
    task: string,
    options: SpeculativeOptions = {}
  ): Promise<SpeculativeResult[]> {
    const branches = options.branches || 3;
    const timeoutMs = options.timeoutMs || 60000;
    const approaches = this.getApproaches(branches);

    const results = await Promise.allSettled(
      approaches.map((approach, index) =>
        this.executeBranch(index, task, approach, timeoutMs)
      )
    );

    const speculationResults: SpeculativeResult[] = results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      }
      return {
        branchId: index,
        approach: approaches[index],
        result: null,
        error: result.reason?.message || 'Unknown error',
        latencyMs: 0
      };
    });

    const scored = await Promise.all(
      speculationResults.map(async (r) => ({
        ...r,
        score: r.error ? 0 : await this.scoreResult(r.result, options.scorer)
      }))
    );

    return scored.sort((a, b) => (b.score || 0) - (a.score || 0));
  }

  private getApproaches(count: number): string[] {
    const all = [
      'concise',      // Short, direct answer
      'detailed',     // Comprehensive explanation
      'creative',     // Creative/imaginative approach
      'analytical',   // Step-by-step analysis
      'pragmatic',    // Practical, action-oriented
      'cautious'      // Conservative, risk-aware
    ];
    return all.slice(0, count);
  }

  private async executeBranch(
    branchId: number,
    task: string,
    approach: string,
    timeoutMs: number
  ): Promise<SpeculativeResult> {
    const startTime = Date.now();
    const timeout = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Timeout')), timeoutMs);
    });

    try {
      // Construct prompt with approach hint
      const enhancedPrompt = this.enhancePrompt(task, approach);

      const result = await Promise.race([
        this.providerManager.route(enhancedPrompt),
        timeout
      ]);

      const latencyMs = Date.now() - startTime;

      return {
        branchId,
        approach,
        result: result.text || 'No result',
        latencyMs,
        score: undefined // Will be computed later
      };
    } catch (error: any) {
      return {
        branchId,
        approach,
        result: null,
        error: error.message,
        latencyMs: Date.now() - startTime
      };
    }
  }

  private enhancePrompt(task: string, approach: string): string {
    const hints: Record<string, string> = {
      concise: `Answer the following concisely and directly. Get to the point quickly.\n\n${task}`,
      detailed: `Provide a comprehensive, detailed response covering all aspects of this question.\n\n${task}`,
      creative: `Think creatively and imaginatively about this. Suggest novel ideas and perspectives.\n\n${task}`,
      analytical: `Analyze this systematically. Break it down step by step and explain your reasoning.\n\n${task}`,
      pragmatic: `Focus on practical, actionable advice. What can actually be done?\n\n${task}`,
      cautious: `Consider potential risks and uncertainties. Be conservative and thorough.\n\n${task}`
    };
    return hints[approach] || task;
  }

  private async scoreResult(result: any, customScorer?: (r: any) => number | Promise<number>): Promise<number> {
    if (customScorer) {
      return typeof customScorer === 'function' ? await Promise.resolve(customScorer(result)) : customScorer;
    }

    // Default scoring heuristics
    let score = 50; // Base score

    // Length scoring (prefer medium length)
    const text = typeof result === 'string' ? result : JSON.stringify(result);
    if (text.length > 100 && text.length < 2000) score += 20;
    else if (text.length > 50) score += 10;

    // Quality signals
    if (text.includes('**') || text.includes('##')) score += 10; // Good formatting
    if (text.includes('```')) score += 10; // Has code
    if (text.match(/\d+\./)) score += 5; // Has numbered points

    return Math.min(100, score);
  }
}

// Default scorer for code tasks
export function codeQualityScorer(result: any): number {
  const text = typeof result === 'string' ? result : '';
  let score = 50;

  // Code quality signals
  if (text.includes('```')) score += 20; // Has code block
  if (text.match(/function\s+\w+/)) score += 10; // Has function
  if (text.match(/const\s+\w+\s*=/)) score += 10; // Has const
  if (text.match(/import\s+/)) score += 10; // Has imports
  if (text.includes('// ') || text.includes('###')) score += 5; // Has comments

  return Math.min(100, score);
}

// Default scorer for analysis tasks
export function analysisQualityScorer(result: any): number {
  const text = typeof result === 'string' ? result : '';
  let score = 50;

  // Analysis quality signals
  if (text.length > 500) score += 20;
  if (text.match(/\d+\.\s+\w+/)) score += 15; // Numbered list
  if (text.includes('**') && text.includes(':')) score += 10; // Bold headers
  if (text.match(/however|therefore|thus|because/gi)) score += 10; // Reasoning words

  return Math.min(100, score);
}
