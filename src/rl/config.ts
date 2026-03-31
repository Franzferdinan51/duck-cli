/**
 * src/rl/config.ts
 * OpenClaw-RL Configuration
 *
 * This integration is OPTIONAL. RL is disabled by default.
 * Enable via: duck rl enable
 * Disable via: duck rl disable
 */

export interface RLConfig {
  /** Is RL training enabled? Default: false */
  enabled: boolean;

  /** OpenClaw-RL server URL (e.g. http://192.168.1.100:30000) */
  serverUrl: string;

  /** API key for RL server (matches SGLANG_API_KEY on server) */
  apiKey: string;

  /** RL method: 'grpo' (Binary RL) or 'opd' (On-Policy Distillation) */
  method: 'grpo' | 'opd';

  /** PRM (Process Reward Model) enabled? (only for grpo method) */
  prmEnabled: boolean;

  /** Number of PRM judge votes (m value) */
  prmVotes: number;

  /** Session tracking enabled */
  sessionTracking: boolean;

  /** Conversation logging directory */
  logDir: string;

  /** Path to local RL config file */
  configPath: string;
}

export const DEFAULT_RL_CONFIG: RLConfig = {
  enabled: false,           // OPTIONAL - default OFF
  serverUrl: '',            // Must be set via duck rl connect <server>
  apiKey: 'apiKey',         // Default matches OpenClaw-RL default
  method: 'grpo',           // Binary RL
  prmEnabled: true,         // PRM evaluation enabled for grpo
  prmVotes: 3,              // Majority voting with 3 judges
  sessionTracking: true,     // Track per-session conversations
  logDir: './rl-logs',      // Where to store RL conversation logs
  configPath: './rl-config.json',
};

/**
 * Load RL config from file, merging with defaults.
 * Returns the full config (including sensitive fields).
 */
export async function loadRLConfig(path?: string): Promise<RLConfig> {
  const configPath = path || DEFAULT_RL_CONFIG.configPath;
  try {
    const { readFileSync } = await import('fs');
    const content = readFileSync(configPath, 'utf-8');
    const saved = JSON.parse(content);
    return { ...DEFAULT_RL_CONFIG, ...saved };
  } catch {
    return { ...DEFAULT_RL_CONFIG };
  }
}

/**
 * Save RL config to file (only saves non-sensitive fields).
 */
export async function saveRLConfig(config: RLConfig, path?: string): Promise<void> {
  const { writeFileSync } = await import('fs');
  const configPath = path || config.configPath || DEFAULT_RL_CONFIG.configPath;
  // Don't save apiKey to disk by default
  const toSave = { ...config, apiKey: config.apiKey !== DEFAULT_RL_CONFIG.apiKey ? config.apiKey : '' };
  writeFileSync(configPath, JSON.stringify(toSave, null, 2), 'utf-8');
}

/**
 * Build OpenClaw-compatible headers for RL server.
 */
export function buildRLHeaders(sessionId: string, turnType: 'main' | 'side' = 'main', sessionDone = false): Record<string, string> {
  return {
    'X-Session-Id': sessionId,
    'X-Turn-Type': turnType,
    'X-Session-Done': sessionDone ? 'true' : 'false',
    'Content-Type': 'application/json',
  };
}

/**
 * Validate RL server URL.
 */
export function isValidRLServerUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Get the chat completions endpoint for the RL server.
 */
export function getRLEndpoint(config: RLConfig): string {
  const base = config.serverUrl.replace(/\/$/, '');
  return `${base}/v1/chat/completions`;
}

/**
 * Get the health endpoint for the RL server.
 */
export function getRLHealthEndpoint(config: RLConfig): string {
  const base = config.serverUrl.replace(/\/$/, '');
  return `${base}/healthz`;
}
