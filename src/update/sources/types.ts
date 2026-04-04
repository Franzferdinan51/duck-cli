/**
 * 🦆 Duck CLI - Integration Sync System
 * Shared types and interfaces for all sync modules
 */

export interface SyncModule {
  name: string;
  source: string;
  repo: string;
  lastSync: Date | null;
  status: SyncStatus;
  sync(): Promise<SyncResult>;
  getChanges(): Promise<Change[]>;
  applyChanges?(changes: Change[]): Promise<void>;
  getStatus(): SyncStatus;
}

export interface SyncStatus {
  configured: boolean;
  available: boolean;
  lastSync: Date | null;
  commitsBehind: number;
  errors: string[];
}

export interface SyncResult {
  success: boolean;
  source: string;
  changesFound: number;
  changesApplied: number;
  conflicts: Conflict[];
  errors: string[];
  duration: number;
  timestamp: Date;
}

export interface Change {
  id: string;
  source: string;
  type: 'file' | 'directory' | 'feature' | 'config';
  path: string;
  action: 'add' | 'modify' | 'delete' | 'merge';
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  metadata?: Record<string, unknown>;
}

export interface Conflict {
  id: string;
  source: string;
  file: string;
  type: 'content' | 'structural' | 'missing';
  ourVersion?: string;
  theirVersion?: string;
  resolution?: 'ours' | 'theirs' | 'merged' | 'manual';
  resolutionDescription?: string;
}

export interface SyncState {
  sources: Record<string, SourceState>;
  global: GlobalSyncState;
}

export interface SourceState {
  name: string;
  repo: string;
  lastSync: string | null;
  lastCommit: string | null;
  status: 'success' | 'failed' | 'pending';
  changesApplied: number;
  errors: string[];
}

export interface GlobalSyncState {
  lastGlobalSync: string | null;
  totalSyncs: number;
  successfulSyncs: number;
  failedSyncs: number;
}

export interface SyncOptions {
  force?: boolean;
  dryRun?: boolean;
  verbose?: boolean;
  target?: string;
}
