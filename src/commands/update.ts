/**
 * 🦆 Duck Agent - Auto Update System
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

export interface UpdateInfo {
  currentVersion: string;
  latestVersion: string;
  releaseNotes?: string;
  updateAvailable: boolean;
  commitCount: number;
  lastCommit: string;
}

export interface UpdateConfig {
  autoBackup: boolean;
  autoMerge: boolean;
  checkOnStart: boolean;
  branch: string;
}

const DEFAULT_CONFIG: UpdateConfig = {
  autoBackup: true,
  autoMerge: false,
  checkOnStart: true,
  branch: 'main',
};

export class UpdateSystem {
  private config: UpdateConfig;
  private homeDir: string;
  private configPath: string;

  constructor(homeDir?: string) {
    this.homeDir = homeDir || process.cwd();
    this.configPath = join(this.homeDir, '.duckagent', 'update-config.json');
    this.config = this.loadConfig();
  }

  private loadConfig(): UpdateConfig {
    try {
      if (existsSync(this.configPath)) {
        const content = readFileSync(this.configPath, 'utf-8');
        return { ...DEFAULT_CONFIG, ...JSON.parse(content) };
      }
    } catch {}
    return { ...DEFAULT_CONFIG };
  }

  saveConfig(): void {
    try {
      const dir = join(this.homeDir, '.duckagent');
      if (!existsSync(dir)) {
        execSync(`mkdir -p "${dir}"`);
      }
      writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
    } catch (e) {
      console.error('Failed to save update config:', e);
    }
  }

  updateConfig(updates: Partial<UpdateConfig>): void {
    this.config = { ...this.config, ...updates };
    this.saveConfig();
  }

  /**
   * Get current version info from git
   */
  getVersionInfo(): { version: string; commit: string; date: string } {
    try {
      const commit = execSync('git rev-parse HEAD', { cwd: this.homeDir, encoding: 'utf-8' }).trim().slice(0, 8);
      const date = execSync('git log -1 --format=%ci', { cwd: this.homeDir, encoding: 'utf-8' }).trim();
      const version = this.getPackageVersion();
      return { version, commit, date };
    } catch {
      return { version: '0.0.0', commit: 'unknown', date: 'unknown' };
    }
  }

  private getPackageVersion(): string {
    try {
      const pkg = JSON.parse(execSync('cat package.json', { cwd: this.homeDir, encoding: 'utf-8' }));
      return pkg.version || '0.0.0';
    } catch {
      return '0.0.0';
    }
  }

  /**
   * Check for updates
   */
  async checkForUpdates(): Promise<UpdateInfo> {
    const current = this.getVersionInfo();
    
    try {
      // Fetch latest
      execSync('git fetch origin', { cwd: this.homeDir, stdio: 'pipe' });
      
      // Get latest commit on current branch
      const latestCommit = execSync(`git rev-parse origin/${this.config.branch}`, { 
        cwd: this.homeDir, 
        encoding: 'utf-8' 
      }).trim();
      
      // Get commit count difference
      const behind = execSync(`git rev-list --count HEAD..origin/${this.config.branch}`, {
        cwd: this.homeDir,
        encoding: 'utf-8'
      }).trim();

      const updateAvailable = current.commit !== latestCommit;
      
      let releaseNotes: string | undefined;
      if (updateAvailable) {
        try {
          releaseNotes = execSync(
            `git log HEAD..origin/${this.config.branch} --oneline`,
            { cwd: this.homeDir, encoding: 'utf-8' }
          ).trim();
        } catch {}
      }

      return {
        currentVersion: current.version,
        latestVersion: latestCommit.slice(0, 8),
        releaseNotes,
        updateAvailable,
        commitCount: parseInt(behind) || 0,
        lastCommit: current.commit,
      };
    } catch {
      return {
        currentVersion: current.version,
        latestVersion: current.commit,
        updateAvailable: false,
        commitCount: 0,
        lastCommit: current.commit,
      };
    }
  }

  /**
   * Perform update
   */
  async update(options: { backup?: boolean; force?: boolean } = {}): Promise<{
    success: boolean;
    backupPath?: string;
    error?: string;
  }> {
    const { backup = this.config.autoBackup, force = false } = options;
    
    try {
      // Check status first
      const status = execSync('git status --porcelain', { cwd: this.homeDir, encoding: 'utf-8' });
      if (status.trim() && !force) {
        return { 
          success: false, 
          error: 'Local changes detected. Use --force to discard.' 
        };
      }

      let backupPath: string | undefined;
      
      // Backup if requested
      if (backup) {
        backupPath = await this.createBackup();
        console.log(`📦 Backup created: ${backupPath}`);
      }

      // Stash if needed
      const hasChanges = status.trim().length > 0;
      if (hasChanges) {
        execSync('git stash', { cwd: this.homeDir, stdio: 'pipe' });
      }

      // Pull latest
      console.log('⬇️  Pulling latest changes...');
      execSync(`git pull origin ${this.config.branch}`, { cwd: this.homeDir, stdio: 'inherit' });

      // Install dependencies
      console.log('📦 Installing dependencies...');
      execSync('npm install', { cwd: this.homeDir, stdio: 'inherit' });

      // Build
      console.log('🔨 Building...');
      execSync('npm run build', { cwd: this.homeDir, stdio: 'inherit' });

      // Restore stash if needed
      if (hasChanges) {
        console.log('↩️  Restoring local changes...');
        try {
          execSync('git stash pop', { cwd: this.homeDir, stdio: 'pipe' });
        } catch {
          console.log('⚠️  Could not restore stash - manual intervention needed');
        }
      }

      return { success: true, backupPath };
    } catch (e: any) {
      return { 
        success: false, 
        error: e.message || 'Update failed',
        backupPath: undefined
      };
    }
  }

  /**
   * Create backup
   */
  async createBackup(): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = `duck-agent-backup-${timestamp}`;
    const backupDir = join(this.homeDir, '.duckagent', 'backups', backupName);
    
    execSync(`mkdir -p "${backupDir}"`);
    
    // Backup key files/dirs
    const items = [
      'package.json',
      'src',
      'dist',
      '.duckagent',
    ];
    
    for (const item of items) {
      const src = join(this.homeDir, item);
      if (existsSync(src)) {
        execSync(`cp -r "${src}" "${backupDir}/"`);
      }
    }
    
    return backupDir;
  }

  /**
   * Restore from backup
   */
  restore(backupPath: string): { success: boolean; error?: string } {
    try {
      if (!existsSync(backupPath)) {
        return { success: false, error: 'Backup not found' };
      }

      // Clear current
      const items = ['package.json', 'src', 'dist', '.duckagent'];
      for (const item of items) {
        const path = join(this.homeDir, item);
        if (existsSync(path)) {
          execSync(`rm -rf "${path}"`);
        }
      }

      // Restore
      execSync(`cp -r "${backupPath}"/* "${this.homeDir}/"`);
      
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  /**
   * List available backups
   */
  listBackups(): { name: string; path: string; date: string }[] {
    const backupDir = join(this.homeDir, '.duckagent', 'backups');
    
    if (!existsSync(backupDir)) {
      return [];
    }

    try {
      const dirs = execSync(`ls -lt "${backupDir}"`, { encoding: 'utf-8' })
        .split('\n')
        .filter((line: string) => line.startsWith('d'))
        .map((line: string) => {
          const parts = line.split(/\s+/);
          const name = parts[parts.length - 1];
          const date = parts.slice(5, 10).join(' ');
          return {
            name,
            path: join(backupDir, name),
            date,
          };
        });

      return dirs;
    } catch {
      return [];
    }
  }

  /**
   * Rollback to previous version
   */
  rollback(): { success: boolean; error?: string } {
    try {
      console.log('↩️  Rolling back...');
      execSync('git checkout HEAD^1', { cwd: this.homeDir, stdio: 'inherit' });
      execSync('npm run build', { cwd: this.homeDir, stdio: 'inherit' });
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  /**
   * Check if on correct branch
   */
  getCurrentBranch(): string {
    try {
      return execSync('git branch --show-current', { cwd: this.homeDir, encoding: 'utf-8' }).trim();
    } catch {
      return 'unknown';
    }
  }

  /**
   * Switch branch
   */
  switchBranch(branch: string): { success: boolean; error?: string } {
    try {
      execSync(`git checkout ${branch}`, { cwd: this.homeDir, stdio: 'inherit' });
      execSync('npm install', { cwd: this.homeDir, stdio: 'inherit' });
      execSync('npm run build', { cwd: this.homeDir, stdio: 'inherit' });
      this.config.branch = branch;
      this.saveConfig();
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  /**
   * Get git diff status
   */
  getStatus(): {
    branch: string;
    clean: boolean;
    ahead: number;
    behind: number;
    untracked: number;
    modified: number;
    staged: number;
  } {
    try {
      const status = execSync('git status --porcelain', { cwd: this.homeDir, encoding: 'utf-8' });
      const lines = status.trim().split('\n').filter((l: string) => l);
      
      let untracked = 0, modified = 0, staged = 0;
      for (const line of lines) {
        const state = line.slice(0, 2);
        if (state === '??') untracked++;
        else if (state === '  ' || state === '??') modified++;
        else staged++;
      }

      const ahead = parseInt(execSync('git rev-list --count HEAD@{upstream}..HEAD', { 
        cwd: this.homeDir, encoding: 'utf-8', stdio: 'pipe' 
      }).toString().trim()) || 0;
      
      const behind = parseInt(execSync('git rev-list --count HEAD..HEAD@{upstream}', { 
        cwd: this.homeDir, encoding: 'utf-8', stdio: 'pipe' 
      }).toString().trim()) || 0;

      return {
        branch: this.getCurrentBranch(),
        clean: lines.length === 0,
        ahead,
        behind,
        untracked,
        modified,
        staged,
      };
    } catch {
      return {
        branch: 'unknown',
        clean: true,
        ahead: 0,
        behind: 0,
        untracked: 0,
        modified: 0,
        staged: 0,
      };
    }
  }
}
