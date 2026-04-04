/**
 * 🦆 Duck Agent - Execution Tracing
 * Debug agent decisions, track token usage, measure latency
 */

import * as fs from 'fs';
import * as path from 'path';
import { homedir } from 'os';
import { randomUUID } from 'crypto';

export interface TraceEvent {
  id: string;
  timestamp: string;
  type: 'span' | 'log' | 'metric' | 'error';
  name: string;
  duration?: number;
  metadata?: Record<string, any>;
  parentId?: string;
}

export interface Trace {
  id: string;
  sessionId: string;
  createdAt: string;
  events: TraceEvent[];
  stats: TraceStats;
}

export interface TraceStats {
  totalTokens?: number;
  inputTokens?: number;
  outputTokens?: number;
  totalMs: number;
  provider?: string;
  model?: string;
}

interface ActiveSpan {
  name: string;
  startTime: number;
  parentId?: string;
}

export class ExecutionTracer {
  private activeTrace: Trace | null = null;
  private spanStack: ActiveSpan[] = [];
  private DATA_DIR: string;
  private tracesDir: string;

  constructor() {
    this.DATA_DIR = path.join(homedir(), '.duckagent', 'tracing');
    this.tracesDir = path.join(this.DATA_DIR, 'traces');
    this.ensureDirs();
  }

  private ensureDirs(): void {
    if (!fs.existsSync(this.DATA_DIR)) {
      fs.mkdirSync(this.DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(this.tracesDir)) {
      fs.mkdirSync(this.tracesDir, { recursive: true });
    }
  }

  /**
   * Start a new trace for a session
   */
  startTrace(sessionId: string): string {
    const traceId = randomUUID();
    this.activeTrace = {
      id: traceId,
      sessionId,
      createdAt: new Date().toISOString(),
      events: [],
      stats: { totalMs: 0 }
    };
    return traceId;
  }

  /**
   * End the current trace
   */
  endTrace(stats?: Partial<TraceStats>): Trace | null {
    if (!this.activeTrace) return null;

    const trace = this.activeTrace;
    trace.stats = { ...trace.stats, ...stats };
    
    // Calculate total duration from spans
    const totalMs = trace.events
      .filter(e => e.type === 'span' && e.duration)
      .reduce((sum, e) => sum + (e.duration || 0), 0);
    trace.stats.totalMs = totalMs;

    // Save trace to disk
    const filePath = path.join(this.tracesDir, `${trace.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(trace, null, 2));

    this.activeTrace = null;
    this.spanStack = [];
    return trace;
  }

  /**
   * Start a span (timed operation)
   */
  startSpan(name: string): string {
    const spanId = randomUUID();
    const parentId = this.spanStack.length > 0 
      ? this.spanStack[this.spanStack.length - 1].name 
      : undefined;
    
    this.spanStack.push({ name, startTime: Date.now(), parentId });
    
    this.log('span', 'start', { spanId, name, parentId });
    return spanId;
  }

  /**
   * End a span
   */
  endSpan(name: string, metadata?: Record<string, any>): number {
    const spanIndex = this.spanStack.findIndex(s => s.name === name);
    if (spanIndex === -1) return 0;

    const span = this.spanStack.splice(spanIndex, 1)[0];
    const duration = Date.now() - span.startTime;

    this.log('span', 'end', { name, duration, metadata });
    return duration;
  }

  /**
   * Log an event
   */
  log(type: TraceEvent['type'], name: string, metadata?: Record<string, any>): void {
    if (!this.activeTrace) return;

    const event: TraceEvent = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      type,
      name,
      metadata
    };

    if (type === 'span' && metadata?.duration) {
      event.duration = metadata.duration;
    }

    this.activeTrace.events.push(event);
  }

  /**
   * Log metrics (tokens, latency, etc.)
   */
  logMetrics(metrics: Partial<TraceStats>): void {
    if (!this.activeTrace) return;
    this.activeTrace.stats = { ...this.activeTrace.stats, ...metrics };
    this.log('metric', 'metrics', metrics);
  }

  /**
   * Log an error
   */
  logError(name: string, error: Error | string): void {
    this.log('error', name, {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined
    });
  }

  /**
   * Get all traces for a session
   */
  getTraces(sessionId?: string): Trace[] {
    const files = fs.readdirSync(this.tracesDir);
    const traces: Trace[] = [];

    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      try {
        const trace = JSON.parse(fs.readFileSync(path.join(this.tracesDir, file), 'utf-8'));
        if (!sessionId || trace.sessionId === sessionId) {
          traces.push(trace);
        }
      } catch {}
    }

    return traces.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  /**
   * Get a specific trace
   */
  getTrace(traceId: string): Trace | null {
    const filePath = path.join(this.tracesDir, `${traceId}.json`);
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  }

  /**
   * Delete old traces (keep last N)
   */
  pruneTraces(keepLast: number = 100): number {
    const traces = this.getTraces();
    let deleted = 0;

    for (let i = keepLast; i < traces.length; i++) {
      const filePath = path.join(this.tracesDir, `${traces[i].id}.json`);
      fs.unlinkSync(filePath);
      deleted++;
    }

    return deleted;
  }

  /**
   * Get trace stats summary
   */
  getStats(): { totalTraces: number; totalTokens: number; avgLatencyMs: number } {
    const traces = this.getTraces();
    const totalTokens = traces.reduce((sum, t) => sum + (t.stats.totalTokens || 0), 0);
    const avgLatencyMs = traces.length > 0 
      ? traces.reduce((sum, t) => sum + t.stats.totalMs, 0) / traces.length 
      : 0;

    return {
      totalTraces: traces.length,
      totalTokens,
      avgLatencyMs: Math.round(avgLatencyMs)
    };
  }
}

export const tracer = new ExecutionTracer();

/**
 * Decorator for tracing async functions
 */
export function traced(name?: string) {
  return function<T extends (...args: any[]) => Promise<any>>(
    target: T,
    context: ClassMethodDecoratorContext
  ): T {
    return async function(this: any, ...args: Parameters<T>): Promise<ReturnType<T>> {
      const spanName = name || context.name.toString();
      tracer.startSpan(spanName);
      try {
        const result = await target.apply(this, args);
        tracer.endSpan(spanName, { success: true });
        return result;
      } catch (error) {
        tracer.endSpan(spanName, { success: false });
        tracer.logError(spanName, error as Error);
        throw error;
      }
    } as T;
  };
}
