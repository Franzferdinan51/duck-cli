/**
 * 🦆 Duck Agent - Device Pairing
 * Device pairing management: list/approve/reject/rotate
 * Commands: openclaw devices [list|approve|reject|rotate]
 * Works with OpenClaw Gateway API
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

export interface DeviceInfo {
  id: string;
  name: string;
  type: 'phone' | 'tablet' | 'desktop' | 'laptop' | 'iot' | 'unknown';
  status: 'pending' | 'paired' | 'rejected' | 'expired';
  pairedAt?: string;
  pairedBy?: string;
  expiresAt?: string;
  lastSeen?: string;
  model?: string;
  os?: string;
  osVersion?: string;
  appVersion?: string;
  tokenFingerprint?: string;
  rejectedAt?: string;
  rejectedBy?: string;
  rejectReason?: string;
  publicUrl?: string;
  remoteAddress?: string;
  capabilities?: string[];
}

export interface DeviceListOptions {
  status?: 'pending' | 'paired' | 'rejected' | 'expired' | 'all';
  limit?: number;
  sortBy?: 'name' | 'status' | 'lastSeen' | 'pairedAt';
  sortDir?: 'asc' | 'desc';
  gatewayUrl?: string;
}

export interface DeviceRotateOptions {
  deviceId: string;
  reason?: string;
  notifyDevice?: boolean;
}

export interface DevicePairingOptions {
  gatewayUrl?: string;
  apiKey?: string;
  timeout?: number;
}

const DEFAULT_GATEWAY_PORT = 18789;
const DEFAULT_GATEWAY_URL = `http://localhost:${DEFAULT_GATEWAY_PORT}`;
const DEVICE_STORE_PATH = join(homedir(), '.openclaw', 'devices.json');

/**
 * DevicePairing manages companion device pairing lifecycle through the
 * OpenClaw Gateway API. Devices (phones, tablets, IoT) connect via
 * the companion app and need to be approved before they can access
 * the gateway.
 */
export class DevicePairing {
  private gatewayUrl: string;
  private apiKey?: string;
  private timeout: number;
  private deviceCache: Map<string, DeviceInfo> = new Map();

  constructor(options: DevicePairingOptions = {}) {
    this.gatewayUrl = options.gatewayUrl || process.env.OPENCLAW_GATEWAY_URL || DEFAULT_GATEWAY_URL;
    this.apiKey = options.apiKey || process.env.OPENCLAW_API_KEY;
    this.timeout = options.timeout || 5000;
    this.loadCachedDevices();
  }

  setGatewayUrl(url: string): void {
    this.gatewayUrl = url;
  }

  // ─── Persistence ─────────────────────────────────────────────────────────

  private loadCachedDevices(): void {
    if (existsSync(DEVICE_STORE_PATH)) {
      try {
        const data = JSON.parse(readFileSync(DEVICE_STORE_PATH, 'utf-8'));
        if (Array.isArray(data)) {
          for (const d of data) {
            this.deviceCache.set(d.id, d);
          }
        }
      } catch {}
    }
  }

  private saveCachedDevices(): void {
    try {
      const dir = join(homedir(), '.openclaw');
      if (!existsSync(dir)) {
        execSync(`mkdir -p "${dir}"`);
      }
      const data = Array.from(this.deviceCache.values());
      writeFileSync(DEVICE_STORE_PATH, JSON.stringify(data, null, 2), 'utf-8');
    } catch {}
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

    const curlCmd = [
      'curl', '-s',
      '-X', method,
      '-H', `Content-Type: application/json`,
      '-H', `Accept: application/json`,
      ...(this.apiKey ? ['-H', `Authorization: Bearer ${this.apiKey}`] : []),
      ...(body ? ['-d', JSON.stringify(body)] : []),
      '--connect-timeout', String(Math.floor(this.timeout / 1000)),
      '--max-time', String(Math.floor(this.timeout / 1000)),
      url,
    ];

    try {
      const output = execSync(curlCmd.join(' '), { stdio: 'pipe' });
      return JSON.parse(output.toString());
    } catch (err: any) {
      const exitCode = err.status;
      if (exitCode === 22) throw new Error(`Gateway unreachable at ${this.gatewayUrl}`);
      if (exitCode === 7) throw new Error(`Connection refused by gateway at ${this.gatewayUrl}`);
      if (exitCode === 28) throw new Error(`Gateway timeout after ${this.timeout}ms`);
      throw new Error(`Gateway request failed (${exitCode || 'unknown'})`);
    }
  }

