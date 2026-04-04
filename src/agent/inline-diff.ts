/**
 * Inline Diff Preview - Hermes-inspired file write diff
 * Shows unified diff output when files are modified
 * Ported from: https://github.com/NousResearch/hermes-agent (agent/display.py)
 */

import { existsSync, readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { homedir } from "os";

export interface DiffSnapshot {
  before: Map<string, string | null>;  // path → content before write
  captured: Date;
}

/**
 * Capture before-state of files before a write operation.
 * Call before file_write executes.
 */
export function captureDiffSnapshot(toolName: string, args: any): DiffSnapshot | null {
  const paths = resolveWriteTargets(toolName, args);
  if (paths.length === 0) return null;

  const snapshot: DiffSnapshot = {
    before: new Map(),
    captured: new Date(),
  };

  for (const p of paths) {
    try {
      snapshot.before.set(p, existsSync(p) ? readFileSync(p, "utf8") : null);
    } catch {
      snapshot.before.set(p, null);
    }
  }

  return snapshot;
}

function resolveWriteTargets(toolName: string, args: any): string[] {
  if (toolName === "file_write") {
    const path = args?.path || args?.file?.path;
    if (path) return [resolvePath(path)];
  }
  if (toolName === "patch" || toolName === "file_patch") {
    const path = args?.path || args?.file?.path;
    if (path) return [resolvePath(path)];
  }
  return [];
}

function resolvePath(path: string): string {
  if (path.startsWith("~")) {
    return resolve(homedir(), path.slice(1));
  }
  if (path.startsWith("/")) {
    return path;
  }
  return resolve(process.cwd(), path);
}

/**
 * Generate unified diff from a before-snapshot and current file state.
 * Returns null if no changes detected.
 */
export function generateDiff(snapshot: DiffSnapshot | null, toolName: string, args: any): string | null {
  if (!snapshot) return null;

  const paths = resolveWriteTargets(toolName, args);
  if (paths.length === 0) return null;

  const chunks: string[] = [];

  for (const p of paths) {
    const before = snapshot.before.get(p);
    let after: string | null = null;
    try {
      after = existsSync(p) ? readFileSync(p, "utf8") : null;
    } catch {}

    if (before === after) continue;

    const displayPath = displayRelPath(p);
    const diff = unifiedDiff(
      before?.split("\n") ?? [],
      after?.split("\n") ?? [],
      `a/${displayPath}`,
      `b/${displayPath}`
    );

    if (diff) chunks.push(diff);
  }

  return chunks.length > 0 ? chunks.join("") : null;
}

function displayRelPath(absPath: string): string {
  try {
    return absPath.replace(resolve(process.cwd()) + "/", "");
  } catch {
    return absPath;
  }
}

/**
 * Generate a unified diff between two strings using the `diff` package.
 * Ported from: https://github.com/NousResearch/hermes-agent (agent/display.py)
 */
import { createTwoFilesPatch } from "diff";

export function unifiedDiff(beforeLines: string[], afterLines: string[], fromFile: string, toFile: string): string {
  const diff = createTwoFilesPatch(
    fromFile,
    toFile,
    beforeLines.join("\n"),
    afterLines.join("\n"),
    "",
    "",
    { context: 3 }
  );
  // Truncate to first 4KB of diff for display
  return diff.length > 4096 ? diff.slice(0, 4096) + "\n... (diff truncated) ..." : diff;
}

/**
 * Format a clean inline diff for display.
 * Returns colored ANSI diff or plain text based on terminal support.
 */
export function formatInlineDiff(diff: string, useColor = true): string {
  if (!diff) return "";

  if (!useColor) return diff;

  // Simple ANSI coloring: green for +, red for -, cyan for headers
  return diff
    .split("\n")
    .map(line => {
      if (line.startsWith("+++") || line.startsWith("---")) {
        return `\x1b[36m${line}\x1b[0m`;  // Cyan
      }
      if (line.startsWith("+")) {
        return `\x1b[32m${line}\x1b[0m`;   // Green
      }
      if (line.startsWith("-")) {
        return `\x1b[31m${line}\x1b[0m`;   // Red
      }
      if (line.startsWith("@@")) {
        return `\x1b[33m${line}\x1b[0m`;  // Yellow
      }
      return line;
    })
    .join("\n");
}

/**
 * Check if a tool result contains success/error indicators.
 */
function resultSucceeded(result: any): boolean {
  if (!result) return false;
  if (typeof result === "string") {
    try { result = JSON.parse(result); } catch { return result.length > 0; }
  }
  if (typeof result !== "object") return false;
  if (result.error) return false;
  if ("success" in result) return !!result.success;
  return true;
}

export default { captureDiffSnapshot, generateDiff, formatInlineDiff };
