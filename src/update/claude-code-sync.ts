/**
 * 🦆 Duck CLI - Claude Code Sync Module - Tool implementations
 */

import { execSync } from 'child_process';
import { existsSync, cpSync, mkdirSync } from 'fs';
import { join } from 'path';
import { BaseSyncModule } from './base-sync.js';
import { Change, SyncStatus } from './types.js';

const CLAUDE_CODE_REPO = 'https://github.com/anthropics/claude-code.git';

const TRACKED_PATHS = [
  { path: 'src/Tool.ts', description: 'Tool definitions and patterns' },
  { path: 'src/Task.ts', description: 'Task handling patterns' },
  { path: 'src/tools/', description: 'Tool implementations (read, write, edit, bash, grep)' },
  { path: 'src/lsp/', description: 'LSP integration patterns' },
];

export class ClaudeCodeSync extends BaseSyncModule {
  name = 'claude-code';
  source = 'Claude Code';
  repo = CLAUDE_CODE_REPO;
  syncMethod: 'clone' = 'clone';

  async prepareSync(): Promise<void> {
    if (existsSync(this.workDir)) execSync(`rm -rf "${this.workDir}"`, { stdio: 'pipe' });
    console.log(`  📦 Cloning ${this.repo}...`);
    execSync(`git clone "${CLAUDE_CODE_REPO}" "${this.workDir}"`, { stdio: 'pipe' });
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
    const critical = ['Tool.ts', 'ToolRegistry', 'core'];
    const high = ['Task.ts', 'tools/', 'lsp/'];
    if (critical.some(p => path.includes(p))) return 'critical';
    if (high.some(p => path.includes(p))) return 'high';
    return 'medium';
  }

  async applyChanges(changes: Change[]): Promise<void> {
    for (const change of changes) {
      const sourcePath = join(this.workDir, change.path);
      const destPath = join(this.homeDir, 'src', 'tools', 'claude-code', change.path);
      if (!existsSync(sourcePath)) continue;
      this.createBackup([`src/tools/claude-code/${change.path}`]);
      mkdirSync(join(destPath, '..'), { recursive: true });
      cpSync(sourcePath, destPath, { force: true, recursive: true });
    }
  }

  getStatus(): SyncStatus {
    return { configured: this.status.configured, available: this.status.available, lastSync: this.lastSync, commitsBehind: 0, errors: this.status.errors };
  }
}

export const claudeCodeSync = new ClaudeCodeSync();
