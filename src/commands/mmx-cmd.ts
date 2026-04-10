/**
 * 🦆 Duck CLI - MiniMax CLI Integration
 * Deep integration with mmx-cli using typed integration layer
 */

import { mmx, syncMmxAuth } from '../integrations/mmx.js';

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
};

function printHelp(): void {
  console.log(`\n${c.bold}${c.cyan}🚀 MiniMax CLI — Text, Image, Video, Speech, Music, Vision${c.reset}\n`);
  console.log(`${c.dim}Official CLI for the MiniMax AI Platform.${c.reset}\n`);
  console.log(`${c.bold}Usage:${c.reset}`);
  console.log(`  duck mmx text chat --message "Hello"           # text generation`);
  console.log(`  duck mmx image "A cat in a spacesuit"          # image generation`);
  console.log(`  duck mmx speech synthesize --text "Hi" --out hi.mp3`);
  console.log(`  duck mmx video generate --prompt "Sunset waves" --async`);
  console.log(`  duck mmx music generate --prompt "Upbeat pop" --out song.mp3`);
  console.log(`  duck mmx vision photo.jpg                      # image understanding`);
  console.log(`  duck mmx search "MiniMax AI latest news"       # web search`);
  console.log(`  duck mmx quota                                 # check usage quota`);
  console.log(`  duck mmx auth login --api-key sk-xxxxx         # authenticate`);
  console.log(`  duck mmx auth status                           # check auth status`);
  console.log(`  duck mmx sync                                  # sync duck-cli env key to mmx`);
  console.log(`\n${c.dim}All mmx flags are passed through directly.${c.reset}\n`);
}

async function interactiveMmxMenu(): Promise<void> {
  console.log(`\n${c.bold}${c.cyan}🚀 MiniMax Interactive Menu${c.reset}\n`);
  const items = [
    { key: '1', label: 'Text Chat', example: 'duck mmx text chat --message "Hello"' },
    { key: '2', label: 'Generate Image', example: 'duck mmx image "A futuristic city"' },
    { key: '3', label: 'Synthesize Speech', example: 'duck mmx speech synthesize --text "Hi" --out hi.mp3' },
    { key: '4', label: 'Generate Video', example: 'duck mmx video generate --prompt "Waves at sunset"' },
    { key: '5', label: 'Generate Music', example: 'duck mmx music generate --prompt "Upbeat pop" --out song.mp3' },
    { key: '6', label: 'Vision (Image Analysis)', example: 'duck mmx vision photo.jpg' },
    { key: '7', label: 'Web Search', example: 'duck mmx search "Latest AI news"' },
    { key: '8', label: 'Check Quota', example: 'duck mmx quota' },
    { key: '9', label: 'Sync Auth', example: 'duck mmx sync' },
    { key: 'h', label: 'Help', example: 'duck mmx --help' },
    { key: 'q', label: 'Quit', example: '' },
  ];

  for (const item of items) {
    console.log(`  ${c.cyan}[${item.key}]${c.reset} ${item.label}${c.dim}${item.example ? ` → ${item.example}` : ''}${c.reset}`);
  }
  console.log();
}

export async function mmxCommand(args: string[]): Promise<void> {
  const subcommand = args[0] || '';

  // Auto-sync auth on every mmx invocation
  try {
    const sync = syncMmxAuth();
    if (sync.synced) {
      console.log(`${c.dim}🔑 Synced MiniMax auth from ${sync.source}${c.reset}`);
    }
  } catch {
    // mmx not installed yet — will fall through to handler
  }

  if (subcommand === '' || subcommand === 'menu' || subcommand === 'interactive') {
    await interactiveMmxMenu();
    return;
  }

  if (subcommand === '--help' || subcommand === '-h') {
    printHelp();
    return;
  }

  if (subcommand === 'sync') {
    try {
      const result = syncMmxAuth();
      if (result.synced) {
        console.log(`${c.green}✅ Synced MiniMax API key from ${result.source}${c.reset}`);
      } else {
        console.log(`${c.yellow}⚠️  ${result.source}${c.reset}`);
      }
    } catch (e: any) {
      console.error(`${c.red}❌ Sync failed:${c.reset}`, e.message);
    }
    return;
  }

  if (subcommand === 'status') {
    const ok = mmx.installed();
    console.log(ok
      ? `${c.green}✅ mmx-cli installed${c.reset}`
      : `${c.red}❌ mmx-cli NOT installed${c.reset}`);
    try {
      console.log(mmx.authStatus());
    } catch {
      console.log(`${c.yellow}⚠️  Not authenticated. Run: duck mmx auth login --api-key <key>${c.reset}`);
    }
    return;
  }

  // Quick passthrough for complex commands that aren't natively wrapped yet
  const passthroughCommands = ['text', 'image', 'speech', 'video', 'music', 'vision', 'search', 'auth', 'quota', 'config'];
  if (passthroughCommands.includes(subcommand)) {
    try {
      const rest = args.join(' ');
      const { execSync } = await import('child_process');
      execSync(`mmx ${rest}`, { stdio: 'inherit' });
    } catch {
      // mmx itself prints errors
    }
    return;
  }

  console.log(`${c.red}Unknown mmx subcommand: ${subcommand}${c.reset}`);
  printHelp();
}
