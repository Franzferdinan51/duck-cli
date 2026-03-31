#!/usr/bin/env node

/**
 * 🦆 Duck Agent CLI
 * 
 * Modes:
 *   shell              - Interactive TUI shell
 *   run <task>         - Execute single task
 *   status             - Show agent status
 *   mcp [port]         - Run as MCP server
 *   desktop <cmd>      - Desktop control
 *   memory <cmd>       - Memory management
 */

import { Agent } from '../agent/core.js';
import { MCPServer } from '../server/mcp-server.js';
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
};

const logo = `
${c.gold}${c.bold}
   ██╗██╗   ██╗██╗ ██████╗████████╗ ██████╗ ██████╗ ██╗   ██╗██╗
   ██║██║   ██║██║██╔════╝╚══██╔══╝██╔═══██╗██╔══██╗╚██╗ ██╔╝██║
   ██║██║   ██║██║██║        ██║   ██║   ██║██████╔╝ ╚████╔╝ ██║
   ██║╚██╗ ██╔╝██║██║        ██║   ██║   ██║██╔══██╗  ╚██╔╝  ╚═╝
   ██║ ╚████╔╝ ██║╚██████╗   ██║   ╚██████╔╝██║  ██║   ██║   ██╗
   ╚═╝  ╚═══╝  ╚═╝ ╚═════╝   ╚═╝    ╚═════╝ ╚═╝  ╚═╝   ╚═╝   ╚═╝
${c.reset}${c.cyan}  Agent System${c.reset}
${c.dim}v0.1.0 - Standalone + MCP Mode${c.reset}
`;

async function main() {
  const [command, ...args] = process.argv.slice(2);

  if (!command || command === '--help' || command === '-h') {
    showHelp();
    return;
  }

  switch (command) {
    case 'shell':
    case 'i':
    case 'chat':
      await startShell();
      break;

    case 'run':
    case 'exec':
    case 'execute':
      await runTask(args.join(' '));
      break;

    case 'status':
    case 'info':
      await showStatus();
      break;

    case 'mcp':
    case 'server':
      await startMCP(parseInt(args[0]) || 3848);
      break;

    case 'desktop':
      await desktopCommand(args);
      break;

    case 'memory':
      await memoryCommand(args);
      break;

    case 'think':
      await think(args.join(' '));
      break;

    case 'remember':
      await remember(args.join(' '));
      break;

    case 'recall':
    case 'search':
      await recall(args.join(' '));
      break;

    default:
      // Treat as task
      await runTask(command + ' ' + args.join(' '));
  }
}

async function startShell() {
  console.log(logo);
  console.log(`${c.green}Starting Duck Agent shell...${c.reset}`);
  console.log(`${c.dim}Type /help for commands, /quit to exit${c.reset}\n`);

  const agent = new Agent({ name: 'Duck Agent' });
  await agent.initialize();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: `${c.green}🦆>${c.reset} `
  });

  rl.prompt();

  rl.on('line', async (line) => {
    const input = line.trim();
    if (!input) { rl.prompt(); return; }

    if (input.startsWith('/')) {
      const [cmd, ...cmdArgs] = input.slice(1).split(' ');
      await handleCommand(cmd, cmdArgs, agent, rl);
    } else {
      process.stdout.write(`${c.dim}Thinking...${c.reset}\n`);
      const result = await agent.execute(input);
      console.log(`\n${c.green}🦆${c.reset} ${result}\n`);
    }

    rl.prompt();
  });

  rl.on('close', () => process.exit(0));
}

