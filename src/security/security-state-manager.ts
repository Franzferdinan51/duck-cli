/**
 * 🦆 Duck Agent - Security State Manager
 * Guards against malicious .env injection and unsafe browser control specifiers.
 * Modeled after OpenClaw v2026.4.9 security principles.
 *
 * Responsibilities:
 * 1. Block runtime-control env vars from untrusted .env files
 * 2. Reject unsafe URL-style browser control specifiers
 * 3. Validate env vars before they are applied to the runtime
 */

import { URL } from 'url';
import { isIPv4, isIPv6 } from 'net';

// ---------------------------------------------------------------------------
// Blocked env var patterns
// ---------------------------------------------------------------------------

/**
 * Env vars that, if set in a workspace .env file, could let the file override
 * runtime behavior in a way that is dangerous or unexpected.
 *
 * Rules:
 * - These vars are OK from the real shell environment (CLI, CI, system)
 * - They are BLOCKED from being applied when loaded from a user-provided .env
 *   path (e.g. the duck source dir's .env or cwd .env)
 */
const BLOCKED_ENV_PATTERNS: RegExp[] = [
  // Duck runtime control — .env files should not override how duck itself runs
  /^DUCK_SOURCE_DIR$/i,
  /^DUCK_BOT_MODE$/i,
  /^DUCK_PROVIDER$/i,
  /^DUCK_MODEL$/i,
  /^DUCK_MESH_PORT$/i,
  /^DUCK_MCP_PORT$/i,
  /^DUCK_ACP_PORT$/i,
  /^DUCK_WS_PORT$/i,
  /^DUCK_GATEWAY_PORT$/i,
  /^DUCK_CONFIG_PATH$/i,
  /^DUCK_DATA_DIR$/i,
  /^DUCK_LOG_LEVEL$/i,
  /^DUCK_SESSION_DIR$/i,

  // OpenClaw / ACP bridge control — workspace .env should not hijack the bridge
  /^OPENCLAW_/,
  /^ACP_/,
  /^ACPX_/,

  // Browser / desktop control via env vars — classic lateral movement vector
  /^BROWSEROS_/,
  /^BROWSEROS_URL$/i,
  /^BROWSER_CONTROL$/i,
  /^OPEN_BROWSER$/i,
  /^BROWSER_URL$/i,
  /^DUCK_BROWSER_URL$/i,
  /^DUCK_DESKTOP_URL$/i,
  /^DESKTOP_BRIDGE_/,
  /^CLAWDCURSOR_/,

  // Execution environment hijacking
  /^NODE_ENV$/i,
  /^NODE_OPTIONS$/i,
  /^EXECUTABLE_PATH$/i,
  /^PROXY_/i,
  /^HTTP_PROXY$/i,
  /^HTTPS_PROXY$/i,
  /^NO_PROXY$/i,

  // Secret injection via env (legitimate secrets are fine; re-injecting them
  // via an untrusted .env to override program flow is not)
  /^DUCK_SECRET_/i,
];

// ---------------------------------------------------------------------------
// SSRF helpers (subset of src/security/ssrf.ts logic, self-contained)
// ---------------------------------------------------------------------------

const BLOCKED_HOSTS = new Set([
  'localhost', '127.0.0.1', '::1', '0.0.0.0', '::ffff:127.0.0.1',
]);

function isPrivateIPv4(addr: string): boolean {
  const parts = addr.split('.').map(Number);
  if (parts.length !== 4) return false;
  const b = (a: number, c: number, d: number) => parts[a] >= c && parts[a] <= d;
  return (
    parts[0] === 127 ||
    (parts[0] === 10) ||
    (parts[0] === 172 && b(1, 16, 31)) ||
    (parts[0] === 192 && parts[1] === 168) ||
    (parts[0] === 169 && parts[1] === 254)
  );
}

function isPrivateIPv6(addr: string): boolean {
  const lower = addr.toLowerCase();
  return (
    lower === '::1' ||
    lower.startsWith('fe80:') ||
    lower.startsWith('fc') ||
    lower.startsWith('fd') ||
    lower === '::ffff:127.0.0.1'
  );
}

function isPrivateHost(host: string): boolean {
  if (BLOCKED_HOSTS.has(host.toLowerCase())) return true;
  if (isIPv4(host)) return isPrivateIPv4(host);
  if (isIPv6(host)) return isPrivateIPv6(host);
  return false;
}

