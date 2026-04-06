/**
 * Bridge Manager - Manages all bridge connections for duck-cli
 * Coordinates ACP, MCP, WebSocket, and REST bridges
 */

import { EventEmitter } from "events";
import { ACPBridge } from "./acp-bridge";
import { MCPBridge, MCPBridgeConfig } from "./mcp-bridge";
import { RESTBridge, RESTBridgeConfig } from "./rest-bridge";
import {
  BridgeConfig,
  BridgeState,
  ToolDefinition,
  ToolCallResult,
  AgentSession,
  BridgeEvent,
} from "./types";

/**
 * Tool registration with handler
 */
export interface ToolRegistration {
  definition: ToolDefinition;
  handler: (tool: string, params: Record<string, any>) => Promise<ToolCallResult>;
}

/**
 * Bridge Manager Configuration
 */
export interface BridgeManagerConfig {
  agentId: string;
  agentName: string;
  gatewayUrl: string;
  reconnectInterval?: number;
  heartbeatInterval?: number;
  /** Enable MCP server */
  mcpEnabled?: boolean;
  mcpPort?: number;
  /** Enable REST API */
  restEnabled?: boolean;
  restPort?: number;
}

/**
 * Bridge Manager - central manager for all bridge connections
 */
export class BridgeManager extends EventEmitter {
  private config: Required<BridgeManagerConfig>;
  private acpBridge: ACPBridge;
  private mcpBridge: MCPBridge;
  private restBridge: RESTBridge;
  private state: BridgeState = "disconnected";
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private cleanupTimer: NodeJS.Timeout | null = null;
  private isInitialized: boolean = false;

  constructor(config: BridgeManagerConfig) {
    super();
    
    // Set defaults
    this.config = {
      gatewayUrl: config.gatewayUrl,
      agentId: config.agentId,
      agentName: config.agentName,
      reconnectInterval: config.reconnectInterval || 5000,
      heartbeatInterval: config.heartbeatInterval || 30000,
      mcpEnabled: config.mcpEnabled !== false,
      mcpPort: config.mcpPort || 9090,
      restEnabled: config.restEnabled !== false,
      restPort: config.restPort || 8080,
    };

    // Create bridges
    const acpConfig: BridgeConfig = {
      gatewayUrl: this.config.gatewayUrl,
      agentId: this.config.agentId,
      agentName: this.config.agentName,
      reconnectInterval: this.config.reconnectInterval,
      heartbeatInterval: this.config.heartbeatInterval,
    };

    this.acpBridge = new ACPBridge(acpConfig);
    this.mcpBridge = new MCPBridge({ port: this.config.mcpPort });
    this.restBridge = new RESTBridge({ port: this.config.restPort });

    this.setupHandlers();
  }

  /**
   * Setup internal event handlers
   */
  private setupHandlers(): void {
    // ACP Bridge events
    this.acpBridge.on("connected", () => {
      this.setState("connected");
      this.emit("connected");
      this.startHeartbeat();
      this.emitEvent("connected", {});
    });

    this.acpBridge.on("disconnected", (data: any) => {
      this.setState("disconnected");
      this.emit("disconnected", data);
      this.emitEvent("disconnected", data);
      this.stopHeartbeat();
    });

    this.acpBridge.on("error", (data: any) => {
      this.emit("error", data);
      this.emitEvent("error", data);
    });

    this.acpBridge.on("state_change", (data: any) => {
      this.setState(data.state);
    });

    this.acpBridge.on("tool_call", (data: any) => {
      this.emit("tool_call", data);
    });

    this.acpBridge.on("spawn_agent", (data: any) => {
      this.emit("spawn_agent", data);
    });

    this.acpBridge.on("agent_output", (data: any) => {
      this.emit("agent_output", data);
    });

    // REST Bridge events
    this.restBridge.on("connect", () => {
      // User requested connect via REST
      this.connect().catch((err) => {
        console.error(`[BridgeManager] REST connect failed: ${err.message}`);
      });
    });

    this.restBridge.on("disconnect", () => {
      this.disconnect("User requested via REST");
    });

    // Forward MCP bridge events
    this.mcpBridge.on("error", (data: any) => {
      this.emit("mcp_error", data);
    });
  }

