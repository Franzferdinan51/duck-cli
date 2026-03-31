/**
 * 🦆 Duck Agent - OpenClaw Sync System
 * Git-based sync with OpenClaw upstream
 * Diff detection, impact analysis, conflict resolution, changelog generation
 */

import { execSync, ExecException } from 'child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { Agent } from '../agent/core.js';

// ============================================================================
// Types
// ============================================================================

export interface OpenClawUpstream {
  url: string;
  branch: string;
  lastSync?: Date;
}

export interface OpenClawDiff {
  file: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  oldPath?: string;
  hunks: DiffHunk[];
}

export interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: string[];
}

export interface OpenClawChange {
  commit: string;
  message: string;
  author: string;
  date: Date;
  files: string[];
  breaking: boolean;
  impact: ChangeImpact;
}

export interface ChangeImpact {
  level: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  affectedAreas: string[];
  riskFactors: string[];
  migrationRequired: boolean;
}

export interface SyncResult {
  success: boolean;
  changes?: OpenClawChange[];
  conflicts?: SyncConflict[];
  backups?: string[];
  error?: string;
  changelog?: string;
}

export interface SyncConflict {
  file: string;
  type: 'content' | 'structural' | 'missing';
  ourVersion?: string;
  theirVersion?: string;
  resolution?: 'ours' | 'theirs' | 'manual' | 'merged';
  aiDecision?: string;
}

export interface SyncConfig {
  upstreamUrl: string;
  upstreamBranch?: string;
  autoBackup?: boolean;
  autoMerge?: boolean;
  aiResolution?: boolean;
  impactAnalysis?: boolean;
}

// ============================================================================
// OpenClaw Sync System
// ============================================================================

export class OpenClawSync {
  private config: SyncConfig;
  private homeDir: string;
  private upstreamRemote: string = 'openclaw-upstream';
  private backupDir: string;
  private changelogPath: string;
  
  constructor(homeDir?: string, config?: Partial<SyncConfig>) {
    this.homeDir = homeDir || process.cwd();
    this.config = {
      upstreamUrl: config?.upstreamUrl || 'https://github.com/openclaw/openclaw.git',
      upstreamBranch: config?.upstreamBranch || 'main',
      autoBackup: config?.autoBackup ?? true,
      autoMerge: config?.autoMerge ?? false,
      aiResolution: config?.aiResolution ?? true,
      impactAnalysis: config?.impactAnalysis ?? true,
    };
    
    this.backupDir = join(this.homeDir, '.duckagent', 'openclaw-sync-backups');
    this.changelogPath = join(this.homeDir, '.duckagent', 'openclaw-changelog.md');
    
    this.ensureDirectories();
  }

  /**
   * Ensure required directories exist
   */
  private ensureDirectories(): void {
    try {
      mkdirSync(this.backupDir, { recursive: true });
      const changelogDir = dirname(this.changelogPath);
      mkdirSync(changelogDir, { recursive: true });
    } catch {}
  }

  /**
   * Set up the OpenClaw upstream remote
   */
  setupUpstream(): { success: boolean; error?: string } {
    try {
      // Check if remote already exists
      const remotes = this.getRemotes();
      
      if (remotes.includes(this.upstreamRemote)) {
        // Update URL if changed
        execSync(`git remote set-url ${this.upstreamRemote} ${this.config.upstreamUrl}`, {
          cwd: this.homeDir,
          stdio: 'pipe',
        });
      } else {
        // Add new remote
        execSync(`git remote add ${this.upstreamRemote} ${this.config.upstreamUrl}`, {
          cwd: this.homeDir,
          stdio: 'pipe',
        });
      }
      
      return { success: true };
    } catch (e) {
      const error = e instanceof Error ? e.message : 'Unknown error';
      return { success: false, error };
    }
  }

  /**
   * Get list of remotes
   */
  private getRemotes(): string[] {
    try {
      const output = execSync('git remote', { cwd: this.homeDir, encoding: 'utf-8' });
      return output.trim().split('\n').filter(Boolean);
    } catch {
      return [];
    }
  }

