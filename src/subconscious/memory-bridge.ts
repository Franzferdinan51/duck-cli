/**
 * Duck Agent Subconscious - Memory Bridge
 * Connects to Duck Agent's native memory system
 * NO external Letta dependency
 */

import { Memory, SubconsciousConfig } from './types.js';

export class MemoryBridge {
  private config: SubconsciousConfig;
  private memories: Map<string, Memory> = new Map();

  constructor(config: Partial<SubconsciousConfig> = {}) {
    this.config = {
      enabled: true,
      whisperInterval: 5000,
      maxMemories: 1000,
      patternThreshold: 0.5,
      ...config
    };
  }

  /**
   * Save a memory to Duck Agent's native storage
   */
  async save(memory: Memory): Promise<void> {
    this.memories.set(memory.id, memory);
    console.log(`[MemoryBridge] Saved memory: ${memory.id}`);
  }

  /**
   * Search memories by query
   */
  async recall(query: string): Promise<Memory[]> {
    const results: Memory[] = [];
    const lowerQuery = query.toLowerCase();
    
    for (const memory of this.memories.values()) {
      if (memory.content.toLowerCase().includes(lowerQuery) ||
          memory.context.toLowerCase().includes(lowerQuery)) {
        results.push(memory);
      }
    }
    
    console.log(`[MemoryBridge] Recalled ${results.length} memories for: ${query}`);
    return results;
  }

  /**
   * Get all memories
   */
  async getAll(): Promise<Memory[]> {
    return Array.from(this.memories.values());
  }

  /**
   * Forget a specific memory
   */
  async forget(memoryId: string): Promise<void> {
    this.memories.delete(memoryId);
    console.log(`[MemoryBridge] Forgot: ${memoryId}`);
  }

  /**
   * Clear all memories
   */
  async clear(): Promise<void> {
    this.memories.clear();
    console.log(`[MemoryBridge] Cleared all memories`);
  }

  /**
   * Get memory count
   */
  async count(): Promise<number> {
    return this.memories.size;
  }

  /**
   * Get statistics
   */
  async getStats(): Promise<{ total: number; oldest: Date | null; newest: Date | null }> {
    const memories = Array.from(this.memories.values());
    return {
      total: memories.length,
      oldest: memories.length > 0 ? new Date(Math.min(...memories.map(m => m.timestamp.getTime()))) : null,
      newest: memories.length > 0 ? new Date(Math.max(...memories.map(m => m.timestamp.getTime()))) : null
    };
  }
}
