/**
 * 🦆 Duck Agent - PinchTab Browser Automation Tools
 * HTTP API client for PinchTab - browser control for AI agents
 *
 * PinchTab is a standalone HTTP server that controls Chrome.
 * Install: curl -fsSL https://pinchtab.com/install.sh | bash
 * Or: pinchtab daemon install
 * API base: http://localhost:9867
 */

import { Agent } from '../agent/core.js';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PinchTabConfig {
  host?: string;
  port?: number;
  baseUrl?: string;
}

export interface TabInfo {
  id: string;
  url: string;
  title: string;
  active: boolean;
}

export interface PageText {
  text: string;
  tokens: number;
}

export interface ActionResult {
  success: boolean;
  error?: string;
}

export interface SnapshotOptions {
  interactive?: boolean;
  compact?: boolean;
  maxTokens?: number;
  depth?: number;
  format?: string;
  noAnimations?: boolean;
}

export interface NavigateOptions {
  tabId?: string;
  newTab?: boolean;
  blockImages?: boolean;
  blockAds?: boolean;
  waitFor?: string;
  waitSelector?: string;
  waitTitle?: string;
  timeout?: number;
}

export interface ActionOptions {
  tabId?: string;
  ref?: string;
  selector?: string;
  nodeId?: number;
  x?: number;
  y?: number;
  kind: string;
  value?: string;
}

// ─── PinchTab Client ─────────────────────────────────────────────────────────

export class PinchTabTools {
  private baseUrl: string;
  private connected = false;

  constructor(config: PinchTabConfig = {}) {
    const host = config.host ?? '127.0.0.1';
    const port = config.port ?? 9867;
    this.baseUrl = config.baseUrl ?? `http://${host}:${port}`;
  }

  // ─── HTTP Helpers ────────────────────────────────────────────────────────

