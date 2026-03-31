/**
 * Duck Agent - Memory System
 * Persistent memory with SOUL, facts, and context
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

export interface MemoryEntry {
  id: string;
  content: string;
  type: 'soul' | 'fact' | 'interaction' | 'learned';
  timestamp: number;
  tags: string[];
}

export class MemorySystem {
  private memoryDir: string;
  private entries: MemoryEntry[] = [];
  private soul: string = '';

  constructor(memoryDir: string = '.duck/memory') {
    this.memoryDir = memoryDir;
  }

  async initialize(): Promise<void> {
    await mkdir(this.memoryDir, { recursive: true });
    
    // Load existing memory
    await this.load();
    
    // Load or create SOUL
    await this.loadSoul();
  }

  private async load(): Promise<void> {
    const memoryFile = join(this.memoryDir, 'memory.json');
    
    if (existsSync(memoryFile)) {
      try {
        const content = await readFile(memoryFile, 'utf-8');
        this.entries = JSON.parse(content);
      } catch {
        this.entries = [];
      }
    }
  }

  async save(): Promise<void> {
    const memoryFile = join(this.memoryDir, 'memory.json');
    await writeFile(memoryFile, JSON.stringify(this.entries, null, 2), 'utf-8');
  }

  private async loadSoul(): Promise<void> {
    const soulFile = join(this.memoryDir, 'SOUL.md');
    
    if (existsSync(soulFile)) {
      this.soul = await readFile(soulFile, 'utf-8');
    } else {
      // Default soul
      this.soul = `# ${process.env.USER || 'Duck'} Agent Soul

## Identity
I am a helpful AI assistant.

## Personality
- Friendly and helpful
- Direct and concise
- Technical and precise

## Rules
1. Be helpful
2. Be honest
3. Be efficient
`;
      await writeFile(soulFile, this.soul, 'utf-8');
    }
  }

  getSoul(): string {
    return this.soul;
  }

  async setSoul(content: string): Promise<void> {
    this.soul = content;
    const soulFile = join(this.memoryDir, 'SOUL.md');
    await writeFile(soulFile, content, 'utf-8');
  }

  async add(content: string, type: MemoryEntry['type'] = 'fact', tags: string[] = []): Promise<void> {
    const entry: MemoryEntry = {
      id: `mem_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      content,
      type,
      timestamp: Date.now(),
      tags
    };

    this.entries.push(entry);
    await this.save();
  }

  async search(query: string, limit: number = 10): Promise<string[]> {
    const queryLower = query.toLowerCase();
    
    const results = this.entries
      .filter(e => 
        e.content.toLowerCase().includes(queryLower) ||
        e.tags.some(t => t.toLowerCase().includes(queryLower))
      )
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);

    return results.map(r => r.content);
  }

  async getRelevant(input: string, limit: number = 5): Promise<string[]> {
    // Simple relevance - just search with input words
    return this.search(input, limit);
  }

  async clear(type?: MemoryEntry['type']): Promise<void> {
    if (type) {
      this.entries = this.entries.filter(e => e.type !== type);
    } else {
      this.entries = [];
    }
    await this.save();
  }

  list(): MemoryEntry[] {
    return [...this.entries];
  }
}

export default MemorySystem;
