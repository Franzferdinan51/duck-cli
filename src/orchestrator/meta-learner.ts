/**
 * duck-cli v3 - MetaLearner
 * Logs session experiences. Planner reads these to improve future plans.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { SessionExperience } from './meta-types.js';

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
