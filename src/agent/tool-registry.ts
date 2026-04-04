/**
 * Duck Agent - Tool Registry with Retry & Fallback Configuration
 */

export enum ToolErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT = 'TIMEOUT',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  NOT_FOUND = 'NOT_FOUND',
  RATE_LIMIT = 'RATE_LIMIT',
  UNKNOWN = 'UNKNOWN',
}

export interface RetryConfig {
  maxRetries: number;
  backoffMs: number;
  backoffMultiplier: number;
}

export interface FallbackConfig {
  tool: string;
  description: string;
  argsTransform?: (args: any, prevResult: any, prevError: any) => any;
}

export interface ToolRegistryEntry {
  name: string;
  maxRetries: number;
  retryConfig: RetryConfig;
  fallbacks: FallbackConfig[];
  errorMap: Record<ToolErrorType, 'retry' | 'fail' | 'fallback'>;
}

const DEFAULT_ERROR_MAP: Record<ToolErrorType, 'retry' | 'fail' | 'fallback'> = {
  [ToolErrorType.NETWORK_ERROR]: 'retry',
  [ToolErrorType.TIMEOUT]: 'retry',
  [ToolErrorType.PERMISSION_DENIED]: 'fail',
  [ToolErrorType.NOT_FOUND]: 'fail',
  [ToolErrorType.RATE_LIMIT]: 'retry',
  [ToolErrorType.UNKNOWN]: 'retry',
};

function shellTimeoutTransform(args) { return { command: args.command, timeout: (args.timeout || 30000) * 1.5 }; }
function execOutTransform(args) { return { command: args.command, timeout: args.timeout }; }
function screenshotFallback() { return {}; }
function findAndTapFallback(args) { return { query: 'coordinates ' + args.x + ',' + args.y }; }
function clipboardSetFallback(args) { return { action: 'set', text: args.text }; }
function dumpScreenFallback(args) { return { query: args.query }; }
function screenFallback() { return {}; }
function shellFallback(args) { return { command: args.command }; }
function appShellFallback(args) { if (args.action === 'launch') return { command: 'am start -n ' + args.package }; return { command: 'am force-stop ' + args.package }; }
function pushShellFallback(args) { return { command: 'adb push ' + args.local + ' ' + args.remote }; }
function pullShellFallback(args) { return { command: 'adb pull ' + args.remote + ' ' + args.local }; }
function clipboardShellFallback(args) { if (args.action === 'get') return { command: 'am broadcast -a clipper.get' }; return { command: 'am broadcast -a clipper.set -e text ' + (args.text || '') }; }
function batteryShellFallback() { return { command: 'dumpsys battery | grep level' }; }
function infoShellFallback() { return { command: "getprop | grep -E 'product.model.manufacturer.sdk.version'" }; }
function termuxShellFallback(args) { return { command: args.command }; }
function screencapShellFallback() { return { command: 'screencap -p /sdcard/screen.png && cat /sdcard/screen.png' }; }
function desktopScreenshotFallback() { return { command: 'screencapture /tmp/duck-screenshot.png && echo /tmp/duck-screenshot.png' }; }
function bashFallback(args) { return { command: 'bash -c ' + JSON.stringify(args.command) }; }
function catFallback(args) { return { command: 'cat ' + JSON.stringify(args.path) }; }
function teeFallback(args) { return { command: 'mkdir -p "$(dirname ' + JSON.stringify(args.path) + ')" && echo ' + JSON.stringify(args.content) + ' > ' + JSON.stringify(args.path) }; }
function curlSearchFallback(args) { return { command: 'curl -s https://duckduckgo.com/?q=' + encodeURIComponent(args.query) + ' | head -100' }; }
function envCheckFallback() { return { command: "env | grep -i 'provider.lmstudio.kimi.minimax.openai' | head -20" }; }
function desktopOpenShell(args) { const p = process.platform; if (p === 'darwin') return { command: 'open -a ' + args.app }; if (p === 'win32') return { command: 'start ' + args.app }; return { command: 'xdg-open ' + args.app }; }
function screenReadFallback() { return { mode: 'path' }; }

