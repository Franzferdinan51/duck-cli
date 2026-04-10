/**
 * duck-cli v3 - FailureReporter
 * Central hub for all failure reporting.
 * All failure sources (tools, providers, channels, bridge, council, auto-heal)
 * feed through here so they can be:
 *   1. Persisted to LearningLoop (SQLite) for long-term pattern learning
 *   2. Sent to Kairos for heartbeat/pattern tracking
 *   3. Sent to Subconscious as whispers for deliberation
 *   4. Forwarded to MetaLearner for planner context
 *
 * Low-risk additive wiring — never deletes, only adds reporting hooks.
 */

import { EventEmitter } from 'events';
import { FailureReport, FailureSource, FailureSeverity } from './meta-types.js';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import Database from '../vendor/better-sqlite3.js';

// FailureReport is imported from meta-types
// Whisper/Subconscious types imported lazily to avoid circular deps
interface SubconsciousWhisper {
  type: string;
  content: string;
  confidence: number;
  source: string;
  context: Record<string, any>;
}

const FAILURE_SEVERITY_THRESHOLD = 0.5; // whispers emitted for severity >= medium

export class FailureReporter extends EventEmitter {
  private db: Database.Database;
  private failurePath: string;
  private learningDir: string;
  private occurrenceCache: Map<string, number> = new Map();
  private failureCount: number = 0;
  private sessionId: string = 'default';

  constructor(failurePath?: string, learningDir?: string) {
    super();
    this.failurePath = failurePath || join(homedir(), '.duck', 'failures');
    this.learningDir = learningDir || join(homedir(), '.duck', 'learning');
    mkdirSync(this.failurePath, { recursive: true });
    const dbPath = join(this.failurePath, 'failure_reports.db');
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.initialize();
    this.loadOccurrenceCache();
  }

  // ─── Public API ───────────────────────────────────────────

