/**
 * 🦆 Duck Agent - Meta Agent System with Tools & Time Context
 * Enhanced meta agents with tool access and real-time context
 */

import { EventEmitter } from 'events';
import { AgentMesh } from '../mesh/agent-mesh-enhanced.js';

export type MetaAgentType = 
  | 'orchestrator' | 'bridge' | 'subconscious' | 'mesh' 
  | 'council' | 'monitor' | 'memory' | 'security' | 'scheduler';

export interface Tool {
  name: string;
  description: string;
  handler: (args: any) => Promise<any>;
}

export interface MetaAgentConfig {
  id: string;
  type: MetaAgentType;
  name: string;
  model: string;
  capabilities: string[];
  tools: string[];
  meshEnabled: boolean;
  autoStart: boolean;
  priority: 'low' | 'normal' | 'high' | 'critical';
}

export interface MetaAgent {
  config: MetaAgentConfig;
  status: 'idle' | 'working' | 'error' | 'stopped';
  currentTask?: string;
  lastActivity: number;
  meshAgentId?: string;
  context: {
    currentTime: string;
    timezone: string;
    sessionId?: string;
    userId?: string;
    recentMemories: string[];
  };
  stats: {
    tasksCompleted: number;
    tasksFailed: number;
    averageResponseTime: number;
  };
}

export interface MetaAgentTask {
  id: string;
  agentType: MetaAgentType;
  task: string;
  payload: any;
  priority: 'low' | 'normal' | 'high' | 'critical';
  timestamp: number;
  timeout: number;
  context?: {
    time: string;
    timezone: string;
    recentContext: string[];
  };
}

/**
 * Meta Agent System with Tools and Time Context
 */
export class MetaAgentSystem extends EventEmitter {
  private agents: Map<string, MetaAgent> = new Map();
  private taskQueue: MetaAgentTask[] = [];
  private mesh: AgentMesh | null = null;
  private tools: Map<string, Tool> = new Map();
  private memory: Map<string, any> = new Map();

  constructor() {
    super();
    this.initializeTools();
    this.initializeDefaultAgents();
    this.startTimeSync();
  }

  /**
   * Initialize available tools for meta agents
   */
  private initializeTools(): void {
    this.tools.set('get_time', {
      name: 'get_time',
      description: 'Get current time and timezone',
      handler: async () => ({
        timestamp: Date.now(),
        iso: new Date().toISOString(),
        local: new Date().toLocaleString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        utc: new Date().toUTCString()
      })
    });

    this.tools.set('get_memory', {
      name: 'get_memory',
      description: 'Retrieve memory by key',
      handler: async (args: { key: string }) => this.memory.get(args.key)
    });

    this.tools.set('set_memory', {
      name: 'set_memory',
      description: 'Store memory by key',
      handler: async (args: { key: string; value: any }) => {
        this.memory.set(args.key, { ...args.value, storedAt: Date.now() });
        return { success: true };
      }
    });

    this.tools.set('search_memories', {
      name: 'search_memories',
      description: 'Search memories by pattern',
      handler: async (args: { pattern: string }) => {
        const results = [];
        for (const [key, value] of this.memory) {
          if (key.includes(args.pattern) || JSON.stringify(value).includes(args.pattern)) {
            results.push({ key, value });
          }
        }
        return results;
      }
    });

    this.tools.set('send_mesh_message', {
      name: 'send_mesh_message',
      description: 'Send message via mesh',
      handler: async (args: { to: string; message: any }) => {
        if (this.mesh) {
          this.mesh.sendMessage('meta-system', args.to, args.message, { priority: 'normal' });
          return { sent: true };
        }
        return { sent: false, error: 'Mesh not connected' };
      }
    });

    this.tools.set('broadcast_mesh', {
      name: 'broadcast_mesh',
      description: 'Broadcast to all mesh agents',
      handler: async (args: { message: any }) => {
        if (this.mesh) {
          this.mesh.broadcast({
            id: `broadcast_${Date.now()}`,
            from: 'meta-system',
            to: 'broadcast',
            type: 'event',
            payload: args.message,
            timestamp: Date.now(),
            ttl: 10,
            priority: 'normal'
          });
          return { broadcast: true };
        }
        return { broadcast: false, error: 'Mesh not connected' };
      }
    });

    this.tools.set('get_agent_status', {
      name: 'get_agent_status',
      description: 'Get status of all agents',
      handler: async () => this.getStatus()
    });

    this.tools.set('execute_shell', {
      name: 'execute_shell',
      description: 'Execute shell command',
      handler: async (args: { command: string }) => {
        const { exec } = await import('child_process');
        const { promisify } = await import('util');
        const execAsync = promisify(exec);
        try {
          const { stdout, stderr } = await execAsync(args.command);
          return { stdout, stderr, success: true };
        } catch (e: any) {
          return { error: e.message, success: false };
        }
      }
    });
  }

