/**
 * 🦆 Duck Agent Gateway
 * OpenClaw-style gateway with HTTP APIs and channel integrations
 */

import { EventEmitter } from 'events';
import { createServer, Server } from 'http';
import { Agent } from '../agent/core.js';
import { ChannelManager } from '../channels/manager.js';
import { ToolRegistry } from '../tools/registry.js';

export interface GatewayConfig {
  port: number;
  host?: string;
  authToken?: string;
  workspace?: string;
}

export interface GatewayMetrics {
  uptime: number;
  sessions: number;
  toolsInvoked: number;
  messagesProcessed: number;
  errors: number;
}

export class Gateway extends EventEmitter {
  private config: GatewayConfig;
  private server: Server | null = null;
  private agent: Agent;
  private channels: ChannelManager;
  private startTime: number;
  private metrics: GatewayMetrics;

  constructor(config: GatewayConfig) {
    super();
    this.config = {
      port: config.port || 18792,
      host: config.host || 'localhost',
      authToken: config.authToken || process.env.GATEWAY_TOKEN || 'duck',
    };
    this.startTime = Date.now();
    this.metrics = {
      uptime: 0,
      sessions: 0,
      toolsInvoked: 0,
      messagesProcessed: 0,
      errors: 0,
    };
    
    // Initialize core components
    this.agent = new Agent({ name: 'DuckGateway' });
    this.channels = new ChannelManager(this.agent);
  }

  /**
   * Start the gateway server
   */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server = createServer();

        // HTTP endpoints
        this.server.on('request', (req: any, res: any) => {
          this.handleRequest(req, res);
        });

        this.server.on('listening', async () => {
          console.log(`🦆 Duck Gateway running on http://${this.config.host}:${this.config.port}`);
          console.log(`   Health: http://${this.config.host}:${this.config.port}/health`);
          console.log(`   API: http://${this.config.host}:${this.config.port}/v1`);
          
          // Initialize agent
          await this.agent.initialize();
          resolve();
        });

        this.server.on('error', (err: Error) => {
          console.error('Gateway error:', err);
          reject(err);
        });

        this.server.listen(this.config.port, this.config.host);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Stop the gateway
   */
  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          console.log('🦆 Duck Gateway stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Handle HTTP requests
   */
  private handleRequest(req: any, res: any): void {
    const host = req.headers?.host || `localhost:${this.config.port}`;
    const url = new URL(req.url || '/', `http://${host}`);
    const path = url.pathname;

    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    // Routes
    if (path === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', gateway: 'DuckGateway' }));
    } else if (path === '/metrics') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(this.getMetrics()));
    } else if (path === '/status') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(this.getStatus()));
    } else if (path.startsWith('/v1/')) {
      this.handleV1API(path, req, res);
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  }

  /**
   * Handle OpenAI-compatible API
   */
  private async handleV1API(path: string, req: any, res: any): Promise<void> {
    let body = '';
    req.on('data', (chunk: Buffer) => { body += chunk.toString(); });

    req.on('end', async () => {
      try {
        if (path === '/v1/models') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            models: [
              { id: 'duck-agent', object: 'model', created: Date.now() },
            ]
          }));
        } else if (path === '/v1/chat/completions') {
          if (!body) {
            res.writeHead(400);
            res.end(JSON.stringify({ error: 'Request body required' }));
            return;
          }
          
          const { messages } = JSON.parse(body);
          const lastMessage = messages[messages.length - 1];
          // Handle vision content (array format) - serialize to string for agent
          const messageContent = typeof lastMessage.content === 'string' 
            ? lastMessage.content 
            : JSON.stringify(lastMessage.content);
          const response = await this.agent.think(messageContent);
          
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            choices: [{
              message: { role: 'assistant', content: response },
              finish_reason: 'stop',
            }]
          }));
        } else if (path === '/v1/embeddings') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ embedding: [] }));
        } else {
          res.writeHead(404);
          res.end('Not found');
        }
      } catch (error) {
        this.metrics.errors++;
        res.writeHead(500);
        res.end(JSON.stringify({ error: 'Internal error' }));
      }
    });
  }

  /**
   * Get gateway status
   */
  getStatus(): any {
    return {
      gateway: 'DuckGateway',
      version: '0.5.0',
      uptime: Date.now() - this.startTime,
      channels: this.channels.getStatus(),
      agent: {
        name: this.agent.getStatus().name,
        tools: this.agent.getStatus().tools,
        skills: this.agent.getStatus().skills,
      },
    };
  }

  /**
   * Get metrics
   */
  getMetrics(): GatewayMetrics {
    return {
      ...this.metrics,
      uptime: Date.now() - this.startTime,
    };
  }
}

export default Gateway;
