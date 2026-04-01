/**
 * Duck Agent - Subconscious CLI Command
 * Claude Subconscious-style but WITHOUT Letta
 */

import { getSubconscious } from '../subconscious/index.js';

const c = {
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  reset: '\x1b[0m'
};

export async function subconsciousCommand(args: string[]): Promise<void> {
  const subcommand = args[0] || 'status';
  const subconscious = getSubconscious();

  switch (subcommand) {
    case 'status': {
      const status = await subconscious.getStatus();
      console.log(`\n${c.cyan}🧠 Subconscious Status${c.reset}`);
      console.log(`${c.dim}${'='.repeat(40)}${c.reset}`);
      console.log(`  Enabled: ${status.enabled ? c.green + 'YES' + c.reset : c.red + 'NO' + c.reset}`);
      console.log(`  Memory count: ${status.memoryCount}`);
      if (status.uptime) {
        const seconds = Math.floor(status.uptime / 1000);
        console.log(`  Uptime: ${seconds}s`);
      }
      break;
    }

    case 'stats': {
      const stats = await subconscious.getStats();
      console.log(`\n${c.cyan}📊 Subconscious Statistics${c.reset}`);
      console.log(`${c.dim}${'='.repeat(40)}${c.reset}`);
      console.log(`  Total memories: ${stats.memoryStats.total}`);
      if (stats.memoryStats.oldest) {
        console.log(`  Oldest: ${stats.memoryStats.oldest.toISOString()}`);
      }
      if (stats.memoryStats.newest) {
        console.log(`  Newest: ${stats.memoryStats.newest.toISOString()}`);
      }
      console.log(`  Topic frequencies: ${stats.topicFrequencies.size}`);
      break;
    }

    case 'enable': {
      subconscious.enable();
      console.log(`${c.green}✓${c.reset} Subconscious enabled`);
      break;
    }

    case 'disable': {
      subconscious.disable();
      console.log(`${c.yellow}✓${c.reset} Subconscious disabled`);
      break;
    }

    case 'reset': {
      await subconscious.reset();
      console.log(`${c.green}✓${c.reset} Subconscious reset`);
      break;
    }

    default: {
      console.log(`\n${c.cyan}🧠 Duck Agent Subconscious${c.reset}`);
      console.log(`${c.dim}${'='.repeat(40)}${c.reset}`);
      console.log(`  Claude Subconscious-style (NO Letta)`);
      console.log(`\n${c.yellow}Usage:${c.reset}`);
      console.log(`  ${c.green}duck subconscious status${c.reset}   Show current state`);
      console.log(`  ${c.green}duck subconscious stats${c.reset}    Show statistics`);
      console.log(`  ${c.green}duck subconscious enable${c.reset}   Turn on`);
      console.log(`  ${c.green}duck subconscious disable${c.reset}  Turn off`);
      console.log(`  ${c.green}duck subconscious reset${c.reset}    Reset all data`);
      break;
    }
  }
}
