/**
 * duck-cli v2 - Hybrid Orchestrator
 * Council Bridge - Integrates AI Council for complex/ethical tasks
 */

import { TaskContext } from './task-complexity.js';

// ==================== Council Types ====================

export interface CouncilRequest {
  task: string;
  context: TaskContext;
  perspectives: string[];
  mode?: CouncilMode;
  urgency?: 'low' | 'normal' | 'high' | 'critical';
  metadata?: Record<string, unknown>;
}

export type CouncilMode =
  | 'legislative' // Debate & vote on proposals
  | 'deliberation' // Roundtable discussion
  | 'research' // Multi-vector investigation
  | 'prediction' // Probabilistic forecasting
  | 'inquiry'; // Direct Q&A

export interface CouncilResponse {
  verdict: 'approve' | 'reject' | 'conditional';
  reasoning: string;
  recommendations: string[];
  consensus: number; // 0-1
  votes?: CouncilVote[];
  deliberationTimeMs: number;
  perspectivesEngaged: number;
  confidence: number;
}

export interface CouncilVote {
  perspective: string;
  vote: 'approve' | 'reject' | 'conditional';
  reasoning: string;
  confidence: number;
}

export interface CouncilPerspective {
  id: string;
  name: string;
  description: string;
  councilor?: string;
  enabled: boolean;
}

// ==================== Default Perspectives ====================

export const DEFAULT_PERSPECTIVES: CouncilPerspective[] = [
  {
    id: 'speaker',
    name: 'Speaker',
    description: 'Facilitates discussion and summarizes consensus',
    councilor: 'Speaker',
    enabled: true,
  },
  {
    id: 'technocrat',
    name: 'Technocrat',
    description: 'Evaluates technical feasibility and implementation',
    councilor: 'Technocrat',
    enabled: true,
  },
  {
    id: 'ethicist',
    name: 'Ethicist',
    description: 'Considers ethical implications and moral dimensions',
    councilor: 'Ethicist',
    enabled: true,
  },
  {
    id: 'pragmatist',
    name: 'Pragmatist',
    description: 'Focuses on practical outcomes and real-world impact',
    councilor: 'Pragmatist',
    enabled: true,
  },
  {
    id: 'skeptic',
    name: 'Skeptic',
    description: 'Challenges assumptions and identifies risks',
    councilor: 'Skeptic',
    enabled: true,
  },
  {
    id: 'sentinel',
    name: 'Sentinel',
    description: 'Identifies security and safety concerns',
    councilor: 'Sentinel',
    enabled: true,
  },
];

// Perspective selection based on task type
const PERSPECTIVE_SELECTION: Record<string, string[]> = {
  android: ['technocrat', 'pragmatist', 'sentinel'],
  vision: ['technocrat', 'pragmatist'],
  coding: ['technocrat', 'pragmatist', 'skeptic'],
  reasoning: ['ethicist', 'pragmatist', 'skeptic', 'sentinel'],
  ethical: ['ethicist', 'sentinel', 'speaker'],
  high_stakes: ['ethicist', 'sentinel', 'pragmatist', 'speaker'],
  default: ['technocrat', 'pragmatist', 'speaker'],
};

// ==================== Council Bridge Class ====================

export interface CouncilBridgeConfig {
  enabled?: boolean;
  timeout?: number;
  minConsensus?: number;
  autoSelectPerspectives?: boolean;
  councilEndpoint?: string;
}

export class CouncilBridge {
  private config: Required<CouncilBridgeConfig>;
  private perspectives: Map<string, CouncilPerspective>;
  private requestHistory: Array<{
    request: CouncilRequest;
    response: CouncilResponse;
    timestamp: number;
  }>;

  constructor(config: CouncilBridgeConfig = {}) {
    this.config = {
      enabled: config.enabled ?? true,
      timeout: config.timeout ?? 30000,
      minConsensus: config.minConsensus ?? 0.6,
      autoSelectPerspectives: config.autoSelectPerspectives ?? true,
      councilEndpoint: config.councilEndpoint ?? 'http://localhost:3000',
    };

    this.perspectives = new Map();
    for (const perspective of DEFAULT_PERSPECTIVES) {
      this.perspectives.set(perspective.id, perspective);
    }

    this.requestHistory = [];
  }

