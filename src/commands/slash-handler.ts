/**
 * 🦆 Duck Agent - Slash Command Handler
 * Pattern for handling slash commands with subcommands
 * Based on NVIDIA NemoClaw slash command architecture
 */

import { loadState, saveState } from '../security/state-manager.js';
import { getKAIROS } from '../kairos/orchestrator.js';
import { MemorySystem } from '../kairos/context.js';

export interface CommandContext {
  senderId?: string;
  channel: string;
  isAuthorized: boolean;
  args?: string;
  commandBody: string;
}

export interface CommandResult {
  text?: string;
  mediaUrl?: string;
  mediaUrls?: string[];
  error?: string;
}

export interface CommandDefinition {
  name: string;
  description: string;
  usage?: string;
  handler: (ctx: CommandContext) => CommandResult | Promise<CommandResult>;
}

// Registry of available commands
const commands = new Map<string, CommandDefinition>();

export function registerCommand(cmd: CommandDefinition): void {
  commands.set(cmd.name, cmd);
}

export function getCommands(): CommandDefinition[] {
  return Array.from(commands.values());
}

function parseArgs(input?: string): { subcommand: string; args: string[] } {
  if (!input?.trim()) {
    return { subcommand: '', args: [] };
  }
  const parts = input.trim().split(/\s+/);
  return { subcommand: parts[0] || '', args: parts.slice(1) };
}

export async function handleCommand(ctx: CommandContext): Promise<CommandResult> {
  const { subcommand, args } = parseArgs(ctx.args);
  
  if (!subcommand) {
    return showHelp();
  }

  const cmd = commands.get(subcommand);
  if (!cmd) {
    return {
      text: `Unknown command: ${subcommand}\n\nTry /duck help for available commands.`,
      error: `Command not found: ${subcommand}`,
    };
  }

  try {
    return await cmd.handler({ ...ctx, args: args.join(' ') });
  } catch (e: any) {
    return {
      text: `Error executing ${subcommand}: ${e.message}`,
      error: e.message,
    };
  }
}

function showHelp(): CommandResult {
  const lines = [
    '**🦆 Duck Agent Commands**',
    '',
    'Usage: `/duck <command> [args]`',
    '',
    '**Core Commands:**',
    '  `status` - Check agent status',
    '  `cost` - Show cost tracking',
    '  `tools` - List available tools',
    '  `model` - Show or change AI model',
    '  `help` - Show this help',
    '',
    '**KAIROS (Autonomous AI):**',
    '  `kairos start` - Start autonomous mode',
    '  `kairos stop` - Stop autonomous mode',
    '  `kairos status` - Show KAIROS status',
    '  `kairos history` - Show action history',
    '',
    '**Companion (Buddy):**',
    '  `buddy show` - Show your buddy',
    '  `buddy hatch <name>` - Hatch a new buddy',
    '  `buddy stats` - Show buddy stats',
    '  `buddy preview` - Preview species',
    '',
    '**Team (Multi-Agent):**',
    '  `team create <name>` - Create a team',
    '  `team list` - List available teams',
    '  `team members` - Show team members',
    '  `team spawn` - Spawn team members',
    '',
    '**Cron (Scheduler):**',
    '  `cron list` - List scheduled jobs',
    '  `cron add <job>` - Add a job',
    '  `cron remove <job>` - Remove a job',
    '  `cron run <job>` - Run a job now',
    '',
    '**AI Council:**',
    '  `council start` - Start council deliberation',
    '  `council status` - Show council status',
    '  `council members` - List councilors',
    '',
    '**Examples:**',
    '  `/duck status` - Check agent status',
    '  `/duck kairos status` - Check autonomous mode',
    '  `/duck buddy hatch MyPal` - Hatch a buddy',
    '  `/duck help` - Show this help',
  ];

  return { text: lines.join('\n') };
}

// ============ Core Commands ============

registerCommand({
  name: 'help',
  description: 'Show help and available commands',
  usage: '/duck help',
  handler: () => showHelp(),
});

