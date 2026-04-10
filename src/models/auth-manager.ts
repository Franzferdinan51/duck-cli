/**
 * 🦆 Duck CLI - Auth Manager
 * 
 * Manages model auth profiles via `openclaw models auth` commands.
 * Auth profiles store API keys and OAuth tokens per provider.
 * 
 * Stored in: auth.profiles (openclaw.json)
 * Also uses: credentials/ directory for sensitive tokens
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { join, dirname } from 'path';

// ─── Config Paths ──────────────────────────────────────────────────────────────

const OPENCLAW_DIR = join(homedir(), '.openclaw');
const OPENCLAW_CONFIG_PATH = join(OPENCLAW_DIR, 'openclaw.json');
const CREDENTIALS_DIR = join(OPENCLAW_DIR, 'credentials');

function getOpenClawConfig(): any {
  if (!existsSync(OPENCLAW_CONFIG_PATH)) return null;
  try {
    return JSON.parse(readFileSync(OPENCLAW_CONFIG_PATH, 'utf-8'));
  } catch {
    return null;
  }
}

function saveOpenClawConfig(config: any): void {
  writeFileSync(OPENCLAW_CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
}

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface AuthProfile {
  id: string;
  provider: string;
  mode: 'api_key' | 'oauth' | 'plugin';
  label?: string;
  expiresAt?: number;   // Unix timestamp ms
  status?: 'active' | 'expiring' | 'expired' | 'missing';
}

export interface AuthStatus {
  profiles: AuthProfile[];
  primaryProvider: string;
  totalActive: number;
  totalExpiring: number;
  totalExpired: number;
}

// ─── Auth Manager ─────────────────────────────────────────────────────────────

export class AuthManager {
  constructor() {
    // Ensure credentials dir exists
    if (!existsSync(CREDENTIALS_DIR)) {
      try { mkdirSync(CREDENTIALS_DIR, { recursive: true }); } catch { /* ignore */ }
    }
  }

  /**
   * List all auth profiles (mirrors `openclaw models auth list`)
   */
  list(): AuthStatus {
    const cfg = getOpenClawConfig();
    const profiles: AuthProfile[] = [];

    if (cfg?.auth?.profiles) {
      const now = Date.now();
      const EXPIRE_WARN_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

      for (const [id, entry] of Object.entries(cfg.auth.profiles) as [string, any][]) {
        const parts = id.split(':');
        const provider = parts[0] || id;
        const label = parts[1] || provider;
        profiles.push({
          id,
          provider,
          mode: entry?.mode || 'api_key',
          label,
          expiresAt: entry?.expiresAt,
          status: this.getStatus(entry, now, EXPIRE_WARN_MS),
        });
      }
    }

    // Detect primary from config
    const primaryProvider = this.detectPrimaryProvider(cfg);

    return {
      profiles,
      primaryProvider,
      totalActive: profiles.filter(p => p.status === 'active').length,
      totalExpiring: profiles.filter(p => p.status === 'expiring').length,
      totalExpired: profiles.filter(p => p.status === 'expired' || p.status === 'missing').length,
    };
  }

  private detectPrimaryProvider(cfg: any): string {
    if (!cfg?.agents?.defaults?.model?.primary) return '';
    const primary = cfg.agents.defaults.model.primary;
    return primary.split('/')[0];
  }

  private getStatus(entry: any, now: number, warnMs: number): AuthProfile['status'] {
    if (!entry) return 'missing';
    if (entry.mode === 'oauth' && entry.expiresAt) {
      const msLeft = entry.expiresAt - now;
      if (msLeft <= 0) return 'expired';
      if (msLeft < warnMs) return 'expiring';
    }
    return 'active';
  }

  /**
   * Describe auth status (pretty-printed)
   */
  describe(): string {
    const status = this.list();
    const lines: string[] = ['\n🦆 Auth Profiles\n'];

    if (status.profiles.length === 0) {
      lines.push('  (none configured)\n');
      return lines.join('\n');
    }

    const icon = (s: AuthProfile['status']) =>
      s === 'active' ? '✅' : s === 'expiring' ? '🟡' : s === 'expired' ? '🔴' : '⚪';

    for (const p of status.profiles) {
      const expires = p.expiresAt
        ? ` (expires ${new Date(p.expiresAt).toLocaleDateString()})`
        : '';
      lines.push(`  ${icon(p.status)} ${p.id} [${p.mode}]${expires}`);
    }

    lines.push('');
    lines.push(`  Primary: ${status.primaryProvider || '(none)'}`);
    lines.push(`  Active: ${status.totalActive}  |  Expiring: ${status.totalExpiring}  |  Expired: ${status.totalExpired}`);
    lines.push('');
    return lines.join('\n');
  }

  /**
   * Add auth profile interactively (mirrors `openclaw models auth add`)
   */
  addInteractive(): void {
    // This requires TTY — delegate to openclaw CLI
    const { execSync } = require('child_process');
    try {
      execSync('openclaw models auth add', { stdio: 'inherit' });
    } catch {
      // User cancelled or failed
    }
  }

  /**
   * Paste a token directly (mirrors `openclaw models auth paste-token`)
   */
  pasteToken(provider: string, token: string): { success: boolean; message: string } {
    const cfg = getOpenClawConfig();
    if (!cfg) return { success: false, message: 'No OpenClaw config found' };

    cfg.auth = cfg.auth || {};
    cfg.auth.profiles = cfg.auth.profiles || {};

    const profileId = `${provider}:default`;
    cfg.auth.profiles[profileId] = {
      provider,
      mode: 'api_key',
    };

    // Save token to credentials dir (not in main config)
    const credPath = join(CREDENTIALS_DIR, `${provider}-token`);
    try {
      writeFileSync(credPath, token, { mode: 0o600 });
    } catch (e) {
      return { success: false, message: `Failed to save token: ${(e as Error).message}` };
    }

    saveOpenClawConfig(cfg);
    return { success: true, message: `Token saved for ${provider}` };
  }

  /**
   * Run provider login flow (mirrors `openclaw models auth login`)
   */
  login(provider: string, opts: { tty?: boolean } = {}): void {
    const { execSync } = require('child_process');
    const args = ['models', 'auth', 'login', provider];
    try {
      if (opts.tty) {
        execSync(`openclaw ${args.join(' ')}`, { stdio: 'inherit' });
      } else {
        execSync(`openclaw ${args.join(' ')}`, { encoding: 'utf-8', timeout: 60000 });
      }
    } catch (e) {
      throw new Error(`Login failed: ${(e as Error).message}`);
    }
  }

  /**
   * Check auth status for a specific provider
   */
  checkProvider(provider: string): AuthProfile | null {
    const status = this.list();
    return status.profiles.find(p => p.provider === provider) || null;
  }

  /**
   * Is a provider's auth active/valid?
   */
  isProviderAuthActive(provider: string): boolean {
    const profile = this.checkProvider(provider);
    if (!profile) return false;
    return profile.status === 'active' || profile.status === 'expiring';
  }

  /**
   * Get auth order for a specific agent (mirrors `openclaw models auth order`)
   */
  getAuthOrder(agentId?: string): string[] {
    const cfg = getOpenClawConfig();
    if (!cfg) return [];

    const key = agentId ? `agents.${agentId}.authOrder` : 'auth.order';
    const order = key.split('.').reduce((o: any, k) => o?.[k], cfg);
    return Array.isArray(order) ? order : [];
  }

  /**
   * Set auth order for a specific agent
   */
  setAuthOrder(order: string[], agentId?: string): { success: boolean; message: string } {
    const cfg = getOpenClawConfig();
    if (!cfg) return { success: false, message: 'No OpenClaw config found' };

    if (agentId) {
      cfg.agents = cfg.agents || {};
      cfg.agents[agentId] = cfg.agents[agentId] || {};
      cfg.agents[agentId].authOrder = order;
    } else {
      cfg.auth = cfg.auth || {};
      cfg.auth.order = order;
    }

    saveOpenClawConfig(cfg);
    return { success: true, message: `Auth order set: ${order.join(' → ')}` };
  }

  /**
   * Get stored credentials path for a provider
   */
  getCredentialsPath(provider: string): string {
    return join(CREDENTIALS_DIR, `${provider}-token`);
  }

  /**
   * Read stored token for a provider
   */
  getStoredToken(provider: string): string | null {
    const path = this.getCredentialsPath(provider);
    if (!existsSync(path)) return null;
    try {
      return readFileSync(path, 'utf-8').trim();
    } catch {
      return null;
    }
  }
}

// ─── Singleton ───────────────────────────────────────────────────────────────

let _instance: AuthManager | null = null;

export function getAuthManager(): AuthManager {
  if (!_instance) _instance = new AuthManager();
  return _instance;
}
