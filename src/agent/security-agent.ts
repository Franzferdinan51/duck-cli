/**
 * 🛡️ Duck Agent - Enhanced Security Meta Agent
 * Specialized security agent with vulnerability scanning, audit, and threat detection
 */

import { EventEmitter } from 'events';
import { promises as fs } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import { homedir } from 'os';
import { join } from 'path';

const execAsync = promisify(exec);

export interface SecurityScanResult {
  timestamp: Date;
  scanType: string;
  findings: SecurityFinding[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  recommendations: string[];
}

export interface SecurityFinding {
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
  category: string;
  title: string;
  description: string;
  location?: string;
  remediation?: string;
}

export interface AuditLog {
  timestamp: Date;
  event: string;
  user?: string;
  action: string;
  result: 'success' | 'failure' | 'blocked';
  details?: Record<string, any>;
}

/**
 * Enhanced Security Agent
 * Provides comprehensive security monitoring and enforcement
 */
export class SecurityAgent extends EventEmitter {
  private auditLogs: AuditLog[] = [];
  private scanHistory: SecurityScanResult[] = [];
  private threatPatterns: RegExp[] = [
    /rm\s+-rf\s+\//i,  // Dangerous rm command
    /:\(\)\s*\{\s*:\|:&\s*\};:/i,  // Fork bomb
    /eval\s*\(/i,  // Dangerous eval
    /child_process/i,  // Node child_process in untrusted code
    /exec\s*\(/i,  // Command execution
    /system\s*\(/i,  // System calls
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,  // XSS
    /SELECT\s+.*\s+FROM\s+.*\s+WHERE\s+.*=/i,  // SQL injection pattern
  ];

  constructor() {
    super();
    this.loadAuditLogs();
  }

  /**
   * Scan for vulnerabilities in code or commands
   */
  async scanVulnerabilities(target: string, type: 'code' | 'command' | 'file' = 'code'): Promise<SecurityScanResult> {
    const findings: SecurityFinding[] = [];
    
    // Check for threat patterns
    for (const pattern of this.threatPatterns) {
      if (pattern.test(target)) {
        findings.push({
          severity: 'critical',
          category: 'dangerous_pattern',
          title: 'Dangerous Pattern Detected',
          description: `Pattern matched: ${pattern.source}`,
          location: target.substring(0, 100),
          remediation: 'Review and sanitize input before execution'
        });
      }
    }

    // Check for hardcoded secrets
    const secretPatterns = [
      { pattern: /api[_-]?key\s*[:=]\s*['"][a-zA-Z0-9]{16,}['"]/i, name: 'API Key' },
      { pattern: /password\s*[:=]\s*['"][^'"]{8,}['"]/i, name: 'Password' },
      { pattern: /secret\s*[:=]\s*['"][a-zA-Z0-9]{16,}['"]/i, name: 'Secret' },
      { pattern: /token\s*[:=]\s*['"][a-zA-Z0-9]{20,}['"]/i, name: 'Token' },
      { pattern: /sk-[a-zA-Z0-9]{20,}/i, name: 'OpenAI-style Key' },
    ];

    for (const { pattern, name } of secretPatterns) {
      if (pattern.test(target)) {
        findings.push({
          severity: 'high',
          category: 'exposed_secret',
          title: `Potential ${name} Exposed`,
          description: `Found pattern that may indicate exposed ${name}`,
          remediation: 'Move secrets to environment variables or secure vault'
        });
      }
    }

    // File-specific checks
    if (type === 'file') {
      try {
        const stats = await fs.stat(target);
        if (stats.mode & 0o002) {
          findings.push({
            severity: 'medium',
            category: 'permissions',
            title: 'World-Writable File',
            description: `${target} is world-writable`,
            remediation: 'chmod o-w ' + target
          });
        }
      } catch (e) {
        // File doesn't exist or can't be accessed
      }
    }

    const result: SecurityScanResult = {
      timestamp: new Date(),
      scanType: type,
      findings,
      riskLevel: this.calculateRiskLevel(findings),
      recommendations: this.generateRecommendations(findings)
    };

    this.scanHistory.push(result);
    this.emit('scanComplete', result);
    
    return result;
  }

  /**
   * Audit system for security issues
   */
  async auditSystem(): Promise<SecurityScanResult> {
    const findings: SecurityFinding[] = [];

    // Check for .env files with secrets
    try {
      const envPath = join(process.cwd(), '.env');
      const envContent = await fs.readFile(envPath, 'utf-8');
      
      if (envContent.includes('KEY') || envContent.includes('SECRET') || envContent.includes('TOKEN')) {
        const stats = await fs.stat(envPath);
        if (stats.mode & 0o044) {
          findings.push({
            severity: 'high',
            category: 'permissions',
            title: '.env File Too Permissive',
            description: '.env file is readable by group/others',
            location: envPath,
            remediation: 'chmod 600 .env'
          });
        }
      }
    } catch (e) {
      // No .env file
    }

    // Check for node_modules with known vulnerabilities
    try {
      const packageJsonPath = join(process.cwd(), 'package.json');
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
      
      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
      const knownVulnerable = ['lodash@<4.17.21', 'axios@<0.21.1', 'minimist@<1.2.3'];
      
      for (const [name, version] of Object.entries(deps)) {
        // Simple version check (in production, use npm audit)
        if (typeof version === 'string' && version.includes('^0.')) {
          findings.push({
            severity: 'low',
            category: 'dependencies',
            title: `Potentially Outdated Dependency: ${name}`,
            description: `${name}@${version} may have known vulnerabilities`,
            remediation: `npm audit fix or update ${name}`
          });
        }
      }
    } catch (e) {
      // No package.json
    }

    // Check SSH key permissions
    try {
      const sshDir = join(homedir(), '.ssh');
      const files = await fs.readdir(sshDir);
      for (const file of files) {
        if (file.endsWith('_rsa') || file.endsWith('_ed25519') || file === 'id_rsa' || file === 'id_ed25519') {
          const keyPath = join(sshDir, file);
          const stats = await fs.stat(keyPath);
          if (stats.mode & 0o077) {
            findings.push({
              severity: 'high',
              category: 'permissions',
              title: 'SSH Key Too Permissive',
              description: `${file} has overly permissive permissions`,
              location: keyPath,
              remediation: `chmod 600 ${keyPath}`
            });
          }
        }
      }
    } catch (e) {
      // No SSH directory
    }

    const result: SecurityScanResult = {
      timestamp: new Date(),
      scanType: 'system_audit',
      findings,
      riskLevel: this.calculateRiskLevel(findings),
      recommendations: this.generateRecommendations(findings)
    };

    this.scanHistory.push(result);
    this.emit('auditComplete', result);
    
    return result;
  }

  /**
   * Check permissions for a file or directory
   */
  async checkPermissions(path: string): Promise<SecurityFinding[]> {
    const findings: SecurityFinding[] = [];
    
    try {
      const stats = await fs.stat(path);
      const mode = stats.mode;
      
      // Check world-writable
      if (mode & 0o002) {
        findings.push({
          severity: 'medium',
          category: 'permissions',
          title: 'World-Writable',
          description: `${path} is writable by anyone`,
          location: path,
          remediation: `chmod o-w ${path}`
        });
      }
      
      // Check world-readable sensitive files
      if ((path.includes('.env') || path.includes('secret') || path.includes('key')) && (mode & 0o044)) {
        findings.push({
          severity: 'high',
          category: 'permissions',
          title: 'Sensitive File World-Readable',
          description: `${path} contains sensitive data and is readable by anyone`,
          location: path,
          remediation: `chmod 600 ${path}`
        });
      }
      
      // Check setuid/setgid
      if (mode & 0o4000 || mode & 0o2000) {
        findings.push({
          severity: 'info',
          category: 'permissions',
          title: 'Setuid/Setgid Bit Set',
          description: `${path} has elevated privileges bit set`,
          location: path,
          remediation: 'Verify this is intentional: ls -la ' + path
        });
      }
    } catch (e) {
      findings.push({
        severity: 'info',
        category: 'access',
        title: 'Cannot Access Path',
        description: `Unable to check permissions for ${path}`,
        location: path
      });
    }
    
    return findings;
  }

  /**
   * Analyze logs for security events
   */
  async analyzeLogs(logPath?: string): Promise<SecurityFinding[]> {
    const findings: SecurityFinding[] = [];
    
    // Check for common attack patterns in logs
    const attackPatterns = [
      { pattern: /failed.*password/i, name: 'Failed Login Attempts', severity: 'medium' as const },
      { pattern: /authentication.*failure/i, name: 'Authentication Failures', severity: 'medium' as const },
      { pattern: /sql.*injection/i, name: 'SQL Injection Attempt', severity: 'critical' as const },
      { pattern: /xss|cross.site.scripting/i, name: 'XSS Attempt', severity: 'high' as const },
      { pattern: /path.*traversal/i, name: 'Path Traversal Attempt', severity: 'high' as const },
      { pattern: /brute.*force/i, name: 'Brute Force Attack', severity: 'high' as const },
    ];
    
    try {
      const targetLog = logPath || '/var/log/system.log';
      const logContent = await fs.readFile(targetLog, 'utf-8').catch(() => '');
      
      for (const { pattern, name, severity } of attackPatterns) {
        const matches = logContent.match(pattern);
        if (matches && matches.length > 5) {
          findings.push({
            severity,
            category: 'intrusion',
            title: name,
            description: `Found ${matches.length} occurrences of ${name} pattern`,
            location: targetLog,
            remediation: 'Review logs and consider blocking source IPs'
          });
        }
      }
    } catch (e) {
      // Log analysis failed
    }
    
    return findings;
  }

  /**
   * Log a security event
   */
  logEvent(event: string, action: string, result: AuditLog['result'], details?: Record<string, any>): void {
    const log: AuditLog = {
      timestamp: new Date(),
      event,
      action,
      result,
      details,
      user: process.env.USER
    };
    
    this.auditLogs.push(log);
    this.emit('securityEvent', log);
    
    // Keep only last 1000 logs
    if (this.auditLogs.length > 1000) {
      this.auditLogs = this.auditLogs.slice(-1000);
    }
  }

  /**
   * Get recent audit logs
   */
  getAuditLogs(limit: number = 100): AuditLog[] {
    return this.auditLogs.slice(-limit);
  }

  /**
   * Get scan history
   */
  getScanHistory(): SecurityScanResult[] {
    return this.scanHistory;
  }

  /**
   * Calculate overall risk level from findings
   */
  private calculateRiskLevel(findings: SecurityFinding[]): SecurityScanResult['riskLevel'] {
    if (findings.some(f => f.severity === 'critical')) return 'critical';
    if (findings.some(f => f.severity === 'high')) return 'high';
    if (findings.some(f => f.severity === 'medium')) return 'medium';
    return 'low';
  }

  /**
   * Generate recommendations from findings
   */
  private generateRecommendations(findings: SecurityFinding[]): string[] {
    const recommendations = new Set<string>();
    
    for (const finding of findings) {
      if (finding.remediation) {
        recommendations.add(finding.remediation);
      }
      
      // Add category-specific recommendations
      switch (finding.category) {
        case 'permissions':
          recommendations.add('Review file permissions regularly');
          break;
        case 'exposed_secret':
          recommendations.add('Use a secrets manager (e.g., 1Password, Vault)');
          break;
        case 'dependencies':
          recommendations.add('Run npm audit regularly and fix vulnerabilities');
          break;
        case 'intrusion':
          recommendations.add('Consider implementing fail2ban or similar');
          break;
      }
    }
    
    return Array.from(recommendations);
  }

  /**
   * Load audit logs from disk
   */
  private async loadAuditLogs(): Promise<void> {
    try {
      const logPath = join(homedir(), '.duck-cli', 'security-audit.json');
      const data = await fs.readFile(logPath, 'utf-8');
      const parsed = JSON.parse(data);
      this.auditLogs = parsed.map((l: any) => ({
        ...l,
        timestamp: new Date(l.timestamp)
      }));
    } catch (e) {
      // No existing logs
    }
  }

  /**
   * Save audit logs to disk
   */
  async saveAuditLogs(): Promise<void> {
    try {
      const logPath = join(homedir(), '.duck-cli', 'security-audit.json');
      await fs.mkdir(join(homedir(), '.duck-cli'), { recursive: true });
      await fs.writeFile(logPath, JSON.stringify(this.auditLogs, null, 2));
    } catch (e) {
      console.error('Failed to save audit logs:', e);
    }
  }

  /**
   * Get security status summary
   */
  getStatus(): {
    totalScans: number;
    totalEvents: number;
    lastScan: Date | null;
    criticalFindings: number;
    highFindings: number;
  } {
    const allFindings = this.scanHistory.flatMap(s => s.findings);
    
    return {
      totalScans: this.scanHistory.length,
      totalEvents: this.auditLogs.length,
      lastScan: this.scanHistory.length > 0 ? this.scanHistory[this.scanHistory.length - 1].timestamp : null,
      criticalFindings: allFindings.filter(f => f.severity === 'critical').length,
      highFindings: allFindings.filter(f => f.severity === 'high').length
    };
  }
}

export default SecurityAgent;
