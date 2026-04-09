/**
 * 🦆 Duck Agent - Node Manager
 * Host-side node management for OpenClaw: install/run/status/uninstall
 * Works with the OpenClaw Gateway running on the host machine
 */

import { execSync, spawn } from 'child_process';
import { existsSync, readFileSync, writeFileSync, chmodSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';

export interface NodeConfig {
  id: string;
  name: string;
  host: string;
  port: number;
  protocol: 'ws' | 'wss' | 'http' | 'https';
  token?: string;
  status: 'unknown' | 'stopped' | 'running' | 'error';
  lastSeen?: Date;
  version?: string;
  capabilities?: string[];
}

export interface NodeStatus {
  id: string;
  name: string;
  status: 'unknown' | 'stopped' | 'running' | 'error';
  uptime?: number;
  memory?: number;
  cpu?: number;
  version?: string;
  lastError?: string;
}

export interface NodeInstallOptions {
  name: string;
  host: string;
  port?: number;
  token?: string;
  autoStart?: boolean;
  installPath?: string;
}

const DEFAULT_GATEWAY_PORT = 18789;
const NODE_INSTALL_DIR = join(homedir(), '.openclaw', 'nodes');

/**
 * NodeManager handles OpenClaw node lifecycle on the local machine.
 * A "node" is a running instance of the OpenClaw companion that connects
 * to the Gateway (e.g. on a phone, Pi, or another Mac).
 */
export class NodeManager {
  private nodes: Map<string, NodeConfig> = new Map();
  private gatewayUrl: string;
  private processes: Map<string, ReturnType<typeof spawn>> = new Map();

  constructor(gatewayUrl?: string) {
    this.gatewayUrl = gatewayUrl || `ws://localhost:${DEFAULT_GATEWAY_PORT}`;
    this.loadNodes();
  }

  /** Get the gateway URL */
  getGatewayUrl(): string {
    return this.gatewayUrl;
  }

  /** Set gateway URL */
  setGatewayUrl(url: string): void {
    this.gatewayUrl = url;
  }

  // ─── Node Storage ─────────────────────────────────────────────────────────

  private getNodeStoragePath(): string {
    return join(homedir(), '.openclaw', 'nodes.json');
  }

  private loadNodes(): void {
    const path = this.getNodeStoragePath();
    if (existsSync(path)) {
      try {
        const data = JSON.parse(readFileSync(path, 'utf-8'));
        for (const [id, config] of Object.entries(data as Record<string, any>)) {
          this.nodes.set(id, config as NodeConfig);
        }
      } catch {}
    }
  }

  private saveNodes(): void {
    const dir = join(homedir(), '.openclaw');
    if (!existsSync(dir)) {
      execSync(`mkdir -p "${dir}"`);
    }
    const data: Record<string, NodeConfig> = {};
    for (const [id, config] of this.nodes) {
      data[id] = config;
    }
    writeFileSync(this.getNodeStoragePath(), JSON.stringify(data, null, 2), 'utf-8');
  }

  // ─── CRUD ────────────────────────────────────────────────────────────────

  /**
   * Register a new node manually (for pre-installed nodes)
   */
  registerNode(config: NodeConfig): void {
    this.nodes.set(config.id, { ...config, status: config.status || 'unknown' });
    this.saveNodes();
  }

  /**
   * Remove a node from the registry
   */
  async uninstallNode(nodeId: string): Promise<boolean> {
    // Stop if running
    await this.stopNode(nodeId);

    // Remove node config
    if (this.nodes.has(nodeId)) {
      this.nodes.delete(nodeId);
      this.saveNodes();
      return true;
    }
    return false;
  }

  /**
   * List all registered nodes
   */
  listNodes(): NodeConfig[] {
    return Array.from(this.nodes.values());
  }

  /**
   * Get a single node config
   */
  getNode(nodeId: string): NodeConfig | undefined {
    return this.nodes.get(nodeId);
  }

  /**
   * Update node config
   */
  updateNode(nodeId: string, updates: Partial<NodeConfig>): void {
    const existing = this.nodes.get(nodeId);
    if (existing) {
      this.nodes.set(nodeId, { ...existing, ...updates });
      this.saveNodes();
    }
  }

  // ─── Lifecycle ──────────────────────────────────────────────────────────

  /**
   * Check if the OpenClaw Gateway is running locally
   */
  isGatewayRunning(): boolean {
    try {
      execSync(`curl -s -o /dev/null -w "%{http_code}" "${this.gatewayUrl.replace('ws', 'http')}/health" --connect-timeout 1 --max-time 2`, { stdio: 'pipe' });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Query node status from the gateway
   */
  async getNodeStatus(nodeId: string): Promise<NodeStatus | null> {
    try {
      const response = execSync(`curl -s "${this.gatewayUrl.replace('ws', 'http')}/nodes/${nodeId}/status" --connect-timeout 2 --max-time 5`, { stdio: 'pipe' });
      return JSON.parse(response.toString());
    } catch {
      // Node not reachable or gateway offline
      const node = this.nodes.get(nodeId);
      return node ? { id: node.id, name: node.name, status: node.status } : null;
    }
  }

  /**
   * Start a registered node (spawns openclaw node run)
   */
  async startNode(nodeId: string): Promise<boolean> {
    const node = this.nodes.get(nodeId);
    if (!node) return false;

    try {
      const child = spawn('openclaw', ['node', 'run', '--id', nodeId, '--gateway', this.gatewayUrl], {
        detached: true,
        stdio: 'ignore',
      });
      child.unref();
      this.processes.set(nodeId, child);

      this.updateNode(nodeId, { status: 'running' });
      return true;
    } catch (err) {
      this.updateNode(nodeId, { status: 'error' });
      return false;
    }
  }

  /**
   * Stop a running node process
   */
  async stopNode(nodeId: string): Promise<boolean> {
    const proc = this.processes.get(nodeId);
    if (proc) {
      try {
        proc.kill('SIGTERM');
        this.processes.delete(nodeId);
      } catch {}
    }
    this.updateNode(nodeId, { status: 'stopped' });
    return true;
  }

  /**
   * Check status of all registered nodes
   */
  async refreshNodeStatuses(): Promise<void> {
    for (const node of this.nodes.values()) {
      const status = await this.getNodeStatus(node.id);
      if (status) {
        this.updateNode(node.id, { status: status.status as any });
      }
    }
  }

  // ─── CLI Helpers ────────────────────────────────────────────────────────

  /**
   * Print node list to console
   */
  printNodeList(): void {
    const nodes = this.listNodes();
    if (nodes.length === 0) {
      console.log('No nodes registered. Run: duck node install <name>');
      return;
    }

    console.log('\n🖥️  Registered Nodes:\n');
    console.log('  ID             NAME              STATUS      GATEWAY');
    console.log('  ' + '─'.repeat(70));

    for (const node of nodes) {
      const statusIcon = node.status === 'running' ? '🟢' :
                         node.status === 'error' ? '🔴' :
                         node.status === 'stopped' ? '⚪' : '⚪';
      console.log(`  ${statusIcon} ${(node.id).substring(0, 12).padEnd(13)} ${(node.name).padEnd(17)} ${node.status.padEnd(10)} ${node.host}:${node.port}`);
    }
    console.log();
  }

  /**
   * Print single node status
   */
  async printNodeStatus(nodeId: string): Promise<void> {
    const node = this.nodes.get(nodeId);
    if (!node) {
      console.log(`Node not found: ${nodeId}`);
      return;
    }

    const status = await this.getNodeStatus(nodeId);

    console.log(`\n🖥️  Node: ${node.name}`);
    console.log(`    ID:       ${node.id}`);
    console.log(`    Host:     ${node.host}:${node.port}`);
    console.log(`    Status:   ${status?.status || node.status}`);
    console.log(`    Gateway:  ${this.gatewayUrl}`);
    if (status?.uptime) {
      const hours = Math.floor(status.uptime / 3600);
      const mins = Math.floor((status.uptime % 3600) / 60);
      console.log(`    Uptime:   ${hours}h ${mins}m`);
    }
    if (status?.version) console.log(`    Version:  ${status.version}`);
    if (status?.memory) console.log(`    Memory:   ${(status.memory / 1024 / 1024).toFixed(1)} MB`);
    if (node.capabilities?.length) console.log(`    Caps:     ${node.capabilities.join(', ')}`);
    console.log();
  }
}

export default NodeManager;
