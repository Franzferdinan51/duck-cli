/**
 * 🦆 Duck CLI - Model Fallback Manager
 * 
 * Manages fallback chains for models via `openclaw models fallbacks` commands.
 * Fallbacks are tried in order when a model fails.
 * 
 * The fallback list lives in: agents.defaults.model.fallbacks (openclaw.json)
 * Image model fallbacks live in: agents.defaults.imageModel.fallbacks (openclaw.json)
 */

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

// ─── Types ───────────────────────────────────────────────────────────────────────

export interface FallbackChain {
  primary: string;
  fallbacks: string[];
  imagePrimary?: string;
  imageFallbacks: string[];
}

// ─── Fallback Manager ─────────────────────────────────────────────────────────

export class ModelFallbackManager {
  /**
   * List current fallback chains (mirrors `openclaw models fallbacks list`)
   */
  list(): FallbackChain {
    const cfg = getOpenClawConfig();
    if (!cfg) return { primary: '', fallbacks: [], imageFallbacks: [] };

    const model = cfg.agents?.defaults?.model || {};
    const imageModel = cfg.agents?.defaults?.imageModel || {};

    return {
      primary: model.primary || '',
      fallbacks: model.fallbacks || [],
      imagePrimary: imageModel?.primary || '',
      imageFallbacks: imageModel?.fallbacks || [],
    };
  }

  /**
   * Pretty-print the fallback chains
   */
  describe(): string {
    const chain = this.list();
    const lines: string[] = ['\n🦆 Model Fallback Chains\n'];

    if (!chain.primary && chain.fallbacks.length === 0) {
      lines.push('  (no fallbacks configured)\n');
      return lines.join('\n');
    }

    // Text model chain
    const primary = chain.primary || '(none)';
    lines.push(`  Text Model:`);
    lines.push(`    Primary:   ${primary}`);
    if (chain.fallbacks.length > 0) {
      lines.push(`    Fallbacks: ${chain.fallbacks.join(' → ')}`);
    } else {
      lines.push(`    Fallbacks: (none)`);
    }

    // Image model chain
    if (chain.imagePrimary || chain.imageFallbacks.length > 0) {
      lines.push(`\n  Image Model:`);
      lines.push(`    Primary:   ${chain.imagePrimary || '(none)'}`);
      if (chain.imageFallbacks.length > 0) {
        lines.push(`    Fallbacks: ${chain.imageFallbacks.join(' → ')}`);
      } else {
        lines.push(`    Fallbacks: (none)`);
      }
    }

    lines.push('');
    return lines.join('\n');
  }

  /**
   * Add a fallback model (mirrors `openclaw models fallbacks add`)
   */
  addFallback(modelId: string, type: 'text' | 'image' = 'text'): { success: boolean; message: string } {
    const cfg = getOpenClawConfig();
    if (!cfg) return { success: false, message: 'No OpenClaw config found' };

    // Ensure structure
    cfg.agents = cfg.agents || {};
    cfg.agents.defaults = cfg.agents.defaults || {};

    if (type === 'image') {
      cfg.agents.defaults.imageModel = cfg.agents.defaults.imageModel || {};
      cfg.agents.defaults.imageModel.fallbacks = cfg.agents.defaults.imageModel.fallbacks || [];
      if (!cfg.agents.defaults.imageModel.fallbacks.includes(modelId)) {
        cfg.agents.defaults.imageModel.fallbacks.push(modelId);
      }
      saveOpenClawConfig(cfg);
      return { success: true, message: `Image fallback added: ${modelId}` };
    } else {
      cfg.agents.defaults.model = cfg.agents.defaults.model || {};
      cfg.agents.defaults.model.fallbacks = cfg.agents.defaults.model.fallbacks || [];
      if (!cfg.agents.defaults.model.fallbacks.includes(modelId)) {
        cfg.agents.defaults.model.fallbacks.push(modelId);
      }
      saveOpenClawConfig(cfg);
      return { success: true, message: `Text fallback added: ${modelId}` };
    }
  }

