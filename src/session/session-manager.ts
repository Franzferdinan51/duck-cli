/**
 * 🦆 Duck Agent - Enhanced Session Manager
 * Cross-session context persistence with OpenClaw-style session handling
 */

import { EventEmitter } from 'events';
import { promises as fs } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

export interface Session {
  id: string;
  name: string;
  createdAt: Date;
  lastActiveAt: Date;
  context: SessionContext;
  messages: SessionMessage[];
  metadata: SessionMetadata;
}

export interface SessionContext {
  currentTask?: string;
  currentProject?: string;
  activeFiles: string[];
  rememberedFacts: string[];
  userPreferences: Record<string, any>;
  toolResults: Record<string, any>;
}

export interface SessionMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface SessionMetadata {
  totalMessages: number;
  totalTokens: number;
  estimatedCost: number;
  tags: string[];
  isArchived: boolean;
}

export interface SessionManagerConfig {
  storageDir: string;
  maxSessions: number;
  autoSaveInterval: number;
  contextWindowSize: number;
}

/**
 * Enhanced Session Manager
 * Provides cross-session context persistence and OpenClaw-style session handling
 */
export class SessionManager extends EventEmitter {
  private sessions: Map<string, Session> = new Map();
  private activeSessionId: string | null = null;
  private config: SessionManagerConfig;
  private autoSaveTimer: NodeJS.Timeout | null = null;

  constructor(config: Partial<SessionManagerConfig> = {}) {
    super();
    this.config = {
      storageDir: config.storageDir || join(homedir(), '.duck-cli', 'sessions'),
      maxSessions: config.maxSessions || 100,
      autoSaveInterval: config.autoSaveInterval || 30000,
      contextWindowSize: config.contextWindowSize || 50
    };
  }

  /**
   * Initialize session manager
   */
  async initialize(): Promise<void> {
    await this.ensureStorageDir();
    await this.loadSessions();
    this.startAutoSave();
    console.log('[SessionManager] Initialized');
  }

  /**
   * Create a new session
   */
  createSession(name: string, initialContext: Partial<SessionContext> = {}): Session {
    const id = this.generateSessionId();
    const session: Session = {
      id,
      name,
      createdAt: new Date(),
      lastActiveAt: new Date(),
      context: {
        activeFiles: [],
        rememberedFacts: [],
        userPreferences: {},
        toolResults: {},
        ...initialContext
      },
      messages: [],
      metadata: {
        totalMessages: 0,
        totalTokens: 0,
        estimatedCost: 0,
        tags: [],
        isArchived: false
      }
    };

    this.sessions.set(id, session);
    this.activeSessionId = id;
    this.emit('sessionCreated', session);
    
    console.log(`[SessionManager] Created session: ${name} (${id})`);
    return session;
  }

  /**
   * Get or create active session
   */
  getActiveSession(): Session {
    if (!this.activeSessionId || !this.sessions.has(this.activeSessionId)) {
      return this.createSession('Default Session');
    }
    return this.sessions.get(this.activeSessionId)!;
  }

  /**
   * Switch to a different session
   */
  switchSession(sessionId: string): boolean {
    if (!this.sessions.has(sessionId)) {
      console.error(`[SessionManager] Session not found: ${sessionId}`);
      return false;
    }

    this.activeSessionId = sessionId;
    const session = this.sessions.get(sessionId)!;
    session.lastActiveAt = new Date();
    
    this.emit('sessionSwitched', session);
    console.log(`[SessionManager] Switched to session: ${session.name}`);
    return true;
  }

  /**
   * Add message to active session
   */
  addMessage(role: SessionMessage['role'], content: string, metadata?: Record<string, any>): void {
    const session = this.getActiveSession();
    const message: SessionMessage = {
      id: this.generateMessageId(),
      role,
      content,
      timestamp: new Date(),
      metadata
    };

    session.messages.push(message);
    session.metadata.totalMessages++;
    session.lastActiveAt = new Date();

    // Trim to context window
    if (session.messages.length > this.config.contextWindowSize) {
      session.messages = session.messages.slice(-this.config.contextWindowSize);
    }

    this.emit('messageAdded', { sessionId: session.id, message });
  }

  /**
   * Update session context
   */
  updateContext(updates: Partial<SessionContext>): void {
    const session = this.getActiveSession();
    session.context = { ...session.context, ...updates };
    session.lastActiveAt = new Date();
    this.emit('contextUpdated', { sessionId: session.id, context: session.context });
  }

