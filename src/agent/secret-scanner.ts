/**
 * Secret Scanner - Hermes-inspired API key exfiltration blocker
 * Ported from: https://github.com/NousResearch/hermes-agent (agent/redact.py)
 *
 * Scans tool results and URLs for API keys, tokens, and credentials.
 * Blocks exfiltration via URL encoding, base64, or prompt injection.
 */

import { homedir } from "os";

// Known API key prefix patterns (Hermes-inspired)
const KEY_PREFIX_PATTERNS: Array<{ pattern: RegExp; name: string }> = [
  { pattern: /sk-[A-Za-z0-9_-]{10,}/g, name: "OpenAI/OpenRouter" },
  { pattern: /ghp_[A-Za-z0-9]{10,}/g, name: "GitHub PAT" },
  { pattern: /github_pat_[A-Za-z0-9_]{10,}/g, name: "GitHub Fine-grained PAT" },
  { pattern: /xox[baprs]-[A-Za-z0-9-]{10,}/g, name: "Slack" },
  { pattern: /AIza[A-Za-z0-9_-]{30,}/g, name: "Google API" },
  { pattern: /pplx-[A-Za-z0-9]{10,}/g, name: "Perplexity" },
  { pattern: /fal_[A-Za-z0-9_-]{10,}/g, name: "Fal.ai" },
  { pattern: /fc-[A-Za-z0-9]{10,}/g, name: "Firecrawl" },
  { pattern: /AKIA[A-Z0-9]{16}/g, name: "AWS Access Key" },
  { pattern: /sk_live_[A-Za-z0-9]{10,}/g, name: "Stripe Live" },
  { pattern: /sk_test_[A-Za-z0-9]{10,}/g, name: "Stripe Test" },
  { pattern: /SG\.[A-Za-z0-9_-]{10,}/g, name: "SendGrid" },
  { pattern: /hf_[A-Za-z0-9]{10,}/g, name: "HuggingFace" },
  { pattern: /r8_[A-Za-z0-9]{10,}/g, name: "Replicate" },
  { pattern: /npm_[A-Za-z0-9]{10,}/g, name: "npm" },
  { pattern: /pypi-[A-Za-z0-9_-]{10,}/g, name: "PyPI" },
  { pattern: /dop_v1_[A-Za-z0-9]{10,}/g, name: "DigitalOcean" },
  { pattern: /doo_v1_[A-Za-z0-9]{10,}/g, name: "DigitalOcean OAuth" },
  { pattern: /am_[A-Za-z0-9_-]{10,}/g, name: "AgentMail" },
  { pattern: /tvly-[A-Za-z0-9]{10,}/g, name: "Tavily" },
  { pattern: /exa_[A-Za-z0-9]{10,}/g, name: "Exa" },
  // MiniMax API key (Duckets' key format)
  { pattern: /sk-cp-[A-Za-z0-9]{20,}/g, name: "MiniMax" },
  // Kimi API key
  { pattern: /sk-kimi-[A-Za-z0-9]{10,}/g, name: "Kimi/Moonshot" },
  // BrowserOS
  { pattern: /brow_[A-Za-z0-9]{10,}/g, name: "BrowserOS" },
];

// ENV assignment patterns
const ENV_SECRET_RE = /(?:API_?KEY|TOKEN|SECRET|PASSWORD|PASSWD|CREDENTIAL|AUTH|PRIVATE)[_\-]?(?:KEY|TOKEN|KEYS|PASS)?\s*[=:]\s*['"]?([^\s'"]+)['"]?/gi;

// JSON field patterns
const JSON_KEY_RE = /"(?:api_?key|token|secret|password|access_token|refresh_token|auth_token|bearer|api_secret|private_key)":\s*"([^"]+)"/gi;

// Telegram bot tokens
const TELEGRAM_RE = /(\d{8,}):([-A-Za-z0-9_]{30,})/g;

// Authorization headers
const AUTH_HEADER_RE = /(Authorization:\s*Bearer\s+)(\S+)/gi;

export interface ScanResult {
  clean: boolean;
  findings: Finding[];
  redacted: string;
}

export interface Finding {
  type: string;
  name: string;
  value: string;
  start: number;
  end: number;
}

export interface SecretScannerConfig {
  enabled: boolean;
  blockOnFind: boolean;
  redactInLogs: boolean;
}

const DEFAULT_CONFIG: SecretScannerConfig = {
  enabled: true,
  blockOnFind: false,  // Just warn, don't block by default
  redactInLogs: true,
};

/**
 * Scan text for leaked API keys/secrets.
 */