  /**
   * Fetch latest from OpenClaw upstream
   */
  fetch(): { success: boolean; error?: string } {
    try {
      this.setupUpstream();
      execSync(`git fetch ${this.upstreamRemote}`, {
        cwd: this.homeDir,
        stdio: 'pipe',
      });
      return { success: true };
    } catch (e) {
      const error = e instanceof Error ? e.message : 'Unknown error';
      return { success: false, error };
    }
  }

  /**
   * Get diff between current state and upstream
   */
  getDiff(): OpenClawDiff[] {
    try {
      const output = execSync(
        `git diff ${this.upstreamRemote}/${this.config.upstreamBranch}..HEAD --stat`,
        { cwd: this.homeDir, encoding: 'utf-8' }
      );
      
      // Parse diff stats
      const diffs: OpenClawDiff[] = [];
      const lines = output.trim().split('\n');
      
      for (const line of lines) {
        const match = line.match(/^\s*(.+?)\s*\|\s*(\d+)\s*([\+|\-]+)$/);
        if (match) {
          diffs.push({
            file: match[1].trim(),
            status: line.includes('+') && !line.includes('-') ? 'added' :
                    !line.includes('+') && line.includes('-') ? 'deleted' : 'modified',
            hunks: [],
          });
        }
      }
      
      return diffs;
    } catch {
      return [];
    }
  }

  /**
   * Get commits that differ from upstream
   */
  getChanges(): OpenClawChange[] {
    try {
      const output = execSync(
        `git log HEAD..${this.upstreamRemote}/${this.config.upstreamBranch} --format="%H|%s|%an|%ae|%ai"`,
        { cwd: this.homeDir, encoding: 'utf-8' }
      );
      
      const changes: OpenClawChange[] = [];
      const lines = output.trim().split('\n').filter(Boolean);
      
      for (const line of lines) {
        const [hash, message, author, email, date] = line.split('|');
        
        // Get files changed in this commit
        const filesOutput = execSync(
          `git diff-tree --no-commit-id --name-only -r ${hash}`,
          { cwd: this.homeDir, encoding: 'utf-8' }
        );
        const files = filesOutput.trim().split('\n').filter(Boolean);
        
        // Analyze impact
        const impact = this.analyzeImpact(files, message);
        
        changes.push({
          commit: hash,
          message,
          author,
          date: new Date(date),
          files,
          breaking: this.isBreakingChange(message, files),
          impact,
        });
      }
      
      return changes.reverse(); // Oldest first
    } catch {
      return [];
    }
  }

  /**
   * Analyze the impact of changes
   */
  private analyzeImpact(files: string[], commitMessage: string): ChangeImpact {
    const areas: string[] = [];
    const risks: string[] = [];
    let level: ChangeImpact['level'] = 'low';
    let migrationRequired = false;
    
    // Categorize files
    for (const file of files) {
      if (file.startsWith('src/gateway/') || file.startsWith('gateway/')) {
        areas.push('gateway');
        risks.push('Gateway protocol changes may affect ACP clients');
      }
      if (file.startsWith('src/tools/') || file.includes('tool')) {
        areas.push('tools');
        risks.push('Tool changes may require adapter updates');
      }
      if (file.startsWith('src/compat/') || file.includes('compat')) {
        areas.push('compatibility');
        level = Math.max(level === 'low' ? 0 : level === 'medium' ? 1 : level === 'high' ? 2 : 3, 1) as ChangeImpact['level'];
      }
      if (file.includes('protocol') || file.includes('api')) {
        areas.push('api');
        risks.push('API changes may break existing integrations');
      }
      if (file.includes('skill') || file.includes('SKILL')) {
        areas.push('skills');
        risks.push('Skill system changes may require skill updates');
      }
      if (file.startsWith('src/cli/') || file.includes('command')) {
        areas.push('cli');
        risks.push('CLI changes may affect existing scripts');
      }
    }
    
    // Check for breaking indicators
    if (commitMessage.toLowerCase().includes('breaking')) {
      level = Math.max(level === 'low' ? 0 : level === 'medium' ? 1 : level === 'high' ? 2 : 3, 2) as ChangeImpact['level'];
      risks.push('Breaking change detected in commit message');
      migrationRequired = true;
    }
    
    // Critical files
    if (files.some(f => f.includes('core') || f.includes('agent'))) {
      level = Math.max(level === 'low' ? 0 : level === 'medium' ? 1 : level === 'high' ? 2 : 3, 2) as ChangeImpact['level'];
      risks.push('Core files modified - high risk');
      migrationRequired = true;
    }
    
    return {
      level,
      description: `Changes affect ${areas.length > 0 ? areas.join(', ') : 'unknown'} areas`,
      affectedAreas: [...new Set(areas)],
      riskFactors: risks,
      migrationRequired,
    };
  }

