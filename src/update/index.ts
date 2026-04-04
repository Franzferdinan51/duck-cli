/**
 * 🦆 Learning Update System - Main Index
 * 
 * Complete learning update system that:
 * - Tracks update history and outcomes
 * - Classifies updates by type and risk
 * - Predicts success probability based on learned patterns
 * - Adapts update strategy based on historical data
 * - Gathers feedback and continuously improves
 * - Sends smart notifications based on update characteristics
 */

export * from './update-memory.js';
export * from './update-classifier.js';
export * from './success-predictor.js';
export * from './adaptive-strategy.js';
export * from './feedback-loop.js';
export * from './smart-notifications.js';

import { updateMemory, type LearningStats } from './update-memory.js';
import { updateClassifier, type ClassifiedUpdate } from './update-classifier.js';
import { successPredictor, type SuccessPrediction } from './success-predictor.js';
import { adaptiveStrategy } from './adaptive-strategy.js';
import { feedbackLoop } from './feedback-loop.js';
import { smartNotifications } from './smart-notifications.js';

export async function analyzeUpdate(
  source: string,
  currentVersion: string,
  newVersion: string,
  changelog: string,
  dependencies: string[] = []
): Promise<{
  classification: ClassifiedUpdate;
  prediction: SuccessPrediction;
  strategy: ReturnType<typeof adaptiveStrategy.generateStrategy>;
}> {
  const classification = updateClassifier.classify(changelog, currentVersion, newVersion, source);
  const prediction = successPredictor.predict(source, currentVersion, newVersion, classification, dependencies);
  const strategy = adaptiveStrategy.generateStrategy(classification, prediction);
  const notification = smartNotifications.createNotification(source, newVersion, classification, prediction, strategy);
  if (notification) smartNotifications.queue(notification);
  return { classification, prediction, strategy };
}

export async function recordUpdateOutcome(
  source: string,
  version: string,
  success: boolean,
  issues: string[] = [],
  duration?: number,
  error?: string
): Promise<void> {
  await feedbackLoop.gatherFeedback({
    source,
    version,
    success,
    timestamp: new Date(),
    duration: duration || 0,
    issues,
    lessons: [],
    error
  });
}

export function getLearningStats(): LearningStats & {
  strategyConfig: ReturnType<typeof adaptiveStrategy.getConfig>;
  notificationPrefs: ReturnType<typeof smartNotifications.getPrefs>;
} {
  return {
    ...updateMemory.getStats(),
    strategyConfig: adaptiveStrategy.getConfig(),
    notificationPrefs: smartNotifications.getPrefs()
  };
}

export const formatters = {
  formatStats(stats: LearningStats): string {
    const lines: string[] = [];
    lines.push('\n🦆 Learning Update Stats');
    lines.push('═'.repeat(50));
    lines.push(`Total Updates: ${stats.totalUpdates}`);
    lines.push(`Success Rate: ${(stats.successRate * 100).toFixed(1)}%`);
    lines.push(`  ✓ Successful: ${stats.successfulUpdates}`);
    lines.push(`  ✗ Failed: ${stats.failedUpdates}`);
    lines.push(`  ↩️ Rollbacks: ${stats.rollbackCount}`);
    lines.push(`  📚 Lessons Learned: ${stats.learningCount}`);
    if (stats.lastUpdate) lines.push(`Last Update: ${stats.lastUpdate.toLocaleString()}`);
    if (stats.mostCommonIssues.length > 0) {
      lines.push('\nMost Common Issues:');
      stats.mostCommonIssues.forEach((issue, i) => lines.push(`  ${i + 1}. ${issue}`));
    }
    if (stats.patternInsights.length > 0) {
      lines.push('\nPattern Insights:');
      stats.patternInsights.forEach(insight => {
        lines.push(`  • ${insight.pattern}`);
        lines.push(`    Success: ${(insight.successRate * 100).toFixed(0)}%`);
        lines.push(`    → ${insight.recommendation}`);
      });
    }
    lines.push('═'.repeat(50) + '\n');
    return lines.join('\n');
  },

  formatHistory(memories: ReturnType<typeof updateMemory.getAll>): string {
    if (memories.length === 0) return 'No update history yet.\n';
    const lines: string[] = [];
    lines.push('\n🦆 Update History');
    lines.push('═'.repeat(50));
    const sorted = [...memories].sort((a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    for (const memory of sorted.slice(0, 20)) {
      const status = memory.success ? '✓' : '✗';
      const rollback = memory.rollbackPerformed ? ' ↩️' : '';
      lines.push(`\n${status} ${memory.source}@${memory.version} (${new Date(memory.timestamp).toLocaleDateString()})${rollback}`);
      if (memory.issues.length > 0) lines.push(`  Issues: ${memory.issues.slice(0, 2).join(', ')}`);
      if (memory.lessons.length > 0) lines.push(`  Learned: ${memory.lessons[0].substring(0, 60)}...`);
    }
    if (sorted.length > 20) lines.push(`\n... and ${sorted.length - 20} more`);
    lines.push('\n' + '═'.repeat(50) + '\n');
    return lines.join('\n');
  },

  formatStrategy(strategy: ReturnType<typeof adaptiveStrategy.generateStrategy>): string {
    const lines: string[] = [];
    lines.push('\n🦆 Update Strategy');
    lines.push('═'.repeat(50));
    lines.push(`Should Update: ${strategy.shouldUpdate ? '✓' : '✗'} (${strategy.approach})`);
    lines.push(`Estimated Risk: ${(strategy.estimatedRisk * 100).toFixed(0)}%`);
    lines.push(`Estimated Time: ${strategy.estimatedTime} minutes`);
    if (strategy.warnings.length > 0) {
      lines.push('\nWarnings:');
      strategy.warnings.forEach(w => lines.push(`  ${w}`));
    }
    lines.push('\nSteps:');
    strategy.steps.forEach(step => lines.push(`  ${step}`));
    lines.push(`\nRollback: ${strategy.rollbackPlan}`);
    if (strategy.monitoringPlan.length > 0) {
      lines.push('\nMonitoring:');
      strategy.monitoringPlan.forEach(m => lines.push(`  • ${m}`));
    }
    lines.push('\n' + '═'.repeat(50) + '\n');
    return lines.join('\n');
  }
};