async function handleCommand(cmd: string, args: string[], agent: Agent, rl: readline.Interface) {
  switch (cmd.toLowerCase()) {
    case 'quit':
    case 'exit':
    case 'q':
      console.log(`\n${c.cyan}Goodbye!${c.reset}`);
      await agent.shutdown();
      rl.close();
      process.exit(0);

    case 'help':
    case 'h':
    case '?':
      console.log(`
${c.bold}Commands:${c.reset}
  /quit, /q          Exit shell
  /status            Show agent status
  /skills            List loaded skills
  /tools             List available tools
  /think <prompt>    Think about something
  /remember <text>   Remember something
  /recall <query>    Search memory
  /clear             Clear screen

${c.bold}Examples:${c.reset}
  /think Why is the sky blue?
  /remember Ryan prefers dark mode
  /recall user preferences
      `);
      break;

    case 'status':
    case 'info':
      console.log(JSON.stringify(agent.getStatus(), null, 2));
      break;

    case 'skills':
      console.log('Skills:', agent.getStatus().skills);
      break;

    case 'tools':
      console.log('Tools: execute, think, remember, recall, desktop, status');
      break;

    case 'think':
      const thought = await agent.think(args.join(' '));
      console.log(`\n${c.cyan}💭${c.reset} ${thought}\n`);
      break;

    case 'remember':
    case 'add':
      await agent.remember(args.join(' '));
      console.log(`${c.green}✓${c.reset} Remembered`);
      break;

    case 'recall':
    case 'search':
    case 'find':
      const results = await agent.recall(args.join(' '));
      console.log(`Found ${results.length} memories:`);
      results.forEach((r, i) => console.log(`  ${i + 1}. ${r}`));
      break;

    case 'clear':
    case 'cls':
      console.clear();
      console.log(logo);
      break;

    default:
      console.log(`${c.red}Unknown command: /${cmd}${c.reset}`);
  }
}

async function runTask(task: string) {
  if (!task) {
    console.log(`${c.red}Error: No task specified${c.reset}`);
    console.log(`Usage: duck run "your task here"`);
    return;
  }

  console.log(logo);
  console.log(`${c.cyan}Executing task...${c.reset}\n`);

  const agent = new Agent({ name: 'Duck Agent' });
  await agent.initialize();

  console.log(`${c.yellow}Task: "${task}"${c.reset}\n`);
  const result = await agent.execute(task);

  console.log(`\n${c.green}Result:${c.reset}`);
  console.log(result);

  await agent.shutdown();
}

async function showStatus() {
  const agent = new Agent({ name: 'Duck Agent' });
  await agent.initialize();
  
  const status = agent.getStatus();
  
  console.log(logo);
  console.log(`${c.bold}Agent Status${c.reset}`);
  console.log(`  Name:     ${status.name}`);
  console.log(`  ID:       ${status.id}`);
  console.log(`  Running:  ${status.running ? c.green + 'Yes' : c.red + 'No'}${c.reset}`);
  console.log(`  Providers: ${status.providers}`);
  console.log(`  Tools:    ${status.tools}`);
  console.log(`  Skills:   ${status.skills}`);
  
  await agent.shutdown();
}

let mcpServer: MCPServer | null = null;

async function startMCP(port: number) {
  console.log(logo);
  console.log(`${c.cyan}Starting MCP Server on port ${port}...${c.reset}\n`);

  mcpServer = new MCPServer(port);
  await mcpServer.start();

  console.log(`${c.green}Server is running!${c.reset}`);
  console.log(`\n${c.bold}Endpoints:${c.reset}`);
  console.log(`  MCP:       POST http://localhost:${port}/mcp`);
  console.log(`  SSE:       GET  http://localhost:${port}/sse`);
  console.log(`  Tools:     GET  http://localhost:${port}/tools`);
  console.log(`  Health:    GET  http://localhost:${port}/health`);
  console.log(`\n${c.dim}Press Ctrl+C to stop${c.reset}`);

  // Keep running
  await new Promise(() => {});
}

async function desktopCommand(args: string[]) {
  const agent = new Agent({ name: 'Duck Agent' });
  await agent.initialize();

  const [action, ...actionArgs] = args;

  switch (action) {
    case 'open':
      await agent.openApp(actionArgs.join(' '));
      console.log(`${c.green}✓${c.reset} Opened: ${actionArgs.join(' ')}`);
      break;
    case 'click':
      await agent.click(parseInt(actionArgs[0]) || 0, parseInt(actionArgs[1]) || 0);
      console.log(`${c.green}✓${c.reset} Clicked`);
      break;
    case 'type':
      await agent.type(actionArgs.join(' '));
      console.log(`${c.green}✓${c.reset} Typed`);
      break;
    case 'screenshot':
      const img = await agent.screenshot();
      console.log(`${c.green}✓${c.reset} Screenshot saved: ${img}`);
      break;
    default:
      console.log('Desktop commands: open <app>, click <x> <y>, type <text>, screenshot');
  }

  await agent.shutdown();
}

