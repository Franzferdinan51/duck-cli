/**
 * 🦆 Duck Agent - Tracing CLI Commands
 */

import { tracer, ExecutionTracer } from '../tracing/execution-tracer.js';

export const tracingCommands = {
  /**
   * Enable tracing for current session
   */
  enable(sessionId?: string): string {
    const traceId = tracer.startTrace(sessionId || 'default');
    return `Tracing enabled. Trace ID: ${traceId}`;
  },

  /**
   * Disable tracing and get final stats
   */
  disable(): string {
    const trace = tracer.endTrace();
    if (!trace) {
      return 'No active trace to end';
    }
    return `Trace completed:\n` +
      `- ID: ${trace.id}\n` +
      `- Duration: ${trace.stats.totalMs}ms\n` +
      `- Tokens: ${trace.stats.totalTokens || 0}\n` +
      `- Events: ${trace.events.length}`;
  },

  /**
   * View trace by ID
   */
  view(traceId: string): string {
    const trace = tracer.getTrace(traceId);
    if (!trace) {
      return `Trace not found: ${traceId}`;
    }

    let output = `Trace: ${trace.id}\n`;
    output += `Session: ${trace.sessionId}\n`;
    output += `Created: ${trace.createdAt}\n`;
    output += `Stats: ${JSON.stringify(trace.stats, null, 2)}\n\n`;
    output += `Events (${trace.events.length}):\n`;

    for (const event of trace.events.slice(-20)) {
      const time = new Date(event.timestamp).toISOString().split('T')[1].slice(0, -1);
      output += `[${time}] ${event.type}: ${event.name}`;
      if (event.duration) output += ` (${event.duration}ms)`;
      output += '\n';
    }

    return output;
  },

  /**
   * List traces for session
   */
  list(sessionId?: string): string {
    const traces = tracer.getTraces(sessionId);
    if (traces.length === 0) {
      return 'No traces found';
    }

    let output = `Traces (${traces.length}):\n`;
    for (const trace of traces.slice(0, 10)) {
      output += `\n${trace.id.slice(0, 8)}... | ${trace.sessionId} | ` +
        `${trace.stats.totalMs}ms | ${new Date(trace.createdAt).toLocaleString()}`;
    }
    return output;
  },

  /**
   * Get tracing stats
   */
  stats(): string {
    const stats = tracer.getStats();
    return `Tracing Statistics:\n` +
      `- Total Traces: ${stats.totalTraces}\n` +
      `- Total Tokens: ${stats.totalTokens}\n` +
      `- Avg Latency: ${stats.avgLatencyMs}ms`;
  },

  /**
   * Prune old traces
   */
  prune(keepLast: number = 100): string {
    const deleted = tracer.pruneTraces(keepLast);
    return `Pruned ${deleted} old traces (keeping ${keepLast})`;
  }
};

export default tracingCommands;
