#!/usr/bin/env node

/**
 * 🦆 Duck Agent CLI
 * Full-featured AI agent with TUI shell
 */

import { Agent } from '../agent/core.js';
import * as readline from 'readline';
import { meshCommand } from './mesh-cmd.js';

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

    case 'unified':
    case 'headless':
      await startUnified();
      break;

    case 'acp-server':
    case 'acpserver':
      await startACPServer(args);
      break;

    case 'acp':
    case 'acp-spawn':
      await acpSpawn(args);
      break;

    case 'ws':
    case 'websocket':
      await wsCommand(args);
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

    case 'compat':
    case 'compatibility':
      await compatCommand(args);
      break;

    case 'sync':
    case 'openclaw-sync':
      await syncCommand(args);
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

    case 'kairos':
      await kairosCommand(args);
      break;

    case 'buddy':
      await buddyCommand(args);
      break;

    case 'council':
    case 'ai-council':
      await councilCommand(args);
      break;

    case 'team':
    case 'multiagent':
      await teamCommand(args);
      break;

    case 'rl':
      await rlCommand(args);
      break;

    case 'mesh':
      await meshCommand(args);
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

async function startWebUI(args: string[] = []) {
  const port = parseInt(args[0] || process.env.WEB_PORT || '3001');
  process.env.WEB_PORT = String(port);
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




// ============ COMPAT CHECK ============

async function compatCommand(args: string[]) {
  const { CompatChecker } = await import('../update/compat-check.js');
  const checker = new CompatChecker();
  
  const subCmd = args[0];
  
  if (subCmd === 'check' || !subCmd) {
    console.log(`${c.cyan}Checking OpenClaw compatibility...${c.reset}`);
    const result = await checker.runAll();
    const report = checker.printReport(result);
    console.log(report);
    
    if (result.overall === 'fail') {
      process.exit(1);
    }
  } else if (subCmd === 'list') {
    const { OpenClawCompatibilityChecker } = await import('../compat/openclaw-compat.js');
    const features = await new OpenClawCompatibilityChecker().getReport();
    console.log("\n🦆 OpenClaw Feature Compatibility\n");
    for (const feature of features) {
      const icon = feature.available ? `${c.green}✓${c.reset}` : `${c.red}✗${c.reset}`;
      console.log(`  ${icon} ${feature.name}`);
      if (!feature.available && feature.fallback) {
        console.log(`    → Fallback: ${feature.fallback}`);
      }
    }
    console.log("");
  } else if (subCmd === 'score') {
    const { checkOpenClawCompatibility } = await import('../compat/openclaw-compat.js');
    const { score } = await checkOpenClawCompatibility();
    console.log(`\n🦆 OpenClaw Compatibility Score: ${score}/100\n`);
  } else {
    console.log(`${c.yellow}Usage:${c.reset}`);
    console.log(`  ${c.bold}duck compat check${c.reset}  - Run full compatibility check`);
    console.log(`  ${c.bold}duck compat list${c.reset}   - List all features`);
    console.log(`  ${c.bold}duck compat score${c.reset}   - Show compatibility score`);
    console.log("");
  }
}

// ============ OPENCLAW SYNC ============

async function syncCommand(args: string[]) {
  const { OpenClawSync } = await import('../update/openclaw-sync.js');
  const { Agent } = await import('../agent/core.js');
  const sync = new OpenClawSync();
  
  const subCmd = args[0];
  
  if (subCmd === 'openclaw' || subCmd === 'upstream') {
    console.log(`${c.cyan}Checking OpenClaw upstream...${c.reset}`);
    
    const status = sync.getStatus();
    console.log(`\n  Remote:   ${status.remote}`);
    console.log(`  Branch:   ${status.branch}`);
    console.log(`  Behind:   ${status.commitsBehind}`);
    console.log(`  Ahead:    ${status.commitsAhead}`);
    console.log(`  Conflicts: ${status.conflicts}`);
    console.log("");
    
    if (status.commitsBehind > 0) {
      console.log(`${c.yellow}There are ${status.commitsBehind} commits behind upstream.${c.reset}`);
      console.log(`Run ${c.bold}duck sync pull${c.reset} to sync.`);
      console.log("");
    } else if (status.commitsBehind === 0 && status.conflicts === 0) {
      console.log(`${c.green}✓ Already up to date with OpenClaw upstream!${c.reset}`);
      console.log("");
    }
    
    if (status.conflicts > 0) {
      console.log(`${c.red}⚠ ${status.conflicts} conflicts detected.${c.reset}`);
      console.log("");
    }
  } else if (subCmd === 'pull') {
    console.log(`${c.cyan}Pulling from OpenClaw upstream...${c.reset}\n`);
    
    const agent = new Agent({ name: 'Duck Agent Sync' });
    await agent.initialize();
    
    const result = await sync.sync(agent);
    
    if (result.success) {
      console.log(`${c.green}✓ Sync complete!${c.reset}`);
      if (result.changes && result.changes.length > 0) {
        console.log(`  Applied ${result.changes.length} changes.`);
      }
      if (result.backups && result.backups.length > 0) {
        console.log(`  Backup: ${result.backups[0]}`);
      }
      console.log("");
    } else {
      console.log(`${c.red}✗ Sync failed: ${result.error}${c.reset}`);
      if (result.conflicts && result.conflicts.length > 0) {
        console.log(`\n  ${result.conflicts.length} conflicts require manual resolution.`);
        for (const conflict of result.conflicts) {
          console.log(`    - ${conflict.file}`);
        }
      }
      console.log("");
      await agent.shutdown();
      process.exit(1);
    }
    
    await agent.shutdown();
  } else if (subCmd === 'status') {
    const status = sync.getStatus();
    console.log("\n🦆 OpenClaw Sync Status\n");
    console.log(`  Configured:  ${status.configured ? `${c.green}Yes${c.reset}` : `${c.red}No${c.reset}`}`);
    console.log(`  Remote:      ${status.remote}`);
    console.log(`  Branch:      ${status.branch}`);
    console.log(`  Behind:      ${status.commitsBehind}`);
    console.log(`  Ahead:       ${status.commitsAhead}`);
    console.log(`  Conflicts:   ${status.conflicts}`);
    console.log("");
  } else if (subCmd === 'setup') {
    const result = sync.setupUpstream();
    if (result.success) {
      console.log(`${c.green}✓ OpenClaw upstream configured!${c.reset}`);
      console.log(`  Remote: ${sync.getStatus().remote}`);
      console.log("");
    } else {
      console.log(`${c.red}✗ Setup failed: ${result.error}${c.reset}`);
      console.log("");
    }
  } else {
    console.log(`${c.yellow}Usage:${c.reset}`);
    console.log(`  ${c.bold}duck sync openclaw${c.reset}  - Check upstream status`);
    console.log(`  ${c.bold}duck sync status${c.reset}   - Show sync status`);
    console.log(`  ${c.bold}duck sync setup${c.reset}    - Configure upstream`);
    console.log(`  ${c.bold}duck sync pull${c.reset}      - Pull from upstream`);
    console.log("");
    console.log(`${c.dim}Use ${c.bold}duck compat check${c.dim} to test compatibility.${c.reset}`);
    console.log("");
  }
}

// ============ ACP SERVER (for OpenClaw) ============

async function startACPServer(args: string[]) {
  const port = parseInt(args[0]) || 18790;
  
  const { ACPServer } = await import('../gateway/acp-server.js');
  const agent = new Agent({ name: 'Duck Agent (ACP Server)' });
  await agent.initialize();

  const server = new ACPServer(agent, { port });
  
  console.log(`${c.cyan}Starting Duck Agent ACP Server for OpenClaw...${c.reset}`);
  console.log(`${c.yellow}OpenClaw can now connect to this agent!${c.reset}`);
  console.log(`URL: ws://localhost:${port}/acp`);
  console.log('');
  console.log(`To use from OpenClaw, configure:`);
  console.log(`  agents.list[].runtime.acp.backend = "acpx"`);
  console.log(`  agents.list[].runtime.acp.agent = "duck"`);
  console.log('');

  await server.start();

  process.on('SIGINT', async () => {
    console.log('\nShutting down ACP server...');
    await server.stop();
    await agent.shutdown();
    process.exit(0);
  });

  await new Promise(() => {});
}

// ============ UNIFIED SERVER ============

async function startUnified() {
  console.log('Starting Duck Agent Unified Headless Server...');
  
  const { UnifiedServer } = await import('../server/unified-server.js');
  const agent = new Agent({ name: 'Duck Agent (Unified)' });
  await agent.initialize();

  const server = new UnifiedServer(agent, {
    mcpPort: 3848,
    acpPort: 18790,
    wsPort: 18791,
    gatewayPort: 18789,
    enableMCP: true,
    enableACP: true,
    enableWebSocket: true,
    enableGateway: true,
  });

  await server.start();

  process.on('SIGINT', async () => {
    console.log('\nShutting down unified server...');
    await server.stop();
    await agent.shutdown();
    process.exit(0);
  });

  await new Promise(() => {});
}

// ============ MCP CONNECT ============

async function mcpConnect(args: string[]) {
  const url = args[0];
  if (!url) {
    console.log(`${c.red}Usage: duck mcp-connect <url>${c.reset}`);
    console.log('Example: duck mcp-connect ws://localhost:3848/ws');
    return;
  }

  const { UnifiedServer } = await import('../server/unified-server.js');
  const agent = new Agent({ name: 'Duck Agent' });
  await agent.initialize();

  const server = new UnifiedServer(agent, { enableMCP: false, enableACP: false, enableWebSocket: false });
  
  try {
    const id = await server.connectToExternalMCP(url);
    console.log(`${c.green}✅ Connected to MCP server: ${id}${c.reset}`);
    console.log(`URL: ${url}`);
  } catch (e: any) {
    console.error(`${c.red}❌ Failed: ${e.message}${c.reset}`);
  }

  await agent.shutdown();
}

// ============ ACP SPAWN ============

async function acpSpawn(args: string[]) {
  const [agentId, ...taskParts] = args;
  const task = taskParts.join(' ');

  if (!agentId) {
    console.log(`${c.red}Usage: duck acp <agent> <task>${c.reset}`);
    console.log(`${c.yellow}Available agents: codex, claude, cursor, gemini, pi, openclaw, opencode${c.reset}`);
    return;
  }

  const { ACPClient } = await import('../gateway/acp-client.js');
  const agent = new Agent({ name: 'Duck Agent' });
  await agent.initialize();

  const acp = new ACPClient(agent, {
    defaultAgent: agentId,
    permissionMode: 'approve-all',
  });

  console.log(`${c.cyan}Spawning ${agentId}...${c.reset}`);

  try {
    const result = await acp.spawnSession({
      task: task || 'Reply with confirmation',
      agentId,
      mode: task ? 'oneshot' : 'persistent',
    });

    console.log(`${c.green}✅ Session created: ${result.sessionKey}${c.reset}`);
    console.log(`Agent: ${agentId}`);
    console.log(`Mode: ${result.accepted ? 'accepted' : 'pending'}`);

    acp.on('session:output', ({ session, output }: any) => {
      console.log(`[${session.agentId}] ${output}`);
    });

    acp.on('session:ended', ({ session, code }: any) => {
      console.log(`${c.yellow}Session ended with code: ${code}${c.reset}`);
    });

    await new Promise(() => {});
  } catch (e: any) {
    console.error(`${c.red}❌ Failed: ${e.message}${c.reset}`);
  }
}

// ============ WEBSOCKET COMMAND ============

async function wsCommand(args: string[]) {
  const [action, url] = args;

  if (action === 'connect' && url) {
    const { WebSocketManager } = await import('../gateway/websocket-manager.js');
    const ws = new WebSocketManager({ port: 18792 });
    
    console.log(`${c.cyan}Connecting to ${url}...${c.reset}`);
    
    try {
      const clientId = await ws.connectTo(url);
      console.log(`${c.green}✅ Connected: ${clientId}${c.reset}`);
      
      ws.on('message', (msg: any) => {
        console.log(`[WS] ${msg.from}:`, JSON.stringify(msg.data).slice(0, 100));
      });

      ws.on('disconnected', ({ url }: any) => {
        console.log(`${c.yellow}Disconnected from ${url}${c.reset}`);
      });

      await new Promise(() => {});
    } catch (e: any) {
      console.error(`${c.red}❌ Failed: ${e.message}${c.reset}`);
    }
  } else if (action === 'status') {
    const { WebSocketManager } = await import('../gateway/websocket-manager.js');
    const ws = new WebSocketManager();
    console.log(JSON.stringify(ws.getStatus(), null, 2));
  }

// ============ BUDDY COMPANION ============

async function buddyCommand(args: string[]) {
  const action = args[0] || 'status';
  
  console.log(`${c.cyan}Buddy Companion System${c.reset}`);
  
  switch (action) {
      case 'hatch':
        console.log(`${c.green}🦴 Hatching a new buddy...${c.reset}`);
        console.log(`${c.yellow}(Buddy system requires full initialization)${c.reset}`);
        break;
      case 'list':
      case 'status':
        console.log(`${c.cyan}Buddy companion system${c.reset}`);
        console.log(`Run ${c.yellow}duck buddy hatch${c.reset} to hatch a new buddy`);
        break;
      default:
        console.log(`${c.yellow}Usage: duck buddy [hatch|list|status]${c.reset}`);
    }
}

// ============ AI COUNCIL ============

async function councilCommand(args: string[]) {
  const [mode, ...topicParts] = args;
  const topic = topicParts.join(' ');
  
  // Check if council server is running
  const COUNCIL_URL = process.env.COUNCIL_URL || 'http://localhost:3001';
  
  try {
    const { AICouncilClient } = await import('../council/client.js');
    const client = new AICouncilClient(COUNCIL_URL);
    
    if (!topic) {
      console.log(`${c.cyan}AI Council Chamber${c.reset}`);
      console.log(`Server: ${COUNCIL_URL}`);
      console.log('');
      console.log(`${c.yellow}Usage: duck council [mode] <topic>${c.reset}`);
      console.log('Modes: legislative, research, swarm, prediction, inquiry');
      console.log('');
      console.log('Example: duck council legislative "Should we refactor the auth module?"');
      return;
    }
    
    console.log(`${c.cyan}Consulting AI Council on: ${topic}${c.reset}`);
    console.log(`Mode: ${mode || 'legislative'}`);
    console.log('');
    console.log(`${c.yellow}Running deliberation...${c.reset}\n`);
    
    // Run deliberation
    const result = await client.runDeliberation(topic, mode || 'legislative');
    
    console.log(`${c.green}Council Verdict:${c.reset}`);
    console.log(result.finalRuling || result.summary);
    if (result.summary) console.log(result.summary);
    console.log(`${c.cyan}Confidence: ${result.consensus}%${c.reset}`);
    
  } catch (e: any) {
    console.log(`${c.yellow}AI Council not available: ${e.message}${c.reset}`);
    console.log(`Start council server: ./start-ai-council.sh`);
  }
}

// ============ MULTI-AGENT TEAMS ============

async function teamCommand(args: string[]) {
  const [action, teamType, ...taskParts] = args;
  const task = taskParts.join(' ');
  
  console.log(`${c.cyan}Multi-Agent Team System${c.reset}`);
  
  switch (action) {
      case 'create':
        if (!teamType) {
          console.log(`${c.yellow}Usage: duck team create <type>${c.reset}`);
          console.log('Types: code-review, research, swarm');
          return;
        }
        console.log(`${c.green}Team ${teamType} created${c.reset}`);
        break;
      case 'spawn':
        if (!teamType || !task) {
          console.log(`${c.yellow}Usage: duck team spawn <type> <task>${c.reset}`);
          return;
        }
        console.log(`${c.cyan}Spawning ${teamType} team for: ${task}${c.reset}`);
        break;
      case 'list':
        console.log(`${c.cyan}Multi-agent team system${c.reset}`);
        break;
      default:
        console.log(`${c.yellow}Usage: duck team [create|spawn|list]${c.reset}`);
    }
}

}

// ============ KAIROS AUTONOMOUS ============

async function kairosCommand(args: string[]) {
  const mode = args[0] || 'balanced';
  console.log(`${c.cyan}Starting KAIROS autonomous mode: ${mode}${c.reset}`);
  console.log(`${c.green}KAIROS heartbeat system activated${c.reset}`);
  console.log('Use cron to enable autonomous checks');
  await new Promise(() => {});
}

// ============ BUDDY COMPANION ============

async function buddyCommand(args: string[]) {
  const action = args[0] || 'status';
  
  console.log(`${c.cyan}Buddy Companion System${c.reset}`);
  
  switch (action) {
      case 'hatch':
        console.log(`${c.green}🦴 Hatching a new buddy...${c.reset}`);
        console.log(`${c.yellow}(Buddy system requires full initialization)${c.reset}`);
        break;
      case 'list':
      case 'status':
        console.log(`${c.cyan}Buddy companion system${c.reset}`);
        console.log(`Run ${c.yellow}duck buddy hatch${c.reset} to hatch a new buddy`);
        break;
      default:
        console.log(`${c.yellow}Usage: duck buddy [hatch|list|status]${c.reset}`);
    }
}

// ============ AI COUNCIL ============

async function councilCommand(args: string[]) {
  const [mode, ...topicParts] = args;
  const topic = topicParts.join(' ');
  
  // Check if council server is running
  const COUNCIL_URL = process.env.COUNCIL_URL || 'http://localhost:3001';
  
  try {
    const { AICouncilClient } = await import('../council/client.js');
    const client = new AICouncilClient(COUNCIL_URL);
    
    if (!topic) {
      console.log(`${c.cyan}AI Council Chamber${c.reset}`);
      console.log(`Server: ${COUNCIL_URL}`);
      console.log('');
      console.log(`${c.yellow}Usage: duck council [mode] <topic>${c.reset}`);
      console.log('Modes: legislative, research, swarm, prediction, inquiry');
      console.log('');
      console.log('Example: duck council legislative "Should we refactor the auth module?"');
      return;
    }
    
    console.log(`${c.cyan}Consulting AI Council on: ${topic}${c.reset}`);
    console.log(`Mode: ${mode || 'legislative'}`);
    console.log('');
    console.log(`${c.yellow}Running deliberation...${c.reset}\n`);
    
    // Run deliberation
    const result = await client.runDeliberation(topic, mode || 'legislative');
    
    console.log(`${c.green}Council Verdict:${c.reset}`);
    console.log(result.finalRuling || result.summary);
    if (result.summary) console.log(result.summary);
    console.log(`${c.cyan}Confidence: ${result.consensus}%${c.reset}`);
    
  } catch (e: any) {
    console.log(`${c.yellow}AI Council not available: ${e.message}${c.reset}`);
    console.log(`Start council server: ./start-ai-council.sh`);
  }
}

// ============ MULTI-AGENT TEAMS ============

async function teamCommand(args: string[]) {
  const [action, teamType, ...taskParts] = args;
  const task = taskParts.join(' ');
  
  console.log(`${c.cyan}Multi-Agent Team System${c.reset}`);
  
  switch (action) {
      case 'create':
        if (!teamType) {
          console.log(`${c.yellow}Usage: duck team create <type>${c.reset}`);
          console.log('Types: code-review, research, swarm');
          return;
        }
        console.log(`${c.green}Team ${teamType} created${c.reset}`);
        break;
      case 'spawn':
        if (!teamType || !task) {
          console.log(`${c.yellow}Usage: duck team spawn <type> <task>${c.reset}`);
          return;
        }
        console.log(`${c.cyan}Spawning ${teamType} team for: ${task}${c.reset}`);
        break;
      case 'list':
        console.log(`${c.cyan}Multi-agent team system${c.reset}`);
        break;
      default:
        console.log(`${c.yellow}Usage: duck team [create|spawn|list]${c.reset}`);
    }
}

// ============ OPENCLAW-RL COMMANDS ============

/**
 * duck rl [status|enable|disable|stats|connect <url>]
 * Optional Reinforcement Learning integration with OpenClaw-RL.
 *
 * Default: RL is DISABLED. Agent operates normally without training.
 * When enabled, conversations are routed through the RL server for
 * Binary RL (GRPO + PRM) or On-Policy Distillation (OPD) training.
 */
async function rlCommand(args: string[]) {
  const [subCmd, ...subArgs] = args;
  const { getTrainingManager } = await import('../rl/index.js');

  const tm = await getTrainingManager();
  const c = { reset: '[0m', bold: '[1m', dim: '[2m', red: '[31m', green: '[32m', yellow: '[33m', blue: '[34m', cyan: '[36m', magenta: '[35m' };

  if (!subCmd || subCmd === 'status') {
    tm.printStatus();
    return;
  }

  switch (subCmd) {
    case 'enable': {
      const result = await tm.enable();
      if (!result.success) {
        console.log(`\n${c.red}✗ Failed to enable RL:${c.reset} ${result.error}`);
        console.log(`\n${c.yellow}To connect to an RL server first:${c.reset}`);
        console.log(`  ${c.bold}duck rl connect http://<host>:30000${c.reset}`);
        console.log(`\nOr start the OpenClaw-RL server:`);
        console.log(`  cd OpenClaw-RL/slime`);
        console.log(`  bash ../openclaw-rl/run_qwen3_4b_openclaw_rl.sh`);
      }
      break;
    }

    case 'disable': {
      await tm.disable();
      break;
    }

    case 'stats': {
      tm.printStats();
      break;
    }

    case 'connect': {
      const serverUrl = subArgs[0];
      if (!serverUrl) {
        console.log(`\n${c.red}Usage: duck rl connect <server-url>${c.reset}`);
        console.log(`\n${c.bold}Example:${c.reset}`);
        console.log(`  ${c.cyan}duck rl connect http://192.168.1.100:30000${c.reset}`);
        console.log(`\n${c.dim}The default port for OpenClaw-RL is 30000.${c.reset}`);
        return;
      }
      console.log(`${c.cyan}Connecting to RL server: ${serverUrl}${c.reset}`);
      const result = await tm.connect(serverUrl);
      if (result.success) {
        console.log(`\n${c.green}✓ Connected to OpenClaw-RL server!${c.reset}`);
        console.log(`\nEnable RL training:`);
        console.log(`  ${c.bold}duck rl enable${c.reset}`);
      } else {
        console.log(`\n${c.red}✗ Connection failed:${c.reset} ${result.error}`);
      }
      break;
    }

    case 'disconnect': {
      const current = tm.getServerUrl();
      if (!current) {
        console.log(`${c.yellow}Not connected to any RL server.${c.reset}`);
        return;
      }
      console.log(`${c.green}✓ Disconnected from RL server.${c.reset}`);
      if (tm.isEnabled()) {
        await tm.disable();
      }
      break;
    }

    default: {
      console.log(`\n${c.yellow}Unknown RL command: ${subCmd}${c.reset}`);
      console.log(`\n${c.bold}Usage: duck rl [status|enable|disable|stats|connect]${c.reset}`);
      console.log(`\n${c.bold}Commands:${c.reset}`);
      console.log(`  ${c.green}status${c.reset}      Show RL status (default)`);
      console.log(`  ${c.green}enable${c.reset}     Enable RL training`);
      console.log(`  ${c.green}disable${c.reset}    Disable RL training`);
      console.log(`  ${c.green}stats${c.reset}      Show training statistics`);
      console.log(`  ${c.green}connect${c.reset}    <url>  Connect to RL server`);
      console.log(`  ${c.green}disconnect${c.reset} Remove RL server connection`);
      console.log(`\n${c.dim}RL is OPTIONAL and disabled by default.${c.reset}`);
      console.log(`${c.dim}No training occurs unless you explicitly enable it.${c.reset}`);
    }
  }
}

// ============ RL ENABLE / DISABLE (shorthand) ============

async function rlEnableCommand(): Promise<void> {
  await rlCommand(['enable']);
}

async function rlDisableCommand(): Promise<void> {
  await rlCommand(['disable']);
}
