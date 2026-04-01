/**
 * Duck Agent - Dangerous Tool Approval System
 * Guardrails for shell, file_write, and other risky operations
 */

export type ApprovalCallback = (
  toolName: string,
  args: Record<string, any>,
  risk: ToolRisk
) => Promise<boolean | 'always' | 'never'>;

export interface ToolRisk {
  level: 'low' | 'medium' | 'high' | 'critical';
  reasons: string[];
  suggestion?: string;
}

export interface ApprovalRule {
  toolName: string;
  patterns: RegExp[];
  riskLevel: ToolRisk['level'];
  reason: string;
  requireConfirmation: boolean;
}

export interface ApprovalLog {
  toolName: string;
  args: Record<string, any>;
  risk: ToolRisk;
  decision: 'approved' | 'denied' | 'always' | 'never';
  timestamp: number;
  sessionId: string;
}

export class DangerousToolGuard {
  private alwaysAllow: Set<string> = new Set();
  private alwaysDeny: Set<string> = new Set();
  private approvalCallback?: ApprovalCallback;
  private approvalLog: ApprovalLog[] = [];
  private sessionId: string;
  private quietMode: boolean = false;

  // Known dangerous patterns
  private dangerousPatterns: { pattern: RegExp; risk: ToolRisk['level']; reason: string }[] = [
    // File destruction
    { pattern: /rm\s+-rf\s+\/|rm\s+-rf\s+\*/gi, risk: 'critical', reason: 'Recursive force delete of root or all files' },
    { pattern: /rm\s+-rf\s+\.\//gi, risk: 'critical', reason: 'Recursive force delete in current directory' },
    { pattern: /rm\s+-rf\s+["']?\//gi, risk: 'critical', reason: 'Force delete from root' },
    { pattern: /del\s+\/f\s+\/q\s+\*/gi, risk: 'critical', reason: 'Windows recursive delete' },
    { pattern: /dd\s+if=/gi, risk: 'critical', reason: 'Direct disk write - can destroy data' },
    { pattern: /mkfs/gi, risk: 'critical', reason: 'Filesystem format - destroys all data' },
    { pattern: /:(){ :|:& };:/gi, risk: 'critical', reason: 'Fork bomb - crashes system' },
    
    // System modification
    { pattern: /chmod\s+-R\s+777/gi, risk: 'high', reason: 'World-writable permissions on all files' },
    { pattern: /chmod\s+000/gi, risk: 'high', reason: 'Removes all permissions' },
    { pattern: /shutdown|halt|reboot|init\s+0|init\s+6/gi, risk: 'high', reason: 'System shutdown/reboot command' },
    { pattern: /systemctl\s+stop\s+(sshd|firewalld|cron)/gi, risk: 'high', reason: 'Stops critical system services' },
    { pattern: /kill\s+-9\s+1|kill\s+-9\s+$$\$/gi, risk: 'critical', reason: 'Kills critical processes' },
    { pattern: /crontab\s+-r/gi, risk: 'high', reason: 'Removes all cron jobs without confirmation' },
    { pattern: /export\s+PASSWORD|export\s+API_KEY/gi, risk: 'medium', reason: 'Exports secrets to environment' },
    
    // Network risks
    { pattern: /curl\s+http:\/\/|wget\s+http:\/\//gi, risk: 'medium', reason: 'Unencrypted HTTP request' },
    { pattern: /nc\s+-e|netcat\s+-e/gi, risk: 'high', reason: 'Reverse shell setup' },
    { pattern: /ssh\s+.*-o\s+StrictHostKeyChecking=no/gi, risk: 'medium', reason: 'Bypasses SSH host key verification' },
    
    // Data exfiltration
    { pattern: /\.(sql|db|sqlite|sqlite3)\s+.*\s+>/gi, risk: 'high', reason: 'Database export to file' },
    { pattern: /mysqldump\s+/gi, risk: 'high', reason: 'MySQL database dump' },
    { pattern: /pg_dump\s+/gi, risk: 'high', reason: 'PostgreSQL database dump' },
    
    // Git
    { pattern: /git\s+push\s+--force/gi, risk: 'medium', reason: 'Force push - can overwrite history' },
    { pattern: /git\s+push\s+--all/gi, risk: 'medium', reason: 'Pushes all branches' },
    
    // Package installation
    { pattern: /npm\s+i\s+-g\s+|npm\s+install\s+-g\s+/gi, risk: 'medium', reason: 'Global npm install - affects system' },
    { pattern: /pip\s+install\s+--user|easy_install/gi, risk: 'medium', reason: 'User package install' },
    { pattern: /brew\s+install\s+|^apt\s+get\s+install/gi, risk: 'medium', reason: 'System package installation' },
    
    // Processes
    { pattern: /killall\s+/gi, risk: 'medium', reason: 'Kills all processes by name' },
    { pattern: /pkill\s+-9/gi, risk: 'medium', reason: 'Force kills processes' },
    
    // Docker/Systemd
    { pattern: /docker\s+rm\s+-f\s+$(docker\s+ps\s+-aq)/gi, risk: 'high', reason: 'Force removes all containers' },
    { pattern: /docker\s+rmi\s+$(docker\s+images\s+-q)/gi, risk: 'high', reason: 'Deletes all images' },
    { pattern: /systemctl\s+disable\s+--now/gi, risk: 'medium', reason: 'Disables and stops service' },
  ];

  // Safe patterns (whitelist)
  private safePatterns: { pattern: RegExp; reason: string }[] = [
    { pattern: /^ls\s+|^cat\s+|^head\s+|^tail\s+|^grep\s+|^find\s+|^pwd|^echo\s+/gi, reason: 'Read-only file operations' },
    { pattern: /^git\s+(status|log|diff|show|branch)/gi, reason: 'Git read-only commands' },
    { pattern: /^ps\s+|^top\s+|^htop|^df\s+|^du\s+|^free\s+/gi, reason: 'System monitoring' },
    { pattern: /^curl\s+(-s|-S|-I|-v|--version)|wget\s+(--version|-V)/gi, reason: 'Version checks and HEAD requests' },
    { pattern: /^node\s+(-v|--version)|npm\s+(list| outdated| audit)/gi, reason: 'Version checks and audits' },
    { pattern: /^mkdir\s+|^touch\s+|^cp\s+|^mv\s+[^:]/gi, reason: 'Basic file operations (non-destructive)' },
  ];

  constructor(sessionId?: string) {
    this.sessionId = sessionId || `session_${Date.now()}`;
  }

  /**
   * Set the approval callback (called when confirmation is needed)
   */
  setApprovalCallback(cb: ApprovalCallback): void {
    this.approvalCallback = cb;
  }

  /**
   * Enable quiet mode (auto-approve low-risk, prompt for high-risk)
   */
  setQuietMode(enabled: boolean): void {
    this.quietMode = enabled;
  }

  /**
   * Analyze a command and return risk assessment
   */
  analyzeRisk(command: string, toolName: string, args: Record<string, any> = {}): ToolRisk {
    const reasons: string[] = [];
    let level: ToolRisk['level'] = 'low';

    // Check dangerous patterns
    for (const { pattern, risk, reason } of this.dangerousPatterns) {
      if (pattern.test(command)) {
        reasons.push(reason);
        if (risk === 'critical') level = 'critical';
        else if (risk === 'high' && level !== 'critical') level = 'high';
        else if (risk === 'medium' && level === 'low') level = 'medium';
      }
    }

    // Check safe patterns
    let isSafe = false;
    for (const { pattern, reason } of this.safePatterns) {
      if (pattern.test(command)) {
        reasons.push(reason);
        isSafe = true;
        break;
      }
    }

    // Length-based risk (very long commands are suspicious)
    if (command.length > 2000 && level === 'low') {
      reasons.push('Very long command - may contain obfuscated content');
      level = 'medium';
    }

    // Special args checks
    if (args.path && typeof args.path === 'string') {
      if (args.path.includes('~') && !args.path.startsWith('~/')) {
        reasons.push('Path contains ~ outside home directory');
        level = 'medium';
      }
      if (args.path.includes('/etc/') || args.path.includes('/usr/bin/')) {
        reasons.push('Modifies system directories');
        level = level === 'low' ? 'medium' : level;
      }
    }

    if (args.content && typeof args.content === 'string' && args.content.length > 100000) {
      reasons.push('Very large content - may be data exfiltration');
      level = level === 'low' ? 'medium' : level;
    }

    // Combine reasons
    if (reasons.length === 0) {
      reasons.push(isSafe ? 'Safe read-only operation' : 'Standard operation');
    }

    // Suggestion based on risk level
    let suggestion: string | undefined;
    if (level === 'critical') {
      suggestion = 'DO NOT RUN. This command can destroy data or compromise the system.';
    } else if (level === 'high') {
      suggestion = 'Verify this command is correct before proceeding.';
    } else if (level === 'medium') {
      suggestion = 'Proceed with normal caution.';
    }

    return { level, reasons, suggestion };
  }

  /**
   * Check if a tool call should proceed
   */
  async checkApproval(toolName: string, args: Record<string, any>): Promise<boolean> {
    // Check always allow/deny lists
    const key = this.buildKey(toolName, args);
    
    if (this.alwaysDeny.has(key) || this.alwaysDeny.has(toolName)) {
      this.logDecision(toolName, args, { level: 'low', reasons: ['Denied by always-deny rule'] }, 'never');
      return false;
    }

    if (this.alwaysAllow.has(key) || this.alwaysAllow.has(toolName)) {
      this.logDecision(toolName, args, { level: 'low', reasons: ['Allowed by always-allow rule'] }, 'always');
      return true;
    }

    // Build command string for analysis
    let command = '';
    if (toolName === 'shell') command = args.command || '';
    else if (toolName === 'file_write') command = `${args.path}: ${args.content?.substring(0, 200) || ''}`;
    else if (toolName === 'file_read') command = args.path || '';

    const risk = this.analyzeRisk(command, toolName, args);

    // In quiet mode, auto-approve low/medium risk
    if (this.quietMode && risk.level === 'low') {
      this.logDecision(toolName, args, risk, 'approved');
      return true;
    }

    // High/critical always need confirmation (unless in alwaysAllow)
    if (risk.level === 'high' || risk.level === 'critical') {
      if (!this.approvalCallback) {
        // No callback - default to deny for critical, prompt would be needed
        this.logDecision(toolName, args, risk, 'denied');
        return false;
      }

      const decision = await this.approvalCallback(toolName, args, risk);
      
      if (decision === 'always') {
        this.alwaysAllow.add(key);
        this.logDecision(toolName, args, risk, 'always');
        return true;
      } else if (decision === 'never') {
        this.alwaysDeny.add(key);
        this.logDecision(toolName, args, risk, 'never');
        return false;
      } else if (!decision) {
        this.logDecision(toolName, args, risk, 'denied');
        return false;
      }

      this.logDecision(toolName, args, risk, 'approved');
      return true;
    }

    // Medium risk in quiet mode - auto approve
    if (this.quietMode && risk.level === 'medium') {
      this.logDecision(toolName, args, risk, 'approved');
      return true;
    }

    // Medium risk needs callback or explicit approval
    if (risk.level === 'medium' && this.approvalCallback) {
      const decision = await this.approvalCallback(toolName, args, risk);
      if (decision === 'always') {
        this.alwaysAllow.add(key);
        this.logDecision(toolName, args, risk, 'always');
        return true;
      } else if (decision === 'never') {
        this.alwaysDeny.add(key);
        this.logDecision(toolName, args, risk, 'never');
        return false;
      } else if (!decision) {
        this.logDecision(toolName, args, risk, 'denied');
        return false;
      }
      this.logDecision(toolName, args, risk, 'approved');
      return true;
    }

    // Default: allow low risk, log
    this.logDecision(toolName, args, risk, 'approved');
    return true;
  }

  private buildKey(toolName: string, args: Record<string, any>): string {
    if (toolName === 'shell') return `shell:${args.command?.substring(0, 50) || ''}`;
    if (toolName === 'file_write') return `file_write:${args.path || ''}`;
    return toolName;
  }

  private logDecision(
    toolName: string,
    args: Record<string, any>,
    risk: ToolRisk,
    decision: ApprovalLog['decision']
  ): void {
    this.approvalLog.push({
      toolName,
      args,
      risk,
      decision,
      timestamp: Date.now(),
      sessionId: this.sessionId,
    });

    // Keep log size manageable
    if (this.approvalLog.length > 1000) {
      this.approvalLog.splice(0, 500);
    }
  }

  /**
   * Get recent approval log
   */
  getLog(limit: number = 50): ApprovalLog[] {
    return this.approvalLog.slice(-limit);
  }

  /**
   * Get stats
   */
  stats(): { total: number; approved: number; denied: number; always: number; never: number } {
    const total = this.approvalLog.length;
    const approved = this.approvalLog.filter(l => l.decision === 'approved').length;
    const denied = this.approvalLog.filter(l => l.decision === 'denied').length;
    const always = this.approvalLog.filter(l => l.decision === 'always').length;
    const never = this.approvalLog.filter(l => l.decision === 'never').length;
    return { total, approved, denied, always, never };
  }

  /**
   * Clear always allow/deny lists
   */
  resetRules(): void {
    this.alwaysAllow.clear();
    this.alwaysDeny.clear();
  }

  /**
   * Format risk for display
   */
  formatRisk(risk: ToolRisk): string {
    const icon = risk.level === 'critical' ? '🔴' 
      : risk.level === 'high' ? '🟠' 
      : risk.level === 'medium' ? '🟡' : '🟢';
    
    const lines = [
      `${icon} Risk: ${risk.level.toUpperCase()}`,
      ...risk.reasons.map(r => `   • ${r}`),
    ];
    
    if (risk.suggestion) {
      lines.push(`   💡 ${risk.suggestion}`);
    }
    
    return lines.join('\n');
  }
}

export default DangerousToolGuard;
