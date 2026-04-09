/**
 * 🦆 Duck Agent - Security Module
 * Security features based on NVIDIA NemoClaw
 */

export { validateURL, validateURLBatch } from './ssrf.js';
export type { SSRFResult } from './ssrf.js';

export { 
  loadState, 
  saveState, 
  updateLastAction, 
  incrementInteractions, 
  clearState,
  getStatePath 
} from './state-manager.js';
export type { DuckAgentState } from './state-manager.js';

export { 
  sanitize, 
  sanitizeObject, 
  containsCredentials, 
  getCredentialEnvVars,
  safeLogContext 
} from './credential-sanitizer.js';

export {
  sanitizeCommand,
  sanitizeOutput,
  sanitizeReason,
  sanitizeNodeMessage,
  sanitizeForRemoteNode,
  sanitizeIncomingNodeMessage,
  logSanitization,
  getSanitizationStats
} from './remote-node-sanitizer.js';

export { SecurityStateManager } from './security-state-manager.js';
export type { EnvVarValidation, BrowserURLCheck, SecurityStateManagerOptions } from './security-state-manager.js';
