/**
 * 🦆 Duck Agent Bridge - Comprehensive Logger & Error Tracker
 * Built-in logging for all protocols: MCP, ACP, WebSocket, REST
 * 
 * Features:
 * - Structured JSON logs
 * - Error tracking with stack traces
 * - Protocol-specific logging
 * - Real-time log streaming
 * - Health status dashboard
 */

import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import fs from 'fs';
import path from 'path';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  FATAL = 4
}

export interface LogEntry {
  timestamp: string;
  level: string;
  protocol: 'mcp' | 'acp' | 'websocket' | 'rest' | 'system' | 'agent';
  component: string;
  message: string;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  metadata?: Record<string, any>;
  requestId?: string;
  duration?: number;
  status?: 'success' | 'error' | 'pending';
}

export interface HealthStatus {
  uptime: number;
  protocols: {
    mcp: ProtocolHealth;
    acp: ProtocolHealth;
    websocket: ProtocolHealth;
    rest: ProtocolHealth;
  };
  errors: {
    total: number;
    byProtocol: Record<string, number>;
    recent: ErrorEntry[];
  };
  logs: {
    total: number;
    byLevel: Record<string, number>;
  };
}

interface ProtocolHealth {
  status: 'healthy' | 'degraded' | 'down';
  requests: number;
  errors: number;
  lastRequest: string | null;
  lastError: string | null;
}

interface ErrorEntry {
  timestamp: string;
  protocol: string;
  component: string;
  message: string;
  stack?: string;
  resolved: boolean;
}

class BridgeLogger {
  private logs: LogEntry[] = [];
  private errors: ErrorEntry[] = [];
  private protocolStats = {
    mcp: { requests: 0, errors: 0, lastRequest: null as string | null, lastError: null as string | null },
    acp: { requests: 0, errors: 0, lastRequest: null as string | null, lastError: null as string | null },
    websocket: { requests: 0, errors: 0, lastRequest: null as string | null, lastError: null as string | null },
    rest: { requests: 0, errors: 0, lastRequest: null as string | null, lastError: null as string | null }
  };
  private startTime = Date.now();
  private logFile: string;
  private wsClients: Set<WebSocket> = new Set();
  private maxLogs = 1000;
  private maxErrors = 100;

  constructor(logDir = '/tmp') {
    this.logFile = path.join(logDir, 'duck-bridge.log');
    this.startCleanup();
  }

  private startCleanup() {
    // Keep logs bounded
    setInterval(() => {
      if (this.logs.length > this.maxLogs) {
        this.logs = this.logs.slice(-this.maxLogs / 2);
      }
      if (this.errors.length > this.maxErrors) {
        this.errors = this.errors.slice(-this.maxErrors / 2);
      }
    }, 60000); // Every minute
  }

