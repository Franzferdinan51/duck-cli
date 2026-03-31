/**
 * 🦆 Duck Agent - Extended Task Tools
 * From instructkr-claude-code
 */

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  created: number;
  updated: number;
  completed?: number;
  result?: any;
}

export interface TaskStore {
  tasks: Map<string, Task>;
  create(task: Omit<Task, 'id' | 'created' | 'updated'>): Task;
  get(id: string): Task | undefined;
  list(): Task[];
  update(id: string, updates: Partial<Task>): Task | undefined;
  delete(id: string): boolean;
  stop(id: string): boolean;
}

export class TaskManager implements TaskStore {
  tasks: Map<string, Task> = new Map();

  create(task: Omit<Task, 'id' | 'created' | 'updated'>): Task {
    const id = `task_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const now = Date.now();
    
    const newTask: Task = {
      ...task,
      id,
      created: now,
      updated: now,
    };
    
    this.tasks.set(id, newTask);
    return newTask;
  }

  get(id: string): Task | undefined {
    return this.tasks.get(id);
  }

  list(): Task[] {
    return Array.from(this.tasks.values())
      .sort((a, b) => b.created - a.created);
  }

  update(id: string, updates: Partial<Task>): Task | undefined {
    const task = this.tasks.get(id);
    if (!task) return undefined;
    
    const updated: Task = {
      ...task,
      ...updates,
      id: task.id,
      created: task.created,
      updated: Date.now(),
    };
    
    this.tasks.set(id, updated);
    return updated;
  }

  delete(id: string): boolean {
    return this.tasks.delete(id);
  }

  stop(id: string): boolean {
    const task = this.tasks.get(id);
    if (!task) return false;
    
    task.status = 'cancelled';
    task.updated = Date.now();
    return true;
  }

  complete(id: string, result?: any): Task | undefined {
    const task = this.tasks.get(id);
    if (!task) return undefined;
    
    task.status = 'completed';
    task.completed = Date.now();
    task.result = result;
    task.updated = Date.now();
    return task;
  }

  // Filter tasks
  byStatus(status: Task['status']): Task[] {
    return this.list().filter(t => t.status === status);
  }

  byPriority(priority: Task['priority']): Task[] {
    return this.list().filter(t => t.priority === priority);
  }

  pending(): Task[] {
    return this.byStatus('pending');
  }

  inProgress(): Task[] {
    return this.byStatus('in_progress');
  }

  completed(): Task[] {
    return this.byStatus('completed');
  }
}

// Global task manager instance
export const taskManager = new TaskManager();

/**
 * TaskListTool - List all tasks
 */
export async function listTasks(options?: { status?: Task['status']; limit?: number }): Promise<string> {
  let tasks = taskManager.list();
  
  if (options?.status) {
    tasks = tasks.filter(t => t.status === options.status);
  }
  
  if (options?.limit) {
    tasks = tasks.slice(0, options.limit);
  }
  
  if (tasks.length === 0) {
    return 'No tasks found.';
  }
  
  return tasks.map(t => {
    const emoji = t.status === 'completed' ? '✅' : 
                  t.status === 'in_progress' ? '🔄' :
                  t.status === 'cancelled' ? '❌' : '⏳';
    const priority = t.priority === 'urgent' ? '🔴' :
                     t.priority === 'high' ? '🟠' :
                     t.priority === 'medium' ? '🟡' : '⚪';
    
    return `${emoji} ${priority} **[${t.id}]** ${t.title}\n   Status: ${t.status} | Priority: ${t.priority}`;
  }).join('\n\n');
}

/**
 * TaskGetTool - Get task details
 */
export async function getTask(id: string): Promise<string> {
  const task = taskManager.get(id);
  
  if (!task) {
    return `Task ${id} not found.`;
  }
  
  return `
**Task: ${task.title}**
ID: ${task.id}
Status: ${task.status}
Priority: ${task.priority}
Created: ${new Date(task.created).toLocaleString()}
Updated: ${new Date(task.updated).toLocaleString()}
${task.completed ? `Completed: ${new Date(task.completed).toLocaleString()}` : ''}
${task.description ? `\nDescription:\n${task.description}` : ''}
${task.result ? `\nResult:\n${JSON.stringify(task.result, null, 2)}` : ''}
`.trim();
}

/**
 * TaskUpdateTool - Update task
 */
export async function updateTask(id: string, updates: { title?: string; status?: Task['status']; priority?: Task['priority']; description?: string }): Promise<string> {
  const task = taskManager.update(id, updates);
  
  if (!task) {
    return `Task ${id} not found.`;
  }
  
  return `Updated task ${id}:\n- Title: ${task.title}\n- Status: ${task.status}\n- Priority: ${task.priority}`;
}

/**
 * TaskStopTool - Cancel a task
 */
export async function stopTask(id: string): Promise<string> {
  const success = taskManager.stop(id);
  
  if (!success) {
    return `Task ${id} not found.`;
  }
  
  return `Task ${id} cancelled.`;
}

export default { taskManager, listTasks, getTask, updateTask, stopTask };
