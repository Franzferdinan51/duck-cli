/**
 * duck-cli AI Doctor - Self-Healing Module
 *
 * Usage:
 *   duck doctor examine <error>   — diagnose an error
 *   duck doctor fix <error>        — diagnose and apply fix
 *   duck doctor repair            — show auto-repair status
 *   duck doctor history          — show repair history
 *
 * ACP Integration:
 *   When attached to OpenClaw gateway, failures detected by duck-cli
 *   are auto-diagnosed and fixed via MiniMax agent before surfacing to user.
 */

export { AIDoctor, getAIDoctor } from './doctor.js';
export { MiniMaxClient } from './minimax-client.js';
export { ACPRepar, getACPRepar } from './acp-repair.js';
export { CodeHarness } from './code-harness.js';
export type {
  Diagnosis,
  FixProposal,
  FixStep,
  DoctorReport,
  DoctorConfig,
  RepairConfig,
  Harness,
  HarnessResult,
} from './types.js';
