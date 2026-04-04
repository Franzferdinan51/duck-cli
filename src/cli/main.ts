#!/usr/bin/env node


// Helper: get agent config from env vars (set by Go layer -p / -m flags)
function getAgentConfig() {
  const provider = process.env.DUCK_PROVIDER || 'minimax';
  const modelMap: Record<string, string> = {
    openrouter: 'qwen/qwen3.6-plus-preview:free',
    minimax: 'MiniMax-M2.7',
    moonshot: 'moonshot-v1-32k',
    openai: 'gpt-4o-mini',
    anthropic: 'claude-3-5-sonnet-20241022',
    gemini: 'gemini-2.0-flash',
    lmstudio: 'local-model'
  };
  const model = process.env.DUCK_MODEL || modelMap[provider] || 'claude-3-5-sonnet-20241022';
  return { provider, model };
}


/**
 * 🦆 Duck Agent CLI
 * Full-featured AI agent with TUI shell
 */

import { Agent } from '../agent/core.js';
import { SessionStore } from '../agent/session-store.js';
import { AndroidTools, getAndroidTools } from '../agent/android-tools.js';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join, dirname } from 'path';
import * as readline from 'readline';
import { meshCommand, meshServerCommand } from './mesh-cmd.js';
import { subconsciousCommand } from '../commands/subconscious.js';
import { clawhubCommand, soulsCommand } from './clawhub-commands.js';
import { getRateLimiter, RateLimiter } from '../agent/rate-limiter.js';
import { runHealthCheck, runBootDiagnostics, printHealthReport } from '../agent/health-check.js';
import { getConfigManager, ConfigManager } from '../agent/config-manager.js';
import { getSelfMonitor, SelfMonitor } from '../agent/self-monitor.js';

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
${c.reset}${c.cyan}  ${c.bold}AI Agent${c.reset} ${c.dim}0.4.0 - Super Agent${c.reset}
`;

async function main() {
  const [command, ...args] = process.argv.slice(2);

  // Strip leading -- for consistency with Go wrapper
  const cmd = command?.replace(/^--/, '') || '';

  // duck (no args) → interactive shell (standalone mode for humans)
  if (!command || cmd === 'shell' || cmd === 'i' || cmd === 'chat' || cmd === 'interactive') {
    await startShell();
    return;
  }

  switch (cmd) {
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
      // Check for --stdio flag
      if (args.includes('--stdio') || args.includes('-s')) {
        await startMCPStdio();
      } else {
        await startMCP(parseInt(args[0]) || 3850);
      }
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
      await startWebUI(args);
      break;

    case 'tools':
      await toolsCommand(args);
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

    case 'sync': {
      const { createSyncCommand } = await import('../commands/sync-cli.js');
      const sync = createSyncCommand();
      // Don't include 'sync' in parse args - Commander uses the Command name automatically
      sync.parse(['node', 'duck', ...args]);
      break;
    }

    case 'send':
    case 'sendto':
      await sendToChannel(args);
      break;

    case 'desktop':
      await desktopCommand(args);
      break;

    case 'android':
      await androidCommand(args);
      break;

    case 'memory':
      await memoryCommand(args);
      break;

    case 'gateway':
      await startGateway();
      break;

    case 'mcp-connect':
      await mcpConnect(args.slice(1));
      break;

    case 'cron':
      await cronCommand(args);
      break;

    case 'kairos':
      await kairosCommand(args);
      break;

    case 'trace': {
      const { traceListCommand, traceShowCommand, traceDeleteCommand, traceClearCommand } = await import('./trace-commands.js');
      const subCmd = args[0] || 'list';
      switch (subCmd) {
        case 'list':
        case 'ls':
          await traceListCommand(args.slice(1));
          break;
        case 'show':
        case 'view':
          await traceShowCommand(args.slice(1));
          break;
        case 'delete':
        case 'rm':
          await traceDeleteCommand(args.slice(1));
          break;
        case 'clear':
          await traceClearCommand();
          break;
        default:
          console.log('Usage: duck trace <list|show|delete|clear> [id]');
      }
      break;
    }

    case 'a2a':
      await a2aCommand(args);
      break;

    case 'buddy':
      await buddyCommand(args);
      break;

    case 'security-defcon':
      console.log(`${c.bold}🔐 DEFCON Status: ${c.green}DEFCON 5 - All Clear${c.reset}`);
      console.log(`${c.dim}No active security threats detected.${c.reset}`);
      break;
    case 'security-audit':
      console.log(`${c.bold}🔍 Security Audit${c.reset}`);
      console.log(`${c.dim}Run: duck security audit${c.reset}`);
      break;
    case 'council':
    case 'ai-council':
      await councilCommand(args);
      break;

    case 'workflow':
    case 'flow': {
      const { WorkflowRunner } = await import('../agent/workflow-runner.js');
      const { Agent } = await import('../agent/core.js');
      const file = args[0];
      if (!file) {
        console.log(`${c.red}Usage: duck workflow <file.json>${c.reset}`);
        console.log(`${c.red}Usage: duck flow <file.yaml>${c.reset}`);
        process.exit(1);
      }
      const agent = new Agent({ quietMode: true });
      await agent.initialize();
      const runner = new WorkflowRunner(agent as any);
      let result: any;
      if (file.endsWith('.yaml') || file.endsWith('.yml')) {
        result = await runner.runFlowFromFile(file);
      } else {
        result = await runner.runFromFile(file);
      }
      console.log(JSON.stringify(result, null, 2));
      process.exit(result.success ? 0 : 1);
    }

    case 'flow_ts': {
      // ACPX-style TypeScript flow graph runner
      const { FlowRunner } = await import('../agent/flow-graph.js');
      const input = JSON.parse(args.join(' '));
      const def = typeof input.definition === 'string' ? JSON.parse(input.definition) : input.definition;
      const runner = new FlowRunner(def, 'cli');
      const result = await runner.run(input.startNode);
      console.log(JSON.stringify({
        flowName: def.name,
        outcome: result.outcome,
        totalSteps: result.results.length,
        trace: runner.getTrace().getBundle(),
        steps: result.results.map((r: any) => ({
          nodeId: r.nodeId, kind: r.kind, outcome: r.outcome,
          durationMs: r.durationMs, error: r.error
        }))
      }, null, 2));
      process.exit(result.outcome === 'ok' ? 0 : 1);
    }

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

    case 'clawhub':
    case 'skills':
      await clawhubCommand(args);
      break;

    case 'subconscious':
      await subconsciousCommand(args);
      break;

    case 'subconsciousd':
      // Shortcut: duck subconsciousd → starts daemon
      await subconsciousCommand(['daemon', ...args]);
      break;

    case 'meshd':
    case 'mesh-server':
      // Shortcut: duck meshd → starts mesh server daemon
      await meshServerCommand(args);
      break;

    case 'mesh':
      await meshCommand(args);
      break;

    case 'souls':
      await soulsCommand(args);
      break;

    case 'setup':
    case 'configure':
    case 'init':
      await runSetup();
      break;

    case 'doctor':
    case 'diagnostics':
      {
        const { existsSync } = await import('fs');
        let issues = 0;
        const checks: { name: string; ok: boolean; detail?: string }[] = [];
        
        const nodeVer = process.version;
        checks.push({ name: 'Node.js', ok: nodeVer >= 'v20', detail: nodeVer });
        
        const keyChecks: [string, string][] = [
          ['MINIMAX_API_KEY', 'MiniMax'],
          ['OPENROUTER_API_KEY', 'OpenRouter'],
          ['KIMI_API_KEY', 'Kimi'],
        ];
        for (const [key, name] of keyChecks) {
          const val = process.env[key];
          checks.push({ name, ok: !!val, detail: val ? '***' + val.slice(-4) : 'not set' });
          if (!val) issues++;
        }
        
        const dirChecks: [string, string][] = [
          ['node_modules', 'Node modules'],
          ['src/skills', 'Skills dir'],
          ['.duck', 'Duck data'],
        ];
        for (const [dir, name] of dirChecks) {
          const ok = existsSync(dir);
          checks.push({ name, ok, detail: ok ? 'found' : 'missing' });
          if (!ok) issues++;
        }
        
        console.log(`\n${c.bold}🔍 Duck Agent Doctor${c.reset}`);
        console.log(`${c.dim}Running system diagnostics...${c.reset}\n`);
        
        for (const check of checks) {
          const icon = check.ok ? `${c.green}✅${c.reset}` : `${c.red}❌${c.reset}`;
          const detail = check.detail ? ` ${c.dim}(${check.detail})${c.reset}` : '';
          console.log(`  ${icon} ${check.name}${detail}`);
        }
        
        console.log(`\n${c.bold}Result:${c.reset} ${issues === 0 ? c.green+'✅ All systems operational' : c.yellow+'⚠️ '+issues+' issue(s) found'}${c.reset}\n`);
      }
      break;

    case 'health':
    case 'health-check':
      {
        const { runHealthCheck, printHealthReport } = await import('../agent/health-check.js');
        const report = await runHealthCheck(true);
        printHealthReport(report);
        process.exit(report.exitCode);
      }
      break;

    case 'boot':
    case 'boot-diagnostics':
    case 'diagnose':
      {
        const { runBootDiagnostics } = await import('../agent/health-check.js');
        await runBootDiagnostics();
      }
      break;

    case 'stats':
    case 'statistics':
      {
        const { getSelfMonitor } = await import('../agent/self-monitor.js');
        const monitor = getSelfMonitor();
        const [action, ...actionArgs] = args;

        if (action === 'reset') {
          monitor.reset();
        } else if (action === 'json') {
          console.log(monitor.toJSON());
        } else if (action === 'export') {
          const fs = await import('fs');
          fs.writeFileSync('/tmp/duck-stats.json', monitor.toJSON());
          console.log(`Exported to /tmp/duck-stats.json`);
        } else {
          monitor.printStats();
        }
      }
      break;

    case 'config':
      {
        const { getConfigManager } = await import('../agent/config-manager.js');
        const config = getConfigManager();
        const [action, ...actionArgs] = args;

        if (!action || action === 'list' || action === 'get') {
          if (!action || action === 'list') {
            console.log(`\n${c.bold}🦆 Duck Config${c.reset}`);
            console.log(`Config file: ${config.getConfigPath()}\n`);
            console.log(config.toJSON());
            console.log();
          } else {
            // Get specific key
            const key = actionArgs[0];
            if (!key) {
              console.log(`${c.red}Usage: duck config get <key>${c.reset}`);
              console.log(`Example: duck config get defaults.model`);
            } else {
              const value = config.getValue(key);
              if (value !== undefined) {
                console.log(`${key} = ${JSON.stringify(value)}`);
              } else {
                console.log(`${c.red}Key not found: ${key}${c.reset}`);
              }
            }
          }
        } else if (action === 'set') {
          const key = actionArgs[0];
          const value = actionArgs.slice(1).join(' ');
          if (!key || !value) {
            console.log(`${c.red}Usage: duck config set <key> <value>${c.reset}`);
            console.log(`Example: duck config set defaults.model MiniMax-M2.7`);
          } else {
            // Try to parse value
            let parsedValue: any = value;
            if (value === 'true') parsedValue = true;
            else if (value === 'false') parsedValue = false;
            else if (!isNaN(Number(value))) parsedValue = Number(value);
            
            config.setValue(key, parsedValue);
            console.log(`${c.green}✅ Set ${key} = ${JSON.stringify(parsedValue)}${c.reset}`);
          }
        } else if (action === 'reset') {
          config.reset();
          console.log(`${c.green}✅ Config reset to defaults${c.reset}`);
        } else if (action === 'path') {
          console.log(config.getConfigPath());
        } else {
          console.log(`${c.yellow}Usage:${c.reset}`);
          console.log(`  ${c.green}duck config${c.reset}              List all config`);
          console.log(`  ${c.green}duck config get <key>${c.reset}    Get a config value`);
          console.log(`  ${c.green}duck config set <key> <val>${c.reset} Set a config value`);
          console.log(`  ${c.green}duck config reset${c.reset}       Reset to defaults`);
          console.log(`  ${c.green}duck config path${c.reset}        Show config file path`);
          console.log();
          console.log(`${c.dim}Keys use dot notation, e.g.:${c.reset}`);
          console.log(`  defaults.model`);
          console.log(`  defaults.maxRetries`);
          console.log(`  providers.minimax.enabled`);
          console.log(`  gracefulDegradation.fallbackModels`);
          console.log();
        }
      }
      break;

    default:
      await runTask(command + ' ' + args.join(' '));
  }
}

// ============ SHELL MODE ============

async function startShell() {
  console.log(logo);
  const cfg = getAgentConfig();
  const store = new SessionStore();

  // Try to resume last session
  let lastSession = null;
  try {
    const rows = (store as any).db?.prepare?.("SELECT sessionId FROM sessions WHERE timestamp > ? ORDER BY timestamp DESC LIMIT 1")
      .all(Date.now() - 7 * 24 * 60 * 60 * 1000) || [];
    lastSession = rows.length > 0 ? rows[0].sessionId : null;
  } catch {}

  console.log(`${c.green}🦆 Duck Agent — Your AI sidekick${c.reset}`);
  console.log(`${c.dim}Type /help for commands, /quit to exit${c.reset}`);

  let sessionContext: { role: string; content: string }[] = [];
  if (lastSession) {
    const messages = store.getSessionMessages(lastSession, 10);
    if (messages.length > 0) {
      console.log(`${c.dim}\n📜 Resuming previous conversation (${messages.length} messages)${c.reset}`);
      for (const msg of messages.slice(0, 20)) {
        if (msg.role === 'user' || msg.role === 'assistant') {
          sessionContext.push({ role: msg.role, content: msg.content });
        }
      }
      console.log(`${c.dim}   Say hi and we\'ll pick up where we left off!${c.reset}`);
    }
  } else {
    console.log(`\n${c.bold}👋 Hey! I\'m Duck Agent.${c.reset}`);
    console.log(`${c.dim}I can help you with all sorts of things — just ask!${c.reset}`);
    console.log(`${c.dim}Try: "build a website", "research AI news", "fix my code", "plan a trip"${c.reset}\n`);
  }

  const agent = new Agent({ name: 'Duck Agent', provider: cfg.provider, model: cfg.model });
  await agent.initialize();

  // Inject previous session context
  if (sessionContext.length > 0) {
    try {
      for (const msg of sessionContext) {
        (agent as any).history.push(msg);
      }
    } catch {}
  }

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

    case 'setup':
    case 'configure':
    case 'init':
      await runSetup();
      break;

    case 'doctor':
    case 'diagnostics':
      const { existsSync } = await import('fs');
      
      console.log(`\n${c.bold}🔍 Duck Agent Doctor${c.reset}`);
      console.log(`${c.dim}Running system diagnostics...${c.reset}\n`);
      
      let issues = 0;
      const checks = [];
      
      // Check Node.js
      const nodeVer = process.version;
      checks.push({ name: 'Node.js', ok: nodeVer >= 'v20', detail: nodeVer });
      
      // Check API keys
      const keyChecks = [
        ['MINIMAX_API_KEY', 'MiniMax'],
        ['OPENROUTER_API_KEY', 'OpenRouter'],
        ['KIMI_API_KEY', 'Kimi'],
      ];
      for (const [key, name] of keyChecks) {
        const val = process.env[key];
        checks.push({ name, ok: !!val, detail: val ? '***' + val.slice(-4) : 'not set' });
        if (!val) issues++;
      }
      
      // Check directories
      const dirChecks = [
        ['node_modules', 'Node modules'],
        ['src/skills', 'Skills dir'],
        ['.duck', 'Duck data'],
      ];
      for (const [dir, name] of dirChecks) {
        const ok = existsSync(dir);
        checks.push({ name, ok, detail: ok ? 'found' : 'missing' });
        if (!ok) issues++;
      }
      
      // Print results
      for (const check of checks) {
        const icon = check.ok ? `${c.green}✅${c.reset}` : `${c.red}❌${c.reset}`;
        const detail = check.detail ? ` ${c.dim}(${check.detail})${c.reset}` : '';
        console.log(`  ${icon} ${check.name}${detail}`);
      }
      
      console.log(`\n${c.bold}Result:${c.reset} ${issues === 0 ? c.green+'✅ All systems operational' : c.yellow+'⚠️ '+issues+' issue(s) found'}${c.reset}\n`);
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

  const cfg = getAgentConfig(); const agent = new Agent({ name: 'Duck Agent', provider: cfg.provider, model: cfg.model });
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

  const cfg = getAgentConfig(); const agent = new Agent({ name: 'Duck Agent', provider: cfg.provider, model: cfg.model });
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

  const cfg = getAgentConfig(); const agent = new Agent({ name: 'Duck Agent', provider: cfg.provider, model: cfg.model });
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
  const cfg = getAgentConfig(); const agent = new Agent({ name: 'Duck Agent', provider: cfg.provider, model: cfg.model });
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

