/**
 * 🦆 Duck Agent - BrowserOS Integration
 * Connect to BrowserOS MCP server for 60+ browser automation tools
 */

export interface BrowserOSConfig {
  host: string;
  port: number;
}

export interface BrowserOSTool {
  name: string;
  description: string;
  input: Record<string, any>;
}

export interface BrowserOSPage {
  id: string;
  url: string;
  title: string;
  active: boolean;
}

export interface BrowserOSSnapshot {
  ref: string;
  role: string;
  name: string;
  value?: string;
  children?: BrowserOSSnapshot[];
}

// Default BrowserOS MCP endpoint
const DEFAULT_CONFIG: BrowserOSConfig = {
  host: '127.0.0.1',
  port: 9100,
};

export class BrowserOSIntegration {
  private config: BrowserOSConfig;
  private baseUrl: string;

  constructor(config: Partial<BrowserOSConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.baseUrl = `http://${this.config.host}:${this.config.port}`;
  }

  /**
   * Check if BrowserOS is running
   */
  async isRunning(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`);
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get info about BrowserOS
   */
  async getInfo(): Promise<any> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch(`${this.baseUrl}/mcp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'browseros_info',
          params: {}
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const data = await response.json() as any;
      return data.result?.text || data;
    } catch (e: any) {
      clearTimeout(timeout);
      console.warn(`[BrowserOS] getInfo failed: ${e.message}`);
      return null;
    }
  }

  // ============ Navigation Tools ============

  /**
   * List all open pages/tabs
   */
  async listPages(): Promise<BrowserOSPage[]> {
    const response = await this.callTool('list_pages', {});
    return response.pages || [];
  }

  /**
   * Get the currently active page
   */
  async getActivePage(): Promise<BrowserOSPage | null> {
    const response = await this.callTool('get_active_page', {});
    return response.page || null;
  }

  /**
   * Navigate to a URL
   */
  async navigate(url: string): Promise<{ success: boolean; page?: BrowserOSPage }> {
    return this.callTool('navigate_page', { url });
  }

  /**
   * Open a new page/tab
   */
  async newPage(url?: string): Promise<{ page: BrowserOSPage }> {
    return this.callTool('new_page', { url });
  }

  /**
   * Open a hidden page (background tab)
   */
  async newHiddenPage(url: string): Promise<{ page: BrowserOSPage }> {
    return this.callTool('new_hidden_page', { url });
  }

  /**
   * Close a page by ID
   */
  async closePage(pageId: string): Promise<void> {
    await this.callTool('close_page', { pageId });
  }

  /**
   * Show/hide a page (make visible)
   */
  async showPage(pageId: string): Promise<void> {
    await this.callTool('show_page', { pageId });
  }

  /**
   * Move a page to a different position
   */
  async movePage(pageId: string, position: number): Promise<void> {
    await this.callTool('move_page', { pageId, position });
  }

  // ============ Observation Tools ============

  /**
   * Take a snapshot of the current page (accessibility tree)
   */
  async takeSnapshot(pageId?: string): Promise<{ snapshot: BrowserOSSnapshot[] }> {
    return this.callTool('take_snapshot', { pageId });
  }

  /**
   * Take an enhanced snapshot with more details
   */
  async takeEnhancedSnapshot(pageId?: string): Promise<{ snapshot: BrowserOSSnapshot[] }> {
    return this.callTool('take_enhanced_snapshot', { pageId });
  }

  /**
   * Get the text content of a page
   */
  async getPageContent(pageId?: string, maxChars?: number): Promise<{ content: string }> {
    return this.callTool('get_page_content', { pageId, maxChars });
  }

  /**
   * Get all links on the current page
   */
  async getPageLinks(pageId?: string): Promise<{ links: { href: string; text: string }[] }> {
    return this.callTool('get_page_links', { pageId });
  }

  /**
   * Search the DOM for elements
   */
  async searchDOM(query: string, pageId?: string): Promise<{ results: any[] }> {
    return this.callTool('search_dom', { query, pageId });
  }

  /**
   * Take a screenshot
   */
  async takeScreenshot(pageId?: string): Promise<{ screenshot: string }> {
    return this.callTool('take_screenshot', { pageId });
  }

  /**
   * Evaluate JavaScript on the page
   */
  async evaluateScript(script: string, pageId?: string): Promise<{ result: any }> {
    return this.callTool('evaluate_script', { expression: script, pageId });
  }

  /**
   * Get console logs from the page
   */
  async getConsoleLogs(pageId?: string): Promise<{ logs: string[] }> {
    return this.callTool('get_console_logs', { pageId });
  }

  // ============ Input Tools ============

  /**
   * Click an element by ref
   */
  async click(ref: string, pageId?: string): Promise<void> {
    await this.callTool('click', { ref, pageId });
  }

  /**
   * Click at specific coordinates
   */
  async clickAt(x: number, y: number, pageId?: string): Promise<void> {
    await this.callTool('click_at', { x, y, pageId });
  }

  /**
   * Hover over an element
   */
  async hover(ref: string, pageId?: string): Promise<void> {
    await this.callTool('hover', { ref, pageId });
  }

  /**
   * Type text into an element
   */
  async type(text: string, pageId?: string): Promise<void> {
    await this.callTool('type_at', { text, pageId });
  }

  /**
   * Fill a form field
   */
  async fill(value: string, ref: string, pageId?: string): Promise<void> {
    await this.callTool('fill', { value, ref, pageId });
  }

  /**
   * Press a key
   */
  async pressKey(key: string, pageId?: string): Promise<void> {
    await this.callTool('press_key', { key, pageId });
  }

  /**
   * Scroll the page
   */
  async scroll(direction: 'up' | 'down' | 'top' | 'bottom', pageId?: string): Promise<void> {
    await this.callTool('scroll', { direction, pageId });
  }

  /**
   * Clear input field
   */
  async clear(ref: string, pageId?: string): Promise<void> {
    await this.callTool('clear', { ref, pageId });
  }

  /**
   * Check a checkbox
   */
  async check(ref: string, pageId?: string): Promise<void> {
    await this.callTool('check', { ref, pageId });
  }

  /**
   * Uncheck a checkbox
   */
  async uncheck(ref: string, pageId?: string): Promise<void> {
    await this.callTool('uncheck', { ref, pageId });
  }

  /**
   * Select option in dropdown
   */
  async selectOption(ref: string, value: string, pageId?: string): Promise<void> {
    await this.callTool('select_option', { ref, value, pageId });
  }

  /**
   * Upload file
   */
  async uploadFile(ref: string, filePath: string, pageId?: string): Promise<void> {
    await this.callTool('upload_file', { ref, filePath, pageId });
  }

  /**
   * Handle dialog (alert, confirm, prompt)
   */
  async handleDialog(accept: boolean, text?: string): Promise<void> {
    await this.callTool('handle_dialog', { accept, text });
  }

  // ============ Page Actions ============

  /**
   * Save page as PDF
   */
  async savePDF(path: string, pageId?: string): Promise<{ path: string }> {
    return this.callTool('save_pdf', { path, pageId });
  }

  /**
   * Save screenshot to file
   */
  async saveScreenshot(path: string, pageId?: string): Promise<{ path: string }> {
    return this.callTool('save_screenshot', { path, pageId });
  }

  /**
   * Download a file
   */
  async downloadFile(url: string, path: string): Promise<{ path: string }> {
    return this.callTool('download_file', { url, path });
  }

  // ============ Bookmarks ============

  /**
   * Get all bookmarks
   */
  async getBookmarks(): Promise<{ bookmarks: any[] }> {
    return this.callTool('get_bookmarks', {});
  }

  /**
   * Create a bookmark
   */
  async createBookmark(title: string, url?: string): Promise<{ bookmark: any }> {
    return this.callTool('create_bookmark', { title, url });
  }

  /**
   * Remove a bookmark
   */
  async removeBookmark(id: string): Promise<void> {
    await this.callTool('remove_bookmark', { id });
  }

  /**
   * Search bookmarks
   */
  async searchBookmarks(query: string): Promise<{ bookmarks: any[] }> {
    return this.callTool('search_bookmarks', { query });
  }

  // ============ History ============

  /**
   * Get recent history
   */
  async getRecentHistory(limit: number = 50): Promise<{ history: any[] }> {
    return this.callTool('get_recent_history', { limit });
  }

  /**
   * Search history
   */
  async searchHistory(query: string): Promise<{ history: any[] }> {
    return this.callTool('search_history', { query });
  }

  /**
   * Delete history item
   */
  async deleteHistoryUrl(url: string): Promise<void> {
    await this.callTool('delete_history_url', { url });
  }

  // ============ Windows ============

  /**
   * List all windows
   */
  async listWindows(): Promise<{ windows: any[] }> {
    return this.callTool('list_windows', {});
  }

  /**
   * Create a new window
   */
  async createWindow(url?: string): Promise<{ window: any }> {
    return this.callTool('create_window', { url });
  }

  /**
   * Close a window
   */
  async closeWindow(windowId: string): Promise<void> {
    await this.callTool('close_window', { windowId });
  }

  // ============ Tab Groups ============

  /**
   * List tab groups
   */
  async listTabGroups(): Promise<{ groups: any[] }> {
    return this.callTool('list_tab_groups', {});
  }

  /**
   * Group tabs together
   */
  async groupTabs(tabIds: string[], title?: string): Promise<{ group: any }> {
    return this.callTool('group_tabs', { tabIds, title });
  }

  /**
   * Ungroup tabs
   */
  async ungroupTabs(tabIds: string[]): Promise<void> {
    await this.callTool('ungroup_tabs', { tabIds });
  }

  // ============ Internal ============

  /**
   * Call a BrowserOS MCP tool
   */
  private async callTool(toolName: string, params: Record<string, any>): Promise<any> {
    const retryDelays = [500, 1000, 2000];
    let lastError = '';

    for (let attempt = 0; attempt <= retryDelays.length; attempt++) {
      if (attempt > 0) {
        const delay = retryDelays[attempt - 1];
        console.log(`[BrowserOS] ${toolName} retry ${attempt}/${retryDelays.length} after ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(`${this.baseUrl}/mcp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: Date.now(),
            method: toolName,
            params
          }),
          signal: controller.signal,
        });
        clearTimeout(timeout);

        let data: any;
        try {
          data = await response.json();
        } catch {
          throw new Error(`BrowserOS ${toolName} returned invalid JSON (HTTP ${response.status}): ${await response.text().catch(() => 'empty')}`);
        }

        if (data?.error) {
          throw new Error(data.error.message || `BrowserOS ${toolName} error`);
        }

        return data.result || data;
      } catch (e: any) {
        lastError = e.message || 'Unknown error';
        const isRetryable = e.name === 'AbortError' || e.message?.includes('ECONNRESET') ||
                           e.message?.includes('ETIMEDOUT') || e.message?.includes('ENOTFOUND') ||
                           e.message?.includes('Connection') || e.message?.includes('fetch') ||
                           e.message?.includes('network') || e.message?.includes('Invalid JSON');
        if (!isRetryable) {
          console.error(`[BrowserOS] ${toolName} failed (non-retryable): ${lastError}`);
          throw e;
        }
        console.warn(`[BrowserOS] ${toolName} failed (retryable): ${lastError}`);
      }
    }

    throw new Error(`BrowserOS ${toolName} failed after ${retryDelays.length} retries: ${lastError}`);
  }

  /**
   * Get all available tools
   */
  async listTools(): Promise<BrowserOSTool[]> {
    const tools: BrowserOSTool[] = [
      // Navigation
      { name: 'list_pages', description: 'List all open tabs', input: {} },
      { name: 'get_active_page', description: 'Get current active tab', input: {} },
      { name: 'navigate_page', description: 'Navigate to URL', input: { url: 'string' } },
      { name: 'new_page', description: 'Open new tab', input: { url: 'string?' } },
      { name: 'new_hidden_page', description: 'Open hidden background tab', input: { url: 'string' } },
      { name: 'close_page', description: 'Close a tab', input: { pageId: 'string' } },
      { name: 'show_page', description: 'Show/activate a tab', input: { pageId: 'string' } },
      { name: 'move_page', description: 'Move tab position', input: { pageId: 'string', position: 'number' } },
      
      // Observation
      { name: 'take_snapshot', description: 'Get page accessibility tree', input: {} },
      { name: 'take_enhanced_snapshot', description: 'Get detailed page tree', input: {} },
      { name: 'get_page_content', description: 'Extract page text', input: { maxChars: 'number?' } },
      { name: 'get_page_links', description: 'Get all links on page', input: {} },
      { name: 'search_dom', description: 'Search DOM elements', input: { query: 'string' } },
      { name: 'take_screenshot', description: 'Take page screenshot', input: {} },
      { name: 'evaluate_script', description: 'Run JavaScript', input: { expression: 'string' } },
      { name: 'get_console_logs', description: 'Get browser console logs', input: {} },
      
      // Input
      { name: 'click', description: 'Click element', input: { ref: 'string' } },
      { name: 'click_at', description: 'Click at coordinates', input: { x: 'number', y: 'number' } },
      { name: 'hover', description: 'Hover over element', input: { ref: 'string' } },
      { name: 'type_at', description: 'Type text', input: { text: 'string' } },
      { name: 'fill', description: 'Fill form field', input: { ref: 'string', value: 'string' } },
      { name: 'press_key', description: 'Press keyboard key', input: { key: 'string' } },
      { name: 'scroll', description: 'Scroll page', input: { direction: 'string' } },
      { name: 'clear', description: 'Clear input', input: { ref: 'string' } },
      { name: 'check', description: 'Check checkbox', input: { ref: 'string' } },
      { name: 'uncheck', description: 'Uncheck checkbox', input: { ref: 'string' } },
      { name: 'select_option', description: 'Select dropdown option', input: { ref: 'string', value: 'string' } },
      { name: 'upload_file', description: 'Upload file', input: { ref: 'string', filePath: 'string' } },
      { name: 'handle_dialog', description: 'Handle alert/confirm', input: { accept: 'boolean', text: 'string?' } },
      
      // Page Actions
      { name: 'save_pdf', description: 'Save page as PDF', input: { path: 'string' } },
      { name: 'save_screenshot', description: 'Save screenshot to file', input: { path: 'string' } },
      { name: 'download_file', description: 'Download file', input: { url: 'string', path: 'string' } },
      
      // Windows
      { name: 'list_windows', description: 'List all windows', input: {} },
      { name: 'create_window', description: 'Create new window', input: { url: 'string?' } },
      { name: 'close_window', description: 'Close window', input: { windowId: 'string' } },
      
      // Bookmarks
      { name: 'get_bookmarks', description: 'List all bookmarks', input: {} },
      { name: 'create_bookmark', description: 'Create bookmark', input: { title: 'string', url: 'string?' } },
      { name: 'remove_bookmark', description: 'Remove bookmark', input: { id: 'string' } },
      { name: 'search_bookmarks', description: 'Search bookmarks', input: { query: 'string' } },
      
      // History
      { name: 'get_recent_history', description: 'Get browsing history', input: { limit: 'number?' } },
      { name: 'search_history', description: 'Search history', input: { query: 'string' } },
      { name: 'delete_history_url', description: 'Delete history entry', input: { url: 'string' } },
      
      // Tab Groups
      { name: 'list_tab_groups', description: 'List tab groups', input: {} },
      { name: 'group_tabs', description: 'Group tabs together', input: { tabIds: 'string[]', title: 'string?' } },
      { name: 'ungroup_tabs', description: 'Ungroup tabs', input: { tabIds: 'string[]' } },
    ];

    return tools;
  }
}

export default BrowserOSIntegration;
