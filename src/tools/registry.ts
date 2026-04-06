/**
 * 🦆 Duck Agent - Enhanced Tool Registry
 * With dangerous tool detection and approval system
 */

export interface ToolDefinition {
  name: string;
  description: string;
  schema: Record<string, any>;
  dangerous?: boolean;
  requiresApproval?: boolean;
  handler: Function;
}

export interface ToolResult {
  success?: boolean;
  result?: any;
  error?: string;
  output?: string;
  durationMs?: number;
}

export interface ToolInfo {
  name: string;
  description: string;
  schema: Record<string, any>;
  dangerous: boolean;
}

export class ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map();
  private approvalCallback: ((name: string, args: any) => Promise<boolean>) | null = null;

  register(def: ToolDefinition): void {
    // Validate schema
    if (!def.schema || typeof def.schema !== 'object') {
      throw new Error(`Tool ${def.name}: invalid schema`);
    }

    // Skip if already registered (prevents duplicate tools)
    if (this.tools.has(def.name)) {
      return;
    }

    this.tools.set(def.name, {
      ...def,
      dangerous: def.dangerous || false,
      requiresApproval: def.requiresApproval !== false
    });

    // Log is handled by registerTool() in core.ts to avoid double-logging
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  async execute(name: string, args: any): Promise<ToolResult> {
    const tool = this.tools.get(name);
    
    if (!tool) {
      return { success: false, error: `Unknown tool: ${name}. Run 'duck tools list' to see available tools.` };
    }

    // Check approval for dangerous tools
    if (tool.dangerous && this.approvalCallback) {
      const approved = await this.approvalCallback(name, args);
      if (!approved) {
        return { success: false, error: `Tool ${name} requires approval` };
      }
    }

    const startTime = Date.now();
    try {
      const result = await tool.handler(args);
      const durationMs = Date.now() - startTime;
      return { success: true, result, output: String(result), durationMs };
    } catch (error: any) {
      const durationMs = Date.now() - startTime;
      const suggestion = this.getToolErrorSuggestion(name, error.message);
      return { 
        success: false, 
        error: suggestion ? `${error.message}${suggestion}` : error.message,
        durationMs 
      };
    }
  }

  /**
   * Provide actionable suggestions when a tool fails
   */
  private getToolErrorSuggestion(toolName: string, errorMsg: string): string {
    const err = errorMsg.toLowerCase();

    if (toolName === 'shell') {
      if (err.includes('permission') || err.includes('denied') || err.includes('eacces')) {
        return '\n💡 Tip: Permission denied. Check file permissions with `ls -la`. Try `chmod +x` if needed.';
      }
      if (err.includes('not found') || err.includes('enoent') || err.includes('command not found')) {
        return '\n💡 Tip: Command not found. Install the tool or check the PATH. Run `which <command>` to locate it.';
      }
      if (err.includes('timeout') || err.includes('timed out')) {
        return '\n💡 Tip: Command timed out. Try simplifying the command or use `duck run` for complex multi-step tasks.';
      }
      if (err.includes('enoent') && err.includes('no such')) {
        return '\n💡 Tip: File or directory not found. Double-check the path and working directory.';
      }
    }

    if (toolName === 'file_write') {
      if (err.includes('permission') || err.includes('denied') || err.includes('eacces')) {
        return '\n💡 Tip: Cannot write to this path. Check directory permissions or use a path in your home directory.';
      }
      if (err.includes('enoent') || err.includes('no such')) {
        return '\n💡 Tip: Parent directory does not exist. The system will attempt to create it automatically.';
      }
    }

    if (toolName.includes('android_')) {
      if (err.includes('no devices') || err.includes('unauthorized') || err.includes('offline')) {
        return '\n💡 Tip: Enable USB debugging on your Android device. Run `adb devices` to check connection.';
      }
      if (err.includes('not found') || err.includes('adb')) {
        return '\n💡 Tip: ADB not found. Install with: `brew install android-platform-tools` (macOS) or `sudo apt install adb` (Linux).';
      }
      if (err.includes('no such file') || err.includes('enoent')) {
        return '\n💡 Tip: File on Android device not found. Use `adb shell ls <path>` to check the path exists.';
      }
    }

    if (toolName === 'web_search') {
      if (err.includes('rate limit') || err.includes('429')) {
        return '\n💡 Tip: Search rate limited. Wait 30 seconds and try again, or configure an alternative search provider.';
      }
      if (err.includes('network') || err.includes('fetch') || err.includes('connect')) {
        return '\n💡 Tip: Network error. Check your internet connection and try again.';
      }
    }

    if (toolName === 'memory_remember' || toolName === 'memory_recall') {
      if (err.includes('database') || err.includes('sql') || err.includes('sqlite')) {
        return '\n💡 Tip: Memory database error. Run `duck doctor` to diagnose or restart the agent.';
      }
    }

    if (toolName === 'speak' || toolName === 'tts') {
      if (err.includes('api key') || err.includes('unauthorized') || err.includes('401')) {
        return '\n💡 Tip: MiniMax API key not set. Run `duck setup` to configure your API keys.';
      }
      if (err.includes('quota') || err.includes('limit')) {
        return '\n💡 Tip: TTS quota exceeded. Daily limit is 4000 chars. Try again tomorrow.';
      }
    }

    if (toolName === 'desktop_screenshot' || toolName === 'screen_read') {
      if (err.includes('screenshot') || err.includes('capture')) {
        return '\n💡 Tip: Screenshot failed. Make sure ClawdCursor is running: `cd ~/.openclaw/workspace/clawd-cursor && nohup npx clawdcursor start &`\n💡 Alternative: Use macOS screenshot hotkey (Cmd+Shift+4) to capture manually.';
      }
    }

    // Default - no specific suggestion
    return '';
  }

  list(): ToolInfo[] {
    return Array.from(this.tools.values()).map(t => ({
      name: t.name,
      description: t.description,
      schema: t.schema,
      dangerous: t.dangerous || false
    }));
  }

  listDangerous(): ToolInfo[] {
    return this.list().filter(t => t.dangerous);
  }

  setApprovalCallback(callback: (name: string, args: any) => Promise<boolean>): void {
    this.approvalCallback = callback;
  }

  validateArgs(name: string, args: any): { valid: boolean; error?: string } {
    const tool = this.tools.get(name);
    if (!tool) {
      return { valid: false, error: `Unknown tool: ${name}` };
    }

    // Basic schema validation
    for (const [key, spec] of Object.entries(tool.schema)) {
      if ((spec as any).required && !(key in args)) {
        return { valid: false, error: `Missing required argument: ${key}` };
      }
    }

    return { valid: true };
  }
}

export default ToolRegistry;