  /**
   * Report a failure from any source.
   * This is the single entry point for all failure reporting.
   */
  report(report: Omit<FailureReport, 'id' | 'timestamp' | 'occurrenceCount'>): FailureReport {
    const id = `fail_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const key = this.occurrenceKey(report);
    const occurrenceCount = (this.occurrenceCache.get(key) || 0) + 1;
    this.occurrenceCache.set(key, occurrenceCount);

    const full: FailureReport = {
      ...report,
      id,
      timestamp: Date.now(),
      occurrenceCount,
    };

    this.failureCount++;
    this.persist(full);
    this.forwardToLearningLoop(full);
    this.forwardToKairos(full);
    this.forwardToSubconscious(full);
    this.forwardToMetaLearner(full);
    this.logFailure(full);

    return full;
  }

  /** Shortcut for tool failures */
  reportTool(toolName: string, message: string, taskPrompt?: string, details?: string): FailureReport {
    return this.report({
      source: 'tool',
      message,
      details,
      toolName,
      taskPrompt,
      severity: this.estimateSeverity(message),
      sessionId: this.sessionId,
    });
  }

  /** Shortcut for provider failures */
  reportProvider(providerName: string, message: string, details?: string): FailureReport {
    return this.report({
      source: 'provider',
      message,
      details,
      providerName,
      severity: this.estimateSeverity(message),
      sessionId: this.sessionId,
    });
  }

  /** Shortcut for Telegram channel failures */
  reportTelegram(message: string, details?: string, channel?: string): FailureReport {
    return this.report({
      source: 'telegram',
      message,
      details,
      channel,
      severity: this.estimateSeverity(message),
      sessionId: this.sessionId,
    });
  }

  /** Shortcut for bridge/MCP failures */
  reportBridge(message: string, details?: string, channel?: string): FailureReport {
    return this.report({
      source: 'bridge',
      message,
      details,
      channel,
      severity: this.estimateSeverity(message),
      sessionId: this.sessionId,
    });
  }

  /** Shortcut for AI Council failures */
  reportCouncil(message: string, details?: string): FailureReport {
    return this.report({
      source: 'council',
      message,
      details,
      severity: this.estimateSeverity(message),
      sessionId: this.sessionId,
    });
  }

  /** Shortcut for auto-heal failures */
  reportAutoHeal(diagnosis: string, recoveryAction: string, message: string, taskPrompt?: string): FailureReport {
    return this.report({
      source: 'auto_heal',
      message,
      diagnosis,
      recoveryAction,
      taskPrompt,
      severity: 'medium',
      autoHealed: false,
      sessionId: this.sessionId,
    });
  }

  /** Shortcut for mesh failures */
  reportMesh(message: string, details?: string, channel?: string): FailureReport {
    return this.report({
      source: 'mesh',
      message,
      details,
      channel,
      severity: this.estimateSeverity(message),
      sessionId: this.sessionId,
    });
  }

  /** Shortcut for internal errors */
  reportInternal(message: string, details?: string): FailureReport {
    return this.report({
      source: 'internal',
      message,
      details,
      severity: 'high',
      sessionId: this.sessionId,
    });
  }

  // ─── Getters ─────────────────────────────────────────────

  getFailureCount(): number {
    return this.failureCount;
  }

  getRecentFailures(limit = 20): FailureReport[] {
    try {
      const rows = this.db.prepare(`
        SELECT * FROM failures
        ORDER BY timestamp DESC
        LIMIT ?
      `).all(limit) as any[];
      return rows.map(r => this.rowToReport(r));
    } catch {
      return [];
    }
  }

  getFailuresBySource(source: FailureSource, limit = 50): FailureReport[] {
    try {
      const rows = this.db.prepare(`
        SELECT * FROM failures
        WHERE source = ?
        ORDER BY timestamp DESC
        LIMIT ?
      `).all(source, limit) as any[];
      return rows.map(r => this.rowToReport(r));
    } catch {
      return [];
    }
  }

  getTopFailingTools(limit = 10): { toolName: string; count: number; lastSeen: number }[] {
    try {
      // JSON fallback doesn't support GROUP BY — simulate by iterating all failures
      const allRows = this.db.prepare(`SELECT tool_name, timestamp FROM failures`).all() as any[];
      const counts = new Map<string, { count: number; lastSeen: number }>();
      for (const r of allRows) {
        if (!r.tool_name || r.tool_name.trim() === '') continue;
        const existing = counts.get(r.tool_name) || { count: 0, lastSeen: 0 };
        existing.count++;
        existing.lastSeen = Math.max(existing.lastSeen, Number(r.timestamp) || 0);
        counts.set(r.tool_name, existing);
      }
      return Array.from(counts.entries())
        .map(([toolName, data]) => ({ toolName, count: data.count, lastSeen: data.lastSeen }))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);
    } catch {
      return [];
    }
  }

  getTopFailingProviders(limit = 10): { providerName: string; count: number; lastSeen: number }[] {
    try {
      const allRows = this.db.prepare(`SELECT provider_name, timestamp FROM failures`).all() as any[];
      const counts = new Map<string, { count: number; lastSeen: number }>();
      for (const r of allRows) {
        if (!r.provider_name || r.provider_name.trim() === '') continue;
        const existing = counts.get(r.provider_name) || { count: 0, lastSeen: 0 };
        existing.count++;
        existing.lastSeen = Math.max(existing.lastSeen, Number(r.timestamp) || 0);
        counts.set(r.provider_name, existing);
      }
      return Array.from(counts.entries())
        .map(([providerName, data]) => ({ providerName, count: data.count, lastSeen: data.lastSeen }))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);
    } catch {
      return [];
    }
  }

  getStats(): {
    total: number;
    bySource: Record<string, number>;
    bySeverity: Record<string, number>;
    topTools: { toolName: string; count: number }[];
    topProviders: { providerName: string; count: number }[];
  } {
    try {
      // JSON fallback doesn't support COUNT/GROUP BY — simulate manually
      const allRows = this.db.prepare(`SELECT source, severity FROM failures`).all() as any[];
      const total = allRows.length;
      const bySource: Record<string, number> = {};
      const bySeverity: Record<string, number> = {};
      for (const r of allRows) {
        if (r.source) bySource[String(r.source)] = (bySource[String(r.source)] || 0) + 1;
        if (r.severity) bySeverity[String(r.severity)] = (bySeverity[String(r.severity)] || 0) + 1;
      }

      const topTools = this.getTopFailingTools(5);
      const topProviders = this.getTopFailingProviders(5);

      return { total, bySource, bySeverity, topTools, topProviders };
    } catch {
      return { total: 0, bySource: {}, bySeverity: {}, topTools: [], topProviders: [] };
    }
  }

  setSessionId(sessionId: string): void {
    this.sessionId = sessionId;
  }

  // ─── Private ─────────────────────────────────────────────

  private initialize(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS failures (
        id TEXT PRIMARY KEY,
        source TEXT NOT NULL,
        message TEXT NOT NULL,
        details TEXT,
        tool_name TEXT,
        provider_name TEXT,
        channel TEXT,
        task_prompt TEXT,
        severity TEXT NOT NULL DEFAULT 'medium',
        auto_healed INTEGER NOT NULL DEFAULT 0,
        diagnosis TEXT,
        recovery_action TEXT,
        timestamp INTEGER NOT NULL,
        occurrence_count INTEGER NOT NULL DEFAULT 1,
        session_id TEXT,
        tags TEXT NOT NULL DEFAULT '[]'
      )
    `);
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_failures_source ON failures(source);
      CREATE INDEX IF NOT EXISTS idx_failures_timestamp ON failures(timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_failures_tool ON failures(tool_name);
      CREATE INDEX IF NOT EXISTS idx_failures_provider ON failures(provider_name);
      CREATE INDEX IF NOT EXISTS idx_failures_severity ON failures(severity);
    `);
  }

  private loadOccurrenceCache(): void {
    try {
      const rows = this.db.prepare(`
        SELECT source, message, tool_name, provider_name, COUNT(*) as c
        FROM failures
        WHERE timestamp > ?
        GROUP BY source, message, tool_name, provider_name
      `).all(Date.now() - 7 * 86400000) as any[];
      for (const r of rows) {
        const key = this.makeKey(r.source, r.message, r.tool_name, r.provider_name);
        this.occurrenceCache.set(key, Number(r.c));
      }
    } catch {
      // Non-fatal
    }
  }

  private occurrenceKey(r: Omit<FailureReport, 'id' | 'timestamp' | 'occurrenceCount'>): string {
    return this.makeKey(r.source, r.message, r.toolName, r.providerName);
  }

  private makeKey(source: string, message: string, toolName?: string, providerName?: string): string {
    return [source, message.slice(0, 80), toolName || '', providerName || ''].join('|');
  }

  private persist(report: FailureReport): void {
    try {
      this.db.prepare(`
        INSERT INTO failures (
          id, source, message, details, tool_name, provider_name, channel,
          task_prompt, severity, auto_healed, diagnosis, recovery_action,
          timestamp, occurrence_count, session_id, tags
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        report.id,
        report.source,
        report.message,
        report.details || null,
        report.toolName || null,
        report.providerName || null,
        report.channel || null,
        report.taskPrompt || null,
        report.severity,
        report.autoHealed ? 1 : 0,
        report.diagnosis || null,
        report.recoveryAction || null,
        report.timestamp,
        report.occurrenceCount,
        report.sessionId || null,
        JSON.stringify(report.tags || [])
      );
    } catch (e) {
      console.warn(`[FailureReporter] ⚠️  Failed to persist: ${e}`);
    }
  }

  /** Forward to LearningLoop via trackInteraction (SQLite) */
  private forwardToLearningLoop(report: FailureReport): void {
    try {
      const llPath = join(this.learningDir, 'learning.db');
      if (!existsSync(llPath)) return;

      const ll = new Database(llPath);
      ll.pragma('journal_mode = WAL');

      const inputStr = `[${report.source}] ${report.toolName || report.providerName || report.channel || report.source}: ${report.message}`;
      const outputStr = report.diagnosis
        ? `Diagnosis: ${report.diagnosis}. Recovery: ${report.recoveryAction || 'none'}`
        : `Failed ${report.occurrenceCount}x. Severity: ${report.severity}`;

      ll.prepare(`
        INSERT INTO interactions (id, session_id, input, output, outcome, tools_used, duration, feedback, timestamp)
        VALUES (?, ?, ?, ?, 'failed', '[]', 0, ?, ?)
      `).run(
        report.id,
        report.sessionId || 'default',
        inputStr.slice(0, 10000),
        outputStr.slice(0, 50000),
        JSON.stringify({ type: 'system_failure', source: report.source, severity: report.severity }),
        report.timestamp
      );

      ll.close();
    } catch {
      // Non-fatal - LearningLoop may not be initialized
    }
  }

  /** Forward to Kairos heartbeat for pattern tracking */
  private forwardToKairos(report: FailureReport): void {
    try {
      this.emit('kairos_failure', {
        source: report.source,
        message: report.message,
        toolName: report.toolName,
        providerName: report.providerName,
        severity: report.severity,
        timestamp: report.timestamp,
      });
    } catch {
      // Non-fatal
    }
  }

  /** Forward to Subconscious as a whisper for deliberation */
  private forwardToSubconscious(report: FailureReport): void {
    try {
      if (report.severity === 'low') return; // Skip low-severity whispers

      const whisper: SubconsciousWhisper = {
        type: `failure:${report.source}`,
        content: this.buildWhisperContent(report),
        confidence: report.severity === 'critical' ? 0.95
          : report.severity === 'high' ? 0.8
          : 0.6,
        source: 'failure-reporter',
        context: {
          failureId: report.id,
          source: report.source,
          toolName: report.toolName,
          providerName: report.providerName,
          occurrenceCount: report.occurrenceCount,
          autoHealed: report.autoHealed,
          diagnosis: report.diagnosis,
          recoveryAction: report.recoveryAction,
        },
      };

      this.emit('subconscious_whisper', whisper);
    } catch {
      // Non-fatal
    }
  }

  /** Forward to MetaLearner's JSON experience log */
  private forwardToMetaLearner(report: FailureReport): void {
    try {
      const metaPath = join(homedir(), '.duck', 'experiences');
      mkdirSync(metaPath, { recursive: true });
      const indexFile = join(metaPath, 'index.json');

      let experiences: any[] = [];
      try {
        if (existsSync(indexFile)) {
          experiences = JSON.parse(readFileSync(indexFile, 'utf8'));
        }
      } catch {}

      experiences.push({
        taskPrompt: report.taskPrompt || `[${report.source}] ${report.message}`,
        outcome: 'failed',
        source: report.source,
        toolName: report.toolName,
        providerName: report.providerName,
        severity: report.severity,
        diagnosis: report.diagnosis,
        recoveryAction: report.recoveryAction,
        occurrenceCount: report.occurrenceCount,
        timestamp: report.timestamp,
      });

      // Keep last 500
      const trimmed = experiences.slice(-500);
      writeFileSync(indexFile, JSON.stringify(trimmed, null, 2));
    } catch {
      // Non-fatal
    }
  }

  private buildWhisperContent(report: FailureReport): string {
    const parts: string[] = [`[${report.source}] ${report.message}`];
    if (report.toolName) parts.push(`Tool: ${report.toolName}`);
    if (report.providerName) parts.push(`Provider: ${report.providerName}`);
    if (report.occurrenceCount > 1) parts.push(`Repeated ${report.occurrenceCount}x`);
    if (report.diagnosis) parts.push(`Diagnosis: ${report.diagnosis}`);
    if (report.recoveryAction) parts.push(`Recovery: ${report.recoveryAction}`);
    if (!report.autoHealed) parts.push('NOT auto-healed — needs attention');
    return parts.join(' | ');
  }

  private estimateSeverity(message: string): FailureSeverity {
    const m = message.toLowerCase();
    if (m.includes('auth') || m.includes('unauthorized') || m.includes('401') || m.includes('403')) return 'high';
    if (m.includes('timeout') || m.includes('etimedout') || m.includes('connection')) return 'medium';
    if (m.includes('rate limit') || m.includes('429') || m.includes('500') || m.includes('502')) return 'medium';
    if (m.includes('not found') || m.includes('404') || m.includes('enoent')) return 'low';
    return 'medium';
  }

  private rowToReport(r: any): FailureReport {
    return {
      id: r.id,
      source: r.source,
      message: r.message,
      details: r.details,
      toolName: r.tool_name,
      providerName: r.provider_name,
      channel: r.channel,
      taskPrompt: r.task_prompt,
      severity: r.severity,
      autoHealed: r.auto_healed === 1,
      diagnosis: r.diagnosis,
      recoveryAction: r.recovery_action,
      timestamp: Number(r.timestamp),
      occurrenceCount: Number(r.occurrence_count),
      sessionId: r.session_id,
      tags: JSON.parse(r.tags || '[]'),
    };
  }

  private logFailure(report: FailureReport): void {
    const icon = report.severity === 'critical' ? '🔴'
      : report.severity === 'high' ? '🔴'
      : report.severity === 'medium' ? '🟡'
      : '🟢';
    console.log(
      `[FailureReporter] ${icon} [${report.source}] ${report.message}` +
      (report.occurrenceCount > 1 ? ` (x${report.occurrenceCount})` : '') +
      (report.diagnosis ? ` → ${report.diagnosis}` : '')
    );
  }

  close(): void {
    try { if (this.db.open) this.db.close(); } catch {}
  }
}

// ─── Singleton ──────────────────────────────────────────────
let _instance: FailureReporter | null = null;

export function getFailureReporter(): FailureReporter {
  if (!_instance) {
    _instance = new FailureReporter();
  }
  return _instance;
}
