/**
 * 🦆 Duck Agent - Bidirectional WebSocket Manager
 * Supports both:
 * - Inbound: Accept incoming WebSocket connections (server mode)
 * - Outbound: Connect to external WebSocket servers (client mode)
 */

import { EventEmitter } from 'events';
import { WebSocket, WebSocketServer } from 'ws';
import { createServer, Server as HTTPServer } from 'http';
import http from 'http';
import { URL } from 'url';
import { logger } from '../server/logger.js';

export interface WSConfig {
  port?: number;
  host?: string;
  path?: string;
  maxConnections?: number;
  pingInterval?: number;
  pingTimeout?: number;
  frameSize?: number;
  PerMessageDeflate?: boolean;
}

export interface WSClient {
  id: string;
  ws: WebSocket;
  remoteAddress?: string;
  connectedAt: number;
  lastActivity?: number;
  metadata?: Record<string, any>;
  isOutbound?: boolean;
  serverUrl?: string;
}

export interface WSMessage {
  type: 'text' | 'binary' | 'ping' | 'pong' | 'control';
  data: any;
  from?: string;
  timestamp?: number;
}

/**
 * Bidirectional WebSocket Manager
 *
 * Features:
 * - Server mode: Accept incoming connections
 * - Client mode: Connect to external servers
 * - Both modes work simultaneously
 * - Auto-reconnection for outbound connections
 * - Heartbeat/ping-pong
 * - Message framing and batching
 */
export class WebSocketManager extends EventEmitter {
  private config: Required<WSConfig>;
  private httpServer: HTTPServer | null = null;
  private wss: WebSocketServer | null = null;
  private inboundClients: Map<string, WSClient> = new Map();
  private outboundClients: Map<string, WSClient> = new Map();
  private reconnectTimers: Map<string, NodeJS.Timeout> = new Map();
  private pingInterval: NodeJS.Timeout | null = null;
  private messageQueue: Map<string, (WSMessage | string)[]> = new Map();

  constructor(config: WSConfig = {}) {
    super();
    this.config = {
      port: config.port || 18796,
      host: config.host || 'localhost',
      path: config.path || '/ws',
      maxConnections: config.maxConnections || 100,
      pingInterval: config.pingInterval || 30000,
      pingTimeout: config.pingTimeout || 5000,
      frameSize: config.frameSize || 65536,
      PerMessageDeflate: config.PerMessageDeflate ?? true,
    };
  }

  // ============ SERVER MODE (INBOUND) ============

  /**
   * Start WebSocket server (accepts incoming connections)
   */
  async startServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.httpServer = createServer();

      this.wss = new WebSocketServer({
        server: this.httpServer,
        path: this.config.path,
        maxPayload: this.config.frameSize,
        clientTracking: true,
      });

      // Compression
      this.wss.on('connection', (ws: WebSocket, req: http.IncomingMessage) => {
        this.handleInboundConnection(ws, req);
      });

      this.wss.on('error', (error) => {
        console.error('[WS] Server error:', error.message);
        logger.error('websocket', 'WebSocketManager', `Server error: ${error.message}`, error, { code: 'WS_001' });
        this.emit('error', error);
      });

      this.httpServer.on('error', (err) => {
        logger.error('websocket', 'WebSocketManager', `HTTP server error: ${err.message}`, err, { code: 'WS_001' });
        reject(err);
      });

