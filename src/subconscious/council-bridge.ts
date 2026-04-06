/**
 * Duck Agent Subconscious - AI Council Integration
 * Brings in council deliberation for complex subconscious decisions
 */

import { SubconsciousConfig, Whisper, CouncilDecision, SessionContext } from './types.js';

interface CouncilBridgeConfig {
  enabled: boolean;
  autoDeliberate: boolean;
  threshold: number; // Confidence threshold to trigger council
  councilUrl: string;
  mode: 'deliberation' | 'legislative' | 'inquiry';
  timeout: number; // ms
}

const DEFAULT_COUNCIL_CONFIG: CouncilBridgeConfig = {
  enabled: true,
  autoDeliberate: true,
  threshold: 0.7, // Only deliberate for high-confidence triggers
  councilUrl: process.env.COUNCIL_URL || 'http://localhost:3001/api/deliberate',
  mode: 'deliberation',
  timeout: 30000
};

export class CouncilBridge {
  private config: CouncilBridgeConfig;
  private recentDecisions: CouncilDecision[] = [];
  private deliberationCount = 0;

  constructor(config: Partial<CouncilBridgeConfig> = {}) {
    this.config = { ...DEFAULT_COUNCIL_CONFIG, ...config };
  }

  /**
   * Check if we should deliberate on a whisper
   */
  shouldDeliberate(whisper: Whisper): boolean {
    if (!this.config.enabled || !this.config.autoDeliberate) {
      return false;
    }
    return whisper.confidence >= this.config.threshold;
  }

  /**
   * Deliberate with the AI Council on a complex issue
   */
  async deliberate(
    topic: string,
    context: SessionContext,
    whisperType: string
  ): Promise<CouncilDecision | null> {
    if (!this.config.enabled) {
      return null;
    }

    console.log(`[CouncilBridge] Deliberating on: ${whisperType} - "${topic.substring(0, 50)}..."`);

    try {
      const startTime = Date.now();
      
      // Build council prompt
      const prompt = this.buildCouncilPrompt(topic, context, whisperType);
      
      // Call AI Council API
      const response = await fetch(this.config.councilUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: prompt,
          mode: this.config.mode
        }),
        signal: AbortSignal.timeout(this.config.timeout)
      });

      if (!response.ok) {
        throw new Error(`Council API error: ${response.status}`);
      }

      const data = await response.json();
      const duration = Date.now() - startTime;

      const decision: CouncilDecision = {
        topic,
        verdict: data.verdict || this.synthesizeVerdict(data),
        confidence: data.confidence || whisperType === 'pattern' ? 0.85 : 0.75,
        reasoning: data.reasoning || this.extractReasoning(data),
        councilors: this.extractCouncilors(data),
        duration,
        timestamp: new Date()
      };

      this.recentDecisions.push(decision);
      this.deliberationCount++;
      
      // Keep last 10 decisions
      if (this.recentDecisions.length > 10) {
        this.recentDecisions.shift();
      }

      console.log(`[CouncilBridge] Verdict: ${decision.verdict} (${decision.confidence}% confidence)`);
      return decision;

    } catch (error) {
      console.error(`[CouncilBridge] Deliberation failed: ${error}`);
      return null;
    }
  }

  /**
   * Build a rich prompt for the council
   */
  private buildCouncilPrompt(topic: string, context: SessionContext, whisperType: string): string {
    const timeHint = context.time 
      ? `User time: ${context.time.toLocaleTimeString()}`
      : '';
    
    const sessionHint = context.sessionHistory 
      ? `${context.sessionHistory.length} previous messages in session`
      : 'Fresh session';

    return `SUB-CONSCIOUS ANALYSIS REQUEST
Type: ${whisperType}
Issue: ${topic}

Context:
- ${timeHint}
- ${sessionHint}
- Kairos stress: ${context.kairosStress || 'unknown'}
- Previous session: ${context.previousSessionEnded || 'normal'}

The sub-conscious has detected something important. Provide a brief, actionable verdict (1-2 sentences) on how to respond to the user. Focus on tone, approach, and any specific suggestions.`;
  }

  /**
   * Synthesize verdict from council response
   */
  private synthesizeVerdict(data: any): string {
    if (typeof data.verdict === 'string') {
      return data.verdict;
    }
    
    // Try to extract from councilor responses
    const councilors = data.councilors || {};
    const verdicts = Object.values(councilors)
      .filter(v => typeof v === 'string')
      .slice(0, 3);
    
    if (verdicts.length > 0) {
      return verdicts.join(' | ');
    }
    
    return 'Proceed with standard approach';
  }

  /**
   * Extract reasoning from response
   */
  private extractReasoning(data: any): string {
    if (data.reasoning) return data.reasoning;
    
    const councilors = data.councilors || {};
    const reasons = Object.entries(councilors)
      .filter(([k, v]) => typeof v === 'string')
      .map(([name, opinion]) => `${name}: ${(opinion as string).substring(0, 100)}`)
      .join('; ');
    
    return reasons || 'No detailed reasoning available';
  }

  /**
   * Extract councilor list
   */
  private extractCouncilors(data: any): string[] {
    if (data.councilors && Array.isArray(data.councilors)) {
      return data.councilors.map((c: any) => c.name || c);
    }
    if (data.councilors && typeof data.councilors === 'object') {
      return Object.keys(data.councilors);
    }
    return ['Speaker', 'Technocrat', 'Ethicist', 'Pragmatist', 'Skeptic'];
  }

  /**
   * Get recent decisions
   */
  getRecentDecisions(limit = 5): CouncilDecision[] {
    return this.recentDecisions.slice(-limit);
  }

  /**
   * Get deliberation stats
   */
  getStats(): { total: number; avgConfidence: number; avgDuration: number } {
    if (this.recentDecisions.length === 0) {
      return { total: 0, avgConfidence: 0, avgDuration: 0 };
    }
    
    const total = this.recentDecisions.length;
    const avgConfidence = this.recentDecisions.reduce((sum, d) => sum + d.confidence, 0) / total;
    const avgDuration = this.recentDecisions.reduce((sum, d) => sum + d.duration, 0) / total;
    
    return { total, avgConfidence, avgDuration };
  }

  /**
   * Update config
   */
  updateConfig(config: Partial<CouncilBridgeConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Reset
   */
  reset(): void {
    this.recentDecisions = [];
    this.deliberationCount = 0;
  }
}

// Singleton instance
let instance: CouncilBridge | null = null;

export function getCouncilBridge(config?: Partial<CouncilBridgeConfig>): CouncilBridge {
  if (!instance) {
    instance = new CouncilBridge(config);
  }
  return instance;
}
