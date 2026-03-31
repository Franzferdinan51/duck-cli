/**
 * src/rl/training-manager.ts
 * OpenClaw-RL Training Manager
 *
 * Manages the RL training lifecycle:
 * - Toggles RL on/off
 * - Coordinates between Duck Agent and RL server
 * - Integrates with KAIROS (memory/learning system)
 * - Logs conversations for training analysis
 * - Handles graceful enable/disable without disrupting normal operation
 *
 * IMPORTANT: This is OPTIONAL. RL training is OFF by default.
 * The agent operates normally without any RL functionality when disabled.
 */

import { mkdir, appendFile, readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import type { RLMessage, RLChatResponse, RLStats } from './rl-client.js';
import { RLClient } from './rl-client.js';
import type { RLConfig } from './config.js';
import { loadRLConfig, saveRLConfig, DEFAULT_RL_CONFIG, isValidRLServerUrl, getRLEndpoint, getRLHealthEndpoint } from './config.js';

export interface TrainingRecord {
  sessionId: string;
  turnNumber: number;
  turnType: 'main' | 'side';
  messages: RLMessage[];
  response?: string;
  score?: number;
  timestamp: string;
  hints?: string[];  // OPD hints extracted from next-state
  excluded?: boolean; // True if sample excluded from training
}

export interface TrainingSession {
  sessionId: string;
  startTime: number;
  turns: TrainingRecord[];
  status: 'active' | 'completed' | 'paused';
  lastActivity: number;
}

export interface TrainingManagerStats {
  rlEnabled: boolean;
  serverUrl: string;
  method: 'grpo' | 'opd';
  prmEnabled: boolean;
  connected: boolean;
  activeSessions: number;
  totalSessions: number;
  totalTurns: number;
  trainableTurns: number;
  averageScore: number;
  recordsLogged: number;
  lastHealthCheck: number;
  rlLogsDir: string;
}

export class TrainingManager {
  private client: RLClient;
  private config: RLConfig;
  private activeSessions: Map<string, TrainingSession> = new Map();
  private totalSessions: number = 0;
  private totalTurns: number = 0;
  private trainableTurns: number = 0;
  private recordsLogged: number = 0;
  private logDir: string;
  private kairosIntegration: boolean = false;

  constructor() {
    this.config = { ...DEFAULT_RL_CONFIG };
    this.client = new RLClient(this.config);
    this.logDir = DEFAULT_RL_CONFIG.logDir;
  }

  /**
   * Initialize the training manager from disk config.
   */
  async initialize(): Promise<void> {
    this.config = await loadRLConfig();
    this.client = new RLClient(this.config);
    this.logDir = this.config.logDir;

    // Ensure log directory exists
    if (!existsSync(this.logDir)) {
      await mkdir(this.logDir, { recursive: true });
    }

    // Load persisted stats if available
    await this.loadStats();
  }

  /**
   * Connect to an OpenClaw-RL server.
   */
  async connect(serverUrl: string, apiKey?: string): Promise<{ success: boolean; error?: string }> {
    if (!isValidRLServerUrl(serverUrl)) {
      return { success: false, error: 'Invalid server URL. Use format: http://host:port' };
    }

    this.config.serverUrl = serverUrl;
    if (apiKey) this.config.apiKey = apiKey;
    this.client.updateConfig(this.config);

    // Verify connection
    const connected = await this.client.checkHealth();
    if (!connected) {
      return {
        success: false,
        error: `Cannot reach RL server at ${serverUrl}. Is it running? (check: ${getRLHealthEndpoint(this.config)})`,
      };
    }

    // Save config
    await saveRLConfig(this.config);
    return { success: true };
  }

  /**
   * Enable RL training.
   * Connects to the configured server if URL is set.
   */
  async enable(): Promise<{ success: boolean; error?: string }> {
    if (!this.config.serverUrl) {
      return {
        success: false,
        error: 'No RL server configured. Run: duck rl connect <server-url>',
      };
    }

    const connected = await this.client.checkHealth();
    if (!connected) {
      return {
        success: false,
        error: `Cannot reach RL server at ${this.config.serverUrl}. Start the server first.`,
      };
    }

    this.config.enabled = true;
    this.client.updateConfig({ enabled: true });
    await saveRLConfig(this.config);

    console.log('[RL] Reinforcement learning enabled.');
    console.log(`[RL] Server: ${this.config.serverUrl}`);
    console.log(`[RL] Method: ${this.config.method === 'grpo' ? 'Binary RL (GRPO + PRM)' : 'On-Policy Distillation (OPD)'}`);
    console.log('[RL] KAIROS integration: active');

    this.kairosIntegration = true;
    return { success: true };
  }

  /**
   * Disable RL training.
   * Agent reverts to normal operation (no training, no overhead).
   */
  async disable(): Promise<void> {
    this.config.enabled = false;
    this.client.updateConfig({ enabled: false });
    await saveRLConfig(this.config);
    this.kairosIntegration = false;

    console.log('[RL] Reinforcement learning disabled.');
    console.log('[RL] Agent operating in normal mode (no training).');
    console.log('[RL] Enable anytime with: duck rl enable');
  }

  /**
   * Check if RL is currently enabled.
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Get RL server URL.
   */
  getServerUrl(): string {
    return this.config.serverUrl || '';
  }

  /**
   * Check RL server health.
   */
  async checkConnection(): Promise<boolean> {
    return this.client.checkHealth();
  }

  /**
   * Start a new training session for a conversation thread.
   */
  startSession(sessionId?: string): string {
    const sid = sessionId || this.client.startSession();
    const session: TrainingSession = {
      sessionId: sid,
      startTime: Date.now(),
      turns: [],
      status: 'active',
      lastActivity: Date.now(),
    };
    this.activeSessions.set(sid, session);
    this.totalSessions++;
    return sid;
  }

  /**
   * End a training session.
   */
  async endSession(sessionId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    session.status = 'completed';
    session.lastActivity = Date.now();

    // Log the completed session
    await this.logSession(session);

    this.activeSessions.delete(sessionId);
  }

  /**
   * Record a turn in the current conversation.
   * Called after each user↔assistant exchange when RL is enabled.
   */
  async recordTurn(
    sessionId: string,
    messages: RLMessage[],
    response: string,
    options: {
      turnType?: 'main' | 'side';
      score?: number;
      hints?: string[];
    } = {}
  ): Promise<void> {
    if (!this.config.enabled) return;

    const session = this.activeSessions.get(sessionId);
    if (!session) {
      this.startSession(sessionId);
    }

    const s = this.activeSessions.get(sessionId) || this.activeSessions.values().next().value;
    if (!s) return;

    const turnType = options.turnType || this.client.classifyTurn(messages);
    const turnNumber = s.turns.length + 1;

    const record: TrainingRecord = {
      sessionId,
      turnNumber,
      turnType,
      messages,
      response,
      score: options.score,
      hints: options.hints,
      timestamp: new Date().toISOString(),
      excluded: turnType === 'side',
    };

    s.turns.push(record);
    s.lastActivity = Date.now();
    this.totalTurns++;

    if (turnType === 'main') {
      this.trainableTurns++;
    }

    // Log turn to file
    await this.logTurn(record);
    this.recordsLogged++;
  }

  /**
   * Process incoming message and route appropriately.
   * When RL is disabled, this is a no-op (no overhead).
   *
   * This is the main integration point for Duck Agent's KAIROS system.
   * When RL is enabled, KAIROS learnings can be used as hints for OPD.
   */
  async onKAIROSLearn(sessionId: string, insight: string, context: RLMessage[]): Promise<void> {
    if (!this.config.enabled) return;

    // KAIROS insights can be used as training hints for OPD
    // or as context for PRM evaluation in GRPO
    if (this.config.method === 'opd') {
      const session = this.activeSessions.get(sessionId);
      if (session && session.turns.length > 0) {
        const lastTurn = session.turns[session.turns.length - 1];
        if (!lastTurn.hints) lastTurn.hints = [];
        lastTurn.hints.push(insight);
      }
    }
  }

  /**
   * Get comprehensive stats for the training manager.
   */
  getStats(): TrainingManagerStats {
    const rlStats = this.client.getStats();
    return {
      rlEnabled: this.config.enabled,
      serverUrl: this.config.serverUrl || '(not configured)',
      method: this.config.method,
      prmEnabled: this.config.prmEnabled,
      connected: rlStats.connected,
      activeSessions: this.activeSessions.size,
      totalSessions: this.totalSessions,
      totalTurns: this.totalTurns,
      trainableTurns: this.trainableTurns,
      averageScore: rlStats.averageScore,
      recordsLogged: this.recordsLogged,
      lastHealthCheck: Date.now(),
      rlLogsDir: this.logDir,
    };
  }

  /**
   * Print a formatted RL status report.
   */
  printStatus(): void {
    const stats = this.getStats();
    const { c } = getColors();

    console.log(`\n${c.bold}🦆 OpenClaw-RL Status${c.reset}\n`);
    console.log(`  ${c.cyan}RL Training:${c.reset}  ${stats.rlEnabled ? `${c.green}ENABLED${c.reset}` : `${c.dim}DISABLED${c.reset} (default)`}`);
    console.log(`  ${c.cyan}Server:${c.reset}        ${stats.serverUrl}`);
    console.log(`  ${c.cyan}Method:${c.reset}        ${stats.method === 'grpo' ? 'Binary RL (GRPO + PRM)' : 'On-Policy Distillation (OPD)'}`);
    console.log(`  ${c.cyan}PRM Eval:${c.reset}      ${stats.prmEnabled ? `${c.green}ON${c.reset}` : `${c.dim}OFF${c.reset}`}`);
    console.log(`  ${c.cyan}Connected:${c.reset}     ${stats.connected ? `${c.green}YES${c.reset}` : `${c.red}NO${c.reset}`}`);
    console.log(`  ${c.cyan}Sessions:${c.reset}       ${stats.totalSessions} total, ${stats.activeSessions} active`);
    console.log(`  ${c.cyan}Turns:${c.reset}          ${stats.totalTurns} total, ${stats.trainableTurns} trainable`);
    console.log(`  ${c.cyan}Avg Score:${c.reset}      ${stats.averageScore > 0 ? stats.averageScore.toFixed(2) : 'N/A'}`);
    console.log(`  ${c.cyan}Log Dir:${c.reset}        ${stats.rlLogsDir}`);

    if (!stats.rlEnabled) {
      console.log(`\n${c.dim}  RL is OPTIONAL and disabled by default.${c.reset}`);
      console.log(`${c.dim}  Enable with: duck rl enable${c.reset}`);
    }
  }

  /**
   * Print training stats in a compact format.
   */
  printStats(): void {
    const stats = this.getStats();
    const { c } = getColors();

    console.log(`\n${c.bold}🦆 RL Training Stats${c.reset}\n`);
    console.log(`  Sessions:    ${stats.totalSessions}`);
    console.log(`  Turns:      ${stats.totalTurns} (${stats.trainableTurns} trainable)`);
    console.log(`  Avg Score:  ${stats.averageScore > 0 ? stats.averageScore.toFixed(2) : 'N/A'}`);
    console.log(`  Logged:     ${stats.recordsLogged} records`);
    console.log(`  Active:     ${stats.activeSessions}`);
  }

  // ===== Private helpers =====

  private async logTurn(record: TrainingRecord): Promise<void> {
    try {
      const date = new Date().toISOString().split('T')[0];
      const logFile = `${this.logDir}/turns-${date}.jsonl`;
      const line = JSON.stringify(record) + '\n';
      await appendFile(logFile, line, 'utf-8');
    } catch (err) {
      // Non-fatal - don't disrupt conversation
      console.warn('[RL] Failed to log turn:', err);
    }
  }

  private async logSession(session: TrainingSession): Promise<void> {
    try {
      const logFile = `${this.logDir}/sessions.jsonl`;
      const summary = {
        sessionId: session.sessionId,
        startTime: new Date(session.startTime).toISOString(),
        endTime: new Date(session.lastActivity).toISOString(),
        turnCount: session.turns.length,
        trainableTurns: session.turns.filter(t => t.turnType === 'main').length,
        totalScore: session.turns.reduce((sum, t) => sum + (t.score || 0), 0),
      };
      await appendFile(logFile, JSON.stringify(summary) + '\n', 'utf-8');
    } catch (err) {
      console.warn('[RL] Failed to log session:', err);
    }
  }

  private async loadStats(): Promise<void> {
    try {
      const statsFile = `${this.logDir}/stats.json`;
      if (existsSync(statsFile)) {
        const data = JSON.parse(await readFile(statsFile, 'utf-8'));
        this.totalSessions = data.totalSessions || 0;
        this.totalTurns = data.totalTurns || 0;
        this.trainableTurns = data.trainableTurns || 0;
        this.recordsLogged = data.recordsLogged || 0;
      }
    } catch {
      // First run - no stats yet
    }
  }

  private async persistStats(): Promise<void> {
    try {
      if (!existsSync(this.logDir)) {
        await mkdir(this.logDir, { recursive: true });
      }
      const statsFile = `${this.logDir}/stats.json`;
      await writeFile(statsFile, JSON.stringify({
        totalSessions: this.totalSessions,
        totalTurns: this.totalTurns,
        trainableTurns: this.trainableTurns,
        recordsLogged: this.recordsLogged,
      }, null, 2), 'utf-8');
    } catch {
      // Non-fatal
    }
  }
}

// ===== ANSI color helpers =====

function getColors() {
  const c = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    dim: '\x1b[2m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    magenta: '\x1b[35m',
  };
  return { c };
}

// ===== Singleton instance =====

let _instance: TrainingManager | null = null;

export async function getTrainingManager(): Promise<TrainingManager> {
  if (!_instance) {
    _instance = new TrainingManager();
    await _instance.initialize();
  }
  return _instance;
}
