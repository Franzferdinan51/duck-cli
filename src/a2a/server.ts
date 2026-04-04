/**
 * 🦆 Duck Agent - A2A Server
 * Publish duck-cli as an A2A agent
 */

import { AgentCard, TaskPayload, TaskResult, A2AMessage, A2AResponse } from './types.js';
import { AgentCardManager } from '../mesh/agent-card.js';
import { randomUUID } from 'crypto';
import http from 'http';

interface Task {
  id: string;
  payload: TaskPayload;
  status: 'pending' | 'working' | 'completed' | 'failed';
  result?: any;
  error?: string;
}

export class A2AServer {
  private agentCardManager: AgentCardManager;
  private tasks: Map<string, Task> = new Map();
  private taskHandler?: (payload: TaskPayload) => Promise<any>;
  private server: http.Server | null = null;

  constructor() {
    this.agentCardManager = new AgentCardManager();
  }

  /**
   * Set the handler for incoming tasks
   */
  onTask(handler: (payload: TaskPayload) => Promise<any>): void {
    this.taskHandler = handler;
  }

  /**
   * Get the Agent Card for this agent
   */
  getAgentCard(): AgentCard {
    return this.agentCardManager.getCard();
  }

  /**
   * Update the Agent Card
   */
  updateCard(updates: Partial<AgentCard>): AgentCard {
    return this.agentCardManager.updateCard(updates);
  }

  /**
   * Start the A2A HTTP server
   */
  async start(port: number = 4001): Promise<void> {
    this.server = http.createServer(async (req, res) => {
      // CORS headers
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }

      // Health check
      if (req.method === 'GET' && req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', agent: 'duck-agent' }));
        return;
      }

      // Get Agent Card
      if (req.method === 'GET' && (req.url === '/a2a/card' || req.url === '/agent-card')) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(this.getAgentCard()));
        return;
      }

      // A2A JSON-RPC endpoint
      if (req.method === 'POST' && req.url === '/a2a') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
          try {
            const message: A2AMessage = JSON.parse(body);
            const response = await this.handleMessage(message);
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(response));
          } catch (error: any) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              jsonrpc: '2.0',
              id: null,
              error: { code: -32603, message: error.message }
            }));
          }
        });
        return;
      }

      // Task status endpoint
      if (req.method === 'GET' && req.url?.startsWith('/a2a/task/')) {
        const taskId = req.url.split('/').pop()!;
        const task = this.tasks.get(taskId);
        if (task) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(this.taskToResult(task)));
        } else {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Task not found' }));
        }
        return;
      }

      // 404
      res.writeHead(404);
      res.end('Not Found');
    });

    return new Promise((resolve) => {
      this.server!.listen(port, () => {
        console.log(`[A2A] Server started on port ${port}`);
        resolve();
      });
    });
  }

  /**
   * Stop the A2A server
   */
  async stop(): Promise<void> {
    if (this.server) {
      await new Promise<void>((resolve) => {
        this.server!.close(() => resolve());
      });
      this.server = null;
    }
  }

  /**
   * Handle incoming A2A messages
   */
  private async handleMessage(message: A2AMessage): Promise<A2AResponse> {
    const { method, params, id } = message;

    try {
      let result: any;

      switch (method) {
        case 'agent.getCard':
          result = this.getAgentCard();
          break;

        case 'tasks.send':
          result = await this.handleSendTask(params?.payload);
          break;

        case 'tasks.get':
          result = this.handleGetTask(params?.taskId);
          break;

        case 'tasks.cancel':
          result = this.handleCancelTask(params?.taskId);
          break;

        default:
          throw new Error(`Unknown method: ${method}`);
      }

      return { jsonrpc: '2.0', id, result };
    } catch (error: any) {
      return {
        jsonrpc: '2.0',
        id,
        error: { code: -32603, message: error.message }
      };
    }
  }

  private async handleSendTask(payload: TaskPayload): Promise<TaskResult> {
    const taskId = payload.taskId || randomUUID();
    
    const task: Task = {
      id: taskId,
      payload,
      status: 'pending'
    };
    this.tasks.set(taskId, task);

    // Process async
    if (this.taskHandler) {
      task.status = 'working';
      this.taskHandler(payload)
        .then((result) => {
          task.status = 'completed';
          task.result = result;
        })
        .catch((error) => {
          task.status = 'failed';
          task.error = error.message;
        });
    }

    return this.taskToResult(task);
  }

  private handleGetTask(taskId: string): TaskResult | null {
    const task = this.tasks.get(taskId);
    return task ? this.taskToResult(task) : null;
  }

  private handleCancelTask(taskId: string): TaskResult | null {
    const task = this.tasks.get(taskId);
    if (!task) return null;
    
    if (task.status === 'pending') {
      task.status = 'failed';
      task.error = 'Cancelled by user';
    }
    
    return this.taskToResult(task);
  }

  private taskToResult(task: Task): TaskResult {
    return {
      taskId: task.id,
      status: task.status,
      result: task.result,
      error: task.error,
      metadata: task.payload.metadata
    };
  }
}

export const a2aServer = new A2AServer();
