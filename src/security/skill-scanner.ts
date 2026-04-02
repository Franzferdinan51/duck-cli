/**
 * 🦆 Duck Agent - Skills Code Scanner
 * Scans skill files for dangerous patterns before installing
 * Based on OpenClaw's dangerous-code-scanner
 */

import { readdirSync, readFileSync, statSync } from 'fs';
import { join, extname, dirname } from 'path';

export interface ScanResult {
  safe: boolean;
  findings: SecurityFinding[];
  scanTime: number;
  filesScanned: number;
}

export interface SecurityFinding {
  file: string;
  line: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
  type: string;
  description: string;
  code: string;
  recommendation: string;
}

const CRITICAL_PATTERNS = [
  { pattern: /rm\s+(-rf\s+|\s+-rf)/i, type: 'destructive-delete', desc: 'Recursive force delete', rec: 'Never use rm -rf on user-specified paths' },
  { pattern: /format\s*\(.*\)/i, type: 'format-string', desc: 'Format string vulnerability', rec: 'Use parameterized queries instead of string interpolation' },
  { pattern: /eval\s*\(/i, type: 'code-injection', desc: 'eval() execution of dynamic code', rec: 'Never eval user input or untrusted strings' },
  { pattern: /exec\s*\(/i, type: 'command-injection', desc: 'Shell command injection risk', rec: 'Avoid exec() with string concatenation' },
  { pattern: /__import__\s*\(/i, type: 'dynamic-import', desc: 'Dynamic module import', rec: 'Use static imports only' },
  { pattern: /subprocess\s*\.\s*call\s*\([^,)]+\+/i, type: 'shell-injection', desc: 'Subprocess with shell injection', rec: 'Use list-form arguments without shell=True' },
  { pattern: /os\.system\s*\(/i, type: 'os-command', desc: 'OS command execution', rec: 'Avoid os.system() with user input' },
  { pattern: /child_process\s*\.exec\s*\([^,)]+\+/i, type: 'node-injection', desc: 'Node.js command injection', rec: 'Avoid exec() with template strings' },
  { pattern: /wget\s+\$|curl\s+\$/i, type: 'url-injection', desc: 'URL injection in shell command', rec: 'Validate and sanitize URLs before use' },
  { pattern: /eval\s*\(.*\$\{/i, type: 'template-injection', desc: 'Template string injection', rec: 'Never eval interpolated strings' },
];

const HIGH_PATTERNS = [
  { pattern: /chmod\s+777/, type: 'insecure-permission', desc: 'World-writable permissions', rec: 'Use 644 for files, 755 for directories' },
  { pattern: /password\s*=\s*["'][^"']{0,20}["']/i, type: 'hardcoded-secret', desc: 'Hardcoded password in code', rec: 'Use environment variables or secrets manager' },
  { pattern: /api[_-]?key\s*=\s*["'][^"']{10,}["']/i, type: 'hardcoded-secret', desc: 'Hardcoded API key', rec: 'Use env vars for API keys' },
  { pattern: /secret\s*=\s*["'][^"']{10,}["']/i, type: 'hardcoded-secret', desc: 'Hardcoded secret', rec: 'Use secrets manager' },
  { pattern: /await\s+import\s*\(/i, type: 'dynamic-import', desc: 'Dynamic import()', rec: 'Use static imports for predictable behavior' },
  { pattern: /localStorage\.setItem|sessionStorage\.setItem/i, type: 'xss-risk', desc: 'DOM storage manipulation', rec: 'Validate input before DOM storage' },
  { pattern: /innerHTML\s*=|outerHTML\s*=/i, type: 'xss-risk', desc: 'Direct HTML injection', rec: 'Use textContent or sanitize with DOMPurify' },
  { pattern: /document\.write\s*\(/i, type: 'xss-risk', desc: 'document.write injection', rec: 'Avoid document.write() entirely' },
  { pattern: /curl\s+(-s\s+)?["']https?:\/\//i, type: 'url-fetch', desc: 'HTTP request from untrusted source', rec: 'Validate URL scheme and destination' },
  { pattern: /wget\s+["']https?:\/\//i, type: 'url-fetch', desc: 'HTTP download from untrusted source', rec: 'Verify URL before downloading' },
];

const MEDIUM_PATTERNS = [
  { pattern: /console\.log\s*\(\s*(req|body|params|query)\s*\)/i, type: 'info-leak', desc: 'Logging sensitive request data', rec: 'Avoid logging raw request objects' },
  { pattern: /\.env(?:\.local|\.development)?["']/i, type: 'config-exposure', desc: 'Environment file reference', rec: 'Ensure .env is in .gitignore' },
  { pattern: /process\.env\.(password|secret|key|token)/i, type: 'env-disclosure', desc: 'Direct env access in logging', rec: 'Redact sensitive env vars before logging' },
  { pattern: /spawn\s*\(\s*["']sh["']\s*,\s*\[/i, type: 'shell-spawn', desc: 'Shell spawn without argument array', rec: 'Use array form of spawn to avoid injection' },
  { pattern: /http\.createServer\s*\(\s*\(\s*req/i, type: 'server-risk', desc: 'Raw HTTP server without security headers', rec: 'Use a framework with security middleware' },
  { pattern: /crypto\.randomBytes?\s*\(\s*[0-9]{1,3}\s*\)/i, type: 'weak-random', desc: 'Weak random number generation', rec: 'Use crypto.randomBytes() with sufficient entropy' },
  { pattern: /Math\.random\s*\(\s*\)/i, type: 'weak-random', desc: 'Math.random() for security-sensitive use', rec: 'Use crypto.randomBytes() for security-sensitive values' },
  { pattern: /password\s*\+=|token\s*\+=/i, type: 'string-concat-secret', desc: 'String concatenation for secrets', rec: 'Use template literals or concat() properly' },
];

export class SkillScanner {
  private criticalPatterns = CRITICAL_PATTERNS;
  private highPatterns = HIGH_PATTERNS;
  private mediumPatterns = MEDIUM_PATTERNS;

  /**
   * Scan a skill directory for dangerous patterns
   */
  async scan(skillPath: string): Promise<ScanResult> {
    const startTime = Date.now();
    const findings: SecurityFinding[] = [];
    let filesScanned = 0;

    const scanFile = (filePath: string, content: string) => {
      const lines = content.split('\n');
      for (const [pattern, type, desc, rec] of [...this.criticalPatterns.map(p => [p.pattern, p.type, p.desc, p.rec]), 
                                          ...this.highPatterns.map(p => [p.pattern, p.type, p.desc, p.rec]),
                                          ...this.mediumPatterns.map(p => [p.pattern, p.type, p.desc, p.rec])]) {
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const regex = pattern as RegExp;
          if (regex.test(line)) {
            const severity = this.criticalPatterns.some(p => p.pattern === regex) ? 'critical' 
              : this.highPatterns.some(p => p.pattern === regex) ? 'high' : 'medium';
            findings.push({
              file: filePath,
              line: i + 1,
              severity,
              type: type as string,
              description: desc as string,
              code: line.trim().slice(0, 100),
              recommendation: rec as string,
            });
          }
        }
      }
    };

    // Recursively scan all files
    const scanDir = (dir: string) => {
      try {
        const entries = readdirSync(dir);
        for (const entry of entries) {
          const fullPath = join(dir, entry);
          try {
            const stat = statSync(fullPath);
            if (stat.isDirectory()) {
              if (!['node_modules', '.git', '__pycache__', 'dist', '.next'].includes(entry)) {
                scanDir(fullPath);
              }
            } else if (stat.isFile()) {
              const ext = extname(entry).toLowerCase();
              if (['.js', '.ts', '.py', '.sh', '.bash', '.ps1', '.rb', '.go', '.rs', '.java', '.c', '.cpp'].includes(ext)) {
                try {
                  const content = readFileSync(fullPath, 'utf-8');
                  scanFile(fullPath.replace(skillPath + '/', ''), content);
                  filesScanned++;
                } catch {
                  // Skip unreadable files
                }
              }
            }
          } catch {
            // Skip inaccessible entries
          }
        }
      } catch {
        // Skip inaccessible directories
      }
    };

    scanDir(skillPath);

    const criticalCount = findings.filter(f => f.severity === 'critical').length;
    const highCount = findings.filter(f => f.severity === 'high').length;

    return {
      safe: criticalCount === 0 && highCount === 0,
      findings: findings.sort((a, b) => {
        const order = { critical: 0, high: 1, medium: 2, low: 3 };
        return order[a.severity] - order[b.severity];
      }),
      scanTime: Date.now() - startTime,
      filesScanned,
    };
  }

  /**
   * Scan and print results
   */
  async scanAndPrint(skillPath: string): Promise<boolean> {
    const result = await this.scan(skillPath);
    const c = { red: '\x1b[31m', yellow: '\x1b[33m', green: '\x1b[32m', reset: '\x1b[0m', bold: '\x1b[1m' };
    
    console.log(`\n'\x1b[1m'🔍 Skill Security Scan'\x1b[0m'`);
    console.log(`'\x1b[2m'Scanned ${result.filesScanned} files in ${result.scanTime}ms'\x1b[0m'\n`);

    if (result.findings.length === 0) {
      console.log(`'\x1b[32m'✅ No security issues found'\x1b[0m'\n`);
      return true;
    }

    const critical = result.findings.filter(f => f.severity === 'critical');
    const high = result.findings.filter(f => f.severity === 'high');
    const medium = result.findings.filter(f => f.severity === 'medium');

    if (critical.length > 0) {
      console.log(`'\x1b[31m'❌ CRITICAL (${critical.length}):'\x1b[0m'`);
      for (const f of critical) {
        console.log(`  '\x1b[31m'•'\x1b[0m' ${f.file}:${f.line} — ${f.description}`);
        console.log(`    '\x1b[2m'${f.code}'\x1b[0m'`);
        console.log(`    '\x1b[33m'→'\x1b[0m' ${f.recommendation}`);
      }
    }

    if (high.length > 0) {
      console.log(`'\x1b[31m'⚠️ HIGH (${high.length}):'\x1b[0m'`);
      for (const f of high) {
        console.log(`  '\x1b[31m'•'\x1b[0m' ${f.file}:${f.line} — ${f.description}`);
        console.log(`    '\x1b[2m'${f.code}'\x1b[0m'`);
        console.log(`    '\x1b[33m'→'\x1b[0m' ${f.recommendation}`);
      }
    }

    if (medium.length > 0) {
      console.log(`'\x1b[33m'⚡ MEDIUM (${medium.length}):'\x1b[0m'`);
      for (const f of medium) {
        console.log(`  '\x1b[33m'•'\x1b[0m' ${f.file}:${f.line} — ${f.description}`);
      }
    }

    console.log(`\n${result.safe ? c.green+'✅' : c.red+'❌'} Skill is ${result.safe ? 'SAFE' : 'UNSAFE'} to install\n`);
    return result.safe;
  }
}

export const skillScanner = new SkillScanner();
export default skillScanner;
