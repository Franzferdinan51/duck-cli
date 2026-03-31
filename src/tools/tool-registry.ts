/**
 * 🦆 Duck Agent - Tool Registry & Toolsets
 * Organized like Hermes Agent with categories
 */

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, string>;
  dangerous?: boolean;
}

export interface ToolResult {
  success: boolean;
  output?: string;
  error?: string;
  data?: any;
}

// ============ Tool Definitions ============

export const TOOL_DEFINITIONS: Record<string, ToolDefinition> = {
  // File Tools
  file_read: { name: 'file_read', description: 'Read contents of a file', parameters: { path: 'string' } },
  file_write: { name: 'file_write', description: 'Write content to a file', parameters: { path: 'string', content: 'string' }, dangerous: true },
  file_edit: { name: 'file_edit', description: 'Edit specific lines in a file', parameters: { path: 'string', oldText: 'string', newText: 'string' }, dangerous: true },
  glob: { name: 'glob', description: 'Find files matching a pattern', parameters: { pattern: 'string' } },
  
  // Shell Tools
  bash: { name: 'bash', description: 'Execute shell commands', parameters: { command: 'string' }, dangerous: true },
  powershell: { name: 'powershell', description: 'Execute Windows PowerShell commands', parameters: { command: 'string' }, dangerous: true },
  
  // Search Tools
  grep: { name: 'grep', description: 'Search for patterns in files', parameters: { pattern: 'string' } },
  web_search: { name: 'web_search', description: 'Search the web for information', parameters: { query: 'string' } },
  web_fetch: { name: 'web_fetch', description: 'Fetch content from a URL', parameters: { url: 'string' } },
  
  // Vision & Media
  vision_analyze: { name: 'vision_analyze', description: 'Analyze an image', parameters: { image: 'string' } },
  image_generate: { name: 'image_generate', description: 'Generate an image from text', parameters: { prompt: 'string' } },
  
  // Voice
  speak: { name: 'speak', description: 'Convert text to speech', parameters: { text: 'string' } },
  
  // Memory
  remember: { name: 'remember', description: 'Save information to memory', parameters: { key: 'string', value: 'string' } },
  recall: { name: 'recall', description: 'Search memory for information', parameters: { query: 'string' } },
  session_search: { name: 'session_search', description: 'Search past conversations', parameters: { query: 'string' } },
  
  // Planning
  todo: { name: 'todo', description: 'Task planning and tracking', parameters: { action: 'string' } },
  
  // Delegation
  delegate_task: { name: 'delegate_task', description: 'Spawn a subagent for parallel tasks', parameters: { task: 'string' }, dangerous: true },
  
  // BrowserOS
  browser_navigate: { name: 'browser_navigate', description: 'Navigate to a URL', parameters: { url: 'string' } },
  browser_click: { name: 'browser_click', description: 'Click on a page element', parameters: { element: 'string' } },
  browser_type: { name: 'browser_type', description: 'Type text into a field', parameters: { element: 'string', text: 'string' } },
  browser_screenshot: { name: 'browser_screenshot', description: 'Take a screenshot', parameters: {} },
  browser_content: { name: 'browser_content', description: 'Extract page text', parameters: {} },
  
  // Coding
  lsp_diagnostics: { name: 'lsp_diagnostics', description: 'Get code diagnostics', parameters: { path: 'string' } },
  repl: { name: 'repl', description: 'Run code in REPL', parameters: { language: 'string', code: 'string' }, dangerous: true },
  
  // System
  get_status: { name: 'get_status', description: 'Get agent status', parameters: {} },
  get_cost: { name: 'get_cost', description: 'Get cost tracking', parameters: {} },
  think: { name: 'think', description: 'Reasoning mode', parameters: { prompt: 'string' } },
};

// ============ Toolset Definitions ============

export interface Toolset {
  name: string;
  description: string;
  tools: string[];
}

