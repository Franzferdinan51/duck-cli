/**
 * ACP Bridge - OpenClaw ACP Protocol Bridge
 * Connects duck-cli to OpenClaw gateway using ACP protocol
 */

import { EventEmitter } from "events";
import { WebSocketBridge } from "./websocket-bridge";
import { ACPProtocol } from "./acp-protocol";
import {
  ACPMessage,
  BridgeConfig,
  BridgeState,
  ToolDefinition,
  ToolCallResult,
  AgentSession,
  ConnectMessage,
  ToolCallMessage,
  ToolResultMessage,
  SpawnAgentMessage,
  AgentOutputMessage,
  generateId,
} from "./types";

/**
 * Tool call handler type
 */
type ToolCallHandler = (
  tool: string,
  params: Record<string, any>
) => Promise<ToolCallResult> | ToolCallResult;

/**
 * Agent output handler type
 */
type AgentOutputHandler = (
  sessionId: string,
  text?: string,
  done?: boolean
) => void | Promise<void>;

/**
 * ACP Bridge - High-level ACP communication with OpenClaw
 */
export class ACPBridge extends EventEmitter {
  private wsBridge: WebSocketBridge;
  private config: BridgeConfig;
  private registeredTools: Map<string, ToolDefinition> = new Map();
  private toolHandlers: Map<string, ToolCallHandler> = new Map();
  private agentOutputHandlers: Map<string, AgentOutputHandler> = new Map();
  private pendingToolCalls: Map<string, {
    resolve: (result: ToolCallResult) => void;
    reject: (err: Error) => void;
    timeout: NodeJS.Timeout;
  }> = new Map();
  private activeSessions: Map<string, AgentSession> = new Map();
  private isRegistered: boolean = false;
  private messageIdCounter: number = 0;

  constructor(config: BridgeConfig) {
    super();
    this.config = config;
    this.wsBridge = new WebSocketBridge(config);
    this.setupWSHandlers();
  }

  /**
   * Setup WebSocket event handlers
   */
  private setupWSHandlers(): void {
    // Forward WebSocket events
    this.wsBridge.on("connected", () => {
      this.emit("connected");
    });

    this.wsBridge.on("disconnected", (data: any) => {
      this.isRegistered = false;
      this.emit("disconnected", data);
    });

    this.wsBridge.on("error", (data: any) => {
      this.emit("error", data);
    });

    this.wsBridge.on("state_change", (data: any) => {
      this.emit("state_change", data);
    });

    // Handle incoming tool calls from OpenClaw
    this.wsBridge.on("tool_call", (message: ACPMessage) => {
      this.handleIncomingToolCall(message as ToolCallMessage);
    });

    // Handle tool results from OpenClaw
    this.wsBridge.on("tool_result", (message: ACPMessage) => {
      this.handleToolResult(message as ToolResultMessage);
    });

    // Handle agent output
    this.wsBridge.on("agent_output", (message: ACPMessage) => {
      this.handleAgentOutput(message as AgentOutputMessage);
    });

    // Handle spawn agent requests
    this.wsBridge.on("spawn_agent", (message: ACPMessage) => {
      this.handleSpawnAgent(message as SpawnAgentMessage);
    });

    // Handle connect acknowledgments
    this.wsBridge.on("ack", (message: ACPMessage) => {
      console.log(`[ACP Bridge] Received ACK: ${JSON.stringify(message.payload)}`);
    });

    // Handle errors
    this.wsBridge.on("error", (message: ACPMessage) => {
      console.error(`[ACP Bridge] Received error from ${message.source}:`, message.payload);
    });
  }

  /**
   * Connect to OpenClaw gateway and register
   */
  async connect(): Promise<void> {
    await this.wsBridge.connect();
    
    // Send connect message
    const connectMsg = ACPProtocol.createConnect(
      this.config.agentId,
      this.config.agentName,
      this.getCapabilities(),
      "1.0.0"
    );
    
    await this.wsBridge.send(connectMsg);
    this.isRegistered = true;
    console.log(`[ACP Bridge] Registered as ${this.config.agentId} with gateway`);
  }

