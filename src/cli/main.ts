#!/usr/bin/env node

/**
 * 🦆 Duck Agent CLI
 * Full-featured AI agent with TUI shell
 */

import { Agent } from '../agent/core.js';
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
  magenta: '\x1b[35m',
};

const logo = `
${c.gold}${c.bold}
   ██╗██╗   ██╗██╗ ██████╗████████╗ ██████╗ ██████╗ ██╗   ██╗██╗
   ██║██║   ██║██║██╔════╝╚══██╔══╝██╔═══██╗██╔══██╗╚██╗ ██╔╝██║
   ██║██║   ██║██║██║        ██║   ██║   ██║██████╔╝ ╚████╔╝ ██║
   ██║╚██╗ ██╔╝██║██║        ██║   ██║   ██║██╔══██╗  ╚██╔╝  ╚═╝
   ██║ ╚████╔╝ ██║╚██████╗   ██║   ╚██████╔╝██║  ██║   ██║   ██╗
   ╚═╝  ╚═══╝  ╚═╝ ╚═════╝   ╚═╝    ╚═════╝ ╚═╝  ╚═╝   ╚═╝   ╚═╝
${c.reset}${c.cyan}  ${c.bold}AI Agent${c.reset} ${c.dim}v0.3.0 - Super Agent${c.reset}
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
    case 'interactive':
      await startShell();
      break;

    case 'run':
    case 'exec':
    case 'execute':
      await runTask(args.join(' '));
      break;

    case 'think':
      await think(args.join(' '));
      break;

    case 'speak':
    case 'voice':
    case 'tts':
      const [cmd, ...voiceArgs] = args.join(' ').split('|');
      await speak(cmd, voiceArgs[0]?.trim());
      break;

    case 'think-speak':
    case 'thinkandspk':
      await thinkAndSpeak(args.join(' '));
      break;

    case 'status':
    case 'info':
      await showStatus();
      break;

    case 'mcp':
    case 'server':
      await startMCP(parseInt(args[0]) || 3848);
      break;

    case 'web':
    case 'ui':
      await startWebUI();
      break;

    case 'tools':
      await listTools();
      break;

    case 'history':
      await showHistory();
      break;

    case 'clear':
      await clearHistory();
      break;

    case 'telegram':
    case 'discord':
    case 'channels':
      await startChannels(args);
      break;
    case 'update':
      await updateCommand(args);
      break;


    case 'send':
    case 'sendto':
      await sendToChannel(args);
      break;

    case 'desktop':
      await desktopCommand(args);
      break;

    case 'memory':
      await memoryCommand(args);
      break;

    default:
      await runTask(command + ' ' + args.join(' '));
  }
}

// ============ SHELL MODE ============

async function startShell() {
  console.log(logo);
  console.log(`${c.green}Starting Duck Agent shell...${c.reset}`);
  console.log(`${c.dim}Type /help for commands, /quit to exit${c.reset}\n`);

  const agent = new Agent({ name: 'Duck Agent',  });
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
      process.stdout.write(`\n${c.dim}Thinking...${c.reset}\n`);
      try {
        const result = await agent.chat(input);
        console.log(`\n${c.cyan}🤖${c.reset} ${formatResponse(result)}\n`);
      } catch (e: any) {
        console.log(`\n${c.red}Error:${c.reset} ${e.message}\n`);
      }
    }

    rl.prompt();
  });

  rl.on('close', async () => {
    await agent.shutdown();
    process.exit(0);
  });
}

async function handleCommand(cmd: string, args: string[], agent: Agent, rl: any) {
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
  /history           Show conversation history
  /clear             Clear history
  /tools             List available tools
  /think <prompt>    Think about something
  /remember <text>   Remember something
  /recall <query>    Search memory
  /model <name>      Switch model
  /clear             Clear screen

${c.bold}Just type${c.reset} what you want me to help with!
      `);
      break;

    case 'status':
      console.log(JSON.stringify(agent.getStatus(), null, 2));
      break;

    case 'history':
      const hist = agent.getHistory();
      console.log(`\n${c.bold}Conversation History (${hist.length} messages)${c.reset}`);
      hist.forEach((m, i) => {
        const role = m.role === 'user' ? `${c.green}You${c.reset}` : `${c.cyan}Agent${c.reset}`;
        const preview = m.content.substring(0, 100) + (m.content.length > 100 ? '...' : '');
        console.log(`  ${i + 1}. [${role}] ${preview}`);
      });
      console.log();
      break;

    case 'clear':
      agent.clearHistory();
      console.log(`${c.green}✓${c.reset} History cleared`);
      break;

    case 'tools':
      console.log(`\n${c.bold}Available Tools:${c.reset}`);
      const tools = agent.getStatus().toolList;
      console.log(JSON.stringify(tools, null, 2));
      console.log();
      break;

    case 'think':
      const thought = await agent.think(args.join(' '));
      console.log(`\n${c.magenta}💭${c.reset} ${thought}\n`);
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

    case 'model':
      console.log(`Model switching: ${c.yellow}${args[0]}${c.reset} (not yet implemented)`);
      break;

    case 'clear':
      if (args[0] === 'screen' || !args[0]) {
        console.clear();
        console.log(logo);
      }
      break;

    default:
      console.log(`${c.red}Unknown command: /${cmd}${c.reset}`);
  }
}

