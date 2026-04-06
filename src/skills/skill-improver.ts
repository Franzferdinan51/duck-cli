/**
 * Duck Agent - Skill Self-Improver
 * Tracks skill usage, success/failure, and auto-improves prompts
 * Works alongside SkillCreator - improves EXISTING skills, doesn't create new ones
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { ProviderManager } from '../providers/manager.js';

export interface SkillExecutionRecord {
  skillName: string;
  triggerPhrase: string;
  success: boolean;
  timestamp: number;
  durationMs: number;
  error?: string;
  feedback?: 'thumbs_up' | 'thumbs_down' | null;
}

export interface SkillHealth {
  name: string;
  totalUses: number;
  successRate: number;
  avgDurationMs: number;
  lastUsed: number;
  consecutiveFailures: number;
  health: 'excellent' | 'good' | 'poor' | 'broken';
  improvementCount: number;
}

export interface ImprovedSkill {
  original: string;
  improved: string;
  changes: string[];
  reason: string;
  timestamp: number;
}

const SKILL_IMPROVE_DIR = join(process.env.HOME || '/tmp', '.duck', 'skills', 'improved');
const EXECUTION_LOG = join(process.env.HOME || '/tmp', '.duck', 'skills', 'execution-log.json');
const IMPROVEMENT_LOG = join(process.env.HOME || '/tmp', '.duck', 'skills', 'improvement-log.json');

export class SkillImprover {
  private executionLog: SkillExecutionRecord[] = [];
  private improvementLog: ImprovedSkill[] = [];
  private consecutiveFailures: Map<string, number> = new Map();
  private improvementThreshold = 5; // Min uses before improving
  private failureWindow = 3;        // Consecutive failures to trigger improvement

  constructor() {
    this.loadExecutionLog();
    this.loadImprovementLog();
  }

  /**
   * Record a skill execution (call after each skill use)
   */
  recordExecution(
    skillName: string,
    triggerPhrase: string,
    success: boolean,
    durationMs: number,
    error?: string
  ): void {
    const record: SkillExecutionRecord = {
      skillName,
      triggerPhrase,
      success,
      timestamp: Date.now(),
      durationMs,
      error
    };

    this.executionLog.push(record);
    this.saveExecutionLog();

    // Track consecutive failures
    if (!success) {
      const current = this.consecutiveFailures.get(skillName) || 0;
      this.consecutiveFailures.set(skillName, current + 1);
    } else {
      this.consecutiveFailures.set(skillName, 0);
    }

    // Check if improvement is needed
    const health = this.getSkillHealth(skillName);
    if (
      health.consecutiveFailures >= this.failureWindow ||
      (health.totalUses >= this.improvementThreshold && health.successRate < 0.6)
    ) {
      this.scheduleImprovement(skillName);
    }
  }

  /**
   * Record user feedback on a skill execution
   */
  recordFeedback(skillName: string, feedback: 'thumbs_up' | 'thumbs_down'): void {
    const lastExec = [...this.executionLog]
      .reverse()
      .find(e => e.skillName === skillName);

    if (lastExec) {
      lastExec.feedback = feedback;
      this.saveExecutionLog();

      if (feedback === 'thumbs_down') {
        // Immediate improvement trigger
        console.log(`\n👎 SkillImprover: Negative feedback for "${skillName}" - scheduling improvement`);
        this.scheduleImprovement(skillName);
      }
    }
  }

  /**
   * Get health metrics for a skill
   */
  getSkillHealth(skillName: string): SkillHealth {
    const records = this.executionLog.filter(r => r.skillName === skillName);
    const recentRecords = records
      .filter(r => r.timestamp > Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
      .slice(-20); // Last 20 uses

    if (recentRecords.length === 0) {
      return {
        name: skillName,
        totalUses: 0,
        successRate: 1.0,
        avgDurationMs: 0,
        lastUsed: 0,
        consecutiveFailures: 0,
        health: 'excellent',
        improvementCount: this.getImprovementCount(skillName)
      };
    }

    const successes = recentRecords.filter(r => r.success).length;
    const successRate = successes / recentRecords.length;
    const avgDurationMs = recentRecords.reduce((sum, r) => sum + r.durationMs, 0) / recentRecords.length;
    const lastUsed = Math.max(...recentRecords.map(r => r.timestamp));
    const consecutiveFailures = this.consecutiveFailures.get(skillName) || 0;

    let health: SkillHealth['health'] = 'excellent';
    if (consecutiveFailures >= this.failureWindow || successRate < 0.3) health = 'broken';
    else if (successRate < 0.6) health = 'poor';
    else if (successRate < 0.8) health = 'good';

    return {
      name: skillName,
      totalUses: recentRecords.length,
      successRate,
      avgDurationMs,
      lastUsed,
      consecutiveFailures,
      health,
      improvementCount: this.getImprovementCount(skillName)
    };
  }

  /**
   * Get all skills with their health metrics
   */
  getAllSkillHealth(): SkillHealth[] {
    const skillNames = new Set(this.executionLog.map(r => r.skillName));
    return Array.from(skillNames).map(name => this.getSkillHealth(name));
  }

  /**
   * Schedule skill for improvement (async, non-blocking)
   */
  private scheduleImprovement(skillName: string): void {
    setTimeout(() => {
      this.improveSkill(skillName).catch(e => {
        console.log(`⚠️  SkillImprover: Failed to improve "${skillName}": ${e.message}`);
      });
    }, 5000); // 5 second delay to not block
  }

  /**
   * Actually improve a skill using LLM analysis
   */
  async improveSkill(skillName: string): Promise<ImprovedSkill | null> {
    const records = this.executionLog
      .filter(r => r.skillName === skillName)
      .slice(-10);

    if (records.length === 0) return null;

    const failures = records.filter(r => !r.success);
    const successes = records.filter(r => r.success);

    const skillPath = this.findSkillPath(skillName);
    if (!skillPath) {
      console.log(`⚠️  SkillImprover: Cannot find skill file for "${skillName}"`);
      return null;
    }

    const originalContent = readFileSync(skillPath, 'utf-8');
    const health = this.getSkillHealth(skillName);

    const provider = new ProviderManager();
    await provider.load(); // Initialize providers before use
    const model = 'minimax/glm-5';

    const analysisPrompt = `Analyze this skill and suggest improvements:

SKILL: ${skillName}
HEALTH: ${health.health} (${Math.round(health.successRate * 100)}% success rate)
RECENT USES: ${records.length}
CONSECUTIVE FAILURES: ${health.consecutiveFailures}

FAILURE EXAMPLES:
${failures.slice(-3).map((f, i) => `[${i + 1}] Trigger: "${f.triggerPhrase}"\n  Error: ${f.error || 'No output'}`).join('\n\n')}

SUCCESS EXAMPLES:
${successes.slice(-2).map((s, i) => `[${i + 1}] Trigger: "${s.triggerPhrase}"`).join('\n')}

CURRENT SKILL:
\`\`\`markdown
${originalContent.slice(0, 1500)}
\`\`\`

Output a JSON object with your analysis:
{
  "changes": ["specific change 1", "specific change 2"],
  "reason": "why these changes will improve the success rate",
  "improved_content": "FULL improved SKILL.md markdown"
}`;

    try {
      const response = await provider.routeWithModel(model, analysisPrompt);
      const content = response.text;
      const improved = this.extractImprovement(content);

      if (improved) {
        // Backup original
        const backupPath = skillPath.replace('.md', `.backup.${Date.now()}.md`);
        writeFileSync(backupPath, originalContent);

        // Write improved version
        writeFileSync(skillPath, improved.improved);
        this.improvementLog.push(improved);
        this.saveImprovementLog();

        console.log(`\n✅ SkillImprover: Improved "${skillName}"`);
        console.log(`   Changes: ${improved.changes.join(', ')}`);
        console.log(`   Backup: ${backupPath}`);

        return improved;
      }
    } catch (e: any) {
      console.log(`⚠️  SkillImprover: LLM failed (${e.message})`);
    }

    return null;
  }

  /**
   * Manually trigger improvement for a skill
   */
  async improveSkillManual(skillName: string): Promise<ImprovedSkill | null> {
    return this.improveSkill(skillName);
  }

  /**
   * Rollback a skill to a previous version
   */
  rollbackSkill(skillName: string, improvementIndex?: number): boolean {
    const skillPath = this.findSkillPath(skillName);
    if (!skillPath) return false;

    const backups = this.findBackups(skillName);
    if (backups.length === 0) return false;

    const targetBackup = improvementIndex !== undefined
      ? backups[improvementIndex]
      : backups[backups.length - 1];

    if (targetBackup) {
      const content = readFileSync(targetBackup, 'utf-8');
      writeFileSync(skillPath, content);
      console.log(`✅ SkillImprover: Rolled back "${skillName}" to ${targetBackup}`);
      return true;
    }
    return false;
  }

  private extractImprovement(content: string): ImprovedSkill | null {
    // Try JSON extraction first
    const jsonMatch = content.match(/\{[\s\S]*?"improved_content"[\s\S]*?\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          original: '',
          improved: parsed.improved_content || parsed.improved || '',
          changes: parsed.changes || [],
          reason: parsed.reason || '',
          timestamp: Date.now()
        };
      } catch { /* fall through */ }
    }

    // Fallback: extract improved_content from markdown
    const mdMatch = content.match(/```markdown\n([\s\S]*?)```/);
    if (mdMatch) {
      return {
        original: '',
        improved: mdMatch[1].trim(),
        changes: ['Auto-improved based on failure analysis'],
        reason: 'Success rate below threshold',
        timestamp: Date.now()
      };
    }

    return null;
  }

  private findSkillPath(skillName: string): string | null {
    const searchDirs = [
      join(process.env.HOME || '/tmp', '.duck', 'skills', 'auto', skillName, 'SKILL.md'),
      join(process.env.HOME || '/tmp', '.duck', 'skills', skillName, 'SKILL.md'),
      join('.', 'skills', skillName, 'SKILL.md')
    ];

    for (const path of searchDirs) {
      if (existsSync(path)) return path;
    }
    return null;
  }

  private findBackups(skillName: string): string[] {
    const autoDir = join(process.env.HOME || '/tmp', '.duck', 'skills', 'auto', skillName);
    if (!existsSync(autoDir)) return [];

    const { readdirSync } = require('fs');
    return readdirSync(autoDir)
      .filter(f => f.includes('.backup.'))
      .map(f => join(autoDir, f))
      .sort();
  }

  private getImprovementCount(skillName: string): number {
    return this.improvementLog.filter(i => i.improved.includes(skillName)).length;
  }

  private loadExecutionLog(): void {
    try {
      if (existsSync(EXECUTION_LOG)) {
        this.executionLog = JSON.parse(readFileSync(EXECUTION_LOG, 'utf-8'));
      }
    } catch { this.executionLog = []; }
  }

  private saveExecutionLog(): void {
    try {
      const dir = EXECUTION_LOG.replace('/execution-log.json', '');
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      writeFileSync(EXECUTION_LOG, JSON.stringify(this.executionLog.slice(-500), null, 2));
    } catch { /* ignore */ }
  }

  private loadImprovementLog(): void {
    try {
      if (existsSync(IMPROVEMENT_LOG)) {
        this.improvementLog = JSON.parse(readFileSync(IMPROVEMENT_LOG, 'utf-8'));
      }
    } catch { this.improvementLog = []; }
  }

  private saveImprovementLog(): void {
    try {
      const dir = IMPROVEMENT_LOG.replace('/improvement-log.json', '');
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      writeFileSync(IMPROVEMENT_LOG, JSON.stringify(this.improvementLog.slice(-50), null, 2));
    } catch { /* ignore */ }
  }

  getStats(): { totalRecords: number; skillsTracked: number; improvementsMade: number } {
    return {
      totalRecords: this.executionLog.length,
      skillsTracked: new Set(this.executionLog.map(r => r.skillName)).size,
      improvementsMade: this.improvementLog.length
    };
  }
}

// Singleton
let instance: SkillImprover | null = null;

export function getSkillImprover(): SkillImprover {
  if (!instance) {
    instance = new SkillImprover();
  }
  return instance;
}
