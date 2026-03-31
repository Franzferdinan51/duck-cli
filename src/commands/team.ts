/**
 * 🦆 Duck Agent - Team CLI Commands
 */

import { Command } from 'commander';
import { TeamManager, TEAM_TEMPLATES, MultiAgentCoordinator } from '../multiagent/index.js';

const coordinator = new MultiAgentCoordinator();
const teamManager = new TeamManager();

export function createTeamCommand(): Command {
  const team = new Command('team')
    .description('👥 Multi-Agent Teams - Create and manage teams of specialized agents');

  // List templates
  team
    .command('templates')
    .description('List available team templates')
    .action(() => {
      console.log('\n👥 Team Templates\n');
      for (const template of TEAM_TEMPLATES) {
        console.log(`  ${template.name}`);
        console.log(`    ${template.description}`);
        console.log(`    Roles: ${template.roles.map(r => r.name).join(', ')}`);
        console.log('');
      }
    });

  // Create team
  team
    .command('create <name>')
    .description('Create a new team')
    .option('-t, --template <template>', 'Use a template')
    .action((name, options) => {
      let created;
      
      if (options.template) {
        created = teamManager.createFromTemplate(options.template, name);
      } else {
        created = teamManager.createTeam(name, `Custom team: ${name}`);
      }
      
      if (created) {
        console.log(`\n✅ Team created: ${created.name} (${created.id})`);
        console.log(`   Members: ${created.members.size}`);
      } else {
        console.log('\n❌ Failed to create team');
      }
      console.log('');
    });

  // List teams
  team
    .command('list')
    .description('List all teams')
    .action(() => {
      const teams = teamManager.getAllTeams();
      console.log('\n👥 Teams\n');
      if (teams.length === 0) {
        console.log('  No teams created yet\n');
      } else {
        for (const t of teams) {
          const status = teamManager.getTeamStatus(t.id);
          const busy = status?.members.filter(m => m.status === 'busy').length || 0;
          console.log(`  ${t.name} (${t.id})`);
          console.log(`    Members: ${t.members.size} | Active: ${busy}`);
          console.log('');
        }
      }
    });

  // Team status
  team
    .command('status <team-id>')
    .description('Show team status')
    .action((teamId) => {
      const status = teamManager.getTeamStatus(teamId);
      if (!status) {
        console.log('\n❌ Team not found\n');
        return;
      }
      
      console.log(`\n👥 Team: ${status.name}`);
      console.log(`   ID: ${status.id}`);
      console.log(`   Members: ${status.totalMembers}`);
      console.log(`   Active Tasks: ${status.activeTasks}`);
      console.log('\n   Members:');
      for (const member of status.members) {
        const icon = member.status === 'busy' ? '⏳' : member.status === 'idle' ? '✅' : '❌';
        console.log(`     ${icon} ${member.name} [${member.role}]`);
      }
      console.log('');
    });

  // Add member
  team
    .command('add <team-id>')
    .description('Add member to team')
    .requiredOption('-n, --name <name>', 'Member name')
    .requiredOption('-r, --role <role>', 'Member role')
    .requiredOption('-s, --specialization <spec>', 'Specialization')
    .action((teamId, options) => {
      const id = options.name.toLowerCase().replace(/\s+/g, '-');
      const colors = ['#4f46e5', '#7c3aed', '#db2777', '#ea580c', '#16a34a', '#0891b2', '#6366f1', '#8b5cf6'];
      const color = colors[Math.floor(Math.random() * colors.length)];
      const added = teamManager.addMember(teamId, {
        id,
        name: options.name,
        role: options.role,
        description: `${options.name} - ${options.specialization}`,
        specialization: options.specialization,
        tools: ['file_read', 'bash'],
        color,
      });
      
      if (added) {
        console.log(`\n✅ Added ${options.name} to team\n`);
      } else {
        console.log('\n❌ Failed to add member (team not found?)\n');
      }
    });

  // Assign task
  team
    .command('task <team-id>')
    .description('Assign a task to a team member')
    .requiredOption('-m, --member <id>', 'Member ID')
    .requiredOption('-d, --description <desc>', 'Task description')
    .requiredOption('-p, --prompt <prompt>', 'Task prompt')
    .option('-t, --type <type>', 'Task type', 'worker')
    .action(async (teamId, options) => {
      console.log(`\n⏳ Assigning task to ${options.member}...`);
      
      const taskId = await teamManager.assignTask(
        teamId,
        options.member,
        options.type as any,
        options.description,
        options.prompt
      );
      
      if (taskId) {
        console.log(`✅ Task assigned: ${taskId}\n`);
      } else {
        console.log('\n❌ Failed to assign task\n');
      }
    });

  // Broadcast
  team
    .command('broadcast <team-id>')
    .description('Broadcast task to all idle members')
    .requiredOption('-d, --description <desc>', 'Task description')
    .requiredOption('-p, --prompt <prompt>', 'Task prompt')
    .option('-t, --type <type>', 'Task type', 'research')
    .action(async (teamId, options) => {
      console.log('\n📢 Broadcasting to idle members...');
      
      const taskIds = await teamManager.broadcastToIdle(
        teamId,
        options.type as any,
        options.description,
        options.prompt
      );
      
      console.log(`✅ Assigned to ${taskIds.length} idle members`);
      for (const id of taskIds) {
        console.log(`   ${id}`);
      }
      console.log('');
    });

  // Stop task
  team
    .command('stop <task-id>')
    .description('Stop a running task')
    .action(async (taskId) => {
      const stopped = await coordinator.stopWorker(taskId);
      console.log(stopped ? '\n✅ Task stopped\n' : '\n❌ Task not found\n');
    });

  // Task status
  team
    .command('tasks')
    .description('Show all tasks')
    .option('-a, --active', 'Show only active')
    .action((options) => {
      const tasks = options.active 
        ? coordinator.getActiveTasks()
        : coordinator.getAllTasks();
      
      console.log('\n📋 Tasks\n');
      if (tasks.length === 0) {
        console.log('  No tasks\n');
        return;
      }
      
      for (const task of tasks) {
        const icon = task.status === 'running' ? '⏳' 
          : task.status === 'completed' ? '✅' 
          : task.status === 'failed' ? '❌' 
          : task.status === 'pending' ? '⏸' : '🛑';
        console.log(`  ${icon} ${task.id} [${task.type}] ${task.description}`);
        console.log(`     Status: ${task.status}`);
      }
      console.log('');
    });

  // Stats
  team
    .command('stats')
    .description('Show coordinator statistics')
    .action(() => {
      const stats = coordinator.getStats();
      console.log('\n📊 Coordinator Stats\n');
      console.log(`  Total tasks: ${stats.total}`);
      console.log(`  Running: ${stats.running}`);
      console.log(`  Completed: ${stats.completed}`);
      console.log(`  Failed: ${stats.failed}`);
      console.log(`  Total tokens: ${stats.totalTokens.toLocaleString()}`);
      console.log(`  Total duration: ${(stats.totalDuration / 1000).toFixed(1)}s`);
      console.log('');
    });

  // Delete team
  team
    .command('delete <team-id>')
    .description('Delete a team')
    .action((teamId) => {
      const deleted = teamManager.deleteTeam(teamId);
      console.log(deleted ? '\n✅ Team deleted\n' : '\n❌ Team not found\n');
    });

  return team;
}

export default createTeamCommand;
