/**
 * 🦆 Duck Agent - KAIROS Proactive AI
 * Always-on background agent that acts without being asked
 * Based on the KAIROS system from Claude Code leak
 */

import { EventEmitter } from 'events';
import { Agent } from '../core.js';

export interface KAIROSConfig {
  enabled?: boolean;
  heartbeatInterval?: number;  // ms between heartbeats
  maxActionsPerCycle?: number;
  autoDreamEnabled?: boolean;
  autoDreamTime?: string;    // HH:MM format
  notificationEnabled?: boolean;
  pushbulletToken?: string;
}

export interface KairosAction {
  timestamp: number;
  action: string;
  reason: string;
  result: any;
  success: boolean;
}

export interface KairosDecision {
  shouldAct: boolean;
  reason: string;
  confidence: number;
  suggestedAction?: string;
}

export interface DailyLog {
  date: string;
  noticed: string[];
  decisions: KairosDecision[];
  actions: KairosAction[];
  dreams: string[];
}

/**
 * KAIROS - Proactive AI System
 * 
 * Features:
 * - Heartbeat system (checks "anything worth doing?")
 * - Proactive decision engine
 * - Auto-notifications
 * - Daily auto-dream consolidation
 * - Append-only action logs
 */
export class KAIROS extends EventEmitter {
  private config: KAIROSConfig;
  private agent: Agent;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private dreamTimer: NodeJS.Timeout | null = null;
  private dailyLog: DailyLog;
  private isRunning: boolean = false;
  private lastHeartbeat: number = 0;
  private actionHistory: KairosAction[] = [];
  private learnedPatterns: Map<string, number> = new Map();

  constructor(agent: Agent, config: KAIROSConfig = {}) {
    super();
    this.agent = agent;
    this.config = {
      enabled: config.enabled ?? true,
      heartbeatInterval: config.heartbeatInterval ?? 30000,  // 30 seconds default
      maxActionsPerCycle: config.maxActionsPerCycle ?? 3,
      autoDreamEnabled: config.autoDreamEnabled ?? true,
      autoDreamTime: config.autoDreamTime ?? '03:00',  // 3 AM
      notificationEnabled: config.notificationEnabled ?? true,
      ...config,
    };
    
    this.dailyLog = this.initDailyLog();
  }

  /**
   * Initialize daily log
   */
  private initDailyLog(): DailyLog {
    return {
      date: new Date().toISOString().split('T')[0],
      noticed: [],
      decisions: [],
      actions: [],
      dreams: [],
    };
  }

  /**
   * Start KAIROS
   */
  async start(): Promise<void> {
    if (this.isRunning) return;
    
    console.log('🧠 KAIROS starting...');
    this.isRunning = true;
    
    // Start heartbeat
    this.startHeartbeat();
    
    // Schedule auto-dream
    if (this.config.autoDreamEnabled) {
      this.scheduleAutoDream();
    }
    
    // Load previous patterns
    this.loadPatterns();
    
    console.log(`✅ KAIROS active! Heartbeat every ${this.config.heartbeatInterval}ms`);
    this.emit('started');
  }

  /**
   * Stop KAIROS
   */
  async stop(): Promise<void> {
    if (!this.isRunning) return;
    
    console.log('🧠 KAIROS stopping...');
    this.isRunning = false;
    
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    
    if (this.dreamTimer) {
      clearTimeout(this.dreamTimer);
      this.dreamTimer = null;
    }
    
    // Save patterns
    this.savePatterns();
    
    // Archive today's log
    this.archiveLog();
    
    console.log('💤 KAIROS stopped');
    this.emit('stopped');
  }

  /**
   * Start heartbeat loop
   */
  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(async () => {
      await this.heartbeat();
    }, this.config.heartbeatInterval);
    
