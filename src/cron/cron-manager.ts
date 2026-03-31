/**
 * 🦆 Duck Agent - Cron Job Manager
 * Full cron management system based on OpenClaw
 */

import { execSync, exec } from 'child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';

export interface CronJob {
  id: string;
  name: string;
  description: string;
  schedule: string;
  scheduleHuman: string;
  script: string;
  enabled: boolean;
  category: string;
  logFile: string;
}

export interface CronManagerOptions {
  scriptsDir: string;
  logDir: string;
}

// Predefined cron jobs from OpenClaw
export const CRON_JOBS: Omit<CronJob, 'enabled'>[] = [
  // System Health
  {
    id: 'sys-health-check',
    name: 'System Health Check',
    description: 'Check services, CPU, RAM, disk, auto-heal',
    schedule: '0 * * * *',
    scheduleHuman: 'Every hour',
    script: 'sys-health-check.sh',
    category: 'system',
    logFile: 'sys-health.log',
  },
  {
    id: 'sys-memory-check',
    name: 'Memory Check',
    description: 'Monitor RAM usage and cleanup if low',
    schedule: '0 * * * *',
    scheduleHuman: 'Every hour',
    script: 'sys-memory-check.sh',
    category: 'system',
    logFile: 'sys-memory.log',
  },
  {
    id: 'sys-auto-heal',
    name: 'Auto Heal',
    description: 'Auto-restart failed services (3 retries)',
    schedule: '0 * * * *',
    scheduleHuman: 'Every hour',
    script: 'sys-auto-heal.sh',
    category: 'system',
    logFile: 'sys-auto-heal.log',
  },
  {
    id: 'sys-backup',
    name: 'System Backup',
    description: 'Backup brain files and state',
    schedule: '0 */2 * * *',
    scheduleHuman: 'Every 2 hours',
    script: 'sys-backup.sh',
    category: 'system',
    logFile: 'sys-backup.log',
  },
  {
    id: 'code-failure-recover',
    name: 'Failure Recovery',
    description: 'Recover from cron/service failures',
    schedule: '0 * * * *',
    scheduleHuman: 'Every hour',
    script: 'code-failure-recover.sh',
    category: 'system',
    logFile: 'failure-recover.log',
  },
  
  // Grow Automation
  {
    id: 'grow-morning-check',
    name: 'Morning Grow Check',
    description: 'Morning plant monitoring, photo, CannaAI',
    schedule: '0 9 * * *',
    scheduleHuman: '9:00 AM daily',
    script: 'grow-morning-check.sh',
    category: 'grow',
    logFile: 'grow-cron.log',
  },
  {
    id: 'grow-evening-check',
    name: 'Evening Grow Check',
    description: 'Evening plant monitoring',
    schedule: '0 21 * * *',
    scheduleHuman: '9:00 PM daily',
    script: 'grow-evening-check.sh',
    category: 'grow',
    logFile: 'grow-cron.log',
  },
  {
    id: 'grow-threshold-alert',
    name: 'Grow Threshold Alert',
    description: 'Monitor VPD, temp, humidity thresholds',
    schedule: '0 * * * *',
    scheduleHuman: 'Every hour',
    script: 'grow-threshold-alert.sh',
    category: 'grow',
    logFile: 'grow-cron.log',
  },
  {
    id: 'grow-watering-tracker',
    name: 'Watering Tracker',
    description: 'Track reservoir levels',
    schedule: '0 7 * * *',
    scheduleHuman: '7:00 AM daily',
    script: 'grow-watering-tracker.sh',
    category: 'grow',
    logFile: 'grow-cron.log',
  },
  {
    id: 'grow-harvest-countdown',
    name: 'Harvest Countdown',
    description: 'Calculate days to harvest',
    schedule: '0 9 * * 0',
    scheduleHuman: 'Sunday 9 AM',
    script: 'grow-harvest-countdown.sh',
    category: 'grow',
    logFile: 'grow-cron.log',
  },
  {
    id: 'grow-monthly-report',
    name: 'Monthly Grow Report',
    description: 'Compile monthly grow statistics',
    schedule: '0 8 1 * *',
    scheduleHuman: '1st of month 8 AM',
    script: 'grow-monthly-report.sh',
    category: 'grow',
    logFile: 'grow-cron.log',
  },
  
  // Crypto
  {
    id: 'crypto-portfolio',
    name: 'Portfolio Snapshot',
    description: 'Daily portfolio balance and P&L',
    schedule: '0 9 * * *',
    scheduleHuman: '9:00 AM daily',
    script: 'crypto-portfolio.sh',
    category: 'crypto',
    logFile: 'crypto-cron.log',
  },
  {
    id: 'crypto-price-alert',
    name: 'Price Alert',
    description: 'Monitor price movements (>5% change)',
    schedule: '0 * * * *',
    scheduleHuman: 'Every hour',
    script: 'crypto-price-alert.sh',
    category: 'crypto',
    logFile: 'crypto-cron.log',
  },
  {
    id: 'crypto-whale-watch',
    name: 'Whale Watch',
    description: 'Monitor large wallet movements',
    schedule: '0 * * * *',
    scheduleHuman: 'Every hour',
    script: 'crypto-whale-watch.sh',
    category: 'crypto',
    logFile: 'crypto-cron.log',
  },
  {
    id: 'crypto-defi-health',
    name: 'DeFi Health',
    description: 'Monitor TVL, APY, governance',
    schedule: '0 */6 * * *',
    scheduleHuman: 'Every 6 hours',
    script: 'crypto-defi-health.sh',
    category: 'crypto',
    logFile: 'crypto-cron.log',
  },
  {
    id: 'crypto-news-scan',
    name: 'Crypto News Scan',
    description: 'Scan for regulatory news, ETF filings',
    schedule: '0 8,18 * * *',
    scheduleHuman: '8 AM and 6 PM',
    script: 'crypto-news-scan.sh',
    category: 'crypto',
    logFile: 'crypto-cron.log',
  },
  
  // OSINT
  {
    id: 'osint-briefing',
    name: 'OSINT Briefing',
    description: 'Daily intelligence briefing',
    schedule: '0 9 * * *',
    scheduleHuman: '9:00 AM daily',
    script: 'osint-briefing.sh',
    category: 'osint',
    logFile: 'osint-cron.log',
  },
  {
    id: 'osint-keyword-alert',
    name: 'Keyword Alert',
    description: 'Monitor tracked keywords on social media',
    schedule: '0 * * * *',
    scheduleHuman: 'Every hour',
    script: 'osint-keyword-alert.sh',
    category: 'osint',
    logFile: 'osint-cron.log',
  },
  {
    id: 'osint-account-watch',
    name: 'Account Watch',
    description: 'Monitor tracked accounts',
    schedule: '0 * * * *',
    scheduleHuman: 'Every hour',
    script: 'osint-account-watch.sh',
    category: 'osint',
    logFile: 'osint-cron.log',
  },
  {
    id: 'osint-github-watch',
    name: 'GitHub Watch',
    description: 'Monitor starred repos',
    schedule: '0 */2 * * *',
    scheduleHuman: 'Every 2 hours',
    script: 'osint-github-watch.sh',
    category: 'osint',
    logFile: 'osint-cron.log',
  },
  {
    id: 'osint-reddit-digest',
    name: 'Reddit Digest',
    description: 'Track subreddits (r/microgrowery, etc.)',
    schedule: '0 9,18 * * *',
    scheduleHuman: '9 AM and 6 PM',
    script: 'osint-reddit-digest.sh',
    category: 'osint',
    logFile: 'osint-cron.log',
  },
  
  // News
  {
    id: 'news-daily-brief',
    name: 'Daily News Brief',
    description: 'Personalized news from RSS feeds',
    schedule: '0 8 * * *',
    scheduleHuman: '8:00 AM daily',
    script: 'news-daily-brief.sh',
    category: 'news',
    logFile: 'news-cron.log',
  },
  
  // Weather
  {
    id: 'weather-daily',
    name: 'Daily Weather',
    description: '5-day forecast, severe alerts',
    schedule: '0 7 * * *',
    scheduleHuman: '7:00 AM daily',
    script: 'weather-daily.sh',
    category: 'weather',
    logFile: 'weather-cron.log',
  },
  
  // Home
  {
    id: 'home-equipment-monitor',
    name: 'Equipment Monitor',
    description: 'Track grow equipment runtime',
    schedule: '0 8 * * *',
    scheduleHuman: '8:00 AM daily',
    script: 'home-equipment-monitor.sh',
    category: 'home',
    logFile: 'home-cron.log',
  },
];

