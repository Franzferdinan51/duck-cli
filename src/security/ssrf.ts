/**
 * 🦆 Duck Agent - SSRF Validation
 * Protects against Server-Side Request Forgery attacks
 * Based on NVIDIA NemoClaw security model
 */

import { promises as dnsPromises } from 'node:dns';
import { isIPv4, isIPv6 } from 'node:net';

interface CidrRange {
  network: Uint8Array;
  prefixLen: number;
}

// Private network ranges to block
const PRIVATE_NETWORKS: CidrRange[] = [
  cidr('127.0.0.0', 8),
  cidr('10.0.0.0', 8),
  cidr('172.16.0.0', 12),
  cidr('192.168.0.0', 16),
  cidr('169.254.0.0', 16),    // Link-local
  cidr6('::1', 128),          // IPv6 loopback
  cidr6('fd00::', 8),          // IPv6 unique local
  cidr6('fe80::', 10),         // IPv6 link-local
];

const ALLOWED_SCHEMES = new Set(['https:', 'http:']);
const BLOCKED_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '0.0.0.0']);

function parseIPv4(addr: string): Uint8Array {
  const parts = addr.split('.').map(Number);
  return new Uint8Array(parts);
}

function parseIPv6(addr: string): Uint8Array {
  // Handle IPv4-mapped notation (::ffff:127.0.0.1)
  const lastColon = addr.lastIndexOf(':');
  const tail = addr.slice(lastColon + 1);
  if (tail.includes('.')) {
    const ipv4Parts = tail.split('.').map(Number);
    const hi = ((ipv4Parts[0] << 8) | ipv4Parts[1]).toString(16);
    const lo = ((ipv4Parts[2] << 8) | ipv4Parts[3]).toString(16);
    return parseIPv6(addr.slice(0, lastColon + 1) + hi + ':' + lo);
  }

  let groups: string[];
  if (addr.includes('::')) {
    const [left, right] = addr.split('::');
    const leftGroups = left ? left.split(':') : [];
    const rightGroups = right ? right.split(':') : [];
    const missing = 8 - leftGroups.length - rightGroups.length;
    groups = [...leftGroups, ...Array(missing).fill('0'), ...rightGroups];
  } else {
    groups = addr.split(':');
  }

  const bytes = new Uint8Array(16);
  for (let i = 0; i < 8; i++) {
    const val = parseInt(groups[i], 16);
    bytes[i * 2] = (val >> 8) & 0xff;
    bytes[i * 2 + 1] = val & 0xff;
  }
  return bytes;
}

function cidr(addr: string, prefixLen: number): CidrRange {
  return { network: parseIPv4(addr), prefixLen };
}

function cidr6(addr: string, prefixLen: number): CidrRange {
  return { network: parseIPv6(addr), prefixLen };
}

function ipInCidr(ipBytes: Uint8Array, range: CidrRange): boolean {
  if (ipBytes.length !== range.network.length) return false;

  const fullBytes = Math.floor(range.prefixLen / 8);
  const remainingBits = range.prefixLen % 8;

  for (let i = 0; i < fullBytes; i++) {
    if (ipBytes[i] !== range.network[i]) return false;
  }

  if (remainingBits > 0) {
    const mask = 0xff << (8 - remainingBits);
    if ((ipBytes[fullBytes] & mask) !== (range.network[fullBytes] & mask)) return false;
  }

  return true;
}

function isPrivateIP(addr: string): boolean {
  // Check direct matches first
  if (BLOCKED_HOSTS.has(addr.toLowerCase())) return true;
  
  try {
    // IPv4
    if (isIPv4(addr)) {
      const bytes = parseIPv4(addr);
      for (const range of PRIVATE_NETWORKS) {
        if (ipInCidr(bytes, range)) return true;
      }
    }
    // IPv6
    if (isIPv6(addr)) {
      const bytes = parseIPv6(addr);
      for (const range of PRIVATE_NETWORKS) {
        if (ipInCidr(bytes, range)) return true;
      }
    }
  } catch {
    return true; // Fail safe - block unknown
  }
  
  return false;
}

export interface SSRFResult {
  allowed: boolean;
  reason?: string;
  resolvedIP?: string;
}

export async function validateURL(url: string): Promise<SSRFResult> {
  // Parse URL
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { allowed: false, reason: 'Invalid URL format' };
  }

  // Check scheme
  if (!ALLOWED_SCHEMES.has(parsed.protocol)) {
    return { allowed: false, reason: `Blocked scheme: ${parsed.protocol}` };
  }

  // Check for credentials in URL
  if (parsed.username || parsed.password) {
    return { allowed: false, reason: 'Credentials in URL not allowed' };
  }

  // Check host
  const host = parsed.hostname.toLowerCase();
  if (BLOCKED_HOSTS.has(host)) {
    return { allowed: false, reason: `Blocked host: ${host}` };
  }

  // Resolve DNS and check if private
  try {
    const addresses = await dnsPromises.lookup(host);
    const resolvedIP = addresses.address;
    
    if (isPrivateIP(resolvedIP)) {
      return { 
        allowed: false, 
        reason: `Resolved to private IP: ${resolvedIP}`,
        resolvedIP 
      };
    }
    
    return { allowed: true, resolvedIP };
  } catch {
    return { allowed: false, reason: `DNS lookup failed for: ${host}` };
  }
}

export async function validateURLBatch(urls: string[]): Promise<Map<string, SSRFResult>> {
  const results = new Map<string, SSRFResult>();
  await Promise.all(
    urls.map(async (url) => {
      results.set(url, await validateURL(url));
    })
  );
  return results;
}

export default { validateURL, validateURLBatch };