  /**
   * Initialize all bridges
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.warn("[BridgeManager] Already initialized");
      return;
    }

    console.log("[BridgeManager] Initializing bridges...");

    // Start REST API if enabled
    if (this.config.restEnabled) {
      try {
        await this.restBridge.start();
        console.log(`[BridgeManager] REST API started on port ${this.config.restPort}`);
      } catch (err: any) {
        console.error(`[BridgeManager] Failed to start REST API: ${err.message}`);
        // Don't fail initialization for REST
      }
    }

    // Start MCP server if enabled
    if (this.config.mcpEnabled) {
      try {
        await this.mcpBridge.start();
        console.log(`[BridgeManager] MCP server started on port ${this.config.mcpPort}`);
      } catch (err: any) {
        console.error(`[BridgeManager] Failed to start MCP server: ${err.message}`);
        // Don't fail initialization for MCP
      }
    }

    // Start session cleanup timer
    this.cleanupTimer = setInterval(() => {
      this.acpBridge.cleanupSessions();
    }, 60000); // Every minute

    // Start mesh health broadcasting if enabled
    if (process.env.MESH_ENABLED === 'true') {
      const meshUrl = process.env.MESH_URL || 'http://localhost:4000';
      const meshKey = process.env.MESH_API_KEY || 'openclaw-mesh-default-key';
      this.startMeshHealthBroadcast(meshUrl, meshKey);
    }

    this.isInitialized = true;
    console.log("[BridgeManager] Initialization complete");
  }

  /**
   * Connect to OpenClaw gateway
   */
  async connect(): Promise<void> {
    console.log(`[BridgeManager] Connecting to ${this.config.gatewayUrl}...`);
    this.setState("connecting");

    try {
      await this.acpBridge.connect();
      console.log("[BridgeManager] Connected to gateway");
    } catch (err: any) {
      this.setState("error");
      throw new Error(`Failed to connect: ${err.message}`);
    }
  }

  /**
   * Disconnect from gateway
   */
  disconnect(reason?: string): void {
    console.log(`[BridgeManager] Disconnecting: ${reason || "no reason"}`);
    this.acpBridge.disconnect(reason);
    this.stopHeartbeat();
  }

  /**
   * Register a tool with all bridges
   */
  registerTool(registration: ToolRegistration): void {
    const { definition, handler } = registration;

    // Register with ACP bridge
    this.acpBridge.registerTool(definition, handler);

    // Register with MCP bridge
    this.mcpBridge.registerTool(definition, handler);

    // Register with REST bridge
    this.restBridge.registerTool(definition, handler);

    console.log(`[BridgeManager] Registered tool: ${definition.name}`);
  }

  /**
   * Register multiple tools
   */
  registerTools(registrations: ToolRegistration[]): void {
    for (const reg of registrations) {
      this.registerTool(reg);
    }
  }

  /**
   * Unregister a tool
   */
  unregisterTool(name: string): void {
    this.acpBridge.unregisterTool(name);
    this.mcpBridge.unregisterTool(name);
    this.restBridge.unregisterTool(name);
    console.log(`[BridgeManager] Unregistered tool: ${name}`);
  }

  /**
   * Get all registered tools
   */
  getRegisteredTools(): ToolDefinition[] {
    return this.acpBridge.getRegisteredTools();
  }

  /**
   * Call a tool on the OpenClaw side
   */
  async callTool(
    tool: string,
    params: Record<string, any>,
    timeoutMs?: number
  ): Promise<ToolCallResult> {
    return this.acpBridge.callTool(tool, params, timeoutMs);
  }

  /**
   * Send streaming agent output to OpenClaw
   */
  async sendAgentOutput(sessionId: string, text?: string, done?: boolean): Promise<void> {
    await this.acpBridge.sendAgentOutput(sessionId, text, done);
  }

  /**
   * Create a new agent session
   */
  async createSession(task: string, agentId?: string): Promise<AgentSession> {
    return this.acpBridge.createSession(task, agentId);
  }

