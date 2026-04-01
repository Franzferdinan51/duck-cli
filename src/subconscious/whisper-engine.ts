/**
 * Duck Agent Subconscious - Whisper Engine
 * Rule-based triggers for generating pre-action insights
 * NO autonomous LLM loops - just rules
 */

import { Whisper, SessionContext } from './types.js';

export class WhisperEngine {
  // Trigger confidence thresholds
  private triggers = {
    keyword: 0.2,
    pattern: 0.75,
    time: 0.65,
    frustration: 0.70,
    kairos: 0.80
  };

  // Frustration keywords
  private frustrationKeywords = [
    'stuck', 'frustrated', 'not working', 'broken', 'fail',
    'fucking', 'shit', 'damn', 'sucks', 'hate', 'terrible'
  ];

  // Topic tracking
  private recentTopics: Map<string, number> = new Map();

  /**
   * Generate whispers based on session context
   */
  async generateWhispers(context: SessionContext): Promise<Whisper[]> {
    const whispers: Whisper[] = [];

    // 1. Keyword trigger - frustration in message
    if (context.message) {
      const lowerMessage = context.message.toLowerCase();
      for (const keyword of this.frustrationKeywords) {
        if (lowerMessage.includes(keyword)) {
          whispers.push({
            type: 'keyword',
            message: `User mentioned "${keyword}" - be patient, empathetic, and helpful`,
            confidence: this.triggers.keyword,
            timestamp: new Date()
          });
          break; // Only one keyword whisper per message
        }
      }

      // Track topics
      this.trackTopic(context.message);
    }

    // 2. Pattern trigger - topic discussed 3+ times
    if (context.sessionHistory && context.sessionHistory.length >= 3) {
      const topicCount = this.countRecentTopics();
      if (topicCount >= 3) {
        whispers.push({
          type: 'pattern',
          message: 'Topic discussed multiple times - consider providing a summary or next step',
          confidence: this.triggers.pattern,
          timestamp: new Date()
        });
      }
    }

    // 3. Time trigger - historically challenging hours
    if (context.time) {
      const hour = context.time.getHours();
      // Late night (10pm - 6am) = user may be tired
      if (hour >= 22 || hour < 6) {
        whispers.push({
          type: 'time',
          message: 'Late night hours - user may be tired, be concise and patient',
          confidence: this.triggers.time,
          timestamp: new Date()
        });
      }
    }

    // 4. Frustration trigger - previous session ended rough
    if (context.previousSessionEnded === 'bad') {
      whispers.push({
        type: 'frustration',
        message: 'Previous session ended badly - start fresh, apologize if needed',
        confidence: this.triggers.frustration,
        timestamp: new Date()
      });
    }

    // 5. KAIROS stress trigger - high stress levels
    if (context.kairosStress !== undefined && context.kairosStress > 0.7) {
      whispers.push({
        type: 'kairos',
        message: 'High stress detected - be extra supportive, suggest breaks',
        confidence: this.triggers.kairos,
        timestamp: new Date()
      });
    }

    return whispers;
  }

  /**
   * Track topics mentioned in messages
   */
  private trackTopic(message: string): void {
    // Simple word tracking - could be enhanced with NLP
    const words = message.toLowerCase().split(/\s+/);
    for (const word of words) {
      if (word.length > 4) {
        const count = this.recentTopics.get(word) || 0;
        this.recentTopics.set(word, count + 1);
      }
    }
    
    // Prune old entries (keep last 50 topics)
    if (this.recentTopics.size > 50) {
      const entries = Array.from(this.recentTopics.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 50);
      this.recentTopics = new Map(entries);
    }
  }

  /**
   * Count how many times recently discussed topics appear
   */
  private countRecentTopics(): number {
    let count = 0;
    for (const freq of this.recentTopics.values()) {
      if (freq >= 2) count++;
    }
    return count;
  }

  /**
   * Get current topic frequencies
   */
  getTopicFrequencies(): Map<string, number> {
    return new Map(this.recentTopics);
  }

  /**
   * Clear topic history
   */
  clearTopics(): void {
    this.recentTopics.clear();
  }
}