  /**
   * Check if a change is breaking
   */
  private isBreakingChange(message: string, files: string[]): boolean {
    const breakingIndicators = [
      'breaking',
      'BREAKING',
      'major',
      'remove',
      'delete',
      'deprecate',
    ];
    
    const hasBreakingMessage = breakingIndicators.some(ind => message.includes(ind));
    const hasBreakingFiles = files.some(f => 
      f.includes('remove') || f.includes('deprecated') || f.includes('breaking')
    );
    
    return hasBreakingMessage || hasBreakingFiles;
  }

  /**
   * Detect conflicts between local and upstream
   */
  detectConflicts(): SyncConflict[] {
    try {
      // Try to merge (dry-run)
      execSync(
        `git merge --no-commit --no-ff ${this.upstreamRemote}/${this.config.upstreamBranch}`,
        { cwd: this.homeDir, stdio: 'pipe' }
      );
      
      // No conflicts - abort the merge
      execSync('git merge --abort', { cwd: this.homeDir, stdio: 'pipe' });
      return [];
    } catch (e) {
      // Conflicts detected
      const conflicts: SyncConflict[] = [];
      
      try {
        const output = execSync('git diff --name-only --diff-filter=U', {
          cwd: this.homeDir,
          encoding: 'utf-8',
        });
        
        const conflictedFiles = output.trim().split('\n').filter(Boolean);
        
        for (const file of conflictedFiles) {
          conflicts.push({
            file,
            type: 'content',
            resolution: 'manual',
          });
        }
        
        // Abort the merge
        execSync('git merge --abort', { cwd: this.homeDir, stdio: 'pipe' });
      } catch {
        // Ignore
      }
      
      return conflicts;
    }
  }

  /**
   * Resolve a conflict using AI decision-making
   */
  async resolveConflict(conflict: SyncConflict, agent?: Agent): Promise<SyncConflict> {
    if (!this.config.aiResolution || !agent) {
      conflict.resolution = 'manual';
      return conflict;
    }
    
    try {
      // Read both versions
      const ourVersion = existsSync(conflict.file) 
        ? readFileSync(conflict.file, 'utf-8')
        : undefined;
      
      const baseVersion = execSync(
        `git show :1:${conflict.file}`,
        { cwd: this.homeDir, encoding: 'utf-8' }
      );
      
      const theirVersion = execSync(
        `git show :3:${conflict.file}`,
        { cwd: this.homeDir, encoding: 'utf-8' }
      );
      
      // Ask AI to resolve
      const prompt = `Resolve this git conflict in ${conflict.file}.
      
Our version (HEAD):
${ourVersion || '(file does not exist in our version)'}

Base version (common ancestor):
${baseVersion}

Their version (${this.upstreamRemote}/${this.config.upstreamBranch}):
${theirVersion}

Consider:
1. Which changes are more relevant for Duck Agent?
2. Are there any Duck Agent-specific modifications that should be preserved?
3. Can both versions be merged cleanly?

Respond with ONLY one word: 'ours', 'theirs', or 'merge'`;
      
      const decision = await agent.think(prompt);
      const choice = decision.toLowerCase().includes('ours') ? 'ours' :
                     decision.toLowerCase().includes('theirs') ? 'theirs' : 'merged';
      
      conflict.resolution = choice;
      conflict.aiDecision = decision;
      
      // Apply resolution
      if (choice === 'ours') {
        execSync(`git checkout --ours ${conflict.file}`, { cwd: this.homeDir, stdio: 'pipe' });
      } else if (choice === 'theirs') {
        execSync(`git checkout --theirs ${conflict.file}`, { cwd: this.homeDir, stdio: 'pipe' });
      }
      // 'merged' means we'll handle it manually
      
      return conflict;
    } catch (e) {
      conflict.resolution = 'manual';
      conflict.aiDecision = `Error during AI resolution: ${e instanceof Error ? e.message : 'Unknown error'}`;
      return conflict;
    }
  }

