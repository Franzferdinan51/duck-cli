/**
 * Duck Agent Subconscious Module
 * Claude Subconscious-style but WITHOUT Letta - WITH AI COUNCIL INTEGRATION
 * 
 * Architecture:
 * - Local mode: Rule-based whispers (no daemon)
 * - Daemon mode: LLM-powered analysis + persistent SQLite storage
 * - Council mode: AI Council deliberation for complex decisions
 * 
 * Start daemon: duck subconsciousd
 * CLI: duck subconscious status/stats/recall/whisper/council
 */

export * from './types.js';

// Core (local, no daemon needed)
export { MemoryBridge } from './memory-bridge.js';
export { WhisperEngine } from './whisper-engine.js';
export { CouncilBridge, getCouncilBridge } from './council-bridge.js';
export { Subconscious, getSubconscious } from './subconscious.js';

// Daemon client (communicates with subconsciousd)
export { SubconsciousClient, getSubconsciousClient } from './client.js';
export type { WhisperResponse, StoredMemory, CouncilMemory, TranscriptSegment } from './client.js';

// Persistence layer
export { SqliteStore } from './persistence/sqlite-store.js';
export { analyzeTranscript, generateWhisper, analyzeCouncilDeliberation } from './persistence/llm-analyzer.js';
