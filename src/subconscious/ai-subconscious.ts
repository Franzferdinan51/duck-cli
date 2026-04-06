/**
 * 🦆 Duck Agent AI-Powered Subconscious
 * Dreams and generates insights using duck-cli's OWN AI providers (NOT Letta)
 * 
 * Uses:
 * - qwen3.5-9b (local via LM Studio) for fast background dreaming
 * - MiniMax M2.7 for deep API-powered analysis
 * - Kimi/OpenRouter as fallbacks
 */

import { ProviderManager } from '../providers/manager.js';

export interface DreamResult {
  insights: string[];
  patterns: string[];
  recommendations: string[];
  dreamNarrative?: string;
  errors?: string[];
}

export interface Insight {
  type: 'pattern' | 'recommendation' | 'warning';
  content: string;
  confidence: number;
  source: 'local' | 'api';
  timestamp: Date;
}

export interface DreamSignal {
  type: string;
  message?: string;
  timestamp?: Date;
  metadata?: Record<string, any>;
}

export class AISubconscious {
  private provider: ProviderManager;
  private recentInsights: Insight[] = [];
  private dreamHistory: DreamResult[] = [];
  private maxInsights: number = 50;
  private maxDreamHistory: number = 20;
  
  constructor() {
    this.provider = new ProviderManager();
    this.initProviders();
  }
  
  private async initProviders(): Promise<void> {
    try {
      await this.provider.load();
      console.log('[AISubconscious] Providers loaded');
    } catch (error) {
      console.error('[AISubconscious] Failed to load providers:', error);
    }
  }
  
  /**
   * Generate insights using LOCAL model (fast, background dreaming)
   * Uses qwen3.5-9b via LM Studio - free, fast, private
   */
  async dreamLocal(sessionSummary: string): Promise<DreamResult> {
    const prompt = `You are Duck Agent's subconscious mind processing a session.

Analyze this session activity:
${sessionSummary}

Generate insights in this format:
KEY_PATTERNS:
- [pattern 1]
- [pattern 2]
INSIGHTS:
- [insight 1]
- [insight 2]
RECOMMENDATIONS:
- [recommendation 1]

Be brief and actionable. Think like a background process that notices things.`;

    try {
      // Try LM Studio first (local, fast, free)
      const result = await this.provider.routeWithModel(
        'lmstudio/qwen3.5-9b',
        prompt
      );
      
      return this.parseDreamResponse(result.text);
    } catch (error) {
      // Fallback to openrouter free tier
      try {
        const result = await this.provider.routeWithModel(
          'openrouter/qwen/qwen3.6-plus-preview:free',
          prompt
        );
        return this.parseDreamResponse(result.text);
      } catch (fallbackError) {
        console.error('[AISubconscious] Local dream failed:', fallbackError);
        return { 
          insights: [], 
          patterns: [], 
          recommendations: [],
          errors: ['Local dreaming unavailable']
        };
      }
    }
  }
  
  /**
   * Generate insights using API model (deeper analysis)
   * Uses MiniMax M2.7 for complex, thoughtful analysis
   */
  async dreamDeep(sessionSummary: string): Promise<DreamResult> {
    const prompt = `You are Duck Agent's subconscious performing deep analysis.

Perform DEEP analysis of this session:
${sessionSummary}

Identify and elaborate on:
EMERGING_PATTERNS:
- [long-term pattern being formed]
- [recurring behavior noticed]
DEEP_INSIGHTS:
- [profound observation about the session]
- [what this reveals about user needs]
STRATEGIC_RECOMMENDATIONS:
- [what to do differently going forward]
- [systematic improvement suggested]
DREAM_NARRATIVE:
[A brief story (2-3 sentences) about what this session meant and where it's heading]

Be thoughtful, insightful, and slightly philosophical about patterns.`;

    try {
      // Use MiniMax for deeper analysis
      const result = await this.provider.routeWithModel(
        'minimax/MiniMax-M2.7',
        prompt
      );
      
      return this.parseDreamResponse(result.text);
    } catch (error) {
      // Fallback to Kimi
      try {
        const result = await this.provider.routeWithModel(
          'kimi/k2p5',
          prompt
        );
        return this.parseDreamResponse(result.text);
      } catch (fallbackError) {
        console.error('[AISubconscious] Deep dream failed:', fallbackError);
        return { 
          insights: [], 
          patterns: [], 
          recommendations: [],
          errors: ['Deep dreaming unavailable']
        };
      }
    }
  }
  
  /**
   * Quick insight generation (synchronous, no dreaming narrative)
   * For real-time suggestions during active sessions
   */
  async quickInsight(context: string): Promise<Insight | null> {
    const prompt = `Quick thought about: ${context}

Give me ONE brief insight or recommendation. Max 1 sentence. Be direct and actionable.`;

    try {
      const result = await this.provider.routeWithModel(
        'lmstudio/qwen3.5-9b',
        prompt
      );
      
      const insight: Insight = {
        type: 'pattern',
        content: result.text.substring(0, 200).trim(),
        confidence: 0.75,
        source: 'local',
        timestamp: new Date()
      };
      
      this.addInsight(insight);
      return insight;
    } catch (error) {
      return null;
    }
  }
  
