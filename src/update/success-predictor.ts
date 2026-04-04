/**
 * 🦆 Success Predictor - Predicts update success based on learned patterns
 */
import { updateMemory } from './update-memory';
import { ClassifiedUpdate } from './update-classifier';

export interface SuccessPrediction {
  willSucceed: boolean;
  confidence: number;
  riskFactors: string[];
  successFactors: string[];
  recommendedActions: string[];
  predictedDuration: number;
  similarUpdates: SimilarUpdate[];
}

export interface SimilarUpdate {
  source: string;
  version: string;
  success: boolean;
  date: Date;
  similarity: number;
  lessons: string[];
}

const TIME_RISK: Record<number, number> = { 0: 0.3, 1: 0.2, 2: 0.1, 3: 0.1, 4: 0.2, 5: 0.3, 6: 0.5, 7: 0.6, 8: 0.7, 9: 0.8, 10: 0.9, 11: 0.8, 12: 0.7, 13: 0.6, 14: 0.5, 15: 0.4, 16: 0.5, 17: 0.6, 18: 0.7, 19: 0.8, 20: 0.9, 21: 0.8, 22: 0.6, 23: 0.4 };
const DAY_RISK: Record<number, number> = { 0: 0.6, 1: 0.5, 2: 0.3, 3: 0.4, 4: 0.5, 5: 0.7, 6: 0.8 };

export class SuccessPredictor {
  predict(source: string, currentVersion: string, newVersion: string, classification: ClassifiedUpdate, dependencies: string[] = []): SuccessPrediction {
    const memories = updateMemory.getBySource(source);
    const total = memories.length;
    const successful = memories.filter(m => m.success).length;
    const histRate = total > 0 ? successful / total : 0.75;
    const now = new Date();
    const hour = now.getHours();
    const day = now.getDay();
    const versionRisk = this.calcVersionRisk(currentVersion, newVersion);
    const depRisk = this.calcDepRisk(dependencies, classification);
    const timeRisk = TIME_RISK[hour] || 0.5;
    const dayRisk = DAY_RISK[day] || 0.5;
    let prob = histRate;
    prob *= (1 - timeRisk * 0.1);
    prob *= (1 - versionRisk * 0.3);
    prob *= (1 - depRisk * 0.2);
    prob *= (1 - (classification.type === 'breaking' ? 0.5 : 0.1));
    const similar = this.findSimilar(source, currentVersion, newVersion, classification);
    if (similar.length > 0) {
      const simRate = similar.filter(s => s.success).length / similar.length;
      prob = prob * 0.6 + simRate * 0.4;
    }
    prob = Math.max(0.05, Math.min(0.95, prob));
    const confidence = Math.min(0.3 + similar.length * 0.1 + (histRate !== 0.75 ? 0.2 : 0), 0.95);
    const riskFactors: string[] = [];
    const successFactors: string[] = [];
    if (histRate < 0.7) riskFactors.push(`Historical success: ${(histRate * 100).toFixed(0)}%`);
    else successFactors.push(`Historical success: ${(histRate * 100).toFixed(0)}%`);
    if (versionRisk > 0.5) riskFactors.push('Major version jump');
    else if (versionRisk === 0) successFactors.push('Low version jump risk');
    if (timeRisk > 0.7) riskFactors.push('Peak usage hours');
    else if (timeRisk < 0.3) successFactors.push('Low-usage hours');
    if (classification.type === 'breaking') riskFactors.push('Breaking changes');
    const actions: string[] = [];
    if (prob >= 0.8) actions.push('High success probability - safe to proceed');
    else if (prob >= 0.6) { actions.push('Moderate success - monitor closely'); actions.push('Prepare rollback plan'); }
    else if (prob >= 0.4) { actions.push('Uncertain - use backup-first'); actions.push('Test first'); }
    else { actions.push('Low success - delay if possible'); actions.push('Ensure full backup'); }
    if (versionRisk > 0.5) actions.push('Review migration guide');
    if (timeRisk > 0.7) actions.push('Consider scheduling for off-peak');
    const duration = 30000 + dependencies.length * 5000 + (classification.type === 'breaking' ? 120000 : classification.type === 'feature' ? 60000 : 0);
    return { willSucceed: prob >= 0.5, confidence, riskFactors, successFactors, recommendedActions: actions, predictedDuration: duration, similarUpdates: similar.slice(0, 5) };
  }

  private calcVersionRisk(current: string, next: string): number {
    const cm = current.match(/^(\d+)\./)?.[1];
    const nm = next.match(/^(\d+)\./)?.[1];
    if (!cm || !nm) return 0.3;
    const diff = parseInt(nm) - parseInt(cm);
    if (diff > 0) return 0.9;
    if (diff < 0) return 0.5;
    return 0;
  }

  private calcDepRisk(deps: string[], classification: ClassifiedUpdate): number {
    if (deps.length === 0) return 0;
    const depRisk = Math.min(deps.length / 20, 1);
    const typeRisk = classification.type === 'breaking' ? 0.7 : classification.type === 'feature' ? 0.4 : 0.2;
    return (depRisk + typeRisk) / 2;
  }

  private findSimilar(source: string, current: string, next: string, classification: ClassifiedUpdate): SimilarUpdate[] {
    const memories = updateMemory.getBySource(source);
    const curMaj = parseInt(current.split('.')[0]) || 0;
    const nextMaj = parseInt(next.split('.')[0]) || 0;
    return memories
      .filter(m => {
        const mMaj = parseInt(m.version.split('.')[0]) || 0;
        return Math.abs(mMaj - curMaj) <= 1 || Math.abs(mMaj - nextMaj) <= 1;
      })
      .map(m => {
        let sim = 0.5;
        if (m.changes.some(c => c.toLowerCase().includes(classification.type))) sim += 0.2;
        if (m.issues.some(i => i.toLowerCase().includes('break'))) sim += 0.15;
        return { source: m.source, version: m.version, success: m.success, date: new Date(m.timestamp), similarity: Math.min(sim, 1), lessons: m.lessons.slice(0, 2) };
      })
      .sort((a, b) => b.similarity - a.similarity);
  }
}

export const successPredictor = new SuccessPredictor();
