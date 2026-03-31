#!/usr/bin/env node
/**
 * 🦆 Duck Agent - Cron Scheduler
 * Installs and manages autonomous task cron jobs
 * 
 * Usage:
 *   duck cron install    - Install all cron jobs
 *   duck cron show      - Show current crontab
 *   duck cron verify    - Verify all scripts exist
 *   duck cron run-all   - Run all tasks manually
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const AUTONOMOUS_DIR = join(__dirname);
const LOG_DIR = '/tmp';

// ANSI colors
const colors = {
  red: '\x1b[0;31m',
  green: '\x1b[0;32m',
  yellow: '\x1b[1;33m',
  blue: '\x1b[0;34m',
  nc: '\x1b[0m',
};

const print = {
  header: (msg: string) => console.log(`\n${colors.blue}==== ${msg} ====${colors.nc}`),
  ok: (msg: string) => console.log(`${colors.green}✓ ${msg}${colors.nc}`),
  warn: (msg: string) => console.log(`${colors.yellow}⚠ ${msg}${colors.nc}`),
  err: (msg: string) => console.log(`${colors.red}✗ ${msg}${colors.nc}`),
};

// ============ Verify Scripts ============
function verifyScripts() {
  print.header('Verifying Scripts');
  let missing = 0;
  
  const scripts = [
    'grow-morning-check.sh',
    'grow-evening-check.sh',
    'grow-threshold-alert.sh',
    'grow-harvest-countdown.sh',
    'grow-monthly-report.sh',
    'grow-watering-tracker.sh',
    'crypto-portfolio.sh',
    'crypto-price-alert.sh',
    'crypto-whale-watch.sh',
    'crypto-defi-health.sh',
    'osint-briefing.sh',
    'osint-keyword-alert.sh',
    'osint-account-watch.sh',
    'osint-github-watch.sh',
    'osint-reddit-digest.sh',
    'news-daily-brief.sh',
    'weather-daily.sh',
    'sys-health-check.sh',
    'sys-auto-heal.sh',
    'sys-backup.sh',
    'sys-memory-check.sh',
    'code-auto-commit.sh',
    'code-failure-recover.sh',
  ];
  
  for (const script of scripts) {
    const path = join(AUTONOMOUS_DIR, script);
    if (existsSync(path)) {
      try {
        execSync(`test -x "${path}"`, { stdio: 'ignore' });
        print.ok(script);
      } catch {
        // Make executable
        try {
          execSync(`chmod +x "${path}"`);
          print.ok(`${script} (made executable)`);
        } catch {
          print.warn(`NOT EXECUTABLE: ${script}`);
          missing++;
        }
      }
    } else {
      print.err(`MISSING: ${script}`);
      missing++;
    }
  }
  
  console.log('');
  if (missing === 0) {
    print.ok('All scripts verified!');
  } else {
    print.warn(`${missing} script(s) missing or not executable`);
  }
}

// ============ Generate Crontab ============
function generateCrontab() {
  return `# =============================================================================
# Duck Agent Master Cron Schedule
# Generated: ${new Date().toISOString()}
# =============================================================================

SHELL=/bin/bash
PATH=/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin
MAILTO=""

# -----------------------------------------------------------------------------
# EVERY HOUR (max polling rate)
# -----------------------------------------------------------------------------
0 * * * * ${AUTONOMOUS_DIR}/sys-health-check.sh >> ${LOG_DIR}/sys-health.log 2>&1
0 * * * * ${AUTONOMOUS_DIR}/sys-memory-check.sh >> ${LOG_DIR}/sys-memory.log 2>&1
0 * * * * ${AUTONOMOUS_DIR}/code-failure-recover.sh >> ${LOG_DIR}/failure-recover.log 2>&1
0 * * * * ${AUTONOMOUS_DIR}/grow-threshold-alert.sh >> ${LOG_DIR}/grow-cron.log 2>&1
0 * * * * ${AUTONOMOUS_DIR}/crypto-price-alert.sh >> ${LOG_DIR}/crypto-cron.log 2>&1
0 * * * * ${AUTONOMOUS_DIR}/crypto-whale-watch.sh >> ${LOG_DIR}/crypto-cron.log 2>&1
0 * * * * ${AUTONOMOUS_DIR}/osint-keyword-alert.sh >> ${LOG_DIR}/osint-cron.log 2>&1
0 * * * * ${AUTONOMOUS_DIR}/osint-account-watch.sh >> ${LOG_DIR}/osint-cron.log 2>&1

# -----------------------------------------------------------------------------
# EVERY 2 HOURS
# -----------------------------------------------------------------------------
0 */2 * * * ${AUTONOMOUS_DIR}/sys-backup.sh >> ${LOG_DIR}/sys-backup.log 2>&1
0 */2 * * * ${AUTONOMOUS_DIR}/code-auto-commit.sh >> ${LOG_DIR}/auto-commit.log 2>&1
0 */2 * * * ${AUTONOMOUS_DIR}/osint-github-watch.sh >> ${LOG_DIR}/osint-cron.log 2>&1

