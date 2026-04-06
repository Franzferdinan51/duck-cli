/**
 * 🦆 Adaptive Strategy - Determines update approach based on type, risk, and learned patterns
 */
import { SuccessPrediction } from './success-predictor';
import { ClassifiedUpdate } from './update-classifier';
import { updateMemory } from './update-memory';

export type UpdateApproach = 'auto' | 'review' | 'backup-first' | 'skip';

export interface UpdateStrategy {
  shouldUpdate: boolean;
  approach: UpdateApproach;
  steps: string[];
  rollbackPlan: string;
  monitoringPlan: string[];
  estimatedRisk: number;
  estimatedTime: number;
  warnings: string[];
}

export interface StrategyConfig {
  allowAutoUpdate: boolean;
  requireBackupSources: string[];
  offPeakHoursOnly: boolean;
  offPeakHoursStart: number;
  offPeakHoursEnd: number;
  maxRiskTolerance: number;
  securityUpdateBehavior: 'immediate' | 'within-24h' | 'manual';
}

const DEFAULT_CONFIG: StrategyConfig = {
  allowAutoUpdate: true,
  requireBackupSources: ['openclaw', 'gateway', 'core'],
  offPeakHoursOnly: false,
  offPeakHoursStart: 22,
  offPeakHoursEnd: 6,
  maxRiskTolerance: 0.7,
  securityUpdateBehavior: 'immediate'
};

export class AdaptiveStrategyEngine {
  private config: StrategyConfig;

  constructor(config?: Partial<StrategyConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.loadConfig();
  }

  private loadConfig(): void {
    try {
      const { existsSync, readFileSync } = require('fs');
      const path = `${process.env.HOME}/.duck/update-strategy.json`;
      if (existsSync(path)) this.config = { ...this.config, ...JSON.parse(readFileSync(path, 'utf-8')) };
    } catch (e) {
      console.error('[AdaptiveStrategy] Failed to load config:', e instanceof Error ? e.message : e);
    }
  }

  saveConfig(): void {
    try {
      const { existsSync, mkdirSync, writeFileSync } = require('fs');
      const path = `${process.env.HOME}/.duck/update-strategy.json`;
      const dir = require('path').dirname(path);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      writeFileSync(path, JSON.stringify(this.config, null, 2), 'utf-8');
    } catch (e) {
      console.error('[AdaptiveStrategy] Failed to save config:', e instanceof Error ? e.message : e);
    }
  }

  generateStrategy(classification: ClassifiedUpdate, prediction: SuccessPrediction): UpdateStrategy {
    const approach = this.determineApproach(classification, prediction);
    const shouldUpdate = this.shouldUpdate(classification, prediction, approach);
    const steps = this.generateSteps(classification, prediction, approach);
    const rollbackPlan = this.generateRollbackPlan(classification, prediction);
    const monitoringPlan = this.generateMonitoringPlan(classification, prediction);
    const estimatedRisk = this.calcRisk(classification, prediction, approach);
    const estimatedTime = this.calcTime(classification, prediction, approach);
    const warnings = this.generateWarnings(classification, prediction, approach);
    return { shouldUpdate, approach, steps, rollbackPlan, monitoringPlan, estimatedRisk, estimatedTime, warnings };
  }

  private determineApproach(classification: ClassifiedUpdate, prediction: SuccessPrediction): UpdateApproach {
    if (classification.type === 'security') return this.config.securityUpdateBehavior === 'immediate' ? 'backup-first' : 'review';
    if (classification.risk === 'high' || prediction.confidence < 0.4) return 'backup-first';
    if (prediction.confidence < 0.5 || !this.config.allowAutoUpdate) return 'review';
    if (classification.risk === 'low' && prediction.confidence >= 0.7) return 'auto';
    return 'review';
  }

  private shouldUpdate(classification: ClassifiedUpdate, prediction: SuccessPrediction, approach: UpdateApproach): boolean {
    if (classification.type === 'docs') return false;
    if (classification.type === 'security') return true;
    if (approach === 'skip') return false;
    if (prediction.confidence < 0.3 && classification.risk === 'high') return false;
    const stats = updateMemory.getStats();
    if (stats.successRate < 0.5 && classification.risk !== 'low') return false;
    return true;
  }

  private generateSteps(classification: ClassifiedUpdate, prediction: SuccessPrediction, approach: UpdateApproach): string[] {
    const steps: string[] = [];
    if (approach === 'backup-first' || approach === 'review') { steps.push('1. Create system backup'); steps.push('2. Document current version'); }
    if (approach === 'backup-first') { steps.push('3. Prepare rollback procedure'); steps.push('4. Verify backup integrity'); }
    steps.push(`${steps.length + 1}. Run pre-flight compatibility checks`);
    steps.push(`${steps.length + 1}. Verify network connectivity`);
    steps.push(`${steps.length + 1}. Apply update`);
    if (classification.type === 'breaking') { steps.push(`${steps.length + 1}. Review breaking changes documentation`); steps.push(`${steps.length + 1}. Update dependent configurations`); }
    if (classification.type === 'security') steps.push(`${steps.length + 1}. Verify security update authenticity`);
    steps.push(`${steps.length + 1}. Verify update completed successfully`);
    steps.push(`${steps.length + 1}. Test core functionality`);
    return steps;
  }