function formatResponse(text: string): string {
  // Clean up response formatting
  return text
    .replace(/\[TOOL:.*?\]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ============ SINGLE TASK MODE ============

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
  
  try {
    const result = await agent.chat(task);
    console.log(`\n${c.green}Result:${c.reset}`);
    console.log(formatResponse(result));
  } catch (e: any) {
    console.log(`\n${c.red}Error:${c.reset} ${e.message}`);
  }

  await agent.shutdown();
}

// ============ THINK MODE ============

async function think(prompt: string) {
  if (!prompt) {
    console.log(`${c.red}Error: No prompt specified${c.reset}`);
    return;
  }

  const agent = new Agent({ name: 'Duck Agent' });
  await agent.initialize();

  const result = await agent.think(prompt);
  console.log(`\n${c.magenta}💭 ${prompt}${c.reset}\n`);
  console.log(result);

  await agent.shutdown();
}

// ============ SPEAK/TTS MODE ============

async function speak(text: string, voice?: string) {
  if (!text || text.trim() === '') {
    console.log(`${c.red}Error: No text specified${c.reset}`);
    console.log(`Usage: duck speak "Hello world" [voice]`);
    console.log(`Voices: narrator, casual, sad`);
    console.log(`Example: duck speak "Hello!" casual`);
    return;
  }

  const apiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey) {
    console.log(`${c.red}Error: MINIMAX_API_KEY not set${c.reset}`);
    console.log(`Set it with: export MINIMAX_API_KEY="your-key"`);
    return;
  }

  console.log(`${c.cyan}🎤 Generating speech...${c.reset}`);
  console.log(`Text: ${text.substring(0, 50)}${text.length > 50 ? '...' : ''}`);
  if (voice) console.log(`Voice: ${voice}`);
  
  try {
    const { TTSService } = await import('../tools/tts.js');
    const tts = new TTSService({ apiKey });
    
    if (voice) tts.setVoice(voice);
    
    const result = await tts.speak({ text, outputPath: './duck_tts.mp3' });
    
    if (result.success) {
      console.log(`\n${c.green}✅ Speech generated!${c.reset}`);
      console.log(`File: ./duck_tts.mp3`);
      console.log(`Chars: ${result.chars} | Remaining: ${tts.getRemainingQuota()}`);
      
      // Auto-play on macOS
      try {
        const { execSync } = await import('child_process');
        execSync('afplay ./duck_tts.mp3 &', { stdio: 'ignore' });
        console.log(`${c.cyan}🔊 Playing...${c.reset}`);
      } catch {
        // afplay not available
      }
    } else {
      console.log(`${c.red}❌ Error: ${result.error}${c.reset}`);
    }
  } catch (err) {
    console.log(`${c.red}❌ TTS Error: ${err}${c.reset}`);
  }
}

