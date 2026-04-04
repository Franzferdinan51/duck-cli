/**
 * MCP Bridge - Model Context Protocol Integration
 * Exposes duck-cli tools via MCP for consumption by OpenClaw and other MCP clients
 */

import { EventEmitter } from "events";
import * as http from "http";
import {
  ToolDefinition,
  ToolCallResult,
  MCPRequest,
  MCPResponse,
  RESTResponse,
} from "./types";

/**
 * MCP Tool Handler - handles tool execution requests
 */
type MCPToolHandler = (
  name: string,
  args: Record<string, any>
) => Promise<ToolCallResult> | ToolCallResult;

/**
 * MCP Bridge Configuration
 */
export interface MCPBridgeConfig {
  port: number;
  host?: string;
  path?: string;
}

/**
 * MCP Protocol Implementation
 * 
 * The MCP protocol uses JSON-RPC 2.0 style requests:
 * - initialize: Handshake with client
 * - tools/list: List available tools
 * - tools/call: Execute a tool
 */
export class MCPBridge extends EventEmitter {
  private config: MCPBridgeConfig;
  private tools: Map<string, ToolDefinition> = new Map();
  private toolHandlers: Map<string, MCPToolHandler> = new Map();
  private server: http.Server | null = null;
  private isRunning: boolean = false;
  private requestId: number = 0;

  constructor(config: MCPBridgeConfig) {
    super();
    this.config = {
      host: "0.0.0.0",
      path: "/mcp",
      ...config,
    };
  }

  /**
   * Register a tool
   */
  registerTool(definition: ToolDefinition, handler: MCPToolHandler): void {
    this.tools.set(definition.name, definition);
    this.toolHandlers.set(definition.name, handler);
    console.log(`[MCP Bridge] Registered tool: ${definition.name}`);
  }

  /**
   * Register multiple tools
   */
  registerTools(tools: Array<{ definition: ToolDefinition; handler: MCPToolHandler }>): void {
    for (const { definition, handler } of tools) {
      this.registerTool(definition, handler);
    }
  }

  /**
   * Unregister a tool
   */
  unregisterTool(name: string): void {
    this.tools.delete(name);
    this.toolHandlers.delete(name);
    console.log(`[MCP Bridge] Unregistered tool: ${name}`);
  }

