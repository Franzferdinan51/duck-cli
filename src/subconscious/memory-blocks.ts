/**
 * 🦆 Duck Agent - Memory Blocks System
 * Inspired by Letta's memory blocks, implemented with duck-cli's infrastructure
 * Uses MiniMax/Kimi/LM Studio - NO Letta endpoints
 */

import { SqliteStore } from './persistence/sqlite-store.js';
import { homedir } from 'os';
import { join } from 'path';

const DATA_DIR = join(homedir(), '.duckagent', 'subconscious');

/**
 * Memory Block Types (Letta-inspired)
 */
export interface MemoryBlock {
  id: string;
  type: MemoryBlockType;
  content: string;
  label: string;
  createdAt: number;
  updatedAt: number;
  accessCount: number;
  importance: number; // 0-1
}

export type MemoryBlockType =
  | 'core_directives'      // Role definition and behavioral guidelines
  | 'guidance'             // Active guidance for next session
  | 'user_preferences'     // User's working style, preferences
  | 'project_context'      // Architecture decisions, tech stack
  | 'codebase_patterns'    // Common patterns in user's code
  | 'session_summaries'    // Summaries of past sessions
  | 'pending_items'        // TODOs, reminders, follow-ups
  | 'learned_skills';      // Auto-learned skills and patterns

/**
 * Memory Blocks Manager
 * Manages 8 core memory blocks like Letta, but with duck-cli's SQLite backend
 */
export class MemoryBlocksManager {
  private store: SqliteStore;
  private blocks: Map<string, MemoryBlock> = new Map();
  private initialized: boolean = false;

  constructor() {
    this.store = new SqliteStore(DATA_DIR);
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Ensure all 8 core blocks exist
    const coreBlocks: MemoryBlockType[] = [
      'core_directives',
      'guidance',
      'user_preferences',
      'project_context',
      'codebase_patterns',
      'session_summaries',
      'pending_items',
      'learned_skills'
    ];

    for (const type of coreBlocks) {
      const existing = await this.loadBlock(type);
      if (!existing) {
        await this.createBlock(type, this.getDefaultContent(type));
      }
    }

    this.initialized = true;
  }

  private getDefaultContent(type: MemoryBlockType): string {
    const defaults: Record<MemoryBlockType, string> = {
      core_directives: `You are Duck Agent, a helpful AI coding assistant.
- Be concise but thorough
- Ask clarifying questions when needed
- Remember user preferences over time
- Proactively suggest improvements`,

      guidance: '', // Empty initially - populated by subconscious

      user_preferences: '', // Learned over time

      project_context: '', // Populated by reading codebase

      codebase_patterns: '', // Learned from code analysis

      session_summaries: '', // Accumulated session summaries

      pending_items: '', // TODOs and reminders

      learned_skills: '' // Auto-learned skills
    };
    return defaults[type];
  }

  /**
   * Create a new memory block
   */
  async createBlock(type: MemoryBlockType, content: string, label?: string): Promise<MemoryBlock> {
    const block: MemoryBlock = {
      id: `block_${type}_${Date.now()}`,
      type,
      content,
      label: label || type,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      accessCount: 0,
      importance: 0.5
    };

    // Store in SQLite
    await this.persistBlock(block);
    this.blocks.set(type, block);

    return block;
  }

  /**
   * Load a block from storage
   */
  private async loadBlock(type: MemoryBlockType): Promise<MemoryBlock | null> {
    // Query from SQLite store
    const memories = await this.store.search({
      query: type,
      limit: 1
    });

    if (memories.length > 0 && memories[0].content.includes(`"type":"${type}"`)) {
      try {
        return JSON.parse(memories[0].content) as MemoryBlock;
      } catch {
        return null;
      }
    }

    return null;
  }

  /**
   * Persist block to SQLite
   */
  private async persistBlock(block: MemoryBlock): Promise<void> {
    await this.store.save({
      content: JSON.stringify(block),
      context: 'memory_block',
      tags: [block.type, 'block'],
      importance: block.importance,
      source: 'memory_blocks_manager'
    });
  }

  /**
   * Get a memory block
   */
  async getBlock(type: MemoryBlockType): Promise<MemoryBlock | null> {
    if (!this.initialized) await this.initialize();

    // Check cache first
    if (this.blocks.has(type)) {
      const block = this.blocks.get(type)!;
      block.accessCount++;
      return block;
    }

    // Load from storage
    const block = await this.loadBlock(type);
    if (block) {
      this.blocks.set(type, block);
    }

    return block;
  }

  /**
   * Update a memory block
   */
  async updateBlock(type: MemoryBlockType, content: string): Promise<void> {
    if (!this.initialized) await this.initialize();

    const block = await this.getBlock(type);
    if (block) {
      block.content = content;
      block.updatedAt = Date.now();
      await this.persistBlock(block);
      this.blocks.set(type, block);
    }
  }

  /**
   * Append to a memory block (for accumulating content)
   */
  async appendToBlock(type: MemoryBlockType, content: string): Promise<void> {
    if (!this.initialized) await this.initialize();

    const block = await this.getBlock(type);
    if (block) {
      block.content += '\n' + content;
      block.updatedAt = Date.now();
      await this.persistBlock(block);
      this.blocks.set(type, block);
    }
  }

  /**
   * Get all blocks formatted for context injection
   */
  async getAllBlocksForContext(): Promise<string> {
    if (!this.initialized) await this.initialize();

    const types: MemoryBlockType[] = [
      'core_directives',
      'guidance',
      'user_preferences',
      'project_context',
      'codebase_patterns',
      'pending_items'
    ];

    let context = '';
    for (const type of types) {
      const block = await this.getBlock(type);
      if (block && block.content.trim()) {
        context += `\n### ${block.label}\n${block.content}\n`;
      }
    }

    return context;
  }

  /**
   * Get guidance block for whisper injection
   */
  async getGuidance(): Promise<string> {
    const block = await this.getBlock('guidance');
    return block?.content || '';
  }

  /**
   * Clear guidance after it's been consumed
   */
  async clearGuidance(): Promise<void> {
    await this.updateBlock('guidance', '');
  }

  /**
   * Add a pending item (TODO)
   */
  async addPendingItem(item: string): Promise<void> {
    await this.appendToBlock('pending_items', `- [ ] ${item}`);
  }

  /**
   * Mark pending item as complete
   */
  async completePendingItem(item: string): Promise<void> {
    const block = await this.getBlock('pending_items');
    if (block) {
      block.content = block.content.replace(
        `- [ ] ${item}`,
        `- [x] ${item} (completed ${new Date().toISOString()})`
      );
      await this.persistBlock(block);
    }
  }
}

export default MemoryBlocksManager;
