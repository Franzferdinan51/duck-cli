/**
 * 🦆 Duck CLI - Capability Manager
 * Provider-backed inference commands for duck-cli
 * Commands: duck capability, duck infer
 */

import { ProviderManager } from '../providers/manager.js';
import { InferenceCapabilities } from '../infer/infer-capabilities.js';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface InferenceResult {
  text?: string;
  error?: string;
  model: string;
  provider: string;
  durationMs: number;
  tokens?: number;
}

export interface CapabilityInfo {
  provider: string;
  models: string[];
  status: 'available' | 'unavailable' | 'no_key';
}

// ─── Capability Manager ───────────────────────────────────────────────────────

export class CapabilityManager {
  private providerManager: ProviderManager;
  private inferenceConfig: InferenceCapabilities;

  constructor() {
    this.providerManager = new ProviderManager();
    this.inferenceConfig = new InferenceCapabilities();
  }

  /**
   * Initialize the provider manager (load all providers)
   */
  async initialize(): Promise<void> {
    await this.providerManager.load();
  }

  /**
   * List all available inference capabilities
   */
  async listCapabilities(): Promise<CapabilityInfo[]> {
    const engines = this.inferenceConfig.listEngines();
    const capabilities: CapabilityInfo[] = [];

    for (const engine of engines) {
      const provider = this.providerManager.getProvider(engine);
      let models: string[] = [];
      let status: CapabilityInfo['status'] = 'unavailable';

      if (provider) {
        status = 'available';
        // Try to get model list if the provider supports it
        if (engine === 'lmstudio') {
          models = ['gemma-4-e4b-it', 'qwen3.5-9b', 'qwen3.5-0.8b', 'qwen3.5-plus'];
        } else if (engine === 'openrouter') {
          models = ['qwen/qwen3.6-plus-preview:free', 'minimax/minimax-m2.5:free', 'nousresearch/hermes-3-llama-3.1-405b:free'];
        } else if (engine === 'minimax') {
          models = ['MiniMax-M2.7', 'MiniMax-M2', 'abab6.5s-chat'];
        } else if (engine === 'kimi') {
          models = ['kimi-k2.5', 'kimi-k2'];
        } else if (engine === 'anthropic') {
          models = ['claude-3-5-sonnet-20241022', 'claude-3-opus-20240229'];
        } else if (engine === 'openai') {
          models = ['gpt-4o-mini', 'gpt-4o'];
        }
      } else {
        // Check why unavailable
        const apiKeyMap: Record<string, string> = {
          minimax: 'MINIMAX_API_KEY',
          anthropic: 'ANTHROPIC_API_KEY',
          openai: 'OPENAI_API_KEY',
          kimi: 'KIMI_API_KEY',
          openrouter: 'OPENROUTER_API_KEY',
          lmstudio: 'LMSTUDIO_URL',
        };
        const key = apiKeyMap[engine];
        if (key) {
          status = process.env[key] ? 'available' : 'no_key';
        } else {
          status = 'unavailable';
        }
      }

      capabilities.push({ provider: engine, models, status });
    }

    return capabilities;
  }

  /**
   * Print capabilities to console
   */
  async printCapabilities(): Promise<void> {
    const caps = await this.listCapabilities();
    const cfg = this.inferenceConfig.getConfig();
    const c = {
      reset: '\x1b[0m',
      bold: '\x1b[1m',
      green: '\x1b[32m',
      yellow: '\x1b[33m',
      red: '\x1b[31m',
      cyan: '\x1b[36m',
      dim: '\x1b[2m',
    };

    console.log(`\n${c.bold}🦆 Inference Capabilities${c.reset}\n`);
    console.log(`  ${c.cyan}Current engine:${c.reset} ${cfg.engine}`);
    console.log(`  ${c.cyan}Temperature:${c.reset} ${cfg.temperature}`);
    console.log(`  ${c.cyan}Max tokens:${c.reset} ${cfg.maxTokens}`);
    console.log(`\n${c.bold}Available Providers:${c.reset}\n`);

    for (const cap of caps) {
      const icon = cap.status === 'available'
        ? `${c.green}✅`
        : cap.status === 'no_key'
          ? `${c.yellow}🔑`
          : `${c.red}❌`;
      const label = cap.status === 'available'
        ? ''
        : cap.status === 'no_key'
          ? ` ${c.dim}(no API key)${c.reset}`
          : ` ${c.dim}(unavailable)${c.reset}`;

      console.log(`  ${icon} ${c.bold}${cap.provider}${c.reset}${label}`);
      if (cap.status === 'available' && cap.models.length > 0) {
        const modelList = cap.models.slice(0, 5).join(', ');
        const more = cap.models.length > 5 ? ` +${cap.models.length - 5} more` : '';
        console.log(`    ${c.dim}${modelList}${more}${c.reset}`);
      }
    }
    console.log();
  }

