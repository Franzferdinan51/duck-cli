/**
 * 🦆 Duck CLI - MiniMax CLI Integration
 * Wraps the mmx-cli npm package for MiniMax AI Platform access
 */

import { execSync } from 'child_process';

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
};

function checkMmxInstalled(): boolean {
  try {
    execSync('mmx --version', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

export async function mmxCommand(args: string[]): Promise<void> {
  if (!checkMmxInstalled()) {
    console.log(`${c.yellow}mmx-cli not found. Installing globally...${c.reset}`);
    try {
      execSync('npm install -g mmx-cli', { stdio: 'inherit' });
      console.log(`${c.green}✅ mmx-cli installed${c.reset}`);
    } catch (e: any) {
      console.error(`${c.red}Failed to install mmx-cli:${c.reset}`, e.message);
      console.log(`${c.dim}Try installing manually:${c.reset}`);
      console.log(`  npm install -g mmx-cli`);
      return;
    }
  }

  const subcommand = args[0] || '--help';

  if (subcommand === '--help' || subcommand === '-h') {
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
    console.log(`\n${c.dim}All mmx flags are passed through directly.${c.reset}\n`);
    return;
  }

  if (subcommand === 'status') {
    const ok = checkMmxInstalled();
    console.log(ok
      ? `${c.green}✅ mmx-cli installed${c.reset}`
      : `${c.red}❌ mmx-cli NOT installed${c.reset}`);
    try {
      execSync('mmx auth status', { stdio: 'inherit' });
    } catch {
      console.log(`${c.yellow}⚠️  Not authenticated. Run: duck mmx auth login --api-key <key>${c.reset}`);
    }
    return;
  }

  // Pass through directly to mmx
  try {
    const rest = args.join(' ');
    execSync(`mmx ${rest}`, { stdio: 'inherit' });
  } catch {
    // mmx itself prints errors and sets exit code
  }
}
