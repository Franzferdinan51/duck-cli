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
 * - Batched async file writes for performance
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

// Protocol-specific error codes (AI Council recommended)
export const ProtocolErrorCodes = {
  MCP: {
    INVALID_REQUEST: { code: 'MCP_001', severity: 'ERROR' },
    TOOL_NOT_FOUND: { code: 'MCP_002', severity: 'ERROR' },
    TOOL_EXECUTION_FAILED: { code: 'MCP_003', severity: 'ERROR' },
    PROTOCOL_VIOLATION: { code: 'MCP_004', severity: 'WARN' },
    TIMEOUT: { code: 'MCP_005', severity: 'WARN' },
  },
  ACP: {
    AGENT_CRASHED: { code: 'ACP_001', severity: 'FATAL' },
    TIMEOUT: { code: 'ACP_002', severity: 'WARN' },
    COMMUNICATION_ERROR: { code: 'ACP_003', severity: 'ERROR' },
    AGENT_DISCONNECTED: { code: 'ACP_004', severity: 'WARN' },
  },
  WEBSOCKET: {
    CONNECTION_FAILED: { code: 'WS_001', severity: 'ERROR' },
    MESSAGE_PARSE_ERROR: { code: 'WS_002', severity: 'ERROR' },
    AUTHENTICATION_FAILED: { code: 'WS_003', severity: 'FATAL' },
    CLIENT_DISCONNECTED: { code: 'WS_004', severity: 'INFO' },
  },
  REST: {
    ENDPOINT_NOT_FOUND: { code: 'REST_001', severity: 'WARN' },
    INVALID_JSON: { code: 'REST_002', severity: 'ERROR' },
    RATE_LIMITED: { code: 'REST_003', severity: 'WARN' },
  },
  SYSTEM: {
    SERVER_START: { code: 'SYS_001', severity: 'INFO' },
    SERVER_STOP: { code: 'SYS_002', severity: 'INFO' },
    CONFIG_ERROR: { code: 'SYS_003', severity: 'FATAL' },
    OUT_OF_MEMORY: { code: 'SYS_004', severity: 'FATAL' },
  }
} as const;

export interface LogEntry {
  timestamp: string;
  level: string;
  protocol: 'mcp' | 'acp' | 'websocket' | 'rest' | 'system' | 'agent';
  component: string;
  message: string;
  code?: string;  // Protocol error code
  errorType?: string;  // Type of error from ProtocolErrorCodes
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
  code?: string;  // Protocol error code
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

  // Batched async write properties
  private logQueue: LogEntry[] = [];
  private flushInterval = 100; // ms
  private maxQueueSize = 50;
  private flushTimer: NodeJS.Timeout | null = null;
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(logDir = '/tmp') {
    this.logFile = path.join(logDir, 'duck-bridge.log');
    
    // Start batch flush timer
    this.flushTimer = setInterval(() => this.flush(), this.flushInterval);
    
    this.startCleanup();
  }

  private startCleanup() {
    // Keep logs bounded
    this.cleanupTimer = setInterval(() => {
      if (this.logs.length > this.maxLogs) {
        this.logs = this.logs.slice(-this.maxLogs / 2);
      }
      if (this.errors.length > this.maxErrors) {
        this.errors = this.errors.slice(-this.maxErrors / 2);
      }
    }, 60000); // Every minute
  }

  // Get error code for protocol/errorType
  addErrorCode(protocol: keyof typeof ProtocolErrorCodes, errorType: string, metadata?: any): string {
    const protocolEntry = ProtocolErrorCodes[protocol] as Record<string, { code: string; severity: string }> | undefined;
    const errorDef = protocolEntry?.[errorType];
    const code = errorDef?.code || `${protocol}_UNKNOWN`;
    if (metadata && errorDef) {
      metadata.errorSeverity = errorDef.severity;
    }
    return code;
  }

