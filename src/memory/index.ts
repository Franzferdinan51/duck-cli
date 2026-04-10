/**
 * Duck Agent Memory System
 * SQLite-backed persistent memory with semantic search and learning
 * 
 * NEW: Lossless Context Management (LCM) - DAG-based summarization
 * that preserves every message while keeping context within token limits
 */

// Legacy memory exports
export { SQLiteStore, MemorySearch, ToolUsage, SessionSummary } from './sqlite-store.js';
export { MemorySystem, MemoryEntry } from './system.js';

// NEW: LCM (Lossless Context Management) exports
export {
  // Core engine
  LCM_CONFIG,
  getOrCreateConversation,
  storeMessage,
  getMessages,
  assembleContext,
  createLeafSummary,
  createCondensedSummary,
  shouldCompact,
  getMessagesForCompaction,
  grepSummaries,
  getLCMStats,
  archiveConversation,
  closeLCM,
  isLCMAvailable,
  // Types
  LCMMessage,
  LCMSummary,
  LCMContextResult,
} from './lcm-engine.js';

// LCM Session wrapper
export {
  LCMSession,
  LCMLoadedContext,
  getOrCreateLCMSession,
  clearLCMSession,
} from './lcm-session.js';
