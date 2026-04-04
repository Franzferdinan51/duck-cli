/**
 * duck-cli Bridge Module
 * 
 * OpenClaw ↔ duck-cli API Bridge for communication between the two systems.
 * 
 * @example
 * ```typescript
 * import { BridgeManager, createBridgeManager } from './bridge';
 * 
 * // Create bridge manager
 * const bridge = createBridgeManager({
 *   agentId: 'android-agent',
 *   agentName: 'Android Controller',
 *   gatewayUrl: 'ws://localhost:18789',
 * });
 * 
 * // Register tools
 * bridge.registerTool({
 *   definition: {
 *     name: 'android_screenshot',
 *     description: 'Capture Android device screen',
 *     inputSchema: { type: 'object', properties: {} }
 *   },
 *   handler: async (tool, params) => {
 *     // Take screenshot logic
 *     return { success: true, result: screenshotBase64 };
 *   }
 * });
 * 
 * // Initialize and connect
 * await bridge.initialize();
 * await bridge.connect();
 * ```
 */

// Types
export * from "./types";

// Protocol
export { ACPProtocol } from "./acp-protocol";

// Bridges
export { WebSocketBridge } from "./websocket-bridge";
export { ACPBridge } from "./acp-bridge";
export { MCPBridge } from "./mcp-bridge";
export type { MCPBridgeConfig } from "./mcp-bridge";
export { RESTBridge } from "./rest-bridge";
export type { RESTBridgeConfig } from "./rest-bridge";

// Manager
export { BridgeManager } from "./bridge-manager";
export type { BridgeManagerConfig, ToolRegistration } from "./bridge-manager";

// Re-export for convenience
export type { ToolDefinition as Tool, ToolCallResult as ToolResult };

// Import for implementation
import { BridgeManager } from "./bridge-manager";
import type { BridgeManagerConfig, ToolRegistration } from "./bridge-manager";
import type { ToolDefinition, ToolCallResult } from "./types";

/**
 * Create a duck-cli tool definition helper
 */
export function defineTool(
  name: string,
  description: string,
  properties?: Record<string, any>,
  required?: string[]
): ToolDefinition {
  return {
    name,
    description,
    inputSchema: {
      type: "object",
      properties: properties || {},
      required: required || [],
    },
  };
}

/**
 * Quick tool registration helper type
 */
export type ToolHandler = (tool: string, params: Record<string, any>) => Promise<ToolCallResult>;

/**
 * Create tool registration helper
 */
export function registerTool(
  name: string,
  description: string,
  handler: ToolHandler,
  properties?: Record<string, any>,
  required?: string[]
): ToolRegistration {
  return {
    definition: defineTool(name, description, properties, required),
    handler,
  };
}

/**
 * Create a configured BridgeManager instance
 */
export function createBridgeManager(config: BridgeManagerConfig): BridgeManager {
  return new BridgeManager(config);
}
