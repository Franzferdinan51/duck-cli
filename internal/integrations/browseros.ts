/**
 * Duck CLI - BrowserOS Integration
 * 
 * Pulls features from BrowserOS:
 * - Browser automation via MCP
 * - 53+ browser tools (navigate, click, type, extract)
 * - OAuth app integrations
 * - Workflow system
 */

export interface BrowserOSConfig {
  endpoint: string;
  apiKey?: string;
  autoConnect: boolean;
}

export interface BrowserTab {
  id: number;
  url: string;
  title: string;
  active: boolean;
}

export interface BrowserAction {
  action: 'nav' | 'click' | 'type' | 'screenshot' | 'extract' | 'scroll';
  target?: string;
  value?: string;
  options?: Record<string, any>;
}

// BrowserOS MCP tool definitions (53+ tools)
export const BROWSEROS_TOOLS = {
  // Navigation
  'browser.nav': {
    description: 'Navigate to URL',
    params: { url: 'string', newTab?: boolean }
  },
  'browser.back': { description: 'Go back' },
  'browser.forward': { description: 'Go forward' },
  'browser.reload': { description: 'Reload page' },
  
  // Interaction
  'browser.click': {
    description: 'Click element by selector or text',
    params: { selector: 'string', button?: 'left' | 'right' }
  },
  'browser.type': {
    description: 'Type text into element or page',
    params: { text: 'string', selector?: string, pressEnter?: boolean }
  },
  'browser.press': {
    description: 'Press keyboard key',
    params: { key: 'string', modifiers?: string[] }
  },
  
  // Content
  'browser.screenshot': {
    description: 'Take screenshot',
    params: { fullPage?: boolean, selector?: string }
  },
  'browser.extract': {
    description: 'Extract data from page',
    params: { selector: 'string', attribute?: string }
  },
  'browser.getText': {
    description: 'Get text content',
    params: { selector: 'string' }
  },
  
  // Tabs
  'browser.tabs.list': { description: 'List all tabs' },
  'browser.tabs.new': {
    description: 'Open new tab',
    params: { url?: string, active?: boolean }
  },
  'browser.tabs.close': {
    description: 'Close tab',
    params: { tabId?: number }
  },
  'browser.tabs.switch': {
    description: 'Switch to tab',
    params: { tabId: number }
  },
  
  // History & Bookmarks
  'browser.history.search': {
    description: 'Search browsing history',
    params: { query: 'string', limit?: number }
  },
  'browser.bookmarks.list': { description: 'List all bookmarks' },
  'browser.bookmarks.add': {
    description: 'Add bookmark',
    params: { url: 'string', title?: string, folder?: string }
  },
  
  // Forms
  'browser.form.fill': {
    description: 'Fill form fields',
    params: { fields: 'Record<string, string>' }
  },
  'browser.form.submit': {
    description: 'Submit form',
    params: { selector?: string }
  },
  
  // JavaScript
  'browser.js.run': {
    description: 'Execute JavaScript',
    params: { code: 'string' }
  },
  
  // Cookies & Storage
  'browser.cookies.get': {
    description: 'Get cookies',
    params: { domain?: string }
  },
  'browser.storage.get': {
    description: 'Get local storage',
    params: { key?: string }
  },
  
  // Downloads
  'browser.downloads.list': { description: 'List downloads' },
  'browser.downloads.cancel': {
    description: 'Cancel download',
    params: { id: 'string' }
  },
};

export class BrowserOSIntegration {
  private config: BrowserOSConfig;
  private connected: boolean = false;
  private tabs: BrowserTab[] = [];

  constructor(config?: Partial<BrowserOSConfig>) {
    this.config = {
      endpoint: 'http://localhost:3000',
      autoConnect: true,
      ...config
    };
  }