      this.httpServer.listen(this.config.port, this.config.host, () => {
        console.log(`\n🦆 WebSocket Server running on ws://${this.config.host}:${this.config.port}${this.config.path}`);
        logger.info('websocket', 'WebSocketManager', `WebSocket server started on port ${this.config.port}`, {
          port: this.config.port,
          host: this.config.host,
          path: this.config.path,
        });
        this.emit('server:started', { port: this.config.port, host: this.config.host });
        resolve();
      });
    });
  }

  private handleInboundConnection(ws: WebSocket, req: http.IncomingMessage): void {
    const clientId = `inb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const client: WSClient = {
      id: clientId,
      ws,
      remoteAddress: req.socket.remoteAddress,
      connectedAt: Date.now(),
      lastActivity: Date.now(),
      isOutbound: false,
    };

    this.inboundClients.set(clientId, client);
    console.log(`[WS] Inbound client connected: ${clientId} from ${client.remoteAddress}`);
    logger.info('websocket', 'WebSocketManager', `Inbound client connected: ${clientId} from ${client.remoteAddress}`, { clientId, remoteAddress: client.remoteAddress });
    this.emit('client:connected', client);

    ws.on('message', (data, isBinary) => {
      client.lastActivity = Date.now();
      this.handleMessage(client, data, isBinary);
    });

    ws.on('pong', () => {
      client.lastActivity = Date.now();
      this.emit('client:pong', client);
    });

    ws.on('close', (code, reason) => {
      console.log(`[WS] Inbound client disconnected: ${clientId} (${code})`);
      logger.info('websocket', 'WebSocketManager', `Inbound client disconnected: ${clientId} (${code})`, { clientId, code });
      this.inboundClients.delete(clientId);
      this.messageQueue.delete(clientId);
      this.emit('client:disconnected', { client, code, reason: reason?.toString() });
    });

    ws.on('error', (error) => {
      console.error(`[WS] Client ${clientId} error:`, error.message);
      logger.error('websocket', 'WebSocketManager', `Client ${clientId} error: ${error.message}`, error, { clientId, code: 'WS_003' });
      this.emit('client:error', { client, error });
    });

    // Send welcome
    this.sendToClient(clientId, { type: 'control', data: { event: 'connected', clientId } });
  }

  // ============ CLIENT MODE (OUTBOUND) ============

  /**
   * Connect to an external WebSocket server
   */
  async connectTo(url: string, metadata?: Record<string, any>): Promise<string> {
    const clientId = `outb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url);

      const client: WSClient = {
        id: clientId,
        ws,
        connectedAt: Date.now(),
        lastActivity: Date.now(),
        metadata,
        isOutbound: true,
        serverUrl: url,
      };

      this.outboundClients.set(clientId, client);
      this.messageQueue.set(clientId, []);

      ws.on('open', () => {
        console.log(`[WS] Connected to ${url} as ${clientId}`);
        logger.info('websocket', 'WebSocketManager', `Connected to ${url} as ${clientId}`, { clientId, url });
        client.lastActivity = Date.now();
        this.emit('connected', { client, url });
        resolve(clientId);
      });

      ws.on('message', (data, isBinary) => {
        client.lastActivity = Date.now();
        this.handleMessage(client, data, isBinary);
      });

      ws.on('pong', () => {
        client.lastActivity = Date.now();
      });

      ws.on('close', (code, reason) => {
        console.log(`[WS] Disconnected from ${url}: ${clientId} (${code})`);
        logger.info('websocket', 'WebSocketManager', `Disconnected from ${url}: ${clientId} (${code})`, { clientId, url, code });
        this.outboundClients.delete(clientId);
        this.messageQueue.delete(clientId);
        this.emit('disconnected', { client, code, reason: reason?.toString(), url });

        // Auto-reconnect
        if (!client.metadata?.manualClose) {
          this.scheduleReconnect(clientId, url, metadata);
        }
      });

      ws.on('error', (error) => {
        console.error(`[WS] Connection error to ${url}:`, error.message);
        logger.error('websocket', 'WebSocketManager', `Connection error to ${url}: ${error.message}`, error, { clientId, url, code: 'WS_001' });
        this.emit('error', { client, error, url });
        if (this.outboundClients.has(clientId)) {
          reject(error);
        }
      });
    });
  }

  private scheduleReconnect(clientId: string, url: string, metadata?: Record<string, any>): void {
    const client = this.outboundClients.get(clientId);
    if (client?.metadata?.manualClose) return;

    const existing = this.reconnectTimers.get(clientId);
    if (existing) clearTimeout(existing);

    console.log(`[WS] Scheduling reconnect for ${clientId} in 5s...`);
    logger.info('websocket', 'WebSocketManager', `Scheduling reconnect for ${clientId} in 5s`, { clientId, url });
    const timer = setTimeout(async () => {
      this.reconnectTimers.delete(clientId);
      try {
        await this.connectTo(url, metadata);
      } catch (e) {
        console.error(`[WS] Reconnect failed for ${clientId}:`, e);
        logger.error('websocket', 'WebSocketManager', `Reconnect failed for ${clientId}: ${(e as Error).message}`, e as Error, { clientId });
      }
    }, 5000);

    this.reconnectTimers.set(clientId, timer);
  }

  /**
   * Disconnect from an external server
   */
  disconnectFrom(clientId: string): void {
    const client = this.outboundClients.get(clientId);
    if (!client) return;

    client.metadata = { ...client.metadata, manualClose: true };

    const timer = this.reconnectTimers.get(clientId);
    if (timer) {
      clearTimeout(timer);
      this.reconnectTimers.delete(clientId);
    }

    client.ws.close(1000, 'Manual disconnect');
  }

  // ============ MESSAGE HANDLING ============

  private handleMessage(client: WSClient, data: any, isBinary: boolean): void {
    try {
      let parsed: any;

      if (isBinary) {
        const str = data.toString('utf-8');
        try {
          parsed = JSON.parse(str);
        } catch {
          parsed = { raw: data };
        }
      } else {
        try {
          parsed = JSON.parse(data.toString());
        } catch {
          parsed = { raw: data.toString() };
        }
      }

      const message: WSMessage = {
        type: isBinary ? 'binary' : 'text',
        data: parsed,
        from: client.id,
        timestamp: Date.now(),
      };

      this.emit('message', message);

      // Handle control messages
      if (parsed.type === 'ping') {
        this.sendToClient(client.id, { type: 'pong', data: { ts: Date.now() } });
      } else if (parsed.type === 'subscribe') {
        client.metadata = { ...client.metadata, channels: parsed.channels };
        this.sendToClient(client.id, { type: 'control', data: { event: 'subscribed', channels: parsed.channels } });
      }

    } catch (error: any) {
      console.error(`[WS] Failed to handle message from ${client.id}:`, error.message);
      logger.error('websocket', 'WebSocketManager', `Failed to handle message from ${client.id}: ${error.message}`, error, { clientId: client.id, code: 'WS_002' });
    }
  }

  // ============ SEND MESSAGES ============

  /**
   * Send message to a specific client (by ID)
   */
  sendToClient(clientId: string, message: WSMessage | any): boolean {
    const msg = typeof message === 'string' ? message : JSON.stringify(message);

    const inbound = this.inboundClients.get(clientId);
    if (inbound?.ws.readyState === WebSocket.OPEN) {
      inbound.ws.send(msg);
      return true;
    }

    const outbound = this.outboundClients.get(clientId);
    if (outbound?.ws.readyState === WebSocket.OPEN) {
      outbound.ws.send(msg);
      return true;
    }

    const queue = this.messageQueue.get(clientId);
    if (queue) {
      queue.push(message);
      return false;
    }

    return false;
  }

  /**
   * Broadcast to all connected clients
   */
  broadcast(message: WSMessage | any, filter?: (client: WSClient) => boolean): void {
    const msg = typeof message === 'string' ? message : JSON.stringify(message);
    const inboundList = Array.from(this.inboundClients.values());
    const outboundList = Array.from(this.outboundClients.values());
    const clients = filter ? [...inboundList, ...outboundList].filter(filter) : [...inboundList, ...outboundList];

    for (const client of clients) {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(msg);
      }
    }
  }

  /**
   * Send to all inbound (server mode) clients
   */
  broadcastInbound(message: WSMessage | any, filter?: (client: WSClient) => boolean): void {
    const msg = typeof message === 'string' ? message : JSON.stringify(message);
    const inboundClients = Array.from(this.inboundClients.values());
    const clients = filter ? inboundClients.filter(filter) : inboundClients;

    for (const client of clients) {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(msg);
      }
    }
  }

  /**
   * Send to all outbound (client mode) connections
   */
  broadcastOutbound(message: WSMessage | any, filter?: (client: WSClient) => boolean): void {
    const msg = typeof message === 'string' ? message : JSON.stringify(message);
    const outboundClients = Array.from(this.outboundClients.values());
    const clients = filter ? outboundClients.filter(filter) : outboundClients;

    for (const client of clients) {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(msg);
      }
    }
  }

  /**
   * Send to clients subscribed to a channel
   */
  broadcastToChannel(channel: string, message: WSMessage | any): void {
    this.broadcast(message, (client) => {
      const channels = client.metadata?.channels || [];
      return channels.includes(channel) || channels.includes('*');
    });
  }

  /**
   * Forward a message to all connected OpenClaw gateways
   */
  async forwardToOpenClaw(message: any): Promise<void> {
    const msg = typeof message === 'string' ? message : JSON.stringify(message);

    for (const client of this.outboundClients.values()) {
      if (client.serverUrl?.includes('openclaw') && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(msg);
      }
    }
  }

  // ============ HEARTBEAT ============

  private startHeartbeat(): void {
    if (this.pingInterval) return;

    this.pingInterval = setInterval(() => {
      const now = Date.now();

      for (const [id, client] of this.inboundClients) {
        if (now - (client.lastActivity || 0) > this.config.pingTimeout) {
          console.log(`[WS] Client ${id} ping timeout, closing`);
          logger.warn('websocket', 'WebSocketManager', `Client ${id} ping timeout, closing`, { clientId: id });
          client.ws.terminate();
          this.inboundClients.delete(id);
          continue;
        }

        if (client.ws.readyState === WebSocket.OPEN) {
          client.ws.ping();
        }
      }

      for (const [id, client] of this.outboundClients) {
        if (now - (client.lastActivity || 0) > this.config.pingTimeout) {
          console.log(`[WS] Outbound ${id} ping timeout`);
          logger.warn('websocket', 'WebSocketManager', `Outbound ${id} ping timeout`, { clientId: id });
          client.ws.terminate();
          continue;
        }

        if (client.ws.readyState === WebSocket.OPEN) {
          client.ws.ping();
        }
      }
    }, this.config.pingInterval);
  }

  private stopHeartbeat(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  // ============ STATUS & MANAGEMENT ============

  /**
   * Get all connected clients
   */
  getClients(): { inbound: WSClient[]; outbound: WSClient[] } {
    return {
      inbound: Array.from(this.inboundClients.values()),
      outbound: Array.from(this.outboundClients.values()),
    };
  }

  /**
   * Get client by ID
   */
  getClient(clientId: string): WSClient | undefined {
    return this.inboundClients.get(clientId) || this.outboundClients.get(clientId);
  }

  /**
   * Get status info
   */
  getStatus(): any {
    return {
      server: {
        running: !!this.httpServer,
        port: this.config.port,
        host: this.config.host,
        path: this.config.path,
      },
      clients: {
        inbound: this.inboundClients.size,
        outbound: this.outboundClients.size,
        total: this.inboundClients.size + this.outboundClients.size,
        max: this.config.maxConnections,
      },
      reconnecting: this.reconnectTimers.size,
      queued: Array.from(this.messageQueue.entries()).filter(([, q]) => q.length > 0).map(([id, q]) => ({ id, queued: q.length })),
    };
  }

  /**
   * Close a specific client connection
   */
  closeClient(clientId: string, code: number = 1000, reason: string = 'Server close'): void {
    const client = this.inboundClients.get(clientId) || this.outboundClients.get(clientId);
    if (client) {
      client.ws.close(code, reason);
    }
  }

  /**
   * Stop WebSocket manager and cleanup
   */
  async stop(): Promise<void> {
    this.stopHeartbeat();

    for (const timer of this.reconnectTimers.values()) {
      clearTimeout(timer);
    }
    this.reconnectTimers.clear();

    for (const client of this.outboundClients.values()) {
      client.metadata = { ...client.metadata, manualClose: true };
      client.ws.close(1000, 'Server shutdown');
    }
    this.outboundClients.clear();

    for (const client of this.inboundClients.values()) {
      client.ws.close(1000, 'Server shutdown');
    }
    this.inboundClients.clear();

    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }

    if (this.httpServer) {
      await new Promise<void>((resolve) => {
        this.httpServer!.close(() => resolve());
      });
      this.httpServer = null;
    }

    console.log('[WS] Manager stopped');
    logger.info('websocket', 'WebSocketManager', 'WebSocket Manager stopped');
  }
}

export default WebSocketManager;