registerCommand({
  name: 'status',
  description: 'Show Duck Agent status',
  usage: '/duck status',
  handler: () => {
    const state = loadState();
    return {
      text: [
        '**🦆 Duck Agent Status**',
        '',
        `Version: ${state.version || 'unknown'}`,
        `Last action: ${state.lastAction || 'none'}`,
        `Total interactions: ${state.totalInteractions}`,
        `Last model: ${state.lastModel || 'none'}`,
        `Updated: ${state.updatedAt}`,
      ].join('\n'),
    };
  },
});

registerCommand({
  name: 'cost',
  description: 'Show cost tracking summary',
  usage: '/duck cost',
  handler: () => {
    const state = loadState();
    return {
      text: [
        '**💰 Cost Tracking**',
        '',
        `Total interactions: ${state.totalInteractions}`,
        `Session count: ${state.sessionCount}`,
        '',
        'Run `/duck cost detailed` for breakdown by provider.',
      ].join('\n'),
    };
  },
});

registerCommand({
  name: 'tools',
  description: 'List available tools',
  usage: '/duck tools [category]',
  handler: (ctx) => {
    const categories = ['file', 'shell', 'web', 'vision', 'voice', 'memory', 'planning', 'browser', 'coding'];
    const category = ctx.args?.toLowerCase();
    
    if (category && !categories.includes(category)) {
      return {
        text: `Unknown category: ${category}\n\nAvailable: ${categories.join(', ')}`,
      };
    }
    
    return {
      text: [
        '**🛠️ Available Tools**',
        '',
        category ? `Showing: ${category}` : 'All categories',
        '',
        'Run `/duck help` for full tool documentation.',
      ].join('\n'),
    };
  },
});

registerCommand({
  name: 'model',
  description: 'Show or change AI model',
  usage: '/duck model [model-name]',
  handler: (ctx) => {
    const model = ctx.args?.trim();
    if (!model) {
      const state = loadState();
      return {
        text: [
          '**🤖 Current Model**',
          '',
          `Model: ${state.lastModel || 'default'}`,
          `Provider: ${state.lastProvider || 'MiniMax'}`,
          '',
          'Run `/duck model <name>` to change.',
        ].join('\n'),
      };
    }
    
    saveState({ lastModel: model });
    return { text: `✅ Model set to: ${model}` };
  },
});

// ============ KAIROS Commands ============

registerCommand({
  name: 'kairos',
  description: 'KAIROS autonomous AI control',
  usage: '/duck kairos [start|stop|status|history]',
  handler: (ctx) => {
    const kairos = getKAIROS();
    const action = ctx.args?.trim().split(' ')[0] || 'status';
    
    switch (action) {
      case 'start':
        kairos.start();
        return { text: '✅ KAIROS started' };
      
      case 'stop':
        kairos.stop();
        return { text: '✅ KAIROS stopped' };
      
      case 'status':
        const state = kairos.getState();
        const config = kairos.getConfig();
        return {
          text: [
            '**🧠 KAIROS Status**',
            '',
            `Running: ${kairos.isActive() ? '✅ Yes' : '❌ No'}`,
            `Mode: ${config.proactiveMode}`,
            `Idle: ${state.isIdle ? 'Yes' : 'No'}`,
            `Last tick: ${new Date(state.lastTick).toLocaleTimeString()}`,
            '',
            `Idle threshold: ${config.idleThreshold}ms`,
            `Tick interval: ${config.tickInterval}ms`,
          ].join('\n'),
        };
      
      case 'history':
        const history = kairos.getActionHistory().slice(-10);
        const lines = ['**📋 Recent Actions**'];
        for (const action of history) {
          lines.push(`  • ${action.description}`);
        }
        return { text: lines.join('\n') };
      
      default:
        return { text: 'Use: /duck kairos [start|stop|status|history]' };
    }
  },
});

// ============ Buddy Commands ============

