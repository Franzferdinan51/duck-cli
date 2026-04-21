/**
 * duck-cli AI Doctor - ACP Repair Integration
 * Listens for failure events and auto-repairs via ACP bridge
 */

import { getAIDoctor } from './doctor.js';
import type { DoctorReport } from './types.js';

export interface RepairConfig {
  enabled: boolean;
  autoRepairOnFailure: boolean;
  maxRetries: number;
  severityThreshold: 'critical' | 'high' | 'medium' | 'low';
}

export class ACPRepar {
  private doctor: ReturnType<typeof getAIDoctor>;
  private config: RepairConfig;
  private pendingRepairs: Map<string, DoctorReport> = new Map();
  private bridge: any = null;
  private failureCallback: ((report: DoctorReport) => Promise<void>) | null = null;

  constructor(config?: Partial<RepairConfig>) {
    this.doctor = getAIDoctor({ autoFix: true, autoFixRiskThreshold: 'low' });
    this.config = {
      enabled: config?.enabled ?? false,
      autoRepairOnFailure: config?.autoRepairOnFailure ?? false,
      maxRetries: config?.maxRetries ?? 2,
      severityThreshold: config?.severityThreshold ?? 'high',
    };
  }

  /**
   * Initialize the repair module
   */
  async initialize(): Promise<void> {
    await this.doctor.initialize();
  }

  /**
   * Attach ACP bridge for sending repair results
   */
  attachBridge(bridge: any): void {
    this.bridge = bridge;
  }

  /**
   * Register a failure callback from the failure reporter
   */
  onFailure(callback: (report: DoctorReport) => Promise<void>): void {
    this.failureCallback = callback;
  }

  /**
   * Handle a failure event — diagnose and optionally repair
   */
  async handleFailure(error: string, context?: string): Promise<DoctorReport> {
    const report = await this.doctor.autoHeal(error, context);

    // Notify via ACP bridge if connected
    if (this.bridge && report.fix) {
      try {
        await this.bridge.sendNotification({
          type: 'doctor.repair.complete',
          report: {
            error: report.error,
            diagnosis: report.diagnosis,
            fixSteps: report.fix.steps.map((s) => ({
              order: s.order,
              action: s.action,
              description: s.description,
              command: s.command || 'N/A',
            })),
            applied: report.applied,
            result: report.result,
            timestamp: report.timestamp,
          },
        });
      } catch (e) {
        // Bridge not connected — silent fail
      }
    }

    return report;
  }

  /**
   * Manually trigger a repair attempt
   */
  async repair(error: string, context?: string, dryRun = false): Promise<DoctorReport> {
    const report = await this.doctor.examine(error, context);

    if (report.fix) {
      await this.doctor.applyFix(report, dryRun);
    }

    return report;
  }

  /**
   * Get repair history
   */
  getHistory(): DoctorReport[] {
    return this.doctor.getHistory();
  }

  /**
   * Update config
   */
  setConfig(config: Partial<RepairConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current config
   */
  getConfig(): RepairConfig {
    return { ...this.config };
  }

  /**
   * Check if a severity passes the threshold
   */
  private passesSeverity(severity: string): boolean {
    const levels = ['critical', 'high', 'medium', 'low'];
    const threshold = levels.indexOf(this.config.severityThreshold);
    const actual = levels.indexOf(severity);
    return actual <= threshold;
  }
}

// Singleton
let reparInstance: ACPRepar | null = null;

export function getACPRepar(config?: Partial<RepairConfig>): ACPRepar {
  if (!reparInstance) {
    reparInstance = new ACPRepar(config);
  }
  return reparInstance;
}
