/**
 * duck-cli v3 - Failures Command
 * CLI: duck failures [stats|list|tools|providers]
 * Shows failure reports and statistics from the FailureReporter pipeline.
 */

import { Command } from 'commander';
import { getFailureReporter } from '../orchestrator/failure-reporter.js';
import { FailureSource } from '../orchestrator/meta-types.js';

export function createFailuresCommand(): Command {
  const cmd = new Command();
  cmd
    .name('failures')
    .description('🦆 View failure reports from the self-healing pipeline');

  cmd
    .command('stats', { isDefault: true })
    .description('Show failure statistics')
    .action(() => {
      try {
        const reporter = getFailureReporter();
        const stats = reporter.getStats();

        console.log('\n🦆 Duck CLI — Failure Statistics\n');
        console.log(`Total failures logged: ${stats.total}`);
        const sourceEntries = Object.entries(stats.bySource).filter(([k]) => k && k !== 'undefined' && k !== 'null');
        if (sourceEntries.length > 0) {
          console.log('\nBy source:');
          for (const [source, count] of sourceEntries) {
            console.log(`  ${source}: ${count}`);
          }
        }
        const sevEntries = Object.entries(stats.bySeverity).filter(([k]) => k && k !== 'undefined' && k !== 'null');
        if (sevEntries.length > 0) {
          console.log('\nBy severity:');
          for (const [sev, count] of sevEntries) {
            const icon = sev === 'critical' ? '🔴' : sev === 'high' ? '🔴' : sev === 'medium' ? '🟡' : '🟢';
            console.log(`  ${icon} ${sev}: ${count}`);
          }
        }
        const topTools = stats.topTools.filter(t => t.toolName && t.toolName.trim());
        if (topTools.length > 0) {
          console.log('\nTop failing tools:');
          for (const t of topTools) {
            console.log(`  ${t.toolName}: ${t.count} failures`);
          }
        }
        const topProviders = stats.topProviders.filter(p => p.providerName && p.providerName.trim());
        if (topProviders.length > 0) {
          console.log('\nTop failing providers:');
          for (const p of topProviders) {
            console.log(`  ${p.providerName}: ${p.count} failures`);
          }
        }
        console.log('');
      } catch (e: any) {
        console.error(`Error: ${e.message}`);
      }
    });

  cmd
    .command('list [source]')
    .description('List recent failures (optionally filter by source: tool, provider, telegram, bridge, council, auto_heal, mesh, internal)')
    .option('-n, --limit <number>', 'Number of failures to show', '20')
    .action((source?: string, options?: { limit?: string }) => {
      try {
        const reporter = getFailureReporter();
        const limit = parseInt(options?.limit || '20', 10);
        const failures = source
          ? reporter.getFailuresBySource(source as FailureSource, limit)
          : reporter.getRecentFailures(limit);

        if (failures.length === 0) {
          console.log('No failures logged yet. 🟢 All clear!');
          return;
        }

        console.log(`\n🦆 Recent Failures (${failures.length} shown)\n`);
        for (const f of failures) {
          const icon = f.severity === 'critical' ? '🔴'
            : f.severity === 'high' ? '🔴'
            : f.severity === 'medium' ? '🟡'
            : '🟢';
          const time = new Date(f.timestamp).toLocaleString();
          const occ = f.occurrenceCount > 1 ? ` (x${f.occurrenceCount})` : '';
          console.log(`${icon} [${f.source}] ${time}`);
          console.log(`   ${f.message}${occ}`);
          if (f.toolName) console.log(`   Tool: ${f.toolName}`);
          if (f.providerName) console.log(`   Provider: ${f.providerName}`);
          if (f.diagnosis) console.log(`   Diagnosis: ${f.diagnosis}`);
          if (f.recoveryAction) console.log(`   Recovery: ${f.recoveryAction}`);
          console.log('');
        }
      } catch (e: any) {
        console.error(`Error: ${e.message}`);
      }
    });

  cmd
    .command('tools')
    .description('Show top failing tools')
    .option('-n, --limit <number>', 'Number of tools to show', '10')
    .action((options?: { limit?: string }) => {
      try {
        const reporter = getFailureReporter();
        const limit = parseInt(options?.limit || '10', 10);
        const tools = reporter.getTopFailingTools(limit);

        if (tools.length === 0) {
          console.log('No tool failures logged yet. 🟢');
          return;
        }

        console.log('\n🦆 Top Failing Tools\n');
        for (const t of tools) {
          const bar = '█'.repeat(Math.min(t.count, 20));
          const lastSeen = new Date(t.lastSeen).toLocaleString();
          console.log(`${t.toolName}: ${t.count} failures | Last: ${lastSeen}`);
          console.log(`  ${bar}`);
        }
        console.log('');
      } catch (e: any) {
        console.error(`Error: ${e.message}`);
      }
    });

  cmd
    .command('providers')
    .description('Show top failing AI providers')
    .option('-n, --limit <number>', 'Number of providers to show', '10')
    .action((options?: { limit?: string }) => {
      try {
        const reporter = getFailureReporter();
        const limit = parseInt(options?.limit || '10', 10);
        const providers = reporter.getTopFailingProviders(limit);

        if (providers.length === 0) {
          console.log('No provider failures logged yet. 🟢');
          return;
        }

        console.log('\n🦆 Top Failing Providers\n');
        for (const p of providers) {
          const lastSeen = new Date(p.lastSeen).toLocaleString();
          console.log(`${p.providerName}: ${p.count} failures | Last: ${lastSeen}`);
        }
        console.log('');
      } catch (e: any) {
        console.error(`Error: ${e.message}`);
      }
    });

  return cmd;
}

/** @deprecated Use createFailuresCommand() instead */
export function registerFailuresCommand(_program: Command): void {
  // No-op - kept for backwards compatibility
}
