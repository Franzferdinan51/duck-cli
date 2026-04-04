/**
 * MoltBrain Integration for duck-cli
 * 
 * Long-term memory layer that learns and recalls context automatically.
 * Works with OpenClaw MCP or standalone via REST API.
 * 
 * API: http://localhost:37777
 */

export interface MoltBrainConfig {
  workerUrl: string;
  port: number;
  maxObservations: number;
  provider: 'claude' | 'openai' | 'anthropic';
  theme: 'dark' | 'light' | 'system';
}

export const DEFAULT_CONFIG: MoltBrainConfig = {
  workerUrl: 'http://localhost:37777',
  port: 37777,
  maxObservations: 50,
  provider: 'claude',
  theme: 'system',
};

export interface Observation {
  id: string;
  content: string;
  sessionId: string;
  project?: string;
  tags: string[];
  timestamp: string;
  type: 'decision' | 'discovery' | 'code' | 'error' | 'note';
}

export interface SearchResult {
  id: string;
  content: string;
  score: number;
  sessionId: string;
  timestamp: string;
}

export interface TimelineEntry {
  date: string;
  observations: Observation[];
  sessionCount: number;
}

export interface MoltBrainStats {
  totalObservations: number;
  totalSessions: number;
  totalProjects: number;
  totalTokens: number;
  tags: Record<string, number>;
}

/**
 * MoltBrain API Client
 */
export class MoltBrainClient {
  private config: MoltBrainConfig;

  constructor(config: Partial<MoltBrainConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Check if MoltBrain worker is running
   */
  async health(): Promise<boolean> {
    try {
      const res = await fetch(`${this.config.workerUrl}/health`);
      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * Search observations semantically
   */
  async search(query: string, limit = 10): Promise<SearchResult[]> {
    try {
      const res = await fetch(
        `${this.config.workerUrl}/api/search?q=${encodeURIComponent(query)}&limit=${limit}`
      );
      if (!res.ok) return [];
      return await res.json();
    } catch {
      return [];
    }
  }

  /**
   * Get timeline for project/time
   */
  async timeline(project?: string, days = 7): Promise<TimelineEntry[]> {
    try {
      const url = new URL(`${this.config.workerUrl}/api/timeline`);
      url.searchParams.set('days', String(days));
      if (project) url.searchParams.set('project', project);
      
      const res = await fetch(url.toString());
      if (!res.ok) return [];
      return await res.json();
    } catch {
      return [];
    }
  }

  /**
   * Get memory statistics
   */
  async stats(): Promise<MoltBrainStats | null> {
    try {
      const res = await fetch(`${this.config.workerUrl}/api/stats`);
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  /**
   * Export memory to JSON
   */
  async export(format: 'json' | 'csv' | 'markdown' = 'json'): Promise<string> {
    try {
      const res = await fetch(
        `${this.config.workerUrl}/api/export?format=${format}`
      );
      if (!res.ok) return '';
      return await res.text();
    } catch {
      return '';
    }
  }

  /**
   * Add a tag to observation
   */
  async tag(observationId: string, tag: string): Promise<boolean> {
    try {
      const res = await fetch(
        `${this.config.workerUrl}/api/observations/${observationId}/tag`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tag }),
        }
      );
      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get observation by ID
   */
  async getObservation(id: string): Promise<Observation | null> {
    try {
      const res = await fetch(
        `${this.config.workerUrl}/api/observations/${id}`
      );
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  /**
   * Create observation manually
   */
  async createObservation(
    content: string,
    type: Observation['type'],
    project?: string,
    tags: string[] = []
  ): Promise<Observation | null> {
    try {
      const res = await fetch(`${this.config.workerUrl}/api/observations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, type, project, tags }),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  /**
   * Prune old observations
   */
  async prune(daysOld: number): Promise<number> {
    try {
      const res = await fetch(
        `${this.config.workerUrl}/api/prune?days=${daysOld}`,
        { method: 'POST' }
      );
      if (!res.ok) return 0;
      const data = await res.json();
      return data.deleted || 0;
    } catch {
      return 0;
    }
  }
}

// Singleton
let moltbrainInstance: MoltBrainClient | null = null;

export function getMoltBrain(config?: Partial<MoltBrainConfig>): MoltBrainClient {
  if (!moltbrainInstance) {
    moltbrainInstance = new MoltBrainClient(config);
  }
  return moltbrainInstance;
}

// CLI tools
export const moltbrainTools = [
  {
    name: 'moltbrain_search',
    description: 'Search long-term memory semantically',
    execute: async (query: string) => {
      const client = getMoltBrain();
      const results = await client.search(query);
      if (results.length === 0) return 'No results found';
      return results
        .map(r => `[${r.score.toFixed(2)}] ${r.content.substring(0, 200)}`)
        .join('\n\n');
    },
  },
  {
    name: 'moltbrain_stats',
    description: 'Show memory statistics',
    execute: async () => {
      const client = getMoltBrain();
      const stats = await client.stats();
      if (!stats) return 'MoltBrain not running or not accessible';
      return JSON.stringify(stats, null, 2);
    },
  },
  {
    name: 'moltbrain_timeline',
    description: 'Get memory timeline',
    execute: async (days = 7) => {
      const client = getMoltBrain();
      const timeline = await client.timeline(undefined, days);
      if (timeline.length === 0) return 'No timeline data';
      return JSON.stringify(timeline, null, 2);
    },
  },
];

export default MoltBrainClient;
