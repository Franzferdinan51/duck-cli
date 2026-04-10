/**
 * 🦆 Duck CLI - OpenClaw Model Manager Integration
 * 
 * Interfaces with OpenClaw's model management system via the openclaw CLI.
 * Provides: list, status, set, scan commands.
 * 
 * Config lives at: ~/.openclaw/openclaw.json
 * Gateway runs at: http://localhost:18792
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

// ─── Config Paths ─────────────────────────────────────────────────────────────

const OPENCLAW_CONFIG_PATH = join(homedir(), '.openclaw', 'openclaw.json');

function getOpenClawConfig(): any {
  if (!existsSync(OPENCLAW_CONFIG_PATH)) {
    return null;
  }
  try {
    return JSON.parse(readFileSync(OPENCLAW_CONFIG_PATH, 'utf-8'));
  } catch {
    return null;
  }
}

function saveOpenClawConfig(config: any): void {
  writeFileSync(OPENCLAW_CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
}

function runOpenClaw(args: string[], timeoutMs = 30000): string {
  try {
    return execSync(`openclaw ${args.join(' ')}`, {
      encoding: 'utf-8',
      timeout: timeoutMs,
      maxBuffer: 10 * 1024 * 1024,
      stdio: ['pipe', 'pipe', 'pipe'],
      // Suppress channel plugin noise from stderr
    }).replace(/\[qqbot[^\]]*\]\s*/g, '').replace(/\n{3,}/g, '\n\n').trim();
  } catch (e: any) {
    const stderr = e.stderr || '';
    // Strip noise but keep real errors
    const cleaned = stderr.replace(/\[qqbot[^\]]*\]\s*/g, '').trim();
    if (cleaned) {
      throw new Error(cleaned);
    }
    throw new Error(e.message || 'Command failed');
  }
}

// ─── Model Catalog Types ──────────────────────────────────────────────────────

export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  reasoning: boolean;
  input: string[];
  output: string[];
  cost: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
  };
  contextWindow: number;
  maxTokens: number;
}

export interface ProviderInfo {
  name: string;
  baseUrl: string;
  api: string;
  apiKey?: string;
  models: ModelInfo[];
}

// ─── Model Manager ────────────────────────────────────────────────────────────

export class ModelManager {
  private config: any;

  constructor() {
    this.config = getOpenClawConfig();
  }

  /**
   * List configured models (mirrors `openclaw models list`)
   */
  listModels(opts: {
    all?: boolean;
    local?: boolean;
    provider?: string;
    json?: boolean;
    plain?: boolean;
  } = {}): string {
    const args = ['models', 'list'];
    if (opts.all) args.push('--all');
    if (opts.local) args.push('--local');
    if (opts.provider) args.push('--provider', opts.provider);
    if (opts.json) args.push('--json');
    if (opts.plain) args.push('--plain');

    try {
      return runOpenClaw(args);
    } catch (e) {
      // Fallback: parse from local config
      return this.listModelsFromConfig(opts);
    }
  }

