/**
 * ACPX-Style Flow Graph Runner
 * Inspired by: https://github.com/openclaw/acpx (flows)
 *
 * Node types:
 * - acp: Model-shaped work (reasoning, judgment, code changes)
 * - action: Deterministic runtime work (shell, gh api, tests)
 * - compute: Pure local transforms (routing, normalization)
 * - checkpoint: Pause for external event (human decision, resume later)
 *
 * Key ACPX principles:
 * - Runtime owns execution, persistence, routing, liveness
 * - Worker (model) owns reasoning, judgment, code changes
 * - Routing stays deterministic outside the worker
 * - Node outcomes: ok / timed_out / failed / cancelled
 */

import { randomUUID } from "crypto";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { FlowTrace, FlowOutcome, NodeKind } from "./flow-trace.js";

export type Outcome = "ok" | "timed_out" | "failed" | "cancelled";

// ─── Node Definitions ────────────────────────────────────────────────────────

export interface AcpNodeConfig {
  prompt: string;
  model?: string;
  provider?: string;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface ActionNodeConfig {
  shell?: string;
  script?: string;
  cwd?: string;
  timeout?: number; // ms
  env?: Record<string, string>;
}

export interface ComputeNodeConfig {
  fn: string; // JavaScript expression or function body
}

export interface CheckpointNodeConfig {
  message?: string;
  waitFor?: string; // event name to wait for
}

export interface FlowNodeCommon {
  id: string;
  name?: string;
  description?: string;
  timeout?: number; // ms, default 15min for acp, 5min for action
  retry?: number;
  onFailure?: "abort" | "continue" | "retry";
}

export interface AcpNode extends FlowNodeCommon {
  kind: "acp";
  config: AcpNodeConfig;
}

export interface ActionNode extends FlowNodeCommon {
  kind: "action";
  config: ActionNodeConfig;
}

export interface ComputeNode extends FlowNodeCommon {
  kind: "compute";
  config: ComputeNodeConfig;
}

export interface CheckpointNode extends FlowNodeCommon {
  kind: "checkpoint";
  config: CheckpointNodeConfig;
}

export type FlowNode = AcpNode | ActionNode | ComputeNode | CheckpointNode;

// ─── Edge Definitions ────────────────────────────────────────────────────────

export type EdgeCondition =
  | { type: "always"; to: string }
  | { type: "outcome"; on: "ok" | "timed_out" | "failed" | "cancelled"; to: string }
  | { type: "switch"; on: string; cases: Record<string, string>; default?: string };

export interface FlowEdge {
  from: string;
  condition: EdgeCondition;
}

// ─── Flow Definition ───────────────────────────────────────────────────────

export interface FlowDefinition {
  name: string;
  description?: string;
  nodes: Record<string, FlowNode>;
  edges: FlowEdge[];
  initial?: string;
  metadata?: Record<string, any>;
}

// ─── Node Result ──────────────────────────────────────────────────────────

export interface NodeResult {
  nodeId: string;
  kind: NodeKind;
  outcome: Outcome;
  output?: any;
  error?: string;
  durationMs?: number;
  tokens?: number;
  cost?: number;
  rawOutput?: string;
}

// ─── Flow Runtime ──────────────────────────────────────────────────────────

export interface FlowContext {
  vars: Record<string, any>;
  history: NodeResult[];
  getVar: (key: string) => any;
  setVar: (key: string, value: any) => void;
}

export class FlowRunner {
  private def: FlowDefinition;
  private context: FlowContext;
  private trace: FlowTrace;
  private currentNodeId: string | null = null;
  private cancelled = false;
  private nodeTimers: Map<string, NodeJS.Timeout> = new Map();

  // Provider manager (injected)
  private providers: any = null;

  constructor(def: FlowDefinition, flowDefPath?: string, providers?: any) {
    this.def = def;
    this.providers = providers || null;
    this.context = this.createContext();
    this.trace = new FlowTrace(def.name, flowDefPath || "memory");
  }

  private createContext(): FlowContext {
    const vars: Record<string, any> = {};
    const history: NodeResult[] = [];

    return {
      vars,
      history,
      getVar: (key: string) => vars[key],
      setVar: (key: string, value: any) => { vars[key] = value; },
    };
  }

