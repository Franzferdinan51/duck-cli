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
  private port: number;
  private httpServer: http.Server | null = null;
  private wss: WebSocketServer | null = null;
  private wsClients: Map<string, ConnectedClient> = new Map();
  private sseClients: Set<{ res: http.ServerResponse; id: string }> = new Set();
  private notificationQueue: Map<string, any[]> = new Map();
  private requestHandlers: Map<string, (params: any) => Promise<any>> = new Map();
  private toolInvocations: Map<string | number, { name: string; startTime: number }> = new Map();
  private nextId = 1;

  constructor(port: number = 3848) {
    this.port = port;
    this.agent = new Agent({ name: 'Duck Agent (MCP)' });
    this.registerCoreHandlers();
    this.registerAgentTools();
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
          version: '0.3.0',
          description: 'Duck Agent - Super AI Agent with KAIROS, Claude Code Tools'
        },
        instructions: 'Duck Agent MCP Server. Use tools/call to execute tasks.',
      };
    });

    // Tools
    this.requestHandlers.set('tools/list', async () => {
      const tools = Array.from(this.tools.values()).map(t => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
        annotations: t.annotations,
      }));
      return { tools };
    });

    this.requestHandlers.set('tools/call', async (params) => {
      const { name, arguments: args = {} } = params;
      const id = this.nextId++;
      this.toolInvocations.set(id, { name, startTime: Date.now() });
      
      try {
        const handler = this.tools.get(name);
        if (!handler) {
          return {
            content: [{ type: 'text', text: `Unknown tool: ${name}` }],
            isError: true,
          };
        }

        const result = await handler.handler(args, this.agent);
        const inv = this.toolInvocations.get(id);
        this.broadcastToSSE({ type: 'tool_complete', tool: name, id, duration: Date.now() - (inv?.startTime ?? 0) });
        
        return {
          content: [{ type: 'text', text: typeof result === 'string' ? result : JSON.stringify(result, null, 2) }],
          isError: false,
        };
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

  private registerAgentTools(): void {
    // Execute task
    this.tools.set('execute', {
      name: 'execute',
      description: 'Execute a task with Duck Agent',
      inputSchema: { type: 'object', properties: { task: { type: 'string', description: 'Task description' } }, required: ['task'] },
      annotations: { destructive: false, idempotent: true },
      handler: async (args: any, agent: Agent) => {
        return await agent.execute(args.task);
      }
    });

    // Think
    this.tools.set('think', {
      name: 'think',
      description: 'Think about something with Duck Agent reasoning',
      inputSchema: { type: 'object', properties: { prompt: { type: 'string' } }, required: ['prompt'] },
      annotations: { destructive: false, idempotent: true },
      handler: async (args: any, agent: Agent) => {
        return await agent.think(args.prompt);
      }
    });

    // Remember
    this.tools.set('remember', {
      name: 'remember',
      description: 'Store information in Duck Agent memory',
      inputSchema: { type: 'object', properties: { content: { type: 'string' }, category: { type: 'string' } }, required: ['content'] },
      annotations: { destructive: false, idempotent: true },
      handler: async (args: any, agent: Agent) => {
        await agent.remember(args.content);
        return { success: true, stored: args.content.length };
      }
    });

    // Recall
    this.tools.set('recall', {
      name: 'recall',
      description: 'Search Duck Agent memory',
      inputSchema: { type: 'object', properties: { query: { type: 'string' }, limit: { type: 'number' } }, required: ['query'] },
      annotations: { destructive: false, idempotent: true },
      handler: async (args: any, agent: Agent) => {
        const results = await agent.recall(args.query);
        return { results, count: results.length };
      }
    });

    // Status
    this.tools.set('get_status', {
      name: 'get_status',
      description: 'Get Duck Agent status and metrics',
      inputSchema: { type: 'object', properties: {} },
      annotations: { destructive: false, idempotent: true },
      handler: async (_args: any, agent: Agent) => {
        return agent.getStatus();
      }
    });

    // Desktop control - screenshot
    this.tools.set('desktop_screenshot', {
      name: 'desktop_screenshot',
      description: 'Take a screenshot of the desktop',
      inputSchema: { type: 'object', properties: {} },
      annotations: { destructive: false, idempotent: true },
      handler: async (_args: any, agent: Agent) => {
        return await agent.screenshot();
      }
    });

    // Desktop control - open app
    this.tools.set('desktop_open', {
      name: 'desktop_open',
      description: 'Open an application',
      inputSchema: { type: 'object', properties: { app: { type: 'string' } }, required: ['app'] },
      annotations: { destructive: false, idempotent: false },
      handler: async (args: any, agent: Agent) => {
        await agent.openApp(args.app);
        return { success: true, opened: args.app };
      }
    });

    // Desktop control - click
    this.tools.set('desktop_click', {
      name: 'desktop_click',
      description: 'Click at coordinates',
      inputSchema: { type: 'object', properties: { x: { type: 'number' }, y: { type: 'number' } }, required: ['x', 'y'] },
      annotations: { destructive: false, idempotent: false },
      handler: async (args: any, agent: Agent) => {
        await agent.click(args.x, args.y);
        return { success: true, clicked: { x: args.x, y: args.y } };
      }
    });

    // Desktop control - type
    this.tools.set('desktop_type', {
      name: 'desktop_type',
      description: 'Type text',
      inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
      annotations: { destructive: false, idempotent: false },
      handler: async (args: any, agent: Agent) => {
        await agent.type(args.text);
        return { success: true, typed: args.text.length };
      }
    });

    // KAIROS status
    this.tools.set('kairos_status', {
      name: 'kairos_status',
      description: 'Get KAIROS autonomous system status',
      inputSchema: { type: 'object', properties: { mode: { type: 'string', enum: ['get', 'set', 'toggle'] }, value: { type: 'string' } } },
      annotations: { destructive: false, idempotent: true },
      handler: async (_args: any, _agent: Agent) => {
        return { mode: 'balanced', enabled: true, heartbeat: true };
      }
    });

    // List available tools
    this.tools.set('list_tools', {
      name: 'list_tools',
      description: 'List all available Duck Agent tools',
      inputSchema: { type: 'object', properties: {} },
      annotations: { destructive: false, idempotent: true },
      handler: async () => {
        return { tools: Array.from(this.tools.keys()) };
      }
    });

    // Ping
    this.tools.set('ping', {
      name: 'ping',
      description: 'Ping the server',
      inputSchema: { type: 'object', properties: {} },
      annotations: { destructive: false, idempotent: true },
      handler: async () => {
        return { pong: true, timestamp: Date.now() };
      }
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
        res.end(JSON.stringify({ status: 'ok', server: 'duck-agent-mcp', version: '0.3.0' }));
      } else if (req.method === 'GET' && url.pathname === '/tools') {
        const tools = Array.from(this.tools.values()).map(t => ({ name: t.name, description: t.description }));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ tools }));
      } else if (req.method === 'GET' && url.pathname === '/capabilities') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(this.getServerCapabilities()));
      } else {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end(`🦆 Duck Agent MCP Server v0.3.0\n\nEndpoints:\n  POST /mcp - MCP protocol\n  GET  /mcp/sse - SSE events\n  GET  /health - Health check\n  GET  /tools - Tool list\n  GET  /capabilities - Server capabilities\n\nWebSocket: ws://localhost:${this.port}/ws\n`);
      }
    });

    // WebSocket Server
    this.wss = new WebSocketServer({ server: this.httpServer, path: '/ws' });
    this.wss.on('connection', (ws: WebSocket, req: http.IncomingMessage) => this.handleWebSocket(ws, req));

    return new Promise((resolve) => {
      this.httpServer!.listen(this.port, () => {
        console.log(`\n🦆 Duck Agent Deep MCP Server v0.3.0`);
        console.log(`   HTTP:     http://localhost:${this.port}/mcp`);
        console.log(`   SSE:      http://localhost:${this.port}/mcp/sse`);
        console.log(`   WebSocket: ws://localhost:${this.port}/ws`);
        console.log(`   Tools:    ${this.tools.size} tools registered\n`);
        resolve();
      });
    });
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
    console.log('[MCP] Server stopped');
  }
}

export default MCPServer;
