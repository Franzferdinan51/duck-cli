/**
 * 🦆 Duck Agent - Multi-Agent Module
 */

export { MultiAgentCoordinator, COORDINATOR_SYSTEM_PROMPT, WORKER_SYSTEM_PROMPT } from './coordinator.js';
export type { AgentTask, TaskType, TaskStatus, CoordinatorOptions, WorkerResult } from './coordinator.js';

export { TeamManager, TEAM_TEMPLATES } from './team.js';
export type { Team, TeamMember, TeamTemplate } from './team.js';
