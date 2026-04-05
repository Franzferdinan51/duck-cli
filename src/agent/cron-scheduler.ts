/**
 * Duck Agent - Natural Language Cron Scheduler
 * Parse natural language schedules into cron expressions
 * Schedule tasks to run automatically
 */

import { spawn } from 'child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import Database from '../vendor/better-sqlite3.js';

export interface CronJob {
  id: string;
  name: string;
  schedule: string;           // natural language: "every day at 9am"
  cronExpr: string;           // actual cron: "0 9 * * *"
  task: string;               // what to run
  taskType: 'shell' | 'agent' | 'skill';
  enabled: boolean;
  lastRun?: number;
  nextRun?: number;
  runCount: number;
  successCount: number;
  failureCount: number;
  lastError?: string;
  createdAt: number;
  lastModified: number;
}

export interface CronRun {
  id: string;
  jobId: string;
  startedAt: number;
  completedAt?: number;
  duration?: number;
  success: boolean;
  output?: string;
  error?: string;
}

export class CronScheduler {
  private db: Database.Database;
  private cronDir: string;
  private runningJobs: Map<string, CronRun> = new Map();
  private intervalId?: NodeJS.Timeout;
  private _cron_listeners: Array<(e: CronEvent) => void> = [];

  constructor(cronDir?: string) {
    this.cronDir = cronDir || join(homedir(), '.duck', 'cron');
    mkdirSync(this.cronDir, { recursive: true });
    
    const dbPath = join(this.cronDir, 'cron.db');
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    
    this.initialize();
    this.startScheduler();
  }

