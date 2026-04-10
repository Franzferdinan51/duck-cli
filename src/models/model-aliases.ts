/**
 * 🦆 Duck CLI - Model Aliases Manager
 * 
 * Manages model aliases via `openclaw models aliases` commands.
 * Aliases provide short names for long model IDs.
 * 
 * Examples:
 *   minimax-m2.7  →  minimax-portal/MiniMax-M2.7
 *   kimi-k2.5     →  kimi-coding/k2p5
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

// ─── Config Path ──────────────────────────────────────────────────────────────

const OPENCLAW_CONFIG_PATH = join(homedir(), '.openclaw', 'openclaw.json');

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

function runOpenClaw(args: string[], timeoutMs = 15000): string {
  try {
    return execSync(`openclaw ${args.join(' ')}`, {
      encoding: 'utf-8',
      timeout: timeoutMs,
      maxBuffer: 10 * 1024 * 1024,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).replace(/\[qqbot[^\]]*\]\s*/g, '').replace(/\n{3,}/g, '\n\n').trim();
  } catch (e: any) {
    const stderr = e.stderr || '';
    const cleaned = stderr.replace(/\[qqbot[^\]]*\]\s*/g, '').trim();
    if (cleaned) throw new Error(cleaned);
    throw new Error(e.message || 'Command failed');
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ModelAlias {
  alias: string;
  modelId: string;
  provider?: string;
}

// ─── Alias Manager ────────────────────────────────────────────────────────────

export class ModelAliasManager {
  /**
   * List all model aliases (mirrors `openclaw models aliases list`)
   */
  list(opts: { json?: boolean; plain?: boolean } = {}): string {
    const args = ['models', 'aliases', 'list'];
    if (opts.plain) args.push('--plain');

    try {
      const out = runOpenClaw(args);
      if (opts.json) {
        // Parse plain list into JSON
        const lines = out.split('\n').filter(l => l.trim() && l.includes('→'));
        const aliases: ModelAlias[] = lines.map(line => {
          const [idPart, aliasPart] = line.split('→').map(s => s.trim());
          return {
            alias: aliasPart || idPart,
            modelId: idPart?.replace(/^[^\s]*\s/, '').trim() || idPart,
          };
        });
        return JSON.stringify({ aliases }, null, 2);
      }
      return out;
    } catch {
      return this.listFromConfig(opts);
    }
  }

  private listFromConfig(opts: { json?: boolean; plain?: boolean } = {}): string {
    const cfg = getOpenClawConfig();
    if (!cfg) return opts.json ? '{"error":"No config"}' : 'No OpenClaw config found';

    const allModels = cfg.agents?.defaults?.models || {};
    const aliases: ModelAlias[] = [];

    for (const [modelId, entry] of Object.entries(allModels) as [string, any][]) {
      if (entry?.alias) {
        aliases.push({ alias: entry.alias, modelId, provider: modelId.split('/')[0] });
      }
    }

    if (opts.json) {
      return JSON.stringify({ aliases }, null, 2);
    }

    if (aliases.length === 0) {
      return '\n🦆 Model Aliases\n\n  (none defined)\n';
    }

    const lines = ['\n🦆 Model Aliases\n'];
    for (const a of aliases) {
      lines.push(`  ${a.alias.padEnd(28)} → ${a.modelId}`);
    }
    lines.push('');
    return lines.join('\n');
  }

  /**
   * Add or update a model alias (mirrors `openclaw models aliases add`)
   */
  add(alias: string, modelId: string): { success: boolean; message: string } {
    try {
      runOpenClaw(['models', 'aliases', 'add', alias, modelId]);
      return { success: true, message: `Alias '${alias}' → '${modelId}' added` };
    } catch (e) {
      // Fallback: direct config write
      return this.addToConfig(alias, modelId);
    }
  }

  private addToConfig(alias: string, modelId: string): { success: boolean; message: string } {
    const cfg = getOpenClawConfig();
    if (!cfg) return { success: false, message: 'No OpenClaw config found' };

    const models = cfg.agents?.defaults?.models || {};
    if (!models[modelId]) {
      return { success: false, message: `Model '${modelId}' not found in config` };
    }

    models[modelId] = { ...models[modelId], alias };
    cfg.agents = cfg.agents || {};
    cfg.agents.defaults = cfg.agents.defaults || {};
    cfg.agents.defaults.models = models;
    saveOpenClawConfig(cfg);

    return { success: true, message: `Alias '${alias}' → '${modelId}' saved` };
  }

  /**
   * Remove a model alias (mirrors `openclaw models aliases remove`)
   */
  remove(aliasOrModelId: string): { success: boolean; message: string } {
    try {
      runOpenClaw(['models', 'aliases', 'remove', aliasOrModelId]);
      return { success: true, message: `Alias '${aliasOrModelId}' removed` };
    } catch (e) {
      return this.removeFromConfig(aliasOrModelId);
    }
  }

  private removeFromConfig(aliasOrModelId: string): { success: boolean; message: string } {
    const cfg = getOpenClawConfig();
    if (!cfg) return { success: false, message: 'No OpenClaw config found' };

    const models = cfg.agents?.defaults?.models || {};
    let found = false;

    // Try by modelId
    if (models[aliasOrModelId]) {
      delete models[aliasOrModelId].alias;
      found = true;
    } else {
      // Try by alias name
      for (const [modelId, entry] of Object.entries(models) as [string, any][]) {
        if (entry?.alias === aliasOrModelId) {
          delete models[modelId].alias;
          found = true;
          break;
        }
      }
    }

    if (!found) {
      return { success: false, message: `Alias '${aliasOrModelId}' not found` };
    }

    cfg.agents.defaults.models = models;
    saveOpenClawConfig(cfg);

    return { success: true, message: `Alias '${aliasOrModelId}' removed` };
  }

  /**
   * Resolve an alias (or modelId) to full model ID
   */
  resolve(aliasOrId: string): string | null {
    const cfg = getOpenClawConfig();
    if (!cfg) return null;

    const models = cfg.agents?.defaults?.models || {};

    // Direct match - is it already a full model ID?
    if (models[aliasOrId]) return aliasOrId;

    // Search by alias
    for (const [modelId, entry] of Object.entries(models) as [string, any][]) {
      if (entry?.alias === aliasOrId) return modelId;
    }

    return null;
  }

  /**
   * Get all known model IDs and their aliases
   */
  getAllMappings(): Record<string, string | undefined> {
    const cfg = getOpenClawConfig();
    if (!cfg) return {};

    const models = cfg.agents?.defaults?.models || {};
    const result: Record<string, string | undefined> = {};

    for (const [modelId, entry] of Object.entries(models) as [string, any][]) {
      result[modelId] = entry?.alias;
    }

    return result;
  }
}

// ─── Singleton ──────────────────────────────────────────────────────────────────

let _instance: ModelAliasManager | null = null;

export function getModelAliasManager(): ModelAliasManager {
  if (!_instance) _instance = new ModelAliasManager();
  return _instance;
}
