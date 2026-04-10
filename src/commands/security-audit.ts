/**
 * 🦆 Duck CLI - Security Audit Command
 * Full security auditing with findings, severity, and remediation
 */

import { Command } from 'commander';
import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
  accessSync,
  constants,
} from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { execSync } from 'child_process';

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface SecurityFinding {
  id: string;
  title: string;
  description: string;
  severity: Severity;
  category: string;
  location?: string;
  remediation?: string;
  references?: string[];
}

export interface AuditResult {
  timestamp: string;
  duration: number;
  findings: SecurityFinding[];
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
  riskLevel: 'critical' | 'high' | 'medium' | 'low' | 'none';
  checksRun: string[];
}

const SEVERITY_ORDER: Severity[] = ['critical', 'high', 'medium', 'low', 'info'];

export class SecurityAuditor {
  private duckDir: string;
  private checks: ((ctx: AuditContext) => Promise<SecurityFinding[]>)[] = [];

  constructor(duckDir?: string) {
    this.duckDir = duckDir || join(homedir(), '.duck');
    this.registerChecks();
  }

  private registerChecks(): void {
    // File permission checks
    this.checks.push(
      this.checkEnvPermissions.bind(this),
      this.checkConfigPermissions.bind(this),
      this.checkSecretExposures.bind(this),
      this.checkApiKeyFormats.bind(this),
      this.checkTokenExposures.bind(this),
      this.checkDependencySecurity.bind(this),
      this.checkNetworkExposures.bind(this),
      this.checkDataDirectoryPermissions.bind(this),
      this.checkLogExposures.bind(this),
      this.checkBackupSecurity.bind(this),
    );
  }

  async audit(options?: { categories?: string[]; severity?: Severity }): Promise<AuditResult> {
    const start = Date.now();
    const findings: SecurityFinding[] = [];
    const checksRun: string[] = [];

    for (const check of this.checks) {
      const name = check.name.replace(/^check/, '');
      checksRun.push(name);
      try {
        const results = await check({ duckDir: this.duckDir, options });
        findings.push(...results);
      } catch (e: any) {
        findings.push({
          id: 'ERR',
          title: `Check failed: ${name}`,
          description: e.message,
          severity: 'info',
          category: 'internal',
        });
      }
    }

    // Filter by options
    let filtered = findings;
    if (options?.categories?.length) {
      filtered = filtered.filter(f => options.categories!.includes(f.category));
    }
    if (options?.severity) {
      const sevIdx = SEVERITY_ORDER.indexOf(options.severity);
      filtered = filtered.filter(f => SEVERITY_ORDER.indexOf(f.severity) <= sevIdx);
    }

    const summary = {
      critical: filtered.filter(f => f.severity === 'critical').length,
      high: filtered.filter(f => f.severity === 'high').length,
      medium: filtered.filter(f => f.severity === 'medium').length,
      low: filtered.filter(f => f.severity === 'low').length,
      info: filtered.filter(f => f.severity === 'info').length,
    };

    const riskLevel = this.computeRiskLevel(summary);

    return {
      timestamp: new Date().toISOString(),
      duration: Date.now() - start,
      findings: filtered,
      summary,
      riskLevel,
      checksRun,
    };
  }

  private computeRiskLevel(summary: AuditResult['summary']): AuditResult['riskLevel'] {
    if (summary.critical > 0) return 'critical';
    if (summary.high > 0) return 'high';
    if (summary.medium > 0) return 'medium';
    if (summary.low > 0) return 'low';
    return 'none';
  }

  // ─── Individual Checks ──────────────────────────────────────────────────