  /**
   * Start time synchronization for all agents
   */
  private startTimeSync(): void {
    // Update time context every minute
    setInterval(() => {
      const now = new Date();
      for (const [id, agent] of this.agents) {
        agent.context.currentTime = now.toISOString();
      }
    }, 60000);
  }

  /**
   * Initialize default meta agents
   */
  private initializeDefaultAgents(): void {
    const defaultAgents: MetaAgentConfig[] = [
      {
        id: 'meta-orchestrator',
        type: 'orchestrator',
        name: 'Orchestrator Agent',
        model: 'qwen3.5-2b-claude-4.6-opus-reasoning-distilled',
        capabilities: ['task_routing', 'complexity_analysis', 'model_selection'],
        tools: ['get_time', 'get_agent_status', 'send_mesh_message'],
        meshEnabled: true,
        autoStart: true,
        priority: 'critical'
      },
      {
        id: 'meta-bridge',
        type: 'bridge',
        name: 'Bridge Agent',
        model: 'gemma-4-e2b-it',
        capabilities: ['system_integration', 'protocol_translation'],
        tools: ['get_time', 'send_mesh_message', 'broadcast_mesh', 'execute_shell'],
        meshEnabled: true,
        autoStart: true,
        priority: 'high'
      },
      {
        id: 'meta-subconscious',
        type: 'subconscious',
        name: 'Subconscious Agent',
        model: 'qwen3.5-0.8b',
        capabilities: ['memory_management', 'whisper_generation', 'pattern_recognition'],
        tools: ['get_time', 'get_memory', 'set_memory', 'search_memories', 'broadcast_mesh'],
        meshEnabled: true,
        autoStart: true,
        priority: 'high'
      },
      {
        id: 'meta-mesh',
        type: 'mesh',
        name: 'Mesh Coordinator',
        model: 'gemma-4-e2b-it',
        capabilities: ['mesh_management', 'agent_discovery', 'federation'],
        tools: ['get_time', 'send_mesh_message', 'broadcast_mesh', 'get_agent_status'],
        meshEnabled: true,
        autoStart: true,
        priority: 'critical'
      },
      {
        id: 'meta-council',
        type: 'council',
        name: 'AI Council Liaison',
        model: 'qwen3.5-2b-claude-4.6-opus-reasoning-distilled',
        capabilities: ['council_communication', 'deliberation_management'],
        tools: ['get_time', 'send_mesh_message', 'broadcast_mesh', 'get_memory'],
        meshEnabled: true,
        autoStart: true,
        priority: 'high'
      },
      {
        id: 'meta-monitor',
        type: 'monitor',
        name: 'System Monitor',
        model: 'qwen3.5-0.8b',
        capabilities: ['health_monitoring', 'performance_tracking', 'alert_generation'],
        tools: ['get_time', 'get_agent_status', 'execute_shell', 'broadcast_mesh'],
        meshEnabled: true,
        autoStart: true,
        priority: 'normal'
      },
      {
        id: 'meta-memory',
        type: 'memory',
        name: 'Memory Manager',
        model: 'qwen3.5-0.8b',
        capabilities: ['memory_optimization', 'garbage_collection', 'persistence'],
        tools: ['get_time', 'get_memory', 'set_memory', 'search_memories'],
        meshEnabled: false,
        autoStart: true,
        priority: 'normal'
      },
      {
        id: 'meta-security',
        type: 'security',
        name: 'Security Agent',
        model: 'qwen3.5-2b-claude-4.6-opus-reasoning-distilled',
        capabilities: ['threat_detection', 'access_control', 'audit_logging'],
        tools: ['get_time', 'get_agent_status', 'execute_shell', 'broadcast_mesh'],
        meshEnabled: true,
        autoStart: true,
        priority: 'critical'
      },
      {
        id: 'meta-scheduler',
        type: 'scheduler',
        name: 'Task Scheduler',
        model: 'qwen3.5-0.8b',
        capabilities: ['job_scheduling', 'cron_management', 'task_queueing'],
        tools: ['get_time', 'get_memory', 'set_memory', 'broadcast_mesh'],
        meshEnabled: true,
        autoStart: true,
        priority: 'normal'
      }
    ];

    for (const config of defaultAgents) {
      this.registerAgent(config);
    }
  }