export const TOOL_RETRY_REGISTRY = {

  android_shell: { name: 'android_shell', maxRetries: 2, retryConfig: { maxRetries: 2, backoffMs: 500, backoffMultiplier: 2 }, fallbacks: [ { tool: 'android_shell', description: 'Retry with longer timeout', argsTransform: shellTimeoutTransform }, { tool: 'android_exec_out', description: 'Use adb exec-out for binary-safe output', argsTransform: execOutTransform }, { tool: 'android_screenshot', description: 'Extract via screenshot when shell fails', argsTransform: screenshotFallback }, ], errorMap: { ...DEFAULT_ERROR_MAP, [ToolErrorType.TIMEOUT]: 'retry', [ToolErrorType.NETWORK_ERROR]: 'retry' } },

  android_exec_out: { name: 'android_exec_out', maxRetries: 2, retryConfig: { maxRetries: 2, backoffMs: 500, backoffMultiplier: 2 }, fallbacks: [ { tool: 'android_shell', description: 'Fallback to adb shell', argsTransform: shellFallback }, ], errorMap: DEFAULT_ERROR_MAP },

  android_screenshot: { name: 'android_screenshot', maxRetries: 2, retryConfig: { maxRetries: 2, backoffMs: 300, backoffMultiplier: 2 }, fallbacks: [ { tool: 'android_shell', description: 'Try screencap via shell', argsTransform: screencapShellFallback }, ], errorMap: DEFAULT_ERROR_MAP },

  android_tap: { name: 'android_tap', maxRetries: 1, retryConfig: { maxRetries: 1, backoffMs: 200, backoffMultiplier: 1.5 }, fallbacks: [ { tool: 'android_find_and_tap', description: 'Find element first then tap', argsTransform: findAndTapFallback }, ], errorMap: { ...DEFAULT_ERROR_MAP, [ToolErrorType.TIMEOUT]: 'fail' } },

  android_type: { name: 'android_type', maxRetries: 1, retryConfig: { maxRetries: 1, backoffMs: 300, backoffMultiplier: 2 }, fallbacks: [ { tool: 'android_clipboard', description: 'Use clipboard to paste text', argsTransform: clipboardSetFallback }, ], errorMap: DEFAULT_ERROR_MAP },

  android_dump: { name: 'android_dump', maxRetries: 2, retryConfig: { maxRetries: 2, backoffMs: 400, backoffMultiplier: 2 }, fallbacks: [ { tool: 'android_screen', description: 'Read screen text when XML dump fails', argsTransform: screenFallback }, ], errorMap: DEFAULT_ERROR_MAP },

  android_find_and_tap: { name: 'android_find_and_tap', maxRetries: 2, retryConfig: { maxRetries: 2, backoffMs: 500, backoffMultiplier: 1.5 }, fallbacks: [ { tool: 'android_dump', description: 'Dump UI then find and tap manually', argsTransform: dumpScreenFallback }, ], errorMap: DEFAULT_ERROR_MAP },

  android_devices: { name: 'android_devices', maxRetries: 2, retryConfig: { maxRetries: 2, backoffMs: 1000, backoffMultiplier: 2 }, fallbacks: [], errorMap: { ...DEFAULT_ERROR_MAP, [ToolErrorType.PERMISSION_DENIED]: 'fail' } },

  android_app: { name: 'android_app', maxRetries: 1, retryConfig: { maxRetries: 1, backoffMs: 500, backoffMultiplier: 1.5 }, fallbacks: [ { tool: 'android_shell', description: 'Try am start/stop via shell', argsTransform: appShellFallback }, ], errorMap: DEFAULT_ERROR_MAP },

  android_install: { name: 'android_install', maxRetries: 0, retryConfig: { maxRetries: 0, backoffMs: 0, backoffMultiplier: 1 }, fallbacks: [], errorMap: { ...DEFAULT_ERROR_MAP, [ToolErrorType.NETWORK_ERROR]: 'retry', [ToolErrorType.TIMEOUT]: 'fail' } },

  android_push: { name: 'android_push', maxRetries: 1, retryConfig: { maxRetries: 1, backoffMs: 1000, backoffMultiplier: 2 }, fallbacks: [ { tool: 'android_shell', description: 'Try adb push via shell', argsTransform: pushShellFallback }, ], errorMap: { ...DEFAULT_ERROR_MAP, [ToolErrorType.NETWORK_ERROR]: 'retry' } },

  android_pull: { name: 'android_pull', maxRetries: 1, retryConfig: { maxRetries: 1, backoffMs: 1000, backoffMultiplier: 2 }, fallbacks: [ { tool: 'android_shell', description: 'Try adb pull via shell', argsTransform: pullShellFallback }, ], errorMap: { ...DEFAULT_ERROR_MAP, [ToolErrorType.NETWORK_ERROR]: 'retry' } },

  android_battery: { name: 'android_battery', maxRetries: 2, retryConfig: { maxRetries: 2, backoffMs: 300, backoffMultiplier: 2 }, fallbacks: [ { tool: 'android_shell', description: 'Get battery via shell dumpsys', argsTransform: batteryShellFallback }, ], errorMap: DEFAULT_ERROR_MAP },

  android_info: { name: 'android_info', maxRetries: 2, retryConfig: { maxRetries: 2, backoffMs: 500, backoffMultiplier: 2 }, fallbacks: [ { tool: 'android_shell', description: 'Get device info via shell getprop', argsTransform: infoShellFallback }, ], errorMap: DEFAULT_ERROR_MAP },

  android_notifications: { name: 'android_notifications', maxRetries: 1, retryConfig: { maxRetries: 1, backoffMs: 300, backoffMultiplier: 2 }, fallbacks: [], errorMap: DEFAULT_ERROR_MAP },

  android_clipboard: { name: 'android_clipboard', maxRetries: 1, retryConfig: { maxRetries: 1, backoffMs: 300, backoffMultiplier: 2 }, fallbacks: [ { tool: 'android_shell', description: 'Try clipboard via shell', argsTransform: clipboardShellFallback }, ], errorMap: DEFAULT_ERROR_MAP },

  android_termux: { name: 'android_termux', maxRetries: 2, retryConfig: { maxRetries: 2, backoffMs: 500, backoffMultiplier: 2 }, fallbacks: [ { tool: 'android_shell', description: 'Run termux command via shell', argsTransform: termuxShellFallback }, ], errorMap: DEFAULT_ERROR_MAP },

  desktop_screenshot: { name: 'desktop_screenshot', maxRetries: 2, retryConfig: { maxRetries: 2, backoffMs: 500, backoffMultiplier: 2 }, fallbacks: [ { tool: 'shell', description: 'Use native screenshot command', argsTransform: desktopScreenshotFallback }, ], errorMap: DEFAULT_ERROR_MAP },

  screen_read: { name: 'screen_read', maxRetries: 2, retryConfig: { maxRetries: 2, backoffMs: 500, backoffMultiplier: 2 }, fallbacks: [ { tool: 'desktop_screenshot', description: 'Fallback to screenshot path', argsTransform: screenReadFallback }, ], errorMap: DEFAULT_ERROR_MAP },

  desktop_open: { name: 'desktop_open', maxRetries: 1, retryConfig: { maxRetries: 1, backoffMs: 300, backoffMultiplier: 1.5 }, fallbacks: [ { tool: 'shell', description: 'Use open/start/xdg-open', argsTransform: desktopOpenShell }, ], errorMap: { ...DEFAULT_ERROR_MAP, [ToolErrorType.NOT_FOUND]: 'fail' } },

  shell: { name: 'shell', maxRetries: 2, retryConfig: { maxRetries: 2, backoffMs: 500, backoffMultiplier: 2 }, fallbacks: [ { tool: 'bash', description: 'Try bash explicitly', argsTransform: bashFallback }, ], errorMap: { ...DEFAULT_ERROR_MAP, [ToolErrorType.TIMEOUT]: 'retry', [ToolErrorType.NETWORK_ERROR]: 'retry' } },

  file_read: { name: 'file_read', maxRetries: 1, retryConfig: { maxRetries: 1, backoffMs: 200, backoffMultiplier: 2 }, fallbacks: [ { tool: 'shell', description: 'Try cat as fallback', argsTransform: catFallback }, ], errorMap: { ...DEFAULT_ERROR_MAP, [ToolErrorType.NOT_FOUND]: 'fail' } },

  file_write: { name: 'file_write', maxRetries: 1, retryConfig: { maxRetries: 1, backoffMs: 300, backoffMultiplier: 1.5 }, fallbacks: [ { tool: 'shell', description: 'Try echo/tee as fallback', argsTransform: teeFallback }, ], errorMap: { ...DEFAULT_ERROR_MAP, [ToolErrorType.PERMISSION_DENIED]: 'fail' } },

  web_search: { name: 'web_search', maxRetries: 2, retryConfig: { maxRetries: 2, backoffMs: 1000, backoffMultiplier: 2 }, fallbacks: [ { tool: 'shell', description: 'Try curl-based search fallback', argsTransform: curlSearchFallback }, ], errorMap: { ...DEFAULT_ERROR_MAP, [ToolErrorType.RATE_LIMIT]: 'retry' } },

  duck_run: { name: 'duck_run', maxRetries: 2, retryConfig: { maxRetries: 2, backoffMs: 2000, backoffMultiplier: 2 }, fallbacks: [], errorMap: { ...DEFAULT_ERROR_MAP, [ToolErrorType.TIMEOUT]: 'retry', [ToolErrorType.RATE_LIMIT]: 'retry' } },

  duck_council: { name: 'duck_council', maxRetries: 1, retryConfig: { maxRetries: 1, backoffMs: 3000, backoffMultiplier: 2 }, fallbacks: [], errorMap: { ...DEFAULT_ERROR_MAP, [ToolErrorType.TIMEOUT]: 'retry' } },

  provider_list: { name: 'provider_list', maxRetries: 1, retryConfig: { maxRetries: 1, backoffMs: 500, backoffMultiplier: 2 }, fallbacks: [ { tool: 'shell', description: 'Check env vars directly', argsTransform: envCheckFallback }, ], errorMap: DEFAULT_ERROR_MAP },

  memory_remember: { name: 'memory_remember', maxRetries: 0, retryConfig: { maxRetries: 0, backoffMs: 0, backoffMultiplier: 1 }, fallbacks: [], errorMap: { ...DEFAULT_ERROR_MAP, [ToolErrorType.UNKNOWN]: 'fail' } },

  memory_recall: { name: 'memory_recall', maxRetries: 0, retryConfig: { maxRetries: 0, backoffMs: 0, backoffMultiplier: 1 }, fallbacks: [], errorMap: { ...DEFAULT_ERROR_MAP, [ToolErrorType.UNKNOWN]: 'fail' } },

  session_search: { name: 'session_search', maxRetries: 0, retryConfig: { maxRetries: 0, backoffMs: 0, backoffMultiplier: 1 }, fallbacks: [], errorMap: { ...DEFAULT_ERROR_MAP, [ToolErrorType.UNKNOWN]: 'fail' } },

  workflow_run: { name: 'workflow_run', maxRetries: 0, retryConfig: { maxRetries: 0, backoffMs: 0, backoffMultiplier: 1 }, fallbacks: [], errorMap: { ...DEFAULT_ERROR_MAP, [ToolErrorType.UNKNOWN]: 'fail' } },

  plan_create: { name: 'plan_create', maxRetries: 0, retryConfig: { maxRetries: 0, backoffMs: 0, backoffMultiplier: 1 }, fallbacks: [], errorMap: { ...DEFAULT_ERROR_MAP, [ToolErrorType.UNKNOWN]: 'fail' } },

  speculate: { name: 'speculate', maxRetries: 0, retryConfig: { maxRetries: 0, backoffMs: 0, backoffMultiplier: 1 }, fallbacks: [], errorMap: { ...DEFAULT_ERROR_MAP, [ToolErrorType.UNKNOWN]: 'fail' } },

  agent_spawn: { name: 'agent_spawn', maxRetries: 0, retryConfig: { maxRetries: 0, backoffMs: 0, backoffMultiplier: 1 }, fallbacks: [], errorMap: { ...DEFAULT_ERROR_MAP, [ToolErrorType.UNKNOWN]: 'fail' } },

  agent_spawn_team: { name: 'agent_spawn_team', maxRetries: 0, retryConfig: { maxRetries: 0, backoffMs: 0, backoffMultiplier: 1 }, fallbacks: [], errorMap: { ...DEFAULT_ERROR_MAP, [ToolErrorType.UNKNOWN]: 'fail' } },

  think_parallel: { name: 'think_parallel', maxRetries: 0, retryConfig: { maxRetries: 0, backoffMs: 0, backoffMultiplier: 1 }, fallbacks: [], errorMap: { ...DEFAULT_ERROR_MAP, [ToolErrorType.UNKNOWN]: 'fail' } },

};

