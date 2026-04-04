/**
 * Session Logger - DroidClaw-inspired crash-safe session logging
 * Writes incremental .partial.json after each step, final .json at session end
 */

import { mkdirSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

export interface LLMDecision {
  think?: string;
  plan?: string[];
  planProgress?: string;
  action?: string;
  reason?: string;
  tool?: string;
  args?: any;
  success?: boolean;
}

export interface StepLog {
  step: number;
  timestamp: string;
  llmDecision: LLMDecision;
  actionResult: { success: boolean; message: string; durationMs?: number };
  llmLatencyMs?: number;
}

export interface SessionSummary {
  sessionId: string;
  goal: string;
  provider: string;
  model: string;
  startTime: string;
  endTime: string;
  totalSteps: number;
  successCount: number;
  failCount: number;
  completed: boolean;
  steps: StepLog[];
}

export class SessionLogger {
  private sessionId: string;
  private logDir: string;
  private steps: StepLog[] = [];
  private goal: string;
  private provider: string;
  private model: string;
  private startTime: string;

  constructor(logDir: string = "/tmp/duck-sessions", goal: string = "", provider: string = "unknown", model: string = "unknown") {
    this.sessionId = `duck-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    this.logDir = logDir;
    this.goal = goal;
    this.provider = provider;
    this.model = model;
    this.startTime = new Date().toISOString();

    try {
      mkdirSync(this.logDir, { recursive: true });
    } catch {}
  }

  getSessionId(): string {
    return this.sessionId;
  }

  logStep(
    step: number,
    decision: LLMDecision,
    result: { success: boolean; message: string; durationMs?: number },
    llmLatencyMs?: number
  ): void {
    const entry: StepLog = {
      step,
      timestamp: new Date().toISOString(),
      llmDecision: {
        think: decision.think,
        plan: decision.plan,
        planProgress: decision.planProgress,
        action: decision.action || decision.tool,
        reason: decision.reason,
        args: decision.args,
      },
      actionResult: {
        success: result.success,
        message: result.message,
        durationMs: result.durationMs,
      },
      llmLatencyMs,
    };
    this.steps.push(entry);

    // Write partial file after each step (crash-safe)
    try {
      const partialPath = join(this.logDir, `${this.sessionId}.partial.json`);
      writeFileSync(partialPath, JSON.stringify(this.buildSummary(false), null, 2));
    } catch {}
  }

  finalize(completed: boolean = false): SessionSummary {
    const summary = this.buildSummary(completed);
    try {
      const finalPath = join(this.logDir, `${this.sessionId}.json`);
      writeFileSync(finalPath, JSON.stringify(summary, null, 2));

      // Remove partial file if it exists
      const partialPath = join(this.logDir, `${this.sessionId}.partial.json`);
      try {
        const fs = require("fs");
        if (existsSync(partialPath)) fs.unlinkSync(partialPath);
      } catch {}

      console.log(`[SessionLogger] Session saved: ${finalPath}`);
    } catch {}
    return summary;
  }

  private buildSummary(completed: boolean): SessionSummary {
    return {
      sessionId: this.sessionId,
      goal: this.goal,
      provider: this.provider,
      model: this.model,
      startTime: this.startTime,
      endTime: new Date().toISOString(),
      totalSteps: this.steps.length,
      successCount: this.steps.filter((s) => s.actionResult.success).length,
      failCount: this.steps.filter((s) => !s.actionResult.success).length,
      completed,
      steps: this.steps,
    };
  }
}

/**
 * Get session logs from a directory
 */
export function getSessionLogs(logDir: string = "/tmp/duck-sessions"): string[] {
  try {
    const fs = require("fs");
    if (!existsSync(logDir)) return [];
    return fs.readdirSync(logDir)
      .filter(f => f.endsWith(".json") || f.endsWith(".partial.json"))
      .map(f => join(logDir, f));
  } catch {
    return [];
  }
}
