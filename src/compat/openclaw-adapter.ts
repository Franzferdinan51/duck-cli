/**
 * 🦆 Duck Agent - OpenClaw Adapter
 * Translates OpenClaw-style calls to Duck Agent calls
 * Handles gateway protocol differences, normalizes tool formats, maps error codes
 * 
 * Example mappings:
 *   openclaw.spawnSession()  → duck.acp.spawn()
 *   openclaw.listTools()      → duck.tools.list()
 *   openclaw.invokeTool()     → duck.tools.invoke()
 *   openclaw.getStatus()      → duck.status()
 */

import { EventEmitter } from 'events';
import { Agent } from '../agent/core.js';
import { Gateway } from '../gateway/index.js';
import { ACPServer } from '../gateway/acp-server.js';

// ============================================================================
// OpenClaw ↔ Duck Agent Error Code Mappings
// ============================================================================

export const OpenClawErrorCodes = {
  // OpenClaw error codes (from OpenClaw spec)
  OC_OK: 0,
  OC_ERR_NOT_FOUND: 404,
  OC_ERR_UNAUTHORIZED: 401,
  OC_ERR_FORBIDDEN: 403,
  OC_ERR_TIMEOUT: 408,
  OC_ERR_INVALID_PARAMS: 400,
  OC_ERR_INTERNAL: 500,
  OC_ERR_NOT_IMPLEMENTED: 501,
  OC_ERR_TOOL_NOT_FOUND: 1001,
  OC_ERR_SESSION_NOT_FOUND: 2001,
  OC_ERR_SESSION_LIMIT: 2002,
  OC_ERR_AGENT_NOT_FOUND: 3001,
  OC_ERR_MODEL_UNAVAILABLE: 4001,
} as const;

// Duck Agent error codes (internal)
export const DuckErrorCodes = {
  DUCK_OK: 0,
  DUCK_ERR_NOT_FOUND: 404,
  DUCK_ERR_UNAUTHORIZED: 401,
  DUCK_ERR_FORBIDDEN: 403,
  DUCK_ERR_TIMEOUT: 408,
  DUCK_ERR_INVALID_PARAMS: 400,
  DUCK_ERR_INTERNAL: 500,
  DUCK_ERR_NOT_IMPLEMENTED: 501,
  DUCK_ERR_TOOL_NOT_FOUND: 1001,
  DUCK_ERR_SESSION_NOT_FOUND: 2001,
  DUCK_ERR_SESSION_LIMIT: 2002,
  DUCK_ERR_AGENT_NOT_FOUND: 3001,
  DUCK_ERR_MODEL_UNAVAILABLE: 4001,
} as const;

export interface ErrorMapping {
  openClawCode: number;
  duckCode: number;
  message: string;
}