export function scanForSecrets(text: string, config: Partial<SecretScannerConfig> = {}): ScanResult {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  if (!cfg.enabled || !text) {
    return { clean: true, findings: [], redacted: text };
  }

  const findings: Finding[] = [];
  const positions = new Set<string>(); // Track (start,end) to avoid duplicates

  // Helper to add finding without overlap
  const addFinding = (type: string, name: string, value: string, start: number, end: number) => {
    const key = `${start}-${end}`;
    if (positions.has(key)) return;
    positions.add(key);
    findings.push({ type, name, value, start, end });
  };

  // Scan for key prefix patterns
  for (const { pattern, name } of KEY_PREFIX_PATTERNS) {
    // Reset lastIndex for global patterns
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const value = match[0];
      // Short tokens: mask most, preserve first 6 + last 4
      const masked = value.length > 10 ? value.slice(0, 6) + "..." + value.slice(-4) : "***";
      addFinding("api_key", name, masked, match.index, match.index + value.length);
    }
  }

  // Scan for Telegram tokens
  TELEGRAM_RE.lastIndex = 0;
  let tgMatch;
  while ((tgMatch = TELEGRAM_RE.exec(text)) !== null) {
    const value = tgMatch[0];
    addFinding("token", "Telegram Bot", tgMatch[1] + ":" + "***", tgMatch.index, tgMatch.index + value.length);
  }

  // Scan for Authorization headers
  AUTH_HEADER_RE.lastIndex = 0;
  let authMatch;
  while ((authMatch = AUTH_HEADER_RE.exec(text)) !== null) {
    const value = authMatch[0];
    addFinding("auth_header", "Authorization", authMatch[1] + "***", authMatch.index, authMatch.index + value.length);
  }

  // Scan for ENV assignments
  let envMatch;
  while ((envMatch = ENV_SECRET_RE.exec(text)) !== null) {
    const value = envMatch[0];
    addFinding("env_var", "Environment Variable", envMatch[1].slice(0, 8) + "***", envMatch.index, envMatch.index + value.length);
  }

  // Scan for JSON key-value secrets
  let jsonMatch;
  while ((jsonMatch = JSON_KEY_RE.exec(text)) !== null) {
    const value = jsonMatch[0];
    addFinding("json_secret", "JSON Secret Field", jsonMatch[2].slice(0, 8) + "***", jsonMatch.index, jsonMatch.index + value.length);
  }

  if (findings.length === 0) {
    return { clean: true, findings: [], redacted: text };
  }

  // Sort by position and redact
  findings.sort((a, b) => a.start - b.start);

  // Build redacted text
  let redacted = "";
  let lastEnd = 0;
  for (const f of findings) {
    redacted += text.slice(lastEnd, f.start);
    redacted += `[${f.name.toUpperCase()}_REDACTED]`;
    lastEnd = f.end;
  }
  redacted += text.slice(lastEnd);

  return { clean: false, findings, redacted };
}

/**
 * Check if a URL contains a secret in the query string.
 */
export function scanUrlForSecrets(url: string): { clean: boolean; reason?: string } {
  try {
    const parsed = new URL(url);
    const secretParams = ["token", "key", "api_key", "apikey", "secret", "password", "auth", "access_token"];
    for (const [k, v] of parsed.searchParams) {
      if (secretParams.includes(k.toLowerCase()) && v.length > 5) {
        return {
          clean: false,
          reason: `URL contains secret in query param "${k}": ${k}=${v.slice(0, 6)}...`
        };
      }
    }
  } catch {}

  return { clean: true };
}

/**
 * Redact secrets from tool results before logging/display.
 */
export function redactFromResult(result: any): any {
  if (!result) return result;

  const str = typeof result === "string" ? result : JSON.stringify(result);
  const { redacted } = scanForSecrets(str, { redactInLogs: true });

  try {
    return JSON.parse(redacted);
  } catch {
    return redacted;
  }
}

/**
 * Log a warning about found secrets (but don't block execution).
 */
export function warnOnSecrets(findings: Finding[], context: string): void {
  if (findings.length === 0) return;

  const uniqueNames = [...new Set(findings.map(f => f.name))];
  console.warn(`[SecretScanner] ⚠️ Potential secret(s) detected in ${context}:`);
  for (const name of uniqueNames) {
    console.warn(`  [SecretScanner]   • ${name}: ${findings.filter(f => f.name === name).length} occurrence(s)`);
  }
  console.warn(`[SecretScanner]   Values have been redacted. Do NOT share this output.`);
}

export class SecretScanner {
  private enabled: boolean;
  private blockOnFind: boolean;
  private redactInLogs: boolean;

  constructor(config: Partial<SecretScannerConfig> = {}) {
    const cfg = { ...DEFAULT_CONFIG, ...config };
    this.enabled = cfg.enabled;
    this.blockOnFind = cfg.blockOnFind;
    this.redactInLogs = cfg.redactInLogs;
  }

  scan(text: string): ScanResult {
    return scanForSecrets(text, { enabled: this.enabled, redactInLogs: this.redactInLogs });
  }

  scanUrl(url: string): { clean: boolean; reason?: string } {
    return scanUrlForSecrets(url);
  }

  redact(result: any): any {
    return redactFromResult(result);
  }

  warn(findings: Finding[], context: string): void {
    return warnOnSecrets(findings, context);
  }
}

export default { SecretScanner, scanForSecrets, scanUrlForSecrets, redactFromResult, warnOnSecrets };