  /**
   * Perform sync with upstream
   */
  async sync(agent?: Agent): Promise<SyncResult> {
    const backups: string[] = [];
    
    try {
      // Step 1: Fetch latest
      const fetchResult = this.fetch();
      if (!fetchResult.success) {
        return { success: false, error: `Failed to fetch: ${fetchResult.error}` };
      }
      
      // Step 2: Get changes
      const changes = this.getChanges();
      
      // Step 3: Detect conflicts
      const conflicts = this.detectConflicts();
      
      // Step 4: Create backup if needed
      if (this.config.autoBackup && (changes.length > 0 || conflicts.length > 0)) {
        const backupPath = this.createBackup();
        backups.push(backupPath);
      }
      
      // Step 5: Resolve conflicts if any
      if (conflicts.length > 0 && agent) {
        for (const conflict of conflicts) {
          await this.resolveConflict(conflict, agent);
        }
      } else if (conflicts.length > 0) {
        return {
          success: false,
          error: `${conflicts.length} conflicts detected - manual resolution required`,
          backups,
          conflicts,
        };
      }
      
      // Step 6: Perform merge if auto-merge enabled
      if (this.config.autoMerge) {
        try {
          execSync(
            `git merge ${this.upstreamRemote}/${this.config.upstreamBranch}`,
            { cwd: this.homeDir, stdio: 'pipe' }
          );
        } catch (e) {
          // Merge failed - conflicts expected
          return {
            success: false,
            error: 'Auto-merge failed',
            backups,
            conflicts: this.detectConflicts(),
          };
        }
      }
      
      // Step 7: Generate changelog
      const changelog = this.generateChangelog(changes);
      
      return {
        success: true,
        changes,
        backups,
        changelog,
      };
    } catch (e) {
      const error = e instanceof Error ? e.message : 'Unknown error';
      
      // Rollback if needed
      if (backups.length > 0) {
        this.rollback(backups[0]);
      }
      
      return {
        success: false,
        error,
        backups,
      };
    }
  }

  /**
   * Create a backup of current state
   */
  createBackup(): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = `openclaw-sync-${timestamp}`;
    const backupPath = join(this.backupDir, backupName);
    
    execSync(`mkdir -p "${backupPath}"`, { cwd: this.homeDir, stdio: 'pipe' });
    
    // Backup key files
    const items = ['src', 'package.json', 'tsconfig.json'];
    
    for (const item of items) {
      const src = join(this.homeDir, item);
      if (existsSync(src)) {
        execSync(`cp -r "${src}" "${backupPath}/"`, { cwd: this.homeDir, stdio: 'pipe' });
      }
    }
    