export class CronManager {
  private scriptsDir: string;
  private logDir: string;
  private enabledJobs: Set<string>;
  
  constructor(options?: Partial<CronManagerOptions>) {
    const home = process.env.HOME || '/tmp';
    this.scriptsDir = options?.scriptsDir || join(home, '.duckagent', 'autonomous');
    this.logDir = options?.logDir || join(home, '.duckagent', 'logs');
    this.enabledJobs = new Set();
    
    // Ensure directories exist
    mkdirSync(this.scriptsDir, { recursive: true });
    mkdirSync(this.logDir, { recursive: true });
    
    // Load enabled jobs from config
    this.loadEnabledJobs();
  }
  
  private getConfigPath(): string {
    const home = process.env.HOME || '/tmp';
    return join(home, '.duckagent', 'cron-config.json');
  }
  
  private loadEnabledJobs(): void {
    const configPath = this.getConfigPath();
    if (existsSync(configPath)) {
      try {
        const config = JSON.parse(readFileSync(configPath, 'utf-8'));
        if (config.enabledJobs) {
          this.enabledJobs = new Set(config.enabledJobs);
        }
      } catch {
        // Use defaults
      }
    } else {
      // Enable all by default
      CRON_JOBS.forEach(job => this.enabledJobs.add(job.id));
      this.saveEnabledJobs();
    }
  }
  
