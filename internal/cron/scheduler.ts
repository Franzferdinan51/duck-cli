/**
 * Duck CLI - Cron Scheduler
 * 
 * Based on Hermes Agent's cron system:
 * - Natural language schedule parsing
 * - Persistent job storage
 * - Platform delivery (Telegram, Discord, etc.)
 */

export interface CronJob {
  id: string;
  name: string;
  schedule: string;
  prompt: string;
  enabled: boolean;
  lastRun?: number;
  nextRun?: number;
  platform?: string;
  chatId?: string;
  repeat?: {
    times?: number;
    interval?: number;
  };
}

export interface CronResult {
  success: boolean;
  output?: string;
  error?: string;
  duration: number;
}

// Parse natural language to cron schedule
const SCHEDULE_PATTERNS = [
  // Daily
  { pattern: /every\s+day\s+at\s+(\d{1,2}):?(\d{2})?\s*(am|pm)?/i, cron: (h: number, m: number) => `${m} ${h} * * *` },
  { pattern: /daily\s+at\s+(\d{1,2}):?(\d{2})?\s*(am|pm)?/i, cron: (h: number, m: number) => `${m} ${h} * * *` },
  { pattern: /every\s+(\d+)\s+hours?/i, cron: (h: number) => `0 */${h} * * *` },
  { pattern: /hourly/i, cron: () => '0 * * * *' },
  
  // Weekly
  { pattern: /every\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+at\s+(\d{1,2}):?(\d{2})?/i, cron: (day: number, h: number, m: number) => `${m} ${h} * * ${day}` },
  { pattern: /weekly\s+on\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i, cron: (day: number) => `0 9 * * ${day}` },
  
  // Monthly
  { pattern: /monthly\s+on\s+the\s+(\d{1,2})(st|nd|rd|th)?/i, cron: (d: number) => `0 9 ${d} * *` },
  { pattern: /every\s+(\d+)\s+minutes?/i, cron: (m: number) => `*/${m} * * * *` },
];

const DAY_MAP: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
  thursday: 4, friday: 5, saturday: 6
};

export class CronScheduler {
  private jobs = new Map<string, CronJob>();
  private intervals = new Map<string, NodeJS.Timeout>();

  async create(name: string, schedule: string, prompt: string, options?: {
    platform?: string;
    chatId?: string;
    repeat?: CronJob['repeat'];
  }): Promise<CronJob> {
    const id = `cron_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const parsed = this.parseSchedule(schedule);

    if (!parsed) {
      throw new Error(`Invalid schedule: ${schedule}`);
    }

    const job: CronJob = {
      id,
      name,
      schedule: parsed,
      prompt,
      enabled: true,
      platform: options?.platform,
      chatId: options?.chatId,
      repeat: options?.repeat
    };

    this.jobs.set(id, job);
    this.scheduleJob(job);

    return job;
  }

  list(): CronJob[] {
    return Array.from(this.jobs.values());
  }

  async trigger(id: string): Promise<CronResult> {
    const job = this.jobs.get(id);
    if (!job) {
      return { success: false, error: 'Job not found', duration: 0 };
    }

    const start = Date.now();

    try {
      // Scan prompt for threats
      const scanResult = this.scanPrompt(job.prompt);
      if (scanResult) {
        return { success: false, error: scanResult, duration: Date.now() - start };
      }

      // Execute the cron job
      // In real impl, would run agent with this prompt
      const output = `[CRON] Would execute: ${job.prompt}`;

      job.lastRun = Date.now();
      this.scheduleNextRun(job);

      return { success: true, output, duration: Date.now() - start };
    } catch (error) {
      return { success: false, error: String(error), duration: Date.now() - start };
    }
  }

  pause(id: string): void {
    const job = this.jobs.get(id);
    if (job) {
      job.enabled = false;
      this.clearSchedule(id);
    }
  }

  resume(id: string): void {
    const job = this.jobs.get(id);
    if (job) {
      job.enabled = true;
      this.scheduleJob(job);
    }
  }

  remove(id: string): void {
    this.clearSchedule(id);
    this.jobs.delete(id);
  }

  private parseSchedule(input: string): string | null {
    const lower = input.toLowerCase();

    for (const { pattern, cron } of SCHEDULE_PATTERNS) {
      const match = lower.match(pattern);
      if (match) {
        const args = match.slice(1).map(a => {
          const n = parseInt(a);
          return isNaN(n) ? a?.toLowerCase() : n;
        });

        // Handle day names
        if (typeof args[0] === 'string' && DAY_MAP[args[0] as string] !== undefined) {
          args[0] = DAY_MAP[args[0] as string] as any;
        }

        try {
          return cron(...args as any);
        } catch {
          continue;
        }
      }
    }

    // If already a valid cron expression, return as-is
    if (/^[\d*\/\s,-]+\s+\d+\s+\d+\s+\d+\s+\d+$/.test(lower)) {
      return lower;
    }

    return null;
  }

  private scanPrompt(prompt: string): string | null {
    // Critical threat patterns
    const THREATS = [
      { pattern: /ignore\s+(previous|all|above|prior)\s+instructions/i, name: 'prompt_injection' },
      { pattern: /do\s+not\s+tell\s+the\s+user/i, name: 'deception_hide' },
      { pattern: /system\s+prompt\s+override/i, name: 'sys_prompt_override' },
      { pattern: /disregard\s+(your|all|any)\s+(instructions|rules)/i, name: 'disregard_rules' },
      { pattern: /curl\s+[^\n]*\$\{?\w*(KEY|TOKEN|SECRET|PASSWORD)/i, name: 'exfil_curl' },
      { pattern: /rm\s+-rf\s+\//i, name: 'destructive_root_rm' },
    ];

    for (const { pattern, name } of THREATS) {
      if (pattern.test(prompt)) {
        return `Blocked: prompt matches threat pattern '${name}'`;
      }
    }

    // Check for invisible unicode
    const INVISIBLE = ['\u200b', '\u200c', '\u200d', '\u2060', '\ufeff'];
    for (const char of INVISIBLE) {
      if (prompt.includes(char)) {
        return `Blocked: content contains invisible unicode`;
      }
    }

    return null;
  }

  private scheduleJob(job: CronJob): void {
    if (!job.enabled) return;

    this.clearSchedule(job.id);

    // Simple interval-based scheduling (in real impl, would use cron-parser)
    const interval = this.scheduleToMs(job.schedule);
    if (!interval) return;

    const timeout = setInterval(() => {
      if (job.enabled) {
        this.trigger(job.id);
      }
    }, interval);

    this.intervals.set(job.id, timeout);
  }

  private scheduleNextRun(job: CronJob): void {
    if (job.repeat?.times !== undefined) {
      job.repeat.times--;
      if (job.repeat.times <= 0) {
        this.remove(job.id);
        return;
      }
    }
    this.scheduleJob(job);
  }

  private clearSchedule(id: string): void {
    const interval = this.intervals.get(id);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(id);
    }
  }

  private scheduleToMs(cron: string): number | null {
    // Simple mapping for basic patterns
    const parts = cron.trim().split(/\s+/);
    if (parts.length < 5) return null;

    const [min, hour] = parts.map(Number);

    if (parts[2] === '*' && parts[3] === '*' && parts[4] === '*') {
      // Daily
      const now = new Date();
      const next = new Date();
      next.setHours(hour, min, 0, 0);
      if (next <= now) next.setDate(next.getDate() + 1);
      return next.getTime() - now.getTime();
    }

    return 60 * 60 * 1000; // Default 1 hour
  }
}
