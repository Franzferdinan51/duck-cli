/**
 * 🦆 Duck Agent - Workflow Commands
 * CLI commands for graph-based workflows
 */

import { Command } from 'commander';
import { WorkflowEngine, WorkflowBuilder } from '../orchestrator/workflow-engine.js';

export function createWorkflowCommand(): Command {
  const cmd = new Command('workflow')
    .description('Graph-based workflow execution with checkpointing and time-travel');

  const engine = new WorkflowEngine();

  cmd
    .command('run <workflowFile>')
    .description('Run a workflow from JSON file')
    .option('-d, --data <json>', 'Initial data as JSON', '{}')
    .action(async (workflowFile, options) => {
      const fs = await import('fs');
      const workflow = JSON.parse(fs.readFileSync(workflowFile, 'utf-8'));
      
      engine.registerWorkflow(workflow);
      
      const initialData = JSON.parse(options.data);
      const execution = await engine.startExecution(workflow.id, initialData);

      console.log(`\n🔄 Workflow Execution Started`);
      console.log(`Execution ID: ${execution.id}`);
      console.log(`Workflow: ${workflow.name}`);
      console.log(`Status: ${execution.status}`);

      // Listen for events
      engine.on('node_started', ({ nodeId, nodeType }) => {
        console.log(`  ▶️  ${nodeType}: ${nodeId}`);
      });

      engine.on('node_completed', ({ nodeId }) => {
        console.log(`  ✅ ${nodeId}`);
      });

      engine.on('checkpoint_created', ({ checkpointId }) => {
        console.log(`  💾 Checkpoint: ${checkpointId}`);
      });

      engine.on('human_approval_required', ({ approvalId, request }) => {
        console.log(`\n⏸️  Human Approval Required: ${approvalId}`);
        console.log(`Action: ${request.proposedAction}`);
        console.log(`Run: duck workflow approve ${approvalId} [yes|no] "feedback"`);
      });

      engine.on('execution_completed', ({ result }) => {
        console.log(`\n✅ Workflow Completed!`);
        console.log('Result:', JSON.stringify(result, null, 2));
      });

      engine.on('execution_failed', ({ error }) => {
        console.log(`\n❌ Workflow Failed: ${error}`);
      });

      // Wait for completion
      while (execution.status === 'running' || execution.status === 'paused') {
        await new Promise(r => setTimeout(r, 100));
      }
    });

  cmd
    .command('create <name>')
    .description('Create a new workflow interactively')
    .action(async (name) => {
      const builder = engine.createWorkflow(name);
      
      // Build a simple example workflow
      const workflow = builder
        .start('Start')
        .agent('Process Input', { prompt: 'Process the input data' })
        .decision('Check Condition', {
          condition: 'data.value > 10',
          branches: {
            true: 'high_value',
            false: 'low_value'
          }
        })
        .agent('High Value', { prompt: 'Handle high value' })
        .agent('Low Value', { prompt: 'Handle low value' })
        .end('End')
        .build();

      console.log(`\n✅ Workflow Created: ${workflow.name}`);
      console.log(`ID: ${workflow.id}`);
      console.log(`Nodes: ${workflow.nodes.size}`);
      
      // Save to file
      const fs = await import('fs');
      const filename = `${name.toLowerCase().replace(/\s+/g, '_')}.workflow.json`;
      fs.writeFileSync(filename, JSON.stringify(workflow, null, 2));
      console.log(`Saved to: ${filename}`);
    });

  cmd
    .command('list')
    .description('List all workflow executions')
    .action(() => {
      const executions = engine.getAllExecutions();
      console.log(`\n🔄 Workflow Executions: ${executions.length}`);
      
      for (const exec of executions) {
        const statusIcon = exec.status === 'completed' ? '✅' :
                          exec.status === 'running' ? '🔄' :
                          exec.status === 'paused' ? '⏸️' :
                          exec.status === 'failed' ? '❌' : '⚪';
        console.log(`\n${statusIcon} ${exec.id}`);
        console.log(`   Workflow: ${exec.workflowId}`);
        console.log(`   Status: ${exec.status}`);
        console.log(`   Current Node: ${exec.currentState.nodeId}`);
        console.log(`   Checkpoints: ${exec.checkpoints.length}`);
        console.log(`   Duration: ${exec.endTime ? ((exec.endTime - exec.startTime) / 1000).toFixed(1) + 's' : 'running'}`);
      }
    });

  cmd
    .command('status <executionId>')
    .description('Get execution status and details')
    .action((executionId) => {
      const exec = engine.getExecution(executionId);
      if (!exec) {
        console.log(`Execution not found: ${executionId}`);
        return;
      }

      console.log(`\n🔄 Execution: ${exec.id}`);
      console.log(`Status: ${exec.status}`);
      console.log(`Current Node: ${exec.currentState.nodeId}`);
      console.log(`Start Time: ${new Date(exec.startTime).toISOString()}`);
      if (exec.endTime) {
        console.log(`End Time: ${new Date(exec.endTime).toISOString()}`);
        console.log(`Duration: ${((exec.endTime - exec.startTime) / 1000).toFixed(1)}s`);
      }
      
      console.log(`\nHistory (${exec.history.length} steps):`);
      for (const state of exec.history) {
        const icon = state.status === 'completed' ? '✅' : state.status === 'failed' ? '❌' : '🔄';
        console.log(`  ${icon} ${state.nodeId}`);
      }

      console.log(`\nCheckpoints (${exec.checkpoints.length}):`);
      for (const chk of exec.checkpoints) {
        console.log(`  💾 ${chk.id} at ${new Date(chk.timestamp).toISOString()}`);
      }
    });

  cmd
    .command('pause <executionId>')
    .description('Pause a running workflow')
    .action((executionId) => {
      engine.pauseExecution(executionId);
      console.log(`Execution ${executionId} paused`);
    });

  cmd
    .command('resume <executionId>')
    .description('Resume a paused workflow')
    .action(async (executionId) => {
      await engine.resumeExecution(executionId);
      console.log(`Execution ${executionId} resumed`);
    });

  cmd
    .command('rewind <executionId> <checkpointId>')
    .description('Time-travel: restore execution from checkpoint')
    .action(async (executionId, checkpointId) => {
      console.log(`⏪ Rewinding ${executionId} to checkpoint ${checkpointId}...`);
      await engine.restoreFromCheckpoint(checkpointId);
      console.log('✅ Execution restored and resumed');
    });

  cmd
    .command('approve <approvalId> <decision> [feedback]')
    .description('Approve or reject a human-in-the-loop request')
    .action((approvalId, decision, feedback) => {
      const approved = decision.toLowerCase() === 'yes' || decision.toLowerCase() === 'true';
      engine.submitHumanApproval(approvalId, approved, feedback);
      console.log(`Approval ${approvalId}: ${approved ? '✅ Approved' : '❌ Rejected'}`);
    });

  cmd
    .command('example')
    .description('Create an example workflow file')
    .action(async () => {
      const fs = await import('fs');
      
      const exampleWorkflow = {
        id: `wf_example_${Date.now()}`,
        name: 'Example Data Processing',
        nodes: {
          start: { id: 'start', type: 'start', name: 'Start', next: 'validate' },
          validate: {
            id: 'validate',
            type: 'agent',
            name: 'Validate Input',
            config: { prompt: 'Validate the input data' },
            next: 'check'
          },
          check: {
            id: 'check',
            type: 'decision',
            name: 'Check Valid',
            config: { condition: 'data.valid === true' },
            next: { true: 'process', false: 'error', default: 'error' }
          },
          process: {
            id: 'process',
            type: 'agent',
            name: 'Process Data',
            config: { prompt: 'Process the validated data' },
            next: 'end'
          },
          error: {
            id: 'error',
            type: 'agent',
            name: 'Handle Error',
            config: { prompt: 'Handle validation error' },
            next: 'end'
          },
          end: { id: 'end', type: 'end', name: 'End' }
        },
        edges: [
          { from: 'start', to: 'validate' },
          { from: 'validate', to: 'check' },
          { from: 'check', to: 'process' },
          { from: 'check', to: 'error' },
          { from: 'process', to: 'end' },
          { from: 'error', to: 'end' }
        ],
        startNode: 'start'
      };

      const filename = 'example.workflow.json';
      fs.writeFileSync(filename, JSON.stringify(exampleWorkflow, null, 2));
      console.log(`✅ Example workflow created: ${filename}`);
      console.log('\nRun it with:');
      console.log(`  duck workflow run ${filename} -d '{"valid": true, "data": "test"}'`);
    });

  return cmd;
}

export default createWorkflowCommand;
