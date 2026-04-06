/**
 * 🦆 Duck Agent - Health Check
 * Comprehensive health checks for all dependencies
 * 
 * Commands:
 *   duck health           - Full health check with exit code
 *   duck boot-diagnostics - Quick startup diagnostics
 */

import { Agent } from './core.js';
import { getAndroidTools } from './android-tools.js';

export interface HealthCheckResult {
  name: string;
  status: 'ok' | 'warn' | 'error';
  detail?: string;
  latencyMs?: number;
  optional?: boolean;
}

export interface HealthReport {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  checks: HealthCheckResult[];
  exitCode: number;
  summary: string;
}

/**
 * Run all health checks and return a comprehensive report
 */
export async function runHealthCheck(verbose: boolean = false): Promise<HealthReport> {
  const checks: HealthCheckResult[] = [];
  let unhealthy = 0;
  let warnings = 0;

  // Run checks in parallel for speed
  const results = await Promise.allSettled([
    checkGateway(),
    checkMiniMax(),
    checkKimi(),
    checkOpenRouter(),
    checkAndroid(),
    checkMCPServers(),
    checkLMStudio(),
    checkSystem(),    // RAM, Disk, CPU
    checkServices(),  // Running services
  ]);

  const checkNames = ['Gateway', 'MiniMax', 'Kimi', 'OpenRouter', 'Android', 'MCP Servers', 'LM Studio', 'System', 'Services'];
  
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === 'fulfilled') {
      checks.push(result.value);
      if (result.value.status === 'error') unhealthy++;
      if (result.value.status === 'warn') warnings++;
    } else {
      checks.push({
        name: checkNames[i],
        status: 'error',
        detail: `Check failed: ${result.reason?.message || 'Unknown error'}`,
      });
      unhealthy++;
    }
  }

  // Determine overall status
  let overall: 'healthy' | 'degraded' | 'unhealthy';
  let exitCode: number;
  
  if (unhealthy === 0 && warnings === 0) {
    overall = 'healthy';
    exitCode = 0;
  } else if (unhealthy === 0) {
    overall = 'degraded';
    exitCode = 0; // Still healthy enough to work
  } else {
    overall = 'unhealthy';
    exitCode = 1;
  }

  const summary = `${checks.filter(c => c.status === 'ok').length}/${checks.length} checks passed${
    unhealthy > 0 ? `, ${unhealthy} failed` : ''
  }${warnings > 0 ? `, ${warnings} warnings` : ''}`;

  return { overall, checks, exitCode, summary };
}

/**
 * Quick boot diagnostics - runs on startup
 */
export async function runBootDiagnostics(): Promise<void> {
  process.stdout.write('\n[DUCK] Boot diagnostics...\n');
  
  const checks = await Promise.all([
    checkGateway(true),
    checkMiniMax(true),
    checkAndroid(true),
    checkLMStudio(true),
  ]);

  for (const check of checks) {
    if (check.status === 'ok') {
      process.stdout.write(`[✓] ${check.name}: ${check.detail || 'connected'}\n`);
    } else if (check.status === 'warn') {
      process.stdout.write(`[!] ${check.name}: ${check.detail || 'not running (optional)'}\n`);
    } else {
      process.stdout.write(`[✗] ${check.name}: ${check.detail || 'error'}\n`);
    }
  }

  process.stdout.write('[DUCK] Ready\n');
}

// ============ Individual Health Checks ============

async function checkGateway(silent: boolean = false): Promise<HealthCheckResult> {
  const start = Date.now();
  try {
    // Check if OpenClaw gateway is reachable
    const gatewayPort = process.env.DUCK_GATEWAY_PORT || '18789';
    const gatewayHost = process.env.DUCK_GATEWAY_HOST || 'localhost';
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    
    try {
      const response = await fetch(`http://${gatewayHost}:${gatewayPort}/health`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);
      
      if (response.ok) {
        return {
          name: 'Gateway',
          status: 'ok',
          detail: 'connected',
          latencyMs: Date.now() - start,
        };
      } else {
        return {
          name: 'Gateway',
          status: 'warn',
          detail: `HTTP ${response.status}`,
          latencyMs: Date.now() - start,
        };
      }
    } catch {
      clearTimeout(timeout);
      // Gateway might not be running - that's okay for CLI-only mode
      return {
        name: 'Gateway',
        status: silent ? 'warn' : 'ok',
        detail: silent ? 'not running (optional)' : 'not running - CLI mode available',
        latencyMs: Date.now() - start,
        optional: true,
      };
    }
  } catch (e: any) {
    return {
      name: 'Gateway',
      status: 'error',
      detail: e.message,
      latencyMs: Date.now() - start,
    };
  }
}

