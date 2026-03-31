#!/usr/bin/env node

/**
 * Duck CLI - TypeScript Agent Core
 * 
 * Graceful handling of missing API keys:
 * - Shows provider status
 * - Falls back to available providers
 * - Helpful setup instructions
 */

import { Agent, AgentConfig } from './agent.js';
import { ToolRegistry } from '../tools/registry.js';
import { ProviderManager } from '../providers/manager.js';
import { MCPManager } from '../mcp/manager.js';
import { SkillRunner } from '../skills/runner.js';
import { SecurityMonitor } from '../security/monitor.js';
import { CouncilRunner } from '../council/runner.js';
import { MemorySystem } from '../memory/system.js';
import { parseArgs } from './args.js';

// Colors
const colors = {
  gold: '\x1b[33m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  dim: '\x1b[2m',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  cyan: '\x1b[36m'
};

const logo = `
${colors.gold}${colors.bold} Duck CLI${colors.reset} - The Ultimate AI Coding Agent
${colors.dim}Version 0.1.0${colors.reset}
`;

async function main() {
  const args = parseArgs(process.argv.slice(2));

  console.log(logo);

  // Initialize providers first
  const providers = new ProviderManager();
  await providers.load();

  // Handle command modes
  if (args.agentList) {
    console.log('Active agents: (coming soon)');
    return;
  }

  if (args.agentSpawn) {
    console.log(`${colors.dim}Spawning agent: ${args.agentSpawn}${colors.reset}`);
    // TODO: Implement agent spawning
    return;
  }

  if (args.mcpList) {
    const mcp = new MCPManager();
    await mcp.load();
    const servers = mcp.listServers();
    console.log(`MCP Servers (${servers.length}):`);
    servers.forEach(s => console.log(`  • ${s}`));
    return;
  }

  if (args.mcpAdd) {
    console.log(`${colors.dim}Adding MCP server: ${args.mcpAdd}${colors.reset}`);
    // TODO: Implement MCP server addition
    return;
  }

  if (args.skillsList) {
    const runner = new SkillRunner();
    await runner.loadSkills();
    const skills = runner.listSkills();
    console.log(`Skills (${skills.length}):`);
    skills.forEach(s => console.log(`  • ${colors.green}${s.metadata.name}${colors.reset} - ${s.metadata.description}`));
    return;
  }

  if (args.skillsSearch) {
    const runner = new SkillRunner();
    await runner.loadSkills();
    const results = runner.search(args.skillsSearch);
    console.log(`Search results for "${args.skillsSearch}":`);
    results.forEach(s => console.log(`  • ${colors.green}${s.metadata.name}${colors.reset}`));
    return;
  }

  if (args.securityAudit || args.securityDefcon) {
    const monitor = new SecurityMonitor();
    if (args.securityAudit) {
      await monitor.audit();
    }
    console.log(`\n${monitor.getStatus()}`);
    return;
  }

  if (args.council) {
    const status = providers.getStatus();
    const hasApiKey = status.some(s => s.name === 'anthropic' && s.available);
    
    if (!hasApiKey) {
      console.log(`${colors.yellow}⚠️  AI Council requires ANTHROPIC_API_KEY${colors.reset}`);
      console.log(providers.getSetupInstructions());
      return;
    }

    const council = new CouncilRunner();
    try {
      const response = await council.deliberate(args.council, args.councilMode || 'decision');
      console.log(`\n${colors.gold}AI Council Response:${colors.reset}\n`);
      console.log(response.consensus);
      console.log(`\n${colors.dim}Votes: ${JSON.stringify(response.votes)}${colors.reset}`);
    } catch (error) {
      console.error(`${colors.red}Council error: ${error}${colors.reset}`);
    }
    return;
  }

  if (args.shell) {
    await runShell();
    return;
  }

  if (args.run) {
    await runTask(args.run);
    return;
  }

  // Default: show help + provider status
  console.log(`
${colors.bold}Usage:${colors.reset}
  duck run "task"           Run a task
  duck -i                   Interactive shell
  duck agent spawn <name> <task>  Spawn an agent
  duck mcp list            List MCP servers
  duck skills list          List skills
  duck security audit       Run security audit
  duck council "question"   Ask AI Council

${colors.bold}Provider Status:${colors.reset}`);
  printProviderStatus(providers);
  
  console.log(`
${colors.dim}Examples:${colors.reset}
  duck run "Fix the login bug"
  duck -i
  duck council "Should we refactor the auth system?"
`);
}

function printProviderStatus(providers: ProviderManager): void {
  const status = providers.getStatus();
  const available = providers.listAvailable();

  for (const s of status) {
    if (s.available) {
      console.log(`  ${colors.green}✓${colors.reset} ${s.name} - ready`);
    } else if (s.requiresKey && !s.keyConfigured) {
      console.log(`  ${colors.dim}○${colors.reset} ${s.name} - configure ${colors.cyan}${getEnvVar(s.name)}${colors.reset}`);
    } else {
      console.log(`  ${colors.dim}○${colors.reset} ${s.name} - unavailable`);
    }
  }

  if (available.length === 0) {
    console.log(`\n${colors.yellow}⚠️  No providers available!${colors.reset}`);
    console.log(providers.getSetupInstructions());
  } else {
    console.log(`\n${colors.green}Using: ${available[0]}${colors.reset}`);
  }
}

function getEnvVar(provider: string): string {
  const map: Record<string, string> = {
    anthropic: 'ANTHROPIC_API_KEY',
    openai: 'OPENAI_API_KEY',
    minimax: 'MINIMAX_API_KEY',
    lmstudio: 'LMSTUDIO_URL (optional)'
  };
  return map[provider] || provider.toUpperCase() + '_API_KEY';
}

async function runShell() {
  const readline = await import('readline');
  
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: `${colors.gold}🦆${colors.reset} `
  });

  const agent = await createAgent();

  rl.prompt();

  rl.on('line', async (line) => {
    const input = line.trim();
    
    if (!input) {
      rl.prompt();
      return;
    }

    if (input === ':quit' || input === ':q' || input === 'exit') {
      console.log(`${colors.dim}Goodbye!${colors.reset}`);
      process.exit(0);
    }

    if (input.startsWith('/')) {
      await handleSkill(input, rl);
      rl.prompt();
      return;
    }

    try {
      process.stdout.write(`${colors.dim}Thinking...${colors.reset}\n`);
      const response = await agent.run(input);
      console.log(`\n${response}\n`);
    } catch (error) {
      console.error(`${colors.red}Error: ${error}${colors.reset}`);
    }

    rl.prompt();
  });
}

