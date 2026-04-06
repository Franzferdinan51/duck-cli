/**
 * Duck Agent Sub-Conscious - Pure JavaScript Memory Store
 * Persistent memory storage for the Sub-Conscious daemon
 * No native modules - works on any platform including Android/Termux
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

export interface StoredMemory {
  id: string;
  content: string;
  context: string;
  tags: string[];
  importance: number;
  source: 'session' | 'council' | 'analysis' | 'manual' | 'dream' | 'whisper';
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
  private dbPath: string;
  private memories: StoredMemory[] = [];
  private initialized = false;

  constructor(dataDir?: string) {
    const baseDir = dataDir || join(process.env.HOME || '/tmp', '.duck', 'subconscious');
    this.dbPath = join(baseDir, 'memories.json');
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    try {
      const dir = join(this.dbPath, '..');
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      
      if (existsSync(this.dbPath)) {
        const data = readFileSync(this.dbPath, 'utf-8');
        this.memories = JSON.parse(data);
      } else {
        this.memories = [];
        this.saveToDisk();
      }
      
      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize Sub-Conscious store:', error);
      this.memories = [];
      this.initialized = true;
    }
  }

  private saveToDisk(): void {
    try {
      writeFileSync(this.dbPath, JSON.stringify(this.memories, null, 2));
    } catch (error) {
      console.error('Failed to save memories:', error);
    }
  }

  async addMemory(memory: Omit<StoredMemory, 'id' | 'createdAt' | 'accessedAt' | 'accessCount'>): Promise<StoredMemory> {
    await this.initialize();
    
    const newMemory: StoredMemory = {
      ...memory,
      id: `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
      accessedAt: new Date().toISOString(),
      accessCount: 0
    };
    
    this.memories.push(newMemory);
    this.saveToDisk();
    return newMemory;
  }

  async search(query: MemoryQuery): Promise<StoredMemory[]> {
    await this.initialize();
    
    let results = this.memories;
    
    if (query.tags && query.tags.length > 0) {
      results = results.filter(m => 
        query.tags!.some(tag => m.tags.includes(tag))
      );
    }
    
    if (query.source) {
      results = results.filter(m => m.source === query.source);
    }
    
    if (query.query) {
      const q = query.query.toLowerCase();
      results = results.filter(m => 
        m.content.toLowerCase().includes(q) ||
        m.context.toLowerCase().includes(q)
      );
    }
    
    if (query.since) {
      const sinceDate = new Date(query.since);
      results = results.filter(m => new Date(m.createdAt) >= sinceDate);
    }
    
    return results.slice(0, query.limit || 20);
  }

  async searchMemories(query: MemoryQuery): Promise<StoredMemory[]> {
    return this.search(query);
  }

  async recent(limit: number = 20): Promise<StoredMemory[]> {
    await this.initialize();
    return this.memories
      .sort((a, b) => new Date(b.accessedAt).getTime() - new Date(a.accessedAt).getTime())
      .slice(0, limit);
  }

  async getMemory(id: string): Promise<StoredMemory | null> {
    await this.initialize();
    
    const memory = this.memories.find(m => m.id === id);
    if (memory) {
      memory.accessCount++;
      memory.accessedAt = new Date().toISOString();
      this.saveToDisk();
    }
    return memory || null;
  }

  async delete(id: string): Promise<boolean> {
    await this.initialize();
    
    const index = this.memories.findIndex(m => m.id === id);
    if (index !== -1) {
      this.memories.splice(index, 1);
      this.saveToDisk();
      return true;
    }
    return false;
  }

  async deleteMemory(id: string): Promise<boolean> {
    return this.delete(id);
  }

  async clear(): Promise<void> {
    await this.initialize();
    this.memories = [];
    this.saveToDisk();
  }

  async saveSessionSummary(
    sessionId: string,
    summary: string,
    patterns: string[],
    keyDecisions: string[],
    topics: string[]
  ): Promise<void> {
    await this.initialize();
    
    const memory: StoredMemory = {
      id: `session_${sessionId}_${Date.now()}`,
      content: summary,
      context: patterns.join('; '),
      tags: ['session', 'summary', ...topics.slice(0, 2)],
      importance: 7,
      source: 'session',
      sessionId,
      createdAt: new Date().toISOString(),
      accessedAt: new Date().toISOString(),
      accessCount: 0
    };
    
    this.memories.push(memory);
    this.saveToDisk();
  }

  async saveCouncilMemory(
    id: string,
    councilorId: string,
    topic: string,
    deliberation: string,
    insight: string,
    tags: string[]
  ): Promise<void> {
    await this.initialize();
    
    const memory: StoredMemory = {
      id: id || `council_${topic}_${Date.now()}`,
      content: insight,
      context: deliberation,
      tags: ['council', councilorId, ...tags.slice(0, 3)],
      importance: 7,
      source: 'council',
      topic,
      createdAt: new Date().toISOString(),
      accessedAt: new Date().toISOString(),
      accessCount: 0
    };
    
    this.memories.push(memory);
    this.saveToDisk();
  }

  async getCouncilMemories(topic: string, limit: number = 10): Promise<StoredMemory[]> {
    await this.initialize();
    return this.memories
      .filter(m => m.source === 'council' && m.topic === topic)
      .sort((a, b) => b.importance - a.importance)
      .slice(0, limit);
  }

  async save(memory: StoredMemory): Promise<void> {
    await this.initialize();
    this.memories.push(memory);
    this.saveToDisk();
  }

  async stats(): Promise<{ total: number; bySource: Record<string, number>; byTag: Record<string, number> }> {
    await this.initialize();
    
    const bySource: Record<string, number> = {};
    const byTag: Record<string, number> = {};
    
    for (const memory of this.memories) {
      bySource[memory.source] = (bySource[memory.source] || 0) + 1;
      for (const tag of memory.tags) {
        byTag[tag] = (byTag[tag] || 0) + 1;
      }
    }
    
    return {
      total: this.memories.length,
      bySource,
      byTag
    };
  }

  async getStats(): Promise<{ total: number; bySource: Record<string, number>; byTag: Record<string, number> }> {
    return this.stats();
  }

  close(): void {
    // No-op for JSON file storage
  }
}
