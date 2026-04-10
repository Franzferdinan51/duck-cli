/**
 * Lossless Context Management (LCM) Engine for duck-cli
 * Based on Lossless Claw - DAG-based summarization that preserves every message
 * 
 * Uses better-sqlite3 for synchronous, high-performance SQLite operations
 */

import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { ChatMessage } from '../agent/chat-session.js';

// Dynamic import for better-sqlite3 to avoid build issues
let Database: any = null;
let dbInstance: any = null;

// Configuration
const LCM_DIR = join(homedir(), '.duck-cli', 'lcm');
const LCM_DB_PATH = process.env.LCM_DATABASE_PATH || join(LCM_DIR, 'lcm.db');

// LCM Configuration
export const LCM_CONFIG = {
  freshTailCount: parseInt(process.env.LCM_FRESH_TAIL_COUNT || '64'),
  leafChunkTokens: parseInt(process.env.LCM_LEAF_CHUNK_TOKENS || '20000'),
  leafTargetTokens: parseInt(process.env.LCM_LEAF_TARGET_TOKENS || '1200'),
  condensedTargetTokens: parseInt(process.env.LCM_CONDENSED_TARGET_TOKENS || '2000'),
  contextThreshold: parseFloat(process.env.LCM_CONTEXT_THRESHOLD || '0.75'),
  incrementalMaxDepth: parseInt(process.env.LCM_INCREMENTAL_MAX_DEPTH || '1'),
  minFanoutLeaf: parseInt(process.env.LCM_LEAF_MIN_FANOUT || '8'),
  minFanoutCondensed: parseInt(process.env.LCM_CONDENSED_MIN_FANOUT || '4'),
  summaryModel: process.env.LCM_SUMMARY_MODEL || 'minimax/MiniMax-M2.7',
  expansionModel: process.env.LCM_EXPANSION_MODEL || 'minimax/MiniMax-M2.7',
  enabled: process.env.LCM_ENABLED !== 'false',
};

// Types
export interface LCMMessage {
  id: number;
  conversationId: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  tokenCount: number;
}

export interface LCMSummary {
  id: number;
  conversationId: number;
  depth: number;
  content: string;
  tokenCount: number;
  sourceIds: number[];
  sourceType: 'messages' | 'summaries';
  createdAt: number;
}

export interface LCMContextResult {
  messages: ChatMessage[];
  summaries: LCMSummary[];
  totalTokens: number;
  freshTailCount: number;
  summaryCount: number;
}

/**
 * Initialize better-sqlite3
 */
function initDatabase(): any {
  if (dbInstance) return dbInstance;
  if (!LCM_CONFIG.enabled) return null;

  try {
    // Dynamic require to avoid build-time dependency
    const BetterSQLite3 = require('better-sqlite3');
    
    // Ensure directory exists
    if (!existsSync(LCM_DIR)) {
      mkdirSync(LCM_DIR, { recursive: true });
    }

    // Open database
    dbInstance = new BetterSQLite3(LCM_DB_PATH);
    dbInstance.pragma('journal_mode = WAL');

    // Create tables
    createTables();

    console.log(`[LCM] Database initialized at ${LCM_DB_PATH}`);
    return dbInstance;
  } catch (err) {
    console.warn('[LCM] Failed to initialize database:', err.message);
    console.warn('[LCM] Run: npm install better-sqlite3');
    LCM_CONFIG.enabled = false;
    return null;
  }
}

/**
 * Create database tables
 */
