/**
 * REST Bridge - HTTP REST API for duck-cli status and tools
 */

import { EventEmitter } from "events";
import * as http from "http";
import * as url from "url";
import {
  ToolDefinition,
  ToolCallResult,
  RESTBridgeConfig,
  RESTResponse,
  BridgeState,
  AgentSession,
} from "./types";

// Re-export for convenience
export { RESTBridgeConfig };

/**
 * REST Tool Handler
 */
type RestToolHandler = (
  name: string,
  args: Record<string, any>
) => Promise<ToolCallResult> | ToolCallResult;

/**
 * Request handler type for custom endpoints
 */
type RequestHandler = (
  req: http.IncomingMessage,
  res: http.ServerResponse,
  pathname: string,
  query: url.URLSearchParams
) => void | Promise<void>;

/**
 * REST Bridge - HTTP API for duck-cli bridge management
 */
export class RESTBridge extends EventEmitter {
  private config: RESTBridgeConfig;
  private server: http.Server | null = null;
  private isRunning: boolean = false;
  private tools: Map<string, ToolDefinition> = new Map();
  private toolHandlers: Map<string, RestToolHandler> = new Map();
  private customHandlers: Map<string, RequestHandler> = new Map();
  private agentState: {
    connected: boolean;
    state: BridgeState;
    lastHeartbeat: number;
    activeSessions: number;
  } = {
    connected: false,
    state: "disconnected",
    lastHeartbeat: 0,
    activeSessions: 0,
  };

  constructor(config: RESTBridgeConfig) {
    super();
    this.config = {
      host: "0.0.0.0",
      ...config,
    };
  }

  /**
   * Register a tool
   */
  registerTool(definition: ToolDefinition, handler: RestToolHandler): void {
    this.tools.set(definition.name, definition);
    this.toolHandlers.set(definition.name, handler);
  }

  /**
   * Register multiple tools
   */
  registerTools(tools: Array<{ definition: ToolDefinition; handler: RestToolHandler }>): void {
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
  }

  /**
   * Register a custom REST endpoint
   */
  registerEndpoint(path: string, handler: RequestHandler): void {
    this.customHandlers.set(path, handler);
    console.log(`[REST Bridge] Registered endpoint: ${path}`);
  }

  /**
   * Update agent state
   */
  updateState(state: Partial<typeof this.agentState>): void {
    Object.assign(this.agentState, state);
  }

  /**
   * Start the REST API server
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.warn("[REST Bridge] Server already running");
      return;
    }

    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        this.handleRequest(req, res);
      });

      this.server.on("error", (err) => {
        console.error(`[REST Bridge] Server error: ${err.message}`);
        this.emit("error", { error: err.message });
        reject(err);
      });

      this.server.listen(this.config.port, this.config.host, () => {
        const addr = this.server?.address();
        const address = typeof addr === "object" ? `${addr?.address}:${addr?.port}` : addr;
        console.log(`[REST Bridge] Server listening on ${address}`);
        this.isRunning = true;
        this.emit("started", { address });
        resolve();
      });
    });
  }

  /**
   * Stop the REST server
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
          console.log("[REST Bridge] Server stopped");
          this.emit("stopped");
          resolve();
        }
      });
    });
  }

  /**
   * Handle HTTP request
   */
  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    // CORS
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    const parsedUrl = url.parse(req.url || "/", true);
    const pathname = parsedUrl.pathname || "/";
    const query = parsedUrl.query;

    // Set JSON content type
    res.setHeader("Content-Type", "application/json");

    try {
      // Check custom handlers first
      const customHandler = this.customHandlers.get(pathname);
      if (customHandler) {
        await customHandler(req, res, pathname, new url.URLSearchParams(query as Record<string, string>));
        return;
      }

      // Route based on path
      if (pathname === "/health" || pathname === "/api/health") {
        return this.handleHealth(res);
      }

      if (pathname === "/status" || pathname === "/api/status") {
        return this.handleStatus(res);
      }

      if (pathname === "/tools" || pathname === "/api/tools") {
        if (req.method === "GET") {
          return this.handleListTools(res);
        }
      }

      if (pathname.startsWith("/tools/")) {
        const toolName = pathname.slice("/tools/".length);
        if (req.method === "GET") {
          return this.handleGetTool(res, toolName);
        }
        if (req.method === "POST") {
          return this.handleCallTool(req, res, toolName);
        }
      }

      if (pathname === "/call" || pathname === "/api/call") {
        return this.handleCallTool(req, res);
      }

      if (pathname === "/sessions" || pathname === "/api/sessions") {
        return this.handleSessions(res);
      }

      if (pathname === "/connect" || pathname === "/api/connect") {
        return this.handleConnect(req, res);
      }

      if (pathname === "/disconnect" || pathname === "/api/disconnect") {
        return this.handleDisconnect(req, res);
      }

      // Root endpoint
      if (pathname === "/" || pathname === "/api") {
        return this.handleRoot(res);
      }

      // 404
      res.writeHead(404);
      res.end(JSON.stringify({ success: false, error: "Not found" }));
    } catch (err: any) {
      console.error(`[REST Bridge] Request error: ${err.message}`);
      res.writeHead(500);
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
  }

  /**
   * Health check endpoint
   */
  private handleHealth(res: http.ServerResponse): void {
    res.writeHead(200);
    res.end(JSON.stringify({ status: "ok", timestamp: Date.now() }));
  }