export const TOOLSETS: Record<string, Toolset> = {
  minimal: { name: 'minimal', description: 'Minimal tools for simple tasks', tools: ['file_read', 'bash', 'grep'] },
  file: { name: 'file', description: 'File manipulation', tools: ['file_read', 'file_write', 'file_edit', 'glob', 'grep'] },
  web: { name: 'web', description: 'Web search and browsing', tools: ['web_search', 'web_fetch'] },
  vision: { name: 'vision', description: 'Image analysis', tools: ['vision_analyze', 'image_generate'] },
  voice: { name: 'voice', description: 'Text-to-speech', tools: ['speak'] },
  terminal: { name: 'terminal', description: 'Shell commands', tools: ['bash', 'powershell'] },
  coding: { name: 'coding', description: 'Full coding suite', tools: ['file_read', 'file_write', 'glob', 'grep', 'bash', 'lsp_diagnostics', 'repl'] },
  browser: { name: 'browser', description: 'Browser automation', tools: ['browser_navigate', 'browser_click', 'browser_type', 'browser_screenshot', 'browser_content'] },
  memory: { name: 'memory', description: 'Memory and persistence', tools: ['remember', 'recall', 'session_search'] },
  planning: { name: 'planning', description: 'Task planning', tools: ['todo'] },
  delegation: { name: 'delegation', description: 'Subagent spawning', tools: ['delegate_task'] },
  duck: { name: 'duck', description: 'Duck Agent default', tools: ['file_read', 'glob', 'bash', 'web_search', 'web_fetch', 'speak', 'remember', 'recall', 'think', 'get_status'] },
  full: { name: 'full', description: 'All tools', tools: Object.keys(TOOL_DEFINITIONS) },
};

// ============ Tool Registry Class ============

export class ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map();
  private handlers: Map<string, (args: any) => Promise<ToolResult>> = new Map();
  
  constructor() {
    for (const [name, def] of Object.entries(TOOL_DEFINITIONS)) {
      this.tools.set(name, def);
    }
  }
  
  register(name: string, definition: ToolDefinition): void {
    this.tools.set(name, definition);
  }
  
  registerHandler(name: string, handler: (args: any) => Promise<ToolResult>): void {
    this.handlers.set(name, handler);
  }
  
  has(name: string): boolean {
    return this.tools.has(name);
  }
  
  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }
  
  list(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }
  
  listByToolset(toolset: string): ToolDefinition[] {
    const ts = TOOLSETS[toolset];
    if (!ts) return [];
    return ts.tools
      .map(name => this.tools.get(name))
      .filter((t): t is ToolDefinition => t !== undefined);
  }
  
  async execute(name: string, args: any): Promise<ToolResult> {
    const handler = this.handlers.get(name);
    if (!handler) return { success: false, error: `No handler for: ${name}` };
    try {
      return await handler(args);
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }
  
  getToolsByCategory(): Record<string, ToolDefinition[]> {
    const cats: Record<string, ToolDefinition[]> = {
      'File': [], 'Shell': [], 'Search': [], 'Vision': [], 'Voice': [],
      'Memory': [], 'Planning': [], 'Browser': [], 'Coding': [], 'System': [], 'Delegation': [],
    };
    
    for (const tool of this.tools.values()) {
      if (tool.name.includes('file')) cats['File'].push(tool);
      else if (tool.name.includes('bash') || tool.name.includes('powershell')) cats['Shell'].push(tool);
      else if (tool.name.includes('search') || tool.name.includes('grep')) cats['Search'].push(tool);
      else if (tool.name.includes('vision') || tool.name.includes('image')) cats['Vision'].push(tool);
      else if (tool.name.includes('speak')) cats['Voice'].push(tool);
      else if (tool.name.includes('remember') || tool.name.includes('recall')) cats['Memory'].push(tool);
      else if (tool.name.includes('todo')) cats['Planning'].push(tool);
      else if (tool.name.includes('browser')) cats['Browser'].push(tool);
      else if (tool.name.includes('lsp') || tool.name.includes('repl')) cats['Coding'].push(tool);
      else if (tool.name.includes('delegate')) cats['Delegation'].push(tool);
      else cats['System'].push(tool);
    }
    
    return cats;
  }
}

export default ToolRegistry;
