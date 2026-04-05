/**
 * MoltBrain Skill - duck-cli Long-Term Memory
 * 
 * Usage:
 *   import { moltbrainService, getMoltBrain } from './index';
 *   
 *   // Search memory
 *   const results = await getMoltBrain().search('authentication');
 *   
 *   // Add observation
 *   await moltbrainService.createObservation(
 *     'Used JWT with 1hr expiry for auth',
 *     'decision',
 *     'my-project'
 *   );
 */

export {
  MoltBrainClient,
  getMoltBrain,
  moltbrainTools,
  DEFAULT_CONFIG,
} from './moltbrain-client';

export type {
  MoltBrainConfig,
  Observation,
  SearchResult,
  TimelineEntry,
  MoltBrainStats,
} from './moltbrain-client';

// Singleton instance
import { MoltBrainClient, DEFAULT_CONFIG } from './moltbrain-client';
const moltbrainService = new MoltBrainClient(DEFAULT_CONFIG);
export { moltbrainService };

/**
 * Start MoltBrain worker locally
 * 
 * Requires: npm install -g moltbrain or npx moltbrain
 */
export async function startWorker(): Promise<boolean> {
  return false;
}

/**
 * Check if MoltBrain is available
 */
export async function isAvailable(): Promise<boolean> {
  return await moltbrainService.health();
}

/**
 * Full memory search with context
 */
export async function searchWithContext(
  query: string,
  limit = 10
): Promise<{
  results: any[];
  context: string;
}> {
  const results = await moltbrainService.search(query, limit);
  
  const context = results.length > 0
    ? `Found ${results.length} relevant memories:\n\n${
        results.map(r => `- ${r.content}`).join('\n')
      }`
    : 'No relevant memories found.';

  return { results, context };
}

/**
 * Inject memory into current session
 */
export async function injectMemory(context: string): Promise<string> {
  const client = moltbrainService;
  
  const timeline = await client.timeline(undefined, 3);
  
  if (timeline.length === 0) {
    return context;
  }

  const memoryLines = ['## Recent Memory\n'];
  
  for (const entry of timeline) {
    for (const obs of entry.observations.slice(0, 3)) {
      memoryLines.push(`- [${obs.type}] ${obs.content.substring(0, 150)}`);
    }
  }

  return `${memoryLines.join('\n')}\n\n${context}`;
}
