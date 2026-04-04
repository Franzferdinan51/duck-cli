/**
 * 🦆 Duck CLI - Pretext Sync Module - Text measurement for Canvas rendering
 */

import { execSync } from 'child_process';
import { existsSync, cpSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { BaseSyncModule } from './base-sync.js';
import { Change, SyncStatus } from './types.js';

const PRETEXT_REPO = 'https://github.com/chenglou/pretext.git';
const PRETEXT_BRANCH = 'main';

export class PretextSync extends BaseSyncModule {
  name = 'pretext';
  source = 'Pretext';
  repo = PRETEXT_REPO;
  syncMethod: 'pull' = 'pull';
  private remoteName = 'pretext-upstream';

  async prepareSync(): Promise<void> {
    const gitDir = join(this.workDir, '.git');
    if (!existsSync(gitDir)) {
      console.log(`  📦 Cloning ${this.repo}...`);
      execSync(`git clone --branch ${PRETEXT_BRANCH} ${PRETEXT_REPO} "${this.workDir}"`, { stdio: 'pipe' });
    } else {
      try { execSync(`git remote get-url ${this.remoteName}`, { cwd: this.workDir, stdio: 'pipe' }); }
      catch { execSync(`git remote add ${this.remoteName} ${PRETEXT_REPO}`, { cwd: this.workDir, stdio: 'pipe' }); }
      execSync(`git fetch ${this.remoteName} ${PRETEXT_BRANCH}`, { cwd: this.workDir, stdio: 'pipe' });
      execSync(`git pull ${this.remoteName} ${PRETEXT_BRANCH}`, { cwd: this.workDir, stdio: 'pipe' });
    }
    this.status.configured = true;
    this.status.available = true;
  }

  async getChanges(): Promise<Change[]> {
    const changes: Change[] = [];
    try {
      const currentCommit = this.execGit('git rev-parse HEAD');
      const lastCommit = this.getLastKnownCommit();

      if (currentCommit !== lastCommit) {
        changes.push({
          id: this.generateChangeId('library', 'pretext'),
          source: this.name,
          type: 'feature',
          path: 'pretext',
          action: 'modify',
          description: `Pretext text measurement library updated`,
          priority: 'medium',
          metadata: { oldCommit: lastCommit, newCommit: currentCommit },
        });
        this.saveLastKnownCommit(currentCommit);
      }
    } catch (e) { this.status.errors.push(e instanceof Error ? e.message : 'Failed to get changes'); }
    return changes;
  }

  private getLastKnownCommit(): string | null {
    try {
      const stateFile = join(this.homeDir, '.duck', 'pretext-commit.json');
      if (existsSync(stateFile)) {
        const state = JSON.parse(readFileSync(stateFile, 'utf-8'));
        return state.commit;
      }
    } catch {}
    return null;
  }

  private saveLastKnownCommit(commit: string): void {
    try {
      const stateFile = join(this.homeDir, '.duck', 'pretext-commit.json');
      writeFileSync(stateFile, JSON.stringify({ commit, updated: new Date().toISOString() }));
    } catch {}
  }

  async applyChanges(changes: Change[]): Promise<void> {
    for (const change of changes) {
      const sourcePath = join(this.workDir, 'dist');
      const destPath = join(this.homeDir, 'node_modules', '@chenglou', 'pretext');

      if (existsSync(sourcePath)) {
        this.createBackup(['node_modules/@chenglou/pretext']);
        mkdirSync(join(destPath, '..'), { recursive: true });
        cpSync(sourcePath, destPath, { force: true, recursive: true });
      }
    }
  }

  getStatus(): SyncStatus {
    return { configured: this.status.configured, available: this.status.available, lastSync: this.lastSync, commitsBehind: 0, errors: this.status.errors };
  }
}

export const pretextSync = new PretextSync();