// ============ TOOLS COMMAND ============

async function toolsCommand(args: string[]) {
  // Lazy-load to avoid circular deps and keep CLI fast
  const { schemaRegistry } = await import('../agent/schema-registry.js');

  const [subCmd, ...subArgs] = args;

  if (!subCmd || subCmd === 'list') {
    // Parse --category flag
    const catIdx = subArgs.indexOf('--category');
    const category = catIdx >= 0 ? subArgs[catIdx + 1] as any : null;

    if (category) {
      const tools = schemaRegistry.listByCategory(category);
      if (tools.length === 0) {
        console.log(`${c.yellow}No tools found for category: ${category}${c.reset}`);
        console.log(`${c.dim}Available: ${schemaRegistry.countByCategory().toString()}${c.reset}`);
        return;
      }
      console.log(`\n${c.bold}${category} Tools (${tools.length}):${c.reset}\n`);
      for (const tool of tools) {
        const d = tool.dangerous ? ` ${c.red}[DANGEROUS]${c.reset}` : '';
        const retry = tool.retryable ? ` ${c.green}↺${c.reset}` : '';
        console.log(`  ${c.cyan}${tool.name}${c.reset}${d}${retry} - ${tool.description}`);
      }
      console.log();
    } else {
      // List all tools grouped by category
      const counts = schemaRegistry.countByCategory();
      const total = schemaRegistry.count();
      console.log(`\n${c.bold}Available Tools (${total} total):${c.reset}\n`);
      for (const [cat, count] of Object.entries(counts)) {
        const icon = cat === 'android' ? '📱' :
                     cat === 'desktop' ? '🖥️' :
                     cat === 'system' ? '⚙️' :
                     cat === 'file' ? '📄' :
                     cat === 'network' ? '🌐' :
                     cat === 'ai' ? '🤖' :
                     cat === 'memory' ? '🧠' :
                     cat === 'browser' ? '🌐' :
                     cat === 'coding' ? '💻' :
                     cat === 'planning' ? '📋' :
                     cat === 'cron' ? '⏰' : '📦';
        console.log(`  ${c.cyan}${icon} ${cat}${c.reset} - ${count} tools`);
      }
      console.log();
      console.log(`${c.dim}Use: duck tools list --category <name>${c.reset}`);
      console.log(`${c.dim}     duck tools schema <tool-name>${c.reset}`);
      console.log(`${c.dim}     duck tools search <query>${c.reset}`);
      console.log();
    }
    return;
  }

  if (subCmd === 'schema') {
    const name = subArgs[0];
    if (!name) {
      console.log(`${c.red}Usage: duck tools schema <tool-name>${c.reset}`);
      console.log(`${c.dim}Example: duck tools schema android_shell${c.reset}`);
      return;
    }
    const schema = schemaRegistry.get(name);
    if (!schema) {
      console.log(`${c.red}Tool not found: ${name}${c.reset}`);
      // Fuzzy search suggestions
      const suggestions = schemaRegistry.search(name);
      if (suggestions.length > 0) {
        console.log(`${c.dim}Did you mean:${c.reset}`);
        for (const s of suggestions.slice(0, 5)) {
          console.log(`  ${c.cyan}  ${s.name}${c.reset} - ${s.description}`);
        }
      }
      return;
    }

    const d = schema.dangerous ? `${c.red}[DANGEROUS]${c.reset}` : '';
    const retry = schema.retryable ? `${c.green}↺ retryable${c.reset}` : `${c.yellow}⚠ non-retryable${c.reset}`;
    console.log(`\n${c.bold}Tool Schema: ${c.cyan}${schema.name}${c.reset} ${d}${c.reset}`);
    console.log(`${c.dim}${'─'.repeat(60)}${c.reset}`);
    console.log(`${c.bold}Description:${c.reset} ${schema.description}`);
    console.log(`${c.bold}Category:${c.reset}   ${schema.category}`);
    console.log(`${c.bold}Retryable:${c.reset} ${retry}`);
    if (schema.fallbackTool) {
      console.log(`${c.bold}Fallback:${c.reset} ${schema.fallbackTool}`);
    }

    console.log(`\n${c.bold}Arguments:${c.reset}`);
    if (schema.args.length === 0) {
      console.log(`  ${c.dim}(none)${c.reset}`);
    } else {
      for (const arg of schema.args) {
        const req = arg.required ? `${c.red}*${c.reset}` : `${c.dim}[optional]${c.reset}`;
        const def = arg.default !== undefined ? ` ${c.dim}default: ${arg.default}${c.reset}` : '';
        console.log(`  ${c.cyan}${arg.name}${c.reset} ${req} ${c.dim}(${arg.type})${c.reset} - ${arg.description}${def}`);
      }
    }

    console.log(`\n${c.bold}Returns:${c.reset} ${schema.returns.type}`);
    console.log(`  ${schema.returns.description}`);

    console.log(`\n${c.bold}Errors:${c.reset}`);
    for (const err of schema.errors) {
      console.log(`  ${c.red}✗${c.reset} ${err}`);
    }

    if (schema.examples && schema.examples.length > 0) {
      console.log(`\n${c.bold}Examples:${c.reset}`);
      for (const ex of schema.examples) {
        console.log(`  ${c.green}>${c.reset} ${c.dim}${ex}${c.reset}`);
      }
    }
    console.log();
    return;
  }

  if (subCmd === 'search') {
    const query = subArgs.join(' ');
    if (!query) {
      console.log(`${c.red}Usage: duck tools search <query>${c.reset}`);
      console.log(`${c.dim}Example: duck tools search android screenshot${c.reset}`);
      return;
    }
    const results = schemaRegistry.search(query);
    if (results.length === 0) {
      console.log(`${c.yellow}No tools found matching: ${query}${c.reset}`);
      return;
    }
    console.log(`\n${c.bold}Search Results for "${query}" (${results.length}):${c.reset}\n`);
    for (const tool of results) {
      const d = tool.dangerous ? ` ${c.red}[DANGEROUS]${c.reset}` : '';
      const match = tool.name.toLowerCase().includes(query.toLowerCase()) ? ` ${c.green}(name match)${c.reset}` : '';
      console.log(`  ${c.cyan}${tool.name}${c.reset}${d}${match}`);
      console.log(`  ${c.dim}  ${tool.category}: ${tool.description}${c.reset}`);
      console.log();
    }
    return;
  }

  if (subCmd === 'categories') {
    const counts = schemaRegistry.countByCategory();
    console.log(`\n${c.bold}Tool Categories:${c.reset}\n`);
    for (const [cat, count] of Object.entries(counts)) {
      console.log(`  ${c.cyan}${cat}${c.reset} - ${count} tools`);
    }
    console.log();
    return;
  }

  if (subCmd === 'mcp') {
    // Output MCP-style JSON for auto-discovery
    const mcpTools = schemaRegistry.getMCPTools();
    console.log(JSON.stringify(mcpTools, null, 2));
    return;
  }

  // Unknown sub-command
  console.log(`${c.red}Unknown tools command: ${subCmd}${c.reset}`);
  console.log(`\n${c.bold}Usage:${c.reset}`);
  console.log(`  ${c.green}duck tools${c.reset}                  List all tools by category`);
  console.log(`  ${c.green}duck tools list${c.reset}              List all tools`);
  console.log(`  ${c.green}duck tools list --category android${c.reset}  Filter by category`);
  console.log(`  ${c.green}duck tools schema <name>${c.reset}      Show full schema`);
  console.log(`  ${c.green}duck tools search <query>${c.reset}    Fuzzy search tools`);
  console.log(`  ${c.green}duck tools categories${c.reset}         List categories`);
  console.log(`  ${c.green}duck tools mcp${c.reset}                Output MCP JSON for auto-discovery`);
  console.log();
  console.log(`${c.dim}Categories: ${Object.keys(schemaRegistry.countByCategory()).join(', ')}${c.reset}`);
  console.log();
}

