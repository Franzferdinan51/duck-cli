/**
 * 🦆 Duck CLI - Hermes-Agent Sync Module
 * Syncs learning loop patterns, FTS5 session memory, parallel subagent RPC, cron scheduling
 */

import { execSync } from 'child_process';
import { existsSync, cpSync, mkdirSync } from 'fs';
import { join } from 'path';
import { BaseSyncModule } from './base-sync.js';
import { Change, SyncStatus } from './types.js';

const HERMES_REPO = 'https://github.com/NousResearch/hermes-agent.git';
const HERMES_BRANCH = 'main';

const TRACKED_PATHS = [
  { path: 'subconscious/', description: 'Learning loop patterns' },
  { path: 'memory/', description: 'FTS5 session memory and recall' },
  { path: 'rpc/', description: 'Parallel subagent RPC coordination' },
  { path: 'cron/', description: 'Natural language cron scheduling' },
  { path: 'skills/', description: 'Skill self-improvement after complex tasks' },
];

export class HermesSync extends BaseSyncModule {
  name = 'hermes';
  source = 'Hermes-Agent';
  repo = HERMES_REPO;
  syncMethod: 'pull' = 'pull';
  private remoteName = 'hermes-upstream';

  async prepareSync(): Promise<void> {
    const gitDir = join(this.workDir, '.git');
    if (!existsSync(gitDir)) {
      console.log(`  📦 Cloning ${this.repo}...`);
      execSync(`git clone --branch ${HERMES_BRANCH} ${HERMES_REPO} "${this.workDir}"`, { stdio: 'pipe' });
    } else {
      try { execSync(`git remote get-url ${this.remoteName}`, { cwd: this.workDir, stdio: 'pipe' }); }
      catch { execSync(`git remote add ${this.remoteName} ${HERMES_REPO}`, { cwd: this.workDir, stdio: 'pipe' }); }
      execSync(`git fetch ${this.remoteName} ${HERMES_BRANCH}`, { cwd: this.workDir, stdio: 'pipe' });
      execSync(`git pull ${this.remoteName} ${HERMES_BRANCH}`, { cwd: this.workDir, stdio: 'pipe' });
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
      const diffOutput = execSync(`git diff ${sinceRef}...${this.remoteName}/${HERMES_BRANCH} --name-status`, { cwd: this.workDir, encoding: 'utf-8', stdio: 'pipe' });
      const lines = diffOutput.trim().split('\n').filter(Boolean);
      for (const line of lines) {
        const [status, ...pathParts] = line.split('\t');
        const path = pathParts.join('\t');
        const tracked = TRACKED_PATHS.find(t => path.includes(t.path));
        if (tracked || this.isInterestingFile(path)) {
          changes.push({
            id: this.generateChangeId('file', path),
            source: this.name,
            type: 'file',
            path,
            action: status === 'A' ? 'add' : status === 'D' ? 'delete' : 'modify',
            description: tracked?.description || `Hermes change: ${path}`,
            priority: this.assessPriority(path),
          });
        }
      }
    } catch (e) { this.status.errors.push(e instanceof Error ? e.message : 'Failed to get changes'); }
    return changes;
  }

  private isInterestingFile(path: string): boolean {
    const interesting = ['subconscious', 'memory', 'fts5', 'rpc', 'cron', 'skill', 'learning', 'loop', 'recall', 'agent', 'coordinator'];
    return interesting.some(p => path.toLowerCase().includes(p));
  }

  private assessPriority(path: string): Change['priority'] {
    const critical = ['subconscious', 'core', 'agent', 'memory/fts5'];
    const high = ['learning', 'skill', 'rpc', 'cron', 'coordinator'];
    if (critical.some(p => path.toLowerCase().includes(p))) return 'critical';
    if (high.some(p => path.toLowerCase().includes(p))) return 'high';
    return 'medium';
  }

  async applyChanges(changes: Change[]): Promise<void> {
    for (const change of changes) {
      const sourcePath = join(this.workDir, change.path);
      const destPath = join(this.homeDir, 'src', 'subconscious', change.path);
      if (!existsSync(sourcePath)) continue;
      this.createBackup([`src/subconscious/${change.path}`]);
      mkdirSync(join(destPath, '..'), { recursive: true });
      cpSync(sourcePath, destPath, { force: true });
    }
  }

  getStatus(): SyncStatus {
    try {
      const commitsBehind = existsSync(join(this.workDir, '.git'))
        ? parseInt(execSync(`git rev-list --count HEAD..${this.remoteName}/${HERMES_BRANCH}`, { cwd: this.workDir, encoding: 'utf-8', stdio: 'pipe' }).trim()) || 0
        : 0;
      return { configured: this.status.configured, available: this.status.available, lastSync: this.lastSync, commitsBehind, errors: this.status.errors };
    } catch { return this.status; }
  }
}

export const hermesSync = new HermesSync();