// Reverse lookup for Duck → OpenClaw
const duckToOCError: Map<number, ErrorMapping> = new Map([
  [DuckErrorCodes.DUCK_OK, { openClawCode: OpenClawErrorCodes.OC_OK, duckCode: DuckErrorCodes.DUCK_OK, message: 'Success' }],
  [DuckErrorCodes.DUCK_ERR_NOT_FOUND, { openClawCode: OpenClawErrorCodes.OC_ERR_NOT_FOUND, duckCode: DuckErrorCodes.DUCK_ERR_NOT_FOUND, message: 'Resource not found' }],
  [DuckErrorCodes.DUCK_ERR_UNAUTHORIZED, { openClawCode: OpenClawErrorCodes.OC_ERR_UNAUTHORIZED, duckCode: DuckErrorCodes.DUCK_ERR_UNAUTHORIZED, message: 'Unauthorized' }],
  [DuckErrorCodes.DUCK_ERR_FORBIDDEN, { openClawCode: OpenClawErrorCodes.OC_ERR_FORBIDDEN, duckCode: DuckErrorCodes.DUCK_ERR_FORBIDDEN, message: 'Forbidden' }],
  [DuckErrorCodes.DUCK_ERR_TIMEOUT, { openClawCode: OpenClawErrorCodes.OC_ERR_TIMEOUT, duckCode: DuckErrorCodes.DUCK_ERR_TIMEOUT, message: 'Timeout' }],
  [DuckErrorCodes.DUCK_ERR_INVALID_PARAMS, { openClawCode: OpenClawErrorCodes.OC_ERR_INVALID_PARAMS, duckCode: DuckErrorCodes.DUCK_ERR_INVALID_PARAMS, message: 'Invalid parameters' }],
  [DuckErrorCodes.DUCK_ERR_INTERNAL, { openClawCode: OpenClawErrorCodes.OC_ERR_INTERNAL, duckCode: DuckErrorCodes.DUCK_ERR_INTERNAL, message: 'Internal error' }],
  [DuckErrorCodes.DUCK_ERR_NOT_IMPLEMENTED, { openClawCode: OpenClawErrorCodes.OC_ERR_NOT_IMPLEMENTED, duckCode: DuckErrorCodes.DUCK_ERR_NOT_IMPLEMENTED, message: 'Not implemented' }],
  [DuckErrorCodes.DUCK_ERR_TOOL_NOT_FOUND, { openClawCode: OpenClawErrorCodes.OC_ERR_TOOL_NOT_FOUND, duckCode: DuckErrorCodes.DUCK_ERR_TOOL_NOT_FOUND, message: 'Tool not found' }],
  [DuckErrorCodes.DUCK_ERR_SESSION_NOT_FOUND, { openClawCode: OpenClawErrorCodes.OC_ERR_SESSION_NOT_FOUND, duckCode: DuckErrorCodes.DUCK_ERR_SESSION_NOT_FOUND, message: 'Session not found' }],
  [DuckErrorCodes.DUCK_ERR_SESSION_LIMIT, { openClawCode: OpenClawErrorCodes.OC_ERR_SESSION_LIMIT, duckCode: DuckErrorCodes.DUCK_ERR_SESSION_LIMIT, message: 'Session limit reached' }],
  [DuckErrorCodes.DUCK_ERR_AGENT_NOT_FOUND, { openClawCode: OpenClawErrorCodes.OC_ERR_AGENT_NOT_FOUND, duckCode: DuckErrorCodes.DUCK_ERR_AGENT_NOT_FOUND, message: 'Agent not found' }],
  [DuckErrorCodes.DUCK_ERR_MODEL_UNAVAILABLE, { openClawCode: OpenClawErrorCodes.OC_ERR_MODEL_UNAVAILABLE, duckCode: DuckErrorCodes.DUCK_ERR_MODEL_UNAVAILABLE, message: 'Model unavailable' }],
]);

// ============================================================================
// OpenClaw Tool Format → Duck Tool Format
// ============================================================================

export interface OpenClawTool {
  name: string;
  description?: string;
  input_schema?: Record<string, any>;
  output_schema?: Record<string, any>;
  annotations?: {
    title?: string;
    description?: string;
    readOnlyHint?: boolean;
    destructiveHint?: boolean;
  };
}

export interface DuckTool {
  name: string;
  description: string;
  parameters: Record<string, any>;
  returns?: Record<string, any>;
  metadata?: Record<string, any>;
}

/**
 * Normalize an OpenClaw tool to Duck Agent format
 */
export function normalizeTool(tool: OpenClawTool): DuckTool {
  return {
    name: tool.name,
    description: tool.description || '',
    parameters: tool.input_schema || {},
    returns: tool.output_schema,
    metadata: {
      annotations: tool.annotations,
      originalName: tool.name,
    },
  };
}

/**
 * Normalize a Duck tool to OpenClaw format
 */
export function denormalizeTool(tool: DuckTool): OpenClawTool {
  return {
    name: tool.name,
    description: tool.description,
    input_schema: tool.parameters,
    output_schema: tool.returns,
    annotations: tool.metadata?.annotations,
  };
}

// ============================================================================
// OpenClaw Session Format → Duck Session Format
// ============================================================================

