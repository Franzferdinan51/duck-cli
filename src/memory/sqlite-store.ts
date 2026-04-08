/**
 * Duck Agent - Pure JavaScript Memory Store
 * No native modules - works on any platform including Android/Termux
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

export interface MemoryEntry {
  id: string;
  content: string;
  type: 'soul' | 'fact' | 'interaction' | 'learned' | 'preference' | 'code';
  timestamp: number;
  tags: string[];
  importance: number;
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
  messages: number;
  tokens: number;
  toolsUsed: number;
  lastMessage: number;
  topic?: string;
}

// Pure JS storage using JSON files
export class SQLiteStore {
  private memoryDir: string;
  private memoryFile: string;
  private toolUsageFile: string;
  private sessionsFile: string;
  private memory: MemoryEntry[] = [];
  private toolUsage: ToolUsage[] = [];
  private sessions: SessionSummary[] = [];
  private initialized = false;

  constructor(memoryDir?: string) {
    this.memoryDir = memoryDir || join(homedir(), '.duck', 'memory');
    this.memoryFile = join(this.memoryDir, 'memory.json');
    this.toolUsageFile = join(this.memoryDir, 'tool-usage.json');
    this.sessionsFile = join(this.memoryDir, 'sessions.json');
    
    try {
      mkdirSync(this.memoryDir, { recursive: true });
      this.load();
      this.initialized = true;
    } catch (e) {
      console.log('Memory system disabled (storage error)');
    }
  }

  private load(): void {
    try {
      if (existsSync(this.memoryFile)) {
        this.memory = JSON.parse(readFileSync(this.memoryFile, 'utf-8'));
      }
      if (existsSync(this.toolUsageFile)) {
        this.toolUsage = JSON.parse(readFileSync(this.toolUsageFile, 'utf-8'));
      }
      if (existsSync(this.sessionsFile)) {
        this.sessions = JSON.parse(readFileSync(this.sessionsFile, 'utf-8'));
      }
    } catch (e) {
      this.memory = [];
      this.toolUsage = [];
      this.sessions = [];
    }
  }

  private save(): void {
    try {
      writeFileSync(this.memoryFile, JSON.stringify(this.memory, null, 2));
      writeFileSync(this.toolUsageFile, JSON.stringify(this.toolUsage, null, 2));
      writeFileSync(this.sessionsFile, JSON.stringify(this.sessions, null, 2));
    } catch (e) {
      // Silent fail for write errors
    }
  }

  async initialize(): Promise<void> {
    // Already initialized in constructor
  }

  async addMemory(entry: Omit<MemoryEntry, 'accessCount' | 'lastAccessed'>): Promise<void> {
    this.memory.push({
      ...entry,
      accessCount: 0,
      lastAccessed: Date.now()
    });
    this.save();
  }

  async searchMemories(query: string, limit = 10): Promise<MemorySearch[]> {
    if (!query || typeof query !== 'string') return [];
    const q = query.toLowerCase();
    return this.memory
      .filter(m => (m.content && m.content.toLowerCase().includes(q)) || (m.tags && m.tags.some(t => t && t.toLowerCase().includes(q))))
      .slice(0, limit)
      .map(m => ({
        id: m.id,
        content: m.content,
        type: m.type,
        timestamp: m.timestamp,
        tags: m.tags.join(', '),
        rank: 0
      }));
  }

  async getMemory(id: string): Promise<MemoryEntry | null> {
    const entry = this.memory.find(m => m.id === id);
    if (entry) {
      entry.accessCount++;
      entry.lastAccessed = Date.now();
      this.save();
    }
    return entry || null;
  }

  async logToolUsage(tool: ToolUsage): Promise<void> {
    this.toolUsage.push(tool);
    if (this.toolUsage.length > 1000) {
      this.toolUsage = this.toolUsage.slice(-500);
    }
    this.save();
  }

  async addSession(session: SessionSummary): Promise<void> {
    const existing = this.sessions.findIndex(s => s.id === session.id);
    if (existing >= 0) {
      this.sessions[existing] = session;
    } else {
      this.sessions.push(session);
    }
    if (this.sessions.length > 100) {
      this.sessions = this.sessions.slice(-50);
    }
    this.save();
  }

  async getSession(id: string): Promise<SessionSummary | null> {
    return this.sessions.find(s => s.id === id) || null;
  }

  async getStats(): Promise<{ memories: number; toolUses: number; sessions: number }> {
    return {
      memories: this.memory.length,
      toolUses: this.toolUsage.length,
      sessions: this.sessions.length
    };
  }

  // Extended methods needed by MemorySystem
  async logToolUse(tool: { toolName: string; args: string; success: boolean; error?: string; duration: number; timestamp: number }): Promise<void> {
    this.toolUsage.push(tool);
    if (this.toolUsage.length > 1000) this.toolUsage = this.toolUsage.slice(-500);
    this.save();
  }

  async getToolStats(days: number = 7): Promise<Record<string, { total: number; success: number; avgDuration: number; successRate: number }>> {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const recent = this.toolUsage.filter(t => t.timestamp > cutoff);
    const stats: Record<string, { total: number; success: number; avgDuration: number; successRate: number }> = {};
    for (const t of recent) {
      if (!stats[t.toolName]) stats[t.toolName] = { total: 0, success: 0, avgDuration: 0, successRate: 0 };
      stats[t.toolName].total++;
      if (t.success) stats[t.toolName].success++;
      stats[t.toolName].avgDuration += t.duration;
    }
    for (const k of Object.keys(stats)) {
      stats[k].avgDuration /= stats[k].total;
      stats[k].successRate = stats[k].success / stats[k].total;
    }
    return stats;
  }

  async getFailingTools(days: number = 7): Promise<string[]> {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const failing = new Set<string>();
    for (const t of this.toolUsage.filter(t => t.timestamp > cutoff && !t.success)) {
      failing.add(t.toolName);
    }
    return Array.from(failing);
  }


  async saveSession(session: Partial<SessionSummary> & { id: string }): Promise<void> {
    const full: SessionSummary = {
      id: session.id,
      messages: session.messages || 0,
      tokens: session.tokens || 0,
      toolsUsed: session.toolsUsed || 0,
      lastMessage: session.lastMessage || Date.now(),
      topic: session.topic
    };
    const existing = this.sessions.findIndex(s => s.id === full.id);
    if (existing >= 0) {
      this.sessions[existing] = full;
    } else {
      this.sessions.push(full);
    }
    if (this.sessions.length > 100) this.sessions = this.sessions.slice(-50);
    this.save();
  }


  async getRecentSessions(limit: number = 10): Promise<SessionSummary[]> {
    return this.sessions.slice(-limit).reverse();
  }

  patterns: any[] = [];
  async learnPattern(type: string, category: string, data: string): Promise<void> {
    this.patterns.push({ type, category, data, timestamp: Date.now() });
    if (this.patterns.length > 100) this.patterns = this.patterns.slice(-50);
  }

  async getPatterns(type?: string): Promise<any[]> {
    return type ? this.patterns.filter(p => p.type === type) : this.patterns;
  }

  stats(): { memories: number; toolLogs: number; sessions: number; patterns: number } {
    return {
      memories: this.memory.length,
      toolLogs: this.toolUsage.length,
      sessions: this.sessions.length,
      patterns: this.patterns.length
    };
  }

  async prune(maxEntries: number = 10000): Promise<number> {
    let pruned = 0;
    if (this.memory.length > maxEntries) {
      const excess = this.memory.length - maxEntries;
      this.memory = this.memory.slice(excess);
      pruned += excess;
    }
    this.save();
    return pruned;
  }


  close(): void {
    this.save();
  }

  // Additional methods for MemorySystem compatibility
  async add(content: string, type: MemoryEntry['type'] = 'fact', tags: string[] = [], importance: number = 5): Promise<string> {
    const id = `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.memory.push({
      id, content, type, tags,
      timestamp: Date.now(),
      importance,
      accessCount: 0,
      lastAccessed: Date.now()
    });
    this.save();
    return id;
  }

  async search(query: string, limit: number = 10): Promise<MemorySearch[]> {
    return this.searchMemories(query, limit);
  }

  async get(id: string): Promise<MemoryEntry | null> {
    return this.getMemory(id);
  }

  async list(type?: MemoryEntry['type'], limit: number = 50): Promise<MemoryEntry[]> {
    let entries = this.memory;
    if (type) entries = entries.filter(e => e.type === type);
    return entries.slice(-limit).reverse();
  }

  async delete(id: string): Promise<boolean> {
    const idx = this.memory.findIndex(m => m.id === id);
    if (idx >= 0) {
      this.memory.splice(idx, 1);
      this.save();
      return true;
    }
    return false;
  }
}
