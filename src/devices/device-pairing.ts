/**
 * 🦆 Duck Agent - Device Pairing
 * Device approval/rejection/rotation for OpenClaw Gateway
 * Commands: openclaw devices list/approve/reject/rotate
 */

import { execSync } from 'child_process';

export interface DeviceInfo {
  id: string;
  name: string;
  type: 'android' | 'ios' | 'macos' | 'windows' | 'linux' | 'unknown';
  status: 'pending' | 'approved' | 'rejected' | 'revoked';
  pairedAt?: string;
  lastSeen?: string;
  publicKey?: string;
  fingerprint?: string;
}

export interface DevicePairingOptions {
  gatewayUrl?: string;
  apiKey?: string;
  timeout?: number;
}

const DEFAULT_GATEWAY_PORT = 18789;
const DEFAULT_GATEWAY_URL = `http://localhost:${DEFAULT_GATEWAY_PORT}`;

/**
 * DevicePairing manages device pairing with the OpenClaw Gateway.
 * Handles approval, rejection, and token rotation.
 */
export class DevicePairing {
  private gatewayUrl: string;
  private apiKey?: string;
  private timeout: number;

  constructor(options: DevicePairingOptions = {}) {
    this.gatewayUrl = options.gatewayUrl || process.env.OPENCLAW_GATEWAY_URL || DEFAULT_GATEWAY_URL;
    this.apiKey = options.apiKey || process.env.OPENCLAW_API_KEY;
    this.timeout = options.timeout || 5000;
  }

  // ─── HTTP Helpers ─────────────────────────────────────────────────────────

  private async httpRequest(path: string, method = 'GET', body?: any): Promise<any> {
    const url = `${this.gatewayUrl}${path}`;
    
    try {
      const curlCmd = [
        'curl',
        '-s',
        '-X', method,
        '-H', 'Content-Type: application/json',
        '-H', 'Accept: application/json',
        ...(this.apiKey ? ['-H', `Authorization: Bearer ${this.apiKey}`] : []),
        ...(body ? ['-d', JSON.stringify(body)] : []),
        '--connect-timeout', String(Math.floor(this.timeout / 1000)),
        '--max-time', String(Math.floor(this.timeout / 1000)),
        url,
      ];
      const output = execSync(curlCmd.join(' '), { stdio: 'pipe' });
      return JSON.parse(output.toString());
    } catch (err: any) {
      throw new Error(`Gateway request failed: ${err.message}`);
    }
  }

  // ─── Device Queries ───────────────────────────────────────────────────────

  /**
   * List all paired devices
   */
  async listDevices(): Promise<DeviceInfo[]> {
    try {
      const data = await this.httpRequest('/devices');
      return Array.isArray(data) ? data : (data.devices || []);
    } catch {
      return [];
    }
  }

  /**
   * Get device details
   */
  async getDevice(deviceId: string): Promise<DeviceInfo | null> {
    try {
      return await this.httpRequest(`/devices/${encodeURIComponent(deviceId)}`);
    } catch {
      return null;
    }
  }

  // ─── Device Management ────────────────────────────────────────────────────

  /**
   * Approve a pending device
   */
  async approveDevice(deviceId: string, approvedBy?: string): Promise<boolean> {
    try {
      await this.httpRequest(`/devices/${encodeURIComponent(deviceId)}/approve`, 'POST', {
        approvedBy: approvedBy || 'duck-cli',
        approvedAt: new Date().toISOString(),
      });
      return true;
    } catch (err: any) {
      console.error(`Failed to approve device ${deviceId}: ${err.message}`);
      return false;
    }
  }

  /**
   * Reject a pending device
   */
  async rejectDevice(deviceId: string, reason?: string): Promise<boolean> {
    try {
      await this.httpRequest(`/devices/${encodeURIComponent(deviceId)}/reject`, 'POST', {
        rejectedBy: 'duck-cli',
        rejectedAt: new Date().toISOString(),
        reason: reason || 'Rejected via duck-cli',
      });
      return true;
    } catch (err: any) {
      console.error(`Failed to reject device ${deviceId}: ${err.message}`);
      return false;
    }
  }

  /**
   * Revoke an approved device
   */
  async revokeDevice(deviceId: string, reason?: string): Promise<boolean> {
    try {
      await this.httpRequest(`/devices/${encodeURIComponent(deviceId)}/revoke`, 'POST', {
        revokedBy: 'duck-cli',
        revokedAt: new Date().toISOString(),
        reason: reason || 'Revoked via duck-cli',
      });
      return true;
    } catch (err: any) {
      console.error(`Failed to revoke device ${deviceId}: ${err.message}`);
      return false;
    }
  }

  /**
   * Rotate device token
   */
  async rotateToken(deviceId: string): Promise<string | null> {
    try {
      const result = await this.httpRequest(`/devices/${encodeURIComponent(deviceId)}/rotate`, 'POST');
      return result.token || null;
    } catch (err: any) {
      console.error(`Failed to rotate token for ${deviceId}: ${err.message}`);
      return null;
    }
  }

  // ─── CLI Output ───────────────────────────────────────────────────────────

  private formatStatus(status: string): string {
    const icons: Record<string, string> = {
      approved: '🟢',
      pending: '🟡',
      rejected: '🔴',
      revoked: '⚫',
    };
    return (icons[status] || '⚪') + ' ' + status;
  }

  /**
   * Print device list
   */
  async printDeviceList(): Promise<void> {
    const devices = await this.listDevices();
    if (devices.length === 0) {
      console.log('\n📱 No devices found.');
      console.log('   Connect a companion app to pair a device.');
      return;
    }

    console.log(`\n📱 Paired Devices (${devices.length}):\n`);
    console.log('  NAME               ID                STATUS      LAST SEEN');
    console.log('  ' + '─'.repeat(70));

    for (const device of devices) {
      const status = this.formatStatus(device.status);
      const name = (device.name || 'Unknown').substring(0, 18).padEnd(19);
      const id = device.id.substring(0, 16).padEnd(18);
      const lastSeen = device.lastSeen 
        ? new Date(device.lastSeen).toLocaleDateString()
        : 'never';
      console.log(`  ${name} ${id} ${status.padEnd(6)} ${lastSeen}`);
    }
    console.log();
  }

  /**
   * Print device details
   */
  async printDeviceDetails(deviceId: string): Promise<void> {
    const device = await this.getDevice(deviceId);
    if (!device) {
      console.log(`Device not found: ${deviceId}`);
      return;
    }

    console.log(`\n📱 Device Details: ${device.name || device.id}\n`);
    console.log(`  ID:         ${device.id}`);
    console.log(`  Name:       ${device.name || 'Unknown'}`);
    console.log(`  Type:       ${device.type || 'unknown'}`);
    console.log(`  Status:     ${this.formatStatus(device.status)}`);
    if (device.pairedAt) console.log(`  Paired:     ${new Date(device.pairedAt).toLocaleString()}`);
    if (device.lastSeen) console.log(`  Last Seen:  ${new Date(device.lastSeen).toLocaleString()}`);
    if (device.fingerprint) console.log(`  Fingerprint: ${device.fingerprint}`);
    console.log();
  }
}

export default DevicePairing;
