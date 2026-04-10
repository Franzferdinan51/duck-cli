/**
 * 🦆 Duck Agent - KAIROS System
 * Autonomous proactive AI inspired by Claude Code
 * Based on Claude Code's core architecture
 */

import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';

// ============================================================================
// KAIROS CORE
// ============================================================================

export interface KAIROSTick {
  timestamp: number;
  localTime: string;
  terminalFocused: boolean;
  idleDuration: number;
}

export interface KAIROSConfig {
  enabled: boolean;
  tickInterval: number;        // ms between ticks
  idleThreshold: number;      // ms before considered idle
  maxActionsPerTick: number;
  proactiveMode: 'aggressive' | 'balanced' | 'conservative';
  sleepEnabled: boolean;
  dreamEnabled: boolean;
  dreamTime: string;          // HH:MM format
}

export const DEFAULT_KAIROS_CONFIG: KAIROSConfig = {
  enabled: true,
  tickInterval: 300000,      // 5 minutes (was 6 hours)
  idleThreshold: 30000,       // 30 seconds idle
  maxActionsPerTick: 3,
  proactiveMode: 'balanced',
  sleepEnabled: true,
  dreamEnabled: true,
  dreamTime: '03:00',
};

export type KAIROSEvent = 
  | 'tick'
  | 'action'
  | 'sleep'
  | 'wake'
  | 'dream'
  | 'idle'
  | 'active'
  | 'error';

export interface KAIROSAction {
  id: string;
  type: string;
  description: string;
  executedAt: number;
  result?: string;
  error?: string;
}

export interface KAIROSDream {
  startedAt: number;
  endedAt?: number;
  topics: string[];
  insights: string[];
}

// ============================================================================
// HEARTBEAT SYSTEM
// ============================================================================

export interface HeartbeatState {
  lastTick: number;
  consecutiveIdleTicks: number;
  consecutiveActiveTicks: number;
  isIdle: boolean;
  isAsleep: boolean;
  lastAction?: string;
  pendingActions: string[];
}

export class KAIROSHeartbeat {
  private state: HeartbeatState = {
    lastTick: Date.now(),
    consecutiveIdleTicks: 0,
    consecutiveActiveTicks: 0,
    isIdle: false,
    isAsleep: false,
    pendingActions: [],
  };
  
  private config: KAIROSConfig;
  
  constructor(config: Partial<KAIROSConfig> = {}) {
    this.config = { ...DEFAULT_KAIROS_CONFIG, ...config };
  }
  
  /**
   * Process a tick and determine state
   */
  processTick(tick: KAIROSTick): HeartbeatState {
    const now = Date.now();
    const idleDuration = now - this.state.lastTick;
    
    this.state.lastTick = now;
    
    // Check for sleep time
    if (this.config.dreamEnabled) {
      const currentTime = tick.localTime.split(':');
      const dreamTimeParts = this.config.dreamTime.split(':');
      
      if (currentTime[0] === dreamTimeParts[0] && currentTime[1] === dreamTimeParts[1]) {
        this.state.isAsleep = true;
      } else {
        this.state.isAsleep = false;
      }
    }
    
    // Determine idle vs active
    if (idleDuration > this.config.idleThreshold) {
      this.state.isIdle = true;
      this.state.consecutiveIdleTicks++;
      this.state.consecutiveActiveTicks = 0;
    } else {
      this.state.isIdle = false;
      this.state.consecutiveActiveTicks++;
      this.state.consecutiveIdleTicks = 0;
    }
    
    return { ...this.state };
  }
  
  /**
   * Get current state
   */
  getState(): HeartbeatState {
    return { ...this.state };
  }
  
  /**
   * Add a pending action
   */
  addPendingAction(action: string): void {
    this.state.pendingActions.push(action);
  }
  
  /**
   * Clear pending actions
   */
  clearPendingActions(): void {
    this.state.pendingActions = [];
  }
  
  /**
   * Record last action
   */
  recordAction(action: string): void {
    this.state.lastAction = action;
  }
}

// ============================================================================
// KAIROS ORCHESTRATOR
// ============================================================================

export class KAIROS extends EventEmitter {
  private config: KAIROSConfig;
  private heartbeat: KAIROSHeartbeat;
  private tickInterval: NodeJS.Timeout | null = null;
  private isRunning = false;
  private currentDream?: KAIROSDream;
  private actionHistory: KAIROSAction[] = [];
  
  // Pattern learning
  private patterns: Map<string, { count: number; lastSeen: number }> = new Map();
  