  getTrace(): FlowTrace { return this.trace; }
  getContext(): FlowContext { return this.context; }
  isCancelled(): boolean { return this.cancelled; }

  cancel(): void {
    this.cancelled = true;
    for (const timer of this.nodeTimers.values()) {
      clearTimeout(timer);
    }
    this.trace.cancel();
  }

  // ─── Execution ──────────────────────────────────────────────────────────

  async run(startNodeId?: string): Promise<{ outcome: Outcome; results: NodeResult[] }> {
    const start = startNodeId || this.def.initial || this.getInitialNode();
    if (!start) {
      return { outcome: "failed", results: [] };
    }

    console.log(`[FlowGraph] Starting flow "${this.def.name}" at node "${start}"`);

    let currentId: string | null = start;

    while (currentId && !this.cancelled) {
      const result = await this.executeNode(currentId);
      this.context.history.push(result);

      // Record in trace
      this.trace.nodeComplete(currentId, result.outcome, result.durationMs);
      if (result.output) {
        this.trace.nodeOutput(currentId, result.output, result.tokens, result.cost);
      }

      // Route to next node
      const nextId = this.route(currentId, result);
      if (!nextId) break;

      currentId = nextId;
    }

    const overallOutcome: Outcome = this.cancelled ? "cancelled"
      : this.context.history.some(r => r.outcome === "failed") ? "failed"
      : this.context.history.every(r => r.outcome === "ok") ? "ok"
      : "failed";

    this.trace.complete(overallOutcome);

    return { outcome: overallOutcome, results: this.context.history };
  }

  private getInitialNode(): string | null {
    const nodeIds = Object.keys(this.def.nodes);
    // Find nodes with no incoming edges
    const hasIncoming = new Set(this.def.edges.map(e => {
      if (e.condition.type === "switch") return Object.values((e.condition as any).cases).flat();
      return [e.condition.type === "always" ? e.condition.to : null];
    }).flat().filter(Boolean));

    const starts = nodeIds.filter(id => !hasIncoming.has(id));
    return starts[0] || nodeIds[0] || null;
  }

  private route(fromNodeId: string, result: NodeResult): string | null {
    const edges = this.def.edges.filter(e => e.from === fromNodeId);
    if (edges.length === 0) return null;

    for (const edge of edges) {
      const cond = edge.condition;

      if (cond.type === "always") {
        return cond.to;
      }

      if (cond.type === "outcome") {
        if (cond.on === result.outcome) {
          return cond.to;
        }
      }

      if (cond.type === "switch") {
        const switchVal = this.context.getVar(cond.on);
        if (switchVal !== undefined && cond.cases[String(switchVal)] !== undefined) {
          return cond.cases[String(switchVal)];
        }
        if (cond.default) return cond.default;
      }
    }

    return null;
  }

  private async executeNode(nodeId: string): Promise<NodeResult> {
    const node = this.def.nodes[nodeId];
    if (!node) {
      return { nodeId, kind: "action" as NodeKind, outcome: "failed", error: `Node ${nodeId} not found` };
    }

    this.currentNodeId = nodeId;
    const startTime = Date.now();

    this.trace.nodeStart(nodeId, node.kind);

    // Set up timeout
    const timeout = node.timeout || (node.kind === "acp" ? 15 * 60 * 1000 : 5 * 60 * 1000);
    const timeoutTimer = setTimeout(() => {
      this.handleTimeout(nodeId, node.kind);
    }, timeout);
    this.nodeTimers.set(nodeId, timeoutTimer);

    try {
      let output: any;
      let tokens: number | undefined;
      let cost: number | undefined;
      let rawOutput: string | undefined;

      switch (node.kind) {
        case "acp":
          ({ output, tokens, cost, rawOutput } = await this.executeAcpNode(node as AcpNode));
          break;
        case "action":
          ({ output, rawOutput } = await this.executeActionNode(node as ActionNode));
          break;
        case "compute":
          ({ output } = await this.executeComputeNode(node as ComputeNode));
          break;
        case "checkpoint":
          output = await this.executeCheckpointNode(node as CheckpointNode);
          break;
      }

      clearTimeout(timeoutTimer);
      this.nodeTimers.delete(nodeId);

      return {
        nodeId,
        kind: node.kind,
        outcome: "ok",
        output,
        durationMs: Date.now() - startTime,
        tokens,
        cost,
        rawOutput,
      };
    } catch (e: any) {
      clearTimeout(timeoutTimer);
      this.nodeTimers.delete(nodeId);

      const errorMsg = e.message || String(e);
      this.trace.nodeError(nodeId, errorMsg, Date.now() - startTime);

      // Check onFailure handling
      if (node.onFailure === "continue") {
        return { nodeId, kind: node.kind, outcome: "ok", error: errorMsg, durationMs: Date.now() - startTime };
      }
      if (node.onFailure === "retry" && (node.retry || 1) > 0) {
        // Simple retry: re-run once
        return this.executeNode(nodeId);
      }

      return { nodeId, kind: node.kind, outcome: "failed", error: errorMsg, durationMs: Date.now() - startTime };
    }
  }