function createTables(): void {
  if (!dbInstance) return;

  // Conversations table
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT UNIQUE NOT NULL,
      created_at INTEGER NOT NULL,
      last_accessed INTEGER NOT NULL,
      archived INTEGER DEFAULT 0
    )
  `);

  // Messages table
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id INTEGER NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      token_count INTEGER DEFAULT 0
    )
  `);

  // Summaries table (DAG nodes)
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS summaries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id INTEGER NOT NULL,
      depth INTEGER NOT NULL,
      content TEXT NOT NULL,
      token_count INTEGER DEFAULT 0,
      source_ids TEXT NOT NULL,
      source_type TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )
  `);

  // Create indexes
  dbInstance.exec(`CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id)`);
  dbInstance.exec(`CREATE INDEX IF NOT EXISTS idx_messages_time ON messages(timestamp)`);
  dbInstance.exec(`CREATE INDEX IF NOT EXISTS idx_summaries_conv ON summaries(conversation_id)`);
  dbInstance.exec(`CREATE INDEX IF NOT EXISTS idx_summaries_depth ON summaries(depth)`);
}

/**
 * Get or create a conversation
 */
export function getOrCreateConversation(sessionId: string): number {
  const db = initDatabase();
  if (!db) return 0;

  // Try to find existing
  const stmt = db.prepare('SELECT id FROM conversations WHERE session_id = ? AND archived = 0');
  const row = stmt.get(sessionId);

  if (row) {
    // Update last accessed
    db.prepare('UPDATE conversations SET last_accessed = ? WHERE id = ?')
      .run(Date.now(), row.id);
    return row.id;
  }

  // Create new
  const insert = db.prepare(
    'INSERT INTO conversations (session_id, created_at, last_accessed) VALUES (?, ?, ?)'
  );
  const result = insert.run(sessionId, Date.now(), Date.now());
  return result.lastInsertRowid;
}

/**
 * Store a message in LCM
 */
export function storeMessage(
  conversationId: number,
  message: ChatMessage
): number {
  const db = initDatabase();
  if (!db) return 0;

  const tokenCount = estimateTokens(message.content);

  const insert = db.prepare(
    `INSERT INTO messages (conversation_id, role, content, timestamp, token_count)
     VALUES (?, ?, ?, ?, ?)`
  );
  
  const result = insert.run(
    conversationId,
    message.role,
    message.content,
    message.timestamp,
    tokenCount
  );

  return result.lastInsertRowid;
}

/**
 * Get messages for a conversation
 */
export function getMessages(
  conversationId: number,
  limit?: number,
  offset?: number
): LCMMessage[] {
  const db = initDatabase();
  if (!db) return [];

  let query = 'SELECT * FROM messages WHERE conversation_id = ? ORDER BY timestamp DESC';
  const params: any[] = [conversationId];

  if (limit) {
    query += ' LIMIT ?';
    params.push(limit);
  }
  if (offset) {
    query += ' OFFSET ?';
    params.push(offset);
  }

  const stmt = db.prepare(query);
  const rows = stmt.all(...params);
  
  return rows.map((row: any) => ({
    id: row.id,
    conversationId: row.conversation_id,
    role: row.role,
    content: row.content,
    timestamp: row.timestamp,
    tokenCount: row.token_count,
  }));
}

/**
 * Assemble context for a conversation
 */
export function assembleContext(
  conversationId: number,
  maxTokens: number = 8000
): LCMContextResult {
  const db = initDatabase();
  if (!db) {
    return { messages: [], summaries: [], totalTokens: 0, freshTailCount: 0, summaryCount: 0 };
  }

  // Get fresh tail (recent messages protected from compaction)
  const freshStmt = db.prepare(
    `SELECT * FROM messages 
     WHERE conversation_id = ? 
     ORDER BY timestamp DESC 
     LIMIT ?`
  );
  const freshMessages = freshStmt.all(conversationId, LCM_CONFIG.freshTailCount);

  // Calculate tokens in fresh tail
  const freshTailTokens = freshMessages.reduce(
    (sum: number, m: any) => sum + m.token_count,
    0
  );

  // Get summaries to fill remaining context
  const remainingTokens = maxTokens - freshTailTokens;
  const summaries: LCMSummary[] = [];

  if (remainingTokens > 0) {
    // Get deepest summaries first (most condensed)
    const summaryStmt = db.prepare(
      `SELECT * FROM summaries 
       WHERE conversation_id = ? 
       ORDER BY depth DESC, created_at DESC`
    );
    const summaryRows = summaryStmt.all(conversationId);

    let currentTokens = 0;
    for (const row of summaryRows) {
      if (currentTokens + row.token_count <= remainingTokens) {
        summaries.push({
          id: row.id,
          conversationId: row.conversation_id,
          depth: row.depth,
          content: row.content,
          tokenCount: row.token_count,
          sourceIds: JSON.parse(row.source_ids),
          sourceType: row.source_type,
          createdAt: row.created_at,
        });
        currentTokens += row.token_count;
      } else {
        break;
      }
    }
  }

  // Convert to ChatMessage format
  const messages: ChatMessage[] = freshMessages
    .reverse()
    .map((m: any) => ({
      role: m.role,
      content: m.content,
      timestamp: m.timestamp,
    }));

  return {
    messages,
    summaries,
    totalTokens: freshTailTokens + summaries.reduce((s, sum) => s + sum.tokenCount, 0),
    freshTailCount: freshMessages.length,
    summaryCount: summaries.length,
  };
}

/**
 * Create a leaf summary
 */
export function createLeafSummary(
  conversationId: number,
  messageIds: number[],
  content: string
): number {
  const db = initDatabase();
  if (!db) return 0;

  const tokenCount = estimateTokens(content);

  const insert = db.prepare(
    `INSERT INTO summaries (conversation_id, depth, content, token_count, source_ids, source_type, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  
  const result = insert.run(
    conversationId,
    0,
    content,
    tokenCount,
    JSON.stringify(messageIds),
    'messages',
    Date.now()
  );

  return result.lastInsertRowid;
}