  /**
   * Remember a fact for cross-session persistence
   */
  rememberFact(fact: string): void {
    const session = this.getActiveSession();
    if (!session.context.rememberedFacts.includes(fact)) {
      session.context.rememberedFacts.push(fact);
      this.emit('factRemembered', { sessionId: session.id, fact });
    }
  }

  /**
   * Get remembered facts across all sessions
   */
  getAllRememberedFacts(): string[] {
    const facts = new Set<string>();
    for (const session of this.sessions.values()) {
      session.context.rememberedFacts.forEach(f => facts.add(f));
    }
    return Array.from(facts);
  }

  /**
   * List all sessions
   */
  listSessions(): Array<{ id: string; name: string; lastActiveAt: Date; messageCount: number }> {
    return Array.from(this.sessions.values())
      .sort((a, b) => b.lastActiveAt.getTime() - a.lastActiveAt.getTime())
      .map(s => ({
        id: s.id,
        name: s.name,
        lastActiveAt: s.lastActiveAt,
        messageCount: s.metadata.totalMessages
      }));
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Archive a session
   */
  archiveSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    
    session.metadata.isArchived = true;
    this.emit('sessionArchived', session);
    return true;
  }

  /**
   * Delete a session
   */
  deleteSession(sessionId: string): boolean {
    if (!this.sessions.has(sessionId)) return false;
    
    this.sessions.delete(sessionId);
    if (this.activeSessionId === sessionId) {
      this.activeSessionId = null;
    }
    
    this.emit('sessionDeleted', { sessionId });
    return true;
  }

  /**
   * Search sessions
   */
  searchSessions(query: string): Session[] {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.sessions.values()).filter(s => 
      s.name.toLowerCase().includes(lowerQuery) ||
      s.messages.some(m => m.content.toLowerCase().includes(lowerQuery)) ||
      s.context.rememberedFacts.some(f => f.toLowerCase().includes(lowerQuery))
    );
  }

  /**
   * Get context for LLM (formatted messages)
   */
  getContextForLLM(): Array<{ role: string; content: string }> {
    const session = this.getActiveSession();
    return session.messages.map(m => ({
      role: m.role,
      content: m.content
    }));
  }

  /**
   * Persist sessions to disk
   */
  async saveSessions(): Promise<void> {
    try {
      const data = {
        activeSessionId: this.activeSessionId,
        sessions: Array.from(this.sessions.entries()),
        savedAt: new Date().toISOString()
      };
      
      const filePath = join(this.config.storageDir, 'sessions.json');
      await fs.writeFile(filePath, JSON.stringify(data, null, 2));
      this.emit('sessionsSaved');
    } catch (error) {
      console.error('[SessionManager] Failed to save sessions:', error);
    }
  }

  /**
   * Load sessions from disk
   */
  private async loadSessions(): Promise<void> {
    try {
      const filePath = join(this.config.storageDir, 'sessions.json');
      const data = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(data);
      
      this.activeSessionId = parsed.activeSessionId;
      this.sessions = new Map(parsed.sessions);
      
      // Restore Date objects
      for (const session of this.sessions.values()) {
        session.createdAt = new Date(session.createdAt);
        session.lastActiveAt = new Date(session.lastActiveAt);
        session.messages.forEach(m => {
          m.timestamp = new Date(m.timestamp);
        });
      }
      
      console.log(`[SessionManager] Loaded ${this.sessions.size} sessions`);
      this.emit('sessionsLoaded', { count: this.sessions.size });
    } catch (error) {
      console.log('[SessionManager] No existing sessions found');
    }
  }

  /**
   * Ensure storage directory exists
   */
  private async ensureStorageDir(): Promise<void> {
    try {
      await fs.mkdir(this.config.storageDir, { recursive: true });
    } catch (error) {
      console.error('[SessionManager] Failed to create storage dir:', error);
    }
  }

  /**
   * Start auto-save timer
   */
  private startAutoSave(): void {
    this.autoSaveTimer = setInterval(() => {
      this.saveSessions();
    }, this.config.autoSaveInterval);
  }

  /**
   * Stop auto-save
   */
  stopAutoSave(): void {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate unique message ID
   */
  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get status
   */
  getStatus(): {
    totalSessions: number;
    activeSessionId: string | null;
    storageDir: string;
    autoSaveEnabled: boolean;
  } {
    return {
      totalSessions: this.sessions.size,
      activeSessionId: this.activeSessionId,
      storageDir: this.config.storageDir,
      autoSaveEnabled: this.autoSaveTimer !== null
    };
  }
}

export default SessionManager;
