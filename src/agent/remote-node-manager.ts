/**
 * 🦆 Duck Agent - Remote Node System
 * OpenClaw-inspired remote node creation and management
 * Allows agents to run commands on remote devices
 */

import { EventEmitter } from 'events';
import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import WebSocket from 'ws';

const execAsync = promisify(exec);

export interface RemoteNodeConfig {
  id: string;
  name: string;
  host: string;
  port?: number;
  username: string;
  privateKey?: string;
  password?: string;
  gatewayUrl: string;
  capabilities?: string[];
}

export interface RemoteNode {
  id: string;
  name: string;
  host: string;
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
  ws?: WebSocket;
  sshTunnel?: any;
  capabilities: string[];
  lastSeen: number;
  paired: boolean;
}

export interface NodeCommand {
  id: string;
  nodeId: string;
  command: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  timeout?: number;
}

export interface NodeCommandResult {
  commandId: string;
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
}

/**
 * Remote Node Manager
 * Manages remote nodes for cross-device agent execution
 */
export class RemoteNodeManager extends EventEmitter {
  private nodes: Map<string, RemoteNode> = new Map();
  private gatewayUrl: string;
  private apiKey: string;

  constructor(gatewayUrl: string = 'ws://localhost:18789', apiKey: string = '') {
    super();
    this.gatewayUrl = gatewayUrl;
    this.apiKey = apiKey;
  }

  /**
   * Create a new remote node
   */
  async createNode(config: RemoteNodeConfig): Promise<RemoteNode> {
    const node: RemoteNode = {
      id: config.id,
      name: config.name,
      host: config.host,
      status: 'connecting',
      capabilities: config.capabilities || ['shell', 'file', 'process'],
      lastSeen: Date.now(),
      paired: false
    };

    this.nodes.set(config.id, node);

    // Establish SSH tunnel if needed
    if (config.host !== 'localhost' && config.host !== '127.0.0.1') {
      await this.establishSSHTunnel(node, config);
    }

    // Connect to gateway
    await this.connectNode(node);

    this.emit('node_created', node);
    return node;
  }

  /**
   * Establish SSH tunnel for remote node
   */
  private async establishSSHTunnel(node: RemoteNode, config: RemoteNodeConfig): Promise<void> {
    const localPort = await this.findFreePort();
    const gatewayPort = new URL(this.gatewayUrl).port || '18789';

    const sshArgs = [
      '-N', // No command execution
      '-L', `${localPort}:localhost:${gatewayPort}`, // Port forwarding
      '-o', 'BatchMode=yes',
      '-o', 'StrictHostKeyChecking=no',
      '-o', 'UserKnownHostsFile=/dev/null'
    ];

    if (config.privateKey) {
      sshArgs.push('-i', config.privateKey);
    }

    sshArgs.push(`${config.username}@${config.host}`);

    const sshProcess = spawn('ssh', sshArgs, {
      detached: true,
      stdio: 'ignore'
    });

    node.sshTunnel = {
      process: sshProcess,
      localPort,
      pid: sshProcess.pid
    };

    // Wait for tunnel to establish
    await new Promise((resolve, reject) => {
      setTimeout(resolve, 2000); // Give SSH time to connect
    });

    console.log(`[RemoteNode] SSH tunnel established: localhost:${localPort} -> ${config.host}:${gatewayPort}`);
  }

  /**
   * Connect node to gateway
   */
  private async connectNode(node: RemoteNode): Promise<void> {
    const wsUrl = this.gatewayUrl.replace('http', 'ws').replace('https', 'wss');
    const localPort = node.sshTunnel?.localPort;
    const connectUrl = localPort 
      ? wsUrl.replace(/:\d+/, `:${localPort}`)
      : wsUrl;

    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`${connectUrl}/ws?nodeId=${node.id}`, {
        headers: {
          'X-API-Key': this.apiKey,
          'X-Node-Capabilities': node.capabilities.join(',')
        }
      });

      ws.on('open', () => {
        node.status = 'connected';
        node.ws = ws;
        node.paired = true;
        node.lastSeen = Date.now();
        console.log(`[RemoteNode] Connected: ${node.name} (${node.id})`);
        this.emit('node_connected', node);
        resolve();
      });

      ws.on('message', (data) => {
        this.handleNodeMessage(node, data);
      });

      ws.on('close', () => {
        node.status = 'disconnected';
        this.emit('node_disconnected', node);
      });

