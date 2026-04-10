/**
 * 🦆 Duck CLI - Configuration Management Command
 * Full config get/set/unset/file/schema/validate
 */

import { Command } from 'commander';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { parse as yamlParse, stringify as yamlStringify } from 'yaml';

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

export interface DuckConfig {
  defaults: {
    model: string;
    maxRetries: number;
    provider?: string;
    temperature?: number;
    maxTokens?: number;
  };
  providers: {
    [provider: string]: {
      enabled: boolean;
      priority: number;
      apiKey?: string;
      baseUrl?: string;
      models?: string[];
    };
  };
  features?: {
    mesh?: boolean;
    subconscious?: boolean;
    skills?: boolean;
    council?: boolean;
    [key: string]: boolean | string | number | undefined;
  };
  rateLimits?: {
    [tool: string]: number;
  };
  circuitBreaker?: {
    failureThreshold: number;
    resetTimeoutMs: number;
  };
  gracefulDegradation?: {
    enabled: boolean;
    fallbackModels: string[];
  };
  logging?: {
    level: 'debug' | 'info' | 'warn' | 'error';
    file?: string;
  };
}

const DEFAULT_CONFIG: DuckConfig = {
  defaults: {
    model: 'MiniMax-M2.7',
    maxRetries: 2,
    provider: 'minimax',
    temperature: 0.7,
    maxTokens: 4096,
  },
  providers: {
    minimax: { enabled: true, priority: 1 },
    openrouter: { enabled: false, priority: 2 },
    kimi: { enabled: false, priority: 3 },
    openai: { enabled: false, priority: 4 },
    anthropic: { enabled: false, priority: 5 },
    lmstudio: { enabled: false, priority: 6 },
  },
  features: {
    mesh: false,
    subconscious: false,
    skills: true,
    council: false,
  },
  logging: {
    level: 'info',
  },
};

