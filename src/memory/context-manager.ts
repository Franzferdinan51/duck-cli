/**
 * 🦆 Duck Agent - Context Manager
 * Based on DuckBot-OS context_manager.py
 * JSON file-backed context storage with learning patterns
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';

export interface ContextSnapshot {
  contextId: string;
  timestamp: number;
  data: Record<string, any>;
  metadata: Record<string, any>;
  tags: string[];
}

export interface LearningPattern {
  patternId: string;
  patternType: string;
  conditions: Record<string, any>;
  outcomes: Record<string, any>;
  confidence: number;
  usageCount: number;
  lastUsed: number;
  successRate: number;
}

export interface AgentMemory {
  memoryId: string;
  agentType: string;
  memoryKey: string;
  memoryData: any;
  importance: number;
  createdAt: number;
  lastAccessed: number;
  accessCount: number;
}

interface ContextData {
  snapshots: ContextSnapshot[];
  patterns: LearningPattern[];
  memories: AgentMemory[];
  relationships: { source: string; target: string; type: string; strength: number; createdAt: number }[];
}

export class ContextManager {
  private dataPath: string;
  private data: ContextData;

  constructor(dataPath: string = './data/context.json') {
    this.dataPath = dataPath;
    
    // Ensure directory exists
    mkdirSync(dirname(dataPath), { recursive: true });
    
    // Load or initialize data
    if (existsSync(dataPath)) {
      try {
        this.data = JSON.parse(readFileSync(dataPath, 'utf-8'));
      } catch {
        this.data = this.emptyData();
      }
    } else {
      this.data = this.emptyData();
    }
  }

  private emptyData(): ContextData {
    return {
      snapshots: [],
      patterns: [],
      memories: [],
      relationships: []
    };
  }

  private save(): void {
    writeFileSync(this.dataPath, JSON.stringify(this.data, null, 2));
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
  }

  // ============ Context Snapshots ============

  storeSnapshot(snapshot: ContextSnapshot): void {
    const id = snapshot.contextId || this.generateId();
    snapshot.contextId = id;
    snapshot.timestamp = snapshot.timestamp || Date.now();
    snapshot.metadata = snapshot.metadata || {};
    snapshot.tags = snapshot.tags || [];
    
    // Keep only last 1000 snapshots
    this.data.snapshots = [
      snapshot,
      ...this.data.snapshots.filter(s => s.contextId !== id)
    ].slice(0, 1000);
    
    this.save();
  }

  getSnapshots(limit: number = 100, tags?: string[]): ContextSnapshot[] {
    let results = this.data.snapshots;
    
    if (tags && tags.length > 0) {
      results = results.filter(s => 
        tags.some(t => s.tags.includes(t))
      );
    }

    return results.slice(0, limit);
  }

  // ============ Learning Patterns ============

  storePattern(pattern: LearningPattern): void {
    const id = pattern.patternId || this.generateId();
    pattern.patternId = id;
    pattern.lastUsed = pattern.lastUsed || Date.now();
    pattern.usageCount = pattern.usageCount || 0;
    pattern.successRate = pattern.successRate || 0;
    pattern.confidence = pattern.confidence || 0.5;
    
    this.data.patterns = [
      pattern,
      ...this.data.patterns.filter(p => p.patternId !== id)
    ];
    
    this.save();
  }

  getPatterns(patternType?: string, limit: number = 100): LearningPattern[] {
    let results = this.data.patterns;
    
    if (patternType) {
      results = results.filter(p => p.patternType === patternType);
    }

    return results
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, limit);
  }

  updatePatternUsage(patternId: string, success: boolean): void {
    const pattern = this.data.patterns.find(p => p.patternId === patternId);
    
    if (pattern) {
      pattern.usageCount++;
      pattern.lastUsed = Date.now();
      
      // Update success rate
      const totalSuccess = pattern.successRate * (pattern.usageCount - 1) + (success ? 1 : 0);
      pattern.successRate = totalSuccess / pattern.usageCount;
      
      // Update confidence
      pattern.confidence = Math.min(1, pattern.confidence + (success ? 0.05 : -0.02));
      
      this.save();
    }
  }

  // ============ Agent Memories ============

  storeMemory(memory: AgentMemory): void {
    const id = memory.memoryId || this.generateId();
    memory.memoryId = id;
    memory.createdAt = memory.createdAt || Date.now();
    memory.lastAccessed = Date.now();
    memory.accessCount = 0;
    memory.importance = memory.importance || 0.5;
    
    this.data.memories = [
      memory,
      ...this.data.memories.filter(m => !(m.agentType === memory.agentType && m.memoryKey === memory.memoryKey))
    ];
    
    this.save();
  }

  getMemories(agentType: string, memoryKey?: string): AgentMemory[] {
    let results = this.data.memories.filter(m => m.agentType === agentType);
    
    if (memoryKey) {
      results = results.filter(m => m.memoryKey === memoryKey);
    }

    // Update access
    for (const m of results) {
      m.accessCount++;
      m.lastAccessed = Date.now();
    }
    this.save();

    return results.sort((a, b) => b.importance - a.importance);
  }

  // ============ Relationships ============

  storeRelationship(source: string, target: string, type: string, strength: number = 0.5): void {
    this.data.relationships.push({
      source,
      target,
      type,
      strength,
      createdAt: Date.now()
    });
    this.save();
  }

  getRelatedContexts(contextId: string): { context: ContextSnapshot; type: string; strength: number }[] {
    const related = this.data.relationships
      .filter(r => r.source === contextId || r.target === contextId)
      .sort((a, b) => b.strength - a.strength);

    const results: { context: ContextSnapshot; type: string; strength: number }[] = [];

    for (const rel of related) {
      const relatedId = rel.source === contextId ? rel.target : rel.source;
      const snapshot = this.data.snapshots.find(s => s.contextId === relatedId);
      if (snapshot) {
        results.push({
          context: snapshot,
          type: rel.type,
          strength: rel.strength
        });
      }
    }

    return results;
  }

  // ============ Pattern Matching ============

  findMatchingPatterns(conditions: Record<string, any>): LearningPattern[] {
    return this.data.patterns.filter(pattern => {
      for (const [key, value] of Object.entries(conditions)) {
        if (pattern.conditions[key] !== value) {
          return false;
        }
      }
      return true;
    }).sort((a, b) => b.confidence - a.confidence);
  }

  // Learn from experience
  learnFromExperience(input: Record<string, any>, output: any, success: boolean): void {
    this.storePattern({
      patternId: '',
      patternType: 'experience',
      conditions: input,
      outcomes: { result: output },
      confidence: success ? 0.7 : 0.3,
      usageCount: 1,
      lastUsed: Date.now(),
      successRate: success ? 1 : 0
    });
  }

  // Get insights
  getInsights(): { patternCount: number; memoryCount: number; snapshotCount: number } {
    return {
      patternCount: this.data.patterns.length,
      memoryCount: this.data.memories.length,
      snapshotCount: this.data.snapshots.length
    };
  }

  // Clear all data
  clear(): void {
    this.data = this.emptyData();
    this.save();
  }
}

export default ContextManager;