  /**
   * Get agent capabilities
   */
  private getCapabilities(): string[] {
    const caps: string[] = [
      "tool_execution",
      "agent_spawning",
      "streaming_output",
      "heartbeat",
    ];
    
    // Add tool names as capabilities
    Array.from(this.registeredTools.keys()).forEach((name) => {
      caps.push(`tool:${name}`);
    });
    
    return caps;
  }

  /**
   * Disconnect from gateway
   */
  disconnect(reason?: string): void {
    const disconnectMsg = ACPProtocol.createDisconnect(reason);
    this.wsBridge.send(disconnectMsg).catch(() => {});
    
    this.wsBridge.disconnect(reason);
    this.isRegistered = false;
  }

  /**
   * Get connection state
   */
  getState(): BridgeState {
    return this.wsBridge.getState();
  }

  /**
   * Check if connected and registered
   */
  isConnected(): boolean {
    return this.wsBridge.isConnected() && this.isRegistered;
  }

  /**
   * Register a tool handler
   */
  registerTool(definition: ToolDefinition, handler: ToolCallHandler): void {
    this.registeredTools.set(definition.name, definition);
    this.toolHandlers.set(definition.name, handler);
    console.log(`[ACP Bridge] Registered tool: ${definition.name}`);
  }

  /**
   * Register multiple tools at once
   */
  registerTools(tools: Array<{ definition: ToolDefinition; handler: ToolCallHandler }>): void {
    for (const { definition, handler } of tools) {
      this.registerTool(definition, handler);
    }
  }

  /**
   * Unregister a tool
   */
  unregisterTool(name: string): void {
    this.registeredTools.delete(name);
    this.toolHandlers.delete(name);
    console.log(`[ACP Bridge] Unregistered tool: ${name}`);
  }

  /**
   * Get all registered tools
   */
  getRegisteredTools(): ToolDefinition[] {
    return Array.from(this.registeredTools.values());
  }

