/**
 * duck-cli v3 - Meta-Agent Command
 * CLI: duck meta plan <task> (preview) and duck meta run <task> (execute)
 */

import { Command } from 'commander';
import { ProviderManager } from '../providers/manager.js';
import { MetaAgent } from '../orchestrator/meta-agent.js';
import { MetaPlanner } from '../orchestrator/meta-planner.js';
import { MetaLearner } from '../orchestrator/meta-learner.js';



function randomUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = Math.random() * 16 | 0;
    return (ch === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}
async function executeToolStub(tool: string, params: any): Promise<any> {
  console.log(`[MetaCLI] Tool called: ${tool}`);
  return { success: true, output: `stub: ${tool}` };
}

async function spawnAgentStub(task: string): Promise<string> {
  const agentId = randomUUID().substring(0, 8);
  console.log(`[MetaCLI] Spawned subagent ${agentId}: "${task}"`);
  return agentId;
}

export function createMetaAgentCommand(): Command {
  const meta = new Command('meta')
    .description('duck-cli v3 Meta-Agent (LLM-powered orchestration)')
    .passThroughOptions();  // Allow unknown flags to pass through

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
      const model = options.planner || 'MiniMax-M2.7';
      const provider = options.provider || 'minimax';
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
      const provider = options.provider || 'minimax';
      const plannerModel = options.planner || 'MiniMax-M2.7';
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
      }, executeToolStub, spawnAgentStub);

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
