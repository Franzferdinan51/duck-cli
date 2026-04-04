/**
 * Pluggable Memory Provider Interface - Hermes-inspired
 * Ported from: https://github.com/NousResearch/hermes-agent (agent/memory_provider.py)
 *
 * Memory is now an extensible plugin system. Third-party memory backends
 * (vector stores, custom DBs, Honcho) implement the MemoryProvider interface.
 *
 * Duck-cli currently uses SQLite-backed SessionStore. This interface allows
 * swapping to alternative backends (vector DB, Honcho, etc.) without changing
 * the agent code.
 */

import { EventEmitter } from "events";

// ─── Provider Interface ─────────────────────────────────────────────────

export interface MemoryEntry {
  id: string;
  key: string;
  content: string;
  tags?: string[];
  createdAt: number;
  updatedAt: number;
  provider: string;
  metadata?: Record<string, any>;
}

export interface MemoryQuery {
  query?: string;           // Semantic search query
  key?: string;             // Exact key match
  tags?: string[];          // Filter by tags
  limit?: number;
  offset?: number;
  since?: number;            // Only entries updated since timestamp
}

export interface MemoryProvider {
  /** Human-readable provider name */
  name: string;

  /** Whether this provider is available (e.g., dependency installed) */
  isAvailable(): boolean;

  /** Initialize provider for a session. Called once per agent session. */
  initialize?(sessionId: string): Promise<void>;

  /** Shutdown/cleanup. Called when agent session ends. */
  shutdown?(): Promise<void>;

  /** Read entries matching a query */
  query(q: MemoryQuery): Promise<MemoryEntry[]>;

  /** Write an entry. If key exists, update; otherwise create. */
  write(entry: Omit<MemoryEntry, "id" | "provider" | "createdAt" | "updatedAt">): Promise<MemoryEntry>;

  /** Delete an entry by key */
  delete(key: string): Promise<boolean>;

  /** Get entries for system prompt injection */
  systemPromptBlock?(): Promise<string>;

  /** Get total entry count */
  count?(): Promise<number>;

  /** Clear all entries */
  clear?(): Promise<void>;

  /** Bulk import/export */
  export?(): Promise<MemoryEntry[]>;
  import?(entries: MemoryEntry[]): Promise<number>;
}

// ─── Built-in Provider: SQLite Memory ──────────────────────────────────

import Database from "better-sqlite3";
import { join } from "path";
import { mkdirSync } from "fs";
import { homedir } from "os";
import { randomUUID } from "crypto";

export class SQLiteMemoryProvider implements MemoryProvider {
  name = "sqlite";
  private db: Database.Database;
  private sessionId?: string;
  private memoryDir: string;

  constructor(memoryDir?: string) {
    this.memoryDir = memoryDir || join(homedir(), ".duck", "memory");
    mkdirSync(this.memoryDir, { recursive: true });
    const dbPath = join(this.memoryDir, "memory.db");
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.initDb();
  }

  private initDb(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS memory (
        id TEXT PRIMARY KEY,
        key TEXT UNIQUE NOT NULL,
        content TEXT NOT NULL,
        tags TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        provider TEXT NOT NULL DEFAULT 'sqlite',
        metadata TEXT
      )
    `);
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_memory_key ON memory(key)
    `);
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_memory_updated ON memory(updated_at)
    `);
  }

  isAvailable(): boolean { return true; }

  async initialize(sessionId: string): Promise<void> {
    this.sessionId = sessionId;
  }

  async shutdown(): Promise<void> {
    this.sessionId = undefined;
  }

  async query(q: MemoryQuery): Promise<MemoryEntry[]> {
    let sql = "SELECT * FROM memory WHERE 1=1";
    const params: any[] = [];

    if (q.key) {
      sql += " AND key = ?";
      params.push(q.key);
    }

    if (q.tags && q.tags.length > 0) {
      for (const tag of q.tags) {
        sql += " AND tags LIKE ?";
        params.push(`%${tag}%`);
      }
    }

    if (q.since) {
      sql += " AND updated_at >= ?";
      params.push(q.since);
    }

    sql += " ORDER BY updated_at DESC";

    if (q.limit) {
      sql += " LIMIT ?";
      params.push(q.limit);
    }

    if (q.offset) {
      sql += " OFFSET ?";
      params.push(q.offset);
    }

    const rows = this.db.prepare(sql).all(...params) as any[];

    return rows.map(row => ({
      id: row.id,
      key: row.key,
      content: row.content,
      tags: row.tags ? JSON.parse(row.tags) : undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      provider: row.provider,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    }));
  }

  async write(entry: Omit<MemoryEntry, "id" | "provider" | "createdAt" | "updatedAt">): Promise<MemoryEntry> {
    const now = Date.now();
    const existing = this.db.prepare("SELECT id FROM memory WHERE key = ?").get(entry.key) as any;
    const id = existing ? existing.id : `mem-${randomUUID().slice(0, 8)}`;

    this.db.prepare(`
      INSERT INTO memory (id, key, content, tags, created_at, updated_at, provider, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        content = excluded.content,
        tags = excluded.tags,
        updated_at = excluded.updated_at,
        metadata = excluded.metadata
    `).run(
      id,
      entry.key,
      entry.content,
      entry.tags ? JSON.stringify(entry.tags) : null,
      existing ? this.db.prepare("SELECT created_at FROM memory WHERE key = ?").get(entry.key) : now,
      now,
      this.name,
      entry.metadata ? JSON.stringify(entry.metadata) : null
    );

    return { id, key: entry.key, content: entry.content, tags: entry.tags, createdAt: now, updatedAt: now, provider: this.name, metadata: entry.metadata };
  }

  async delete(key: string): Promise<boolean> {
    const result = this.db.prepare("DELETE FROM memory WHERE key = ?").run(key);
    return result.changes > 0;
  }

  async systemPromptBlock(): Promise<string> {
    const entries = await this.query({ limit: 50 });
    if (entries.length === 0) return "";

    const blocks = entries.map(e =>
      `## ${e.key}\n${e.content}${e.tags ? `\n_Tags: ${e.tags.join(", ")}_` : ""}`
    );
    return `\n\n--- MEMORY ---\n${blocks.join("\n\n")}\n--- END MEMORY ---\n`;
  }

  async count(): Promise<number> {
    const row = this.db.prepare("SELECT COUNT(*) as count FROM memory").get() as any;
    return row.count;
  }

  async clear(): Promise<void> {
    this.db.exec("DELETE FROM memory");
  }

  async export(): Promise<MemoryEntry[]> {
    return this.query({});
  }

  async import(entries: MemoryEntry[]): Promise<number> {
    let count = 0;
    for (const e of entries) {
      await this.write({
        key: e.key,
        content: e.content,
        tags: e.tags,
        metadata: e.metadata,
      });
      count++;
    }
    return count;
  }
}

