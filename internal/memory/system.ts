/**
 * Duck CLI - Semantic Memory System
 * 
 * **KILLER FEATURE**: Persistent memory across sessions.
 * 
 * Based on Claude Code's memory system:
 * - Session summaries
 * - Project memory
 * - Semantic search
 * - Context injection
 */

import { readFile, writeFile, mkdir, readdir } from 'fs/promises';
import { join, dirname } from 'path';
import { existsSync } from 'fs';

interface MemoryEntry {
  id: string;
  type: 'decision' | 'pattern' | 'context' | 'fact';
  content: string;
  timestamp: number;
  tags: string[];
}

interface SessionSummary {
  id: string;
  date: string;
  summary: string;
  tasks: string[];
}

export class MemorySystem {
  private memoryDir: string;
  private memories: MemoryEntry[] = [];
  private sessions: SessionSummary[] = [];

  constructor(memoryDir?: string) {
    this.memoryDir = memoryDir || join(process.cwd(), '.duck/memory');
  }

  async initialize(): Promise<void> {
    // Ensure memory directory exists
    await mkdir(this.memoryDir, { recursive: true });
    await mkdir(join(this.memoryDir, 'sessions'), { recursive: true });

    // Load existing memories
    await this.loadMemories();
    await this.loadSessions();
  }

  private async loadMemories(): Promise<void> {
    const memoriesFile = join(this.memoryDir, 'memories.json');
    
    if (existsSync(memoriesFile)) {
      const content = await readFile(memoriesFile, 'utf-8');
      this.memories = JSON.parse(content);
    }
  }

  private async saveMemories(): Promise<void> {
    const memoriesFile = join(this.memoryDir, 'memories.json');
    await writeFile(memoriesFile, JSON.stringify(this.memories, null, 2));
  }

  private async loadSessions(): Promise<void> {
    const sessionsDir = join(this.memoryDir, 'sessions');
    const files = await readdir(sessionsDir).catch(() => []);
    
    this.sessions = [];
    for (const file of files.filter(f => f.endsWith('.json'))) {
      try {
        const content = await readFile(join(sessionsDir, file), 'utf-8');
        this.sessions.push(JSON.parse(content));
      } catch {
        // Skip invalid files
      }
    }
  }

  // Store a memory
  async remember(
    content: string,
    type: MemoryEntry['type'] = 'fact',
    tags: string[] = []
  ): Promise<void> {
    const entry: MemoryEntry = {
      id: this.generateId(),
      type,
      content,
      timestamp: Date.now(),
      tags
    };

    this.memories.push(entry);
    await this.saveMemories();
  }

  // Search memories
  async search(query: string, limit: number = 10): Promise<MemoryEntry[]> {
    const lowerQuery = query.toLowerCase();
    
    // Score each memory by relevance
    const scored = this.memories.map(m => {
      let score = 0;
      
      // Direct content match
      if (m.content.toLowerCase().includes(lowerQuery)) {
        score += 10;
      }
      
      // Tag match
      for (const tag of m.tags) {
        if (tag.toLowerCase().includes(lowerQuery)) {
          score += 5;
        }
      }
      
      // Type match
      if (lowerQuery.includes(m.type)) {
        score += 2;
      }

      // Recency bonus
      const daysOld = (Date.now() - m.timestamp) / (1000 * 60 * 60 * 24);
      if (daysOld < 7) score += 3;
      else if (daysOld < 30) score += 1;

      return { entry: m, score };
    });

    // Sort by score and return top results
    return scored
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(s => s.entry);
  }

  // Get memories relevant to current context
  async getContext(relatedTo: string[]): Promise<MemoryEntry[]> {
    const results: MemoryEntry[] = [];
    
    for (const term of relatedTo) {
      const found = await this.search(term, 3);
      results.push(...found);
    }

    // Dedupe and return
    const seen = new Set<string>();
    return results.filter(r => {
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    });
  }

  // Save session summary
  async saveSessionSummary(summary: string, tasks: string[]): Promise<void> {
    const session: SessionSummary = {
      id: this.generateId(),
      date: new Date().toISOString(),
      summary,
      tasks
    };

    this.sessions.push(session);

    // Save to file
    const sessionsDir = join(this.memoryDir, 'sessions');
    await writeFile(
      join(sessionsDir, `${session.id}.json`),
      JSON.stringify(session, null, 2)
    );
  }

  // Search past sessions
  async searchSessions(query: string, limit: number = 5): Promise<SessionSummary[]> {
    const lowerQuery = query.toLowerCase();
    
    return this.sessions
      .filter(s => 
        s.summary.toLowerCase().includes(lowerQuery) ||
        s.tasks.some(t => t.toLowerCase().includes(lowerQuery))
      )
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  // Get recent sessions
  async getRecentSessions(days: number = 7): Promise<SessionSummary[]> {
    const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
    
    return this.sessions
      .filter(s => s.timestamp > cutoff)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  // Store a decision
  async rememberDecision(
    decision: string,
    rationale: string,
    context: string
  ): Promise<void> {
    await this.remember(
      `Decision: ${decision}\nRationale: ${rationale}\nContext: ${context}`,
      'decision',
      ['decision']
    );
  }

  // Store a code pattern
  async rememberPattern(
    pattern: string,
    usage: string,
    examples: string[]
  ): Promise<void> {
    await this.remember(
      `Pattern: ${pattern}\nUsage: ${usage}\nExamples: ${examples.join(', ')}`,
      'pattern',
      ['pattern']
    );
  }

  // Get project memory (high-level info)
  async getProjectMemory(): Promise<string> {
    const decisions = this.memories.filter(m => m.type === 'decision');
    const patterns = this.memories.filter(m => m.type === 'pattern');
    
    let output = '## Project Memory\n\n';
    
    if (decisions.length > 0) {
      output += '### Key Decisions\n';
      for (const d of decisions.slice(-5)) {
        output += `- ${d.content}\n`;
      }
      output += '\n';
    }
    
    if (patterns.length > 0) {
      output += '### Code Patterns\n';
      for (const p of patterns.slice(-5)) {
        output += `- ${p.content}\n`;
      }
    }
    
    return output;
  }

  // Compact old memories
  async compact(): Promise<void> {
    // Keep recent memories, summarize old ones
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    
    const recent = this.memories.filter(m => m.timestamp > thirtyDaysAgo);
    const old = this.memories.filter(m => m.timestamp <= thirtyDaysAgo);

    if (old.length > 0) {
      // Summarize old memories into a single entry
      const summary = old.map(m => m.content).join('\n---\n');
      
      await this.remember(
        `[Compacted from ${old.length} memories]\n${summary.slice(0, 500)}...`,
        'context',
        ['compacted']
      );
    }

    this.memories = recent;
    await this.saveMemories();
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }
}