export function getToolRetryConfig(toolName) { return TOOL_RETRY_REGISTRY[toolName] || null; }
export function shouldRetryOnError(entry, errorType) { return entry.errorMap[errorType] === 'retry'; }
export function shouldFallbackOnError(entry, errorType) { return entry.errorMap[errorType] === 'fallback' && entry.fallbacks.length > 0; }

export function classifyError(error, toolName) {
  const msg = (error && (error.message || error.stderr || String(error))) || '';
  const lower = msg.toLowerCase();
  if (lower.includes('econnrefused') || lower.includes('enetunreach') || lower.includes('enotfound') || lower.includes('connection refused') || lower.includes('connection reset') || lower.includes('socket hang up') || lower.includes('etimedout') || lower.includes('connect etimedout') || lower.includes('getaddrinfo')) return ToolErrorType.NETWORK_ERROR;
  if (lower.includes('timeout') || lower.includes('timed out') || lower.includes('request timeout')) return ToolErrorType.TIMEOUT;
  if (lower.includes('permission denied') || lower.includes('eacces') || lower.includes('denied') || lower.includes('not authorized') || lower.includes('authentication failed') || lower.includes('unauthorized') || lower.includes('access denied')) return ToolErrorType.PERMISSION_DENIED;
  if (lower.includes('not found') || lower.includes('enoent') || lower.includes('no such file') || lower.includes('does not exist') || lower.includes('device not found') || lower.includes('adb: no devices')) return ToolErrorType.NOT_FOUND;
  if (lower.includes('rate limit') || lower.includes('too many requests') || lower.includes('429') || lower.includes('throttl') || lower.includes('retry after')) return ToolErrorType.RATE_LIMIT;
  return ToolErrorType.UNKNOWN;
}

export function logEvent(event, data) {
  const ts = new Date().toISOString();
  if (event === 'TOOL_CALL') return '[TOOL_CALL] timestamp=' + ts + ' tool=' + data.tool + ' attempt=' + data.attempt + '/' + data.maxAttempts;
  if (event === 'TOOL_SUCCESS') return '[TOOL_SUCCESS] timestamp=' + ts + ' tool=' + data.tool + ' duration=' + data.durationMs + 'ms';
  if (event === 'TOOL_RETRY') return '[TOOL_RETRY] timestamp=' + ts + ' tool=' + data.tool + ' error="' + data.error + '" attempt=' + data.attempt + '/' + data.maxAttempts + ' wait=' + data.waitMs + 'ms';
  if (event === 'TOOL_FALLBACK') return '[TOOL_FALLBACK] timestamp=' + ts + ' tool=' + data.tool + ' trying=' + data.fallback;
  if (event === 'TOOL_FAIL') return '[TOOL_FAIL] timestamp=' + ts + ' tool=' + data.tool + ' error="' + data.error + '" attempts=' + data.attempt + '/' + data.maxAttempts;
}

export default TOOL_RETRY_REGISTRY;