  /**
   * Get all registered tools
   */
  getTools(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  /**
   * Check if tool exists
   */
  hasTool(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Start the MCP HTTP server
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.warn("[MCP Bridge] Server already running");
      return;
    }

    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        this.handleRequest(req, res);
      });

      this.server.on("error", (err) => {
        console.error(`[MCP Bridge] Server error: ${err.message}`);
        this.emit("error", { error: err.message });
        reject(err);
      });

      this.server.listen(this.config.port, this.config.host, () => {
        const addr = this.server?.address();
        const address = typeof addr === "object" ? `${addr?.address}:${addr?.port}` : addr;
        console.log(`[MCP Bridge] Server listening on ${address}`);
        this.isRunning = true;
        this.emit("started", { address });
        resolve();
      });
    });
  }

  /**
   * Stop the MCP server
   */
  async stop(): Promise<void> {
    if (!this.server) {
      return;
    }

    return new Promise((resolve, reject) => {
      this.server!.close((err) => {
        if (err) {
          reject(err);
        } else {
          this.isRunning = false;
          console.log("[MCP Bridge] Server stopped");
          this.emit("stopped");
          resolve();
        }
      });
    });
  }

  /**
   * Handle incoming HTTP request
   */
  private handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    // Set CORS headers
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    // Only handle POST requests to the MCP path
    if (req.method !== "POST" || req.url !== this.config.path) {
      res.writeHead(404);
      res.end(JSON.stringify({ error: "Not found" }));
      return;
    }

    let body = "";
    
    req.on("data", (chunk) => {
      body += chunk;
    });

    req.on("end", async () => {
      try {
        const request: MCPRequest = JSON.parse(body);
        const response = await this.processRequest(request);
        
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(response));
      } catch (err: any) {
        console.error(`[MCP Bridge] Request error: ${err.message}`);
        
        const errorResponse: MCPResponse = {
          error: {
            code: -32603,
            message: err.message,
          },
        };
        
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(errorResponse));
      }
    });

    req.on("error", (err) => {
      console.error(`[MCP Bridge] Request error: ${err.message}`);
    });
  }

  /**
   * Process an MCP request
   */
  private async processRequest(request: MCPRequest): Promise<MCPResponse> {
    const { method, params } = request;

    console.log(`[MCP Bridge] Processing: ${method}`);

    switch (method) {
      case "initialize":
        return this.handleInitialize(params);

      case "tools/list":
      case "tool_definitions":
        return this.handleToolsList();

      case "tools/call":
      case "tool_call":
        return this.handleToolCall(params);

      case "ping":
        return { result: { pong: true } };

      default:
        return {
          error: {
            code: -32601,
            message: `Unknown method: ${method}`,
          },
        };
    }
  }

  /**
   * Handle initialize request - MCP handshake
   */
  private handleInitialize(params?: any): MCPResponse {
    const response = {
      protocolVersion: "2024-11-05",
      capabilities: {
        tools: {
          listChanged: true,
        },
      },
      serverInfo: {
        name: "duck-cli",
        version: "1.0.0",
      },
    };

    console.log("[MCP Bridge] Client initialized");
    return { result: response };
  }

  /**
   * Handle tools/list request
   */
  private handleToolsList(): MCPResponse {
    const tools = this.getTools();
    
    return {
      result: {
        tools: tools.map((t) => ({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema,
        })),
      },
    };
  }

  /**
   * Handle tools/call request
   */
  private async handleToolCall(params?: any): Promise<MCPResponse> {
    if (!params) {
      return {
        error: {
          code: -32602,
          message: "Missing parameters",
        },
      };
    }

    const name = params.name || params.tool;
    const args = params.arguments || params.args || {};

    if (!name) {
      return {
        error: {
          code: -32602,
          message: "Missing tool name",
        },
      };
    }

    if (!this.tools.has(name)) {
      return {
        result: {
          content: [
            {
              type: "text",
              text: JSON.stringify({ error: `Unknown tool: ${name}` }),
            },
          ],
          isError: true,
        },
      };
    }

    try {
      const handler = this.toolHandlers.get(name)!;
      const result = await handler(name, args);

      if (result.success) {
        return {
          result: {
            content: [
              {
                type: "text",
                text: typeof result.result === "string" 
                  ? result.result 
                  : JSON.stringify(result.result),
              },
            ],
          },
        };
      } else {
        return {
          result: {
            content: [
              {
                type: "text",
                text: result.error || "Tool execution failed",
              },
            ],
            isError: true,
          },
        };
      }
    } catch (err: any) {
      return {
        result: {
          content: [
            {
              type: "text",
              text: err.message,
            },
          ],
          isError: true,
        },
      };
    }
  }

  /**
   * Get server status
   */
  getStatus(): { running: boolean; address?: string; toolCount: number } {
    const addr = this.server?.address();
    return {
      running: this.isRunning,
      address: typeof addr === "object" ? `${addr?.address}:${addr?.port}` : undefined,
      toolCount: this.tools.size,
    };
  }

  /**
   * Generate OpenAPI schema for REST bridge
   */
  generateOpenAPISchema(): any {
    const paths: any = {};
    
    // Tools list endpoint
    paths["/mcp/tools"] = {
      get: {
        summary: "List available MCP tools",
        responses: {
          "200": {
            description: "List of tools",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    tools: {
                      type: "array",
                      items: { $ref: "#/components/schemas/Tool" },
                    },
                  },
                },
              },
            },
          },
        },
      },
    };

    // Tool call endpoint
    paths["/mcp/tools/call"] = {
      post: {
        summary: "Execute a tool",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name"],
                properties: {
                  name: { type: "string", description: "Tool name" },
                  arguments: { type: "object", description: "Tool arguments" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Tool result",
          },
        },
      },
    };

    // Build tool schemas
    const schemas: any = {};
    Array.from(this.tools.entries()).forEach(([name, tool]) => {
      schemas[name] = {
        type: "object",
        properties: tool.inputSchema.properties || {},
      };
    });

    return {
      openapi: "3.0.0",
      info: {
        title: "duck-cli MCP Bridge",
        version: "1.0.0",
        description: "Model Context Protocol bridge for duck-cli tools",
      },
      paths,
      components: {
        schemas: {
          Tool: {
            type: "object",
            properties: {
              name: { type: "string" },
              description: { type: "string" },
              inputSchema: { type: "object" },
            },
          },
          ...schemas,
        },
      },
    };
  }

  /**
   * Emit event
   */
  emit(event: string, ...args: any[]): boolean {
    return super.emit(event, ...args);
  }
}