registerCommand({
  name: 'buddy',
  description: 'Buddy companion system',
  usage: '/duck buddy [show|hatch|stats]',
  handler: (ctx) => {
    const action = ctx.args?.trim().split(' ')[0] || 'show';
    
    switch (action) {
      case 'show':
        return { text: '🐤 Run `duck buddy show` in terminal to see your buddy!' };
      
      case 'hatch':
        const name = ctx.args?.trim().split(' ').slice(1).join(' ');
        if (!name) {
          return { text: 'Usage: /duck buddy hatch <name>' };
        }
        return { text: "🥚 Hatching " + name + "... Run `duck buddy hatch " + name + "` in terminal!" };
      
      case 'stats':
        return { text: '🐤 Run `duck buddy stats` in terminal to see buddy stats!' };
      
      default:
        return { text: 'Use: /duck buddy [show|hatch|stats]' };
    }
  },
});

// ============ Team Commands ============

registerCommand({
  name: 'team',
  description: 'Multi-agent team management',
  usage: '/duck team [create|list|members|spawn]',
  handler: (ctx) => {
    const action = ctx.args?.trim().split(' ')[0] || 'list';
    
    switch (action) {
      case 'list':
        return {
          text: [
            '**👥 Available Teams**',
            '',
            '  code_review - Security, Performance, Style reviewers',
            '  research - Researcher, Analyst, Writer',
            '  swarm - 3x Implementers for parallel work',
            '',
            'Use: /duck team create <name>',
          ].join('\n'),
        };
      
      case 'create':
        const name = ctx.args?.trim().split(' ').slice(1).join(' ');
        if (!name) {
          return { text: 'Usage: /duck team create <name>' };
        }
        return { text: "👥 Team \"" + name + "\" created! Run `duck team members " + name + "` to see roles." };
      
      default:
        return { text: 'Use: /duck team [list|create|members|spawn]' };
    }
  },
});

// ============ Cron Commands ============

registerCommand({
  name: 'cron',
  description: 'Cron job management',
  usage: '/duck cron [list|add|remove|run]',
  handler: (ctx) => {
    const action = ctx.args?.trim().split(' ')[0] || 'list';
    
    switch (action) {
      case 'list':
        return {
          text: [
            '**⏰ Scheduled Jobs**',
            '',
            'Run `duck cron list` in terminal for full list.',
            '',
            'Categories: sys, grow, crypto, osint, news, weather, home',
          ].join('\n'),
        };
      
      case 'run':
        const job = ctx.args?.trim().split(' ').slice(1).join(' ');
        if (!job) {
          return { text: 'Usage: /duck cron run <job-name>' };
        }
        return { text: `⏰ Running job "${job}"...` };
      
      default:
        return { text: 'Use: /duck cron [list|add|remove|run]' };
    }
  },
});

// ============ Council Commands ============

registerCommand({
  name: 'council',
  description: 'AI Council deliberation',
  usage: '/duck council [start|status|members]',
  handler: (ctx) => {
    const action = ctx.args?.trim().split(' ')[0] || 'status';
    
    switch (action) {
      case 'status':
        return {
          text: [
            '**🏛️ AI Council Status**',
            '',
            'Run `duck council status` in terminal to see council deliberation status.',
          ].join('\n'),
        };
      
      case 'start':
        return { text: '🏛️ Run `duck council start` in terminal to begin deliberation!' };
      
      default:
        return { text: 'Use: /duck council [start|status|members]' };
    }
  },
});

// ============ Memory Commands ============

registerCommand({
  name: 'memory',
  description: 'Memory management',
  usage: '/duck memory [load|show|add]',
  handler: async (ctx) => {
    const action = ctx.args?.trim().split(' ')[0] || 'show';
    
    switch (action) {
      case 'load':
        const mem = new MemorySystem();
        const files = await mem.loadMemoryFiles();
        return {
          text: [
            '**💾 Memory Files**',
            '',
            `Found ${files.length} memory files`,
            '',
            files.slice(0, 5).map(f => `  • ${f.path}`).join('\n'),
          ].join('\n'),
        };
      
      case 'show':
        return { text: 'Run `duck memory show` in terminal to see compiled memory.' };
      
      default:
        return { text: 'Use: /duck memory [load|show]' };
    }
  },
});

export default { registerCommand, getCommands, handleCommand };