  private saveEnabledJobs(): void {
    const configPath = this.getConfigPath();
    const home = process.env.HOME || '/tmp';
    mkdirSync(join(home, '.duckagent'), { recursive: true });
    writeFileSync(configPath, JSON.stringify({
      enabledJobs: Array.from(this.enabledJobs),
      updatedAt: new Date().toISOString(),
    }, null, 2));
  }
  
  /**
   * List all available cron jobs
   */
  listJobs(enabledOnly = false): CronJob[] {
    return CRON_JOBS.map(job => ({
      ...job,
      enabled: this.enabledJobs.has(job.id),
    })).filter(job => !enabledOnly || job.enabled);
  }
  
  /**
   * List jobs by category
   */
  listByCategory(category: string): CronJob[] {
    return this.listJobs().filter(job => job.category === category);
  }
  
  /**
   * Get available categories
   */
  getCategories(): { id: string; name: string; count: number }[] {
    const categories = new Map<string, number>();
    for (const job of CRON_JOBS) {
      categories.set(job.category, (categories.get(job.category) || 0) + 1);
    }
    
    const categoryNames: Record<string, string> = {
      system: 'System Health',
      grow: 'Grow Automation',
      crypto: 'Crypto',
      osint: 'OSINT',
      news: 'News',
      weather: 'Weather',
      home: 'Home',
    };
    
    return Array.from(categories.entries()).map(([id, count]) => ({
      id,
      name: categoryNames[id] || id,
      count,
    }));
  }
  
  /**
   * Enable a cron job
   */
  enable(jobId: string): boolean {
    if (!CRON_JOBS.find(j => j.id === jobId)) {
      return false;
    }
    this.enabledJobs.add(jobId);
    this.saveEnabledJobs();
    return true;
  }
  
  /**
   * Disable a cron job
   */
  disable(jobId: string): boolean {
    this.enabledJobs.delete(jobId);
    this.saveEnabledJobs();
    return true;
  }
  
  /**
   * Enable all jobs in a category
   */
  enableCategory(category: string): number {
    let count = 0;
    for (const job of CRON_JOBS) {
      if (job.category === category) {
        this.enabledJobs.add(job.id);
        count++;
      }
    }
    if (count > 0) this.saveEnabledJobs();
    return count;
  }
  