    // Run immediately
    this.heartbeat();
  }

  /**
   * Heartbeat - the core KAIROS loop
   * Runs every interval and asks "anything worth doing?"
   */
  private async heartbeat(): Promise<void> {
    this.lastHeartbeat = Date.now();
    
    try {
      // Check for new day
      this.checkNewDay();
      
      // Build context
      const context = await this.buildContext();
      
      // Make decision
      const decision = await this.decide(context);
      
      // Log decision
      this.dailyLog.decisions.push(decision);
      
      if (decision.shouldAct) {
        console.log(`💭 KAIROS: ${decision.reason}`);
        await this.act(decision, context);
      }
      
      this.emit('heartbeat', { decision, context });
    } catch (error) {
      console.error('KAIROS heartbeat error:', error);
      this.emit('error', error);
    }
  }

  /**
   * Build context for decision making
   */
  private async buildContext(): Promise<Record<string, any>> {
    const status = this.agent.getStatus();
    const recentActions = this.actionHistory.slice(-10);
    
    return {
      time: new Date().toISOString(),
      agent: {
        name: status.name,
        interactions: status.historyLength,
        lastError: status.metrics.failedInteractions > 0 ? "has errors" : "no errors",
      },
      patterns: Array.from(this.learnedPatterns.entries()),
      recentActions,
      system: {
        memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024,
        uptime: 0,
      },
      learnedPatterns: this.learnedPatterns,
    };
  }

  /**
   * Decide if we should act
   * This is the core decision engine
   */
  private async decide(context: Record<string, any>): Promise<KairosDecision> {
    // Ask the agent if there's anything worth doing
    const prompt = this.buildDecisionPrompt(context);
    const response = await this.agent.think(prompt);
    
    // Parse response
    const shouldAct = response.toLowerCase().includes('yes') || 
                      response.toLowerCase().includes('take action') ||
                      response.toLowerCase().includes('proceed');
    
    const confidence = this.extractConfidence(response);
    const reason = this.extractReason(response);
    
    return {
      shouldAct,
      reason: reason || 'Based on heartbeat check',
      confidence,
      suggestedAction: shouldAct ? this.extractAction(response) : undefined,
    };
  }

  /**
   * Build decision prompt
   */
  private buildDecisionPrompt(context: Record<string, any>): string {
    const patterns = Array.from(this.learnedPatterns.keys()).slice(0, 5);
    const recent = context.recentActions.map((a: any) => a.action).join(', ') || 'none';
    
    return `KAIROS HEARTBEAT CHECK (${new Date().toISOString()})

You are an always-on AI assistant. Evaluate if ANYTHING is worth doing right now.

CONTEXT:
- Time: ${context.time}
- Recent actions: ${recent}
- Learned patterns: ${patterns.length > 0 ? patterns.join(', ') : 'none'}
- Agent status: ${context.agent.interactions} interactions, ${context.agent.lastError || 'no errors'}

SYSTEM:
- Memory: ${context.system.memoryUsage.toFixed(1)} MB
- Uptime: ${Math.floor(context.system.uptime / 1000)}s

Based on this context, should you take any action?

OPTIONS:
1. If something needs attention (error recovery, monitoring, maintenance) → TAKE ACTION
2. If the user might need notification → TAKE ACTION  
3. If you notice patterns worth acting on → TAKE ACTION
4. If everything is fine → STAY QUIET

Respond with:
- YES + action if something needs doing
- NO if everything is fine

Be concise. You have ${this.config.maxActionsPerCycle} max actions per cycle.`;
  }

  /**
   * Extract confidence from response
   */
  private extractConfidence(response: string): number {
    const match = response.match(/(\d+)%/);
    if (match) return parseInt(match[1]) / 100;
    
    const low = response.match(/low|maybe|probably not/i);
    if (low) return 0.3;
    
    const med = response.match(/medium|moderate|maybe/i);
    if (med) return 0.6;
    
    const high = response.match(/high|definitely|absolutely|yes/i);
    if (high) return 0.9;
    
    return 0.5;
  }

  /**
   * Extract reason from response
   */
  private extractReason(response: string): string {
    // Try to find a reason
    const match = response.match(/because (.+)/i) || 
                  response.match(/reason: (.+)/i) ||
                  response.match(/since (.+)/i);
    if (match) return match[1].substring(0, 100);
    
    return response.substring(0, 100);
  }

  /**
   * Extract suggested action
   */
  private extractAction(response: string): string {
    const match = response.match(/action: (.+)/i) || 
                  response.match(/do: (.+)/i) ||
                  response.match(/^(.+)$/m);
    return match ? match[1].trim() : 'general check';
  }

  /**
   * Take action based on decision
   */
  private async act(decision: KairosDecision, context: Record<string, any>): Promise<void> {
    if (!decision.shouldAct || !decision.suggestedAction) return;
    
    const action: KairosAction = {
      timestamp: Date.now(),
      action: decision.suggestedAction,
      reason: decision.reason,
      result: null,
      success: false,
    };
    
    try {
      // Execute the action
      const result = await this.agent.think(`Execute this action: ${decision.suggestedAction}`);
      action.result = result;
      action.success = true;
      
      // Learn from action
      this.learn(action);
      
      // Notify if enabled
      if (this.config.notificationEnabled) {
        await this.notify(action);
      }
      
      this.dailyLog.actions.push(action);
      this.actionHistory.push(action);
      
      console.log(`✅ KAIROS acted: ${decision.suggestedAction}`);
      this.emit('action', action);
    } catch (error) {
      action.result = { error: error instanceof Error ? error.message : 'Unknown error' };
      action.success = false;
      console.error(`❌ KAIROS action failed: ${error}`);
      this.emit('action_failed', action);
    }
  }

  /**
   * Learn from actions
   */
  private learn(action: KairosAction): void {
    const key = action.action.substring(0, 50);
    const current = this.learnedPatterns.get(key) || 0;
    this.learnedPatterns.set(key, current + (action.success ? 1 : -1));
    
    // Emit learning event
    this.emit('learned', { pattern: key, count: this.learnedPatterns.get(key) });
  }

  /**
   * Send notification
   */
  private async notify(action: KairosAction): Promise<void> {
    // This would integrate with push notifications
    // For now, just emit the event
    this.emit('notification', {
      title: 'KAIROS Action',
      body: `${action.action}: ${action.success ? '✅' : '❌'}`,
      action,
    });
  }

  /**
   * Schedule auto-dream
   */
  private scheduleAutoDream(): void {
    const [hours, minutes] = this.config.autoDreamTime!.split(':').map(Number);
    const now = new Date();
    const dreamTime = new Date();
    dreamTime.setHours(hours, minutes, 0, 0);
    
    // If time has passed today, schedule for tomorrow
    if (dreamTime <= now) {
      dreamTime.setDate(dreamTime.getDate() + 1);
    }
    
    const msUntilDream = dreamTime.getTime() - now.getTime();
    
    this.dreamTimer = setTimeout(async () => {
      await this.autoDream();
      // Reschedule for next day
      if (this.config.autoDreamEnabled) {
        this.scheduleAutoDream();
      }
    }, msUntilDream);
    
    console.log(`💭 KAIROS auto-dream scheduled for ${dreamTime.toISOString()}`);
  }

  /**
   * Auto-dream - consolidate learnings while user sleeps
   */
  private async autoDream(): Promise<void> {
    console.log('💭 KAIROS: Starting auto-dream...');
    
    const learnings = Array.from(this.learnedPatterns.entries())
      .map(([pattern, score]) => `${pattern}: ${score > 0 ? '✅' : '❌'} (${score})`)
      .join('\n');
    
    const prompt = `KAIROS AUTO-DREAM - ${new Date().toISOString()}

You are consolidating what you learned today. Review these patterns and actions:

LEARNED PATTERNS:
${learnings}

TODAY'S ACTIONS:
${this.dailyLog.actions.map(a => `- ${a.action}: ${a.success ? '✅' : '❌'}`).join('\n')}

NOTICED:
${this.dailyLog.noticed.join('\n') || 'Nothing notable'}

Create a summary of:
1. What you learned today
2. What patterns emerged
3. What you should watch for tomorrow
4. Any adjustments to your behavior

Keep it concise - this is dream consolidation, not detailed analysis.`;

    const dream = await this.agent.think(prompt);
    this.dailyLog.dreams.push(dream);
    
    // Emit dream event
    this.emit('dream', dream);
    
    console.log('💭 KAIROS: Auto-dream complete');
  }

  /**
   * Check for new day and reset log
   */
  private checkNewDay(): void {
    const today = new Date().toISOString().split('T')[0];
    if (this.dailyLog.date !== today) {
      // Archive old log
      this.archiveLog();
      // Start new log
      this.dailyLog = this.initDailyLog();
      console.log(`🗓️ KAIROS: New day started`);
    }
  }

  /**
   * Archive daily log
   */
  private archiveLog(): void {
    if (this.dailyLog.actions.length === 0 && this.dailyLog.dreams.length === 0) return;
    
    // In a real system, this would save to a file/database
    const logEntry = JSON.stringify({
      timestamp: Date.now(),
      ...this.dailyLog,
    }, null, 2);
    
    // Emit for external storage
    this.emit('log', logEntry);
    
    console.log(`📝 KAIROS: Archived log for ${this.dailyLog.date}`);
  }

  /**
   * Save patterns to storage
   */
  private savePatterns(): void {
    // Emit for external storage
    const patterns = Object.fromEntries(this.learnedPatterns);
    this.emit('save_patterns', patterns);
  }

  /**
   * Load patterns from storage
   */
  private loadPatterns(): void {
    // This would load from a file/database
    // For now, just emit event
    this.emit('load_patterns');
  }

  /**
   * Get daily log
   */
  getDailyLog(): DailyLog {
    return { ...this.dailyLog };
  }

  /**
   * Get learned patterns
   */
  getPatterns(): Record<string, number> {
    return Object.fromEntries(this.learnedPatterns);
  }

  /**
   * Force a heartbeat check
   */
  async forceHeartbeat(): Promise<KairosDecision> {
    const context = await this.buildContext();
    const decision = await this.decide(context);
    
    if (decision.shouldAct) {
      await this.act(decision, context);
    }
    
    return decision;
  }

  /**
   * Get status
   */
  getStatus(): any {
    return {
      running: this.isRunning,
      heartbeatInterval: this.config.heartbeatInterval,
      lastHeartbeat: this.lastHeartbeat,
      actionsToday: this.dailyLog.actions.length,
      decisionsToday: this.dailyLog.decisions.length,
      patternsLearned: this.learnedPatterns.size,
      autoDreamEnabled: this.config.autoDreamEnabled,
      autoDreamTime: this.config.autoDreamTime,
    };
  }
}

export default KAIROS;
