/**
 * 🦆 Duck CLI - Vector Memory System
 * Embedding-based semantic memory search
 * Works with OpenAI embeddings or local LM Studio embeddings
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { createHash, randomBytes } from 'crypto';

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

export interface MemoryRecord {
  id: string;
  content: string;
  metadata: Record<string, unknown>;
  embedding?: number[];
  createdAt: number;
  updatedAt: number;
  tags: string[];
  accessCount: number;
}

export interface SearchResult {
  record: MemoryRecord;
  score: number;
}

// ─── Simple Embedding Provider Interface ────────────────────────────────────

export interface EmbeddingProvider {
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
}

// ─── OpenAI Embeddings ───────────────────────────────────────────────────────

export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  private apiKey: string;
  private model: string;
  private baseUrl: string;

  constructor(apiKey?: string, model = 'text-embedding-3-small', baseUrl = 'https://api.openai.com/v1') {
    this.apiKey = apiKey || process.env.OPENAI_API_KEY || '';
    this.model = model;
    this.baseUrl = baseUrl;
  }

  async embed(text: string): Promise<number[]> {
    if (!this.apiKey) throw new Error('OpenAI API key not set');
    const { execSync } = await import('child_process');
    const body = JSON.stringify({ input: text, model: this.model });
    const result = execSync(`curl -s -X POST ${this.baseUrl}/embeddings -H "Authorization: Bearer ${this.apiKey}" -H "Content-Type: application/json" -d '${body.replace(/'/g, "'\"'\"'")}'`, { encoding: 'utf-8' });
    const parsed = JSON.parse(result);
    return parsed.data?.[0]?.embedding || [];
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    if (!this.apiKey) throw new Error('OpenAI API key not set');
    const { execSync } = await import('child_process');
    const body = JSON.stringify({ input: texts, model: this.model });
    const result = execSync(`curl -s -X POST ${this.baseUrl}/embeddings -H "Authorization: Bearer ${this.apiKey}" -H "Content-Type: application/json" -d '${body.replace(/'/g, "'\"'\"'")}'`, { encoding: 'utf-8' });
    const parsed = JSON.parse(result);
    return (parsed.data || []).sort((a: any, b: any) => a.index - b.index).map((d: any) => d.embedding);
  }
}

// ─── TF-IDF Fallback (no API needed) ────────────────────────────────────────

export class TFIDFProvider implements EmbeddingProvider {
  private vocab: Map<string, number> = new Map();
  private idf: Map<string, number> = new Map();
  private dimension = 256;

  tokenize(text: string): string[] {
    return text.toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 2);
  }

  async embed(text: string): Promise<number[]> {
    const tokens = this.tokenize(text);
    const tf = new Map<string, number>();
    for (const t of tokens) {
      tf.set(t, (tf.get(t) || 0) + 1);
    }
    for (const [t, count] of tf) {
      tf.set(t, count / tokens.length);
    }

    const vec = new Array(this.dimension).fill(0);
    let i = 0;
    for (const [token, score] of tf) {
      const hash = this.hashToken(token);
      const idx = hash % this.dimension;
      const idfVal = this.idf.get(token) || Math.log(2);
      vec[idx] += score * idfVal;
      if (++i >= 50) break;
    }

    // Normalize
    const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
    return vec.map(v => v / norm);
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map(t => this.embed(t)));
  }

  train(documents: string[]): void {
    // Build IDF from corpus
    const docFreq = new Map<string, number>();
    for (const doc of documents) {
      const tokens = new Set(this.tokenize(doc));
      for (const t of tokens) {
        docFreq.set(t, (docFreq.get(t) || 0) + 1);
      }
    }
    for (const [token, df] of docFreq) {
      this.idf.set(token, Math.log(documents.length / (df + 1)));
    }
  }

  private hashToken(token: string): number {
    let hash = 0;
    for (let i = 0; i < token.length; i++) {
      hash = ((hash << 5) - hash) + token.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }
}

// ─── Vector Memory Store ─────────────────────────────────────────────────────

export class VectorMemory {
  private storePath: string;
  private records: MemoryRecord[] = [];
  private provider: EmbeddingProvider;
  private tfidf: TFIDFProvider;
  private initialized = false;

  constructor(options?: {
    dir?: string;
    provider?: EmbeddingProvider;
    useTfidfFallback?: boolean;
  }) {
    const dir = options?.dir || join(homedir(), '.duck', 'vector-memory');
    this.storePath = join(dir, 'store.jsonl');
    this.provider = options?.provider || new OpenAIEmbeddingProvider();
    this.tfidf = new TFIDFProvider();
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    const dir = dirname(this.storePath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    if (existsSync(this.storePath)) {
      try {
        const content = readFileSync(this.storePath, 'utf-8');
        const lines = content.split('\n').filter(l => l.trim());
        this.records = lines.map(l => JSON.parse(l) as MemoryRecord);
        // Train TF-IDF on all content
        this.tfidf.train(this.records.map(r => r.content));
      } catch { /* corrupted, start fresh */ }
    }
    this.initialized = true;
  }

  async add(
    content: string,
    options?: {
      metadata?: Record<string, unknown>;
      tags?: string[];
      embedding?: number[];
    }
  ): Promise<string> {
    await this.initialize();
    const id = this.genId();
    const now = Date.now();
    const embedding = options?.embedding || await this.safeEmbed(content);

    const record: MemoryRecord = {
      id,
      content,
      metadata: options?.metadata || {},
      embedding,
      createdAt: now,
      updatedAt: now,
      tags: options?.tags || [],
      accessCount: 0,
    };

    this.records.push(record);
    this.persist();
    return id;
  }

  async search(query: string, options?: { limit?: number; threshold?: number }): Promise<SearchResult[]> {
    await this.initialize();
    const limit = options?.limit || 10;
    const threshold = options?.threshold || 0.3;

    let queryEmbedding: number[];
    try {
      queryEmbedding = await this.provider.embed(query);
    } catch {
      queryEmbedding = await this.tfidf.embed(query);
    }

    const results: SearchResult[] = [];
    for (const record of this.records) {
      const embedding = record.embedding || (await this.safeEmbed(record.content));
      const score = this.cosineSimilarity(queryEmbedding, embedding);
      if (score >= threshold) {
        results.push({ record, score });
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }

  async get(id: string): Promise<MemoryRecord | null> {
    await this.initialize();
    const record = this.records.find(r => r.id === id);
    if (record) {
      record.accessCount++;
      this.persist();
    }
    return record || null;
  }

  async update(id: string, content: string, options?: { metadata?: Record<string, unknown>; tags?: string[] }): Promise<boolean> {
    await this.initialize();
    const idx = this.records.findIndex(r => r.id === id);
    if (idx === -1) return false;

    const record = this.records[idx];
    const embedding = await this.safeEmbed(content);

    this.records[idx] = {
      ...record,
      content,
      embedding,
      metadata: options?.metadata || record.metadata,
      tags: options?.tags || record.tags,
      updatedAt: Date.now(),
    };

    this.persist();
    return true;
  }

  async delete(id: string): Promise<boolean> {
    await this.initialize();
    const before = this.records.length;
    this.records = this.records.filter(r => r.id !== id);
    if (this.records.length < before) {
      this.persist();
      return true;
    }
    return false;
  }

  async bulkAdd(items: { content: string; metadata?: Record<string, unknown>; tags?: string[] }[]): Promise<string[]> {
    await this.initialize();
    const ids: string[] = [];
    for (const item of items) {
      const id = await this.add(item.content, { metadata: item.metadata, tags: item.tags });
      ids.push(id);
    }
    return ids;
  }

  stats(): { count: number; avgLength: number; tags: string[]; oldest: number; newest: number } {
    const tags = new Set<string>();
    let totalLen = 0;
    let oldest = Date.now();
    let newest = 0;
    for (const r of this.records) {
      totalLen += r.content.length;
      for (const t of r.tags) tags.add(t);
      if (r.createdAt < oldest) oldest = r.createdAt;
      if (r.createdAt > newest) newest = r.createdAt;
    }
    return {
      count: this.records.length,
      avgLength: this.records.length ? totalLen / this.records.length : 0,
      tags: Array.from(tags),
      oldest,
      newest,
    };
  }

  list(options?: { tags?: string[]; limit?: number; offset?: number }): MemoryRecord[] {
    let results = this.records;
    if (options?.tags?.length) {
      results = results.filter(r => options.tags!.some(t => r.tags.includes(t)));
    }
    const offset = options?.offset || 0;
    const limit = options?.limit || 100;
    return results.slice(offset, offset + limit);
  }

  clear(): void {
    this.records = [];
    this.persist();
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  private async safeEmbed(text: string): Promise<number[]> {
    try {
      return await this.provider.embed(text);
    } catch {
      return await this.tfidf.embed(text);
    }
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    const norm = Math.sqrt(normA) * Math.sqrt(normB);
    return norm === 0 ? 0 : dot / norm;
  }

  private genId(): string {
    return randomBytes(8).toString('hex');
  }

  private persist(): void {
    const lines = this.records.map(r => JSON.stringify(r)).join('\n');
    writeFileSync(this.storePath, lines + '\n', { mode: 0o600 });
  }
}

// ─── CLI Interface ──────────────────────────────────────────────────────────

export async function vectorMemoryCLI(args: string[]): Promise<void> {
  const [action, ...rest] = args;
  const vm = new VectorMemory();

  switch (action) {
    case 'add': {
      const content = rest.join(' ');
      if (!content) { console.log('Usage: duck memory vector add <content>'); return; }
      const id = await vm.add(content);
      console.log(`${c.green}✅ Added: ${id}${c.reset}`);
      break;
    }
    case 'search': {
      const query = rest.join(' ');
      if (!query) { console.log('Usage: duck memory vector search <query>'); return; }
      const results = await vm.search(query, { limit: 5 });
      console.log(`\n${c.bold}Search: "${query}"${c.reset}\n`);
      if (results.length === 0) {
        console.log(`${c.dim}No results found${c.reset}\n`);
        return;
      }
      for (const { record, score } of results) {
        console.log(`${c.cyan}[${(score * 100).toFixed(1)}%]${c.reset} ${record.content.substring(0, 120)}${record.content.length > 120 ? '...' : ''}`);
        if (record.tags.length) console.log(`  ${c.dim}Tags: ${record.tags.join(', ')}${c.reset}`);
        console.log(`  ${c.dim}ID: ${record.id}${c.reset}`);
        console.log();
      }
      break;
    }
    case 'list': {
      const records = vm.list({ limit: 20 });
      console.log(`\n${c.bold}Memory (${records.length} records)${c.reset}\n`);
      for (const r of records) {
        console.log(`${c.cyan}${r.id}${c.reset} ${r.content.substring(0, 80)}${r.content.length > 80 ? '...' : ''}`);
      }
      console.log();
      break;
    }
    case 'stats': {
      const stats = vm.stats();
      console.log(`\n${c.bold}Vector Memory Stats${c.reset}\n`);
      console.log(`  Records:    ${stats.count}`);
      console.log(`  Avg length: ${Math.round(stats.avgLength)} chars`);
      console.log(`  Tags:       ${stats.tags.length > 0 ? stats.tags.join(', ') : '(none)'}`);
      console.log(`  Oldest:     ${new Date(stats.oldest).toLocaleString()}`);
      console.log(`  Newest:     ${new Date(stats.newest).toLocaleString()}`);
      console.log();
      break;
    }
    case 'clear': {
      vm.clear();
      console.log(`${c.green}✅ Memory cleared${c.reset}`);
      break;
    }
    default: {
      console.log(`\n${c.bold}🦆 Vector Memory${c.reset}`);
      console.log(`Usage: duck memory vector <add|search|list|stats|clear>\n`);
      console.log(`  ${c.green}add <content>${c.reset}      Add a memory`);
      console.log(`  ${c.green}search <query>${c.reset}    Semantic search`);
      console.log(`  ${c.green}list${c.reset}              List recent memories`);
      console.log(`  ${c.green}stats${c.reset}             Show stats`);
      console.log(`  ${c.green}clear${c.reset}             Clear all`);
    }
  }
}