  private async request<T = any>(
    method: string,
    path: string,
    body?: any,
    params?: Record<string, string>
  ): Promise<T> {
    let url = `${this.baseUrl}${path}`;
    if (params) {
      const qs = new URLSearchParams(params).toString();
      url += `?${qs}`;
    }

    const opts: RequestInit = {
      method,
      headers: { 'Content-Type': 'application/json' },
    };

    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(url, opts);
    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      throw new Error(`PinchTab ${method} ${path} → ${res.status}: ${text}`);
    }

    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      return res.json();
    }
    return res.text() as any;
  }

  private get<T = any>(path: string, params?: Record<string, string>): Promise<T> {
    return this.request<T>('GET', path, undefined, params);
  }

  private post<T = any>(path: string, body?: any): Promise<T> {
    return this.request<T>('POST', path, body);
  }

  // ─── Health & Status ──────────────────────────────────────────────────────

  /** Check if PinchTab is running and healthy */
  async isAvailable(): Promise<boolean> {
    try {
      const health = await this.get<any>('/health');
      this.connected = true;
      return !!health;
    } catch {
      this.connected = false;
      return false;
    }
  }

  /** Get server info */
  async getHealth(): Promise<any> {
    return this.get<any>('/health');
  }

  // ─── Tab Management ───────────────────────────────────────────────────────

  /** List all open tabs */
  async listTabs(): Promise<TabInfo[]> {
    const tabs = await this.get<any[]>('/tabs');
    return tabs.map((t: any) => ({
      id: String(t.id),
      url: t.url || '',
      title: t.title || '',
      active: t.active || false,
    }));
  }

  /** Navigate to a URL */
  async navigate(url: string, options: NavigateOptions = {}): Promise<ActionResult> {
    try {
      await this.post<any>('/navigate', { url, ...options });
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  /** Navigate back */
  async goBack(tabId?: string): Promise<ActionResult> {
    try {
      if (tabId) {
        await this.post('/back?' + new URLSearchParams({ tabId }).toString());
      } else {
        await this.post('/back');
      }
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  /** Navigate forward */
  async goForward(tabId?: string): Promise<ActionResult> {
    try {
      if (tabId) {
        await this.post('/forward?' + new URLSearchParams({ tabId }).toString());
      } else {
        await this.post('/forward');
      }
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  /** Reload current tab */
  async reload(tabId?: string): Promise<ActionResult> {
    try {
      if (tabId) {
        await this.post('/reload?' + new URLSearchParams({ tabId }).toString());
      } else {
        await this.post('/reload');
      }
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  /** Open a new blank tab */
  async newTab(url?: string): Promise<ActionResult> {
    try {
      await this.post<any>('/tab', { action: 'new', url });
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  /** Close a tab */
  async closeTab(tabId: string): Promise<ActionResult> {
    try {
      await this.post(`/tabs/${tabId}/close`);
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  // ─── Page Analysis ─────────────────────────────────────────────────────────

  /** Get page text content */
  async getText(tabId?: string): Promise<PageText> {
    const params: Record<string, string> = {};
    if (tabId) params.tabId = tabId;
    const result = await this.get<any>('/text', Object.keys(params).length ? params : undefined);
    return {
      text: result.text || result || '',
      tokens: result.tokens || 0,
    };
  }

  /** Get accessibility snapshot */
  async getSnapshot(tabId?: string, options: SnapshotOptions = {}): Promise<any> {
    const params: Record<string, string> = {};
    if (tabId) params.tabId = tabId;
    if (options.interactive) params.interactive = 'true';
    if (options.compact) params.compact = 'true';
    if (options.maxTokens) params.maxTokens = String(options.maxTokens);
    if (options.depth) params.depth = String(options.depth);
    if (options.format) params.format = options.format;
    if (options.noAnimations) params.noAnimations = 'true';

    return this.get<any>('/snapshot', Object.keys(params).length ? params : undefined);
  }

  /** Quick snapshot (compact, interactive) */
  async quickSnapshot(tabId?: string): Promise<any> {
    return this.getSnapshot(tabId, { interactive: true, compact: true, maxTokens: 4000 });
  }

  // ─── Interaction ───────────────────────────────────────────────────────────

  /** Click element */
  async click(target: { ref?: string; selector?: string; x?: number; y?: number }, tabId?: string): Promise<ActionResult> {
    try {
      await this.post('/action', {
        kind: 'click',
        tabId,
        ...target,
      });
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  /** Type text */
  async type(text: string, target: { ref?: string; selector?: string }, tabId?: string): Promise<ActionResult> {
    try {
      await this.post('/action', {
        kind: 'type',
        value: text,
        tabId,
        ...target,
      });
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  /** Fill input directly */
  async fill(text: string, target: { ref?: string; selector?: string }, tabId?: string): Promise<ActionResult> {
    try {
      await this.post('/action', {
        kind: 'fill',
        value: text,
        tabId,
        ...target,
      });
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  /** Press a key */
  async press(key: string, tabId?: string): Promise<ActionResult> {
    try {
      await this.post('/action', { kind: 'press', value: key, tabId });
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  /** Scroll page or element */
  async scroll(delta: { x?: number; y?: number }, target?: { ref?: string; selector?: string }, tabId?: string): Promise<ActionResult> {
    try {
      await this.post('/action', {
        kind: 'scroll',
        value: JSON.stringify(delta),
        tabId,
        ...target,
      });
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  /** Hover over element */
  async hover(target: { ref?: string; selector?: string }, tabId?: string): Promise<ActionResult> {
    try {
      await this.post('/action', { kind: 'hover', tabId, ...target });
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  /** Evaluate JavaScript */
  async evaluate(script: string, tabId?: string): Promise<any> {
    try {
      return await this.post<any>('/evaluate', { script, tabId });
    } catch (e: any) {
      return { error: e.message };
    }
  }

  // ─── Screenshot & PDF ─────────────────────────────────────────────────────

  /** Take screenshot */
  async screenshot(tabId?: string, format: 'png' | 'jpeg' = 'png'): Promise<string> {
    const params: Record<string, string> = {};
    if (tabId) params.tabId = tabId;
    if (format !== 'png') params.format = format;

    const data = await this.get<string>('/screenshot', Object.keys(params).length ? params : undefined);
    return data;
  }

  /** Generate PDF */
  async pdf(tabId?: string, options: Record<string, any> = {}): Promise<any> {
    const params: Record<string, string> = {};
    if (tabId) params.tabId = tabId;
    return this.post('/pdf', { ...options, ...(Object.keys(params).length ? { tabId } : {}) });
  }

  // ─── Find Elements ────────────────────────────────────────────────────────

  /** Semantic element search */
  async find(query: string, tabId?: string, threshold = 0.7): Promise<any[]> {
    try {
      const result = await this.post<any>('/find', { query, tabId, threshold });
      return Array.isArray(result) ? result : [];
    } catch {
      return [];
    }
  }

  // ─── Status ───────────────────────────────────────────────────────────────

  isConnected(): boolean {
    return this.connected;
  }
}

// ─── Singleton instance ───────────────────────────────────────────────────────

let _instance: PinchTabTools | null = null;

export function getPinchTabTools(config?: PinchTabConfig): PinchTabTools {
  if (!_instance) {
    _instance = new PinchTabTools(config);
  }
  return _instance;
}

// ─── Tool Registration ────────────────────────────────────────────────────────

/**
 * Register PinchTab tools with the Duck Agent
 */
export function registerPinchTabTools(agent: Agent): void {
  const pt = getPinchTabTools();

  const tools = {
    pinchtab_navigate: {
      name: 'pinchtab_navigate',
      description: 'Navigate browser to URL via PinchTab',
      schema: { url: 'string', tabId: 'string?' },
      dangerous: false,
      handler: async (args: { url: string; tabId?: string }) => {
        const result = await pt.navigate(args.url, { tabId: args.tabId });
        return JSON.stringify(result);
      },
    },

    pinchtab_screenshot: {
      name: 'pinchtab_screenshot',
      description: 'Take a browser screenshot via PinchTab',
      schema: { tabId: 'string?', format: 'string?' },
      dangerous: false,
      handler: async (args: { tabId?: string; format?: 'png' | 'jpeg' }) => {
        const img = await pt.screenshot(args.tabId, args.format || 'png');
        return img;
      },
    },

    pinchtab_snapshot: {
      name: 'pinchtab_snapshot',
      description: 'Get browser accessibility snapshot via PinchTab',
      schema: { tabId: 'string?', interactive: 'boolean?', compact: 'boolean?', maxTokens: 'number?' },
      dangerous: false,
      handler: async (args: any) => {
        const snap = await pt.getSnapshot(args.tabId, {
          interactive: args.interactive,
          compact: args.compact,
          maxTokens: args.maxTokens,
        });
        return typeof snap === 'string' ? snap : JSON.stringify(snap);
      },
    },

    pinchtab_text: {
      name: 'pinchtab_text',
      description: 'Get page text content via PinchTab',
      schema: { tabId: 'string?' },
      dangerous: false,
      handler: async (args: { tabId?: string }) => {
        const page = await pt.getText(args.tabId);
        return page.text;
      },
    },

    pinchtab_tabs: {
      name: 'pinchtab_tabs',
      description: 'List all open browser tabs via PinchTab',
      schema: {},
      dangerous: false,
      handler: async () => {
        const tabs = await pt.listTabs();
        return JSON.stringify(tabs);
      },
    },

    pinchtab_click: {
      name: 'pinchtab_click',
      description: 'Click element by ref or selector via PinchTab',
      schema: { ref: 'string?', selector: 'string?', x: 'number?', y: 'number?', tabId: 'string?' },
      dangerous: false,
      handler: async (args: any) => {
        const result = await pt.click(
          { ref: args.ref, selector: args.selector, x: args.x, y: args.y },
          args.tabId
        );
        return JSON.stringify(result);
      },
    },

    pinchtab_type: {
      name: 'pinchtab_type',
      description: 'Type text into element via PinchTab',
      schema: { text: 'string', ref: 'string?', selector: 'string?', tabId: 'string?' },
      dangerous: false,
      handler: async (args: any) => {
        const result = await pt.type(args.text, { ref: args.ref, selector: args.selector }, args.tabId);
        return JSON.stringify(result);
      },
    },

    pinchtab_press: {
      name: 'pinchtab_press',
      description: 'Press a key via PinchTab',
      schema: { key: 'string', tabId: 'string?' },
      dangerous: false,
      handler: async (args: { key: string; tabId?: string }) => {
        const result = await pt.press(args.key, args.tabId);
        return JSON.stringify(result);
      },
    },

    pinchtab_health: {
      name: 'pinchtab_health',
      description: 'Check PinchTab server health',
      schema: {},
      dangerous: false,
      handler: async () => {
        const health = await pt.getHealth();
        return JSON.stringify(health);
      },
    },

    pinchtab_back: {
      name: 'pinchtab_back',
      description: 'Navigate browser back',
      schema: { tabId: 'string?' },
      dangerous: false,
      handler: async (args: { tabId?: string }) => {
        const result = await pt.goBack(args.tabId);
        return JSON.stringify(result);
      },
    },

    pinchtab_forward: {
      name: 'pinchtab_forward',
      description: 'Navigate browser forward',
      schema: { tabId: 'string?' },
      dangerous: false,
      handler: async (args: { tabId?: string }) => {
        const result = await pt.goForward(args.tabId);
        return JSON.stringify(result);
      },
    },

    pinchtab_newtab: {
      name: 'pinchtab_newtab',
      description: 'Open a new browser tab',
      schema: { url: 'string?' },
      dangerous: false,
      handler: async (args: { url?: string }) => {
        const result = await pt.newTab(args.url);
        return JSON.stringify(result);
      },
    },
  };

  for (const [name, tool] of Object.entries(tools)) {
    (agent as any).registerTool(tool);
  }
}

export default PinchTabTools;