// ─── Memory Manager ─────────────────────────────────────────────────────

/**
 * Manages multiple memory providers with priority ordering.
 * Duck-cli's builtin SQLite memory is always first; plugins can be added.
 */
export class MemoryManager {
  private providers: MemoryProvider[] = [];
  private activeProvider?: MemoryProvider;
  private ee = new EventEmitter();

  constructor() {
    // Always register built-in SQLite provider first (cannot be disabled)
    this.registerProvider(new SQLiteMemoryProvider());
  }

  /**
   * Register a memory provider. Newer providers have higher priority.
   */
  registerProvider(provider: MemoryProvider): void {
    this.providers.push(provider);
    this.providers.sort((a, b) => {
      // Built-in providers first, then by registration order
      if (a.name === "sqlite") return -1;
      if (b.name === "sqlite") return 1;
      return 0;
    });

    // Activate first available
    if (!this.activeProvider || !this.activeProvider.isAvailable()) {
      this.activeProvider = this.findAvailable();
    }

    this.ee.emit("provider_registered", provider.name);
  }

  private findAvailable(): MemoryProvider | undefined {
    return this.providers.find(p => p.isAvailable());
  }

  getActiveProvider(): MemoryProvider | undefined {
    return this.activeProvider;
  }

  listProviders(): string[] {
    return this.providers.map(p => p.name);
  }

  /**
   * Initialize all providers for a session.
   */
  async initializeAll(sessionId: string): Promise<void> {
    for (const p of this.providers) {
      if (p.initialize) {
        try {
          await p.initialize(sessionId);
        } catch (e) {
          console.warn(`[MemoryManager] Failed to initialize ${p.name}:`, e);
        }
      }
    }
  }

  /**
   * Shutdown all providers.
   */
  async shutdownAll(): Promise<void> {
    for (const p of this.providers) {
      if (p.shutdown) {
        try {
          await p.shutdown();
        } catch (e) {
          console.warn(`[MemoryManager] Failed to shutdown ${p.name}:`, e);
        }
      }
    }
  }

  /**
   * Query memory across all providers (fallback chain).
   */
  async query(q: MemoryQuery): Promise<MemoryEntry[]> {
    for (const p of this.providers) {
      if (!p.isAvailable()) continue;
      try {
        const results = await p.query(q);
        if (results.length > 0) return results;
      } catch (e) {
        console.warn(`[MemoryManager] ${p.name} query failed:`, e);
      }
    }
    return [];
  }

  /**
   * Write to all available providers (replicate write).
   */
  async write(entry: Omit<MemoryEntry, "id" | "provider" | "createdAt" | "updatedAt">): Promise<void> {
    for (const p of this.providers) {
      if (!p.isAvailable()) continue;
      try {
        await p.write(entry);
      } catch (e) {
        console.warn(`[MemoryManager] ${p.name} write failed:`, e);
      }
    }
  }

  /**
   * Build context block from all providers for system prompt.
   */
  async buildSystemPrompt(): Promise<string> {
    const blocks: string[] = [];

    for (const p of this.providers) {
      if (!p.isAvailable()) continue;
      try {
        if (p.systemPromptBlock) {
          const block = await p.systemPromptBlock();
          if (block) blocks.push(block);
        }
      } catch (e) {
        console.warn(`[MemoryManager] ${p.name} systemPromptBlock failed:`, e);
      }
    }

    return blocks.join("\n");
  }

  on(event: "provider_registered", cb: (name: string) => void): void {
    this.ee.on(event, cb);
  }
}

export default { SQLiteMemoryProvider, MemoryManager };
