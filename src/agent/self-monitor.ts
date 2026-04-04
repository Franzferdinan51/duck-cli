/**
 * 🦆 Duck Agent - Self Monitor
 * Tracks usage statistics and persists to ~/.duck/stats.json
 * 
 * Usage:
 *   duck stats           - Show usage statistics
 *   duck stats reset     - Reset all stats
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

export interface RunRecord {
  timestamp: number;
  success: boolean;
  steps: number;
  tokens?: number;
  cost?: number;
  durationMs: number;
  model?: string;
  provider?: string;
  error?: string;
}

export interface Stats {
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  totalSteps: number;
  totalTokens: number;
  totalCost: number;
  totalDurationMs: number;
  lastRun?: RunRecord;
  runsByDay: Record<string, number>;  // 'YYYY-MM-DD' -> count
  runsByModel: Record<string, number>;  // model name -> count
  runsByProvider: Record<string, number>;  // provider -> count
}

const DEFAULT_STATS: Stats = {
  totalRuns: 0,
  successfulRuns: 0,
  failedRuns: 0,
  totalSteps: 0,
  totalTokens: 0,
  totalCost: 0,
  totalDurationMs: 0,
  runsByDay: {},
  runsByModel: {},
  runsByProvider: {},
};

export class SelfMonitor {
  private stats: Stats;
  private statsPath: string;
  private currentRun?: {
    startTime: number;
    steps: number;
    tokens: number;
    cost: number;
    model?: string;
    provider?: string;
  };

  constructor() {
    const duckDir = join(homedir(), '.duck');
    if (!existsSync(duckDir)) {
      mkdirSync(duckDir, { recursive: true });
    }
    
    this.statsPath = join(duckDir, 'stats.json');
    this.stats = this.load();
  }

  /**
   * Load stats from file
   */
  private load(): Stats {
    if (!existsSync(this.statsPath)) {
      return { ...DEFAULT_STATS };
    }

    try {
      const content = readFileSync(this.statsPath, 'utf-8');
      const parsed = JSON.parse(content);
      
      // Merge with defaults to ensure all fields exist
      return { ...DEFAULT_STATS, ...parsed };
    } catch (e) {
      console.error('Error loading stats, using defaults:', e);
      return { ...DEFAULT_STATS };
    }
  }

  /**
   * Save stats to file
   */
  private save(): void {
    try {
      writeFileSync(this.statsPath, JSON.stringify(this.stats, null, 2), { mode: 0o600 });
    } catch (e) {
      console.error('Error saving stats:', e);
    }
  }

  /**
   * Start tracking a new run
   */
  startRun(options?: { model?: string; provider?: string }): void {
    this.currentRun = {
      startTime: Date.now(),
      steps: 0,
      tokens: 0,
      cost: 0,
      model: options?.model,
      provider: options?.provider,
    };
  }

  /**
   * Record a step in the current run
   */
  recordStep(tokens?: number, cost?: number): void {
    if (this.currentRun) {
      this.currentRun.steps++;
      if (tokens) this.currentRun.tokens += tokens;
      if (cost) this.currentRun.cost += cost;
    }
  }

  /**
   * End the current run and record the result
   */
  endRun(success: boolean, error?: string): void {
    if (!this.currentRun) {
      console.warn('SelfMonitor: endRun called without startRun');
      return;
    }

    const record: RunRecord = {
      timestamp: this.currentRun.startTime,
      success,
      steps: this.currentRun.steps,
      tokens: this.currentRun.tokens,
      cost: this.currentRun.cost,
      durationMs: Date.now() - this.currentRun.startTime,
      model: this.currentRun.model,
      provider: this.currentRun.provider,
      error,
    };

    // Update aggregate stats
    this.stats.totalRuns++;
    if (success) {
      this.stats.successfulRuns++;
    } else {
      this.stats.failedRuns++;
    }

    this.stats.totalSteps += record.steps;
    this.stats.totalTokens += record.tokens || 0;
    this.stats.totalCost += record.cost || 0;
    this.stats.totalDurationMs += record.durationMs;
    this.stats.lastRun = record;

    // Update runs by day
    const day = new Date(record.timestamp).toISOString().split('T')[0];
    this.stats.runsByDay[day] = (this.stats.runsByDay[day] || 0) + 1;

    // Update runs by model
    if (record.model) {
      this.stats.runsByModel[record.model] = (this.stats.runsByModel[record.model] || 0) + 1;
    }

    // Update runs by provider
    if (record.provider) {
      this.stats.runsByProvider[record.provider] = (this.stats.runsByProvider[record.provider] || 0) + 1;
    }

    this.currentRun = undefined;
    this.save();
  }

  /**
   * Get the current stats
   */
  getStats(): Stats {
    return { ...this.stats };
  }

  /**
   * Get formatted stats for display
   */
  getFormattedStats(): string {
    const s = this.stats;
    const avgSteps = s.totalRuns > 0 ? (s.totalSteps / s.totalRuns).toFixed(1) : '0';
    const avgDuration = s.totalRuns > 0 ? ((s.totalDurationMs / s.totalRuns) / 1000).toFixed(1) : '0';
    const successRate = s.totalRuns > 0 ? ((s.successfulRuns / s.totalRuns) * 100).toFixed(1) : '0';
    const avgTokens = s.totalRuns > 0 ? Math.round(s.totalTokens / s.totalRuns) : 0;

    const lines = [
      '',
      '  🦆 Duck Agent Statistics',
      '',
      `  ${s.totalRuns.toLocaleString()} total runs`,
      `  ${s.successfulRuns.toLocaleString()} successful  •  ${s.failedRuns.toLocaleString()} failed`,
      `  Success rate: ${successRate}%`,
      '',
      '  ─── Performance ───',
      `  Avg steps/run: ${avgSteps}`,
      `  Avg duration: ${avgDuration}s`,
      `  Avg tokens/run: ${avgTokens.toLocaleString()}`,
      '',
      '  ─── Usage ───',
      `  Total tokens: ${s.totalTokens.toLocaleString()}`,
      `  Total cost: $${s.totalCost.toFixed(4)}`,
      '',
    ];

    // Add top models if any
    const topModels = Object.entries(s.runsByModel)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
    
    if (topModels.length > 0) {
      lines.push('  ─── Top Models ───');
      for (const [model, count] of topModels) {
        lines.push(`  ${model}: ${count} runs`);
      }
      lines.push('');
    }

    // Add recent days
    const recentDays = Object.entries(s.runsByDay)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, 5);
    
    if (recentDays.length > 0) {
      lines.push('  ─── Recent Activity ───');
      for (const [day, count] of recentDays) {
        const date = new Date(day).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        lines.push(`  ${date}: ${count} runs`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Print stats to console
   */
  printStats(): void {
    console.log(this.getFormattedStats());
  }

  /**
   * Reset all stats
   */
  reset(): void {
    this.stats = { ...DEFAULT_STATS };
    this.save();
    console.log('✅ Statistics reset');
  }

  /**
   * Get the path to the stats file
   */
  getStatsPath(): string {
    return this.statsPath;
  }

  /**
   * Export stats as JSON
   */
  toJSON(): string {
    return JSON.stringify(this.stats, null, 2);
  }
}

// Singleton instance
let selfMonitorInstance: SelfMonitor | null = null;

export function getSelfMonitor(): SelfMonitor {
  if (!selfMonitorInstance) {
    selfMonitorInstance = new SelfMonitor();
  }
  return selfMonitorInstance;
}
