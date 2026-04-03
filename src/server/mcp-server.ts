/**
 * 🦆 Duck Agent - Deep MCP Server (Streamable HTTP + WebSocket)
 * Full MCP 2024-11-05 spec with bidirectional communication
 */

import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { Agent } from '../agent/core.js';
import { ToolRegistry } from '../tools/registry.js';

// MCP JSON-RPC types
export interface MCPRequest {
  jsonrpc: '2.0';
  id: string | number | null;
  method: string;
  params?: any;
}

export interface MCPResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: any;
  error?: { code: number; message: string; data?: any };
}

export interface MCPServerCapabilities {
  tools?: Record<string, any>;
  resources?: { subscribe?: boolean; list?: boolean };
  prompts?: { list?: boolean };
  sampling?: {};
}

interface ConnectedClient {
  ws: WebSocket;
  id: string;
  capabilities: MCPClientCapabilities;
  info?: { name: string; version?: string };
}

interface MCPClientCapabilities {
  tools?: Record<string, any>;
  resources?: { subscribe?: boolean };
}

interface WSToolDefinition {
  name: string;
  description: string;
  inputSchema: any;
  annotations?: { destructive?: boolean; idempotent?: boolean };
  handler: (args: any, agent: Agent) => Promise<any>;
}

/**
 * Deep MCP Server - Supports:
 * - HTTP POST/GET (classic)
 * - Streamable HTTP (MCP 2024-11-05)
 * - WebSocket (bidirectional)
 * - SSE for notifications
 */
export class MCPServer {
  private agent: Agent;
  private tools: Map<string, WSToolDefinition> = new Map();
  private agentInitialized = false;
  private port: number;
  private httpServer: http.Server | null = null;
  private wss: WebSocketServer | null = null;
  private wsClients: Map<string, ConnectedClient> = new Map();
  private sseClients: Set<{ res: http.ServerResponse; id: string }> = new Set();
  private notificationQueue: Map<string, any[]> = new Map();
  private requestHandlers: Map<string, (params: any) => Promise<any>> = new Map();
  private toolInvocations: Map<string | number, { name: string; startTime: number }> = new Map();
  private nextId = 1;

  constructor(port: number = 3850) {
    this.port = port;
    this.agent = new Agent({ name: 'Duck Agent (MCP)' });
    this.registerCoreHandlers();
    // MCP tools are loaded dynamically from agent after initialization
  }

