/**
 * 🦆 Duck Agent - Slash Command Handler
 * Pattern for handling slash commands with subcommands
 * Based on NVIDIA NemoClaw slash command architecture
 */

import { loadState, saveState } from '../security/state-manager.js';

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
    '**Available Commands:**',
  ];

  for (const cmd of commands.values()) {
    const usage = cmd.usage || `/${cmd.name}`;
    lines.push(`  \`${usage}\` - ${cmd.description}`);
  }

  lines.push(
    '',
    '**Examples:**',
    '  `/duck status` - Check agent status',
    '  `/duck help` - Show this help',
    '  `/duck cost` - Show cost tracking',
  );

  return { text: lines.join('\n') };
}

// ============ Built-in Commands ============

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

export default { registerCommand, getCommands, handleCommand };
