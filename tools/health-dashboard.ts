#!/usr/bin/env npx tsx
/**
 * health-dashboard.ts - DuckBot Health Dashboard
 * =============================================================================
 * Real-time dashboard showing:
 * - Status of ALL services in one view
 * - Uptime tracking
 * - Restart history
 * - Quick actions (restart individual services)
 * 
 * Usage: 
 *   ./health-dashboard.ts status    - Show current status
 *   ./health-dashboard.ts restart <service> - Restart a service
 *   ./health-dashboard.ts history  - Show restart history
 *   ./health-dashboard.ts html      - Generate HTML dashboard
 * =============================================================================
 */

import { execSync, exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const LOG_DIR = '/tmp/auto-heal';
const STATE_FILE = `${LOG_DIR}/state.json`;
const LOG_FILE = `${LOG_DIR}/enhanced-heal.log`;
const HISTORY_FILE = `${LOG_DIR}/restart-history.json`;

// =============================================================================
// Service Definitions
// =============================================================================

interface ServiceInfo {
  name: string;
  key: string;
  url: string;
  port: number;
  critical: boolean;
  processName: string;
  startCommand?: string;
}

const ALL_SERVICES: ServiceInfo[] = [
  { name: 'OpenClaw Gateway', key: 'gateway', url: 'http://127.0.0.1:18789', port: 18789, critical: true, processName: 'openclaw' },
  { name: 'MCP Server', key: 'mcp', url: 'http://127.0.0.1:3848', port: 3848, critical: true, processName: 'clawdcursor', startCommand: 'cd /Users/duckets/.openclaw/workspace/clawd-cursor && nohup npx clawdcursor start > /tmp/clawdcursor.log 2>&1 &' },
  { name: 'ACP Server', key: 'acp', url: 'http://127.0.0.1:18790', port: 18790, critical: true, processName: 'openclaw' },
  { name: 'WebSocket Server', key: 'websocket', url: 'http://127.0.0.1:18791', port: 18791, critical: true, processName: 'openclaw' },
  { name: 'CannaAI Web UI', key: 'cannai', url: 'http://localhost:3000', port: 3000, critical: true, processName: 'tsx', startCommand: 'cd /Users/duckets/.openclaw/workspace/CannaAI && nohup /bin/sh -c "NODE_ENV=production npx tsx server.ts" > /tmp/cannai.log 2>&1 &' },
  { name: 'AI Council Web UI', key: 'ai-council', url: 'http://localhost:3001', port: 3001, critical: true, processName: 'vite', startCommand: '/Users/duckets/.openclaw/workspace/start-ai-council.sh' },
  { name: 'Agent Monitor', key: 'agent-monitor', url: 'http://localhost:3001/api/health', port: 3001, critical: false, processName: 'node' },
  { name: 'LM Studio', key: 'lm-studio', url: 'http://100.116.54.125:1234', port: 1234, critical: false, processName: 'lm-studio' },
];

// =============================================================================
// State Types
// =============================================================================

interface ServiceState {
  attempts: number;
  lastAttempt: string;
  lastSuccess: string;
  consecutiveFailures: number;
  totalRestarts: number;
}

interface HealState {
  lastCheck: string;
  services: Record<string, ServiceState>;
  nuclearMode: boolean;
  nuclearTriggeredAt?: string;
}

interface RestartEntry {
  timestamp: string;
  service: string;
  serviceKey: string;
  status: 'success' | 'failed';
  attempts: number;
  duration?: number;
}

// =============================================================================
// Utility Functions
// =============================================================================

function log(msg: string): void {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

function checkHttp(url: string, timeoutMs = 3000): boolean {
  try {
    const result = execSync(
      `curl -s -o /dev/null -w "%{http_code}" --max-time ${timeoutMs/1000} "${url}" 2>/dev/null || echo "000"`,
      { encoding: 'utf-8' }
    ).trim();
    return result.length === 3 && result[0] >= '2' && result[0] <= '5';
  } catch {
    return false;
  }
}

function loadState(): HealState | null {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
    }
  } catch {}
  return null;
}

function loadHistory(): RestartEntry[] {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8'));
    }
  } catch {}
  return [];
}

function saveHistory(history: RestartEntry[]): void {
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
  } catch {}
}

function addHistoryEntry(entry: RestartEntry): void {
  const history = loadHistory();
  history.unshift(entry);
  // Keep last 100 entries
  if (history.length > 100) {
    history.length = 100;
  }
  saveHistory(history);
}