  /**
   * Run inference against a specific model or the default engine
   */
  async runInference(
    prompt: string,
    opts: {
      model?: string;
      engine?: string;
      temperature?: number;
      maxTokens?: number;
      system?: string;
    } = {}
  ): Promise<InferenceResult> {
    await this.initialize();

    const startTime = Date.now();
    const engine = opts.engine || this.inferenceConfig.getConfig().engine;
    const model = opts.model || 'auto';

    const messages: any[] = [];
    if (opts.system) {
      messages.push({ role: 'system', content: opts.system });
    }
    messages.push({ role: 'user', content: prompt });

    const provider = this.providerManager.getProvider(engine);
    if (!provider) {
      return {
        error: `Provider '${engine}' not available. Set MINIMAX_API_KEY, ANTHROPIC_API_KEY, OPENAI_API_KEY, KIMI_API_KEY, OPENROUTER_API_KEY, or start LM Studio.`,
        model,
        provider: engine,
        durationMs: Date.now() - startTime,
      };
    }

    try {
      const result = await provider.complete({
        model: model !== 'auto' ? model : undefined,
        messages,
      });

      return {
        text: result.text,
        error: result.error,
        model: model !== 'auto' ? model : 'auto',
        provider: engine,
        durationMs: Date.now() - startTime,
      };
    } catch (e: any) {
      return {
        error: e.message,
        model,
        provider: engine,
        durationMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Test inference with a specific model
   * Model format: "provider" or "provider:model"
   * Examples: "minimax", "openrouter:minimax/minimax-m2.5:free", "lmstudio:gemma-4-e4b-it"
   */
  async testModel(model: string, prompt = 'Say "Hello from [model name]" in exactly that format.'): Promise<InferenceResult> {
    // Parse model string (e.g., "openrouter:minimax/minimax-m2.5:free")
    let engine = 'minimax';
    let actualModel = 'auto'; // default: let provider pick its default model

    if (model.includes(':')) {
      const [e, m] = model.split(':', 2);
      engine = e;
      actualModel = m;
    } else {
      // Plain provider name — use provider's default model
      engine = model;
    }

    return this.runInference(prompt, { engine, model: actualModel });
  }

  /**
   * Set the default inference engine
   */
  setEngine(engine: string): boolean {
    const valid = this.inferenceConfig.listEngines();
    if (!valid.includes(engine)) {
      console.error(`Invalid engine '${engine}'. Valid: ${valid.join(', ')}`);
      return false;
    }
    return this.inferenceConfig.setEngine(engine as any);
  }

  /**
   * Set default temperature
   */
  setTemperature(temp: number): boolean {
    return this.inferenceConfig.setTemperature(temp);
  }

  /**
   * Set default max tokens
   */
  setMaxTokens(tokens: number): boolean {
    return this.inferenceConfig.setMaxTokens(tokens);
  }

  /**
   * Get current inference config
   */
  getConfig() {
    return this.inferenceConfig.getConfig();
  }

  /**
   * Print engine list
   */
  printEngines(): void {
    this.inferenceConfig.printEngines();
  }
}

export default CapabilityManager;
