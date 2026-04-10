/**
 * 🦆 Duck CLI - Screenshot Module
 * Screenshot and snapshot capabilities via BrowserOS MCP
 */

import { writeFileSync } from 'fs';
import { execSync } from 'child_process';

const BROWSEROS_MCP_URL = process.env.BROWSEROS_MCP_URL || 'http://127.0.0.1:9200/mcp';

export interface ScreenshotOptions {
  path?: string;
  fullPage?: boolean;
  type?: 'png' | 'jpeg';
  width?: number;
  height?: number;
  quality?: number;
  target?: 'sandbox' | 'host' | 'node';
  targetId?: string;
  profile?: string;
}

export interface SnapshotOptions {
  path?: string;
  format?: 'aria' | 'ai' | 'role';
  compact?: boolean;
  target?: 'sandbox' | 'host' | 'node';
  targetId?: string;
  profile?: string;
}

function mcpCall(tool: string, args: Record<string, any> = {}): any {
  const body = JSON.stringify({ tool, args });
  const result = execSync(
    `curl -s -X POST ${BROWSEROS_MCP_URL} -H "Content-Type: application/json" -d '${body.replace(/'/g, "'\"'\"'")}'`,
    { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'], timeout: 30000 }
  );
  return JSON.parse(result.trim() || '{}');
}

/**
 * Take a screenshot and optionally save to file
 * Requires BrowserOS MCP running on port 9200
 */
export async function takeScreenshot(options: ScreenshotOptions = {}): Promise<{ data: string; path?: string }> {
  const { path, fullPage = false, type = 'png' } = options;

  try {
    const resp = mcpCall('browseros.take_screenshot');
    if (resp.error) throw new Error(typeof resp.error === 'string' ? resp.error : JSON.stringify(resp.error));
    const data = resp.result?.data || resp.data || JSON.stringify(resp);

    if (path && data && typeof data === 'string') {
      writeFileSync(path, data);
      return { data, path };
    }

    return { data };
  } catch (err: any) {
    throw new Error(`Screenshot failed: ${err.message}. Ensure BrowserOS MCP is running on ${BROWSEROS_MCP_URL}.`);
  }
}

/**
 * Get accessibility snapshot of the page
 */
export async function takeSnapshot(options: SnapshotOptions = {}): Promise<{ data: any; path?: string }> {
  const { path, format = 'role' } = options;

  try {
    const resp = mcpCall('browseros.take_snapshot');
    if (resp.error) throw new Error(typeof resp.error === 'string' ? resp.error : JSON.stringify(resp.error));
    const data = resp.result || resp.data || resp;

    if (path) {
      writeFileSync(path, JSON.stringify(data, null, 2));
      return { data, path };
    }

    return { data };
  } catch (err: any) {
    throw new Error(`Snapshot failed: ${err.message}. Ensure BrowserOS MCP is running on ${BROWSEROS_MCP_URL}.`);
  }
}

/**
 * Take screenshot of specific element by ref
 */
export async function screenshotElement(ref: string, options: ScreenshotOptions = {}): Promise<{ data: string; path?: string }> {
  return takeScreenshot({
    ...options,
    targetId: ref,
  });
}
