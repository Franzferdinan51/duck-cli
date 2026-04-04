/**
 * 🦆 Duck CLI - Integration Sync System
 * Orchestrates all sync modules and provides unified sync commands
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import {
  SyncModule,
  SyncResult,
  SyncStatus,
  Change,
  SyncState,
  SyncOptions,
} from './types.js';

// Import all sync modules
import { OpenClawSync, openclawSync } from './openclaw-sync.js';
import { HermesSync, hermesSync } from './hermes-sync.js';
import { NeMoClawSync, nemoclawSync } from './nemoclaw-sync.js';
import { DroidClawSync, droidclawSync } from './droidclaw-sync.js';
import { ClaudeCodeSync, claudeCodeSync } from './claude-code-sync.js';
import { AgentMeshSync, agentMeshSync } from './agent-mesh-sync.js';
import { PretextSync, pretextSync } from './pretext-sync.js';
import { CopilotKitSync, copilotkitSync } from './copilotkit-sync.js';
import { AICouncilSync, aiCouncilSync } from './ai-council-sync.js';

// Registry of all sync modules
export const syncModules: Record<string, SyncModule> = {
  openclaw: openclawSync,
  hermes: hermesSync,
  nemoclaw: nemoclawSync,
  droidclaw: droidclawSync,
  'claude-code': claudeCodeSync,
  'agent-mesh': agentMeshSync,
  pretext: pretextSync,
  copilotkit: copilotkitSync,
  'ai-council': aiCouncilSync,
};

// Sync module metadata
export const syncModuleInfo: Record<string, { name: string; source: string; repo: string; description: string }> = {
  openclaw: {
    name: 'OpenClaw',
    source: 'OpenClaw',
    repo: 'https://github.com/openclaw/openclaw',
    description: 'ACP/MCP protocols, Gateway API, Skills system, Security hardening',
  },
  hermes: {
    name: 'Hermes-Agent',
    source: 'Hermes-Agent',
    repo: 'https://github.com/NousResearch/hermes-agent',
    description: 'Learning loops, FTS5 memory, Subagent RPC, Cron scheduling',
  },
  nemoclaw: {
    name: 'NeMoClaw',
    source: 'NeMoClaw',
    repo: 'https://github.com/NVIDIA/NeMoClaw',
    description: 'Security sandboxing, Blueprint management, DGX Spark support',
  },
  droidclaw: {
    name: 'DroidClaw',
    source: 'DroidClaw',
    repo: 'https://github.com/unitedbyai/droidclaw',
    description: 'Android automation, ADB commands, Device management',
  },
  'claude-code': {
    name: 'Claude Code',
    source: 'Claude Code',
    repo: 'https://github.com/anthropics/claude-code',
    description: 'Tool implementations (read, write, edit, bash, grep, LSP)',
  },
  'agent-mesh': {
    name: 'Agent Mesh API',
    source: 'Agent Mesh API',
    repo: 'https://github.com/Franzferdinan51/agent-mesh-api',
    description: 'Multi-agent communication, Mesh networking',
  },
  pretext: {
    name: 'Pretext',
    source: 'Pretext',
    repo: 'https://github.com/chenglou/pretext',
    description: 'Text measurement for Canvas rendering',
  },
  copilotkit: {
    name: 'CopilotKit',
    source: 'CopilotKit',
    repo: 'https://github.com/CopilotKit/CopilotKit',
    description: 'UI components and Copilot integration',
  },
  'ai-council': {
    name: 'AI Council',
    source: 'AI-Bot-Council-Concensus',
    repo: 'https://github.com/Franzferdinan51/AI-Bot-Council-Concensus',
    description: 'Multi-agent deliberation, Consensus building',
  },
};

/**
 * 🦆 Sync Orchestrator
 * Manages all sync operations across all sources
 */
export class SyncOrchestrator {
  private homeDir: string;
  private statePath: string;

  constructor(homeDir?: string) {
    this.homeDir = homeDir || process.cwd();
    this.statePath = join(this.homeDir, '.duck', 'sync-state.json');
  }

  /**
   * Get list of all sync modules with their status
   */
  listSources(): Array<{ name: string; info: typeof syncModuleInfo[string]; status: SyncStatus }> {
    return Object.entries(syncModules).map(([name, module]) => ({
      name,
      info: syncModuleInfo[name],
      status: module.getStatus(),
    }));
  }

  /**
   * Get sync status for all sources
   */
  getAllStatus(): Record<string, SyncStatus> {
    const statuses: Record<string, SyncStatus> = {};

    for (const [name, module] of Object.entries(syncModules)) {
      statuses[name] = module.getStatus();
    }

    return statuses;
  }

  /**
   * Get global sync state
   */
  getGlobalState(): SyncState['global'] {
    try {
      if (existsSync(this.statePath)) {
        const state: SyncState = JSON.parse(readFileSync(this.statePath, 'utf-8'));
        return state.global;
      }
    } catch {}

    return {
      lastGlobalSync: null,
      totalSyncs: 0,
      successfulSyncs: 0,
      failedSyncs: 0,
    };
  }

