/**
 * Duck Agent - Subconscious CLI Command
 * Claude Subconscious-style but WITHOUT Letta
 * 
 * Supports:
 * - Local rule-based whispers (no daemon needed)
 * - Daemon mode (duck subconsciousd) for LLM-powered analysis
 */

import { getSubconscious } from '../subconscious/index.js';
import { SubconsciousClient, getSubconsciousClient } from '../subconscious/client.js';

const c = {
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

export async function subconsciousCommand(args: string[]): Promise<void> {
  const subcommand = args[0] || 'status';
  const client = getSubconsciousClient();

  switch (subcommand) {
    case 'daemon': {
      // Start the daemon inline
      const { startDaemon } = await import('../daemons/subconsciousd.js');
      const port = parseInt(args[1]) || parseInt(process.env.SUBCONSCIOUS_PORT || '4001');
      await startDaemon(port);
      return;
    }

    case 'status': {
      // Check daemon first
      const daemonUp = await client.ping().catch(() => false);
      
      console.log(`\n${c.cyan}${c.bold}🧠 Subconscious Status${c.reset}`);
      console.log(`${c.dim}${'─'.repeat(40)}${c.reset}`);
      
      if (daemonUp) {
        const stats = await client.getStats();
        console.log(`  ${c.green}●${c.reset} Daemon: running at ${client.getDaemonUrl()}`);
        console.log(`  ${c.green}●${c.reset} Memories: ${stats.stats.total}`);
        console.log(`  Sources: ${Object.entries(stats.stats.bySource).map(([k,v]) => `${k}:${v}`).join(', ') || 'none'}`);
        if (stats.stats.oldest) {
          console.log(`  Oldest: ${new Date(stats.stats.oldest).toLocaleDateString()}`);
        }
      } else {
        console.log(`  ${c.yellow}○${c.reset} Daemon: not running`);
        console.log(`  ${c.dim}  Run ${c.green}duck subconscious daemon${c.reset} to start${c.dim}`);
      }

      // Local state
      const subconscious = getSubconscious();
      const status = await subconscious.getStatus();
      console.log(`  ${status.enabled ? c.green + '●' + c.reset : c.yellow + '○' + c.reset} Local: ${status.enabled ? 'enabled' : 'disabled'}`);
      console.log(`  Local memories: ${status.memoryCount}`);
      break;
    }

    case 'stats': {
      const daemonUp = await client.ping().catch(() => false);
      
      console.log(`\n${c.cyan}${c.bold}📊 Subconscious Statistics${c.reset}`);
      console.log(`${c.dim}${'─'.repeat(40)}${c.reset}`);
      
      if (daemonUp) {
        const stats = await client.getStats();
        console.log(`  ${c.green}●${c.reset} Daemon memories: ${stats.stats.total}`);
        console.log(`  By source:`);
        for (const [source, count] of Object.entries(stats.stats.bySource)) {
          console.log(`    - ${source}: ${count}`);
        }
        console.log(`  Recent: ${stats.recentMemories}`);
      } else {
        console.log(`  ${c.yellow}○${c.reset} Daemon not running`);
      }
      
      const subconscious = getSubconscious();
      const localStats = await subconscious.getStats();
      console.log(`  ${c.cyan}●${c.reset} Local memories: ${localStats.memoryStats.total}`);
      console.log(`  Topics tracked: ${localStats.topicFrequencies.size}`);
      break;
    }

    case 'whisper': {
      // Get a whisper for a message
      const message = args.slice(1).join(' ') || undefined;
      const daemonUp = await client.ping().catch(() => false);
      
      if (!daemonUp) {
        console.log(`${c.yellow}Daemon not running. Run: duck subconscious daemon${c.reset}`);
        return;
      }

      const whisper = await client.getWhisper(message);
      console.log(`\n${c.cyan}${c.bold}🗣️ Whisper${c.reset}`);
      console.log(`${c.dim}${'─'.repeat(40)}${c.reset}`);
      if (whisper.whisper) {
        console.log(`  ${c.green}${whisper.whisper}${c.reset}`);
      } else {
        console.log(`  ${c.dim}(no whisper generated)${c.reset}`);
      }
      if (whisper.memories.length > 0) {
        console.log(`\n  ${c.bold}Relevant memories:${c.reset}`);
        for (const m of whisper.memories.slice(0, 3)) {
          console.log(`  ${c.dim}- [${m.source}] ${m.content.slice(0, 80)}${c.reset}`);
        }
      }
      break;
    }

    case 'recall': {
      // Recall memories
      const query = args.slice(1).join(' ');
      if (!query) {
        console.log(`${c.yellow}Usage: duck subconscious recall <query>${c.reset}`);
        return;
      }

      const daemonUp = await client.ping().catch(() => false);
      if (!daemonUp) {
        console.log(`${c.yellow}Daemon not running. Run: duck subconscious daemon${c.reset}`);
        return;
      }

      const result = await client.recall(query);
      console.log(`\n${c.cyan}${c.bold}🔍 Recall: "${query}"${c.reset}`);
      console.log(`${c.dim}${'─'.repeat(40)}${c.reset}`);
      console.log(`  Found ${result.count} memories:`);
      for (const m of result.memories.slice(0, 5)) {
        console.log(`  ${c.green}[${m.source}]${c.reset} ${c.dim}${m.content.slice(0, 100)}${c.reset}`);
      }
      break;
    }

    case 'recent': {
      const limit = parseInt(args[1]) || 10;
      const daemonUp = await client.ping().catch(() => false);
      
      if (!daemonUp) {
        console.log(`${c.yellow}Daemon not running.${c.reset}`);
        return;
      }

      const result = await client.getRecent(limit);
      console.log(`\n${c.cyan}${c.bold}📋 Recent Memories${c.reset}`);
      console.log(`${c.dim}${'─'.repeat(40)}${c.reset}`);
      for (const m of result.memories.slice(0, limit)) {
        const date = new Date(m.createdAt).toLocaleDateString();
        console.log(`  ${c.green}[${date}]${c.reset} ${c.dim}${m.content.slice(0, 80)}${c.reset}`);
      }
      break;
    }

    case 'council': {
      // Council memory integration
      const topic = args[1];
      if (!topic) {
        console.log(`${c.yellow}Usage: duck subconscious council <topic>${c.reset}`);
        return;
      }

      const daemonUp = await client.ping().catch(() => false);
      if (!daemonUp) {
        console.log(`${c.yellow}Daemon not running.${c.reset}`);
        return;
      }

      const result = await client.getCouncilMemories(topic);
      console.log(`\n${c.cyan}${c.bold}🏛️ Council Memories: "${topic}"${c.reset}`);
      console.log(`${c.dim}${'─'.repeat(40)}${c.reset}`);
      if (result.memories.length === 0) {
        console.log(`  ${c.dim}No council memories found for this topic.${c.reset}`);
      }
      for (const m of result.memories) {
        console.log(`  ${c.green}[${m.councilor_id}]${c.reset} ${c.dim}${m.insight.slice(0, 100)}${c.reset}`);
      }
      break;
    }

    case 'enable': {
      getSubconscious().enable();
      console.log(`${c.green}✓${c.reset} Subconscious enabled (local mode)`);
      break;
    }

    case 'disable': {
      getSubconscious().disable();
      console.log(`${c.yellow}✓${c.reset} Subconscious disabled`);
      break;
    }

    case 'reset': {
      const daemonUp = await client.ping().catch(() => false);
      if (daemonUp) {
        await client.clear();
        console.log(`${c.green}✓${c.reset} Daemon memories cleared`);
      }
      await getSubconscious().reset();
      console.log(`${c.green}✓${c.reset} Local memory reset`);
      break;
    }

    case 'help': {
      printHelp();
      break;
    }

    default: {
      printHelp();
    }
  }
}

function printHelp(): void {
  console.log(`\n${c.cyan}${c.bold}🧠 Duck Agent Subconscious${c.reset} ${c.dim}(Claude Subconscious-style, NO Letta)${c.reset}`);
  console.log(`${c.dim}${'─'.repeat(40)}${c.reset}`);
  console.log(`  Background agent that watches sessions, accumulates context,`);
  console.log(`  and whispers guidance back — using MiniMax/LM Studio, not Letta.`);
  console.log(`\n${c.bold}Daemon Commands:${c.reset}`);
  console.log(`  ${c.green}duck subconscious daemon${c.reset}  Start background daemon (LLM-powered)`);
  console.log(`  ${c.green}duck subconscious status${c.reset}   Check daemon + local state`);
  console.log(`  ${c.green}duck subconscious stats${c.reset}    Memory statistics`);
  console.log(`  ${c.green}duck subconscious whisper${c.reset}  "msg"  Get whisper for message`);
  console.log(`  ${c.green}duck subconscious recall${c.reset}   "query"  Search memories`);
  console.log(`  ${c.green}duck subconscious recent${c.reset}     [n]  Recent memories`);
  console.log(`  ${c.green}duck subconscious council${c.reset}  "topic"  Council memories`);
  console.log(`  ${c.green}duck subconscious reset${c.reset}     Clear all memories`);
  console.log(`\n${c.bold}Local Commands:${c.reset}`);
  console.log(`  ${c.green}duck subconscious enable${c.reset}   Enable (rule-based whispers)`);
  console.log(`  ${c.green}duck subconscious disable${c.reset}  Disable`);
  console.log(`\n${c.dim}The daemon runs LLM-powered analysis for richer memories.`);
  console.log(`Start it with: ${c.green}duck subconsciousd${c.reset} ${c.dim}or ${c.green}duck subconscious daemon${c.reset}${c.reset}`);
}
