/**
 * 🦆 Duck Agent - External Agent Mesh Bridge
 * Allows external agents to connect to the duck-cli agent mesh
 * Implements the agent-mesh-api protocol for hive-mind connectivity
 */

import { EventEmitter } from "events";
import http from "http";
import { WebSocket, WebSocketServer } from "ws";

export interface ExternalAgentConfig {
  meshPort: number;
  apiPort: number;
  allowedOrigins?: string[];
  authToken?: string;
  enableHiveMind?: boolean;
}

export interface ExternalAgent {
  id: string;
  name: string;
  role: string;
  capabilities: string[];
  ws?: WebSocket;
  connectedAt: Date;
  lastHeartbeat: Date;
}

export interface MeshMessage {
  type: "broadcast" | "direct" | "discovery" | "heartbeat" | "capability";
  from: string;
  to?: string;
  payload: any;
  timestamp: number;
}

/**
 * External Agent Mesh Bridge
 * Enables external agents to join the duck-cli mesh network
 */
export class ExternalMeshBridge extends EventEmitter {
  private config: Required<ExternalAgentConfig>;
  private httpServer?: http.Server;
  private wsServer?: WebSocketServer;
  private externalAgents: Map<string, ExternalAgent> = new Map();
  private heartbeatInterval?: NodeJS.Timeout;

  constructor(config: ExternalAgentConfig) {
    super();
    this.config = {
      meshPort: config.meshPort || 4001,
      apiPort: config.apiPort || 4002,
      allowedOrigins: config.allowedOrigins || ["*"],
      authToken: config.authToken || process.env.MESH_AUTH_TOKEN || "",
      enableHiveMind: config.enableHiveMind !== false,
    };
  }

  /**
   * Start the external mesh bridge
   */
  async start(): Promise<void> {
    // Create HTTP server for REST API
    this.httpServer = http.createServer((req, res) => {
      this.handleHttpRequest(req, res);
    });

    // Create WebSocket server for real-time mesh communication
    this.wsServer = new WebSocketServer({
      server: this.httpServer,
      path: "/mesh",
      verifyClient: (info, cb) => {
        // Check auth token if configured
        if (this.config.authToken) {
          const token = info.req.headers["x-mesh-auth"];
          if (token !== this.config.authToken) {
            cb(false, 401, "Unauthorized");
            return;
          }
        }
        cb(true);
      },
    });

    this.wsServer.on("connection", (ws, req) => {
      this.handleWsConnection(ws, req);
    });

    // Start listening
    await new Promise<void>((resolve, reject) => {
      this.httpServer!.listen(this.config.meshPort, () => {
        console.log(`[ExternalMeshBridge] 🌐 Mesh bridge listening on port ${this.config.meshPort}`);
        resolve();
      });
      this.httpServer!.on("error", reject);
    });

    // Start heartbeat monitoring
    this.startHeartbeat();

    this.emit("started", { port: this.config.meshPort });
  }

  /**
   * Handle HTTP REST API requests
   */
  private handleHttpRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    // Set CORS headers
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Mesh-Auth");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url || "/", `http://localhost:${this.config.meshPort}`);

