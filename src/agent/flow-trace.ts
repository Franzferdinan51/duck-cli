/**
 * ACPX-Style Flow Trace & Replay System
 * Inspired by: https://github.com/openclaw/acpx (flow trace/replay)
 *
 * Features:
 * - Self-contained run bundles (~/.duck/flows/runs/<run-id>/)
 * - Append-only trace events (source of truth)
 * - Derived projections (status, step list, latest results)
 * - Content artifacts (prompt text, raw output, shell stdout)
 * - Replay without live global state
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, unlinkSync } from "fs";
import { join, dirname } from "path";
import { randomUUID } from "crypto";

export type FlowOutcome = "ok" | "timed_out" | "failed" | "cancelled";
export type NodeKind = "acp" | "action" | "compute" | "checkpoint" | "shell";

export interface FlowTraceEvent {
  event: "node_start" | "node_complete" | "node_output" | "node_error" | "flow_start" | "flow_complete" | "flow_cancel";
  timestamp: string;
  runId: string;
  nodeId?: string;
  nodeKind?: NodeKind;
  seq: number;
  data?: any;
  outcome?: FlowOutcome;
  durationMs?: number;
  error?: string;
  tokens?: number;
  cost?: number;
}

export interface FlowRunBundle {
  runId: string;
  flowName: string;
  flowDefPath: string;
  schema: "duck.flow-run.v1";
  createdAt: string;
  completedAt?: string;
  outcome?: FlowOutcome;
  status: "running" | "completed" | "failed" | "cancelled";
  currentNode?: string;
  totalSteps: number;
  completedSteps: number;
  tracePath: string;
  artifactsPath: string;
}

export interface FlowStepRecord {
  nodeId: string;
  nodeKind: NodeKind;
  startedAt: string;
  completedAt?: string;
  outcome?: FlowOutcome;
  output?: any;
  error?: string;
  tokens?: number;
  cost?: number;
  durationMs?: number;
  promptText?: string;
  rawOutput?: string;
  shellStdout?: string;
  shellStderr?: string;
}

const DEFAULT_FLOW_DIR = join(process.env.HOME || "/tmp", ".duck", "flows");
const DEFAULT_RUN_DIR = join(DEFAULT_FLOW_DIR, "runs");

export class FlowTrace {
  private runId: string;
  private runDir: string;
  private tracePath: string;
  private artifactsPath: string;
  private bundle: FlowRunBundle;
  private stepRecords: Map<string, FlowStepRecord> = new Map();
  private events: FlowTraceEvent[] = [];
  private seq = 0;
  private startedAt: string;
  private flowName: string;

  constructor(flowName: string, flowDefPath: string, runDir = DEFAULT_RUN_DIR) {
    this.runId = `run-${Date.now()}-${randomUUID().slice(0, 8)}`;
    this.runDir = join(runDir, this.runId);
    this.startedAt = new Date().toISOString();
    this.flowName = flowName;

    mkdirSync(this.runDir, { recursive: true });
    this.tracePath = join(this.runDir, "trace.ndjson");
    this.artifactsPath = join(this.runDir, "artifacts");
    mkdirSync(this.artifactsPath, { recursive: true });

    this.bundle = {
      runId: this.runId,
      flowName,
      flowDefPath,
      schema: "duck.flow-run.v1",
      createdAt: this.startedAt,
      status: "running",
      totalSteps: 0,
      completedSteps: 0,
      tracePath: this.tracePath,
      artifactsPath: this.artifactsPath,
    };

    this.writeBundle();
    this.emit({ event: "flow_start", data: { flowName, flowDefPath } });
  }

  getRunId(): string { return this.runId; }
  getBundle(): FlowRunBundle { return this.bundle; }
  getRunDir(): string { return this.runDir; }

  private emit(event: Omit<FlowTraceEvent, "timestamp" | "runId" | "seq">): void {
    const e: FlowTraceEvent = {
      ...event,
      timestamp: new Date().toISOString(),
      runId: this.runId,
      seq: ++this.seq,
    };
    this.events.push(e);

    // Append-only to trace file (crash-safe)
    try {
      writeFileSync(this.tracePath, JSON.stringify(e) + "\n", { flag: "a" });
    } catch {}
  }

  // Node lifecycle
  nodeStart(nodeId: string, nodeKind: NodeKind, promptText?: string): void {
    const record: FlowStepRecord = {
      nodeId,
      nodeKind,
      startedAt: new Date().toISOString(),
    };
    if (promptText) record.promptText = promptText;
    this.stepRecords.set(nodeId, record);

    this.emit({ event: "node_start", nodeId, nodeKind, data: { promptText } });
    this.bundle.totalSteps++;
    this.bundle.currentNode = nodeId;
    this.writeBundle();
  }

  nodeOutput(nodeId: string, output: any, tokens?: number, cost?: number): void {
    const record = this.stepRecords.get(nodeId);
    if (record) {
      record.output = output;
      if (tokens) record.tokens = tokens;
      if (cost) record.cost = cost;
    }

    // Save output artifact
    const artifactPath = join(this.artifactsPath, `${nodeId}.output.json`);
    try {
      writeFileSync(artifactPath, JSON.stringify(output, null, 2));
    } catch {}

    this.emit({ event: "node_output", nodeId, data: { output }, tokens, cost });
  }

  nodeComplete(nodeId: string, outcome: FlowOutcome, durationMs?: number, rawOutput?: string): void {
    const record = this.stepRecords.get(nodeId);
    if (record) {
      record.completedAt = new Date().toISOString();
      record.outcome = outcome;
      record.durationMs = durationMs;
      if (rawOutput) record.rawOutput = rawOutput;
    }

    this.emit({ event: "node_complete", nodeId, outcome, durationMs });
    this.bundle.completedSteps++;
    this.bundle.currentNode = undefined;
    this.writeBundle();
  }

  nodeError(nodeId: string, error: string, durationMs?: number): void {
    const record = this.stepRecords.get(nodeId);
    if (record) {
      record.completedAt = new Date().toISOString();
      record.outcome = "failed";
      record.error = error;
      record.durationMs = durationMs;
    }

    this.emit({ event: "node_error", nodeId, error, durationMs, outcome: "failed" });
    this.bundle.currentNode = undefined;
    this.writeBundle();
  }

  // Shell action artifacts
  saveShellArtifact(nodeId: string, stdout: string, stderr: string): void {
    const record = this.stepRecords.get(nodeId);
    if (record) {
      record.shellStdout = stdout.slice(0, 10000);
      record.shellStderr = stderr.slice(0, 1000);
    }

    try {
      writeFileSync(join(this.artifactsPath, `${nodeId}.stdout.txt`), stdout);
      if (stderr) writeFileSync(join(this.artifactsPath, `${nodeId}.stderr.txt`), stderr);
    } catch {}
  }

  // ACP conversation artifact for acp nodes
  saveConversationArtifact(nodeId: string, conversation: any): void {
    try {
      writeFileSync(join(this.artifactsPath, `${nodeId}.conversation.json`), JSON.stringify(conversation, null, 2));
    } catch {}
  }

  // Flow lifecycle
  complete(outcome: FlowOutcome): void {
    const completedAt = new Date().toISOString();
    this.bundle.completedAt = completedAt;
    this.bundle.outcome = outcome;
    this.bundle.status = outcome === "ok" ? "completed" : outcome === "cancelled" ? "cancelled" : "failed";
    this.bundle.currentNode = undefined;

    this.emit({ event: "flow_complete", outcome });

    // Write final snapshot
    this.writeBundle();
    this.writeSnapshot();

    console.log(`[FlowTrace] Flow "${this.flowName}" ${outcome} — ${this.runId} — ${this.bundle.completedSteps}/${this.bundle.totalSteps} steps`);
  }

  cancel(): void {
    this.complete("cancelled");
  }

  private writeBundle(): void {
    try {
      writeFileSync(join(this.runDir, "bundle.json"), JSON.stringify(this.bundle, null, 2));
    } catch {}
  }

  private writeSnapshot(): void {
    const snapshot = {
      schema: "duck.flow-snapshot.v1",
      runId: this.runId,
      generatedAt: new Date().toISOString(),
      status: this.bundle.status,
      outcome: this.bundle.outcome,
      currentNode: this.bundle.currentNode,
      totalSteps: this.bundle.totalSteps,
      completedSteps: this.bundle.completedSteps,
      steps: Array.from(this.stepRecords.values()),
    };

    try {
      writeFileSync(join(this.runDir, "snapshot.json"), JSON.stringify(snapshot, null, 2));
    } catch {}
  }

  // Replay: read all events from trace file
  static replay(runDir: string): { bundle: FlowRunBundle; events: FlowTraceEvent[]; snapshot?: any } {
    const bundlePath = join(runDir, "bundle.json");
    const tracePath = join(runDir, "trace.ndjson");
    const snapshotPath = join(runDir, "snapshot.json");

    let bundle: FlowRunBundle | null = null;
    let snapshot: any = null;
    const events: FlowTraceEvent[] = [];

    try { bundle = JSON.parse(readFileSync(bundlePath, "utf8")); } catch {}
    try { snapshot = JSON.parse(readFileSync(snapshotPath, "utf8")); } catch {}

    if (existsSync(tracePath)) {
      const content = readFileSync(tracePath, "utf8");
      const lines = content.split("\n");
      for (const line of lines) {
        if (!line.trim()) continue;
        try { events.push(JSON.parse(line)); } catch {}
      }
    }

    return { bundle: bundle!, events, snapshot };
  }

  // List all flow runs
  static listRuns(runDir = DEFAULT_RUN_DIR): FlowRunBundle[] {
    const runs: FlowRunBundle[] = [];
    if (!existsSync(runDir)) return runs;

    for (const runId of readdirSync(runDir)) {
      const bundlePath = join(runDir, runId, "bundle.json");
      if (existsSync(bundlePath)) {
        try {
          const b = JSON.parse(readFileSync(bundlePath, "utf8")) as FlowRunBundle;
          runs.push(b);
        } catch {}
      }
    }

    return runs.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  // Get latest run for a flow
  static latestRun(flowName: string, runDir = DEFAULT_RUN_DIR): FlowRunBundle | null {
    const runs = FlowTrace.listRuns(runDir).filter(r => r.flowName === flowName);
    return runs[0] || null;
  }
}

export default FlowTrace;
