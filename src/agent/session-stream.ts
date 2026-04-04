/**
 * ACPX-Style Session Stream - NDJSON Append-Only Persistence
 * Inspired by: https://github.com/openclaw/acpx (session-persistence + session-event-log)
 *
 * Features:
 * - Append-only NDJSON stream (one ACP JSON-RPC message per line)
 * - Segment rotation (64MB max per segment, 5 segments max)
 * - Crash-safe: partial final line ignored on replay
 * - Checkpoint projection from stream replay
 * - Lock file for safe write coordination
 */

import { createHash, randomUUID } from "crypto";
import { appendFileSync, closeSync, existsSync, mkdirSync, openSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from "fs";
import { open } from "fs/promises";
import { basename, dirname, join } from "path";

export type StreamOutcome = "ok" | "timed_out" | "failed" | "cancelled";

// ACPX-style session record schema
export interface SessionCheckpoint {
  schema: "duck.session.v1";
  acpx_record_id: string;
  acp_session_id: string;
  agent_session_id: string;
  name: string;
  created_at: string;
  last_used_at: string;
  last_seq: number;
  last_request_id: string;
  event_log: {
    active_path: string;
    segment_count: number;
    max_segment_bytes: number;
    max_segments: number;
    last_write_at: string;
    last_write_error: string | null;
  };
  title: string | null;
  messages: SessionStreamMessage[];
  cumulative_token_usage: Record<string, number>;
  request_token_usage: Record<string, number>;
  current_mode_id: string;
  available_commands: string[];
  outcome?: StreamOutcome;
}

export interface SessionStreamMessage {
  jsonrpc: "2.0";
  id?: string;
  method?: string;
  params?: any;
  result?: any;
  error?: { code: number; message: string; data?: any };
  // Duck-specific extensions (not part of ACP wire protocol)
  _duck?: {
    role?: "user" | "assistant" | "tool";
    toolName?: string;
    toolResult?: string;
    tokens?: number;
    cost?: number;
    outcome?: StreamOutcome;
    durationMs?: number;
  };
}

const DEFAULT_SESSION_DIR = join(process.env.HOME || "/tmp", ".duck", "sessions");
const MAX_SEGMENT_BYTES = 64 * 1024 * 1024; // 64MB
const MAX_SEGMENTS = 5;

export class SessionStream {
  private recordId: string;
  private sessionDir: string;
  private streamPath: string;
  private checkpointPath: string;
  private lockPath: string;
  private segmentCount = 0;
  private lastSeq = 0;
  private lastRequestId = "";
  private messageCount = 0;
  private messages: SessionStreamMessage[] = [];
  private pendingWrite = "";
  private fd: number = -1;
  private closed = false;

  constructor(sessionDir = DEFAULT_SESSION_DIR, name = "default", recordId?: string) {
    this.recordId = recordId || `duck-${Date.now()}-${randomUUID().slice(0, 8)}`;
    this.sessionDir = sessionDir;
    mkdirSync(this.sessionDir, { recursive: true });

    // Stream path with segment support
    this.streamPath = join(this.sessionDir, `${this.recordId}.stream.ndjson`);
    this.checkpointPath = join(this.sessionDir, `${this.recordId}.json`);
    this.lockPath = join(this.sessionDir, `${this.recordId}.stream.lock`);

    // Check for existing segments
    this.discoverSegments();
  }

  getRecordId(): string { return this.recordId; }
  getCheckpointPath(): string { return this.checkpointPath; }
  getStreamPath(): string { return this.streamPath; }

  private discoverSegments(): void {
    const base = join(this.sessionDir, `${this.recordId}.stream`);
    let seg = 0;
    while (true) {
      const path = seg === 0 ? `${base}.ndjson` : `${base}.${seg}.ndjson`;
      if (existsSync(path)) {
        this.segmentCount = seg + 1;
        const stat = statSync(path);
        if (stat.size >= MAX_SEGMENT_BYTES) seg++;
        else break;
      } else {
        break;
      }
      if (seg > MAX_SEGMENTS) break;
    }
    this.streamPath = seg === 0 ? `${base}.ndjson` : `${base}.${seg}.ndjson`;
  }

  private acquireLock(): boolean {
    try {
      if (existsSync(this.lockPath)) {
        const lockAge = Date.now() - statSync(this.lockPath).mtimeMs;
        if (lockAge > 30000) {
          // Stale lock, remove it
          unlinkSync(this.lockPath);
        } else {
          return false;
        }
      }
      writeFileSync(this.lockPath, JSON.stringify({ pid: process.pid, ts: Date.now() }));
      return true;
    } catch {
      return false;
    }
  }

  private releaseLock(): void {
    try { unlinkSync(this.lockPath); } catch {}
  }

  private getCurrentStreamSize(): number {
    try { return statSync(this.streamPath).size; } catch { return 0; }
  }

  private rotateSegment(): void {
    const oldPath = this.streamPath;
    this.segmentCount++;
    const base = join(this.sessionDir, `${this.recordId}.stream`);
    this.streamPath = `${base}.${this.segmentCount}.ndjson`;

    // Check segment limit - remove oldest if needed
    if (this.segmentCount > MAX_SEGMENTS) {
      const oldestSeg = this.segmentCount - MAX_SEGMENTS;
      const oldestPath = oldestSeg === 0
        ? join(this.sessionDir, `${this.recordId}.stream.ndjson`)
        : join(this.sessionDir, `${this.recordId}.stream.${oldestSeg}.ndjson`);
      try { unlinkSync(oldestPath); } catch {}
    }

    try {
      renameSync(oldPath, oldPath.replace(".ndjson", `.${this.segmentCount - 1}.ndjson`));
      this.streamPath = join(this.sessionDir, `${this.recordId}.stream.ndjson`);
    } catch {}
  }

  // Append a message to the stream (ACPX-style)
  append(method: string, params?: any, options?: {
    id?: string;
    result?: any;
    error?: any;
    duck?: SessionStreamMessage["_duck"];
  }): void {
    if (this.closed) return;

    if (!this.acquireLock()) {
      console.warn("[SessionStream] Could not acquire lock, skipping write");
      return;
    }

    try {
      const msg: SessionStreamMessage = {
        jsonrpc: "2.0",
        id: options?.id || `req-${++this.lastSeq}`,
        method,
        params,
        ...(options?.result !== undefined ? { result: options.result } : {}),
        ...(options?.error ? { error: options.error } : {}),
        ...(options?.duck ? { _duck: options.duck } : {}),
      };

      this.lastRequestId = msg.id || "";
      this.lastSeq++;
      this.messageCount++;
      if (options?.duck) this.messages.push(msg);

      const line = JSON.stringify(msg) + "\n";

      // Check rotation
      if (this.getCurrentStreamSize() + line.length > MAX_SEGMENT_BYTES) {
        this.rotateSegment();
      }

      appendFileSync(this.streamPath, line, "utf8");
      this.updateCheckpoint();
    } finally {
      this.releaseLock();
    }
  }

  // ACPX-style notification (no id, no result)
  notify(method: string, params?: any, duck?: SessionStreamMessage["_duck"]): void {
    if (this.closed) return;
    if (!this.acquireLock()) return;

    try {
      const msg: SessionStreamMessage = {
        jsonrpc: "2.0",
        method,
        params,
        ...(duck ? { _duck: duck } : {}),
      };

      this.messageCount++;
      if (duck) this.messages.push(msg);

      const line = JSON.stringify(msg) + "\n";
      if (this.getCurrentStreamSize() + line.length > MAX_SEGMENT_BYTES) {
        this.rotateSegment();
      }

      appendFileSync(this.streamPath, line, "utf8");
    } finally {
      this.releaseLock();
    }
  }

  private updateCheckpoint(): void {
    const checkpoint: SessionCheckpoint = {
      schema: "duck.session.v1",
      acpx_record_id: this.recordId,
      acp_session_id: this.recordId,
      agent_session_id: this.recordId,
      name: "duck-session",
      created_at: new Date(0).toISOString(),
      last_used_at: new Date().toISOString(),
      last_seq: this.lastSeq,
      last_request_id: this.lastRequestId,
      event_log: {
        active_path: this.streamPath,
        segment_count: this.segmentCount || 1,
        max_segment_bytes: MAX_SEGMENT_BYTES,
        max_segments: MAX_SEGMENTS,
        last_write_at: new Date().toISOString(),
        last_write_error: null,
      },
      title: null,
      messages: this.messages.slice(-100), // Keep last 100 for quick access
      cumulative_token_usage: {},
      request_token_usage: {},
      current_mode_id: "duck",
      available_commands: ["session/set_mode", "session/set_config_option"],
    };

    try {
      writeFileSync(this.checkpointPath, JSON.stringify(checkpoint, null, 2));
    } catch (e) {
      console.warn("[SessionStream] Checkpoint write failed:", e);
    }
  }

  // Replay stream and rebuild checkpoint (ACPX repair on startup)
  replay(): { messages: SessionStreamMessage[]; errors: string[] } {
    const messages: SessionStreamMessage[] = [];
    const errors: string[] = [];
    let seq = 0;

    // Read all segments in order
    const segments: string[] = [];
    const base = join(this.sessionDir, `${this.recordId}.stream`);

    // Collect all existing segments
    segments.push(`${base}.ndjson`);
    for (let i = 1; i <= 20; i++) {
      const segPath = `${base}.${i}.ndjson`;
      if (existsSync(segPath)) segments.push(segPath);
      else break;
    }

    for (const segPath of segments) {
      try {
        const content = readFileSync(segPath, "utf8");
        const lines = content.split("\n");

        for (const line of lines) {
          if (!line.trim()) continue; // Skip empty lines
          try {
            const msg = JSON.parse(line) as SessionStreamMessage;
            if (msg.jsonrpc !== "2.0") {
              errors.push(`Invalid JSON-RPC version in ${segPath}`);
              continue;
            }
            messages.push(msg);
            seq++;
            if (msg.id) this.lastRequestId = msg.id;
          } catch (e) {
            // Trailing partial final line: ignore
            errors.push(`Parse error in ${segPath}: ${(e as Error).message}`);
          }
        }
      } catch (e) {
        errors.push(`Could not read segment ${segPath}: ${(e as Error).message}`);
      }
    }

    this.lastSeq = seq;
    this.messageCount = messages.length;
    this.messages = messages.slice(-100);

    // Rebuild checkpoint
    this.updateCheckpoint();

    return { messages, errors };
  }

  // Get checkpoint
  getCheckpoint(): SessionCheckpoint | null {
    try {
      if (!existsSync(this.checkpointPath)) return null;
      return JSON.parse(readFileSync(this.checkpointPath, "utf8")) as SessionCheckpoint;
    } catch {
      return null;
    }
  }

  // Get recent messages from checkpoint
  getRecentMessages(limit = 50): SessionStreamMessage[] {
    return this.messages.slice(-limit);
  }

  close(outcome?: StreamOutcome): void {
    if (this.closed) return;
    this.closed = true;

    if (outcome) {
      this.notify("session/end", { outcome }, { outcome });
    }

    this.updateCheckpoint();
    console.log(`[SessionStream] Closed session ${this.recordId}, ${this.messageCount} messages across ${this.segmentCount || 1} segments`);
  }

  // List all sessions in directory
  static listSessions(sessionDir = DEFAULT_SESSION_DIR): Array<{ recordId: string; checkpoint: SessionCheckpoint }> {
    const results: Array<{ recordId: string; checkpoint: SessionCheckpoint }> = [];
    try {
      if (!existsSync(sessionDir)) return results;
      const files = require("fs").readdirSync(sessionDir);

      for (const file of files) {
        if (file.endsWith(".json") && !file.includes(".stream.")) {
          try {
            const checkpoint = JSON.parse(readFileSync(join(sessionDir, file), "utf8")) as SessionCheckpoint;
            if (checkpoint.schema === "duck.session.v1") {
              results.push({ recordId: checkpoint.acpx_record_id, checkpoint });
            }
          } catch {}
        }
      }
    } catch {}

    return results.sort((a, b) =>
      new Date(b.checkpoint.last_used_at).getTime() - new Date(a.checkpoint.last_used_at).getTime()
    );
  }
}

export default SessionStream;