async function checkMiniMax(silent: boolean = false): Promise<HealthCheckResult> {
  const start = Date.now();
  try {
    const apiKey = process.env.MINIMAX_API_KEY;
    if (!apiKey) {
      return {
        name: 'MiniMax',
        status: silent ? 'warn' : 'error',
        detail: 'API key not set',
        latencyMs: Date.now() - start,
        optional: silent,
      };
    }

    // Quick API check - just verify the key format
    if (!apiKey.startsWith('sk-')) {
      return {
        name: 'MiniMax',
        status: 'error',
        detail: 'Invalid API key format',
        latencyMs: Date.now() - start,
      };
    }

    // Try a minimal API call
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch('https://api.minimax.chat/v1/models', {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (response.ok) {
        return {
          name: 'MiniMax',
          status: 'ok',
          detail: 'available',
          latencyMs: Date.now() - start,
        };
      } else if (response.status === 401) {
        return {
          name: 'MiniMax',
          status: 'error',
          detail: 'Invalid API key',
          latencyMs: Date.now() - start,
        };
      } else {
        return {
          name: 'MiniMax',
          status: 'warn',
          detail: `HTTP ${response.status}`,
          latencyMs: Date.now() - start,
        };
      }
    } catch {
      clearTimeout(timeout);
      return {
        name: 'MiniMax',
        status: silent ? 'warn' : 'error',
        detail: 'Network error - service unavailable',
        latencyMs: Date.now() - start,
        optional: silent,
      };
    }
  } catch (e: any) {
    return {
      name: 'MiniMax',
      status: 'error',
      detail: e.message,
      latencyMs: Date.now() - start,
    };
  }
}

async function checkKimi(silent: boolean = false): Promise<HealthCheckResult> {
  const start = Date.now();
  try {
    const apiKey = process.env.KIMI_API_KEY;
    if (!apiKey) {
      return {
        name: 'Kimi',
        status: silent ? 'warn' : 'ok',
        detail: 'API key not set (optional)',
        latencyMs: Date.now() - start,
        optional: true,
      };
    }

    // Verify key format
    if (!apiKey.startsWith('sk-')) {
      return {
        name: 'Kimi',
        status: 'warn',
        detail: 'Invalid API key format',
        latencyMs: Date.now() - start,
        optional: true,
      };
    }

    // Quick network check to Moonshot
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch('https://api.moonshot.cn/v1/models', {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (response.ok) {
        return {
          name: 'Kimi',
          status: 'ok',
          detail: 'available',
          latencyMs: Date.now() - start,
        };
      } else {
        return {
          name: 'Kimi',
          status: 'warn',
          detail: `HTTP ${response.status}`,
          latencyMs: Date.now() - start,
          optional: true,
        };
      }
    } catch {
      clearTimeout(timeout);
      return {
        name: 'Kimi',
        status: 'warn',
        detail: 'Network error (optional)',
        latencyMs: Date.now() - start,
        optional: true,
      };
    }
  } catch (e: any) {
    return {
      name: 'Kimi',
      status: 'warn',
      detail: e.message,
      latencyMs: Date.now() - start,
      optional: true,
    };
  }
}

async function checkOpenRouter(silent: boolean = false): Promise<HealthCheckResult> {
  const start = Date.now();
  try {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return {
        name: 'OpenRouter',
        status: 'ok',
        detail: 'API key not set (optional)',
        latencyMs: Date.now() - start,
        optional: true,
      };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch('https://openrouter.ai/api/v1/models', {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (response.ok) {
        return {
          name: 'OpenRouter',
          status: 'ok',
          detail: 'available',
          latencyMs: Date.now() - start,
        };
      } else {
        return {
          name: 'OpenRouter',
          status: 'warn',
          detail: `HTTP ${response.status}`,
          latencyMs: Date.now() - start,
          optional: true,
        };
      }
    } catch {
      clearTimeout(timeout);
      return {
        name: 'OpenRouter',
        status: 'warn',
        detail: 'Network error (optional)',
        latencyMs: Date.now() - start,
        optional: true,
      };
    }
  } catch (e: any) {
    return {
      name: 'OpenRouter',
      status: 'warn',
      detail: e.message,
      latencyMs: Date.now() - start,
      optional: true,
    };
  }
}

async function checkAndroid(silent: boolean = false): Promise<HealthCheckResult> {
  const start = Date.now();
  try {
    const android = getAndroidTools();
    const devices = await android.refreshDevices();
    
    if (devices.length === 0) {
      return {
        name: 'Android',
        status: silent ? 'warn' : 'ok',
        detail: 'no devices connected',
        latencyMs: Date.now() - start,
        optional: true,
      };
    }

    return {
      name: 'Android',
      status: 'ok',
      detail: `${devices.length} device${devices.length > 1 ? 's' : ''} connected`,
      latencyMs: Date.now() - start,
    };
  } catch (e: any) {
    return {
      name: 'Android',
      status: silent ? 'warn' : 'error',
      detail: `ADB error: ${e.message}`,
      latencyMs: Date.now() - start,
      optional: true,
    };
  }
}

async function checkMCPServers(): Promise<HealthCheckResult> {
  const start = Date.now();
  try {
    // Check configured MCP servers
    const mcporterPath = process.env.MCP_SERVER_PATH || '/usr/local/bin/mcporter';
    const fs = await import('fs');
    
    if (!fs.existsSync(mcporterPath)) {
      return {
        name: 'MCP Servers',
        status: 'warn',
        detail: 'mcporter not found',
        latencyMs: Date.now() - start,
        optional: true,
      };
    }

    return {
      name: 'MCP Servers',
      status: 'ok',
      detail: 'available',
      latencyMs: Date.now() - start,
    };
  } catch (e: any) {
    return {
      name: 'MCP Servers',
      status: 'warn',
      detail: e.message,
      latencyMs: Date.now() - start,
      optional: true,
    };
  }
}

async function checkLMStudio(silent: boolean = false): Promise<HealthCheckResult> {
  const start = Date.now();
  try {
    // Check if LM Studio is configured and reachable
    const lmStudioHost = process.env.LMSTUDIO_HOST || 'localhost';
    const lmStudioPort = process.env.LMSTUDIO_PORT || '1234';
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    try {
      const response = await fetch(`http://${lmStudioHost}:${lmStudioPort}/v1/models`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (response.ok) {
        return {
          name: 'LM Studio',
          status: 'ok',
          detail: 'available',
          latencyMs: Date.now() - start,
        };
      } else {
        return {
          name: 'LM Studio',
          status: 'warn',
          detail: `HTTP ${response.status}`,
          latencyMs: Date.now() - start,
          optional: true,
        };
      }
    } catch {
      clearTimeout(timeout);
      return {
        name: 'LM Studio',
        status: silent ? 'warn' : 'ok',
        detail: 'not running (optional)',
        latencyMs: Date.now() - start,
        optional: true,
      };
    }
  } catch (e: any) {
    return {
      name: 'LM Studio',
      status: 'warn',
      detail: e.message,
      latencyMs: Date.now() - start,
      optional: true,
    };
  }
}

/**
 * Check system resources: RAM, Disk, CPU
 */
async function checkSystem(): Promise<HealthCheckResult> {
  const start = Date.now();
  try {
    const { execSync } = await import('child_process');
    const os = await import('os');

    // RAM check - use platform-specific command for accurate free memory
    let memPercent = 0;
    let memFree = '';
    try {
      if (process.platform === 'darwin') {
        // macOS: use vm_stat for accurate free memory
        const vmStat = execSync('vm_stat | head -5', { encoding: 'utf8' });
        const pagesFree = parseInt(vmStat.match(/Pages free[:\s]+(\d+)/i)?.[1] || '0');
        const pagesInactive = parseInt(vmStat.match(/Pages inactive[:\s]+(\d+)/i)?.[1] || '0');
        const pagesSpeculative = parseInt(vmStat.match(/Pages speculative[:\s]+(\d+)/i)?.[1] || '0');
        const pageSize = 4096; // macOS page size
        const totalMemBytes = os.totalmem();
        const freeBytes = (pagesFree + pagesInactive + pagesSpeculative) * pageSize;
        memFree = `${Math.round(freeBytes / 1024 / 1024 / 1024 * 10) / 10}GB`;
        memPercent = Math.round(((totalMemBytes - freeBytes) / totalMemBytes) * 100);
      } else {
        // Linux/other: os.freemem() is reasonably accurate
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        memFree = `${Math.round(freeMem / 1024 / 1024 / 1024 * 10) / 10}GB`;
        memPercent = Math.round(((totalMem - freeMem) / totalMem) * 100);
      }
    } catch {
      // fallback to simple calculation
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      memFree = `${Math.round(freeMem / 1024 / 1024 / 1024)}GB`;
      memPercent = Math.round(((totalMem - freeMem) / totalMem) * 100);
    }

    // Disk check (root filesystem)
    let diskPercent = 0;
    let diskFreeStr = '';
    try {
      if (process.platform === 'darwin') {
        const diskInfo = execSync('df -h / | tail -1 | awk \'{print $5 " " $4}\' 2>/dev/null').toString().trim();
        const parts = diskInfo.split(/\s+/);
        diskPercent = parseInt(parts[0]);
        diskFreeStr = `, ${parts[1]} free`;
      } else if (process.platform === 'linux') {
        const diskInfo = execSync('df -h / | tail -1 | awk \'{print $5 " " $4}\' 2>/dev/null').toString().trim();
        const parts = diskInfo.split(/\s+/);
        diskPercent = parseInt(parts[0]);
        diskFreeStr = `, ${parts[1]} free`;
      }
    } catch {
      // disk check failed, skip
    }

    // Build detail string
    const memStr = `RAM ${memPercent}% used (${memFree} free)`;
    const diskStr = diskPercent > 0 ? ` | Disk ${diskPercent}% used${diskFreeStr}` : '';

    // Determine status (macOS is more memory-compressed so use higher thresholds)
    let status: 'ok' | 'warn' | 'error' = 'ok';
    const isMac = process.platform === 'darwin';
    if (memPercent > 97 || diskPercent > 95) status = 'error';
    else if (memPercent > (isMac ? 90 : 80) || diskPercent > 85) status = 'warn';

    const detail = `${memStr}${diskStr}`;
    return { name: 'System', status, detail, latencyMs: Date.now() - start };
  } catch (e: any) {
    return { name: 'System', status: 'warn', detail: e.message, latencyMs: Date.now() - start, optional: true };
  }
}

/**
 * Check running services: Gateway, AI Council, CannaAI, etc.
 */
async function checkServices(): Promise<HealthCheckResult> {
  const start = Date.now();
  try {
    const { execSync } = await import('child_process');
    const { existsSync } = await import('fs');

    const services: { name: string; check: () => boolean }[] = [
      { name: 'OpenClaw Gateway', check: () => existsSync('/tmp/openclaw-gateway.lock') || existsSync(`${process.env.HOME || '/root'}/.openclaw/gateway.lock`) },
      { name: 'LM Studio', check: () => {
        try {
          execSync('curl -s http://localhost:1234/v1/models --max-time 1 > /dev/null 2>&1', { stdio: 'ignore' });
          return true;
        } catch { return false; }
      }},
      { name: 'AI Council', check: () => existsSync('/tmp/ai-council.lock') || existsSync(`${process.env.HOME || '/root'}/.duck/council.lock`) },
    ];

    const running: string[] = [];
    const stopped: string[] = [];

    for (const svc of services) {
      try {
        if (svc.check()) {
          running.push(svc.name);
        } else {
          stopped.push(svc.name);
        }
      } catch {
        stopped.push(svc.name);
      }
    }

    let status: 'ok' | 'warn' | 'error' = 'ok';
    let detail: string;

    if (running.length === 0) {
      detail = 'No services running (CLI mode OK)';
      status = 'ok';
    } else if (running.length < services.length) {
      detail = `Running: ${running.join(', ')} | Stopped: ${stopped.join(', ')}`;
      status = 'warn';
    } else {
      detail = `All ${running.length} services running`;
      status = 'ok';
    }

    return { name: 'Services', status, detail, latencyMs: Date.now() - start };
  } catch (e: any) {
    return { name: 'Services', status: 'warn', detail: e.message, latencyMs: Date.now() - start, optional: true };
  }
}

/**
 * Print a health report to console
 */
export function printHealthReport(report: HealthReport): void {
  const c = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    cyan: '\x1b[36m',
  };

  console.log(`\n${c.bold}🦆 Duck Agent Health Check${c.reset}\n`);

  for (const check of report.checks) {
    let icon: string;
    let color: string;

    if (check.status === 'ok') {
      icon = '✅';
      color = c.green;
    } else if (check.status === 'warn') {
      icon = '⚠️';
      color = c.yellow;
    } else {
      icon = '❌';
      color = c.red;
    }

    const detail = check.detail ? ` ${color}(${check.detail})${c.reset}` : '';
    const latency = check.latencyMs !== undefined ? ` ${c.cyan}${check.latencyMs}ms${c.reset}` : '';
    const optional = check.optional ? ` ${c.cyan}[optional]${c.reset}` : '';

    console.log(`  ${icon} ${check.name}${detail}${latency}${optional}`);
  }

  console.log(`\n${c.bold}Overall:${c.reset} ${report.overall === 'healthy' ? c.green + '✅ Healthy' : report.overall === 'degraded' ? c.yellow + '⚠️ Degraded' : c.red + '❌ Unhealthy'}${c.reset}`);
  console.log(`${c.bold}Summary:${c.reset} ${report.summary}\n`);
}