  /**
   * Disable all jobs in a category
   */
  disableCategory(category: string): number {
    let count = 0;
    for (const job of CRON_JOBS) {
      if (job.category === category) {
        this.enabledJobs.delete(job.id);
        count++;
      }
    }
    if (count > 0) this.saveEnabledJobs();
    return count;
  }
  
  /**
   * Generate crontab for enabled jobs
   */
  generateCrontab(): string {
    const header = `# =============================================================================
# Duck Agent Cron Schedule
# Generated: ${new Date().toISOString()}
# =============================================================================
SHELL=/bin/bash
PATH=/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin
MAILTO=""
`;
    
    const jobs = this.listJobs().map(job => {
      const scriptPath = join(this.scriptsDir, job.script);
      const logPath = join(this.logDir, job.logFile);
      return `${job.schedule} ${scriptPath} >> ${logPath} 2>&1`;
    }).join('\n');
    
    return header + '\n' + jobs + '\n';
  }
  
  /**
   * Install crontab
   */
  install(): { success: boolean; message: string } {
    try {
      // Backup existing
      try {
        execSync('crontab -l > /tmp/crontab.backup 2>/dev/null || true');
      } catch {
        // No existing crontab
      }
      
      // Install new
      const cron = this.generateCrontab();
      execSync(`echo '${cron.replace(/'/g, "'\"'\"'")}' | crontab -`, { stdio: 'pipe' });
      
      return { success: true, message: 'Crontab installed successfully' };
    } catch (e: any) {
      return { success: false, message: `Failed: ${e.message}` };
    }
  }
  
  /**
   * Show current crontab
   */
  showCrontab(): string {
    try {
      return execSync('crontab -l 2>/dev/null || echo "No crontab installed"').toString();
    } catch {
      return 'No crontab installed';
    }
  }
  
  /**
   * Verify all scripts exist
   */
  verifyScripts(): { exists: string[]; missing: string[] } {
    const exists: string[] = [];
    const missing: string[] = [];
    
    for (const job of CRON_JOBS) {
      const scriptPath = join(this.scriptsDir, job.script);
      if (existsSync(scriptPath)) {
        exists.push(job.id);
      } else {
        missing.push(job.id);
      }
    }
    
    return { exists, missing };
  }
  
  /**
   * Run a specific job manually
   */
  runJob(jobId: string): Promise<{ success: boolean; output: string; error?: string }> {
    return new Promise((resolve) => {
      const job = CRON_JOBS.find(j => j.id === jobId);
      if (!job) {
        resolve({ success: false, output: '', error: 'Job not found' });
        return;
      }
      
      const scriptPath = join(this.scriptsDir, job.script);
      if (!existsSync(scriptPath)) {
        resolve({ success: false, output: '', error: `Script not found: ${scriptPath}` });
        return;
      }
      
      const startTime = Date.now();
      exec(scriptPath, { timeout: 300000 }, (error, stdout, stderr) => {
        const duration = Date.now() - startTime;
        resolve({
          success: !error,
          output: stdout || `Completed in ${duration}ms`,
          error: stderr || undefined,
        });
      });
    });
  }
  
  /**
   * Run all enabled jobs manually
   */
  async runAll(): Promise<{ results: { jobId: string; success: boolean; duration: number }[] }> {
    const results: { jobId: string; success: boolean; duration: number }[] = [];
    
    for (const job of this.listJobs()) {
      const startTime = Date.now();
      const result = await this.runJob(job.id);
      results.push({
        jobId: job.id,
        success: result.success,
        duration: Date.now() - startTime,
      });
    }
    
    return { results };
  }
  
