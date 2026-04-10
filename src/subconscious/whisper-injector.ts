/**
 * 🦆 Duck Agent - Whisper Injection System
 * Real-time guidance injection inspired by Letta's whisper mode
 * Uses MiniMax/Kimi/LM Studio - NO Letta endpoints
 */

import { EventEmitter } from 'events';
import { SubconsciousClient } from './client.js';

export interface WhisperConfig {
  mode: 'whisper' | 'full' | 'off';
  maxWhisperLength: number;
  confidenceThreshold: number;
  injectBeforePrompt: boolean;
  injectBeforeTool: boolean;
}

export interface WhisperContext {
  sessionId: string;
  message: string;
  recentHistory: string[];
  currentTool?: string;
  toolParams?: any;
}

export interface WhisperResult {
  whisper: string | null;
  confidence: number;
  source: 'memory_blocks' | 'session_analysis' | 'pattern_match' | 'none' | 'full';
  timestamp: number;
}

/**
 * Whisper Injector
 * Injects guidance before prompts and tool executions
 */
export class WhisperInjector extends EventEmitter {
  private client: SubconsciousClient;
  private config: WhisperConfig;
  private lastWhisper: string | null = null;
  private whisperHistory: string[] = [];

  constructor(config: Partial<WhisperConfig> = {}) {
    super();
    this.client = new SubconsciousClient();
    this.config = {
      mode: config.mode || 'whisper',
      maxWhisperLength: config.maxWhisperLength || 500,
      confidenceThreshold: config.confidenceThreshold || 0.7,
      injectBeforePrompt: config.injectBeforePrompt !== false,
      injectBeforeTool: config.injectBeforeTool !== false
    };
  }

  /**
   * Get whisper before user prompt
   */
  async getPromptWhisper(context: WhisperContext): Promise<WhisperResult> {
    if (this.config.mode === 'off') {
      return { whisper: null, confidence: 0, source: 'none', timestamp: Date.now() };
    }

    try {
      // Check if daemon is running
      const isRunning = await this.client.ping();
      if (!isRunning) {
        return { whisper: null, confidence: 0, source: 'none', timestamp: Date.now() };
      }

      // Get guidance from memory blocks
      const guidance = await this.fetchGuidance();

      // Get contextual whisper
      const whisper = await this.fetchWhisper(context);

      // Combine guidance + whisper
      let combined = '';
      if (guidance) combined += guidance + '\n\n';
      if (whisper) combined += whisper;

      if (!combined.trim()) {
        return { whisper: null, confidence: 0, source: 'none', timestamp: Date.now() };
      }

      // Truncate if too long
      if (combined.length > this.config.maxWhisperLength) {
        combined = combined.slice(0, this.config.maxWhisperLength) + '...';
      }

      // Avoid repeating the same whisper
      if (this.lastWhisper === combined) {
        return { whisper: null, confidence: 0, source: 'none', timestamp: Date.now() };
      }

      this.lastWhisper = combined;
      this.whisperHistory.push(combined);

      // Keep history manageable
      if (this.whisperHistory.length > 10) {
        this.whisperHistory.shift();
      }

      const result: WhisperResult = {
        whisper: combined,
        confidence: this.calculateConfidence(combined),
        source: guidance && whisper ? 'full' : guidance ? 'memory_blocks' : 'session_analysis',
        timestamp: Date.now()
      };

      this.emit('whisper', result);
      return result;

    } catch (e) {
      console.error('[WhisperInjector] Error:', e);
      return { whisper: null, confidence: 0, source: 'none', timestamp: Date.now() };
    }
  }

  /**
   * Get whisper before tool execution
   */
  async getToolWhisper(toolName: string, params: any, context: WhisperContext): Promise<WhisperResult> {
    if (this.config.mode === 'off' || !this.config.injectBeforeTool) {
      return { whisper: null, confidence: 0, source: 'none', timestamp: Date.now() };
    }

    // Check for tool-specific guidance
    const toolGuidance = await this.getToolSpecificGuidance(toolName, params);
    if (toolGuidance) {
      return {
        whisper: toolGuidance,
        confidence: 0.8,
        source: 'pattern_match',
        timestamp: Date.now()
      };
    }

    return { whisper: null, confidence: 0, source: 'none', timestamp: Date.now() };
  }

  /**
   * Format whisper for injection into context
   */
  formatWhisper(whisper: string): string {
    return `\n🧠 [Sub-Conscious] ${whisper}\n`;
  }

  /**
   * Clear whisper history
   */
  clearHistory(): void {
    this.whisperHistory = [];
    this.lastWhisper = null;
  }

  private async fetchGuidance(): Promise<string | null> {
    try {
      const response = await fetch(`${this.client['baseUrl']}/guidance`);
      if (!response.ok) return null;
      const data = await response.json();
      return data.guidance || null;
    } catch {
      return null;
    }
  }

  private async fetchWhisper(context: WhisperContext): Promise<string | null> {
    try {
      const response = await fetch(`${this.client['baseUrl']}/whisper`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: context.message,
          recentTopics: context.recentHistory,
          sessionHistory: context.recentHistory
        })
      });

      if (!response.ok) return null;
      const data = await response.json();
      return data.whisper || null;
    } catch {
      return null;
    }
  }

  private async getToolSpecificGuidance(toolName: string, params: any): Promise<string | null> {
    // Check memory blocks for tool-specific patterns
    try {
      const response = await fetch(`${this.client['baseUrl']}/blocks/codebase_patterns`);
      if (!response.ok) return null;
      const data = await response.json();

      if (data.content && data.content.includes(toolName)) {
        // Extract relevant guidance
        const lines = data.content.split('\n');
        for (const line of lines) {
          if (line.includes(toolName) && line.includes('⚠️')) {
            return line.trim();
          }
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  private calculateConfidence(whisper: string): number {
    // Simple confidence based on whisper length and content
    let confidence = 0.5;

    // Longer whispers from analysis have higher confidence
    if (whisper.length > 200) confidence += 0.2;

    // Whispers with specific guidance markers
    if (whisper.includes('⚠️') || whisper.includes('💡')) confidence += 0.1;

    // Whispers referencing past sessions
    if (whisper.includes('Previously') || whisper.includes('Last time')) confidence += 0.1;

    return Math.min(confidence, 1.0);
  }
}

export default WhisperInjector;
