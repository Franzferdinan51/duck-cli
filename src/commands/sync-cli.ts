/**
 * 🦆 Duck Agent - Sync Command
 * File watching, upstream syncing, and OpenClaw integration
 */

import { Command } from 'commander';
import { existsSync, watch } from 'fs';
import { join, dirname } from 'path';
import { execSync, spawn } from 'child_process';


// Find workspace source directory
function findWorkspaceSource(): string {
  const candidates = [
    join(process.cwd(), 'src'),
    join(process.cwd()),
    '/tmp/duck-cli-main/src',
    join(process.env.HOME || '', '.openclaw/workspace/duck-cli-src/src'),
    join(process.env.HOME || '', 'duck-cli/src'),
  ];
  for (const c of candidates) {
    if (existsSync(join(c, '..', 'package.json'))) {
      return c;
    }
    if (existsSync(join(c, 'agent', 'core.ts'))) {
      return c;
    }
  }
  return candidates[0];
}

function findProjectRoot(): string {
  const candidates = [
    process.cwd(),
    '/tmp/duck-cli-main',
    join(process.env.HOME || '', '.openclaw/workspace/duck-cli-src'),
    join(process.env.HOME || '', 'duck-cli'),
  ];
  for (const c of candidates) {
    if (existsSync(join(c, 'package.json'))) {
      return c;
    }
  }
  return candidates[0];
}

interface SyncState {
  lastWatch: string | null;
  watchedPath: string | null;
  openclawEnabled: boolean;
  autoRebuild: boolean;
  autoPush: boolean;
}

const STATE_FILE = join(process.env.HOME || '', '.duck', 'sync-state.json');

function loadSyncState(): SyncState {
  try {
    if (existsSync(STATE_FILE)) {
      return JSON.parse(require('fs').readFileSync(STATE_FILE, 'utf-8'));
    }
  } catch {}
  return {
    lastWatch: null,
    watchedPath: null,
    openclawEnabled: true,
    autoRebuild: true,
    autoPush: false,
  };
}

