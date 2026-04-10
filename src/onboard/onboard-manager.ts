/**
 * Duck Agent - Onboard Manager
 * Interactive onboarding for gateway, workspace, and skills
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { homedir, platform } from 'os';
import { join, dirname } from 'path';
import * as readline from 'readline';

// Colors
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gold: '\x1b[33m',
  magenta: '\x1b[35m',
};

export interface OnboardConfig {
  gateway: GatewayConfig;
  workspace: WorkspaceConfig;
  skills: SkillsConfig;
  completed: boolean;
  version: string;
}

export interface GatewayConfig {
  enabled: boolean;
  url: string;
  token: string;
  autoConnect: boolean;
  port: number;
}

export interface WorkspaceConfig {
  path: string;
  defaultModel: string;
  provider: string;
  autoStart: boolean;
  chatHistory: boolean;
}

export interface SkillsConfig {
  autoInstall: boolean;
  categories: string[];
  installed: string[];
}

export interface OnboardResult {
  success: boolean;
  config?: OnboardConfig;
  error?: string;
}

export class OnboardManager {
  private duckDir: string;
  private configPath: string;
  private envPath: string;
  private config: OnboardConfig;

  constructor() {
    this.duckDir = join(homedir(), '.duck');
    this.configPath = join(this.duckDir, 'onboard.json');
    this.envPath = join(this.duckDir, '.env');

    this.config = this.loadConfig();
  }

  // ─── Config Loading / Saving ───────────────────────────────────────────────

  private loadConfig(): OnboardConfig {
    const defaults: OnboardConfig = {
      gateway: {
        enabled: false,
        url: '',
        token: '',
        autoConnect: false,
        port: 18789,
      },
      workspace: {
        path: join(homedir(), '.openclaw', 'workspace'),
        defaultModel: 'minimax/MiniMax-M2.7',
        provider: 'minimax',
        autoStart: true,
        chatHistory: true,
      },
      skills: {
        autoInstall: true,
        categories: [],
        installed: [],
      },
      completed: false,
      version: '1.0.0',
    };

    if (existsSync(this.configPath)) {
      try {
        const content = readFileSync(this.configPath, 'utf-8');
        const saved = JSON.parse(content);
        // Merge with defaults (don't clobber missing keys from older config)
        return {
          gateway: { ...defaults.gateway, ...saved.gateway },
          workspace: { ...defaults.workspace, ...saved.workspace },
          skills: { ...defaults.skills, ...saved.skills },
          completed: saved.completed ?? false,
          version: saved.version ?? '1.0.0',
        };
      } catch {
        return defaults;
      }
    }

    return defaults;
  }

  saveConfig(): void {
    mkdirSync(this.duckDir, { recursive: true });
    writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), { mode: 0o600 });
  }

  // ─── Environment Helpers ───────────────────────────────────────────────────

  private loadEnv(): Record<string, string> {
    const env: Record<string, string> = {};
    if (existsSync(this.envPath)) {
      try {
        const content = readFileSync(this.envPath, 'utf-8');
        for (const line of content.split('\n')) {
          const m = line.match(/^([^#=]+)=(.*)$/);
          if (m) env[m[1].trim()] = m[2].trim();
        }
      } catch {}
    }
    return env;
  }

  private saveEnv(env: Record<string, string>): void {
    mkdirSync(this.duckDir, { recursive: true });
    const lines = Object.entries(env)
      .filter(([, v]) => v !== undefined && v !== '')
      .map(([k, v]) => `${k}=${v}`);
    writeFileSync(this.envPath, lines.join('\n') + '\n', { mode: 0o600 });
  }

  // ─── Interactive rl helper ──────────────────────────────────────────────────

  private async ask(question: string, rl: readline.Interface): Promise<string> {
    return new Promise<string>(res => {
      rl.question(`${c.cyan}${question}${c.reset}: `, a => res(a));
    });
  }

  private async askYesNo(question: string, rl: readline.Interface, defaultVal = false): Promise<boolean> {
    const defaultStr = defaultVal ? 'Y/n' : 'y/N';
    const answer = await this.ask(`${question} [${defaultStr}]`, rl);
    if (!answer.trim()) return defaultVal;
    return answer.trim().toLowerCase().startsWith('y');
  }

  // ─── Banner ────────────────────────────────────────────────────────────────

  private printBanner(title: string, step: number, total: number): void {
    console.log(`\n${c.bold}${c.gold}═══════════════════════════════════════════════════════${c.reset}`);
    console.log(`${c.bold}${c.cyan}  ${title}${c.reset}`);
    console.log(`${c.dim}  Step ${step} of ${total}${c.reset}`);
    console.log(`${c.gold}═══════════════════════════════════════════════════════${c.reset}\n`);
  }

  private printSection(title: string): void {
    console.log(`\n${c.bold}${c.blue}── ${title} ──────────────────────────────────────────${c.reset}`);
  }

  // ─── Check existing setup ──────────────────────────────────────────────────

  getStatus(): { needsOnboarding: boolean; gatewayConnected: boolean; skillsCount: number } {
    const env = this.loadEnv();
    const hasApiKey = !!(env.MINIMAX_API_KEY || env.OPENROUTER_API_KEY || env.KIMI_API_KEY);
    const gatewayConnected = !!(this.config.gateway.enabled && this.config.gateway.url);

    let skillsCount = 0;
    const wsSkillsDir = join(this.config.workspace.path, 'skills');
    if (existsSync(wsSkillsDir)) {
      try {
        const { readdirSync } = require('fs');
        skillsCount = readdirSync(wsSkillsDir).filter((f: string) => f.endsWith('.md') || f.endsWith('.skill')).length;
      } catch {}
    }

    return {
      needsOnboarding: !this.config.completed || !hasApiKey,
      gatewayConnected,
      skillsCount,
    };
  }

  // ─── Step 1: Gateway Setup ──────────────────────────────────────────────────

  async setupGateway(rl: readline.Interface): Promise<GatewayConfig> {
    this.printSection('Gateway Setup');

    const enabled = await this.askYesNo('Enable OpenClaw Gateway bridge?', rl, false);
    const cfg: GatewayConfig = { ...this.config.gateway, enabled };

    if (enabled) {
      const url = await this.ask('Gateway URL [http://localhost:18789]', rl);
      cfg.url = url.trim() || 'http://localhost:18789';

      const token = await this.ask('Gateway token (press Enter to skip)', rl);
      cfg.token = token.trim();

      cfg.autoConnect = await this.askYesNo('Auto-connect on startup?', rl, false);

      const portStr = await this.ask(`Gateway port [${cfg.port}]`, rl);
      if (portStr.trim()) {
        const port = parseInt(portStr.trim());
        if (!isNaN(port) && port > 0 && port < 65536) {
          cfg.port = port;
        }
      }

      console.log(`\n${c.green}✅ Gateway configured${c.reset}`);
      console.log(`   URL: ${cfg.url}`);
      console.log(`   Auto-connect: ${cfg.autoConnect ? 'yes' : 'no'}`);
    } else {
      console.log(`\n${c.dim}Gateway skipped. You can enable it later with: duck onboard gateway${c.reset}`);
    }

    return cfg;
  }

  // ─── Step 2: Workspace Setup ────────────────────────────────────────────────

  async setupWorkspace(rl: readline.Interface): Promise<WorkspaceConfig> {
    this.printSection('Workspace Setup');

    const defaultPath = join(homedir(), '.openclaw', 'workspace');
    const path = await this.ask(`Workspace directory [${defaultPath}]`, rl);
    const wsPath = path.trim() || defaultPath;

    if (!existsSync(wsPath)) {
      console.log(`${c.yellow}⚠️  Workspace directory does not exist yet.${c.reset}`);
      console.log(`${c.dim}It will be created when you first run Duck Agent.${c.reset}`);
    }

    const cfg: WorkspaceConfig = {
      ...this.config.workspace,
      path: wsPath,
    };

    this.printSection('AI Provider');
    const providerChoices = [
      { value: 'minimax', label: 'MiniMax  (recommended, free tier available)' },
      { value: 'openrouter', label: 'OpenRouter  (free tier: qwen3.6-plus-preview)' },
      { value: 'kimi', label: 'Kimi  (Moonshot)' },
      { value: 'lmstudio', label: 'LM Studio  (local, free)' },
    ];

    console.log(`Available providers:`);
    for (const p of providerChoices) {
      console.log(`  ${c.cyan}  ${p.value.padEnd(12)}${c.reset} ${p.label}`);
    }

    const provider = await this.ask('Default provider [minimax]', rl);
    cfg.provider = provider.trim() || 'minimax';

    const modelMap: Record<string, string> = {
      minimax: 'MiniMax-M2.7',
      openrouter: 'qwen/qwen3.6-plus-preview:free',
      kimi: 'moonshot-v1-32k',
      lmstudio: 'gemma-4-e4b-it',
    };
    cfg.defaultModel = modelMap[cfg.provider] || 'MiniMax-M2.7';

    cfg.autoStart = await this.askYesNo('Auto-start Duck Agent on login?', rl, false);
    cfg.chatHistory = await this.askYesNo('Store chat history?', rl, true);

    console.log(`\n${c.green}✅ Workspace configured${c.reset}`);
    console.log(`   Path: ${cfg.path}`);
    console.log(`   Provider: ${cfg.provider}`);
    console.log(`   Model: ${cfg.defaultModel}`);

    return cfg;
  }

  // ─── Step 3: Skills Setup ──────────────────────────────────────────────────

  async setupSkills(rl: readline.Interface): Promise<SkillsConfig> {
    this.printSection('Skills Setup');

    const wsSkillsDir = join(this.config.workspace.path, 'skills');
    let currentSkills: string[] = [];
    if (existsSync(wsSkillsDir)) {
      try {
        const { readdirSync } = require('fs');
        currentSkills = readdirSync(wsSkillsDir)
          .filter((f: string) => f.endsWith('.md') || f.endsWith('.skill'))
          .map((f: string) => f.replace(/\.(md|skill)$/, ''));
      } catch {}
    }

    if (currentSkills.length > 0) {
      console.log(`${c.green}Found ${currentSkills.length} installed skills:${c.reset}`);
      for (const s of currentSkills.slice(0, 10)) {
        console.log(`  ${c.cyan}  ${s}${c.reset}`);
      }
      if (currentSkills.length > 10) {
        console.log(`  ${c.dim}  ... and ${currentSkills.length - 10} more${c.reset}`);
      }
      console.log();
    } else {
      console.log(`${c.dim}No skills installed yet.${c.reset}`);
      console.log(`${c.dim}Run ${c.green}duck skills install <name>${c.reset}${c.dim} to add skills.${c.reset}\n`);
    }

    const autoInstall = await this.askYesNo('Auto-install recommended skills on setup?', rl, true);
    const cfg: SkillsConfig = {
      ...this.config.skills,
      autoInstall,
      installed: currentSkills,
    };

    if (autoInstall) {
      const recommended = ['github', 'weather', 'apple-notes', 'apple-reminders', 'things-mac'];
      const toInstall = recommended.filter((s: string) => !currentSkills.includes(s));

      if (toInstall.length > 0) {
        console.log(`\n${c.cyan}Recommended skills to install:${c.reset}`);
        for (const s of toInstall) {
          console.log(`  ${c.green}  ${s}${c.reset}`);
        }
        cfg.categories = recommended;
      } else {
        console.log(`\n${c.green}All recommended skills already installed!${c.reset}`);
      }
    }

    return cfg;
  }

  // ─── Step 4: API Keys ────────────────────────────────────────────────────────

  async setupApiKeys(rl: readline.Interface): Promise<void> {
    this.printSection('API Keys');

    const env = this.loadEnv();
    const hasMinimax = !!env.MINIMAX_API_KEY;
    const hasOpenRouter = !!env.OPENROUTER_API_KEY;
    const hasKimi = !!env.KIMI_API_KEY;

    console.log(`${c.bold}Current status:${c.reset}`);
    console.log(`  ${hasMinimax ? c.green + '✅' : c.red + '❌'} MiniMax API Key ${hasMinimax ? '(found)' : '(not set)'}`);
    console.log(`  ${hasOpenRouter ? c.green + '✅' : c.red + '❌'} OpenRouter API Key ${hasOpenRouter ? '(found)' : '(not set)'}`);
    console.log(`  ${hasKimi ? c.green + '✅' : c.red + '❌'} Kimi API Key ${hasKimi ? '(found)' : '(not set)'}`);
    console.log();

    console.log(`${c.dim}Get free API keys at:${c.reset}`);
    console.log(`  MiniMax:    ${c.blue}https://platform.minimax.io${c.reset}`);
    console.log(`  OpenRouter: ${c.blue}https://openrouter.ai${c.reset}`);
    console.log(`  Kimi:       ${c.blue}https://platform.moonshot.cn${c.reset}`);
    console.log();

    const minikey = await this.ask('MiniMax API Key (press Enter to skip)', rl);
    const openrouter = await this.ask('OpenRouter API Key (press Enter to skip)', rl);
    const kimi = await this.ask('Kimi API Key (press Enter to skip)', rl);
    const provider = await this.ask('Default provider (minimax/openrouter/kimi) [minimax]', rl);

    if (minikey.trim()) env.MINIMAX_API_KEY = minikey.trim();
    if (openrouter.trim()) env.OPENROUTER_API_KEY = openrouter.trim();
    if (kimi.trim()) env.KIMI_API_KEY = kimi.trim();
    if (provider.trim()) env.DUCK_PROVIDER = provider.trim();

    // Detect provider from available keys
    if (!provider.trim() && !env.DUCK_PROVIDER) {
      if (env.MINIMAX_API_KEY) env.DUCK_PROVIDER = 'minimax';
      else if (env.OPENROUTER_API_KEY) env.DUCK_PROVIDER = 'openrouter';
      else if (env.KIMI_API_KEY) env.DUCK_PROVIDER = 'kimi';
    }

    this.saveEnv(env);

    const savedMinimax = !!env.MINIMAX_API_KEY;
    const savedOpenRouter = !!env.OPENROUTER_API_KEY;
    const savedKimi = !!env.KIMI_API_KEY;

    if (savedMinimax || savedOpenRouter || savedKimi) {
      console.log(`\n${c.green}✅ API keys saved to ${this.envPath}${c.reset}`);
    } else {
      console.log(`\n${c.yellow}⚠️  No API keys configured.${c.reset}`);
      console.log(`${c.dim}You can add them later with ${c.green}duck setup${c.reset}${c.dim} or by editing ${this.envPath}${c.reset}`);
    }
  }

  // ─── Main Onboarding Flow ──────────────────────────────────────────────────

  /**
   * Run the full interactive onboarding wizard.
   * Returns OnboardResult with the final config.
   */
  async onboard(): Promise<OnboardResult> {
    console.log(`\n${c.bold}${c.gold}╔═══════════════════════════════════════════════════════╗${c.reset}`);
    console.log(`${c.bold}${c.gold}║${c.reset}  ${c.bold}${c.cyan}🦆 Duck Agent — First-Time Setup${c.reset}  ${c.bold}${c.gold}║${c.reset}`);
    console.log(`${c.bold}${c.gold}╚═══════════════════════════════════════════════════════╝${c.reset}`);
    console.log(`${c.dim}This wizard will help you configure gateway, workspace, and skills.${c.reset}`);
    console.log(`${c.dim}Press Ctrl+C at any time to abort.${c.reset}`);

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    try {
      // Step 1: Gateway
      this.printBanner('Step 1: Gateway', 1, 4);
      this.config.gateway = await this.setupGateway(rl);

      // Step 2: Workspace
      this.printBanner('Step 2: Workspace', 2, 4);
      this.config.workspace = await this.setupWorkspace(rl);

      // Step 3: Skills
      this.printBanner('Step 3: Skills', 3, 4);
      this.config.skills = await this.setupSkills(rl);

      // Step 4: API Keys
      this.printBanner('Step 4: API Keys', 4, 4);
      await this.setupApiKeys(rl);

      // Mark as complete
      this.config.completed = true;
      this.saveConfig();

      // Summary
      console.log(`\n${c.bold}${c.gold}═══════════════════════════════════════════════════════${c.reset}`);
      console.log(`${c.bold}${c.gold}║${c.reset}  ${c.green}✅ Onboarding Complete!${c.reset}  ${c.bold}${c.gold}║${c.reset}`);
      console.log(`${c.bold}${c.gold}═══════════════════════════════════════════════════════${c.reset}`);
      console.log();
      console.log(`${c.bold}Next steps:${c.reset}`);
      console.log(`  ${c.green}duck shell${c.reset}         Start chatting with Duck Agent`);
      console.log(`  ${c.green}duck status${c.reset}        Check system status`);
      console.log(`  ${c.green}duck skills list${c.reset}   Browse available skills`);
      console.log(`  ${c.green}duck doctor${c.reset}        Run system diagnostics`);
      console.log();
      console.log(`${c.dim}Config saved to: ${this.configPath}${c.reset}`);
      console.log(`${c.dim}API keys saved to: ${this.envPath}${c.reset}`);
      console.log();

      return { success: true, config: this.config };
    } catch (err: any) {
      console.error(`\n${c.red}❌ Onboarding error: ${err.message}${c.reset}`);
      return { success: false, error: err.message };
    } finally {
      rl.close();
    }
  }

  // ─── Partial Onboarding ────────────────────────────────────────────────────

  /**
   * Run gateway-only onboarding (convenience command)
   */
  async onboardGateway(): Promise<OnboardResult> {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    try {
      this.config.gateway = await this.setupGateway(rl);
      this.saveConfig();
      return { success: true, config: this.config };
    } catch (err: any) {
      return { success: false, error: err.message };
    } finally {
      rl.close();
    }
  }

  /**
   * Run workspace-only onboarding
   */
  async onboardWorkspace(): Promise<OnboardResult> {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    try {
      this.config.workspace = await this.setupWorkspace(rl);
      this.saveConfig();
      return { success: true, config: this.config };
    } catch (err: any) {
      return { success: false, error: err.message };
    } finally {
      rl.close();
    }
  }

  /**
   * Run skills-only onboarding
   */
  async onboardSkills(): Promise<OnboardResult> {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    try {
      this.config.skills = await this.setupSkills(rl);
      this.saveConfig();
      return { success: true, config: this.config };
    } catch (err: any) {
      return { success: false, error: err.message };
    } finally {
      rl.close();
    }
  }

  /**
   * Print current onboarding status
   */
  printStatus(): void {
    const status = this.getStatus();
    const env = this.loadEnv();

    console.log(`\n${c.bold}🦆 Duck Agent Onboarding Status${c.reset}`);
    console.log(`${c.gold}────────────────────────────────────────────${c.reset}`);

    console.log(`\n${c.bold}API Keys:${c.reset}`);
    console.log(`  ${env.MINIMAX_API_KEY ? c.green + '✅' : c.red + '❌'} MiniMax`);
    console.log(`  ${env.OPENROUTER_API_KEY ? c.green + '✅' : c.red + '❌'} OpenRouter`);
    console.log(`  ${env.KIMI_API_KEY ? c.green + '✅' : c.red + '❌'} Kimi`);

    console.log(`\n${c.bold}Gateway:${c.reset}`);
    console.log(`  ${this.config.gateway.enabled ? c.green + '✅' : c.dim + '○'} Enabled: ${this.config.gateway.enabled ? 'yes' : 'no'}`);
    if (this.config.gateway.url) {
      console.log(`  ${c.cyan}URL:${c.reset} ${this.config.gateway.url}`);
    }

    console.log(`\n${c.bold}Workspace:${c.reset}`);
    console.log(`  ${c.cyan}Path:${c.reset} ${this.config.workspace.path}`);
    console.log(`  ${c.cyan}Provider:${c.reset} ${this.config.workspace.provider}`);
    console.log(`  ${c.cyan}Model:${c.reset} ${this.config.workspace.defaultModel}`);

    console.log(`\n${c.bold}Skills:${c.reset}`);
    console.log(`  ${c.cyan}Installed:${c.reset} ${this.config.skills.installed.length} skill(s)`);
    console.log(`  ${c.cyan}Auto-install:${c.reset} ${this.config.skills.autoInstall ? 'enabled' : 'disabled'}`);

    console.log(`\n${c.bold}Onboarding:${c.reset}`);
    if (this.config.completed) {
      console.log(`  ${c.green}✅ Setup completed${c.reset}`);
    } else {
      console.log(`  ${c.yellow}⚠️  Not yet completed${c.reset}`);
      console.log(`  Run ${c.green}duck onboard${c.reset}${c.yellow} to start the setup wizard${c.reset}`);
    }
    console.log();
  }

  /**
   * Reset onboarding state (re-run wizard)
   */
  reset(): void {
    this.config.completed = false;
    this.saveConfig();
    console.log(`${c.green}✅ Onboarding reset. Run ${c.cyan}duck onboard${c.green} to start again.${c.reset}`);
  }

  getConfig(): OnboardConfig {
    return this.config;
  }
}
