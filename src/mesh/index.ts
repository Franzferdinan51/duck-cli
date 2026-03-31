/**
 * 🦆 Duck Agent - Agent Mesh Module
 * Inter-agent communication and collaboration
 */

// Re-export everything from agent-mesh
export {
  AgentMeshClient,
  default as AgentMesh,
} from './agent-mesh.js';

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
