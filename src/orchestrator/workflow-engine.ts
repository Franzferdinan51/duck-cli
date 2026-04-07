/**
 * 🦆 Duck Agent - Workflow System
 * Microsoft Agent Framework-inspired graph-based workflows
 * Supports streaming, checkpointing, human-in-the-loop, time-travel
 */

import { EventEmitter } from 'events';
import { randomUUID } from 'crypto';

export type WorkflowNodeType = 
  | 'agent'      // AI agent node
  | 'tool'       // Tool execution
  | 'decision'   // Conditional branch
  | 'parallel'   // Parallel execution
  | 'human'      // Human-in-the-loop
  | 'map'        // Map over items
  | 'reduce'     // Reduce results
  | 'delay'      // Delay/wait
  | 'error'      // Error handler
  | 'start'
  | 'end';

export interface WorkflowNode {
  id: string;
  type: WorkflowNodeType;
  name: string;
  config?: Record<string, any>;
  next?: string | string[] | { [key: string]: string }; // Single, array, or conditional
  retry?: {
    maxAttempts: number;
    delayMs: number;
  };
  timeout?: number;
}

export interface WorkflowEdge {
  from: string;
  to: string;
  condition?: string; // JavaScript expression for conditional edges
}

export interface Workflow {
  id: string;
  name: string;
  nodes: Map<string, WorkflowNode>;
  edges: WorkflowEdge[];
  startNode: string;
}

export interface WorkflowState {
  nodeId: string;
  data: Record<string, any>;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'paused';
  startTime: number;
  endTime?: number;
  error?: string;
  checkpointId?: string;
}

export interface WorkflowCheckpoint {
  id: string;
  workflowId: string;
  state: WorkflowState;
  timestamp: number;
  history: WorkflowState[];
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  status: 'running' | 'completed' | 'failed' | 'paused';
  currentState: WorkflowState;
  history: WorkflowState[];
  checkpoints: WorkflowCheckpoint[];
  startTime: number;
  endTime?: number;
}

export interface HumanApprovalRequest {
  executionId: string;
  nodeId: string;
  context: Record<string, any>;
  proposedAction: string;
  timeout?: number;
}

/**
 * Workflow Engine
 * Graph-based workflow execution with checkpointing and time-travel
 */
export class WorkflowEngine extends EventEmitter {
  private workflows: Map<string, Workflow> = new Map();
  private executions: Map<string, WorkflowExecution> = new Map();
  private checkpoints: Map<string, WorkflowCheckpoint> = new Map();
  private humanApprovals: Map<string, HumanApprovalRequest> = new Map();

  /**
   * Register a workflow
   */
  registerWorkflow(workflow: Workflow): void {
    this.workflows.set(workflow.id, workflow);
    console.log(`[Workflow] Registered: ${workflow.name} (${workflow.id})`);
  }

  /**
   * Create a workflow builder
   */
  createWorkflow(name: string): WorkflowBuilder {
    return new WorkflowBuilder(name, this);
  }

  /**
   * Start workflow execution
   */
  async startExecution(
    workflowId: string,
    initialData: Record<string, any> = {}
  ): Promise<WorkflowExecution> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const execution: WorkflowExecution = {
      id: executionId,
      workflowId,
      status: 'running',
      currentState: {
        nodeId: workflow.startNode,
        data: initialData,
        status: 'running',
        startTime: Date.now()
      },
      history: [],
      checkpoints: [],
      startTime: Date.now()
    };

    this.executions.set(executionId, execution);
    this.emit('execution_started', { executionId, workflowId });

    // Start execution
    this.executeNode(executionId, workflow.startNode, initialData);

