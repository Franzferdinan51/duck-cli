/**
 * 🦆 Duck CLI - NeMoClaw Sync Module - Security sandboxing, Blueprint management
 */

import { execSync } from 'child_process';
import { existsSync, cpSync, mkdirSync } from 'fs';
import { join } from 'path';
import { BaseSyncModule } from './base-sync.js';
import { Change, SyncStatus } from './types.js';

const NEMO_REPO = 'https://github.com/NVIDIA/NeMoClaw.git';
const NEMO_BRANCH = 'main';

const TRACKED_PATHS = [
  { path: 'security/', description: 'Security sandboxing patterns' },
  { path: 'blueprint/', description: 'Blueprint management' },
  { path: 'inference/', description: 'Routed inference architecture' },
  { path: 'sandbox/', description: 'Sandbox isolation patterns' },
];

export class NeMoClawSync extends BaseSyncModule {
  name = 'nemoclaw';
  source = 'NeMoClaw';
  repo = NEMO_REPO;
  syncMethod: 'merge' = 'merge';
  private remoteName = 'nemoclaw-upstream';

  async prepareSync(): Promise<void> {
    const gitDir = join(this.workDir, '.git');
    if (!existsSync(gitDir)) {
      console.log(`  📦 Cloning ${this.repo}...`);
      execSync(`git clone --branch ${NEMO_BRANCH} ${NEMO_REPO} "${this.workDir}"`, { stdio: 'pipe' });
    } else {
      try { execSync(`git remote get-url ${this.remoteName}`, { cwd: this.workDir, stdio: 'pipe' }); }
      catch { execSync(`git remote add ${this.remoteName} ${NEMO_REPO}`, { cwd: this.workDir, stdio: 'pipe' }); }
      execSync(`git fetch ${this.remoteName} ${NEMO_BRANCH}`, { cwd: this.workDir, stdio: 'pipe' });
    }
    this.status.configured = true;
    this.status.available = true;
  }

  async getChanges(): Promise<Change[]> {
    const changes: Change[] = [];
    try {
      const sinceRef = this.lastSync
        ? execSync(`git log --reverse --format=%H -1 --since="${this.lastSync.toISOString()}"`, { cwd: this.workDir, encoding: 'utf-8', stdio: 'pipe' }).trim()
        : 'HEAD';
      const diffOutput = execSync(`git diff ${sinceRef}...${this.remoteName}/${NEMO_BRANCH} --name-status`, { cwd: this.workDir, encoding: 'utf-8', stdio: 'pipe' });
      const lines = diffOutput.trim().split('\n').filter(Boolean);
      for (const line of lines) {
        const [status, ...pathParts] = line.split('\t');
        const path = pathParts.join('\t');
        const tracked = TRACKED_PATHS.find(t => path.includes(t.path));
        if (tracked || this.isSecurityFile(path)) {
          changes.push({
            id: this.generateChangeId('file', path),
            source: this.name,
            type: 'file',
            path,
            action: status === 'A' ? 'add' : status === 'D' ? 'delete' : 'modify',
            description: tracked?.description || `NeMoClaw security: ${path}`,
            priority: this.assessSecurityPriority(path, tracked?.description || ''),
          });
        }
      }
    } catch (e) { this.status.errors.push(e instanceof Error ? e.message : 'Failed to get changes'); }
    return changes;
  }

  private isSecurityFile(path: string): boolean {
    const securityPatterns = ['security', 'sandbox', 'blueprint', 'inference', 'dgx', 'isolate', 'permission', 'access', 'audit', 'policy'];
    return securityPatterns.some(p => path.toLowerCase().includes(p));
  }

  private assessSecurityPriority(path: string, description: string): Change['priority'] {
    const critical = ['sandbox', 'security/core', 'policy', 'audit'];
    const high = ['security', 'blueprint', 'inference', 'dgx'];
    if (critical.some(p => path.toLowerCase().includes(p))) return 'critical';
    if (high.some(p => path.toLowerCase().includes(p)) || description.includes('security')) return 'high';
    return 'medium';
  }

  async applyChanges(changes: Change[]): Promise<void> {
    for (const change of changes) {
      const sourcePath = join(this.workDir, change.path);
      const destPath = join(this.homeDir, 'src', 'security', 'nemoclaw', change.path);
      if (!existsSync(sourcePath)) continue;
      this.createBackup([`src/security/nemoclaw/${change.path}`]);
      mkdirSync(join(destPath, '..'), { recursive: true });
      cpSync(sourcePath, destPath, { force: true });
    }
  }

  getStatus(): SyncStatus {
    try {
      const commitsBehind = existsSync(join(this.workDir, '.git'))
        ? parseInt(execSync(`git rev-list --count HEAD..${this.remoteName}/${NEMO_BRANCH}`, { cwd: this.workDir, encoding: 'utf-8', stdio: 'pipe' }).trim()) || 0
        : 0;
      return { configured: this.status.configured, available: this.status.available, lastSync: this.lastSync, commitsBehind, errors: this.status.errors };
    } catch { return this.status; }
  }
}

export const nemoclawSync = new NeMoClawSync();