function getUptimeSeconds(processName: string): number {
  try {
    if (processName === 'openclaw') {
      const result = execSync('ps -p $(pgrep -f "openclaw" | head -1) -o etimes= 2>/dev/null || echo "0"', { encoding: 'utf-8' }).trim();
      return parseInt(result) || 0;
    }
    const result = execSync(`pgrep -f "${processName}" | head -1 | xargs ps -o etimes= 2>/dev/null || echo "0"`, { encoding: 'utf-8' }).trim();
    return parseInt(result) || 0;
  } catch {
    return 0;
  }
}

function formatUptime(seconds: number): string {
  if (seconds === 0) return 'N/A';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

// =============================================================================
// Service Status Check
// =============================================================================

interface ServiceStatus {
  info: ServiceInfo;
  isUp: boolean;
  responseCode?: string;
  uptime?: string;
  state: ServiceState | null;
}

async function getServiceStatus(info: ServiceInfo): Promise<ServiceStatus> {
  let responseCode = '000';
  let isUp = false;

  try {
    responseCode = execSync(
      `curl -s -o /dev/null -w "%{http_code}" --max-time 3 "${info.url}" 2>/dev/null || echo "000"`,
      { encoding: 'utf-8' }
    ).trim();
    isUp = responseCode.length === 3 && responseCode[0] >= '2' && responseCode[0] <= '5';
  } catch {}

  const state = loadState();
  const uptimeSec = isUp ? getUptimeSeconds(info.processName) : 0;

  return {
    info,
    isUp,
    responseCode,
    uptime: isUp ? formatUptime(uptimeSec) : undefined,
    state: state?.services[info.key] || null,
  };
}

// =============================================================================
// Display Functions
// =============================================================================

function displayStatus(): void {
  console.log('\n' + '═'.repeat(60));
  console.log('  🏥 DUCKBOT HEALTH DASHBOARD');
  console.log('═'.repeat(60) + '\n');

  const state = loadState();
  const history = loadHistory();
  
  console.log(`📊 Last Check: ${state?.lastCheck ? new Date(state.lastCheck).toLocaleString() : 'Never'}`);
  console.log(`🚨 Nuclear Mode: ${state?.nuclearMode ? '⚠️ ACTIVE' : '✅ Inactive'}`);
  console.log('');

  console.log('┌─────────────────────────────────────────────────────────────────────┐');
  console.log('│  SERVICE                  │  STATUS  │  PORT  │  UPTIME  │ CRITICAL │');
  console.log('├─────────────────────────────────────────────────────────────────────┤');

  // Check all services
  const statuses: ServiceStatus[] = ALL_SERVICES.map(s => ({
    info: s,
    isUp: false,
    responseCode: '???',
    state: state?.services[s.key] || null,
  }));

  // Sequential check for reliability
  for (let i = 0; i < statuses.length; i++) {
    statuses[i] = await getServiceStatus(ALL_SERVICES[i]);
  }

  let criticalDown = 0;
  let totalUp = 0;

  for (const status of statuses) {
    const statusIcon = status.isUp ? '✅ UP' : '❌ DOWN';
    const port = status.info.port.toString();
    const uptime = status.uptime || 'N/A';
    const critical = status.info.critical ? '🔴' : '🟡';
    
    if (!status.isUp && status.info.critical) criticalDown++;
    if (status.isUp) totalUp++;

    // Truncate name if needed
    const name = status.info.name.padEnd(22).substring(0, 22);
    
    console.log(`│ ${name} │ ${statusIcon.padEnd(8)} │ ${port.padStart(5)} │ ${uptime.padStart(7)} │    ${critical}    │`);
  }

  console.log('└─────────────────────────────────────────────────────────────────────┘');
  console.log('');
  console.log(`📈 Summary: ${totalUp}/${ALL_SERVICES.length} services UP`);
  
  if (criticalDown > 0) {
    console.log(`🚨 WARNING: ${criticalDown} CRITICAL service(s) DOWN!`);
  }

  // Show recent restarts
  if (history.length > 0) {
    console.log('\n📜 RECENT RESTARTS:');
    console.log('─'.repeat(60));
    for (const entry of history.slice(0, 5)) {
      const time = new Date(entry.timestamp).toLocaleString();
      const icon = entry.status === 'success' ? '✅' : '❌';
      console.log(`  ${icon} ${entry.service} - ${time} (${entry.attempts} attempts)`);
    }
  }

  console.log('\n📋 QUICK ACTIONS:');
  console.log('  restart <service>  - Restart a specific service');
  console.log('  history            - Show full restart history');
  console.log('  html               - Generate HTML dashboard\n');
}

async function restartService(serviceKey: string): Promise<void> {
  const service = ALL_SERVICES.find(s => s.key === serviceKey);
  if (!service) {
    console.error(`Unknown service: ${serviceKey}`);
    console.log(`Available: ${ALL_SERVICES.map(s => s.key).join(', ')}`);
    return;
  }

  console.log(`\n🔄 Restarting ${service.name}...`);
  const startTime = Date.now();

  try {
    // Kill existing
    if (service.processName === 'openclaw') {
      execSync('openclaw gateway restart', { stdio: 'ignore' });
    } else {
      execSync(`pkill -f "${service.processName}" 2>/dev/null || true`, { stdio: 'ignore' });
    }
    
    await new Promise(r => setTimeout(r, 2000));

    // Start if we have a command
    if (service.startCommand) {
      execSync(service.startCommand, { stdio: 'ignore', shell: '/bin/bash' });
    }

    await new Promise(r => setTimeout(r, 5000));

    // Verify
    const isUp = checkHttp(service.url);
    const duration = Math.round((Date.now() - startTime) / 1000);

    const entry: RestartEntry = {
      timestamp: new Date().toISOString(),
      service: service.name,
      serviceKey: service.key,
      status: isUp ? 'success' : 'failed',
      attempts: 1,
      duration,
    };
    addHistoryEntry(entry);

    if (isUp) {
      console.log(`✅ ${service.name} restarted successfully in ${duration}s`);
    } else {
      console.log(`❌ ${service.name} restart failed - service not responding`);
    }
  } catch (error) {
    console.error(`Failed to restart ${service.name}: ${error}`);
  }
}

function displayHistory(): void {
  const history = loadHistory();
  
  console.log('\n📜 RESTART HISTORY');
  console.log('═'.repeat(60));
  
  if (history.length === 0) {
    console.log('No restart history recorded.');
    return;
  }

  for (const entry of history.slice(0, 20)) {
    const time = new Date(entry.timestamp).toLocaleString();
    const icon = entry.status === 'success' ? '✅' : '❌';
    console.log(`${icon} [${time}] ${entry.service}`);
    console.log(`   Attempts: ${entry.attempts} | Duration: ${entry.duration || 'N/A'}s`);
  }
}

function generateHtml(): void {
  const state = loadState();
  const history = loadHistory();
  
  // Get all statuses
  const statuses: ServiceStatus[] = ALL_SERVICES.map(s => ({
    info: s,
    isUp: false,
    state: state?.services[s.key] || null,
  }));

  // Generate HTML
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DuckBot Health Dashboard</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f0f1a; color: #fff; min-height: 100vh; padding: 20px; }
    .container { max-width: 1200px; margin: 0 auto; }
    h1 { text-align: center; margin-bottom: 30px; color: #00d4ff; font-size: 2em; }
    .status-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 15px; margin-bottom: 30px; }
    .service-card { background: linear-gradient(135deg, #1a1a2e, #16213e); border-radius: 12px; padding: 20px; border: 1px solid #333; transition: transform 0.2s; }
    .service-card:hover { transform: translateY(-2px); border-color: #00d4ff; }
    .service-card.up { border-left: 4px solid #00ff88; }
    .service-card.down { border-left: 4px solid #ff4444; }
    .service-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
    .service-name { font-weight: 600; font-size: 1.1em; }
    .status-badge { padding: 4px 12px; border-radius: 20px; font-size: 0.8em; font-weight: 600; }
    .status-badge.up { background: #00ff8822; color: #00ff88; }
    .status-badge.down { background: #ff444422; color: #ff4444; }
    .service-meta { font-size: 0.85em; color: #888; }
    .service-meta div { margin: 5px 0; }
    .critical { color: #ff6b6b; }
    .section { background: #1a1a2e; border-radius: 12px; padding: 20px; margin-bottom: 20px; }
    .section h2 { color: #00d4ff; margin-bottom: 15px; border-bottom: 1px solid #333; padding-bottom: 10px; }
    .history-item { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #2a2a4a; }
    .history-item:last-child { border-bottom: none; }
    .timestamp { color: #888; font-size: 0.9em; }
    .btn { background: #00d4ff; color: #000; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: 600; transition: background 0.2s; }
    .btn:hover { background: #00a8cc; }
    .btn:disabled { background: #444; cursor: not-allowed; }
    .summary { display: flex; justify-content: space-around; text-align: center; margin-bottom: 20px; }
    .summary-item { background: #1a1a2e; padding: 20px; border-radius: 12px; flex: 1; margin: 0 10px; }
    .summary-value { font-size: 2em; font-weight: 700; color: #00d4ff; }
    .summary-label { color: #888; margin-top: 5px; }
    .nuclear-alert { background: linear-gradient(135deg, #ff4444, #cc0000); padding: 20px; border-radius: 12px; text-align: center; animation: pulse 1s infinite; }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.8; } }
    .refresh { text-align: center; margin-top: 20px; color: #888; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🏥 DuckBot Health Dashboard</h1>
    
    ${state?.nuclearMode ? `
    <div class="nuclear-alert">
      <h2>🚨 NUCLEAR MODE ACTIVE</h2>
      <p>All critical services are down. Manual intervention required!</p>
      <p>Triggered: ${state.nuclearTriggeredAt ? new Date(state.nuclearTriggeredAt).toLocaleString() : 'Unknown'}</p>
    </div>
    ` : ''}
    
    <div class="summary">
      <div class="summary-item">
        <div class="summary-value">${statuses.filter(s => s.isUp).length}/${ALL_SERVICES.length}</div>
        <div class="summary-label">Services UP</div>
      </div>
      <div class="summary-item">
        <div class="summary-value">${history.length}</div>
        <div class="summary-label">Total Restarts</div>
      </div>
      <div class="summary-item">
        <div class="summary-value">${state?.lastCheck ? new Date(state.lastCheck).toLocaleTimeString() : 'Never'}</div>
        <div class="summary-label">Last Check</div>
      </div>
    </div>
    
    <div class="status-grid">
      ${ALL_SERVICES.map(svc => {
        const status = statuses.find(st => st.info.key === svc.key) || { isUp: false, state: null };
        const svcState = status.state;
        return `
        <div class="service-card ${status.isUp ? 'up' : 'down'}">
          <div class="service-header">
            <span class="service-name">${svc.name}</span>
            <span class="status-badge ${status.isUp ? 'up' : 'down'}">${status.isUp ? 'UP' : 'DOWN'}</span>
          </div>
          <div class="service-meta">
            <div>🌐 ${svc.url}</div>
            <div>🔌 Port: ${svc.port}</div>
            <div>⏱️ Uptime: ${status.uptime || 'N/A'}</div>
            ${svcState ? `<div>🔄 Restarts: ${svcState.totalRestarts}</div>` : ''}
            <div class="${svc.critical ? 'critical' : ''}">${svc.critical ? '🔴 CRITICAL' : '🟡 Non-critical'}</div>
          </div>
          <button class="btn" onclick="restartService('${svc.key}')" ${!status.isUp ? '' : 'disabled'}>
            ${status.isUp ? 'Running' : 'Restart'}
          </button>
        </div>
        `;
      }).join('')}
    </div>
    
    <div class="section">
      <h2>📜 Restart History</h2>
      ${history.length === 0 ? '<p>No restart history.</p>' : ''}
      ${history.slice(0, 10).map(entry => `
        <div class="history-item">
          <span>${entry.status === 'success' ? '✅' : '❌'} ${entry.service}</span>
          <span class="timestamp">${new Date(entry.timestamp).toLocaleString()} (${entry.attempts} attempts)</span>
        </div>
      `).join('')}
    </div>
    
    <div class="refresh">
      Auto-refreshes every 30 seconds | Last updated: ${new Date().toLocaleString()}
    </div>
  </div>
  
  <script>
    setTimeout(() => location.reload(), 30000);
    function restartService(key) {
      if (confirm('Restart this service?')) {
        fetch('/restart?service=' + key).then(r => location.reload());
      }
    }
  </script>
</body>
</html>`;

  const outputPath = '/tmp/health-dashboard.html';
  fs.writeFileSync(outputPath, html);
  console.log(`\n✅ HTML dashboard generated: ${outputPath}`);
  console.log('Open with: open ' + outputPath);
}

// =============================================================================
// Main
// =============================================================================

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0] || 'status';

  switch (command) {
    case 'status':
      await displayStatus();
      break;
    case 'restart':
      await restartService(args[1]);
      break;
    case 'history':
      displayHistory();
      break;
    case 'html':
      await generateHtml();
      break;
    default:
      console.log(`Unknown command: ${command}`);
      console.log('Usage: health-dashboard.ts [status|restart|history|html]');
  }
}

main().catch(console.error);
