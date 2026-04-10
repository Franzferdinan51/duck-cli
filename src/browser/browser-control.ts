/**
 * 🦆 Duck CLI - Browser Control Module
 * Browser automation via OpenClaw-compatible browser tool
 */

import { execSync } from 'child_process';

export interface BrowserStatus {
  running: boolean;
  profile: string;
  tabs: TabInfo[];
  activeTab?: string;
}

export interface TabInfo {
  id: string;
  url: string;
  title: string;
  active: boolean;
}

export interface NavigateOptions {
  url: string;
  target?: 'sandbox' | 'host' | 'node';
  profile?: string;
  timeoutMs?: number;
}

export interface ClickOptions {
  ref: string;
  target?: 'sandbox' | 'host' | 'node';
  targetId?: string;
}

export interface TypeOptions {
  text: string;
  target?: 'sandbox' | 'host' | 'node';
  targetId?: string;
}

// Check if BrowserOS MCP is available
function checkBrowserOS(): boolean {
  try {
    execSync('curl -s http://127.0.0.1:9003/health', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get browser status - running state, profile, open tabs
 */
export async function getBrowserStatus(profile = 'user'): Promise<BrowserStatus> {
  const hasBrowserOS = checkBrowserOS();
  
  return {
    running: hasBrowserOS,
    profile,
    tabs: [],
    activeTab: undefined,
  };
}

/**
 * Start browser with optional profile
 */
export async function startBrowser(profile = 'user'): Promise<void> {
  try {
    execSync('open -a BrowserOS', { stdio: 'pipe' });
  } catch (err: any) {
    throw new Error(`Failed to start browser: ${err.message}`);
  }
}

/**
 * Stop browser
 */
export async function stopBrowser(profile = 'user'): Promise<void> {
  try {
    execSync('pkill -f "BrowserOS"', { stdio: 'pipe' });
  } catch (err: any) {
    throw new Error(`Failed to stop browser: ${err.message}`);
  }
}

/**
 * List open browser tabs
 */
export async function listBrowserTabs(profile = 'user'): Promise<TabInfo[]> {
  return [];
}

/**
 * Open a new tab with URL
 */
export async function openBrowserTab(url: string, profile = 'user'): Promise<TabInfo> {
  try {
    execSync(`open "${url}"`, { stdio: 'pipe' });
    return {
      id: String(Date.now()),
      url,
      title: '',
      active: true,
    };
  } catch (err: any) {
    throw new Error(`Failed to open browser tab: ${err.message}`);
  }
}

/**
 * Navigate active tab to URL
 */
export async function navigateBrowser(options: NavigateOptions): Promise<void> {
  const { url } = options;
  await openBrowserTab(url);
}

/**
 * Click element by ref
 */
export async function clickBrowserElement(options: ClickOptions): Promise<void> {
  throw new Error('Browser click requires BrowserOS MCP. Use: mcporter call browseros.click');
}

/**
 * Type text into focused element
 */
export async function typeBrowserText(options: TypeOptions): Promise<void> {
  throw new Error('Browser type requires BrowserOS MCP. Use: mcporter call browseros.type');
}

/**
 * Take browser screenshot
 */
export async function browserScreenshot(options: {
  fullPage?: boolean;
  type?: 'png' | 'jpeg';
  target?: 'sandbox' | 'host' | 'node';
  targetId?: string;
  profile?: string;
} = {}): Promise<string> {
  throw new Error('Browser screenshot requires BrowserOS MCP. Use: mcporter call browseros.take_screenshot');
}

/**
 * Get page snapshot (accessibility tree)
 */
export async function getBrowserSnapshot(options: {
  target?: 'sandbox' | 'host' | 'node';
  targetId?: string;
  profile?: string;
  refs?: 'role' | 'aria';
} = {}): Promise<any> {
  throw new Error('Browser snapshot requires BrowserOS MCP. Use: mcporter call browseros.take_snapshot');
}

/**
 * Close a browser tab
 */
export async function closeBrowserTab(tabId: string, profile = 'user'): Promise<void> {
  throw new Error('Browser tab close requires BrowserOS MCP.');
}

/**
 * Navigate browser back/forward/reload
 */
export async function browserNavigateAction(action: 'back' | 'forward' | 'reload', profile = 'user'): Promise<void> {
  throw new Error('Browser navigation requires BrowserOS MCP.');
}

export default {
  getBrowserStatus,
  startBrowser,
  stopBrowser,
  listBrowserTabs,
  openBrowserTab,
  navigateBrowser,
  clickBrowserElement,
  typeBrowserText,
  browserScreenshot,
  getBrowserSnapshot,
  closeBrowserTab,
  browserNavigateAction,
};