async function handleSkill(input: string, rl: any) {
  const parts = input.slice(1).split(' ');
  const skillName = parts[0];
  const args = parts.slice(1).join(' ');

  const runner = new SkillRunner();
  await runner.loadSkills();

  try {
    const result = await runner.run(skillName, { args, cwd: process.cwd() });
    console.log(result.output || result.error);
  } catch (error) {
    console.error(`${colors.red}Skill error: ${error}${colors.reset}`);
  }
}

async function runTask(prompt: string) {
  const providers = new ProviderManager();
  await providers.load();

  if (providers.listAvailable().length === 0) {
    console.log(`${colors.red}✗ No AI providers available!${colors.reset}`);
    console.log(providers.getSetupInstructions());
    process.exit(1);
  }

  console.log(`${colors.dim}Initializing agent...${colors.reset}\n`);
  console.log(`${colors.dim}Using provider: ${providers.listAvailable()[0]}${colors.reset}\n`);

  const agent = await createAgent();
  
  try {
    console.log(`${colors.dim}Running task...${colors.reset}\n`);
    const response = await agent.run(prompt);
    console.log(response);
  } catch (error) {
    console.error(`${colors.red}Error: ${error}${colors.reset}`);
    console.log(`\n${colors.dim}Provider status:${colors.reset}`);
    printProviderStatus(providers);
    process.exit(1);
  }
}

async function createAgent(): Promise<Agent> {
  const tools = new ToolRegistry();
  await tools.load();

  const providers = new ProviderManager();
  await providers.load();

  if (providers.listAvailable().length === 0) {
    throw new Error('No AI providers available. Configure an API key or start LM Studio.');
  }

  const mcp = new MCPManager();
  await mcp.load();
  const mcpTools = await mcp.getTools();
  mcpTools.forEach(tool => tools.registerExternal(tool));

  const config: AgentConfig = {
    model: process.env.DUCK_MODEL || 'claude-3-5-sonnet-20241022',
    provider: providers.getDefault(),
    tools: tools.list(),
    systemPrompt: await loadSystemPrompt()
  };

  return new Agent(config);
}

async function loadSystemPrompt(): Promise<string> {
  const fs = await import('fs');
  const path = await import('path');
  
  const promptPath = path.join(process.cwd(), 'sources/claude-code-system-prompts/prompts/01_main_system_prompt.md');
  
  if (fs.existsSync(promptPath)) {
    return fs.readFileSync(promptPath, 'utf-8');
  }

  return `You are Duck CLI, an expert coding assistant.
Be concise. Focus on the task. Use available tools efficiently.`;
}

// Run
main().catch(console.error);
