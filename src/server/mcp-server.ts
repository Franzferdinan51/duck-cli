/**
 * Duck Agent - MCP Server Mode
 * Run as MCP server for OpenClaw integration
 */

import http from 'http';
import { Agent } from '../agent/core.js';

export interface MCPRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: any;
}

export interface MCPResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: any;
  error?: { code: number; message: string; data?: any };
}

export class MCPServer {
  private agent: Agent;
  private tools: Map<string, any> = new Map();
  private port: number;
  private server: http.Server | null = null;
  private sseClients: Set<(data: any) => void> = new Set();

  constructor(port: number = 3848) {
    this.port = port;
    this.agent = new Agent({ name: 'Duck Agent (MCP)' });
    this.registerTools();
  }

  private registerTools(): void {
    this.tools.set('execute', {
      description: 'Execute a task with the Duck Agent',
      inputSchema: { type: 'object', properties: { task: { type: 'string' } }, required: ['task'] }
    });
    this.tools.set('think', {
      description: 'Think about something',
      inputSchema: { type: 'object', properties: { prompt: { type: 'string' } }, required: ['prompt'] }
    });
    this.tools.set('remember', {
      description: 'Remember something',
      inputSchema: { type: 'object', properties: { content: { type: 'string' } }, required: ['content'] }
    });
    this.tools.set('recall', {
      description: 'Search memory',
      inputSchema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] }
    });
    this.tools.set('status', {
      description: 'Get agent status',
      inputSchema: { type: 'object', properties: {} }
    });
    this.tools.set('desktop', {
      description: 'Control desktop',
      inputSchema: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['open', 'click', 'type', 'screenshot'] },
          target: { type: 'string' },
          x: { type: 'number' },
          y: { type: 'number' }
        }
      }
    });
  }

  async start(): Promise<void> {
    await this.agent.initialize();

    this.server = http.createServer(async (req, res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      const url = new URL(req.url || '/', `http://localhost:${this.port}`);

      if (url.pathname === '/mcp' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
          try {
            const request = JSON.parse(body) as MCPRequest;
            const response = await this.processRequest(request);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(response));
          } catch (error: any) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32603, message: error.message } }));
          }
        });
      } else if (url.pathname === '/sse') {
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });
        const send = (data: any) => res.write(`data: ${JSON.stringify(data)}\n\n`);
        send({ type: 'connected', agent: 'Duck Agent' });
        this.sseClients.add(send);
        req.on('close', () => this.sseClients.delete(send));
      } else if (url.pathname === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', agent: 'Duck Agent' }));
      } else if (url.pathname === '/tools') {
        const toolList = Array.from(this.tools.entries()).map(([name, tool]) => ({ name, description: tool.description, inputSchema: tool.inputSchema }));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ tools: toolList }));
      } else {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('🦆 Duck Agent MCP Server\n\nPOST /mcp - MCP protocol\nGET /sse - SSE\nGET /tools - List tools\nGET /health - Health');
      }
    });

    return new Promise((resolve) => {
      this.server!.listen(this.port, () => {
        console.log(`\n🦆 Duck Agent MCP Server on port ${this.port}`);
        console.log(`   http://localhost:${this.port}/mcp`);
        console.log(`   http://localhost:${this.port}/tools\n`);
        resolve();
      });
    });
  }

  private async processRequest(request: MCPRequest): Promise<MCPResponse> {
    const { id, method, params } = request;
    try {
      switch (method) {
        case 'initialize':
          return { jsonrpc: '2.0', id, result: { protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'duck-agent', version: '0.1.0' } } };
        case 'tools/list':
          return { jsonrpc: '2.0', id, result: { tools: Array.from(this.tools.entries()).map(([name, tool]) => ({ name, description: tool.description, inputSchema: tool.inputSchema })) } };
        case 'tools/call':
          return await this.callTool(params?.name, params?.arguments, id);
        default:
          return { jsonrpc: '2.0', id, error: { code: -32601, message: `Unknown method: ${method}` } };
      }
    } catch (error: any) {
      return { jsonrpc: '2.0', id, error: { code: -32603, message: error.message } };
    }
  }

  private async callTool(name: string, args: any, id: string | number): Promise<MCPResponse> {
    try {
      let result: any;
      switch (name) {
        case 'execute': result = await this.agent.execute(args?.task || ''); break;
        case 'think': result = await this.agent.think(args?.prompt || ''); break;
        case 'remember': await this.agent.remember(args?.content || ''); result = { success: true }; break;
        case 'recall': const memories = await this.agent.recall(args?.query || ''); result = { memories, count: memories.length }; break;
        case 'status': result = this.agent.getStatus(); break;
        case 'desktop':
          if (args?.action === 'screenshot') result = await this.agent.screenshot();
          else if (args?.action === 'open') { await this.agent.openApp(args?.target || ''); result = { success: true }; }
          else if (args?.action === 'click') { await this.agent.click(args?.x || 0, args?.y || 0); result = { success: true }; }
          else if (args?.action === 'type') { await this.agent.type(args?.target || ''); result = { success: true }; }
          break;
        default:
          return { jsonrpc: '2.0', id, error: { code: -32602, message: `Unknown tool: ${name}` } };
      }
      return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: typeof result === 'string' ? result : JSON.stringify(result) }] } };
    } catch (error: any) {
      return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: `Error: ${error.message}` }], isError: true } };
    }
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) { this.server.close(() => resolve()); this.server = null; }
      else resolve();
    });
    await this.agent.shutdown();
  }
}

export default MCPServer;