  private async httpRequestRaw(path: string): Promise<string> {
    try {
      const authHeader = this.apiKey ? `-H "Authorization: Bearer ${this.apiKey}" ` : '';
      const output = execSync(
        `curl -s --connect-timeout ${Math.floor(this.timeout / 1000)} --max-time ${Math.floor(this.timeout / 1000)} ${authHeader}"${this.gatewayUrl}${path}"`,
        { stdio: 'pipe' }
      );
      return output.toString();
    } catch {
      return '{}';
    }
  }

  // ─── Gateway Health ──────────────────────────────────────────────────────

  async isGatewayReachable(): Promise<boolean> {
    try {
      await this.httpRequestRaw('/health');
      return true;
    } catch {
      return false;
    }
  }

  // ─── Device Queries ───────────────────────────────────────────────────────

  /**
   * List all devices with optional filtering
   */
  async listDevices(options: DeviceListOptions = {}): Promise<DeviceInfo[]> {
    const { status = 'all', limit = 50, sortBy = 'lastSeen', sortDir = 'desc' } = options;

    try {
      const params = new URLSearchParams({
        status: status === 'all' ? '' : status,
        limit: String(limit),
        sortBy,
        sortDir,
      });
      const data = await this.httpRequest(`/devices?${params.toString()}`);
      const devices: DeviceInfo[] = Array.isArray(data) ? data : (data.devices || []);
      // Update cache
      for (const d of devices) {
        this.deviceCache.set(d.id, d);
      }
      this.saveCachedDevices();
      return devices;
    } catch {
      // Fallback: return cached devices
      let devices = Array.from(this.deviceCache.values());
      if (status !== 'all') {
        devices = devices.filter(d => d.status === status);
      }
      return devices.slice(0, limit);
    }
  }

  /**
   * Get detailed info for a specific device
   */
  async getDevice(deviceId: string): Promise<DeviceInfo | null> {
    try {
      const data = await this.httpRequest(`/devices/${encodeURIComponent(deviceId)}`);
      if (data && data.id) {
        this.deviceCache.set(deviceId, data);
        this.saveCachedDevices();
        return data;
      }
      return null;
    } catch {
      return this.deviceCache.get(deviceId) || null;
    }
  }

  // ─── Pairing Management ──────────────────────────────────────────────────

