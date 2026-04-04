/**
 * 🦆 Duck Agent - A2A (Agent-to-Agent) Protocol
 * Based on NVIDIA NeMo Agent Toolkit A2A integration
 */

export interface AgentCard {
  name: string;
  version: string;
  description: string;
  capabilities: AgentCapabilities;
  skills: Skill[];
  streaming: boolean;
  auth?: AuthConfig;
  endpoint?: string;
}

export interface AgentCapabilities {
  streaming?: boolean;
  pushNotifications?: boolean;
  stateTransitionHistory?: boolean;
  inputModes?: string[];
  outputModes?: string[];
}

export interface Skill {
  name: string;
  description: string;
  examples?: string[];
  tags?: string[];
}

export interface AuthConfig {
  type: 'none' | 'api_key' | 'oauth2';
  description?: string;
}

export interface A2AMessage {
  id: string;
  method: string;
  params?: any;
}

export interface TaskPayload {
  taskId?: string;
  input: any;
  sessionId?: string;
  metadata?: Record<string, string>;
}

export interface TaskResult {
  taskId: string;
  status: 'pending' | 'working' | 'completed' | 'failed';
  result?: any;
  error?: string;
  metadata?: Record<string, string>;
}

export interface A2AResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: any;
  error?: { code: number; message: string; data?: any };
}
