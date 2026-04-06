/**
 * 🦆 Duck Agent - Sub-Conscious Daemon
 * Background daemon for LLM-powered session analysis and memory
 * NO external Letta dependency
 * 
 * Usage: duck subconsciousd
 *        node dist/daemons/subconsciousd.js
 */

import { createServer, IncomingMessage, ServerResponse } from 'http';
import { analyzeTranscript, generateWhisper, TranscriptSegment, analyzeCouncilDeliberation } from '../subconscious/persistence/llm-analyzer.js';
import { SqliteStore, StoredMemory } from '../subconscious/persistence/sqlite-store.js';
import { FTSSearch, getFTSIndex } from '../subconscious/fts-search.js';

const DEFAULT_PORT = 4001;
const DATA_DIR = `${process.env.HOME || '/tmp'}/.duckagent/subconscious`;

interface SessionPayload {
  sessionId: string;
  transcript: TranscriptSegment[];
  cwd?: string;
  topics?: string[];
}

interface WhisperRequest {
  message?: string;
  recentTopics?: string[];
  sessionHistory?: string[];
  count?: number;
}

interface CouncilPayload {
  sessionId: string;
  topic: string;
  councilorId: string;
  deliberation: string;
}

interface DreamPayload {
  sessionId: string;
  startedAt: number;
  endedAt?: number;
  topics: string[];
  insights: string[];
  actionSummary?: string;
  patternsSeen?: string[];
}

/**
 * Start the Sub-Conscious daemon
 */
