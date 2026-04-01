/**
 * Duck Agent Subconscious - Type Definitions
 * Claude Subconscious-style but WITHOUT Letta
 */

// Pattern detected in session history
export interface Pattern {
  id: string;
  topic: string;
  frequency: number;
  lastSeen: Date;
  confidence: number;
}

// Whisper generated before action
export interface Whisper {
  type: 'keyword' | 'pattern' | 'time' | 'frustration' | 'kairos';
  message: string;
  confidence: number;
  timestamp: Date;
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
}

// Session context for whisper generation
export interface SessionContext {
  message?: string;
  sessionHistory?: string[];
  time?: Date;
  kairosStress?: number;
  previousSessionEnded?: 'good' | 'bad' | 'neutral';
}
