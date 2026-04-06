// @ts-nocheck
/**
 * duck-cli v3 - Chat Session
 * Manages conversation history and context window for a single user session.
 */

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

export class ChatSession {
  messages: ChatMessage[] = [];
  sessionId: string;
  createdAt: number;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
    this.createdAt = Date.now();
    this.messages = [];
  }

  addSystem(content: string): void {
    this.messages.unshift({ role: 'system', content, timestamp: Date.now() });
  }

  addUser(content: string): void {
    this.messages.push({ role: 'user', content, timestamp: Date.now() });
  }

  addAssistant(content: string): void {
    this.messages.push({ role: 'assistant', content, timestamp: Date.now() });
  }

  getMessages(): ChatMessage[] {
    return this.messages;
  }

  getContext(maxTokens: number): ChatMessage[] {
    // Rough estimate: ~4 chars per token
    const maxChars = maxTokens * 4;
    const systemMsgs: ChatMessage[] = [];
    const nonSystem: ChatMessage[] = [];

    for (const msg of this.messages) {
      if (msg.role === 'system') {
        systemMsgs.push(msg);
      } else {
        nonSystem.unshift(msg); // newest at end
      }
    }

    // Start with system, add non-system from oldest to newest
    const result: ChatMessage[] = [...systemMsgs];
    let totalChars = systemMsgs.reduce((sum, m) => sum + m.content.length, 0);

    for (const msg of nonSystem) {
      if (totalChars + msg.content.length <= maxChars) {
        result.push(msg);
        totalChars += msg.content.length;
      } else {
        // If single message exceeds budget, truncate it or skip
        break;
      }
    }

    return result;
  }

  clear(): void {
    const systemMsgs = this.messages.filter(m => m.role === 'system');
    this.messages = systemMsgs;
  }

  size(): number {
    return this.messages.length;
  }

  toJSON(): object {
    return {
      sessionId: this.sessionId,
      createdAt: this.createdAt,
      messages: this.messages,
    };
  }
}

// In-memory session store
const sessions = new Map();

export function getOrCreateSession(sessionId: string): ChatSession {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, new ChatSession(sessionId));
  }
  return sessions.get(sessionId);
}

export function clearSession(sessionId: string): void {
  sessions.delete(sessionId);
}

export function listSessions(): string[] {
  return Array.from(sessions.keys());
}
