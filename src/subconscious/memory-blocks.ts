/**
 * Memory Blocks Manager - Letta-style memory blocks WITHOUT Letta
 */

export interface MemoryBlock {
  name: string;
  content: string;
  updatedAt: number;
  version: number;
}

export class MemoryBlocksManager {
  private blocks: Map<string, MemoryBlock> = new Map();

  async initialize(): Promise<void> {
    // Initialize default blocks
    this.blocks.set('project_context', {
      name: 'project_context',
      content: '',
      updatedAt: Date.now(),
      version: 1
    });
    this.blocks.set('codebase_patterns', {
      name: 'codebase_patterns',
      content: '',
      updatedAt: Date.now(),
      version: 1
    });
    this.blocks.set('guidance', {
      name: 'guidance',
      content: '',
      updatedAt: Date.now(),
      version: 1
    });
    this.blocks.set('session_summaries', {
      name: 'session_summaries',
      content: '',
      updatedAt: Date.now(),
      version: 1
    });
    console.log('[MemoryBlocks] Initialized');
  }

  async getBlock(name: string): Promise<MemoryBlock | undefined> {
    return this.blocks.get(name);
  }

  async updateBlock(name: string, content: string): Promise<void> {
    const block = this.blocks.get(name);
    if (block) {
      block.content = content;
      block.updatedAt = Date.now();
      block.version++;
    }
  }

  async appendToBlock(name: string, content: string): Promise<void> {
    const block = this.blocks.get(name);
    if (block) {
      block.content += content;
      block.updatedAt = Date.now();
      block.version++;
    }
  }

  async getAllBlocks(): Promise<MemoryBlock[]> {
    return Array.from(this.blocks.values());
  }
}

export default MemoryBlocksManager;
