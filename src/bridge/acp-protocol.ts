/**
 * ACP (Agent Communication Protocol) - Message Protocol Implementation
 */

import {
  ACPMessage,
  ACPMessageType,
  ConnectMessage,
  DisconnectMessage,
  ToolCallMessage,
  ToolResultMessage,
  SpawnAgentMessage,
  AgentOutputMessage,
  HeartbeatMessage,
  ErrorMessage,
  generateId,
  timestamp,
} from "./types";

/**
 * ACP Protocol Handler
 * Handles serialization/deserialization and validation of ACP messages
 */
export class ACPProtocol {
  private static readonly SUPPORTED_TYPES: ACPMessageType[] = [
    "connect",
    "disconnect",
    "tool_call",
    "tool_result",
    "spawn_agent",
    "agent_output",
    "heartbeat",
    "error",
    "ack",
  ];

  /**
   * Serialize ACP message to JSON string for transmission
   */
  static serialize(msg: ACPMessage): string {
    try {
      return JSON.stringify(msg);
    } catch (err) {
      throw new Error(`Failed to serialize ACP message: ${err}`);
    }
  }

  /**
   * Deserialize JSON string to ACP message with validation
   */
  static deserialize(data: string): ACPMessage {
    try {
      const parsed = JSON.parse(data);

      // Validate required fields
      if (!parsed.type || !parsed.id || parsed.timestamp === undefined) {
        throw new Error("Missing required fields: type, id, timestamp");
      }

      // Validate message type
      if (!this.SUPPORTED_TYPES.includes(parsed.type)) {
        throw new Error(`Unknown ACP message type: ${parsed.type}`);
      }

      // Ensure payload exists
      if (parsed.payload === undefined) {
        parsed.payload = {};
      }

      return parsed as ACPMessage;
    } catch (err) {
      if (err instanceof SyntaxError) {
        throw new Error(`Invalid JSON: ${err}`);
      }
      throw err;
    }
  }

  /**
   * Create a connect message
   */
  static createConnect(
    agentId: string,
    agentName: string,
    capabilities: string[],
    version: string,
    source: string = "duck-cli"
  ): ConnectMessage {
    return {
      type: "connect",
      id: generateId(),
      timestamp: timestamp(),
      payload: {
        agentId,
        agentName,
        capabilities,
        version,
      },
      source,
    };
  }

  /**
   * Create a disconnect message
   */
  static createDisconnect(
    reason?: string,
    source: string = "duck-cli"
  ): DisconnectMessage {
    return {
      type: "disconnect",
      id: generateId(),
      timestamp: timestamp(),
      payload: { reason },
      source,
    };
  }

  /**
   * Create a tool call message
   */
  static createToolCall(
    tool: string,
    params: Record<string, any>,
    callId: string,
    source: string = "duck-cli",
    target?: string
  ): ToolCallMessage {
    return {
      type: "tool_call",
      id: generateId(),
      timestamp: timestamp(),
      payload: { tool, params, callId },
      source,
      target,
    };
  }

  /**
   * Create a tool result message
   */
  static createToolResult(
    callId: string,
    result?: any,
    error?: string,
    source: string = "duck-cli",
    target?: string
  ): ToolResultMessage {
    return {
      type: "tool_result",
      id: generateId(),
      timestamp: timestamp(),
      payload: { callId, result, error },
      source,
      target,
    };
  }

  /**
   * Create a spawn agent message
   */
  static createSpawnAgent(
    task: string,
    agentId?: string,
    model?: string,
    source: string = "duck-cli"
  ): SpawnAgentMessage {
    return {
      type: "spawn_agent",
      id: generateId(),
      timestamp: timestamp(),
      payload: { task, agentId, model },
      source,
    };
  }

  /**
   * Create an agent output message
   */
  static createAgentOutput(
    sessionId: string,
    text?: string,
    toolCalls?: ToolCallMessage["payload"][],
    done?: boolean,
    source: string = "duck-cli"
  ): AgentOutputMessage {
    return {
      type: "agent_output",
      id: generateId(),
      timestamp: timestamp(),
      payload: { sessionId, text, toolCalls, done },
      source,
    };
  }

  /**
   * Create a heartbeat message
   */
  static createHeartbeat(
    latency?: number,
    source: string = "duck-cli"
  ): HeartbeatMessage {
    return {
      type: "heartbeat",
      id: generateId(),
      timestamp: timestamp(),
      payload: { latency },
      source,
    };
  }

  /**
   * Create an error message
   */
  static createError(
    code: string,
    message: string,
    source: string = "duck-cli",
    target?: string
  ): ErrorMessage {
    return {
      type: "error",
      id: generateId(),
      timestamp: timestamp(),
      payload: { code, message },
      source,
      target,
    };
  }

  /**
   * Validate message structure based on type
   */
  static validate(msg: ACPMessage): { valid: boolean; error?: string } {
    switch (msg.type) {
      case "connect":
        if (!msg.payload.agentId || !msg.payload.agentName) {
          return { valid: false, error: "Missing agentId or agentName in connect" };
        }
        break;

      case "tool_call":
        if (!msg.payload.tool || !msg.payload.callId) {
          return { valid: false, error: "Missing tool or callId in tool_call" };
        }
        break;

      case "tool_result":
        if (!msg.payload.callId) {
          return { valid: false, error: "Missing callId in tool_result" };
        }
        break;

      case "spawn_agent":
        if (!msg.payload.task) {
          return { valid: false, error: "Missing task in spawn_agent" };
        }
        break;

      case "error":
        if (!msg.payload.code || !msg.payload.message) {
          return { valid: false, error: "Missing code or message in error" };
        }
        break;
    }

    return { valid: true };
  }

  /**
   * Get message type label for logging
   */
  static getTypeLabel(type: ACPMessageType): string {
    const labels: Record<ACPMessageType, string> = {
      connect: "📡 CONNECT",
      disconnect: "🔌 DISCONNECT",
      tool_call: "🔧 TOOL_CALL",
      tool_result: "✅ TOOL_RESULT",
      spawn_agent: "🤖 SPAWN_AGENT",
      agent_output: "💬 AGENT_OUTPUT",
      heartbeat: "💓 HEARTBEAT",
      error: "❌ ERROR",
      ack: "✓ ACK",
    };
    return labels[type] || type.toUpperCase();
  }
}
