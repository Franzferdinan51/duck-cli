/**
 * duck-cli v3 - Meta-Agent Command
 * CLI: duck meta plan <task> (preview) and duck meta run <task> (execute)
 */

import { Command } from 'commander';
import { ProviderManager } from '../providers/manager.js';
import { MetaAgent } from '../orchestrator/meta-agent.js';
import { MetaPlanner } from '../orchestrator/meta-planner.js';
import { MetaLearner } from '../orchestrator/meta-learner.js';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { homedir } from 'os';
import { execSync } from 'child_process';

function randomUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = Math.random() * 16 | 0;
    return (ch === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

/**
 * Expand ~ to home directory
 */
function expandPath(p: string): string {
  if (p.startsWith('~')) {
    return join(homedir(), p.slice(1));
  }
  return p;
}

/**
 * Create directory recursively (cross-platform)
 */
function mkdirp(dirPath: string): void {
  const fullPath = expandPath(dirPath);
  try {
    mkdirSync(fullPath, { recursive: true });
  } catch (e: any) {
    if (e.code !== 'EEXIST') {
      throw e;
    }
  }
}

/**
 * Actual tool executor - replaces the stub!
 */
async function executeTool(tool: string, params: any): Promise<any> {
  console.log(`[MetaCLI] 🔧 Executing tool: ${tool}`);
  
  try {
    switch (tool) {
      case 'file_write': {
        const { path: filePath, content } = params;
        if (!filePath) {
          return { success: false, error: 'Missing required parameter: path' };
        }
        if (content === undefined) {
          return { success: false, error: 'Missing required parameter: content' };
        }
        
        // Resolve path and ensure directory exists
        const resolvedPath = resolve(expandPath(filePath));
        const dir = dirname(resolvedPath);
        
        if (!existsSync(dir)) {
          mkdirp(dir);
        }
        
        // Write the file
        writeFileSync(resolvedPath, content, 'utf-8');
        
        // Verify the file was actually created
        if (!existsSync(resolvedPath)) {
          return { success: false, error: `File was not created at ${resolvedPath}` };
        }
        
        console.log(`[MetaCLI] ✅ File written: ${resolvedPath} (${content.length} bytes)`);
        return { success: true, path: resolvedPath, bytes: content.length };
      }
      
      case 'file_read': {
        const { path: filePath } = params;
        if (!filePath) {
          return { success: false, error: 'Missing required parameter: path' };
        }
        
        const resolvedPath = resolve(expandPath(filePath));
        
        if (!existsSync(resolvedPath)) {
          return { success: false, error: `File not found: ${resolvedPath}` };
        }
        
        const content = readFileSync(resolvedPath, 'utf-8');
        console.log(`[MetaCLI] ✅ File read: ${resolvedPath} (${content.length} bytes)`);
        return { success: true, path: resolvedPath, content, bytes: content.length };
      }
      
      case 'shell': {
        const { command } = params;
        if (!command) {
          return { success: false, error: 'Missing required parameter: command' };
        }
        
        console.log(`[MetaCLI] 🖥️  Running shell: ${command.substring(0, 100)}...`);
        
        try {
          const output = execSync(command, {
            encoding: 'utf-8',
            timeout: 60000,
            maxBuffer: 10 * 1024 * 1024,
          });
          console.log(`[MetaCLI] ✅ Shell completed`);
          return { success: true, output };
        } catch (e: any) {
          const errorMsg = e.message || String(e);
          console.log(`[MetaCLI] ❌ Shell error: ${errorMsg.substring(0, 100)}`);
          return { success: false, error: errorMsg, output: e.stdout };
        }
      }
      
      default:
        console.log(`[MetaCLI] ⚠️  Unknown tool: ${tool}`);
        return { success: false, error: `Unknown tool: ${tool}` };
    }
  } catch (e: any) {
    console.log(`[MetaCLI] ❌ Tool error: ${e.message}`);
    return { success: false, error: e.message };
  }
}

async function spawnAgentStub(task: string): Promise<string> {
  const { SubagentManager } = await import('../agent/subagent-manager.js');
  const manager = new SubagentManager();
  const agent = manager.spawn(task, {
    role: 'general',
    timeout: 300000,
    model: process.env.DUCK_MODEL || 'qwen3.5-0.8b',
    provider: process.env.DUCK_PROVIDER || 'lmstudio',
  });

  manager.start(agent.id, {
    role: 'general',
    timeout: 300000,
    model: process.env.DUCK_MODEL || 'qwen3.5-0.8b',
    provider: process.env.DUCK_PROVIDER || 'lmstudio',
  }).catch((err: any) => {
    console.error(`[MetaCLI] Failed to start subagent ${agent.id}: ${err?.message || err}`);
  });

  console.log(`[MetaCLI] Spawned real subagent ${agent.id}: "${task}"`);
  return agent.id;
}

export function createMetaAgentCommand(): Command {
  const meta = new Command('meta')
    .description('duck-cli v3 Meta-Agent (LLM-powered orchestration)')
    // NOTE: no passThroughOptions() here — subcommands define their own flags

  // duck meta plan <task> — preview plan without executing
  meta
    .command('plan <task>')
    .description('Preview what duck-cli v3 would do (no execution)')
    .option('--json', 'Output plan as JSON')
    .option('--planner <model>', 'Planner model (e.g. qwen3.5-0.8b for local free)')
    .option('--provider <name>', 'Provider: lmstudio (local), minimax, kimi')
    .action(async (task: string, options: any) => {
      const pm = new ProviderManager();
      await pm.load();
      const model = options.planner || 'qwen3.5-0.8b';
      const provider = options.provider || 'lmstudio';
      const planner = new MetaPlanner(pm, model, provider);
      const plan = await planner.plan({ id: randomUUID(), prompt: task, createdAt: Date.now() });

      if (options.json) {
        console.log(JSON.stringify(plan, null, 2));
      } else {
        console.log(planner.formatPlanTrace(plan));
      }
    });

  // duck meta run <task> — full meta-agent execution
  meta
    .command('run <task>')
    .description('Execute with Meta-Agent (Planner → Critic → Healer → Learner)')
    .option('--dry-run', 'Show plan without executing')
    .option('--no-trace', 'Suppress step trace')
    .option('--no-learn', 'Disable learning')
    .option('--planner <model>', 'Planner model (e.g. qwen3.5-0.8b for local free)')
    .option('--critic <model>', 'Critic model')
    .option('--healer <model>', 'Healer model')
    .option('--provider <name>', 'Provider: lmstudio (local free), minimax (API), kimi (API)')
    .action(async (task: string, options: any) => {
      console.log(`\ndock-cli v3 Meta-Agent: "${task}"\n`);
      const provider = options.provider || 'lmstudio';
      const plannerModel = options.planner || 'qwen3.5-0.8b';
      const criticModel = options.critic || plannerModel;
      const healerModel = options.healer || plannerModel;
      console.log(`[Config] Provider: ${provider}, Planner: ${plannerModel}, Critic: ${criticModel}, Healer: ${healerModel}\n`);

      const pm = new ProviderManager();
      await pm.load();
      const agent = new MetaAgent(pm, {
        plannerProvider: provider,
        plannerModel,
        criticModel,
        healerModel,
        enableTrace: !options.trace,
        enableLearning: !options.learn,
        dryRun: options.dryRun,
      }, executeTool, spawnAgentStub);

      const result = await agent.execute({ id: randomUUID(), prompt: task, createdAt: Date.now() });

      console.log(`\n${'='.repeat(60)}`);
      console.log(`Result: ${result.success ? '✅ SUCCESS' : '⚠️ ' + result.outcome.toUpperCase()}`);
      console.log(`Steps: ${result.steps.length} executed`);
      console.log(`Time: ${(result.totalTimeMs / 1000).toFixed(1)}s`);
    });

  // duck meta learnings — show past lessons
  meta
    .command('learnings')
    .description('Show recent lessons from past sessions')
    .option('--topic <topic>', 'Filter by topic keywords')
    .action(async (options: any) => {
      const learner = new MetaLearner();
      const lessons = learner.getRecentLessons(options.topic || 'task', 10);

      if (lessons.length === 0) {
        console.log('\n📭 No lessons yet. Run some tasks first!\n');
      } else {
        console.log('\n📖 Recent Lessons:\n');
        lessons.forEach((l, i) => console.log(`  ${i + 1}. ${l}`));
        console.log('');
      }
    });

  return meta;
}
