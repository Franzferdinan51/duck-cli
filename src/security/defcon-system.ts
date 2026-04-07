/**
 * 🛡️ Duck Agent - DEFCON Security System
 * Defense readiness condition management integrated with Security Agent
 */

import { EventEmitter } from 'events';
import { promises as fs } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

export type DefconLevel = 1 | 2 | 3 | 4 | 5;

export interface DefconState {
  level: DefconLevel;
  name: string;
  description: string;
  color: string;
  timestamp: Date;
  triggeredBy: string;
  reason: string;
  autoEscalate: boolean;
}

export interface ThreatAssessment {
  category: 'cyber' | 'physical' | 'weather' | 'health' | 'financial' | 'infrastructure';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  source: string;
  recommendedLevel: DefconLevel;
}

/**
 * DEFCON Security System
 * Manages defense readiness levels and auto-escalation
 */
export class DefconSystem extends EventEmitter {
  private currentState: DefconState;
  private history: DefconState[] = [];
  private readonly stateFile: string;
  private autoEscalationEnabled: boolean = true;

  constructor() {
    super();
    this.stateFile = join(homedir(), '.duck-cli', 'defcon-state.json');
    this.currentState = {
      level: 5,
      name: 'DEFCON 5',
      description: 'Normal readiness - All clear',
      color: '#22c55e', // green
      timestamp: new Date(),
      triggeredBy: 'system',
      reason: 'Initial state',
      autoEscalate: true
    };
    this.loadState();
  }

  /**
   * Get current DEFCON level
   */
  getCurrentLevel(): DefconState {
    return { ...this.currentState };
  }

  /**
   * Set DEFCON level manually
   */
  async setLevel(
    level: DefconLevel,
    reason: string,
    triggeredBy: string = 'manual'
  ): Promise<void> {
    const oldLevel = this.currentState.level;
    
    if (oldLevel === level) {
      return; // No change
    }

    // Archive current state
    this.history.push({ ...this.currentState });
    if (this.history.length > 100) {
      this.history = this.history.slice(-100);
    }

    // Update state
    this.currentState = {
      level,
      name: `DEFCON ${level}`,
      description: this.getLevelDescription(level),
      color: this.getLevelColor(level),
      timestamp: new Date(),
      triggeredBy,
      reason,
      autoEscalate: this.autoEscalationEnabled
    };

    // Save state
    await this.saveState();

    // Emit event
    this.emit('levelChanged', {
      oldLevel,
      newLevel: level,
      reason,
      triggeredBy
    });

    // Broadcast to mesh if available
    this.broadcastToMesh(level, reason);

    console.log(`[DEFCON] Changed from ${oldLevel} to ${level}: ${reason}`);
  }

  /**
   * Auto-escalate based on threat assessment
   */
  async assessThreat(threat: ThreatAssessment): Promise<void> {
    if (!this.autoEscalationEnabled) {
      console.log('[DEFCON] Auto-escalation disabled, threat logged but not acted upon');
      this.emit('threatDetected', { threat, action: 'logged' });
      return;
    }

    const recommendedLevel = this.calculateDefconLevel(threat);
    
    if (recommendedLevel < this.currentState.level) {
      await this.setLevel(
        recommendedLevel,
        `${threat.category} threat: ${threat.description}`,
        'security-agent'
      );
      
      this.emit('threatDetected', { 
        threat, 
        action: 'escalated',
        newLevel: recommendedLevel 
      });
    } else {
      this.emit('threatDetected', { threat, action: 'logged' });
    }
  }

  /**
   * Calculate DEFCON level from threat
   */
  private calculateDefconLevel(threat: ThreatAssessment): DefconLevel {
    // Critical threats = DEFCON 1-2
    if (threat.severity === 'critical') {
      return threat.category === 'cyber' || threat.category === 'physical' ? 1 : 2;
    }
    
    // High threats = DEFCON 3
    if (threat.severity === 'high') {
      return 3;
    }
    
    // Medium threats = DEFCON 4
    if (threat.severity === 'medium') {
      return 4;
    }
    
    // Low threats = DEFCON 5 (no change)
    return 5;
  }

  /**
   * Get level description
   */
  private getLevelDescription(level: DefconLevel): string {
    const descriptions: Record<DefconLevel, string> = {
      1: 'Maximum readiness - Nuclear war imminent or ongoing',
      2: 'Armed forces ready to deploy in 6 hours',
      3: 'Armed forces ready to deploy in 15 minutes',
      4: 'Increased intelligence watch and security',
      5: 'Normal readiness - All clear'
    };
    return descriptions[level];
  }

  /**
   * Get level color
   */
  private getLevelColor(level: DefconLevel): string {
    const colors: Record<DefconLevel, string> = {
      1: '#dc2626', // red
      2: '#ea580c', // orange-red
      3: '#f97316', // orange
      4: '#eab308', // yellow
      5: '#22c55e'  // green
    };
    return colors[level];
  }

  /**
   * Enable/disable auto-escalation
   */
  setAutoEscalation(enabled: boolean): void {
    this.autoEscalationEnabled = enabled;
    this.currentState.autoEscalate = enabled;
    console.log(`[DEFCON] Auto-escalation ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Get history
   */
  getHistory(limit: number = 10): DefconState[] {
    return this.history.slice(-limit);
  }

  /**
   * Get status for display
   */
  getStatus(): {
    current: DefconState;
    history: DefconState[];
    autoEscalation: boolean;
  } {
    return {
      current: this.getCurrentLevel(),
      history: this.getHistory(),
      autoEscalation: this.autoEscalationEnabled
    };
  }

  /**
   * Load state from disk
   */
  private async loadState(): Promise<void> {
    try {
      const data = await fs.readFile(this.stateFile, 'utf-8');
      const parsed = JSON.parse(data);
      this.currentState = {
        ...parsed.current,
        timestamp: new Date(parsed.current.timestamp)
      };
      this.history = parsed.history.map((h: any) => ({
        ...h,
        timestamp: new Date(h.timestamp)
      }));
      this.autoEscalationEnabled = parsed.autoEscalation ?? true;
    } catch (e) {
      // No existing state
    }
  }

  /**
   * Save state to disk
   */
  private async saveState(): Promise<void> {
    try {
      await fs.mkdir(join(homedir(), '.duck-cli'), { recursive: true });
      await fs.writeFile(this.stateFile, JSON.stringify({
        current: this.currentState,
        history: this.history,
        autoEscalation: this.autoEscalationEnabled
      }, null, 2));
    } catch (e) {
      console.error('[DEFCON] Failed to save state:', e);
    }
  }

  /**
   * Broadcast to mesh
   */
  private broadcastToMesh(level: DefconLevel, reason: string): void {
    // This would connect to the mesh system
    // For now, just emit event
    this.emit('meshBroadcast', { level, reason, timestamp: new Date() });
  }

  /**
   * Quick status check
   */
  isElevated(): boolean {
    return this.currentState.level <= 3;
  }

  /**
   * Check if critical
   */
  isCritical(): boolean {
    return this.currentState.level <= 2;
  }
}

export default DefconSystem;
