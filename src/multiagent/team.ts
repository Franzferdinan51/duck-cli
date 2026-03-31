/**
 * 🦆 Duck Agent - Team Management
 * Create and manage teams of specialized agents
 */

import { MultiAgentCoordinator, AgentTask, TaskType } from './coordinator.js';

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  description: string;
  specialization: string;
  tools: string[];
  color: string;
  status: 'idle' | 'busy' | 'offline';
  currentTask?: string;
}

export interface Team {
  id: string;
  name: string;
  description: string;
  members: Map<string, TeamMember>;
  coordinator: MultiAgentCoordinator;
  createdAt: Date;
  activeTasks: number;
}

export interface TeamTemplate {
  name: string;
  description: string;
  roles: {
    name: string;
    role: string;
    specialization: string;
    tools: string[];
  }[];
}

// Pre-built team templates
export const TEAM_TEMPLATES: TeamTemplate[] = [
  {
    name: 'Code Review',
    description: 'Parallel code review with multiple perspectives',
    roles: [
      { name: 'Security Reviewer', role: 'security', specialization: 'Security audit', tools: ['file_read', 'grep', 'bash'] },
      { name: 'Performance Reviewer', role: 'performance', specialization: 'Performance analysis', tools: ['file_read', 'grep', 'bash'] },
      { name: 'Style Reviewer', role: 'style', specialization: 'Code style and patterns', tools: ['file_read', 'glob'] },
    ],
  },
  {
    name: 'Research Team',
    description: 'Multi-angle research investigation',
    roles: [
      { name: 'Technical Researcher', role: 'technical', specialization: 'Technical deep dive', tools: ['file_read', 'grep', 'web_search', 'web_fetch'] },
      { name: 'Market Researcher', role: 'market', specialization: 'Market and competitive analysis', tools: ['web_search', 'web_fetch'] },
      { name: 'Documentation Researcher', role: 'docs', specialization: 'Documentation review', tools: ['file_read', 'glob'] },
    ],
  },
  {
    name: 'Build Team',
    description: 'Parallel implementation with verification',
    roles: [
      { name: 'Backend Developer', role: 'backend', specialization: 'Backend implementation', tools: ['file_read', 'file_write', 'glob', 'bash'] },
      { name: 'Frontend Developer', role: 'frontend', specialization: 'Frontend implementation', tools: ['file_read', 'file_write', 'glob'] },
      { name: 'Tester', role: 'tester', specialization: 'Testing and verification', tools: ['file_read', 'bash'] },
    ],
  },
  {
    name: 'Debug Squad',
    description: 'Multi-perspective debugging team',
    roles: [
      { name: 'Logic Debugger', role: 'logic', specialization: 'Logic and flow analysis', tools: ['file_read', 'grep', 'bash'] },
      { name: 'Data Debugger', role: 'data', specialization: 'Data and state issues', tools: ['file_read', 'grep'] },
      { name: 'Integration Debugger', role: 'integration', specialization: 'API and integration issues', tools: ['file_read', 'bash'] },
    ],
  },
];

const MEMBER_COLORS = [
  '#4f46e5', '#7c3aed', '#db2777', '#ea580c',
  '#16a34a', '#0891b2', '#6366f1', '#8b5cf6',
];

export class TeamManager {
  private teams: Map<string, Team> = new Map();
  private coordinator: MultiAgentCoordinator;
  
  constructor() {
    this.coordinator = new MultiAgentCoordinator();
  }
  
  /**
   * Create a new team
   */
  createTeam(name: string, description: string): Team {
    const id = `team-${Date.now().toString(36)}`;
    
    const team: Team = {
      id,
      name,
      description,
      members: new Map(),
      coordinator: this.coordinator,
      createdAt: new Date(),
      activeTasks: 0,
    };
    
    this.teams.set(id, team);
    return team;
  }
  
