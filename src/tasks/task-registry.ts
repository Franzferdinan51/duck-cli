/**
 * 🦆 Duck Agent - Task Registry (v2026.3.31 OpenClaw Compatibility)
 * 
 * SQLite-backed task ledger that provides:
 * - Persistent task storage
 * - Blocked state tracking
 * - Parent-child task flow
 * 
 * Compatible with OpenClaw v2026.3.31 task system
 */

import { EventEmitter } from 'events';
import * as path from 'path';
import * as fs from 'fs';

// ============================================================================
// Types
// ============================================================================

export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'blocked' | 'cancelled';

export interface Task {
  id: string;
  name: string;
  description?: string;
  status: TaskStatus;
  parentId?: string;          // Parent task ID for task flow
  childIds?: string[];        // Child task IDs
  blockedReason?: string;     // Why task is blocked
  createdAt: number;
  updatedAt: number;
  startedAt?: number;
  completedAt?: number;
  result?: any;
  error?: string;
  metadata?: Record<string, any>;
}

export interface TaskCreate {
  name: string;
  description?: string;
  parentId?: string;
  metadata?: Record<string, any>;
}

export interface TaskFilter {
  status?: TaskStatus;
  parentId?: string;
  limit?: number;
  offset?: number;
}

// ============================================================================
// Simple SQLite-like store (using JSON for Duck Agent)
// ============================================================================

class TaskStore {
  private storePath: string;
  private tasks: Map<string, Task> = new Map();
  private dirty: boolean = false;
  
  constructor(storePath: string) {
    this.storePath = storePath;
    this.load();
  }
  
  private load(): void {
    try {
      if (fs.existsSync(this.storePath)) {
        const data = JSON.parse(fs.readFileSync(this.storePath, 'utf-8'));
        for (const task of data.tasks || []) {
          this.tasks.set(task.id, task);
        }
      }
    } catch (e) {
      console.warn('[TaskStore] Failed to load, starting fresh');
    }
  }
  
  save(): void {
    if (!this.dirty) return;
    
    const dir = path.dirname(this.storePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(this.storePath, JSON.stringify({
      tasks: Array.from(this.tasks.values()),
      updatedAt: Date.now(),
    }, null, 2));
    
    this.dirty = false;
  }
  
  get(id: string): Task | undefined {
    return this.tasks.get(id);
  }
  
  set(id: string, task: Task): void {
    this.tasks.set(id, task);
    this.dirty = true;
  }
  
  delete(id: string): void {
    this.tasks.delete(id);
    this.dirty = true;
  }
  
  values(): Task[] {
    return Array.from(this.tasks.values());
  }
  
  filter(fn: (task: Task) => boolean): Task[] {
    return Array.from(this.tasks.values()).filter(fn);
  }
}

// ============================================================================
// Task Registry
// ============================================================================

export class TaskRegistry extends EventEmitter {
  private store: TaskStore;
  private nextId: number = 1;
  
  constructor(dataDir?: string) {
    super();
    
    const home = process.env.HOME || '/tmp';
    const dir = dataDir || path.join(home, '.duckagent', 'data');
    
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    this.store = new TaskStore(path.join(dir, 'tasks.json'));
    
    // Load next ID from existing tasks
    const tasks = this.store.values();
    if (tasks.length > 0) {
      const maxId = Math.max(...tasks.map(t => {
        const num = parseInt(t.id.replace('task_', ''));
        return isNaN(num) ? 0 : num;
      }));
      this.nextId = maxId + 1;
    }
  }
  
  /**
   * Generate a new task ID
   */
  private newId(): string {
    return `task_${this.nextId++}`;
  }
  
  /**
   * Create a new task
   */
  create(input: TaskCreate): Task {
    const now = Date.now();
    const task: Task = {
      id: this.newId(),
      name: input.name,
      description: input.description,
      status: 'pending',
      parentId: input.parentId,
      childIds: [],
      createdAt: now,
      updatedAt: now,
      metadata: input.metadata,
    };
    
    // If parent specified, add this task as a child
    if (input.parentId) {
      const parent = this.store.get(input.parentId);
      if (parent) {
        parent.childIds = parent.childIds || [];
        parent.childIds.push(task.id);
        parent.updatedAt = now;
        this.store.set(parent.id, parent);
      }
    }
    
    this.store.set(task.id, task);
    this.store.save();
    
    this.emit('task:created', task);
    return task;
  }
  
  /**
   * Get a task by ID
   */
  get(id: string): Task | undefined {
    return this.store.get(id);
  }
  
