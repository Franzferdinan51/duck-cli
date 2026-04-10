/**
 * 🦆 Duck Agent - KAIROS CLI Commands
 */

import { Command } from 'commander';
import { 
  getKAIROS, 
  startKAIROS, 
  stopKAIROS,
  KAIROS,
  KAIROSTick,
  KAIROSDream 
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
import { getSubconsciousClient } from '../subconscious/client.js';
import { getSkillCreator } from '../skills/skill-creator.js';
import { getSkillImprover } from '../skills/skill-improver.js';

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
      
      // Subconscious daemon client for dream saving
      const subconscious = getSubconsciousClient();

      // Log events
      k.on('tick', (tick: KAIROSTick, state: any) => {
        console.log(`[${tick.localTime}] tick - idle:${state.isIdle} asleep:${state.isAsleep}`);
      });

      // Wire dream_complete → subconscious daemon (KAIROS + Subconscious integration)
      k.on('dream_complete', async (dream: KAIROSDream) => {
        console.log(`\n💤 KAIROS Dream complete: ${dream.insights.length} insights\n`);
        try {
          const patternsSeen = Array.from((k as any).patterns?.keys() || []).slice(-10) as string[];
          const actionSummary = ((k as any).actionHistory?.slice(-50) || [])
            .map((a: any) => a.type)
            .reduce((acc: any, t: string) => { acc[t] = (acc[t] || 0) + 1; return acc; }, {} as Record<string, number>);
          await subconscious.saveDream({
            sessionId: `kairos_${Date.now()}`,
            startedAt: dream.startedAt,
            endedAt: dream.endedAt,
            topics: dream.topics,
            insights: dream.insights,
            actionSummary: JSON.stringify(actionSummary),
            patternsSeen,
          });
          console.log(`💤 Dream insights saved to Sub-Conscious\n`);
        } catch (e: any) {
          console.log(`⚠️  Dream save failed (daemon may not be running): ${e.message}`);
        }
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

  // Dream - manually trigger dream consolidation
  kairos
    .command('dream')
    .description('Manually trigger KAIROS dream consolidation')
    .option('-s, --save', 'Save dream insights to Sub-Conscious daemon', false)
    .action(async (options) => {
      const k = getKAIROS();
      const state = k.getState();

      console.log('\n💤 KAIROS Dream\n');

      // Manually set asleep to trigger dream
      (k as any).state.isAsleep = true;
      (k as any).state.dreamEnabled = true;

      // Trigger a tick to run the dream
      await (k as any).tick();

      const dream = k.getCurrentDream();
      if (dream) {
        console.log(`  Started: ${new Date(dream.startedAt).toLocaleTimeString()}`);
        console.log(`  Insights: ${dream.insights.length}`);
        if (dream.insights.length > 0) {
          console.log('\n  Insights:');
          for (const insight of dream.insights) {
            console.log(`    - ${insight}`);
          }
        }

        if (options.save) {
          const subconscious = getSubconsciousClient();
          try {
            const patternsSeen = Array.from((k as any).patterns?.keys() || []).slice(-10) as string[];
            await subconscious.saveDream({
              sessionId: `kairos_manual_${Date.now()}`,
              startedAt: dream.startedAt,
              endedAt: dream.endedAt,
              topics: dream.topics,
              insights: dream.insights,
              patternsSeen,
            });
            console.log('\n  💾 Dream insights saved to Sub-Conscious');
          } catch (e: any) {
            console.log(`\n  ⚠️  Could not save: ${e.message}`);
          }
        }
      } else {
        console.log('  No dream (already dreaming or not enabled)');
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

  // Skills - Autonomous skill management
  kairos
    .command('skills')
    .description('Manage auto-created skills')
    .option('-l, --list', 'List auto-created skills', false)
    .option('-s, --stats', 'Show skill creator stats', false)
    .option('-p, --patterns', 'Show patterns ready for skill creation', false)
    .option('-c, --create <pattern>', 'Manually trigger skill creation for a pattern')
    .option('-i, --improve <skillName>', 'Improve a specific skill')
    .option('-t, --improve-all', 'Improve all skills with poor health', false)
    .action(async (options) => {
      const creator = getSkillCreator();
      const improver = getSkillImprover();

      if (options.stats) {
        const stats = creator.getStats();
        const impStats = improver.getStats();
        console.log('\n🎯 Skill Creator Stats\n');
        console.log(`  Patterns tracked: ${stats.patternsTracked}`);
        console.log(`  Skills created:  ${stats.skillsCreated}`);
        console.log(`  Ready to create:  ${stats.readyToCreate}`);
        console.log('\n📊 Skill Improver Stats\n');
        console.log(`  Executions logged: ${impStats.totalRecords}`);
        console.log(`  Skills tracked:    ${impStats.skillsTracked}`);
        console.log(`  Improvements made: ${impStats.improvementsMade}`);
        console.log('');
        return;
      }

      if (options.patterns) {
        const patterns = creator.getReadyPatterns();
        console.log('\n🎯 Patterns Ready for Skill Creation\n');
        if (patterns.length === 0) {
          console.log('  No patterns ready (need 3+ occurrences)');
        } else {
          for (const p of patterns.slice(0, 10)) {
            console.log(`  ${p.pattern}`);
            console.log(`     Occurrences: ${p.count} | Executions: ${p.executions.length}`);
          }
        }
        console.log('');
        return;
      }

      if (options.list) {
        const skills = creator.listAutoSkills();
        console.log('\n🛠️  Auto-Created Skills\n');
        if (skills.length === 0) {
          console.log('  No auto-created skills yet');
        } else {
          for (const skill of skills) {
            const health = improver.getSkillHealth(skill);
            const emoji = health.health === 'excellent' ? '✅' : health.health === 'good' ? '👍' : health.health === 'poor' ? '⚠️' : '❌';
            console.log(`  ${emoji} ${skill}`);
            console.log(`     Uses: ${health.totalUses} | Health: ${health.health} | Improvements: ${health.improvementCount}`);
          }
        }
        console.log('');
        return;
      }

      if (options.create) {
        console.log(`\n🎯 Creating skill for pattern: ${options.create}\n`);
        const result = await creator.createSkillForPattern(options.create);
        if (result) {
          console.log(`✅ Skill created: ${result.name}`);
          console.log(`   Triggers: ${result.triggers.join(', ')}`);
        } else {
          console.log('⚠️  Could not create skill (check pattern)');
        }
        console.log('');
        return;
      }

      if (options.improve) {
        console.log(`\n📈 Improving skill: ${options.improve}\n`);
        const result = await improver.improveSkillManual(options.improve);
        if (result) {
          console.log(`✅ Skill improved`);
          console.log(`   Changes: ${result.changes.join(', ')}`);
        } else {
          console.log('⚠️  Could not improve skill');
        }
        console.log('');
        return;
      }

      if (options.improveAll) {
        const allHealth = improver.getAllSkillHealth();
        const poor = allHealth.filter(h => h.health === 'poor' || h.health === 'broken');
        console.log(`\n📈 Improving ${poor.length} skills with poor health...\n`);
        for (const h of poor) {
          const result = await improver.improveSkillManual(h.name);
          console.log(`  ${result ? '✅' : '⚠️'} ${h.name} → ${result ? 'improved' : 'failed'}`);
        }
        console.log('');
        return;
      }

      // Default: show all info
      const skills = creator.listAutoSkills();
      const patterns = creator.getReadyPatterns();
      const allHealth = improver.getAllSkillHealth();

      console.log('\n🛠️  Duck-CLI Skill System\n');
      console.log(`  Auto-created skills: ${skills.length}`);
      console.log(`  Patterns tracked:   ${creator.getStats().patternsTracked}`);
      console.log(`  Ready to create:     ${patterns.length}`);
      console.log(`  Skills tracked:      ${allHealth.length}`);
      const poorCount = allHealth.filter(h => h.health === 'poor' || h.health === 'broken').length;
      if (poorCount > 0) console.log(`  Needs improvement:   ${poorCount}`);
      console.log('\n  Options:');
      console.log('    --list        List auto-created skills');
      console.log('    --stats       Show creator + improver stats');
      console.log('    --patterns    Show patterns ready for skill creation');
      console.log('    --create <p>  Manually create skill from pattern');
      console.log('    --improve <s> Improve a specific skill');
      console.log('    --improve-all Improve all skills with poor health');
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
