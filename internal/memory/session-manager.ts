/**
 * Duck CLI - Session Maintenance & Auto-Pruning
 */

import Database from 'better-sqlite3';
import { mkdir, rm } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

export interface SessionConfig {
  maxSessions: number;
  maxDays: number;
  maxMessagesPerSession: number;
  autoPrune: boolean;
  pruneMode: 'warn' | 'enforce';
  dryRun: boolean;
}

const DEFAULT_CONFIG: SessionConfig = {
  maxSessions: 100,
  maxDays: 30,
  maxMessagesPerSession: 1000,
  autoPrune: true,
  pruneMode: 'warn',
  dryRun: false
};

export interface Session {
  id: string;
  source: string;
  model: string;
  startedAt: number;
  endedAt?: number;
  messageCount: number;
  sizeBytes: number;
}

export interface PruneResult {
  deleted: number;
  freedBytes: number;
  sessions: string[];
}

export class SessionManager {
  private db: Database.Database;
  private config: SessionConfig;
  private dbPath: string;

  constructor(dbPath?: string, config?: Partial<SessionConfig>) {
    this.dbPath = dbPath || join(process.cwd(), '.duck/state.db');
    this.config = { ...DEFAULT_CONFIG, ...config };
    mkdir(join(this.dbPath, '..'), { recursive: true }).catch(() => {});
    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL');
    this.init();
  }

  private init(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        source TEXT NOT NULL,
        model TEXT,
        started_at REAL NOT NULL,
        ended_at REAL,
        message_count INTEGER DEFAULT 0,
        size_bytes INTEGER DEFAULT 0
      )
    `);

    try {
      this.db.exec(`ALTER TABLE sessions ADD COLUMN size_bytes INTEGER DEFAULT 0`);
    } catch {
      // Column exists
    }
  }

  createSession(source: string, model: string): Session {
    const id = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = Date.now();

    this.db.prepare(
      `INSERT INTO sessions (id, source, model, started_at, message_count, size_bytes)
       VALUES (?, ?, ?, ?, 0, 0)`
    ).run(id, source, model, now);

    return { id, source, model, startedAt: now, messageCount: 0, sizeBytes: 0 };
  }

  updateSession(id: string, updates: Partial<Session>): void {
    if (updates.messageCount !== undefined) {
      this.db.prepare(`UPDATE sessions SET message_count = ? WHERE id = ?`)
        .run(updates.messageCount, id);
    }
    if (updates.endedAt !== undefined) {
      this.db.prepare(`UPDATE sessions SET ended_at = ? WHERE id = ?`)
        .run(updates.endedAt, id);
    }
  }

  endSession(id: string): void {
    this.updateSession(id, { endedAt: Date.now() });
  }

  getSession(id: string): Session | null {
    const row = this.db.prepare(
      `SELECT * FROM sessions WHERE id = ?`
    ).get(id) as any;

    if (!row) return null;

    return {
      id: row.id,
      source: row.source,
      model: row.model,
      startedAt: row.started_at,
      endedAt: row.ended_at,
      messageCount: row.message_count,
      sizeBytes: row.size_bytes
    };
  }

  getRecentSessions(limit: number = 10): Session[] {
    const rows = this.db.prepare(
      `SELECT * FROM sessions ORDER BY started_at DESC LIMIT ?`
    ).all(limit) as any[];

    return rows.map(r => ({
      id: r.id,
      source: r.source,
      model: r.model,
      startedAt: r.started_at,
      endedAt: r.ended_at,
      messageCount: r.message_count,
      sizeBytes: r.size_bytes
    }));
  }

  getSessionStats(): { total: number; oldest: number; newest: number; totalMessages: number; totalSize: number } {
    const stats = this.db.prepare(`
      SELECT 
        COUNT(*) as total,
        MIN(started_at) as oldest,
        MAX(started_at) as newest,
        SUM(message_count) as total_messages,
        SUM(size_bytes) as total_size
      FROM sessions
    `).get() as any;

    return {
      total: stats.total || 0,
      oldest: stats.oldest || 0,
      newest: stats.newest || 0,
      totalMessages: stats.total_messages || 0,
      totalSize: stats.total_size || 0
    };
  }

  async prune(options?: { dryRun?: boolean; maxDays?: number; maxSessions?: number }): Promise<PruneResult> {
    const dryRun = options?.dryRun ?? this.config.dryRun;
    const maxDays = options?.maxDays ?? this.config.maxDays;
    const maxSessions = options?.maxSessions ?? this.config.maxSessions;

    const now = Date.now();
    const cutoffTime = now - (maxDays * 24 * 60 * 60 * 1000);
    const toDelete: string[] = [];

    // Find old sessions
    const oldSessions = this.db.prepare(
      `SELECT id, size_bytes FROM sessions WHERE started_at < ?`
    ).all(cutoffTime) as any[];

    for (const s of oldSessions) {
      toDelete.push(s.id);
    }

    // Find excess sessions
    const allSessions = this.db.prepare(
      `SELECT id, started_at, size_bytes FROM sessions ORDER BY started_at DESC`
    ).all() as any[];

    if (allSessions.length > maxSessions) {
      const toRemove = allSessions.slice(maxSessions);
      for (const s of toRemove) {
        if (!toDelete.includes(s.id)) {
          toDelete.push(s.id);
        }
      }
    }

    if (dryRun) {
      return { deleted: 0, freedBytes: 0, sessions: toDelete };
    }

    let freedBytes = 0;

    for (const id of toDelete) {
      const row = this.db.prepare(
        `SELECT size_bytes FROM sessions WHERE id = ?`
      ).get(id) as any;
      freedBytes += row?.size_bytes || 0;

      this.db.prepare(`DELETE FROM messages WHERE session_id = ?`).run(id);
      this.db.prepare(`DELETE FROM sessions WHERE id = ?`).run(id);
    }

    this.db.exec(`VACUUM`);

    return { deleted: toDelete.length, freedBytes, sessions: toDelete };
  }

  checkPruneNeeded(): { needed: boolean; reason?: string; stats?: any } {
    const stats = this.getSessionStats();
    const now = Date.now();

    if (stats.total > this.config.maxSessions) {
      return { needed: true, reason: `Over session limit: ${stats.total}/${this.config.maxSessions}`, stats };
    }

    if (stats.oldest > 0) {
      const ageDays = (now - stats.oldest) / (24 * 60 * 60 * 1000);
      if (ageDays > this.config.maxDays) {
        return { needed: true, reason: `Oldest session is ${Math.round(ageDays)} days old (max ${this.config.maxDays})`, stats };
      }
    }

    return { needed: false, stats };
  }

  async autoCleanup(): Promise<PruneResult | null> {
    if (!this.config.autoPrune) return null;

    const check = this.checkPruneNeeded();
    if (!check.needed) return null;

    if (this.config.pruneMode === 'warn') {
      console.log(`[SessionManager] Warning: ${check.reason}`);
      console.log(`[SessionManager] Run with --prune to clean up`);
      return null;
    }

    return this.prune();
  }

  close(): void {
    this.db.close();
  }
}