  /**
   * Status endpoint - returns agent connection state
   */
  private handleStatus(res: http.ServerResponse): void {
    const status = {
      success: true,
      data: {
        ...this.agentState,
        uptime: this.isRunning ? Date.now() - (this.server?.address() as any)?.startTime : 0,
        toolsRegistered: this.tools.size,
      },
    };
    res.writeHead(200);
    res.end(JSON.stringify(status));
  }

  /**
   * Root endpoint - API info
   */
  private handleRoot(res: http.ServerResponse): void {
    const info = {
      name: "duck-cli REST Bridge",
      version: "1.0.0",
      endpoints: [
        "GET /health - Health check",
        "GET /status - Agent status",
        "GET /tools - List registered tools",
        "GET /tools/:name - Get tool definition",
        "POST /tools/:name - Execute tool",
        "POST /call - Execute tool (body: {name, args})",
        "GET /sessions - List active sessions",
        "POST /connect - Connect to gateway",
        "POST /disconnect - Disconnect from gateway",
      ],
    };
    res.writeHead(200);
    res.end(JSON.stringify(info));
  }

  /**
   * List all registered tools
   */
  private handleListTools(res: http.ServerResponse): void {
    const tools = Array.from(this.tools.values()).map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    }));

    res.writeHead(200);
    res.end(JSON.stringify({ success: true, data: tools }));
  }

  /**
   * Get a specific tool definition
   */
  private handleGetTool(res: http.ServerResponse, name: string): void {
    const tool = this.tools.get(name);
    
    if (!tool) {
      res.writeHead(404);
      res.end(JSON.stringify({ success: false, error: `Tool not found: ${name}` }));
      return;
    }

    res.writeHead(200);
    res.end(JSON.stringify({ success: true, data: tool }));
  }

  /**
   * Call a tool
   */
  private async handleCallTool(req: http.IncomingMessage, res: http.ServerResponse, name?: string): Promise<void> {
    let body = "";

    await new Promise<void>((resolve) => {
      req.on("data", (chunk) => {
        body += chunk;
      });
      req.on("end", resolve);
    });

    let params: { name?: string; args?: Record<string, any> } = {};
    
    try {
      params = body ? JSON.parse(body) : {};
    } catch {
      res.writeHead(400);
      res.end(JSON.stringify({ success: false, error: "Invalid JSON body" }));
      return;
    }

    const toolName = name || params.name;
    
    if (!toolName) {
      res.writeHead(400);
      res.end(JSON.stringify({ success: false, error: "Missing tool name" }));
      return;
    }

    const handler = this.toolHandlers.get(toolName);
    
    if (!handler) {
      res.writeHead(404);
      res.end(JSON.stringify({ success: false, error: `Tool not found: ${toolName}` }));
      return;
    }

    try {
      const result = await handler(toolName, params.args || {});
      res.writeHead(200);
      res.end(JSON.stringify(result));
    } catch (err: any) {
      res.writeHead(200);
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
  }

  /**
   * List active sessions
   */
  private handleSessions(res: http.ServerResponse): void {
    // This would need to be connected to the bridge manager
    res.writeHead(200);
    res.end(
      JSON.stringify({
        success: true,
        data: {
          count: this.agentState.activeSessions,
          sessions: [],
        },
      })
    );
  }

  /**
   * Connect endpoint (trigger connect)
   */
  private handleConnect(req: http.IncomingMessage, res: http.ServerResponse): void {
    this.emit("connect");
    res.writeHead(200);
    res.end(JSON.stringify({ success: true, message: "Connect requested" }));
  }

  /**
   * Disconnect endpoint (trigger disconnect)
   */
  private handleDisconnect(req: http.IncomingMessage, res: http.ServerResponse): void {
    this.emit("disconnect");
    res.writeHead(200);
    res.end(JSON.stringify({ success: true, message: "Disconnect requested" }));
  }

  /**
   * Get server status
   */
  getStatus(): { running: boolean; address?: string; endpoints: number } {
    const addr = this.server?.address();
    return {
      running: this.isRunning,
      address: typeof addr === "object" ? `${addr?.address}:${addr?.port}` : undefined,
      endpoints: this.customHandlers.size,
    };
  }

  /**
   * Generate OpenAPI schema
   */
  generateOpenAPISchema(): any {
    const paths: any = {
      "/health": {
        get: {
          summary: "Health check",
          responses: { "200": { description: "OK" } },
        },
      },
      "/status": {
        get: {
          summary: "Get agent status",
          responses: {
            "200": {
              description: "Agent status",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      connected: { type: "boolean" },
                      state: { type: "string" },
                      activeSessions: { type: "number" },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/tools": {
        get: {
          summary: "List all tools",
          responses: { "200": { description: "Tool list" } },
        },
      },
      "/call": {
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
                    name: { type: "string" },
                    args: { type: "object" },
                  },
                },
              },
            },
          },
          responses: { "200": { description: "Tool result" } },
        },
      },
    };

    // Add per-tool endpoints
    Array.from(this.tools.keys()).forEach((name) => {
      paths[`/tools/${name}`] = {
        get: {
          summary: `Get ${name} tool definition`,
          responses: { "200": { description: "Tool definition" } },
        },
        post: {
          summary: `Execute ${name} tool`,
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: this.tools.get(name)?.inputSchema || { type: "object" },
              },
            },
          },
          responses: { "200": { description: "Tool result" } },
        },
      };
    });

    return {
      openapi: "3.0.0",
      info: {
        title: "duck-cli REST Bridge",
        version: "1.0.0",
        description: "REST API for duck-cli bridge management",
      },
      paths,
    };
  }
}
