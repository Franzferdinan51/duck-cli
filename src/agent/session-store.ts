/**
 * Duck Agent - Session Store (Pure JS Version)
 * JSON-file-backed session history
 * Works on any platform including Android/Termux
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

export interface SessionMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  toolName?: string;
  toolResult?: string;
  timestamp: number;
  tokens?: number;
  cost?: number;
}

export interface SessionSummary {
  id: string;
  sessionId: string;
  summary: string;
  topic: string;
  outcome: 'success' | 'partial' | 'failed' | 'ongoing';
  messageCount: number;
  duration: number;
  firstMessage: string;
  lastMessage: string;
  timestamp: number;
}

interface StoredMessage {
  id: string;
  sessionId: string;
  role: string;
  content: string;
  toolName?: string;
  toolResult?: string;
  timestamp: number;
  tokens?: number;
  cost?: number;
}

interface StoredSummary {
  id: string;
  sessionId: string;
  summary: string;
  topic: string;
  outcome: string;
  messageCount: number;
  duration: number;
  firstMessage: string;
  lastMessage: string;
  timestamp: number;
}

interface SessionData {
  messages: StoredMessage[];
  summaries: StoredSummary[];
}

export class SessionStore {
  private dataPath: string;
  private data: SessionData = { messages: [], summaries: [] };

  constructor(memoryDir?: string) {
    const dir = memoryDir || join(homedir(), '.duck', 'memory');
    mkdirSync(dir, { recursive: true });
    this.dataPath = join(dir, 'sessions.json');
    this.load();
  }

  private load(): void {
    try {
      if (existsSync(this.dataPath)) {
        const raw = readFileSync(this.dataPath, 'utf-8');
        const parsed = JSON.parse(raw);
        this.data = {
          messages: Array.isArray(parsed?.messages) ? parsed.messages : [],
          summaries: Array.isArray(parsed?.summaries) ? parsed.summaries : []
        };
      }
    } catch (e) {
      this.data = { messages: [], summaries: [] };
    }
  }

  private save(): void {
    try {
      writeFileSync(this.dataPath, JSON.stringify(this.data, null, 2));
    } catch (e) {
      console.error('Failed to save sessions:', e);
    }
  }

  addMessage(msg: Omit<SessionMessage, 'id'>): string {
    const id = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const stored: StoredMessage = {
      ...msg,
      id,
      content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
    };
    
    this.data.messages.push(stored);
    this.upsertSummary(msg.sessionId);
    this.save();
    return id;
  }

  private upsertSummary(sessionId: string): void {
    const sessionMsgs = this.data.messages.filter(m => m.sessionId === sessionId);
    if (sessionMsgs.length === 0) return;

    const first = sessionMsgs[0];
    const last = sessionMsgs[sessionMsgs.length - 1];
    const topic = this.extractTopic(first.content);
    
    const now = Date.now();
    const duration = last.timestamp - first.timestamp;
    const isActive = now - last.timestamp < 5 * 60 * 1000;
    const failedCount = sessionMsgs.filter(m => m.content.includes('❌') || m.content.includes('error')).length;
    const successCount = sessionMsgs.filter(m => m.role === 'assistant' && !m.content.includes('❌') && !m.content.includes('error')).length;

    let outcome: SessionSummary['outcome'] = 'ongoing';
    if (!isActive) {
      if (failedCount > successCount * 2) outcome = 'failed';
      else if (successCount > 0) outcome = 'success';
      else outcome = 'partial';
    }

    const existing = this.data.summaries.findIndex(s => s.sessionId === sessionId);
    const firstContent = typeof first.content === 'string' ? first.content : JSON.stringify(first.content ?? '') || '';
    const lastContent = typeof last.content === 'string' ? last.content : JSON.stringify(last.content ?? '') || '';

    const summary: StoredSummary = {
      id: existing >= 0 ? this.data.summaries[existing].id : `sum_${Date.now()}`,
      sessionId,
      summary: '',
      topic,
      outcome,
      messageCount: sessionMsgs.length,
      duration,
      firstMessage: String(firstContent).slice(0, 200),
      lastMessage: String(lastContent).slice(0, 200),
      timestamp: now
    };

    if (existing >= 0) {
      this.data.summaries[existing] = summary;
    } else {
      this.data.summaries.push(summary);
    }
  }

  private extractTopic(content: string): string {
    const words = content.toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 3)
      .slice(0, 5);
    return words.join(' ') || 'general';
  }

  search(query: string, limit: number = 20, sessionId?: string): SessionMessage[] {
    const q = query.toLowerCase();
    let results = this.data.messages.filter(m => {
      const content = typeof m.content === 'string' ? m.content : JSON.stringify(m.content);
      return content.toLowerCase().includes(q);
    });

    if (sessionId) {
      results = results.filter(m => m.sessionId === sessionId);
    }

    results.sort((a, b) => b.timestamp - a.timestamp);
    return results.slice(0, limit).map(this.mapRow);
  }

  getRecentSessions(limit: number = 10): { sessionId: string; lastMessage: string; timestamp: number; messageCount: number; topic: string }[] {
    return this.data.summaries
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit)
      .map(s => ({
        sessionId: s.sessionId,
        lastMessage: s.lastMessage,
        timestamp: s.timestamp,
        messageCount: s.messageCount,
        topic: s.topic
      }));
  }

  getSessionMessages(sessionId: string, limit: number = 100, offset: number = 0): SessionMessage[] {
    return this.data.messages
      .filter(m => m.sessionId === sessionId)
      .sort((a, b) => a.timestamp - b.timestamp)
      .slice(offset, offset + limit)
      .map(this.mapRow);
  }

  getSessionContext(sessionId: string, maxMessages: number = 50): SessionMessage[] {
    return this.data.messages
      .filter(m => m.sessionId === sessionId)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, maxMessages)
      .sort((a, b) => a.timestamp - b.timestamp)
      .map(this.mapRow);
  }

  private mapRow = (r: StoredMessage): SessionMessage => ({
    id: r.id,
    sessionId: r.sessionId,
    role: r.role as SessionMessage['role'],
    content: r.content,
    toolName: r.toolName,
    toolResult: r.toolResult,
    timestamp: r.timestamp,
    tokens: r.tokens,
    cost: r.cost
  });

  endSession(sessionId: string, outcome: SessionSummary['outcome'] = 'success'): void {
    const idx = this.data.summaries.findIndex(s => s.sessionId === sessionId);
    if (idx >= 0) {
      this.data.summaries[idx].outcome = outcome;
      this.save();
    }
  }

  updateSummary(sessionId: string, summary: string): void {
    const idx = this.data.summaries.findIndex(s => s.sessionId === sessionId);
    if (idx >= 0) {
      this.data.summaries[idx].summary = summary;
      this.save();
    }
  }

  getSession(id: string): SessionSummary | null {
    const s = this.data.summaries.find(s => s.sessionId === id);
    return s ? { ...s, outcome: s.outcome as SessionSummary['outcome'] } : null;
  }

  listAllSessions(limit: number = 50): SessionSummary[] {
    return this.data.summaries
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit)
      .map(s => ({ ...s, outcome: s.outcome as SessionSummary['outcome'] }));
  }

  generateSessionSummary(sessionId: string): string {
    const msgs = this.getSessionMessages(sessionId, 20);
    if (msgs.length === 0) return 'Empty session';
    const userMsgs = msgs.filter(m => m.role === 'user').map(m => m.content);
    return `Goal: ${(userMsgs[0] || '').slice(0, 100)}\nOutcome: ${(msgs.filter(m => m.role === 'assistant').pop()?.content || '').slice(0, 150)}`;
  }

  stats(): { totalSessions: number; totalMessages: number; activeSessions: number; avgSessionLength: number } {
    const now = Date.now();
    const fiveMinAgo = now - 5 * 60 * 1000;
    const active = this.data.summaries.filter(s => {
      const lastMsg = this.data.messages.find(m => m.sessionId === s.sessionId);
      return lastMsg && lastMsg.timestamp > fiveMinAgo;
    }).length;

    return {
      totalSessions: this.data.summaries.length,
      totalMessages: this.data.messages.length,
      activeSessions: active,
      avgSessionLength: Math.round(this.data.messages.length / Math.max(1, this.data.summaries.length))
    };
  }

  close(): void {
    // No-op for JSON file storage
  }
}

export default SessionStore;
