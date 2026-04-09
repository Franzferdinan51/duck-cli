/**
 * 🦆 Duck CLI - Secrets Management
 * Secure storage for API keys, tokens, and sensitive values
 * Stored in ~/.duck/secrets/secrets.json with 0o600 permissions
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, chmodSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

export interface SecretEntry {
  key: string;
  value: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
  tags: string[];
}

export interface SecretsStore {
  secrets: SecretEntry[];
  version: number;
}

const SECRETS_DIR = join(homedir(), '.duck', 'secrets');
const SECRETS_FILE = join(SECRETS_DIR, 'secrets.json');

export class SecretsManager {
  private store: SecretsStore = { secrets: [], version: 1 };
  private initialized = false;

  constructor() {
    this.initialize();
  }

  private initialize(): void {
    try {
      if (!existsSync(SECRETS_DIR)) {
        mkdirSync(SECRETS_DIR, { recursive: true });
      }
      this.load();
      this.initialized = true;
    } catch (e) {
      console.warn('[Secrets] Failed to initialize secrets store');
    }
  }

  private load(): void {
    try {
      if (existsSync(SECRETS_FILE)) {
        const raw = readFileSync(SECRETS_FILE, 'utf-8');
        this.store = JSON.parse(raw) as SecretsStore;
      }
    } catch (e) {
      this.store = { secrets: [], version: 1 };
    }
  }

  private save(): void {
    try {
      if (!existsSync(SECRETS_DIR)) {
        mkdirSync(SECRETS_DIR, { recursive: true });
      }
      writeFileSync(SECRETS_FILE, JSON.stringify(this.store, null, 2), { mode: 0o600 });
    } catch (e) {
      throw new Error(`Failed to save secrets: ${e}`);
    }
  }

  /**
   * Set a secret value. Creates or updates.
   */
  set(key: string, value: string, options?: { description?: string; tags?: string[] }): void {
    if (!key || typeof key !== 'string') {
      throw new Error('Secret key must be a non-empty string');
    }
    if (value === undefined || value === null) {
      throw new Error('Secret value cannot be null or undefined');
    }

    const now = Date.now();
    const existing = this.store.secrets.find(s => s.key === key);

    if (existing) {
      existing.value = value;
      existing.updatedAt = now;
      if (options?.description !== undefined) existing.description = options.description;
      if (options?.tags !== undefined) existing.tags = options.tags;
    } else {
      this.store.secrets.push({
        key,
        value,
        description: options?.description,
        tags: options?.tags || [],
        createdAt: now,
        updatedAt: now,
      });
    }

    this.save();
  }

  /**
   * Get a secret value by key.
   * Supports env-var expansion: $VAR or ${VAR} in the value.
   */
  get(key: string): string | undefined {
    const entry = this.store.secrets.find(s => s.key === key);
    if (!entry) return undefined;

    // Expand environment variables in the value
    return entry.value.replace(/\$(\w+)|\$\{(\w+)\}/g, (_, v1, v2) => {
      const varName = v1 || v2;
      return process.env[varName] || '';
    });
  }

  /**
   * Get full secret entry (without value) for inspection.
   */
  getEntry(key: string): SecretEntry | undefined {
    return this.store.secrets.find(s => s.key === key);
  }

  /**
   * Delete a secret by key.
   */
  delete(key: string): boolean {
    const idx = this.store.secrets.findIndex(s => s.key === key);
    if (idx === -1) return false;
    this.store.secrets.splice(idx, 1);
    this.save();
    return true;
  }

  /**
   * List all secret keys (not values).
   */
  list(options?: { tag?: string }): SecretEntry[] {
    let results = this.store.secrets;
    if (options?.tag) {
      results = results.filter(s => s.tags.includes(options.tag!));
    }
    // Return shallow copy without values to avoid leaking secrets in logs
    return results.map(s => ({
      key: s.key,
      value: s.value ? '********' : '',
      description: s.description,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
      tags: [...s.tags],
    }));
  }

  /**
   * Check if a secret exists.
   */
  has(key: string): boolean {
    return this.store.secrets.some(s => s.key === key);
  }

  /**
   * Get total count of secrets.
   */
  count(): number {
    return this.store.secrets.length;
  }

  /**
   * Get secrets file path.
   */
  getPath(): string {
    return SECRETS_FILE;
  }

  /**
   * Get all tags across all secrets.
   */
  getTags(): string[] {
    const tagSet = new Set<string>();
    for (const s of this.store.secrets) {
      for (const t of s.tags) tagSet.add(t);
    }
    return Array.from(tagSet);
  }

  /**
   * Export a secret (with value) — use with caution.
   */
  export(key: string): SecretEntry | undefined {
    const entry = this.store.secrets.find(s => s.key === key);
    if (!entry) return undefined;
    return { ...entry };
  }

  /**
   * Bulk import secrets from an object.
   */
  importSecrets(secrets: Record<string, string>): void {
    const now = Date.now();
    for (const [key, value] of Object.entries(secrets)) {
      const existing = this.store.secrets.find(s => s.key === key);
      if (existing) {
        existing.value = value;
        existing.updatedAt = now;
      } else {
        this.store.secrets.push({
          key,
          value,
          tags: [],
          createdAt: now,
          updatedAt: now,
        });
      }
    }
    this.save();
  }
}

// Singleton instance
let _instance: SecretsManager | null = null;

export function getSecretsManager(): SecretsManager {
  if (!_instance) {
    _instance = new SecretsManager();
  }
  return _instance;
}