const CONFIG_SCHEMA = {
  type: 'object',
  required: ['defaults', 'providers'],
  properties: {
    defaults: {
      type: 'object',
      required: ['model', 'maxRetries', 'provider'],
      properties: {
        model: { type: 'string', minLength: 1 },
        maxRetries: { type: 'number', minimum: 0, maximum: 10 },
        provider: { type: 'string', enum: ['minimax', 'openrouter', 'kimi', 'openai', 'anthropic', 'lmstudio'] },
        temperature: { type: 'number', minimum: 0, maximum: 2 },
        maxTokens: { type: 'number', minimum: 1, maximum: 128000 },
      },
    },
    providers: {
      type: 'object',
      additionalProperties: {
        type: 'object',
        required: ['enabled', 'priority'],
        properties: {
          enabled: { type: 'boolean' },
          priority: { type: 'number', minimum: 1, maximum: 100 },
          apiKey: { type: 'string' },
          baseUrl: { type: 'string', format: 'uri' },
          models: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  },
};

export class ConfigManager {
  private configPath: string;
  private envPath: string;
  private config: DuckConfig;
  private initialized: boolean = false;

  constructor(configDir?: string) {
    const dir = configDir || join(homedir(), '.duck');
    this.configPath = join(dir, 'config.yaml');
    this.envPath = join(dir, '.env');
    this.config = this.loadConfig();
  }

  private loadConfig(): DuckConfig {
    if (existsSync(this.configPath)) {
      try {
        const raw = readFileSync(this.configPath, 'utf-8');
        const parsed = yamlParse(raw) as DuckConfig;
        // Merge with defaults
        return this.mergeConfig(DEFAULT_CONFIG, parsed);
      } catch (e) {
        console.warn(`${c.yellow}Warning: Failed to parse config.yaml, using defaults: ${e}${c.reset}`);
      }
    }
    return { ...DEFAULT_CONFIG };
  }

  private mergeConfig(defaults: DuckConfig, override: Partial<DuckConfig>): DuckConfig {
    return {
      ...defaults,
      ...override,
      defaults: { ...defaults.defaults, ...(override.defaults || {}) },
      providers: {
        ...defaults.providers,
        ...(override.providers || {}),
      },
      features: { ...defaults.features, ...(override.features || {}) },
    };
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    this.config = this.loadConfig();
    this.initialized = true;
  }

  get(key: string): unknown {
    const parts = key.split('.');
    let val: unknown = this.config;
    for (const part of parts) {
      if (val && typeof val === 'object' && part in val) {
        val = (val as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }
    return val;
  }

  set(key: string, value: unknown): void {
    const parts = key.split('.');
    let obj: Record<string, unknown> = this.config as unknown as Record<string, unknown>;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!(part in obj) || typeof obj[part] !== 'object') {
        obj[part] = {};
      }
      obj = obj[part] as Record<string, unknown>;
    }
    obj[parts[parts.length - 1]] = value;
  }

  unset(key: string): boolean {
    const parts = key.split('.');
    let obj: Record<string, unknown> = this.config as unknown as Record<string, unknown>;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!(parts[i] in obj) || typeof obj[parts[i]] !== 'object') {
        return false;
      }
      obj = obj[parts[i]] as Record<string, unknown>;
    }
    if (parts[parts.length - 1] in obj) {
      delete obj[parts[parts.length - 1]];
      return true;
    }
    return false;
  }

  save(): void {
    const dir = dirname(this.configPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(this.configPath, yamlStringify(this.config), { mode: 0o600 });
  }

  getPath(): string {
    return this.configPath;
  }

  getEnvPath(): string {
    return this.envPath;
  }

  toJSON(): string {
    return JSON.stringify(this.config, null, 2);
  }

  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this.config.defaults?.model) {
      errors.push('defaults.model is required');
    }
    if (!this.config.defaults?.provider) {
      errors.push('defaults.provider is required');
    }
    if (this.config.defaults?.maxRetries !== undefined) {
      if (this.config.defaults.maxRetries < 0 || this.config.defaults.maxRetries > 10) {
        errors.push('defaults.maxRetries must be between 0 and 10');
      }
    }
    if (this.config.defaults?.temperature !== undefined) {
      if (this.config.defaults.temperature < 0 || this.config.defaults.temperature > 2) {
        errors.push('defaults.temperature must be between 0 and 2');
      }
    }

    if (!this.config.providers || typeof this.config.providers !== 'object') {
      errors.push('providers must be an object');
    }

    return { valid: errors.length === 0, errors };
  }

  getSchema(): object {
    return CONFIG_SCHEMA;
  }

  reset(): void {
    this.config = { ...DEFAULT_CONFIG };
    this.save();
  }

  list(): DuckConfig {
    return this.config;
  }
}