  private generateRollbackPlan(classification: ClassifiedUpdate, prediction: SuccessPrediction): string {
    const plans = ['Restore from backup'];
    if (prediction.similarUpdates.length > 0) plans.push(`Revert to ${prediction.similarUpdates[0].version}`);
    if (classification.type === 'breaking') { plans.push('Breaking changes may require full reconfiguration'); plans.push('Restore database/state from backup'); }
    if (classification.type === 'dependency') plans.push('Pin dependency versions to previous state');
    plans.push('Monitor for 10 minutes after rollback');
    return plans.join(' → ');
  }

  private generateMonitoringPlan(classification: ClassifiedUpdate, prediction: SuccessPrediction): string[] {
    const plan = ['Check agent is still running', 'Verify gateway connectivity', 'Check for error logs in last 5 minutes', 'Test basic command execution', 'Verify tool access', 'Check memory/state integrity'];
    if (classification.type === 'security') { plan.push('Monitor for intrusion detection alerts'); plan.push('Check authentication systems'); }
    if (classification.type === 'breaking') { plan.push('Monitor for breaking change errors'); plan.push('Check API compatibility'); }
    const mins = prediction.predictedDuration > 60000 ? 15 : 5;
    plan.push(`Monitor continuously for ${mins} minutes`);
    plan.push('Check again in 24 hours');
    return plan;
  }

  private calcRisk(classification: ClassifiedUpdate, prediction: SuccessPrediction, approach: UpdateApproach): number {
    let risk = classification.risk === 'low' ? 0.1 : classification.risk === 'medium' ? 0.4 : 0.8;
    risk += (1 - prediction.confidence) * 0.3;
    risk += prediction.similarUpdates.filter(s => !s.success).length * 0.15;
    const stats = updateMemory.getStats();
    if (stats.successRate < 1) risk += (1 - stats.successRate) * 0.2;
    if (!this.isOffPeak()) risk += 0.1;
    if (approach === 'auto') risk += 0.1;
    else if (approach === 'backup-first') risk -= 0.2;
    else if (approach === 'skip') risk = 1;
    return Math.max(0, Math.min(1, risk));
  }

  private calcTime(classification: ClassifiedUpdate, prediction: SuccessPrediction, approach: UpdateApproach): number {
    let mins = 5;
    if (approach === 'backup-first') mins += 10;
    else if (approach === 'review') mins += 15;
    mins += Math.round(prediction.predictedDuration / 60000);
    if (classification.type === 'breaking') mins += 15;
    else if (classification.type === 'feature') mins += 5;
    if (classification.risk === 'high') mins += 10;
    return mins;
  }

  private generateWarnings(classification: ClassifiedUpdate, prediction: SuccessPrediction, approach: UpdateApproach): string[] {
    const warnings: string[] = [];
    if (classification.risk === 'high') warnings.push('⚠️ HIGH RISK update - proceed with caution');
    if (prediction.confidence < 0.5) warnings.push(`⚠️ Low confidence (${(prediction.confidence * 100).toFixed(0)}%)`);
    const failed = prediction.similarUpdates.filter(s => !s.success).length;
    if (failed > 0) warnings.push(`⚠️ ${failed} similar updates failed`);
    if (classification.type === 'breaking') warnings.push('⚠️ Breaking changes - review migration guide');
    prediction.riskFactors.slice(0, 2).forEach(f => warnings.push(`⚠️ ${f}`));
    if (!this.isOffPeak() && approach === 'auto') warnings.push('⚠️ Not in off-peak hours');
    return warnings;
  }

  private isOffPeak(): boolean {
    const hour = new Date().getHours();
    const { offPeakHoursStart: start, offPeakHoursEnd: end } = this.config;
    if (start <= end) return hour >= start && hour < end;
    return hour >= start || hour < end;
  }

  adaptFromOutcome(source: string, version: string, success: boolean, issues: string[]): void {
    if (!success) {
      if (issues.some(i => i.toLowerCase().includes('depend'))) {
        if (!this.config.requireBackupSources.includes(source)) this.config.requireBackupSources.push(source);
      }
      this.saveConfig();
    }
  }

  getConfig(): StrategyConfig { return { ...this.config }; }
  updateConfig(updates: Partial<StrategyConfig>): void { this.config = { ...this.config, ...updates }; this.saveConfig(); }
}

export const adaptiveStrategy = new AdaptiveStrategyEngine();