  /**
   * Engage the council for deliberation
   */
  async engage(request: CouncilRequest): Promise<CouncilResponse> {
    const startTime = Date.now();

    // Check if council is disabled
    if (!this.config.enabled) {
      return this.createFastResponse(request, startTime);
    }

    // Auto-select perspectives if enabled
    const perspectives = this.config.autoSelectPerspectives
      ? this.selectPerspectives(request)
      : request.perspectives;

    // Build full request
    const fullRequest: CouncilRequest = {
      ...request,
      perspectives,
    };

    try {
      // Attempt to engage real council
      const response = await this.engageRealCouncil(fullRequest);

      // Cache response
      this.requestHistory.push({
        request: fullRequest,
        response,
        timestamp: Date.now(),
      });

      return response;
    } catch (error) {
      // Fallback to simulated council
      console.warn('Council unavailable, using simulation:', error);
      const response = this.createSimulatedResponse(fullRequest, startTime);

      this.requestHistory.push({
        request: fullRequest,
        response,
        timestamp: Date.now(),
      });

      return response;
    }
  }

  /**
   * Engage the real AI Council API
   */
  private async engageRealCouncil(request: CouncilRequest): Promise<CouncilResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(`${this.config.councilEndpoint}/api/deliberate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          task: request.task,
          mode: request.mode ?? 'deliberation',
          perspectives: request.perspectives,
          context: request.context,
          urgency: request.urgency ?? 'normal',
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Council API error: ${response.status}`);
      }

      const data = await response.json();

      return {
        verdict: data.verdict as 'approve' | 'reject' | 'conditional',
        reasoning: data.reasoning,
        recommendations: data.recommendations ?? [],
        consensus: data.consensus ?? 0.5,
        votes: data.votes,
        deliberationTimeMs: Date.now() - (data.startTime ?? Date.now()),
        perspectivesEngaged: data.perspectivesEngaged ?? request.perspectives.length,
        confidence: data.confidence ?? 0.5,
      };
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * Create simulated council response for testing/fallback
   */
  private createSimulatedResponse(request: CouncilRequest, startTime: number): CouncilResponse {
    const task = request.task.toLowerCase();
    const deliberationTimeMs = 500 + Math.random() * 1000;

    // Determine verdict based on task characteristics
    let verdict: 'approve' | 'reject' | 'conditional' = 'approve';
    let consensus = 0.7;
    const recommendations: string[] = [];
    const votes: CouncilVote[] = [];

    // Simulate perspective votes
    for (const perspectiveId of request.perspectives) {
      const perspective = this.perspectives.get(perspectiveId);
      if (!perspective) continue;

      let vote: 'approve' | 'reject' | 'conditional' = 'approve';
      let voteReasoning = 'Task appears reasonable';

      // Adjust based on perspective type
      switch (perspectiveId) {
        case 'ethicist':
          if (task.includes('delete') || task.includes('remove') || task.includes('destroy')) {
            vote = 'conditional';
            voteReasoning = 'Consider implications of destructive action';
            recommendations.push('Verify this is the intended action');
          }
          if (task.includes('hack') || task.includes('exploit')) {
            vote = 'reject';
            voteReasoning = 'Ethical concerns with exploitation';
          }
          break;

        case 'sentinel':
          if (task.includes('password') || task.includes('secret') || task.includes('credential')) {
            vote = 'conditional';
            voteReasoning = 'Security-sensitive operation detected';
            recommendations.push('Ensure proper authentication and authorization');
          }
          if (task.includes('rm -rf') || task.includes('destroy')) {
            vote = 'reject';
            voteReasoning = 'Dangerous operation without safety measures';
          }
          break;

        case 'technocrat':
          if (task.includes('api') || task.includes('system') || task.includes('deploy')) {
            vote = 'conditional';
            voteReasoning = 'Technical implementation details needed';
          }
          break;

        case 'skeptic':
          if (recommendations.length > 2) {
            vote = 'conditional';
            voteReasoning = 'Multiple concerns identified';
          }
          break;

        case 'pragmatist':
          voteReasoning = 'Practical approach approved';
          break;

        case 'speaker':
          voteReasoning = 'Consensus can be reached';
          break;
      }

      votes.push({
        perspective: perspective.name,
        vote,
        reasoning: voteReasoning,
        confidence: 0.6 + Math.random() * 0.3,
      });
    }

    // Calculate consensus
    const approveVotes = votes.filter((v) => v.vote === 'approve').length;
    const rejectVotes = votes.filter((v) => v.vote === 'reject').length;
    const conditionalVotes = votes.filter((v) => v.vote === 'conditional').length;

    consensus = (approveVotes + conditionalVotes * 0.5) / votes.length;

    // Determine final verdict
    if (rejectVotes > votes.length / 2) {
      verdict = 'reject';
    } else if (rejectVotes > 0 || conditionalVotes > votes.length / 2) {
      verdict = 'conditional';
    }

    // Build reasoning
    const reasoning = this.buildReasoning(votes, verdict, recommendations);

    return {
      verdict,
      reasoning,
      recommendations,
      consensus,
      votes,
      deliberationTimeMs: Math.round(deliberationTimeMs),
      perspectivesEngaged: votes.length,
      confidence: consensus,
    };
  }

  /**
   * Fast response when council is disabled
   */
  private createFastResponse(request: CouncilRequest, startTime: number): CouncilResponse {
    return {
      verdict: 'approve',
      reasoning: 'Council bypassed - fast path enabled',
      recommendations: [],
      consensus: 1.0,
      deliberationTimeMs: Date.now() - startTime,
      perspectivesEngaged: 0,
      confidence: 0.5,
    };
  }

  /**
   * Build reasoning string from votes
   */
  private buildReasoning(
    votes: CouncilVote[],
    verdict: 'approve' | 'reject' | 'conditional',
    recommendations: string[]
  ): string {
    const lines: string[] = [];

    lines.push(`Council deliberation completed with ${verdict.toUpperCase()} verdict:`);
    lines.push('');

    for (const v of votes) {
      lines.push(`• ${v.perspective}: ${v.vote.toUpperCase()} - ${v.reasoning}`);
    }

    lines.push('');

    if (recommendations.length > 0) {
      lines.push('Recommendations:');
      for (const rec of recommendations) {
        lines.push(`• ${rec}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Select perspectives based on task type
   */
  private selectPerspectives(request: CouncilRequest): string[] {
    const task = request.task.toLowerCase();

    // Check for specific task types
    if (
      task.includes('android') ||
      task.includes('tap') ||
      task.includes('swipe') ||
      task.includes('adb')
    ) {
      return PERSPECTIVE_SELECTION.android;
    }

    if (
      task.includes('screenshot') ||
      task.includes('image') ||
      task.includes('photo') ||
      task.includes('visual')
    ) {
      return PERSPECTIVE_SELECTION.vision;
    }

    if (
      task.includes('code') ||
      task.includes('function') ||
      task.includes('api') ||
      task.includes('implement')
    ) {
      return PERSPECTIVE_SELECTION.coding;
    }

    if (
      task.includes('ethical') ||
      task.includes('moral') ||
      task.includes('bias') ||
      task.includes('privacy')
    ) {
      return PERSPECTIVE_SELECTION.ethical;
    }

    if (
      task.includes('security') ||
      task.includes('hack') ||
      task.includes('breach') ||
      task.includes('password') ||
      task.includes('delete') ||
      task.includes('destroy')
    ) {
      return PERSPECTIVE_SELECTION.high_stakes;
    }

    return PERSPECTIVE_SELECTION.default;
  }

  /**
   * Add or update a perspective
   */
  setPerspective(perspective: CouncilPerspective): void {
    this.perspectives.set(perspective.id, perspective);
  }

  /**
   * Get a perspective by ID
   */
  getPerspective(id: string): CouncilPerspective | undefined {
    return this.perspectives.get(id);
  }

  /**
   * Get all perspectives
   */
  getAllPerspectives(): CouncilPerspective[] {
    return Array.from(this.perspectives.values());
  }

  /**
   * Get enabled perspectives
   */
  getEnabledPerspectives(): CouncilPerspective[] {
    return Array.from(this.perspectives.values()).filter((p) => p.enabled);
  }

  /**
   * Enable/disable a perspective
   */
  togglePerspective(id: string, enabled: boolean): void {
    const perspective = this.perspectives.get(id);
    if (perspective) {
      perspective.enabled = enabled;
      this.perspectives.set(id, perspective);
    }
  }

  /**
   * Get request history
   */
  getHistory(count = 10): Array<{ request: CouncilRequest; response: CouncilResponse; timestamp: number }> {
    return this.requestHistory.slice(-count);
  }

  /**
   * Clear history
   */
  clearHistory(): void {
    this.requestHistory = [];
  }

  /**
   * Enable/disable council
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
  }

  /**
   * Check if council is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Get configuration
   */
  getConfig(): Readonly<Required<CouncilBridgeConfig>> {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(updates: Partial<CouncilBridgeConfig>): void {
    Object.assign(this.config, updates);
  }
}

// ==================== Factory Functions ====================

let defaultBridge: CouncilBridge | null = null;

export function getCouncilBridge(): CouncilBridge {
  if (!defaultBridge) {
    defaultBridge = new CouncilBridge();
  }
  return defaultBridge;
}

export function createCouncilBridge(config?: CouncilBridgeConfig): CouncilBridge {
  return new CouncilBridge(config);
}

// ==================== Convenience Functions ====================

/**
 * Quick council engagement
 */
export async function engageCouncil(request: CouncilRequest): Promise<CouncilResponse> {
  return getCouncilBridge().engage(request);
}

/**
 * Check if task needs council deliberation
 */
export function needsCouncilEngagement(
  task: string,
  complexity: number,
  hasEthicalDimension: boolean
): boolean {
  return complexity >= 7 || hasEthicalDimension;
}