  /**
   * Call a tool on the OpenClaw side (request tool execution)
   */
  async callTool(
    tool: string,
    params: Record<string, any>,
    timeoutMs: number = 30000
  ): Promise<ToolCallResult> {
    if (!this.isConnected()) {
      return { success: false, error: "Not connected to gateway" };
    }

    const callId = generateId();
    
    const toolCallMsg = ACPProtocol.createToolCall(
      tool,
      params,
      callId,
      this.config.agentId,
      "gateway" // Target the gateway/openclaw
    );

    return new Promise((resolve, reject) => {
      // Set timeout
      const timeout = setTimeout(() => {
        this.pendingToolCalls.delete(callId);
        reject(new Error(`Tool call ${callId} timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      // Store pending call
      this.pendingToolCalls.set(callId, { resolve, reject, timeout });

      // Send tool call
      this.wsBridge.send(toolCallMsg).catch((err) => {
        clearTimeout(timeout);
        this.pendingToolCalls.delete(callId);
        reject(err);
      });
    });
  }

  /**
   * Handle incoming tool call from OpenClaw
   */
  private async handleIncomingToolCall(message: ToolCallMessage): Promise<void> {
    const { tool, params, callId } = message.payload;
    const source = message.source;

    console.log(`[ACP Bridge] Tool call: ${tool}(${JSON.stringify(params)}) from ${source}`);

    // Check if we have a handler for this tool
    const handler = this.toolHandlers.get(tool);
    
    if (!handler) {
      console.warn(`[ACP Bridge] No handler for tool: ${tool}`);
      const errorResult = ACPProtocol.createToolResult(
        callId,
        undefined,
        `Unknown tool: ${tool}`,
        this.config.agentId,
        source
      );
      await this.wsBridge.send(errorResult);
      return;
    }

    try {
      // Execute the tool
      const result = await handler(tool, params);
      
      // Send result back
      const resultMsg = ACPProtocol.createToolResult(
        callId,
        result.success ? result.result : undefined,
        result.success ? undefined : result.error,
        this.config.agentId,
        source
      );
      
      await this.wsBridge.send(resultMsg);
      
      if (result.success) {
        console.log(`[ACP Bridge] Tool ${tool} succeeded`);
      } else {
        console.log(`[ACP Bridge] Tool ${tool} failed: ${result.error}`);
      }
    } catch (err: any) {
      console.error(`[ACP Bridge] Tool ${tool} threw error: ${err.message}`);
      
      const errorMsg = ACPProtocol.createToolResult(
        callId,
        undefined,
        err.message,
        this.config.agentId,
        source
      );
      await this.wsBridge.send(errorMsg);
    }
  }

  /**
   * Handle tool result from OpenClaw
   */
  private handleToolResult(message: ToolResultMessage): void {
    const { callId, result, error } = message.payload;
    
    const pending = this.pendingToolCalls.get(callId);
    if (pending) {
      clearTimeout(pending.timeout);
      this.pendingToolCalls.delete(callId);
      
      if (error) {
        pending.reject(new Error(error));
      } else {
        pending.resolve({ success: true, result });
      }
    } else {
      console.warn(`[ACP Bridge] Received result for unknown callId: ${callId}`);
    }
  }

  /**
   * Register an agent output handler
   */
  onAgentOutput(sessionId: string, handler: AgentOutputHandler): void {
    this.agentOutputHandlers.set(sessionId, handler);
  }

  /**
   * Remove an agent output handler
   */
  offAgentOutput(sessionId: string): void {
    this.agentOutputHandlers.delete(sessionId);
  }

  /**
   * Handle incoming agent output
   */
  private handleAgentOutput(message: AgentOutputMessage): void {
    const { sessionId, text, done } = message.payload;
    
    const handler = this.agentOutputHandlers.get(sessionId);
    if (handler) {
      handler(sessionId, text, done);
    }
    
    this.emit("agent_output", { sessionId, text, done });
  }

  /**
   * Handle spawn agent request from OpenClaw
   */
  private handleSpawnAgent(message: SpawnAgentMessage): void {
    const { task, agentId, model } = message.payload;
    const source = message.source;
    
    console.log(`[ACP Bridge] Spawn agent request: task="${task}", agentId=${agentId}, model=${model}`);
    
    this.emit("spawn_agent", { task, agentId, model, source });
  }

  /**
   * Send streaming agent output
   */
  async sendAgentOutput(
    sessionId: string,
    text?: string,
    done?: boolean
  ): Promise<void> {
    if (!this.isConnected()) {
      throw new Error("Not connected to gateway");
    }

    const outputMsg = ACPProtocol.createAgentOutput(sessionId, text, undefined, done);
    await this.wsBridge.send(outputMsg);
  }

  /**
   * Create a new agent session
   */
  async createSession(task: string, agentId?: string): Promise<AgentSession> {
    const sessionId = generateId();
    const session: AgentSession = {
      sessionId,
      agentId: agentId || `${this.config.agentId}-session-${this.messageIdCounter++}`,
      task,
      status: "pending",
      createdAt: Date.now(),
    };
    
    this.activeSessions.set(sessionId, session);
    return session;
  }

  /**
   * Get active session
   */
  getSession(sessionId: string): AgentSession | undefined {
    return this.activeSessions.get(sessionId);
  }

  /**
   * Update session status
   */
  updateSession(sessionId: string, updates: Partial<AgentSession>): void {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      Object.assign(session, updates);
    }
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): AgentSession[] {
    return Array.from(this.activeSessions.values());
  }

  /**
   * Cleanup completed sessions
   */
  cleanupSessions(maxAgeMs: number = 3600000): void {
    const now = Date.now();
    Array.from(this.activeSessions.entries()).forEach(([sessionId, session]) => {
      if (session.status === "completed" || session.status === "failed") {
        if (now - session.createdAt > maxAgeMs) {
          this.activeSessions.delete(sessionId);
        }
      }
    });
  }

  /**
   * Send heartbeat
   */
  async sendHeartbeat(): Promise<void> {
    if (!this.isConnected()) {
      return;
    }
    
    const hb = ACPProtocol.createHeartbeat();
    await this.wsBridge.send(hb);
  }

  /**
   * Update config
   */
  updateConfig(config: Partial<BridgeConfig>): void {
    this.config = { ...this.config, ...config };
    this.wsBridge.updateConfig(this.config);
  }

  /**
   * Get config
   */
  getConfig(): BridgeConfig {
    return { ...this.config };
  }
}
