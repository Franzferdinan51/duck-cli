/**
 * 🦆 Feedback Loop - Gathers feedback after updates and continuously improves
 */
import { updateMemory, FeedbackItem } from './update-memory';
import { adaptiveStrategy, AdaptiveStrategyEngine } from './adaptive-strategy';

export interface UpdateOutcome {
  source: string;
  version: string;
  success: boolean;
  timestamp: Date;
  duration: number;
  issues: string[];
  lessons: string[];
  exitCode?: number;
  error?: string;
}

export interface FeedbackRequest {
  type: 'issue'  | 'conflict' | 'improvement';
  description: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
}

export class FeedbackLoop {
  private strategyEngine: AdaptiveStrategyEngine;
  private lastDailyReview: Date | null = null;
  private lastWeeklyReview: Date | null = null;
  private lastMonthlyReview: Date | null = null;

  constructor(strategyEngine?: AdaptiveStrategyEngine) {
    this.strategyEngine = strategyEngine || adaptiveStrategy;
    this.loadState();
  }

  private loadState(): void {
    try {
      const { existsSync, readFileSync } = require('fs');
      const path = `${process.env.HOME}/.duck/update-review-state.json`;
      if (existsSync(path)) {
        const state = JSON.parse(readFileSync(path, 'utf-8'));
        this.lastDailyReview = state.lastDailyReview ? new Date(state.lastDailyReview) : null;
        this.lastWeeklyReview = state.lastWeeklyReview ? new Date(state.lastWeeklyReview) : null;
        this.lastMonthlyReview = state.lastMonthlyReview ? new Date(state.lastMonthlyReview) : null;
      }
    } catch (e) {
      console.error('[FeedbackLoop] Failed to load state:', e instanceof Error ? e.message : e);
    }
  }

  private saveState(): void {
    try {
      const { existsSync, mkdirSync, writeFileSync } = require('fs');
      const path = `${process.env.HOME}/.duck/update-review-state.json`;
      const dir = require('path').dirname(path);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      writeFileSync(path, JSON.stringify({
        lastDailyReview: this.lastDailyReview?.toISOString(),
        lastWeeklyReview: this.lastWeeklyReview?.toISOString(),
        lastMonthlyReview: this.lastMonthlyReview?.toISOString()
      }, null, 2), 'utf-8');
    } catch (e) {
      console.error('[FeedbackLoop] Failed to save state:', e instanceof Error ? e.message : e);
    }
  }

  async gatherFeedback(outcome: UpdateOutcome): Promise<void> {
    console.log(`[feedback-loop] Recording feedback for ${outcome.source}@${outcome.version}`);
    this.recordOutcome(outcome);
    const patterns = this.analyzePatterns(outcome);
    if (!outcome.success) this.strategyEngine.adaptFromOutcome(outcome.source, outcome.version, false, outcome.issues);
    await this.checkPeriodicReviews();
    console.log(`[feedback-loop] Feedback recorded. ${patterns.length} patterns identified.`);
  }

  private recordOutcome(outcome: UpdateOutcome): void {
    const memory = updateMemory.getLatest(outcome.source);
    if (memory) {
      memory.success = outcome.success;
      memory.duration = outcome.duration;
      memory.issues.push(...outcome.issues);
      memory.lessons.push(...outcome.lessons);
      if (outcome.success) memory.lessons.push(`Successful update of ${outcome.source} to ${outcome.version}`);
      else {
        memory.lessons.push(`Failed update of ${outcome.source} to ${outcome.version}`);
        memory.lessons.push(...this.extractFailureLessons(outcome));
        if (outcome.error) memory.issues.push(`Error: ${outcome.error}`);
      }
      updateMemory.record(memory);
    }
  }

  private extractFailureLessons(outcome: UpdateOutcome): string[] {
    const lessons: string[] = [];
    if (outcome.error) {
      if (outcome.error.includes('peer')) lessons.push('Peer dependency issue - check versions');
      if (outcome.error.includes('ENOENT')) lessons.push('Missing file or dependency');
      if (outcome.error.includes('timeout')) lessons.push('Timeout occurred - may need retry');
      if (outcome.error.includes('permission')) lessons.push('Permission denied - check permissions');
      if (outcome.error.includes('EADDRINUSE')) lessons.push('Port conflict - stop existing process');
    }
    outcome.issues.forEach(issue => {
      const lower = issue.toLowerCase();
      if (lower.includes('break')) lessons.push('Breaking change - should have used backup-first');
      if (lower.includes('peer')) lessons.push('Dependency conflict - resolve peer dependencies');
    });
    return lessons;
  }

