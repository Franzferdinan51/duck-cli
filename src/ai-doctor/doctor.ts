/**
 * duck-cli AI Doctor - Main Class
 * Self-healing AI that diagnoses and fixes errors using MiniMax
 */

import { MiniMaxClient } from './minimax-client.js';
import type { Diagnosis, FixProposal, DoctorReport, DoctorConfig, FixStep } from './types.js';

export class AIDoctor {
  private miniMax: MiniMaxClient;
  private codeHarness: CodeHarness;
  private config: DoctorConfig;
  private reports: DoctorReport[] = [];

  constructor(config?: Partial<DoctorConfig>) {
    this.config = {
      autoFix: config?.autoFix ?? false,
      autoFixRiskThreshold: config?.autoFixRiskThreshold ?? 'low',
      model: config?.model ?? 'MiniMax-M2.7',
      provider: config?.provider ?? 'minimax',
    };
    this.miniMax = new MiniMaxClient(this.config.model);
    this.codeHarness = new CodeHarness();
  }

  async initialize(): Promise<void> {
    await this.miniMax.initialize();
  }

  /**
   * Diagnose an error
   */
  async diagnose(error: string, context?: string): Promise<Diagnosis> {
    const response = await this.miniMax.diagnose(error, context);
    return this.parseDiagnosis(response, error);
  }

  /**
   * Propose a fix for an error based on diagnosis
   */
  async proposeFix(error: string, diagnosis: Diagnosis): Promise<FixProposal> {
    const response = await this.miniMax.proposeFix(error, diagnosis.rootCause);
    return this.parseFixProposal(response, diagnosis);
  }

  /**
   * Full workflow: diagnose → propose fix
   */
  async examine(error: string, context?: string): Promise<DoctorReport> {
    const logs: string[] = [];

    logs.push(`[${new Date().toISOString()}] Starting AI Doctor examination`);

    // Step 1: Diagnose
    const diagnosis = await this.diagnose(error, context);
    logs.push(`[${new Date().toISOString()}] Diagnosis: ${diagnosis.rootCause}`);
    logs.push(`[${new Date().toISOString()}] Category: ${diagnosis.category}, Severity: ${diagnosis.severity}`);

    // Step 2: Propose fix
    const fix = await this.proposeFix(error, diagnosis);
    logs.push(`[${new Date().toISOString()}] Fix proposed: ${fix.steps.length} steps, risk: ${fix.estimatedRisk}`);

    const report: DoctorReport = {
      timestamp: Date.now(),
      error,
      diagnosis,
      fix,
      applied: false,
      logs,
    };

    this.reports.push(report);
    return report;
  }

  /**
   * Apply a fix
   */
  async applyFix(report: DoctorReport, dryRun = false): Promise<{ success: boolean; output: string }> {
    if (!report.fix) {
      return { success: false, output: 'No fix proposed' };
    }

    const outputs: string[] = [];

    for (const step of report.fix.steps) {
      if (step.action === 'noop') continue;

      const output = dryRun
        ? `[DRY RUN] Would execute: ${step.command || step.description}`
        : await this.executeStep(step);

      outputs.push(output);
    }

    report.applied = !dryRun;
    report.result = dryRun ? 'success' : 'success';
    report.logs.push(`[${new Date().toISOString()}] Fix ${dryRun ? '(dry run)' : ''} applied`);

    return { success: true, output: outputs.join('\n') };
  }

  /**
   * Auto-heal an error if auto-fix is enabled
   */
  async autoHeal(error: string, context?: string): Promise<DoctorReport> {
    const report = await this.examine(error, context);

    if (
      this.config.autoFix &&
      report.fix?.autoFixable &&
      this.riskAllowed(report.fix.estimatedRisk)
    ) {
      const result = await this.applyFix(report);
      report.result = result.success ? 'success' : 'failed';
      report.logs.push(`[${new Date().toISOString()}] Auto-heal ${result.success ? 'succeeded' : 'failed'}`);
    } else {
      report.logs.push(`[${new Date().toISOString()}] Auto-heal skipped (autoFix=${this.config.autoFix}, autoFixable=${report.fix?.autoFixable}, risk=${report.fix?.estimatedRisk})`);
    }

    return report;
  }

  /**
   * Get repair history
   */
  getHistory(): DoctorReport[] {
    return this.reports;
  }

  /**
   * Get config
   */
  getConfig(): DoctorConfig {
    return { ...this.config };
  }