// ============ THINK + SPEAK MODE ============

async function thinkAndSpeak(prompt: string) {
  if (!prompt) {
    console.log(`${c.red}Error: No prompt specified${c.reset}`);
    return;
  }

  const apiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey) {
    console.log(`${c.red}Error: MINIMAX_API_KEY not set${c.reset}`);
    return;
  }

  const agent = new Agent({ name: 'Duck Agent' });
  await agent.initialize();

  console.log(`${c.magenta}💭 Thinking...${c.reset}`);
  const response = await agent.think(prompt);
  console.log(`${c.cyan}🤖 Response ready, generating speech...${c.reset}`);
  
  await agent.shutdown();

  try {
    const { TTSService } = await import('../tools/tts.js');
    const tts = new TTSService({ apiKey });
    
    // Truncate if too long for TTS
    const ttsText = response.length > 500 ? response.substring(0, 500) + "... (truncated)" : response;
    
    const result = await tts.speak({ text: ttsText, outputPath: './duck_think_speak.mp3' });
    
    if (result.success) {
      console.log(`\n${c.green}✅ Audio ready!${c.reset}`);
      try {
        const { execSync } = await import('child_process');
        execSync('afplay ./duck_think_speak.mp3 &', { stdio: 'ignore' });
      } catch {}
    }
  } catch (err) {
    console.log(`${c.red}TTS Error: ${err}${c.reset}`);
  }
}

// ============ STATUS ============

async function showStatus() {
  const agent = new Agent({ name: 'Duck Agent' });
  await agent.initialize();
  
  const status = agent.getStatus();
  
  console.log(logo);
  console.log(`${c.bold}Agent Status${c.reset}`);
  console.log(`  ${c.cyan}Name:${c.reset}       ${status.name}`);
  console.log(`  ${c.cyan}ID:${c.reset}         ${status.id}`);
  console.log(`  ${c.cyan}Providers:${c.reset}   ${status.providers}`);
  console.log(`  ${c.cyan}Tools:${c.reset}       ${status.tools}`);
  console.log(`  ${c.cyan}Skills:${c.reset}      ${status.skills}`);
  console.log(`  ${c.cyan}History:${c.reset}     ${status.historyLength} messages`);
  
  await agent.shutdown();
}

// ============ TOOLS LIST ============

async function listTools() {
  const agent = new Agent({ name: 'Duck Agent' });
  await agent.initialize();
  
  console.log(`\n${c.bold}Available Tools:${c.reset}\n`);
  
  const tools = agent.getStatus().toolList as any[];
  for (const tool of tools) {
    const dangerous = tool.dangerous ? ` ${c.red}[DANGEROUS]${c.reset}` : '';
    console.log(`  ${c.cyan}${tool.name}${c.reset} - ${tool.description}${dangerous}`);
  }
  
  console.log();
  await agent.shutdown();
}

// ============ HISTORY ============

async function showHistory() {
  const agent = new Agent({ name: 'Duck Agent' });
  await agent.initialize();
  
  const history = agent.getHistory();
  console.log(`\n${c.bold}Conversation History${c.reset}\n`);
  
  for (const msg of history) {
    const role = msg.role === 'user' ? `${c.green}You${c.reset}` : `${c.cyan}Agent${c.reset}`;
    console.log(`[${role}] ${msg.content.substring(0, 200)}`);
    console.log();
  }
  
  await agent.shutdown();
}

async function clearHistory() {
  const agent = new Agent({ name: 'Duck Agent' });
  await agent.initialize();
  agent.clearHistory();
  console.log(`${c.green}✓${c.reset} History cleared`);
  await agent.shutdown();
}