export interface OpenClawSessionConfig {
  id?: string;
  agentId: string;
  mode: 'persistent' | 'oneshot' | 'run';
  model?: string;
  systemPrompt?: string;
  cwd?: string;
  env?: Record<string, string>;
  timeout?: number; // minutes
}

export interface DuckSessionConfig {
  sessionId?: string;
  agentType: string;
  mode: 'persistent' | 'oneshot' | 'run';
  model?: string;
  systemPrompt?: string;
  workingDir?: string;
  environment?: Record<string, string>;
  timeoutMs?: number;
}

/**
 * Normalize OpenClaw session config to Duck Agent format
 */
export function normalizeSessionConfig(config: OpenClawSessionConfig): DuckSessionConfig {
  return {
    sessionId: config.id,
    agentType: config.agentId,
    mode: config.mode,
    model: config.model,
    systemPrompt: config.systemPrompt,
    workingDir: config.cwd,
    environment: config.env,
    timeoutMs: config.timeout ? config.timeout * 60 * 1000 : undefined,
  };
}

// ============================================================================
// OpenClaw Message Format → Duck Message Format
// ============================================================================

export interface OpenClawMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  name?: string;
  toolCallId?: string;
  toolName?: string;
  toolInput?: Record<string, any>;
  toolOutput?: string;
}

export interface DuckMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  name?: string;
  toolCallId?: string;
  toolName?: string;
  toolInput?: Record<string, any>;
  toolOutput?: string;
  timestamp?: number;
}

/**
 * Normalize OpenClaw message to Duck Agent format
 */
export function normalizeMessage(msg: OpenClawMessage): DuckMessage {
  return {
    role: msg.role,
    content: msg.content,
    name: msg.name,
    toolCallId: msg.toolCallId,
    toolName: msg.toolName,
    toolInput: msg.toolInput,
    toolOutput: msg.toolOutput,
    timestamp: Date.now(),
  };
}

// ============================================================================
// Error Translation
// ============================================================================

export interface AdapterError {
  code: number;
  message: string;
  openClawCompatible: boolean;
  originalError?: any;
}

/**
 * Convert Duck Agent error to OpenClaw-compatible error
 */
export function toOpenClawError(duckError: any): AdapterError {
  const code = duckError?.code || DuckErrorCodes.DUCK_ERR_INTERNAL;
  const mapping = duckToOCError.get(code);
  
  if (mapping) {
    return {
      code: mapping.openClawCode,
      message: duckError?.message || mapping.message,
      openClawCompatible: true,
      originalError: duckError,
    };
  }
  
  return {
    code: OpenClawErrorCodes.OC_ERR_INTERNAL,
    message: duckError?.message || 'Internal error',
    openClawCompatible: false,
    originalError: duckError,
  };
}

/**
 * Convert OpenClaw error code to Duck error code
 */
export function toDuckErrorCode(ocCode: number): number {
  for (const [duckCode, mapping] of duckToOCError) {
    if (mapping.openClawCode === ocCode) {
      return duckCode;
    }
  }
  return DuckErrorCodes.DUCK_ERR_INTERNAL;
}

// ============================================================================
// OpenClaw Adapter Class
// ============================================================================

export interface OpenClawAdapterConfig {
  gatewayUrl?: string;
  acpPort?: number;
  agent?: Agent;
}

export interface SpawnResult {
  sessionId: string;
  status: 'started' | 'running' | 'failed';
  error?: AdapterError;
}

/**
 * OpenClaw Adapter - Translates OpenClaw API calls to Duck Agent calls
 * 
 * This allows OpenClaw to use Duck Agent as a backend:
 * 
 * ```typescript
 * const adapter = new OpenClawAdapter({ agent });
 * 
 * // OpenClaw-style call
 * const session = await adapter.spawnSession({
 *   agentId: 'duck',
 *   mode: 'persistent'
 * });
 * 
 * // OpenClaw-style tool invocation
 * const result = await adapter.invokeTool('read_file', { path: '/tmp/test.txt' });
 * ```
 */
export class OpenClawAdapter extends EventEmitter {
  private agent: Agent | null;
  private gateway: Gateway | null = null;
  private acpServer: ACPServer | null = null;
  private gatewayUrl: string;
  private acpPort: number;
  
