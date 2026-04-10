/**
 * duck-cli v3 - MetaLearner
 * Logs session experiences. Planner reads these to improve future plans.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { SessionExperience, Plan } from './meta-types.js';
import Database from '../vendor/better-sqlite3.js';

export class MetaLearner {
  private experiencePath: string;
  private maxExperiences: number;

  constructor(experiencePath = './experiences', maxExperiences = 500) {
    this.experiencePath = experiencePath;
    this.maxExperiences = maxExperiences;
    this.ensureDir();
  }

  log(experience: SessionExperience): void {
    try {
      const experiences = this.load();
      experiences.push({ ...experience, timestamp: Date.now() });
      const trimmed = experiences.slice(-this.maxExperiences);
      this.save(trimmed);
      console.log(`[MetaLearner] 📝 Logged: ${experience.taskPrompt.substring(0, 50)} → ${experience.outcome}`);
    } catch (e) {
      console.log(`[MetaLearner] ⚠️  Failed to log: ${e}`);
    }
  }

  getRecentLessons(taskType: string, limit = 5): string[] {
    const experiences = this.load();
    const relevant = experiences
      .filter(e => e.taskPrompt.toLowerCase().includes(taskType.toLowerCase()))
      .slice(-limit);

    return relevant.map(e => {
      const stepSummary = e.steps.map(s => (s.success ? '✅' : '❌') + ' [' + s.action + ']').join(' → ');
      return `[${e.outcome}] ${e.taskPrompt}: ${stepSummary}`;
    });
  }

  getToolStats(toolName: string): { attempts: number; successes: number; avgTimeMs: number } {
    const experiences = this.load();
    const relevant = experiences.flatMap(e =>
      e.steps.filter(s => s.toolUsed === toolName)
    );

    return {
      attempts: relevant.length,
      successes: relevant.filter(s => s.success).length,
      avgTimeMs: relevant.length > 0
        ? relevant.reduce((sum, s) => sum + s.durationMs, 0) / relevant.length
        : 0,
    };
  }

  getPlannerContext(taskPrompt: string): string {
    const words = taskPrompt.toLowerCase().split(/\s+/);
    const keyTerms = words.filter(w => w.length > 4);
    if (keyTerms.length === 0) return '';

    const lessons = this.getRecentLessons(keyTerms.slice(0, 3).join(' '), 3);
    if (lessons.length === 0) return '';

    return '\nRelevant past experiences:\n' + lessons.map(l => '• ' + l).join('\n');
  }

  /**
   * Log a failure from FailureReporter so MetaLearner/Planner can use it.
   * Also forwards to LearningLoop (SQLite) for long-term pattern tracking.
   */
  logFailure(opts: {
    source: string;
    message: string;
    toolName?: string;
    providerName?: string;
    severity?: string;
    diagnosis?: string;
    recoveryAction?: string;
    occurrenceCount?: number;
    timestamp: number;
    sessionId?: string;
  }): void {
    try {
      const experiences = this.load();
      const exp: SessionExperience = {
        taskPrompt: `[${opts.source}] ${opts.message}`,
        outcome: 'failed',
        plan: { taskId: '', complexity: 0, approach: opts.source, steps: [], provider: '', model: '', reasoning: '', estimatedTotalTimeMs: 0, estimatedTotalCost: 0, parallelizable: false, confidence: 0 },
        steps: [],
        totalTimeMs: 0,
        totalCost: 0,
        lessonsLearned: opts.diagnosis ? `Diagnosis: ${opts.diagnosis} | Recovery: ${opts.recoveryAction || 'none'}` : undefined,
        timestamp: opts.timestamp,
      };
      experiences.push(exp);
      const trimmed = experiences.slice(-this.maxExperiences);
      this.save(trimmed);
      console.log(`[MetaLearner] 📝 Logged failure: [${opts.source}] ${opts.message.substring(0, 50)}`);
    } catch (e) {
      console.log(`[MetaLearner] ⚠️  Failed to log: ${e}`);
    }

    // Also forward to LearningLoop SQLite if available
    this.forwardToLearningLoop(opts);
  }

  private forwardToLearningLoop(opts: {
    source: string;
    message: string;
    toolName?: string;
    providerName?: string;
    severity?: string;
    occurrenceCount?: number;
    timestamp: number;
    sessionId?: string;
  }): void {
    try {
      const llPath = join(homedir(), '.duck', 'learning', 'learning.db');
      if (!existsSync(llPath)) return;
      const ll = new Database(llPath);
      ll.pragma('journal_mode = WAL');
      const inputStr = `[${opts.source}] ${opts.toolName || opts.providerName || opts.source}: ${opts.message}`;
      const outputStr = `Severity: ${opts.severity || 'unknown'}, Occurred: ${opts.occurrenceCount || 1}x`;
      ll.prepare(`
        INSERT INTO interactions (id, session_id, input, output, outcome, tools_used, duration, feedback, timestamp)
        VALUES (?, ?, ?, ?, 'failed', '[]', 0, ?, ?)
      `).run(
        `fail_${opts.timestamp}_${Math.random().toString(36).slice(2, 6)}`,
        opts.sessionId || 'default',
        inputStr.slice(0, 10000),
        outputStr.slice(0, 50000),
        JSON.stringify({ type: 'system_failure', source: opts.source, severity: opts.severity }),
        opts.timestamp
      );
      ll.close();
    } catch { /* non-fatal */ }
  }


  private ensureDir(): void {
    try { mkdirSync(this.experiencePath, { recursive: true }); } catch {}
  }

  private load(): SessionExperience[] {
    try {
      const indexFile = join(this.experiencePath, 'index.json');
      if (!existsSync(indexFile)) return [];
      return JSON.parse(readFileSync(indexFile, 'utf8'));
    } catch {
      return [];
    }
  }

  private save(experiences: SessionExperience[]): void {
    try {
      writeFileSync(join(this.experiencePath, 'index.json'), JSON.stringify(experiences, null, 2));
    } catch {}
  }
}
