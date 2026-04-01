/**
 * Duck Agent Subconscious Module
 * Claude Subconscious-style but WITHOUT Letta
 * 
 * Uses Duck Agent's own:
 * - Memory system (JSONL + files)
 * - Providers (MiniMax, Kimi, etc.)
 * - KAIROS integration
 */

// Types
export * from './types.js';

// Core classes
export { MemoryBridge } from './memory-bridge.js';
export { WhisperEngine } from './whisper-engine.js';
export { Subconscious, getSubconscious } from './subconscious.js';
