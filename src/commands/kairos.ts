/**
 * 🦆 Duck Agent - KAIROS CLI Commands
 */

import { Command } from 'commander';
import { 
  getKAIROS, 
  startKAIROS, 
  stopKAIROS,
  KAIROS,
  KAIROSTick 
} from '../kairos/orchestrator.js';
import { 
  ThinkingModule, 
  fastThink, 
  ReasoningChain 
} from '../kairos/thinking.js';
import { 
  MemorySystem, 
  SessionManager 
} from '../kairos/context.js';
import { 
  getToolRegistry, 
  BUILTIN_TOOLS 
} from '../kairos/tools.js';

export function createKairosCommand(): Command {
  const kairos = new Command('kairos')
    .description('🧠 KAIROS - Autonomous AI with proactive capabilities');

  // Start KAIROS
  kairos
    .command('start')
    .description('Start KAIROS autonomous mode')
    .option('-m, --mode <mode>', 'Proactive mode', 'balanced')
    .option('-t, --tick <ms>', 'Tick interval (ms)', '5000')
    .action((options) => {
      const k = startKAIROS({
        proactiveMode: options.mode as any,
        tickInterval: parseInt(options.tick),
      });
      
      console.log('\n🧠 KAIROS started');
      console.log(`   Mode: ${options.mode}`);
      console.log(`   Tick: ${options.tick}ms`);
      console.log('');
      
      // Log events
      k.on('tick', (tick: KAIROSTick, state: any) => {
        console.log(`[${tick.localTime}] tick - idle:${state.isIdle} asleep:${state.isAsleep}`);
      });
    });

  // Stop KAIROS
  kairos
    .command('stop')
    .description('Stop KAIROS autonomous mode')
    .action(() => {
      stopKAIROS();
      console.log('\n🧠 KAIROS stopped\n');
    });

  // Status
  kairos
    .command('status')
    .description('Show KAIROS status')
    .action(() => {
      const k = getKAIROS();
      const state = k.getState();
      const config = k.getConfig();
      const dream = k.getCurrentDream();
      
      console.log('\n🧠 KAIROS Status\n');
      console.log(`  Running: ${k.isActive() ? '✅ Yes' : '❌ No'}`);
      console.log(`  Mode: ${config.proactiveMode}`);
      console.log(`  Idle: ${state.isIdle ? 'Yes' : 'No'}`);
      console.log(`  Asleep: ${state.isAsleep ? 'Yes' : 'No'}`);
      console.log(`  Last tick: ${new Date(state.lastTick).toLocaleTimeString()}`);
      if (dream) {
        console.log(`  Dreaming: Yes (started ${new Date(dream.startedAt).toLocaleTimeString()})`);
      }
      console.log('');
    });

  // History
  kairos
    .command('history')
    .description('Show action history')
    .option('-n, --limit <n>', 'Number of actions', '10')
    .action((options) => {
      const k = getKAIROS();
      const history = k.getActionHistory();
      const limit = parseInt(options.limit);
      
      console.log('\n📋 Recent Actions\n');
      
      for (const action of history.slice(-limit)) {
        const time = new Date(action.executedAt).toLocaleTimeString();
        const icon = action.error ? '❌' : '✅';
        console.log(`  ${icon} [${time}] ${action.description}`);
      }
      
      console.log('');
    });

  return kairos;
}