/**
 * Create a condensed summary
 */
export function createCondensedSummary(
  conversationId: number,
  depth: number,
  summaryIds: number[],
  content: string
): number {
  const db = initDatabase();
  if (!db) return 0;

  const tokenCount = estimateTokens(content);

  const insert = db.prepare(
    `INSERT INTO summaries (conversation_id, depth, content, token_count, source_ids, source_type, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  
  const result = insert.run(
    conversationId,
    depth,
    content,
    tokenCount,
    JSON.stringify(summaryIds),
    'summaries',
    Date.now()
  );

  return result.lastInsertRowid;
}

/**
 * Check if compaction is needed
 */
export function shouldCompact(conversationId: number, maxTokens: number): boolean {
  const db = initDatabase();
  if (!db) return false;

  const stmt = db.prepare(
    `SELECT SUM(token_count) as total FROM messages WHERE conversation_id = ?`
  );
  const row = stmt.get(conversationId);

  const totalTokens = row?.total || 0;
  return totalTokens > maxTokens * LCM_CONFIG.contextThreshold;
}

/**
 * Get messages that need compaction
 */
export function getMessagesForCompaction(
  conversationId: number,
  excludeRecent: number = LCM_CONFIG.freshTailCount
): LCMMessage[] {
  const db = initDatabase();
  if (!db) return [];

  // Get total count
  const countStmt = db.prepare(
    'SELECT COUNT(*) as count FROM messages WHERE conversation_id = ?'
  );
  const countRow = countStmt.get(conversationId);
  const totalCount = countRow?.count || 0;

  if (totalCount <= excludeRecent) return [];

  // Get messages excluding recent
  const stmt = db.prepare(
    `SELECT * FROM messages 
     WHERE conversation_id = ? 
     ORDER BY timestamp ASC
     LIMIT ?`
  );
  const rows = stmt.all(conversationId, totalCount - excludeRecent);

  return rows.map((row: any) => ({
    id: row.id,
    conversationId: row.conversation_id,
    role: row.role,
    content: row.content,
    timestamp: row.timestamp,
    tokenCount: row.token_count,
  }));
}

/**
 * Search summaries using grep-like functionality
 */
export function grepSummaries(conversationId: number, query: string): LCMSummary[] {
  const db = initDatabase();
  if (!db) return [];

  const stmt = db.prepare(
    `SELECT * FROM summaries 
     WHERE conversation_id = ? AND content LIKE ?
     ORDER BY depth DESC`
  );
  const rows = stmt.all(conversationId, `%${query}%`);

  return rows.map((row: any) => ({
    id: row.id,
    conversationId: row.conversation_id,
    depth: row.depth,
    content: row.content,
    tokenCount: row.token_count,
    sourceIds: JSON.parse(row.source_ids),
    sourceType: row.source_type,
    createdAt: row.created_at,
  }));
}

/**
 * Get conversation stats
 */
export function getLCMStats(sessionId: string): {
  conversationId: number | null;
  messageCount: number;
  summaryCount: number;
  totalTokens: number;
  dbSize: number;
} | null {
  const db = initDatabase();
  if (!db) return null;

  const convStmt = db.prepare(
    'SELECT id FROM conversations WHERE session_id = ? AND archived = 0'
  );
  const conv = convStmt.get(sessionId);

  if (!conv) return null;

  const msgStmt = db.prepare(
    'SELECT COUNT(*) as count, SUM(token_count) as tokens FROM messages WHERE conversation_id = ?'
  );
  const msgRow = msgStmt.get(conv.id);

  const sumStmt = db.prepare(
    'SELECT COUNT(*) as count FROM summaries WHERE conversation_id = ?'
  );
  const sumRow = sumStmt.get(conv.id);

  // Get DB file size
  let dbSize = 0;
  try {
    const { statSync } = require('fs');
    const stats = statSync(LCM_DB_PATH);
    dbSize = stats.size;
  } catch {}

  return {
    conversationId: conv.id,
    messageCount: msgRow?.count || 0,
    summaryCount: sumRow?.count || 0,
    totalTokens: msgRow?.tokens || 0,
    dbSize,
  };
}

/**
 * Archive a conversation (for /reset)
 */
export function archiveConversation(sessionId: string): void {
  const db = initDatabase();
  if (!db) return;

  db.prepare('UPDATE conversations SET archived = 1 WHERE session_id = ?').run(sessionId);
}

/**
 * Close database connection
 */
export function closeLCM(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

/**
 * Estimate token count for text
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Check if LCM is available
 */
export function isLCMAvailable(): boolean {
  if (!LCM_CONFIG.enabled) return false;
  const db = initDatabase();
  return db !== null;
}
