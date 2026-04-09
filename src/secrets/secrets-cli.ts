/**
 * 🦆 Duck CLI - Secrets Command
 * CLI interface for secrets management
 */

import { Command } from 'commander';
import { getSecretsManager } from './secrets-manager.js';

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

function formatDate(ts: number): string {
  return new Date(ts).toLocaleString();
}

export function createSecretsCommand(): Command {
  const cmd = new Command('secrets')
    .description('Secure secrets management: set, get, delete, list');

  const manager = getSecretsManager();

  // secrets set <key> <value> [--description <text>] [--tag <tag>]
  cmd
    .command('set <key> <value>')
    .description('Set a secret value')
    .option('-d, --description <text>', 'Description for the secret')
    .option('-t, --tag <tag>', 'Tag to categorize the secret', (val) => val.split(',').map(s => s.trim()), [])
    .action((key: string, value: string, opts: { description?: string; tag?: string[] }) => {
      try {
        manager.set(key, value, { description: opts.description, tags: opts.tag });
        console.log(`${c.green}✅ Secret set: ${key}${c.reset}`);
      } catch (e: any) {
        console.error(`${c.red}❌ Failed to set secret: ${e.message}${c.reset}`);
        process.exit(1);
      }
    });

  // secrets get <key>
  cmd
    .command('get <key>')
    .description('Get a secret value (supports $VAR and ${VAR} expansion)')
    .action((key: string) => {
      const value = manager.get(key);
      if (value === undefined) {
        console.error(`${c.red}❌ Secret not found: ${key}${c.reset}`);
        process.exit(1);
      }
      // Print value only (no formatting) so it can be captured
      console.log(value);
    });

  // secrets show <key>
  cmd
    .command('show <key>')
    .description('Show full details of a secret (metadata + value)')
    .action((key: string) => {
      const entry = manager.getEntry(key);
      if (!entry) {
        console.error(`${c.red}❌ Secret not found: ${key}${c.reset}`);
        process.exit(1);
      }
      console.log(`\n${c.bold}Secret: ${entry.key}${c.reset}`);
      console.log(`${c.cyan}Value:${c.reset} ${entry.value}`);
      if (entry.description) console.log(`${c.cyan}Description:${c.reset} ${entry.description}`);
      console.log(`${c.cyan}Created:${c.reset} ${formatDate(entry.createdAt)}`);
      console.log(`${c.cyan}Updated:${c.reset} ${formatDate(entry.updatedAt)}`);
      if (entry.tags.length > 0) console.log(`${c.cyan}Tags:${c.reset} ${entry.tags.join(', ')}`);
      console.log();
    });

  // secrets delete <key>
  cmd
    .command('delete <key>')
    .description('Delete a secret')
    .action((key: string) => {
      const deleted = manager.delete(key);
      if (deleted) {
        console.log(`${c.green}✅ Deleted secret: ${key}${c.reset}`);
      } else {
        console.error(`${c.red}❌ Secret not found: ${key}${c.reset}`);
        process.exit(1);
      }
    });

  // secrets list [--tag <tag>]
  cmd
    .command('list')
    .description('List all secret keys (values are hidden)')
    .option('-t, --tag <tag>', 'Filter by tag')
    .action((opts: { tag?: string }) => {
      const secrets = manager.list({ tag: opts.tag });
      if (secrets.length === 0) {
        console.log(`${c.dim}No secrets stored${c.reset}`);
        return;
      }
      console.log(`\n${c.bold}🦆 Secrets (${secrets.length})${c.reset}`);
      console.log(`Path: ${c.cyan}${manager.getPath()}${c.reset}\n`);
      for (const s of secrets) {
        const desc = s.description ? ` — ${s.description}` : '';
        const tags = s.tags.length > 0 ? ` [${s.tags.join(', ')}]` : '';
        console.log(`  ${c.green}${s.key}${c.reset}${desc}${c.dim}${tags}${c.reset}`);
        console.log(`    Updated: ${formatDate(s.updatedAt)}`);
      }
      console.log();
    });

  // secrets tags
  cmd
    .command('tags')
    .description('List all tags used across secrets')
    .action(() => {
      const tags = manager.getTags();
      if (tags.length === 0) {
        console.log(`${c.dim}No tags defined${c.reset}`);
        return;
      }
      console.log(`${c.bold}Tags:${c.reset}`);
      for (const tag of tags) {
        const count = manager.list({ tag }).length;
        console.log(`  ${c.cyan}${tag}${c.reset} (${count})`);
      }
      console.log();
    });

  // secrets has <key>
  cmd
    .command('has <key>')
    .description('Check if a secret exists (exit 0 if yes, 1 if no)')
    .action((key: string) => {
      if (manager.has(key)) {
        console.log(`${c.green}✓ Secret exists: ${key}${c.reset}`);
        process.exit(0);
      } else {
        console.log(`${c.red}✗ Secret not found: ${key}${c.reset}`);
        process.exit(1);
      }
    });

  // secrets path
  cmd
    .command('path')
    .description('Show secrets file path')
    .action(() => {
      console.log(manager.getPath());
    });

  // secrets export <key>
  cmd
    .command('export <key>')
    .description('Export a secret with its value (use with caution)')
    .action((key: string) => {
      const entry = manager.export(key);
      if (!entry) {
        console.error(`${c.red}❌ Secret not found: ${key}${c.reset}`);
        process.exit(1);
      }
      const safe: Record<string, any> = { ...entry };
      // Warn about sensitive data
      console.error(`${c.yellow}⚠️  Exporting secret value — handle with care!${c.reset}`);
      console.log(JSON.stringify(safe, null, 2));
    });

  // secrets import <file>
  cmd
    .command('import [file]')
    .description('Bulk import secrets from a JSON file (key-value pairs)')
    .action((file: string) => {
      try {
        const fs = require('fs');
        let data: Record<string, string>;
        if (file) {
          if (!fs.existsSync(file)) {
            console.error(`${c.red}❌ File not found: ${file}${c.reset}`);
            process.exit(1);
          }
          data = JSON.parse(fs.readFileSync(file, 'utf-8'));
        } else {
          // Read from stdin
          let stdin = '';
          process.stdin.on('data', chunk => { stdin += chunk; });
          process.stdin.on('end', () => {
            try {
              data = JSON.parse(stdin);
              manager.importSecrets(data);
              console.log(`${c.green}✅ Imported ${Object.keys(data).length} secrets${c.reset}`);
            } catch (e: any) {
              console.error(`${c.red}❌ Invalid JSON: ${e.message}${c.reset}`);
              process.exit(1);
            }
          });
          return;
        }
        manager.importSecrets(data);
        console.log(`${c.green}✅ Imported ${Object.keys(data).length} secrets${c.reset}`);
      } catch (e: any) {
        console.error(`${c.red}❌ Import failed: ${e.message}${c.reset}`);
        process.exit(1);
      }
    });

  return cmd;
}
