/**
 * Duck CLI - OpenClaw-Style Memory System
 * 
 * Supports:
 * - MEMORY.md (agent memory - facts, learnings)
 * - USER.md (user preferences, context)
 * - Progressive loading (load only what's relevant)
 * - Semantic search across memories
 */

import { readdir, readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

export interface MemoryEntry {
  id: string;
  content: string;
  timestamp: number;
  tags: string[];
  source: 'memory' | 'user' | 'session';
}

export interface MemoryConfig {
  memoryDir: string;
  maxMemoryChars: number;
  maxUserChars: number;
  enableProgressive: boolean;
}

const DEFAULT_CONFIG: MemoryConfig = {
  memoryDir: '.duck/memory',
  maxMemoryChars: 8000,
  maxUserChars: 4000,
  enableProgressive: true
};

export class OpenClawMemory {
  private config: MemoryConfig;
  private memoryDir: string;
  private memories: MemoryEntry[] = [];
  private users: MemoryEntry[] = [];
  private loaded: boolean = false;

  constructor(config?: Partial<MemoryConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.memoryDir = this.config.memoryDir;
  }

  async initialize(): Promise<void> {
    await mkdir(this.memoryDir, { recursive: true });
    await this.loadAll();
    this.loaded = true;
  }

  private async loadAll(): Promise<void> {
    this.memories = [];
    this.users = [];

    // Load MEMORY.md
    const memoryPath = join(this.memoryDir, 'memory.md');
    if (existsSync(memoryPath)) {
      try {
        const content = await readFile(memoryPath, 'utf-8');
        this.memories = this.parseMemoryFile(content, 'memory');
      } catch {
        // Ignore
      }
    }

    // Load USER.md
    const userPath = join(this.memoryDir, 'user.md');
    if (existsSync(userPath)) {
      try {
        const content = await readFile(userPath, 'utf-8');
        this.users = this.parseMemoryFile(content, 'user');
      } catch {
        // Ignore
      }
    }

    // Load session memories
    const sessionDir = join(this.memoryDir, 'sessions');
    if (existsSync(sessionDir)) {
      const files = await readdir(sessionDir);
      for (const file of files.filter(f => f.endsWith('.md'))) {
        try {
          const content = await readFile(join(sessionDir, file), 'utf-8');
          const entries = this.parseMemoryFile(content, 'session');
          this.memories.push(...entries);
        } catch {
          // Ignore
        }
      }
    }
  }

  private parseMemoryFile(content: string, source: 'memory' | 'user' | 'session'): MemoryEntry[] {
    const entries: MemoryEntry[] = [];
    const blocks = content.split(/^---$/m);

    for (const block of blocks) {
      const lines = block.trim().split('\n');
      if (lines.length < 2) continue;

      // Parse frontmatter
      const frontmatter: Record<string, string> = {};
      let inFrontmatter = false;
      let contentStart = 0;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line === '---') {
          inFrontmatter = true;
          continue;
        }
        if (inFrontmatter && line.match(/^\w+:/)) {
          const [key, ...valueParts] = line.split(':');
          frontmatter[key.trim()] = valueParts.join(':').trim();
        } else {
          contentStart = i;
          break;
        }
      }

      const entryContent = lines.slice(contentStart).join('\n').trim();
      if (!entryContent) continue;

      entries.push({
        id: frontmatter.id || `entry_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        content: entryContent,
        timestamp: parseInt(frontmatter.timestamp) || Date.now(),
        tags: frontmatter.tags?.split(',').map(t => t.trim()) || [],
        source
      });
    }

    return entries;
  }

  // Get memories relevant to query (progressive loading)
  async getRelevantMemories(query: string, limit: number = 10): Promise<MemoryEntry[]> {
    if (!this.config.enableProgressive) {
      return this.memories.slice(0, limit);
    }

    // Simple keyword matching for relevance
    const queryWords = query.toLowerCase().split(/\s+/);
    const scored = this.memories.map(entry => {
      let score = 0;
      const content = entry.content.toLowerCase();
      
      for (const word of queryWords) {
        if (content.includes(word)) score++;
      }
      
      // Boost recent
      const age = Date.now() - entry.timestamp;
      if (age < 24 * 60 * 60 * 1000) score += 2;
      
      return { entry, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit).map(s => s.entry);
  }

  // Add memory
  async add(content: string, tags: string[] = [], source: 'memory' | 'session' = 'memory'): Promise<void> {
    const entry: MemoryEntry = {
      id: `mem_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      content,
      timestamp: Date.now(),
      tags,
      source
    };

    this.memories.push(entry);
    await this.save();
  }

  // Update memory
  async update(id: string, content: string): Promise<boolean> {
    const idx = this.memories.findIndex(m => m.id === id);
    if (idx === -1) return false;

    this.memories[idx].content = content;
    this.memories[idx].timestamp = Date.now();
    await this.save();
    return true;
  }

  // Delete memory
  async delete(id: string): Promise<boolean> {
    const idx = this.memories.findIndex(m => m.id === id);
    if (idx === -1) return false;

    this.memories.splice(idx, 1);
    await this.save();
    return true;
  }

  // Save to file
  private async save(): Promise<void> {
    const memoryPath = join(this.memoryDir, 'memory.md');
    let content = '---\n';
    
    for (const entry of this.memories.filter(m => m.source === 'memory')) {
      content += `id: ${entry.id}\n`;
      content += `timestamp: ${entry.timestamp}\n`;
      content += `tags: ${entry.tags.join(', ')}\n`;
      content += '---\n';
      content += entry.content + '\n';
      content += '---\n\n';
    }

    await writeFile(memoryPath, content, 'utf-8');
  }

  // Get system prompt block
  getSystemPromptBlock(): string {
    const memoryChars = this.memories.reduce((sum, m) => sum + m.content.length, 0);
    const userChars = this.users.reduce((sum, u) => sum + u.content.length, 0);

    let block = '\n## MEMORY\n';
    block += `<!-- ${this.memories.length} entries, ${memoryChars} chars -->\n\n`;

    for (const entry of this.memories.slice(-20)) {
      block += `### ${new Date(entry.timestamp).toISOString().split('T')[0]} ${entry.tags.map(t => `#${t}`).join(' ')}\n`;
      block += entry.content + '\n\n';
    }

    if (this.users.length > 0) {
      block += '\n## USER CONTEXT\n';
      block += `<!-- ${this.users.length} entries, ${userChars} chars -->\n\n`;
      
      for (const entry of this.users) {
        block += `### ${entry.tags.join(', ')}\n`;
        block += entry.content + '\n\n';
      }
    }

    return block;
  }

  // Search memories
  search(query: string): MemoryEntry[] {
    const queryLower = query.toLowerCase();
    return this.memories.filter(m => 
      m.content.toLowerCase().includes(queryLower) ||
      m.tags.some(t => t.toLowerCase().includes(queryLower))
    );
  }

  // Get all memories
  getAll(): { memories: MemoryEntry[]; users: MemoryEntry[] } {
    return {
      memories: [...this.memories],
      users: [...this.users]
    };
  }

  // Get stats
  getStats(): { memoryCount: number; userCount: number; memoryChars: number; userChars: number } {
    return {
      memoryCount: this.memories.length,
      userCount: this.users.length,
      memoryChars: this.memories.reduce((sum, m) => sum + m.content.length, 0),
      userChars: this.users.reduce((sum, u) => sum + u.content.length, 0)
    };
  }

  isLoaded(): boolean {
    return this.loaded;
  }
}

export default OpenClawMemory;
