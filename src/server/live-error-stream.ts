/**
 * 🦆 Duck Agent Bridge - Live Error Stream via WebSocket
 * Streams real-time error events to subscribed clients
 * Supports admin filtering (admin clients see everything, regular clients see WARN+)
 */

import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { LogLevel, LogEntry, logger } from './logger.js';
import { DEFAULT_LIVE_ERROR_PORT } from '../config/index.js';

export interface LiveStreamConfig {
  levels?: LogLevel[];
  protocols?: string[];
  includeStackTraces?: boolean;
}

interface Subscriber {
  ws: WebSocket;
  filters: LiveStreamConfig;
  isAdmin: boolean;
}

export class LiveErrorStream {
  private subscribers: Map<string, Subscriber> = new Map();
  private wss: WebSocketServer;
  private server: http.Server;

  constructor(port: number = DEFAULT_LIVE_ERROR_PORT) {
    this.server = http.createServer();
    this.wss = new WebSocketServer({ server: this.server });

    this.wss.on('connection', (ws, req) => this.handleConnection(ws, req));

    // Wire into existing logger
    this.integrateWithLogger();

    this.server.listen(port, () => {
      console.log(`🦆 Live Error Stream: ws://localhost:${port}/errors`);
    });
  }

  private integrateWithLogger(): void {
    // Intercept logger.broadcast to filter per-client
    const originalBroadcast = logger.broadcast.bind(logger);
    logger.broadcast = (entry: LogEntry) => {
      this.streamToFilteredClients(entry);
      originalBroadcast(entry);
    };
  }

  private streamToFilteredClients(entry: LogEntry): void {
    for (const [clientId, client] of this.subscribers) {
      if (this.shouldDeliver(entry, client)) {
        try {
          client.ws.send(JSON.stringify({
            type: 'live_error',
            ...this.formatEntry(entry, client.isAdmin)
          }));
        } catch (err) {
          // Client disconnected, clean up
          this.subscribers.delete(clientId);
        }
      }
    }
  }

  private shouldDeliver(entry: LogEntry, client: Subscriber): boolean {
    // Admins get everything
    if (client.isAdmin) return true;
    // Non-admins only get WARN and above
    const levelNum = LogLevel[entry.level as keyof typeof LogLevel] ?? 0;
    if (levelNum < LogLevel.WARN) return false;
    return true;
  }

  private formatEntry(entry: LogEntry, includeStack: boolean): any {
    return {
      timestamp: entry.timestamp,
      level: entry.level,
      protocol: entry.protocol,
      component: entry.component,
      message: entry.message,
      error: entry.error ? {
        name: entry.error.name,
        message: entry.error.message,
        stack: includeStack ? entry.error.stack : undefined
      } : undefined
    };
  }

  private handleConnection(ws: WebSocket, req: http.IncomingMessage): void {
    const url = new URL(req.url || '/', 'http://localhost');
    const clientId = `client_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const isAdmin = url.searchParams.get('admin') === 'true';

    this.subscribers.set(clientId, {
      ws,
      filters: { levels: [LogLevel.WARN, LogLevel.ERROR, LogLevel.FATAL] },
      isAdmin
    });

    console.log(`[LiveErrorStream] Client connected: ${clientId} (admin: ${isAdmin})`);

    ws.send(JSON.stringify({ type: 'subscribed', clientId, isAdmin }));

    ws.on('close', () => {
      console.log(`[LiveErrorStream] Client disconnected: ${clientId}`);
      this.subscribers.delete(clientId);
    });

    ws.on('error', (err) => {
      console.error(`[LiveErrorStream] Client error: ${clientId}`, err.message);
      this.subscribers.delete(clientId);
    });

    // Handle ping/pong
    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
        }
      } catch {
        // Ignore malformed messages
      }
    });
  }

  broadcastError(entry: LogEntry): void {
    this.streamToFilteredClients(entry);
  }

  async stop(): Promise<void> {
    for (const [clientId] of this.subscribers) {
      const client = this.subscribers.get(clientId);
      if (client) {
        try {
          client.ws.close();
        } catch {
          // Already closed
        }
      }
    }
    this.subscribers.clear();

    return new Promise((resolve) => {
      this.wss.close(() => {
        this.server.close(() => resolve());
      });
    });
  }
}

export default LiveErrorStream;