  log(level: LogLevel, protocol: LogEntry['protocol'], component: string, message: string, metadata?: any, error?: Error) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel[level],
      protocol,
      component,
      message,
      requestId: metadata?.requestId,
      duration: metadata?.duration,
      status: error ? 'error' : (metadata?.status || 'success'),
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : undefined,
      metadata
    };

    // Store in memory
    this.logs.push(entry);

    // Write to file
    fs.appendFileSync(this.logFile, JSON.stringify(entry) + '\n');

    // Update stats
    if (protocol !== 'system') {
      this.protocolStats[protocol].requests++;
      this.protocolStats[protocol].lastRequest = entry.timestamp;
    }

    // Track errors
    if (level >= LogLevel.ERROR) {
      this.errors.push({
        timestamp: entry.timestamp,
        protocol,
        component,
        message,
        stack: error?.stack,
        resolved: false
      });
      if (protocol !== 'system') {
        this.protocolStats[protocol].errors++;
        this.protocolStats[protocol].lastError = entry.timestamp;
      }
    }

    // Broadcast to WebSocket subscribers
    this.broadcast(entry);

    // Console output (colored)
    this.consoleLog(entry);
  }

  private consoleLog(entry: LogEntry) {
    const color = {
      DEBUG: '\x1b[36m',   // Cyan
      INFO: '\x1b[32m',   // Green
      WARN: '\x1b[33m',   // Yellow
      ERROR: '\x1b[31m',  // Red
      FATAL: '\x1b[35m'  // Magenta
    }[entry.level] || '\x1b[0m';

    const protocolColor = {
      mcp: '\x1b[34m',      // Blue
      acp: '\x1b[35m',     // Magenta
      websocket: '\x1b[36m', // Cyan
      rest: '\x1b[33m',     // Yellow
      system: '\x1b[37m',   // White
      agent: '\x1b[32m'    // Green
    }[entry.protocol] || '\x1b[0m';

    const reset = '\x1b[0m';
    console.log(
      `${color}[${entry.level}]${reset} ` +
      `${protocolColor}[${entry.protocol}]${reset} ` +
      `${entry.component}: ${entry.message}` +
      (entry.error ? ` ${color}ERROR: ${entry.error.message}${reset}` : '')
    );
  }

  private broadcast(entry: LogEntry) {
    const data = JSON.stringify({ type: 'log', entry });
    for (const ws of this.wsClients) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    }
  }

  // WebSocket log streaming
  addWebSocketClient(ws: WebSocket) {
    this.wsClients.add(ws);
    ws.on('close', () => this.wsClients.delete(ws));
  }

  // ============ Convenience methods ============

  debug(protocol: LogEntry['protocol'], component: string, message: string, metadata?: any) {
    this.log(LogLevel.DEBUG, protocol, component, message, metadata);
  }

  info(protocol: LogEntry['protocol'], component: string, message: string, metadata?: any) {
    this.log(LogLevel.INFO, protocol, component, message, metadata);
  }

  warn(protocol: LogEntry['protocol'], component: string, message: string, metadata?: any) {
    this.log(LogLevel.WARN, protocol, component, message, metadata);
  }

  error(protocol: LogEntry['protocol'], component: string, message: string, err?: Error, metadata?: any) {
    this.log(LogLevel.ERROR, protocol, component, message, { ...metadata, error: err?.message }, err);
  }

  fatal(protocol: LogEntry['protocol'], component: string, message: string, err?: Error, metadata?: any) {
    this.log(LogLevel.FATAL, protocol, component, message, { ...metadata, error: err?.message }, err);
  }

  // ============ Query methods ============

  getHealth(): HealthStatus {
    const protocolHealth = (protocol: keyof typeof this.protocolStats): ProtocolHealth => {
      const stats = this.protocolStats[protocol];
      const errorRate = stats.requests > 0 ? stats.errors / stats.requests : 0;
      return {
        status: errorRate > 0.5 ? 'down' : errorRate > 0.1 ? 'degraded' : 'healthy',
        requests: stats.requests,
        errors: stats.errors,
        lastRequest: stats.lastRequest,
        lastError: stats.lastError
      };
    };

    return {
      uptime: Date.now() - this.startTime,
      protocols: {
        mcp: protocolHealth('mcp'),
        acp: protocolHealth('acp'),
        websocket: protocolHealth('websocket'),
        rest: protocolHealth('rest')
      },
      errors: {
        total: this.errors.length,
        byProtocol: Object.fromEntries(
          Object.entries(this.protocolStats).map(([k, v]) => [k, v.errors])
        ),
        recent: this.errors.slice(-10).reverse()
      },
      logs: {
        total: this.logs.length,
        byLevel: this.logs.reduce((acc, log) => {
          acc[log.level] = (acc[log.level] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      }
    };
  }

  getLogs(options: {
    protocol?: LogEntry['protocol'];
    level?: LogLevel;
    since?: string;
    limit?: number;
    search?: string;
  } = {}): LogEntry[] {
    let filtered = this.logs;

    if (options.protocol) {
      filtered = filtered.filter(l => l.protocol === options.protocol);
    }
    if (options.level !== undefined) {
      filtered = filtered.filter(l => l.level === LogLevel[options.level]);
    }
    if (options.since) {
      filtered = filtered.filter(l => l.timestamp >= options.since);
    }
    if (options.search) {
      const search = options.search.toLowerCase();
      filtered = filtered.filter(l =>
        l.message.toLowerCase().includes(search) ||
        l.component.toLowerCase().includes(search)
      );
    }

    return filtered.slice(-(options.limit || 100));
  }

  getErrors(protocol?: LogEntry['protocol'], unresolved?: boolean): ErrorEntry[] {
    let filtered = this.errors;
    if (protocol) {
      filtered = filtered.filter(e => e.protocol === protocol);
    }
    if (unresolved !== undefined) {
      filtered = filtered.filter(e => e.resolved !== unresolved);
    }
    return filtered.reverse();
  }

  resolveError(timestamp: string) {
    const error = this.errors.find(e => e.timestamp === timestamp);
    if (error) {
      error.resolved = true;
    }
  }

  // HTTP handler for log queries
  async handleRequest(req: http.IncomingMessage, res: http.ServerResponse) {
    const url = new URL(req.url, 'http://localhost');
    const path = url.pathname;

    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');

    try {
      if (path === '/health' || path === '/api/health') {
        res.end(JSON.stringify(this.getHealth(), null, 2));
        return;
      }

      if (path === '/logs' || path === '/api/logs') {
        const options = {
          protocol: url.searchParams.get('protocol') as LogEntry['protocol'],
          level: url.searchParams.get('level') ? parseInt(url.searchParams.get('level')) : undefined,
          since: url.searchParams.get('since') || undefined,
          limit: url.searchParams.get('limit') ? parseInt(url.searchParams.get('limit')) : undefined,
          search: url.searchParams.get('search') || undefined
        };
        res.end(JSON.stringify(this.getLogs(options), null, 2));
        return;
      }

      if (path === '/errors' || path === '/api/errors') {
        const protocol = url.searchParams.get('protocol') as LogEntry['protocol'];
        const unresolved = url.searchParams.get('unresolved');
        res.end(JSON.stringify(this.getErrors(protocol, unresolved === 'true'), null, 2));
        return;
      }

      if (path === '/resolve-error' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
          const { timestamp } = JSON.parse(body);
          this.resolveError(timestamp);
          res.end(JSON.stringify({ success: true }));
        });
        return;
      }

      if (path === '/logs/stream') {
        // WebSocket upgrade
        const ws = new WebSocket(req, res, { httpToken: 'log-stream' });
        this.addWebSocketClient(ws);
        ws.send(JSON.stringify({ type: 'subscribed', message: 'Log stream started' }));
        return;
      }

      // Dashboard HTML
      if (path === '/' || path === '/dashboard') {
        res.setHeader('Content-Type', 'text/html');
        res.end(this.getDashboardHTML());
        return;
      }

      res.statusCode = 404;
      res.end(JSON.stringify({ error: 'Not found' }));
    } catch (err) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: String(err) }));
    }
  }

  private getDashboardHTML(): string {
    const health = this.getHealth();
    const recentLogs = this.getLogs({ limit: 20 });
    const recentErrors = this.getErrors(undefined, true).slice(0, 10);

    return `<!DOCTYPE html>
<html>
<head>
  <title>Duck Bridge Dashboard</title>
  <meta http-equiv="refresh" content="5">
  <style>
    body { font-family: monospace; background: #1a1a2e; color: #eee; padding: 20px; }
    h1 { color: #00ff88; }
    .card { background: #16213e; border-radius: 8px; padding: 15px; margin: 10px 0; }
    .protocol { display: inline-block; padding: 5px 10px; border-radius: 4px; margin: 5px; }
    .healthy { background: #00ff88; color: #000; }
    .degraded { background: #ffaa00; color: #000; }
    .down { background: #ff4444; color: #fff; }
    .error { background: #ff4444; padding: 10px; border-radius: 4px; margin: 5px 0; }
    .log { font-size: 12px; border-bottom: 1px solid #333; padding: 5px; }
    .DEBUG { color: #888; }
    .INFO { color: #00ff88; }
    .WARN { color: #ffaa00; }
    .ERROR { color: #ff4444; }
    .FATAL { color: #ff00ff; }
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; padding: 8px; border-bottom: 1px solid #333; }
    th { color: #00ff88; }
  </style>
</head>
<body>
  <h1>🦆 Duck Bridge Dashboard</h1>
  <p>Uptime: ${Math.floor(health.uptime / 1000 / 60)} minutes | Logs: ${health.logs.total} | Errors: ${health.errors.total}</p>

  <div class="card">
    <h2>Protocol Health</h2>
    <table>
      <tr><th>Protocol</th><th>Status</th><th>Requests</th><th>Errors</th><th>Last Request</th><th>Last Error</th></tr>
      ${Object.entries(health.protocols).map(([name, p]) => `
        <tr>
          <td>${name.toUpperCase()}</td>
          <td><span class="protocol ${p.status}">${p.status}</span></td>
          <td>${p.requests}</td>
          <td>${p.errors}</td>
          <td>${p.lastRequest ? new Date(p.lastRequest).toLocaleTimeString() : 'Never'}</td>
          <td>${p.lastError ? new Date(p.lastError).toLocaleTimeString() : 'None'}</td>
        </tr>
      `).join('')}
    </table>
  </div>

  <div class="card">
    <h2>Recent Errors (${recentErrors.length})</h2>
    ${recentErrors.length === 0 ? '<p>No unresolved errors!</p>' : recentErrors.map(e => `
      <div class="error">
        <strong>[${e.protocol}] ${e.component}</strong>: ${e.message}
        <br><small>${new Date(e.timestamp).toLocaleString()}</small>
        ${e.stack ? `<pre style="font-size:10px;overflow:auto">${e.stack}</pre>` : ''}
      </div>
    `).join('')}
  </div>

  <div class="card">
    <h2>Recent Logs (${recentLogs.length})</h2>
    ${recentLogs.reverse().map(l => `
      <div class="log ${l.level}">
        [${l.timestamp.split('T')[1].split('.')[0]}] ${l.level} [${l.protocol}] ${l.component}: ${l.message}
        ${l.error ? `<br>ERROR: ${l.error.message}` : ''}
      </div>
    `).join('')}
  </div>

  <div class="card">
    <h2>API Endpoints</h2>
    <ul>
      <li><code>GET /health</code> - Full health status</li>
      <li><code>GET /logs?protocol=mcp&level=3&limit=50</code> - Query logs</li>
      <li><code>GET /errors?protocol=mcp&unresolved=true</code> - Query errors</li>
      <li><code>POST /resolve-error</code> - Mark error resolved (body: {"timestamp": "..."})</li>
      <li><code>WS /logs/stream</code> - Real-time log stream</li>
    </ul>
  </div>
</body>
</html>`;
  }
}

// Singleton
export const logger = new BridgeLogger();

export default logger;
