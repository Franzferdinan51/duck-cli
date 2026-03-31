/**
 * 🦆 Duck Agent - Tasks Module (v2026.3.31 OpenClaw Compatibility)
 * 
 * Exports:
 * - TaskRegistry: SQLite-backed task ledger
 * - TaskStatus: Task status enum
 * - Task: Task interface
 * - TaskCreate: Task creation input
 * - TaskFilter: Task query filter
 */

export { TaskRegistry } from './task-registry.js';
export type { Task, TaskCreate, TaskFilter, TaskStatus } from './task-registry.js';
