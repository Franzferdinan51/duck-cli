#!/usr/bin/env npx tsx
/**
 * enhanced-auto-heal.ts - DuckBot Production Auto-Heal System
 * =============================================================================
 * Comprehensive auto-heal with:
 * - Service discovery (gateway, MCP, ACP, WebSocket, unified, web UI, etc.)
 * - Exponential backoff for restart attempts
 * - Nuclear option after 3 failures
 * - Telegram alerts
 * - Timestamped logging
 * - State persistence across runs
 * =============================================================================
 */

import { execSync, exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// =============================================================================
// Configuration
// =============================================================================

const LOG_DIR = '/tmp/auto-heal';
const STATE_FILE = `${LOG_DIR}/state.json`;
const LOG_FILE = `${LOG_DIR}/enhanced-heal.log`;
const LOCK_FILE = `${LOG_DIR}/enhanced-heal.lock`;
const MAX_ATTEMPTS = 3;
const NUCLEAR_ALERT_ID = '647890'; // Critical alerts topic

// Service definitions with health check URLs and restart handlers
interface Service {
  name: string;
  key: string;
  url: string;
  port?: number;
  type: 'http' | 'process' | 'remote';
  check: () => Promise<boolean>;
  heal: () => Promise<boolean>;
  critical: boolean;
}

const SERVICES: Service[] = [
  // duck-cli Core Services (standalone — duck-cli runs without OpenClaw)
  {
    name: 'Duck Gateway API',
    key: 'duck-gateway',
    url: 'http://127.0.0.1:18792',
    port: 18792,
    type: 'process',
    check: async () => checkHttp('http://127.0.0.1:18792'),
    heal: () => healDuckGateway(),
    critical: true,
  },
  {
    name: 'Duck Chat Agent',
    key: 'duck-chat',
    url: 'http://127.0.0.1:18797',
    port: 18797,
    type: 'process',
    check: async () => checkHttp('http://127.0.0.1:18797'),
    heal: () => healDuckChat(),
    critical: false,
  },
  {
    name: 'Duck MCP Server',
    key: 'duck-mcp',
    url: 'http://127.0.0.1:3850',
    port: 3850,
    type: 'process',
    check: async () => checkHttp('http://127.0.0.1:3850'),
    heal: () => healMCP(),
    critical: false,
  },
  // OpenClaw Services (optional — duck-cli does NOT require OpenClaw)
  // These are monitored only when OpenClaw is installed and the bridge is used.
  {
    name: 'OpenClaw Gateway (optional)',
    key: 'gateway',
    url: 'http://127.0.0.1:18789',
    port: 18789,
    type: 'process',
    check: async () => checkHttp('http://127.0.0.1:18789'),
    heal: () => healOpenClawGateway(),
    critical: false,  // OPTIONAL — duck-cli is standalone without OpenClaw
  },
  {
    name: 'OpenClaw MCP (optional)',
    key: 'oc-mcp',
    url: 'http://127.0.0.1:3848',
    port: 3848,
    type: 'process',
    check: async () => checkHttp('http://127.0.0.1:3848'),
    heal: () => healMCP(),
    critical: false,
  },
  {
    name: 'OpenClaw ACP (optional)',
    key: 'oc-acp',
    url: 'http://127.0.0.1:18790',
    port: 18790,
    type: 'process',
    check: async () => checkHttp('http://127.0.0.1:18790'),
    heal: () => healACP(),
    critical: false,
  },
  {
    name: 'OpenClaw WS (optional)',
    key: 'oc-ws',
    url: 'http://127.0.0.1:18791',
    port: 18791,
    type: 'process',
    check: async () => checkHttp('http://127.0.0.1:18791'),
    heal: () => healWebSocket(),
    critical: false,
  },
  // Web UIs
  {
    name: 'CannaAI Web UI',
    key: 'cannai',
    url: 'http://localhost:3000',
    port: 3000,
    type: 'process',
    check: async () => checkHttp('http://localhost:3000'),
    heal: () => healCannaAI(),
    critical: true,
  },
  {
    name: 'AI Council Web UI',
    key: 'ai-council',
    url: 'http://localhost:3001',
    port: 3001,
    type: 'process',
    check: async () => checkHttp('http://localhost:3001'),
    heal: () => healAICouncil(),
    critical: true,
  },
  {
    name: 'Agent Monitor Dashboard',
    key: 'agent-monitor',
    url: 'http://localhost:3001/api/health',
    port: 3001,
    type: 'process',
    check: async () => checkHttp('http://localhost:3001/api/health'),
    heal: () => healAgentMonitor(),
    critical: false,
  },
  // Remote Services
  {
    name: 'LM Studio (Windows PC)',
    key: 'lm-studio',
    url: 'http://100.116.54.125:1234',
    port: 1234,
    type: 'remote',
    check: async () => checkHttp('http://100.116.54.125:1234'),
    heal: () => healLMStudio(),
    critical: false,
  },
];

// =============================================================================
// State Management
// =============================================================================

interface HealState {
  lastCheck: string;
  services: Record<string, {
    attempts: number;
    lastAttempt: string;
    lastSuccess: string;
    consecutiveFailures: number;
    totalRestarts: number;
  }>;
  nuclearMode: boolean;
  nuclearTriggeredAt?: string;
}

function loadState(): HealState {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const raw = fs.readFileSync(STATE_FILE, 'utf-8');
      const data = JSON.parse(raw);

      // Garbage-collect stale service entries (services no longer in SERVICES list)
      const validKeys = new Set(SERVICES.map(s => s.key));
      for (const key of Object.keys(data.services || {})) {
        if (!validKeys.has(key)) {
          log(`GC: Removing stale service state for "${key}"`);
          delete data.services[key];
        }
      }

      // Nuclear mode recovery: if nuclear was triggered >15 min ago, auto-reset
      if (data.nuclearMode && data.nuclearTriggeredAt) {
        const triggeredAt = new Date(data.nuclearTriggeredAt).getTime();
        const ageMs = Date.now() - triggeredAt;
        if (ageMs > 15 * 60 * 1000) {
          log(`NUCLEAR RECOVERY: Auto-resetting nuclear mode after ${Math.round(ageMs / 60000)} min`);
          data.nuclearMode = false;
          data.nuclearTriggeredAt = undefined;
        }
      }

      // Initialize any new services added since last run
      for (const svc of SERVICES) {
        if (!data.services[svc.key]) {
          data.services[svc.key] = {
            attempts: 0,
            lastAttempt: '',
            lastSuccess: '',
            consecutiveFailures: 0,
            totalRestarts: 0,
          };
        }
      }

      return data;
    }
  } catch (e) {
    log(`WARN: Could not load state file: ${e}`);
  }
  return createDefaultState();
}