  /**
   * Get an active session
   */
  getSession(sessionId: string): AgentSession | undefined {
    return this.acpBridge.getSession(sessionId);
  }

  /**
   * Update session status
   */
  updateSession(sessionId: string, updates: Partial<AgentSession>): void {
    this.acpBridge.updateSession(sessionId, updates);
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): AgentSession[] {
    return this.acpBridge.getActiveSessions();
  }

  /**
   * Register agent output handler
   */
  onAgentOutput(sessionId: string, handler: (sessionId: string, text?: string, done?: boolean) => void): void {
    this.acpBridge.onAgentOutput(sessionId, handler);
  }

  /**
   * Remove agent output handler
   */
  offAgentOutput(sessionId: string): void {
    this.acpBridge.offAgentOutput(sessionId);
  }

  /**
   * Register a custom REST endpoint
   */
  registerRESTEndpoint(
    path: string,
    handler: (req: any, res: any, pathname: string, query: URLSearchParams) => void | Promise<void>
  ): void {
    this.restBridge.registerEndpoint(path, handler);
  }

  /**
   * Update REST bridge state
   */
  updateRESTState(state: Partial<{ connected: boolean; state: BridgeState; activeSessions: number; lastHeartbeat: number }>): void {
    this.restBridge.updateState(state);
  }

  /**
   * Start heartbeat
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();
    
    this.heartbeatTimer = setInterval(async () => {
      try {
        await this.acpBridge.sendHeartbeat();
        this.updateRESTState({ lastHeartbeat: Date.now() });
      } catch (err) {
        console.error(`[BridgeManager] Heartbeat failed: ${err}`);
      }
    }, this.config.heartbeatInterval);
  }

  /**
   * Stop heartbeat
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Set state
   */
  private setState(state: BridgeState): void {
    if (this.state !== state) {
      this.state = state;
      this.emit("stateChanged", state);
      this.updateRESTState({ state });
    }
  }

  /**
   * Get current state
   */
  getState(): BridgeState {
    return this.state;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.state === "connected";
  }

  /**
   * Get bridge statuses
   */
  getStatus(): {
    state: BridgeState;
    connected: boolean;
    acp: { url: string; connected: boolean };
    mcp: { running: boolean; port: number; toolCount: number };
    rest: { running: boolean; port: number };
    sessions: number;
  } {
    return {
      state: this.state,
      connected: this.isConnected(),
      acp: {
        url: this.config.gatewayUrl,
        connected: this.acpBridge.isConnected(),
      },
      mcp: {
        running: this.mcpBridge.getStatus().running,
        port: this.config.mcpPort,
        toolCount: this.mcpBridge.getTools().length,
      },
      rest: {
        running: this.restBridge.getStatus().running,
        port: this.config.restPort,
      },
      sessions: this.getActiveSessions().length,
    };
  }

  /**
   * Emit a bridge event
   */
  private emitEvent(type: BridgeEvent["type"], data?: any): void {
    const event: BridgeEvent = {
      type,
      data,
      timestamp: Date.now(),
    };
    this.emit("event", event);
  }

  /**
   * Shutdown all bridges
   */
  async shutdown(): Promise<void> {
    console.log("[BridgeManager] Shutting down...");

    // Stop timers
    this.stopHeartbeat();
    
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    // Disconnect ACP
    this.acpBridge.disconnect("Shutdown");

    // Stop MCP
    if (this.mcpBridge.getStatus().running) {
      await this.mcpBridge.stop();
    }

    // Stop REST
    if (this.restBridge.getStatus().running) {
      await this.restBridge.stop();
    }

    this.isInitialized = false;
    console.log("[BridgeManager] Shutdown complete");
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<BridgeManagerConfig>): void {
    Object.assign(this.config, config);
    
    // Update ACP config if gateway URL changed
    if (config.gatewayUrl) {
      this.acpBridge.updateConfig({ gatewayUrl: config.gatewayUrl });
    }

    if (config.heartbeatInterval) {
      this.acpBridge.updateConfig({ heartbeatInterval: config.heartbeatInterval });
      if (this.isConnected()) {
        this.startHeartbeat(); // Restart with new interval
      }
    }
  }