// ============ MCP SERVER ============

async function startMCP(port: number) {
  console.log(logo);
  console.log(`${c.cyan}Starting MCP Server on port ${port}...${c.reset}\n`);
  
  const { MCPServer } = await import('../server/mcp-server.js');
  const server = new MCPServer(port);
  await server.start();
  
  console.log(`${c.green}Server is running!${c.reset}`);
  console.log(`\n${c.bold}Endpoints:${c.reset}`);
  console.log(`  MCP:       POST http://localhost:${port}/mcp`);
  console.log(`  Tools:     GET  http://localhost:${port}/tools`);
  console.log(`  Health:    GET  http://localhost:${port}/health`);
  console.log(`\n${c.dim}Press Ctrl+C to stop${c.reset}`);

  await new Promise(() => {});
}

// ============ WEB UI ============

async function startWebUI() {
  const port = parseInt(process.env.WEB_PORT || '3000');
  console.log(logo);
  console.log(`${c.cyan}Starting Duck Agent Web UI on port ${port}...${c.reset}\n`);
  
  const { createServer } = await import('http');
  const { readFileSync, existsSync } = await import('fs');
  const { join, extname } = await import('path');
  const { Agent } = await import('../agent/core.js');
  
  // Initialize agent
  const agent = new Agent({ name: 'DuckWebAgent' });
  await agent.initialize();
  
  const WEB_UI_PATH = join(process.cwd(), 'web-ui');
  
  const MIME_TYPES: Record<string, string> = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
  };
  
  const server = createServer(async (req: any, res: any) => {
    const url = new URL(req.url, `http://localhost:${port}`);
    const path = url.pathname;
    
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }
    
    try {
      // API Routes
      if (path === '/api/status') {
        const status = agent.getStatus();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ...status, uptime: Date.now() }));
        return;
      }
      
      if (path === '/api/chat') {
        let body = '';
        req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
        req.on('end', async () => {
          const { message } = JSON.parse(body);
          const response = await agent.think(message);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ response }));
        });
        return;
      }
      
      if (path === '/api/tools') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ tools: agent.getStatus().toolList }));
        return;
      }
      
      // Static files
      let filePath = path === '/' ? '/index.html' : path;
      filePath = join(WEB_UI_PATH, filePath);
      
      if (!filePath.startsWith(WEB_UI_PATH)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }
      
      if (existsSync(filePath)) {
        const ext = extname(filePath);
        const mime = MIME_TYPES[ext] || 'application/octet-stream';
        const content = readFileSync(filePath);
        res.writeHead(200, { 'Content-Type': mime });
        res.end(content);
      } else {
        const indexPath = join(WEB_UI_PATH, 'index.html');
        if (existsSync(indexPath)) {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(readFileSync(indexPath));
        } else {
          res.writeHead(404);
          res.end('Web UI not found. Run: duck web');
        }
      }
    } catch (error) {
      res.writeHead(500);
      res.end('Error');
    }
  });
  
  server.listen(port, () => {
    console.log(`${c.green}✅ Duck Agent Web UI running!${c.reset}`);
    console.log(`\n  🌐 http://localhost:${port}`);
    console.log(`\n${c.dim}Press Ctrl+C to stop${c.reset}\n`);
  });
}

// ============ DESKTOP ============

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
      console.log(`${c.green}✓${c.reset} Screenshot: ${img}`);
      break;
    default:
      console.log('Desktop commands: open <app>, click <x> <y>, type <text>, screenshot');
  }

  await agent.shutdown();
}

// ============ MEMORY ============

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
      console.log(`Found ${results.length}:`);
      results.forEach((r, i) => console.log(`  ${i + 1}. ${r}`));
      break;
    default:
      console.log('Memory: add <text>, search <query>');
  }

  await agent.shutdown();
}

// ============ HELP ============

