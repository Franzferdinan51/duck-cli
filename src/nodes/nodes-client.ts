/**
 * 🦆 Duck Agent - Nodes Client
 * Gateway-side node queries: list/describe/approve/reject
 * Commands: openclaw nodes [list|describe|approve|reject]
 * Works with OpenClaw Gateway API
 */

import { execSync } from 'child_process';

export interface NodeInfo {
  id: string;
  name: string;
  type: string;
  status: 'online' | 'offline' | 'pending' | 'rejected';
  lastSeen?: string;
  firstSeen?: string;
  pairedAt?: string;
  pairedBy?: string;
  publicUrl?: string;
  remoteAddress?: string;
  clientVersion?: string;
  osInfo?: string;
  capabilities?: string[];
  tokenFingerprint?: string;
  expiresAt?: string;
  rejectedAt?: string;
  rejectedBy?: string;
}

export interface NodeListOptions {
  /** Filter by status: 'online' | 'offline' | 'pending' | 'rejected' | 'all' */
  status?: 'online' | 'offline' | 'pending' | 'rejected' | 'all';
  /** Limit results */
  limit?: number;
  /** Sort field */
  sortBy?: 'name' | 'status' | 'lastSeen';
  /** Sort direction */
  sortDir?: 'asc' | 'desc';
  /** Gateway URL override */
  gatewayUrl?: string;
  /** Include expired tokens */
  includeExpired?: boolean;
}

export interface NodesClientOptions {
  gatewayUrl?: string;
  apiKey?: string;
  timeout?: number;
}

const DEFAULT_GATEWAY_PORT = 18789;
const DEFAULT_GATEWAY_URL = `http://localhost:${DEFAULT_GATEWAY_PORT}`;

/**
 * NodesClient talks to the OpenClaw Gateway API to query and manage
 * paired nodes (devices that have connected to the gateway).
 */
export class NodesClient {
  private gatewayUrl: string;
  private apiKey?: string;
  private timeout: number;

  constructor(options: NodesClientOptions = {}) {
    this.gatewayUrl = options.gatewayUrl || process.env.OPENCLAW_GATEWAY_URL || DEFAULT_GATEWAY_URL;
    this.apiKey = options.apiKey || process.env.OPENCLAW_API_KEY;
    this.timeout = options.timeout || 5000;
  }

  setGatewayUrl(url: string): void {
    this.gatewayUrl = url;
  }

  // ─── HTTP Helpers ─────────────────────────────────────────────────────────

