/**
 * 🦆 Duck CLI - Screenshot Module
 * Screenshot and snapshot capabilities via BrowserOS MCP
 */

import { writeFileSync } from 'fs';
import { execSync } from 'child_process';

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

/**
 * Take a screenshot and optionally save to file
 * Requires BrowserOS MCP running on port 9002
 */
export async function takeScreenshot(options: ScreenshotOptions = {}): Promise<{ data: string; path?: string }> {
  const { path, fullPage = false, type = 'png' } = options;

  try {
    // Use BrowserOS MCP via mcporter
    const result = execSync(
      'mcporter call browseros.take_screenshot 2>/dev/null || echo "{\"error\": \"BrowserOS not available\"}"',
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }
    );
    
    const data = result.trim();

    if (path && data && !data.includes('error')) {
      writeFileSync(path, data);
      return { data, path };
    }

    return { data };
  } catch (err: any) {
    throw new Error(`Screenshot failed: ${err.message}. Ensure BrowserOS MCP is running on port 9002.`);
  }
}

/**
 * Get accessibility snapshot of the page
 */
export async function takeSnapshot(options: SnapshotOptions = {}): Promise<{ data: any; path?: string }> {
  const { path, format = 'role' } = options;

  try {
    const result = execSync(
      'mcporter call browseros.take_snapshot 2>/dev/null || echo "{\"error\": \"BrowserOS not available\"}"',
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }
    );
    
    const data = JSON.parse(result);
    
    if (path) {
      writeFileSync(path, JSON.stringify(data, null, 2));
      return { data, path };
    }

    return { data };
  } catch (err: any) {
    throw new Error(`Snapshot failed: ${err.message}. Ensure BrowserOS MCP is running on port 9002.`);
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

/**
 * Take full-page screenshot
 */
export async function takeFullPageScreenshot(options: ScreenshotOptions = {}): Promise<{ data: string; path?: string }> {
  return takeScreenshot({ ...options, fullPage: true });
}

/**
 * Save screenshot data to a file
 */
export async function saveScreenshot(data: string, outputPath: string): Promise<string> {
  try {
    writeFileSync(outputPath, data);
    return outputPath;
  } catch (err: any) {
    throw new Error(`Failed to save screenshot: ${err.message}`);
  }
}

/**
 * Get console logs from browser
 */
export async function getBrowserConsole(options: {
  target?: 'sandbox' | 'host' | 'node';
  targetId?: string;
  profile?: string;
  level?: 'all' | 'warning' | 'error';
} = {}): Promise<{ logs: any[] }> {
  try {
    const result = execSync(
      'mcporter call browseros.get_console_logs 2>/dev/null || echo "[]"',
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }
    );
    
    return { logs: JSON.parse(result) };
  } catch (err: any) {
    return { logs: [] };
  }
}

export default {
  takeScreenshot,
  takeSnapshot,
  screenshotElement,
  takeFullPageScreenshot,
  saveScreenshot,
  getBrowserConsole,
};