  private handleTimeout(nodeId: string, kind: NodeKind): void {
    console.warn(`[FlowGraph] Node ${nodeId} timed out`);
    this.trace.nodeError(nodeId, "Node timed out", undefined);
    this.nodeTimers.delete(nodeId);
    // Don't auto-cancel — let the caller handle
  }

  // ─── ACP Node: Model-shaped work ────────────────────────────────────────

  private async executeAcpNode(node: AcpNode): Promise<{ output: any; tokens?: number; cost?: number; rawOutput?: string }> {
    const config = node.config;

    // Inject flow context into prompt
    let prompt = config.prompt;
    prompt += `\n\n[FLOW CONTEXT] Flow variables: ${JSON.stringify(this.context.vars)}`;

    if (this.providers) {
      try {
        const result = await this.providers.route(prompt);
        return {
          output: result.text,
          tokens: undefined,
          cost: undefined,
          rawOutput: result.text,
        };
      } catch (e: any) {
        throw new Error(`ACP node failed: ${e.message}`);
      }
    }

    // Fallback: return a placeholder
    return {
      output: `[ACP node: ${node.id}] Prompt: ${prompt.slice(0, 100)}...`,
      rawOutput: "",
    };
  }

  // ─── Action Node: Deterministic runtime work ────────────────────────────

  private async executeActionNode(node: ActionNode): Promise<{ output: any; rawOutput?: string }> {
    const { shell, script, cwd, timeout, env } = node.config;

    if (shell) {
      return this.runShell(shell, cwd, timeout, env);
    }

    if (script) {
      // Execute inline script
      const { writeFileSync, unlinkSync, existsSync } = require("fs");
      const tmpScript = `/tmp/flow-action-${randomUUID().slice(0, 8)}.sh`;
      writeFileSync(tmpScript, script, { mode: 0o755 });
      try {
        const result = await this.runShell(`bash "${tmpScript}"`, cwd, timeout, env);
        return result;
      } finally {
        try { unlinkSync(tmpScript); } catch {}
      }
    }

    throw new Error("Action node has no shell or script config");
  }