function saveSyncState(state: SyncState): void {
  try {
    require('fs').mkdirSync(require('path').dirname(STATE_FILE), { recursive: true });
    require('fs').writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch {}
}

/** Notify OpenClaw via Gateway API (HTTP to Telegram) */
async function notifyOpenClaw(message: string, type: 'info' | 'warning' | 'success' | 'error' = 'info'): Promise<void> {
  try {
    const state = loadSyncState();
    if (!state.openclawEnabled) return;

    // Use curl to call OpenClaw gateway Telegram endpoint
    const emoji: Record<string, string> = {
      info: '🔔',
      warning: '⚠️',
      success: '✅',
      error: '🔴',
    };
    
    const body = JSON.stringify({
      channel: 'telegram',
      message: `🦆 ${emoji[type]} **Duck-CLI Sync** ${emoji[type]}\n\n${message}`,
      topicId: 647908,
    });

    execSync(
      `curl -s -X POST http://localhost:18792/api/message/send -H "Content-Type: application/json" -d '${body.replace(/'/g, "'\\''")}'`,
      { timeout: 5000, stdio: 'ignore' }
    );
  } catch {
    // Silently fail - OpenClaw might not be running
  }
}

/** Rebuild the TypeScript and restart if needed */
function doRebuild(projectRoot: string): { success: boolean; output: string } {
  try {
    console.log('🔄 Rebuilding...');
    execSync('npm run build', { cwd: projectRoot, stdio: 'pipe' });
    
    // Rebuild Go binary
    try {
      execSync('go build -o duck ./cmd/duck/', { cwd: projectRoot, stdio: 'pipe' });
      execSync(`cp duck "${process.env.HOME}/.local/bin/duck"`, { cwd: projectRoot, stdio: 'pipe' });
    } catch {}
    
    return { success: true, output: '✅ Build OK' };
  } catch (e: any) {
    return { success: false, output: e.message || 'Build failed' };
  }
}

/** Watch mode - monitor source and rebuild on changes */
async function startWatch(args: string[]): Promise<void> {
  const projectRoot = findProjectRoot();
  const watchPath = args[0] || join(projectRoot, 'src');
  const state = loadSyncState();
  
  state.watchedPath = watchPath;
  state.lastWatch = new Date().toISOString();
  saveSyncState(state);

  const ignoreDirs = new Set(['node_modules', 'dist', '.git', '.next', 'coverage', '__pycache__']);
  const ignoreExts = new Set(['.js', '.map', '.d.ts', '.lock', '.png', '.jpg', '.mp3', '.mp4']);
  
  let rebuildTimeout: NodeJS.Timeout | null = null;
  let lastBuild = Date.now();
  let buildCount = 0;
  let isBuilding = false;

  console.log(`
🦆 Duck-CLI Watch Mode
━━━━━━━━━━━━━━━━━━━━━━
Watching: ${watchPath}
Project:  ${projectRoot}
Auto-rebuild: ${state.autoRebuild ? 'ON' : 'OFF'}
OpenClaw notifications: ${state.openclawEnabled ? 'ON' : 'OFF'}
━━━━━━━━━━━━━━━━━━━━━━
Press Ctrl+C to stop.
`);

  notifyOpenClaw(`🔄 Duck-CLI watch started\nWatching: \`${watchPath}\``);

  const watcher = watch(watchPath, { recursive: true }, (eventType, filename) => {
    if (!filename) return;
    
    // Ignore irrelevant files
    const ext = require('path').extname(filename);
    const parts = filename.split(require('path').sep);
    if (parts.some(p => ignoreDirs.has(p)) || ignoreExts.has(ext)) return;

    const fullPath = join(watchPath, filename);
    const stat = (() => {
      try { return require('fs').statSync(fullPath); } catch { return null; }
    })();
    if (stat?.isDirectory()) return;

    // Debounce rebuilds (max 1 per 3 seconds)
    if (rebuildTimeout) return;
    rebuildTimeout = setTimeout(() => {
      rebuildTimeout = null;
    }, 3000);

    buildCount++;
    const changeFile = filename;
    console.log(`📝 [${new Date().toLocaleTimeString()}] ${eventType}: ${changeFile}`);

    if (state.autoRebuild) {
      // Wait a bit for file writes to settle
      setTimeout(async () => {
        if (isBuilding) return;
        isBuilding = true;
        
        const { success, output } = doRebuild(projectRoot);
        console.log(`📦 Build #${buildCount} ${output}`);
        
        if (success) {
          if (state.autoPush) {
            try {
              execSync('git add -A && git commit -m "chore: auto-save from watch"', { cwd: projectRoot, stdio: 'pipe' });
              execSync('git push origin main', { cwd: projectRoot, stdio: 'pipe' });
              console.log('📤 Pushed to GitHub');
            } catch {}
          }
        } else {
          console.log(`❌ Build failed: ${output}`);
          notifyOpenClaw(`❌ Build failed:\n\`\`\`\n${output}\n\`\`\``, 'error');
        }
        
        isBuilding = false;
      }, 500);
    }
  });

  process.on('SIGINT', () => {
    console.log('\n\n🛑 Stopping watch mode...');
    watcher.close();
    notifyOpenClaw('🛑 Duck-CLI watch stopped');
    process.exit(0);
  });
}

/** Sync from upstream sources */
async function doSync(source: string, projectRoot: string): Promise<void> {
  console.log(`🔄 Syncing from ${source}...`);
  
  try {
    if (source === 'openclaw') {
      // Pull latest from OpenClaw workspace
      const openclawPath = join(process.env.HOME || '', '.openclaw/workspace/duck-cli-src');
      if (existsSync(join(openclawPath, '.git'))) {
        execSync('git pull origin main', { cwd: openclawPath, stdio: 'inherit' });
        console.log('✅ OpenClaw workspace synced');
      }
    } else if (source === 'github') {
      execSync('git pull origin main', { cwd: projectRoot, stdio: 'inherit' });
      console.log('✅ GitHub synced');
    } else if (source === 'all') {
      // Sync all sources
      execSync('git pull origin main', { cwd: projectRoot, stdio: 'inherit' });
      console.log('✅ All sources synced');
    }
    
    notifyOpenClaw(`✅ Synced from \`${source}\``, 'success');
  } catch (e: any) {
    console.log(`❌ Sync failed: ${e.message}`);
    notifyOpenClaw(`❌ Sync from \`${source}\` failed:\n\`\`\`\n${e.message}\n\`\`\``, 'error');
  }
}

/** Show sync status */
async function showStatus(projectRoot: string): Promise<void> {
  const state = loadSyncState();
  const gitInfo = (() => {
    try {
      const commit = execSync('git rev-parse --short HEAD', { cwd: projectRoot, encoding: 'utf-8' }).trim();
      const branch = execSync('git branch --show-current', { cwd: projectRoot, encoding: 'utf-8' }).trim();
      const behind = execSync('git rev-list --count HEAD..origin/main', { cwd: projectRoot, encoding: 'utf-8' }).trim();
      const date = execSync('git log -1 --format=%ci', { cwd: projectRoot, encoding: 'utf-8' }).trim();
      return { commit, branch, behind, date };
    } catch {
      return { commit: 'unknown', branch: 'unknown', behind: '0', date: 'unknown' };
    }
  })();

  console.log(`
🦆 Duck-CLI Sync Status
━━━━━━━━━━━━━━━━━━━━━━
Source:       ${projectRoot}
Git branch:   ${gitInfo.branch}
Git commit:  ${gitInfo.commit}
Last push:    ${gitInfo.date}
Commits behind origin: ${gitInfo.behind}
━━━━━━━━━━━━━━━━━━━━━━
Watch mode:   ${state.lastWatch ? `Active (started ${state.lastWatch})` : 'Inactive'}
Watch path:   ${state.watchedPath || 'None'}
Auto-rebuild: ${state.autoRebuild ? 'ON' : 'OFF'}
Auto-push:    ${state.autoPush ? 'ON' : 'OFF'}
OpenClaw:     ${state.openclawEnabled ? 'Enabled' : 'Disabled'}
━━━━━━━━━━━━━━━━━━━━━━
  `);
}

/** OpenClaw tandem mode - runs Duck-CLI while monitoring OpenClaw workspace */
async function startTandemMode(): Promise<void> {
  console.log(`
🦆 Duck-CLI + OpenClaw Tandem Mode
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
This mode watches BOTH:
  1. Duck-CLI source: ${findProjectRoot()}
  2. OpenClaw workspace: ${join(process.env.HOME || '', '.openclaw/workspace')}

And notifies via OpenClaw's Telegram when:
  - Duck-CLI source changes
  - OpenClaw updates available
  - Build succeeds/fails
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Press Ctrl+C to stop.
`);

  await notifyOpenClaw('🔗 **Tandem Mode Started**\nDuck-CLI and OpenClaw now working in parallel\n\nWatching for changes...');

  // Watch duck-cli source
  const projectRoot = findProjectRoot();
  const state = loadSyncState();
  state.watchedPath = join(projectRoot, 'src');
  state.lastWatch = new Date().toISOString();
  saveSyncState(state);

  let rebuildTimeout: NodeJS.Timeout | null = null;

  const watcher = watch(join(projectRoot, 'src'), { recursive: true }, (eventType, filename) => {
    if (!filename || !eventType.includes('change') && !eventType.includes('rename')) return;
    const ext = require('path').extname(filename);
    if (['.js', '.map', '.d.ts', '.lock'].includes(ext)) return;
    
    if (rebuildTimeout) return;
    rebuildTimeout = setTimeout(async () => {
      rebuildTimeout = null;
      console.log(`📝 Source changed: ${filename}`);
      
      const { success } = doRebuild(projectRoot);
      if (success) {
        console.log('✅ Build OK');
        await notifyOpenClaw(`✅ **Duck-CLI rebuilt**\nSource changed: \`${filename}\`\nBuild #${Date.now()}`);
      }
    }, 1000);
  });

  process.on('SIGINT', () => {
    console.log('\n\n🛑 Stopping tandem mode...');
    watcher.close();
    process.exit(0);
  });
}

export function createSyncCommand(): Command {
  const sync = new Command('sync').description('🦆 Sync and watch commands for Duck-CLI + OpenClaw');

  sync.command('watch [path]')
    .description('Watch source for changes and auto-rebuild')
    .action((path) => startWatch(path ? [path] : []));

  sync.command('status')
    .description('Show sync status and watch state')
    .action(() => showStatus(findProjectRoot()));

  sync.command('openclaw')
    .description('Sync from OpenClaw workspace')
    .action(() => doSync('openclaw', findProjectRoot()));

  sync.command('github')
    .description('Pull latest from GitHub')
    .action(() => doSync('github', findProjectRoot()));

  sync.command('all')
    .description('Sync from all sources')
    .action(() => doSync('all', findProjectRoot()));

  sync.command('tandem')
    .description('🦆+🦞 Watch mode with OpenClaw notifications (WATCH LIVE)')
    .action(() => startTandemMode());

  sync.command('notify [message]')
    .description('Send notification to OpenClaw')
    .action((message) => {
      if (!message) {
        console.log('Usage: duck sync notify <message>');
        return;
      }
      notifyOpenClaw(message).then(() => {
        console.log('✅ Notification sent');
      }).catch(() => {
        console.log('❌ Failed to send notification');
      });
    });

  return sync;
}