function createDefaultState(): HealState {
  const state: HealState = {
    lastCheck: new Date().toISOString(),
    services: {},
    nuclearMode: false,
  };
  for (const svc of SERVICES) {
    state.services[svc.key] = {
      attempts: 0,
      lastAttempt: '',
      lastSuccess: '',
      consecutiveFailures: 0,
      totalRestarts: 0,
    };
  }
  return state;
}

function saveState(state: HealState): void {
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch (e) {
    log(`WARN: Could not save state file: ${e}`);
  }
}

// =============================================================================
// Logging
// =============================================================================

function log(msg: string): void {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${msg}`;
  console.log(line);
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    fs.appendFileSync(LOG_FILE, line + '\n');
  } catch (e) {
    console.error(`Failed to write to log: ${e}`);
  }
}

function logSection(title: string): void {
  const sep = '='.repeat(50);
  log(sep);
  log(title);
  log(sep);
}

// =============================================================================
// Lock Management
// =============================================================================

function acquireLock(): boolean {
  try {
    if (fs.existsSync(LOCK_FILE)) {
      const pid = fs.readFileSync(LOCK_FILE, 'utf-8').trim();
      try {
        process.kill(parseInt(pid), 0);
        log(`WARN: Another instance running (PID ${pid}). Exiting.`);
        return false;
      } catch {
        log('WARN: Stale lock found. Removing.');
      }
    }
    fs.writeFileSync(LOCK_FILE, process.pid.toString());
    return true;
  } catch (e) {
    log(`WARN: Could not acquire lock: ${e}`);
    return false;
  }
}

function releaseLock(): void {
  try {
    fs.unlinkSync(LOCK_FILE);
  } catch {}
}

// =============================================================================
// HTTP Health Check
// =============================================================================

/**
 * HTTP health check using native fetch with AbortController timeout.
 * Validates: (1) reachable, (2) HTTP 2xx, (3) response body is non-empty.
 */
async function checkHttp(url: string, timeoutMs = 5000): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal as any,
      redirect: 'follow',
    });

    clearTimeout(timeout);

    // Must be 2xx
    if (response.status < 200 || response.status >= 300) {
      return false;
    }

    // Body must be non-empty (guards against empty-200 ghost services)
    try {
      const text = await response.clone().text();
      return text.trim().length > 0;
    } catch {
      // Could not read body — treat as unhealthy
      return false;
    }
  } catch {
    return false;
  }
}

// =============================================================================
// Telegram Alerts
// =============================================================================

async function sendTelegramAlert(message: string, parseMode = 'HTML'): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    log('WARN: TELEGRAM_BOT_TOKEN not set, skipping alert');
    return;
  }

  const chatId = NUCLEAR_ALERT_ID;
  const encodedMsg = encodeURIComponent(message.replace(/%0A/g, '\n'));
  
  try {
    execSync(
      `curl -s -X POST "https://api.telegram.org/bot${botToken}/sendMessage" ` +
      `-d "chat_id=${chatId}&text=${encodedMsg}&parse_mode=${parseMode}"`,
      { stdio: 'ignore' }
    );
    log(`Telegram alert sent: ${message.substring(0, 100)}...`);
  } catch (e) {
    log(`WARN: Failed to send Telegram alert: ${e}`);
  }
}

// =============================================================================
// Service Heal Functions
// =============================================================================

async function healDuckGateway(): Promise<boolean> {
  log('  -> Attempting to heal Duck Gateway (duck-cli built-in, port 18792)...');
  try {
    // Restart duck-cli's own gateway
    execSync('pkill -f "duck gateway" 2>/dev/null || true', { stdio: 'ignore' });
    await sleep(1000);
    const duckBin = process.env.DUCK_BINARY ||
      (process.env.DUCK_SOURCE_DIR ? `${process.env.DUCK_SOURCE_DIR}/duck` : 'duck');
    execSync(`cd ${process.env.DUCK_SOURCE_DIR || '.'} && nohup ${duckBin} gateway > /tmp/duck-gateway.log 2>&1 &`, { stdio: 'ignore' });
    await sleep(5000);
    return await checkHttp('http://127.0.0.1:18792');
  } catch (e) {
    log(`  -> ERROR: Failed to heal Duck Gateway: ${e}`);
    return false;
  }
}

async function healDuckChat(): Promise<boolean> {
  log('  -> Attempting to heal Duck Chat Agent (port 18797)...');
  try {
    execSync('pkill -f "duck chat-agent" 2>/dev/null || true', { stdio: 'ignore' });
    await sleep(1000);
    const duckBin = process.env.DUCK_BINARY ||
      (process.env.DUCK_SOURCE_DIR ? `${process.env.DUCK_SOURCE_DIR}/duck` : 'duck');
    execSync(`cd ${process.env.DUCK_SOURCE_DIR || '.'} && nohup ${duckBin} chat-agent > /tmp/duck-chat.log 2>&1 &`, { stdio: 'ignore' });
    await sleep(5000);
    return await checkHttp('http://127.0.0.1:18797');
  } catch (e) {
    log(`  -> ERROR: Failed to heal Duck Chat Agent: ${e}`);
    return false;
  }
}

async function healOpenClawGateway(): Promise<boolean> {
  log('  -> Attempting to heal OpenClaw Gateway...');
  try {
    execSync('openclaw gateway restart', { stdio: 'ignore' });
    await sleep(5000);
    return await checkHttp('http://127.0.0.1:18789');
  } catch (e) {
    log(`  -> ERROR: Failed to heal gateway: ${e}`);
    return false;
  }
}

async function healMCP(): Promise<boolean> {
  log('  -> Attempting to heal Duck MCP Server (port 3850)...');
  try {
    // Kill existing
    execSync('pkill -f "duck mcp" 2>/dev/null || true', { stdio: 'ignore' });
    await sleep(1000);
    // Restart duck-cli's MCP server
    const duckBin = process.env.DUCK_BINARY ||
      (process.env.DUCK_SOURCE_DIR ? `${process.env.DUCK_SOURCE_DIR}/duck` : 'duck');
    execSync(`cd ${process.env.DUCK_SOURCE_DIR || '.'} && nohup ${duckBin} mcp > /tmp/duck-mcp.log 2>&1 &`, { stdio: 'ignore' });
    await sleep(5000);
    return await checkHttp('http://127.0.0.1:3850');
  } catch (e) {
    log(`  -> ERROR: Failed to heal Duck MCP: ${e}`);
    return false;
  }
}

async function healACP(): Promise<boolean> {
  log('  -> Attempting to heal ACP Server...');
  try {
    execSync('openclaw gateway restart', { stdio: 'ignore' });
    await sleep(5000);
    return await checkHttp('http://127.0.0.1:18790');
  } catch (e) {
    log(`  -> ERROR: Failed to heal ACP: ${e}`);
    return false;
  }
}

async function healWebSocket(): Promise<boolean> {
  log('  -> Attempting to heal WebSocket Server...');
  try {
    execSync('openclaw gateway restart', { stdio: 'ignore' });
    await sleep(5000);
    return await checkHttp('http://127.0.0.1:18791');
  } catch (e) {
    log(`  -> ERROR: Failed to heal WebSocket: ${e}`);
    return false;
  }
}

async function healCannaAI(): Promise<boolean> {
  log('  -> Attempting to heal CannaAI...');
  try {
    // Kill existing processes
    execSync('pkill -f "tsx server.ts" 2>/dev/null || true', { stdio: 'ignore' });
    execSync('pkill -f "CannaAI" 2>/dev/null || true', { stdio: 'ignore' });
    await sleep(2000);

    const cannaiDir = '/Users/duckets/.openclaw/workspace/CannaAI';
    
    // Rebuild if needed
    if (!fs.existsSync(path.join(cannaiDir, '.next/BUILD_ID'))) {
      log('  -> CannaAI build missing, rebuilding...');
      execSync('npm run build', { cwd: cannaiDir, stdio: 'ignore' });
    }

    // Start
    execSync(
      `cd "${cannaiDir}" && ` +
      'nohup /bin/sh -c "NODE_ENV=production npx tsx server.ts" > /tmp/cannai.log 2>&1 &',
      { stdio: 'ignore' }
    );
    await sleep(5000);
    return await checkHttp('http://localhost:3000');
  } catch (e) {
    log(`  -> ERROR: Failed to heal CannaAI: ${e}`);
    return false;
  }
}

async function healAICouncil(): Promise<boolean> {
  log('  -> Attempting to heal AI Council...');
  try {
    const startScript = '/Users/duckets/.openclaw/workspace/start-ai-council.sh';
    
    // Kill existing
    execSync('pkill -f "vite" 2>/dev/null || true', { stdio: 'ignore' });
    await sleep(2000);

    if (fs.existsSync(startScript)) {
      execSync(`nohup "${startScript}" > /tmp/ai-council.log 2>&1 &`, { stdio: 'ignore' });
    } else {
      const councilDir = '/Users/duckets/.openclaw/workspace/ai-council-chamber';
      if (fs.existsSync(councilDir)) {
        execSync(`cd "${councilDir}" && nohup npm run dev > /tmp/ai-council.log 2>&1 &`, { stdio: 'ignore' });
      }
    }
    
    await sleep(8000);
    return await checkHttp('http://localhost:3001');
  } catch (e) {
    log(`  -> ERROR: Failed to heal AI Council: ${e}`);
    return false;
  }
}

async function healAgentMonitor(): Promise<boolean> {
  log('  -> Attempting to heal Agent Monitor...');
  try {
    // Kill existing
    execSync('pkill -f "agent-monitor" 2>/dev/null || true', { stdio: 'ignore' });
    await sleep(1000);

    const monitorDir = '/Users/duckets/.openclaw/workspace/agent-monitor';
    if (fs.existsSync(monitorDir)) {
      execSync(
        `cd "${monitorDir}" && ` +
        'nohup PORT=3001 HOSTNAME=0.0.0.0 node .next/standalone/server.js > /tmp/agent-monitor-3001.log 2>&1 &',
        { stdio: 'ignore' }
      );
    }
    
    await sleep(5000);
    return await checkHttp('http://localhost:3001/api/health');
  } catch (e) {
    log(`  -> ERROR: Failed to heal Agent Monitor: ${e}`);
    return false;
  }
}

async function healLMStudio(): Promise<boolean> {
  log('  -> Attempting to heal LM Studio (Windows PC)...');
  // LM Studio is on Windows - we can only try WOL or notify
  try {
    // Check if it came back on its own
    if (await checkHttp('http://100.116.54.125:1234')) {
      log('  -> LM Studio: HEALED (came back on its own)');
      return true;
    }
    
    // Try WOL if MAC is configured
    // wakeonlan AA:BB:CC:DD:EE:FF 2>/dev/null || true;
    
    log('  -> LM Studio DOWN - requires manual intervention on Windows PC');
    return false;
  } catch {
    return false;
  }
}

// =============================================================================
// Nuclear Option - Everything is Down
// =============================================================================

async function triggerNuclearOption(state: HealState): Promise<void> {
  if (state.nuclearMode) {
    log('NUCLEAR MODE: Already active, skipping duplicate trigger');
    return;
  }

  log('*** NUCLEAR OPTION TRIGGERED ***');
  log('*** ALL CRITICAL SERVICES DOWN - USER ALERT ***');
  
  state.nuclearMode = true;
  state.nuclearTriggeredAt = new Date().toISOString();
  saveState(state);

  const message = `
🚨 <b>NUCLEAR ALERT - System Critical</b>
❌ All critical services are DOWN
⏰ Triggered: ${new Date().toLocaleString()}
🔄 Auto-heal has failed all attempts
👤 Manual intervention required!
`;

  await sendTelegramAlert(message);
  log('Nuclear alert sent to Telegram');
}

// =============================================================================
// Main Heal Logic with Exponential Backoff
// =============================================================================

async function healServiceWithBackoff(
  service: Service,
  state: HealState
): Promise<{ success: boolean; nuclear: boolean }> {
  const serviceState = state.services[service.key];

  logSection(`HEALING: ${service.name}`);
  log(`URL: ${service.url}`);
  log(`Critical: ${service.critical}`);
  log(`Previous attempts: ${serviceState.attempts}`);

  // Exponential backoff: 5s, 10s, 20s — cap at 20s to avoid long stalls
  const backoffMs = Math.min(Math.pow(2, serviceState.attempts) * 5000, 20000);

  if (serviceState.attempts > 0) {
    log(`Waiting ${backoffMs / 1000}s before retry (exponential backoff, capped at 20s)...`);
    await sleep(backoffMs);
  }

  serviceState.attempts++;
  serviceState.lastAttempt = new Date().toISOString();

  let healed = false;
  try {
    healed = await service.heal();
  } catch (e: any) {
    log(`  -> heal() threw: ${e.message}`);
  }

  if (healed) {
    log(`✅ ${service.name}: HEALED`);
    serviceState.consecutiveFailures = 0;
    // Reset attempt counter on success so next failure starts fresh
    serviceState.attempts = 0;
    serviceState.lastSuccess = new Date().toISOString();
    serviceState.totalRestarts++;
    return { success: true, nuclear: false };
  }

  log(`❌ ${service.name}: still DOWN after attempt ${serviceState.attempts}`);

  if (serviceState.attempts >= MAX_ATTEMPTS) {
    serviceState.consecutiveFailures++;

    if (service.critical) {
      const alertMsg =
        `🚨 <b>Service DOWN - Healer Failed</b>\n` +
        `Service: ${service.name}\n` +
        `Attempts: ${MAX_ATTEMPTS}/${MAX_ATTEMPTS}\n` +
        `Manual intervention required!`;

      await sendTelegramAlert(alertMsg);
      log(`Alert sent for ${service.name}`);

      // Check if ALL critical services are down → nuclear
      const allCriticalDown = SERVICES
        .filter(s => s.critical)
        .every(s => {
          // Use sync check to avoid async inside filter
          try {
            const result = s.check();
            // We need to await it — do it differently below
            return false; // placeholder, real check below
          } catch {
            return false;
          }
        });

      // Re-check critically with a quick parallel probe
      const criticalChecks = await Promise.all(
        SERVICES.filter(s => s.critical).map(s => s.check().catch(() => false))
      );
      const allCriticalDown2 = criticalChecks.every(r => !r);

      if (allCriticalDown2) {
        await triggerNuclearOption(state);
        return { success: false, nuclear: true };
      }
    }
  }

  return { success: false, nuclear: false };
}

// =============================================================================
// Health Check All Services
// =============================================================================

async function checkAllServices(
  state: HealState
): Promise<{ up: Service[]; down: Service[] }> {
  const up: Service[] = [];
  const down: Service[] = [];

  for (const service of SERVICES) {
    const isUp = await service.check();
    const emoji = isUp ? '✅' : '❌';
    log(`${emoji} ${service.name}: ${isUp ? 'UP' : 'DOWN'} (${service.url})`);
    
    if (isUp) {
      up.push(service);
      // Reset failure counter on successful check
      if (state.services[service.key].consecutiveFailures > 0) {
        log(`  -> ${service.name} recovered, resetting failure counter`);
        state.services[service.key].consecutiveFailures = 0;
        state.services[service.key].attempts = 0;
      }
    } else {
      down.push(service);
    }
  }

  return { up, down };
}

// =============================================================================
// Utility
// =============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// =============================================================================
// Main Entry Point
// =============================================================================

async function main(): Promise<void> {
  logSection('ENHANCED AUTO-HEAL STARTED');
  log(`PID: ${process.pid}`);
  log(`Node: ${process.version}`);

  // Acquire lock
  if (!acquireLock()) {
    process.exit(0);
  }

  try {
    // Load persistent state
    const state = loadState();
    state.lastCheck = new Date().toISOString();
    saveState(state);

    // Check all services
    logSection('CHECKING ALL SERVICES');
    const { up, down } = await checkAllServices(state);

    log('');
    log(`Summary: ${up.length}/${SERVICES.length} services UP`);
    
    if (down.length === 0) {
      log('All services healthy. Nothing to heal.');
      return;
    }

    log(`Services needing healing: ${down.map(s => s.name).join(', ')}`);

    // Heal each down service
    for (const service of down) {
      // Skip if nuclear mode already triggered
      if (state.nuclearMode) {
        log(`NUCLEAR MODE: Skipping ${service.name} healing`);
        continue;
      }

      const { success, nuclear } = await healServiceWithBackoff(service, state);
      
      if (nuclear) {
        log('NUCLEAR MODE engaged - aborting remaining heals');
        break;
      }

      if (success) {
        const recoveryMsg = 
          `✅ <b>Service Recovered</b>\n` +
          `Service: ${service.name}\n` +
          `Status: Back UP after auto-heal`;
        await sendTelegramAlert(recoveryMsg);
      }
    }

    saveState(state);
    logSection('ENHANCED AUTO-HEAL COMPLETED');

  } catch (error) {
    log(`FATAL ERROR: ${error}`);
    console.error(error);
  } finally {
    releaseLock();
  }
}

// Run
main().catch(console.error);
