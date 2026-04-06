/**
 * 🦆 Duck Agent - Configuration
 * Centralized configuration with environment variable support
 * Cross-platform compatible paths
 */

import { homedir } from 'os';
import { join } from 'path';

// ─── Directory Helpers ───────────────────────────────────────────────────────

/**
 * Get Duck data directory (cross-platform)
 * Env: DUCK_DATA_DIR - explicit path override
 * Env: HOME (fallback) - user home directory
 */
export function getDuckDataDir(): string {
  return process.env.DUCK_DATA_DIR || join(homedir(), '.duck');
}

/**
 * Get DuckAgent data directory (cross-platform)
 * Env: DUCKAGENT_DATA_DIR - explicit path override  
 * Env: HOME (fallback) - user home directory
 */
export function getDuckAgentDataDir(): string {
  return process.env.DUCKAGENT_DATA_DIR || join(homedir(), '.duckagent');
}

// ─── Path Configuration ──────────────────────────────────────────────────────

/** Agent card storage directory */
export const AGENT_CARD_DIR = join(getDuckAgentDataDir(), 'mesh');

/** Subconscious daemon data directory */
export const SUBCONSCIOUS_DATA_DIR = join(getDuckAgentDataDir(), 'subconscious');

/** State directory */
export const STATE_DIR = join(getDuckAgentDataDir(), 'state');

// ─── Network Configuration ───────────────────────────────────────────────────

/** Default timeout for health checks (ms) */
export const DEFAULT_HEALTH_TIMEOUT = parseInt(process.env.DEFAULT_HEALTH_TIMEOUT || '3000');

/** Default timeout for exec operations (ms) */
export const DEFAULT_EXEC_TIMEOUT = parseInt(process.env.DEFAULT_EXEC_TIMEOUT || '30000');

/** Default timeout for ADB operations (ms) */
export const DEFAULT_ADB_TIMEOUT = parseInt(process.env.DEFAULT_ADB_TIMEOUT || '10000');

/** Default timeout for Android content wait (ms) */
export const DEFAULT_CONTENT_WAIT_TIMEOUT = parseInt(process.env.DEFAULT_CONTENT_WAIT_TIMEOUT || '10000');

// ─── Port Configuration ──────────────────────────────────────────────────────

/** Subconscious daemon default port */
export const DEFAULT_SUBCONSCIOUS_PORT = parseInt(process.env.SUBCONSCIOUS_PORT || '4001');

/** Mesh server default port */
export const DEFAULT_MESH_PORT = parseInt(process.env.MESH_PORT || process.env.PORT || '4000');

/** OpenClaw-RL default port */
export const DEFAULT_OPENCLAW_RL_PORT = parseInt(process.env.OPENCLAW_RL_PORT || '30000');

/** MCP server default port (Streamable HTTP + WebSocket) */
export const DEFAULT_MCP_PORT = parseInt(process.env.MCP_PORT || '3850');

/** Live error stream default port (WebSocket) */
export const DEFAULT_LIVE_ERROR_PORT = parseInt(process.env.LIVE_ERROR_PORT || '3851');

/** ACP server default port (for OpenClaw gateway) */
export const DEFAULT_ACP_PORT = parseInt(process.env.ACP_PORT || '18794');

/** A2A server default port */
export const DEFAULT_A2A_PORT = parseInt(process.env.A2A_PORT || '4001');

/** Telegram webhook server default port */
export const DEFAULT_TELEGRAM_WEBHOOK_PORT = parseInt(process.env.TELEGRAM_WEBHOOK_PORT || '8443');

// ─── API Keys (with fallback defaults for dev) ────────────────────────────────

export const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY || '';
export const MINIMAX_API_KEY_2 = process.env.MINIMAX_API_KEY_2 || '';
export const KIMI_API_KEY = process.env.KIMI_API_KEY || '';
export const MOONSHOT_API_KEY = process.env.MOONSHOT_API_KEY || '';
export const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
export const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
export const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';

// ─── LM Studio Configuration ─────────────────────────────────────────────────

export const LMSTUDIO_URL = process.env.LMSTUDIO_URL || 'http://localhost:1234';
export const LMSTUDIO_KEY = process.env.LMSTUDIO_KEY || process.env.LMSTUDIO_API_KEY || 'not-needed';

// ─── Mesh Configuration ──────────────────────────────────────────────────────

export const MESH_URL = process.env.MESH_URL || process.env.AGENT_MESH_URL || 'http://localhost:4000';
export const MESH_API_KEY = process.env.MESH_API_KEY || process.env.AGENT_MESH_API_KEY || 'openclaw-mesh-default-key';
export const MESH_HOST = process.env.MESH_HOST || '0.0.0.0';

// ─── BrowserOS Configuration ─────────────────────────────────────────────────

export const BROWSEROS_HOST = process.env.BROWSEROS_HOST || '127.0.0.1';
export const BROWSEROS_PORT = parseInt(process.env.BROWSEROS_PORT || '9100');

// ─── Update Notification Paths ──────────────────────────────────────────────

export const UPDATE_NOTIFICATIONS_PATH = join(getDuckDataDir(), 'update-notifications.json');
export const UPDATE_PREFS_PATH = join(getDuckDataDir(), 'update-notification-prefs.json');
export const UPDATE_STRATEGY_PATH = join(getDuckDataDir(), 'update-strategy.json');
export const UPDATE_REVIEW_STATE_PATH = join(getDuckDataDir(), 'update-review-state.json');

// ─── Safety Limits ───────────────────────────────────────────────────────────

export const MAX_SENT_HISTORY = 100;
export const MAX_DISMISSED_HISTORY = 500;
export const MAX_CONTEXT_SNAPSHOTS = 100;
