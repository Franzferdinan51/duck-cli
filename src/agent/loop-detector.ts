/**
 * Loop Detector - DroidClaw-inspired failure recovery
 * 
 * Detects when the agent is stuck in a loop:
 * - Same tool failing repeatedly
 * - Same action pattern repeated
 * - Agent drifting (too many meta-actions without progress)
 * 
 * Injects recovery hints to break the loop.
 */

export interface ActionRecord {
  tool: string;
  args: string;  // JSON stringified args for comparison
  success: boolean;
  timestamp: number;
}

export interface RecoveryHint {
  type: 'stuck' | 'repetition' | 'drift' | 'context';
  message: string;
  priority: 'high' | 'medium' | 'low';
}

export class LoopDetector {
  private history: ActionRecord[] = [];
  private maxHistory = 20;
  private stuckThreshold = 3;  // Same failed tool 3x = stuck
  private driftThreshold = 5; // 5+ meta actions in a row = drift

  // Meta-actions that indicate the agent is "thinking" rather than doing
  private static readonly META_TOOLS = new Set([
    'plan_create', 'plan_list', 'agent_spawn', 'agent_list',
    'session_search', 'learn_from_feedback', 'duck_council',
    'cron_list', 'memory_list', 'memory_recall'
  ]);

  record(tool: string, args: any, success: boolean): void {
    this.history.push({
      tool,
      args: JSON.stringify(args || {}),
      success,
      timestamp: Date.now()
    });
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }
  }

  /**
   * Check if agent is stuck in a loop and generate recovery hints
   */
  check(): RecoveryHint[] {
    const hints: RecoveryHint[] = [];

    if (this.history.length < 2) return hints;

    // 1. Stuck loop detection - same tool failing repeatedly
    const recentFails = this.history.slice(-10).filter(r => !r.success);
    const toolFails = new Map<string, number>();
    for (const r of recentFails) {
      toolFails.set(r.tool, (toolFails.get(r.tool) || 0) + 1);
    }
    
    for (const [tool, count] of toolFails.entries()) {
      if (count >= this.stuckThreshold) {
        hints.push({
          type: 'stuck',
          message: this.buildStuckHint(tool, count),
          priority: count >= 5 ? 'high' : 'medium'
        });
        break; // Only one stuck hint at a time
      }
    }

    // 2. Repetition detection - same action (tool + similar args) repeated
    const recent = this.history.slice(-8);
    const actionFreq = new Map<string, number>();
    for (const r of recent) {
      const key = `${r.tool}:${r.args}`;
      actionFreq.set(key, (actionFreq.get(key) || 0) + 1);
    }
    for (const [action, count] of actionFreq.entries()) {
      if (count >= 3) {
        const [tool] = action.split(':');
        hints.push({
          type: 'repetition',
          message: this.buildRepetitionHint(tool, count),
          priority: 'high'
        });
        break;
      }
    }

    // 3. Drift detection - too many meta-actions without real progress
    const recentMeta = recent.slice(-6);
    const metaCount = recentMeta.filter(r => LoopDetector.META_TOOLS.has(r.tool)).length;
    const successfulRealActions = recentMeta.filter(r => 
      !LoopDetector.META_TOOLS.has(r.tool) && r.success
    ).length;
    
    if (metaCount >= this.driftThreshold && successfulRealActions === 0) {
      hints.push({
        type: 'drift',
        message: `You've been planning/listing/spawning for ${metaCount} steps without taking a real action that succeeds. Stop planning and DO something: use a real tool like shell, file_write, web_search, or desktop_control to actually make progress.`,
        priority: 'medium'
      });
    }

    return hints;
  }

  /**
   * Get recent failed tools for context injection
   */
  getRecentFails(): string[] {
    return this.history.slice(-5).filter(r => !r.success).map(r => r.tool);
  }

  /**
   * Check if last N actions were all failures
   */
  allFailedLast(n: number): boolean {
    const recent = this.history.slice(-n);
    return recent.length >= n && recent.every(r => !r.success);
  }

  private buildStuckHint(tool: string, count: number): string {
    const hints: Record<string, string> = {
      'shell': `The "shell" command has failed ${count} times. Possible causes: (1) Command syntax is wrong — check the command format. (2) Path doesn't exist — verify the file path. (3) Permission denied — the command may not be available. Try a DIFFERENT approach instead of repeating the same command.`,
      'file_write': `File write has failed ${count} times. Possible causes: (1) Parent directory doesn't exist — create it first with shell. (2) Permission denied — check file permissions. (3) Path is invalid — use absolute paths like /tmp/... (4) Disk full. Try a DIFFERENT file path or create the directory first.`,
      'web_search': `Web search has failed ${count} times. The search API may be rate-limited or unavailable. Wait a moment and try again, or use a different search approach.`,
      'desktop_control': `Desktop control has failed ${count} times. Possible causes: (1) The target app isn't open. (2) The element coordinates changed. (3) Accessibility permission missing. Try opening the app first or use shell commands as an alternative.`,
      'memory_remember': `Memory recall has failed ${count} times. The memory system may be unavailable. Try a different approach — use session_search or just proceed without the memory context.`,
    };
    
    const genericHint = `Tool "${tool}" has failed ${count} times in recent steps. This pattern suggests either: (1) The tool has a persistent error condition, (2) The environment state hasn't changed, or (3) You're using the wrong tool for this task. You MUST try a DIFFERENT approach — don't keep repeating the same failing tool. Consider using a different tool that accomplishes the same goal, or verify the preconditions are met before retrying.`;
    
    return hints[tool] || genericHint;
  }

  private buildRepetitionHint(tool: string, count: number): string {
    return `You've attempted "${tool}" ${count} times with the same arguments. The action is clearly not working as expected. STOP REPEATING and try something completely different: (1) Try a different tool that achieves the same outcome. (2) Break the task into smaller steps. (3) Verify the preconditions are met. (4) Consider that the previous steps may have actually succeeded silently.`;
  }

  clear(): void {
    this.history = [];
  }

  getHistory(): ActionRecord[] {
    return [...this.history];
  }
}
