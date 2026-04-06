/**
 * 🦆 Duck Agent - Agent Mesh Module
 * Inter-agent communication and collaboration
 */

// Re-export everything from agent-mesh
export {
  AgentMeshClient,
  default as AgentMesh,
} from './agent-mesh.js';

// Re-export AgentCreator and templates for dynamic sub-agent spawning
export {
  AgentCreator,
  AGENT_TEMPLATES,
} from '../prompts/agent-creator.js';
export type {
  AgentSpec,
  AgentTemplate,
} from '../prompts/agent-creator.js';

// Types
export type {
  MeshAgent,
  MeshMessage,
  MeshHealthStatus,
  HealthReport,
  CatastropheEvent,
  MeshOptions,
  MeshEventType,
  MeshEvent,
} from './agent-mesh.js';
