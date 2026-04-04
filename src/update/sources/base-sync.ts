/**
 * 🦆 Duck CLI - Base Sync Module
 * Abstract base class for all sync modules
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync, cpSync } from 'fs';
import { join, dirname } from 'path';
import {
  SyncModule,
  SyncResult,
  SyncStatus,
  Change,
  Conflict,
  SyncState,
} from './types.js';

export abstract class BaseSyncModule implements SyncModule {
  abstract name: string;
  abstract source: string;
  abstract repo: string;
  abstract syncMethod: 'merge' | 'pull' | 'clone';

  lastSync: Date | null = null;
  status: SyncStatus = {
    configured: false,
    available: false,
    lastSync: null,
    commitsBehind: 0,
    errors: [],
  };

  protected homeDir: string;
  protected statePath: string = '';
  protected syncBackupsDir: string = '';
  protected workDir: string = '';

  constructor(homeDir?: string) {
    this.homeDir = homeDir || process.cwd();
    this.initPaths();
    this.ensureDirectories();
    this.loadState();
  }

  protected initPaths(): void {
    // Subclasses call super() then set their own name/source/repo
    // But we need paths based on the name, so we init with default and subclasses override
    const defaultName = 'unknown';
    const duckHome = join(this.homeDir, '.duck');
    this.statePath = join(duckHome, 'sync-state.json');
    this.syncBackupsDir = join(duckHome, 'sync-backups', defaultName);
    this.workDir = join(this.homeDir, 'sources', defaultName);
  }

  protected setupPaths(moduleName: string): void {
    const duckHome = join(this.homeDir, '.duck');
    this.statePath = join(duckHome, 'sync-state.json');
    this.syncBackupsDir = join(duckHome, 'sync-backups', moduleName);
    this.workDir = join(this.homeDir, 'sources', moduleName);
  }

  protected get moduleName(): string {
    return this.name;
  }

  protected ensureDirectories(): void {
    try {
      mkdirSync(this.syncBackupsDir, { recursive: true });
      mkdirSync(dirname(this.statePath), { recursive: true });
    } catch {}
  }

  protected loadState(): void {
    try {
      if (existsSync(this.statePath)) {
        const state: SyncState = JSON.parse(readFileSync(this.statePath, 'utf-8'));
        const sourceState = state.sources[this.name];
        if (sourceState) {
          this.lastSync = sourceState.lastSync ? new Date(sourceState.lastSync) : null;
        }
      }
    } catch {}
  }

  protected saveState(result: Partial<SyncResult>, errors: string[] = []): void {
    try {
      let state: SyncState;
      try {
        state = existsSync(this.statePath)
          ? JSON.parse(readFileSync(this.statePath, 'utf-8'))
          : { sources: {}, global: { lastGlobalSync: null, totalSyncs: 0, successfulSyncs: 0, failedSyncs: 0 } };
      } catch {
        state = { sources: {}, global: { lastGlobalSync: null, totalSyncs: 0, successfulSyncs: 0, failedSyncs: 0 } };
      }

      state.sources[this.name] = {
        name: this.name,
        repo: this.repo,
        lastSync: result.timestamp?.toISOString() || new Date().toISOString(),
        lastCommit: this.getCurrentCommit(),
        status: result.success ? 'success' : 'failed',
        changesApplied: result.changesApplied || 0,
        errors,
      };

      state.global.totalSyncs++;
      if (result.success) {
        state.global.successfulSyncs++;
        state.global.lastGlobalSync = new Date().toISOString();
      } else {
        state.global.failedSyncs++;
      }

      writeFileSync(this.statePath, JSON.stringify(state, null, 2));
    } catch {}
  }

  protected getCurrentCommit(): string | null {
    try {
      if (existsSync(join(this.workDir, '.git'))) {
        return execSync('git rev-parse HEAD', { cwd: this.workDir, encoding: 'utf-8' }).trim().slice(0, 8);
      }
    } catch {}
    return null;
  }

  async sync(): Promise<SyncResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    let changesFound = 0;
    let changesApplied = 0;
    const conflicts: Conflict[] = [];

    try {
      await this.prepareSync();

      const changes = await this.getChanges();
      changesFound = changes.length;

      try {
        await this.applyChanges(changes);
        changesApplied = changes.length;
      } catch (e) {
        for (const change of changes) {
          conflicts.push({
            id: `${this.name}-${change.id}`,
            source: this.name,
            file: change.path,
            type: 'content',
            resolution: 'manual',
            resolutionDescription: e instanceof Error ? e.message : 'Unknown error',
          });
        }
      }

      this.lastSync = new Date();
      const success = errors.length === 0;
      this.saveState({
        success,
        source: this.name,
        changesFound,
        changesApplied,
        conflicts,
        errors,
        duration: Date.now() - startTime,
        timestamp: this.lastSync,
      }, errors);

      return {
        success,
        source: this.name,
        changesFound,
        changesApplied,
        conflicts,
        errors,
        duration: Date.now() - startTime,
        timestamp: new Date(),
      };
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : 'Unknown error';
      errors.push(errorMsg);

      this.saveState({
        success: false,
        source: this.name,
        changesFound,
        changesApplied,
        conflicts,
        errors,
        duration: Date.now() - startTime,
        timestamp: new Date(),
      }, errors);

      return {
        success: false,
        source: this.name,
        changesFound,
        changesApplied,
        conflicts,
        errors,
        duration: Date.now() - startTime,
        timestamp: new Date(),
      };
    }
  }

  abstract prepareSync(): Promise<void>;
  abstract getChanges(): Promise<Change[]>;
  abstract applyChanges(changes: Change[]): Promise<void>;
  abstract getStatus(): SyncStatus;

  protected execGit(cmd: string, cwd?: string): string {
    return execSync(cmd, {
      cwd: cwd || this.workDir,
      encoding: 'utf-8',
      stdio: 'pipe',
    }).trim();
  }

  protected createBackup(files: string[]): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = `${this.name}-${timestamp}`;
    const backupPath = join(this.syncBackupsDir, backupName);

    try {
      mkdirSync(backupPath, { recursive: true });
      for (const file of files) {
        const src = join(this.homeDir, file);
        if (existsSync(src)) {
          execSync(`cp -r "${src}" "${backupPath}/"`, { stdio: 'pipe' });
        }
      }
    } catch {}

    return backupPath;
  }

  protected generateChangeId(type: string, path: string): string {
    return `${this.name}-${type}-${path}`.replace(/[^a-z0-9-]/gi, '-');
  }
}
