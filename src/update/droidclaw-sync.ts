/**
 * 🦆 Duck CLI - DroidClaw Sync Module - Android automation patterns
 */

import { execSync } from 'child_process';
import { existsSync, cpSync, mkdirSync } from 'fs';
import { join } from 'path';
import { BaseSyncModule } from './base-sync.js';
import { Change, SyncStatus } from './types.js';

const DROID_REPO = 'https://github.com/unitedbyai/droidclaw.git';
const DROID_BRANCH = 'main';

const TRACKED_PATHS = [
  { path: 'android/', description: 'Android automation patterns' },
  { path: 'adb/', description: 'ADB command building' },
  { path: 'device/', description: 'Device management' },
  { path: 'ui/', description: 'UI element finding/tapping' },
];

export class DroidClawSync extends BaseSyncModule {
  name = 'droidclaw';
  source = 'DroidClaw';
  repo = DROID_REPO;
  syncMethod: 'clone' = 'clone';

  async prepareSync(): Promise<void> {
    if (existsSync(this.workDir)) execSync(`rm -rf "${this.workDir}"`, { stdio: 'pipe' });
    console.log(`  📦 Cloning ${this.repo}...`);
    execSync(`git clone --branch ${DROID_BRANCH} ${DROID_REPO} "${this.workDir}"`, { stdio: 'pipe' });
    this.status.configured = true;
    this.status.available = true;
  }

  async getChanges(): Promise<Change[]> {
    const changes: Change[] = [];
    try {
      for (const tracked of TRACKED_PATHS) {
        const sourcePath = join(this.workDir, tracked.path);
        if (existsSync(sourcePath)) {
          changes.push({
            id: this.generateChangeId('file', tracked.path),
            source: this.name,
            type: tracked.path.endsWith('/') ? 'directory' : 'file',
            path: tracked.path,
            action: 'add',
            description: tracked.description,
            priority: this.assessPriority(tracked.path),
          });
        }
      }
    } catch (e) { this.status.errors.push(e instanceof Error ? e.message : 'Failed to get changes'); }
    return changes;
  }

  private assessPriority(path: string): Change['priority'] {
    const critical = ['core', 'adb/command', 'device/manager'];
    const high = ['android', 'ui/find', 'ui/tap'];
    if (critical.some(p => path.toLowerCase().includes(p))) return 'critical';
    if (high.some(p => path.toLowerCase().includes(p))) return 'high';
    return 'medium';
  }

  async applyChanges(changes: Change[]): Promise<void> {
    for (const change of changes) {
      const sourcePath = join(this.workDir, change.path);
      const destPath = join(this.homeDir, 'src', 'tools', 'android', change.path);
      if (!existsSync(sourcePath)) continue;
      this.createBackup([`src/tools/android/${change.path}`]);
      mkdirSync(join(destPath, '..'), { recursive: true });
      cpSync(sourcePath, destPath, { force: true, recursive: true });
    }
  }

  getStatus(): SyncStatus {
    return { configured: this.status.configured, available: this.status.available, lastSync: this.lastSync, commitsBehind: 0, errors: this.status.errors };
  }
}

export const droidclawSync = new DroidClawSync();
