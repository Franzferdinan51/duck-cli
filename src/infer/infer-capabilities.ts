/**
 * 🦆 Duck CLI - Inference Capabilities
 * Manages inference capabilities and engine settings
 * Commands: openclaw infer
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const OPENCLAW_CONFIG_PATH = join(homedir(), '.openclaw', 'openclaw.json');

export interface InferenceConfig {
  engine: 'auto' | 'openai' | 'anthropic' | 'minimax' | 'kimi' | 'lmstudio' | 'openrouter';
  temperature: number;
  maxTokens: number;
  topP: number;
  frequencyPenalty: number;
  presencePenalty: number;
  reasoning?: boolean;
  jsonMode?: boolean;
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

export class InferenceCapabilities {
  /**
   * Get current inference configuration
   */
  getConfig(): InferenceConfig {
    const cfg = getOpenClawConfig();
    const infer = cfg?.agents?.defaults?.inference || {};

    return {
      engine: infer.engine || 'auto',
      temperature: infer.temperature ?? 0.7,
      maxTokens: infer.maxTokens ?? 4096,
      topP: infer.topP ?? 1.0,
      frequencyPenalty: infer.frequencyPenalty ?? 0,
      presencePenalty: infer.presencePenalty ?? 0,
      reasoning: infer.reasoning ?? false,
      jsonMode: infer.jsonMode ?? false,
    };
  }

  /**
   * Print inference config to console
   */
  printConfig(): void {
    const cfg = this.getConfig();

    console.log('\n🦆 Inference Configuration\n');
    console.log(`  Engine:             ${cfg.engine}`);
    console.log(`  Temperature:        ${cfg.temperature}`);
    console.log(`  Max Tokens:         ${cfg.maxTokens}`);
    console.log(`  Top P:              ${cfg.topP}`);
    console.log(`  Frequency Penalty:  ${cfg.frequencyPenalty}`);
    console.log(`  Presence Penalty:   ${cfg.presencePenalty}`);
    console.log(`  Reasoning:          ${cfg.reasoning ? '✅ enabled' : '❌ disabled'}`);
    console.log(`  JSON Mode:          ${cfg.jsonMode ? '✅ enabled' : '❌ disabled'}`);
    console.log();
  }

  /**
   * Update inference configuration
   */
  updateConfig(updates: Partial<InferenceConfig>): boolean {
    const cfg = getOpenClawConfig();
    if (!cfg) {
      console.error('No OpenClaw config found');
      return false;
    }

    if (!cfg.agents) cfg.agents = {};
    if (!cfg.agents.defaults) cfg.agents.defaults = {};
    if (!cfg.agents.defaults.inference) cfg.agents.defaults.inference = {};

    Object.assign(cfg.agents.defaults.inference, updates);
    saveOpenClawConfig(cfg);

    console.log('✅ Updated inference configuration');
    return true;
  }

  /**
   * Set inference engine
   */
  setEngine(engine: InferenceConfig['engine']): boolean {
    return this.updateConfig({ engine });
  }

  /**
   * Set temperature
   */
  setTemperature(temp: number): boolean {
    return this.updateConfig({ temperature: Math.max(0, Math.min(2, temp)) });
  }

  /**
   * Set max tokens
   */
  setMaxTokens(tokens: number): boolean {
    return this.updateConfig({ maxTokens: Math.max(1, tokens) });
  }

  /**
   * Enable/disable reasoning
   */
  setReasoning(enabled: boolean): boolean {
    return this.updateConfig({ reasoning: enabled });
  }

  /**
   * Enable/disable JSON mode
   */
  setJsonMode(enabled: boolean): boolean {
    return this.updateConfig({ jsonMode: enabled });
  }

  /**
   * List available inference engines
   */
  listEngines(): string[] {
    return ['auto', 'openai', 'anthropic', 'minimax', 'kimi', 'lmstudio', 'openrouter'];
  }

  /**
   * Print available engines
   */
  printEngines(): void {
    const engines = this.listEngines();
    const current = this.getConfig().engine;

    console.log('\n🦆 Available Inference Engines\n');
    for (const engine of engines) {
      const marker = engine === current ? '✅' : '  ';
      console.log(`  ${marker} ${engine}`);
    }
    console.log();
  }
}

export default InferenceCapabilities;
