/**
 * 🦆 Duck Agent - BrowserOS Native CDP Tools
 * Native Duck CLI tools backed by BrowserOS MCP server
 */

import { BrowserOSIntegration, type BrowserOSPage } from '../integrations/browseros.js';

export interface BrowserOSNativeConfig {
  host?: string;
  port?: number;
}

export interface PageInfo {
  id: string;
  url: string;
  title: string;
  active: boolean;
}

export class BrowserOSNativeTools {
  private browserOS: BrowserOSIntegration;
  private connected = false;

  constructor(config: BrowserOSNativeConfig = {}) {
    this.browserOS = new BrowserOSIntegration({
      host: config.host ?? '127.0.0.1',
      port: config.port ?? 9100,
    });
  }

  /** Check if BrowserOS is available */
  async isAvailable(): Promise<boolean> {
    return this.browserOS.isRunning();
  }

  /** List all open tabs */
  async listTabs(): Promise<PageInfo[]> {
    const pages = await this.browserOS.listPages();
    return pages.map(p => ({ id: p.id, url: p.url, title: p.title, active: p.active }));
  }

  /** Open a new tab */
  async newPage(url: string): Promise<PageInfo> {
    const result = await this.browserOS.newPage(url);
    return result.page;
  }

  /** Navigate active tab to URL */
  async navigate(url: string): Promise<boolean> {
    const result = await this.browserOS.navigate(url);
    return result.success;
  }

  /** Click element by ref */
  async click(ref: string): Promise<void> {
    return this.browserOS.click(ref);
  }

  /** Type text into element */
  async type(text: string): Promise<void> {
    return this.browserOS.type(text);
  }

  /** Take screenshot */
  async screenshot(): Promise<string> {
    const result = await this.browserOS.takeScreenshot();
    return result.screenshot; // base64 PNG
  }

  /** Get page text content */
  async getContent(): Promise<string> {
    const result = await this.browserOS.getPageContent();
    return result.content;
  }

  /** Get accessibility snapshot */
  async getSnapshot(): Promise<string> {
    const result = await this.browserOS.takeSnapshot();
    return JSON.stringify(result.snapshot);
  }

  /** Close a tab */
  async closeTab(tabId: string): Promise<void> {
    return this.browserOS.closePage(tabId);
  }

  /** Evaluate JS on page */
  async evaluate(script: string): Promise<any> {
    const result = await this.browserOS.evaluateScript(script);
    return result.result;
  }

  /** Navigate helpers */
  async goBack(): Promise<void> { return this.browserOS.pressKey('Backspace'); }
  async goForward(): Promise<void> { return this.browserOS.pressKey('Alt-Right'); }
  async reload(): Promise<void> { return this.browserOS.pressKey('F5'); }
  async scrollDown(n = 3): Promise<void> { for (let i = 0; i < n; i++) await this.browserOS.scroll('down'); }
  async scrollUp(n = 3): Promise<void> { for (let i = 0; i < n; i++) await this.browserOS.scroll('up'); }
}

// Tool definitions for MCP registry
export const BROWSEROS_TOOLS = {
  browser_tabs_list: {
    name: 'browser_tabs_list',
    description: 'List all open browser tabs in BrowserOS',
    parameters: {},
  },
  browser_new_tab: {
    name: 'browser_new_tab',
    description: 'Open a new browser tab',
    parameters: { url: 'string' },
  },
  browser_navigate: {
    name: 'browser_navigate',
    description: 'Navigate browser to URL',
    parameters: { url: 'string' },
  },
  browser_click: {
    name: 'browser_click',
    description: 'Click element by ref (e.g., e5)',
    parameters: { ref: 'string' },
  },
  browser_type: {
    name: 'browser_type',
    description: 'Type text into element',
    parameters: { text: 'string' },
  },
  browser_screenshot: {
    name: 'browser_screenshot',
    description: 'Take screenshot of current page',
    parameters: {},
  },
  browser_content: {
    name: 'browser_content',
    description: 'Get page text content',
    parameters: {},
  },
  browser_snapshot: {
    name: 'browser_snapshot',
    description: 'Get accessibility tree snapshot',
    parameters: {},
  },
  browser_close_tab: {
    name: 'browser_close_tab',
    description: 'Close a browser tab',
    parameters: { tabId: 'string' },
  },
  browser_evaluate: {
    name: 'browser_evaluate',
    description: 'Run JavaScript on page',
    parameters: { script: 'string' },
  },
};

export default BrowserOSNativeTools;
