/**
 * 🦆 Update Classifier - Classifies updates by type and risk level
 */
import { updateMemory } from './update-memory';

export type UpdateType = 'security' | 'bugfix' | 'feature' | 'breaking' | 'refactor' | 'dependency' | 'docs' | 'performance' | 'unknown';

export interface ClassifiedUpdate {
  type: UpdateType;
  risk: 'low' | 'medium' | 'high';
  autoUpdate: boolean;
  reason: string;
  dependencies: string[];
  indicators: string[];
  confidence: number;
}

const TYPE_KEYWORDS: Record<UpdateType, string[]> = {
  security: ['security', 'vulnerability', 'cve-', 'exploit', 'patch', 'malicious', 'injection', 'xss', 'csrf', 'auth bypass', 'sanitize', 'encrypt', 'hash'],
  bugfix: ['bug', 'fix', 'fixes', 'fixed', 'hotfix', 'issue', 'problem', 'error', 'crash', 'typo', 'regression'],
  breaking: ['breaking', 'breaking change', 'migration', 'deprecated', 'remove', 'delete', 'rename', 'api change', 'major version'],
  feature: ['feature', 'new', 'add', 'introduce', 'enhancement', 'support', 'capability'],
  refactor: ['refactor', 'restructure', 'rewrite', 'cleanup', 'simplify', 'architecture'],
  dependency: ['update', 'bump', 'upgrade', 'pin', 'version', 'dependency', 'peer', 'devdep'],
  docs: ['docs', 'documentation', 'readme', 'changelog', 'comment', 'example', 'guide'],
  performance: ['perf', 'performance', 'speed', 'fast', 'optimize', 'cache', 'memory'],
  unknown: []
};

const HIGH_RISK_PATTERNS = [/major/i, /breaking/i, /migration/i, /v(\d+)\./];

export class UpdateClassifier {
  classify(changelog: string, currentVersion: string, newVersion: string, source?: string): ClassifiedUpdate {
    const text = `${changelog} ${currentVersion} ${newVersion}`.toLowerCase();
    const scores: Record<string, number> = {};

    for (const [type, keywords] of Object.entries(TYPE_KEYWORDS)) {
      scores[type] = keywords.filter(k => text.includes(k.toLowerCase())).length;
    }

    const versionMatch = newVersion.match(/^(\d+)\.(\d+)\.(\d+)/);
    if (versionMatch) {
      const [major, minor] = [versionMatch[1], versionMatch[2]].map(Number);
      if (major > 0) scores['breaking'] = (scores['breaking'] || 0) + 3;
      if (minor === 0) scores['feature'] = (scores['feature'] || 0) + 1;
    }

    for (const pattern of HIGH_RISK_PATTERNS) {
      if (pattern.test(text)) scores['breaking'] = (scores['breaking'] || 0) + 2;
    }

    if (source) {
      const failed = updateMemory.getBySource(source).filter(m => !m.success);
      if (failed.length > 0) scores['breaking'] = (scores['breaking'] || 0) + failed.length;
    }

    let bestType: UpdateType = 'unknown';
    let bestScore = 0;
    for (const [type, score] of Object.entries(scores)) {
      if (score > bestScore) { bestScore = score; bestType = type as UpdateType; }
    }

    const risk = this.calcRisk(bestType, scores, currentVersion, newVersion);
    const autoUpdate = this.canAuto(bestType, risk);
    const confidence = Math.min(bestScore / 5, 1);

    return {
      type: bestType,
      risk,
      autoUpdate,
      confidence,
      reason: `${bestType} update - ${risk} risk (${currentVersion} → ${newVersion})`,
      dependencies: this.extractDeps(changelog),
      indicators: Object.entries(scores).filter(([, s]) => s > 0).map(([t]) => `[${t}]`).slice(0, 5)
    };
  }

  private calcRisk(type: UpdateType, scores: Record<string, number>, current: string, next: string): 'low' | 'medium' | 'high' {
    if (type === 'docs' || type === 'refactor') return 'low';
    if (type === 'security') return 'medium';
    if (scores['breaking'] > 2) return 'high';
    const cm = current.match(/^(\d+)\./)?.[1];
    const nm = next.match(/^(\d+)\./)?.[1];
    if (cm && nm && parseInt(nm) > parseInt(cm)) return 'high';
    return 'medium';
  }

  private canAuto(type: UpdateType, risk: 'low' | 'medium' | 'high'): boolean {
    if (risk === 'high') return false;
    return type === 'docs' || type === 'refactor' || type === 'bugfix' || risk === 'low';
  }

  private extractDeps(changelog: string): string[] {
    const deps: string[] = [];
    changelog.match(/@[\w-]+\/[\w-]+/g)?.forEach(d => deps.push(d));
    changelog.match(/[\w-]+@[\d.]+/g)?.forEach(d => deps.push(d));
    return Array.from(new Set(deps));
  }
}

export const updateClassifier = new UpdateClassifier();
