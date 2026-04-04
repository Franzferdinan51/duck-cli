/**
 * 🦆 Learning Update Memory System
 * Tracks update history, learns from outcomes, and adapts behavior
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';

const MEMORY_FILE = join(homedir(), '.duck', 'update-memory.json');

export interface FeedbackItem {
  timestamp: Date;
  type: 'issue' | 'improvement' | 'conflict';
  description: string;
  resolved: boolean;
  resolution?: string;
}

export interface UpdateMemory {
  source: string;
  version: string;
  timestamp: Date;
  success: boolean;
  changes: string[];
  issues: string[];
  rollbackPerformed: boolean;
  lessons: string[];
  feedback: FeedbackItem[];
  duration?: number;
  dependencies: string[];
  tags: string[];
}

export interface LearningStats {
  totalUpdates: number;
  successfulUpdates: number;
  failedUpdates: number;
  rollbackCount: number;
  successRate: number;
  averageDuration: number;
  mostCommonIssues: string[];
  mostCommonSource: string;
  learningCount: number;
  lastUpdate: Date | null;
  patternInsights: PatternInsight[];
}

export interface PatternInsight {
  pattern: string;
  occurrence: number;
  successRate: number;
  recommendation: string;
}

export class UpdateMemoryStore {
  private memoryPath: string;
  private memories: UpdateMemory[] = [];
  private statsCache: LearningStats | null = null;

  constructor(memoryPath?: string) {
    this.memoryPath = memoryPath || MEMORY_FILE;
    this.load();
  }

  private load(): void {
    try {
      if (existsSync(this.memoryPath)) {
        const data = JSON.parse(readFileSync(this.memoryPath, 'utf-8'));
        this.memories = data.memories.map((m: any) => ({
          ...m,
          timestamp: new Date(m.timestamp),
          feedback: m.feedback.map((f: any) => ({ ...f, timestamp: new Date(f.timestamp) }))
        }));
      }
    } catch { this.memories = []; }
  }

  private save(): void {
    try {
      const dir = dirname(this.memoryPath);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      writeFileSync(this.memoryPath, JSON.stringify({ memories: this.memories }, null, 2), 'utf-8');
      this.statsCache = null;
    } catch {}
  }

  record(memory: Omit<UpdateMemory, 'feedback'> & { feedback?: FeedbackItem[] }): void {
    const record: UpdateMemory = {
      ...memory,
      feedback: memory.feedback || [],
      lessons: memory.lessons || [],
      issues: memory.issues || [],
      changes: memory.changes || [],
      dependencies: memory.dependencies || [],
      tags: memory.tags || []
    };
    this.memories.push(record);
    this.extractLessons(record);
    this.save();
  }

  addFeedback(source: string, version: string, feedback: FeedbackItem): void {
    const memory = this.memories.find(m => m.source === source && m.version === version);
    if (memory) {
      memory.feedback.push(feedback);
      if (feedback.resolved) memory.lessons.push(`Resolved: ${feedback.description} → ${feedback.resolution}`);
      this.save();
    }
  }

  getAll(): UpdateMemory[] { return [...this.memories]; }
  getBySource(source: string): UpdateMemory[] { return this.memories.filter(m => m.source === source); }

  getLatest(source: string): UpdateMemory | undefined {
    return this.getBySource(source).sort((a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )[0];
  }

  getStats(): LearningStats {
    if (this.statsCache) return this.statsCache;
    const successful = this.memories.filter(m => m.success);
    const failed = this.memories.filter(m => !m.success);
    const withRollback = this.memories.filter(m => m.rollbackPerformed);
    const issueCounts = new Map<string, number>();
    this.memories.forEach(m => m.issues.forEach(issue => issueCounts.set(issue, (issueCounts.get(issue) || 0) + 1)));
    const mostCommonIssues = Array.from(issueCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([issue]) => issue);
    const sourceCounts = new Map<string, number>();
    this.memories.forEach(m => sourceCounts.set(m.source, (sourceCounts.get(m.source) || 0) + 1));
    const mostCommonSource = Array.from(sourceCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || 'none';
    const withDuration = this.memories.filter(m => m.duration);
    const averageDuration = withDuration.length > 0 ? withDuration.reduce((sum, m) => sum + (m.duration || 0), 0) / withDuration.length : 0;
    this.statsCache = {
      totalUpdates: this.memories.length,
      successfulUpdates: successful.length,
      failedUpdates: failed.length,
      rollbackCount: withRollback.length,
      successRate: this.memories.length > 0 ? successful.length / this.memories.length : 0,
      averageDuration,
      mostCommonIssues,
      mostCommonSource,
      learningCount: this.memories.reduce((sum, m) => sum + m.lessons.length, 0),
      lastUpdate: this.memories.length > 0 ? new Date(Math.max(...this.memories.map(m => new Date(m.timestamp).getTime()))) : null,
      patternInsights: this.extractPatternInsights()
    };
    return this.statsCache;
  }

  private extractLessons(memory: UpdateMemory): void {
    if (memory.success && memory.changes.length > 0) memory.lessons.push(`Successfully updated ${memory.source} from ${memory.version}`);
    memory.issues.forEach(issue => {
      if (issue.includes('peer')) memory.lessons.push(`Peer dependency issue with ${memory.source}@${memory.version}`);
      if (issue.includes('break')) memory.lessons.push(`Breaking change detected in ${memory.source}@${memory.version}`);
    });
    if (memory.rollbackPerformed) memory.lessons.push(`Rollback performed for ${memory.source}@${memory.version} - needs backup-first approach`);
  }

  private extractPatternInsights(): PatternInsight[] {
    const insights: PatternInsight[] = [];
    const majorUpdates = this.memories.filter(m => { const match = m.version.match(/^(\d+)\./); return match && parseInt(match[1]) > 0; });
    if (majorUpdates.length > 0) {
      const rate = majorUpdates.filter(m => m.success).length / majorUpdates.length;
      insights.push({ pattern: 'Major version updates', occurrence: majorUpdates.length, successRate: rate, recommendation: rate < 0.7 ? 'Use backup-first approach' : 'Relatively safe' });
    }
    const highDepUpdates = this.memories.filter(m => m.dependencies.length > 10);
    if (highDepUpdates.length > 0) {
      const rate = highDepUpdates.filter(m => m.success).length / highDepUpdates.length;
      insights.push({ pattern: 'Updates with >10 dependencies', occurrence: highDepUpdates.length, successRate: rate, recommendation: rate < 0.8 ? 'Use staged approach' : 'Manageable' });
    }
    const nightUpdates = this.memories.filter(m => { const hour = new Date(m.timestamp).getHours(); return hour >= 22 || hour < 6; });
    if (nightUpdates.length > 3) {
      const rate = nightUpdates.filter(m => m.success).length / nightUpdates.length;
      insights.push({ pattern: 'Night-time updates (10PM-6AM)', occurrence: nightUpdates.length, successRate: rate, recommendation: rate > 0.9 ? 'Consider scheduling' : 'No advantage' });
    }
    return insights;
  }

  findSimilar(source: string, version: string, changes: string[]): UpdateMemory[] {
    return this.memories.filter(m => {
      if (m.source !== source) return false;
      const thisMajor = parseInt(version.split('.')[0]);
      const thatMajor = parseInt(m.version.split('.')[0]);
      if (Math.abs(thisMajor - thatMajor) > 1) return false;
      const commonChanges = m.changes.filter(c => changes.some(change => c.toLowerCase().includes(change.toLowerCase().substring(0, 20))));
      return commonChanges.length > 0;
    });
  }

  prune(keepLast: number = 100): void {
    if (this.memories.length > keepLast) {
      this.memories = this.memories.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, keepLast);
      this.save();
    }
  }
}

export const updateMemory = new UpdateMemoryStore();
