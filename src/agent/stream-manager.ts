/**
 * Duck Agent - Streaming Event System
 * SSE streaming for real-time tool output
 */

import { Readable } from 'stream';
import type { Whisper } from '../subconscious/index.js';

export type StreamEventType = 
  | 'tool_start' | 'tool_output' | 'tool_end' | 'tool_error'
  | 'thinking' | 'plan_step' | 'plan_progress'
  | 'guard_block' | 'guard_warn'
  | 'memory_save' | 'session_start' | 'session_end' | 'error' | 'connected' | 'whisper';

export interface StreamEvent {
  type: StreamEventType;
  sessionId: string;
  timestamp: number;
  data: Record<string, any>;
}

export class StreamManager {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private sessions: any = {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private globalStreams: any = new Set();
  private eventLog: StreamEvent[] = [];
  private maxLogSize: number = 10000;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  addGlobalStream(stream: Readable): void { this.globalStreams.add(stream); }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  removeGlobalStream(stream: Readable): void { this.globalStreams.delete(stream); }
  addSessionStream(sessionId: string, stream: Readable): void {
    if (!this.sessions[sessionId]) this.sessions[sessionId] = new Set();
    this.sessions[sessionId].add(stream);
  }
  removeSessionStream(sessionId: string, stream: Readable): void {
    if (this.sessions[sessionId]) {
      this.sessions[sessionId].delete(stream);
      if (this.sessions[sessionId].size === 0) delete this.sessions[sessionId];
    }
  }

  private broadcast(event: StreamEvent): void {
    this.eventLog.push(event);
    if (this.eventLog.length > this.maxLogSize) this.eventLog.splice(0, this.eventLog.length - this.maxLogSize);
    const data = `data: ${JSON.stringify(event)}\n\n`;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const s of (this.globalStreams as Set<Readable>)) { try { (s as any).push(data); } catch {} }
    if (this.sessions[event.sessionId]) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const s of (this.sessions[event.sessionId] as Set<Readable>)) { try { (s as any).push(data); } catch {} }
    }
  }

  createSessionStream(sessionId: string): Readable {
    const stream = new Readable({ read() {} });
    const data = `data: ${JSON.stringify({ type: 'connected', sessionId, timestamp: Date.now() })}\n\n`;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (stream as any).push(data);
    this.addSessionStream(sessionId, stream);
    return stream;
  }

  createGlobalStream(): Readable {
    const stream = new Readable({ read() {} });
    const data = `data: ${JSON.stringify({ type: 'connected', timestamp: Date.now() })}\n\n`;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (stream as any).push(data);
    this.addGlobalStream(stream);
    return stream;
  }

  toolStart(sessionId: string, toolName: string, args: Record<string, any>): void {
    this.broadcast({ type: 'tool_start', sessionId, timestamp: Date.now(), data: { toolName, args } });
  }
  toolChunk(sessionId: string, toolName: string, chunk: string, isError = false): void {
    this.broadcast({ type: 'tool_output', sessionId, timestamp: Date.now(), data: { toolName, chunk, isError } });
  }
  toolEnd(sessionId: string, toolName: string, success: boolean, result?: string, errorMsg?: string, duration = 0): void {
    this.broadcast({ type: 'tool_end', sessionId, timestamp: Date.now(), data: { toolName, success, result, error: errorMsg, duration } });
  }
  thinking(sessionId: string, thought: string): void {
    this.broadcast({ type: 'thinking', sessionId, timestamp: Date.now(), data: { thought } });
  }
  planStep(sessionId: string, planId: string, step: string, status: string): void {
    this.broadcast({ type: 'plan_step', sessionId, timestamp: Date.now(), data: { planId, step, status } });
  }
  planProgress(sessionId: string, planId: string, progress: number, total: number): void {
    this.broadcast({ type: 'plan_progress', sessionId, timestamp: Date.now(), data: { planId, progress, total, pct: Math.round((progress / total) * 100) } });
  }
  guardBlock(sessionId: string, toolName: string, args: Record<string, any>, risk: string, reasons: string[]): void {
    this.broadcast({ type: 'guard_block', sessionId, timestamp: Date.now(), data: { toolName, args, risk, reasons } });
  }
  guardWarn(sessionId: string, toolName: string, args: Record<string, any>, risk: string, reasons: string[]): void {
    this.broadcast({ type: 'guard_warn', sessionId, timestamp: Date.now(), data: { toolName, args, risk, reasons } });
  }
  memorySave(sessionId: string, memoryId: string, content: string): void {
    this.broadcast({ type: 'memory_save', sessionId, timestamp: Date.now(), data: { memoryId, content: content.slice(0, 100) } });
  }
  sessionStart(sessionId: string, goal?: string): void {
    this.broadcast({ type: 'session_start', sessionId, timestamp: Date.now(), data: { sessionId, goal } });
  }
  sessionEnd(sessionId: string, outcome: string, duration: number, toolsUsed: string[]): void {
    this.broadcast({ type: 'session_end', sessionId, timestamp: Date.now(), data: { sessionId, outcome, duration, toolsUsed } });
  }
  error(sessionId: string, err: string, context?: string): void {
    this.broadcast({ type: 'error', sessionId, timestamp: Date.now(), data: { error: err, context } });
  }
  
  whisper(sessionId: string, whispers: Whisper[]): void {
    const prompt = whispers.map(w => `👻 ${w.message}`).join('\n');
    console.log(prompt);
    this.broadcast({ type: 'whisper', sessionId, timestamp: Date.now(), data: { whispers } });
  }

  getRecentEvents(sessionId?: string, limit = 50): StreamEvent[] {
    if (sessionId) return this.eventLog.filter(e => e.sessionId === sessionId).slice(-limit);
    return this.eventLog.slice(-limit);
  }
  getActiveSessions(): string[] { return Object.keys(this.sessions); }
  getSubscriberCount(sessionId?: string): number {
    if (sessionId) return this.sessions[sessionId] ? (this.sessions[sessionId] as Set<Readable>).size : 0;
    return (this.globalStreams as Set<Readable>).size;
  }
}

export const streamManager = new StreamManager();
export default streamManager;
