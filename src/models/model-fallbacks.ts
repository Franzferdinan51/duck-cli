/**
 * 🦆 Duck CLI - Model Fallback Chain Manager
 * Manages fallback chains for OpenClaw models
 * Commands: openclaw models fallbacks
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const OPENCLAW_CONFIG_PATH = join(homedir(), '.openclaw', 'openclaw.json');

export interface FallbackChain {
  primary: string;
  fallbacks: string[];
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

export class ModelFallbackManager {
  /**
   * Get the current fallback chain
   */
  getFallbackChain(): FallbackChain {
    const cfg = getOpenClawConfig();
    if (!cfg) return { primary: '', fallbacks: [] };

    const model = cfg.agents?.defaults?.model || {};
    return {
      primary: model.primary || '',
      fallbacks: model.fallbacks || [],
    };
  }

  /**
   * Print fallback chain to console
   */
  printFallbacks(): void {
    const chain = this.getFallbackChain();

    console.log('\n🦆 Model Fallback Chain\n');
    console.log(`  Primary:   ${chain.primary || '(not set)'}`);

    if (chain.fallbacks.length === 0) {
      console.log('  Fallbacks: (none)');
    } else {
      console.log('  Fallbacks:');
      chain.fallbacks.forEach((fb, i) => {
        console.log(`    ${i + 1}. ${fb}`);
      });
    }

    // Subagent fallbacks
    const cfg = getOpenClawConfig();
    const subagentModel = cfg?.agents?.defaults?.subagents?.model || {};
    if (subagentModel.primary || subagentModel.fallbacks?.length > 0) {
      console.log(`\n  Subagent:`);
      console.log(`    Primary:   ${subagentModel.primary || chain.primary}`);
      if (subagentModel.fallbacks?.length > 0) {
        subagentModel.fallbacks.forEach((fb: string, i: number) => {
          console.log(`    ${i + 1}. ${fb}`);
        });
      }
    }

    console.log();
  }

  /**
   * Add a model to the fallback chain
   */
  addFallback(modelId: string): boolean {
    const cfg = getOpenClawConfig();
    if (!cfg) {
      console.error('No OpenClaw config found');
      return false;
    }

    if (!cfg.agents) cfg.agents = {};
    if (!cfg.agents.defaults) cfg.agents.defaults = {};
    if (!cfg.agents.defaults.model) cfg.agents.defaults.model = {};

    const model = cfg.agents.defaults.model;
    if (!model.fallbacks) model.fallbacks = [];

    if (model.fallbacks.includes(modelId)) {
      console.log(`⚠️ ${modelId} is already in the fallback chain`);
      return false;
    }

    model.fallbacks.push(modelId);
    saveOpenClawConfig(cfg);
    console.log(`✅ Added ${modelId} to fallback chain`);
    return true;
  }

  /**
   * Remove a model from the fallback chain
   */
  removeFallback(modelId: string): boolean {
    const cfg = getOpenClawConfig();
    if (!cfg) return false;

    const fallbacks = cfg.agents?.defaults?.model?.fallbacks || [];
    const idx = fallbacks.indexOf(modelId);

    if (idx === -1) {
      console.log(`⚠️ ${modelId} not found in fallback chain`);
      return false;
    }

    fallbacks.splice(idx, 1);
    saveOpenClawConfig(cfg);
    console.log(`✅ Removed ${modelId} from fallback chain`);
    return true;
  }

  /**
   * Set the entire fallback chain
   */
  setFallbacks(fallbacks: string[]): boolean {
    const cfg = getOpenClawConfig();
    if (!cfg) {
      console.error('No OpenClaw config found');
      return false;
    }

    if (!cfg.agents) cfg.agents = {};
    if (!cfg.agents.defaults) cfg.agents.defaults = {};
    if (!cfg.agents.defaults.model) cfg.agents.defaults.model = {};

    cfg.agents.defaults.model.fallbacks = fallbacks;
    saveOpenClawConfig(cfg);
    console.log(`✅ Set fallback chain (${fallbacks.length} models)`);
    return true;
  }

  /**
   * Clear all fallbacks
   */
  clearFallbacks(): boolean {
    return this.setFallbacks([]);
  }
}

export default ModelFallbackManager;