export async function startDaemon(port = DEFAULT_PORT): Promise<void> {
  const store = new SqliteStore(DATA_DIR);
  const fts = getFTSIndex();
  let ftsIndexed = false;
  
  // Simple in-memory queue for async analysis
  const analysisQueue: SessionPayload[] = [];
  let processing = false;

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url || '/', `http://localhost:${port}`);
    const path = url.pathname;
    const method = req.method || 'GET';

    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    // Parse body for POST requests
    let body = '';
    for await (const chunk of req) {
      body += chunk;
    }

    try {
      // Route: GET /
      if (path === '/' && method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          service: 'duck-subconsciousd',
          version: '1.0.0',
          status: 'running',
          port,
          dataDir: DATA_DIR
        }));
        return;
      }

      // Route: GET /health
      if (path === '/health' && method === 'GET') {
        const stats = await store.stats();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok', memories: stats.total }));
        return;
      }

      // Route: POST /session - Queue session for analysis
      if (path === '/session' && method === 'POST') {
        const payload = JSON.parse(body) as SessionPayload;
        analysisQueue.push(payload);
        
        // Process queue asynchronously
        processQueue();
        
        res.writeHead(202, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          status: 'queued', 
          queueLength: analysisQueue.length,
          sessionId: payload.sessionId 
        }));
        return;
      }

      // Route: GET /whisper - Get whisper for current context
      if (path === '/whisper' && method === 'GET') {
        const query = url.searchParams;
        const req2: WhisperRequest = {
          message: query.get('message') || undefined,
          recentTopics: query.get('topics')?.split(',').filter(Boolean),
          count: parseInt(query.get('count') || '5')
        };

        // Search relevant memories
        const memories = req2.message 
          ? await store.search({ query: req2.message, limit: req2.count || 5 })
          : await store.recent(req2.count || 5);

        // Generate LLM whisper
        const whisper = await generateWhisper({
          message: req2.message,
          memories,
          recentTopics: req2.recentTopics
        });

        // Persist the generated whisper as a memory so it can be recalled later
        if (whisper && whisper.length > 10) {
          const memory: StoredMemory = {
            id: `whisper_${Date.now()}_${Math.random().toString(36).slice(2)}`,
            content: whisper,
            context: `Generated from: ${req2.message || 'current context'}`,
            tags: ['whisper', 'subconscious', ...(req2.recentTopics || [])],
            importance: 0.5,
            source: 'whisper' as const,
            topic: req2.recentTopics?.[0] || 'general',
            createdAt: new Date().toISOString(),
            accessedAt: new Date().toISOString(),
            accessCount: 0
          };
          await store.save(memory);
          console.log(`[Sub-Conscious Daemon] Whisper saved: ${whisper.substring(0, 60)}...`);
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          whisper,
          memories: memories.slice(0, 3).map(m => ({ 
            id: m.id, 
            content: m.content, 
            source: m.source,
            importance: m.importance 
          }))
        }));
        return;
      }

      // Route: GET /recall - TF-IDF powered recall (FTS)
      if (path === '/recall' && method === 'GET') {
        const query = url.searchParams.get('q') || '';
        const limit = parseInt(url.searchParams.get('limit') || '20');
        const ftsMode = url.searchParams.get('fts') !== 'false'; // FTS on by default
        const since = url.searchParams.get('since') || undefined;

        // Lazy-build FTS index on first recall
        if (ftsMode && !ftsIndexed) {
          const allMemories = await store.recent(1000);
          fts.buildIndex(allMemories);
          ftsIndexed = true;
          console.log(`[Sub-Conscious] FTS index built: ${fts.getStats().indexedDocs} docs`);
        }

        let results;
        if (ftsMode && query) {
          // Use TF-IDF FTS search
          const allMemories = await store.search({ query: '', limit: 1000, since });
          const ftsResults = fts.search(query, allMemories, limit);
          results = ftsResults.map(r => r.memory);
        } else {
          // Fallback to basic search
          results = await store.search({ query, limit, since });
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ memories: results, count: results.length, fts: ftsMode }));
        return;
      }

      // Route: GET /council - Get council-specific memories
      if (path === '/council' && method === 'GET') {
        const topic = url.searchParams.get('topic') || '';
        const limit = parseInt(url.searchParams.get('limit') || '10');
        
        const memories = await store.getCouncilMemories(topic, limit);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ memories, count: memories.length }));
        return;
      }

      // Route: POST /council - Store council deliberation memory
      if (path === '/council' && method === 'POST') {
        const payload = JSON.parse(body) as CouncilPayload;
        
        const { insight, tags } = await analyzeCouncilDeliberation(
          payload.topic,
          payload.deliberation,
          payload.councilorId
        );

        await store.saveCouncilMemory(
          `cm_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          payload.councilorId,
          payload.topic,
          payload.deliberation,
          insight,
          tags
        );

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'saved', insight, tags }));
        return;
      }

      // Route: POST /dream - Store KAIROS dream insights
      if (path === '/dream' && method === 'POST') {
        const payload = JSON.parse(body) as DreamPayload;
        const duration = payload.endedAt ? payload.endedAt - payload.startedAt : 0;
        const content = `KAIROS Dream Consolidation\n\nInsights:\n${payload.insights.map(i => '- ' + i).join('\n')}\n\nTopics: ${payload.topics.join(', ')}\nDuration: ${Math.round(duration / 1000)}s`;

        const memory: StoredMemory = {
          id: `dream_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          content,
          context: `Patterns: ${(payload.patternsSeen || []).join(', ')}. Action summary: ${payload.actionSummary || 'N/A'}`,
          tags: ['dream', 'kairos', 'consolidation', ...(payload.topics || [])],
          importance: 0.6,
          source: 'dream' as const,
          topic: payload.topics?.[0] || 'general',
          createdAt: new Date(payload.startedAt).toISOString(),
          accessedAt: new Date().toISOString(),
          accessCount: 0,
        };
        await store.save(memory);
        console.log(`[Sub-Conscious Daemon] Dream saved: ${payload.insights.length} insights`);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'saved', memoryId: memory.id, insightsCount: payload.insights.length }));
        return;
      }

      // Route: GET /stats
      if (path === '/stats' && method === 'GET') {
        const stats = await store.stats();
        const recent = await store.recent(5);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ stats, recentMemories: recent.length }));
        return;
      }

      // Route: GET /recent
      if (path === '/recent' && method === 'GET') {
        const limit = parseInt(url.searchParams.get('limit') || '20');
        const memories = await store.recent(limit);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ memories, count: memories.length }));
        return;
      }

      // Route: DELETE /memory/:id
      if (path.startsWith('/memory/') && method === 'DELETE') {
        const id = path.split('/')[2];
        await store.delete(id);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'deleted', id }));
        return;
      }

      // Route: POST /clear
      if (path === '/clear' && method === 'POST') {
        await store.clear();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'cleared' }));
        return;
      }

      // 404
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found', path, method }));
    } catch (error: any) {
      console.error('[Sub-Conscious Daemon] Error:', error.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
  });

  /**
   * Process analysis queue asynchronously
   */
  async function processQueue(): Promise<void> {
    if (processing || analysisQueue.length === 0) return;
    processing = true;

    while (analysisQueue.length > 0) {
      const payload = analysisQueue.shift()!;
      try {
        console.log(`[Sub-Conscious Daemon] Analyzing session ${payload.sessionId}...`);
        
        const result = await analyzeTranscript(payload.transcript, payload.sessionId);
        
        if (result) {
          // Store session summary
          await store.saveSessionSummary(
            payload.sessionId,
            result.summary,
            result.patterns,
            result.keyDecisions,
            result.topics
          );

          // Store importance memories
          if (result.importance > 0.3) {
            const memory: StoredMemory = {
              id: `mem_${Date.now()}_${Math.random().toString(36).slice(2)}`,
              content: result.summary,
              context: result.patterns.join('; '),
              tags: result.tags,
              importance: result.importance,
              source: 'session',
              sessionId: payload.sessionId,
              topic: result.topics[0],
              createdAt: new Date().toISOString(),
              accessedAt: new Date().toISOString(),
              accessCount: 0
            };
            await store.save(memory);
          }

          console.log(`[Sub-Conscious Daemon] ✅ Session ${payload.sessionId} analyzed`);
          console.log(`  Topics: ${result.topics.join(', ')}`);
          console.log(`  Patterns: ${result.patterns.length}`);
          console.log(`  Importance: ${result.importance}`);
        }
      } catch (error: any) {
        console.error(`[Sub-Conscious Daemon] Analysis failed for ${payload.sessionId}:`, error.message);
      }
    }

    processing = false;
  }

  server.listen(port, () => {
    console.log(`\n🧠 Duck Sub-Conscious Daemon started on port ${port}`);
    console.log(`   Data directory: ${DATA_DIR}`);
    console.log(`   API: http://localhost:${port}/`);
    console.log(`   Whisper: GET /whisper?message=...`);
    console.log(`   Recall: GET /recall?q=...`);
    console.log(`   Session: POST /session {sessionId, transcript}`);
    console.log(`   Council: POST /council {sessionId, topic, councilorId, deliberation}`);
    console.log('');
  });

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n[Sub-Conscious Daemon] Shutting down...');
    store.close();
    server.close();
    process.exit(0);
  });
}

// Run if executed directly
const port = parseInt(process.env.SUBCONSCIOUS_PORT || String(DEFAULT_PORT));
startDaemon(port).catch(console.error);
