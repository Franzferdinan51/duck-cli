/**
 * 🦆 Duck CLI - CopilotKit Sync Module - UI components and patterns
 */

import { execSync } from 'child_process';
import { existsSync, cpSync, mkdirSync } from 'fs';
import { join } from 'path';
import { BaseSyncModule } from './base-sync.js';
import { Change, SyncStatus } from './types.js';

const COPILOTKIT_REPO = 'https://github.com/CopilotKit/CopilotKit.git';
const COPILOTKIT_BRANCH = 'main';

const TRACKED_PATHS = [
  { path: 'packages/', description: 'CopilotKit packages' },
  { path: 'sdk/', description: 'CopilotKit SDK' },
  { path: 'ui/', description: 'UI components' },
];

export class CopilotKitSync extends BaseSyncModule {
  name = 'copilotkit';
  source = 'CopilotKit';
  repo = COPILOTKIT_REPO;
  syncMethod: 'clone' = 'clone';

  async prepareSync(): Promise<void> {
    try {
      if (existsSync(this.workDir)) execSync(`rm -rf "${this.workDir}"`, { stdio: 'pipe' });
      console.log(`  📦 Cloning ${this.repo}...`);
      execSync(`git clone --branch ${COPILOTKIT_BRANCH} ${COPILOTKIT_REPO} "${this.workDir}"`, { stdio: 'pipe' });
    } catch (e) {
      this.status.errors.push(`Clone failed: ${e instanceof Error ? e.message : e}`);
      throw e;
    }
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
    const critical = ['sdk/core', 'ui/components'];
    const high = ['sdk/', 'ui/'];
    if (critical.some(p => path.includes(p))) return 'critical';
    if (high.some(p => path.includes(p))) return 'high';
    return 'medium';
  }

  async applyChanges(changes: Change[]): Promise<void> {
    for (const change of changes) {
      const sourcePath = join(this.workDir, change.path);
      const destPath = join(this.homeDir, 'src', 'ui', 'copilotkit', change.path);
      if (!existsSync(sourcePath)) continue;
      this.createBackup([`src/ui/copilotkit/${change.path}`]);
      mkdirSync(join(destPath, '..'), { recursive: true });
      cpSync(sourcePath, destPath, { force: true, recursive: true });
    }
  }

  getStatus(): SyncStatus {
    return { configured: this.status.configured, available: this.status.available, lastSync: this.lastSync, commitsBehind: 0, errors: this.status.errors };
  }
}

export const copilotkitSync = new CopilotKitSync();
