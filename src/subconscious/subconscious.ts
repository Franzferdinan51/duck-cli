/**
 * Duck Agent Subconscious
 * Claude Subconscious-style background agent WITH AI Council integration
 * WITHOUT Letta - uses Duck Agent's own memory, providers, and AI Council
 */

import { MemoryBridge } from './memory-bridge.js';
import { WhisperEngine } from './whisper-engine.js';
import { CouncilBridge, getCouncilBridge } from './council-bridge.js';
import { Whisper, SubconsciousConfig, SessionContext, CouncilDecision } from './types.js';

export class Subconscious {
  private memory: MemoryBridge;
  private whisper: WhisperEngine;
  private council: CouncilBridge;
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
    this.council = getCouncilBridge({
      enabled: true,
      autoDeliberate: true,
      threshold: 0.7 // Only deliberate for high-confidence whispers
    });
  }

  /**
   * Enable the subconscious
   */
  enable(): void {
    this.enabled = true;
    this.sessionStartTime = new Date();
    console.log('[Subconscious] Enabled - watching, learning, and deliberating');
    console.log('[Subconscious] AI Council bridge active for complex decisions');
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
    councilStats: { total: number; avgConfidence: number; avgDuration: number };
  }> {
    const memCount = await this.memory.count();
    const uptime = this.sessionStartTime 
      ? Date.now() - this.sessionStartTime.getTime() 
      : null;
    
    return {
      enabled: this.enabled,
      uptime,
      memoryCount: memCount,
      config: this.config,
      councilStats: this.council.getStats()
    };
  }

  /**
   * Get detailed statistics
   */
  async getStats(): Promise<{
    memoryStats: { total: number; oldest: Date | null; newest: Date | null };
    topicFrequencies: Map<string, number>;
    config: SubconsciousConfig;
    councilStats: { total: number; avgConfidence: number; avgDuration: number };
  }> {
    return {
      memoryStats: await this.memory.getStats(),
      topicFrequencies: this.whisper.getTopicFrequencies(),
      config: this.config,
      councilStats: this.council.getStats()
    };
  }

  /**
   * Generate whispers for current context - WITH AI COUNCIL DELIBERATION
   */
  async getWhispers(context: SessionContext): Promise<Whisper[]> {
    if (!this.enabled) return [];
    
    // Generate rule-based whispers first
    const whispers = await this.whisper.generateWhispers(context);
    
    // Check if any whisper should trigger council deliberation
    for (const whisper of whispers) {
      if (this.council.shouldDeliberate(whisper)) {
        console.log(`[Subconscious] High-confidence whisper: ${whisper.type} (${whisper.confidence})`);
        
        // Deliberate with AI Council
        const decision = await this.council.deliberate(
          whisper.message,
          context,
          whisper.type
        );
        
        if (decision) {
          // Add council verdict as a special whisper
          whispers.push({
            type: 'council',
            message: `COUNCIL: ${decision.verdict}`,
            confidence: decision.confidence,
            timestamp: new Date(),
            metadata: {
              reasoning: decision.reasoning,
              councilors: decision.councilors,
              duration: decision.duration
            }
          });
        }
      }
    }
    
    return whispers;
  }

  /**
   * Deliberate on a custom topic with the AI Council
   */
  async deliberateWithCouncil(topic: string, context?: SessionContext): Promise<CouncilDecision | null> {
    return this.council.deliberate(
      topic,
      context || {
        message: topic,
        sessionHistory: [],
        kairosStress: 0.5
      },
      'user_request'
    );
  }

  /**
   * Get recent council decisions
   */
  getRecentCouncilDecisions(limit = 5): CouncilDecision[] {
    return this.council.getRecentDecisions(limit);
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
    this.council.reset();
    this.sessionStartTime = this.enabled ? new Date() : null;
    console.log('[Subconscious] Reset complete');
  }

  /**
   * Process a session update - ENHANCED with council deliberation
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