  async connect(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.endpoint}/health`, {
        method: 'GET',
        headers: this.getHeaders()
      });
      this.connected = response.ok;
      return this.connected;
    } catch {
      this.connected = false;
      return false;
    }
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }
    return headers;
  }

  async listTabs(): Promise<BrowserTab[]> {
    if (!this.connected) await this.connect();
    if (!this.connected) return [];

    try {
      const response = await fetch(`${this.config.endpoint}/tabs`, {
        headers: this.getHeaders()
      });
      const data = await response.json();
      this.tabs = data.tabs || [];
      return this.tabs;
    } catch {
      return [];
    }
  }

  async navigate(url: string, newTab: boolean = false): Promise<boolean> {
    return this.execute('browser.nav', { url, newTab });
  }

  async click(selector: string): Promise<boolean> {
    return this.execute('browser.click', { selector });
  }

  async type(text: string, selector?: string): Promise<boolean> {
    return this.execute('browser.type', { text, selector });
  }

  async screenshot(fullPage: boolean = false): Promise<string | null> {
    try {
      const response = await fetch(`${this.config.endpoint}/screenshot`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ fullPage })
      });
      const data = await response.json();
      return data.screenshot || null;
    } catch {
      return null;
    }
  }

  async extract(selector: string, attribute?: string): Promise<string | null> {
    try {
      const response = await fetch(`${this.config.endpoint}/extract`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ selector, attribute })
      });
      const data = await response.json();
      return data.result || null;
    } catch {
      return null;
    }
  }

  async newTab(url?: string): Promise<boolean> {
    return this.execute('browser.tabs.new', { url, active: true });
  }

  async closeTab(tabId?: number): Promise<boolean> {
    return this.execute('browser.tabs.close', { tabId });
  }

  async searchHistory(query: string, limit: number = 20): Promise<any[]> {
    try {
      const response = await fetch(`${this.config.endpoint}/history/search`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ query, limit })
      });
      const data = await response.json();
      return data.results || [];
    } catch {
      return [];
    }
  }

  async runScript(code: string): Promise<any> {
    try {
      const response = await fetch(`${this.config.endpoint}/js/run`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ code })
      });
      const data = await response.json();
      return data.result;
    } catch {
      return null;
    }
  }

  private async execute(tool: string, params: Record<string, any>): Promise<boolean> {
    if (!this.connected) await this.connect();
    if (!this.connected) return false;

    try {
      const response = await fetch(`${this.config.endpoint}/tools/execute`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ tool, params })
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  getStatus(): { connected: boolean; tabCount: number } {
    return {
      connected: this.connected,
      tabCount: this.tabs.length
    };
  }
}

// OAuth App Integration (BrowserOS-style)
export interface OAuthApp {
  id: string;
  name: string;
  authUrl: string;
  scopes: string[];
}

export const SUPPORTED_OAUTH_APPS: OAuthApp[] = [
  { id: 'github', name: 'GitHub', authUrl: 'https://github.com/login/oauth/authorize', scopes: ['repo', 'user', 'workflow'] },
  { id: 'google', name: 'Google', authUrl: 'https://accounts.google.com/o/oauth2/v2/auth', scopes: ['email', 'profile', 'calendar', 'gmail.readonly'] },
  { id: 'slack', name: 'Slack', authUrl: 'https://slack.com/oauth/v2/authorize', scopes: ['channels:history', 'chat:write', 'users:read'] },
  { id: 'discord', name: 'Discord', authUrl: 'https://discord.com/api/oauth2/authorize', scopes: ['identify', 'guilds'] },
  { id: 'notion', name: 'Notion', authUrl: 'https://api.notion.com/v1/oauth/authorize', scopes: ['integration_user', 'read_content'] },
  { id: 'linear', name: 'Linear', authUrl: 'https://linear.app/oauth/authorize', scopes: ['read', 'write'] },
];

export class OAuthManager {
  private tokens: Map<string, string> = new Map();

  async authorize(appId: string, apiKey: string): Promise<boolean> {
    // In a full implementation, this would handle OAuth flow
    // For now, support API key auth for apps that use it
    this.tokens.set(appId, apiKey);
    return true;
  }

  getToken(appId: string): string | undefined {
    return this.tokens.get(appId);
  }

  isConnected(appId: string): boolean {
    return this.tokens.has(appId);
  }

  listConnected(): string[] {
    return Array.from(this.tokens.keys());
  }
}
