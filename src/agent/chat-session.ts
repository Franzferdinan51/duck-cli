// @ts-nocheck
/**
 * duck-cli v3 - Persistent Chat Session
 * Manages conversation history with disk persistence
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

export interface SessionData {
  sessionId: string;
  createdAt: number;
  lastAccessed: number;
  messages: ChatMessage[];
  metadata?: {
    userId?: string;
    platform?: string;
    model?: string;
  };
}

const DUCK_DIR = join(homedir(), '.duck-cli');
const SESSIONS_DIR = join(DUCK_DIR, 'sessions');
const SESSION_TTL = 24 * 60 * 60 * 1000; // 24 hours

// Ensure directories exist
if (!existsSync(DUCK_DIR)) mkdirSync(DUCK_DIR, { recursive: true });
if (!existsSync(SESSIONS_DIR)) mkdirSync(SESSIONS_DIR, { recursive: true });

export class ChatSession {
  messages: ChatMessage[] = [];
  sessionId: string;
  createdAt: number;
  lastAccessed: number;
  metadata: SessionData['metadata'];

  constructor(sessionId: string, metadata?: SessionData['metadata']) {
    this.sessionId = sessionId;
    this.createdAt = Date.now();
    this.lastAccessed = Date.now();
    this.messages = [];
    this.metadata = metadata;
    
    // Try to load existing session
    this.load();
  }

  addSystem(content: string): void {
    // Remove old system messages to avoid duplication
    this.messages = this.messages.filter(m => m.role !== 'system');
    this.messages.unshift({ role: 'system', content, timestamp: Date.now() });
    this.save();
  }

  addUser(content: string): void {
    this.messages.push({ role: 'user', content, timestamp: Date.now() });
    this.lastAccessed = Date.now();
    this.save();
  }

  addAssistant(content: string): void {
    this.messages.push({ role: 'assistant', content, timestamp: Date.now() });
    this.lastAccessed = Date.now();
    this.save();
  }

  addToolResult(toolName: string, result: string): void {
    this.messages.push({ 
      role: 'system', 
      content: `[Tool ${toolName} result]: ${result}`,
      timestamp: Date.now() 
    });
    this.lastAccessed = Date.now();
    this.save();
  }

  getMessages(): ChatMessage[] {
    this.lastAccessed = Date.now();
    return this.messages;
  }

  getContext(maxTokens: number = 8000): ChatMessage[] {
    // Rough estimate: ~4 chars per token
    const maxChars = maxTokens * 4;
    const systemMsgs: ChatMessage[] = [];
    const nonSystem: ChatMessage[] = [];

    for (const msg of this.messages) {
      if (msg.role === 'system') {
        systemMsgs.push(msg);
      } else {
        nonSystem.push(msg);
      }
    }

    // Start with system, add non-system from newest to oldest (then reverse)
    const result: ChatMessage[] = [...systemMsgs];
    let totalChars = systemMsgs.reduce((sum, m) => sum + m.content.length, 0);

    // Add non-system messages from newest to oldest
    for (let i = nonSystem.length - 1; i >= 0; i--) {
      const msg = nonSystem[i];
      if (totalChars + msg.content.length <= maxChars) {
        result.push(msg);
        totalChars += msg.content.length;
      } else {
        break;
      }
    }

    // Reverse to get chronological order
    const systemCount = systemMsgs.length;
    const nonSystemResult = result.slice(systemCount).reverse();
    return [...systemMsgs, ...nonSystemResult];
  }

  clear(): void {
    const systemMsgs = this.messages.filter(m => m.role === 'system');
    this.messages = systemMsgs;
    this.save();
  }

  size(): number {
    return this.messages.length;
  }

  toJSON(): SessionData {
    return {
      sessionId: this.sessionId,
      createdAt: this.createdAt,
      lastAccessed: this.lastAccessed,
      messages: this.messages,
      metadata: this.metadata,
    };
  }

  private getSessionPath(): string {
    return join(SESSIONS_DIR, `${this.sessionId}.json`);
  }

  private save(): void {
    try {
      writeFileSync(this.getSessionPath(), JSON.stringify(this.toJSON(), null, 2));
    } catch (e) {
      console.error('[ChatSession] Failed to save:', e);
    }
  }

  private load(): void {
    try {
      const path = this.getSessionPath();
      if (existsSync(path)) {
        const data: SessionData = JSON.parse(readFileSync(path, 'utf-8'));
        this.messages = data.messages || [];
        this.createdAt = data.createdAt || Date.now();
        this.lastAccessed = data.lastAccessed || Date.now();
        this.metadata = { ...this.metadata, ...data.metadata };
      }
    } catch (e) {
      console.error('[ChatSession] Failed to load:', e);
    }
  }
}

// In-memory cache with disk persistence
const sessions = new Map<string, ChatSession>();

export function getOrCreateSession(sessionId: string, metadata?: SessionData['metadata']): ChatSession {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, new ChatSession(sessionId, metadata));
  }
  const session = sessions.get(sessionId)!;
  session.lastAccessed = Date.now();
  return session;
}

export function clearSession(sessionId: string): void {
  sessions.delete(sessionId);
  try {
    const path = join(SESSIONS_DIR, `${sessionId}.json`);
    if (existsSync(path)) {
      require('fs').unlinkSync(path);
    }
  } catch (e) {
    console.error('[ChatSession] Failed to clear:', e);
  }
}

export function listSessions(): string[] {
  return Array.from(sessions.keys());
}

export function loadAllSessions(): void {
  try {
    const files = require('fs').readdirSync(SESSIONS_DIR);
    for (const file of files) {
      if (file.endsWith('.json')) {
        const sessionId = file.replace('.json', '');
        try {
          const session = new ChatSession(sessionId);
          // Check TTL
          if (Date.now() - session.lastAccessed < SESSION_TTL) {
            sessions.set(sessionId, session);
          } else {
            // Expired, delete
            clearSession(sessionId);
          }
        } catch (e) {
          console.error(`[ChatSession] Failed to load ${sessionId}:`, e);
        }
      }
    }
    console.log(`[ChatSession] Loaded ${sessions.size} sessions from disk`);
  } catch (e) {
    console.error('[ChatSession] Failed to load sessions:', e);
  }
}

export function cleanupExpiredSessions(): void {
  const now = Date.now();
  for (const [sessionId, session] of sessions) {
    if (now - session.lastAccessed > SESSION_TTL) {
      clearSession(sessionId);
    }
  }
}

// Load sessions on module import
loadAllSessions();

// Periodic cleanup every hour
setInterval(cleanupExpiredSessions, 60 * 60 * 1000);
