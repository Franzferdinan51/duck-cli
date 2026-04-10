/**
 * LCM-Enhanced Chat Session
 * Wraps ChatSession with Lossless Context Management
 */

import { ChatSession, ChatMessage, SessionData } from '../agent/chat-session.js';
import { 
  assembleContext, 
  storeMessage,
  getOrCreateConversation,
  getLCMStats,
  grepSummaries,
  archiveConversation,
  LCM_CONFIG,
  isLCMAvailable 
} from './lcm-engine.js';

export interface LCMLoadedContext {
  messages: ChatMessage[];
  hasMoreHistory: boolean;
  summaryCount: number;
  freshTailCount: number;
}

/**
 * LCM-Enhanced Session
 * Maintains full conversation history in LCM while providing
 * intelligent context assembly for the model
 */
export class LCMSession {
  private session: ChatSession;
  private conversationId: number = 0;
  private useLCM: boolean;

  constructor(sessionId: string, metadata?: SessionData['metadata']) {
    this.session = new ChatSession(sessionId, metadata);
    this.useLCM = LCM_CONFIG.enabled && isLCMAvailable();
    
    if (this.useLCM) {
      this.conversationId = getOrCreateConversation(sessionId);
      console.log(`[LCMSession] Initialized for ${sessionId}, conversation=${this.conversationId}`);
    }
  }

  /**
   * Add system message
   */
  addSystem(content: string): void {
    this.session.addSystem(content);
  }

  /**
   * Add user message (with LCM persistence)
   */
  addUser(content: string): void {
    // Add to regular session
    this.session.addUser(content);

    // Persist to LCM
    if (this.useLCM && this.conversationId) {
      storeMessage(this.conversationId, {
        role: 'user',
        content,
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Add assistant message (with LCM persistence)
   */
  addAssistant(content: string): void {
    // Add to regular session
    this.session.addAssistant(content);

    // Persist to LCM
    if (this.useLCM && this.conversationId) {
      storeMessage(this.conversationId, {
        role: 'assistant',
        content,
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Add tool result (with LCM persistence)
   */
  addToolResult(toolName: string, result: string): void {
    // Add to regular session
    this.session.addToolResult(toolName, result);

    // Persist to LCM
    if (this.useLCM && this.conversationId) {
      storeMessage(this.conversationId, {
        role: 'system',
        content: `[Tool ${toolName} result]: ${result}`,
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Get context for the model
   * Uses LCM to assemble summaries + fresh tail
   */
  getContext(maxTokens: number = 8000): ChatMessage[] {
    // If LCM disabled, use regular session
    if (!this.useLCM || !this.conversationId) {
      return this.session.getContext(maxTokens);
    }

    const lcmContext = assembleContext(this.conversationId, maxTokens);

    // Convert summaries to system messages
    const summaryMessages: ChatMessage[] = lcmContext.summaries.map(s => ({
      role: 'system',
      content: `[Summary d${s.depth}]: ${s.content}`,
      timestamp: Date.now(),
    }));

    // Combine: summaries first, then fresh messages
    return [...summaryMessages, ...lcmContext.messages];
  }

  /**
   * Get raw messages (for debugging)
   */
  getMessages(): ChatMessage[] {
    return this.session.getMessages();
  }

  /**
   * Get LCM stats
   */
  getStats(): {
    messageCount: number;
    summaryCount: number;
    totalTokens: number;
    dbSize: number;
  } | null {
    if (!this.useLCM) return null;
    return getLCMStats(this.session.sessionId);
  }

  /**
   * Search history using LCM grep
   */
  searchHistory(query: string): string[] {
    if (!this.useLCM || !this.conversationId) {
      // Fallback: search in-memory messages
      return this.session.getMessages()
        .filter(m => m.content.toLowerCase().includes(query.toLowerCase()))
        .map(m => m.content);
    }

    const summaries = grepSummaries(this.conversationId, query);
    return summaries.map(s => s.content);
  }

  /**
   * Clear session (but keep LCM history)
   */
  clear(): void {
    this.session.clear();
  }

  /**
   * Archive conversation (for /reset)
   */
  archive(): void {
    if (this.useLCM) {
      archiveConversation(this.session.sessionId);
    }
  }

  size(): number {
    return this.session.size();
  }

  get sessionId(): string {
    return this.session.sessionId;
  }
}

// Session cache
const sessions = new Map<string, LCMSession>();

export function getOrCreateLCMSession(
  sessionId: string,
  metadata?: SessionData['metadata']
): LCMSession {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, new LCMSession(sessionId, metadata));
  }
  return sessions.get(sessionId)!;
}

export function clearLCMSession(sessionId: string): void {
  sessions.delete(sessionId);
}