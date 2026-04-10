/**
 * 🦆 Duck Agent - Unified Headless Server
 * Integrates MCP + ACP + WebSocket for full headless operation
 */

import { EventEmitter } from 'events';
import http from 'http';
import { WebSocket } from 'ws';
import { MCPServer } from './mcp-server.js';
import { ACPClient } from '../gateway/acp-client.js';
import { WebSocketManager } from '../gateway/websocket-manager.js';
import { Agent } from '../agent/core.js';
import { logger } from './logger.js';

export interface UnifiedServerConfig {
  mcpPort?: number;
  acpPort?: number;
  wsPort?: number;
  gatewayPort?: number;
  enableMCP?: boolean;
  enableACP?: boolean;
  enableWebSocket?: boolean;
  enableGateway?: boolean;
  acpConfig?: Parameters<typeof ACPClient.prototype.updateConfig>[0];
  wsConfig?: Parameters<typeof WebSocketManager.prototype.getStatus>['wsPort' extends keyof Parameters<typeof WebSocketManager.prototype.getStatus> ? never : never] extends never ? {} : {};
}

interface ExternalMCPServer {
  url: string;
  name: string;
  connected: boolean;
  ws?: WebSocket;
  lastPing?: number;
}

/**
 * Unified Server - All headless protocols in one
 * 
 * Provides:
 * - MCP Server (port configurable, default 3850)
 * - ACP Client (spawn Codex, Claude, Pi, etc.)
 * - WebSocket Manager (bidirectional)
 * - Gateway API (OpenAI-compatible)
 */
export class UnifiedServer extends EventEmitter {
  private agent: Agent;
  private config: Required<UnifiedServerConfig>;
  
  // Servers
  private mcpServer: MCPServer | null = null;
  private acpClient: ACPClient | null = null;
  private wsManager: WebSocketManager | null = null;
  private gatewayServer: http.Server | null = null;
  
  // External connections
  private externalMCPServers: Map<string, ExternalMCPServer> = new Map();
  
  // Status
  private startedAt: number = 0;
  private status: 'stopped' | 'starting' | 'running' | 'error' = 'stopped';

  constructor(agent: Agent, config: UnifiedServerConfig = {}) {
    super();
    this.agent = agent;
    this.config = {
      mcpPort: config.mcpPort ?? 3850,
      acpPort: config.acpPort ?? 18794,
      wsPort: config.wsPort ?? 18796,
      gatewayPort: config.gatewayPort ?? 18792,
      enableMCP: config.enableMCP ?? true,
      enableACP: config.enableACP ?? true,
      enableWebSocket: config.enableWebSocket ?? true,
      enableGateway: config.enableGateway ?? true,
      acpConfig: config.acpConfig || {},
      wsConfig: config.wsConfig || {},
    };
  }