  constructor(config: Partial<KAIROSConfig> = {}) {
    super();
    this.config = { ...DEFAULT_KAIROS_CONFIG, ...config };
    this.heartbeat = new KAIROSHeartbeat(this.config);
  }
  
  /**
   * Start KAIROS autonomous mode
   */
  start(): void {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.emit('wake');
    
    // Fire first tick immediately so heartbeat/dream logic runs right away
    this.tick();
    
    // Start tick loop
    this.tickInterval = setInterval(() => {
      this.tick();
    }, this.config.tickInterval);
  }
  
  /**
   * Stop KAIROS
   */
  stop(): void {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
    this.emit('sleep');
  }
  
  /**
   * Process a tick — fully wrapped in try-catch so a broken action never kills the loop
   */
  private tick(): void {
    if (!this.config.enabled) return;

    let tick: KAIROSTick;
    let state: HeartbeatState;

    try {
      const now = new Date();
      tick = {
        timestamp: now.getTime(),
        localTime: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        terminalFocused: true,
        idleDuration: Date.now() - this.heartbeat.getState().lastTick,
      };

      state = this.heartbeat.processTick(tick);
    } catch (e: any) {
      this.emit('error', { phase: 'heartbeat', error: e.message });
      return;
    }

    this.emit('tick', tick, state);

    // Handle sleep/dream — each phase wrapped independently
    if (state.isAsleep && this.config.dreamEnabled) {
      try {
        this.runDream();
      } catch (e: any) {
        this.emit('error', { phase: 'dream', error: e.message });
      }
      return;
    }

    // Decide actions based on state
    if (state.isIdle) {
      this.emit('idle', state);
      if (this.config.proactiveMode === 'aggressive' || this.config.proactiveMode === 'balanced') {
        try {
          this.performProactiveActions(state);
        } catch (e: any) {
          this.emit('error', { phase: 'proactive_actions', error: e.message });
        }
      }
    } else {
      this.emit('active', state);
    }

    // Learn patterns — isolated so a bad pattern doesn't crash tick
    try {
      this.learnPatterns(tick);
    } catch (e: any) {
      this.emit('error', { phase: 'learn_patterns', error: e.message });
    }
  }
  
  /**
   * Perform proactive actions when idle
   */
  private performProactiveActions(state: HeartbeatState): void {
    const maxActions = this.config.maxActionsPerTick;
    let actionsTaken = 0;
    
    // Check pending actions first
    while (state.pendingActions.length > 0 && actionsTaken < maxActions) {
      const action = state.pendingActions.shift();
      if (action) {
        this.executeAction({
          id: randomUUID(),
          type: 'queued',
          description: action,
          executedAt: Date.now(),
        });
        actionsTaken++;
      }
    }
    
    // Proactive mode actions
    if (this.config.proactiveMode === 'aggressive' && actionsTaken < maxActions) {
      // Aggressive: check for opportunities
      const opportunities = this.identifyOpportunities();
      for (const opp of opportunities.slice(0, maxActions - actionsTaken)) {
        this.executeAction({
          id: randomUUID(),
          type: 'proactive',
          description: opp,
          executedAt: Date.now(),
        });
        actionsTaken++;
      }
    }
  }
  
  /**
   * Identify proactive opportunities
   */
  private identifyOpportunities(): string[] {
    const opportunities: string[] = [];
    
    // Learn from patterns
    for (const [pattern, data] of this.patterns) {
      if (data.count > 3 && Date.now() - data.lastSeen < 3600000) {
        // This pattern is recurring - suggest automation
        opportunities.push(`Consider automating: ${pattern}`);
      }
    }
    
    return opportunities;
  }
  
  /**
   * Execute an action
   */
  private executeAction(action: KAIROSAction): void {
    this.actionHistory.push(action);
    this.heartbeat.recordAction(action.description);
    this.emit('action', action);
    
    // Keep history limited
    if (this.actionHistory.length > 100) {
      this.actionHistory = this.actionHistory.slice(-50);
    }
  }
  
  /**
   * Run dream consolidation — fully isolated
   */
  private runDream(): void {
    if (this.currentDream) return;

    this.currentDream = {
      startedAt: Date.now(),
      topics: [],
      insights: [],
    };

    this.emit('dream', this.currentDream);

    // Consolidate patterns and learning — wrapped so crash doesn't kill dream
    try {
      const consolidatedInsights = this.consolidateLearnings();
      this.currentDream.insights = consolidatedInsights;
    } catch (e: any) {
      this.emit('error', { phase: 'consolidate_learnings', error: e.message });
      this.currentDream.insights = [];
    }

    // End dream after some time
    const dreamId = this.currentDream.startedAt;
    setTimeout(() => {
      // Only end the current dream (not a newer one that started after this timeout)
      if (this.currentDream && this.currentDream.startedAt === dreamId) {
        this.currentDream.endedAt = Date.now();
        this.emit('dream_complete', this.currentDream);
        this.currentDream = undefined;
      }
    }, 30000); // 30 seconds dream
  }
  
