/**
 * 🦆 Duck CLI - Capability CLI
 * Commander-based CLI for capability/inference commands
 */

import { Command } from 'commander';
import { CapabilityManager } from './capability-manager.js';

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

export function createCapabilityCommand(): Command {
  const cmd = new Command('capability')
    .alias('infer')
    .description('🦆 Provider-backed inference commands');

  const manager = new CapabilityManager();

  // capability list
  cmd
    .command('list')
    .description('List available inference capabilities')
    .action(async () => {
      await manager.printCapabilities();
    });

  // capability run <prompt>
  cmd
    .command('run <prompt>')
    .description('Run inference with a prompt')
    .option('-e, --engine <engine>', 'Inference engine (minimax, openai, anthropic, kimi, openrouter, lmstudio)')
    .option('-m, --model <model>', 'Specific model to use')
    .option('-t, --temperature <temp>', 'Temperature (0-2)', parseFloat)
    .option('--max-tokens <tokens>', 'Max tokens', parseInt)
    .option('-s, --system <prompt>', 'System prompt')
    .action(async (prompt: string, options: Record<string, any>) => {
      const result = await manager.runInference(prompt, {
        engine: options.engine,
        model: options.model,
        temperature: options.temperature,
        maxTokens: options.maxTokens,
        system: options.system,
      });

      if (result.error) {
        console.error(`${c.red}❌ Error: ${result.error}${c.reset}`);
        process.exit(1);
      }

      console.log(result.text);
      console.log(`${c.dim}\n(${result.provider}/${result.model}, ${result.durationMs}ms)${c.reset}`);
    });

  // capability test <model>
  cmd
    .command('test <model>')
    .description('Test a specific model (format: provider or provider:model)')
    .option('-p, --prompt <prompt>', 'Custom test prompt')
    .action(async (model: string, options: Record<string, any>) => {
      console.log(`${c.cyan}Testing ${model}...${c.reset}`);
      const result = await manager.testModel(model, options.prompt);

      if (result.error) {
        console.error(`${c.red}❌ Failed: ${result.error}${c.reset}`);
        process.exit(1);
      }

      console.log(`${c.green}✅ Success${c.reset}`);
      console.log(`Response: ${result.text}`);
      console.log(`${c.dim}Duration: ${result.durationMs}ms${c.reset}`);
    });

  // capability set-engine <engine>
  cmd
    .command('set-engine <engine>')
    .description('Set default inference engine')
    .action((engine: string) => {
      const success = manager.setEngine(engine);
      if (success) {
        console.log(`${c.green}✅ Default engine set to: ${engine}${c.reset}`);
      } else {
        process.exit(1);
      }
    });

  // capability set-temp <temperature>
  cmd
    .command('set-temp <temperature>')
    .description('Set default temperature (0-2)')
    .action((temp: string) => {
      const success = manager.setTemperature(parseFloat(temp));
      if (success) {
        console.log(`${c.green}✅ Default temperature set to: ${temp}${c.reset}`);
      }
    });

  // capability set-max-tokens <tokens>
  cmd
    .command('set-max-tokens <tokens>')
    .description('Set default max tokens')
    .action((tokens: string) => {
      const success = manager.setMaxTokens(parseInt(tokens, 10));
      if (success) {
        console.log(`${c.green}✅ Default max tokens set to: ${tokens}${c.reset}`);
      }
    });

  // capability config
  cmd
    .command('config')
    .description('Show current inference configuration')
    .action(() => {
      manager.printEngines();
    });

  return cmd;
}

export default createCapabilityCommand;
