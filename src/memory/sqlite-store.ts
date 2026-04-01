/**
 * Duck Agent - SQLite Memory Store
 * Fast, persistent, searchable memory using better-sqlite3
 */

import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

export interface MemoryEntry {
  id: string;
  content: string;
  type: 'soul' | 'fact' | 'interaction' | 'learned' | 'preference' | 'code';
  timestamp: number;
  tags: string[];
  importance: number;      // 0-10, auto-set from content analysis
  accessCount: number;
  lastAccessed: number;
}

export interface MemorySearch {
  id: string;
  content: string;
  type: string;
  timestamp: number;
  tags: string;
  rank: number;
}

export interface ToolUsage {
  toolName: string;
  args: string;
  success: boolean;
  error?: string;
  duration: number;
  timestamp: number;
}

export interface SessionSummary {
  id: string;
  sessionId: string;
  summary: string;
  keyDecisions: string[];
  toolsUsed: string[];
  outcome: 'success' | 'partial' | 'failed';
  duration: number;
  timestamp: number;
}

export class SQLiteStore {
  private db: Database.Database;
  private memoryDir: string;
  private initialized: boolean = false;

  constructor(memoryDir?: string) {
    this.memoryDir = memoryDir || join(homedir(), '.duck', 'memory');
    mkdirSync(this.memoryDir, { recursive: true });
    
    const dbPath = join(this.memoryDir, 'duck-memory.db');
    this.db = new Database(dbPath);
    
    // Enable WAL mode for better concurrent access
    this.db.pragma('journal_mode = WAL');
    
    this.initialize();
    this.initialized = true;
  }

