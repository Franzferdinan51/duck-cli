/**
 * Duck CLI - Security Monitor
 * 
 * DEFCON-style security monitoring:
 * - Dependency scanning
 * - Secret detection
 * - CVE monitoring
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

enum SecurityLevel {
  GREEN = 5,
  YELLOW = 4,
  ORANGE = 3,
  RED = 2,
  BLACK = 1
}

interface SecurityAlert {
  level: SecurityLevel;
  type: string;
  title: string;
  description: string;
  fix?: string;
}

export class SecurityMonitor {
  private level: SecurityLevel = SecurityLevel.GREEN;
  private alerts: SecurityAlert[] = [];

  async audit(): Promise<void> {
    this.alerts = [];
    
    // Check npm/yarn dependencies
    await this.checkDependencies();
    
    // Check for secrets
    await this.checkSecrets();
    
    // Update DEFCON level
    this.updateLevel();
  }

  private async checkDependencies(): Promise<void> {
    // npm audit
    try {
      const { stdout } = await execAsync('npm audit --json 2>/dev/null', { 
        timeout: 30000 
      });
      
      const result = JSON.parse(stdout);
      const vulns = result.vulnerabilities || {};
      
      for (const [name, vuln] of Object.entries(vulns as Record<string, any>)) {
        if (vuln.severity === 'critical') {
          this.alerts.push({
            level: SecurityLevel.RED,
            type: 'vulnerability',
            title: `Critical: ${name}`,
            description: `Critical vulnerability in ${name}`,
            fix: `npm audit fix --force`
          });
        } else if (vuln.severity === 'high') {
          this.alerts.push({
            level: SecurityLevel.ORANGE,
            type: 'vulnerability',
            title: `High: ${name}`,
            description: `High severity vulnerability in ${name}`,
            fix: `npm audit fix`
          });
        }
      }
    } catch {
      // npm audit not available or no package.json
    }
  }

  private async checkSecrets(): Promise<void> {
    const patterns = [
      { pattern: 'sk-[a-zA-Z0-9]{20,}', name: 'OpenAI API Key' },
      { pattern: 'ghp_[a-zA-Z0-9]{20,}', name: 'GitHub Token' },
      { pattern: 'AIza[a-zA-Z0-9_-]{35}', name: 'Google API Key' },
      { pattern: 'password\\s*=\\s*["\'][^"\']{8,}["\']', name: 'Hardcoded Password' }
    ];

    for (const { pattern, name } of patterns) {
      try {
        const { stdout } = await execAsync(
          `grep -r -E "${pattern}" --include="*.ts" --include="*.js" --include="*.json" --include="*.yaml" . 2>/dev/null | head -5`,
          { timeout: 10000 }
        );
        
        if (stdout.trim()) {
          this.alerts.push({
            level: SecurityLevel.RED,
            type: 'secret',
            title: `Secret detected: ${name}`,
            description: `Potential ${name} found in codebase`,
            fix: 'Remove hardcoded secrets, use environment variables'
          });
        }
      } catch {
        // No matches or grep error
      }
    }
  }

  private updateLevel(): void {
    if (this.alerts.some(a => a.level === SecurityLevel.BLACK)) {
      this.level = SecurityLevel.BLACK;
    } else if (this.alerts.some(a => a.level === SecurityLevel.RED)) {
      this.level = SecurityLevel.RED;
    } else if (this.alerts.some(a => a.level === SecurityLevel.ORANGE)) {
      this.level = SecurityLevel.ORANGE;
    } else if (this.alerts.length > 0) {
      this.level = SecurityLevel.YELLOW;
    } else {
      this.level = SecurityLevel.GREEN;
    }
  }

  getStatus(): string {
    const levelName = [
      '',
      '🔴🔴 DEFCON 1 - CRITICAL',
      '🔴 DEFCON 2 - HIGH',
      '🟠 DEFCON 3 - ELEVATED',
      '🟡 DEFCON 4 - MINOR',
      '🟢 DEFCON 5 - ALL CLEAR'
    ][this.level];

    let output = `\n${levelName}\n`;
    
    if (this.alerts.length > 0) {
      output += `\nAlerts:\n`;
      for (const alert of this.alerts) {
        output += `  • [${alert.type}] ${alert.title}\n`;
        if (alert.fix) {
          output += `    Fix: ${alert.fix}\n`;
        }
      }
    }
    
    return output;
  }

  getLevel(): SecurityLevel {
    return this.level;
  }

  getAlerts(): SecurityAlert[] {
    return this.alerts;
  }
}
