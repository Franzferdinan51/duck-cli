/**
 * Duck Agent Subconscious - Type Definitions
 * Claude Subconscious-style but WITHOUT Letta - WITH AI Council integration
 */

// Whisper source type
export type WhisperSource = 'council' | 'session' | 'analysis' | 'manual' | 'dream' | 'whisper' | 'council_deliberation' | 'kairos_dream' | 'memory_blocks_manager';

// Whisper result
export interface WhisperResult {
  whisper: string | null;
  confidence: number;
  source: WhisperMode;
  timestamp: number;
}

// Whisper mode
export type WhisperMode = 'none' | 'memory_blocks' | 'session_analysis' | 'pattern_match' | 'full';

// Council decision with source
export interface CouncilDecisionWithSource extends CouncilDecision {
  source: WhisperSource;
}

// Pattern detected in session history
export interface Pattern {
  id: string;
  topic: string;
  frequency: number;
  lastSeen: Date;
  confidence: number;
}

// AI Council decision
export interface CouncilDecision {
  topic: string;
  verdict: string;
  confidence: number;
  reasoning: string;
  councilors: string[];
  duration: number;
  timestamp: Date;
}

// Whisper generated before action
export interface Whisper {
  type: 'keyword' | 'pattern' | 'time' | 'frustration' | 'kairos' | 'council';
  message: string;
  confidence: number;
  timestamp: Date;
  metadata?: {
    reasoning?: string;
    councilors?: string[];
    duration?: number;
  };
}

// Memory stored in native system
export interface Memory {
  id: string;
  content: string;
  context: string;
  timestamp: Date;
  importance: number;
}

// Subconscious configuration
export interface SubconsciousConfig {
  enabled: boolean;
  whisperInterval: number;
  maxMemories: number;
  patternThreshold: number;
  councilEnabled?: boolean;
  councilThreshold?: number;
}

// Session context for whisper generation
export interface SessionContext {
  message?: string;
  sessionHistory?: string[];
  time?: Date;
  kairosStress?: number;
  previousSessionEnded?: 'good' | 'bad' | 'neutral';
}