  // Flush queued logs to disk (batched async write)
  private flush() {
    if (this.logQueue.length === 0) return;

    const batch = this.logQueue.splice(0);
    const content = batch.map(e => JSON.stringify(e)).join('\n') + '\n';

    // Async write (non-blocking)
    fs.appendFile(this.logFile, content, (err) => {
      if (err) {
        // Fallback to sync on error
        console.error('[Logger] Batch write failed, using sync:', err.message);
        fs.appendFileSync(this.logFile, content);
      }
    });
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

    // Console output (immediate)
    this.consoleLog(entry);

    // Broadcast to WebSocket (immediate)
    this.broadcast(entry);

    // Queue for batch file write
    this.logQueue.push(entry);

    // Auto-flush if queue is full
    if (this.logQueue.length >= this.maxQueueSize) {
      this.flush();
    }

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
        code: metadata?.code,
        stack: error?.stack,
        resolved: false
      });
      if (protocol !== 'system') {
        this.protocolStats[protocol].errors++;
        this.protocolStats[protocol].lastError = entry.timestamp;
      }
    }
    
    // Colored stderr for errors
    this.consoleError(entry);
  }

  private consoleLog(entry: LogEntry) {
    const isTTY = process.stdout.isTTY;
    
    if (isTTY) {
      // Color codes
      const levelColors: Record<string, string> = {
        DEBUG: '\x1b[90m',   // Bright black (gray)
        INFO: '\x1b[36m',    // Cyan
        WARN: '\x1b[33m',    // Yellow
        ERROR: '\x1b[31m',   // Red
        FATAL: '\x1b[35m',   // Magenta
      };
      
      const protocolColors: Record<string, string> = {
        mcp: '\x1b[34m',       // Blue
        acp: '\x1b[35m',      // Magenta
        websocket: '\x1b[36m', // Cyan
        rest: '\x1b[33m',      // Yellow
        system: '\x1b[37m',    // White
        agent: '\x1b[32m',     // Green
      };
      
      const reset = '\x1b[0m';
      const level = levelColors[entry.level] || reset;
      const proto = protocolColors[entry.protocol] || reset;
      
      // Format: [LEVEL] [PROTOCOL] component: message
      const timestamp = entry.timestamp.split('T')[1].split('.')[0];
      const header = `${level}[${entry.level}]${reset} ${proto}[${entry.protocol}]${reset}`;
      const msg = `${entry.component}: ${entry.message}`;
      
      // Add error indicator for errors
      const errorSuffix = entry.error ? ` ${level}✗ ${entry.error.message}${reset}` : '';
      
      console.log(`${timestamp} ${header} ${msg}${errorSuffix}`);
    } else {
      // JSON for piping/redirects
      console.log(JSON.stringify(entry));
    }
  }

  private consoleError(entry: LogEntry) {
    if (entry.level === 'ERROR' || entry.level === 'FATAL') {
      const isTTY = process.stderr.isTTY;
      if (isTTY) {
        const levelColors: Record<string, string> = {
          ERROR: '\x1b[31m',
          FATAL: '\x1b[35m',
        };
        const reset = '\x1b[0m';
        const color = levelColors[entry.level] || reset;
        console.error(`${color}[${entry.level}]${reset} ${entry.component}: ${entry.message}`);
        if (entry.error?.stack) {
          console.error(entry.error.stack);
        }
      } else {
        console.error(JSON.stringify(entry));
      }
    }
  }

  // Broadcast to WebSocket subscribers (public for LiveErrorStream integration)
  broadcast(entry: LogEntry): void {
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

  // Graceful shutdown - flush remaining logs and clear timers
  async shutdown() {
    // Flush remaining logs
    this.flush();

    // Clear timers
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
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
        // WebSocket upgrade - ws 8.x handles this via WebSocketServer
        // Create WebSocket directly for streaming to logger subscribers
        // @ts-ignore - ws 8.x ServerWebSocket constructor accepts (request, socket, head)
        const ws = new WebSocket(req, res, undefined);
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

  getDashboardHTML(): string {
    const health = this.getHealth();
    const recentLogs = this.getLogs({ limit: 30 });
    const recentErrors = this.getErrors(undefined, true).slice(0, 10);

    return `<!DOCTYPE html>
<html>
<head>
  <title>Duck Bridge Dashboard</title>
  <meta http-equiv="refresh" content="5">
  <style>
    * { box-sizing: border-box; }
    body { font-family: 'SF Mono', Monaco, monospace; background: #0d1117; color: #c9d1d9; padding: 20px; margin: 0; }
    h1 { color: #58a6ff; font-size: 24px; margin-bottom: 20px; }
    h2 { color: #8b949e; font-size: 14px; text-transform: uppercase; margin-top: 30px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 15px; }
    .card { background: #161b22; border: 1px solid #30363d; border-radius: 6px; padding: 15px; }
    .status { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; }
    .healthy { background: #238636; color: #fff; }
    .degraded { background: #d29922; color: #fff; }
    .down { background: #da3633; color: #fff; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { text-align: left; padding: 8px; border-bottom: 1px solid #30363d; }
    th { color: #58a6ff; }
    .log-entry { padding: 8px; border-bottom: 1px solid #21262d; font-size: 12px; }
    .DEBUG { color: #6e7681; }
    .INFO { color: #58a6ff; }
    .WARN { color: #d29922; }
    .ERROR { color: #da3633; }
    .FATAL { color: #f85149; background: #490202; }
    .protocol { color: #a371f7; }
    .uptime { font-size: 12px; color: #8b949e; }
    .api { margin-top: 20px; padding: 15px; background: #161b22; border-radius: 6px; }
    code { background: #21262d; padding: 2px 6px; border-radius: 3px; color: #79c0ff; }
  </style>
</head>
<body>
  <h1>🦆 Duck Bridge Dashboard</h1>
  <p class="uptime">Uptime: ${Math.floor(health.uptime / 1000 / 60)}min | Logs: ${health.logs.total} | Errors: ${health.errors.total}</p>

  <h2>Protocol Health</h2>
  <div class="grid">
    ${Object.entries(health.protocols).map(([name, p]) => `
      <div class="card">
        <h3>${name.toUpperCase()}</h3>
        <span class="status ${p.status}">${p.status}</span>
        <p>Requests: ${p.requests} | Errors: ${p.errors}</p>
        <p class="uptime">Last: ${p.lastRequest ? new Date(p.lastRequest).toLocaleTimeString() : 'Never'}</p>
      </div>
    `).join('')}
  </div>

  <h2>Recent Errors (${recentErrors.length})</h2>
  <div class="card">
    ${recentErrors.length === 0 ? '<p>No unresolved errors!</p>' :
      recentErrors.map(e => `
        <div class="log-entry ERROR">
          <span class="protocol">[${e.protocol}]</span> ${e.component}: ${e.message}
          <br><small>${new Date(e.timestamp).toLocaleString()}</small>
        </div>
      `).join('')}
  </div>

  <h2>Recent Logs</h2>
  <div class="card">
    ${recentLogs.slice(-20).reverse().map(l => `
      <div class="log-entry ${l.level}">
        [${l.timestamp.split('T')[1].split('.')[0]}] <span class="protocol">${l.level}</span> <span class="protocol">[${l.protocol}]</span> ${l.component}: ${l.message}
      </div>
    `).join('')}
  </div>

  <div class="api">
    <h2>API Endpoints</h2>
    <ul>
      <li><code>GET /health</code> - Full health status</li>
      <li><code>GET /logs?protocol=mcp&level=3&limit=50</code> - Query logs</li>
      <li><code>GET /errors?unresolved=true</code> - Error list</li>
      <li><code>WS /logs/stream</code> - Real-time WebSocket stream</li>
    </ul>
  </div>
</body>
</html>`;
  }
}

// Singleton
export const logger = new BridgeLogger();

export default logger;
