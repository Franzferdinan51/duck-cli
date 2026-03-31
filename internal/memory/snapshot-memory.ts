/**
 * Duck CLI - Frozen Snapshot Memory System
 * 
 * Based on Hermes Agent's memory_tool.py:
 * - Frozen snapshot injected at session start (prefix-cache friendly)
 * - MEMORY.md + USER.md files
 * - Usage tracking (% and char count)
 * - Mid-session writes persist to disk but don't change system prompt
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

export interface MemoryEntry {
  id: string;
  content: string;
  timestamp: number;
  type: 'memory' | 'user';
}

export interface MemoryConfig {
  maxChars: number;
  delimiter: string;
}

const DEFAULT_CONFIG: MemoryConfig = {
  maxChars: 2200,
  delimiter: '\n§\n'
};

const MEMORY_THREATS = [
  { pattern: /ignore\s+(previous|all|above|prior)\s+instructions/i, name: 'prompt_injection' },
  { pattern: /you\s+are\s+now\s+/i, name: 'role_hijack' },
  { pattern: /do\s+not\s+tell\s+the\s+user/i, name: 'deception_hide' },
  { pattern: /\$\(.*curl.*\$\{/i, name: 'exfil_curl' },
];

export class FrozenSnapshotMemory {
  private memoryDir: string;
  private config: MemoryConfig;
  private memoryEntries: MemoryEntry[] = [];
  private userEntries: MemoryEntry[] = [];
  
  // Frozen snapshot for current session (set at load time)
  private frozenSnapshot: { memory: string; user: string } = { memory: '', user: '' };
  
  // Usage tracking
  private memoryChars = 0;
  private userChars = 0;

  constructor(memoryDir?: string, config?: Partial<MemoryConfig>) {
    this.memoryDir = memoryDir || join(process.cwd(), '.duck/memory');
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async initialize(): Promise<void> {
    await mkdir(this.memoryDir, { recursive: true });
    await this.load();
    this.buildFrozenSnapshot();
  }

  private async load(): Promise<void> {
    this.memoryEntries = [];
    this.userEntries = [];

    // Load memory entries
    const memoryFile = join(this.memoryDir, 'memory.txt');
    if (existsSync(memoryFile)) {
      const content = await readFile(memoryFile, 'utf-8');
      const entries = content.split(this.config.delimiter).filter(e => e.trim());
      
      for (const entry of entries) {
        const lines = entry.split('\n');
        const timestamp = parseInt(lines[0]) || Date.now();
        const entryContent = lines.slice(1).join('\n');
        
        this.memoryEntries.push({
          id: `${timestamp}`,
          content: entryContent,
          timestamp,
          type: 'memory'
        });
      }
    }

    // Load user entries
    const userFile = join(this.memoryDir, 'user.txt');
    if (existsSync(userFile)) {
      const content = await readFile(userFile, 'utf-8');
      const entries = content.split(this.config.delimiter).filter(e => e.trim());
      
      for (const entry of entries) {
        const lines = entry.split('\n');
        const timestamp = parseInt(lines[0]) || Date.now();
        const entryContent = lines.slice(1).join('\n');
        
        this.userEntries.push({
          id: `${timestamp}`,
          content: entryContent,
          timestamp,
          type: 'user'
        });
      }
    }
  }

  private buildFrozenSnapshot(): void {
    // Build frozen snapshot from current entries
    // This is what gets injected into system prompt
    
    const memoryContent = this.memoryEntries
      .map(e => `${e.timestamp}\n${e.content}`)
      .join(this.config.delimiter);
    
    const userContent = this.userEntries
      .map(e => `${e.timestamp}\n${e.content}`)
      .join(this.config.delimiter);

    this.frozenSnapshot = {
      memory: memoryContent,
      user: userContent
    };

    this.memoryChars = memoryContent.length;
    this.userChars = userContent.length;
  }

  // Get frozen snapshot for system prompt injection
  getFrozenSnapshot(): { memory: string; user: string } {
    return this.frozenSnapshot;
  }

  // Get usage stats
  getUsageStats(): { memory: { chars: number; max: number; percent: number }; user: { chars: number; max: number; percent: number } } {
    const memoryPercent = Math.round((this.memoryChars / this.config.maxChars) * 100);
    const userPercent = Math.round((this.userChars / this.config.maxChars) * 100);
    
    return {
      memory: { chars: this.memoryChars, max: this.config.maxChars, percent: memoryPercent },
      user: { chars: this.userChars, max: this.config.maxChars, percent: userPercent }
    };
  }

  // Scan content for threats
  scanContent(content: string): string | null {
    for (const { pattern, name } of MEMORY_THREATS) {
      if (pattern.test(content)) {
        return `Blocked: content matches threat pattern '${name}'. Memory entries are injected into system prompt.`;
      }
    }
    
    // Check invisible unicode
    const INVISIBLE = ['\u200b', '\u200c', '\u200d', '\u2060', '\ufeff'];
    for (const char of INVISIBLE) {
      if (content.includes(char)) {
        return `Blocked: content contains invisible unicode U+${char.charCodeAt(0).toString(16).toUpperCase()}`;
      }
    }
    
    return null;
  }

  // Add entry
  async add(content: string, type: 'memory' | 'user'): Promise<{ success: boolean; error?: string }> {
    // Scan for threats
    const threat = this.scanContent(content);
    if (threat) {
      return { success: false, error: threat };
    }

    // Check capacity
    const targetArray = type === 'memory' ? this.memoryEntries : this.userEntries;
    const currentChars = type === 'memory' ? this.memoryChars : this.userChars;
    
    if (currentChars + content.length > this.config.maxChars) {
      // Need to prune oldest entries
      await this.prune(type);
    }

    const entry: MemoryEntry = {
      id: `${Date.now()}`,
      content,
      timestamp: Date.now(),
      type
    };

    targetArray.push(entry);

    // Persist to disk immediately
    await this.persist();

    // Rebuild frozen snapshot for next session
    this.buildFrozenSnapshot();

    return { success: true };
  }

  // Replace entry by substring match
  async replace(find: string, replacement: string, type: 'memory' | 'user'): Promise<{ success: boolean; error?: string }> {
    // Scan replacement for threats
    const threat = this.scanContent(replacement);
    if (threat) {
      return { success: false, error: threat };
    }

    const targetArray = type === 'memory' ? this.memoryEntries : this.userEntries;
    const idx = targetArray.findIndex(e => e.content.includes(find));
    
    if (idx === -1) {
      return { success: false, error: `Entry not found: "${find.slice(0, 50)}..."` };
    }

    targetArray[idx].content = replacement;
    targetArray[idx].timestamp = Date.now();

    await this.persist();
    this.buildFrozenSnapshot();

    return { success: true };
  }

  // Remove entry by substring match
  async remove(find: string, type: 'memory' | 'user'): Promise<{ success: boolean; error?: string }> {
    const targetArray = type === 'memory' ? this.memoryEntries : this.userEntries;
    const idx = targetArray.findIndex(e => e.content.includes(find));
    
    if (idx === -1) {
      return { success: false, error: `Entry not found: "${find.slice(0, 50)}..."` };
    }

    targetArray.splice(idx, 1);

    await this.persist();
    this.buildFrozenSnapshot();

    return { success: true };
  }

  // Prune oldest entries to make room
  private async prune(type: 'memory' | 'user'): Promise<void> {
    const targetArray = type === 'memory' ? this.memoryEntries : this.userEntries;
    
    // Remove oldest 25%
    const toRemove = Math.ceil(targetArray.length * 0.25);
    targetArray.splice(0, toRemove);
  }

  // Persist to disk
  private async persist(): Promise<void> {
    // Persist memory
    const memoryFile = join(this.memoryDir, 'memory.txt');
    const memoryContent = this.memoryEntries
      .map(e => `${e.timestamp}\n${e.content}`)
      .join(this.config.delimiter);
    await writeFile(memoryFile, memoryContent, 'utf-8');

    // Persist user
    const userFile = join(this.memoryDir, 'user.txt');
    const userContent = this.userEntries
      .map(e => `${e.timestamp}\n${e.content}`)
      .join(this.config.delimiter);
    await writeFile(userFile, userContent, 'utf-8');
  }

  // List all entries
  list(type?: 'memory' | 'user'): MemoryEntry[] {
    if (type) {
      return type === 'memory' ? [...this.memoryEntries] : [...this.userEntries];
    }
    return [...this.memoryEntries, ...this.userEntries];
  }

  // Search entries
  search(query: string, type?: 'memory' | 'user'): MemoryEntry[] {
    const lower = query.toLowerCase();
    const results: MemoryEntry[] = [];

    const check = (entries: MemoryEntry[]) => {
      for (const entry of entries) {
        if (entry.content.toLowerCase().includes(lower)) {
          results.push(entry);
        }
      }
    };

    if (!type || type === 'memory') check(this.memoryEntries);
    if (!type || type === 'user') check(this.userEntries);

    return results;
  }
}
