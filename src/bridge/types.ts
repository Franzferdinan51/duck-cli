/**
 * Shared types for OpenClaw ↔ duck-cli Bridge Communication
 */

// ACP Message Types
export type ACPMessageType =
  | "connect"
  | "disconnect"
  | "tool_call"
  | "tool_result"
  | "spawn_agent"
  | "agent_output"
  | "heartbeat"
  | "error"
  | "ack";

// Base ACP Message
export interface ACPMessage {
  type: ACPMessageType;
  id: string;
  timestamp: number;
  payload: any;
  source: string;
  target?: string;
}

// Connection message
export interface ConnectMessage extends ACPMessage {
  type: "connect";
  payload: {
    agentId: string;
    agentName: string;
    capabilities: string[];
    version: string;
  };
}

// Disconnection message
export interface DisconnectMessage extends ACPMessage {
  type: "disconnect";
  payload: {
    reason?: string;
  };
}

// Tool call from OpenClaw to duck-cli
export interface ToolCallMessage extends ACPMessage {
  type: "tool_call";
  payload: {
    tool: string;
    params: Record<string, any>;
    callId: string;
  };
}

// Tool result from duck-cli to OpenClaw
export interface ToolResultMessage extends ACPMessage {
  type: "tool_result";
  payload: {
    callId: string;
    result?: any;
    error?: string;
  };
}

// Spawn agent request
export interface SpawnAgentMessage extends ACPMessage {
  type: "spawn_agent";
  payload: {
    task: string;
    agentId?: string;
    model?: string;
  };
}

// Agent output (streaming)
export interface AgentOutputMessage extends ACPMessage {
  type: "agent_output";
  payload: {
    sessionId: string;
    text?: string;
    toolCalls?: ToolCallMessage["payload"][];
    done?: boolean;
  };
}

// Heartbeat for keep-alive
export interface HeartbeatMessage extends ACPMessage {
  type: "heartbeat";
  payload: {
    latency?: number;
  };
}

// Error message
export interface ErrorMessage extends ACPMessage {
  type: "error";
  payload: {
    code: string;
    message: string;
  };
}

// Bridge configuration
export interface BridgeConfig {
  gatewayUrl: string;
  agentId: string;
  agentName: string;
  reconnectInterval?: number;
  heartbeatInterval?: number;
  connectionTimeout?: number;
}

// Bridge connection state
export type BridgeState = "disconnected" | "connecting" | "connected" | "reconnecting" | "error";

// Bridge events
export type BridgeEventType =
  | "connected"
  | "disconnected"
  | "error"
  | "message"
  | "tool_call"
  | "agent_spawned"
  | "state_change";

export interface BridgeEvent {
  type: BridgeEventType;
  data?: any;
  timestamp: number;
}

// Bridge event handler
export type BridgeEventHandler = (event: BridgeEvent) => void | Promise<void>;

// Tool definition (for MCP exposure)
export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties?: Record<string, any>;
    required?: string[];
  };
}

// Tool call result
export interface ToolCallResult {
  success: boolean;
  result?: any;
  error?: string;
}

// MCP types
export interface MCPRequest {
  method: string;
  params?: {
    name?: string;
    arguments?: Record<string, any>;
    cursor?: string;
  };
}

export interface MCPResponse {
  result?: any;
  error?: {
    code: number;
    message: string;
  };
}

// Agent session for spawned agents
export interface AgentSession {
  sessionId: string;
  agentId: string;
  task: string;
  status: "pending" | "running" | "completed" | "failed";
  createdAt: number;
  result?: any;
}

// REST API types
export interface RESTBridgeConfig {
  port: number;
  host?: string;
}

// REST endpoint response
export interface RESTResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

// Utility: generate unique ID
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

// Utility: create timestamp
export function timestamp(): number {
  return Date.now();
}
