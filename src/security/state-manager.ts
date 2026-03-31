/**
 * 🦆 Duck Agent - State Manager
 * Persistent state management for Duck Agent sessions
 * Based on NVIDIA NemoClaw state management
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'path';

const STATE_DIR = join(process.env.HOME || '/tmp', '.duckagent', 'state');

export interface DuckAgentState {
  lastRunId: string | null;
  lastAction: string | null;
  version: string | null;
  sandboxName: string | null;
  sessionCount: number;
  totalInteractions: number;
  createdAt: string | null;
  updatedAt: string;
  lastModel: string | null;
  lastProvider: string | null;
  preferences: Record<string, any>;
}

let stateDirCreated = false;

function ensureStateDir(): void {
  if (stateDirCreated) return;
  if (!existsSync(STATE_DIR)) {
    mkdirSync(STATE_DIR, { recursive: true });
  }
  stateDirCreated = true;
}

function statePath(): string {
  return join(STATE_DIR, 'state.json');
}

function blankState(): DuckAgentState {
  return {
    lastRunId: null,
    lastAction: null,
    version: null,
    sandboxName: null,
    sessionCount: 0,
    totalInteractions: 0,
    createdAt: null,
    updatedAt: new Date().toISOString(),
    lastModel: null,
    lastProvider: null,
    preferences: {},
  };
}

export function loadState(): DuckAgentState {
  ensureStateDir();
  const path = statePath();
  if (!existsSync(path)) {
    return blankState();
  }
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as DuckAgentState;
  } catch {
    return blankState();
  }
}

export function saveState(state: Partial<DuckAgentState>): DuckAgentState {
  ensureStateDir();
  const current = loadState();
  const updated: DuckAgentState = {
    ...current,
    ...state,
    updatedAt: new Date().toISOString(),
  };
  updated.createdAt ??= updated.updatedAt;
  writeFileSync(statePath(), JSON.stringify(updated, null, 2));
  return updated;
}

export function updateLastAction(action: string, runId?: string): void {
  saveState({
    lastAction: action,
    lastRunId: runId || `run_${Date.now()}`,
    sessionCount: loadState().sessionCount + (runId ? 1 : 0),
  });
}

export function incrementInteractions(): void {
  const state = loadState();
  saveState({ totalInteractions: state.totalInteractions + 1 });
}

export function clearState(): void {
  ensureStateDir();
  const path = statePath();
  if (existsSync(path)) {
    writeFileSync(path, JSON.stringify(blankState(), null, 2));
  }
}

export function getStatePath(): string {
  ensureStateDir();
  return statePath();
}

export default { loadState, saveState, updateLastAction, incrementInteractions, clearState, getStatePath };
