/**
 * duck-cli AI Doctor - Types
 */

export interface Diagnosis {
  error: string;
  rootCause: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: 'network' | 'auth' | 'memory' | 'code' | 'config' | 'dependency' | 'timeout' | 'unknown';
  confidence: number; // 0-1
}

export interface FixProposal {
  diagnosis: Diagnosis;
  steps: FixStep[];
  estimatedRisk: 'low' | 'medium' | 'high';
  autoFixable: boolean;
}

export interface FixStep {
  order: number;
  action: 'restart' | 'reinstall' | 'patch' | 'config' | 'clear_cache' | 'rebuild' | 'noop';
  description: string;
  command?: string;
  reversible: boolean;
  autoFixable: boolean;
  estimatedRisk?: 'low' | 'medium' | 'high';
}

export interface DoctorReport {
  timestamp: number;
  error: string;
  diagnosis: Diagnosis;
  fix?: FixProposal;
  applied: boolean;
  result?: 'success' | 'partial' | 'failed';
  logs: string[];
}

export interface DoctorConfig {
  autoFix: boolean;
  autoFixRiskThreshold: 'low' | 'medium' | 'high';
  model: string;
  provider: string;
}

export type Harness = 'claude' | 'codex' | 'crush' | 'auto';

export interface HarnessResult {
  success: boolean;
  output: string;
  error?: string;
}
