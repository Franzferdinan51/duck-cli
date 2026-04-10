/**
 * 🦆 Duck CLI - Sandbox Command
 * CLI interface for sandbox management: list, recreate, explain
 */

import { Command } from 'commander';
import {
  listSandboxes,
  recreateSandbox,
  explainPage,
  openInSandbox,
  getSandboxStatus,
  type SandboxInfo,
  type ExplainResult,
} from '../sandbox/sandbox-manager.js';

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
};

export function createSandboxCommand(): Command {
  const cmd = new Command('sandbox')
    .description('Sandbox management - list, recreate, explain');

  // ── sandbox list ────────────────────────────────────────────────────────
  cmd
    .command('list')
    .alias('ls')
    .description('List all sandboxes')
    .action(async () => {
      try {
        const sandboxes = await listSandboxes();
        console.log(`\n${c.bold}🧪 Sandboxes${c.reset}\n`);
        
        if (sandboxes.length === 0) {
          console.log(`  ${c.dim}No sandboxes found${c.reset}`);
        }
        
        for (const s of sandboxes) {
          const statusColor = s.status === 'active' ? c.green : s.status === 'error' ? c.red : c.yellow;
          const statusIcon = s.status === 'active' ? '🟢' : s.status === 'error' ? '🔴' : '🟡';
          console.log(`  ${statusIcon} ${c.bold}${s.name}${c.reset}`);
          console.log(`     ID:     ${s.id}`);
          console.log(`     Status: ${statusColor}${s.status}${c.reset}`);
          console.log(`     Profile: ${s.profile}`);
          if (s.created) console.log(`     Created: ${s.created}`);
          console.log();
        }
      } catch (err: any) {
        console.error(`${c.red}Error:${c.reset} ${err.message}`);
      }
    });

  // ── sandbox status ─────────────────────────────────────────────────────
  cmd
    .command('status')
    .description('Show sandbox status')
    .action(async () => {
      try {
        const status = await getSandboxStatus();
        const statusColor = status.status === 'active' ? c.green : status.status === 'error' ? c.red : c.yellow;
        const statusIcon = status.status === 'active' ? '🟢' : status.status === 'error' ? '🔴' : '🟡';
        
        console.log(`\n${c.bold}🧪 Sandbox Status${c.reset}`);
        console.log(`  Name:    ${status.name}`);
        console.log(`  ID:      ${status.id}`);
        console.log(`  Status:  ${statusColor}${statusIcon} ${status.status}${c.reset}`);
        console.log(`  Profile: ${status.profile}`);
        console.log();
      } catch (err: any) {
        console.error(`${c.red}Error:${c.reset} ${err.message}`);
      }
    });

  // ── sandbox recreate ───────────────────────────────────────────────────
  cmd
    .command('recreate')
    .description('Recreate sandbox (stop and start fresh)')
    .option('--id <id>', 'Sandbox ID to recreate')
    .action(async (opts) => {
      try {
        console.log(`${c.yellow}♻️  Recreating sandbox...${c.reset}`);
        const sandbox = await recreateSandbox(opts.id);
        const statusColor = sandbox.status === 'active' ? c.green : c.yellow;
        console.log(`${c.green}✅ Sandbox recreated${c.reset}`);
        console.log(`   ID:     ${sandbox.id}`);
        console.log(`   Name:   ${sandbox.name}`);
        console.log(`   Status: ${statusColor}${sandbox.status}${c.reset}`);
      } catch (err: any) {
        console.error(`${c.red}Error:${c.reset} ${err.message}`);
      }
    });

  // ── sandbox explain ────────────────────────────────────────────────────
  cmd
    .command('explain')
    .description('Explain current page structure')
    .option('--tab <id>', 'Target tab ID')
    .option('-o, --output <path>', 'Save explanation to file')
    .action(async (opts) => {
      try {
        const result = await explainPage(opts.tab);
        
        console.log(`\n${c.bold}🔍 Page Explanation${c.reset}`);
        console.log(`\n${c.cyan}${result.summary}${c.reset}\n`);
        
        if (result.links.length > 0) {
          console.log(`${c.bold}Links:${c.reset}`);
          for (const link of result.links.slice(0, 10)) {
            console.log(`  ${c.green}[${link.ref}]${c.reset} ${link.text || link.href}`);
          }
          console.log();
        }
        
        if (result.forms.length > 0) {
          console.log(`${c.bold}Forms:${c.reset}`);
          for (const form of result.forms) {
            console.log(`  ${c.green}[${form.ref}]${c.reset} ${form.method ?? 'GET'} ${form.action ?? ''}`);
            for (const field of form.fields) {
              console.log(`    - ${field}`);
            }
          }
          console.log();
        }
        
        if (result.elements.length > 0) {
          console.log(`${c.bold}Interactive Elements:${c.reset}`);
          for (const el of result.elements.slice(0, 15)) {
            console.log(`  ${c.green}[${el.ref}]${c.reset} ${el.role} ${el.name || ''}`);
          }
          console.log();
        }
        
        if (opts.output) {
          const { writeFileSync } = await import('fs');
          writeFileSync(opts.output, JSON.stringify(result, null, 2));
          console.log(`${c.green}✅ Saved to:${c.reset} ${opts.output}`);
        }
      } catch (err: any) {
        console.error(`${c.red}Error:${c.reset} ${err.message}`);
      }
    });

  // ── sandbox open ────────────────────────────────────────────────────────
  cmd
    .command('open')
    .description('Open URL in sandbox')
    .argument('<url>', 'URL to open')
    .action(async (url) => {
      try {
        await openInSandbox(url);
        console.log(`${c.green}✅ Opened in sandbox:${c.reset} ${url}`);
      } catch (err: any) {
        console.error(`${c.red}Error:${c.reset} ${err.message}`);
      }
    });

  return cmd;
}

export default createSandboxCommand;