  /**
   * Update a task
   */
  update(id: string, updates: Partial<Task>): Task | undefined {
    const task = this.store.get(id);
    if (!task) return undefined;
    
    const updated: Task = {
      ...task,
      ...updates,
      id: task.id, // Prevent ID change
      updatedAt: Date.now(),
    };
    
    this.store.set(id, updated);
    this.store.save();
    
    this.emit('task:updated', updated);
    return updated;
  }
  
  /**
   * Start a task
   */
  start(id: string): Task | undefined {
    return this.update(id, {
      status: 'running',
      startedAt: Date.now(),
    });
  }
  
  /**
   * Complete a task successfully
   */
  complete(id: string, result?: any): Task | undefined {
    return this.update(id, {
      status: 'completed',
      completedAt: Date.now(),
      result,
    });
  }
  
  /**
   * Fail a task
   */
  fail(id: string, error: string): Task | undefined {
    return this.update(id, {
      status: 'failed',
      completedAt: Date.now(),
      error,
    });
  }
  
  /**
   * Block a task
   */
  block(id: string, reason: string): Task | undefined {
    return this.update(id, {
      status: 'blocked',
      blockedReason: reason,
    });
  }
  
  /**
   * Unblock a task
   */
  unblock(id: string): Task | undefined {
    return this.update(id, {
      status: 'pending',
      blockedReason: undefined,
    });
  }
  
  /**
   * Cancel a task
   */
  cancel(id: string): Task | undefined {
    return this.update(id, {
      status: 'cancelled',
      completedAt: Date.now(),
    });
  }
  
  /**
   * List tasks with optional filtering
   */
  list(filter?: TaskFilter): Task[] {
    let tasks = this.store.values();
    
    if (filter?.status) {
      tasks = tasks.filter(t => t.status === filter.status);
    }
    
    if (filter?.parentId !== undefined) {
      tasks = tasks.filter(t => t.parentId === filter.parentId);
    }
    
    // Sort by createdAt descending (newest first)
    tasks.sort((a, b) => b.createdAt - a.createdAt);
    
    if (filter?.offset) {
      tasks = tasks.slice(filter.offset);
    }
    
    if (filter?.limit) {
      tasks = tasks.slice(0, filter.limit);
    }
    
    return tasks;
  }
  
  /**
   * Get child tasks of a parent
   */
  getChildren(parentId: string): Task[] {
    return this.store.filter(t => t.parentId === parentId);
  }
  
  /**
   * Get all blocked tasks
   */
  getBlocked(): Task[] {
    return this.store.filter(t => t.status === 'blocked');
  }
  
  /**
   * Get active tasks (pending or running)
   */
  getActive(): Task[] {
    return this.store.filter(t => t.status === 'pending' || t.status === 'running');
  }
  
  /**
   * Delete a task
   */
  delete(id: string): boolean {
    const task = this.store.get(id);
    if (!task) return false;
    
    // Remove from parent's childIds
    if (task.parentId) {
      const parent = this.store.get(task.parentId);
      if (parent && parent.childIds) {
        parent.childIds = parent.childIds.filter(cid => cid !== id);
        this.store.set(parent.id, parent);
      }
    }
    
    // Delete any child tasks
    for (const childId of task.childIds || []) {
      this.delete(childId);
    }
    
    this.store.delete(id);
    this.store.save();
    
    this.emit('task:deleted', id);
    return true;
  }
  
  /**
   * Get task summary/stats
   */
  getSummary(): {
    total: number;
    pending: number;
    running: number;
    completed: number;
    failed: number;
    blocked: number;
  } {
    const tasks = this.store.values();
    return {
      total: tasks.length,
      pending: tasks.filter(t => t.status === 'pending').length,
      running: tasks.filter(t => t.status === 'running').length,
      completed: tasks.filter(t => t.status === 'completed').length,
      failed: tasks.filter(t => t.status === 'failed').length,
      blocked: tasks.filter(t => t.status === 'blocked').length,
    };
  }
  
  /**
   * Check if all children of a task are complete
   */
  areChildrenComplete(parentId: string): boolean {
    const children = this.getChildren(parentId);
    if (children.length === 0) return true;
    return children.every(c => c.status === 'completed' || c.status === 'cancelled');
  }
  
  /**
   * Cleanup old completed/failed tasks
   */
  cleanup(maxAgeMs: number = 7 * 24 * 60 * 60 * 1000): number {
    const cutoff = Date.now() - maxAgeMs;
    const tasks = this.store.values();
    let count = 0;
    
    for (const task of tasks) {
      if ((task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled') &&
          task.completedAt && task.completedAt < cutoff) {
        this.delete(task.id);
        count++;
      }
    }
    
    return count;
  }
}

export default TaskRegistry;
