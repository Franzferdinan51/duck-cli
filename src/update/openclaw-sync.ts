/**
 * 🦆 Duck CLI - OpenClaw Sync Module
 * Syncs ACP/MCP protocol, Gateway API patterns, Skills system, Security hardening
 */

import { execSync } from 'child_process';
import { existsSync, cpSync, mkdirSync } from 'fs';
import { join } from 'path';
import { BaseSyncModule } from './base-sync.js';
import { Change, SyncStatus } from './types.js';

const OPENCLAW_REPO = 'https://github.com/openclaw/openclaw.git';
const OPENCLAW_BRANCH = 'main';

const TRACKED_PATHS = [
  { path: 'src/gateway/', description: 'Gateway API patterns' },
  { path: 'src/compat/', description: 'ACP/MCP protocol implementations' },
  { path: 'src/skills/', description: 'Skills system architecture' },
  { path: 'src/security/', description: 'Security hardening' },
  { path: 'src/providers/', description: 'Multi-provider model integration' },
  { path: 'src/channels/', description: 'Multi-channel inbox patterns' },
];

export class OpenClawSync extends BaseSyncModule {
  name = 'openclaw';
  source = 'OpenClaw';
  repo = OPENCLAW_REPO;
  syncMethod: 'merge' = 'merge';
  private remoteName = 'openclaw-upstream';

  async prepareSync(): Promise<void> {
    const gitDir = join(this.workDir, '.git');

    if (!existsSync(gitDir)) {
      console.log(`  📦 Cloning ${this.repo}...`);
      execSync(`git clone --branch ${OPENCLAW_BRANCH} ${OPENCLAW_REPO} "${this.workDir}"`, { stdio: 'pipe' });
    } else {
      try {
        execSync(`git remote get-url ${this.remoteName}`, { cwd: this.workDir, stdio: 'pipe' });
      } catch {
        execSync(`git remote add ${this.remoteName} ${OPENCLAW_REPO}`, { cwd: this.workDir, stdio: 'pipe' });
      }
      execSync(`git fetch ${this.remoteName} ${OPENCLAW_BRANCH}`, { cwd: this.workDir, stdio: 'pipe' });
    }

    this.status.configured = true;
    this.status.available = true;
  }

  async getChanges(): Promise<Change[]> {
    const changes: Change[] = [];
    try {
      const sinceRef = this.lastSync
        ? execSync(`git log --reverse --format=%H -1 --since="${this.lastSync.toISOString()}"`, {
            cwd: this.workDir, encoding: 'utf-8', stdio: 'pipe',
          }).trim()
        : 'HEAD';

      const diffOutput = execSync(
        `git diff ${sinceRef}...${this.remoteName}/${OPENCLAW_BRANCH} --name-status`,
        { cwd: this.workDir, encoding: 'utf-8', stdio: 'pipe' }
      );

      const lines = diffOutput.trim().split('\n').filter(Boolean);
      for (const line of lines) {
        const [status, ...pathParts] = line.split('\t');
        const path = pathParts.join('\t');
        const tracked = TRACKED_PATHS.find(t => path.startsWith(t.path.replace('src/', '')) || path.startsWith(t.path));

        if (tracked || this.isInterestingFile(path)) {
          changes.push({
            id: this.generateChangeId('file', path),
            source: this.name,
            type: 'file',
            path,
            action: status === 'A' ? 'add' : status === 'D' ? 'delete' : 'modify',
            description: tracked?.description || `OpenClaw change: ${path}`,
            priority: this.assessPriority(path, status),
          });
        }
      }
    } catch (e) {
      this.status.errors.push(e instanceof Error ? e.message : 'Failed to get changes');
    }
    return changes;
  }

  private isInterestingFile(path: string): boolean {
    const interestingPatterns = ['gateway', 'mcp', 'acp', 'protocol', 'skill', 'security', 'provider', 'model', 'channel', 'inbox', 'ssrf', 'credential'];
    return interestingPatterns.some(p => path.toLowerCase().includes(p));
  }

  private assessPriority(path: string, status: string): Change['priority'] {
    const criticalPaths = ['core', 'agent', 'gateway', 'protocol'];
    const highPaths = ['skill', 'security', 'provider', 'channel'];
    const isCritical = criticalPaths.some(p => path.toLowerCase().includes(p));
    const isHigh = highPaths.some(p => path.toLowerCase().includes(p));
    if (isCritical) return 'critical';
    if (isHigh) return 'high';
    if (status === 'D') return 'medium';
    return 'low';
  }

  async applyChanges(changes: Change[]): Promise<void> {
    for (const change of changes) {
      const sourcePath = join(this.workDir, change.path);
      const destPath = join(this.homeDir, 'src', 'compat', 'openclaw', change.path);
      if (!existsSync(sourcePath)) throw new Error(`Source file not found: ${change.path}`);
      this.createBackup([`src/compat/openclaw/${change.path}`]);
      mkdirSync(join(destPath, '..'), { recursive: true });
      cpSync(sourcePath, destPath, { force: true });
    }
  }

  getStatus(): SyncStatus {
    try {
      const commitsBehind = existsSync(join(this.workDir, '.git'))
        ? parseInt(execSync(
            `git rev-list --count HEAD..${this.remoteName}/${OPENCLAW_BRANCH}`,
            { cwd: this.workDir, encoding: 'utf-8', stdio: 'pipe' }
          ).trim()) || 0
        : 0;
      return { configured: this.status.configured, available: this.status.available, lastSync: this.lastSync, commitsBehind, errors: this.status.errors };
    } catch {
      return this.status;
    }
  }
}

export const openclawSync = new OpenClawSync();