  /**
   * Get configuration
   */
  getConfig(): Required<BridgeManagerConfig> {
    return { ...this.config };
  }

  /**
   * Get the ACP bridge directly for advanced use
   */
  getACPBridge(): ACPBridge {
    return this.acpBridge;
  }

  /**
   * Get the MCP bridge directly for advanced use
   */
  getMCPBridge(): MCPBridge {
    return this.mcpBridge;
  }

  /**
   * Get the REST bridge directly for advanced use
   */
  getRESTBridge(): RESTBridge {
    return this.restBridge;
  }

  // ═══════════════════════════════════════════════════════════════
  // MESH INTEGRATION — Agent Mesh (coordination bus)
  // ═══════════════════════════════════════════════════════════════

  /**
   * Register this agent with the agent-mesh coordination bus
   * Mesh = slow/async coordination (health, catastrophes, events)
   * NOT for fast task execution (use direct calls for that)
   */
  async registerWithMesh(meshUrl = 'http://localhost:4000', apiKey = 'openclaw-mesh-default-key'): Promise<boolean> {
    try {
      const resp = await fetch(`${meshUrl}/api/agents/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey,
        },
        body: JSON.stringify({
          name: this.config.agentName,
          endpoint: this.config.gatewayUrl,
          capabilities: ['health-monitor', 'routing', 'acp', 'mcp', 'catastrophe-handler'],
        }),
      });
      const data = await resp.json();
      if (data.success) {
        console.log(`[BridgeManager] ✅ Registered with mesh as "${data.agentId}"`);
        return true;
      }
      console.warn(`[BridgeManager] ⚠️ Mesh registration failed: ${data.message}`);
      return false;
    } catch (err) {
      console.warn(`[BridgeManager] ⚠️ Mesh unavailable at ${meshUrl} — continuing without mesh`);
      return false;
    }
  }

  /**
   * Broadcast health status to mesh (called every 30s)
   */
  async broadcastHealthToMesh(meshUrl = 'http://localhost:4000', apiKey = 'openclaw-mesh-default-key'): Promise<void> {
    try {
      await fetch(`${meshUrl}/api/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey,
        },
        body: JSON.stringify({
          type: 'broadcast',
          fromAgentId: this.config.agentName,
          content: {
            event: 'health',
            status: this.state,
            agentId: this.config.agentId,
            agentName: this.config.agentName,
            capabilities: ['health-monitor', 'routing', 'acp', 'mcp', 'catastrophe-handler'],
            timestamp: Date.now(),
          },
        }),
      });
    } catch (e) {
      console.warn('[BridgeManager] Mesh registration failed (mesh optional):', e instanceof Error ? e.message : e);
    }
  }

  /**
   * Broadcast a catastrophe alert to mesh
   */
  async broadcastCatastropheToMesh(message: string, meshUrl = 'http://localhost:4000', apiKey = 'openclaw-mesh-default-key'): Promise<void> {
    try {
      await fetch(`${meshUrl}/api/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey,
        },
        body: JSON.stringify({
          type: 'broadcast',
          fromAgentId: this.config.agentName,
          content: {
            event: 'catastrophe',
            message,
            agentId: this.config.agentId,
            timestamp: Date.now(),
          },
        }),
      });
      console.warn(`[BridgeManager] 🚨 Catastrophe broadcast: ${message}`);
    } catch (e) {
      console.error('[BridgeManager] Catastrophe broadcast failed:', e instanceof Error ? e.message : e);
    }
  }

  /**
   * Start mesh health broadcasting (every 30s)
   * Call after initialize() if you want mesh integration
   */
  startMeshHealthBroadcast(meshUrl = 'http://localhost:4000', apiKey = 'openclaw-mesh-default-key'): void {
    // Register first
    this.registerWithMesh(meshUrl, apiKey).catch(() => {});

    // Broadcast every 30s
    const interval = setInterval(() => {
      this.broadcastHealthToMesh(meshUrl, apiKey);
    }, 30000);

    // Emit so caller can track
    this.emit('mesh_health_broadcast_started', { interval });
    console.log('[BridgeManager] 🌐 Mesh health broadcast started (30s interval)');
  }
}