  private registerCoreHandlers(): void {
    // Initialize
    this.requestHandlers.set('initialize', async (params) => {
      const clientInfo = params?.clientInfo;
      return {
        protocolVersion: '2024-11-05',
        capabilities: this.getServerCapabilities() as MCPServerCapabilities,
        serverInfo: {
          name: 'duck-agent',
          version: '0.4.0',
          description: 'Duck Agent - Super AI Agent with KAIROS, Claude Code Tools'
        },
        instructions: 'Duck Agent MCP Server. Use tools/call to execute tasks.',
      };
    });

    // Tools - dynamically load from agent registry
    this.requestHandlers.set('tools/list', async () => {
      // Ensure agent is initialized
      if (!this.agentInitialized) {
        await this.agent.initialize();
        this.agentInitialized = true;
      }
      
      // Get all tools from agent's registry
      const agentTools = this.agent.getTools();
      const tools = agentTools.map(t => {
        // Convert simplified schema to proper JSON Schema format
        const schema = t.schema || {};
        const properties: Record<string, any> = {};
        const required: string[] = [];
        
        for (const [key, spec] of Object.entries(schema)) {
          if (typeof spec === 'object' && spec !== null) {
            // It's a property definition
            const { type, description, optional, ...rest } = spec as any;
            properties[key] = { type, description, ...rest };
            if (!optional) {
              required.push(key);
            }
          } else {
            // It's just a type string
            properties[key] = { type: spec };
          }
        }
        
        const inputSchema: any = {
          type: 'object',
          properties,
          additionalProperties: true,
        };
        if (required.length > 0) {
          inputSchema.required = required;
        }
        
        return {
          name: t.name,
          description: t.description,
          inputSchema,
          annotations: { destructive: t.dangerous, idempotent: !t.dangerous },
        };
      });
      return { tools };
    });

    this.requestHandlers.set('tools/call', async (params) => {
      // Ensure agent is initialized
      if (!this.agentInitialized) {
        await this.agent.initialize();
        this.agentInitialized = true;
      }
      
      const { name, arguments: args = {} } = params;
      const id = this.nextId++;
      this.toolInvocations.set(id, { name, startTime: Date.now() });
      
      try {
        const result = await this.agent.executeTool(name, args);
        const inv = this.toolInvocations.get(id);
        this.broadcastToSSE({ type: 'tool_complete', tool: name, id, duration: Date.now() - (inv?.startTime ?? 0) });
        
        if (result.success) {
          return {
            content: [{ type: 'text', text: typeof result.result === 'string' ? result.result : JSON.stringify(result.result, null, 2) }],
            isError: false,
          };
        } else {
          return {
            content: [{ type: 'text', text: result.error || 'Tool execution failed' }],
            isError: true,
          };
        }
      } catch (error: any) {
        return {
          content: [{ type: 'text', text: `Error: ${error.message}` }],
          isError: true,
        };
      } finally {
        this.toolInvocations.delete(id);
      }
    });

    // Resources
    this.requestHandlers.set('resources/list', async () => {
      return {
        resources: [
          { uri: 'memory://recent', name: 'Recent Memory', description: 'Recent memory entries', mimeType: 'application/json' },
          { uri: 'status://agent', name: 'Agent Status', description: 'Current agent status', mimeType: 'application/json' },
        ]
      };
    });

    this.requestHandlers.set('resources/read', async (params) => {
      const { uri } = params;
      if (uri === 'status://agent') {
        return { contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(this.agent.getStatus()) }] };
      }
      return { contents: [{ uri, mimeType: 'text/plain', text: 'Resource not found' }] };
    });

    // Prompts
    this.requestHandlers.set('prompts/list', async () => {
      return {
        prompts: [
          { name: 'code_review', description: 'Review code for issues', arguments: [{ name: 'code', description: 'Code to review', required: true }] },
          { name: 'explain_error', description: 'Explain an error message', arguments: [{ name: 'error', description: 'Error to explain', required: true }] },
        ]
      };
    });

    this.requestHandlers.set('prompts/get', async (params) => {
      const { name, arguments: args = {} } = params;
      switch (name) {
        case 'code_review':
          return { messages: [{ role: 'user', content: { type: 'text', text: `Review this code:\n\n${args.code}` } }] };
        case 'explain_error':
          return { messages: [{ role: 'user', content: { type: 'text', text: `Explain this error:\n\n${args.error}` } }] };
        default:
          throw new Error(`Unknown prompt: ${name}`);
      }
    });

    // Ping
    this.requestHandlers.set('ping', async () => {
      return { timestamp: Date.now() };
    });

    // Notifications
    this.requestHandlers.set('notifications/initialized', async () => {
      return null;
    });
  }

  private getServerCapabilities(): MCPServerCapabilities {
    return {
      tools: {},
      resources: { subscribe: true, list: true },
      prompts: { list: true },
      sampling: {},
    };
  }

  // ============ HTTP HANDLERS ============

  private async handleStreamableHTTP(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const url = new URL(req.url || '/mcp', `http://localhost:${this.port}`);

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('X-Content-Type-Options', 'nosniff');

    if (url.pathname === '/mcp/stream') {
      // Streamable HTTP
      res.writeHead(200);
      
      let body = '';
      req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
      req.on('end', async () => {
        try {
          const request = JSON.parse(body || '{}') as MCPRequest;
          const response = await this.processRequest(request);
          res.write(JSON.stringify(response));
          res.end();
        } catch (error: any) {
          res.write(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32603, message: error.message } }));
          res.end();
        }
      });
    } else if (url.pathname === '/mcp/sse') {
      // SSE endpoint for server→client events
      const clientId = `sse_${Date.now()}`;
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      });

      const clientObj = { res, id: clientId };
      this.sseClients.add(clientObj);
      this.sendSSE(clientObj, { type: 'connected', clientId, server: 'duck-agent' });

      // Send queued notifications
      const queue = this.notificationQueue.get(clientId) || [];
      for (const msg of queue) this.sendSSE(clientObj, msg);
      this.notificationQueue.delete(clientId);

      req.on('close', () => this.sseClients.delete(clientObj));
    } else {
      res.writeHead(404);
      res.end(JSON.stringify({ error: 'Not found' }));
    }
  }

  // ============ WEBSOCKET HANDLERS ============

  private handleWebSocket(ws: WebSocket, req: http.IncomingMessage): void {
    const clientId = `ws_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const client: ConnectedClient = { ws, id: clientId, capabilities: {} };
    this.wsClients.set(clientId, client);

    console.log(`[MCP] WebSocket client connected: ${clientId}`);

    // Send welcome
    ws.send(JSON.stringify({ jsonrpc: '2.0', method: 'connected', params: { clientId, server: 'duck-agent' } }));

    ws.on('message', async (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString()) as MCPRequest;
        
        if (message.method) {
          // Request
          const response = await this.processRequest({
            jsonrpc: '2.0',
            id: message.id,
            method: message.method,
            params: message.params,
          });
          
          if (message.id !== undefined && message.id !== null) {
            ws.send(JSON.stringify(response));
          }
        }
      } catch (error: any) {
        ws.send(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32603, message: error.message } }));
      }
    });

    ws.on('close', () => {
      console.log(`[MCP] WebSocket client disconnected: ${clientId}`);
      this.wsClients.delete(clientId);
    });

    ws.on('error', (error: Error) => {
      console.error(`[MCP] WebSocket error for ${clientId}:`, error.message);
    });
  }

  // ============ REQUEST PROCESSING ============

  private async processRequest(request: MCPRequest): Promise<MCPResponse> {
    const { id, method, params } = request;
    
    try {
      if (method?.startsWith('notifications/')) {
        // One-way notifications
        return { jsonrpc: '2.0', id: null };
      }

      const handler = this.requestHandlers.get(method);
      if (!handler) {
        return { jsonrpc: '2.0', id, error: { code: -32601, message: `Unknown method: ${method}` } };
      }

      const result = await handler(params);
      return { jsonrpc: '2.0', id, result };
    } catch (error: any) {
      return { jsonrpc: '2.0', id, error: { code: -32603, message: error.message } };
    }
  }

  // ============ BROADCAST ============

  private sendSSE(client: { res: http.ServerResponse; id: string }, data: any): void {
    try {
      client.res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch {
      this.sseClients.delete(client);
    }
  }

  broadcastToSSE(data: any): void {
    for (const client of this.sseClients) {
      this.sendSSE(client, data);
    }
  }

  broadcastToWS(data: any, targetId?: string): void {
    const message = JSON.stringify(data);
    
    if (targetId) {
      const client = this.wsClients.get(targetId);
      if (client) client.ws.send(message);
    } else {
      for (const client of this.wsClients.values()) {
        client.ws.send(message);
      }
    }
  }

  /**
   * Send a message TO connected clients (server→client push)
   */
  pushToClients(method: string, params: any): void {
    this.broadcastToSSE({ type: 'server_push', method, params });
    this.broadcastToWS({ jsonrpc: '2.0', method, params });
  }

  // ============ SERVER LIFECYCLE ============

  async start(): Promise<void> {
    await this.agent.initialize();

    // HTTP Server
    this.httpServer = http.createServer(async (req: any, res: any) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Client-ID');

      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      const url = new URL(req.url || '/', `http://localhost:${this.port}`);

      if (req.method === 'POST' && url.pathname.startsWith('/mcp')) {
        await this.handleStreamableHTTP(req, res);
      } else if (req.method === 'GET' && url.pathname === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', server: 'duck-agent-mcp', version: '0.4.0' }));
      } else if (req.method === 'GET' && url.pathname === '/tools') {
        const tools = Array.from(this.tools.values()).map(t => ({ name: t.name, description: t.description }));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ tools }));
      } else if (req.method === 'GET' && url.pathname === '/capabilities') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(this.getServerCapabilities()));
      } else {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end(`🦆 Duck Agent MCP Server v0.4.0\n\nEndpoints:\n  POST /mcp - MCP protocol\n  GET  /mcp/sse - SSE events\n  GET  /health - Health check\n  GET  /tools - Tool list\n  GET  /capabilities - Server capabilities\n\nWebSocket: ws://localhost:${this.port}/ws\n`);
      }
    });

    // WebSocket Server
    this.wss = new WebSocketServer({ server: this.httpServer, path: '/ws' });
    this.wss.on('connection', (ws: WebSocket, req: http.IncomingMessage) => this.handleWebSocket(ws, req));

    return new Promise((resolve) => {
      this.httpServer!.listen(this.port, () => {
        console.log(`\n🦆 Duck Agent Deep MCP Server v0.4.0`);
        console.log(`   HTTP:     http://localhost:${this.port}/mcp`);
        console.log(`   SSE:      http://localhost:${this.port}/mcp/sse`);
        console.log(`   WebSocket: ws://localhost:${this.port}/ws`);
        console.log(`   Tools:    ${this.tools.size} tools registered\n`);
        resolve();
      });
    });
  }

  /**
   * Start MCP server using stdio transport (for LM Studio, Claude Desktop, etc.)
   * Reads JSON-RPC requests from stdin, writes responses to stdout
   */
  async startStdio(): Promise<void> {
    // Suppress stdout during stdio mode to prevent polluting JSON-RPC stream
    // All console output goes to stderr instead
    const originalLog = console.log;
    console.log = (...args: any[]) => console.error('[init]', ...args);
    
    await this.agent.initialize();
    console.error('[MCP] Starting stdio server (tools: %d)...', this.agent.getTools().length);
    
    // Send initializtion response to complete handshake
    const initRequest: MCPRequest = {
      jsonrpc: '2.0',
      id: null,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: this.getServerCapabilities(),
        clientInfo: { name: 'lm-studio', version: '0.0.1' }
      }
    };
    
    // Wait for client to send initialize, then respond
    process.stdin.setEncoding('utf8');
    let initialized = false;
    let initializedResolve: () => void;
    const initPromise = new Promise<void>((resolve) => { initializedResolve = resolve; });
    
    let buffer = '';
    
    process.stdin.on('data', async (chunk: string) => {
      buffer += chunk;
      
      // Process complete JSON-RPC messages (newline-delimited)
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer
      
      for (const line of lines) {
        if (!line.trim()) continue;
        
        try {
          const request = JSON.parse(line) as MCPRequest;
          
          // Handle initialize specially - it's the first message
          if (request.method === 'initialize' && !initialized) {
            initialized = true;
            const response: MCPResponse = {
              jsonrpc: '2.0',
              id: request.id,
              result: {
                protocolVersion: '2024-11-05',
                capabilities: this.getServerCapabilities(),
                serverInfo: {
                  name: 'duck-agent',
                  version: '0.4.0',
                  description: 'Duck Agent MCP Server'
                }
              }
            };
            process.stdout.write(JSON.stringify(response) + '\n');
            
            // Send notifications/initialized
            const notif: MCPResponse = {
              jsonrpc: '2.0',
              id: null,
              result: null
            };
            process.stdout.write(JSON.stringify(notif) + '\n');
            
            initializedResolve?.();
            continue;
          }
          
          // Wait for initialization before processing other requests
          if (!initialized) {
            await initPromise;
          }
          
          // Process the request
          const response = await this.processRequest(request);
          
          // Only send responses for requests with id
          if (request.id !== undefined && request.id !== null) {
            process.stdout.write(JSON.stringify(response) + '\n');
          }
        } catch (error: any) {
          console.error('[MCP stdio] Error:', error.message);
          const errorResponse: MCPResponse = {
            jsonrpc: '2.0',
            id: null,
            error: { code: -32603, message: error.message }
          };
          process.stdout.write(JSON.stringify(errorResponse) + '\n');
        }
      }
    });
    
    process.stdin.on('end', () => {
      console.error('[MCP] Stdin closed');
    });
    
    // Keep process alive
    await new Promise<void>((resolve) => {
      process.on('SIGINT', () => {
        console.error('[MCP] Received SIGINT');
        resolve();
      });
      process.on('SIGTERM', () => {
        console.error('[MCP] Received SIGTERM');
        resolve();
      });
    });
    
    await this.stop();
  }

  async stop(): Promise<void> {
    // Close all WebSocket clients
    for (const client of this.wsClients.values()) {
      client.ws.close();
    }
    this.wsClients.clear();

    // Close SSE clients
    for (const client of this.sseClients) {
      client.res.end();
    }
    this.sseClients.clear();

    // Stop servers
    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }

    if (this.httpServer) {
      await new Promise<void>((resolve) => this.httpServer!.close(() => resolve()));
      this.httpServer = null;
    }

    await this.agent.shutdown();
    console.error('[MCP] Server stopped');
  }
}

export default MCPServer;
