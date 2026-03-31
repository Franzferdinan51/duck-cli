/**
 * Duck CLI - SQLite Session Store with FTS5
 * 
 * Based on Hermes Agent's hermes_state.py:
 * - WAL mode for concurrent readers
 * - FTS5 full-text search
 * - Session tracking with tokens/usage
 */

import { Database } from 'bun:sqlite';
import { mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

export interface Session {
  id: string;
  source: string;
  userId?: string;
  model: string;
  startedAt: number;
  endedAt?: number;
  messageCount: number;
  toolCallCount: number;
  inputTokens: number;
  outputTokens: number;
}

export interface Message {
  id?: number;
  sessionId: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  toolCallId?: string;
  toolCalls?: string;
  timestamp: number;
}

export class SessionStore {
  private db: Database;
  private dbPath: string;

  constructor(dbPath?: string) {
    this.dbPath = dbPath || join(process.cwd(), '.duck/state.db');
    mkdir(join(this.dbPath, '..'), { recursive: true }).catch(() => {});
    
    this.db = new Database(this.dbPath);
    this.db.exec('PRAGMA journal_mode = WAL');
    this.init();
  }

  private init(): void {
    // Sessions table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        source TEXT NOT NULL,
        user_id TEXT,
        model TEXT,
        started_at REAL NOT NULL,
        ended_at REAL,
        message_count INTEGER DEFAULT 0,
        tool_call_count INTEGER DEFAULT 0,
        input_tokens INTEGER DEFAULT 0,
        output_tokens INTEGER DEFAULT 0
      )
    `);

    // Messages table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT,
        tool_call_id TEXT,
        tool_calls TEXT,
        timestamp REAL NOT NULL,
        FOREIGN KEY (session_id) REFERENCES sessions(id)
      )
    `);

    // Indexes
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_sessions_started ON sessions(started_at DESC);
      CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id, timestamp);
    `);

    // FTS5 virtual table
    this.db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
        content,
        content=messages,
        content_rowid=id
      )
    `);
  }

  createSession(source: string, model: string): Session {
    const id = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = Date.now();

    this.db.exec(
      `INSERT INTO sessions (id, source, model, started_at, message_count, tool_call_count)
       VALUES (?, ?, ?, ?, 0, 0)`,
      [id, source, model, now]
    );

    return { id, source, model, startedAt: now, messageCount: 0, toolCallCount: 0, inputTokens: 0, outputTokens: 0 };
  }

  addMessage(sessionId: string, role: Message['role'], content: string, toolCalls?: any): void {
    const now = Date.now();
    const toolCallsJson = toolCalls ? JSON.stringify(toolCalls) : null;

    this.db.exec(
      `INSERT INTO messages (session_id, role, content, tool_calls, timestamp)
       VALUES (?, ?, ?, ?, ?)`,
      [sessionId, role, content, toolCallsJson, now]
    );

    // Update session counters
    this.db.exec(
      `UPDATE sessions SET message_count = message_count + 1 WHERE id = ?`,
      [sessionId]
    );

    if (toolCalls) {
      this.db.exec(
        `UPDATE sessions SET tool_call_count = tool_call_count + ? WHERE id = ?`,
        [toolCalls.length, sessionId]
      );
    }
  }

  getMessages(sessionId: string): Message[] {
    const rows = this.db.query(
      `SELECT * FROM messages WHERE session_id = ? ORDER BY timestamp`,
      [sessionId]
    ).all() as any[];

    return rows.map(r => ({
      id: r.id,
      sessionId: r.session_id,
      role: r.role,
      content: r.content,
      toolCallId: r.tool_call_id,
      toolCalls: r.tool_calls,
      timestamp: r.timestamp
    }));
  }

  search(query: string, limit: number = 10): { sessionId: string; content: string; rank: number }[] {
    try {
      const rows = this.db.query(`
        SELECT messages.session_id, messages.content, messages_fts.rank
        FROM messages_fts
        JOIN messages ON messages_fts.rowid = messages.id
        WHERE messages_fts MATCH ?
        ORDER BY rank
        LIMIT ?
      `, [query, limit]).all(query, limit) as any[];

      return rows.map(r => ({
        sessionId: r.session_id,
        content: r.content,
        rank: r.rank
      }));
    } catch {
      // FTS might not be available, fallback to LIKE
      const rows = this.db.query(`
        SELECT session_id, content, 0 as rank
        FROM messages
        WHERE content LIKE ?
        LIMIT ?
      `, [`%${query}%`, limit]).all(`%${query}%`, limit) as any[];

      return rows.map(r => ({
        sessionId: r.session_id,
        content: r.content,
        rank: r.rank
      }));
    }
  }

  getRecentSessions(limit: number = 10): Session[] {
    const rows = this.db.query(
      `SELECT * FROM sessions ORDER BY started_at DESC LIMIT ?`,
      [limit]
    ).all(limit) as any[];

    return rows.map(r => ({
      id: r.id,
      source: r.source,
      userId: r.user_id,
      model: r.model,
      startedAt: r.started_at,
      endedAt: r.ended_at,
      messageCount: r.message_count,
      toolCallCount: r.tool_call_count,
      inputTokens: r.input_tokens,
      outputTokens: r.output_tokens
    }));
  }

  endSession(sessionId: string): void {
    this.db.exec(
      `UPDATE sessions SET ended_at = ? WHERE id = ?`,
      [Date.now(), sessionId]
    );
  }

  close(): void {
    this.db.close();
  }
}