  private runShell(command: string, cwd?: string, timeout?: number, env?: Record<string, string>): Promise<{ output: any; rawOutput?: string }> {
    return new Promise((resolve, reject) => {
      const { spawn } = require("child_process");
      const mergedEnv = { ...process.env, ...env };

      const proc = spawn("sh", ["-c", command], {
        cwd: cwd || process.cwd(),
        env: mergedEnv,
        stdio: ["ignore", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";

      proc.stdout?.on("data", (d: Buffer) => { stdout += d.toString(); });
      proc.stderr?.on("data", (d: Buffer) => { stderr += d.toString(); });

      const timer = timeout ? setTimeout(() => {
        proc.kill("SIGTERM");
        reject(new Error(`Shell timed out after ${timeout}ms`));
      }, timeout) : null;

      proc.on("close", (code: number) => {
        if (timer) clearTimeout(timer);
        const output = code === 0 ? stdout : `${stdout}\n[exit ${code}]`;
        this.trace.saveShellArtifact(this.currentNodeId!, stdout, stderr);
        if (code === 0) {
          resolve({ output, rawOutput: stdout });
        } else {
          reject(new Error(`Shell exited with code ${code}: ${stderr || stdout}`));
        }
      });

      proc.on("error", (e: Error) => {
        if (timer) clearTimeout(timer);
        reject(e);
      });
    });
  }

  // ─── Compute Node: Pure local transforms ───────────────────────────────

  private async executeComputeNode(node: ComputeNode): Promise<{ output: any }> {
    const { fn } = node.config;
    const ctx = this.context;

    try {
      // Safe compute: provide getVar/setVar and context
      const computeFn = new Function("ctx", `
        const { vars, history, getVar, setVar } = ctx;
        ${fn}
      `);

      const output = computeFn(ctx);
      if (output !== undefined) {
        // If result is a key=value pair, set it as a var
        if (typeof output === "object" && output !== null) {
          // Allow returning { key: value } to set vars
        } else if (typeof output === "string" && output.includes("=")) {
          // Allow "key=value" shorthand
          const [k, v] = output.split("=");
          ctx.setVar(k.trim(), v.trim());
        }
      }

      return { output };
    } catch (e: any) {
      throw new Error(`Compute node failed: ${e.message}`);
    }
  }

  // ─── Checkpoint Node: Pause for external event ─────────────────────────

  private async executeCheckpointNode(node: CheckpointNode): Promise<any> {
    const message = node.config.message || `Checkpoint: ${node.id}`;
    console.log(`[FlowGraph] Checkpoint reached: ${message}`);

    // In duck-cli, checkpoints pause the flow and return control
    // The caller can resume by calling flowRunner.resume(event)
    // For now, we just emit the checkpoint and continue
    return { checkpoint: node.id, message, vars: { ...this.context.vars } };
  }

  // ─── Helper: Load flow from file ─────────────────────────────────────────

  static async loadFlow(filePath: string, providers?: any): Promise<FlowRunner> {
    if (!existsSync(filePath)) {
      throw new Error(`Flow file not found: ${filePath}`);
    }

    const content = readFileSync(filePath, "utf8");
    let def: FlowDefinition;

    if (filePath.endsWith(".json") || filePath.endsWith(".jsonc")) {
      def = JSON.parse(content);
    } else if (filePath.endsWith(".ts")) {
      // TypeScript flow module — requires dynamic import
      throw new Error("TypeScript flow modules require transpilation. Use JSON flow files or .mts extension.");
    } else {
      throw new Error(`Unsupported flow file format: ${filePath}`);
    }

    // Validate
    FlowRunner.validate(def);

    return new FlowRunner(def, filePath, providers);
  }

  static validate(def: FlowDefinition): void {
    if (!def.name) throw new Error("Flow must have a name");
    if (!def.nodes || Object.keys(def.nodes).length === 0) throw new Error("Flow must have at least one node");
    if (!def.edges || def.edges.length === 0) throw new Error("Flow must have at least one edge");

    const nodeIds = new Set(Object.keys(def.nodes));

    for (const edge of def.edges) {
      if (!nodeIds.has(edge.from)) throw new Error(`Edge from unknown node: ${edge.from}`);
      if (edge.condition.type !== "switch") {
        if (!nodeIds.has((edge.condition as any).to)) throw new Error(`Edge to unknown node: ${(edge.condition as any).to}`);
      }
    }
  }
}

// ─── Convenience: Define flow helpers (ACPX-style) ─────────────────────────

export function defineFlow(def: FlowDefinition): FlowDefinition {
  return def;
}

export function acp(config: AcpNodeConfig): AcpNode {
  return { kind: "acp", id: `acp-${randomUUID().slice(0, 8)}`, config };
}

export function action(config: ActionNodeConfig): ActionNode {
  return { kind: "action", id: `action-${randomUUID().slice(0, 8)}`, config };
}

export function compute(config: ComputeNodeConfig): ComputeNode {
  return { kind: "compute", id: `compute-${randomUUID().slice(0, 8)}`, config };
}

export function checkpoint(config: CheckpointNodeConfig = {}): CheckpointNode {
  return { kind: "checkpoint", id: `checkpoint-${randomUUID().slice(0, 8)}`, config };
}

export function shell(command: string, opts?: { cwd?: string; timeout?: number; env?: Record<string, string> }): ActionNode {
  return action({ shell: command, ...opts });
}

export default FlowRunner;