  /**
   * Parse structured response from dream generation
   */
  private parseDreamResponse(response: string): DreamResult {
    const patterns: string[] = [];
    const insights: string[] = [];
    const recommendations: string[] = [];
    let dreamNarrative: string | undefined;
    
    const lines = response.split('\n');
    let currentSection = '';
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      if (trimmed.startsWith('KEY_PATTERNS:') || trimmed.startsWith('EMERGING_PATTERNS:')) {
        currentSection = 'patterns';
      } else if (trimmed.startsWith('INSIGHTS:') || trimmed.startsWith('DEEP_INSIGHTS:')) {
        currentSection = 'insights';
      } else if (trimmed.startsWith('RECOMMENDATIONS:') || trimmed.startsWith('STRATEGIC_RECOMMENDATIONS:')) {
        currentSection = 'recommendations';
      } else if (trimmed.startsWith('DREAM_NARRATIVE:')) {
        currentSection = 'narrative';
        dreamNarrative = trimmed.substring(16).trim();
      } else if (trimmed.startsWith('-') && trimmed.length > 1) {
        // Bullet point items
        const content = trimmed.substring(1).trim();
        if (currentSection === 'patterns') {
          patterns.push(content);
        } else if (currentSection === 'insights') {
          insights.push(content);
        } else if (currentSection === 'recommendations') {
          recommendations.push(content);
        } else if (currentSection === 'narrative' && dreamNarrative) {
          dreamNarrative += ' ' + content;
        }
      } else if (trimmed && currentSection && !trimmed.includes(':')) {
        // Continuation of previous bullet
        if (currentSection === 'patterns') {
          patterns.push(trimmed);
        } else if (currentSection === 'insights') {
          insights.push(trimmed);
        } else if (currentSection === 'recommendations') {
          recommendations.push(trimmed);
        } else if (currentSection === 'narrative' && dreamNarrative) {
          dreamNarrative += ' ' + trimmed;
        }
      }
    }
    
    return { patterns, insights, recommendations, dreamNarrative };
  }
  
  /**
   * Run a complete dreaming cycle
   * Integrates with OpenClaw dreaming phases:
   * - Light: Quick local pass (rule-based speed)
   * - Deep: API-powered analysis for complex sessions
   * - REM: Pattern synthesis and recommendation generation
   */
  async runDreamingCycle(recentSignals: DreamSignal[]): Promise<DreamResult> {
    if (recentSignals.length === 0) {
      return { insights: [], patterns: [], recommendations: [] };
    }
    
    // Build session summary
    const summary = recentSignals
      .slice(-20) // Last 20 signals
      .map(s => `- ${s.message || s.type}`)
      .join('\n');
    
    console.log(`[AISubconscious] Dreaming with ${recentSignals.length} signals...`);
    
    // Phase 1: Local quick pass (always runs)
    const localDream = await this.dreamLocal(summary);
    console.log(`[AISubconscious] Local dream: ${localDream.patterns.length} patterns, ${localDream.insights.length} insights`);
    
    // Phase 2: Deep API analysis (only for significant sessions)
    let finalDream = localDream;
    if (recentSignals.length > 5) {
      console.log('[AISubconscious] Session significant, running deep analysis...');
      const deepDream = await this.dreamDeep(summary);
      console.log(`[AISubconscious] Deep dream: ${deepDream.patterns.length} patterns, ${deepDream.insights.length} insights`);
      
      // Merge results
      finalDream = {
        insights: [...new Set([...localDream.insights, ...deepDream.insights])],
        patterns: [...new Set([...localDream.patterns, ...deepDream.patterns])],
        recommendations: [...new Set([...localDream.recommendations, ...deepDream.recommendations])],
        dreamNarrative: deepDream.dreamNarrative || localDream.dreamNarrative,
        errors: [...(localDream.errors || []), ...(deepDream.errors || [])]
      };
    }
    
    // Store in history
    this.dreamHistory.push(finalDream);
    if (this.dreamHistory.length > this.maxDreamHistory) {
      this.dreamHistory.shift();
    }
    
    // Convert recommendations to insights
    for (const rec of finalDream.recommendations) {
      this.addInsight({
        type: 'recommendation',
        content: rec,
        confidence: 0.7,
        source: recentSignals.length > 5 ? 'api' : 'local',
        timestamp: new Date()
      });
    }
    
    return finalDream;
  }
  
  /**
   * Add an insight to recent insights
   */
  private addInsight(insight: Insight): void {
    this.recentInsights.push(insight);
    if (this.recentInsights.length > this.maxInsights) {
      this.recentInsights.shift();
    }
  }
  
  /**
   * Get recent insights
   */
  getRecentInsights(): Insight[] {
    return this.recentInsights.slice(-10);
  }
  
  /**
   * Get all insights by type
   */
  getInsightsByType(type: Insight['type']): Insight[] {
    return this.recentInsights.filter(i => i.type === type);
  }
  
  /**
   * Get dream history
   */
  getDreamHistory(): DreamResult[] {
    return this.dreamHistory.slice(-5);
  }
  
  /**
   * Get system status
   */
  getStatus(): {
    insightCount: number;
    dreamCount: number;
    lastDream: Date | null;
    availableProviders: string[];
  } {
    return {
      insightCount: this.recentInsights.length,
      dreamCount: this.dreamHistory.length,
      lastDream: this.dreamHistory.length > 0 
        ? new Date() 
        : null,
      availableProviders: this.provider.list()
    };
  }
  
  /**
   * Clear all stored data
   */
  clear(): void {
    this.recentInsights = [];
    this.dreamHistory = [];
    console.log('[AISubconscious] Cleared all insights and dream history');
  }
}

// Singleton instance
let instance: AISubconscious | null = null;

export function getAISubconscious(): AISubconscious {
  if (!instance) {
    instance = new AISubconscious();
  }
  return instance;
}