  /**
   * Create a custom cron job
   */
  createCustomJob(
    id: string,
    name: string,
    description: string,
    schedule: string,
    scriptContent: string
  ): { success: boolean; message: string } {
    // Validate schedule
    if (!this.validateSchedule(schedule)) {
      return { success: false, message: 'Invalid cron schedule' };
    }
    
    // Write script
    const scriptPath = join(this.scriptsDir, `${id}.sh`);
    try {
      writeFileSync(scriptPath, `#!/bin/bash\n${scriptContent}`);
      execSync(`chmod +x "${scriptPath}"`);
      
      // Add to jobs list
      CRON_JOBS.push({
        id,
        name,
        description,
        schedule,
        scheduleHuman: this.scheduleToHuman(schedule),
        script: `${id}.sh`,
        category: 'custom',
        logFile: `${id}.log`,
      });
      
      return { success: true, message: `Created: ${scriptPath}` };
    } catch (e: any) {
      return { success: false, message: `Failed: ${e.message}` };
    }
  }
  
  /**
   * Delete a custom cron job
   */
  deleteCustomJob(jobId: string): { success: boolean; message: string } {
    const jobIndex = CRON_JOBS.findIndex(j => j.id === jobId && j.category === 'custom');
    if (jobIndex === -1) {
      return { success: false, message: 'Not found or not a custom job' };
    }
    
    const scriptPath = join(this.scriptsDir, CRON_JOBS[jobIndex].script);
    try {
      if (existsSync(scriptPath)) {
        execSync(`rm "${scriptPath}"`);
      }
      CRON_JOBS.splice(jobIndex, 1);
      this.enabledJobs.delete(jobId);
      this.saveEnabledJobs();
      
      return { success: true, message: 'Deleted custom job' };
    } catch (e: any) {
      return { success: false, message: `Failed: ${e.message}` };
    }
  }
  
  /**
   * Get job status
   */
  getJobStatus(jobId: string): { job: CronJob | null; running: boolean; lastRun?: string; lastLog?: string } {
    const job = this.listJobs().find(j => j.id === jobId);
    if (!job) {
      return { job: null, running: false };
    }
    
    const logPath = join(this.logDir, job.logFile);
    let lastLog: string | undefined;
    
    if (existsSync(logPath)) {
      const content = readFileSync(logPath, 'utf-8');
      const lines = content.split('\n').filter(l => l.trim());
      lastLog = lines[lines.length - 1];
    }
    
    return {
      job,
      running: false,
      lastRun: lastLog ? lastLog.split(']')[0]?.replace('[', '') : undefined,
      lastLog,
    };
  }
  
  // Helper methods
  
  private validateSchedule(schedule: string): boolean {
    const parts = schedule.trim().split(/\s+/);
    if (parts.length < 5) return false;
    
    // Basic validation - could be more thorough
    const cronPart = (part: string, max: number) => {
      if (part === '*') return true;
      if (part.includes('/')) {
        const [base, step] = part.split('/');
        return base === '*' || (parseInt(base) <= max && parseInt(step) > 0);
      }
      if (part.includes(',')) {
        return part.split(',').every(p => this.validateSchedule(p.trim()));
      }
      if (part.includes('-')) {
        const [start, end] = part.split('-').map(Number);
        return !isNaN(start) && !isNaN(end) && start <= end;
      }
      const num = parseInt(part);
      return !isNaN(num) && num >= 0 && num <= max;
    };
    
    return (
      cronPart(parts[0], 59) &&   // minute
      cronPart(parts[1], 23) &&   // hour
      cronPart(parts[2], 31) &&   // day of month
      cronPart(parts[3], 12) &&   // month
      cronPart(parts[4], 7)       // day of week
    );
  }
  
  private scheduleToHuman(schedule: string): string {
    const parts = schedule.trim().split(/\s+/);
    if (parts.length < 5) return schedule;
    
    const [min, hour, dom, mon, dow] = parts;
    
    if (min === '*' && hour === '*') return 'Every minute';
    if (min === '0' && hour === '*') return 'Every hour';
    if (dom === '*' && mon === '*' && dow === '*') {
      if (hour !== '*' && min !== '*') {
        return `${hour}:${min.padStart(2, '0')} daily`;
      }
    }
    if (dow !== '*') {
      return `Weekly (${dow}) at ${hour}:${min}`;
    }
    
    return schedule;
  }
}

export default CronManager;