  private async httpRequest(path: string, method = 'GET', body?: any): Promise<any> {
    const url = `${this.gatewayUrl}${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    try {
      const curlCmd = [
        'curl',
        '-s',
        '-X', method,
        '-H', `Content-Type: application/json`,
        '-H', `Accept: application/json`,
        ...(this.apiKey ? ['-H', `Authorization: Bearer ${this.apiKey}`] : []),
        ...(body ? ['-d', JSON.stringify(body)] : []),
        '--connect-timeout', String(Math.floor(this.timeout / 1000)),
        '--max-time', String(Math.floor(this.timeout / 1000)),
        url,
      ];
      const output = execSync(curlCmd.join(' '), { stdio: 'pipe' });
      return JSON.parse(output.toString());
    } catch (err: any) {
      const exitCode = err.status;
      if (exitCode === 22) throw new Error(`Gateway unreachable at ${this.gatewayUrl}`);
      if (exitCode === 7) throw new Error(`Connection refused by gateway at ${this.gatewayUrl}`);
      if (exitCode === 28) throw new Error(`Gateway timeout after ${this.timeout}ms`);
      throw new Error(`Gateway request failed: ${err.message}`);
    }
  }

  private async httpRequestRaw(path: string): Promise<string> {
    try {
      const output = execSync(
        `curl -s --connect-timeout ${Math.floor(this.timeout / 1000)} --max-time ${Math.floor(this.timeout / 1000)} ` +
        `${this.apiKey ? `-H "Authorization: Bearer ${this.apiKey}" ` : ''}` +
        `"${this.gatewayUrl}${path}"`,
        { stdio: 'pipe' }
      );
      return output.toString();
    } catch (err: any) {
      return '{}';
    }
  }

  // ─── Gateway Health ──────────────────────────────────────────────────────

  /**
   * Check if the gateway is reachable
   */
  async isGatewayReachable(): Promise<boolean> {
    try {
      await this.httpRequestRaw('/health');
      return true;
    } catch {
      return false;
    }
  }

  // ─── Node Queries ────────────────────────────────────────────────────────

  /**
   * List all nodes with optional filtering
   */
  async listNodes(options: NodeListOptions = {}): Promise<NodeInfo[]> {
    const {
      status = 'all',
      limit = 50,
      sortBy = 'lastSeen',
      sortDir = 'desc',
      includeExpired = false,
    } = options;

    const params = new URLSearchParams({
      status: status === 'all' ? '' : status,
      limit: String(limit),
      sortBy,
      sortDir,
      includeExpired: String(includeExpired),
    });

    try {
      const data = await this.httpRequest(`/nodes?${params.toString()}`);
      const nodes: NodeInfo[] = Array.isArray(data) ? data : (data.nodes || []);
      return nodes;
    } catch (err: any) {
      // Fallback: try simple curl
      try {
        const raw = await this.httpRequestRaw('/nodes');
        const data = JSON.parse(raw);
        return Array.isArray(data) ? data : (data.nodes || []);
      } catch {
        return [];
      }
    }
  }

  /**
   * Get detailed info for a specific node
   */
  async describeNode(nodeId: string): Promise<NodeInfo | null> {
    try {
      const data = await this.httpRequest(`/nodes/${encodeURIComponent(nodeId)}`);
      return data;
    } catch {
      return null;
    }
  }

  /**
   * Get node status (online/offline/pending/rejected)
   */
  async getNodeStatus(nodeId: string): Promise<string> {
    try {
      const data = await this.httpRequest(`/nodes/${encodeURIComponent(nodeId)}/status`);
      return data.status || 'unknown';
    } catch {
      return 'unknown';
    }
  }

  // ─── Node Management ──────────────────────────────────────────────────────

  /**
   * Approve a pending node
   */
  async approveNode(nodeId: string, approvedBy?: string): Promise<boolean> {
    try {
      await this.httpRequest(`/nodes/${encodeURIComponent(nodeId)}/approve`, 'POST', {
        approvedBy: approvedBy || 'duck-cli',
        approvedAt: new Date().toISOString(),
      });
      return true;
    } catch (err: any) {
      console.error(`Failed to approve node ${nodeId}: ${err.message}`);
      return false;
    }
  }

  /**
   * Reject a pending or online node
   */
  async rejectNode(nodeId: string, reason?: string): Promise<boolean> {
    try {
      await this.httpRequest(`/nodes/${encodeURIComponent(nodeId)}/reject`, 'POST', {
        rejectedBy: 'duck-cli',
        rejectedAt: new Date().toISOString(),
        reason: reason || 'Rejected via duck-cli',
      });
      return true;
    } catch (err: any) {
      console.error(`Failed to reject node ${nodeId}: ${err.message}`);
      return false;
    }
  }

  // ─── CLI Output ───────────────────────────────────────────────────────────

  private formatStatus(status: string): string {
    const icons: Record<string, string> = {
      online: '🟢',
      offline: '⚫',
      pending: '🟡',
      rejected: '🔴',
      unknown: '⚪',
    };
    return (icons[status] || '⚪') + ' ' + status;
  }

  private formatAge(dateStr?: string): string {
    if (!dateStr) return 'never';
    const age = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(age / 60000);
    const hours = Math.floor(mins / 60);
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (mins > 0) return `${mins}m ago`;
    return 'just now';
  }

  /**
   * Print node list to console
   */
  async printNodeList(options: NodeListOptions = {}): Promise<void> {
    const reachable = await this.isGatewayReachable();
    if (!reachable) {
      console.log(`\n⚠️  Gateway not reachable at ${this.gatewayUrl}`);
      console.log(`    Start the gateway: openclaw gateway start`);
      console.log(`    Or set: export OPENCLAW_GATEWAY_URL=http://localhost:${DEFAULT_GATEWAY_PORT}`);
      return;
    }

    const nodes = await this.listNodes(options);
    if (nodes.length === 0) {
      console.log(`\n📱 No nodes found.`);
      console.log(`   Connect a companion app to this gateway, then approve it with:`);
      console.log(`   duck nodes approve <node-id>`);
      return;
    }

    console.log(`\n📱 Paired Nodes (${nodes.length}):\n`);
    console.log('  NAME               ID                STATUS    LAST SEEN         VERSION');
    console.log('  ' + '─'.repeat(75));

    for (const node of nodes) {
      const status = this.formatStatus(node.status);
      const name = (node.name || node.id).substring(0, 18).padEnd(19);
      const id = node.id.substring(0, 16).padEnd(18);
      const lastSeen = this.formatAge(node.lastSeen);
      const ver = node.clientVersion || '-';
      console.log(`  ${name} ${id} ${status.padEnd(6)} ${lastSeen.padEnd(16)} ${ver}`);
    }
    console.log();
  }

  /**
   * Print detailed node info
   */
  async printDescribeNode(nodeId: string): Promise<void> {
    const node = await this.describeNode(nodeId);
    if (!node) {
      console.log(`Node not found: ${nodeId}`);
      return;
    }

    console.log(`\n📱 Node Details: ${node.name || node.id}\n`);
    console.log(`  ID:              ${node.id}`);
    if (node.type) console.log(`  Type:            ${node.type}`);
    console.log(`  Status:          ${this.formatStatus(node.status)}`);
    if (node.publicUrl) console.log(`  Public URL:      ${node.publicUrl}`);
    if (node.remoteAddress) console.log(`  Remote Address:  ${node.remoteAddress}`);
    if (node.clientVersion) console.log(`  Client Version:  ${node.clientVersion}`);
    if (node.osInfo) console.log(`  OS Info:         ${node.osInfo}`);
    if (node.capabilities?.length) console.log(`  Capabilities:   ${node.capabilities.join(', ')}`);
    if (node.firstSeen) console.log(`  First Seen:      ${node.firstSeen}`);
    if (node.lastSeen) console.log(`  Last Seen:       ${node.lastSeen}`);
    if (node.pairedAt) console.log(`  Paired At:       ${node.pairedAt}`);
    if (node.pairedBy) console.log(`  Paired By:       ${node.pairedBy}`);
    if (node.expiresAt) console.log(`  Token Expires:   ${node.expiresAt}`);
    console.log();
  }
}

export default NodesClient;
