/**
 * 🦆 Duck Agent - MCP Remote Client (v2026.3.31 OpenClaw Compatibility)
 * 
 * Connect to remote MCP servers via HTTP/SSE (OpenClaw v2026.3.31 spec)
 * 
 * Supports:
 * - Remote HTTP/SSE MCP server connections
 * - Auth headers for authenticated endpoints
 * - Connection timeouts
 * - Tool calling on remote servers
 */

import http from 'http';
import https from 'https';
import { EventEmitter } from 'events';
import { URL } from 'url';

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

export interface MCPTool {
  name: string;
  description?: string;
  inputSchema: any;
  annotations?: any;
}

export interface MCPServerInfo {
  name: string;
  version?: string;
  description?: string;
}

export interface MCPCapabilities {
  tools?: Record<string, any>;
  resources?: { subscribe?: boolean; list?: boolean };
  prompts?: { list?: boolean };
  sampling?: {};
}

export interface RemoteMCPConfig {
  /** Server URL (http:// or https://) */
  url: string;
  /** Auth header for authenticated endpoints */
  authHeader?: string;
  /** Connection timeout in ms */
  timeout?: number;
  /** Server name for logging */
  name?: string;
}

/**
 * Remote MCP Client - Connect to external MCP servers via HTTP/SSE
 * 
 * OpenClaw v2026.3.31 introduces remote MCP server support for mcp.servers URL configs.
 * This client implements that spec.
 */
export class RemoteMCPClient extends EventEmitter {
  private config: RemoteMCPConfig;
  private serverInfo: MCPServerInfo | null = null;
  private capabilities: MCPCapabilities = {};
  private tools: Map<string, MCPTool> = new Map();
  private initialized: boolean = false;
  private sseConnection: http.ClientRequest | null = null;
  private requestId: number = 1;
  private pendingRequests: Map<string | number, {
    resolve: (result: any) => void;
    reject: (error: any) => void;
  }> = new Map();

  constructor(config: RemoteMCPConfig) {
    super();
    this.config = {
      timeout: 30000,
      name: 'remote-mcp',
      ...config,
    };
  }

  /**
   * Initialize connection to remote MCP server
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Send initialize request
      const response = await this.sendRequest('initialize', {
        protocolVersion: '2024-11-05',
        clientInfo: {
          name: 'duck-agent',
          version: '0.4.0',
        },
        capabilities: {
          tools: {},
          resources: {},
        },
      });

      this.serverInfo = response.serverInfo;
      this.capabilities = response.capabilities;
      this.initialized = true;

      // List available tools
      const toolsResponse = await this.sendRequest('tools/list', {});
      for (const tool of toolsResponse.tools || []) {
        this.tools.set(tool.name, tool);
      }

      this.emit('ready', { serverInfo: this.serverInfo, tools: this.tools.size });
    } catch (error: any) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Send a JSON-RPC request to the remote server
   */
  private async sendRequest(method: string, params?: any): Promise<any> {
    const id = this.requestId++;
    
    const request: MCPRequest = {
      jsonrpc: '2.0',
      id,
      method,
      params,
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request ${method} timed out after ${this.config.timeout}ms`));
      }, this.config.timeout);

      this.pendingRequests.set(id, { resolve, reject });

      this.httpRequest(request)
        .then((response) => {
          clearTimeout(timeout);
          this.pendingRequests.delete(id);
          
          if (response.error) {
            reject(new Error(`${method} failed: ${response.error.message}`));
          } else {
            resolve(response.result);
          }
        })
        .catch((error) => {
          clearTimeout(timeout);
          this.pendingRequests.delete(id);
          reject(error);
        });
    });
  }

  /**
   * Make HTTP request to remote MCP server
   */
  private async httpRequest(request: MCPRequest): Promise<MCPResponse> {
    const url = new URL(this.config.url);
    const isHttps = url.protocol === 'https:';
    const client = isHttps ? https : http;

    const headers: http.OutgoingHttpHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
    };

    if (this.config.authHeader) {
      headers['Authorization'] = this.config.authHeader;
    }

    return new Promise((resolve, reject) => {
      const req = client.request(
        {
          hostname: url.hostname,
          port: url.port || (isHttps ? 443 : 80),
          path: url.pathname + (url.search || ''),
          method: 'POST',
          headers,
          timeout: this.config.timeout,
        },
        (res) => {
          let body = '';
          
          res.on('data', (chunk) => {
            body += chunk.toString();
          });
          
          res.on('end', () => {
            if (res.statusCode && res.statusCode >= 400) {
              reject(new Error(`HTTP ${res.statusCode}: ${body}`));
              return;
            }

            try {
              const response = JSON.parse(body) as MCPResponse;
              resolve(response);
            } catch (e) {
              reject(new Error(`Invalid JSON response: ${body}`));
            }
          });
        }
      );

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Connection timeout'));
      });

      req.write(JSON.stringify(request));
      req.end();
    });
  }

  /**
   * Call a tool on the remote server
   */
  async callTool(name: string, args: Record<string, any> = {}): Promise<any> {
    if (!this.initialized) {
      await this.initialize();
    }

    const response = await this.sendRequest('tools/call', {
      name,
      arguments: args,
    });

    return response;
  }

  /**
   * List tools available on remote server
   */
  async listTools(): Promise<MCPTool[]> {
    if (!this.initialized) {
      await this.initialize();
    }
    return Array.from(this.tools.values());
  }

  /**
   * Get server info
   */
  getServerInfo(): MCPServerInfo | null {
    return this.serverInfo;
  }

  /**
   * Get server capabilities
   */
  getCapabilities(): MCPCapabilities {
    return this.capabilities;
  }

  /**
   * Check if connected
   */
  isReady(): boolean {
    return this.initialized;
  }

  /**
   * Close connection
   */
  close(): void {
    if (this.sseConnection) {
      this.sseConnection.destroy();
      this.sseConnection = null;
    }
    this.initialized = false;
    this.emit('close');
  }
}

/**
 * Remote MCP Server Manager - Manage connections to multiple remote MCP servers
 */
export class RemoteMCPServerManager {
  private clients: Map<string, RemoteMCPClient> = new Map();

  /**
   * Add a remote MCP server
   */
  async add(name: string, config: RemoteMCPConfig): Promise<RemoteMCPClient> {
    const client = new RemoteMCPClient({ ...config, name });
    
    client.on('error', (error) => {
      console.error(`[RemoteMCP] ${name} error:`, error.message);
    });

    await client.initialize();
    this.clients.set(name, client);
    
    return client;
  }

  /**
   * Get a remote server client
   */
  get(name: string): RemoteMCPClient | undefined {
    return this.clients.get(name);
  }

  /**
   * Remove a remote server
   */
  remove(name: string): void {
    const client = this.clients.get(name);
    if (client) {
      client.close();
      this.clients.delete(name);
    }
  }

  /**
   * List all remote servers
   */
  list(): string[] {
    return Array.from(this.clients.keys());
  }

  /**
   * Call a tool on a specific remote server
   */
  async callTool(serverName: string, toolName: string, args: Record<string, any> = {}): Promise<any> {
    const client = this.clients.get(serverName);
    if (!client) {
      throw new Error(`Unknown remote server: ${serverName}`);
    }
    return client.callTool(toolName, args);
  }

  /**
   * Close all connections
   */
  closeAll(): void {
    for (const [name, client] of this.clients) {
      client.close();
    }
    this.clients.clear();
  }
}

export default RemoteMCPClient;
