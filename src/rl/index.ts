/**
 * src/rl/index.ts
 * OpenClaw-RL Integration for Duck Agent
 *
 * IMPORTANT: This module is OPTIONAL and disabled by default.
 * Enable via: duck rl enable
 * Disable via: duck rl disable
 *
 * Exports:
 * - TrainingManager / getTrainingManager() - Main RL lifecycle manager
 * - RLClient / RLClient.fromConfig() - Low-level RL server client
 * - RLConfig / loadRLConfig / saveRLConfig - Configuration
 * - All types: RLMessage, RLChatOptions, RLChatResponse, RLStats, TrainingRecord, etc.
 */

// Import for use in this module
import { getTrainingManager } from './training-manager.js';
import type { TrainingManagerStats } from './training-manager.js';

// Configuration
export {
  type RLConfig,
  DEFAULT_RL_CONFIG,
  loadRLConfig,
  saveRLConfig,
  buildRLHeaders,
  isValidRLServerUrl,
  getRLEndpoint,
  getRLHealthEndpoint,
} from './config.js';

// Client
export {
  type RLMessage,
  type RLChatOptions,
  type RLChatResponse,
  type RLTurnScore,
  type RLStats,
  RLClient,
} from './rl-client.js';

// Training Manager
export {
  type TrainingRecord,
  type TrainingSession,
  type TrainingManagerStats,
  TrainingManager,
  getTrainingManager,
} from './training-manager.js';

/**
 * Quick status check for the RL subsystem.
 * Returns a plain object with current state - useful for CLI display.
 */
export async function getRLStatus(): Promise<{
  enabled: boolean;
  connected: boolean;
  serverUrl: string;
  method: string;
  message: string;
}> {
  try {
    const tm = await getTrainingManager();
    const stats = tm.getStats();
    return {
      enabled: stats.rlEnabled,
      connected: stats.connected,
      serverUrl: stats.serverUrl,
      method: stats.method,
      message: stats.rlEnabled
        ? `RL active (${stats.method})`
        : 'RL disabled (normal mode)',
    };
  } catch {
    return {
      enabled: false,
      connected: false,
      serverUrl: '',
      method: 'grpo',
      message: 'RL subsystem unavailable',
    };
  }
}