export function createConfigCommand(): Command {
  const cmd = new Command('config')
    .description('Configuration management: get, set, unset, file, schema, validate, reset');

  const manager = new ConfigManager();

  // config get <key>
  cmd
    .command('get <key>')
    .description('Get a config value (dot notation: defaults.model)')
    .action((key: string) => {
      const val = manager.get(key);
      if (val !== undefined) {
        console.log(JSON.stringify(val, null, 2));
      } else {
        console.error(`${c.red}Key not found: ${key}${c.reset}`);
        console.log(`${c.dim}Use 'duck config list' to see all keys${c.reset}`);
        process.exit(1);
      }
    });

  // config set <key> <value>
  cmd
    .command('set <key> <value>')
    .description('Set a config value (dot notation)')
    .action((key: string, value: string) => {
      // Try to parse as JSON value first
      let parsed: unknown = value;
      if (value === 'true') parsed = true;
      else if (value === 'false') parsed = false;
      else if (value === 'null') parsed = null;
      else if (!isNaN(Number(value)) && value.trim() !== '') parsed = Number(value);
      else if (value.startsWith('{') || value.startsWith('[')) {
        try { parsed = JSON.parse(value); } catch { /* keep as string */ }
      }

      manager.set(key, parsed);
      manager.save();
      console.log(`${c.green}✅ Set ${key} = ${JSON.stringify(parsed)}${c.reset}`);
    });

  // config unset <key>
  cmd
    .command('unset <key>')
    .description('Remove a config key')
    .action((key: string) => {
      const ok = manager.unset(key);
      if (ok) {
        manager.save();
        console.log(`${c.green}✅ Unset ${key}${c.reset}`);
      } else {
        console.error(`${c.red}Key not found: ${key}${c.reset}`);
        process.exit(1);
      }
    });

  // config list
  cmd
    .command('list')
    .description('List all config values')
    .action(() => {
      console.log(`\n${c.bold}🦆 Duck CLI Configuration${c.reset}`);
      console.log(`Config: ${c.cyan}${manager.getPath()}${c.reset}`);
      console.log(`Env:    ${c.cyan}${manager.getEnvPath()}${c.reset}\n`);
      console.log(yamlStringify(manager.list()));
    });

  // config file
  cmd
    .command('file')
    .description('Show config file path')
    .action(() => {
      console.log(manager.getPath());
    });

  // config schema
  cmd
    .command('schema')
    .description('Show config schema')
    .action(() => {
      console.log(JSON.stringify(manager.getSchema(), null, 2));
    });

  // config validate
  cmd
    .command('validate')
    .description('Validate config file')
    .action(() => {
      const result = manager.validate();
      if (result.valid) {
        console.log(`${c.green}✅ Config is valid${c.reset}`);
      } else {
        console.error(`${c.red}❌ Config has errors:${c.reset}`);
        result.errors.forEach(e => console.log(`  ${c.red}- ${e}${c.reset}`));
        process.exit(1);
      }
    });

  // config reset
  cmd
    .command('reset')
    .description('Reset config to defaults')
    .action(() => {
      manager.reset();
      console.log(`${c.green}✅ Config reset to defaults${c.reset}`);
    });

  // config edit (opens config in editor)
  cmd
    .command('edit')
    .description('Open config file in $EDITOR')
    .action(() => {
      const editor = process.env.EDITOR || 'nano';
      const { spawn } = require('child_process');
      spawn(editor, [manager.getPath()], { stdio: 'inherit' });
    });

  // config env - show .env management
  cmd
    .command('env')
    .description('Manage .env file')
    .argument('[action]', 'Action: show, set <key> <value>, unset <key>')
    .argument('[key]', 'Key name')
    .argument('[value]', 'Value')
    .action((action: string, key: string, value: string) => {
      const envPath = manager.getEnvPath();
      let env: Record<string, string> = {};
      if (existsSync(envPath)) {
        try {
          const content = readFileSync(envPath, 'utf-8');
          for (const line of content.split('\n')) {
            const m = line.match(/^([^#=]+)=(.*)$/);
            if (m) env[m[1].trim()] = m[2].trim();
          }
        } catch { /* ignore */ }
      }

      if (!action || action === 'show') {
        console.log(`\n${c.bold}🦆 .env Configuration${c.reset}`);
        console.log(`Path: ${c.cyan}${envPath}${c.reset}\n`);
        for (const [k, v] of Object.entries(env)) {
          const hidden = v ? '***' + v.slice(-4) : '(empty)';
          console.log(`  ${k}=${hidden}`);
        }
        console.log();
        return;
      }

      if (action === 'set' && key && value !== undefined) {
        env[key] = value;
        const dir = dirname(envPath);
        if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
        const lines = Object.entries(env).map(([k, v]) => `${k}=${v}`).join('\n');
        writeFileSync(envPath, lines + '\n', { mode: 0o600 });
        console.log(`${c.green}✅ Set ${key}=${value}${c.reset}`);
        return;
      }

      if (action === 'unset' && key) {
        if (key in env) {
          delete env[key];
          const lines = Object.entries(env).map(([k, v]) => `${k}=${v}`).join('\n');
          writeFileSync(envPath, lines + '\n', { mode: 0o600 });
          console.log(`${c.green}✅ Unset ${key}${c.reset}`);
        } else {
          console.error(`${c.red}Key not in .env: ${key}${c.reset}`);
          process.exit(1);
        }
        return;
      }

      console.log(`${c.yellow}Usage: duck config env [show|set <key> <value>|unset <key>]${c.reset}`);
    });

  return cmd;
}
