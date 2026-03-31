#!/usr/bin/env node

/**
 * 🦆 Duck Agent CLI
 * Main entry point for the Duck Agent System
 */

import { Agent } from '../agent/core.js';
import * as readline from 'readline';

// Colors
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gold: '\x1b[33m',
};

const logo = `
${colors.gold}${colors.bold}
   ██╗██╗   ██╗██╗ ██████╗████████╗ ██████╗ ██████╗ ██╗   ██╗██╗
   ██║██║   ██║██║██╔════╝╚══██╔══╝██╔═══██╗██╔══██╗╚██╗ ██╔╝██║
   ██║██║   ██║██║██║        ██║   ██║   ██║██████╔╝ ╚████╔╝ ██║
   ██║╚██╗ ██╔╝██║██║        ██║   ██║   ██║██╔══██╗  ╚██╔╝  ╚═╝
   ██║ ╚████╔╝ ██║╚██████╗   ██║   ╚██████╔╝██║  ██║   ██║   ██╗
   ╚═╝  ╚═══╝  ╚═╝ ╚═════╝   ╚═╝    ╚═════╝ ╚═╝  ╚═╝   ╚═╝   ╚═╝
${colors.reset}${colors.cyan}  Agent System${colors.reset}
${colors.dim}v0.1.0 - The Ultimate AI Agent${colors.reset}
`;

async function main() {
  const args = process.argv.slice(2);
  
  // Show help if no args
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    showHelp();
    return;
  }

  const command = args[0];

  switch (command) {
    case 'start':
    case 'run':
      await runAgent(args.slice(1).join(' '));
      break;

    case 'shell':
    case 'chat':
    case 'i':
      await startShell();
      break;

    case 'desktop':
      await desktopCommand(args.slice(1));
      break;

    case 'status':
      await showStatus();
      break;

    case 'memory':
      await memoryCommand(args.slice(1));
      break;

    default:
      // Treat as direct task
      await runAgent(command + ' ' + args.slice(1).join(' '));
  }
}

async function runAgent(task: string) {
  if (!task) {
    console.log(`${colors.red}Error: No task specified${colors.reset}`);
    console.log(`Usage: duck run "your task here"`);
    return;
  }

  console.log(logo);
  console.log(`${colors.cyan}Initializing agent...${colors.reset}\n`);

  const agent = new Agent({ name: 'Duck Agent' });
  await agent.initialize();

  console.log(`\n${colors.yellow}Executing: "${task}"${colors.reset}\n`);

  const result = await agent.execute(task);

  console.log(`\n${colors.green}Result:${colors.reset}`);
  console.log(result);

  await agent.shutdown();
}

async function startShell() {
  console.log(logo);
  console.log(`${colors.green}Starting interactive shell...${colors.reset}`);
  console.log(`${colors.dim}Type /help for commands, /quit to exit${colors.reset}\n`);

  const agent = new Agent({ name: 'Duck Agent' });
  await agent.initialize();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: `${colors.green}🦆>${colors.reset} `
  });

  rl.prompt();

  rl.on('line', async (line) => {
    const input = line.trim();

    if (!input) {
      rl.prompt();
      return;
    }

    // Commands
    if (input.startsWith('/')) {
      const [cmd, ...args] = input.slice(1).split(' ');
      
      switch (cmd.toLowerCase()) {
        case 'quit':
        case 'exit':
        case 'q':
          console.log(`\n${colors.cyan}Goodbye!${colors.reset}`);
          await agent.shutdown();
          rl.close();
          return;

        case 'help':
        case 'h':
          console.log(`
${colors.bold}Commands:${colors.reset}
  /quit, /q     Exit shell
  /status        Show agent status
  /tools         List available tools
  /memory        Show memory stats
  /clear         Clear screen

Or just type what you want me to do!
`);
          break;

        case 'status':
          console.log(JSON.stringify(agent.getStatus(), null, 2));
          break;

        case 'tools':
          console.log('Use the tools directly by describing what you need.');
          break;

        case 'clear':
          console.clear();
          console.log(logo);
          break;

        default:
          console.log(`${colors.red}Unknown command: /${cmd}${colors.reset}`);
      }
    } else {
      // Execute task
      process.stdout.write(`\n${colors.dim}Thinking...${colors.reset}\n`);
      const result = await agent.execute(input);
      console.log(`\n${colors.green}🦆${colors.reset} ${result}\n`);
    }

    rl.prompt();
  });

  rl.on('close', () => {
    process.exit(0);
  });
}

async function showStatus() {
  const agent = new Agent({ name: 'Duck Agent' });
  await agent.initialize();
  console.log(JSON.stringify(agent.getStatus(), null, 2));
  await agent.shutdown();
}

async function desktopCommand(args: string[]) {
  const agent = new Agent({ name: 'Duck Agent' });
  await agent.initialize();

  const action = args[0];

  switch (action) {
    case 'open':
      await agent.openApp(args.slice(1).join(' '));
      break;
    case 'screenshot':
      const img = await agent.screenshot();
      console.log(`Screenshot: ${img}`);
      break;
    default:
      console.log('Desktop commands: open, screenshot');
  }

  await agent.shutdown();
}

async function memoryCommand(args: string[]) {
  const agent = new Agent({ name: 'Duck Agent' });
  await agent.initialize();

  const action = args[0];

  switch (action) {
    case 'add':
      await agent.remember(args.slice(1).join(' '));
      console.log('Remembered!');
      break;
    case 'search':
      const results = await agent.recall(args.slice(1).join(' '));
      console.log('Found:', results);
      break;
    default:
      console.log('Memory commands: add, search');
  }

  await agent.shutdown();
}

function showHelp() {
  console.log(logo);
  console.log(`
${colors.bold}Usage:${colors.reset}
  duck [command] [options]

${colors.bold}Commands:${colors.reset}
  duck run "task"      Execute a task
  duck shell           Start interactive shell
  duck start            Start agent (shorthand for shell)
  duck status           Show agent status
  duck desktop [cmd]    Desktop control
  duck memory [cmd]     Memory management

${colors.bold}Examples:${colors.reset}
  duck run "open safari"
  duck run "fix the auth bug"
  duck shell

${colors.bold}Environment:${colors.reset}
  MINIMAX_API_KEY    MiniMax API key
  LMSTUDIO_URL       LM Studio URL
  ANTHROPIC_API_KEY  Anthropic API key
  OPENAI_API_KEY     OpenAI API key

${colors.dim}See docs/ARCHITECTURE.md for system design${colors.reset}
`);
}

main().catch(e => {
  console.error(`${colors.red}Error:${colors.reset}`, e.message);
  process.exit(1);
});
