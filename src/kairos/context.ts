/**
 * 🦆 Duck Agent - Context Management
 * Inspired by Claude Code's context system
 */

import { existsSync, readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';

// ============================================================================
// MEMORY FILES (CLAUDE.MD SYSTEM)
// ============================================================================

export interface MemoryFile {
  path: string;
  content: string;
  priority: number;  // Higher = loaded later = higher priority
  isLocal: boolean;   // Local (not committed to repo)
}

const MAX_MEMORY_CHARS = 40000;

export class MemorySystem {
  private memoryDir: string;
  private memoryFiles: MemoryFile[] = [];
  
  constructor(memoryDir?: string) {
    this.memoryDir = memoryDir || join(homedir(), '.duckagent', 'memory');
  }
  
  /**
   * Load all memory files
   */
  async loadMemoryFiles(): Promise<MemoryFile[]> {
    this.memoryFiles = [];
    
    // Load project memory (current directory)
    await this.loadProjectMemory(process.cwd());
    
    // Load global memory (~/.duckagent/memory/)
    await this.loadGlobalMemory();
    
    // Sort by priority (lower first = loaded first)
    this.memoryFiles.sort((a, b) => a.priority - b.priority);
    
    return this.memoryFiles;
  }
  
  /**
   * Load memory files from a directory tree
   */
  private async loadDirectoryMemory(dir: string, basePriority: number): Promise<void> {
    if (!existsSync(dir)) return;
    
    try {
      // Load CLAUDE.md if exists
      const claudeMd = join(dir, 'CLAUDE.md');
      if (existsSync(claudeMd)) {
        const content = this.stripFrontmatter(readFileSync(claudeMd, 'utf-8'));
        this.memoryFiles.push({
          path: claudeMd,
          content,
          priority: basePriority,
          isLocal: true,
        });
      }
      
      // Load .claude directory
      const claudeDir = join(dir, '.claude');
      if (existsSync(claudeDir)) {
        // Load .claude/CLAUDE.md
        const claudeDirMd = join(claudeDir, 'CLAUDE.md');
        if (existsSync(claudeDirMd)) {
          const content = this.stripFrontmatter(readFileSync(claudeDirMd, 'utf-8'));
          this.memoryFiles.push({
            path: claudeDirMd,
            content,
            priority: basePriority + 1,
            isLocal: true,
          });
        }
        
        // Load rules/*.md
        const rulesDir = join(claudeDir, 'rules');
        if (existsSync(rulesDir)) {
          const ruleFiles = readdirSync(rulesDir).filter(f => f.endsWith('.md'));
          for (const ruleFile of ruleFiles) {
            const content = this.stripFrontmatter(
              readFileSync(join(rulesDir, ruleFile), 'utf-8')
            );
            this.memoryFiles.push({
              path: join(rulesDir, ruleFile),
              content,
              priority: basePriority + 2,
              isLocal: false,
            });
          }
        }
      }
    } catch (e) {
      // Ignore errors
    }
  }
  
  /**
   * Load project memory (walks up directory tree)
   */
  private async loadProjectMemory(startDir: string): Promise<void> {
    let dir = startDir;
    let priority = 0;
    
    while (dir !== dirname(dir)) {
      await this.loadDirectoryMemory(dir, priority);
      dir = dirname(dir);
      priority += 10;
    }
  }
  
  /**
   * Load global memory
   */
  private async loadGlobalMemory(): Promise<void> {
    await this.loadDirectoryMemory(
      join(this.memoryDir, 'global'),
      100
    );
  }
  
  /**
   * Strip YAML frontmatter from markdown
   */
  private stripFrontmatter(content: string): string {
    if (content.startsWith('---')) {
      const end = content.indexOf('---', 3);
      if (end !== -1) {
        return content.slice(end + 3).trim();
      }
    }
    return content;
  }
  
  /**
   * Compile all memory into a single string
   */
  compileMemory(): string {
    const parts: string[] = [];
    
    for (const file of this.memoryFiles) {
      if (parts.join('').length + file.content.length > MAX_MEMORY_CHARS) {
        break; // Truncate if too long
      }
      parts.push(`\n---\n${file.content}`);
    }
    
    return parts.join('\n');
  }
  
  /**
   * Get memory for a specific purpose
   */
  getMemoryForPurpose(purpose: string): string {
    const relevant = this.memoryFiles.filter(f =>
      f.content.toLowerCase().includes(purpose.toLowerCase())
    );
    
    return relevant.map(f => f.content).join('\n\n');
  }
  
  /**
   * Save a memory file
   */
  saveMemory(path: string, content: string): void {
    const dir = dirname(path);
    if (!existsSync(dir)) {
      // Would need mkdirSync here
    }
    writeFileSync(path, content);
  }
}

// ============================================================================
// CONTEXT BUILDING
// ============================================================================

export interface ContextOptions {
  includeGit?: boolean;
  includeMemory?: boolean;
  includeTools?: boolean;
  includeCapabilities?: boolean;
}

export interface Context {
  system: string;
  git?: string;
  memory?: string;
  capabilities?: string;
}

export async function buildContext(options: ContextOptions = {}): Promise<string> {
  const parts: string[] = [];
  
  // Git status
  if (options.includeGit !== false) {
    const git = await getGitContext();
    if (git) parts.push(git);
  }
  
  // Memory
  if (options.includeMemory !== false) {
    const mem = new MemorySystem();
    const files = await mem.loadMemoryFiles();
    if (files.length > 0) {
      parts.push(mem.compileMemory());
    }
  }
  
  return parts.join('\n\n');
}

/**
 * Get git context
 */
export async function getGitContext(): Promise<string | null> {
  // This would integrate with actual git commands
  // For now, return placeholder
  return null;
}

// ============================================================================
// SESSION MANAGEMENT
// ============================================================================

export interface Session {
  id: string;
  createdAt: number;
  lastActive: number;
  messageCount: number;
  toolsUsed: string[];
  costTotal: number;
}

export class SessionManager {
  private sessions: Map<string, Session> = new Map();
  private currentSessionId: string;
  
  constructor() {
    this.currentSessionId = this.generateSessionId();
    this.createSession(this.currentSessionId);
  }
  
  private generateSessionId(): string {
    return `sess_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }
  
  createSession(id?: string): Session {
    const sessionId = id || this.generateSessionId();
    const session: Session = {
      id: sessionId,
      createdAt: Date.now(),
      lastActive: Date.now(),
      messageCount: 0,
      toolsUsed: [],
      costTotal: 0,
    };
    this.sessions.set(sessionId, session);
    return session;
  }
  
  getSession(id: string): Session | undefined {
    return this.sessions.get(id);
  }
  
  getCurrentSession(): Session | undefined {
    return this.sessions.get(this.currentSessionId);
  }
  
  recordMessage(): void {
    const session = this.getCurrentSession();
    if (session) {
      session.messageCount++;
      session.lastActive = Date.now();
    }
  }
  
  recordTool(toolName: string): void {
    const session = this.getCurrentSession();
    if (session && !session.toolsUsed.includes(toolName)) {
      session.toolsUsed.push(toolName);
    }
  }
  
  recordCost(cost: number): void {
    const session = this.getCurrentSession();
    if (session) {
      session.costTotal += cost;
    }
  }
  
  getAllSessions(): Session[] {
    return Array.from(this.sessions.values());
  }
  
  getRecentSessions(limit: number = 10): Session[] {
    return this.getAllSessions()
      .sort((a, b) => b.lastActive - a.lastActive)
      .slice(0, limit);
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  MemorySystem,
  SessionManager,
  buildContext,
  getGitContext,
};
