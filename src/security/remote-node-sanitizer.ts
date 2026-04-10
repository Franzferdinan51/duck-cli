/**
 * 🦆 Duck Agent - Remote Node Sanitizer
 * Prevents injection attacks when controlling remote nodes (Termux/Android)
 * Based on OpenClaw v2026.4.9 security fix
 * 
 * Key threats prevented:
 * - System: command injection via malformed node messages
 * - CRLF injection in command/output strings
 * - Credential exfiltration via crafted output
 * - Path traversal in command arguments
 */

import { sanitize, sanitizeObject } from './credential-sanitizer.js';

// Patterns that indicate potential injection attempts
const INJECTION_PATTERNS = {
  // System: prefix (OpenClaw command injection)
  SYSTEM_PREFIX: /^System:\s*/i,
  
  // Newlines/CRLF in what should be single-line fields
  CRLF: /[\r\n]/g,
  
  // Multiple newlines (message formatting abuse)
  MULTILINE_ABUSE: /\n{3,}/g,
  
  // Potential command separators that could break out of intended command
  COMMAND_SEPARATORS: /[;&|`$]/g,
  
  // Variable expansion in commands
  VARIABLE_EXPAND: /\$\(|\$\{|\$[a-zA-Z_]/g,
  
  // Path traversal attempts
  PATH_TRAVERSAL: /\.\.\//g,
  
  // Null bytes
  NULL_BYTE: /\x00/g,
  
  // Unicode confusables (homoglyphs for ASCII chars)
  UNICODE_CONFUSABLES: /[\u200B-\u200F\u2028-\u202F\uFEFF]/g,
  
  // ANSI escape codes (terminal formatting injection)
  ANSI_ESCAPE: /\x1b\[[0-9;]*[a-zA-Z]/g,
  
  // Remote host manipulation via @ in what looks like email but is user@host
  SSH_HOST_INJECTION: /@[a-zA-Z0-9.-]+\//g,
};

// Dangerous patterns that should NEVER appear in commands
const BLOCKED_PATTERNS = [
  { pattern: /^System:\s*/i, reason: 'OpenClaw command injection prefix' },
  { pattern: /\\x00/, reason: 'Null byte injection' },
  { pattern: /\x1b\[0m\x1b\[31m.*System:/i, reason: 'ANSI-colored System: injection' },
];

export interface SanitizationResult {
  sanitized: string;
  wasModified: boolean;
  threatDetected: boolean;
  threats: string[];
}

/**
 * Sanitize a command string for safe execution on remote node
 */
export function sanitizeCommand(command: string): SanitizationResult {
  const threats: string[] = [];
  let sanitized = command;
  let wasModified = false;
  
  // Check for blocked patterns first
  for (const { pattern, reason } of BLOCKED_PATTERNS) {
    if (pattern.test(sanitized)) {
      threats.push(reason);
    }
  }
  
  // Remove System: prefix if present (injection attempt)
  if (INJECTION_PATTERNS.SYSTEM_PREFIX.test(sanitized)) {
    sanitized = sanitized.replace(INJECTION_PATTERNS.SYSTEM_PREFIX, '');
    wasModified = true;
  }
  
  // Remove newlines to prevent CRLF injection
  if (INJECTION_PATTERNS.CRLF.test(sanitized)) {
    sanitized = sanitized.replace(INJECTION_PATTERNS.CRLF, '');
    wasModified = true;
  }
  
  // Remove excessive newlines (message abuse)
  if (INJECTION_PATTERNS.MULTILINE_ABUSE.test(sanitized)) {
    sanitized = sanitized.replace(INJECTION_PATTERNS.MULTILINE_ABUSE, '\n\n');
    wasModified = true;
  }
  
  // Remove command separators that could chain commands
  if (INJECTION_PATTERNS.COMMAND_SEPARATORS.test(sanitized)) {
    sanitized = sanitized.replace(INJECTION_PATTERNS.COMMAND_SEPARATORS, '');
    wasModified = true;
  }
  
  // Remove variable expansion attempts
  if (INJECTION_PATTERNS.VARIABLE_EXPAND.test(sanitized)) {
    sanitized = sanitized.replace(INJECTION_PATTERNS.VARIABLE_EXPAND, '');
    wasModified = true;
  }
  
  // Remove path traversal attempts
  if (INJECTION_PATTERNS.PATH_TRAVERSAL.test(sanitized)) {
    sanitized = sanitized.replace(INJECTION_PATTERNS.PATH_TRAVERSAL, '');
    wasModified = true;
  }
  
  // Remove null bytes
  if (INJECTION_PATTERNS.NULL_BYTE.test(sanitized)) {
    sanitized = sanitized.replace(INJECTION_PATTERNS.NULL_BYTE, '');
    wasModified = true;
  }
  
  // Remove unicode confusables
  if (INJECTION_PATTERNS.UNICODE_CONFUSABLES.test(sanitized)) {
    sanitized = sanitized.replace(INJECTION_PATTERNS.UNICODE_CONFUSABLES, '');
    wasModified = true;
  }
  
  // Remove ANSI escape codes
  if (INJECTION_PATTERNS.ANSI_ESCAPE.test(sanitized)) {
    sanitized = sanitized.replace(INJECTION_PATTERNS.ANSI_ESCAPE, '');
    wasModified = true;
  }
  
  // Trim whitespace
  const trimmed = sanitized.trim();
  if (trimmed !== sanitized) {
    sanitized = trimmed;
    wasModified = true;
  }
  
  return {
    sanitized,
    wasModified,
    threatDetected: threats.length > 0,
    threats
  };
}

/**
 * Sanitize output before sending to remote node
 */
export function sanitizeOutput(output: string): SanitizationResult {
  const threats: string[] = [];
  let sanitized = output;
  
  // Remove ANSI escape codes from output
  if (INJECTION_PATTERNS.ANSI_ESCAPE.test(sanitized)) {
    sanitized = sanitized.replace(INJECTION_PATTERNS.ANSI_ESCAPE, '');
  }
  
  // Remove excessive newlines
  if (INJECTION_PATTERNS.MULTILINE_ABUSE.test(sanitized)) {
    sanitized = sanitized.replace(INJECTION_PATTERNS.MULTILINE_ABUSE, '\n\n');
  }
  
  // Remove null bytes
  if (INJECTION_PATTERNS.NULL_BYTE.test(sanitized)) {
    sanitized = sanitized.replace(INJECTION_PATTERNS.NULL_BYTE, '');
  }
  
  // Also run credential sanitization on output
  sanitized = sanitize(sanitized);
  
  return {
    sanitized,
    wasModified: sanitized !== output,
    threatDetected: threats.length > 0,
    threats
  };
}

/**
 * Sanitize reason/description text
 */
export function sanitizeReason(reason: string): SanitizationResult {
  const threats: string[] = [];
  let sanitized = reason;
  
  // Remove newlines in reason fields
  if (INJECTION_PATTERNS.CRLF.test(sanitized)) {
    sanitized = sanitized.replace(INJECTION_PATTERNS.CRLF, ' ');
  }
  
  // Remove excessive whitespace
  if (INJECTION_PATTERNS.MULTILINE_ABUSE.test(sanitized)) {
    sanitized = sanitized.replace(INJECTION_PATTERNS.MULTILINE_ABUSE, ' ');
  }
  
  // Remove ANSI codes
  if (INJECTION_PATTERNS.ANSI_ESCAPE.test(sanitized)) {
    sanitized = sanitized.replace(INJECTION_PATTERNS.ANSI_ESCAPE, '');
  }
  
  // Remove unicode confusables
  if (INJECTION_PATTERNS.UNICODE_CONFUSABLES.test(sanitized)) {
    sanitized = sanitized.replace(INJECTION_PATTERNS.UNICODE_CONFUSABLES, '');
  }
  
  // Trim
  sanitized = sanitized.trim().replace(/\s+/g, ' ');
  
  return {
    sanitized,
    wasModified: sanitized !== reason,
    threatDetected: threats.length > 0,
    threats
  };
}

/**
 * Sanitize a full node message before enqueueing/processing
 */
export interface NodeMessage {
  type?: string;
  command?: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  stdout?: string;
  stderr?: string;
  reason?: string;
  [key: string]: any;
}

export function sanitizeNodeMessage(msg: NodeMessage): { sanitized: NodeMessage; threats: string[] } {
  const allThreats: string[] = [];
  const sanitized: NodeMessage = {};
  
  for (const [key, value] of Object.entries(msg)) {
    if (typeof value === 'string') {
      let result;
      
      if (key === 'command' || key === 'cwd') {
        // Commands and paths need strict sanitization
        result = sanitizeCommand(value);
      } else if (key === 'stdout' || key === 'stderr' || key === 'output') {
        // Output fields
        result = sanitizeOutput(value);
      } else if (key === 'reason' || key === 'description') {
        // Reason/description fields
        result = sanitizeReason(value);
      } else {
        // Default: basic sanitization for any string field
        result = sanitizeCommand(value);
      }
      
      sanitized[key] = result.sanitized;
      if (result.wasModified) allThreats.push(...result.threats);
      if (result.threatDetected) allThreats.push(...result.threats);
    } else if (Array.isArray(value)) {
      // Sanitize array elements (e.g., args)
      sanitized[key] = value.map(item => {
        if (typeof item === 'string') {
          return sanitizeCommand(item).sanitized;
        }
        return item;
      });
    } else if (value && typeof value === 'object') {
      // Recursively sanitize nested objects
      const nested = sanitizeNodeMessage(value);
      sanitized[key] = nested.sanitized;
      allThreats.push(...nested.threats);
    } else {
      // Primitive or other types pass through
      sanitized[key] = value;
    }
  }
  
  return { sanitized, threats: [...new Set(allThreats)] };
}

/**
 * Log sanitization events for security auditing
 */
export interface SanitizationLogEntry {
  timestamp: number;
  nodeId: string;
  field: string;
  originalLength: number;
  sanitizedLength: number;
  threats: string[];
}

const sanitizationLog: SanitizationLogEntry[] = [];

export function logSanitization(entry: Omit<SanitizationLogEntry, 'timestamp'>): void {
  sanitizationLog.push({
    timestamp: Date.now(),
    ...entry
  });
  
  // Keep log size bounded
  if (sanitizationLog.length > 1000) {
    sanitizationLog.shift();
  }
  
  // Log to console for immediate visibility
  if (entry.threats.length > 0) {
    console.warn(`[RemoteNodeSanitizer] 🚨 ${entry.threats.length} threat(s) detected for node ${entry.nodeId} field "${entry.field}"`);
  }
}

/**
 * Get sanitization statistics
 */
export function getSanitizationStats(): {
  totalEvents: number;
  threatsDetected: number;
  recentThreats: SanitizationLogEntry[];
} {
  return {
    totalEvents: sanitizationLog.length,
    threatsDetected: sanitizationLog.filter(e => e.threats.length > 0).length,
    recentThreats: sanitizationLog.slice(-10)
  };
}

/**
 * Create a sanitized wrapper for WebSocket message sending
 * Use this when sending messages TO remote nodes
 */
export function sanitizeForRemoteNode(data: any): string {
  const result = sanitizeNodeMessage(data);
  
  if (result.threats.length > 0) {
    logSanitization({
      nodeId: 'outgoing',
      field: 'message',
      originalLength: JSON.stringify(data).length,
      sanitizedLength: JSON.stringify(result.sanitized).length,
      threats: result.threats
    });
  }
  
  return JSON.stringify(result.sanitized);
}

/**
 * Sanitize incoming message from remote node before processing
 * Use this when receiving messages FROM remote nodes
 */
export function sanitizeIncomingNodeMessage<T>(data: T): T {
  if (typeof data !== 'object' || data === null) {
    return data;
  }
  
  const result = sanitizeNodeMessage(data as NodeMessage);
  
  if (result.threats.length > 0) {
    logSanitization({
      nodeId: 'incoming',
      field: 'message',
      originalLength: JSON.stringify(data).length,
      sanitizedLength: JSON.stringify(result.sanitized).length,
      threats: result.threats
    });
  }
  
  return result.sanitized as T;
}

export default {
  sanitizeCommand,
  sanitizeOutput,
  sanitizeReason,
  sanitizeNodeMessage,
  sanitizeForRemoteNode,
  sanitizeIncomingNodeMessage,
  logSanitization,
  getSanitizationStats
};