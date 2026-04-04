/**
 * 🦆 Duck CLI - Execution Trace System
 * Structured logging and step-by-step traces for agent execution visibility
 */

import * as fs from 'fs';
import * as path from 'path';
import { homedir } from 'os';

export interface TraceEvent {
  timestamp: number;
  type: 'agent_start' | 'agent_end' | 'thought' | 'tool_call' | 'tool_result' | 'tool_error' | 'retry' | 'fallback' | 'error';
  step: number;
  data: any;
  duration?: number;
}

export interface TraceSummary {
  totalSteps: number;
  toolCalls: number;
  errors: number;
  duration: number;
}

export interface ExecutionTraceFile {
  id: string;
  timestamp: string;
  sessionId?: string;
  summary: TraceSummary;
  events: TraceEvent[];
  errorReport?: ErrorReport;
}

export interface ErrorReport {
  whatFailed: string;
  whatWasTried: string[];
  recoveryAction: string;
  traceFile: string;
}

const EMOJI_MAP: Record<string, string> = {
  agent_start: '🤖',
  agent_end: '✅',
  thought: '💭',
  tool_call: '📱',
  tool_result: '✓',
  tool_error: '❌',
  retry: '🔄',
  fallback: '🔀',
  error: '🚨'
};

export class ExecutionTrace {
  events: TraceEvent[] = [];
  stepCount = 0;
  private startTime: number = 0;
  private traceId: string = '';
  private sessionId?: string;
  private isActive: boolean = false;
  private logDir: string;
  private verbose: boolean = false;
  private pendingError?: ErrorReport;

  constructor(sessionId?: string) {
    const home = homedir();
    this.logDir = path.join(home, '.duck', 'logs');
    this.sessionId = sessionId;
    this.ensureLogDir();
  }