  /**
   * Start all enabled servers
   */
  async start(): Promise<void> {
    if (this.status === 'running') {
      logger.info('system', 'UnifiedServer', 'Already running');
      return;
    }

    this.status = 'starting';
    this.startedAt = Date.now();
    const errors: Error[] = [];

    // Keep banner for user-facing startup (TTY stdout)
    console.log('\n═══════════════════════════════════════════');
    console.log('  🦆 Duck Agent Unified Headless Server');
    console.log('═══════════════════════════════════════════\n');

    // Start MCP Server
    if (this.config.enableMCP) {
      try {
        this.mcpServer = new MCPServer(this.config.mcpPort);
        await this.mcpServer.start();
        console.log(`  ✓ MCP Server:      ws://localhost:${this.config.mcpPort}/ws`);
        logger.info('mcp', 'UnifiedServer', `MCP Server started on port ${this.config.mcpPort}`, { port: this.config.mcpPort });
      } catch (e: any) {
        errors.push(e);
        console.error(`  ✗ MCP Server failed: ${e.message}`);
        logger.error('mcp', 'UnifiedServer', `MCP Server failed to start: ${e.message}`, e, { port: this.config.mcpPort, code: 'MCP_001' });
      }
    }

    // Start ACP Client
    if (this.config.enableACP) {
      try {
        this.acpClient = new ACPClient(this.agent, this.config.acpConfig);
        await this.acpClient.startGateway();
        console.log(`  ✓ ACP Gateway:    ws://localhost:${this.config.acpPort}/acp`);
        logger.info('acp', 'UnifiedServer', `ACP Gateway started on port ${this.config.acpPort}`, { port: this.config.acpPort });
      } catch (e: any) {
        errors.push(e);
        console.error(`  ✗ ACP Gateway failed: ${e.message}`);
        logger.error('acp', 'UnifiedServer', `ACP Gateway failed to start: ${e.message}`, e, { port: this.config.acpPort, code: 'ACP_003' });
      }
    }

    // Start WebSocket Manager
    if (this.config.enableWebSocket) {
      try {
        this.wsManager = new WebSocketManager({ port: this.config.wsPort });
        await this.wsManager.startServer();
        
        // Handle messages
        this.wsManager.on('message', (msg) => {
          this.handleWSMessage(msg);
        });

        this.wsManager.on('client:connected', (client) => {
          logger.info('websocket', 'UnifiedServer', `Client connected: ${client.id}`, { clientId: client.id });
          this.emit('client:connected', client);
        });

        this.wsManager.on('client:disconnected', ({ client }) => {
          this.emit('client:disconnected', client);
        });

        console.log(`  ✓ WebSocket:      ws://localhost:${this.config.wsPort}/ws`);
        logger.info('websocket', 'UnifiedServer', `WebSocket server started on port ${this.config.wsPort}`, { port: this.config.wsPort });
      } catch (e: any) {
        errors.push(e);
        console.error(`  ✗ WebSocket failed: ${e.message}`);
        logger.error('websocket', 'UnifiedServer', `WebSocket server failed to start: ${e.message}`, e, { port: this.config.wsPort, code: 'WS_001' });
      }
    }

    // Start Gateway API
    if (this.config.enableGateway) {
      try {
        await this.startGateway();
        console.log(`  ✓ Gateway API:    http://localhost:${this.config.gatewayPort}/v1`);
        logger.info('rest', 'UnifiedServer', `Gateway API started on port ${this.config.gatewayPort}`, { port: this.config.gatewayPort });
      } catch (e: any) {
        errors.push(e);
        console.error(`  ✗ Gateway failed: ${e.message}`);
        logger.error('rest', 'UnifiedServer', `Gateway API failed to start: ${e.message}`, e, { port: this.config.gatewayPort, code: 'REST_001' });
      }
    }

    console.log('\n═══════════════════════════════════════════');

    if (errors.length > 0 && errors.length === Object.values(this.config).filter(v => v === true).length) {
      this.status = 'error';
      logger.fatal('system', 'UnifiedServer', `All servers failed to start: ${errors.map(e => e.message).join(', ')}`);
      throw new Error(`All servers failed: ${errors.map(e => e.message).join(', ')}`);
    }

    this.status = 'running';
    this.emit('started');
    
    console.log(`\n  Status: RUNNING`);
    console.log(`  Uptime: ${this.getUptime()}`);
    console.log(`\n  Use duck mcp --help for MCP tools`);
    console.log(`  Use /acp spawn for ACP sessions\n`);

    if (errors.length > 0) {
      console.log(`  ⚠ ${errors.length} server(s) failed - see above\n`);
      logger.warn('system', 'UnifiedServer', `${errors.length} server(s) failed to start — see above`);
    } else {
      logger.info('system', 'UnifiedServer', `Unified server running. Uptime: ${this.getUptime()}`);
    }
  }