  private listModelsFromConfig(opts: { plain?: boolean; json?: boolean; provider?: string } = {}): string {
    const cfg = getOpenClawConfig();
    if (!cfg) return 'No OpenClaw config found';

    const modelsSection = cfg.models || {};
    const providers = modelsSection.providers || {};
    const agentDefaults = cfg.agents?.defaults?.models || {};
    const primary = cfg.agents?.defaults?.model?.primary || '';

    const lines: string[] = [];

    for (const [provName, provConfig] of Object.entries(providers) as [string, any][]) {
      if (opts.provider && provName !== opts.provider) continue;
      const models = provConfig.models || [];
      for (const m of models) {
        const id = `${provName}/${m.id}`;
        const isPrimary = id === primary || m.id === primary;
        const alias = agentDefaults[id]?.alias;
        const prefix = isPrimary ? '✅' : '  ';
        const aliasStr = alias ? ` → ${alias}` : '';
        lines.push(`${prefix} ${id}${aliasStr}`);
      }
    }

    if (opts.json) {
      const allModels: ModelInfo[] = [];
      for (const [provName, provConfig] of Object.entries(providers) as [string, any][]) {
        if (opts.provider && provName !== opts.provider) continue;
        const models = provConfig.models || [];
        for (const m of models) {
          allModels.push({
            id: `${provName}/${m.id}`,
            name: m.name || m.id,
            provider: provName,
            reasoning: m.reasoning || false,
            input: m.input || ['text'],
            output: m.output || ['text'],
            cost: m.cost || { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
            contextWindow: m.contextWindow || 0,
            maxTokens: m.maxTokens || 0,
          });
        }
      }
      return JSON.stringify({ models: allModels }, null, 2);
    }

    if (!opts.plain && lines.length > 0) {
      return '\n🦆 Configured Models:\n\n' + lines.join('\n') + '\n';
    }

    return lines.join('\n') || 'No models found';
  }

  /**
   * Show configured model state (mirrors `openclaw models status`)
   */
  status(opts: {
    json?: boolean;
    plain?: boolean;
    probe?: boolean;
    probeConcurrency?: number;
    probeTimeout?: number;
    probeProvider?: string;
    probeMaxTokens?: number;
    check?: boolean;
  } = {}): string {
    const args = ['models', 'status'];
    if (opts.json) args.push('--json');
    if (opts.plain) args.push('--plain');
    if (opts.probe) args.push('--probe');
    if (opts.probeConcurrency) args.push('--probe-concurrency', String(opts.probeConcurrency));
    if (opts.probeTimeout) args.push('--probe-timeout', String(opts.probeTimeout));
    if (opts.probeProvider) args.push('--probe-provider', opts.probeProvider);
    if (opts.probeMaxTokens) args.push('--probe-max-tokens', String(opts.probeMaxTokens));
    if (opts.check) args.push('--check');

    try {
      return runOpenClaw(args, opts.probe ? 60000 : 15000);
    } catch (e) {
      return this.statusFromConfig(opts);
    }
  }

  private statusFromConfig(opts: { json?: boolean; plain?: boolean } = {}): string {
    const cfg = getOpenClawConfig();
    if (!cfg) return opts.json ? '{"error":"No config"}' : 'No OpenClaw config found';

    const agents = cfg.agents || {};
    const defaults = agents.defaults || {};
    const model = defaults.model || {};
    const primary = model.primary || 'not set';
    const fallbacks: string[] = model.fallbacks || [];
    const allModels = defaults.models || {};
    const subagentModel = defaults.subagents?.model || {};

    if (opts.json) {
      return JSON.stringify({
        primary,
        fallbacks,
        subagentPrimary: subagentModel.primary || primary,
        subagentFallbacks: subagentModel.fallbacks || [],
        configuredModels: Object.keys(allModels),
      }, null, 2);
    }

    const lines: string[] = [];
    lines.push('\n🦆 Model Status\n');

    // Primary
    lines.push(`  Primary:   ${primary}`);
    lines.push(`  Fallbacks: ${fallbacks.length > 0 ? fallbacks.join(', ') : '(none)'}`);

    // Subagent
    const subPrimary = subagentModel.primary || primary;
    const subFallbacks = subagentModel.fallbacks || [];
    lines.push(`\n  Subagent:  ${subPrimary}`);
    if (subFallbacks.length > 0) {
      lines.push(`  Sub-Fallbacks: ${subFallbacks.join(', ')}`);
    }

    // Provider count
    const providers = cfg.models?.providers || {};
    const modelCount = Object.values(providers).reduce(
      (sum: number, p: any) => sum + (p.models?.length || 0),
      0
    );
    lines.push(`\n  Providers: ${Object.keys(providers).length}`);
    lines.push(`  Models:    ${modelCount}`);

    // Auth profiles
    const auth = cfg.auth?.profiles || {};
    lines.push(`  Auth:      ${Object.keys(auth).length} profile(s)`);

    lines.push('');
    return lines.join('\n');
  }

  /**
   * Set the default model (mirrors `openclaw models set`)
   */
  setDefault(modelId: string): { success: boolean; message: string } {
    try {
      runOpenClaw(['models', 'set', modelId]);
      return { success: true, message: `Default model set to: ${modelId}` };
    } catch (e) {
      return { success: false, message: `Failed: ${(e as Error).message}` };
    }
  }

  /**
   * Set the default image model (mirrors `openclaw models set-image`)
   */
  setDefaultImage(modelId: string): { success: boolean; message: string } {
    try {
      runOpenClaw(['models', 'set-image', modelId]);
      return { success: true, message: `Default image model set to: ${modelId}` };
    } catch (e) {
      return { success: false, message: `Failed: ${(e as Error).message}` };
    }
  }

  /**
   * Scan OpenRouter free models (mirrors `openclaw models scan`)
   */
  async scan(opts: {
    concurrency?: number;
    maxAgeDays?: number;
    maxCandidates?: number;
    minParams?: number;
    noProbe?: boolean;
    noInput?: boolean;
    provider?: string;
    setDefault?: boolean;
    setImage?: boolean;
    timeout?: number;
    yes?: boolean;
    json?: boolean;
  } = {}): Promise<string> {
    const args = ['models', 'scan'];
    if (opts.concurrency) args.push('--concurrency', String(opts.concurrency));
    if (opts.maxAgeDays) args.push('--max-age-days', String(opts.maxAgeDays));
    if (opts.maxCandidates) args.push('--max-candidates', String(opts.maxCandidates));
    if (opts.minParams) args.push('--min-params', String(opts.minParams));
    if (opts.noProbe) args.push('--no-probe');
    if (opts.noInput) args.push('--no-input');
    if (opts.provider) args.push('--provider', opts.provider);
    if (opts.setDefault) args.push('--set-default');
    if (opts.setImage) args.push('--set-image');
    if (opts.timeout) args.push('--timeout', String(opts.timeout));
    if (opts.yes) args.push('--yes');
    if (opts.json) args.push('--json');

    return runOpenClaw(args, 300000); // 5 min timeout for scan
  }

  /**
   * Get all providers with their models from config
   */
  getProviders(): ProviderInfo[] {
    const cfg = getOpenClawConfig();
    if (!cfg) return [];

    const providers: ProviderInfo[] = [];
    const modelsSection = cfg.models?.providers || {};

    for (const [name, config] of Object.entries(modelsSection) as [string, any][]) {
      providers.push({
        name,
        baseUrl: config.baseUrl || '',
        api: config.api || '',
        apiKey: config.apiKey ? '(set)' : undefined,
        models: (config.models || []).map((m: any) => ({
          id: m.id,
          name: m.name || m.id,
          provider: name,
          reasoning: m.reasoning || false,
          input: m.input || ['text'],
          output: m.output || ['text'],
          cost: m.cost || { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
          contextWindow: m.contextWindow || 0,
          maxTokens: m.maxTokens || 0,
        })),
      });
    }

    return providers;
  }

  /**
   * Get the primary model and fallbacks from config
   */
  getCurrentModel(): { primary: string; fallbacks: string[] } {
    const cfg = getOpenClawConfig();
    if (!cfg) return { primary: '', fallbacks: [] };

    const model = cfg.agents?.defaults?.model || {};
    return {
      primary: model.primary || '',
      fallbacks: model.fallbacks || [],
    };
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

let _instance: ModelManager | null = null;

export function getModelManager(): ModelManager {
  if (!_instance) _instance = new ModelManager();
  return _instance;
}