    // Health check
    if (url.pathname === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        status: "ok",
        externalAgents: this.externalAgents.size,
        hiveMindEnabled: this.config.enableHiveMind,
      }));
      return;
    }

    // List connected external agents
    if (url.pathname === "/agents") {
      res.writeHead(200, { "Content-Type": "application/json" });
      const agents = Array.from(this.externalAgents.values()).map(a => ({
        id: a.id,
        name: a.name,
        role: a.role,
        capabilities: a.capabilities,
        connectedAt: a.connectedAt,
      }));
      res.end(JSON.stringify({ agents }));
      return;
    }

    // Register new agent (HTTP fallback)
    if (url.pathname === "/register" && req.method === "POST") {
      this.handleAgentRegistration(req, res);
      return;
    }

    // 404
    res.writeHead(404);
    res.end(JSON.stringify({ error: "Not found" }));
  }

  /**
   * Handle WebSocket connections from external agents
   */
  private handleWsConnection(ws: WebSocket, req: http.IncomingMessage): void {
    console.log("[ExternalMeshBridge] 🔌 New external agent connection");

    let agentId: string | null = null;

    ws.on("message", (data) => {
      try {
        const msg = JSON.parse(data.toString()) as MeshMessage;

        // Handle registration
        if (msg.type === "discovery" && msg.payload?.register) {
          agentId = msg.payload.agentId || `external-${Date.now()}`;
          const agent: ExternalAgent = {
            id: agentId,
            name: msg.payload.name || "External Agent",
            role: msg.payload.role || "worker",
            capabilities: msg.payload.capabilities || [],
            ws,
            connectedAt: new Date(),
            lastHeartbeat: new Date(),
          };
          this.externalAgents.set(agentId, agent);
          console.log(`[ExternalMeshBridge] ✅ Agent registered: ${agent.name} (${agentId})`);

          // Send acknowledgment
          ws.send(JSON.stringify({
            type: "discovery",
            from: "mesh-bridge",
            payload: {
              registered: true,
              agentId,
              meshInfo: {
                totalAgents: this.externalAgents.size,
                hiveMindEnabled: this.config.enableHiveMind,
              },
            },
            timestamp: Date.now(),
          }));

          this.emit("agent:connected", agent);
          return;
        }

        // Handle heartbeat
        if (msg.type === "heartbeat") {
          if (agentId && this.externalAgents.has(agentId)) {
            const agent = this.externalAgents.get(agentId)!;
            agent.lastHeartbeat = new Date();
          }
          return;
        }

        // Handle capability broadcast
        if (msg.type === "capability" && agentId) {
          const agent = this.externalAgents.get(agentId);
          if (agent) {
            agent.capabilities = msg.payload.capabilities || agent.capabilities;
            this.emit("agent:capability", { agent, capabilities: agent.capabilities });
          }
          return;
        }

        // Forward message to other agents (hive-mind)
        if (this.config.enableHiveMind) {
          this.broadcastToMesh(msg, agentId);
        }

        // Emit for local processing
        this.emit("message", msg);

      } catch (e) {
        console.error("[ExternalMeshBridge] ❌ Failed to parse message:", e);
      }
    });

    ws.on("close", () => {
      if (agentId && this.externalAgents.has(agentId)) {
        const agent = this.externalAgents.get(agentId)!;
        console.log(`[ExternalMeshBridge] 👋 Agent disconnected: ${agent.name} (${agentId})`);
        this.externalAgents.delete(agentId);
        this.emit("agent:disconnected", agent);
      }
    });

    ws.on("error", (err) => {
      console.error("[ExternalMeshBridge] ❌ WebSocket error:", err);
    });
  }

  /**
   * Handle HTTP agent registration
   */
  private handleAgentRegistration(req: http.IncomingMessage, res: http.ServerResponse): void {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", () => {
      try {
        const data = JSON.parse(body);
        const agentId = data.agentId || `external-${Date.now()}`;
        const agent: ExternalAgent = {
          id: agentId,
          name: data.name || "External Agent",
          role: data.role || "worker",
          capabilities: data.capabilities || [],
          connectedAt: new Date(),
          lastHeartbeat: new Date(),
        };
        this.externalAgents.set(agentId, agent);

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          registered: true,
          agentId,
          wsEndpoint: `ws://localhost:${this.config.meshPort}/mesh`,
        }));

        this.emit("agent:registered", agent);
      } catch (e) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: "Invalid registration data" }));
      }
    });
  }

  /**
   * Broadcast message to all connected external agents
   */
  private broadcastToMesh(msg: MeshMessage, excludeAgentId?: string | null): void {
    const message = JSON.stringify(msg);
    for (const [id, agent] of this.externalAgents) {
      if (id !== excludeAgentId && agent.ws?.readyState === WebSocket.OPEN) {
        agent.ws.send(message);
      }
    }
  }

  /**
   * Send message to specific external agent
   */
  sendToAgent(agentId: string, msg: MeshMessage): boolean {
    const agent = this.externalAgents.get(agentId);
    if (agent?.ws?.readyState === WebSocket.OPEN) {
      agent.ws.send(JSON.stringify(msg));
      return true;
    }
    return false;
  }

  /**
   * Broadcast to all external agents
   */
  broadcast(msg: Omit<MeshMessage, "timestamp">): void {
    const fullMsg: MeshMessage = {
      ...msg,
      timestamp: Date.now(),
    };
    this.broadcastToMesh(fullMsg);
  }

  /**
   * Get all connected external agents
   */
  getAgents(): ExternalAgent[] {
    return Array.from(this.externalAgents.values());
  }

  /**
   * Start heartbeat monitoring
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      const now = new Date();
      const timeout = 60000; // 60 seconds

      for (const [id, agent] of this.externalAgents) {
        if (now.getTime() - agent.lastHeartbeat.getTime() > timeout) {
          console.log(`[ExternalMeshBridge] 💔 Agent timeout: ${agent.name} (${id})`);
          agent.ws?.close();
          this.externalAgents.delete(id);
          this.emit("agent:timeout", agent);
        }
      }

      // Send heartbeat to all agents
      this.broadcast({
        type: "heartbeat",
        from: "mesh-bridge",
        payload: { timestamp: Date.now() },
      });
    }, 30000);
  }

  /**
   * Stop the bridge
   */
  async stop(): Promise<void> {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    // Close all agent connections
    for (const agent of this.externalAgents.values()) {
      agent.ws?.close();
    }
    this.externalAgents.clear();

    // Close servers
    this.wsServer?.close();
    await new Promise<void>((resolve) => {
      this.httpServer?.close(() => resolve());
    });

    this.emit("stopped");
  }
}

export default ExternalMeshBridge;
