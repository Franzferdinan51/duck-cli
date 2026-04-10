/**
 * 🦆 Duck Agent - Meta Agent Commands
 * CLI commands for managing internal meta agents
 */

import { Command } from 'commander';
import { MetaAgentSystem } from '../agent/meta-agent-system.js';

export function createMetaAgentCommand(): Command {
  const cmd = new Command('meta')
    .description('Internal meta agents for orchestration, bridge, and subconscious');

  const system = new MetaAgentSystem();

  cmd
    .command('status')
    .description('Show meta agent system status')
    .action(() => {
      const status = system.getStatus();
      
      console.log('\n🦆 Meta Agent System Status');
      console.log('===========================');
      console.log(`Total Agents: ${status.totalAgents}`);
      console.log(`Active: ${status.activeAgents}`);
      console.log(`Idle: ${status.idleAgents}`);
      console.log(`Error: ${status.errorAgents}`);
      console.log(`Task Queue: ${status.taskQueueLength}`);
      console.log(`Mesh Connected: ${status.meshConnected ? '✅' : '❌'}`);

      console.log('\n📋 Registered Agents:');
      for (const agent of system.getAllAgents()) {
        const statusIcon = agent.status === 'idle' ? '🟢' :
                          agent.status === 'working' ? '🟡' :
                          agent.status === 'error' ? '🔴' : '⚪';
        console.log(`\n  ${statusIcon} ${agent.config.name}`);
        console.log(`     ID: ${agent.config.id}`);
        console.log(`     Type: ${agent.config.type}`);
        console.log(`     Model: ${agent.config.model}`);
        console.log(`     Status: ${agent.status}`);
        console.log(`     Capabilities: ${agent.config.capabilities.join(', ')}`);
        console.log(`     Tasks Completed: ${agent.stats.tasksCompleted}`);
        console.log(`     Avg Response Time: ${agent.stats.averageResponseTime.toFixed(0)}ms`);
      }
    });

  cmd
    .command('start <agentId>')
    .description('Start a meta agent')
    .action(async (agentId) => {
      try {
        await system.startAgent(agentId);
        console.log(`✅ Started meta agent: ${agentId}`);
      } catch (e: any) {
        console.error(`❌ Failed to start agent: ${e.message}`);
      }
    });

  cmd
    .command('stop <agentId>')
    .description('Stop a meta agent')
    .action((agentId) => {
      system.stopAgent(agentId);
      console.log(`⏹️  Stopped meta agent: ${agentId}`);
    });

  cmd
    .command('stop-all')
    .description('Stop all meta agents')
    .action(() => {
      system.stopAll();
      console.log('⏹️  All meta agents stopped');
    });

  cmd
    .command('task <agentType> <task>')
    .description('Assign task to meta agent')
    .option('-p, --payload <json>', 'Task payload as JSON', '{}')
    .option('--priority <level>', 'Task priority (low/normal/high/critical)', 'normal')
    .option('--timeout <ms>', 'Task timeout in ms', '30000')
    .action(async (agentType, task, options) => {
      try {
        const payload = JSON.parse(options.payload);
        const result = await system.assignTask(
          agentType as any,
          task,
          payload,
          {
            priority: options.priority as any,
            timeout: parseInt(options.timeout)
          }
        );

        console.log('\n📋 Task Result:');
        console.log(`  Success: ${result.success ? '✅' : '❌'}`);
        console.log(`  Duration: ${result.durationMs}ms`);
        console.log(`  Result:`, JSON.stringify(result.result, null, 2));
      } catch (e: any) {
        console.error(`❌ Task failed: ${e.message}`);
      }
    });

  cmd
    .command('list')
    .description('List all meta agents')
    .action(() => {
      console.log('\n🦆 Meta Agents:');
      console.log('==============');
      
      for (const agent of system.getAllAgents()) {
        const icon = agent.config.priority === 'critical' ? '🔴' :
                    agent.config.priority === 'high' ? '🟠' :
                    agent.config.priority === 'normal' ? '🟡' : '🟢';
        console.log(`${icon} ${agent.config.name}`);
        console.log(`   ID: ${agent.config.id}`);
        console.log(`   Type: ${agent.config.type}`);
        console.log(`   Model: ${agent.config.model}`);
        console.log(`   Status: ${agent.status}`);
        console.log(`   Mesh: ${agent.config.meshEnabled ? '✅' : '❌'}`);
        console.log();
      }
    });

  cmd
    .command('models')
    .description('Show models used by meta agents')
    .action(() => {
      console.log('\n🧠 Meta Agent Models:');
      console.log('=====================');
      console.log('qwen3.5-0.8b: Fast, lightweight tasks');
      console.log('  - Used by: subconscious, monitor, memory, scheduler');
      console.log();
      console.log('qwen3.5-2b-claude-4.6-opus-reasoning-distilled: Complex reasoning');
      console.log('  - Used by: orchestrator, council, security');
      console.log();
      console.log('gemma-4-e2b-it: General purpose, tool calling');
      console.log('  - Used by: bridge, mesh');
    });

  return cmd;
}

export default createMetaAgentCommand;
