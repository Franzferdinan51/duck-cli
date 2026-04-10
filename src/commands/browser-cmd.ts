/**
 * 🦆 Duck CLI - Browser Command
 * CLI interface for browser automation via OpenClaw browser tool
 */

import { Command } from 'commander';
import {
  getBrowserStatus,
  startBrowser,
  stopBrowser,
  listBrowserTabs,
  openBrowserTab,
  navigateBrowser,
  clickBrowserElement,
  typeBrowserText,
  browserScreenshot,
  getBrowserSnapshot,
  closeBrowserTab,
  browserNavigateAction,
  type BrowserStatus,
  type TabInfo,
} from '../browser/browser-control.js';

import { takeScreenshot, takeSnapshot } from '../browser/screenshot.js';

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
};

export function createBrowserCommand(): Command {
  const cmd = new Command('browser')
    .description('Browser automation - status, tabs, navigate, click, type, screenshot');

  // ── browser status ────────────────────────────────────────────────────────
  cmd
    .command('status')
    .description('Show browser running status')
    .option('-p, --profile <name>', 'Browser profile', 'user')
    .action(async (opts) => {
      try {
        const status = await getBrowserStatus(opts.profile);
        console.log(`\n${c.bold}🌐 Browser Status${c.reset}`);
        console.log(`  Running:  ${status.running ? `${c.green}Yes${c.reset}` : `${c.red}No${c.reset}`}`);
        console.log(`  Profile:  ${status.profile}`);
        
        if (status.tabs.length > 0) {
          console.log(`  Tabs:     ${status.tabs.length}`);
        }
        console.log();
      } catch (err: any) {
        console.error(`${c.red}Error:${c.reset} ${err.message}`);
      }
    });

  // ── browser start ───────────────────────────────────────────────────────
  cmd
    .command('start')
    .description('Start browser')
    .option('-p, --profile <name>', 'Browser profile', 'user')
    .action(async (opts) => {
      try {
        await startBrowser(opts.profile);
        console.log(`${c.green}✅ Browser started${c.reset} (profile: ${opts.profile})`);
      } catch (err: any) {
        console.error(`${c.red}Error:${c.reset} ${err.message}`);
      }
    });

  // ── browser stop ────────────────────────────────────────────────────────
  cmd
    .command('stop')
    .description('Stop browser')
    .option('-p, --profile <name>', 'Browser profile', 'user')
    .action(async (opts) => {
      try {
        await stopBrowser(opts.profile);
        console.log(`${c.green}✅ Browser stopped${c.reset}`);
      } catch (err: any) {
        console.error(`${c.red}Error:${c.reset} ${err.message}`);
      }
    });

  // ── browser tabs ────────────────────────────────────────────────────────
  cmd
    .command('tabs')
    .description('List open browser tabs')
    .option('-p, --profile <name>', 'Browser profile', 'user')
    .action(async (opts) => {
      try {
        const tabs = await listBrowserTabs(opts.profile);
        console.log(`\n${c.bold}📑 Browser Tabs${c.reset}\n`);
        for (let i = 0; i < tabs.length; i++) {
          const tab = tabs[i];
          const active = tab.active ? ` ${c.green}[ACTIVE]${c.reset}` : '';
          const title = tab.title ? tab.title.substring(0, 50) : '(no title)';
          console.log(`  ${i + 1}. ${c.cyan}${tab.url}${c.reset} ${c.dim}${title}${c.reset}${active}`);
        }
        console.log();
      } catch (err: any) {
        console.error(`${c.red}Error:${c.reset} ${err.message}`);
      }
    });

  // ── browser open ────────────────────────────────────────────────────────
  cmd
    .command('open')
    .description('Open URL in new tab')
    .argument('<url>', 'URL to open')
    .option('-p, --profile <name>', 'Browser profile', 'user')
    .action(async (url, opts) => {
      try {
        const tab = await openBrowserTab(url, opts.profile);
        console.log(`${c.green}✅ Opened:${c.reset} ${url}`);
        console.log(`   Tab ID: ${tab.id}`);
      } catch (err: any) {
        console.error(`${c.red}Error:${c.reset} ${err.message}`);
      }
    });

  // ── browser navigate ─────────────────────────────────────────────────────
  cmd
    .command('navigate')
    .description('Navigate to URL')
    .argument('<url>', 'URL to navigate to')
    .option('-t, --target <target>', 'Target browser (host/sandbox/node)', 'host')
    .option('-p, --profile <name>', 'Browser profile', 'user')
    .action(async (url, opts) => {
      try {
        await navigateBrowser({
          url,
          target: opts.target as 'host' | 'sandbox' | 'node',
          profile: opts.profile,
        });
        console.log(`${c.green}✅ Navigated to:${c.reset} ${url}`);
      } catch (err: any) {
        console.error(`${c.red}Error:${c.reset} ${err.message}`);
      }
    });

  // ── browser click ───────────────────────────────────────────────────────
  cmd
    .command('click')
    .description('Click element by ref (e.g., e5)')
    .argument('<ref>', 'Element reference')
    .option('-t, --target <target>', 'Target browser (host/sandbox/node)', 'host')
    .option('--tab <id>', 'Target tab ID')
    .action(async (ref, opts) => {
      try {
        await clickBrowserElement({
          ref,
          target: opts.target as 'host' | 'sandbox' | 'node',
          targetId: opts.tab,
        });
        console.log(`${c.green}✅ Clicked:${c.reset} ${ref}`);
      } catch (err: any) {
        console.error(`${c.red}Error:${c.reset} ${err.message}`);
      }
    });

  // ── browser type ────────────────────────────────────────────────────────
  cmd
    .command('type')
    .description('Type text into focused element')
    .argument('<text>', 'Text to type')
    .option('-t, --target <target>', 'Target browser (host/sandbox/node)', 'host')
    .option('--tab <id>', 'Target tab ID')
    .action(async (text, opts) => {
      try {
        await typeBrowserText({
          text,
          target: opts.target as 'host' | 'sandbox' | 'node',
          targetId: opts.tab,
        });
        console.log(`${c.green}✅ Typed:${c.reset} "${text}"`);
      } catch (err: any) {
        console.error(`${c.red}Error:${c.reset} ${err.message}`);
      }
    });

  // ── browser screenshot ───────────────────────────────────────────────────
  cmd
    .command('screenshot [path]')
    .description('Take screenshot')
    .option('-o, --output <path>', 'Save screenshot to file')
    .option('-f, --full-page', 'Capture full page')
    .option('--image-type <type>', 'Image type (png/jpeg)', 'png')
    .option('-t, --target <target>', 'Target browser (host/sandbox/node)', 'host')
    .option('--tab <id>', 'Target tab ID')
    .option('-p, --profile <name>', 'Browser profile', 'user')
    .action(async (pathArg, opts) => {
      try {
        const { path: outPath, data } = await takeScreenshot({
          path: opts.output || pathArg,
          fullPage: opts.fullPage,
          type: opts.imageType as 'png' | 'jpeg',
          target: opts.target as 'sandbox' | 'host' | 'node',
          targetId: opts.tab,
          profile: opts.profile,
        });

        if (outPath) {
          console.log(`${c.green}✅ Screenshot saved:${c.reset} ${outPath}`);
        } else {
          console.log(`${c.yellow}Screenshot captured (${data.length} bytes, not saved)${c.reset}`);
        }
      } catch (err: any) {
        console.error(`${c.red}Error:${c.reset} ${err.message}`);
      }
    });

  // ── browser snapshot ────────────────────────────────────────────────────
  cmd
    .command('snapshot')
    .description('Get page accessibility snapshot')
    .option('-o, --output <path>', 'Save snapshot to file')
    .option('--format <format>', 'Format (role/aria/ai)', 'role')
    .option('-t, --target <target>', 'Target browser (host/sandbox/node)', 'host')
    .option('--tab <id>', 'Target tab ID')
    .option('-p, --profile <name>', 'Browser profile', 'user')
    .action(async (opts) => {
      try {
        const { data } = await takeSnapshot({
          path: opts.output,
          format: opts.format as 'aria' | 'ai' | 'role',
          target: opts.target as 'sandbox' | 'host' | 'node',
          targetId: opts.tab,
          profile: opts.profile,
        });
        console.log(JSON.stringify(data, null, 2));
      } catch (err: any) {
        console.error(`${c.red}Error:${c.reset} ${err.message}`);
      }
    });

  // ── browser close ──────────────────────────────────────────────────────
  cmd
    .command('close')
    .description('Close a browser tab')
    .argument('<tabId>', 'Tab ID to close')
    .option('-p, --profile <name>', 'Browser profile', 'user')
    .action(async (tabId, opts) => {
      try {
        await closeBrowserTab(tabId, opts.profile);
        console.log(`${c.green}✅ Tab closed:${c.reset} ${tabId}`);
      } catch (err: any) {
        console.error(`${c.red}Error:${c.reset} ${err.message}`);
      }
    });

  // ── browser back/forward/reload ────────────────────────────────────────
  cmd
    .command('back')
    .description('Navigate browser back')
    .option('-p, --profile <name>', 'Browser profile', 'user')
    .action(async (opts) => {
      try {
        await browserNavigateAction('back', opts.profile);
        console.log(`${c.green}✅ Navigated back${c.reset}`);
      } catch (err: any) {
        console.error(`${c.red}Error:${c.reset} ${err.message}`);
      }
    });

  cmd
    .command('forward')
    .description('Navigate browser forward')
    .option('-p, --profile <name>', 'Browser profile', 'user')
    .action(async (opts) => {
      try {
        await browserNavigateAction('forward', opts.profile);
        console.log(`${c.green}✅ Navigated forward${c.reset}`);
      } catch (err: any) {
        console.error(`${c.red}Error:${c.reset} ${err.message}`);
      }
    });

  cmd
    .command('reload')
    .description('Reload current page')
    .option('-p, --profile <name>', 'Browser profile', 'user')
    .action(async (opts) => {
      try {
        await browserNavigateAction('reload', opts.profile);
        console.log(`${c.green}✅ Reloaded${c.reset}`);
      } catch (err: any) {
        console.error(`${c.red}Error:${c.reset} ${err.message}`);
      }
    });

  return cmd;
}

export default createBrowserCommand;
