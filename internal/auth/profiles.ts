/**
 * Duck CLI - Auth Profiles with Health Checks & Auto-Rotation
 * 
 * Based on OpenClaw's auth-profiles.ts:
 * - Per-provider credential stores
 * - Cooldown tracking after failures
 * - Health checks
 * - Automatic rotation on failure
 */

export interface AuthProfile {
  id: string;
  provider: string;
  apiKey: string;
  baseUrl?: string;
  isActive: boolean;
  failures: number;
  lastFailure?: number;
  cooldownUntil?: number;
  health: 'healthy' | 'degraded' | 'unhealthy';
  lastHealthCheck?: number;
}

export interface AuthConfig {
  profilesDir: string;
  maxFailures: number;
  cooldownMs: number;
  healthCheckIntervalMs: number;
}

const DEFAULT_CONFIG: AuthConfig = {
  profilesDir: '.duck/auth',
  maxFailures: 3,
  cooldownMs: 60 * 1000, // 1 minute
  healthCheckIntervalMs: 5 * 60 * 1000 // 5 minutes
};

export class AuthProfiles {
  private config: AuthConfig;
  private profilesDir: string;
  private profiles = new Map<string, AuthProfile>();
  private healthChecks = new Map<string, NodeJS.Timeout>();

  constructor(config?: Partial<AuthConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.profilesDir = this.config.profilesDir;
  }

  // Add a profile
  add(profile: Omit<AuthProfile, 'isActive' | 'failures' | 'health'>): void {
    const fullProfile: AuthProfile = {
      ...profile,
      isActive: true,
      failures: 0,
      health: 'healthy'
    };
    
    this.profiles.set(profile.id, fullProfile);
  }

  // Get active profile for provider
  getActive(provider: string): AuthProfile | null {
    for (const profile of this.profiles.values()) {
      if (profile.provider === provider && profile.isActive && !this.isInCooldown(profile)) {
        return profile;
      }
    }
    return null;
  }

  // Get all profiles for provider
  getAll(provider: string): AuthProfile[] {
    return Array.from(this.profiles.values()).filter(p => p.provider === provider);
  }

  // Check if profile is in cooldown
  private isInCooldown(profile: AuthProfile): boolean {
    if (!profile.cooldownUntil) return false;
    return Date.now() < profile.cooldownUntil;
  }

  // Mark failure and potentially rotate
  async markFailure(profileId: string): Promise<{ rotated: boolean; newProfile?: AuthProfile }> {
    const profile = this.profiles.get(profileId);
    if (!profile) return { rotated: false };

    profile.failures++;
    profile.lastFailure = Date.now();

    if (profile.failures >= this.config.maxFailures) {
      // Enter cooldown
      profile.cooldownUntil = Date.now() + this.config.cooldownMs;
      profile.health = 'unhealthy';

      // Try to rotate to another profile
      const others = this.getAll(profile.provider).filter(p => 
        p.id !== profileId && p.isActive && !this.isInCooldown(p)
      );

      if (others.length > 0) {
        const newProfile = others[0];
        return { rotated: true, newProfile };
      }
    } else {
      profile.health = 'degraded';
    }

    return { rotated: false };
  }

  // Mark success
  markSuccess(profileId: string): void {
    const profile = this.profiles.get(profileId);
    if (!profile) return;

    profile.failures = 0;
    profile.health = 'healthy';
    profile.cooldownUntil = undefined;
    profile.lastHealthCheck = Date.now();
  }

  // Health check a profile
  async healthCheck(profileId: string, testFn: (apiKey: string, baseUrl?: string) => Promise<boolean>): Promise<boolean> {
    const profile = this.profiles.get(profileId);
    if (!profile) return false;

    try {
      const healthy = await testFn(profile.apiKey, profile.baseUrl);
      
      if (healthy) {
        this.markSuccess(profileId);
        return true;
      } else {
        await this.markFailure(profileId);
        return false;
      }
    } catch {
      await this.markFailure(profileId);
      return false;
    }
  }

  // Start periodic health checks
  startHealthChecks(
    testFn: (profile: AuthProfile) => Promise<boolean>
  ): void {
    for (const [id, profile] of this.profiles) {
      if (this.healthChecks.has(id)) continue;

      const interval = setInterval(async () => {
        if (this.isInCooldown(profile)) return;
        await this.healthCheck(id, (key, url) => testFn({ ...profile, apiKey: key, baseUrl: url }));
      }, this.config.healthCheckIntervalMs);

      this.healthChecks.set(id, interval);
    }
  }

  // Stop health checks
  stopHealthChecks(): void {
    for (const interval of this.healthChecks.values()) {
      clearInterval(interval);
    }
    this.healthChecks.clear();
  }

  // List all profiles
  list(): AuthProfile[] {
    return Array.from(this.profiles.values());
  }

  // Get status summary
  getStatus(): { provider: string; healthy: number; degraded: number; unhealthy: number }[] {
    const byProvider = new Map<string, { healthy: number; degraded: number; unhealthy: number }>();

    for (const profile of this.profiles.values()) {
      if (!byProvider.has(profile.provider)) {
        byProvider.set(profile.provider, { healthy: 0, degraded: 0, unhealthy: 0 });
      }
      
      const stats = byProvider.get(profile.provider)!;
      if (profile.health === 'healthy') stats.healthy++;
      else if (profile.health === 'degraded') stats.degraded++;
      else stats.unhealthy++;
    }

    return Array.from(byProvider.entries()).map(([provider, stats]) => ({
      provider,
      ...stats
    }));
  }

  // Remove profile
  remove(id: string): boolean {
    const interval = this.healthChecks.get(id);
    if (interval) {
      clearInterval(interval);
      this.healthChecks.delete(id);
    }
    return this.profiles.delete(id);
  }

  // Rotate to next available profile
  rotate(provider: string): AuthProfile | null {
    const all = this.getAll(provider);
    const available = all.filter(p => p.isActive && !this.isInCooldown(p));
    
    if (available.length === 0) return null;
    
    // Return first available (could implement round-robin)
    return available[0];
  }
}

// Provider-specific health checks
export async function checkAnthropicHealth(apiKey: string): Promise<boolean> {
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-4-20240307',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'ping' }]
      })
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function checkOpenAIHealth(apiKey: string): Promise<boolean> {
  try {
    const response = await fetch('https://api.openai.com/v1/models', {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function checkGenericHealth(apiKey: string, baseUrl?: string): Promise<boolean> {
  try {
    const url = baseUrl || 'https://api.openai.com/v1';
    const response = await fetch(`${url}/models`, {
      headers: { 
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    return response.ok;
  } catch {
    return false;
  }
}