      ws.on('error', (err) => {
        node.status = 'error';
        this.emit('node_error', { node, error: err });
        reject(err);
      });
    });
  }

  /**
   * Handle messages from node
   */
  private handleNodeMessage(node: RemoteNode, data: WebSocket.Data): void {
    try {
      const msg = JSON.parse(data.toString());
      
      if (msg.type === 'command') {
        this.executeCommandOnNode(node, msg);
      } else if (msg.type === 'heartbeat') {
        node.lastSeen = Date.now();
      } else if (msg.type === 'status') {
        this.emit('node_status', { node, status: msg.status });
      }
    } catch (e) {
      console.error('[RemoteNode] Failed to parse message:', e);
    }
  }

  /**
   * Execute command on remote node
   */
  private async executeCommandOnNode(node: RemoteNode, cmd: NodeCommand): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Execute via SSH if remote
      let result;
      if (node.sshTunnel) {
        const sshCmd = `ssh -o BatchMode=yes -p ${node.sshTunnel.localPort} localhost "cd ${cmd.cwd || '~'} && ${cmd.command} ${cmd.args?.join(' ') || ''}"`;
        result = await execAsync(sshCmd, { timeout: cmd.timeout || 60000 });
      } else {
        // Local execution
        result = await execAsync(`${cmd.command} ${cmd.args?.join(' ') || ''}`, {
          cwd: cmd.cwd,
          env: { ...process.env, ...cmd.env },
          timeout: cmd.timeout || 60000
        });
      }

      const response: NodeCommandResult = {
        commandId: cmd.id,
        success: true,
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: 0,
        durationMs: Date.now() - startTime
      };

      node.ws?.send(JSON.stringify({ type: 'command_result', result: response }));
    } catch (error: any) {
      const response: NodeCommandResult = {
        commandId: cmd.id,
        success: false,
        stdout: '',
        stderr: error.stderr || error.message,
        exitCode: error.code || 1,
        durationMs: Date.now() - startTime
      };

      node.ws?.send(JSON.stringify({ type: 'command_result', result: response }));
    }
  }

  /**
   * Send command to node
   */
  async sendCommand(nodeId: string, command: string, args?: string[], options: {
    cwd?: string;
    timeout?: number;
  } = {}): Promise<NodeCommandResult> {
    const node = this.nodes.get(nodeId);
    if (!node || node.status !== 'connected') {
      throw new Error(`Node ${nodeId} not connected`);
    }

    const cmd: NodeCommand = {
      id: `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      nodeId,
      command,
      args,
      cwd: options.cwd,
      timeout: options.timeout
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Command timeout'));
      }, options.timeout || 60000);

      const handler = (data: WebSocket.Data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'command_result' && msg.result.commandId === cmd.id) {
            clearTimeout(timeout);
            node.ws?.off('message', handler);
            resolve(msg.result);
          }
        } catch {}
      };

      node.ws?.on('message', handler);
      node.ws?.send(JSON.stringify({ type: 'command', ...cmd }));
    });
  }

  /**
   * List all nodes
   */
  listNodes(): RemoteNode[] {
    return Array.from(this.nodes.values());
  }

  /**
   * Get node by ID
   */
  getNode(id: string): RemoteNode | undefined {
    return this.nodes.get(id);
  }

  /**
   * Disconnect and remove node
   */
  async removeNode(id: string): Promise<void> {
    const node = this.nodes.get(id);
    if (!node) return;

    // Close WebSocket
    node.ws?.close();

    // Kill SSH tunnel
    if (node.sshTunnel?.process) {
      node.sshTunnel.process.kill('SIGTERM');
    }

    this.nodes.delete(id);
    this.emit('node_removed', { id });
  }

  /**
   * Find a free local port
   */
  private async findFreePort(): Promise<number> {
    const { createServer } = await import('net');
    return new Promise((resolve, reject) => {
      const server = createServer();
      server.listen(0, () => {
        const port = (server.address() as any).port;
        server.close(() => resolve(port));
      });
    });
  }

  /**
   * Check node health
   */
  async checkNodeHealth(nodeId: string): Promise<boolean> {
    const node = this.nodes.get(nodeId);
    if (!node) return false;

    try {
      await this.sendCommand(nodeId, 'echo', ['ping'], { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }
}

export default RemoteNodeManager;
