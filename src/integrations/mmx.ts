/**
 * 🚀 MiniMax CLI Integration Layer
 * Deep integration with mmx-cli for duck-cli
 */

import { spawnSync, execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const MMX_CONFIG_DIR = join(homedir(), '.mmx');
const MMX_CONFIG_PATH = join(MMX_CONFIG_DIR, 'config.json');

export interface MmxConfig {
  api_key?: string;
  region?: 'global' | 'cn';
  base_url?: string;
  output?: 'text' | 'json';
  timeout?: number;
}

export interface MmxTextOptions {
  prompt: string;
  system?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  stream?: boolean;
}

export interface MmxImageOptions {
  prompt: string;
  aspectRatio?: string;
  n?: number;
  outDir?: string;
  outPrefix?: string;
}

export interface MmxSpeechOptions {
  text: string;
  model?: string;
  voice?: string;
  speed?: number;
  volume?: number;
  pitch?: number;
  format?: string;
  out?: string;
}

export interface MmxVideoOptions {
  prompt: string;
  model?: string;
  firstFrame?: string;
  download?: string;
  noWait?: boolean;
}

export interface MmxMusicOptions {
  prompt: string;
  lyrics?: string;
  instrumental?: boolean;
  lyricsOptimizer?: boolean;
  out?: string;
}

export interface MmxVisionOptions {
  imagePath: string;
  prompt?: string;
}

export interface MmxSearchOptions {
  query: string;
}

function checkMmxInstalled(): boolean {
  try {
    execSync('mmx --version', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function ensureMmxInstalled(): void {
  if (!checkMmxInstalled()) {
    throw new Error('mmx-cli is not installed. Run: npm install -g mmx-cli');
  }
}

function readMmxConfig(): MmxConfig {
  if (!existsSync(MMX_CONFIG_PATH)) return {};
  try {
    return JSON.parse(readFileSync(MMX_CONFIG_PATH, 'utf-8'));
  } catch {
    return {};
  }
}

function writeMmxConfig(config: MmxConfig): void {
  if (!existsSync(MMX_CONFIG_DIR)) {
    mkdirSync(MMX_CONFIG_DIR, { recursive: true, mode: 0o700 });
  }
  writeFileSync(MMX_CONFIG_PATH, JSON.stringify(config, null, 2) + '\n', { mode: 0o600 });
}

/**
 * Sync MiniMax API key from duck-cli .env to mmx-cli config
 */
export function syncMmxAuth(): { synced: boolean; source: string } {
  ensureMmxInstalled();
  const envKey = process.env.MINIMAX_API_KEY;
  const config = readMmxConfig();

  if (envKey) {
    if (config.api_key !== envKey) {
      config.api_key = envKey;
      writeMmxConfig(config);
      return { synced: true, source: 'MINIMAX_API_KEY env var' };
    }
    return { synced: false, source: 'already synced from MINIMAX_API_KEY' };
  }

  if (config.api_key) {
    return { synced: false, source: 'mmx config.json already has key' };
  }

  return { synced: false, source: 'no key found anywhere' };
}

function runMmx(args: string[]): string {
  ensureMmxInstalled();
  syncMmxAuth();
  const result = spawnSync('mmx', args, { encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024 });
  if (result.error) throw result.error;
  return result.stdout || result.stderr || '';
}

export const mmx = {
  installed: checkMmxInstalled,
  syncAuth: syncMmxAuth,
  config: readMmxConfig,

  textChat(options: MmxTextOptions): string {
    const args = ['text', 'chat', '--message', options.prompt];
    if (options.system) args.push('--system', options.system);
    if (options.model) args.push('--model', options.model);
    if (options.maxTokens) args.push('--max-tokens', String(options.maxTokens));
    if (options.temperature) args.push('--temperature', String(options.temperature));
    if (options.stream) args.push('--stream');
    return runMmx(args);
  },

  generateImage(options: MmxImageOptions): string {
    const args = ['image', 'generate', '--prompt', options.prompt];
    if (options.aspectRatio) args.push('--aspect-ratio', options.aspectRatio);
    if (options.n) args.push('--n', String(options.n));
    if (options.outDir) args.push('--out-dir', options.outDir);
    if (options.outPrefix) args.push('--out-prefix', options.outPrefix);
    return runMmx(args);
  },

  synthesizeSpeech(options: MmxSpeechOptions): string {
    const args = ['speech', 'synthesize', '--text', options.text];
    if (options.model) args.push('--model', options.model);
    if (options.voice) args.push('--voice', options.voice);
    if (options.speed !== undefined) args.push('--speed', String(options.speed));
    if (options.volume !== undefined) args.push('--volume', String(options.volume));
    if (options.pitch !== undefined) args.push('--pitch', String(options.pitch));
    if (options.format) args.push('--format', options.format);
    if (options.out) args.push('--out', options.out);
    return runMmx(args);
  },

  generateVideo(options: MmxVideoOptions): string {
    const args = ['video', 'generate', '--prompt', options.prompt];
    if (options.model) args.push('--model', options.model);
    if (options.firstFrame) args.push('--first-frame', options.firstFrame);
    if (options.download) args.push('--download', options.download);
    if (options.noWait) args.push('--no-wait');
    return runMmx(args);
  },

  generateMusic(options: MmxMusicOptions): string {
    const args = ['music', 'generate', '--prompt', options.prompt];
    if (options.lyrics) args.push('--lyrics', options.lyrics);
    if (options.instrumental) args.push('--instrumental');
    if (options.lyricsOptimizer) args.push('--lyrics-optimizer');
    if (options.out) args.push('--out', options.out);
    return runMmx(args);
  },

  visionDescribe(options: MmxVisionOptions): string {
    const args = ['vision', 'describe', '--image', options.imagePath];
    if (options.prompt) args.push('--prompt', options.prompt);
    return runMmx(args);
  },

  searchQuery(options: MmxSearchOptions): string {
    return runMmx(['search', 'query', '--q', options.query]);
  },

  showQuota(): string {
    return runMmx(['quota', 'show']);
  },

  authStatus(): string {
    ensureMmxInstalled();
    return runMmx(['auth', 'status']);
  },

  authLogin(apiKey: string): string {
    ensureMmxInstalled();
    return runMmx(['auth', 'login', '--api-key', apiKey]);
  }
};