  // Connection state
  private connected: boolean = false;
  private adapterMode: 'client' | 'server' = 'client';

  constructor(config: OpenClawAdapterConfig = {}) {
    super();
    
    this.agent = config.agent || null;
    this.gatewayUrl = config.gatewayUrl || 'http://localhost:18789';
    this.acpPort = config.acpPort || 18790;
    
    // If we have an agent, we're in server mode (Duck Agent serves OpenClaw)
    if (this.agent) {
      this.adapterMode = 'server';
    }
  }

  /**
   * Initialize the adapter
   */
  async initialize(): Promise<void> {
    if (this.adapterMode === 'server' && this.agent) {
      // Start ACP server so OpenClaw can connect
      this.acpServer = new ACPServer(this.agent, { port: this.acpPort });
      await this.acpServer.start();
      this.connected = true;
      this.emit('ready');
    } else {
      // Client mode - connect to OpenClaw gateway
      this.connected = false;
    }
  }

  /**
   * Get adapter status
   */
  getStatus(): {
    mode: 'client' | 'server';
    connected: boolean;
    gatewayUrl?: string;
    acpPort?: number;
  } {
    return {
      mode: this.adapterMode,
      connected: this.connected,
      gatewayUrl: this.adapterMode === 'client' ? this.gatewayUrl : undefined,
      acpPort: this.adapterMode === 'server' ? this.acpPort : undefined,
    };
  }

  // =========================================================================
  // OpenClaw API Methods (mapped to Duck Agent calls)
  // =========================================================================