  private initialize(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS cron_jobs (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        schedule TEXT NOT NULL,
        cron_expr TEXT NOT NULL,
        task TEXT NOT NULL,
        task_type TEXT NOT NULL DEFAULT 'shell',
        enabled INTEGER NOT NULL DEFAULT 1,
        last_run INTEGER,
        next_run INTEGER,
        run_count INTEGER NOT NULL DEFAULT 0,
        success_count INTEGER NOT NULL DEFAULT 0,
        failure_count INTEGER NOT NULL DEFAULT 0,
        last_error TEXT,
        created_at INTEGER NOT NULL,
        last_modified INTEGER NOT NULL
      )
    `);

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS cron_runs (
        id TEXT PRIMARY KEY,
        job_id TEXT NOT NULL,
        started_at INTEGER NOT NULL,
        completed_at INTEGER,
        duration INTEGER,
        success INTEGER NOT NULL,
        output TEXT,
        error TEXT
      )
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_job_id ON cron_runs(job_id);
      CREATE INDEX IF NOT EXISTS idx_next_run ON cron_jobs(next_run);
    `);
  }

  /**
   * Parse natural language → cron expression + next run time
   */
  parseNaturalSchedule(input: string): { cronExpr: string; nextRun: number; description: string } {
    const lower = input.toLowerCase().trim();
    
    // "every day at 9am" / "daily at 9am" / "every morning at 9"
    let match = lower.match(/every\s+day\s+at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
    if (!match) match = lower.match(/daily\s+at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
    if (!match) match = lower.match(/every\s+morning\s+at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
    if (!match) match = lower.match(/every\s+evening\s+at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
    if (lower.includes('every day at') || lower.includes('daily at')) {
      const parts = lower.split(/\s+at\s+/);
      const timePart = parts[parts.length - 1];
      const m = timePart.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
      if (m) match = [null, m[1] || '', m[2] || '', m[3] || ''] as any;
    }
    if (match) {
      let hour = parseInt(match[1]);
      const min = match[2] ? parseInt(match[2]) : 0;
      const ampm = match[3];
      if (ampm === 'pm' && hour < 12) hour += 12;
      if (ampm === 'am' && hour === 12) hour = 0;
      const cronExpr = `${min} ${hour} * * *`;
      const nextRun = this.getNextRunTime(cronExpr);
      const desc = lower.includes('evening') ? `Daily at ${hour}:${min.toString().padStart(2,'0')}` : `Daily at ${hour}:${min.toString().padStart(2,'0')}`;
      return { cronExpr, nextRun, description: desc };
    }

    // "every hour" / "hourly"
    if (lower === 'every hour' || lower === 'hourly' || lower === 'every hour on the hour') {
      const cronExpr = '0 * * * *';
      return { cronExpr, nextRun: this.getNextRunTime(cronExpr), description: 'Every hour' };
    }

    // "every X minutes"
    const minMatch = lower.match(/every\s+(\d+)\s+minutes?/);
    if (minMatch) {
      const mins = parseInt(minMatch[1]);
      if (mins >= 5 && mins <= 59) {
        const cronExpr = `*/${mins} * * * *`;
        return { cronExpr, nextRun: this.getNextRunTime(cronExpr), description: `Every ${mins} minutes` };
      }
    }

    // "every weekday at 9am"
    const weekdayMatch = lower.match(/every\s+weekday\s+at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
    if (weekdayMatch) {
      let hour = parseInt(weekdayMatch[1]);
      const min = weekdayMatch[2] ? parseInt(weekdayMatch[2]) : 0;
      const ampm = weekdayMatch[3];
      if (ampm === 'pm' && hour < 12) hour += 12;
      const cronExpr = `${min} ${hour} * * 1-5`;
      return { cronExpr, nextRun: this.getNextRunTime(cronExpr), description: `Weekdays at ${hour}:${min.toString().padStart(2,'0')}` };
    }

    // "every Monday at 3pm"
    const dayMatch = lower.match(/every\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\s+at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
    if (dayMatch) {
      const days: Record<string, number> = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
      const day = days[dayMatch[1]] ?? 1;
      let hour = parseInt(dayMatch[2]);
      const min = dayMatch[3] ? parseInt(dayMatch[3]) : 0;
      const ampm = dayMatch[4];
      if (ampm === 'pm' && hour < 12) hour += 12;
      const cronExpr = `${min} ${hour} * * ${day}`;
      return { cronExpr, nextRun: this.getNextRunTime(cronExpr), description: `Every ${dayMatch[1]} at ${hour}:${min.toString().padStart(2,'0')}` };
    }

    // "every week on Monday"
    const weekMatch = lower.match(/every\s+week\s+(?:on\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)/);
    if (weekMatch) {
      const days: Record<string, number> = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
      const day = days[weekMatch[1]] ?? 1;
      const cronExpr = `0 9 * * ${day}`;
      return { cronExpr, nextRun: this.getNextRunTime(cronExpr), description: `Every ${weekMatch[1]} at 9:00` };
    }

    // "every month on the 1st"
    const monthMatch = lower.match(/every\s+month\s+(?:on\s+)?the\s+(\d{1,2})(?:st|nd|rd|th)?/);
    if (monthMatch) {
      const day = parseInt(monthMatch[1]);
      const cronExpr = `0 9 ${day} * *`;
      return { cronExpr, nextRun: this.getNextRunTime(cronExpr), description: `Monthly on the ${day}${this.ordinal(day)}` };
    }

    // "twice daily" / "every 12 hours"
    if (lower === 'twice daily' || lower === 'every 12 hours') {
      const cronExpr = '0 9,21 * * *';
      return { cronExpr, nextRun: this.getNextRunTime(cronExpr), description: 'Twice daily (9am, 9pm)' };
    }

    // "three times a day"
    if (lower === 'three times a day' || lower === 'every 8 hours') {
      const cronExpr = '0 8,16,0 * * *';
      return { cronExpr, nextRun: this.getNextRunTime(cronExpr), description: 'Three times daily (8am, 4pm, midnight)' };
    }

    // Default: once daily at 9am
    return { cronExpr: '0 9 * * *', nextRun: this.getNextRunTime('0 9 * * *'), description: 'Daily at 9:00 AM' };
  }

  private ordinal(n: number): string {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return s[(v - 20) % 10] || s[v] || s[0];
  }

  private getNextRunTime(cronExpr: string): number {
    const parts = cronExpr.split(' ');
    if (parts.length !== 5) return Date.now() + 86400000;

    const [min, hour, day, mon, dow] = parts.map(p => p === '*' ? null : parseInt(p));
    const now = new Date();
    
    for (let offset = 0; offset < 525600; offset++) { // max 1 year ahead
      const candidate = new Date(now.getTime() + offset * 60000);
      
      if (dow !== null && candidate.getDay() !== dow) continue;
      if (day !== null && candidate.getDate() !== day) continue;
      if (mon !== null && candidate.getMonth() + 1 !== mon) continue;
      if (hour !== null && candidate.getHours() !== hour) continue;
      if (min !== null && candidate.getMinutes() !== min) continue;
      
      return candidate.getTime();
    }
    
    return Date.now() + 86400000;
  }

  /**
   * Create a cron job from natural language
   */
  createJob(name: string, schedule: string, task: string, taskType: CronJob['taskType'] = 'shell'): CronJob {
    const { cronExpr, nextRun, description } = this.parseNaturalSchedule(schedule);
    const id = `job_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const now = Date.now();

    this.db.prepare(`
      INSERT INTO cron_jobs (id, name, schedule, cron_expr, task, task_type, enabled, next_run, run_count, success_count, failure_count, created_at, last_modified)
      VALUES (?, ?, ?, ?, ?, ?, 1, ?, 0, 0, 0, ?, ?)
    `).run(id, name, schedule, cronExpr, task, taskType, nextRun, now, now);

    return {
      id, name, schedule: description || schedule, cronExpr, task, taskType,
      enabled: true, nextRun, runCount: 0, successCount: 0, failureCount: 0,
      createdAt: now, lastModified: now
    };
  }

  /**
   * List all jobs
   */
  listJobs(enabledOnly: boolean = false): CronJob[] {
    let sql = `SELECT * FROM cron_jobs`;
    if (enabledOnly) sql += ` WHERE enabled = 1`;
    sql += ` ORDER BY next_run ASC`;

    const rows = this.db.prepare(sql).all() as any[];
    return rows.map(this.mapJob);
  }

  private mapJob = (r: any): CronJob => ({
    id: r.id,
    name: r.name,
    schedule: r.schedule,
    cronExpr: r.cron_expr,
    task: r.task,
    taskType: r.task_type,
    enabled: r.enabled === 1,
    lastRun: r.last_run,
    nextRun: r.next_run,
    runCount: r.run_count,
    successCount: r.success_count,
    failureCount: r.failure_count,
    lastError: r.last_error,
    createdAt: r.created_at,
    lastModified: r.last_modified
  });

  /**
   * Enable/disable a job
   */
  setEnabled(jobId: string, enabled: boolean): void {
    this.db.prepare(`UPDATE cron_jobs SET enabled = ?, last_modified = ? WHERE id = ?`)
      .run(enabled ? 1 : 0, Date.now(), jobId);
  }

  /**
   * Delete a job
   */
  deleteJob(jobId: string): void {
    this.db.prepare(`DELETE FROM cron_jobs WHERE id = ?`).run(jobId);
  }

  /**
   * Update job schedule
   */
  updateSchedule(jobId: string, schedule: string): void {
    const { cronExpr, nextRun, description } = this.parseNaturalSchedule(schedule);
    this.db.prepare(`UPDATE cron_jobs SET schedule = ?, cron_expr = ?, next_run = ?, last_modified = ? WHERE id = ?`)
      .run(description || schedule, cronExpr, nextRun, Date.now(), jobId);
  }

  /**
   * Manually trigger a job (run now)
   */
  async runNow(jobId: string): Promise<CronRun> {
    const job = this.db.prepare(`SELECT * FROM cron_jobs WHERE id = ?`).get(jobId) as any;
    if (!job) throw new Error(`Job not found: ${jobId}`);

    return this.executeJob(this.mapJob(job));
  }

  /**
   * Execute a job
   */
  private async executeJob(job: CronJob): Promise<CronRun> {
    const runId = `run_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const startedAt = Date.now();
    
    const run: CronRun = { id: runId, jobId: job.id, startedAt, success: false };
    this.runningJobs.set(job.id, run);

    this.notifyListeners({ type: 'run_start', job, run, timestamp: Date.now() });

    this.db.prepare(`INSERT INTO cron_runs (id, job_id, started_at, success) VALUES (?, ?, ?, 0)`)
      .run(runId, job.id, startedAt);

    try {
      let output = '';

      if (job.taskType === 'shell') {
        output = await this.runShell(job.task);
      } else if (job.taskType === 'agent') {
        output = await this.runAgentTask(job.task);
      } else if (job.taskType === 'skill') {
        output = await this.runSkill(job.task);
      }

      const completedAt = Date.now();
      const duration = completedAt - startedAt;

      this.db.prepare(`
        UPDATE cron_jobs SET last_run = ?, next_run = ?, run_count = run_count + 1, 
          success_count = success_count + 1, last_modified = ? WHERE id = ?
      `).run(startedAt, this.getNextRunTime(job.cronExpr), completedAt, job.id);

      this.db.prepare(`
        UPDATE cron_runs SET completed_at = ?, duration = ?, success = 1, output = ? WHERE id = ?
      `).run(completedAt, duration, String(output || '').slice(0, 10000), runId);

      run.success = true;
      run.completedAt = completedAt;
      run.duration = duration;
      run.output = output;

      this.notifyListeners({ type: 'run_complete', job, run, success: true, timestamp: Date.now() });
    } catch (err: any) {
      const completedAt = Date.now();
      const duration = completedAt - startedAt;
      const error = err.message || String(err);

      this.db.prepare(`
        UPDATE cron_jobs SET last_run = ?, run_count = run_count + 1,
          failure_count = failure_count + 1, last_error = ?, last_modified = ? WHERE id = ?
      `).run(startedAt, String(error || '').slice(0, 500), completedAt, job.id);

      this.db.prepare(`
        UPDATE cron_runs SET completed_at = ?, duration = ?, success = 0, error = ? WHERE id = ?
      `).run(completedAt, duration, String(error || '').slice(0, 500), runId);

      run.completedAt = completedAt;
      run.duration = duration;
      run.error = error;

      this.notifyListeners({ type: 'run_complete', job, run, success: false, error: String(error), timestamp: Date.now() });
    }

    this.runningJobs.delete(job.id);
    return run;
  }

  private runShell(command: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const child: any = spawn(command, [], { 
        shell: true, 
        timeout: 300000,
      });
      
      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data: Buffer) => { stdout += data.toString(); });
      child.stderr?.on('data', (data: Buffer) => { stderr += data.toString(); });

      child.on('close', (code: any) => {
        if (code === 0) {
          resolve(stdout || 'Command completed');
        } else {
          reject(new Error(stderr || `Exit code: ${code}`));
        }
      });

      child.on('error', reject);
    });
  }

  private async runAgentTask(task: string): Promise<string> {
    // In production, would call the agent API
    return `[Agent task] ${task} — (would execute via agent API)`;
  }

  private async runSkill(skill: string): Promise<string> {
    // In production, would call skill runner
    return `[Skill] ${skill} — (would execute via skill runner)`;
  }

  // ─── Scheduler Loop ────────────────────────────────────────

  private startScheduler(): void {
    // Check every minute
    this.intervalId = setInterval(() => this.checkJobs(), 60000);
    // Also check immediately
    this.checkJobs();
  }

  private checkJobs(): void {
    const now = Date.now();
    const jobs = this.listJobs(true);

    for (const job of jobs) {
      if (job.nextRun && job.nextRun <= now) {
        // Job is due
        this.executeJob(job).catch(() => {});
      }
    }
  }

  stopScheduler(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
  }

  // ─── Event Listeners ───────────────────────────────────────

  onEvent(cb: (event: CronEvent) => void): void {
    this._cron_listeners.push(cb);
  }

  private notifyListeners(event: CronEvent): void {
    for (const cb of this._cron_listeners) {
      try { cb(event); } catch {}
    }
  }

  // ─── History ────────────────────────────────────────────────

  getRunHistory(jobId: string, limit: number = 20): CronRun[] {
    const rows = this.db.prepare(`
      SELECT * FROM cron_runs WHERE job_id = ? ORDER BY started_at DESC LIMIT ?
    `).all(jobId, limit) as any[];

    return rows.map(r => ({
      id: r.id,
      jobId: r.job_id,
      startedAt: r.started_at,
      completedAt: r.completed_at,
      duration: r.duration,
      success: r.success === 1,
      output: r.output,
      error: r.error
    }));
  }

  isRunning(jobId: string): boolean {
    return this.runningJobs.has(jobId);
  }

  stats(): { totalJobs: number; enabledJobs: number; runningJobs: number; totalRuns: number; successRate: number } {
    const jobs = this.listJobs();
    const runs = (this.db.prepare(`SELECT COUNT(*) as c, SUM(success) as s FROM cron_runs`).get() as any) || {};
    const totalRuns = Number(runs.c) || 0;
    const successSum = Number(runs.s) || 0;
    return {
      totalJobs: jobs.length,
      enabledJobs: jobs.filter(j => j.enabled).length,
      runningJobs: this.runningJobs.size,
      totalRuns,
      successRate: totalRuns > 0 ? Math.round(successSum / totalRuns * 100) / 100 : 0
    };
  }

  close(): void {
    this.stopScheduler();
    try { if (this.db.open) this.db.close(); } catch {}
  }
}

// ─── Event Types ──────────────────────────────────────────────

export type CronEventType = 'run_start' | 'run_complete' | 'job_added' | 'job_removed' | 'job_enabled' | 'job_disabled';

export interface CronEvent {
  type: CronEventType;
  job?: CronJob;
  run?: CronRun;
  success?: boolean;
  error?: string;
  timestamp?: number;
}

export default CronScheduler;