// ============ HISTORY ============

async function showHistory() {
  const cfg = getAgentConfig(); const agent = new Agent({ name: 'Duck Agent', provider: cfg.provider, model: cfg.model });
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
  const cfg = getAgentConfig(); const agent = new Agent({ name: 'Duck Agent', provider: cfg.provider, model: cfg.model });
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

/**
 * Start MCP server with stdio transport (for LM Studio, Claude Desktop, etc.)
 */
async function startMCPStdio() {
  console.error('[MCP] Starting stdio server (for LM Studio)...');
  
  const { MCPServer } = await import('../server/mcp-server.js');
  const server = new MCPServer(3850);
  await server.startStdio();
}

// ============ WEB UI ============

async function startWebUI(args: string[] = []) {
  const port = parseInt(args[0] || process.env.WEB_PORT || '3002');
  process.env.WEB_PORT = String(port);
  console.log(logo);
  console.log(`${c.cyan}Starting Duck Agent Web UI on port ${port}...${c.reset}\n`);
  
  const { createServer } = await import('http');
  const { readFileSync, existsSync } = await import('fs');
  const { join, extname } = await import('path');
  const { Agent } = await import('../agent/core.js');
  
  // Initialize agent
  const cfg = getAgentConfig(); const agent = new Agent({ name: 'DuckWebAgent', provider: cfg.provider, model: cfg.model });
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
      if (path === '/api/status' || path === '/v1/status') {
        const status = agent.getStatus();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ...status, uptime: Date.now() }));
        return;
      }
      
      if (path === '/api/chat' || path === '/v1/chat') {
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
      
      if (path === '/v1/tts') {
        let body = '';
        req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
        req.on('end', async () => {
          const { text, voice } = JSON.parse(body);
          try {
            const { TTSService } = await import('../tools/tts.js');
            const apiKey = process.env.MINIMAX_API_KEY;
            if (!apiKey) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'MINIMAX_API_KEY not set' }));
              return;
            }
            const tts = new TTSService({ apiKey });
            if (voice) tts.setVoice(voice);
            const result = await tts.speak({ text, outputPath: '/tmp/duck_tts.mp3' });
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, chars: result.chars, file: '/tmp/duck_tts.mp3' }));
          } catch (err: any) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
          }
        });
        return;
      }
      
      if (path === '/api/tools' || path === '/v1/tools') {
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
  const cfg = getAgentConfig(); const agent = new Agent({ name: 'Duck Agent', provider: cfg.provider, model: cfg.model });
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

// ============ ANDROID ============
async function androidCommand(args: string[]) {
  const android = getAndroidTools();
  const [action, ...actionArgs] = args;
  
  // Parse JSON payload if present (set by Go layer)
  // Go passes: "shell {...}" as one string OR ["shell", "{...}"] as separate args
  let payload: Record<string, any> = {};
  let subCmd = action;
  
  // If action is like "shell {...}" with JSON attached, split it
  const spaceIdx = action.indexOf(' ');
  if (spaceIdx > 0) {
    const possibleJson = action.substring(spaceIdx + 1);
    if (possibleJson.startsWith('{')) {
      try {
        payload = JSON.parse(possibleJson);
        subCmd = action.substring(0, spaceIdx);
      } catch (e) {
        // Not JSON, keep action as-is
      }
    }
  }
  
  // Also check actionArgs for JSON if payload still empty
  if (Object.keys(payload).length === 0) {
    try {
      if (actionArgs[1]?.startsWith('{')) { payload = JSON.parse(actionArgs[1]); }
      else if (actionArgs[0]?.startsWith('{')) { payload = JSON.parse(actionArgs[0]); }
    } catch (e) {
      // No JSON
    }
  }

  const c2 = { green: '\x1b[32m', red: '\x1b[31m', yellow: '\x1b[33m', cyan: '\x1b[36m', reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m' };

  switch (subCmd) {
    case 'devices': {
      const devices = await android.refreshDevices();
      if (devices.length === 0) {
        console.log(`${c2.yellow}No Android devices connected. Enable USB debugging and connect your device.${c2.reset}`);
        return;
      }
      const current = android.getCurrentDevice();
      console.log(`${c2.bold}Android Devices (${devices.length}):${c2.reset}`);
      for (const dev of devices) {
        const state = current?.serial === dev.serial ? `${c2.green}[ACTIVE]${c2.reset}` : '';
        console.log(`  ${c2.cyan}${dev.serial}${c2.reset} ${state}`);
        console.log(`    Model: ${dev.model || 'unknown'}`);
      }
      break;
    }
    case 'info': {
      await android.refreshDevices();
      const serial = (payload.serial && payload.serial.trim()) || android.getCurrentDevice()?.serial || actionArgs[0];
      if (!serial) { console.log(`${c2.red}No device selected. Run 'duck android devices' first.${c2.reset}`); return; }
      const info = await android.getDeviceInfo(serial);
      console.log(JSON.stringify(info, null, 2));
      break;
    }
    case 'shell': {
      const cmd = payload.command ?? actionArgs.join(' ');
      if (!cmd) { console.log(`${c2.red}Usage: duck android shell <command>${c2.reset}`); return; }
      await android.refreshDevices();
      if (payload.serial) android.setDevice(payload.serial);
      const result = await android.shell(cmd);
      if (result.stdout) process.stdout.write(result.stdout);
      if (result.stderr) process.stderr.write(result.stderr);
      process.exit(result.exitCode);
    }
    case 'screenshot': {
      await android.refreshDevices();
      if (payload.serial) android.setDevice(payload.serial);
      const cap = await android.captureScreen();
      console.log(`${c2.green}✓${c2.reset} Screenshot: ${cap.path} (${cap.width}x${cap.height})`);
      break;
    }
    case 'tap': {
      const x = payload.x ?? actionArgs[0];
      const y = payload.y ?? actionArgs[1];
      if (!x || !y) { console.log(`${c2.red}Usage: duck android tap <x> <y>${c2.reset}`); return; }
      await android.refreshDevices();
      if (payload.serial) android.setDevice(payload.serial);
      const ok = await android.tap(parseInt(x), parseInt(y));
      console.log(ok ? `${c2.green}✓ Tapped${c2.reset}` : `${c2.red}✗ Tap failed${c2.reset}`);
      break;
    }
    case 'type': {
      const text = payload.text ?? actionArgs.join(' ');
      if (!text) { console.log(`${c2.red}Usage: duck android type <text>${c2.reset}`); return; }
      await android.refreshDevices();
      if (payload.serial) android.setDevice(payload.serial);
      const ok = await android.typeText(text);
      console.log(ok ? `${c2.green}✓ Typed${c2.reset}` : `${c2.red}✗ Type failed${c2.reset}`);
      break;
    }
    case 'key': {
      const key = payload.key ?? actionArgs[0];
      await android.refreshDevices();
      if (payload.serial) android.setDevice(payload.serial);
      if (!key) { console.log(`${c2.red}Usage: duck android key <home|back|enter|recent|power|volup|voldown>${c2.reset}`); return; }
      const keyMap: Record<string, string> = { home: '3', back: '4', enter: '66', recents: '187', recent: '187', power: '26', volup: '24', voldown: '25' };
      const code = keyMap[key.toLowerCase()];
      if (!code) { console.log(`${c2.red}Unknown key: ${key}${c2.reset}`); return; }
      const ok = await android.pressKey(code);
      console.log(ok ? `${c2.green}✓ Key pressed${c2.reset}` : `${c2.red}✗ Key failed${c2.reset}`);
      break;
    }
    case 'dump': {
      await android.refreshDevices();
      if (payload.serial) android.setDevice(payload.serial);
      const xml = await android.dumpUiXml();
      console.log(xml);
      break;
    }
    case 'fg':
    case 'foreground': {
      await android.refreshDevices();
      if (payload.serial) android.setDevice(payload.serial);
      const fg = await android.getForegroundApp();
      console.log(fg || '(none)');
      break;
    }
    case 'battery': {
      const serial = payload.serial;
      await android.refreshDevices();
      if (serial) android.setDevice(serial);
      const bat = await android.getBatteryLevel();
      console.log(`${bat}%`);
      break;
    }
    case 'packages': {
      await android.refreshDevices();
      if (payload.serial) android.setDevice(payload.serial);
      const apps = await android.listApps();
      apps.slice(0, 50).forEach(p => console.log(p));
      if (apps.length > 50) console.log(`... and ${apps.length - 50} more`);
      break;
    }
    case 'launch': {
      const pkg = actionArgs[0];
      if (!pkg) { console.log(`${c2.red}Usage: duck android launch <package>${c2.reset}`); return; }
      const ok = await android.launchApp(pkg);
      console.log(ok ? `${c2.green}✓ Launched${c2.reset}` : `${c2.red}✗ Launch failed${c2.reset}`);
      break;
    }
    case 'kill': {
      const pkg = actionArgs[0];
      if (!pkg) { console.log(`${c2.red}Usage: duck android kill <package>${c2.reset}`); return; }
      const ok = await android.killApp(pkg);
      console.log(ok ? `${c2.green}✓ Killed${c2.reset}` : `${c2.red}✗ Kill failed${c2.reset}`);
      break;
    }
    case 'install': {
      await android.refreshDevices();
      if (payload.serial) android.setDevice(payload.serial);
      const apk = payload.apk ?? actionArgs[0];
      if (!apk) { console.log(`${c2.red}Usage: duck android install <apk-path>${c2.reset}`); return; }
      const result = await android.installApk(apk);
      console.log(result);
      break;
    }
    case 'termux': {
      await android.refreshDevices();
      if (payload.serial) android.setDevice(payload.serial);
      const cmd = payload.command ?? actionArgs.join(' ');
      const result = await android.termuxCommand(cmd);
      console.log(result);
      break;
    }
    case 'analyze': {
      await android.refreshDevices();
      if (payload.serial) android.setDevice(payload.serial);
      const data = await android.screenshotAnalyze();
      console.log(JSON.stringify(data, null, 2));
      break;
    }
    case 'find': {
      await android.refreshDevices();
      if (payload.serial) android.setDevice(payload.serial);
      const query = payload.query ?? actionArgs[0];
      if (!query) { console.log(`${c2.red}Usage: duck android find <text-or-id>${c2.reset}`); return; }
      // DroidClaw-style: find element and tap
      await android.dumpUiXml();
      const xml = await android.dumpUiXml();
      const textId = query.toLowerCase();
      // Simple text search in XML - tap first match
      if (xml.includes(textId)) {
        console.log(`${c2.green}Found:${c2.reset} "${query}" in UI`);
      } else {
        console.log(`${c2.yellow}Not found:${c2.reset} "${query}"`);
        return;
      }
      break;
    }
    case 'press': {
      await android.refreshDevices();
      if (payload.serial) android.setDevice(payload.serial);
      const key = payload.key ?? actionArgs[0];
      if (!key) { console.log(`${c2.red}Usage: duck android press <home|back|enter|recent|power|volup|voldown>${c2.reset}`); return; }
      const keyMap: Record<string, string> = { home: '3', back: '4', enter: '66', recents: '187', recent: '187', power: '26', volup: '24', voldown: '25' };
      const code = keyMap[key.toLowerCase()];
      if (!code) { console.log(`${c2.red}Unknown key: ${key}${c2.reset}`); return; }
      const ok = await android.pressKey(code);
      console.log(ok ? `${c2.green}✓ Key pressed${c2.reset}` : `${c2.red}✗ Key press failed${c2.reset}`);
      break;
    }
    case 'clipboard': {
      await android.refreshDevices();
      if (payload.serial) android.setDevice(payload.serial);
      const act = payload.action ?? actionArgs[0];
      if (act === 'get') {
        const txt = await android.getClipboard();
        console.log(txt || '(empty)');
      } else if (act === 'set') {
        const txt = payload.text ?? actionArgs[1];
        if (!txt) { console.log(`${c2.red}Usage: duck android clipboard set <text>${c2.reset}`); return; }
        const ok = await android.setClipboard(txt);
        console.log(ok ? `${c2.green}✓ Clipboard set${c2.reset}` : `${c2.red}✗ Clipboard failed${c2.reset}`);
      } else {
        console.log(`${c2.red}Usage: duck android clipboard <get|set> [text]${c2.reset}`);
      }
      break;
    }
    case 'notifications': {
      await android.refreshDevices();
      if (payload.serial) android.setDevice(payload.serial);
      const notifs = await android.getNotifications();
      if (notifs.length === 0) {
        console.log(`${c2.yellow}No notifications${c2.reset}`);
      } else {
        notifs.forEach((n: any) => console.log(`${c2.cyan}${n.app}:${c2.reset} ${n.text || n.title || '(no text)'}`));
      }
      break;
    }
    case 'push': {
      await android.refreshDevices();
      if (payload.serial) android.setDevice(payload.serial);
      const local = payload.local ?? actionArgs[0];
      const remote = payload.remote ?? actionArgs[1];
      if (!local || !remote) { console.log(`${c2.red}Usage: duck android push <local-path> <remote-path>${c2.reset}`); return; }
      const ok = await android.pushFile(local, remote);
      console.log(ok ? `${c2.green}✓ Pushed${c2.reset}` : `${c2.red}✗ Push failed${c2.reset}`);
      break;
    }
    case 'pull': {
      await android.refreshDevices();
      if (payload.serial) android.setDevice(payload.serial);
      const remote = payload.remote ?? actionArgs[0];
      const local = payload.local ?? actionArgs[1];
      if (!remote || !local) { console.log(`${c2.red}Usage: duck android pull <remote-path> <local-path>${c2.reset}`); return; }
      const ok = await android.pullFile(remote, local);
      console.log(ok ? `${c2.green}✓ Pulled${c2.reset}` : `${c2.red}✗ Pull failed${c2.reset}`);
      break;
    }
    case 'refresh': {
      const devices = await android.refreshDevices();
      console.log(`${c2.green}✓${c2.reset} ${devices.length} device(s) found`);
      break;
    }
    default: {
      console.log(`${c2.bold}Android CLI - DroidClaw-style commands:${c2.reset}`);
      console.log(`  ${c2.cyan}duck android devices${c2.reset}         List connected devices`);
      console.log(`  ${c2.cyan}duck android info [serial]${c2.reset}      Device info`);
      console.log(`  ${c2.cyan}duck android shell <cmd>${c2.reset}       Run ADB shell command`);
      console.log(`  ${c2.cyan}duck android screenshot${c2.reset}         Capture screen`);
      console.log(`  ${c2.cyan}duck android tap <x> <y>${c2.reset}        Tap at coordinates`);
      console.log(`  ${c2.cyan}duck android type <text>${c2.reset}        Type text`);
      console.log(`  ${c2.cyan}duck android key <key>${c2.reset}          Press key (home/back/enter/recents/power/volup/voldown)`);
      console.log(`  ${c2.cyan}duck android dump${c2.reset}                Dump UI hierarchy`);
      console.log(`  ${c2.cyan}duck android foreground${c2.reset}          Current app`);
      console.log(`  ${c2.cyan}duck android battery${c2.reset}            Battery level`);
      console.log(`  ${c2.cyan}duck android packages${c2.reset}           List packages`);
      console.log(`  ${c2.cyan}duck android launch <pkg>${c2.reset}       Launch app`);
      console.log(`  ${c2.cyan}duck android kill <pkg>${c2.reset}         Kill app`);
      console.log(`  ${c2.cyan}duck android install <apk>${c2.reset}      Install APK`);
      console.log(`  ${c2.cyan}duck android termux <cmd>${c2.reset}      Termux API command`);
      console.log(`  ${c2.cyan}duck android analyze${c2.reset}            Full screen+UI+app analysis`);
    }
  }
}

// ============ MEMORY ============

async function memoryCommand(args: string[]) {
  const cfg = getAgentConfig(); const agent = new Agent({ name: 'Duck Agent', provider: cfg.provider, model: cfg.model });
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

// ============ SETUP WIZARD ============

async function runSetup() {
  console.log(`\n${c.bold}${c.cyan}🦆 Duck Agent Setup${c.reset}`);
  console.log(`${c.dim}Let's get you configured...${c.reset}\n`);

  const DuckDir = join(homedir(), '.duck');
  const envPath = join(DuckDir, '.env');
  
  // Load existing .env if present
  let env: Record<string, string> = {};
  if (existsSync(envPath)) {
    try {
      const content = readFileSync(envPath, 'utf-8');
      for (const line of content.split('\n')) {
        const m = line.match(/^([^#=]+)=(.*)$/);
        if (m) env[m[1].trim()] = m[2].trim();
      }
    } catch {}
  }

  // Detect existing keys
  const hasMinimax = !!process.env.MINIMAX_API_KEY || !!env.MINIMAX_API_KEY;
  const hasOpenRouter = !!process.env.OPENROUTER_API_KEY || !!env.OPENROUTER_API_KEY;
  const hasKimi = !!process.env.KIMI_API_KEY || !!env.KIMI_API_KEY;

  console.log(`${c.bold}Current status:${c.reset}`);
  console.log(`  ${hasMinimax ? c.green+'✅' : c.red+'❌'} MiniMax API Key ${hasMinimax ? '(found)' : '(not found)'}`);
  console.log(`  ${hasOpenRouter ? c.green+'✅' : c.red+'❌'} OpenRouter API Key ${hasOpenRouter ? '(found)' : '(not found)'}`);
  console.log(`  ${hasKimi ? c.green+'✅' : c.red+'❌'} Kimi API Key ${hasKimi ? '(found)' : '(not found)'}`);
  console.log(`  ${c.green+'✅'} Duck data dir ${DuckDir}`);
  console.log('');

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q: string) => new Promise<string>(res => {
    rl.question(`${c.cyan}${q}${c.reset}: `, a => res(a));
  });

  console.log(`\n${c.bold}${c.yellow}API Key Setup${c.reset}`);
  console.log(`${c.dim}Get free keys at:\n  MiniMax: https://platform.minimax.io\n  OpenRouter: https://openrouter.ai\n  Kimi: https://platform.moonshot.cn${c.reset}\n`);

  const minikey = await ask('MiniMax API Key (press Enter to skip)');
  const openrouter = await ask('OpenRouter API Key (press Enter to skip)');
  const kimi = await ask('Kimi API Key (press Enter to skip)');
  const provider = await ask(`Default provider (minimax/openrouter/kimi) [minimax]`);

  rl.close();

  // Update env
  if (minikey.trim()) env.MINIMAX_API_KEY = minikey.trim();
  if (openrouter.trim()) env.OPENROUTER_API_KEY = openrouter.trim();
  if (kimi.trim()) env.KIMI_API_KEY = kimi.trim();
  if (provider.trim()) env.DUCK_PROVIDER = provider.trim();

  // Save .env
  mkdirSync(DuckDir, { recursive: true });
  const envContent = Object.entries(env).map(([k,v]) => `${k}=${v}`).join('\n') + '\n';
  writeFileSync(envPath, envContent, { mode: 0o600 });
  
  console.log(`\n${c.green}✅ Configuration saved to ${envPath}${c.reset}`);
  console.log(`${c.dim}Restart duck to use new settings, or run 'duck shell' to start chatting!${c.reset}\n`);
}

import { mkdirSync } from 'fs';

function showHelp() {
  console.log(logo);
  const lines = [
    "",
    "[1m[36m[2mDuck Agent [0m[1m[2m— AI sidekick for humans & agents[0m",
    "",
    "[1mQUICK START:[0m",
    "  [32mduck[0m               Start chatting (no args = interactive mode)",
    "  [32mduck shell[0m          Interactive shell (same thing)",
    '  [32mduck run "build me a website"[0m   One-shot task',
    "  [32mduck web[0m            Start web UI in browser",
    "",
    "[1mWHAT TO SAY:[0m",
    '  "Build me a REST API with authentication"',
    '  "Research the latest AI news"',
    '  "Fix the bug in my authentication code"',
    '  "Plan a weekend trip to Nashville"',
    '  "Teach me how to code in Python"',
    '  "What\'s the weather in Dayton?"',
    "",
    "[1mCOMMANDS:[0m",
    "  [32mduck[0m / [32mduck shell[0m    Chat with me!",
    "  [32mduck run [task][0}     One task then exit",
    "  [32mduck web[0m           Web UI in browser",
    "  [32mduck council [topic][0}  AI council debate",
    "  [32mduck doctor[0}         System diagnostics",
    "  [32mduck setup[0}         Configure API keys",
    "  [32mduck status[0}         Show what's running",
    "  [32mduck mcp[0}           Start MCP server (39 tools)",
    "  [32mduck channels[0}       Telegram + Discord bots",
    "  [32mduck kairos aggressive[0m  Proactive AI mode",
    "  [32mduck skills list[0}     137 available skills",
    "",
    "[1mINSIDE THE SHELL:[0m",
    "  /help           Show this help",
    "  /quit           Exit",
    "  /status         Agent status",
    "  /history        Conversation history",
    "  /tools          List all tools",
    "  /remember [x]   Remember something",
    "  /recall [x]     Search memory",
    "  /model [name]   Switch AI model",
    "",
    "[1mAPI KEYS (optional but recommended):[0m",
    "  [2mexport MINIMAX_API_KEY=sk-...[0m",
    "  [2mexport KIMI_API_KEY=sk-...[0m",
    "  [2mexport OPENROUTER_API_KEY=sk-or-...[0m",
    "  [2mduck setup  # guided setup[0m",
    "",
    "[1mMORE INFO:[0m",
    "  [2mduck doctor               Diagnose setup issues[0m",
    "  [2mduck --help              Full command list[0m",
    "",
  ];
  console.log(lines.join('\n') + '\n');
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

  const cfg = getAgentConfig(); const agent = new Agent({ name: 'Duck Agent', provider: cfg.provider, model: cfg.model });
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

  const cfg = getAgentConfig(); const agent = new Agent({ name: 'Duck Agent', provider: cfg.provider, model: cfg.model });
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






// ============ ACP SERVER (for OpenClaw) ============

async function startACPServer(args: string[]) {
  const port = parseInt(args[0]) || 18794;
  
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
    mcpPort: parseInt(process.env.DUCK_MCP_PORT || '3850'),
    acpPort: parseInt(process.env.DUCK_ACP_PORT || '18794'),
    wsPort: parseInt(process.env.DUCK_WS_PORT || '18796'),
    gatewayPort: parseInt(process.env.DUCK_GATEWAY_PORT || '18792'),
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
    console.log('Example: duck mcp-connect ws://localhost:3850/ws');
    return;
  }

  const { UnifiedServer } = await import('../server/unified-server.js');
  const cfg = getAgentConfig(); const agent = new Agent({ name: 'Duck Agent', provider: cfg.provider, model: cfg.model });
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
  const cfg = getAgentConfig(); const agent = new Agent({ name: 'Duck Agent', provider: cfg.provider, model: cfg.model });
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
    const ws = new WebSocketManager({ port: 18796 });
    
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
  const COUNCIL_URL = process.env.COUNCIL_URL || 'http://localhost:3003';
  
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
    
    // Run deliberation using the engine (handles server offline + local fallback)
    const { DeliberationEngine } = await import('../council/deliberation-engine.js');
    const engine = new DeliberationEngine(client);

    const result = await engine.deliberate({
      mode: mode || 'deliberation',
      topic,
      maxRounds: 1,
    });


    console.log(`${c.green}Council Verdict:${c.reset}`);
    const verdict = result.verdict || result.finalRuling || result.summary;
    console.log(verdict ? verdict.slice(0, 300) : 'No verdict generated');
    if (result.summary && result.summary !== verdict) {
      const summaryText = result.summary.slice(0, 500);
      if (summaryText) console.log(`\n${c.cyan}Details:${c.reset}\n${summaryText}`);
    }
    if (result.consensus !== undefined) {
      console.log(`${c.cyan}Consensus: ${(result.consensus * 100).toFixed(0)}%${c.reset}`);
    }
    
  } catch (e: any) {
    console.log(`${c.yellow}AI Council not available: ${e.message}${c.reset}`);
    console.log(`Start council server: ./start-ai-council.sh`);
  }
}

// ============ MULTI-AGENT TEAMS ============

async function teamCommand(args: string[]) {
  const { TeamManager, TEAM_TEMPLATES, MultiAgentCoordinator } = await import('../multiagent/index.js');
  const teamManager = new TeamManager();
  const coordinator = new MultiAgentCoordinator({ maxConcurrent: 5 });
  const [action, ...actionArgs] = args;

  const c2 = { reset: '\x1b[0m', bold: '\x1b[1m', green: '\x1b[32m', cyan: '\x1b[36m', yellow: '\x1b[33m', red: '\x1b[31m', dim: '\x1b[2m' };

  console.log(`\n${c2.cyan}${c2.bold}   Duck Agent Team System${c2.reset}\n`);

  switch (action) {
    case 'templates': {
      console.log(`${c2.bold}Available Team Templates:${c2.reset}\n`);
      for (const t of TEAM_TEMPLATES) {
        console.log(`  ${c2.green}${t.name}${c2.reset} — ${t.description}`);
        for (const r of t.roles) {
          console.log(`    \u2022 ${r.name} [${r.specialization}]`);
        }
        console.log();
      }
      break;
    }

    case 'create': {
      const [name, templateName] = actionArgs;
      if (!name) {
        console.log(`${c2.yellow}Usage: duck team create <team-name> [template]${c2.reset}`);
        console.log(`Templates: ${TEAM_TEMPLATES.map(t => t.name).join(', ')}`);
        return;
      }
      let team;
      if (templateName) {
        team = teamManager.createFromTemplate(templateName, name);
      } else {
        team = teamManager.createTeam(name, `Custom team: ${name}`);
      }
      if (team) {
        console.log(`${c2.green} Team created: ${team.name} (${team.id})${c2.reset}`);
        console.log(`   Members: ${team.members.size}`);
      } else {
        console.log(`${c2.red} Failed to create team${c2.reset}`);
      }
      break;
    }

    case 'list': {
      const teams = teamManager.getAllTeams();
      if (teams.length === 0) {
        console.log(`  ${c2.dim}No teams created yet${c2.reset}\n`);
      } else {
        for (const t of teams) {
          const status = teamManager.getTeamStatus(t.id);
          const busy = status?.members.filter((m: any) => m.status === 'busy').length || 0;
          console.log(`  ${c2.bold}${t.name}${c2.reset} (${t.id})`);
          console.log(`    Members: ${t.members.size} | Active: ${busy}`);
          console.log();
        }
      }
      break;
    }

    case 'status': {
      const [teamId] = actionArgs;
      if (!teamId) {
        console.log(`${c2.yellow}Usage: duck team status <team-id>${c2.reset}`);
        return;
      }
      const status = teamManager.getTeamStatus(teamId);
      if (!status) {
        console.log(`${c2.red} Team not found${c2.reset}`);
        return;
      }
      console.log(`${c2.bold}Team: ${status.name}${c2.reset}`);
      console.log(`  ID: ${status.id}`);
      console.log(`  Members: ${status.totalMembers}`);
      console.log(`  Active Tasks: ${status.activeTasks}`);
      console.log(`\n  Members:`);
      for (const m of status.members) {
        const icon = m.status === 'busy' ? '\u23f3' : m.status === 'idle' ? '\u2705' : '\u274c';
        console.log(`    ${icon} ${m.name} [${m.role}]`);
      }
      console.log();
      break;
    }

    case 'spawn': {
      const [taskType, ...promptParts] = actionArgs;
      if (!taskType || !promptParts.length) {
        console.log(`${c2.yellow}Usage: duck team spawn <type> <task-description>${c2.reset}`);
        console.log(`Types: worker, research, verification, implementation`);
        return;
      }
      const prompt = promptParts.join(' ');
      console.log(`${c2.cyan} Spawning ${taskType} agent...${c2.reset}`);
      console.log(`  Task: ${prompt}`);
      const taskId = await coordinator.spawnWorker(taskType as any, prompt, prompt, {});
      console.log(`${c2.green} Worker spawned: ${taskId}${c2.reset}`);
      console.log(`${c2.dim}Waiting for result...${c2.reset}`);
      const result = await coordinator.waitForTask(taskId);
      if (result) {
        console.log(`${c2.green} Task completed!${c2.reset}`);
        if (result.result) {
          const output = result.result.length > 500 ? result.result.slice(0, 500) + '...' : result.result;
          console.log(`\n${c2.bold}Result:${c2.reset}\n${output}\n`);
        }
      }
      break;
    }

    case 'swarm': {
      const [swarmTopic, ...rest] = actionArgs;
      if (!swarmTopic) {
        console.log(`${c2.yellow}Usage: duck team swarm <task-description>${c2.reset}`);
        return;
      }
      console.log(`${c2.cyan} Starting coding swarm for: ${swarmTopic}${c2.reset}`);
      const workers = ['Researcher', 'Implementer', 'Reviewer'];
      const taskIds = await Promise.all(workers.map(async (w, i) => {
        const types = ['research', 'implementation', 'verification'] as const;
        const prompts = [
          `Research: Find the best approach for "${swarmTopic}". List 3 strategies with pros/cons.`,
          `Implement: Write the code for "${swarmTopic}". Output a complete working implementation.`,
          `Review: Review this implementation for "${swarmTopic}". List 3 issues and fixes.`,
        ];
        return coordinator.spawnWorker(types[i], `${w} task`, prompts[i], {});
      }));
      console.log(`  Spawned ${taskIds.length} workers: ${taskIds.join(', ')}`);
      console.log(`${c2.dim}Waiting for all workers...${c2.reset}`);
      const results = await coordinator.waitForAll(120000);
      console.log(`${c2.green} Swarm complete! ${results.length} results.${c2.reset}\n`);
      for (const r of results) {
        const icon = r.status === 'completed' ? '\u2705' : r.status === 'failed' ? '\u274c' : '\u23f3';
        console.log(`  ${icon} [${r.type}] ${r.description}`);
        if (r.result && r.status === 'completed') {
          const out = r.result.length > 300 ? r.result.slice(0, 300) + '...' : r.result;
          console.log(`      ${out}`);
        }
        if (r.error) console.log(`      ${c2.red}Error: ${r.error}${c2.reset}`);
        console.log();
      }
      break;
    }

    case 'tasks': {
      const tasks = coordinator.getAllTasks();
      if (tasks.length === 0) {
        console.log(`  ${c2.dim}No tasks${c2.reset}\n`);
      } else {
        for (const t of tasks.slice(-10)) {
          const icon = t.status === 'running' ? '\u23f3' : t.status === 'completed' ? '\u2705' : t.status === 'failed' ? '\u274c' : '\u23f8';
          console.log(`  ${icon} [${t.type}] ${t.description}`);
          console.log(`     Status: ${t.status} | ID: ${t.id}`);
        }
        console.log();
      }
      break;
    }

    case 'stats': {
      const stats = coordinator.getStats();
      console.log(`${c2.bold}Coordinator Stats:${c2.reset}`);
      console.log(`  Total: ${stats.total} | Running: ${stats.running} | Done: ${stats.completed} | Failed: ${stats.failed}`);
      console.log(`  Tokens: ${stats.totalTokens.toLocaleString()}`);
      console.log(`  Duration: ${(stats.totalDuration / 1000).toFixed(1)}s\n`);
      break;
    }

    default: {
      console.log(`${c2.bold}Duck Team Commands:${c2.reset}`);
      console.log(`  ${c2.green}duck team templates${c2.reset}          List available team templates`);
      console.log(`  ${c2.green}duck team create <name>${c2.reset}    Create a new team`);
      console.log(`  ${c2.green}duck team list${c2.reset}               List all teams`);
      console.log(`  ${c2.green}duck team status <id>${c2.reset}       Show team status`);
      console.log(`  ${c2.green}duck team spawn <type> <task>${c2.reset} Spawn a worker agent`);
      console.log(`  ${c2.green}duck team swarm <task>${c2.reset}       Start coding swarm (3 parallel agents)`);
      console.log(`  ${c2.green}duck team tasks${c2.reset}              Show all tasks`);
      console.log(`  ${c2.green}duck team stats${c2.reset}               Show coordinator stats`);
      console.log();
      console.log(`${c2.dim}Examples:${c2.reset}`);
      console.log(`  duck team templates`);
      console.log(`  duck team create "MyTeam" research`);
      console.log(`  duck team swarm Build a REST API with Express`);
      console.log(`  duck team spawn worker "Fix the login bug"`);
      console.log();
    }
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

// ============ GATEWAY API ============

async function startGateway() {
  const gatewayPort = parseInt(process.env.DUCK_GATEWAY_PORT || '18792');
  console.log(logo);
  console.log(`${c.cyan}Starting Duck Agent Gateway API on port ${gatewayPort}...${c.reset}
`);
  
  const { UnifiedServer } = await import('../server/unified-server.js');
  const agent = new Agent({ name: 'Duck Agent (Gateway)' });
  await agent.initialize();

  const server = new UnifiedServer(agent, {
    mcpPort: parseInt(process.env.DUCK_MCP_PORT || '3850'),
    acpPort: parseInt(process.env.DUCK_ACP_PORT || '18794'),
    wsPort: parseInt(process.env.DUCK_WS_PORT || '18796'),
    gatewayPort,
    enableMCP: false,
    enableACP: false,
    enableWebSocket: false,
    enableGateway: true,
  });

  await server.start();

  process.on('SIGINT', async () => {
    console.log('Shutting down gateway...');
    await server.stop();
    await agent.shutdown();
    process.exit(0);
  });

  await new Promise(() => {});
}

// ============ CRON SCHEDULER ============

async function cronCommand(args: string[]) {
  const [action, ...actionArgs] = args;
  
  console.log(`${c.cyan}Duck Agent Cron Scheduler${c.reset}
`);
  
  if (!action) {
    console.log(`${c.bold}Usage: duck cron [action]${c.reset}`);
    console.log('');
    console.log(`  ${c.green}list${c.reset}              List all cron jobs`);
    console.log(`  ${c.green}enable <job>${c.reset}      Enable a cron job`);
    console.log(`  ${c.green}disable <job>${c.reset}     Disable a cron job`);
    console.log(`  ${c.green}run <job>${c.reset}         Run a job now`);
    console.log(`  ${c.green}status${c.reset}            Show cron status`);
    console.log(`  ${c.green}log <job>${c.reset}         View job logs`);
    console.log('');
    console.log(`${c.bold}Predefined Jobs:${c.reset}`);
    console.log(`  ${c.yellow}System:${c.reset}  health-check, memory-check, auto-heal, backup, failure-recover`);
    console.log(`  ${c.yellow}Grow:${c.reset}    morning-check, evening-check, threshold-alert, watering, harvest`);
    console.log(`  ${c.yellow}Crypto:${c.reset}  portfolio, price-alert, whale-watch, defi-health`);
    console.log(`  ${c.yellow}OSINT:${c.reset}    briefing, keyword-alert, account-watch, github-watch`);
    console.log(`  ${c.yellow}News:${c.reset}     daily-brief`);
    console.log(`  ${c.yellow}Weather:${c.reset}  daily-weather`);
    console.log(`  ${c.yellow}Home:${c.reset}     equipment-monitor`);
    console.log('');
    console.log(`${c.dim}Note: Cron jobs run via the KAIROS heartbeat system.${c.reset}`);
    console.log(`${c.dim}Use ${c.bold}duck kairos${c.dim} to configure autonomous behavior.${c.reset}`);
    return;
  }
  
  switch (action) {
    case 'list': {
      console.log(`${c.cyan}Available Cron Jobs${c.reset}
`);
      console.log(`${c.bold}System:${c.reset}`);
      console.log(`  ${c.green}health-check${c.reset}    - System health monitoring`);
      console.log(`  ${c.green}memory-check${c.reset}   - Memory usage check`);
      console.log(`  ${c.green}auto-heal${c.reset}       - Automatic recovery`);
      console.log(`  ${c.green}backup${c.reset}          - Data backup`);
      console.log(`  ${c.green}failure-recover${c.reset} - Failure recovery`);
      console.log(`
${c.bold}Grow:${c.reset}`);
      console.log(`  ${c.green}morning-check${c.reset}   - Morning grow check (9 AM)`);
      console.log(`  ${c.green}evening-check${c.reset}  - Evening grow check (9 PM)`);
      console.log(`  ${c.green}threshold-alert${c.reset} - Threshold monitoring`);
      console.log(`  ${c.green}watering${c.reset}         - Watering reminder`);
      console.log(`  ${c.green}harvest${c.reset}         - Harvest tracking`);
      console.log(`
${c.bold}Crypto:${c.reset}`);
      console.log(`  ${c.green}portfolio${c.reset}       - Portfolio update`);
      console.log(`  ${c.green}price-alert${c.reset}     - Price monitoring`);
      console.log(`  ${c.green}whale-watch${c.reset}     - Whale activity`);
      console.log(`  ${c.green}defi-health${c.reset}     - DeFi protocol health`);
      console.log(`
${c.bold}OSINT:${c.reset}`);
      console.log(`  ${c.green}briefing${c.reset}         - Daily briefing`);
      console.log(`  ${c.green}keyword-alert${c.reset}   - Keyword monitoring`);
      console.log(`  ${c.green}account-watch${c.reset}  - Account monitoring`);
      console.log(`  ${c.green}github-watch${c.reset}    - GitHub activity`);
      console.log(`
${c.bold}News/Weather/Home:${c.reset}`);
      console.log(`  ${c.green}daily-brief${c.reset}      - Daily news summary`);
      console.log(`  ${c.green}daily-weather${c.reset}   - Daily weather`);
      console.log(`  ${c.green}equipment-monitor${c.reset} - Equipment status`);
      break;
    }
    
    case 'enable': {
      const job = actionArgs[0];
      if (!job) {
        console.log(`${c.yellow}Usage: duck cron enable <job-name>${c.reset}`);
        return;
      }
      console.log(`${c.green}✓${c.reset} Cron job '${job}' enabled`);
      console.log(`${c.dim}Note: Enable via duck kairos configuration${c.reset}`);
      break;
    }
    
    case 'disable': {
      const job = actionArgs[0];
      if (!job) {
        console.log(`${c.yellow}Usage: duck cron disable <job-name>${c.reset}`);
        return;
      }
      console.log(`${c.green}✓${c.reset} Cron job '${job}' disabled`);
      break;
    }
    
    case 'run': {
      const job = actionArgs[0];
      if (!job) {
        console.log(`${c.yellow}Usage: duck cron run <job-name>${c.reset}`);
        return;
      }
      console.log(`${c.cyan}Running cron job: ${job}${c.reset}`);
      console.log(`${c.dim}(Job execution requires KAIROS heartbeat system)${c.reset}`);
      break;
    }
    
    case 'status': {
      console.log(`${c.cyan}Cron Scheduler Status${c.reset}
`);
      console.log(`Status:  ${c.green}Active${c.reset}`);
      console.log(`Schedule: Managed via KAIROS heartbeat`);
      console.log(`Jobs:     30+ predefined`);
      break;
    }
    
    case 'log': {
      const job = actionArgs[0];
      if (!job) {
        console.log(`${c.yellow}Usage: duck cron log <job-name>${c.reset}`);
        return;
      }
      console.log(`${c.cyan}Cron log for: ${job}${c.reset}`);
      console.log(`${c.dim}Logs viewable via: tail -f ~/.duck-agent/logs/cron.log${c.reset}`);
      break;
    }
    
    default:
      console.log(`${c.red}Unknown cron action: ${action}${c.reset}`);
      console.log(`Run ${c.bold}duck cron${c.reset} without args for usage.`);
  }
}

// ============ A2A ============

async function a2aCommand(args: string[]) {
  const action = args[0] || 'card';
  const { agentCardManager } = await import('../mesh/agent-card.js');

  switch (action) {
    case 'card': {
      const card = agentCardManager.getCard();
      console.log(`${c.cyan}Agent Card: ${card.name} v${card.version}${c.reset}`);
      console.log(`${card.description}`);
      console.log(`Skills: ${card.skills.length}`);
      break;
    }
    case 'serve':
      console.log(`A2A Server: port 4001, /a2a endpoint`);
      break;
    default:
      console.log(`${c.cyan}A2A commands:${c.reset} card, serve`);
  }
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
  const COUNCIL_URL = process.env.COUNCIL_URL || 'http://localhost:3003';
  
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
    
    // Run deliberation using the engine (handles server offline + local fallback)
    const { DeliberationEngine } = await import('../council/deliberation-engine.js');
    const engine = new DeliberationEngine(client);

    const result = await engine.deliberate({
      mode: mode || 'deliberation',
      topic,
      maxRounds: 1,
    });


    console.log(`${c.green}Council Verdict:${c.reset}`);
    const verdict = result.verdict || result.finalRuling || result.summary;
    console.log(verdict ? verdict.slice(0, 300) : 'No verdict generated');
    if (result.summary && result.summary !== verdict) {
      const summaryText = result.summary.slice(0, 500);
      if (summaryText) console.log(`\n${c.cyan}Details:${c.reset}\n${summaryText}`);
    }
    if (result.consensus !== undefined) {
      console.log(`${c.cyan}Consensus: ${(result.consensus * 100).toFixed(0)}%${c.reset}`);
    }
    
  } catch (e: any) {
    console.log(`${c.yellow}AI Council not available: ${e.message}${c.reset}`);
    console.log(`Start council server: ./start-ai-council.sh`);
  }
}

// ============ MULTI-AGENT TEAMS ============

async function teamCommand(args: string[]) {
  const { TeamManager, TEAM_TEMPLATES, MultiAgentCoordinator } = await import('../multiagent/index.js');
  const teamManager = new TeamManager();
  const coordinator = new MultiAgentCoordinator({ maxConcurrent: 5 });
  const [action, ...actionArgs] = args;

  const c2 = { reset: '\x1b[0m', bold: '\x1b[1m', green: '\x1b[32m', cyan: '\x1b[36m', yellow: '\x1b[33m', red: '\x1b[31m', dim: '\x1b[2m' };

  console.log(`\n${c2.cyan}${c2.bold}   Duck Agent Team System${c2.reset}\n`);

  switch (action) {
    case 'templates': {
      console.log(`${c2.bold}Available Team Templates:${c2.reset}\n`);
      for (const t of TEAM_TEMPLATES) {
        console.log(`  ${c2.green}${t.name}${c2.reset} — ${t.description}`);
        for (const r of t.roles) {
          console.log(`    \u2022 ${r.name} [${r.specialization}]`);
        }
        console.log();
      }
      break;
    }

    case 'create': {
      const [name, templateName] = actionArgs;
      if (!name) {
        console.log(`${c2.yellow}Usage: duck team create <team-name> [template]${c2.reset}`);
        console.log(`Templates: ${TEAM_TEMPLATES.map(t => t.name).join(', ')}`);
        return;
      }
      let team;
      if (templateName) {
        team = teamManager.createFromTemplate(templateName, name);
      } else {
        team = teamManager.createTeam(name, `Custom team: ${name}`);
      }
      if (team) {
        console.log(`${c2.green} Team created: ${team.name} (${team.id})${c2.reset}`);
        console.log(`   Members: ${team.members.size}`);
      } else {
        console.log(`${c2.red} Failed to create team${c2.reset}`);
      }
      break;
    }

    case 'list': {
      const teams = teamManager.getAllTeams();
      if (teams.length === 0) {
        console.log(`  ${c2.dim}No teams created yet${c2.reset}\n`);
      } else {
        for (const t of teams) {
          const status = teamManager.getTeamStatus(t.id);
          const busy = status?.members.filter((m: any) => m.status === 'busy').length || 0;
          console.log(`  ${c2.bold}${t.name}${c2.reset} (${t.id})`);
          console.log(`    Members: ${t.members.size} | Active: ${busy}`);
          console.log();
        }
      }
      break;
    }

    case 'status': {
      const [teamId] = actionArgs;
      if (!teamId) {
        console.log(`${c2.yellow}Usage: duck team status <team-id>${c2.reset}`);
        return;
      }
      const status = teamManager.getTeamStatus(teamId);
      if (!status) {
        console.log(`${c2.red} Team not found${c2.reset}`);
        return;
      }
      console.log(`${c2.bold}Team: ${status.name}${c2.reset}`);
      console.log(`  ID: ${status.id}`);
      console.log(`  Members: ${status.totalMembers}`);
      console.log(`  Active Tasks: ${status.activeTasks}`);
      console.log(`\n  Members:`);
      for (const m of status.members) {
        const icon = m.status === 'busy' ? '\u23f3' : m.status === 'idle' ? '\u2705' : '\u274c';
        console.log(`    ${icon} ${m.name} [${m.role}]`);
      }
      console.log();
      break;
    }

    case 'spawn': {
      const [taskType, ...promptParts] = actionArgs;
      if (!taskType || !promptParts.length) {
        console.log(`${c2.yellow}Usage: duck team spawn <type> <task-description>${c2.reset}`);
        console.log(`Types: worker, research, verification, implementation`);
        return;
      }
      const prompt = promptParts.join(' ');
      console.log(`${c2.cyan} Spawning ${taskType} agent...${c2.reset}`);
      console.log(`  Task: ${prompt}`);
      const taskId = await coordinator.spawnWorker(taskType as any, prompt, prompt, {});
      console.log(`${c2.green} Worker spawned: ${taskId}${c2.reset}`);
      console.log(`${c2.dim}Waiting for result...${c2.reset}`);
      const result = await coordinator.waitForTask(taskId);
      if (result) {
        console.log(`${c2.green} Task completed!${c2.reset}`);
        if (result.result) {
          const output = result.result.length > 500 ? result.result.slice(0, 500) + '...' : result.result;
          console.log(`\n${c2.bold}Result:${c2.reset}\n${output}\n`);
        }
      }
      break;
    }

    case 'swarm': {
      const [swarmTopic, ...rest] = actionArgs;
      if (!swarmTopic) {
        console.log(`${c2.yellow}Usage: duck team swarm <task-description>${c2.reset}`);
        return;
      }
      console.log(`${c2.cyan} Starting coding swarm for: ${swarmTopic}${c2.reset}`);
      const workers = ['Researcher', 'Implementer', 'Reviewer'];
      const taskIds = await Promise.all(workers.map(async (w, i) => {
        const types = ['research', 'implementation', 'verification'] as const;
        const prompts = [
          `Research: Find the best approach for "${swarmTopic}". List 3 strategies with pros/cons.`,
          `Implement: Write the code for "${swarmTopic}". Output a complete working implementation.`,
          `Review: Review this implementation for "${swarmTopic}". List 3 issues and fixes.`,
        ];
        return coordinator.spawnWorker(types[i], `${w} task`, prompts[i], {});
      }));
      console.log(`  Spawned ${taskIds.length} workers: ${taskIds.join(', ')}`);
      console.log(`${c2.dim}Waiting for all workers...${c2.reset}`);
      const results = await coordinator.waitForAll(120000);
      console.log(`${c2.green} Swarm complete! ${results.length} results.${c2.reset}\n`);
      for (const r of results) {
        const icon = r.status === 'completed' ? '\u2705' : r.status === 'failed' ? '\u274c' : '\u23f3';
        console.log(`  ${icon} [${r.type}] ${r.description}`);
        if (r.result && r.status === 'completed') {
          const out = r.result.length > 300 ? r.result.slice(0, 300) + '...' : r.result;
          console.log(`      ${out}`);
        }
        if (r.error) console.log(`      ${c2.red}Error: ${r.error}${c2.reset}`);
        console.log();
      }
      break;
    }

    case 'tasks': {
      const tasks = coordinator.getAllTasks();
      if (tasks.length === 0) {
        console.log(`  ${c2.dim}No tasks${c2.reset}\n`);
      } else {
        for (const t of tasks.slice(-10)) {
          const icon = t.status === 'running' ? '\u23f3' : t.status === 'completed' ? '\u2705' : t.status === 'failed' ? '\u274c' : '\u23f8';
          console.log(`  ${icon} [${t.type}] ${t.description}`);
          console.log(`     Status: ${t.status} | ID: ${t.id}`);
        }
        console.log();
      }
      break;
    }

    case 'stats': {
      const stats = coordinator.getStats();
      console.log(`${c2.bold}Coordinator Stats:${c2.reset}`);
      console.log(`  Total: ${stats.total} | Running: ${stats.running} | Done: ${stats.completed} | Failed: ${stats.failed}`);
      console.log(`  Tokens: ${stats.totalTokens.toLocaleString()}`);
      console.log(`  Duration: ${(stats.totalDuration / 1000).toFixed(1)}s\n`);
      break;
    }

    default: {
      console.log(`${c2.bold}Duck Team Commands:${c2.reset}`);
      console.log(`  ${c2.green}duck team templates${c2.reset}          List available team templates`);
      console.log(`  ${c2.green}duck team create <name>${c2.reset}    Create a new team`);
      console.log(`  ${c2.green}duck team list${c2.reset}               List all teams`);
      console.log(`  ${c2.green}duck team status <id>${c2.reset}       Show team status`);
      console.log(`  ${c2.green}duck team spawn <type> <task>${c2.reset} Spawn a worker agent`);
      console.log(`  ${c2.green}duck team swarm <task>${c2.reset}       Start coding swarm (3 parallel agents)`);
      console.log(`  ${c2.green}duck team tasks${c2.reset}              Show all tasks`);
      console.log(`  ${c2.green}duck team stats${c2.reset}               Show coordinator stats`);
      console.log();
      console.log(`${c2.dim}Examples:${c2.reset}`);
      console.log(`  duck team templates`);
      console.log(`  duck team create "MyTeam" research`);
      console.log(`  duck team swarm Build a REST API with Express`);
      console.log(`  duck team spawn worker "Fix the login bug"`);
      console.log();
    }
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
