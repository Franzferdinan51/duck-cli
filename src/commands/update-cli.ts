/**
 * 🦆 Duck Agent - Update CLI Commands
 */

import { Command } from 'commander';
import { UpdateSystem } from './update.js';

export function createUpdateCommand(): Command {
  const update = new Command('update')
    .description('🔄 Update system management');

  // Check for updates
  update
    .command('check')
    .description('Check for updates')
    .action(async () => {
      const updater = new UpdateSystem();
      const info = await updater.checkForUpdates();
      
      console.log('\n🔄 Update Check\n');
      console.log(`  Current: ${info.currentVersion}`);
      console.log(`  Latest:  ${info.latestVersion}`);
      console.log(`  Status:  ${info.updateAvailable ? '🟢 Update available!' : '🟢 Up to date'}`);
      
      if (info.updateAvailable) {
        console.log(`  Commits behind: ${info.commitCount}`);
        console.log('\n  Run `duck update install` to update.\n');
      } else {
        console.log('\n');
      }
    });

  // Install update
  update
    .command('install')
    .description('Install latest update')
    .option('--force', 'Force update even with local changes')
    .option('--no-backup', 'Skip backup before update')
    .action(async (options) => {
      const updater = new UpdateSystem();
      console.log('\n🔄 Updating Duck Agent...\n');
      
      const result = await updater.update({
        backup: options.backup,
        force: options.force,
      });
      
      if (result.success) {
        console.log('\n✅ Update complete!\n');
      } else {
        console.log(`\n❌ Update failed: ${result.error}\n`);
      }
    });

  // Create backup
  update
    .command('backup')
    .description('Create a backup')
    .action(async () => {
      const updater = new UpdateSystem();
      console.log('\n📦 Creating backup...\n');
      
      const backupPath = await updater.createBackup();
      console.log(`✅ Backup created: ${backupPath}\n`);
    });

  // List backups
  update
    .command('backups')
    .description('List available backups')
    .action(() => {
      const updater = new UpdateSystem();
      const backups = updater.listBackups();
      
      console.log('\n📦 Available Backups\n');
      
      if (backups.length === 0) {
        console.log('  No backups found\n');
        return;
      }
      
      for (const backup of backups.slice(0, 10)) {
        console.log(`  ${backup.name}`);
        console.log(`    Date: ${backup.date}`);
        console.log('');
      }
    });

  // Restore backup
  update
    .command('restore <backup-name>')
    .description('Restore from a backup')
    .action((name) => {
      const updater = new UpdateSystem();
      const backups = updater.listBackups();
      const backup = backups.find((b: { name: string }) => b.name === name);
      
      if (!backup) {
        console.log(`\n❌ Backup not found: ${name}\n`);
        return;
      }
      
      const result = updater.restore(backup.path);
      if (result.success) {
        console.log('\n✅ Restore complete!\n');
      } else {
        console.log(`\n❌ Restore failed: ${result.error}\n`);
      }
    });

  // Rollback
  update
    .command('rollback')
    .description('Rollback to previous version')
    .action(() => {
      const updater = new UpdateSystem();
      const result = updater.rollback();
      
      if (result.success) {
        console.log('\n✅ Rolled back!\n');
      } else {
        console.log(`\n❌ Rollback failed: ${result.error}\n`);
      }
    });

  // Status
  update
    .command('status')
    .description('Show git status')
    .action(() => {
      const updater = new UpdateSystem();
      const status = updater.getStatus();
      
      console.log('\n📊 Git Status\n');
      console.log(`  Branch: ${status.branch}`);
      console.log(`  Clean:  ${status.clean ? '✅ Yes' : '❌ No'}`);
      
      if (!status.clean) {
        console.log(`  Untracked: ${status.untracked}`);
        console.log(`  Modified:  ${status.modified}`);
        console.log(`  Staged:    ${status.staged}`);
      }
      
      if (status.ahead > 0) console.log(`  Ahead:     ${status.ahead}`);
      if (status.behind > 0) console.log(`  Behind:    ${status.behind}`);
      
      console.log('');
    });

  // Switch branch
  update
    .command('branch <branch>')
    .description('Switch to a branch')
    .action((branch) => {
      const updater = new UpdateSystem();
      const result = updater.switchBranch(branch);
      
      if (result.success) {
        console.log(`\n✅ Switched to ${branch}!\n`);
      } else {
        console.log(`\n❌ Failed: ${result.error}\n`);
      }
    });

  return update;
}

export default createUpdateCommand;
