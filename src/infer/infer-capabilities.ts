/**
 * 🦆 Duck CLI - Inference Capabilities
 * 
 * Exposes capability discovery via `openclaw infer` commands.
 * Maps what providers/models can do (text, image, audio, video, embeddings).
 * 
 * Mirrors: openclaw infer list, openclaw infer inspect <capability>
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

// ─── Config Path ──────────────────────────────────────────────────────────────

const OPENCLAW_CONFIG_PATH = join(homedir(), '.openclaw', 'openclaw.json');

function runOpenClaw(args: string[], timeoutMs = 30000): string {
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

// ─── Engine Config (must be declared before InferCapabilities class) ────────

interface EngineConfig {
  engine: string;
  temperature: number;
  maxTokens: number;
  topP?: number;
  reasoning?: boolean;
  jsonMode?: boolean;
}
export { EngineConfig };

function getEngineConfig(): EngineConfig {
  return {
    engine: process.env.DUCK_ENGINE || 'minimax',
    temperature: parseFloat(process.env.DUCK_TEMPERATURE || '0.7'),
    maxTokens: parseInt(process.env.DUCK_MAX_TOKENS || '4096', 10),
    topP: parseFloat(process.env.DUCK_TOP_P || '0.95'),
    reasoning: process.env.DUCK_REASONING === 'true',
    jsonMode: process.env.DUCK_JSON_MODE === 'true',
  };
}

function setEngineConfig更新(cfg: Partial<EngineConfig>): void {
  if (cfg.engine) process.env.DUCK_ENGINE = cfg.engine;
  if (cfg.temperature !== undefined) process.env.DUCK_TEMPERATURE = String(cfg.temperature);
  if (cfg.maxTokens !== undefined) process.env.DUCK_MAX_TOKENS = String(cfg.maxTokens);
  if (cfg.topP !== undefined) process.env.DUCK_TOP_P = String(cfg.topP);
  if (cfg.reasoning !== undefined) process.env.DUCK_REASONING = String(cfg.reasoning);
  if (cfg.jsonMode !== undefined) process.env.DUCK_JSON_MODE = String(cfg.jsonMode);
}

// ─── Capability Types ─────────────────────────────────────────────────────────

export type CapabilityId =
  | 'text.infer'
  | 'text.chat'
  | 'text.complete'
  | 'image.generate'
  | 'image.describe'
  | 'image.edit'
  | 'audio.tts'
  | 'audio.stt'
  | 'video.generate'
  | 'video.describe'
  | 'embedding.create'
  | 'web.search'
  | 'web.fetch';

export interface Capability {
  id: CapabilityId;
  name: string;
  description: string;
  providers: string[];
  models: string[];
  transport?: string;
}

export interface CapabilityStatus {
  capabilities: Capability[];
  providers: string[];
  totalCapabilities: number;
}

// ─── Capability Definitions ───────────────────────────────────────────────────

const CAPABILITY_DEFINITIONS: Omit<Capability, 'providers' | 'models'>[] = [
  { id: 'text.infer', name: 'Text Inference', description: 'General text generation and completion' },
  { id: 'text.chat', name: 'Chat Completion', description: 'Multi-turn conversational AI' },
  { id: 'text.complete', name: 'Completion', description: 'Traditional completion API' },
  { id: 'image.generate', name: 'Image Generation', description: 'Text-to-image generation' },
  { id: 'image.describe', name: 'Image Description', description: 'Vision/image understanding' },
  { id: 'image.edit', name: 'Image Editing', description: 'Edit/reference image generation' },
  { id: 'audio.tts', name: 'Text to Speech', description: 'Speech synthesis' },
  { id: 'audio.stt', name: 'Speech to Text', description: 'Audio transcription' },
  { id: 'video.generate', name: 'Video Generation', description: 'Text/image-to-video' },
  { id: 'video.describe', name: 'Video Description', description: 'Video understanding' },
  { id: 'embedding.create', name: 'Embeddings', description: 'Text embedding generation' },
  { id: 'web.search', name: 'Web Search', description: 'Search the web' },
  { id: 'web.fetch', name: 'Web Fetch', description: 'Fetch web pages' },
];

// ─── Infer Capabilities ───────────────────────────────────────────────────────

export class InferCapabilities {
  private capabilityCache: Capability[] | null = null;
  private cacheTimestamp: number = 0;
  private CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  /**
   * List all canonical capabilities (mirrors `openclaw infer list`)
   */
  list(opts: { json?: boolean; plain?: boolean } = {}): string {
    const args = ['infer', 'list'];
    if (opts.plain) args.push('--plain');
    try {
      return runOpenClaw(args);
    } catch {
      return this.describeCapabilities(opts);
    }
  }

  private describeCapabilities(opts: { json?: boolean; plain?: boolean } = {}): string {
    const caps = this.getCapabilitiesWithProviders();
    if (opts.json) {
      return JSON.stringify({ capabilities: caps }, null, 2);
    }
    const lines: string[] = ['\n🦆 Inference Capabilities\n'];
    for (const c of caps) {
      const providers = c.providers.length > 0 ? c.providers.join(', ') : '(none)';
      lines.push(`  ${c.id.padEnd(22)} ${c.name}`);
      lines.push(`    ${c.description}`);
      lines.push(`    Providers: ${providers}`);
      lines.push('');
    }
    return lines.join('\n');
  }

  /**
   * Inspect a specific capability (mirrors `openclaw infer inspect <id>`)
   */
  inspect(capabilityId: string): Capability | null {
    try {
      const out = runOpenClaw(['infer', 'inspect', capabilityId]);
      const match = out.match(/\{[\s\S]*?"id"[\s\S]*?\}/);
      if (match) return JSON.parse(match[0]);
    } catch { /* fall through */ }
    const caps = this.getCapabilitiesWithProviders();
    return caps.find(c => c.id === capabilityId) || null;
  }

  /**
   * Get full capability list with providers/models filled in
   */
  getCapabilitiesWithProviders(): Capability[] {
    const now = Date.now();
    if (this.capabilityCache && now - this.cacheTimestamp < this.CACHE_TTL_MS) {
      return this.capabilityCache;
    }

    const cfg = existsSync(OPENCLAW_CONFIG_PATH)
      ? JSON.parse(readFileSync(OPENCLAW_CONFIG_PATH, 'utf-8'))
      : null;

    const providers: Record<string, string[]> = {};
    if (cfg?.models?.providers) {
      for (const [name, config] of Object.entries(cfg.models.providers) as [string, any][]) {
        providers[name] = (config.models || []).map((m: any) => `${name}/${m.id}`);
      }
    }

    const caps: Capability[] = CAPABILITY_DEFINITIONS.map(def => {
      const supportingProviders: string[] = [];
      const supportingModels: string[] = [];
      for (const [provName] of Object.entries(providers) as [string, string[]][]) {
        if (this.providerSupportsCapability(provName, def.id, cfg)) {
          supportingProviders.push(provName);
          supportingModels.push(...(providers[provName] || []));
        }
      }
      return { ...def, providers: supportingProviders, models: supportingModels };
    });

    this.capabilityCache = caps;
    this.cacheTimestamp = now;
    return caps;
  }

  private providerSupportsCapability(provider: string, capId: CapabilityId, cfg: any): boolean {
    const models: any[] = cfg?.models?.providers?.[provider]?.models || [];
    const hasImageInput = models.some((m: any) => (m.input || []).includes('image'));
    const hasTextInput = models.some((m: any) => (m.input || []).includes('text'));

    switch (capId) {
      case 'text.infer':
      case 'text.chat':
      case 'text.complete': return hasTextInput;
      case 'image.generate': return provider === 'minimax-portal';
      case 'image.describe': return hasImageInput || provider === 'kimi' || provider === 'kimi-coding';
      case 'image.edit': return provider === 'minimax-portal';
      case 'audio.tts': return provider === 'minimax-portal';
      case 'audio.stt': return provider === 'minimax-portal';
      case 'video.generate': return provider === 'minimax-portal';
      case 'video.describe': return hasImageInput;
      case 'embedding.create': return models.some((m: any) => m.id?.includes('embedding') || m.id?.includes('nomic'));
      case 'web.search': return provider === 'openai-codex';
      case 'web.fetch': return true;
      default: return false;
    }
  }

  /**
   * Get capabilities for a specific provider
   */
  getProviderCapabilities(provider: string): Capability[] {
    return this.getCapabilitiesWithProviders().filter(c => c.providers.includes(provider));
  }

  /**
   * Get the best model for a capability from a provider
   */
  getBestModelForCapability(provider: string, capId: CapabilityId): string | null {
    const caps = this.getCapabilitiesWithProviders();
    const cap = caps.find(c => c.id === capId);
    if (!cap) return null;
    const models = cap.models.filter(m => m.startsWith(`${provider}/`));
    if (models.length === 0) return null;
    if (capId.startsWith('text.')) {
      const reasoning = models.find(m => m.includes('reasoning') || m.includes('opus') || m.includes('haiku'));
      if (reasoning) return reasoning;
    }
    return models[0];
  }

  /**
   * List models (mirrors `openclaw infer model list`)
   */
  modelList(opts: { provider?: string; json?: boolean } = {}): string {
    const args = ['infer', 'model', 'list'];
    if (opts.provider) args.push('--provider', opts.provider);
    if (opts.json) args.push('--json');
    try {
      return runOpenClaw(args);
    } catch {
      return this.modelListFromConfig(opts);
    }
  }

  private modelListFromConfig(opts: { provider?: string; json?: boolean } = {}): string {
    const cfg = existsSync(OPENCLAW_CONFIG_PATH) ? JSON.parse(readFileSync(OPENCLAW_CONFIG_PATH, 'utf-8')) : null;
    if (!cfg) return opts.json ? '{"error":"No config"}' : 'No config';

    const results: any[] = [];
    const providers = cfg.models?.providers || {};
    for (const [name, config] of Object.entries(providers) as [string, any][]) {
      if (opts.provider && name !== opts.provider) continue;
      for (const m of config.models || []) {
        results.push({
          id: `${name}/${m.id}`,
          name: m.name || m.id,
          provider: name,
          contextWindow: m.contextWindow,
          maxTokens: m.maxTokens,
          reasoning: m.reasoning,
          input: m.input || ['text'],
        });
      }
    }

    if (opts.json) return JSON.stringify({ models: results }, null, 2);
    const lines = ['\n🦆 Available Models\n'];
    for (const m of results) {
      const icon = m.reasoning ? '🧠' : '  ';
      lines.push(`  ${icon} ${m.id.padEnd(45)} ctx:${m.contextWindow}`);
    }
    lines.push('');
    return lines.join('\n');
  }

  /**
   * Run inference (mirrors `openclaw infer model <prompt>`)
   */
  infer(opts: { model?: string; prompt: string; system?: string; json?: boolean } = { prompt: '' }): string {
    const args = ['infer', 'model'];
    if (opts.model) args.push('--model', opts.model);
    if (opts.json) args.push('--json');
    args.push(opts.prompt);
    try {
      return runOpenClaw(args, 60000);
    } catch (e) {
      return opts.json ? JSON.stringify({ error: (e as Error).message }) : `Error: ${(e as Error).message}`;
    }
  }

  /**
   * List available engines (providers)
   */
  listEngines(): string[] {
    return ['minimax', 'openrouter', 'lmstudio', 'kimi', 'openai', 'anthropic', 'openclaw'];
  }

  /**
   * Set the default engine
   */
  setEngine(engine: string): boolean {
    if (!this.listEngines().includes(engine)) return false;
    setEngineConfig更新({ engine });
    return true;
  }

  /**
   * Set default temperature
   */
  setTemperature(temp: number): boolean {
    setEngineConfig更新({ temperature: temp });
    return true;
  }

  /**
   * Set default max tokens
   */
  setMaxTokens(tokens: number): boolean {
    setEngineConfig更新({ maxTokens: tokens });
    return true;
  }

  /**
   * Print engine list to console
   */
  printEngines(): void {
    const c = { green: '\x1b[32m', reset: '\x1b[0m', bold: '\x1b[1m', cyan: '\x1b[36m' };
    console.log(`\n${c.bold}Available Engines:${c.reset}`);
    for (const eng of this.listEngines()) {
      console.log(`  ${c.green}✅${c.reset} ${eng}`);
    }
    console.log();
  }

  /**
   * Get engine configuration
   */
  getConfig() {
    return getEngineConfig();
  }

  /**
   * Clear the capability cache
   */
  clearCache(): void {
    this.capabilityCache = null;
    this.cacheTimestamp = 0;
  }
}

// Alias for pre-existing capability-manager.ts compatibility
export { InferCapabilities as InferenceCapabilities };

// ─── Singleton ───────────────────────────────────────────────────────────────

let _instance: InferCapabilities | null = null;

export function getInferCapabilities(): InferCapabilities {
  if (!_instance) _instance = new InferCapabilities();
  return _instance;
}