  /**
   * Sync from a specific source
   */
  async syncSource(name: string, options: SyncOptions = {}): Promise<SyncResult> {
    const module = syncModules[name];

    if (!module) {
      return {
        success: false,
        source: name,
        changesFound: 0,
        changesApplied: 0,
        conflicts: [],
        errors: [`Unknown sync source: ${name}`],
        duration: 0,
        timestamp: new Date(),
      };
    }

    if (options.verbose) {
      console.log(`\n🔄 Syncing ${module.name}...`);
    }

    return await module.sync();
  }

  /**
   * Sync from all sources
   */
  async syncAll(options: SyncOptions = {}): Promise<SyncResult[]> {
    const results: SyncResult[] = [];

    if (options.verbose) {
      console.log('\n🌀 Starting global sync...\n');
    }

    for (const [name, module] of Object.entries(syncModules)) {
      if (options.target && options.target !== name) continue;

      try {
        const result = await this.syncSource(name, options);
        results.push(result);

        if (options.verbose) {
          const icon = result.success ? '✅' : '❌';
          console.log(`  ${icon} ${module.name}: ${result.changesApplied}/${result.changesFound} changes`);
        }
      } catch (e) {
        results.push({
          success: false,
          source: name,
          changesFound: 0,
          changesApplied: 0,
          conflicts: [],
          errors: [e instanceof Error ? e.message : 'Unknown error'],
          duration: 0,
          timestamp: new Date(),
        });
      }
    }

    if (options.verbose) {
      console.log('\n🌀 Global sync complete!\n');
    }

    return results;
  }

  /**
   * Get changes from a specific source without applying
   */
  async getChanges(name: string): Promise<Change[]> {
    const module = syncModules[name];
    if (!module) return [];
    return await module.getChanges();
  }

  /**
   * Get changes from all sources
   */
  async getAllChanges(): Promise<Change[]> {
    const allChanges: Change[] = [];

    for (const [, module] of Object.entries(syncModules)) {
      const changes = await module.getChanges();
      allChanges.push(...changes);
    }

    return allChanges;
  }

  /**
   * Format sync results as a readable string
   */
  formatResults(results: SyncResult[]): string {
    let output = '\n📊 Sync Results\n';
    output += '─'.repeat(50) + '\n';

    let totalChanges = 0;
    let totalApplied = 0;
    let successCount = 0;

    for (const result of results) {
      const icon = result.success ? '✅' : '❌';
      output += `${icon} ${syncModuleInfo[result.source]?.name || result.source}\n`;
      output += `   Changes: ${result.changesApplied}/${result.changesFound}\n`;
      output += `   Duration: ${result.duration}ms\n`;

      if (result.errors.length > 0) {
        output += `   Errors: ${result.errors.join(', ')}\n`;
      }

      if (result.conflicts.length > 0) {
        output += `   Conflicts: ${result.conflicts.length}\n`;
      }

      totalChanges += result.changesFound;
      totalApplied += result.changesApplied;
      if (result.success) successCount++;
    }

    output += '─'.repeat(50) + '\n';
    output += `Total: ${successCount}/${results.length} succeeded\n`;
    output += `Changes: ${totalApplied}/${totalChanges} applied\n`;

    return output;
  }

  /**
   * Format status as a readable table
   */
  formatStatus(): string {
    const sources = this.listSources();
    const global = this.getGlobalState();

    let output = '\n🔄 Integration Sync Status\n';
    output += '─'.repeat(60) + '\n';
    output += `Last Global Sync: ${global.lastGlobalSync ? new Date(global.lastGlobalSync).toLocaleString() : 'Never'}\n`;
    output += `Total Syncs: ${global.totalSyncs} | ✅ ${global.successfulSyncs} | ❌ ${global.failedSyncs}\n`;
    output += '─'.repeat(60) + '\n';
    output += 'Source              | Status    | Last Sync            | Behind\n';
    output += '─'.repeat(60) + '\n';

    for (const { name, info, status } of sources) {
      const statusStr = status.available ? (status.lastSync ? 'Synced' : 'Pending') : 'N/A';
      const lastSyncStr = status.lastSync ? new Date(status.lastSync).toLocaleDateString() : 'Never';
      const behindStr = status.commitsBehind > 0 ? `${status.commitsBehind}` : '-';

      output += `${info.name.padEnd(19)} | ${statusStr.padEnd(9)} | ${lastSyncStr.padEnd(20)} | ${behindStr}\n`;
    }

    output += '─'.repeat(60) + '\n';

    return output;
  }
}

// Export singleton instance
export const syncOrchestrator = new SyncOrchestrator();

// Export types
export { SyncModule, SyncResult, SyncStatus, Change, Conflict, SyncState, SyncOptions } from './types.js';
