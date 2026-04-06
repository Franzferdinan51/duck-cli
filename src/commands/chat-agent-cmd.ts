// @ts-nocheck
/**
 * duck-cli v3 - Chat Agent Command
 * CLI: duck chat-agent start [--port 18797] [--model MiniMax-M2.7]
 */

import { Command } from 'commander';
import { startChatAgent } from '../agent/chat-agent.js';

export function createChatAgentCommand(): Command {
  const chat = new Command('chat-agent')
    .description('🦆 Duck Chat Agent — Conversational AI agent (Bridge ↔ Orchestrator)')
    .passThroughOptions();

  chat
    .command('start')
    .description('Start the Duck Chat Agent HTTP server')
    .option('--port <number>', 'Port to listen on', '18797')
    .option('--model <name>', 'MiniMax model to use', 'MiniMax-M2.7')
    .action(async (options) => {
      const port = parseInt(options.port);
      if (isNaN(port) || port < 1 || port > 65535) {
        console.error(`Invalid port: ${options.port}`);
        process.exit(1);
      }

      // Set model in env for chat-agent to pick up
      if (options.model) {
        process.env.DUCK_CHAT_MODEL = options.model;
      }

      await startChatAgent(port);
    });

  return chat;
}

// CLI entrypoint (when run directly with tsx)
if (require.main === module) {
  const { Command } = require('commander');
  const cmd = new Command();
  cmd
    .name('duck-chat-agent')
    .description('Duck Chat Agent HTTP server')
    .option('--port <number>', 'Port', '18797')
    .option('--model <name>', 'Model', 'MiniMax-M2.7')
    .action(async (opts) => {
      if (opts.model) process.env.DUCK_CHAT_MODEL = opts.model;
      await startChatAgent(parseInt(opts.port));
    });
  cmd.parse(process.argv);
}