export function createThinkCommand(): Command {
  const think = new Command('think')
    .description('🤔 Thinking and reasoning tools');

  // Fast think
  think
    .command('fast <prompt>')
    .description('Quick reasoning')
    .action((prompt) => {
      const result = fastThink(prompt);
      console.log('\n💭 Thinking...\n');
      console.log(`  ${result}\n`);
    });

  // Deep think
  think
    .command('deep <prompt>')
    .description('Deep reasoning with chain of thought')
    .action(async (prompt) => {
      console.log('\n💭 Deep thinking...\n');
      
      const module = new ThinkingModule();
      module.startThinking(prompt);
      
      // Add reasoning steps
      module.addThought('Understanding the problem...', 0.8);
      module.addThought('Identifying key constraints...', 0.7);
      module.addThought('Exploring potential approaches...', 0.6);
      module.addThought('Evaluating trade-offs...', 0.7);
      
      const result = module.conclude('Solution identified through systematic reasoning.');
      
      console.log(module.formatTree());
      console.log(`\n📊 Confidence: ${Math.round(result.confidence * 100)}%`);
      console.log(`   Tokens used: ${result.tokensUsed}\n`);
    });

  // Chain of thought
  think
    .command('chain <steps...>')
    .description('Build a reasoning chain')
    .action((steps) => {
      const chain = new ReasoningChain();
      
      for (const step of steps) {
        chain.addStep(step);
      }
      
      console.log('\n🔗 Reasoning Chain\n');
      console.log(chain.format());
      console.log('');
    });

  return think;
}

export function createMemoryCommand(): Command {
  const memory = new Command('memory')
    .description('🧠 Memory management');

  // Load memory
  memory
    .command('load')
    .description('Load memory files')
    .action(async () => {
      console.log('\n📚 Loading memory...\n');
      
      const system = new MemorySystem();
      const files = await system.loadMemoryFiles();
      
      console.log(`  Found ${files.length} memory files:\n`);
      
      for (const file of files) {
        const size = file.content.length;
        console.log(`  ${file.isLocal ? '📁' : '📄'} ${file.path}`);
        console.log(`     ${size} chars, priority ${file.priority}`);
      }
      
      console.log(`\n  Total: ${files.reduce((sum, f) => sum + f.content.length, 0)} chars\n`);
    });

  // Show compiled memory
  memory
    .command('show')
    .description('Show compiled memory')
    .action(async () => {
      const system = new MemorySystem();
      await system.loadMemoryFiles();
      const compiled = system.compileMemory();
      
      console.log('\n📜 Compiled Memory\n');
      console.log(compiled.slice(0, 2000));
      if (compiled.length > 2000) {
        console.log('\n... (truncated)\n');
      }
    });

  return memory;
}

export function createToolsCommand(): Command {
  const tools = new Command('tools')
    .description('🔧 Tool management');

  // List tools
  tools
    .command('list')
    .description('List available tools')
    .option('-c, --category <cat>', 'Filter by category')
    .action((options) => {
      const registry = getToolRegistry();
      const toolList = registry.list(options.category);
      
      console.log('\n🔧 Available Tools\n');
      
      // Group by category
      const byCategory = new Map<string, typeof toolList>();
      for (const tool of toolList) {
        const cat = tool.category || 'other';
        if (!byCategory.has(cat)) {
          byCategory.set(cat, []);
        }
        byCategory.get(cat)!.push(tool);
      }
      
      for (const [cat, catTools] of byCategory) {
        console.log(`  📁 ${cat.toUpperCase()}`);
        for (const tool of catTools) {
          const danger = tool.dangerous ? ' ⚠️' : '';
          console.log(`     ${tool.name}${danger} - ${tool.description}`);
        }
        console.log('');
      }
    });

  // Stats
  tools
    .command('stats')
    .description('Show tool usage statistics')
    .action(() => {
      const registry = getToolRegistry();
      const stats = registry.getStats();
      const mostUsed = registry.getMostUsed(10);
      
      console.log('\n📊 Tool Usage Stats\n');
      
      if (mostUsed.length === 0) {
        console.log('  No tool usage yet\n');
        return;
      }
      
      for (const { name, count } of mostUsed) {
        const stat = stats[name];
        const avgMs = stat ? Math.round(stat.avgDuration) : 0;
        console.log(`  ${name.padEnd(20)} ${count} uses, avg ${avgMs}ms`);
      }
      
      console.log('');
    });

  return tools;
}

export default {
  createKairosCommand,
  createThinkCommand,
  createMemoryCommand,
  createToolsCommand,
};
