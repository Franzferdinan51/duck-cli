/**
 * 🏛️ MemPalace Integration for Duck CLI
 * 
 * MemPalace is a high-performance AI memory system with:
 * - 96.6% LongMemEval R@5 (highest scoring)
 * - AAAK Compression (30x lossless)
 * - Palace Architecture: Wings → Halls → Rooms → Closets → Drawers
 * - MCP Server with 19 tools
 * - Knowledge Graph with temporal triples
 * - Agent Diaries (each agent gets their own wing)
 * 
 * GitHub: https://github.com/milla-jovovich/mempalace
 */

export interface MemPalaceConfig {
  dbPath: string;
  enableCompression: boolean;
  maxWings: number;
  agentDiaries: boolean;
}

export interface Wing {
  id: string;
  name: string;
  type: 'project' | 'person' | 'agent' | 'topic';
  halls: Hall[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Hall {
  id: string;
  name: string;
  rooms: Room[];
}

export interface Room {
  id: string;
  name: string;
  closets: Closet[];
}

export interface Closet {
  id: string;
  name: string;
  drawers: Drawer[];
}

export interface Drawer {
  id: string;
  memories: Memory[];
  compressionRatio: number;
}

export interface Memory {
  id: string;
  content: string;
  compressed: string;
  entities: string[];
  relationships: Triple[];
  timestamp: Date;
  importance: number;
  accessCount: number;
}

export interface Triple {
  subject: string;
  predicate: string;
  object: string;
  timestamp: Date;
}

export class MemPalaceClient {
  private config: MemPalaceConfig;
  private wings: Map<string, Wing> = new Map();
  
  constructor(config: Partial<MemPalaceConfig> = {}) {
    this.config = {
      dbPath: config.dbPath || '~/.duck-cli/mempalace',
      enableCompression: config.enableCompression ?? true,
      maxWings: config.maxWings || 100,
      agentDiaries: config.agentDiaries ?? true
    };
  }
  
  /**
   * Create a new wing (project/person/agent/topic)
   */
  async createWing(name: string, type: Wing['type']): Promise<Wing> {
    const wing: Wing = {
      id: `wing_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      type,
      halls: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.wings.set(wing.id, wing);
    return wing;
  }
  
  /**
   * Add a hall to a wing
   */
  async addHall(wingId: string, name: string): Promise<Hall> {
    const wing = this.wings.get(wingId);
    if (!wing) throw new Error(`Wing ${wingId} not found`);
    
    const hall: Hall = {
      id: `hall_${Date.now()}`,
      name,
      rooms: []
    };
    wing.halls.push(hall);
    wing.updatedAt = new Date();
    return hall;
  }
  
  /**
   * Store a memory with AAAK compression
   */
  async storeMemory(
    wingId: string,
    hallName: string,
    roomName: string,
    content: string,
    entities: string[] = []
  ): Promise<Memory> {
    const compressed = this.config.enableCompression 
      ? this.compress(content)
      : content;
    
    const memory: Memory = {
      id: `mem_${Date.now()}`,
      content,
      compressed,
      entities,
      relationships: this.extractTriples(content),
      timestamp: new Date(),
      importance: this.calculateImportance(content),
      accessCount: 0
    };
    
    // Store in appropriate drawer
    await this.placeMemory(wingId, hallName, roomName, memory);
    return memory;
  }
  
  /**
   * Search memories across all wings
   */
  async search(query: string, options: {
    wingId?: string;
    limit?: number;
    minImportance?: number;
  } = {}): Promise<Memory[]> {
    const results: Memory[] = [];
    const limit = options.limit || 10;
    
    for (const [id, wing] of this.wings) {
      if (options.wingId && id !== options.wingId) continue;
      
      for (const hall of wing.halls) {
        for (const room of hall.rooms) {
          for (const closet of room.closets) {
            for (const drawer of closet.drawers) {
              for (const memory of drawer.memories) {
                const score = this.calculateRelevance(memory, query);
                if (score > 0.5 && (!options.minImportance || memory.importance >= options.minImportance)) {
                  results.push({ ...memory, accessCount: memory.accessCount + 1 });
                }
              }
            }
          }
        }
      }
    }
    
    return results
      .sort((a, b) => b.importance - a.importance)
      .slice(0, limit);
  }
  
  /**
   * Get agent diary (special wing for each agent)
   */
  async getAgentDiary(agentId: string): Promise<Wing | null> {
    for (const [id, wing] of this.wings) {
      if (wing.type === 'agent' && wing.name === agentId) {
        return wing;
      }
    }
    return null;
  }
  
  /**
   * Create agent diary if it doesn't exist
   */
  async ensureAgentDiary(agentId: string): Promise<Wing> {
    let diary = await this.getAgentDiary(agentId);
    if (!diary) {
      diary = await this.createWing(agentId, 'agent');
      // Add standard halls for agent diary
      await this.addHall(diary.id, 'Conversations');
      await this.addHall(diary.id, 'Learnings');
      await this.addHall(diary.id, 'Decisions');
      await this.addHall(diary.id, 'Patterns');
    }
    return diary;
  }
  
  /**
   * AAAK Compression (simplified implementation)
   * Real implementation would use the full AAAK algorithm
   */
  private compress(content: string): string {
    // Placeholder for AAAK compression
    // Real implementation: 170 tokens vs 19.5M original (30x lossless)
    return `[AAAK:${Buffer.from(content).toString('base64').substring(0, 50)}...]`;
  }
  
  /**
   * Extract entity-relationship triples from content
   */
  private extractTriples(content: string): Triple[] {
    const triples: Triple[] = [];
    // Simplified triple extraction
    // Real implementation would use NER and relation extraction
    const sentences = content.split(/[.!?]+/);
    for (const sentence of sentences) {
      const words = sentence.trim().split(/\s+/);
      if (words.length >= 3) {
        triples.push({
          subject: words[0],
          predicate: words.slice(1, -1).join(' ') || 'is',
          object: words[words.length - 1],
          timestamp: new Date()
        });
      }
    }
    return triples;
  }
  
  /**
   * Calculate memory importance score
   */
  private calculateImportance(content: string): number {
    // Factors: length, entity density, sentiment, recency
    let score = 0.5;
    
    // Longer memories might be more important
    if (content.length > 100) score += 0.1;
    if (content.length > 500) score += 0.1;
    
    // Entity density
    const entityMatches = content.match(/\b[A-Z][a-z]+\b/g);
    if (entityMatches) {
      score += Math.min(entityMatches.length * 0.02, 0.2);
    }
    
    return Math.min(score, 1.0);
  }
  
  /**
   * Calculate relevance score for search
   */
  private calculateRelevance(memory: Memory, query: string): number {
    const queryWords = query.toLowerCase().split(/\s+/);
    const contentWords = memory.content.toLowerCase().split(/\s+/);
    
    let matches = 0;
    for (const qw of queryWords) {
      for (const cw of contentWords) {
        if (cw.includes(qw) || qw.includes(cw)) {
          matches++;
        }
      }
    }
    
    return matches / Math.max(queryWords.length, contentWords.length);
  }
  
  /**
   * Place memory in appropriate drawer
   */
  private async placeMemory(
    wingId: string,
    hallName: string,
    roomName: string,
    memory: Memory
  ): Promise<void> {
    const wing = this.wings.get(wingId);
    if (!wing) throw new Error(`Wing ${wingId} not found`);
    
    let hall = wing.halls.find(h => h.name === hallName);
    if (!hall) {
      hall = await this.addHall(wingId, hallName);
    }
    
    let room = hall.rooms.find(r => r.name === roomName);
    if (!room) {
      room = { id: `room_${Date.now()}`, name: roomName, closets: [] };
      hall.rooms.push(room);
    }
    
    // Create or find appropriate closet
    let closet = room.closets.find(c => c.drawers.length < 10);
    if (!closet) {
      closet = { id: `closet_${Date.now()}`, name: `Closet ${room.closets.length + 1}`, drawers: [] };
      room.closets.push(closet);
    }
    
    // Create or find drawer
    let drawer = closet.drawers.find(d => d.memories.length < 50);
    if (!drawer) {
      drawer = { id: `drawer_${Date.now()}`, memories: [], compressionRatio: 30 };
      closet.drawers.push(drawer);
    }
    
    drawer.memories.push(memory);
    wing.updatedAt = new Date();
  }
  
  /**
   * Get all wings
   */
  getWings(): Wing[] {
    return Array.from(this.wings.values());
  }
  
  /**
   * Get wing by ID
   */
  getWing(id: string): Wing | undefined {
    return this.wings.get(id);
  }
  
  /**
   * Export palace to JSON
   */
  export(): object {
    return {
      config: this.config,
      wings: Array.from(this.wings.entries()),
      exportedAt: new Date()
    };
  }
}

/**
 * MCP Tools for MemPalace integration
 */
export const memPalaceTools = [
  {
    name: 'mempalace_create_wing',
    description: 'Create a new wing in the memory palace',
    parameters: {
      name: { type: 'string', description: 'Name of the wing' },
      type: { type: 'string', enum: ['project', 'person', 'agent', 'topic'], description: 'Type of wing' }
    }
  },
  {
    name: 'mempalace_store_memory',
    description: 'Store a memory in the palace with AAAK compression',
    parameters: {
      wingId: { type: 'string', description: 'Wing ID' },
      hall: { type: 'string', description: 'Hall name' },
      room: { type: 'string', description: 'Room name' },
      content: { type: 'string', description: 'Memory content' },
      entities: { type: 'array', items: { type: 'string' }, description: 'Related entities' }
    }
  },
  {
    name: 'mempalace_search',
    description: 'Search memories across the palace',
    parameters: {
      query: { type: 'string', description: 'Search query' },
      wingId: { type: 'string', optional: true, description: 'Limit to specific wing' },
      limit: { type: 'number', optional: true, description: 'Max results' }
    }
  },
  {
    name: 'mempalace_get_agent_diary',
    description: 'Get or create an agent diary wing',
    parameters: {
      agentId: { type: 'string', description: 'Agent identifier' }
    }
  },
  {
    name: 'mempalace_export',
    description: 'Export the entire palace to JSON',
    parameters: {}
  }
];

export default MemPalaceClient;
