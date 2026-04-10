/**
 * LCM Compaction Service
 * Handles summarization of message chunks into DAG nodes
 */

import { 
  storeMessage, 
  getMessages, 
  createLeafSummary, 
  createCondensedSummary,
  shouldCompact,
  getMessagesForCompaction,
  LCMMessage, 
  LCM_CONFIG 
} from './lcm-engine.js';
import { ChatMessage } from '../agent/chat-session.js';

/**
 * Summarization result
 */
export interface SummarizationResult {
  summaryId: number;
  content: string;
  tokenCount: number;
  sourceIds: number[];
}

/**
 * Compaction Service
 * Creates summaries from messages and condensed summaries from summaries
 */
export class LCMCompactionService {
  /**
   * Check if compaction is needed and run it
   */
  checkAndCompact(conversationId: number, maxTokens: number): boolean {
    // Check if we need compaction
    if (!shouldCompact(conversationId, maxTokens)) return false;

    console.log(`[LCM Compaction] Running compaction for conversation ${conversationId}`);

    // Get messages that need compaction
    const messages = getMessagesForCompaction(conversationId);
    if (messages.length < LCM_CONFIG.minFanoutLeaf) {
      console.log(`[LCM Compaction] Not enough messages to compact (${messages.length} < ${LCM_CONFIG.minFanoutLeaf})`);
      return false;
    }

    // Create leaf summaries
    this.compactMessages(conversationId, messages);

    // Check if we need to create condensed summaries
    this.checkAndCondense(conversationId);

    return true;
  }

  /**
   * Compact a batch of messages into a leaf summary
   */
  private compactMessages(conversationId: number, messages: LCMMessage[]): void {
    // Group messages into chunks
    const chunks = this.chunkMessages(messages);

    for (const chunk of chunks) {
      if (chunk.length < LCM_CONFIG.minFanoutLeaf) {
        // Not enough messages for a summary
        continue;
      }

      // Generate summary (placeholder - would call LLM in production)
      const summary = this.summarizeMessages(chunk);

      // Store summary
      const summaryId = createLeafSummary(
        conversationId,
        chunk.map(m => m.id),
        summary.content
      );

      console.log(`[LCM Compaction] Created leaf summary ${summaryId} from ${chunk.length} messages`);
    }
  }

  /**
   * Check if condensed summaries are needed and create them
   */
  private checkAndCondense(conversationId: number): void {
    // This is a simplified version - full implementation would track DAG depth
    console.log(`[LCM Compaction] Checking for condensation opportunities`);
  }

  /**
   * Chunk messages for summarization
   */
  private chunkMessages(messages: LCMMessage[]): LCMMessage[][] {
    const chunks: LCMMessage[][] = [];
    let currentChunk: LCMMessage[] = [];
    let currentTokens = 0;

    for (const message of messages) {
      if (currentTokens + message.tokenCount > LCM_CONFIG.leafChunkTokens) {
        // Start new chunk
        if (currentChunk.length >= LCM_CONFIG.minFanoutLeaf) {
          chunks.push(currentChunk);
        }
        currentChunk = [message];
        currentTokens = message.tokenCount;
      } else {
        currentChunk.push(message);
        currentTokens += message.tokenCount;
      }
    }

    // Add final chunk if it has enough messages
    if (currentChunk.length >= LCM_CONFIG.minFanoutLeaf) {
      chunks.push(currentChunk);
    }

    return chunks;
  }

  /**
   * Summarize a chunk of messages
   * In production, this would call an LLM
   */
  private summarizeMessages(messages: LCMMessage[]): SummarizationResult {
    // Create a simple summary (placeholder for LLM call)
    const content = messages.map(m => {
      const prefix = m.role === 'user' ? 'User' : m.role === 'assistant' ? 'Assistant' : 'System';
      return `${prefix}: ${m.content.substring(0, 100)}${m.content.length > 100 ? '...' : ''}`;
    }).join('\n');

    const summaryContent = `[Summary of ${messages.length} messages] ${content.substring(0, 200)}...`;

    return {
      summaryId: 0, // Will be set by createLeafSummary
      content: summaryContent,
      tokenCount: Math.ceil(summaryContent.length / 4),
      sourceIds: messages.map(m => m.id),
    };
  }

  /**
   * Condense summaries into higher-level summary
   */
  private condenseSummaries(conversationId: number, depth: number, summaries: any[]): void {
    // Group summaries into chunks
    const chunks = this.chunkSummaries(summaries);

    for (const chunk of chunks) {
      if (chunk.length < LCM_CONFIG.minFanoutCondensed) {
        continue;
      }

      // Generate condensed summary (placeholder)
      const condensed = this.summarizeSummaries(chunk);

      // Store condensed summary
      const summaryId = createCondensedSummary(
        conversationId,
        depth,
        chunk.map((s: any) => s.id),
        condensed.content
      );

      console.log(`[LCM Compaction] Created condensed summary ${summaryId} at depth ${depth}`);
    }
  }

  /**
   * Chunk summaries for condensation
   */
  private chunkSummaries(summaries: any[]): any[][] {
    const chunks: any[][] = [];
    let currentChunk: any[] = [];

    for (const summary of summaries) {
      currentChunk.push(summary);

      if (currentChunk.length >= LCM_CONFIG.minFanoutCondensed) {
        chunks.push(currentChunk);
        currentChunk = [];
      }
    }

    if (currentChunk.length >= LCM_CONFIG.minFanoutCondensed) {
      chunks.push(currentChunk);
    }

    return chunks;
  }

  /**
   * Summarize a chunk of summaries
   */
  private summarizeSummaries(summaries: any[]): SummarizationResult {
    const combined = summaries.map((s: any) => s.content).join('\n\n');
    const condensed = `[Condensed summary of ${summaries.length} summaries] ${combined.substring(0, 300)}...`;

    return {
      summaryId: 0,
      content: condensed,
      tokenCount: Math.ceil(condensed.length / 4),
      sourceIds: summaries.map((s: any) => s.id),
    };
  }
}

// Singleton
let service: LCMCompactionService | null = null;

export function getCompactionService(): LCMCompactionService {
  if (!service) {
    service = new LCMCompactionService();
  }
  return service;
}