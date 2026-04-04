import { Command } from 'commander';
import { UpdateSystem } from './update.js';
export function createUpdateCommand(): Command {
  const update = new Command('update').description('🔄 Update system management');
  update.command('check').description('Check for updates').action(async () => {
    const system = new UpdateSystem();
    const info = await system.checkForUpdates();
    console.log(JSON.stringify(info, null, 2));
  });
  update.command('install').description('Install updates').action(async () => {
    const system = new UpdateSystem();
    await system.update({});
  });
  update.command('backup').description('Backup current installation').action(async () => {
    const system = new UpdateSystem();
    const path = await system.createBackup();
    console.log('Backup created:', path);
  });
  return update;
}
