/**
 * 🦆 Duck Agent - Council Command
 * CLI command for AI Council interaction
 */

import { Command } from 'commander';
import { AICouncilClient, CORE_COUNCILORS, DELIBERATION_MODES } from '../council/client.js';
import { DeliberationEngine } from '../council/deliberation-engine.js';

export function createCouncilCommand(): Command {
  const council = new Command('council')
    .description('🗳️ AI Council Chamber - Multi-agent deliberation');

  // List available modes
  council
    .command('modes')
    .description('List available deliberation modes')
    .action(() => {
      console.log('\n🗳️ Deliberation Modes:\n');
      for (const mode of DELIBERATION_MODES) {
        console.log(`  ${mode.id.padEnd(15)} - ${mode.description}`);
      }
      console.log('');
    });

  // List councilors
  council
    .command('councilors')
    .description('List available councilors')
    .option('-e, --enabled', 'Show only enabled councilors')
    .action((options) => {
      console.log('\n🏛️ AI Councilors:\n');
      for (const c of CORE_COUNCILORS) {
        if (options.enabled && !c.enabled) continue;
        const status = c.enabled ? '✅' : '❌';
        console.log(`  ${status} ${c.name.padEnd(20)} [${c.role}]`);
      }
      console.log('');
    });

  // Quick deliberation
  council
    .command('ask <topic>')
    .description('Ask the council a question')
    .option('-m, --mode <mode>', 'Deliberation mode', 'deliberation')
    .option('-c, --councilors <ids>', 'Comma-separated councilor IDs')
    .action(async (topic, options) => {
      console.log(`\n🏛️ Council deliberation on: "${topic}"`);
      console.log(`   Mode: ${options.mode}`);
      console.log('');
      
      const client = new AICouncilClient();
      const engine = new DeliberationEngine(client);
      
      // Parse councilors
      let councilors = CORE_COUNCILORS;
      if (options.councilors) {
        const ids = options.councilors.split(',');
        councilors = CORE_COUNCILORS.filter(c => ids.includes(c.id));
      }
      
      // Run deliberation
      const result = await engine.deliberate({
        mode: options.mode,
        topic,
        councilors,
        maxRounds: 2,
      });
      
      // Output results
      console.log('\n📊 Results:\n');
      console.log(`  Topic: ${result.topic}`);
      console.log(`  Mode: ${result.mode}`);
      console.log(`  Duration: ${(result.duration / 1000).toFixed(1)}s`);
      
      if (result.summary) {
        console.log('\n📝 Summary:\n');
        console.log(result.summary.substring(0, 500) + '...');
      }
      
      if (result.votes) {
        console.log('\n🗳️ Votes:');
        for (const vote of result.votes) {
          const icon = vote.vote === 'yea' ? '✅' : '❌';
          console.log(`  ${icon} ${vote.vote.toUpperCase()} (${vote.confidence}/10)`);
        }
      }
      
      if (result.consensus !== undefined) {
        console.log(`\n📈 Consensus: ${(result.consensus * 100).toFixed(0)}%`);
      }
      
      if (result.finalRuling) {
        console.log(`\n⚖️ Final Ruling: ${result.finalRuling}`);
      }
      
      console.log('');
    });

  // Legislative debate with voting
  council
    .command('debate <proposal>')
    .description('Formal legislative debate with voting')
    .option('-r, --rounds <n>', 'Number of debate rounds', '3')
    .option('-t, --threshold <n>', 'Approval threshold (0-1)', '0.6')
    .action(async (proposal, options) => {
      console.log(`\n⚖️ Legislative Debate: "${proposal}"`);
      console.log(`   Rounds: ${options.rounds}`);
      console.log(`   Threshold: ${options.threshold}`);
      console.log('');
      
      const client = new AICouncilClient();
      const engine = new DeliberationEngine(client);
      
      const result = await engine.deliberate({
        mode: 'legislative',
        topic: proposal,
        councilors: CORE_COUNCILORS.filter(c => c.enabled),
        maxRounds: parseInt(options.rounds),
        threshold: parseFloat(options.threshold),
      });
      
      // Output ruling
      if (result.finalRuling) {
        console.log(`\n${result.finalRuling === 'APPROVED' ? '✅' : '❌'} ${result.finalRuling}`);
      }
      
      if (result.summary) {
        console.log('\n📝 Debate Summary:\n');
        console.log(result.summary);
      }
      
      console.log('');
    });

  // Research mode
  council
    .command('research <topic>')
    .description('Deep research investigation')
    .action(async (topic) => {
      console.log(`\n🔍 Deep Research: "${topic}"`);
      console.log('');
      
      const client = new AICouncilClient();
      const engine = new DeliberationEngine(client);
      
      const result = await engine.deliberate({
        mode: 'research',
        topic,
        councilors: CORE_COUNCILORS.filter(c => c.enabled),
      });
      
      if (result.summary) {
        console.log('\n📊 Research Report:\n');
        console.log(result.summary);
      }
      
      console.log(`\n⏱️ Completed in ${(result.duration / 1000).toFixed(1)}s`);
      console.log('');
    });

  // Prediction mode
  council
    .command('predict <question>')
    .description('Probabilistic forecasting')
    .action(async (question) => {
      console.log(`\n🔮 Prediction: "${question}"`);
      console.log('');
      
      const client = new AICouncilClient();
      const engine = new DeliberationEngine(client);
      
      const result = await engine.deliberate({
        mode: 'prediction',
        topic: question,
        councilors: CORE_COUNCILORS.filter(c => c.enabled),
      });
      
      if (result.summary) {
        console.log('\n📊 Forecast:\n');
        console.log(result.summary);
      }
      
      if (result.finalRuling) {
        console.log(`\n🔮 ${result.finalRuling}`);
      }
      
      console.log('');
    });

  // Status check
  council
    .command('status')
    .description('Check AI Council Chamber status')
    .action(async () => {
      const client = new AICouncilClient();
      
      console.log('\n🏛️ AI Council Chamber Status\n');
      
      const healthy = await client.healthCheck();
      if (healthy) {
        console.log('  ✅ Server: Online');
        console.log(`  🌐 URL: ${client['baseUrl']}`);
        
        const modes = await client.listModes();
        console.log(`  📋 Modes: ${modes.length} available`);
        
        const councilors = await client.listCouncilors();
        console.log(`  👥 Councilors: ${councilors.length} available`);
      } else {
        console.log('  ❌ Server: Offline');
        console.log('  💡 Run: cd AI-Bot-Council-Concensus && npm run dev');
      }
      
      console.log('');
    });

  return council;
}

export default createCouncilCommand;