  /**
   * Create team from template
   */
  createFromTemplate(templateName: string, customName?: string): Team | null {
    const template = TEAM_TEMPLATES.find(t => t.name === templateName);
    if (!template) return null;
    
    const team = this.createTeam(
      customName || template.name,
      template.description
    );
    
    // Add members from template
    template.roles.forEach((role, idx) => {
      const roleId = role.name.toLowerCase().replace(/\s+/g, '-');
      this.addMember(team.id, {
        id: roleId,
        name: role.name,
        role: role.role,
        description: `${role.name} - ${role.specialization}`,
        specialization: role.specialization,
        tools: role.tools,
        color: MEMBER_COLORS[idx % MEMBER_COLORS.length],
      });
    });
    
    return team;
  }
  
  /**
   * Add member to team
   */
  addMember(teamId: string, member: Omit<TeamMember, 'status'>): boolean {
    const team = this.teams.get(teamId);
    if (!team) return false;
    
    const fullMember: TeamMember = {
      ...member,
      status: 'idle',
    };
    
    team.members.set(member.id, fullMember);
    return true;
  }
  
  /**
   * Remove member from team
   */
  removeMember(teamId: string, memberId: string): boolean {
    const team = this.teams.get(teamId);
    if (!team) return false;
    return team.members.delete(memberId);
  }
  
  /**
   * Get team by ID
   */
  getTeam(teamId: string): Team | undefined {
    return this.teams.get(teamId);
  }
  
  /**
   * Get all teams
   */
  getAllTeams(): Team[] {
    return Array.from(this.teams.values());
  }
  
  /**
   * Delete team
   */
  deleteTeam(teamId: string): boolean {
    const team = this.teams.get(teamId);
    if (!team) return false;
    
    // Stop all active tasks
    for (const member of team.members.values()) {
      if (member.currentTask) {
        this.coordinator.stopWorker(member.currentTask);
      }
    }
    
    return this.teams.delete(teamId);
  }
  
  /**
   * Assign task to member
   */
  async assignTask(
    teamId: string,
    memberId: string,
    taskType: TaskType,
    description: string,
    prompt: string
  ): Promise<string | null> {
    const team = this.teams.get(teamId);
    if (!team) return null;
    
    const member = team.members.get(memberId);
    if (!member) return null;
    
    // Mark member as busy
    member.status = 'busy';
    team.activeTasks++;
    
    // Spawn task
    const taskId = await this.coordinator.spawnWorker(taskType, description, prompt);
    member.currentTask = taskId;
    
    // Listen for completion
    this.coordinator.on('taskCompleted', (task) => {
      if (task.id === taskId) {
        member.status = 'idle';
        member.currentTask = undefined;
        team.activeTasks--;
      }
    });
    
    this.coordinator.on('taskFailed', (task) => {
      if (task.id === taskId) {
        member.status = 'idle';
        member.currentTask = undefined;
        team.activeTasks--;
      }
    });
    
    return taskId;
  }
  
  /**
   * Broadcast to all idle members
   */
  async broadcastToIdle(
    teamId: string,
    taskType: TaskType,
    description: string,
    prompt: string
  ): Promise<string[]> {
    const team = this.teams.get(teamId);
    if (!team) return [];
    
    const taskIds: string[] = [];
    const idleMembers = Array.from(team.members.values()).filter(m => m.status === 'idle');
    
    for (const member of idleMembers) {
      const taskId = await this.assignTask(teamId, member.id, taskType, description, prompt);
      if (taskId) taskIds.push(taskId);
    }
    
    return taskIds;
  }
  
  /**
   * Get team status
   */
  getTeamStatus(teamId: string): {
    id: string;
    name: string;
    members: { name: string; role: string; status: string }[];
    activeTasks: number;
    totalMembers: number;
  } | null {
    const team = this.teams.get(teamId);
    if (!team) return null;
    
    return {
      id: team.id,
      name: team.name,
      members: Array.from(team.members.values()).map(m => ({
        name: m.name,
        role: m.role,
        status: m.status,
      })),
      activeTasks: team.activeTasks,
      totalMembers: team.members.size,
    };
  }
  
  /**
   * Get available templates
   */
  listTemplates(): TeamTemplate[] {
    return TEAM_TEMPLATES;
  }
  
  /**
   * Get coordinator for direct access
   */
  getCoordinator(): MultiAgentCoordinator {
    return this.coordinator;
  }
}

export default TeamManager;
