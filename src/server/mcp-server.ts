/**
 * 🦆 Duck Agent - Deep MCP Server (Streamable HTTP + WebSocket)
 * Full MCP 2024-11-05 spec with bidirectional communication
 */

import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { Agent } from '../agent/core.js';
import { ToolRegistry } from '../tools/registry.js';
import { logger } from './logger.js';
import { LiveErrorStream } from './live-error-stream.js';
import { DEFAULT_MCP_PORT } from '../config/index.js';

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
  private errorStream: LiveErrorStream | null = null;

  constructor(port: number = DEFAULT_MCP_PORT) {
    this.port = port;
    this.agent = new Agent({ name: 'Duck Agent (MCP)' });
    this.registerCoreHandlers();
    // MCP tools are loaded dynamically from agent after initialization
  }

  private registerCoreHandlers(): void {
    // Initialize
    this.requestHandlers.set('initialize', async (params) => {
      const clientInfo = params?.clientInfo;
      
      // Detect LM Studio client for compatibility
      const isLMStudio = clientInfo?.name && (
        clientInfo.name.toLowerCase().includes('lm-studio') ||
        clientInfo.name.includes('LM Studio')
      );
      
      // LM Studio may need protocol version 2024-11-05 or earlier compatibility
      const protocolVersion = isLMStudio ? '2024-11-05' : '2024-11-05';
      
      return {
        protocolVersion,
        capabilities: this.getServerCapabilities() as MCPServerCapabilities,
        serverInfo: {
          name: 'duck-agent',
          version: '0.4.0',
          description: 'Duck Agent - Super AI Agent with KAIROS, Claude Code Tools'
        },
        instructions: 'Duck Agent MCP Server. IMPORTANT: Tool names use UNDERSCORE not slashes. Examples: duck_run, duck_status, duck_doctor, think_parallel, agent_spawn. Do NOT use duck_/ with a slash. Use tools/call with exact tool names and JSON arguments.',
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
        // Avoid using reserved JSON Schema keywords as property names
        const schema = t.schema || {};
        const properties: Record<string, any> = {};
        const required: string[] = [];
        
        for (const [key, spec] of Object.entries(schema)) {
          if (typeof spec === 'object' && spec !== null) {
            // It's a property definition - extract properly
            const propSpec = spec as any;
            // Build property with explicit type - ensure types are strings for JSON Schema compatibility
            const prop: any = {};
            if (propSpec.type) {
              // Ensure type is a valid JSON Schema type string
              const typeStr = String(propSpec.type).toLowerCase();
              if (['string', 'number', 'boolean', 'object', 'array', 'null', 'integer'].includes(typeStr)) {
                prop.type = typeStr;
              } else {
                prop.type = 'string'; // Default to string for unknown types
              }
            }
            if (propSpec.description) prop.description = propSpec.description;
            if (propSpec.default !== undefined) prop.default = propSpec.default;
            if (propSpec.enum) prop.enum = propSpec.enum;
            // Add any other fields except reserved schema keywords
            for (const [k, v] of Object.entries(propSpec)) {
              if (!['type', 'description', 'default', 'enum', 'optional'].includes(k)) {
                prop[k] = v;
              }
            }
            properties[key] = prop;
            if (!propSpec.optional) {
              required.push(key);
            }
          } else {
            // It's just a type string - ensure valid JSON Schema type
            const typeStr = String(spec).toLowerCase();
            if (['string', 'number', 'boolean', 'object', 'array', 'null', 'integer'].includes(typeStr)) {
              properties[key] = { type: typeStr };
            } else {
              properties[key] = { type: 'string' }; // Default to string
            }
          }
        }
        
        const inputSchema: any = {
          type: 'object',
          properties,
          additionalProperties: true,
        };
        // Ensure required is an array of strings
        if (required.length > 0 && Array.isArray(required)) {
          inputSchema.required = required.filter(r => typeof r === 'string');
        }
        
        return {
          name: t.name,
          description: this.categorizeToolDescription(t.name, t.description),
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

    // Sampling - for LM Studio compatibility (progress/cancel notifications)
    this.requestHandlers.set('sampling/createMessage', async (params) => {
      // LM Studio may request sampling - we reject gracefully
      return {
        content: [{ type: 'text', text: 'Sampling not supported by Duck Agent MCP Server' }],
        role: 'assistant',
        stopReason: 'rejected',
      };
    });

    // Sampling messages - handle progress/cancel notifications from LM Studio
    this.requestHandlers.set('samplingMessages', async (params) => {
      // LM Studio may send progress/cancel notifications
      // Return empty success - we don't support interactive sampling
      return { success: true };
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

  // Tool categorization emoji prefixes for LM Studio compatibility
  private categorizeToolDescription(name: string, description: string): string {
    const lowerName = name.toLowerCase();
    const lowerDesc = description.toLowerCase();
    
    // Categorize based on tool name and description keywords
    if (lowerName.includes('search') || lowerName.includes('find') || lowerName.includes('browse') ||
        lowerDesc.includes('search') || lowerDesc.includes('find information') || lowerDesc.includes('web search')) {
      return '🔍 ' + description;
    }
    if (lowerName.includes('code') || lowerName.includes('git') || lowerName.includes('file') ||
        lowerName.includes('edit') || lowerName.includes('write') || lowerName.includes('read') ||
        lowerDesc.includes('code') || lowerDesc.includes('programming') || lowerDesc.includes('file operation')) {
      return '💻 ' + description;
    }
    if (lowerName.includes('image') || lowerName.includes('photo') || lowerName.includes('picture') ||
        lowerName.includes('draw') || (lowerName.includes('generate') && (lowerName.includes('image') || lowerName.includes('art'))) ||
        lowerDesc.includes('image') || lowerDesc.includes('picture') || lowerDesc.includes('art')) {
      return '🎨 ' + description;
    }
    if (lowerName.includes('speak') || lowerName.includes('speech') || lowerName.includes('tts') ||
        lowerName.includes('audio') || lowerName.includes('voice') || lowerName.includes('say') ||
        lowerDesc.includes('speech') || lowerDesc.includes('text to speech') || lowerDesc.includes('voice')) {
      return '🎤 ' + description;
    }
    if (lowerName.includes('system') || lowerName.includes('shell') || lowerName.includes('exec') ||
        lowerName.includes('run') || lowerName.includes('command') || lowerName.includes('bash') ||
        lowerDesc.includes('system command') || lowerDesc.includes('shell execution')) {
      return '⚡ ' + description;
    }
    if (lowerName.includes('agent') || lowerName.includes('task') || lowerName.includes('spawn') ||
        lowerDesc.includes('agent') || lowerDesc.includes('sub-agent') || lowerDesc.includes('spawn')) {
      return '🤖 ' + description;
    }
    if (lowerName.includes('memory') || lowerName.includes('remember') || lowerName.includes('learn') ||
        lowerDesc.includes('memory') || lowerDesc.includes('remember') || lowerDesc.includes('context')) {
      return '🧠 ' + description;
    }
    if (lowerName.includes('browser') || lowerName.includes('web') || lowerName.includes('url') ||
        lowerName.includes('http') || lowerDesc.includes('browser') || lowerDesc.includes('web page')) {
      return '🌐 ' + description;
    }
    // Default - general purpose tool
    return '🔧 ' + description;
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
    } else if (url.pathname === '/mcp') {
      // Default MCP endpoint - use streamable HTTP pattern
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
        
        // Detect LM Studio from initialize request
        if (message.method === 'initialize' && message.params?.clientInfo) {
          const clientInfo = message.params.clientInfo;
          const isLMStudio = clientInfo?.name && (
            clientInfo.name.toLowerCase().includes('lm-studio') ||
            clientInfo.name.includes('LM Studio')
          );
          if (isLMStudio) {
            console.log(`[MCP] LM Studio WebSocket client: ${clientInfo.name} ${clientInfo.version || ''}`);
            client.info = clientInfo;
          }
        }
        
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
        ws.send(JSON.stringify({
          jsonrpc: '2.0',
          id: null,
          error: {
            code: -32603,
            message: `WebSocket error: ${error.message}`,
            data: { hint: 'Ensure message is valid JSON-RPC 2.0' }
          }
        }));
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

  // JSON-RPC error codes
  private static readonly ERR_PARSE_ERROR = -32700;
  private static readonly ERR_INVALID_REQUEST = -32600;
  private static readonly ERR_METHOD_NOT_FOUND = -32601;
  private static readonly ERR_INVALID_PARAMS = -32602;
  private static readonly ERR_INTERNAL_ERROR = -32603;

  // Human-readable error messages
  private getErrorMessage(code: number, method?: string, details?: string): string {
    const messages: Record<number, string> = {
      [MCPServer.ERR_PARSE_ERROR]: 'Invalid JSON received. Request must be valid JSON-RPC 2.0 format.',
      [MCPServer.ERR_INVALID_REQUEST]: `Invalid request structure. Ensure method name is a string and id is valid.`,
      [MCPServer.ERR_METHOD_NOT_FOUND]: `Method '${method || 'unknown'}' not found. Available methods: initialize, tools/list, tools/call, ping, prompts/list, prompts/get, resources/list, resources/read.`,
      [MCPServer.ERR_INVALID_PARAMS]: `Invalid parameters for method '${method || 'unknown'}'. ${details || 'Check parameter types and required fields.'}`,
      [MCPServer.ERR_INTERNAL_ERROR]: `Internal server error${details ? `: ${details}` : '. Please try again.'}`,
    };
    return messages[code] || `Unknown error (code: ${code})`;
  }

  private async processRequest(request: MCPRequest): Promise<MCPResponse> {
    const { id, method, params } = request;
    
    try {
      // Validate JSON-RPC structure
      if (!request || typeof request.jsonrpc !== 'string' || request.jsonrpc !== '2.0') {
        return {
          jsonrpc: '2.0',
          id: id ?? null,
          error: {
            code: MCPServer.ERR_PARSE_ERROR,
            message: this.getErrorMessage(MCPServer.ERR_PARSE_ERROR),
            data: { hint: 'Ensure request has "jsonrpc": "2.0" and valid structure' }
          }
        };
      }

      if (!method || typeof method !== 'string') {
        return {
          jsonrpc: '2.0',
          id: id ?? null,
          error: {
            code: MCPServer.ERR_INVALID_REQUEST,
            message: this.getErrorMessage(MCPServer.ERR_INVALID_REQUEST),
            data: { hint: 'Method must be a non-empty string' }
          }
        };
      }

      if (method?.startsWith('notifications/')) {
        // One-way notifications - no response needed
        return { jsonrpc: '2.0', id: null };
      }

      const handler = this.requestHandlers.get(method);
      if (!handler) {
        return {
          jsonrpc: '2.0',
          id,
          error: {
            code: MCPServer.ERR_METHOD_NOT_FOUND,
            message: this.getErrorMessage(MCPServer.ERR_METHOD_NOT_FOUND, method),
            data: { availableMethods: Array.from(this.requestHandlers.keys()) }
          }
        };
      }

      const startTime = Date.now();
      const requestId = `${method}-${Date.now()}`;
      
      logger.info('mcp', 'handler', `Request: ${method}`, { requestId, params });
      
      try {
        const result = await handler(params);
        const duration = Date.now() - startTime;
        
        logger.info('mcp', 'handler', `Response: ${method} (${duration}ms)`, { requestId, duration, success: true });
        
        return { jsonrpc: '2.0', id, result };
      } catch (error: any) {
        const duration = Date.now() - startTime;
        
        logger.error('mcp', 'handler', `Error: ${method}`, error, { requestId, duration, params });
        
        return {
          jsonrpc: '2.0',
          id,
          error: {
            code: MCPServer.ERR_INTERNAL_ERROR,
            message: this.getErrorMessage(MCPServer.ERR_INTERNAL_ERROR, method, error.message),
            data: { originalError: error.message, stack: error.stack?.split('\n')[1]?.trim() }
          }
        };
      }
    } catch (error: any) {
      logger.error('mcp', 'process', 'Unexpected error in request processing', error);
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: MCPServer.ERR_INTERNAL_ERROR,
          message: this.getErrorMessage(MCPServer.ERR_INTERNAL_ERROR, method, error.message)
        }
      };
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

      // Logger HTTP endpoints
      if (url.pathname === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(logger.getHealth(), null, 2));
        return;
      }
      if (url.pathname === '/logs') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        const logs = logger.getLogs({ limit: parseInt(url.searchParams.get('limit') || '50') });
        res.end(JSON.stringify(logs, null, 2));
        return;
      }
      if (url.pathname === '/errors') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        const errors = logger.getErrors();
        res.end(JSON.stringify(errors, null, 2));
        return;
      }

      if (url.pathname === '/' || url.pathname === '/dashboard') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(logger.getDashboardHTML());
        return;
      }

      if (req.method === 'POST' && url.pathname.startsWith('/mcp')) {
        await this.handleStreamableHTTP(req, res);
      } else if (req.method === 'GET' && url.pathname === '/tools') {
        // Get tools from agent registry (this.tools is internal WS defs, not agent tools)
        const agentTools = this.agentInitialized ? this.agent.getTools() : [];
        const tools = agentTools.map(t => ({ name: t.name, description: t.description }));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', server: 'duck-agent-mcp', version: '0.4.0', tools }));
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
        console.log(`   Tools:    ${this.agentInitialized ? this.agent.getTools().length : 0} tools registered\n`);

        // Start Live Error Stream on port 3851
        this.errorStream = new LiveErrorStream(3851);

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
    const originalWarn = console.warn;
    console.log = (...args: any[]) => console.error('[out]', ...args);
    console.warn = (...args: any[]) => console.error('[warn]', ...args);
    
    try {
      await this.agent.initialize();
      console.error('[MCP] Starting stdio server (tools: %d)...', this.agent.getTools().length);
      
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
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (!line.trim()) continue;
          
          try {
            const request = JSON.parse(line) as MCPRequest;
            
            // Handle initialize specially - it's the first message
            if (request.method === 'initialize' && !initialized) {
              initialized = true;
              
              const clientInfo = request.params?.clientInfo;
              const isLMStudio = clientInfo?.name && (
                clientInfo.name.toLowerCase().includes('lm-studio') ||
                clientInfo.name.includes('LM Studio')
              );
              const isClaude = clientInfo?.name && clientInfo.name.includes('Claude');
              
              if (isLMStudio) console.error('[MCP] LM Studio detected:', clientInfo.name, clientInfo.version);
              else if (isClaude) console.error('[MCP] Claude Desktop detected:', clientInfo.name, clientInfo.version);
              else console.error('[MCP] Client:', clientInfo?.name || 'Unknown');
              
              const response: MCPResponse = {
                jsonrpc: '2.0',
                id: request.id,
                result: {
                  protocolVersion: '2024-11-05',
                  capabilities: this.getServerCapabilities(),
                  serverInfo: {
                    name: 'duck-agent',
                    version: '0.4.0',
                    description: 'Duck Agent MCP Server - Multi-provider AI'
                  }
                }
              };
              process.stdout.write(JSON.stringify(response) + '\n');
              
              // Send initialized notification
              const notif = { jsonrpc: '2.0', method: 'notifications/initialized', params: {} };
              process.stdout.write(JSON.stringify(notif) + '\n');
              
              initializedResolve?.();
              continue;
            }
            
            if (!initialized) await initPromise;
            
            const response = await this.processRequest(request);
            if (request.id !== undefined && request.id !== null) {
              process.stdout.write(JSON.stringify(response) + '\n');
            }
          } catch (error: any) {
            console.error('[MCP stdio] Error:', error.message);
            const errorResponse: MCPResponse = {
              jsonrpc: '2.0',
              id: null,
              error: { code: -32700, message: `Parse error: ${error.message}` }
            };
            process.stdout.write(JSON.stringify(errorResponse) + '\n');
          }
        }
      });
      
      process.stdin.on('end', () => {
        console.error('[MCP] Stdin closed, exiting...');
        process.exit(0);
      });
      
      process.stdin.on('error', (err) => {
        console.error('[MCP] Stdin error:', err.message);
        process.exit(1);
      });
      
    } catch (error: any) {
      console.error('[MCP] Fatal error:', error.message);
      process.exit(1);
    }
    
    // Keep alive with graceful shutdown
    await new Promise<void>((resolve) => {
      const shutdown = (sig: string) => {
        console.error(`[MCP] ${sig}, shutting down...`);
        resolve();
      };
      process.on('SIGINT', () => shutdown('SIGINT'));
      process.on('SIGTERM', () => shutdown('SIGTERM'));
    });
    
    await this.stop();
    console.error('[MCP] Stdio server stopped');
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

    // Stop Live Error Stream
    if (this.errorStream) {
      await this.errorStream.stop();
      this.errorStream = null;
    }

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