  private ensureLogDir(): void {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  /**
   * Enable verbose console output
   */
  enableVerbose(): void {
    this.verbose = true;
  }

  /**
   * Disable verbose console output
   */
  disableVerbose(): void {
    this.verbose = false;
  }

  /**
   * Check if trace is enabled via environment variable
   */
  static isEnabled(): boolean {
    return process.env.DUCK_TRACE === '1';
  }

  /**
   * Start a new trace session
   */
  start(sessionId?: string): string {
    if (sessionId) this.sessionId = sessionId;
    this.traceId = `trace-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.startTime = Date.now();
    this.events = [];
    this.stepCount = 0;
    this.isActive = true;
    this.pendingError = undefined;

    this.log('agent_start', { sessionId: this.sessionId, traceId: this.traceId });

    if (this.verbose) {
      console.log(`[${this.cyan('TRACE')}] Started trace ${this.traceId}`);
    }

    return this.traceId;
  }

  /**
   * End the current trace and save to file
   */
  async end(): Promise<string | null> {
    if (!this.isActive) return null;

    this.log('agent_end', { duration: Date.now() - this.startTime });
    this.isActive = false;

    const traceFile = this.buildTraceFile();
    const filePath = path.join(this.logDir, `${this.traceId}.json`);

    // Async write to avoid slowing down execution
    await this.writeFileAsync(filePath, JSON.stringify(traceFile, null, 2));

    if (this.verbose) {
      const summary = this.getSummary();
      console.log(`[${this.cyan('TRACE')}] Saved to ${filePath}`);
      console.log(`[${this.cyan('TRACE')}] Summary: ${summary.totalSteps} steps, ${summary.toolCalls} tool calls, ${summary.errors} errors`);
    }

    return filePath;
  }

  /**
   * Log an event
   */
  log(type: string, data: any, duration?: number): void {
    if (!this.isActive && type !== 'agent_start') return;

    const event: TraceEvent = {
      timestamp: Date.now(),
      type: type as TraceEvent['type'],
      step: ++this.stepCount,
      data,
      duration
    };

    this.events.push(event);

    // Console output for verbose mode
    if (this.verbose && ExecutionTrace.isEnabled()) {
      this.printEvent(event);
    }
  }

  /**
   * Print event to console in the specified format
   */
  private printEvent(event: TraceEvent): void {
    const emoji = EMOJI_MAP[event.type] || '•';
    const step = `[Step ${event.step}]`;

    switch (event.type) {
      case 'agent_start':
        console.log(`${step} ${emoji} Agent started`);
        break;
      case 'agent_end':
        console.log(`${step} ${emoji} Agent completed`);
        break;
      case 'thought':
        console.log(`${step} ${emoji} Thinking...`);
        if (event.data && typeof event.data === 'string') {
          console.log(`       ${event.data.substring(0, 100)}${event.data.length > 100 ? '...' : ''}`);
        }
        break;
      case 'tool_call':
        console.log(`${step} ${emoji} Tool: ${event.data?.name || 'unknown'} - Args: ${JSON.stringify(event.data?.args || {}).substring(0, 80)}`);
        break;
      case 'tool_result':
        if (event.duration) {
          const ms = event.duration < 1000 ? `${event.duration}ms` : `${(event.duration / 1000).toFixed(1)}s`;
          console.log(`[Result] ${this.green('✓ Success')} (${ms})`);
        } else {
          console.log(`[Result] ${this.green('✓ Success')}`);
        }
        if (event.data) {
          const summary = typeof event.data === 'string' ? event.data.substring(0, 80) : JSON.stringify(event.data).substring(0, 80);
          console.log(`         ${summary}${summary.length >= 80 ? '...' : ''}`);
        }
        break;
      case 'tool_error':
        console.log(`[Result] ${this.red('✗ Error')} - ${event.data}`);
        break;
      case 'retry':
        console.log(`${step} ${emoji} Retry attempt ${event.data?.attempt || 1} - ${event.data?.reason || 'unknown'}`);
        break;
      case 'fallback':
        console.log(`${step} ${emoji} Fallback triggered - ${event.data?.reason || 'unknown'}`);
        break;
      case 'error':
        console.log(`${step} ${this.red('🚨 Error')}: ${event.data}`);
        break;
    }
  }

  /**
   * Log a tool call
   */
  logToolCall(toolName: string, args: any): void {
    this.log('tool_call', { name: toolName, args });
  }

  /**
   * Log a tool result
   */
  logToolResult(result: any, duration: number): void {
    this.log('tool_result', result, duration);
  }

  /**
   * Log a tool error
   */
  logToolError(error: string, duration?: number): void {
    this.log('tool_error', error, duration);
  }

  /**
   * Log a retry attempt
   */
  logRetry(attempt: number, reason: string): void {
    this.log('retry', { attempt, reason });
  }

  /**
   * Log a fallback trigger
   */
  logFallback(reason: string): void {
    this.log('fallback', { reason });
  }

  /**
   * Log an error
   */
  logError(error: string): void {
    this.log('error', error);
  }

  /**
   * Log agent thought
   */
  logThought(thought: string): void {
    this.log('thought', thought);
  }

  /**
   * Generate an error report
   */
  generateErrorReport(whatFailed: string, whatWasTried: string[], recoveryAction: string): void {
    this.pendingError = {
      whatFailed,
      whatWasTried,
      recoveryAction,
      traceFile: path.join(this.logDir, `${this.traceId}.json`)
    };
  }

  /**
   * Get trace summary
   */
  getSummary(): TraceSummary {
    const toolCalls = this.events.filter(e => e.type === 'tool_call').length;
    const errors = this.events.filter(e => e.type === 'error' || e.type === 'tool_error').length;
    const duration = this.startTime > 0 ? Date.now() - this.startTime : 0;

    return {
      totalSteps: this.stepCount,
      toolCalls,
      errors,
      duration
    };
  }

  /**
   * Build the trace file structure
   */
  private buildTraceFile(): ExecutionTraceFile {
    return {
      id: this.traceId,
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      summary: this.getSummary(),
      events: this.events,
      errorReport: this.pendingError
    };
  }

  /**
   * Export trace as JSON string
   */
  toJSON(): string {
    return JSON.stringify(this.buildTraceFile(), null, 2);
  }

  /**
   * Export trace as Markdown string
   */
  toMarkdown(): string {
    const lines: string[] = [];
    const summary = this.getSummary();

    lines.push(`# Execution Trace`);
    lines.push('');
    lines.push(`**Trace ID:** ${this.traceId}`);
    lines.push(`**Session:** ${this.sessionId || 'N/A'}`);
    lines.push(`**Timestamp:** ${new Date().toISOString()}`);
    lines.push('');
    lines.push(`## Summary`);
    lines.push('');
    lines.push(`| Metric | Value |`);
    lines.push(`|--------|-------|`);
    lines.push(`| Total Steps | ${summary.totalSteps} |`);
    lines.push(`| Tool Calls | ${summary.toolCalls} |`);
    lines.push(`| Errors | ${summary.errors} |`);
    lines.push(`| Duration | ${summary.duration}ms |`);
    lines.push('');

    if (this.pendingError) {
      lines.push(`## Error Report`);
      lines.push('');
      lines.push(`**What Failed:** ${this.pendingError.whatFailed}`);
      lines.push('');
      lines.push(`**What Was Tried:**`);
      this.pendingError.whatWasTried.forEach((item, i) => {
        lines.push(`  ${i + 1}. ${item}`);
      });
      lines.push('');
      lines.push(`**Recovery Action:** ${this.pendingError.recoveryAction}`);
      lines.push('');
    }

    lines.push(`## Events`);
    lines.push('');
    lines.push(`| Step | Type | Data | Duration |`);
    lines.push(`|------|------|------|----------|`);

    for (const event of this.events) {
      const emoji = EMOJI_MAP[event.type] || '•';
      const dataStr = typeof event.data === 'string' ? event.data : JSON.stringify(event.data);
      const dataPreview = dataStr.length > 50 ? dataStr.substring(0, 50) + '...' : dataStr;
      const duration = event.duration ? `${event.duration}ms` : '-';
      lines.push(`| ${event.step} | ${emoji} ${event.type} | ${dataPreview} | ${duration} |`);
    }

    return lines.join('\n');
  }

  /**
   * Get the trace ID
   */
  getTraceId(): string {
    return this.traceId;
  }

  /**
   * Check if trace is active
   */
  isTracing(): boolean {
    return this.isActive;
  }

  /**
   * Async file write helper
   */
  private writeFileAsync(filePath: string, content: string): Promise<void> {
    return new Promise((resolve, reject) => {
      fs.writeFile(filePath, content, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  // ANSI color helpers
  private cyan(s: string): string {
    return `\x1b[36m${s}\x1b[0m`;
  }

  private green(s: string): string {
    return `\x1b[32m${s}\x1b[0m`;
  }

  private red(s: string): string {
    return `\x1b[31m${s}\x1b[0m`;
  }
}

// Global trace instance
let globalTrace: ExecutionTrace | null = null;

/**
 * Get or create the global trace instance
 */
export function getGlobalTrace(): ExecutionTrace {
  if (!globalTrace) {
    globalTrace = new ExecutionTrace();
    if (ExecutionTrace.isEnabled()) {
      globalTrace.enableVerbose();
    }
  }
  return globalTrace;
}

/**
 * Start tracing if DUCK_TRACE=1
 */
export function maybeStartTrace(sessionId?: string): string | undefined {
  if (ExecutionTrace.isEnabled()) {
    return getGlobalTrace().start(sessionId);
  }
  return undefined;
}

/**
 * End tracing if active
 */
export async function maybeEndTrace(): Promise<string | null> {
  if (globalTrace && globalTrace.isTracing()) {
    return await globalTrace.end();
  }
  return null;
}