function showHelp() {
  console.log(logo);
  console.log(`
${c.bold}Usage:${c.reset}
  duck [command] [options]

${c.bold}Commands:${c.reset}
  ${c.green}shell${c.reset}           Start interactive TUI shell
  ${c.green}run <task>${c.reset}      Execute a single task
  ${c.green}think <prompt>${c.reset}   Think about something
  ${c.green}status${c.reset}           Show agent status
  ${c.green}tools${c.reset}           List available tools
  ${c.green}history${c.reset}         Show conversation history
  ${c.green}mcp [port]${c.reset}       Start MCP server (default: 3848)
  ${c.green}memory${c.reset}           Memory commands
  ${c.green}channels${c.reset}          Start Telegram/Discord channels
  ${c.green}send <ch> <id> <msg>${c.reset}  Send message to channel
  ${c.green}desktop${c.reset}          Desktop control

${c.bold}Examples:${c.reset}
  duck shell                      # Interactive mode
  duck run "open Safari"         # Single task
  duck think "Why is sky blue?"   # Reasoning
  duck tools                     # List tools
  duck mcp                       # MCP server

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

// ============ TELEGRAM & DISCORD ============

async function startChannels(args: string[]) {
  const configFile = args[0] || './channels.json';
  
  console.log(logo);
  console.log(`${c.cyan}Starting Duck Agent with channels...${c.reset}\n`);

  // Load config
  let config: any = {};
  try {
    const { readFile } = await import('fs/promises');
    const content = await readFile(configFile, 'utf-8');
    config = JSON.parse(content);
  } catch (e) {
    console.log(`${c.yellow}No config file found at ${configFile}${c.reset}`);
    console.log(`\n${c.bold}To enable channels, create a ${configFile} with:${c.reset}`);
    console.log(`
{
  "telegram": {
    "botToken": "YOUR_TELEGRAM_BOT_TOKEN",
    "allowedUsers": [123456789]
  },
  "discord": {
    "botToken": "YOUR_DISCORD_BOT_TOKEN",
    "applicationId": "123456789",
    "allowedRoles": ["Admin", "Moderator"]
  }
}
`);
    return;
  }

  const agent = new Agent({ name: 'Duck Agent' });
  await agent.initialize();

  const { ChannelManager } = await import('../channels/manager.js');
  const manager = new ChannelManager(agent);
  
  await manager.start(config);

  console.log(`\n${c.green}✅ Channels started!${c.reset}`);
  console.log(`   Active: ${manager.listChannels().join(', ')}`);
  console.log(`\n${c.dim}Press Ctrl+C to stop${c.reset}`);

  // Handle shutdown
  process.on('SIGINT', async () => {
    console.log('\n\n🦆 Shutting down...');
    manager.stop();
    await agent.shutdown();
    process.exit(0);
  });

  // Keep running
  await new Promise(() => {});
}

// ============ SEND MESSAGE ============

async function sendToChannel(args: string[]) {
  const [channel, chatId, ...messageParts] = args;
  const message = messageParts.join(' ');

  if (!channel || !chatId || !message) {
    console.log(`${c.red}Usage: duck send <telegram|discord> <chatId> <message>${c.reset}`);
    return;
  }

  const agent = new Agent({ name: 'Duck Agent' });
  await agent.initialize();

  const { ChannelManager } = await import('../channels/manager.js');
  const manager = new ChannelManager(new Agent({ name: 'Temp' }));

  try {
    await manager.sendTo(channel, chatId, message);
    console.log(`${c.green}✅ Message sent to ${channel}${c.reset}`);
  } catch (e: any) {
    console.error(`${c.red}❌ Failed: ${e.message}${c.reset}`);
  }

  await agent.shutdown();
}

// ============ UPDATE ============

async function updateCommand(args: string[]) {
  const { createUpdateCommand } = await import('../commands/update-cli.js');
  const { Command } = await import('commander');
  
  const update = createUpdateCommand();
  update.parse(['node', 'duck', ...args]);
}