    return execution;
  }

  /**
   * Execute a single node
   */
  private async executeNode(
    executionId: string,
    nodeId: string,
    data: Record<string, any>
  ): Promise<void> {
    const execution = this.executions.get(executionId);
    if (!execution || execution.status !== 'running') return;

    const workflow = this.workflows.get(execution.workflowId)!;
    const node = workflow.nodes.get(nodeId);
    if (!node) {
      this.failExecution(executionId, `Node not found: ${nodeId}`);
      return;
    }

    console.log(`[Workflow] Executing: ${node.name} (${node.type})`);

    // Update state
    execution.currentState = {
      nodeId,
      data: { ...data },
      status: 'running',
      startTime: Date.now()
    };

    this.emit('node_started', { executionId, nodeId, nodeType: node.type });

    try {
      // Execute based on node type
      let result: Record<string, any>;

      switch (node.type) {
        case 'agent':
          result = await this.executeAgentNode(node, data);
          break;
        case 'tool':
          result = await this.executeToolNode(node, data);
          break;
        case 'decision':
          result = await this.executeDecisionNode(node, data);
          break;
        case 'parallel':
          result = await this.executeParallelNode(node, data, executionId);
          break;
        case 'human':
          result = await this.executeHumanNode(node, data, executionId);
          break;
        case 'map':
          result = await this.executeMapNode(node, data, executionId);
          break;
        case 'reduce':
          result = await this.executeReduceNode(node, data);
          break;
        case 'delay':
          result = await this.executeDelayNode(node, data);
          break;
        case 'start':
        case 'end':
          result = data;
          break;
        default:
          throw new Error(`Unknown node type: ${node.type}`);
      }

      // Save checkpoint
      await this.createCheckpoint(executionId);

      // Move to next node
      execution.currentState.status = 'completed';
      execution.currentState.endTime = Date.now();
      execution.history.push({ ...execution.currentState });

      this.emit('node_completed', { executionId, nodeId, result });

      // Determine next node
      const nextNodeId = this.getNextNode(workflow, node, result);
      if (nextNodeId) {
        await this.executeNode(executionId, nextNodeId, result);
      } else {
        // Workflow complete
        this.completeExecution(executionId, result);
      }

    } catch (error: any) {
      // Handle error
      if (node.retry && execution.currentState.status !== 'failed') {
        console.log(`[Workflow] Retrying ${node.name}...`);
        await new Promise(r => setTimeout(r, node.retry!.delayMs));
        await this.executeNode(executionId, nodeId, data);
      } else {
        this.failExecution(executionId, error.message);
      }
    }
  }

  /**
   * Execute agent node
   */
  private async executeAgentNode(
    node: WorkflowNode,
    data: Record<string, any>
  ): Promise<Record<string, any>> {
    // This would integrate with duck-cli's agent system
    console.log(`[Workflow] Agent: ${node.config?.prompt || 'Processing...'}`);
    
    // Simulate agent execution
    return {
      ...data,
      agent_result: `Processed by ${node.name}`,
      timestamp: Date.now()
    };
  }

  /**
   * Execute tool node
   */
  private async executeToolNode(
    node: WorkflowNode,
    data: Record<string, any>
  ): Promise<Record<string, any>> {
    const toolName = node.config?.tool;
    const params = node.config?.params || {};

    console.log(`[Workflow] Tool: ${toolName}`);

    // This would integrate with duck-cli's tool registry
    return {
      ...data,
      tool_result: `Executed ${toolName}`,
      params
    };
  }

  /**
   * Execute decision node
   */
  private async executeDecisionNode(
    node: WorkflowNode,
    data: Record<string, any>
  ): Promise<Record<string, any>> {
    const condition = node.config?.condition;
    let result: string;

    if (condition) {
      // Evaluate condition
      try {
        const fn = new Function('data', `return ${condition}`);
        result = fn(data) ? 'true' : 'false';
      } catch {
        result = 'false';
      }
    } else {
      result = 'default';
    }

    return {
      ...data,
      decision: result,
      condition
    };
  }

  /**
   * Execute parallel node
   */
  private async executeParallelNode(
    node: WorkflowNode,
    data: Record<string, any>,
    executionId: string
  ): Promise<Record<string, any>> {
    const branches = node.config?.branches || [];
    console.log(`[Workflow] Parallel: ${branches.length} branches`);

    // Execute all branches in parallel
    const results = await Promise.all(
      branches.map(async (branch: any) => {
        // Each branch gets its own execution context
        return this.executeBranch(branch, data);
      })
    );

    return {
      ...data,
      parallel_results: results
    };
  }

  /**
   * Execute human-in-the-loop node
   */
  private async executeHumanNode(
    node: WorkflowNode,
    data: Record<string, any>,
    executionId: string
  ): Promise<Record<string, any>> {
    const request: HumanApprovalRequest = {
      executionId,
      nodeId: node.id,
      context: data,
      proposedAction: node.config?.action || 'Continue?',
      timeout: node.timeout || 300000 // 5 minutes default
    };

    const approvalId = `approval_${Date.now()}`;
    this.humanApprovals.set(approvalId, request);

    // Pause execution
    const execution = this.executions.get(executionId)!;
    execution.status = 'paused';

    console.log(`[Workflow] ⏸️  Paused for human approval: ${approvalId}`);
    this.emit('human_approval_required', { approvalId, request });

    // Wait for approval (with timeout)
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.humanApprovals.delete(approvalId);
        reject(new Error('Human approval timeout'));
      }, request.timeout);

      this.once(`approval_${approvalId}`, (approved: boolean, feedback?: string) => {
        clearTimeout(timeout);
        this.humanApprovals.delete(approvalId);

        if (approved) {
          execution.status = 'running';
          resolve({
            ...data,
            human_approved: true,
            human_feedback: feedback
          });
        } else {
          reject(new Error('Human rejected the action'));
        }
      });
    });
  }

  /**
   * Submit human approval
   */
  submitHumanApproval(approvalId: string, approved: boolean, feedback?: string): void {
    this.emit(`approval_${approvalId}`, approved, feedback);
  }

  /**
   * Execute map node
   */
  private async executeMapNode(
    node: WorkflowNode,
    data: Record<string, any>,
    executionId: string
  ): Promise<Record<string, any>> {
    const items = data[node.config?.items_field || 'items'] || [];
    const workflowId = node.config?.sub_workflow;

    console.log(`[Workflow] Map: ${items.length} items`);

    // Execute sub-workflow for each item
    const results = await Promise.all(
      items.map((item: any) => {
        if (workflowId) {
          return this.startExecution(workflowId, { item, parent: data });
        }
        return Promise.resolve({ item });
      })
    );

    return {
      ...data,
      mapped_results: results
    };
  }

  /**
   * Execute reduce node
   */
  private async executeReduceNode(
    node: WorkflowNode,
    data: Record<string, any>
  ): Promise<Record<string, any>> {
    const items = data[node.config?.items_field || 'items'] || [];
    const reducer = node.config?.reducer || 'concat';

    console.log(`[Workflow] Reduce: ${items.length} items with ${reducer}`);

    let result: any;
    switch (reducer) {
      case 'sum':
        result = items.reduce((a: number, b: number) => a + b, 0);
        break;
      case 'concat':
        result = items.join('');
        break;
      case 'array':
        result = items;
        break;
      default:
        result = items;
    }

    return {
      ...data,
      reduced_result: result
    };
  }

  /**
   * Execute delay node
   */
  private async executeDelayNode(
    node: WorkflowNode,
    data: Record<string, any>
  ): Promise<Record<string, any>> {
    const delayMs = node.config?.delay || 1000;
    console.log(`[Workflow] Delay: ${delayMs}ms`);
    await new Promise(r => setTimeout(r, delayMs));
    return data;
  }

  /**
   * Get next node based on current node and result
   */
  private getNextNode(
    workflow: Workflow,
    currentNode: WorkflowNode,
    result: Record<string, any>
  ): string | null {
    if (!currentNode.next) return null;

    // Conditional routing
    if (typeof currentNode.next === 'object' && !Array.isArray(currentNode.next)) {
      const decision = result.decision || 'default';
      return currentNode.next[decision] || currentNode.next['default'];
    }

    // Single or array
    return Array.isArray(currentNode.next) ? currentNode.next[0] : currentNode.next;
  }

  /**
   * Execute a branch (for parallel)
   */
  private async executeBranch(branch: any, data: Record<string, any>): Promise<any> {
    // Simplified branch execution
    return { branch, data };
  }

  /**
   * Create checkpoint
   */
  private async createCheckpoint(executionId: string): Promise<void> {
    const execution = this.executions.get(executionId);
    if (!execution) return;

    const checkpoint: WorkflowCheckpoint = {
      id: `chk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      workflowId: execution.workflowId,
      state: { ...execution.currentState },
      timestamp: Date.now(),
      history: [...execution.history]
    };

    execution.checkpoints.push(checkpoint);
    this.checkpoints.set(checkpoint.id, checkpoint);

    this.emit('checkpoint_created', { executionId, checkpointId: checkpoint.id });
  }

  /**
   * Restore from checkpoint (time-travel)
   */
  async restoreFromCheckpoint(checkpointId: string): Promise<WorkflowExecution> {
    const checkpoint = this.checkpoints.get(checkpointId);
    if (!checkpoint) {
      throw new Error(`Checkpoint not found: ${checkpointId}`);
    }

    const execution = this.executions.get(checkpoint.state.nodeId);
    if (!execution) {
      throw new Error('Execution not found');
    }

    // Restore state
    execution.currentState = { ...checkpoint.state, status: 'running' };
    execution.history = [...checkpoint.history];
    execution.status = 'running';

    console.log(`[Workflow] ⏪ Restored from checkpoint: ${checkpointId}`);
    this.emit('execution_restored', { executionId: execution.id, checkpointId });

    // Continue execution
    const workflow = this.workflows.get(execution.workflowId)!;
    await this.executeNode(execution.id, checkpoint.state.nodeId, checkpoint.state.data);

    return execution;
  }

  /**
   * Complete execution
   */
  private completeExecution(executionId: string, finalData: Record<string, any>): void {
    const execution = this.executions.get(executionId);
    if (!execution) return;

    execution.status = 'completed';
    execution.endTime = Date.now();
    execution.currentState.data = finalData;

    console.log(`[Workflow] ✅ Completed: ${executionId}`);
    this.emit('execution_completed', { executionId, result: finalData });
  }

  /**
   * Fail execution
   */
  private failExecution(executionId: string, error: string): void {
    const execution = this.executions.get(executionId);
    if (!execution) return;

    execution.status = 'failed';
    execution.endTime = Date.now();
    execution.currentState.status = 'failed';
    execution.currentState.error = error;

    console.log(`[Workflow] ❌ Failed: ${executionId} - ${error}`);
    this.emit('execution_failed', { executionId, error });
  }

  /**
   * Pause execution
   */
  pauseExecution(executionId: string): void {
    const execution = this.executions.get(executionId);
    if (execution) {
      execution.status = 'paused';
      this.emit('execution_paused', { executionId });
    }
  }

  /**
   * Resume execution
   */
  async resumeExecution(executionId: string): Promise<void> {
    const execution = this.executions.get(executionId);
    if (!execution || execution.status !== 'paused') return;

    execution.status = 'running';
    this.emit('execution_resumed', { executionId });

    // Continue from current state
    const workflow = this.workflows.get(execution.workflowId)!;
    const nextNodeId = this.getNextNode(workflow, workflow.nodes.get(execution.currentState.nodeId)!, execution.currentState.data);
    
    if (nextNodeId) {
      await this.executeNode(executionId, nextNodeId, execution.currentState.data);
    }
  }

  /**
   * Get execution status
   */
  getExecution(executionId: string): WorkflowExecution | undefined {
    return this.executions.get(executionId);
  }

  /**
   * Get all executions
   */
  getAllExecutions(): WorkflowExecution[] {
    return Array.from(this.executions.values());
  }

  /**
   * Get checkpoint
   */
  getCheckpoint(checkpointId: string): WorkflowCheckpoint | undefined {
    return this.checkpoints.get(checkpointId);
  }
}

/**
 * Workflow Builder
 * Fluent API for building workflows
 */
export class WorkflowBuilder {
  private workflow: Workflow;
  private engine: WorkflowEngine;
  private lastNodeId: string | null = null;

  constructor(name: string, engine: WorkflowEngine) {
    this.engine = engine;
    this.workflow = {
      id: `wf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      nodes: new Map(),
      edges: [],
      startNode: ''
    };
  }

  start(name: string = 'Start'): this {
    const node: WorkflowNode = {
      id: 'start',
      type: 'start',
      name
    };
    this.workflow.nodes.set('start', node);
    this.workflow.startNode = 'start';
    this.lastNodeId = 'start';
    return this;
  }

  agent(name: string, config: { prompt?: string; model?: string } = {}): this {
    return this.addNode('agent', name, config);
  }

  tool(name: string, config: { tool: string; params?: Record<string, any> }): this {
    return this.addNode('tool', name, config);
  }

  decision(name: string, config: { condition: string; branches: { [key: string]: string } }): this {
    const node: WorkflowNode = {
      id: this.makeId(name),
      type: 'decision',
      name,
      config,
      next: config.branches
    };
    this.addNodeInternal(node);
    return this;
  }

  parallel(name: string, config: { branches: any[] }): this {
    return this.addNode('parallel', name, config);
  }

  human(name: string, config: { action: string; timeout?: number }): this {
    return this.addNode('human', name, config);
  }

  map(name: string, config: { items_field: string; sub_workflow?: string }): this {
    return this.addNode('map', name, config);
  }

  reduce(name: string, config: { items_field: string; reducer: string }): this {
    return this.addNode('reduce', name, config);
  }

  delay(name: string, config: { delay: number }): this {
    return this.addNode('delay', name, config);
  }

  end(name: string = 'End'): this {
    const node: WorkflowNode = {
      id: 'end',
      type: 'end',
      name
    };
    this.workflow.nodes.set('end', node);
    this.connectTo(node.id);
    this.lastNodeId = 'end';
    return this;
  }

  private addNode(type: WorkflowNodeType, name: string, config: Record<string, any>): this {
    const node: WorkflowNode = {
      id: this.makeId(name),
      type,
      name,
      config
    };
    this.addNodeInternal(node);
    return this;
  }

  private addNodeInternal(node: WorkflowNode): void {
    this.workflow.nodes.set(node.id, node);
    this.connectTo(node.id);
    this.lastNodeId = node.id;
  }

  private connectTo(nodeId: string): void {
    if (this.lastNodeId && this.lastNodeId !== nodeId) {
      const lastNode = this.workflow.nodes.get(this.lastNodeId);
      if (lastNode) {
        lastNode.next = nodeId;
        this.workflow.edges.push({ from: this.lastNodeId, to: nodeId });
      }
    }
  }

  private makeId(name: string): string {
    return `${name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
  }

  build(): Workflow {
    this.engine.registerWorkflow(this.workflow);
    return this.workflow;
  }
}

export default WorkflowEngine;
