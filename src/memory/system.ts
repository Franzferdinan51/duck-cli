/**
 * Duck Agent - Memory System
 * SQLite-backed persistent memory with semantic search and learning
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { fileURLToPath } from 'url';
import { SQLiteStore, MemorySearch, ToolUsage, SessionSummary } from './sqlite-store.js';

// Raw import for SOUL-template.md fallback personality
import soulTemplateRaw from '../prompts/SOUL-template.md?raw';

export { SQLiteStore, MemorySearch, ToolUsage, SessionSummary };

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

export class MemorySystem {
  private store: SQLiteStore;
  private soul: string = '';
  private soulPath: string;
  private initialized: boolean = false;

  constructor(memoryDir?: string) {
    const dir = memoryDir || join(homedir(), '.duck', 'memory');
    this.store = new SQLiteStore(dir);
    this.soulPath = join(dir, 'SOUL.md');
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    // Load SOUL
    if (existsSync(this.soulPath)) {
      this.soul = readFileSync(this.soulPath, 'utf-8');
    } else {
      this.soul = this.defaultSoul();
      writeFileSync(this.soulPath, this.soul, 'utf-8');
    }
    
    this.initialized = true;
  }

  private defaultSoul(): string {
    // Use SOUL-template.md as fallback from prompts module
    if (soulTemplateRaw) {
      return soulTemplateRaw;
    }
    // Fallback to basic SOUL if template not available
    return `# Duck Agent SOUL

## Identity
I am Duck Agent — a super AI coding agent built on duck-cli.

## Personality
- Direct and no-BS
- Technical and precise
- Casual but competent
- Swears when appropriate

## Capabilities
- 13 core tools (shell, file, desktop, memory, web, etc.)
- 10 built-in skills
- Multi-provider AI (MiniMax, OpenAI, Anthropic, LM Studio)
- MCP server mode
- Web UI mode

## Rules
1. Always verify before acting
2. Log tool usage for learning
3. Ask for clarification on ambiguous tasks
4. Be honest about limitations
`;
  }

  getSoul(): string {
    return this.soul;
  }

  async setSoul(content: string): Promise<void> {
    this.soul = content;
    writeFileSync(this.soulPath, content, 'utf-8');
  }

  // ─── Core Memory Operations ───────────────────────────────────

  async add(
    content: string,
    type: MemoryEntry['type'] = 'fact',
    tags: string[] = [],
    importance?: number
  ): Promise<string> {
    return this.store.add(content, type, tags, importance);
  }

  async remember(content: string, type: MemoryEntry['type'] = 'fact', tags: string[] = []): Promise<string> {
    return this.store.add(content, type, tags);
  }

  async search(query: string, limit: number = 10): Promise<string[]> {
    const results = await this.store.search(query, limit);
    return results.map(r => r.content);
  }

  async recall(query: string, limit: number = 10): Promise<MemorySearch[]> {
    return this.store.search(query, limit);
  }

  async get(id: string): Promise<MemoryEntry | null> {
    return this.store.get(id);
  }

  async list(type?: MemoryEntry['type'], limit: number = 50): Promise<MemoryEntry[]> {
    return this.store.list(type, limit);
  }

  async delete(id: string): Promise<boolean> {
    return this.store.delete(id);
  }

  async learn(content: string, tags: string[] = ['learned']): Promise<string> {
    return this.store.add(content, 'learned', tags, 7);
  }

  async rememberPreference(content: string): Promise<string> {
    return this.store.add(content, 'preference', ['preference'], 8);
  }

  // ─── Tool Telemetry ───────────────────────────────────────────

  async logTool(toolName: string, args: string, success: boolean, error?: string, duration: number = 0): Promise<void> {
    await this.store.logToolUse({
      toolName,
      args: args.substring(0, 500), // Truncate long args
      success,
      error,
      duration,
      timestamp: Date.now(),
    });
  }

  async getToolStats(days: number = 7): Promise<Record<string, { total: number; success: number; avgDuration: number; successRate: number }>> {
    return this.store.getToolStats(days);
  }

  async getFailingTools(days: number = 7): Promise<string[]> {
    return this.store.getFailingTools(days);
  }

  // ─── Session Management ────────────────────────────────────────

  async saveSession(
    sessionId: string,
    summary: string,
    keyDecisions: string[],
    toolsUsed: string[],
    outcome: 'success' | 'partial' | 'failed',
    duration: number
  ): Promise<void> {
    await this.store.saveSession({
      id: `sess_${Date.now()}`,
      lastMessage: Date.now(),
      topic: summary.substring(0, 50),
    });
  }

  async getRecentSessions(limit: number = 10): Promise<SessionSummary[]> {
    return this.store.getRecentSessions(limit);
  }

  // ─── Pattern Learning ─────────────────────────────────────────

  async learnFromFeedback(success: boolean, feedback?: string): Promise<void> {
    if (feedback) {
      await this.store.learnPattern('feedback', success ? 'positive' : 'negative', feedback);
    }
  }

  async getLearnedPatterns(type?: string): Promise<any[]> {
    return this.store.getPatterns(type);
  }

  // ─── Stats ───────────────────────────────────────────────────

  stats(): { memories: number; toolLogs: number; sessions: number; patterns: number } {
    return this.store.stats();
  }

  async prune(maxEntries: number = 10000): Promise<number> {
    return this.store.prune(maxEntries);
  }

  close(): void {
    this.store.close();
  }
}

export default MemorySystem;