# -----------------------------------------------------------------------------
# EVERY 6 HOURS
# -----------------------------------------------------------------------------
0 */6 * * * ${AUTONOMOUS_DIR}/crypto-defi-health.sh >> ${LOG_DIR}/crypto-cron.log 2>&1

# -----------------------------------------------------------------------------
# DAILY (once per day)
# -----------------------------------------------------------------------------
0 7 * * * ${AUTONOMOUS_DIR}/grow-watering-tracker.sh >> ${LOG_DIR}/grow-cron.log 2>&1
0 7 * * * ${AUTONOMOUS_DIR}/weather-daily.sh >> ${LOG_DIR}/weather-cron.log 2>&1
0 8 * * * ${AUTONOMOUS_DIR}/news-daily-brief.sh >> ${LOG_DIR}/news-cron.log 2>&1
0 8 * * * ${AUTONOMOUS_DIR}/crypto-portfolio.sh >> ${LOG_DIR}/crypto-cron.log 2>&1
0 9 * * * ${AUTONOMOUS_DIR}/osint-briefing.sh >> ${LOG_DIR}/osint-cron.log 2>&1
0 9 * * * ${AUTONOMOUS_DIR}/osint-reddit-digest.sh >> ${LOG_DIR}/osint-cron.log 2>&1
0 9 * * * ${AUTONOMOUS_DIR}/grow-morning-check.sh >> ${LOG_DIR}/grow-cron.log 2>&1
0 21 * * * ${AUTONOMOUS_DIR}/grow-evening-check.sh >> ${LOG_DIR}/grow-cron.log 2>&1

# -----------------------------------------------------------------------------
# WEEKLY (Sunday 9AM)
# -----------------------------------------------------------------------------
0 9 * * 0 ${AUTONOMOUS_DIR}/grow-harvest-countdown.sh >> ${LOG_DIR}/grow-cron.log 2>&1

# -----------------------------------------------------------------------------
# MONTHLY (1st of month 8AM)
# -----------------------------------------------------------------------------
0 8 1 * * ${AUTONOMOUS_DIR}/grow-monthly-report.sh >> ${LOG_DIR}/grow-cron.log 2>&1

# =============================================================================
# End of Duck Agent Master Cron
# =============================================================================
`;
}

// ============ Install Crontab ============
function installCrontab() {
  print.header('Installing Duck Agent Cron Jobs');
  
  try {
    const existing = execSync('crontab -l 2>/dev/null || echo ""', { encoding: 'utf-8' });
    const backup = `/tmp/crontab.backup.${Date.now()}`;
    execSync(`crontab -l > "${backup}" 2>/dev/null || true`);
    print.ok(`Backed up existing crontab to: ${backup}`);
  } catch (e) {
    // No existing crontab
  }
  
  const cron = generateCrontab();
  execSync(`echo '${cron.replace(/'/g, "'\"'\"'")}' | crontab -`);
  print.ok('Crontab installed!');
  showCrontab();
}

// ============ Show Crontab ============
function showCrontab() {
  print.header('Current Crontab');
  try {
    const current = execSync('crontab -l 2>/dev/null || echo "No crontab"', { encoding: 'utf-8' });
    console.log(current);
  } catch {
    console.log('No crontab installed');
  }
}

// ============ Run All ============
function runAll() {
  print.header('Running All Tasks');
  const { execSync: exec } = require('child_process');
  
  const scripts = [
    'sys-health-check.sh',
    'grow-morning-check.sh',
    'crypto-portfolio.sh',
    'osint-briefing.sh',
    'news-daily-brief.sh',
  ];
  
  for (const script of scripts) {
    const path = join(AUTONOMOUS_DIR, script);
    if (existsSync(path)) {
      print.ok(`Running: ${script}`);
      try {
        exec(`"${path}"`, { stdio: 'inherit', timeout: 60000 });
      } catch (e) {
        print.err(`FAILED: ${script}`);
      }
    }
  }
}

// ============ Main ============
const command = process.argv[2] || 'help';

switch (command) {
  case 'verify':
    verifyScripts();
    break;
  case 'install':
    installCrontab();
    break;
  case 'show':
    showCrontab();
    break;
  case 'run-all':
    runAll();
    break;
  default:
    console.log(`
🦆 Duck Agent Cron Scheduler

Usage: duck cron <command>

Commands:
  verify    - Verify all scripts exist and are executable
  install   - Install all cron jobs
  show      - Show current crontab
  run-all   - Run all tasks manually

Examples:
  duck cron verify
  duck cron install
  duck cron show
`);
}
