/**
 * 🦆 Duck CLI - Backup CLI
 * Commander-based CLI for backup commands: create, verify, restore, list, prune
 */

import { Command } from 'commander';
import { BackupManager, formatBytes } from './backup-manager.js';
import { basename } from 'path';

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

export function createBackupCommand(): Command {
  const cmd = new Command('backup')
    .description('🦆 Backup management — create, verify, restore, list, prune');

  const manager = new BackupManager();

  // backup create [name]
  cmd
    .command('create [name]')
    .description('Create a new backup')
    .option('--no-compress', 'Skip compression')
    .option('--output <path>', 'Output file path')
    .option('--include <paths...>', 'Additional paths to include')
    .option('--exclude <paths...>', 'Paths to exclude')
    .action(async (name: string | undefined, options: Record<string, any>) => {
      try {
        const result = await manager.create({
          name,
          compress: options.compress !== false,
          output: options.output,
          include: options.include,
          exclude: options.exclude,
        });
        console.log(`\n${c.green}✅ Backup created successfully${c.reset}`);
        console.log(`Path: ${result.path}`);
        console.log(`Files: ${result.stats.fileCount} | Size: ${formatBytes(result.stats.totalSize)}`);
      } catch (e: any) {
        console.error(`${c.red}❌ Backup failed: ${e.message}${c.reset}`);
        process.exit(1);
      }
    });

  // backup verify <backup>
  cmd
    .command('verify <backup>')
    .description('Verify backup integrity')
    .action(async (backupPath: string) => {
      const result = await manager.verify(backupPath);
      if (result.ok) {
        const m = result.stats.manifest;
        console.log(`${c.green}✅ Backup verified: ${basename(backupPath)}${c.reset}`);
        console.log(`  ${c.cyan}Version:${c.reset} ${m.version} | ${c.cyan}Created:${c.reset} ${new Date(m.timestamp).toLocaleString()}`);
        console.log(`  ${c.cyan}Files:${c.reset} ${result.stats.fileCount} | ${c.cyan}Size:${c.reset} ${formatBytes(m.totalSize)}`);
        console.log(`  ${c.cyan}Host:${c.reset} ${m.hostname}`);
        process.exit(0);
      } else {
        console.error(`${c.red}❌ Backup verification failed:${c.reset}`);
        result.errors.forEach(e => console.log(`  ${c.red}- ${e}${c.reset}`));
        process.exit(1);
      }
    });

  // backup restore <backup>
  cmd
    .command('restore <backup>')
    .description('Restore from a backup')
    .option('--target <dir>', 'Restore target directory')
    .option('-y, --yes', 'Skip confirmation')
    .action(async (backupPath: string, options: Record<string, any>) => {
      try {
        const result = await manager.restore(backupPath, {
          overwrite: options.yes,
          target: options.target,
        });
        if (!result.success && result.error) {
          console.error(`${c.red}❌ Restore failed: ${result.error}${c.reset}`);
          process.exit(1);
        }
      } catch (e: any) {
        console.error(`${c.red}❌ Restore failed: ${e.message}${c.reset}`);
        process.exit(1);
      }
    });

  // backup list
  cmd
    .command('list')
    .description('List all backups')
    .action(() => {
      const backups = manager.list();
      if (backups.length === 0) {
        console.log(`${c.yellow}No backups found${c.reset}`);
        console.log(`${c.dim}Run: duck backup create${c.reset}`);
        return;
      }
      console.log(`\n${c.bold}🦆 Backups (${backups.length})${c.reset}\n`);
      for (const b of backups) {
        const m = b.manifest;
        const size = m ? formatBytes(m.totalSize) : 'unknown';
        const date = m ? new Date(m.timestamp).toLocaleString() : 'unknown';
        console.log(`  ${c.cyan}${basename(b.path)}${c.reset}`);
        console.log(`    ${c.dim}${date} | ${size} | ${m?.includes.length || 0} files${c.reset}`);
        if (m?.hostname) console.log(`    Host: ${m.hostname}`);
        console.log();
      }
    });

  // backup prune [count]
  cmd
    .command('prune [count]')
    .description('Delete old backups, keeping most recent N (default 5)')
    .action((count: string | undefined) => {
      const keep = parseInt(count || '5', 10);
      manager.prune(keep);
    });

  return cmd;
}