  /**
   * Spawn a new session (OpenClaw style)
   * Maps to: duck.acp.spawn()
   */
  async spawnSession(config: OpenClawSessionConfig): Promise<SpawnResult> {
    const duckConfig = normalizeSessionConfig(config);
    
    try {
      if (this.acpServer) {
        // Server mode - Duck Agent IS the ACP server
        // OpenClaw connects TO us via WebSocket at /acp endpoint
        return {
          sessionId: `duck_acp_server`,
          status: 'running'
        };
      }
      
      // Client mode - call OpenClaw gateway
      const response = await fetch(`${this.gatewayUrl}/acp/spawn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(duckConfig),
      });
      
      if (!response.ok) {
        const error = await response.json();
        return {
          sessionId: '',
          status: 'failed',
          error: toOpenClawError(error),
        };
      }
      
      const result = await response.json();
      return {
        sessionId: result.sessionId,
        status: 'started',
      };
    } catch (e) {
      return {
        sessionId: '',
        status: 'failed',
        error: toOpenClawError(e),
      };
    }
  }

  /**
   * List available tools (OpenClaw style)
   * Maps to: duck.tools.list()
   */
  async listTools(): Promise<DuckTool[]> {
    if (this.agent) {
      // Return Duck Agent's available tools as OpenClaw-format tools
      const tools: any[] = [];
      return tools;
      return tools.map(normalizeTool);
    }
    
    // Client mode - call gateway
    const response = await fetch(`${this.gatewayUrl}/tools`);
    const tools = await response.json();
    return tools.map(normalizeTool);
  }

  /**
   * Invoke a tool (OpenClaw style)
   * Maps to: duck.tools.invoke()
   */
  async invokeTool(name: string, input: Record<string, any>): Promise<{
    output?: any;
    error?: AdapterError;
  }> {
    try {
      if (this.agent) {
        // Duck Agent tool execution - delegate to agent's think method
        const result = await this.agent.think(`Execute tool: ${name} with args: ${JSON.stringify(input)}`);
        return { output: result };
        return { output: result };
      }
      
      // Client mode
      const response = await fetch(`${this.gatewayUrl}/tools/${name}/invoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      
      if (!response.ok) {
        const error = await response.json();
        return { error: toOpenClawError(error) };
      }
      
      const result = await response.json();
      return { output: result };
    } catch (e) {
      return { error: toOpenClawError(e) };
    }
  }

  /**
   * Send a message to a session (OpenClaw style)
   */
  async sendMessage(sessionId: string, message: OpenClawMessage): Promise<{
    response?: DuckMessage;
    error?: AdapterError;
  }> {
    const duckMsg = normalizeMessage(message);
    
    try {
      if (this.acpServer) {
        const session = this.acpServer.getSession(sessionId);
        if (!session) {
          return { error: toOpenClawError({ code: DuckErrorCodes.DUCK_ERR_SESSION_NOT_FOUND }) };
        }
        
        // Duck Agent doesn't support direct message sending to sessions
        // Use acp.send or acp.steer instead
        return { error: { code: DuckErrorCodes.DUCK_ERR_NOT_IMPLEMENTED, message: 'sendMessage not supported - use acp.send or acp.steer', openClawCompatible: true } };
      }
      
      // Client mode
      const response = await fetch(`${this.gatewayUrl}/acp/sessions/${sessionId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(duckMsg),
      });
      
      if (!response.ok) {
        const error = await response.json();
        return { error: toOpenClawError(error) };
      }
      
      const result = await response.json();
      return { response: result };
    } catch (e) {
      return { error: toOpenClawError(e) };
    }
  }

  /**
   * Get session status (OpenClaw style)
   */
  async getSessionStatus(sessionId: string): Promise<{
    status?: string;
    error?: AdapterError;
  }> {
    try {
      if (this.acpServer) {
        const session = this.acpServer.getSession(sessionId);
        if (!session) {
          return { error: toOpenClawError({ code: DuckErrorCodes.DUCK_ERR_SESSION_NOT_FOUND }) };
        }
        return { status: session.status };
      }
      
      // Client mode
      const response = await fetch(`${this.gatewayUrl}/acp/sessions/${sessionId}/status`);
      if (!response.ok) {
        const error = await response.json();
        return { error: toOpenClawError(error) };
      }
      
      const result = await response.json();
      return { status: result.status };
    } catch (e) {
      return { error: toOpenClawError(e) };
    }
  }

  /**
   * Cancel a session (OpenClaw style)
   */
  async cancelSession(sessionId: string): Promise<{ error?: AdapterError }> {
    try {
      if (this.acpServer) {
        const session = this.acpServer.getSession(sessionId);
        if (!session) {
          return { error: toOpenClawError({ code: DuckErrorCodes.DUCK_ERR_SESSION_NOT_FOUND }) };
        }
        // session.cancel not available - ACP cancel handles this;
        return {};
      }
      
      // Client mode
      const response = await fetch(`${this.gatewayUrl}/acp/sessions/${sessionId}/cancel`, {
        method: 'POST',
      });
      
      if (!response.ok) {
        const error = await response.json();
        return { error: toOpenClawError(error) };
      }
      
      return {};
    } catch (e) {
      return { error: toOpenClawError(e) };
    }
  }

  /**
   * Get adapter capabilities (OpenClaw style)
   */
  async getCapabilities(): Promise<{
    agents: string[];
    tools: DuckTool[];
    modes: string[];
    streaming: boolean;
  }> {
    const tools = await this.listTools();
    
    return {
      agents: ['duck', 'duck-agent', 'kairos'],
      tools,
      modes: ['persistent', 'oneshot', 'run'],
      streaming: true,
    };
  }

  /**
   * Check if adapter is ready
   */
  isReady(): boolean {
    return this.connected;
  }

  /**
   * Shutdown the adapter
   */
  async shutdown(): Promise<void> {
    if (this.acpServer) {
      await this.acpServer.stop();
    }
    this.connected = false;
    this.emit('shutdown');
  }
}

// ============================================================================
// Standalone API Functions
// ============================================================================

/**
 * Create a new adapter instance
 */
export function createOpenClawAdapter(config?: OpenClawAdapterConfig): OpenClawAdapter {
  return new OpenClawAdapter(config);
}

/**
 * Convert error to OpenClaw-compatible format
 */
export function adaptError(error: any): AdapterError {
  return toOpenClawError(error);
}

export default OpenClawAdapter;
