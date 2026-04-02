/**
 * Duck Agent Sub-Conscious - SQLite Memory Store
 * Persistent memory storage for the Sub-Conscious daemon
 * NO external Letta dependency
 */

// @ts-ignore
import Database from 'better-sqlite3';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

export interface StoredMemory {
  id: string;
  content: string;
  context: string;
  tags: string[];
  importance: number;
  source: 'session' | 'council' | 'analysis' | 'manual';
  sessionId?: string;
  topic?: string;
  embedding?: string;
  createdAt: string;
  accessedAt: string;
  accessCount: number;
}

export interface MemoryQuery {
  query: string;
  tags?: string[];
  source?: string;
  limit?: number;
  since?: string;
}

export class SqliteStore {
  private db: any;
  private dataDir: string;

  constructor(dataDir?: string) {
    this.dataDir = dataDir || join(process.env.HOME || '/tmp', '.duckagent', 'subconscious');
    if (!existsSync(this.dataDir)) {
      mkdirSync(this.dataDir, { recursive: true });
    }
    
    const dbPath = join(this.dataDir, 'memories.db');
    this.db = new Database(dbPath);
    this.init();
  }

  private init(): void {
    // Enable FTS5 for full-text search
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        context TEXT DEFAULT '',
        tags TEXT DEFAULT '[]',
        importance REAL DEFAULT 0.5,
        source TEXT DEFAULT 'session',
        session_id TEXT,
        topic TEXT,
        embedding TEXT,
        created_at TEXT NOT NULL,
        accessed_at TEXT NOT NULL,
        access_count INTEGER DEFAULT 0
      );
      
      CREATE INDEX IF NOT EXISTS idx_memories_source ON memories(source);
      CREATE INDEX IF NOT EXISTS idx_memories_topic ON memories(topic);
      CREATE INDEX IF NOT EXISTS idx_memories_created ON memories(created_at);
      
      CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
        content, context, tags,
        content='memories',
        content_rowid='rowid'
      );
      
      CREATE TABLE IF NOT EXISTS council_memories (
        id TEXT PRIMARY KEY,
        councilor_id TEXT,
        topic TEXT,
        deliberation TEXT,
        insight TEXT,
        tags TEXT DEFAULT '[]',
        created_at TEXT NOT NULL
      );
      
      CREATE TABLE IF NOT EXISTS session_summaries (
        session_id TEXT PRIMARY KEY,
        summary TEXT,
        patterns TEXT,
        key_decisions TEXT,
        topics TEXT,
        created_at TEXT NOT NULL
      );
    `);

    // Triggers to keep FTS in sync
    this.db.exec(`
      CREATE TRIGGER IF NOT EXISTS memories_ai AFTER INSERT ON memories BEGIN
        INSERT INTO memories_fts(rowid, content, context, tags)
        VALUES (new.rowid, new.content, new.context, new.tags);
      END;
    `);
  }

  /**
   * Store a new memory
   */
  async save(memory: StoredMemory): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO memories 
      (id, content, context, tags, importance, source, session_id, topic, embedding, created_at, accessed_at, access_count)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      memory.id,
      memory.content,
      memory.context,
      JSON.stringify(memory.tags),
      memory.importance,
      memory.source,
      memory.sessionId || null,
      memory.topic || null,
      memory.embedding || null,
      memory.createdAt,
      memory.accessedAt,
      memory.accessCount
    );
  }

  /**
   * Search memories by query (FTS5 full-text search)
   */
  async search(query: MemoryQuery): Promise<StoredMemory[]> {
    const { query: q, tags, source, limit = 20, since } = query;
    
    let sql = `
      SELECT m.*, bm25(memories_fts) as rank
      FROM memories m
      JOIN memories_fts f ON m.rowid = f.rowid
      WHERE memories_fts MATCH ?
    `;
    const params: any[] = [q + '*'];  // FTS5 wildcard search

    if (source) {
      sql += ' AND m.source = ?';
      params.push(source);
    }

    if (since) {
      sql += ' AND m.created_at >= ?';
      params.push(since);
    }

    sql += ' ORDER BY rank LIMIT ?';
    params.push(limit);

    const rows = this.db.prepare(sql).all(...params) as any[];
    return rows.map(this.rowToMemory);
  }

  /**
   * Get memories by tags
   */
  async byTags(tags: string[], limit = 20): Promise<StoredMemory[]> {
    const tagList = tags.map(t => `"${t}"`).join(' ');
    const rows = this.db.prepare(`
      SELECT * FROM memories 
      WHERE tags LIKE ? 
      ORDER BY importance DESC, created_at DESC 
      LIMIT ?
    `).all(`%${tags[0]}%`, limit) as any[];
    return rows.map(this.rowToMemory);
  }

  /**
   * Get recent memories
   */
  async recent(limit = 20): Promise<StoredMemory[]> {
    const rows = this.db.prepare(`
      SELECT * FROM memories 
      ORDER BY accessed_at DESC 
      LIMIT ?
    `).all(limit) as any[];
    return rows.map(this.rowToMemory);
  }

  /**
   * Get memory by ID
   */
  async get(id: string): Promise<StoredMemory | null> {
    const row = this.db.prepare('SELECT * FROM memories WHERE id = ?').get(id) as any;
    if (row) {
      // Update access count
      this.db.prepare('UPDATE memories SET access_count = access_count + 1, accessed_at = ? WHERE id = ?')
        .run(new Date().toISOString(), id);
    }
    return row ? this.rowToMemory(row) : null;
  }

  /**
   * Store council deliberation memory
   */
  async saveCouncilMemory(
    id: string,
    councilorId: string,
    topic: string,
    deliberation: string,
    insight: string,
    tags: string[]
  ): Promise<void> {
    this.db.prepare(`
      INSERT OR REPLACE INTO council_memories 
      (id, councilor_id, topic, deliberation, insight, tags, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, councilorId, topic, deliberation, insight, JSON.stringify(tags), new Date().toISOString());
  }

  /**
   * Get council memories for a topic
   */
  async getCouncilMemories(topic: string, limit = 10): Promise<any[]> {
    return this.db.prepare(`
      SELECT * FROM council_memories 
      WHERE topic LIKE ? 
      ORDER BY created_at DESC 
      LIMIT ?
    `).all(`%${topic}%`, limit);
  }

  /**
   * Store session summary
   */
  async saveSessionSummary(
    sessionId: string,
    summary: string,
    patterns: string[],
    keyDecisions: string[],
    topics: string[]
  ): Promise<void> {
    this.db.prepare(`
      INSERT OR REPLACE INTO session_summaries 
      (session_id, summary, patterns, key_decisions, topics, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(sessionId, summary, JSON.stringify(patterns), JSON.stringify(keyDecisions), JSON.stringify(topics), new Date().toISOString());
  }

  /**
   * Get session summary
   */
  async getSessionSummary(sessionId: string): Promise<any | null> {
    const row = this.db.prepare('SELECT * FROM session_summaries WHERE session_id = ?').get(sessionId) as any;
    if (!row) return null;
    return {
      ...row,
      patterns: JSON.parse(row.patterns || '[]'),
      keyDecisions: JSON.parse(row.key_decisions || '[]'),
      topics: JSON.parse(row.topics || '[]')
    };
  }

  /**
   * Get stats
   */
  async stats(): Promise<{ total: number; bySource: Record<string, number>; oldest: string | null; newest: string | null }> {
    const total = (this.db.prepare('SELECT COUNT(*) as c FROM memories').get() as any).c;
    const bySourceRows = this.db.prepare('SELECT source, COUNT(*) as c FROM memories GROUP BY source').all() as any[];
    const oldest = (this.db.prepare('SELECT MIN(created_at) as d FROM memories').get() as any)?.d;
    const newest = (this.db.prepare('SELECT MAX(created_at) as d FROM memories').get() as any)?.d;
    
    const bySource: Record<string, number> = {};
    for (const row of bySourceRows) {
      bySource[row.source] = row.c;
    }
    
    return { total, bySource, oldest, newest };
  }

  /**
   * Delete memory
   */
  async delete(id: string): Promise<void> {
    this.db.prepare('DELETE FROM memories WHERE id = ?').run(id);
  }

  /**
   * Clear all memories
   */
  async clear(): Promise<void> {
    this.db.exec('DELETE FROM memories; DELETE FROM council_memories; DELETE FROM session_summaries;');
  }

  private rowToMemory(row: any): StoredMemory {
    return {
      id: row.id,
      content: row.content,
      context: row.context || '',
      tags: JSON.parse(row.tags || '[]'),
      importance: row.importance,
      source: row.source,
      sessionId: row.session_id,
      topic: row.topic,
      embedding: row.embedding,
      createdAt: row.created_at,
      accessedAt: row.accessed_at,
      accessCount: row.access_count
    };
  }

  close(): void {
    this.db.close();
  }
}
