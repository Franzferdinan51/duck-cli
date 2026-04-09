/**
 * 🦆 Duck CLI - Auth Manager
 * Manages authentication profiles for OpenClaw
 * Commands: openclaw models auth
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const OPENCLAW_CONFIG_PATH = join(homedir(), '.openclaw', 'openclaw.json');

export interface AuthProfile {
  name: string;
  provider: string;
  apiKey?: string;
  baseUrl?: string;
  enabled: boolean;
}

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

export class AuthManager {
  /**
   * List all auth profiles
   */
  listProfiles(): AuthProfile[] {
    const cfg = getOpenClawConfig();
    if (!cfg) return [];

    const profiles: AuthProfile[] = [];
    const auth = cfg.auth?.profiles || {};

    for (const [name, profile] of Object.entries(auth) as [string, any][]) {
      profiles.push({
        name,
        provider: profile.provider || 'unknown',
        apiKey: profile.apiKey ? '***' : undefined,
        baseUrl: profile.baseUrl,
        enabled: profile.enabled !== false,
      });
    }

    return profiles;
  }

  /**
   * Print auth profiles to console
   */
  printProfiles(): void {
    const profiles = this.listProfiles();
    if (profiles.length === 0) {
      console.log('\n🦆 No auth profiles configured.');
      console.log('   Add API keys for providers like OpenAI, Anthropic, MiniMax, etc.');
      return;
    }

    console.log(`\n🦆 Auth Profiles (${profiles.length}):\n`);
    console.log('  NAME              PROVIDER        STATUS    API KEY');
    console.log('  ' + '─'.repeat(65));

    for (const p of profiles) {
      const status = p.enabled ? '🟢' : '⚪';
      const apiKeyStatus = p.apiKey ? '✅ set' : '❌ not set';
      console.log(`  ${p.name.padEnd(17)} ${p.provider.padEnd(15)} ${status}        ${apiKeyStatus}`);
    }
    console.log();
  }

  /**
   * Add or update an auth profile
   */
  setProfile(name: string, provider: string, apiKey: string, baseUrl?: string): boolean {
    const cfg = getOpenClawConfig();
    if (!cfg) {
      console.error('No OpenClaw config found');
      return false;
    }

    if (!cfg.auth) cfg.auth = {};
    if (!cfg.auth.profiles) cfg.auth.profiles = {};

    cfg.auth.profiles[name] = {
      provider,
      apiKey,
      ...(baseUrl && { baseUrl }),
      enabled: true,
    };

    saveOpenClawConfig(cfg);
    console.log(`✅ Set auth profile "${name}" for ${provider}`);
    return true;
  }

  /**
   * Remove an auth profile
   */
  removeProfile(name: string): boolean {
    const cfg = getOpenClawConfig();
    if (!cfg) return false;

    const profiles = cfg.auth?.profiles || {};
    if (!profiles[name]) {
      console.log(`⚠️ Profile "${name}" not found`);
      return false;
    }

    delete profiles[name];
    saveOpenClawConfig(cfg);
    console.log(`✅ Removed auth profile "${name}"`);
    return true;
  }

  /**
   * Enable/disable a profile
   */
  setProfileEnabled(name: string, enabled: boolean): boolean {
    const cfg = getOpenClawConfig();
    if (!cfg) return false;

    const profile = cfg.auth?.profiles?.[name];
    if (!profile) {
      console.log(`⚠️ Profile "${name}" not found`);
      return false;
    }

    profile.enabled = enabled;
    saveOpenClawConfig(cfg);
    console.log(`${enabled ? '✅ Enabled' : '⚪ Disabled'} auth profile "${name}"`);
    return true;
  }

  /**
   * Get a profile's API key (for internal use)
   */
  getApiKey(name: string): string | null {
    const cfg = getOpenClawConfig();
    if (!cfg) return null;

    return cfg.auth?.profiles?.[name]?.apiKey || null;
  }
}

export default AuthManager;