  /**
   * Approve a pending device
   */
  async approveDevice(deviceId: string, approvedBy?: string): Promise<{ success: boolean; error?: string }> {
    try {
      await this.httpRequest(`/devices/${encodeURIComponent(deviceId)}/approve`, 'POST', {
        approvedBy: approvedBy || 'duck-cli',
        approvedAt: new Date().toISOString(),
      });
      // Update cache
      const cached = this.deviceCache.get(deviceId);
      if (cached) {
        this.deviceCache.set(deviceId, { ...cached, status: 'paired', pairedAt: new Date().toISOString() });
        this.saveCachedDevices();
      }
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Reject a pending or paired device
   */
  async rejectDevice(
    deviceId: string,
    reason?: string,
    rejectedBy = 'duck-cli'
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await this.httpRequest(`/devices/${encodeURIComponent(deviceId)}/reject`, 'POST', {
        rejectedBy,
        rejectedAt: new Date().toISOString(),
        reason: reason || 'Rejected via duck-cli',
      });
      // Update cache
      this.deviceCache.set(deviceId, {
        ...(this.deviceCache.get(deviceId) || { id: deviceId, name: deviceId, type: 'unknown' as const, status: 'rejected' as const }),
        status: 'rejected',
        rejectedAt: new Date().toISOString(),
        rejectedBy,
        rejectReason: reason,
      });
      this.saveCachedDevices();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Rotate device token (disconnect + issue new token)
   */
  async rotateDeviceToken(options: DeviceRotateOptions): Promise<{ success: boolean; newToken?: string; error?: string }> {
    const { deviceId, reason, notifyDevice = true } = options;
    try {
      const result = await this.httpRequest(`/devices/${encodeURIComponent(deviceId)}/rotate`, 'POST', {
        reason: reason || 'Token rotation requested',
        notifyDevice,
        rotatedAt: new Date().toISOString(),
        rotatedBy: 'duck-cli',
      });
      return { success: true, newToken: result.token };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Revoke a device (full disconnect + remove)
   */
  async revokeDevice(deviceId: string, reason?: string): Promise<{ success: boolean; error?: string }> {
    try {
      await this.httpRequest(`/devices/${encodeURIComponent(deviceId)}/revoke`, 'POST', {
        reason: reason || 'Revoked via duck-cli',
        revokedAt: new Date().toISOString(),
      });
      this.deviceCache.delete(deviceId);
      this.saveCachedDevices();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Generate a pairing token for a new device
   */
  async generatePairingToken(label?: string): Promise<{ success: boolean; token?: string; expiresAt?: string; error?: string }> {
    try {
      const result = await this.httpRequest('/devices/pairing-token', 'POST', {
        label: label || `duck-cli-${Date.now()}`,
        expiresIn: 300, // 5 minutes
      });
      return {
        success: true,
        token: result.token,
        expiresAt: result.expiresAt,
      };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  // ─── CLI Output ───────────────────────────────────────────────────────────

  private formatStatus(status: string): string {
    const icons: Record<string, string> = {
      pending: '🟡',
      paired: '🟢',
      rejected: '🔴',
      expired: '⚫',
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

  private deviceTypeIcon(type: string): string {
    const icons: Record<string, string> = {
      phone: '📱', tablet: '📲', desktop: '🖥️', laptop: '💻', iot: '🔌', unknown: '❓',
    };
    return icons[type] || '❓';
  }

  /**
   * Print device list to console
   */
  async printDeviceList(options: DeviceListOptions = {}): Promise<void> {
    const reachable = await this.isGatewayReachable();
    if (!reachable) {
      console.log(`\n⚠️  Gateway not reachable at ${this.gatewayUrl}`);
      console.log(`    Start the gateway: openclaw gateway start`);
      return;
    }

    const devices = await this.listDevices(options);
    if (devices.length === 0) {
      console.log(`\n📱 No devices found.`);
      console.log(`   Generate a pairing QR: duck qr`);
      return;
    }

    console.log(`\n📱 Paired Devices (${devices.length}):\n`);
    console.log('  ' + 'NAME'.padEnd(20) + 'ID'.padEnd(18) + 'TYPE    STATUS    LAST SEEN');
    console.log('  ' + '─'.repeat(70));

    for (const device of devices) {
      const icon = this.deviceTypeIcon(device.type);
      const name = (device.name || device.id).substring(0, 19).padEnd(20);
      const id = device.id.substring(0, 16).padEnd(18);
      const type = (device.type || 'unknown').padEnd(7);
      const status = this.formatStatus(device.status);
      const lastSeen = this.formatAge(device.lastSeen);
      console.log(`  ${icon} ${name} ${id} ${type} ${status.padEnd(9)} ${lastSeen}`);
    }
    console.log();
  }

  /**
   * Print detailed device info
   */
  async printDeviceInfo(deviceId: string): Promise<void> {
    const device = await this.getDevice(deviceId);
    if (!device) {
      console.log(`Device not found: ${deviceId}`);
      return;
    }

    console.log(`\n📱 Device Details: ${device.name || deviceId}\n`);
    console.log(`  ID:              ${device.id}`);
    console.log(`  Type:            ${this.deviceTypeIcon(device.type)} ${device.type}`);
    console.log(`  Status:          ${this.formatStatus(device.status)}`);
    if (device.model) console.log(`  Model:           ${device.model}`);
    if (device.os) console.log(`  OS:              ${device.os}${device.osVersion ? ' ' + device.osVersion : ''}`);
    if (device.appVersion) console.log(`  App Version:     ${device.appVersion}`);
    if (device.publicUrl) console.log(`  Public URL:      ${device.publicUrl}`);
    if (device.remoteAddress) console.log(`  Remote Address:  ${device.remoteAddress}`);
    if (device.capabilities?.length) console.log(`  Capabilities:   ${device.capabilities.join(', ')}`);
    if (device.pairedAt) console.log(`  Paired At:       ${device.pairedAt}`);
    if (device.pairedBy) console.log(`  Paired By:       ${device.pairedBy}`);
    if (device.expiresAt) console.log(`  Token Expires:   ${device.expiresAt}`);
    if (device.lastSeen) console.log(`  Last Seen:       ${device.lastSeen}`);
    if (device.rejectedAt) console.log(`  Rejected At:     ${device.rejectedAt}`);
    if (device.rejectReason) console.log(`  Reject Reason:   ${device.rejectReason}`);
    console.log();
  }
}

export default DevicePairing;
