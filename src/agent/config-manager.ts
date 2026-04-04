/**
 * 🦆 Duck Agent - Configuration Manager
 * YAML-based configuration with get/set commands
 * 
 * Config file: ~/.duck/config.yaml
 * 
 * Usage:
 *   duck config get <key>     - Get a config value
 *   duck config set <key> <value>  - Set a config value
 *   duck config list         - List all config
 *   duck config reset        - Reset to defaults
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { parse as yamlParse, stringify as yamlStringify } from 'yaml';

export interface DuckConfig {
  defaults: {
    model: string;
    maxRetries: number;
    provider?: string;
  };
  providers: {
    [provider: string]: {
      enabled: boolean;
      priority: number;
      apiKey?: string;
      baseUrl?: string;
    };
  };
  rateLimits?: {
    [tool: string]: number; // calls per minute
  };
  circuitBreaker?: {
    failureThreshold: number;  // failures before opening (default: 5)
    resetTimeoutMs: number;    // ms before trying again (default: 300000 = 5min)
  };
  gracefulDegradation?: {
    enabled: boolean;
    fallbackModels: string[];
  };
}

const DEFAULT_CONFIG: DuckConfig = {
  defaults: {
    model: 'MiniMax-M2.7',
    maxRetries: 2,
    provider: 'minimax',
  },
  providers: {
    minimax: {
      enabled: true,
      priority: 1,
    },
    kimi: {
      enabled: false,
      priority: 2,
    },
    openrouter: {
      enabled: false,
      priority: 3,
    },
  },
  circuitBreaker: {
    failureThreshold: 5,
    resetTimeoutMs: 300000,
  },
  gracefulDegradation: {
    enabled: true,
    fallbackModels: [
      'MiniMax-M2.7',
      'moonshot-v1-32k',
      'qwen/qwen3.6-plus-preview:free',
    ],
  },
};

export class ConfigManager {
  private config: DuckConfig;
  private configPath: string;
  private configDir: string;

  constructor() {
    this.configDir = join(homedir(), '.duck');
    this.configPath = join(this.configDir, 'config.yaml');
    this.config = this.load();
  }

  /**
   * Load config from file or return defaults
   */
  private load(): DuckConfig {
    // Ensure directory exists
    if (!existsSync(this.configDir)) {
      mkdirSync(this.configDir, { recursive: true });
    }

    if (!existsSync(this.configPath)) {
      // Create default config
      this.save(DEFAULT_CONFIG);
      return { ...DEFAULT_CONFIG };
    }

    try {
      const content = readFileSync(this.configPath, 'utf-8');
      const parsed = yamlParse(content) as Partial<DuckConfig>;
      
      // Merge with defaults to ensure all fields exist
      return this.merge(DEFAULT_CONFIG, parsed);
    } catch (e) {
      console.error('Error loading config, using defaults:', e);
      return { ...DEFAULT_CONFIG };
    }
  }

  /**
   * Save config to file
   */
  private save(config: DuckConfig): void {
    try {
      const content = yamlStringify(config);
      writeFileSync(this.configPath, content, { mode: 0o600 });
    } catch (e) {
      console.error('Error saving config:', e);
      throw e;
    }
  }

  /**
   * Deep merge two objects
   */
  private merge(defaults: any, overrides: any): any {
    const result: any = { ...defaults };
    
    for (const key of Object.keys(overrides)) {
      if (
        typeof defaults[key] === 'object' &&
        defaults[key] !== null &&
        typeof overrides[key] === 'object' &&
        overrides[key] !== null &&
        !Array.isArray(defaults[key]) &&
        !Array.isArray(overrides[key])
      ) {
        result[key] = this.merge(defaults[key], overrides[key]);
      } else {
        result[key] = overrides[key];
      }
    }
    
    return result;
  }

  /**
   * Get the full config
   */
  get(): DuckConfig {
    return { ...this.config };
  }

  /**
   * Get a specific config value by dot-notation key
   * e.g., get('defaults.model') returns the default model
   */
  getValue(key: string): any {
    const parts = key.split('.');
    let current: any = this.config;

    for (const part of parts) {
      if (current === undefined || current === null) {
        return undefined;
      }
      current = current[part];
    }

    return current;
  }

  /**
   * Set a specific config value by dot-notation key
   * e.g., set('defaults.model', 'gpt-4')
   */
  setValue(key: string, value: any): void {
    const parts = key.split('.');
    let current: any = this.config;

    // Navigate to the parent
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (typeof current[part] !== 'object' || current[part] === null) {
        current[part] = {};
      }
      current = current[part];
    }

    // Set the final value
    const lastPart = parts[parts.length - 1];
    current[lastPart] = value;

    this.save(this.config);
  }

  /**
   * Reset config to defaults
   */
  reset(): void {
    this.config = { ...DEFAULT_CONFIG };
    this.save(this.config);
  }

  /**
   * Get the default model
   */
  getDefaultModel(): string {
    return this.config.defaults.model;
  }

  /**
   * Get the default provider
   */
  getDefaultProvider(): string {
    return this.config.defaults.provider || 'minimax';
  }

  /**
   * Get max retries
   */
  getMaxRetries(): number {
    return this.config.defaults.maxRetries;
  }

  /**
   * Get circuit breaker config
   */
  getCircuitBreakerConfig() {
    return this.config.circuitBreaker || { failureThreshold: 5, resetTimeoutMs: 300000 };
  }

  /**
   * Get fallback models for graceful degradation
   */
  getFallbackModels(): string[] {
    return this.config.gracefulDegradation?.fallbackModels || ['MiniMax-M2.7'];
  }

  /**
   * Check if graceful degradation is enabled
   */
  isGracefulDegradationEnabled(): boolean {
    return this.config.gracefulDegradation?.enabled ?? true;
  }

  /**
   * Get enabled providers sorted by priority
   */
  getEnabledProviders(): Array<{ name: string; priority: number }> {
    const providers: Array<{ name: string; priority: number }> = [];
    
    for (const [name, config] of Object.entries(this.config.providers)) {
      if (config.enabled) {
        providers.push({ name, priority: config.priority });
      }
    }
    
    return providers.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Set provider enabled/disabled
   */
  setProviderEnabled(provider: string, enabled: boolean): void {
    if (!this.config.providers[provider]) {
      this.config.providers[provider] = {
        enabled,
        priority: Object.keys(this.config.providers).length + 1,
      };
    } else {
      this.config.providers[provider].enabled = enabled;
    }
    this.save(this.config);
  }

  /**
   * Export config as JSON string
   */
  toJSON(): string {
    return JSON.stringify(this.config, null, 2);
  }

  /**
   * Get config file path
   */
  getConfigPath(): string {
    return this.configPath;
  }
}

// Singleton instance
let configManagerInstance: ConfigManager | null = null;

export function getConfigManager(): ConfigManager {
  if (!configManagerInstance) {
    configManagerInstance = new ConfigManager();
  }
  return configManagerInstance;
}
