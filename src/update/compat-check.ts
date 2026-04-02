/**
 * 🦆 Duck Agent - OpenClaw Compatibility Checker
 * Tests if Duck Agent is OpenClaw-compatible
 * Runs after each update, reports what works / what's broken
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

// ============================================================================
// Types
// ============================================================================

export interface CompatCheckResult {
  timestamp: Date;
  version: string;
  overall: 'pass' | 'partial' | 'fail';
  score: number; // 0-100
  checks: CompatCheck[];
  summary: string;
  recommendations: string[];
}

export interface CompatCheck {
  id: string;
  name: string;
  category: 'core' | 'protocol' | 'integration' | 'tools' | 'api';
  status: 'pass' | 'fail' | 'warn' | 'skip';
  message?: string;
  expected?: string;
  actual?: string;
  fix?: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
}

export interface CompatConfig {
  strict?: boolean;
  skipSlow?: boolean;
  categories?: ('core' | 'protocol' | 'integration' | 'tools' | 'api')[];
}

// ============================================================================
// Compatibility Checker
// ============================================================================

export class CompatChecker {
  private homeDir: string;
  private strict: boolean;
  private checks: CompatCheck[] = [];
  
  constructor(homeDir?: string, config?: CompatConfig) {
    this.homeDir = homeDir || process.cwd();
    this.strict = config?.strict ?? false;
  }

  /**
   * Run all compatibility checks
   */
  async runAll(config?: CompatConfig): Promise<CompatCheckResult> {
    this.checks = [];
    const categories = config?.categories || ['core', 'protocol', 'integration', 'tools', 'api'];
    
    // Run checks by category
    if (categories.includes('core')) {
      await this.checkCore();
    }
    if (categories.includes('protocol')) {
      await this.checkProtocols();
    }
    if (categories.includes('integration')) {
      await this.checkIntegrations();
    }
    if (categories.includes('tools')) {
      await this.checkTools();
    }
    if (categories.includes('api')) {
      await this.checkAPI();
    }
    
    return this.generateResult();
  }

  /**
   * Check core features
   */
  private async checkCore(): Promise<void> {
    // Check TypeScript compilation
    this.addCheck({
      id: 'core-typescript',
      name: 'TypeScript Compilation',
      category: 'core',
      severity: 'critical',
      status: 'pass',
      expected: 'tsc compiles without errors',
    });
    
    try {
      execSync('npx tsc --noEmit', { 
        cwd: this.homeDir, 
        stdio: 'pipe',
        timeout: 60000 
      });
      this.checks.find(c => c.id === 'core-typescript')!.status = 'pass';
    } catch {
      this.checks.find(c => c.id === 'core-typescript')!.status = 'fail';
      this.checks.find(c => c.id === 'core-typescript')!.message = 'TypeScript compilation failed';
    }
    
    // Check required files exist
    const requiredFiles = [
      'src/agent/core.ts',
      'src/gateway/index.ts',
      'src/gateway/acp-server.ts',
      'src/cli/main.ts',
      'package.json',
    ];
    
    for (const file of requiredFiles) {
      const exists = existsSync(join(this.homeDir, file));
      this.addCheck({
        id: `core-file-${file.replace(/[\/\.]/g, '-')}`,
        name: `Required file: ${file}`,
        category: 'core',
        severity: 'high',
        status: exists ? 'pass' : 'fail',
        expected: 'File exists',
        actual: exists ? 'Found' : 'Missing',
        fix: exists ? undefined : `Create ${file}`,
      });
    }
    
    // Check package.json validity
    try {
      const pkg = JSON.parse(readFileSync(join(this.homeDir, 'package.json'), 'utf-8'));
      
      this.addCheck({
        id: 'core-package-name',
        name: 'Package name is duck-agent',
        category: 'core',
        severity: 'medium',
        status: pkg.name === 'duck-agent' ? 'pass' : 'warn',
        expected: 'duck-agent',
        actual: pkg.name,
      });
      
      this.addCheck({
        id: 'core-package-version',
        name: 'Package version is set',
        category: 'core',
        severity: 'low',
        status: pkg.version ? 'pass' : 'fail',
        expected: 'Semantic version (e.g., 0.4.0)',
        actual: pkg.version || 'missing',
      });
      
      this.addCheck({
        id: 'core-package-deps',
        name: 'Required dependencies present',
        category: 'core',
        severity: 'high',
        status: pkg.dependencies ? 'pass' : 'fail',
        expected: 'Dependencies object in package.json',
        actual: pkg.dependencies ? `Found ${Object.keys(pkg.dependencies).length} dependencies` : 'Missing',
      });
    } catch (e) {
      this.addCheck({
        id: 'core-package-parse',
        name: 'package.json is valid JSON',
        category: 'core',
        severity: 'critical',
        status: 'fail',
        message: `Failed to parse: ${e instanceof Error ? e.message : 'Unknown error'}`,
        fix: 'Fix package.json syntax',
      });
    }
    
    // Check node_modules
    const nodeModulesExists = existsSync(join(this.homeDir, 'node_modules'));
    this.addCheck({
      id: 'core-node-modules',
      name: 'node_modules installed',
      category: 'core',
      severity: 'medium',
      status: nodeModulesExists ? 'pass' : 'warn',
      expected: 'node_modules directory exists',
      actual: nodeModulesExists ? 'Installed' : 'Not installed',
      fix: nodeModulesExists ? undefined : 'Run npm install',
    });
    
    // Check dist directory
    const distExists = existsSync(join(this.homeDir, 'dist'));
    this.addCheck({
      id: 'core-dist',
      name: 'dist directory exists (built)',
      category: 'core',
      severity: 'medium',
      status: distExists ? 'pass' : 'warn',
      expected: 'dist directory exists',
      actual: distExists ? 'Built' : 'Not built',
      fix: distExists ? undefined : 'Run npm run build',
    });
  }

  /**
   * Check protocol compatibility
   */
  private async checkProtocols(): Promise<void> {
    // ACP Protocol
    const acpServerPath = join(this.homeDir, 'src', 'gateway', 'acp-server.ts');
    const acpServerExists = existsSync(acpServerPath);
    
    this.addCheck({
      id: 'protocol-acp',
      name: 'ACP Server implementation',
      category: 'protocol',
      severity: 'critical',
      status: acpServerExists ? 'pass' : 'fail',
      expected: 'ACP Server class in src/gateway/acp-server.ts',
      actual: acpServerExists ? 'Found' : 'Missing',
      fix: acpServerExists ? undefined : 'Create ACP Server implementation',
    });
    
    // WebSocket support
    let wsAvailable = false;
    try {
      const ws = require('ws');
      wsAvailable = typeof ws === 'function';
    } catch {}
    
    this.addCheck({
      id: 'protocol-websocket',
      name: 'WebSocket support (ws package)',
      category: 'protocol',
      severity: 'critical',
      status: wsAvailable ? 'pass' : 'fail',
      expected: 'ws package available',
      actual: wsAvailable ? 'Available' : 'Not available',
      fix: wsAvailable ? undefined : 'Run npm install ws',
    });
    
    // Gateway
    const gatewayPath = join(this.homeDir, 'src', 'gateway', 'index.ts');
    const gatewayExists = existsSync(gatewayPath);
    
    this.addCheck({
      id: 'protocol-gateway',
      name: 'Gateway implementation',
      category: 'protocol',
      severity: 'critical',
      status: gatewayExists ? 'pass' : 'fail',
      expected: 'Gateway class in src/gateway/index.ts',
      actual: gatewayExists ? 'Found' : 'Missing',
      fix: gatewayExists ? undefined : 'Create Gateway implementation',
    });
    
    // OpenAI compatibility
    const gatewayContent = gatewayExists 
      ? readFileSync(gatewayPath, 'utf-8')
      : '';
    
    const hasOpenAICompat = gatewayContent.includes('/v1/chat/completions');
    
    this.addCheck({
      id: 'protocol-openai',
      name: 'OpenAI API compatibility',
      category: 'protocol',
      severity: 'high',
      status: hasOpenAICompat ? 'pass' : 'warn',
      expected: 'OpenAI-compatible endpoints',
      actual: hasOpenAICompat ? 'Implemented' : 'Not implemented',
      fix: hasOpenAICompat ? undefined : 'Add OpenAI-compatible endpoints to Gateway',
    });
  }

  /**
   * Check integration compatibility
   */
  private async checkIntegrations(): Promise<void> {
    // OpenClaw Adapter
    const adapterPath = join(this.homeDir, 'src', 'compat', 'openclaw-adapter.ts');
    const adapterExists = existsSync(adapterPath);
    
    this.addCheck({
      id: 'integration-adapter',
      name: 'OpenClaw Adapter',
      category: 'integration',
      severity: 'critical',
      status: adapterExists ? 'pass' : 'fail',
      expected: 'Adapter in src/compat/openclaw-adapter.ts',
      actual: adapterExists ? 'Found' : 'Missing',
      fix: adapterExists ? undefined : 'Create OpenClaw Adapter',
    });
    
    // OpenClaw Compatibility module
    const compatPath = join(this.homeDir, 'src', 'compat', 'openclaw-compat.ts');
    const compatExists = existsSync(compatPath);
    
    this.addCheck({
      id: 'integration-compat',
      name: 'OpenClaw Compatibility module',
      category: 'integration',
      severity: 'high',
      status: compatExists ? 'pass' : 'fail',
      expected: 'Compatibility module in src/compat/',
      actual: compatExists ? 'Found' : 'Missing',
      fix: compatExists ? undefined : 'Create OpenClaw Compatibility module',
    });
    
    // Skills system
    const skillsPath = join(this.homeDir, 'src', 'skills');
    const skillsExists = existsSync(skillsPath);
    
    this.addCheck({
      id: 'integration-skills',
      name: 'Skills system',
      category: 'integration',
      severity: 'high',
      status: skillsExists ? 'pass' : 'warn',
      expected: 'Skills directory exists',
      actual: skillsExists ? 'Found' : 'Missing',
      fix: skillsExists ? undefined : 'Create skills system',
    });
    
    // Memory system
    const memoryPath = join(this.homeDir, 'src', 'memory');
    const memoryExists = existsSync(memoryPath);
    
    this.addCheck({
      id: 'integration-memory',
      name: 'Memory system',
      category: 'integration',
      severity: 'high',
      status: memoryExists ? 'pass' : 'warn',
      expected: 'Memory directory exists',
      actual: memoryExists ? 'Found' : 'Missing',
      fix: memoryExists ? undefined : 'Create memory system',
    });
    
    // Tool registry
    const toolsPath = join(this.homeDir, 'src', 'tools');
    const toolsExists = existsSync(toolsPath);
    
    this.addCheck({
      id: 'integration-tools',
      name: 'Tool registry',
      category: 'integration',
      severity: 'high',
      status: toolsExists ? 'pass' : 'warn',
      expected: 'Tools directory exists',
      actual: toolsExists ? 'Found' : 'Missing',
      fix: toolsExists ? undefined : 'Create tool registry',
    });
  }

  /**
   * Check tool compatibility
   */
  private async checkTools(): Promise<void> {
    // File tools
    const fileToolChecks = [
      { id: 'tools-read', name: 'File read tool' },
      { id: 'tools-write', name: 'File write tool' },
      { id: 'tools-edit', name: 'File edit tool' },
    ];
    
    const toolsPath = join(this.homeDir, 'src', 'tools', 'registry.ts');
    const toolsContent = existsSync(toolsPath) 
      ? readFileSync(toolsPath, 'utf-8')
      : '';
    
    for (const check of fileToolChecks) {
      const hasTool = toolsContent.toLowerCase().includes(check.name.toLowerCase().replace(' tool', ''));
      this.addCheck({
        id: check.id,
        name: check.name,
        category: 'tools',
        severity: 'high',
        status: hasTool ? 'pass' : 'warn',
        expected: `${check.name} available`,
        actual: hasTool ? 'Found' : 'Missing',
      });
    }
    
    // Browser tools
    this.addCheck({
      id: 'tools-browser',
      name: 'Browser automation tools',
      category: 'tools',
      severity: 'medium',
      status: 'warn',
      message: 'Browser tools availability depends on installation',
    });
    
    // Shell tools
    const hasShell = toolsContent.includes('shell') || toolsContent.includes('exec');
    this.addCheck({
      id: 'tools-shell',
      name: 'Shell execution tool',
      category: 'tools',
      severity: 'high',
      status: hasShell ? 'pass' : 'warn',
      expected: 'Shell/exec tool available',
      actual: hasShell ? 'Found' : 'Missing',
    });
  }

  /**
   * Check API compatibility
   */
  private async checkAPI(): Promise<void> {
    // Gateway API endpoints
    const gatewayPath = join(this.homeDir, 'src', 'gateway', 'index.ts');
    const gatewayContent = existsSync(gatewayPath)
      ? readFileSync(gatewayPath, 'utf-8')
      : '';
    
    const endpoints = [
      { path: '/health', name: 'Health check endpoint' },
      { path: '/metrics', name: 'Metrics endpoint' },
      { path: '/v1/chat/completions', name: 'Chat completions endpoint' },
      { path: '/v1/models', name: 'Models endpoint' },
    ];
    
    for (const endpoint of endpoints) {
      const hasEndpoint = gatewayContent.includes(endpoint.path);
      this.addCheck({
        id: `api-endpoint-${endpoint.path.replace(/[\/\.]/g, '-')}`,
        name: endpoint.name,
        category: 'api',
        severity: endpoint.path === '/v1/chat/completions' ? 'critical' : 'high',
        status: hasEndpoint ? 'pass' : 'fail',
        expected: `GET/POST ${endpoint.path}`,
        actual: hasEndpoint ? 'Implemented' : 'Not implemented',
        fix: hasEndpoint ? undefined : `Add ${endpoint.path} endpoint to Gateway`,
      });
    }
    
    // ACP API
    const acpPath = join(this.homeDir, 'src', 'gateway', 'acp-server.ts');
    const acpContent = existsSync(acpPath)
      ? readFileSync(acpPath, 'utf-8')
      : '';
    
    const acpMethods = [
      { method: 'spawn', name: 'Session spawn' },
      { method: 'message', name: 'Send message' },
      { method: 'cancel', name: 'Cancel session' },
    ];
    
    for (const method of acpMethods) {
      const hasMethod = acpContent.includes(method.method);
      this.addCheck({
        id: `api-acp-${method.method}`,
        name: `ACP: ${method.name}`,
        category: 'api',
        severity: 'high',
        status: hasMethod ? 'pass' : 'warn',
        expected: `ACP method: ${method.method}`,
        actual: hasMethod ? 'Found' : 'Missing',
      });
    }
  }

  /**
   * Add a check to the list
   */
  private addCheck(check: Omit<CompatCheck, 'status'> & { status: CompatCheck['status'] }): void {
    // Check if duplicate
    const existing = this.checks.find(c => c.id === check.id);
    if (existing) {
      Object.assign(existing, check);
    } else {
      this.checks.push(check as CompatCheck);
    }
  }

  /**
   * Generate the final result
   */
  private generateResult(): CompatCheckResult {
    const version = this.getVersion();
    
    // Calculate score
    const passCount = this.checks.filter(c => c.status === 'pass').length;
    const warnCount = this.checks.filter(c => c.status === 'warn').length;
    const failCount = this.checks.filter(c => c.status === 'fail').length;
    const total = this.checks.length;
    
    const score = Math.round(((passCount + warnCount * 0.5) / total) * 100);
    
    // Determine overall status
    let overall: 'pass' | 'partial' | 'fail';
    const criticalFails = this.checks.filter(c => c.severity === 'critical' && c.status === 'fail');
    
    if (criticalFails.length > 0) {
      overall = 'fail';
    } else if (failCount > 0 || warnCount > total * 0.3) {
      overall = 'partial';
    } else {
      overall = 'pass';
    }
    
    // Generate summary
    let summary = '';
    if (overall === 'pass') {
      summary = `All checks passed. Duck Agent is fully compatible with OpenClaw.`;
    } else if (overall === 'partial') {
      summary = `Some checks need attention (${failCount} failures, ${warnCount} warnings). Review the detailed report below.`;
    } else {
      summary = `Compatibility issues detected. ${criticalFails.length} critical failures require immediate attention.`;
    }
    
    // Generate recommendations
    const recommendations: string[] = [];
    
    const failures = this.checks.filter(c => c.status === 'fail');
    for (const failure of failures.slice(0, 5)) {
      if (failure.fix) {
        recommendations.push(`${failure.name}: ${failure.fix}`);
      } else {
        recommendations.push(`${failure.name}: Review and fix`);
      }
    }
    
    const warnings = this.checks.filter(c => c.status === 'warn');
    if (warnings.length > 0) {
      recommendations.push(`${warnings.length} warnings may affect functionality`);
    }
    
    return {
      timestamp: new Date(),
      version,
      overall,
      score,
      checks: this.checks,
      summary,
      recommendations,
    };
  }

  /**
   * Get Duck Agent version
   */
  private getVersion(): string {
    try {
      const pkg = JSON.parse(readFileSync(join(this.homeDir, 'package.json'), 'utf-8'));
      return pkg.version || '0.0.0';
    } catch {
      return 'unknown';
    }
  }

  /**
   * Print a formatted report
   */
  printReport(result: CompatCheckResult): string {
    const lines: string[] = [];
    
    lines.push('');
    lines.push('═══════════════════════════════════════════════════════════════');
    lines.push('  🦆 Duck Agent - OpenClaw Compatibility Report');
    lines.push('═══════════════════════════════════════════════════════════════');
    lines.push('');
    lines.push(`  Version:    ${result.version}`);
    lines.push(`  Checked:    ${result.timestamp.toISOString()}`);
    lines.push(`  Score:      ${result.score}/100 (${result.overall.toUpperCase()})`);
    lines.push('');
    
    // Summary
    lines.push('───────────────────────────────────────────────────────────────');
    lines.push('  SUMMARY');
    lines.push('───────────────────────────────────────────────────────────────');
    lines.push(`  ${result.summary}`);
    lines.push('');
    
    // Stats
    const passCount = result.checks.filter(c => c.status === 'pass').length;
    const warnCount = result.checks.filter(c => c.status === 'warn').length;
    const failCount = result.checks.filter(c => c.status === 'fail').length;
    
    lines.push(`  ✅ Pass:  ${passCount}`);
    lines.push(`  ⚠️  Warn:  ${warnCount}`);
    lines.push(`  ❌ Fail:  ${failCount}`);
    lines.push('');
    
    // Failed checks
    if (failCount > 0) {
      lines.push('───────────────────────────────────────────────────────────────');
      lines.push('  FAILED CHECKS');
      lines.push('───────────────────────────────────────────────────────────────');
      
      for (const check of result.checks.filter(c => c.status === 'fail')) {
        lines.push(`  ❌ [${check.severity.toUpperCase()}] ${check.name}`);
        if (check.message) {
          lines.push(`     ${check.message}`);
        }
        if (check.fix) {
          lines.push(`     → ${check.fix}`);
        }
      }
      lines.push('');
    }
    
    // Warnings
    if (warnCount > 0 && result.score < 100) {
      lines.push('───────────────────────────────────────────────────────────────');
      lines.push('  WARNINGS');
      lines.push('───────────────────────────────────────────────────────────────');
      
      for (const check of result.checks.filter(c => c.status === 'warn').slice(0, 10)) {
        lines.push(`  ⚠️  ${check.name}`);
        if (check.message) {
          lines.push(`     ${check.message}`);
        }
      }
      lines.push('');
    }
    
    // Recommendations
    if (result.recommendations.length > 0) {
      lines.push('───────────────────────────────────────────────────────────────');
      lines.push('  RECOMMENDATIONS');
      lines.push('───────────────────────────────────────────────────────────────');
      
      for (const rec of result.recommendations.slice(0, 5)) {
        lines.push(`  → ${rec}`);
      }
      lines.push('');
    }
    
    lines.push('═══════════════════════════════════════════════════════════════');
    lines.push('');
    
    return lines.join('\n');
  }
}

// ============================================================================
// Standalone Functions
// ============================================================================

/**
 * Run compatibility check
 */
export async function runCompatCheck(homeDir?: string): Promise<CompatCheckResult> {
  const checker = new CompatChecker(homeDir);
  return checker.runAll();
}

/**
 * Print compatibility report
 */
export function printCompatReport(result: CompatCheckResult): string {
  const checker = new CompatChecker();
  return checker.printReport(result);
}

export default CompatChecker;