/**
 * Check a browser control URL for SSRF / localhost access.
 * Returns { allowed: false, reason } if blocked.
 */
export interface BrowserURLCheck {
  allowed: boolean;
  reason?: string;
  resolvedIP?: string;
}

export function validateBrowserControlURL(rawUrl: string): BrowserURLCheck {
  // Reject empty / whitespace
  const urlStr = rawUrl.trim();
  if (!urlStr) {
    return { allowed: false, reason: 'Empty browser control URL' };
  }

  // Reject dangerous schemes before URL parsing
  const dangerousSchemes = ['javascript:', 'data:', 'file:', 'vbscript:', 'blob:'];
  for (const scheme of dangerousSchemes) {
    if (urlStr.toLowerCase().startsWith(scheme)) {
      return { allowed: false, reason: `Blocked scheme: ${scheme}` };
    }
  }

  // Reject meta-refresh style strings (e.g. "60;url=http://...")
  if (/^\d+\s*;\s*url=/i.test(urlStr)) {
    return { allowed: false, reason: 'Blocked meta-refresh style control string' };
  }

  let parsed: URL;
  try {
    // Add a scheme so the URL parser handles plain hostnames correctly
    const withScheme = urlStr.match(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//)
      ? urlStr
      : `http://${urlStr}`;
    parsed = new URL(withScheme);
  } catch {
    return { allowed: false, reason: 'Invalid URL format' };
  }

  const host = parsed.hostname.toLowerCase();

  // Block localhost / private IPs for browser control (SSRF)
  if (isPrivateHost(host)) {
    return { allowed: false, reason: `Blocked private/localhost browser target: ${host}` };
  }

  // Block if the final resolved host (after redirects would resolve) is private
  // For now, check the direct host since we don't follow redirects
  const blockedTlds = ['onion', 'i2p', 'i2p'];
  if (blockedTlds.some(tld => host.endsWith(`.${tld}`))) {
    return { allowed: false, reason: `Blocked dark-net TLD: ${host}` };
  }

  return { allowed: true };
}

// ---------------------------------------------------------------------------
// Main SecurityStateManager
// ---------------------------------------------------------------------------

export interface EnvVarValidation {
  key: string;
  allowed: boolean;
  reason?: string;
  blockedPattern?: string;
}

export interface SecurityStateManagerOptions {
  /** Path from which the .env is being loaded (for context) */
  envFilePath?: string;
  /**
   * If true, treat the .env as trusted (e.g. ~/.duck/.env created by setup).
   * Default: false (workspace .env files are untrusted).
   */
  trustedEnvFile?: boolean;
}

/**
 * SecurityStateManager
 *
 * Guards the runtime against malicious .env content.
 * - Parses and validates env vars before they are applied
 * - Blocks runtime-control vars from untrusted .env files
 * - Rejects unsafe URL-style browser control specifiers
 */
export class SecurityStateManager {
  private blockedVars: Map<string, string> = new Map(); // key → blockedPattern
  private browserURLViolations: string[] = [];
  private envFilePath: string;
  private trustedEnvFile: boolean;

  constructor(options: SecurityStateManagerOptions = {}) {
    this.envFilePath = options.envFilePath ?? 'unknown';
    this.trustedEnvFile = options.trustedEnvFile ?? false;
  }

  /**
   * Validate a single env var key+value pair.
   * Returns validation result; mutates internal state.
   */
  validateVar(key: string, value: string): EnvVarValidation {
    // Trusted env files bypass most checks
    if (this.trustedEnvFile) {
      // But still check browser URL values even in trusted files
      this.checkBrowserControlValue(key, value);
      return { key, allowed: true };
    }

    // Blocked pattern check
    for (const pattern of BLOCKED_ENV_PATTERNS) {
      if (pattern.test(key)) {
        this.blockedVars.set(key, pattern.source);
        return {
          key,
          allowed: false,
          reason: `Runtime-control env var blocked from untrusted .env (${this.envFilePath}). Set it in your shell or ~/.duck/.env instead.`,
          blockedPattern: pattern.source,
        };
      }
    }

    // Browser control URL check
    const browserCheck = this.checkBrowserControlValue(key, value);
    if (!browserCheck.allowed) {
      return browserCheck;
    }

    return { key, allowed: true };
  }

  /**
   * Validate an entire flat env object (key-value pairs).
   * Returns array of validation results.
   */
  validateEnv(env: Record<string, string>): EnvVarValidation[] {
    const results: EnvVarValidation[] = [];
    for (const [key, value] of Object.entries(env)) {
      results.push(this.validateVar(key, value));
    }
    return results;
  }

  /**
   * Filter an env object: returns only vars that passed validation.
   * Logs blocked vars for audit.
   */
  filterEnv(env: Record<string, string>): Record<string, string> {
    const allowed: Record<string, string> = {};
    for (const [key, value] of Object.entries(env)) {
      const result = this.validateVar(key, value);
      if (result.allowed) {
        allowed[key] = value;
      } else {
        console.warn(
          `[SecurityStateManager] BLOCKED env var from ${this.envFilePath}: ` +
          `${key} (matched: ${result.blockedPattern})`
        );
      }
    }
    return allowed;
  }

  /**
   * Parse a .env file content and return a filtered env object.
   * Respects comments (#) and quoted values.
   */
  parseAndFilterEnv(content: string): Record<string, string> {
    const raw: Record<string, string> = {};
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      // Skip comments and empty lines
      if (!trimmed || trimmed.startsWith('#')) continue;
      // Skip export prefix
      const clean = trimmed.startsWith('export ') ? trimmed.slice(7) : trimmed;
      const eqIdx = clean.indexOf('=');
      if (eqIdx === -1) continue;
      const key = clean.slice(0, eqIdx).trim();
      let value = clean.slice(eqIdx + 1).trim();
      // Strip surrounding quotes
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      raw[key] = value;
    }
    return this.filterEnv(raw);
  }

  /**
   * Check if a value looks like a browser control URL and validate it.
   */
  private checkBrowserControlValue(key: string, value: string): EnvVarValidation {
    const browserControlKeys = [
      'BROWSEROS_URL', 'BROWSER_CONTROL', 'OPEN_BROWSER', 'BROWSER_URL',
      'DUCK_BROWSER_URL', 'DUCK_DESKTOP_URL', 'CLAWDCURSOR_URL',
      'OPENCLAW_BROWSER_URL', 'OPENCLAW_BROWSER_CTL', 'OPENCLAW_BROWSER_CONTROL',
    ];
    const keyLower = key.toLowerCase();
    const isBrowserKey = browserControlKeys.some(k => keyLower === k.toLowerCase());
    if (!isBrowserKey) {
      return { key, allowed: true };
    }

    const urlStr = value.trim();
    if (!urlStr) {
      return { key, allowed: true }; // empty is fine, just means "don't open browser"
    }

    const check = validateBrowserControlURL(urlStr);
    if (!check.allowed) {
      this.browserURLViolations.push(`${key}=${urlStr} → ${check.reason}`);
      return {
        key,
        allowed: false,
        reason: `Unsafe browser control URL in ${key}: ${check.reason}`,
      };
    }

    return { key, allowed: true };
  }

  // Accessors for audit / reporting
  getBlockedVars(): Map<string, string> {
    return new Map(this.blockedVars);
  }

  getBrowserURLViolations(): string[] {
    return [...this.browserURLViolations];
  }

  hasViolations(): boolean {
    return this.blockedVars.size > 0 || this.browserURLViolations.length > 0;
  }

  /**
   * Print a security report to stderr (non-intrusive).
   */
  printReport(): void {
    if (!this.hasViolations()) return;
    const { red, yellow, reset } = ansiColors();
    let report = `\n${red}[SecurityStateManager] Security report for: ${this.envFilePath}${reset}\n`;
    if (this.blockedVars.size > 0) {
      report += `${yellow}Blocked runtime-control env vars (not applied):${reset}\n`;
      this.blockedVars.forEach((pattern, key) => {
        report += `  ${red}✗${reset} ${key} (matched: ${pattern})\n`;
      });
    }
    if (this.browserURLViolations.length > 0) {
      report += `${yellow}Browser control URL violations:${reset}\n`;
      for (const v of this.browserURLViolations) {
        report += `  ${red}✗${reset} ${v}\n`;
      }
    }
    process.stderr.write(report + '\n');
  }
}

// ---------------------------------------------------------------------------
// ANSI helpers
// ---------------------------------------------------------------------------

function ansiColors() {
  return {
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    green: '\x1b[32m',
    cyan: '\x1b[36m',
    dim: '\x1b[2m',
    reset: '\x1b[0m',
  };
}

// ---------------------------------------------------------------------------
// Thin wrappers matching the OpenClaw v2026.4.9 surface area
// ---------------------------------------------------------------------------

export default SecurityStateManager;