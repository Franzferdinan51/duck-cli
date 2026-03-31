/**
 * 🦆 Duck Agent - Thinking System
 * Inspired by Claude Code's thinking module
 */

import { EventEmitter } from 'events';

// ============================================================================
// THINKING MODULE
// ============================================================================

export interface ThinkingOptions {
  enabled: boolean;
  maxDepth: number;
  budget: number;        // Max tokens for thinking
  includeConfidence: boolean;
}

export const DEFAULT_THINKING_OPTIONS: ThinkingOptions = {
  enabled: true,
  maxDepth: 5,
  budget: 10000,
  includeConfidence: true,
};

export interface Thought {
  id: string;
  text: string;
  confidence: number;     // 0-1
  depth: number;
  parent?: string;       // Parent thought ID
  children: string[];
  createdAt: number;
}

export interface ThinkingResult {
  thoughts: Thought[];
  conclusion: string;
  confidence: number;
  tokensUsed: number;
}

export class ThinkingModule extends EventEmitter {
  private options: ThinkingOptions;
  private thoughts: Map<string, Thought> = new Map();
  private rootId?: string;
  private currentDepth = 0;
  private tokensUsed = 0;
  
  constructor(options: Partial<ThinkingOptions> = {}) {
    super();
    this.options = { ...DEFAULT_THINKING_OPTIONS, ...options };
  }
  
  /**
   * Start a new thinking chain
   */
  startThinking(initialPrompt: string): string {
    const id = this.generateId();
    
    const thought: Thought = {
      id,
      text: initialPrompt,
      confidence: 0.5,
      depth: 0,
      children: [],
      createdAt: Date.now(),
    };
    
    this.thoughts.set(id, thought);
    this.rootId = id;
    this.currentDepth = 0;
    this.tokensUsed = this.estimateTokens(initialPrompt);
    
    this.emit('thought', thought);
    return id;
  }
  
  /**
   * Add a sub-thought
   */
  addThought(text: string, confidence: number = 0.5): string | null {
    if (!this.rootId) return null;
    if (this.currentDepth >= this.options.maxDepth) return null;
    if (this.tokensUsed >= this.options.budget) return null;
    
    const parentId = this.getCurrentThoughtId();
    const parent = this.thoughts.get(parentId!);
    
    const id = this.generateId();
    const thought: Thought = {
      id,
      text,
      confidence,
      depth: this.currentDepth + 1,
      parent: parentId,
      children: [],
      createdAt: Date.now(),
    };
    
    this.thoughts.set(id, thought);
    parent?.children.push(id);
    this.tokensUsed += this.estimateTokens(text);
    this.currentDepth++;
    
    this.emit('thought', thought);
    return id;
  }
  
  /**
   * Add multiple thoughts at once
   */
  addThoughts(thoughtTexts: string[]): string[] {
    const ids: string[] = [];
    for (const text of thoughtTexts) {
      const id = this.addThought(text);
      if (id) ids.push(id);
    }
    return ids;
  }
  
  /**
   * Conclude thinking
   */
  conclude(conclusion: string): ThinkingResult {
    const thoughts = this.getAllThoughts();
    
    // Calculate overall confidence
    let totalConfidence = 0;
    let count = 0;
    for (const thought of thoughts) {
      totalConfidence += thought.confidence;
      count++;
    }
    
    const result: ThinkingResult = {
      thoughts,
      conclusion,
      confidence: count > 0 ? totalConfidence / count : 0,
      tokensUsed: this.tokensUsed,
    };
    
    this.emit('concluded', result);
    return result;
  }
  
  /**
   * Get current thought ID
   */
  private getCurrentThoughtId(): string | undefined {
    if (!this.rootId) return undefined;
    
    let current = this.rootId;
    let maxDepth = 0;
    
    for (const [id, thought] of this.thoughts) {
      if (thought.depth > maxDepth) {
        maxDepth = thought.depth;
        current = id;
      }
    }
    
    return current;
  }
  
  /**
   * Get all thoughts as array
   */
  getAllThoughts(): Thought[] {
    return Array.from(this.thoughts.values());
  }
  
  /**
   * Get thought tree as formatted string
   */
  formatTree(): string {
    if (!this.rootId) return '';
    
    const lines: string[] = [];
    this.formatNode(this.rootId, 0, lines);
    return lines.join('\n');
  }
  
  private formatNode(id: string, depth: number, lines: string[]): void {
    const thought = this.thoughts.get(id);
    if (!thought) return;
    
    const indent = '  '.repeat(depth);
    const confidence = this.options.includeConfidence 
      ? ` [${Math.round(thought.confidence * 100)}%]` 
      : '';
    
    lines.push(`${indent}${thought.text}${confidence}`);
    
    for (const childId of thought.children) {
      this.formatNode(childId, depth + 1, lines);
    }
  }
  
  private generateId(): string {
    return `th_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  }
  
  private estimateTokens(text: string): number {
    // Rough estimate: 1 token ≈ 4 chars
    return Math.ceil(text.length / 4);
  }
  
  /**
   * Reset thinking state
   */
  reset(): void {
    this.thoughts.clear();
    this.rootId = undefined;
    this.currentDepth = 0;
    this.tokensUsed = 0;
  }
  
  /**
   * Update options
   */
  updateOptions(options: Partial<ThinkingOptions>): void {
    this.options = { ...this.options, ...options };
  }
}

// ============================================================================
// FAST THINKING (quick reasoning)
// ============================================================================

export function fastThink(prompt: string, options: {
  maxTime?: number;
  confidence?: boolean;
} = {}): string {
  // Quick heuristic-based reasoning
  const startTime = Date.now();
  const maxTime = options.maxTime || 1000;
  
  // Simple pattern matching for quick responses
  const lower = prompt.toLowerCase();
  
  // Decision patterns
  if (lower.includes('should i') || lower.includes('should we')) {
    return 'Consider the pros and cons, the risks and benefits, and the long-term vs short-term implications.';
  }
  
  // Explanation patterns
  if (lower.includes('why') || lower.includes('how does')) {
    return 'Break down the components and explain the causal relationships.';
  }
  
  // Debug patterns
  if (lower.includes('bug') || lower.includes('error') || lower.includes('fix')) {
    return 'Start with the error message, trace the execution flow, identify the root cause.';
  }
  
  // Code patterns
  if (lower.includes('implement') || lower.includes('write code')) {
    return 'Define the interface first, then implement the core logic, add error handling last.';
  }
  
  // Generic fallback
  if (Date.now() - startTime < maxTime) {
    return 'Consider multiple perspectives and weigh the evidence carefully.';
  }
  
  return 'Need more information to provide a useful response.';
}

// ============================================================================
// REASONING CHAIN
// ============================================================================

export interface ReasoningStep {
  step: number;
  thought: string;
  action?: string;
  result?: string;
}

export class ReasoningChain {
  private steps: ReasoningStep[] = [];
  
  addStep(thought: string, action?: string, result?: string): void {
    this.steps.push({
      step: this.steps.length + 1,
      thought,
      action,
      result,
    });
  }
  
  getSteps(): ReasoningStep[] {
    return [...this.steps];
  }
  
  format(): string {
    if (this.steps.length === 0) return 'No reasoning steps yet.';
    
    return this.steps.map(s => {
      let line = `${s.step}. ${s.thought}`;
      if (s.action) line += `\n   → ${s.action}`;
      if (s.result) line += `\n   ← ${s.result}`;
      return line;
    }).join('\n\n');
  }
  
  clear(): void {
    this.steps = [];
  }
}

export default {
  ThinkingModule,
  fastThink,
  ReasoningChain,
};