  /**
   * Remove a fallback model (mirrors `openclaw models fallbacks remove`)
   */
  removeFallback(modelId: string, type: 'text' | 'image' = 'text'): { success: boolean; message: string } {
    const cfg = getOpenClawConfig();
    if (!cfg) return { success: false, message: 'No OpenClaw config found' };

    if (type === 'image') {
      const fallbacks = cfg.agents?.defaults?.imageModel?.fallbacks || [];
      const idx = fallbacks.indexOf(modelId);
      if (idx === -1) return { success: false, message: `Not found in image fallbacks: ${modelId}` };
      fallbacks.splice(idx, 1);
      cfg.agents.defaults.imageModel.fallbacks = fallbacks;
      saveOpenClawConfig(cfg);
      return { success: true, message: `Image fallback removed: ${modelId}` };
    } else {
      const fallbacks = cfg.agents?.defaults?.model?.fallbacks || [];
      const idx = fallbacks.indexOf(modelId);
      if (idx === -1) return { success: false, message: `Not found in text fallbacks: ${modelId}` };
      fallbacks.splice(idx, 1);
      cfg.agents.defaults.model.fallbacks = fallbacks;
      saveOpenClawConfig(cfg);
      return { success: true, message: `Text fallback removed: ${modelId}` };
    }
  }

  /**
   * Clear all fallbacks (mirrors `openclaw models fallbacks clear`)
   */
  clear(type?: 'text' | 'image' | 'all'): { success: boolean; message: string } {
    const cfg = getOpenClawConfig();
    if (!cfg) return { success: false, message: 'No OpenClaw config found' };

    if (!type || type === 'all' || type === 'text') {
      if (cfg.agents?.defaults?.model) {
        cfg.agents.defaults.model.fallbacks = [];
      }
    }
    if (!type || type === 'all' || type === 'image') {
      if (cfg.agents?.defaults?.imageModel) {
        cfg.agents.defaults.imageModel.fallbacks = [];
      }
    }

    saveOpenClawConfig(cfg);
    const which = type === 'all' ? 'all' : type ? `${type} ` : '';
    return { success: true, message: `${which}fallbacks cleared` };
  }

  /**
   * Set the entire fallback chain (replace)
   */
  setChain(fallbacks: string[], type: 'text' | 'image' = 'text'): { success: boolean; message: string } {
    const cfg = getOpenClawConfig();
    if (!cfg) return { success: false, message: 'No OpenClaw config found' };

    if (type === 'image') {
      cfg.agents = cfg.agents || {};
      cfg.agents.defaults = cfg.agents.defaults || {};
      cfg.agents.defaults.imageModel = cfg.agents.defaults.imageModel || {};
      cfg.agents.defaults.imageModel.fallbacks = fallbacks;
    } else {
      cfg.agents = cfg.agents || {};
      cfg.agents.defaults = cfg.agents.defaults || {};
      cfg.agents.defaults.model = cfg.agents.defaults.model || {};
      cfg.agents.defaults.model.fallbacks = fallbacks;
    }

    saveOpenClawConfig(cfg);
    return { success: true, message: `${type} fallback chain set: ${fallbacks.join(' → ')}` };
  }

  /**
   * Get next fallback in chain (for routing)
   */
  getNextFallback(current: string, type: 'text' | 'image' = 'text'): string | null {
    const chain = this.list();
    const fallbacks = type === 'image' ? chain.imageFallbacks : chain.fallbacks;
    const idx = fallbacks.indexOf(current);
    return idx >= 0 && idx < fallbacks.length - 1 ? fallbacks[idx + 1] : null;
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

let _instance: ModelFallbackManager | null = null;

export function getModelFallbackManager(): ModelFallbackManager {
  if (!_instance) _instance = new ModelFallbackManager();
  return _instance;
}
