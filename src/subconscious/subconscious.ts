/**
 * Duck Agent Subconscious
 * Claude Subconscious-style background agent
 * WITHOUT Letta - uses Duck Agent's own memory and providers
 */

import { MemoryBridge } from './memory-bridge.js';
import { WhisperEngine } from './whisper-engine.js';
import { Whisper, SubconsciousConfig, SessionContext } from './types.js';

export class Subconscious {
  private memory: MemoryBridge;
  private whisper: WhisperEngine;
  private config: SubconsciousConfig;
  private enabled: boolean = false;
  private sessionStartTime: Date | null = null;

  constructor(config: Partial<SubconsciousConfig> = {}) {
    this.config = {
      enabled: true,
      whisperInterval: 5000,
      maxMemories: 1000,
      patternThreshold: 0.5,
      ...config
    };
    
    this.memory = new MemoryBridge(this.config);
    this.whisper = new WhisperEngine();
  }

  /**
   * Enable the subconscious
   */
  enable(): void {
    this.enabled = true;
    this.sessionStartTime = new Date();
    console.log('[Subconscious] Enabled - watching and learning');
  }

  /**
   * Disable the subconscious
   */
  disable(): void {
    this.enabled = false;
    console.log('[Subconscious] Disabled');
  }

  /**
   * Check if enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Get system status
   */
  async getStatus(): Promise<{
    enabled: boolean;
    uptime: number | null;
    memoryCount: number;
    config: SubconsciousConfig;
  }> {
    const memCount = await this.memory.count();
    const uptime = this.sessionStartTime 
      ? Date.now() - this.sessionStartTime.getTime() 
      : null;
    
    return {
      enabled: this.enabled,
      uptime,
      memoryCount: memCount,
      config: this.config
    };
  }

  /**
   * Get detailed statistics
   */
  async getStats(): Promise<{
    memoryStats: { total: number; oldest: Date | null; newest: Date | null };
    topicFrequencies: Map<string, number>;
    config: SubconsciousConfig;
  }> {
    return {
      memoryStats: await this.memory.getStats(),
      topicFrequencies: this.whisper.getTopicFrequencies(),
      config: this.config
    };
  }

  /**
   * Generate whispers for current context
   */
  async getWhispers(context: SessionContext): Promise<Whisper[]> {
    if (!this.enabled) return [];
    return this.whisper.generateWhispers(context);
  }

  /**
   * Remember something
   */
  async remember(content: string, context: string = '', importance: number = 0.5): Promise<void> {
    const memory = {
      id: `mem_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      content,
      context,
      timestamp: new Date(),
      importance
    };
    await this.memory.save(memory);
  }

  /**
   * Recall memories
   */
  async recall(query: string): Promise<void> {
    const memories = await this.memory.recall(query);
    if (memories.length > 0) {
      console.log(`[Subconscious] Remembered: ${memories.length} memories`);
    }
  }

  /**
   * Reset all learned data
   */
  async reset(): Promise<void> {
    await this.memory.clear();
    this.whisper.clearTopics();
    this.sessionStartTime = this.enabled ? new Date() : null;
    console.log('[Subconscious] Reset complete');
  }

  /**
   * Process a session update
   */
  async onSessionUpdate(context: SessionContext): Promise<Whisper[]> {
    return this.getWhispers(context);
  }
}

// Singleton instance
let instance: Subconscious | null = null;

export function getSubconscious(config?: Partial<SubconsciousConfig>): Subconscious {
  if (!instance) {
    instance = new Subconscious(config);
  }
  return instance;
}
