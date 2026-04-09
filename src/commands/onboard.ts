/**
 * 🦆 Duck CLI - Interactive Onboarding Wizard
 * Like `openclaw onboard` - guided first-run setup
 */

import * as readline from 'readline';
import { existsSync, readFileSync, writeFileSync, mkdirSync, chmodSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { execSync } from 'child_process';

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

const logo = `
${c.cyan}${c.bold}
   ██╗██╗   ██╗██╗ ██████╗████████╗ ██████╗ ██████╗ ██╗   ██╗██╗
   ██║██║   ██║██║██╔════╝╚══██╔══╝██╔═══██╗██╔══██╗╚██╗ ██╔╝██║
   ██║██║   ██║██║██║        ██║   ██║   ██║██████╔╝ ╚████╔╝ ██║
   ██║╚██╗ ██╔╝██║██║        ██║   ██║   ██║██╔══██╗  ╚██╔╝  ╚═╝
   ██║ ╚████╔╝ ██║╚██████╗   ██║   ╚██████╔╝██║  ██║   ██║   ██╗
   ╚═╝  ╚═══╝  ╚═╝ ╚═════╝   ╚═╝    ╚═════╝ ╚═╝  ╚═╝   ╚═╝   ╚═╝
${c.reset}${c.cyan}  AI Agent${c.reset} ${c.dim}onboarding wizard${c.reset}
`;

export interface OnboardResult {
  success: boolean;
  configured: {
    minimax?: boolean;
    openrouter?: boolean;
    kimi?: boolean;
    openai?: boolean;
    anthropic?: boolean;
    provider?: string;
    model?: string;
    [key: string]: boolean | string | undefined;
  };
  duckDir: string;
  configPath: string;
  skipped: boolean[];
}

export async function runOnboardingWizard(options?: { force?: boolean }): Promise<OnboardResult> {
  console.log(`\n${logo}`);
  console.log(`${c.bold}Welcome to Duck CLI! Let's get you set up.${c.reset}\n`);
  console.log(`${c.dim}This wizard will help you configure API keys and settings.${c.reset}`);
  console.log(`${c.dim}Press Ctrl+C at any time to exit (settings already saved will be kept).${c.reset}\n`);

  const duckDir = join(homedir(), '.duck');
  const envPath = join(duckDir, '.env');
  const configPath = join(duckDir, 'config.yaml');
  const skillsDir = join(duckDir, 'skills');

  // Load existing .env if present
  let env: Record<string, string> = {};
  if (existsSync(envPath)) {
    try {
      const content = readFileSync(envPath, 'utf-8');
      for (const line of content.split('\n')) {
        const m = line.match(/^([^#=]+)=(.*)$/);
        if (m) env[m[1].trim()] = m[2].trim();
      }
    } catch { /* ignore */ }
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q: string): Promise<string> =>
    new Promise<string>(res => rl.question(`${c.cyan}${q}${c.reset}: `, a => res(a)));

  const askChoice = async (q: string, choices: string[]): Promise<number> => {
    const choiceStr = choices.map((c, i) => `${i + 1}. ${c}`).join('  ');
    const raw = await ask(`${q} ${choiceStr}`);
    const idx = parseInt(raw.trim(), 10) - 1;
    if (isNaN(idx) || idx < 0 || idx >= choices.length) return 0;
    return idx;
  };

  const askYN = async (q: string, default_ = true): Promise<boolean> => {
    const raw = await ask(`${q} [${default_ ? 'Y/n' : 'y/N'}]`);
    if (!raw.trim()) return default_;
    return raw.trim().toLowerCase().startsWith('y');
  };

  const result: OnboardResult = {
    success: false,
    configured: {},
    duckDir,
    configPath,
    skipped: [],
  };

  // ─── Step 1: API Keys ───────────────────────────────────────────────────
  console.log(`\n${c.bold}${c.cyan}Step 1: API Keys${c.reset}`);
  console.log(`${c.dim}Get free API keys at the links below. You can skip any you don't want.${c.reset}\n`);

  const keySources = [
    { key: 'MINIMAX_API_KEY', name: 'MiniMax', url: 'https://platform.minimax.io', desc: 'Primary provider — recommended' },
    { key: 'OPENROUTER_API_KEY', name: 'OpenRouter', url: 'https://openrouter.ai', desc: '30+ free models' },
    { key: 'KIMI_API_KEY', name: 'Kimi (Moonshot)', url: 'https://platform.moonshot.cn', desc: 'Vision + long context' },
    { key: 'OPENAI_API_KEY', name: 'OpenAI', url: 'https://platform.openai.com', desc: 'GPT-4o, o1, o3' },
    { key: 'ANTHROPIC_API_KEY', name: 'Anthropic', url: 'https://console.anthropic.com', desc: 'Claude 3.5, 3.7' },
  ];

  const skipped: boolean[] = [];
  for (const src of keySources) {
    const existing = env[src.key] || process.env[src.key];
    if (existing) {
      console.log(`  ${c.green}✅${c.reset} ${src.name} — already configured (***${existing.slice(-4)})`);
      result.configured[src.key.toLowerCase().replace('_api_key', '') as keyof typeof result.configured] = true;
      continue;
    }
    const want = await askYN(`Configure ${src.name}? (${src.url})`);
    if (want) {
      let attempts = 0;
      while (attempts < 3) {
        const val = await ask(`  ${src.name} API Key`);
        if (val.trim().length > 10) {
          env[src.key] = val.trim();
          result.configured[src.key.toLowerCase().replace('_api_key', '') as keyof typeof result.configured] = true;
          console.log(`  ${c.green}✅ Saved${c.reset}`);
          break;
        } else {
          attempts++;
          console.log(`  ${c.red}Key too short, try again (${attempts}/3)${c.reset}`);
        }
      }
      if (attempts >= 3) {
        console.log(`  ${c.yellow}Skipped${c.reset}`);
        skipped.push(true);
      }
    } else {
      skipped.push(true);
    }
  }

  // ─── Step 2: Default Provider ─────────────────────────────────────────
  console.log(`\n${c.bold}${c.cyan}Step 2: Default Provider${c.reset}\n`);
  const available = keySources.filter(s => !!env[s.key] || !!process.env[s.key]);
  if (available.length === 0) {
    console.log(`${c.yellow}No API keys configured. Will use LM Studio or OpenRouter free tier.${c.reset}`);
    const useFree = await askYN('Try OpenRouter free tier?', true);
    if (useFree) {
      env.DUCK_PROVIDER = 'openrouter';
      env.OPENROUTER_API_KEY = env.OPENROUTER_API_KEY || '';
      result.configured.provider = 'openrouter';
    }
  } else {
    console.log(`Available providers:`);
    available.forEach((s, i) => console.log(`  ${i + 1}. ${s.name}`));
    const idx = await askChoice('Select default provider', available.map(s => s.name));
    const chosen = available[idx];
    env.DUCK_PROVIDER = chosen.key.replace('_API_KEY', '').toLowerCase();
    result.configured.provider = env.DUCK_PROVIDER;
    result.configured.model = getRecommendedModel(env.DUCK_PROVIDER);
    console.log(`  ${c.green}Default: ${env.DUCK_PROVIDER}${c.reset}`);
  }

  // ─── Step 3: Duck Data Directory ───────────────────────────────────────
  console.log(`\n${c.bold}${c.cyan}Step 3: Data Directory${c.reset}\n`);
  console.log(`  Duck data directory: ${c.cyan}${duckDir}${c.reset}`);
  const dirOk = existsSync(duckDir);
  if (!dirOk) {
    mkdirSync(duckDir, { recursive: true });
    mkdirSync(skillsDir, { recursive: true });
    console.log(`  ${c.green}Created${c.reset}`);
  } else {
    console.log(`  ${c.dim}Already exists${c.reset}`);
  }

  // ─── Step 4: Provider Models ───────────────────────────────────────────
  console.log(`\n${c.bold}${c.cyan}Step 4: Model Selection${c.reset}\n`);
  if (env.DUCK_PROVIDER) {
    const recommended = getRecommendedModel(env.DUCK_PROVIDER);
    console.log(`  Recommended model for ${env.DUCK_PROVIDER}: ${c.cyan}${recommended}${c.reset}`);
    const useRecommended = await askYN('Use recommended model?', true);
    if (!useRecommended) {
      const raw = await ask('Enter model name');
      env.DUCK_MODEL = raw.trim() || recommended;
    } else {
      env.DUCK_MODEL = recommended;
    }
    result.configured.model = env.DUCK_MODEL;
  }

  // ─── Step 5: Optional Features ─────────────────────────────────────────
  console.log(`\n${c.bold}${c.cyan}Step 5: Optional Features${c.reset}\n`);

  const installSkills = await askYN('Install skills marketplace?', true);
  if (installSkills) {
    console.log(`  ${c.dim}Skills can be installed later with: duck skills install <name>${c.reset}`);
  }

  const enableMesh = await askYN('Enable agent mesh networking?', false);
  if (enableMesh) {
    env.DUCK_MESH_ENABLED = 'true';
  }

  const enableSubconscious = await askYN('Enable subconscious self-reflection?', false);
  if (enableSubconscious) {
    env.DUCK_SUBCONSCIOUS_ENABLED = 'true';
  }

  // ─── Step 6: Save Configuration ────────────────────────────────────────
  console.log(`\n${c.bold}${c.cyan}Step 6: Saving Configuration${c.reset}\n`);

  mkdirSync(duckDir, { recursive: true });
  const envLines = Object.entries(env)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

  writeFileSync(envPath, envLines + '\n', { mode: 0o600 });
  console.log(`  ${c.green}✅ Saved .env: ${envPath}${c.reset}`);

  // Create a basic config.yaml
  const yamlContent = `
# Duck CLI Configuration
# Generated by onboard wizard

defaults:
  provider: ${env.DUCK_PROVIDER || 'openrouter'}
  model: ${env.DUCK_MODEL || 'qwen/qwen3.6-plus-preview:free'}
  maxRetries: 2

providers:
  minimax:
    enabled: ${!!env.MINIMAX_API_KEY}
    priority: 1
  openrouter:
    enabled: true
    priority: 2
  kimi:
    enabled: ${!!env.KIMI_API_KEY}
    priority: 3
  openai:
    enabled: ${!!env.OPENAI_API_KEY}
    priority: 4
  anthropic:
    enabled: ${!!env.ANTHROPIC_API_KEY}
    priority: 5

features:
  mesh: ${enableMesh}
  subconscious: ${enableSubconscious}
  skills: ${installSkills}
`;
  writeFileSync(configPath, yamlContent, { mode: 0o600 });
  console.log(`  ${c.green}✅ Saved config: ${configPath}${c.reset}`);

  // ─── Step 7: Verify ────────────────────────────────────────────────────
  console.log(`\n${c.bold}${c.cyan}Step 7: Verification${c.reset}\n`);

  if (env.MINIMAX_API_KEY || env.OPENROUTER_API_KEY || env.KIMI_API_KEY) {
    try {
      console.log(`  ${c.dim}Verifying provider connectivity...${c.reset}`);
      const { execSync } = await import('child_process');
      const testResult = execSync(
        `node -e "const {Agent}=require('./dist/agent/core.js');const a=new Agent({name:'Test'});await a.initialize();console.log('OK');a.shutdown();"`,
        { cwd: dirname(dirname(require.resolve('../package.json', { paths: [__dirname] }))), stdio: 'pipe', timeout: 15000 }
      );
      console.log(`  ${c.green}✅ Agent initialized successfully${c.reset}`);
    } catch (e: any) {
      console.log(`  ${c.yellow}⚠️  Agent init warning: ${e.message.split('\n')[0]}${c.reset}`);
      console.log(`  ${c.dim}This is OK — keys may need a moment to activate.${c.reset}`);
    }
  }

  // ─── Done ──────────────────────────────────────────────────────────────
  rl.close();

  console.log(`\n${c.green}${c.bold}✅ Onboarding complete!${c.reset}\n`);
  console.log(`${c.bold}Next steps:${c.reset}`);
  console.log(`  ${c.cyan}duck${c.reset}              Start chatting`);
  console.log(`  ${c.cyan}duck shell${c.reset}        Interactive shell`);
  console.log(`  ${c.cyan}duck doctor${c.reset}       Check system health`);
  console.log(`  ${c.cyan}duck help${c.reset}         Full command list`);
  console.log(`  ${c.cyan}duck skills${c.reset}       Browse skills marketplace`);
  console.log();

  result.success = true;
  result.skipped = skipped;
  return result;
}

function getRecommendedModel(provider: string): string {
  const models: Record<string, string> = {
    minimax: 'MiniMax-M2.7',
    openrouter: 'qwen/qwen3.6-plus-preview:free',
    kimi: 'moonshot-v1-32k',
    openai: 'gpt-4o-mini',
    anthropic: 'claude-3-5-sonnet-20241022',
    lmstudio: 'gemma-4-e4b-it',
  };
  return models[provider] || 'MiniMax-M2.7';
}

// CLI entry point
// Note: ESM import.meta.url check removed for CommonJS compatibility
// Use: import { runOnboardingWizard } from './onboard.js' instead
