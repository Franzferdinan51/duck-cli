/**
 * 🦆 Duck Agent - BrowserOS Provider
 * Use BrowserOS as an AI provider with browser automation
 */

import { BrowserOSIntegration, type BrowserOSConfig } from '../integrations/browseros';

export interface BrowserOSProviderConfig extends BrowserOSConfig {
  name?: string;
}

export class BrowserOSProvider {
  name: string;
  private browserOS: BrowserOSIntegration;

  constructor(config: BrowserOSProviderConfig) {
    this.name = config.name || 'browseros';
    this.browserOS = new BrowserOSIntegration(config);
  }

  /**
   * Check if provider is available
   */
  async isAvailable(): Promise<boolean> {
    return this.browserOS.isRunning();
  }

  /**
   * Get provider info
   */
  async getInfo(): Promise<any> {
    return this.browserOS.getInfo();
  }

  // ============ BrowserOS Tools ============

  async listPages() { return this.browserOS.listPages(); }
  async getActivePage() { return this.browserOS.getActivePage(); }
  async navigate(url: string) { return this.browserOS.navigate(url); }
  async newPage(url?: string) { return this.browserOS.newPage(url); }
  async closePage(pageId: string) { return this.browserOS.closePage(pageId); }
  async showPage(pageId: string) { return this.browserOS.showPage(pageId); }

  async takeSnapshot(pageId?: string) { return this.browserOS.takeSnapshot(pageId); }
  async getPageContent(pageId?: string, maxChars?: number) { return this.browserOS.getPageContent(pageId, maxChars); }
  async takeScreenshot(pageId?: string) { return this.browserOS.takeScreenshot(pageId); }
  async evaluateScript(script: string, pageId?: string) { return this.browserOS.evaluateScript(script, pageId); }

  async click(ref: string, pageId?: string) { return this.browserOS.click(ref, pageId); }
  async clickAt(x: number, y: number, pageId?: string) { return this.browserOS.clickAt(x, y, pageId); }
  async type(text: string, pageId?: string) { return this.browserOS.type(text, pageId); }
  async fill(value: string, ref: string, pageId?: string) { return this.browserOS.fill(value, ref, pageId); }
  async pressKey(key: string, pageId?: string) { return this.browserOS.pressKey(key, pageId); }
  async scroll(direction: 'up' | 'down' | 'top' | 'bottom', pageId?: string) { return this.browserOS.scroll(direction, pageId); }

  async getBookmarks() { return this.browserOS.getBookmarks(); }
  async createBookmark(title: string, url?: string) { return this.browserOS.createBookmark(title, url); }
  async searchBookmarks(query: string) { return this.browserOS.searchBookmarks(query); }

  async getRecentHistory(limit?: number) { return this.browserOS.getRecentHistory(limit); }
  async searchHistory(query: string) { return this.browserOS.searchHistory(query); }

  async listWindows() { return this.browserOS.listWindows(); }
  async createWindow(url?: string) { return this.browserOS.createWindow(url); }

  async listTabGroups() { return this.browserOS.listTabGroups(); }
  async groupTabs(tabIds: string[], title?: string) { return this.browserOS.groupTabs(tabIds, title); }

  async listTools() { return this.browserOS.listTools(); }
}

export default BrowserOSProvider;