  private async checkEnvPermissions(ctx: AuditContext): Promise<SecurityFinding[]> {
    const findings: SecurityFinding[] = [];
    const envPath = join(ctx.duckDir, '.env');
    if (existsSync(envPath)) {
      try {
        const stat = statSync(envPath);
        const mode = stat.mode & 0o777;
        if (mode !== 0o600) {
          findings.push({
            id: 'ENV-PERM-001',
            title: '.env file has incorrect permissions',
            description: `.env file permissions are ${mode.toString(8)}, should be 0600 (owner read/write only)`,
            severity: 'high',
            category: 'file-permissions',
            location: envPath,
            remediation: `Run: chmod 600 "${envPath}"`,
            references: ['https://owasp.org/www-project-top-ten/2017/A3_2017-Sensitive_Data_Exposure'],
          });
        }
      } catch { /* ignore */ }
    }
    return findings;
  }

  private async checkConfigPermissions(ctx: AuditContext): Promise<SecurityFinding[]> {
    const findings: SecurityFinding[] = [];
    const configPath = join(ctx.duckDir, 'config.yaml');
    if (existsSync(configPath)) {
      try {
        const stat = statSync(configPath);
        const mode = stat.mode & 0o777;
        if (mode !== 0o600 && mode !== 0o400) {
          findings.push({
            id: 'CFG-PERM-002',
            title: 'config.yaml has weak permissions',
            description: `config.yaml permissions are ${mode.toString(8)}, should be 0600 or 0400`,
            severity: 'medium',
            category: 'file-permissions',
            location: configPath,
            remediation: `Run: chmod 600 "${configPath}"`,
          });
        }
      } catch { /* ignore */ }
    }
    return findings;
  }

  private async checkSecretExposures(ctx: AuditContext): Promise<SecurityFinding[]> {
    const findings: SecurityFinding[] = [];
    const patterns = [
      { regex: /sk-[a-zA-Z0-9]{20,}/, name: 'OpenAI API key', type: 'openai' },
      { regex: /minimax-[a-zA-Z0-9]{20,}/i, name: 'MiniMax API key', type: 'minimax' },
      { regex: /moonshot-[a-zA-Z0-9]{20,}/i, name: 'Moonshot API key', type: 'kimi' },
      { regex: /anthropic-[a-zA-Z0-9]{20,}/i, name: 'Anthropic API key', type: 'anthropic' },
      { regex: /sk-or-v1-[a-f0-9]{48,}/, name: 'OpenRouter API key', type: 'openrouter' },
    ];

    const dirs = [ctx.duckDir, join(homedir(), '.openclaw')];
    for (const dir of dirs) {
      if (!existsSync(dir)) continue;
      await this.scanDirForSecrets(dir, patterns, findings, 3);
    }

    return findings;
  }

  private async scanDirForSecrets(
    dir: string,
    patterns: { regex: RegExp; name: string; type: string }[],
    findings: SecurityFinding[],
    maxDepth: number,
    depth = 0
  ): Promise<void> {
    if (depth > maxDepth) return;
    try {
      const entries = readdirSync(dir);
      for (const entry of entries) {
        if (entry === 'node_modules' || entry === '.git' || entry === 'dist') continue;
        const fullPath = join(dir, entry);
        try {
          const stat = statSync(fullPath);
          if (stat.isDirectory()) {
            await this.scanDirForSecrets(fullPath, patterns, findings, maxDepth, depth + 1);
          } else if (stat.isFile()) {
            const content = readFileSync(fullPath, 'utf-8').substring(0, 10000);
            for (const { regex, name, type } of patterns) {
              if (regex.test(content)) {
                findings.push({
                  id: `SECRET-${type.toUpperCase()}-001`,
                  title: `${name} potentially exposed in source`,
                  description: `A ${name} pattern was found in ${fullPath}`,
                  severity: 'critical',
                  category: 'secret-exposure',
                  location: fullPath,
                  remediation: 'Remove API keys from source code. Use environment variables.',
                  references: ['https://owasp.org/www-project-top-ten/2017/A3_2017-Sensitive_Data_Exposure'],
                });
              }
            }
          }
        } catch { /* skip */ }
      }
    } catch { /* skip */ }
  }