  /**
   * Update config
   */
  setConfig(config: Partial<DoctorConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // ---- Private helpers ----

  private parseDiagnosis(response: string, error: string): Diagnosis {
    const lines = response.split('\n').map((l) => l.trim());

    let rootCause = 'Unknown error';
    let category: Diagnosis['category'] = 'unknown';
    let severity: Diagnosis['severity'] = 'medium';
    let confidence = 0.5;

    for (const line of lines) {
      if (line.startsWith('ROOT_CAUSE:')) {
        rootCause = line.substring(11).trim();
      } else if (line.startsWith('CATEGORY:')) {
        const cat = line.substring(9).trim().toLowerCase();
        if (['network', 'auth', 'memory', 'code', 'config', 'dependency', 'timeout'].includes(cat)) {
          category = cat as Diagnosis['category'];
        }
      } else if (line.startsWith('SEVERITY:')) {
        const sev = line.substring(9).trim().toLowerCase();
        if (['critical', 'high', 'medium', 'low'].includes(sev)) {
          severity = sev as Diagnosis['severity'];
        }
      } else if (line.startsWith('CONFIDENCE:')) {
        const conf = parseFloat(line.substring(11).trim());
        if (!isNaN(conf) && conf >= 0 && conf <= 1) {
          confidence = conf;
        }
      }
    }

    return { error, rootCause, category, severity, confidence };
  }

  private parseFixProposal(response: string, diagnosis: Diagnosis): FixProposal {
    const steps: FixStep[] = [];

    if (response.includes('NO_FIX_NEEDED')) {
      return {
        diagnosis,
        steps: [{ order: 0, action: 'noop', description: 'No fix needed', reversible: false, autoFixable: true }],
        estimatedRisk: 'low',
        autoFixable: true,
      };
    }

    const lines = response.split('\n');
    for (const line of lines) {
      const match = line.match(/STEP\s*(\d+):\s*(.+?)\s*\|\s*(\w+)\s*\|\s*(.+?)\s*\|\s*(\w+)\s*\|\s*(true|false)/i);
      if (match) {
        const [, orderStr, description, action, command, risk, auto] = match;
        steps.push({
          order: parseInt(orderStr, 10),
          description: description.trim(),
          action: action.toLowerCase() as FixStep['action'],
          command: command.trim() !== 'N/A' ? command.trim() : undefined,
          autoFixable: auto.toLowerCase() === 'true',
          estimatedRisk: risk.toLowerCase() as 'low' | 'medium' | 'high',
          reversible: false,
        });
      }
    }

    const estimatedRisk = steps.length > 0
      ? (steps[0].estimatedRisk || 'medium')
      : 'low';

    return {
      diagnosis,
      steps: steps.length > 0 ? steps : [{ order: 1, action: 'noop', description: 'No specific fix available', reversible: false, autoFixable: true }],
      estimatedRisk,
      autoFixable: steps.every((s) => s.autoFixable),
    };
  }

  private async executeStep(step: FixStep): Promise<string> {
    if (!step.command) {
      return `No command for step: ${step.description}`;
    }

    try {
      const { execSync } = await import('child_process');
      const output = execSync(step.command, { encoding: 'utf-8', timeout: 60000, shell: true });
      return output;
    } catch (e: any) {
      return `Command failed: ${e.message}`;
    }
  }

  /**
   * Auto-repair code using Claude Code or Codex harness
   */
  async autoRepair(error: string, context?: { file?: string; code?: string; cwd?: string }): Promise<DoctorReport> {
    const logs: string[] = [];
    logs.push(`[${new Date().toISOString()}] Starting code repair via Claude Code/Codex`);

    const result = await this.codeHarness.repair(error, context);
    logs.push(`[${new Date().toISOString()}] Harness result: ${result.success ? 'success' : 'failed'}`);

    const report: DoctorReport = {
      timestamp: Date.now(),
      error,
      diagnosis: {
        error,
        rootCause: result.success ? 'Fixed via code harness' : (result.error || 'Harness failed'),
        severity: 'medium',
        category: 'code',
        confidence: result.success ? 0.9 : 0.3,
      },
      fix: result.success ? {
        diagnosis: {} as Diagnosis,
        steps: [{
          order: 1,
          action: 'patch',
          description: 'Code fix applied via ' + (CodeHarness.detect() === 'claude' ? 'Claude Code' : 'Codex'),
          command: undefined,
          reversible: false,
          autoFixable: true,
        }],
        estimatedRisk: 'medium',
        autoFixable: true,
      } : undefined,
      applied: result.success,
      result: result.success ? 'success' : 'failed',
      logs,
    };

    this.reports.push(report);
    return report;
  }

  private riskAllowed(risk: string): boolean {
    const levels = ['low', 'medium', 'high'];
    const threshold = levels.indexOf(this.config.autoFixRiskThreshold);
    const actual = levels.indexOf(risk);
    return actual <= threshold;
  }
}

// Singleton instance
let doctorInstance: AIDoctor | null = null;

export function getAIDoctor(config?: Partial<DoctorConfig>): AIDoctor {
  if (!doctorInstance) {
    doctorInstance = new AIDoctor(config);
  }
  return doctorInstance;
}