  /**
   * Consolidate learnings from the day
   */
  private consolidateLearnings(): string[] {
    const insights: string[] = [];
    
    // Analyze patterns
    const sortedPatterns = Array.from(this.patterns.entries())
      .sort((a, b) => b[1].count - a[1].count);
    
    if (sortedPatterns.length > 0) {
      insights.push(`Most frequent pattern: ${sortedPatterns[0][0]}`);
    }
    
    // Analyze action history
    const actionTypes = new Map<string, number>();
    for (const action of this.actionHistory.slice(-50)) {
      actionTypes.set(action.type, (actionTypes.get(action.type) || 0) + 1);
    }
    
    const mostCommon = Array.from(actionTypes.entries())
      .sort((a, b) => b[1] - a[1])[0];
    
    if (mostCommon) {
      insights.push(`Most common action type: ${mostCommon[0]}`);
    }
    
    return insights;
  }
  
  /**
   * Learn patterns from ticks
   */
  private learnPatterns(tick: KAIROSTick): void {
    // This would integrate with actual pattern detection
    // For now, just track time-based patterns
    const hour = new Date(tick.timestamp).getHours();
    const pattern = `hour_${hour}`;
    
    const existing = this.patterns.get(pattern);
    if (existing) {
      existing.count++;
      existing.lastSeen = tick.timestamp;
    } else {
      this.patterns.set(pattern, { count: 1, lastSeen: tick.timestamp });
    }
  }
  
  /**
   * Update configuration
   */
  updateConfig(config: Partial<KAIROSConfig>): void {
    this.config = { ...this.config, ...config };
    this.heartbeat = new KAIROSHeartbeat(this.config);
  }
  
  /**
   * Get current config
   */
  getConfig(): KAIROSConfig {
    return { ...this.config };
  }
  
  /**
   * Get action history
   */
  getActionHistory(): KAIROSAction[] {
    return [...this.actionHistory];
  }
  
  /**
   * Get current dream
   */
  getCurrentDream(): KAIROSDream | undefined {
    return this.currentDream;
  }

  /**
   * Get state
   */
  getState(): HeartbeatState {
    return this.heartbeat.getState();
  }

  /**
   * Health check — returns whether KAIROS tick loop is healthy
   * Unhealthy if: lastTick > 3x tickInterval ago OR tickInterval is null
   */
  isHealthy(): boolean {
    if (!this.isRunning) return false;
    const state = this.heartbeat.getState();
    const elapsed = Date.now() - state.lastTick;
    return elapsed < this.config.tickInterval * 3;
  }

  /**
   * Get health report
   */
  getHealthReport(): {
    healthy: boolean;
    isRunning: boolean;
    lastTick: number;
    tickInterval: number;
    consecutiveIdleTicks: number;
    consecutiveActiveTicks: number;
    isIdle: boolean;
    isAsleep: boolean;
    actionHistorySize: number;
    patternCount: number;
  } {
    const state = this.heartbeat.getState();
    return {
      healthy: this.isHealthy(),
      isRunning: this.isRunning,
      lastTick: state.lastTick,
      tickInterval: this.config.tickInterval,
      consecutiveIdleTicks: state.consecutiveIdleTicks,
      consecutiveActiveTicks: state.consecutiveActiveTicks,
      isIdle: state.isIdle,
      isAsleep: state.isAsleep,
      actionHistorySize: this.actionHistory.length,
      patternCount: this.patterns.size,
    };
  }
  
  /**
   * Check if running
   */
  isActive(): boolean {
    return this.isRunning;
  }
}

// ============================================================================
// QUICK ACCESS FUNCTIONS
// ============================================================================

let globalKAIROS: KAIROS | null = null;

export function getKAIROS(): KAIROS {
  if (!globalKAIROS) {
    globalKAIROS = new KAIROS();
  }
  return globalKAIROS;
}

export function startKAIROS(config?: Partial<KAIROSConfig>): KAIROS {
  const kairos = getKAIROS();
  kairos.updateConfig(config || {});
  kairos.start();
  return kairos;
}

export function stopKAIROS(): void {
  getKAIROS().stop();
}

export default KAIROS;