  private initialize(): void {
    // Core memory entries
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'fact',
        timestamp INTEGER NOT NULL,
        tags TEXT NOT NULL DEFAULT '[]',
        importance INTEGER NOT NULL DEFAULT 5,
        access_count INTEGER NOT NULL DEFAULT 0,
        last_accessed INTEGER NOT NULL DEFAULT 0
      )
    `);

    // Tool usage telemetry
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tool_usage (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tool_name TEXT NOT NULL,
        args TEXT,
        success INTEGER NOT NULL,
        error TEXT,
        duration INTEGER NOT NULL,
        timestamp INTEGER NOT NULL
      )
    `);

    // Session summaries
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        summary TEXT NOT NULL,
        key_decisions TEXT NOT NULL DEFAULT '[]',
        tools_used TEXT NOT NULL DEFAULT '[]',
        outcome TEXT NOT NULL,
        duration INTEGER NOT NULL,
        timestamp INTEGER NOT NULL
      )
    `);

    // Learned patterns (from feedback)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS patterns (
        id TEXT PRIMARY KEY,
        pattern_type TEXT NOT NULL,
        trigger TEXT NOT NULL,
        response TEXT NOT NULL,
        success_count INTEGER NOT NULL DEFAULT 0,
        failure_count INTEGER NOT NULL DEFAULT 0,
        confidence REAL NOT NULL DEFAULT 0.5,
        last_used INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL
      )
    `);

    // Indexes for fast search
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_mem_type ON memories(type);
      CREATE INDEX IF NOT EXISTS idx_mem_timestamp ON memories(timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_mem_importance ON memories(importance DESC);
      CREATE INDEX IF NOT EXISTS idx_tool_name ON tool_usage(tool_name);
      CREATE INDEX IF NOT EXISTS idx_tool_timestamp ON tool_usage(timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_pattern_type ON patterns(pattern_type);
    `);

    // Full-text search
    this.db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
        content,
        tags,
        content=memories,
        content_rowid=rowid
      )
    `);
  }

  // ─── Memory Operations ─────────────────────────────────────────

  async add(
    content: string,
    type: MemoryEntry['type'] = 'fact',
    tags: string[] = [],
    importance: number = 5
  ): Promise<string> {
    const id = `mem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const timestamp = Date.now();
    const tagsJson = JSON.stringify(tags);

    // Auto-set importance based on content
    const autoImportance = this.calcImportance(content, type);

    const stmt = this.db.prepare(`
      INSERT INTO memories (id, content, type, timestamp, tags, importance, access_count, last_accessed)
      VALUES (?, ?, ?, ?, ?, ?, 0, ?)
    `);
    stmt.run(id, content, type, timestamp, tagsJson, Math.max(importance, autoImportance), timestamp);

    // Update FTS
    this.db.prepare(`INSERT INTO memories_fts(rowid, content, tags) VALUES (last_insert_rowid(), ?, ?)`)
      .run(content, tagsJson);

    return id;
  }

  private calcImportance(content: string, type: MemoryEntry['type']): number {
    let score = 5;
    
    // Type-based boost
    const typeBoost: Record<string, number> = {
      preference: 3,
      learned: 3,
      soul: 10,
      fact: 2,
      interaction: 1,
      code: 4,
    };
    score += typeBoost[type] || 0;

    // Length boost (longer = more important)
    if (content.length > 500) score += 2;
    else if (content.length > 200) score += 1;

    // Keyword boost
    const important = ['always', 'never', 'must', 'critical', 'important', 'preference', 'style'];
    if (important.some(w => content.toLowerCase().includes(w))) score += 2;

    return Math.min(10, Math.max(1, score));
  }

  async search(query: string, limit: number = 10, type?: MemoryEntry['type']): Promise<MemorySearch[]> {
    const start = Date.now();
    
    let sql = `
      SELECT m.id, m.content, m.type, m.timestamp, m.tags, m.importance,
             rank
      FROM memories m
      JOIN memories_fts fts ON m.rowid = fts.rowid
      WHERE memories_fts MATCH ?
    `;
    const params: any[] = [query + '*'];

    if (type) {
      sql += ` AND m.type = ?`;
      params.push(type);
    }

    sql += ` ORDER BY rank, m.importance DESC LIMIT ?`;
    params.push(limit);

    try {
      const rows = this.db.prepare(sql).all(...params) as any[];
      return rows.map((r: any) => ({
        id: r.id,
        content: r.content,
        type: r.type,
        timestamp: r.timestamp,
        tags: r.tags,
        rank: r.rank || 0,
      }));
    } catch {
      // Fallback to LIKE search if FTS fails
      let likeSql = `SELECT id, content, type, timestamp, tags, importance as rank FROM memories WHERE content LIKE ?`;
      const likeParams: any[] = [`%${query}%`];
      if (type) {
        likeSql += ` AND type = ?`;
        likeParams.push(type);
      }
      likeSql += ` ORDER BY importance DESC LIMIT ?`;
      likeParams.push(limit);

      const rows = this.db.prepare(likeSql).all(...likeParams) as any[];
      return rows.map((r: any) => ({
        id: r.id,
        content: r.content,
        type: r.type,
        timestamp: r.timestamp,
        tags: r.tags,
        rank: r.rank,
      }));
    }
  }

  async get(id: string): Promise<MemoryEntry | null> {
    const row = this.db.prepare(`SELECT * FROM memories WHERE id = ?`).get(id) as any;
    if (!row) return null;

    // Update access stats
    this.db.prepare(`UPDATE memories SET access_count = access_count + 1, last_accessed = ? WHERE id = ?`)
      .run(Date.now(), id);

    return {
      id: row.id,
      content: row.content,
      type: row.type,
      timestamp: row.timestamp,
      tags: JSON.parse(row.tags),
      importance: row.importance,
      accessCount: row.access_count,
      lastAccessed: row.last_accessed,
    };
  }

  async list(type?: MemoryEntry['type'], limit: number = 50): Promise<MemoryEntry[]> {
    let sql = `SELECT * FROM memories`;
    const params: any[] = [];
    if (type) {
      sql += ` WHERE type = ?`;
      params.push(type);
    }
    sql += ` ORDER BY timestamp DESC LIMIT ?`;
    params.push(limit);

    const rows = this.db.prepare(sql).all(...params) as any[];
    return rows.map(r => ({
      id: r.id,
      content: r.content,
      type: r.type,
      timestamp: r.timestamp,
      tags: JSON.parse(r.tags),
      importance: r.importance,
      accessCount: r.access_count,
      lastAccessed: r.last_accessed,
    }));
  }

  async delete(id: string): Promise<boolean> {
    const result = this.db.prepare(`DELETE FROM memories WHERE id = ?`).run(id);
    return result.changes > 0;
  }

  async update(id: string, content: string, tags?: string[]): Promise<boolean> {
    if (tags !== undefined) {
      const result = this.db.prepare(`UPDATE memories SET content = ?, tags = ? WHERE id = ?`)
        .run(content, JSON.stringify(tags), id);
      return result.changes > 0;
    } else {
      const result = this.db.prepare(`UPDATE memories SET content = ? WHERE id = ?`)
        .run(content, id);
      return result.changes > 0;
    }
  }

  // ─── Tool Telemetry ────────────────────────────────────────────

  async logToolUse(tool: ToolUsage): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO tool_usage (tool_name, args, success, error, duration, timestamp)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(tool.toolName, tool.args, tool.success ? 1 : 0, tool.error || null, tool.duration, tool.timestamp);
  }

  async getToolStats(days: number = 7): Promise<Record<string, { total: number; success: number; avgDuration: number; successRate: number }>> {
    const since = Date.now() - days * 24 * 60 * 60 * 1000;
    
    const rows = this.db.prepare(`
      SELECT tool_name, 
             COUNT(*) as total,
             SUM(success) as success,
             AVG(duration) as avg_duration
      FROM tool_usage
      WHERE timestamp > ?
      GROUP BY tool_name
    `).all(since) as any[];

    const stats: Record<string, any> = {};
    for (const r of rows) {
      const total = r.total as number;
      const success = r.success as number;
      stats[r.tool_name] = {
        total,
        success,
        avgDuration: Math.round(r.avg_duration),
        successRate: Math.round((success / total) * 100) / 100,
      };
    }
    return stats;
  }

  async getFailingTools(days: number = 7): Promise<string[]> {
    const since = Date.now() - days * 24 * 60 * 60 * 1000;
    const rows = this.db.prepare(`
      SELECT tool_name
      FROM tool_usage
      WHERE timestamp > ? AND success = 0
      GROUP BY tool_name
      HAVING COUNT(*) > 3
    `).all(since) as any[];
    return rows.map(r => r.tool_name);
  }

  // ─── Session Summaries ─────────────────────────────────────────

  async saveSession(summary: SessionSummary): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO sessions (id, session_id, summary, key_decisions, tools_used, outcome, duration, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      summary.id,
      summary.sessionId,
      summary.summary,
      JSON.stringify(summary.keyDecisions),
      JSON.stringify(summary.toolsUsed),
      summary.outcome,
      summary.duration,
      summary.timestamp
    );
  }

  async getRecentSessions(limit: number = 10): Promise<SessionSummary[]> {
    const rows = this.db.prepare(`
      SELECT * FROM sessions ORDER BY timestamp DESC LIMIT ?
    `).all(limit) as any[];

    return rows.map(r => ({
      id: r.id,
      sessionId: r.session_id,
      summary: r.summary,
      keyDecisions: JSON.parse(r.key_decisions),
      toolsUsed: JSON.parse(r.tools_used),
      outcome: r.outcome,
      duration: r.duration,
      timestamp: r.timestamp,
    }));
  }

  // ─── Pattern Learning ─────────────────────────────────────────

  async learnPattern(type: string, trigger: string, response: string): Promise<string> {
    const id = `pat_${Date.now()}`;
    const existing = this.db.prepare(`SELECT * FROM patterns WHERE trigger = ? AND pattern_type = ?`)
      .get(trigger, type) as any;

    if (existing) {
      this.db.prepare(`
        UPDATE patterns SET response = ?, success_count = success_count + 1, 
        confidence = (success_count + 1.0) / (success_count + failure_count + 2),
        last_used = ?
        WHERE id = ?
      `).run(response, Date.now(), existing.id);
      return existing.id;
    }

    this.db.prepare(`
      INSERT INTO patterns (id, pattern_type, trigger, response, success_count, failure_count, confidence, last_used, created_at)
      VALUES (?, ?, ?, ?, 1, 0, 0.6, ?, ?)
    `).run(id, type, trigger, response, Date.now(), Date.now());
    return id;
  }

  async getPatterns(type?: string): Promise<any[]> {
    let sql = `SELECT * FROM patterns`;
    const params: any[] = [];
    if (type) {
      sql += ` WHERE pattern_type = ?`;
      params.push(type);
    }
    sql += ` ORDER BY confidence DESC, usage_count DESC`;
    return this.db.prepare(sql).all(...params);
  }

  async recordPatternFailure(patternId: string): Promise<void> {
    this.db.prepare(`
      UPDATE patterns SET failure_count = failure_count + 1,
      confidence = success_count / (success_count + failure_count + 2),
      last_used = ?
      WHERE id = ?
    `).run(Date.now(), patternId);
  }

  // ─── Utility ───────────────────────────────────────────────────

  async prune(maxEntries: number = 10000): Promise<number> {
    const count = this.db.prepare(`SELECT COUNT(*) as c FROM memories`).get() as any;
    if (count.c <= maxEntries) return 0;

    // Delete oldest, lowest-importance entries
    const result = this.db.prepare(`
      DELETE FROM memories WHERE id IN (
        SELECT id FROM memories 
        ORDER BY importance ASC, timestamp ASC 
        LIMIT ?
      )
    `).run(count.c - maxEntries);
    return result.changes;
  }

  close(): void {
    if (this.initialized && this.db.open) {
      this.db.close();
      this.initialized = false;
    }
  }

  stats(): { memories: number; toolLogs: number; sessions: number; patterns: number } {
    const memories = (this.db.prepare(`SELECT COUNT(*) as c FROM memories`).get() as any).c;
    const toolLogs = (this.db.prepare(`SELECT COUNT(*) as c FROM tool_usage`).get() as any).c;
    const sessions = (this.db.prepare(`SELECT COUNT(*) as c FROM sessions`).get() as any).c;
    const patterns = (this.db.prepare(`SELECT COUNT(*) as c FROM patterns`).get() as any).c;
    return { memories, toolLogs, sessions, patterns };
  }
}

export default SQLiteStore;