    return backupPath;
  }

  /**
   * Rollback to a previous backup
   */
  rollback(backupPath: string): { success: boolean; error?: string } {
    try {
      if (!existsSync(backupPath)) {
        return { success: false, error: 'Backup not found' };
      }
      
      // Save current state first
      const currentBackup = this.createBackup();
      
      // Restore from backup
      const items = ['src', 'package.json', 'tsconfig.json'];
      for (const item of items) {
        const backupItem = join(backupPath, item);
        const current = join(this.homeDir, item);
        
        if (existsSync(current)) {
          execSync(`rm -rf "${current}"`, { cwd: this.homeDir, stdio: 'pipe' });
        }
        if (existsSync(backupItem)) {
          execSync(`cp -r "${backupItem}" "${this.homeDir}/"`, { cwd: this.homeDir, stdio: 'pipe' });
        }
      }
      
      return { success: true };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'Unknown error' };
    }
  }

  /**
   * Generate changelog from changes
   */
  generateChangelog(changes: OpenClawChange[]): string {
    if (changes.length === 0) {
      return '# OpenClaw Sync Changelog\n\nNo changes from upstream.\n';
    }
    
    let changelog = '# OpenClaw Sync Changelog\n';
    changelog += `Generated: ${new Date().toISOString()}\n\n`;
    
    // Group by impact level
    const critical = changes.filter(c => c.impact.level === 'critical');
    const high = changes.filter(c => c.impact.level === 'high');
    const medium = changes.filter(c => c.impact.level === 'medium');
    const low = changes.filter(c => c.impact.level === 'low');
    
    if (critical.length > 0) {
      changelog += '## 🔴 Critical Changes\n\n';
      for (const change of critical) {
        changelog += this.formatChange(change);
      }
      changelog += '\n';
    }
    
    if (high.length > 0) {
      changelog += '## 🟠 High Impact Changes\n\n';
      for (const change of high) {
        changelog += this.formatChange(change);
      }
      changelog += '\n';
    }
    
    if (medium.length > 0) {
      changelog += '## 🟡 Medium Impact Changes\n\n';
      for (const change of medium) {
        changelog += this.formatChange(change);
      }
      changelog += '\n';
    }
    
    if (low.length > 0) {
      changelog += '## 🟢 Low Impact Changes\n\n';
      for (const change of low) {
        changelog += this.formatChange(change);
      }
      changelog += '\n';
    }
    
    // Save changelog
    try {
      writeFileSync(this.changelogPath, changelog);
    } catch {}
    
    return changelog;
  }

  /**
   * Format a single change entry
   */
  private formatChange(change: OpenClawChange): string {
    let entry = `### ${change.message}\n`;
    entry += `- **Commit:** \`${change.commit.slice(0, 8)}\`\n`;
    entry += `- **Author:** ${change.author}\n`;
    entry += `- **Date:** ${change.date.toISOString()}\n`;
    entry += `- **Files:** ${change.files.length}\n`;
    
    if (change.breaking) {
      entry += `- **⚠️ BREAKING CHANGE**\n`;
    }
    
    if (change.impact.affectedAreas.length > 0) {
      entry += `- **Affected areas:** ${change.impact.affectedAreas.join(', ')}\n`;
    }
    
    if (change.impact.riskFactors.length > 0) {
      entry += `- **Risk factors:**\n`;
      for (const risk of change.impact.riskFactors) {
        entry += `  - ${risk}\n`;
      }
    }
    
    entry += '\n';
    return entry;
  }

  /**
   * Get sync status
   */
  getStatus(): {
    configured: boolean;
    remote: string;
    branch: string;
    commitsBehind: number;
    commitsAhead: number;
    conflicts: number;
    lastSync?: Date;
  } {
    try {
      const remotes = this.getRemotes();
      const configured = remotes.includes(this.upstreamRemote);
      
      if (!configured) {
        return {
          configured: false,
          remote: this.upstreamRemote,
          branch: this.config.upstreamBranch || 'main',
          commitsBehind: 0,
          commitsAhead: 0,
          conflicts: 0,
        };
      }
      
      // Get commit counts
      let commitsBehind = 0;
      let commitsAhead = 0;
      
      try {
        commitsBehind = parseInt(
          execSync(`git rev-list --count HEAD..${this.upstreamRemote}/${this.config.upstreamBranch}`, {
            cwd: this.homeDir,
            encoding: 'utf-8',
            stdio: 'pipe',
          }).trim()
        ) || 0;
        
        commitsAhead = parseInt(
          execSync(`git rev-list --count ${this.upstreamRemote}/${this.config.upstreamBranch}..HEAD`, {
            cwd: this.homeDir,
            encoding: 'utf-8',
            stdio: 'pipe',
          }).trim()
        ) || 0;
      } catch {
        // Ignore
      }
      
      const conflicts = this.detectConflicts().length;
      
      return {
        configured,
        remote: this.upstreamRemote,
        branch: this.config.upstreamBranch || 'main',
        commitsBehind,
        commitsAhead,
        conflicts,
        lastSync: undefined, // Would need to track this
      };
    } catch {
      return {
        configured: false,
        remote: this.upstreamRemote,
        branch: this.config.upstreamBranch || 'main',
        commitsBehind: 0,
        commitsAhead: 0,
        conflicts: 0,
      };
    }
  }
}

export default OpenClawSync;