  private analyzePatterns(outcome: UpdateOutcome): string[] {
    const patterns: string[] = [];
    const memories = updateMemory.getBySource(outcome.source);
    const recent = memories.slice(-10);
    if (recent.length >= 3) {
      const avgDur = recent.reduce((sum, m) => sum + (m.duration || 0), 0) / recent.length;
      if (outcome.duration > avgDur * 1.5) patterns.push('Update took longer than usual');
      if (outcome.duration < avgDur * 0.5 && !outcome.success) patterns.push('Failed quickly - immediate error');
    }
    const issueFreq = new Map<string, number>();
    memories.forEach(m => m.issues.forEach(issue => issueFreq.set(issue.substring(0, 50), (issueFreq.get(issue.substring(0, 50)) || 0) + 1)));
    issueFreq.forEach((count, issue) => { if (count >= 3) patterns.push(`Recurring issue: "${issue.substring(0, 50)}..." (${count}x)`); });
    return patterns;
  }

  async checkPeriodicReviews(): Promise<void> {
    const now = new Date();
    const dayMs = 24 * 60 * 60 * 1000;
    const weekMs = 7 * dayMs;
    const monthMs = 30 * dayMs;
    if (!this.lastDailyReview || now.getTime() - this.lastDailyReview.getTime() > dayMs) { await this.performDailyReview(); this.lastDailyReview = now; this.saveState(); }
    if (!this.lastWeeklyReview || now.getTime() - this.lastWeeklyReview.getTime() > weekMs) { await this.performWeeklyReview(); this.lastWeeklyReview = now; this.saveState(); }
    if (!this.lastMonthlyReview || now.getTime() - this.lastMonthlyReview.getTime() > monthMs) { await this.performMonthlyReview(); this.lastMonthlyReview = now; this.saveState(); }
  }

  private async performDailyReview(): Promise<void> {
    console.log('[feedback-loop] Daily review...');
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recent = updateMemory.getAll().filter(m => new Date(m.timestamp) > yesterday);
    if (recent.length === 0) { console.log('[feedback-loop] No updates in 24h'); return; }
    const failed = recent.filter(m => !m.success);
    if (failed.length > 0) { console.log(`[feedback-loop] ${failed.length} failed in last 24h`); failed.forEach(f => this.strategyEngine.adaptFromOutcome(f.source, f.version, false, f.issues)); }
  }

  private async performWeeklyReview(): Promise<void> {
    console.log('[feedback-loop] Weekly review...');
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recent = updateMemory.getAll().filter(m => new Date(m.timestamp) > weekAgo);
    if (recent.length === 0) return;
    const rate = recent.filter(m => m.success).length / recent.length;
    console.log(`[feedback-loop] Weekly: ${recent.length} updates, ${(rate * 100).toFixed(0)}% success`);
    const issueCounts = new Map<string, number>();
    recent.flatMap(m => m.issues).forEach(issue => issueCounts.set(issue.substring(0, 30), (issueCounts.get(issue.substring(0, 30)) || 0) + 1));
    const common = Array.from(issueCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
    if (common.length > 0 && common[0][1] >= 3) { console.log(`[feedback-loop] Recurring issue - disabling auto-update`); this.strategyEngine.updateConfig({ allowAutoUpdate: false }); }
  }

  private async performMonthlyReview(): Promise<void> {
    console.log('[feedback-loop] Monthly review...');
    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recent = updateMemory.getAll().filter(m => new Date(m.timestamp) > monthAgo);
    if (recent.length === 0) return;
    const stats = updateMemory.getStats();
    console.log(`[feedback-loop] Monthly: ${recent.length} updates, ${(stats.successRate * 100).toFixed(0)}% success`);
    if (stats.successRate >= 0.9) { console.log('[feedback-loop] High success - re-enabling auto-update'); this.strategyEngine.updateConfig({ allowAutoUpdate: true }); }
    else if (stats.successRate < 0.7) { console.log('[feedback-loop] Low success - keeping conservative'); }
  }

  processUserFeedback(source: string, version: string, feedback: FeedbackRequest): void {
    const item: FeedbackItem = { timestamp: new Date(), type: feedback.type, description: feedback.description, resolved: false };
    updateMemory.addFeedback(source, version, item);
    if (feedback.type === 'issue') {
      const memories = updateMemory.getBySource(source);
      const memory = memories.find(m => m.version === version);
      if (memory) this.strategyEngine.adaptFromOutcome(source, version, memory.success, [feedback.description]);
    }
    console.log(`[feedback-loop] Feedback recorded: ${feedback.type} - ${feedback.description}`);
  }

  getPendingFeedback(): { source: string; version: string; feedback: FeedbackItem[] }[] {
    return updateMemory.getAll().map(m => ({ source: m.source, version: m.version, feedback: m.feedback.filter(f => !f.resolved) })).filter(p => p.feedback.length > 0);
  }

  resolveFeedback(source: string, version: string, index: number, resolution: string): void {
    const memories = updateMemory.getBySource(source);
    const memory = memories.find(m => m.version === version);
    if (memory && memory.feedback[index]) {
      memory.feedback[index].resolved = true;
      memory.feedback[index].resolution = resolution;
      memory.lessons.push(`Resolved: ${memory.feedback[index].description} → ${resolution}`);
      updateMemory.record(memory);
    }
  }
}

export const feedbackLoop = new FeedbackLoop();
