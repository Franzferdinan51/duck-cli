/**
 * 🦆 Duck Agent - Cron CLI Commands
 */

import { Command } from 'commander';
import { CronManager, CRON_JOBS } from '../cron/cron-manager.js';

export function createCronCommand(): Command {
  const cron = new Command('cron')
    .description('⏰ Cron Job Manager - Schedule and manage autonomous tasks');

  // List jobs
  cron
    .command('list')
    .description('List all cron jobs')
    .option('-e, --enabled', 'Show only enabled jobs')
    .option('-c, --category <cat>', 'Filter by category')
    .action((options) => {
      const manager = new CronManager();
      
      if (options.category) {
        const jobs = manager.listByCategory(options.category);
        console.log(`\n⏰ Cron Jobs (${options.category})\n`);
        for (const job of jobs) {
          const status = job.enabled ? '✅' : '❌';
          console.log(`  ${status} ${job.name}`);
          console.log(`     ${job.schedule} - ${job.scheduleHuman}`);
          console.log(`     ${job.description}`);
          console.log('');
        }
      } else {
        const jobs = manager.listJobs(options.enabled);
        console.log(`\n⏰ Cron Jobs (${options.enabled ? 'enabled' : 'all'})\n`);
        
        // Group by category
        const byCategory = new Map<string, typeof jobs>();
        for (const job of jobs) {
          if (!byCategory.has(job.category)) {
            byCategory.set(job.category, []);
          }
          byCategory.get(job.category)!.push(job);
        }
        
        for (const [cat, catJobs] of byCategory) {
          console.log(`  📁 ${cat.toUpperCase()}`);
          for (const job of catJobs) {
            const status = job.enabled ? '✅' : '❌';
            console.log(`     ${status} ${job.name.padEnd(25)} ${job.schedule}`);
          }
          console.log('');
        }
      }
    });

  // Categories
  cron
    .command('categories')
    .description('List job categories')
    .action(() => {
      const manager = new CronManager();
      const cats = manager.getCategories();
      
      console.log('\n📁 Cron Categories\n');
      for (const cat of cats) {
        console.log(`  ${cat.name.padEnd(20)} ${cat.count} jobs`);
      }
      console.log('');
    });

  // Enable
  cron
    .command('enable <job-id>')
    .description('Enable a cron job')
    .option('-a, --all', 'Enable all jobs')
    .option('-c, --category <cat>', 'Enable all in category')
    .action((jobId, options) => {
      const manager = new CronManager();
      
      if (options.all) {
        const cats = manager.getCategories();
        let total = 0;
        for (const cat of cats) {
          total += manager.enableCategory(cat.id);
        }
        manager.install();
        console.log(`\n✅ Enabled all ${total} cron jobs\n`);
      } else if (options.category) {
        const count = manager.enableCategory(options.category);
        manager.install();
        console.log(`\n✅ Enabled ${count} jobs in ${options.category}\n`);
      } else {
        if (manager.enable(jobId)) {
          manager.install();
          console.log(`\n✅ Enabled: ${jobId}\n`);
        } else {
          console.log(`\n❌ Job not found: ${jobId}\n`);
        }
      }
    });

  // Disable
  cron
    .command('disable <job-id>')
    .description('Disable a cron job')
    .option('-a, --all', 'Disable all jobs')
    .option('-c, --category <cat>', 'Disable all in category')
    .action((jobId, options) => {
      const manager = new CronManager();
      
      if (options.all) {
        for (const job of manager.listJobs()) {
          manager.disable(job.id);
        }
        manager.install();
        console.log('\n✅ Disabled all cron jobs\n');
      } else if (options.category) {
        const count = manager.disableCategory(options.category);
        manager.install();
        console.log(`\n✅ Disabled ${count} jobs in ${options.category}\n`);
      } else {
        manager.disable(jobId);
        manager.install();
        console.log(`\n✅ Disabled: ${jobId}\n`);
      }
    });

  // Run job
  cron
    .command('run <job-id>')
    .description('Run a cron job manually')
    .option('-a, --all', 'Run all enabled jobs')
    .action(async (jobId, options) => {
      const manager = new CronManager();
      
      if (options.all) {
        console.log('\n⏰ Running all enabled jobs...\n');
        const result = await manager.runAll();
        
        for (const r of result.results) {
          const icon = r.success ? '✅' : '❌';
          console.log(`  ${icon} ${r.jobId.padEnd(30)} ${(r.duration / 1000).toFixed(1)}s`);
        }
        console.log('');
      } else {
        console.log(`\n⏰ Running: ${jobId}\n`);
        const result = await manager.runJob(jobId);
        
        if (result.success) {
          console.log('✅ Success');
          if (result.output) console.log(result.output);
        } else {
          console.log('❌ Failed');
          if (result.error) console.log(result.error);
        }
        console.log('');
      }
    });

  // Status
  cron
    .command('status [job-id]')
    .description('Check cron job status')
    .action((jobId) => {
      const manager = new CronManager();
      
      if (jobId) {
        const status = manager.getJobStatus(jobId);
        if (status.job) {
          console.log(`\n⏰ ${status.job.name}`);
          console.log(`   ${status.job.enabled ? '✅ Enabled' : '❌ Disabled'}`);
          console.log(`   Schedule: ${status.job.schedule} (${status.job.scheduleHuman})`);
          console.log(`   Script: ${status.job.script}`);
          console.log(`   Log: ${status.job.logFile}`);
          if (status.lastRun) {
            console.log(`   Last run: ${status.lastRun}`);
          }
          console.log('');
        } else {
          console.log('\n❌ Job not found\n');
        }
      } else {
        const { exists, missing } = manager.verifyScripts();
        console.log('\n⏰ Cron Status\n');
        console.log(`  Scripts: ${exists.length}/${CRON_JOBS.length} present`);
        if (missing.length > 0) {
          console.log(`  Missing: ${missing.join(', ')}`);
        }
        
        const enabled = manager.listJobs(true).length;
        console.log(`  Enabled: ${enabled}/${CRON_JOBS.length}`);
        console.log('');
      }
    });

  // Show crontab
  cron
    .command('show')
    .description('Show current crontab')
    .action(() => {
      const manager = new CronManager();
      console.log('\n📋 Current Crontab\n');
      console.log(manager.showCrontab());
    });

  // Install
  cron
    .command('install')
    .description('Install crontab with enabled jobs')
    .action(() => {
      const manager = new CronManager();
      const { exists, missing } = manager.verifyScripts();
      
      console.log(`\n⏰ Installing crontab (${exists.length} scripts present)`);
      
      if (missing.length > 0) {
        console.log(`⚠️  Missing scripts: ${missing.length}`);
        for (const m of missing) {
          console.log(`    - ${m}`);
        }
      }
      
      const result = manager.install();
      if (result.success) {
        console.log('✅ Crontab installed successfully');
      } else {
        console.log(`❌ Failed: ${result.message}`);
      }
      console.log('');
    });

  // Verify
  cron
    .command('verify')
    .description('Verify all cron scripts exist')
    .action(() => {
      const manager = new CronManager();
      const { exists, missing } = manager.verifyScripts();
      
      console.log('\n🔍 Verifying Cron Scripts\n');
      
      console.log('  ✅ Present:');
      for (const e of exists) {
        const job = CRON_JOBS.find(j => j.id === e);
        console.log(`     ${job?.name || e}`);
      }
      
      if (missing.length > 0) {
        console.log('\n  ❌ Missing:');
        for (const m of missing) {
          const job = CRON_JOBS.find(j => j.id === m);
          console.log(`     ${job?.name || m}`);
        }
      }
      
      console.log(`\n  Total: ${exists.length}/${CRON_JOBS.length}\n`);
    });

  // Create custom job
  cron
    .command('create <id>')
    .description('Create a custom cron job')
    .requiredOption('-n, --name <name>', 'Job name')
    .requiredOption('-s, --schedule <cron>', 'Cron schedule (e.g., "0 * * * *")')
    .requiredOption('-c, --command <cmd>', 'Command/script to run')
    .option('-d, --description <desc>', 'Job description')
    .action((id, options) => {
      const manager = new CronManager();
      const result = manager.createCustomJob(
        id,
        options.name,
        options.description || '',
        options.schedule,
        options.command
      );
      
      if (result.success) {
        console.log(`\n✅ ${result.message}`);
        console.log(`   Schedule: ${options.schedule}`);
        console.log(`   Run 'duck cron install' to activate\n`);
      } else {
        console.log(`\n❌ ${result.message}\n`);
      }
    });

  // Delete custom job
  cron
    .command('delete <job-id>')
    .description('Delete a custom cron job')
    .action((jobId) => {
      const manager = new CronManager();
      const result = manager.deleteCustomJob(jobId);
      
      if (result.success) {
        manager.install();
        console.log(`\n✅ ${result.message}\n`);
      } else {
        console.log(`\n❌ ${result.message}\n`);
      }
    });

  return cron;
}

export default createCronCommand;