  private async checkApiKeyFormats(ctx: AuditContext): Promise<SecurityFinding[]> {
    const findings: SecurityFinding[] = [];
    const envPath = join(ctx.duckDir, '.env');
    if (!existsSync(envPath)) return findings;

    try {
      const content = readFileSync(envPath, 'utf-8');
      const lines = content.split('\n');
      for (const line of lines) {
        const m = line.match(/^([^#=]+)=(.*)$/);
        if (!m) continue;
        const key = m[1].trim();
        const val = m[2].trim();
        if (key.endsWith('_API_KEY') || key.endsWith('_SECRET') || key === 'TOKEN') {
          if (val && !val.startsWith('***') && val.length < 20) {
            findings.push({
              id: `KEY-FMT-${key}`,
              title: `Suspicious ${key} format`,
              description: `${key} appears to be a placeholder or invalid key (too short)`,
              severity: 'low',
              category: 'key-format',
              remediation: 'Verify API key is correct. Placeholder values will cause auth failures.',
            });
          }
        }
      }
    } catch { /* ignore */ }

    return findings;
  }

  private async checkTokenExposures(ctx: AuditContext): Promise<SecurityFinding[]> {
    const findings: SecurityFinding[] = [];
    const tokenPatterns = [
      { regex: /ghp_[a-zA-Z0-9]{36}/, name: 'GitHub Personal Access Token' },
      { regex: /xox[baprs]-[a-zA-Z0-9]{10,}/, name: 'Slack Token' },
      { regex: /AIza[a-zA-Z0-9_-]{35}/, name: 'Google API Key' },
      { regex: /[a-zA-Z0-9_-]*:[a-zA-Z0-9_-]*@/, name: 'Basic Auth URL credential' },
    ];

    const envPath = join(ctx.duckDir, '.env');
    if (!existsSync(envPath)) return findings;

    try {
      const content = readFileSync(envPath, 'utf-8');
      for (const { regex, name } of tokenPatterns) {
        if (regex.test(content)) {
          findings.push({
            id: `TOKEN-${name.replace(/\s/g, '').toUpperCase().substring(0, 8)}`,
            title: `Potential ${name} in .env`,
            description: `A ${name} pattern was detected in .env`,
            severity: 'high',
            category: 'token-exposure',
            location: envPath,
            remediation: 'Ensure only necessary tokens are stored in .env',
          });
        }
      }
    } catch { /* ignore */ }

    return findings;
  }

  private async checkDependencySecurity(ctx: AuditContext): Promise<SecurityFinding[]> {
    const findings: SecurityFinding[] = [];

    try {
      // Run npm audit if available
      const pkgJson = join(process.cwd(), 'package.json');
      if (existsSync(pkgJson)) {
        try {
          const auditOutput = execSync('npm audit --json 2>/dev/null || true', {
            encoding: 'utf-8',
            timeout: 30000,
          });
          const audit = JSON.parse(auditOutput);
          const vulnCount = audit.metadata?.vulnerability_count || 0;
          if (vulnCount > 0) {
            findings.push({
              id: 'DEPS-001',
              title: `${vulnCount} vulnerable npm dependency/vulnerabilities found`,
              description: `npm audit found ${vulnCount} vulnerabilities in dependencies`,
              severity: vulnCount > 10 ? 'high' : 'medium',
              category: 'dependencies',
              remediation: 'Run: npm audit fix',
              references: ['https://owasp.org/www-project-top-ten/2017/A9_2017-Using_Components_with_Known_Vulnerabilities'],
            });
          }
        } catch { /* npm audit may fail, ignore */ }
      }
    } catch { /* ignore */ }

    return findings;
  }

  private async checkNetworkExposures(ctx: AuditContext): Promise<SecurityFinding[]> {
    const findings: SecurityFinding[] = [];

    // Check for hardcoded IPs or localhost exposure
    const sensitivePatterns = [
      { regex: /0\.0\.0\.0:\d+/g, name: 'Bound to all interfaces' },
      { regex: /::\d+/g, name: 'IPv6 binding' },
    ];

    const configPath = join(ctx.duckDir, 'config.yaml');
    if (existsSync(configPath)) {
      try {
        const content = readFileSync(configPath, 'utf-8');
        for (const { regex, name } of sensitivePatterns) {
          const matches = content.match(regex);
          if (matches && matches.length > 0) {
            findings.push({
              id: 'NET-001',
              title: `Network binding: ${name}`,
              description: `Found ${matches.join(', ')} in config. Verify this is intentional.`,
              severity: 'low',
              category: 'network',
              remediation: 'Bind to localhost (127.0.0.1) unless remote access is needed.',
            });
          }
        }
      } catch { /* ignore */ }
    }

    return findings;
  }

  private async checkDataDirectoryPermissions(ctx: AuditContext): Promise<SecurityFinding[]> {
    const findings: SecurityFinding[] = [];
    if (!existsSync(ctx.duckDir)) return findings;

    try {
      const stat = statSync(ctx.duckDir);
      const mode = stat.mode & 0o777;
      if (mode !== 0o700 && mode !== 0o755) {
        findings.push({
          id: 'DIR-PERM-001',
          title: '.duck directory has broad permissions',
          description: `.duck directory is accessible by other users (mode: ${mode.toString(8)})`,
          severity: 'medium',
          category: 'file-permissions',
          location: ctx.duckDir,
          remediation: `Run: chmod 700 "${ctx.duckDir}"`,
        });
      }
    } catch { /* ignore */ }

    return findings;
  }

  private async checkLogExposures(ctx: AuditContext): Promise<SecurityFinding[]> {
    const findings: SecurityFinding[] = [];
    const logPatterns = ['*.log', 'logs', '*.ndjson'];

    const dirs = [ctx.duckDir, '/tmp'];
    for (const dir of dirs) {
      if (!existsSync(dir)) continue;
      try {
        const entries = readdirSync(dir);
        for (const entry of entries) {
          for (const pattern of logPatterns) {
            if (pattern.startsWith('*') && entry.endsWith(pattern.slice(1))) {
              const fullPath = join(dir, entry);
              const stat = statSync(fullPath);
              if (stat.size > 10 * 1024 * 1024) { // > 10MB
                findings.push({
                  id: 'LOG-001',
                  title: 'Large log file found',
                  description: `${fullPath} is ${(stat.size / 1024 / 1024).toFixed(1)}MB`,
                  severity: 'low',
                  category: 'log-exposure',
                  location: fullPath,
                  remediation: 'Consider log rotation or deleting old logs',
                });
              }
            }
          }
        }
      } catch { /* ignore */ }
    }

    return findings;
  }

  private async checkBackupSecurity(ctx: AuditContext): Promise<SecurityFinding[]> {
    const findings: SecurityFinding[] = [];
    const backupDir = join(ctx.duckDir, 'backups');
    if (!existsSync(backupDir)) return findings;

    try {
      const entries = readdirSync(backupDir);
      for (const entry of entries) {
        const fullPath = join(backupDir, entry);
        const stat = statSync(fullPath);
        const mode = stat.mode & 0o777;
        if (mode !== 0o600) {
          findings.push({
            id: 'BACKUP-001',
            title: `Backup file has weak permissions`,
            description: `${entry} has mode ${mode.toString(8)}, should be 0600`,
            severity: 'medium',
            category: 'file-permissions',
            location: fullPath,
            remediation: `Run: chmod 600 "${fullPath}"`,
          });
        }
      }
    } catch { /* ignore */ }

    return findings;
  }
}

interface AuditContext {
  duckDir: string;
  options?: { categories?: string[]; severity?: Severity };
}

export function createSecurityAuditCommand(): Command {
  const cmd = new Command('security-audit')
    .description('Run full security audit (findings, severity, remediation)');

  const auditor = new SecurityAuditor();

  cmd
    .command('run')
    .description('Run the security audit')
    .option('--category <cats...>', 'Filter by category (file-permissions, secret-exposure, dependencies, etc.)')
    .option('--severity <level>', 'Minimum severity to show (critical|high|medium|low|info)')
    .option('--json', 'Output as JSON')
    .option('--format <format>', 'Output format (text|json|table)', 'text')
    .action(async (options: Record<string, any>) => {
      console.log(`${c.cyan}🔍 Running security audit...\n${c.reset}`);

      const result = await auditor.audit({
        categories: options.category,
        severity: options.severity as Severity,
      });

      if (options.json || options.format === 'json') {
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      printAuditResults(result);
      process.exit(result.riskLevel === 'critical' || result.riskLevel === 'high' ? 1 : 0);
    });

  cmd
    .command('categories')
    .description('List available audit categories')
    .action(() => {
      const categories = [
        { name: 'file-permissions', desc: 'File and directory permission issues' },
        { name: 'secret-exposure', desc: 'API keys or secrets in source/logs' },
        { name: 'key-format', desc: 'Malformed or placeholder API keys' },
        { name: 'token-exposure', desc: 'Third-party tokens in config' },
        { name: 'dependencies', desc: 'Vulnerable npm dependencies' },
        { name: 'network', desc: 'Network binding and exposure issues' },
        { name: 'log-exposure', desc: 'Large or sensitive log files' },
        { name: 'backup-security', desc: 'Backup file permissions' },
      ];
      console.log(`\n${c.bold}Security Audit Categories:${c.reset}\n`);
      for (const cat of categories) {
        console.log(`  ${c.cyan}${cat.name}${c.reset} - ${cat.desc}`);
      }
      console.log();
    });

  cmd
    .command('check <category>')
    .description('Run a specific audit category')
    .action(async (category: string) => {
      const result = await auditor.audit({ categories: [category] });
      printAuditResults(result);
    });

  return cmd;
}

function printAuditResults(result: AuditResult): void {
  const riskColor = {
    critical: c.red,
    high: c.red,
    medium: c.yellow,
    low: c.cyan,
    none: c.green,
  }[result.riskLevel] || c.reset;

  console.log(`${c.bold}Security Audit Results${c.reset}`);
  console.log(`${c.dim}${'─'.repeat(50)}${c.reset}`);
  console.log(`  Timestamp:  ${result.timestamp}`);
  console.log(`  Duration:   ${result.duration}ms`);
  console.log(`  Checks run: ${result.checksRun.length}`);
  console.log();

  console.log(`${c.bold}Risk Level:${c.reset} ${riskColor}${result.riskLevel.toUpperCase()}${c.reset}`);
  console.log(`${c.bold}Summary:${c.reset}`);
  const icons: Record<Severity, string> = {
    critical: `${c.red}🔴`,
    high: `${c.red}🔴`,
    medium: `${c.yellow}🟡`,
    low: `${c.cyan}🔵`,
    info: `${c.dim}⚪`,
  };
  for (const [sev, count] of Object.entries(result.summary)) {
    if (count > 0) {
      console.log(`  ${icons[sev as Severity]} ${sev}: ${count}`);
    }
  }

  if (result.findings.length === 0) {
    console.log(`\n${c.green}✅ No issues found${c.reset}\n`);
    return;
  }

  console.log(`\n${c.bold}Findings (${result.findings.length}):${c.reset}\n`);
  for (const finding of result.findings) {
    const sevColor = {
      critical: c.red,
      high: c.red,
      medium: c.yellow,
      low: c.cyan,
      info: c.dim,
    }[finding.severity];
    const icon = icons[finding.severity];
    console.log(`${icon} [${sevColor}${finding.severity.toUpperCase()}${c.reset}] ${c.bold}${finding.title}${c.reset}`);
    console.log(`    ${finding.description}`);
    if (finding.location) {
      console.log(`    ${c.dim}Location: ${finding.location}${c.reset}`);
    }
    if (finding.remediation) {
      console.log(`    ${c.green}Fix: ${finding.remediation}${c.reset}`);
    }
    if (finding.references?.length) {
      console.log(`    ${c.dim}Ref: ${finding.references.join(', ')}${c.reset}`);
    }
    console.log();
  }
}