  /**
   * Start Gateway API (OpenAI-compatible)
   */
  private async startGateway(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.gatewayServer = http.createServer(async (req: any, res: any) => {
        const url = new URL(req.url || '/', `http://localhost:${this.config.gatewayPort}`);
        
        // CORS
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        
        if (req.method === 'OPTIONS') {
          res.writeHead(204);
          res.end();
          return;
        }

        try {
          if (url.pathname === '/health') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'ok', service: 'duck-agent-unified' }));
          } else if (url.pathname === '/logger/health') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(logger.getHealth(), null, 2));
          } else if (url.pathname === '/logger/logs') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            const logs = logger.getLogs({ limit: parseInt(url.searchParams.get('limit') || '50') });
            res.end(JSON.stringify(logs, null, 2));
          } else if (url.pathname === '/logger/errors') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(logger.getErrors(), null, 2));
          } else if (url.pathname === '/status') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(this.getStatus()));
          } else if (url.pathname === '/v1/models') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              object: 'list',
              data: [
                { id: 'duck-agent', object: 'model', created: Date.now(), owned_by: 'duck-agent' }
              ]
            }));
          } else if (url.pathname === '/v1/chat/completions') {
            await this.handleChatCompletion(req, res);
          } else if (url.pathname === '/v1/completions') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ choices: [{ text: 'Use /v1/chat/completions instead' }] }));
          } else if (url.pathname === '/mcp/connect') {
            // Connect to external MCP server
            const serverUrl = url.searchParams.get('url');
            if (serverUrl) {
              await this.connectToExternalMCP(serverUrl);
              res.writeHead(200);
              res.end(JSON.stringify({ connected: true, url: serverUrl }));
            } else {
              res.writeHead(400);
              res.end(JSON.stringify({ error: 'url parameter required' }));
            }
          } else if (url.pathname === '/mcp/servers') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ servers: Array.from(this.externalMCPServers.entries()).map(([id, s]) => ({
              id, name: s.name, url: s.url, connected: s.connected
            }))}));
          } else if (url.pathname === '/acp/sessions') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ sessions: this.acpClient?.listSessions() || [] }));
          } else if (url.pathname === '/ws/clients') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(this.wsManager?.getStatus() || { clients: { inbound: 0, outbound: 0 } }));
          } else {
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end('🦆 Duck Agent Unified Server\n\nEndpoints:\n  /health - Health check\n  /status - Full status\n  /v1/chat/completions - OpenAI-compatible API\n  /mcp/connect?url= - Connect to external MCP\n  /mcp/servers - List connected MCP servers\n  /acp/sessions - ACP session management\n  /ws/clients - WebSocket client status\n');
          }
        } catch (e: any) {
          res.writeHead(500);
          res.end(JSON.stringify({ error: e.message }));
        }
      });

      this.gatewayServer.on('error', reject);

      this.gatewayServer.listen(this.config.gatewayPort, () => {
        resolve();
      });
    });
  }

  /**
   * Handle OpenAI-compatible chat completions
   */
  private async handleChatCompletion(req: any, res: any): Promise<void> {
    let body = '';
    req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
    req.on('end', async () => {
      try {
        const { messages, model, temperature, max_tokens, stream } = JSON.parse(body || '{}');
        
        if (stream) {
          res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });
          
          // Streaming response
          const lastMessage = messages?.[messages.length - 1]?.content || '';
          const response = await this.agent.think(lastMessage);
          
          // Stream chunks
          const chunks = response.split(' ');
          for (const chunk of chunks) {
            res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: chunk + ' ' } }] })}\n\n`);
            await new Promise(r => setTimeout(r, 10));
          }
          res.write('data: [DONE]\n\n');
          res.end();
        } else {
          const lastMessage = messages?.[messages.length - 1]?.content || '';
          const response = await this.agent.think(lastMessage);
          
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            id: `chat_${Date.now()}`,
            object: 'chat.completion',
            created: Date.now(),
            model: model || 'duck-agent',
            choices: [{
              index: 0,
              message: { role: 'assistant', content: response },
              finish_reason: 'stop',
            }],
            usage: { prompt_tokens: lastMessage.length, completion_tokens: response.length, total_tokens: lastMessage.length + response.length }
          }));
        }
      } catch (e: any) {
        res.writeHead(500);
        res.end(JSON.stringify({ error: e.message }));
      }
    });
  }

  /**
   * Handle WebSocket messages
   */
  private handleWSMessage(msg: any): void {
    // Route messages based on type
    if (msg.data?.type === 'mcp') {
      // MCP protocol message
      this.handleMCPMessage(msg);
    } else if (msg.data?.type === 'acp') {
      // ACP protocol message
      this.handleACPMessage(msg);
    } else {
      // Regular message - process as agent task
      this.agent.think(msg.data?.text || JSON.stringify(msg.data))
        .then(response => {
          this.wsManager?.sendToClient(msg.from, { type: 'response', data: response, original: msg });
        });
    }
  }

  private handleMCPMessage(msg: any): void {
    // Forward MCP messages to MCP server
    this.mcpServer?.pushToClients('server_push', msg.data);
  }

  private handleACPMessage(msg: any): void {
    // Handle ACP protocol messages
    const { action, params } = msg.data;
    
    switch (action) {
      case 'spawn':
        this.acpClient?.spawnSession(params);
        break;
      case 'cancel':
        this.acpClient?.cancelSession(params.sessionId);
        break;
      case 'status':
        this.wsManager?.sendToClient(msg.from, {
          type: 'acp_status',
          data: this.acpClient?.getCapabilities()
        });
        break;
    }
  }

  /**
   * Connect to an external MCP server (OUTBOUND)
   */
  async connectToExternalMCP(url: string, name?: string): Promise<string> {
    const id = `mcp_${Date.now()}`;
    
    logger.info('mcp', 'UnifiedServer', `Connecting to external MCP server: ${url}`, { url });
    
    try {
      const ws = new WebSocket(url);

      ws.on('open', () => {
        logger.info('mcp', 'UnifiedServer', `Connected to external MCP server: ${url}`, { url });
        const server = this.externalMCPServers.get(id);
        if (server) {
          server.connected = true;
          server.ws = ws;
        }
        this.emit('mcp:connected', { id, url, name });
      });

      ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());
          this.handleExternalMCPMessage(id, msg);
        } catch (e) {
          logger.error('mcp', 'UnifiedServer', `Failed to parse external MCP message from ${url}`, e as Error, { url });
        }
      });

      ws.on('close', () => {
        logger.info('mcp', 'UnifiedServer', `Disconnected from external MCP server: ${url}`, { url });
        const server = this.externalMCPServers.get(id);
        if (server) {
          server.connected = false;
          server.ws = undefined;
        }
        this.emit('mcp:disconnected', { id, url });
      });

      ws.on('error', (error) => {
        logger.error('mcp', 'UnifiedServer', `WebSocket error from external MCP server ${url}: ${error.message}`, error, { url, code: 'MCP_003' });
        this.emit('mcp:error', { id, url, error });
      });

      this.externalMCPServers.set(id, { url, name: name || url, connected: false, ws });

      // Send initialize
      ws.send(JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          clientInfo: { name: 'duck-agent', version: '0.6.1' }
        }
      }));

      return id;
    } catch (e: any) {
      throw new Error(`Failed to connect to ${url}: ${e.message}`);
    }
  }

  private handleExternalMCPMessage(serverId: string, msg: any): void {
    this.emit('mcp:message', { serverId, message: msg });
    
    // Handle responses to our requests
    if (msg.id) {
      this.emit('mcp:response', { serverId, id: msg.id, result: msg.result, error: msg.error });
    }
  }

  /**
   * Call a tool on an external MCP server
   */
  async callExternalMCPTool(serverId: string, tool: string, args?: any): Promise<any> {
    const server = this.externalMCPServers.get(serverId);
    if (!server?.ws || server.ws.readyState !== WebSocket.OPEN) {
      throw new Error(`MCP server ${serverId} not connected`);
    }

    const id = Date.now();
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`MCP call timeout for ${tool}`));
      }, 30000);

      const handler = (result: any) => {
        if (result.id === id) {
          clearTimeout(timeout);
          this.off('mcp:response', handler);
          if (result.error) reject(new Error(result.error.message));
          else resolve(result.result);
        }
      };

      this.on('mcp:response', handler);

      server.ws?.send(JSON.stringify({
        jsonrpc: '2.0',
        id,
        method: 'tools/call',
        params: { name: tool, arguments: args }
      }));
    });
  }

  /**
   * Get full status
   */
  getStatus(): any {
    return {
      status: this.status,
      uptime: this.getUptime(),
      services: {
        mcp: {
          enabled: this.config.enableMCP,
          running: !!this.mcpServer,
          port: this.config.mcpPort,
          externalServers: Array.from(this.externalMCPServers.entries()).map(([id, s]) => ({
            id, name: s.name, url: s.url, connected: s.connected
          }))
        },
        acp: {
          enabled: this.config.enableACP,
          running: !!this.acpClient,
          port: this.config.acpPort,
          sessions: this.acpClient?.listSessions() || []
        },
        websocket: {
          enabled: this.config.enableWebSocket,
          running: !!this.wsManager,
          port: this.config.wsPort,
          clients: this.wsManager?.getClients() || { inbound: [], outbound: [] }
        },
        gateway: {
          enabled: this.config.enableGateway,
          running: !!this.gatewayServer,
          port: this.config.gatewayPort
        }
      },
      agent: this.agent.getStatus(),
    };
  }

  private getUptime(): string {
    const ms = Date.now() - this.startedAt;
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    return h > 0 ? `${h}h ${m % 60}m ${s % 60}s` : `${m}m ${s % 60}s`;
  }

  /**
   * Stop all servers
   */
  async stop(): Promise<void> {
    logger.info('system', 'UnifiedServer', 'Shutting down all servers');

    // Disconnect external MCP servers
    for (const [id, server] of this.externalMCPServers) {
      if (server.ws) {
        server.ws.close();
      }
    }
    this.externalMCPServers.clear();

    // Stop MCP
    if (this.mcpServer) {
      await this.mcpServer.stop();
      this.mcpServer = null;
    }

    // Stop ACP
    if (this.acpClient) {
      await this.acpClient.stop();
      this.acpClient = null;
    }

    // Stop WebSocket
    if (this.wsManager) {
      await this.wsManager.stop();
      this.wsManager = null;
    }

    // Stop Gateway
    if (this.gatewayServer) {
      await new Promise<void>((resolve) => {
        this.gatewayServer!.close(() => resolve());
      });
      this.gatewayServer = null;
    }

    this.status = 'stopped';
    logger.info('system', 'UnifiedServer', 'All servers stopped');
    this.emit('stopped');
  }
}

export default UnifiedServer;