async function memoryCommand(args: string[]) {
  const agent = new Agent({ name: 'Duck Agent' });
  await agent.initialize();

  const [action, ...actionArgs] = args;

  switch (action) {
    case 'add':
    case 'remember':
      await agent.remember(actionArgs.join(' '));
      console.log(`${c.green}✓${c.reset} Remembered`);
      break;
    case 'search':
    case 'recall':
      const results = await agent.recall(actionArgs.join(' '));
      console.log(`Found ${results.length} memories:`);
      results.forEach((r, i) => console.log(`  ${i + 1}. ${r}`));
      break;
    default:
      console.log('Memory commands: add <text>, search <query>');
  }

  await agent.shutdown();
}

async function think(prompt: string) {
  if (!prompt) {
    console.log(`${c.red}Error: No prompt specified${c.reset}`);
    return;
  }

  const agent = new Agent({ name: 'Duck Agent' });
  await agent.initialize();

  const result = await agent.think(prompt);
  console.log(`\n${c.cyan}💭 ${prompt}${c.reset}\n`);
  console.log(result);

  await agent.shutdown();
}

async function remember(content: string) {
  if (!content) {
    console.log(`${c.red}Error: No content specified${c.reset}`);
    return;
  }

  const agent = new Agent({ name: 'Duck Agent' });
  await agent.initialize();

  await agent.remember(content);
  console.log(`${c.green}✓${c.reset} Remembered: "${content}"`);

  await agent.shutdown();
}

async function recall(query: string) {
  if (!query) {
    console.log(`${c.red}Error: No query specified${c.reset}`);
    return;
  }

  const agent = new Agent({ name: 'Duck Agent' });
  await agent.initialize();

  const results = await agent.recall(query);
  console.log(`\n${c.cyan}🔍 Search: "${query}"${c.reset}\n`);
  console.log(`Found ${results.length} results:`);
  results.forEach((r, i) => console.log(`  ${i + 1}. ${r}`));

  await agent.shutdown();
}

function showHelp() {
  console.log(logo);
  console.log(`
${c.bold}Usage:${c.reset}
  duck [command] [options]

${c.bold}Commands:${c.reset}
  ${c.green}shell${c.reset}           Start interactive TUI shell
  ${c.green}run <task>${c.reset}      Execute a single task
  ${c.green}mcp [port]${c.reset}       Start MCP server (default: 3848)
  ${c.green}status${c.reset}           Show agent status
  ${c.green}think <prompt>${c.reset}   Think about something
  ${c.green}remember <text>${c.reset}   Remember something
  ${c.green}recall <query>${c.reset}    Search memory
  ${c.green}desktop <cmd>${c.reset}    Desktop control
  ${c.green}memory <cmd>${c.reset}     Memory management

${c.bold}Examples:${c.reset}
  duck shell                      # Interactive mode
  duck run "open Safari"          # Single task
  duck mcp                        # MCP server on port 3848
  duck mcp 4000                   # MCP server on port 4000
  duck think "Why is sky blue?"   # Think
  duck remember "I like pizza"    # Remember
  duck recall "food preferences"  # Search memory

${c.bold}As MCP Server:${c.reset}
  POST /mcp    - MCP protocol JSON-RPC
  GET  /sse    - Server-Sent Events
  GET  /tools  - List available tools
  GET  /health - Health check

${c.bold}Environment Variables:${c.reset}
  MINIMAX_API_KEY    MiniMax API key
  ANTHROPIC_API_KEY  Anthropic API key
  OPENAI_API_KEY     OpenAI API key
  LMSTUDIO_URL       LM Studio URL
`);
}

main().catch(e => {
  console.error(`${c.red}Error:${c.reset}`, e.message);
  process.exit(1);
});
