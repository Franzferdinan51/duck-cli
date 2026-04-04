/**
 * Duck Agent - Session Store
 * SQLite-backed session history with FTS5 search
 * Enables cross-session context without manual memory
 */

import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

export interface SessionMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  toolName?: string;
  toolResult?: string;
  timestamp: number;
  tokens?: number;
  cost?: number;
}

export interface SessionSummary {
  id: string;
  sessionId: string;
  summary: string;
  topic: string;
  outcome: 'success' | 'partial' | 'failed' | 'ongoing';
  messageCount: number;
  duration: number;
  firstMessage: string;
  lastMessage: string;
  timestamp: number;
}

export class SessionStore {
  private db: Database.Database;
  private memoryDir: string;

  constructor(memoryDir?: string) {
    this.memoryDir = memoryDir || join(homedir(), '.duck', 'memory');
    mkdirSync(this.memoryDir, { recursive: true });
    
    const dbPath = join(this.memoryDir, 'sessions.db');
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    
    this.initialize();
  }

  private initialize(): void {
    // Sessions table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        tool_name TEXT,
        tool_result TEXT,
        timestamp INTEGER NOT NULL,
        tokens INTEGER,
        cost REAL
      )
    `);

    // Session summaries
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS session_summaries (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL UNIQUE,
        summary TEXT NOT NULL,
        topic TEXT NOT NULL DEFAULT '',
        outcome TEXT NOT NULL DEFAULT 'ongoing',
        message_count INTEGER NOT NULL DEFAULT 0,
        duration INTEGER NOT NULL DEFAULT 0,
        first_message TEXT NOT NULL DEFAULT '',
        last_message TEXT NOT NULL DEFAULT '',
        timestamp INTEGER NOT NULL
      )
    `);

    // FTS5 for conversation search
    this.db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS sessions_fts USING fts5(
        session_id,
        role,
        content,
        content=sessions,
        content_rowid=rowid
      )
    `);

    // Indexes
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_session_id ON sessions(session_id);
      CREATE INDEX IF NOT EXISTS idx_timestamp ON sessions(timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_session_summary_id ON session_summaries(session_id);
    `);
  }

  // ─── Message Operations ────────────────────────────────────────

  addMessage(msg: Omit<SessionMessage, 'id'>): string {
    const id = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    
    // Serialize content - SQLite can only bind primitives, not arrays/objects
    const contentStr = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
    console.log('[DEBUG] addMessage called, content type:', typeof msg.content, 'contentStr type:', typeof contentStr);
    
    const stmt = this.db.prepare(`
      INSERT INTO sessions (id, session_id, role, content, tool_name, tool_result, timestamp, tokens, cost)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      id,
      msg.sessionId,
      msg.role,
      contentStr,
      msg.toolName || null,
      msg.toolResult || null,
      msg.timestamp,
      msg.tokens || null,
      msg.cost || null
    );

    // Update FTS (only if content is string - FTS doesn't handle arrays)
    if (typeof msg.content === 'string') {
      this.db.prepare(`INSERT INTO sessions_fts(rowid, session_id, role, content) VALUES (last_insert_rowid(), ?, ?, ?)`)
        .run(msg.sessionId, msg.role, msg.content);
    }

    // Update or create summary
    this.upsertSummary(msg.sessionId);

    return id;
  }

  private upsertSummary(sessionId: string): void {
    const stats = this.getSessionStats(sessionId);
    if (!stats) return;

    const firstMsg = this.db.prepare(`SELECT content FROM sessions WHERE session_id = ? ORDER BY timestamp ASC LIMIT 1`)
      .get(sessionId) as { content: string } | undefined;
    const lastMsg = this.db.prepare(`SELECT content FROM sessions WHERE session_id = ? ORDER BY timestamp DESC LIMIT 1`)
      .get(sessionId) as { content: string } | undefined;

    // Determine topic from first message
    const first = firstMsg?.content || '';
    const topic = this.extractTopic(first);

    // Determine outcome
    let outcome: SessionSummary['outcome'] = 'ongoing';
    if (stats.isActive) {
      outcome = 'ongoing';
    } else if (stats.failedCount > stats.successCount * 2) {
      outcome = 'failed';
    } else if (stats.successCount > 0) {
      outcome = 'success';
    } else {
      outcome = 'partial';
    }

    const existing = this.db.prepare(`SELECT id FROM session_summaries WHERE session_id = ?`).get(sessionId);
    if (existing) {
      this.db.prepare(`
        UPDATE session_summaries SET
          summary = ?, topic = ?, outcome = ?, message_count = ?,
          duration = ?, first_message = ?, last_message = ?, timestamp = ?
        WHERE session_id = ?
      `).run('', topic, outcome, stats.count, stats.duration, first.slice(0, 200), lastMsg?.content.slice(0, 200) || '', Date.now(), sessionId);
    } else {
      this.db.prepare(`
        INSERT INTO session_summaries (id, session_id, summary, topic, outcome, message_count, duration, first_message, last_message, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(`sum_${Date.now()}`, sessionId, '', topic, outcome, stats.count, stats.duration, first.slice(0, 200), lastMsg?.content.slice(0, 200) || '', Date.now());
    }
  }

  private extractTopic(firstMessage: string): string {
    // Simple topic extraction - first meaningful words
    const words = firstMessage.toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 3)
      .slice(0, 5);
    return words.join(' ') || 'general';
  }

  private getSessionStats(sessionId: string): { count: number; duration: number; successCount: number; failedCount: number; isActive: boolean } | null {
    const msgs = this.db.prepare(`SELECT * FROM sessions WHERE session_id = ?`).all(sessionId) as any[];
    if (msgs.length === 0) return null;

    const first = msgs.reduce((min, m) => m.timestamp < min ? m.timestamp : min, msgs[0].timestamp);
    const last = msgs.reduce((max, m) => m.timestamp > max ? m.timestamp : max, msgs[0].timestamp);
    const successCount = msgs.filter(m => m.role === 'assistant' && !m.content.includes('❌') && !m.content.includes('error')).length;
    const failedCount = msgs.filter(m => m.content.includes('❌') || m.content.includes('error')).length;

    // Session is "active" if last message within 5 minutes
    const isActive = Date.now() - last < 5 * 60 * 1000;

    return {
      count: msgs.length,
      duration: last - first,
      successCount,
      failedCount,
      isActive
    };
  }

  // ─── Search ──────────────────────────────────────────────────

  /**
   * Full-text search across all sessions
   */
  search(query: string, limit: number = 20, sessionId?: string): SessionMessage[] {
    let sql: string;
    let params: any[];

    if (sessionId) {
      sql = `
        SELECT s.id, s.session_id, s.role, s.content, s.tool_name, s.tool_result, s.timestamp, s.tokens, s.cost
        FROM sessions s
        JOIN sessions_fts fts ON s.rowid = fts.rowid
        WHERE sessions_fts MATCH ? AND s.session_id = ?
        ORDER BY s.timestamp DESC
        LIMIT ?
      `;
      params = [query + '*', sessionId, limit];
    } else {
      sql = `
        SELECT s.id, s.session_id, s.role, s.content, s.tool_name, s.tool_result, s.timestamp, s.tokens, s.cost
        FROM sessions s
        JOIN sessions_fts fts ON s.rowid = fts.rowid
        WHERE sessions_fts MATCH ?
        ORDER BY s.timestamp DESC
        LIMIT ?
      `;
      params = [query + '*', limit];
    }

    try {
      const rows = this.db.prepare(sql).all(...params) as any[];
      return rows.map(this.mapRow);
    } catch {
      // Fallback to LIKE
      const likeSql = sessionId
        ? `SELECT * FROM sessions WHERE session_id = ? AND content LIKE ? ORDER BY timestamp DESC LIMIT ?`
        : `SELECT * FROM sessions WHERE content LIKE ? ORDER BY timestamp DESC LIMIT ?`;
      const likeParams = sessionId ? [sessionId, `%${query}%`, limit] : [`%${query}%`, limit];
      const rows = this.db.prepare(likeSql).all(...likeParams) as any[];
      return rows.map(this.mapRow);
    }
  }

  /**
   * Get recent conversations (grouped by session)
   */
  getRecentSessions(limit: number = 10): { sessionId: string; lastMessage: string; timestamp: number; messageCount: number; topic: string }[] {
    const summaries = this.db.prepare(`
      SELECT session_id, last_message, timestamp, message_count, topic
      FROM session_summaries
      ORDER BY timestamp DESC
      LIMIT ?
    `).all(limit) as any[];

    return summaries.map(s => ({
      sessionId: s.session_id,
      lastMessage: s.last_message,
      timestamp: s.timestamp,
      messageCount: s.message_count,
      topic: s.topic
    }));
  }

  /**
   * Get messages for a specific session
   */
  getSessionMessages(sessionId: string, limit: number = 100, offset: number = 0): SessionMessage[] {
    const rows = this.db.prepare(`
      SELECT * FROM sessions WHERE session_id = ?
      ORDER BY timestamp ASC LIMIT ? OFFSET ?
    `).all(sessionId, limit, offset) as any[];

    return rows.map(this.mapRow);
  }

  /**
   * Get conversation context for a session (recent messages for context window)
   */
  getSessionContext(sessionId: string, maxMessages: number = 50): SessionMessage[] {
    const rows = this.db.prepare(`
      SELECT * FROM (
        SELECT * FROM sessions WHERE session_id = ?
        ORDER BY timestamp DESC LIMIT ?
      ) sub
      ORDER BY timestamp ASC
    `).all(sessionId, maxMessages) as any[];

    return rows.map(this.mapRow);
  }

  private mapRow = (r: any): SessionMessage => ({
    id: r.id,
    sessionId: r.session_id,
    role: r.role,
    content: r.content,
    toolName: r.tool_name,
    toolResult: r.tool_result,
    timestamp: r.timestamp,
    tokens: r.tokens,
    cost: r.cost
  });

  // ─── Session Management ──────────────────────────────────────

  endSession(sessionId: string, outcome: SessionSummary['outcome'] = 'success'): void {
    this.db.prepare(`UPDATE session_summaries SET outcome = ? WHERE session_id = ?`)
      .run(outcome, sessionId);
  }

  updateSummary(sessionId: string, summary: string): void {
    this.db.prepare(`UPDATE session_summaries SET summary = ? WHERE session_id = ?`)
      .run(summary, sessionId);
  }

  getSession(id: string): SessionSummary | null {
    const row = this.db.prepare(`SELECT * FROM session_summaries WHERE session_id = ?`).get(id) as any;
    if (!row) return null;
    return {
      id: row.id,
      sessionId: row.session_id,
      summary: row.summary,
      topic: row.topic,
      outcome: row.outcome,
      messageCount: row.message_count,
      duration: row.duration,
      firstMessage: row.first_message,
      lastMessage: row.last_message,
      timestamp: row.timestamp
    };
  }

  listAllSessions(limit: number = 50): SessionSummary[] {
    const rows = this.db.prepare(`
      SELECT * FROM session_summaries ORDER BY timestamp DESC LIMIT ?
    `).all(limit) as any[];

    return rows.map(r => ({
      id: r.id,
      sessionId: r.session_id,
      summary: r.summary,
      topic: r.topic,
      outcome: r.outcome,
      messageCount: r.message_count,
      duration: r.duration,
      firstMessage: r.first_message,
      lastMessage: r.last_message,
      timestamp: r.timestamp
    }));
  }

  // ─── LLM Summarization Helper ────────────────────────────────

  /**
   * Generate a summary of a session using the conversation itself
   */
  generateSessionSummary(sessionId: string): string {
    const msgs = this.getSessionMessages(sessionId, 20);
    if (msgs.length === 0) return 'Empty session';

    const userMsgs = msgs.filter(m => m.role === 'user').map(m => m.content);
    const assistantMsgs = msgs.filter(m => m.role === 'assistant').map(m => m.content);

    const firstGoal = userMsgs[0] || '';
    const lastResult = assistantMsgs[assistantMsgs.length - 1] || '';

    // Simple extractive summary - first goal + last result
    return `Goal: ${firstGoal.slice(0, 100)}\nOutcome: ${lastResult.slice(0, 150)}`;
  }

  // ─── Stats ──────────────────────────────────────────────────

  stats(): { totalSessions: number; totalMessages: number; activeSessions: number; avgSessionLength: number } {
    const sessions = (this.db.prepare(`SELECT COUNT(DISTINCT session_id) as c FROM session_summaries`).get() as any).c;
    const messages = (this.db.prepare(`SELECT COUNT(*) as c FROM sessions`).get() as any).c;
    const active = (this.db.prepare(`SELECT COUNT(*) as c FROM session_summaries WHERE outcome = 'ongoing'`).get() as any).c;
    const avgLen = messages / Math.max(1, sessions);

    return {
      totalSessions: sessions,
      totalMessages: messages,
      activeSessions: active,
      avgSessionLength: Math.round(avgLen)
    };
  }

  close(): void {
    try { if (this.db.open) this.db.close(); } catch {}
  }
}

export default SessionStore;