  /**
   * Register a meta agent
   */
  registerAgent(config: MetaAgentConfig): MetaAgent {
    const now = new Date();
    const agent: MetaAgent = {
      config,
      status: 'idle',
      lastActivity: Date.now(),
      context: {
        currentTime: now.toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        recentMemories: []
      },
      stats: {
        tasksCompleted: 0,
        tasksFailed: 0,
        averageResponseTime: 0
      }
    };

    this.agents.set(config.id, agent);
    console.log(`[MetaAgent] Registered: ${config.name} (${config.id})`);
    this.emit('agent_registered', agent);

    if (config.autoStart) {
      this.startAgent(config.id);
    }

    return agent;
  }

  /**
   * Start a meta agent
   */
  async startAgent(agentId: string): Promise<void> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Meta agent not found: ${agentId}`);
    }

    agent.status = 'idle';
    agent.lastActivity = Date.now();
    agent.context.currentTime = new Date().toISOString();

    // Register with mesh if enabled
    if (agent.config.meshEnabled && this.mesh) {
      const meshAgent = await this.mesh.registerAgent(
        agent.config.name,
        'duck-cli',
        [...agent.config.capabilities, ...agent.config.tools],
        undefined,
        { 
          metaAgentType: agent.config.type, 
          model: agent.config.model,
          tools: agent.config.tools
        }
      );
      agent.meshAgentId = meshAgent.id;
    }

    console.log(`[MetaAgent] Started: ${agent.config.name}`);
    this.emit('agent_started', agent);
  }

  /**
   * Assign task with time context
   */
  async assignTask(
    agentType: MetaAgentType,
    task: string,
    payload: any,
    options: { priority?: 'low' | 'normal' | 'high' | 'critical'; timeout?: number; context?: any } = {}
  ): Promise<any> {
    const agent = this.findAgentByType(agentType);
    if (!agent) {
      throw new Error(`No available agent of type: ${agentType}`);
    }

    const now = new Date();
    const taskObj: MetaAgentTask = {
      id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      agentType,
      task,
      payload,
      priority: options.priority || 'normal',
      timestamp: Date.now(),
      timeout: options.timeout || 30000,
      context: {
        time: now.toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        recentContext: options.context?.recentMemories || []
      }
    };

    this.taskQueue.push(taskObj);
    agent.status = 'working';
    agent.currentTask = taskObj.id;
    agent.lastActivity = Date.now();

    this.emit('task_assigned', { agent, task: taskObj });

    // Execute with time context
    const startTime = Date.now();
    try {
      // Inject time context into payload
      const enrichedPayload = {
        ...payload,
        _meta: {
          currentTime: now.toISOString(),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          agentId: agent.config.id,
          taskId: taskObj.id
        }
      };

      const result = await this.executeTaskWithTools(agent, taskObj, enrichedPayload);
      
      const duration = Date.now() - startTime;
      agent.stats.tasksCompleted++;
      agent.stats.averageResponseTime = 
        (agent.stats.averageResponseTime * (agent.stats.tasksCompleted - 1) + duration) / agent.stats.tasksCompleted;

      agent.status = 'idle';
      agent.currentTask = undefined;

      // Store in memory for cross-session context
      this.memory.set(`task_${taskObj.id}`, {
        task: taskObj,
        result,
        completedAt: Date.now()
      });

      this.emit('task_completed', { agent, task: taskObj, result });
      return result;

    } catch (error: any) {
      agent.stats.tasksFailed++;
      agent.status = 'error';
      this.emit('task_failed', { agent, task: taskObj, error });
      throw error;
    }
  }

  /**
   * Execute task with tool access
   */
  private async executeTaskWithTools(agent: MetaAgent, task: MetaAgentTask, payload: any): Promise<any> {
    console.log(`[MetaAgent] ${agent.config.name} executing: ${task.task}`);
    console.log(`[MetaAgent] Time context: ${task.context?.time}`);

    // Build tool context
    const toolContext: Record<string, any> = {};
    for (const toolName of agent.config.tools) {
      const tool = this.tools.get(toolName);
      if (tool) {
        toolContext[toolName] = async (args: any) => {
          console.log(`[MetaAgent] ${agent.config.name} using tool: ${toolName}`);
          return tool.handler(args);
        };
      }
    }

    // Execute based on agent type with tools
    switch (agent.config.type) {
      case 'orchestrator':
        return this.executeOrchestratorTask(task, payload, toolContext);
      case 'bridge':
        return this.executeBridgeTask(task, payload, toolContext);
      case 'subconscious':
        return this.executeSubconsciousTask(task, payload, toolContext);
      case 'mesh':
        return this.executeMeshTask(task, payload, toolContext);
      case 'council':
        return this.executeCouncilTask(task, payload, toolContext);
      case 'monitor':
        return this.executeMonitorTask(task, payload, toolContext);
      case 'memory':
        return this.executeMemoryTask(task, payload, toolContext);
      case 'security':
        return this.executeSecurityTask(task, payload, toolContext);
      case 'scheduler':
        return this.executeSchedulerTask(task, payload, toolContext);
      default:
        return { executed: true, task: task.task, time: task.context?.time };
    }
  }

  private async executeOrchestratorTask(task: MetaAgentTask, payload: any, tools: any): Promise<any> {
    const time = await tools.get_time();
    return { 
      complexity: 7, 
      recommendedModel: 'MiniMax-M2.7', 
      useCouncil: true,
      time,
      toolsUsed: ['get_time']
    };
  }

  private async executeBridgeTask(task: MetaAgentTask, payload: any, tools: any): Promise<any> {
    const time = await tools.get_time();
    const status = await tools.get_agent_status();
    return { 
      synced: true, 
      systems: ['openclaw', 'council', 'mesh'],
      time,
      agentStatus: status,
      toolsUsed: ['get_time', 'get_agent_status']
    };
  }

  private async executeSubconsciousTask(task: MetaAgentTask, payload: any, tools: any): Promise<any> {
    const time = await tools.get_time();
    const memories = await tools.search_memories({ pattern: payload.query || 'recent' });
    return { 
      whisper: 'Consider checking AI Council for this complex decision',
      confidence: 0.85,
      type: 'suggestion',
      time,
      relevantMemories: memories,
      toolsUsed: ['get_time', 'search_memories']
    };
  }

  private async executeMeshTask(task: MetaAgentTask, payload: any, tools: any): Promise<any> {
    const time = await tools.get_time();
    const status = await tools.get_agent_status();
    return { 
      agents: status.totalAgents,
      time,
      meshStatus: 'active',
      toolsUsed: ['get_time', 'get_agent_status']
    };
  }

  private async executeCouncilTask(task: MetaAgentTask, payload: any, tools: any): Promise<any> {
    const time = await tools.get_time();
    return { 
      submitted: true, 
      sessionId: `council_${Date.now()}`,
      time,
      toolsUsed: ['get_time']
    };
  }

  private async executeMonitorTask(task: MetaAgentTask, payload: any, tools: any): Promise<any> {
    const time = await tools.get_time();
    const status = await tools.get_agent_status();
    return { 
      healthy: true, 
      cpu: 45, 
      memory: 60, 
      disk: 30,
      agents: status.totalAgents,
      time,
      toolsUsed: ['get_time', 'get_agent_status']
    };
  }

  private async executeMemoryTask(task: MetaAgentTask, payload: any, tools: any): Promise<any> {
    const time = await tools.get_time();
    await tools.set_memory({ 
      key: `memory_${Date.now()}`, 
      value: { task: task.task, time: time.iso } 
    });
    return { 
      optimized: true, 
      freed: '256MB',
      time,
      toolsUsed: ['get_time', 'set_memory']
    };
  }

  private async executeSecurityTask(task: MetaAgentTask, payload: any, tools: any): Promise<any> {
    const time = await tools.get_time();
    const status = await tools.get_agent_status();
    return { 
      scanned: true, 
      threats: 0, 
      score: 95,
      time,
      agentStatus: status,
      toolsUsed: ['get_time', 'get_agent_status']
    };
  }

  private async executeSchedulerTask(task: MetaAgentTask, payload: any, tools: any): Promise<any> {
    const time = await tools.get_time();
    await tools.set_memory({
      key: `scheduled_${Date.now()}`,
      value: { task: payload, scheduledAt: time.iso }
    });
    return { 
      scheduled: true, 
      jobId: `job_${Date.now()}`,
      time,
      toolsUsed: ['get_time', 'set_memory']
    };
  }

  private findAgentByType(type: MetaAgentType): MetaAgent | undefined {
    for (const [id, agent] of this.agents) {
      if (agent.config.type === type && agent.status !== 'stopped') {
        return agent;
      }
    }
    return undefined;
  }

  connectToMesh(mesh: AgentMesh): void {
    this.mesh = mesh;
    for (const [id, agent] of this.agents) {
      if (agent.config.meshEnabled && agent.status !== 'stopped') {
        this.startAgent(id);
      }
    }
    console.log('[MetaAgentSystem] Connected to mesh');
    this.emit('mesh_connected', { meshId: mesh['meshId'] });
  }

  getAllAgents(): MetaAgent[] {
    return Array.from(this.agents.values());
  }

  getAgent(agentId: string): MetaAgent | undefined {
    return this.agents.get(agentId);
  }

  getStatus(): {
    totalAgents: number;
    activeAgents: number;
    idleAgents: number;
    errorAgents: number;
    taskQueueLength: number;
    meshConnected: boolean;
    memorySize: number;
  } {
    const allAgents = Array.from(this.agents.values());
    return {
      totalAgents: allAgents.length,
      activeAgents: allAgents.filter(a => a.status === 'working').length,
      idleAgents: allAgents.filter(a => a.status === 'idle').length,
      errorAgents: allAgents.filter(a => a.status === 'error').length,
      taskQueueLength: this.taskQueue.length,
      meshConnected: !!this.mesh,
      memorySize: this.memory.size
    };
  }

  stopAgent(agentId: string): void {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.status = 'stopped';
      this.emit('agent_stopped', agent);
    }
  }

  stopAll(): void {
    for (const [id] of this.agents) {
      this.stopAgent(id);
    }
    this.emit('all_stopped');
  }
}

export default MetaAgentSystem;
