/**
 * 🦆 Duck CLI - Model Aliases Manager
 * Manages model aliases for OpenClaw
 * Commands: openclaw models aliases
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const OPENCLAW_CONFIG_PATH = join(homedir(), '.openclaw', 'openclaw.json');

export interface ModelAlias {
  alias: string;
  modelId: string;
  provider: string;
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

export class ModelAliasManager {
  /**
   * List all model aliases
   */
  listAliases(): ModelAlias[] {
    const cfg = getOpenClawConfig();
    if (!cfg) return [];

    const aliases: ModelAlias[] = [];
    const models = cfg.agents?.defaults?.models || {};

    for (const [modelId, modelConfig] of Object.entries(models) as [string, any][]) {
      if (modelConfig?.alias) {
        const [provider, id] = modelId.split('/');
        aliases.push({
          alias: modelConfig.alias,
          modelId: id || modelId,
          provider: provider || 'unknown',
        });
      }
    }

    return aliases;
  }

  /**
   * Print aliases to console
   */
  printAliases(): void {
    const aliases = this.listAliases();
    if (aliases.length === 0) {
      console.log('\n🦆 No model aliases configured.');
      console.log('   Aliases let you use short names like "fast" or "vision" instead of full model IDs.');
      return;
    }

    console.log(`\n🦆 Model Aliases (${aliases.length}):\n`);
    console.log('  ALIAS        MODEL ID              PROVIDER');
    console.log('  ' + '─'.repeat(60));

    for (const a of aliases) {
      console.log(`  ${a.alias.padEnd(12)} ${a.modelId.padEnd(21)} ${a.provider}`);
    }
    console.log();
  }

  /**
   * Set an alias for a model
   */
  setAlias(alias: string, modelId: string): boolean {
    const cfg = getOpenClawConfig();
    if (!cfg) {
      console.error('No OpenClaw config found');
      return false;
    }

    if (!cfg.agents) cfg.agents = {};
    if (!cfg.agents.defaults) cfg.agents.defaults = {};
    if (!cfg.agents.defaults.models) cfg.agents.defaults.models = {};

    cfg.agents.defaults.models[modelId] = {
      ...(cfg.agents.defaults.models[modelId] || {}),
      alias,
    };

    saveOpenClawConfig(cfg);
    console.log(`✅ Set alias "${alias}" → ${modelId}`);
    return true;
  }

  /**
   * Remove an alias
   */
  removeAlias(alias: string): boolean {
    const cfg = getOpenClawConfig();
    if (!cfg) return false;

    const models = cfg.agents?.defaults?.models || {};
    let found = false;

    for (const [modelId, modelConfig] of Object.entries(models) as [string, any][]) {
      if (modelConfig?.alias === alias) {
        delete modelConfig.alias;
        if (Object.keys(modelConfig).length === 0) {
          delete models[modelId];
        }
        found = true;
        break;
      }
    }

    if (found) {
      saveOpenClawConfig(cfg);
      console.log(`✅ Removed alias "${alias}"`);
    } else {
      console.log(`⚠️ Alias "${alias}" not found`);
    }

    return found;
  }

  /**
   * Resolve an alias to a full model ID
   */
  resolveAlias(alias: string): string | null {
    const cfg = getOpenClawConfig();
    if (!cfg) return null;

    const models = cfg.agents?.defaults?.models || {};

    for (const [modelId, modelConfig] of Object.entries(models) as [string, any][]) {
      if (modelConfig?.alias === alias) {
        return modelId;
      }
    }

    return null;
  }
}

export default ModelAliasManager;
