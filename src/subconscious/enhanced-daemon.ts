/**
 * 🦆 Duck Agent - Enhanced Sub-Conscious Daemon
 * Letta-inspired features: background watching, whisper injection, memory blocks
 * Uses MiniMax/Kimi/LM Studio - NO Letta endpoints
 */

import { createServer, IncomingMessage, ServerResponse } from 'http';
import { MemoryBlocksManager, MemoryBlockType } from './memory-blocks.js';
import { analyzeTranscript, generateWhisper, TranscriptSegment } from './persistence/llm-analyzer.js';
import { SqliteStore } from './persistence/sqlite-store.js';
import { FTSSearch, getFTSIndex, getSessionFTS } from './fts-search.js';
import { AgentMeshClient } from '../mesh/agent-mesh.js';

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
 * Enhanced Sub-Conscious Daemon
 * - Watches all sessions
 * - Maintains memory blocks
 * - Generates whispers
 * - Connects to mesh for inter-agent communication
 */
export class SubconsciousDaemon {
  private port: number;
  private store: SqliteStore;
  private memoryBlocks: MemoryBlocksManager;
  private fts: FTSSearch;
  private mesh: AgentMeshClient | null = null;
  private analysisQueue: SessionPayload[] = [];
  private processing = false;
  private server?: ReturnType<typeof createServer>;

  constructor(port = DEFAULT_PORT) {
    this.port = port;
    this.store = new SqliteStore(DATA_DIR);
    this.memoryBlocks = new MemoryBlocksManager();
    this.fts = getFTSIndex();
  }

  async start(): Promise<void> {
    // Initialize memory blocks
    await this.memoryBlocks.initialize();

    // Connect to mesh if available
    await this.connectToMesh();

    // Start HTTP server
    this.server = createServer((req, res) => this.handleRequest(req, res));

    await new Promise<void>((resolve) => {
      this.server!.listen(this.port, () => {
        console.log(`[Sub-Conscious] 🧠 Daemon running on port ${this.port}`);
        console.log(`[Sub-Conscious] Memory blocks initialized`);
        if (this.mesh) {
          console.log(`[Sub-Conscious] Connected to mesh`);
        }
        resolve();
      });
    });

    // Start background processing
    this.startBackgroundProcessing();
  }

  private async connectToMesh(): Promise<void> {
    try {
      this.mesh = new AgentMeshClient({
        serverUrl: process.env.AGENT_MESH_URL || 'http://localhost:4000',
        agentName: 'Sub-Conscious',
        capabilities: ['memory', 'whisper', 'analysis', 'background']
      });

      const agentId = await this.mesh.register();
      if (agentId) {
        await this.mesh.connect();

        // Subscribe to mesh events
        this.mesh.on('error', (event) => {
          console.log('[Sub-Conscious] Mesh error:', event);
        });

        // Broadcast that we're online
        await this.mesh.broadcast(JSON.stringify({
          type: 'subconscious_online',
          capabilities: ['memory_blocks', 'whispers', 'session_analysis']
        }));
      }
    } catch (e) {
      console.log('[Sub-Conscious] Mesh not available:', e);
      this.mesh = null;
    }
  }

  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url || '/', `http://localhost:${this.port}`);
    const path = url.pathname;
    const method = req.method || 'GET';

    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    // Parse body
    let body = '';
    for await (const chunk of req) {
      body += chunk;
    }

    try {
      // Health check
      if (path === '/health' && method === 'GET') {
        const stats = await this.store.stats();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'running',
          memoryBlocks: true,
          meshConnected: this.mesh?.isConnected() || false,
          queueSize: this.analysisQueue.length,
          stats
        }));
        return;
      }

      // Receive session transcript (async analysis)
      if (path === '/session' && method === 'POST') {
        const payload: SessionPayload = JSON.parse(body);
        this.analysisQueue.push(payload);
        res.writeHead(202, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ queued: true, queueSize: this.analysisQueue.length }));
        return;
      }

      // Get whisper (synchronous)
      if (path === '/whisper' && method === 'POST') {
        const request: WhisperRequest = JSON.parse(body);
        const whisper = await this.generateWhisper(request);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ whisper }));
        return;
      }

      // Get guidance (from memory blocks)
      if (path === '/guidance' && method === 'GET') {
        const guidance = await this.memoryBlocks.getGuidance();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ guidance }));
        return;
      }

      // Clear guidance
      if (path === '/guidance' && method === 'DELETE') {
        await this.memoryBlocks.clearGuidance();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ cleared: true }));
        return;
      }

      // Get memory block
      if (path.startsWith('/blocks/') && method === 'GET') {
        const type = path.split('/')[2] as MemoryBlockType;
        const block = await this.memoryBlocks.getBlock(type);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(block || { error: 'Block not found' }));
        return;
      }

      // Update memory block
      if (path.startsWith('/blocks/') && method === 'POST') {
        const type = path.split('/')[2] as MemoryBlockType;
        const { content } = JSON.parse(body);
        await this.memoryBlocks.updateBlock(type, content);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ updated: true }));
        return;
      }

      // Get all blocks for context
      if (path === '/blocks' && method === 'GET') {
        const context = await this.memoryBlocks.getAllBlocksForContext();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ context }));
        return;
      }

      // Store council deliberation
      if (path === '/council' && method === 'POST') {
        const payload: CouncilPayload = JSON.parse(body);
        await this.storeCouncilMemory(payload);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ stored: true }));
        return;
      }

      // Save dream
      if (path === '/dream' && method === 'POST') {
        const payload: DreamPayload = JSON.parse(body);
        await this.processDream(payload);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ saved: true }));
        return;
      }

      // Search memories
      if (path === '/search' && method === 'GET') {
        const query = url.searchParams.get('q') || '';
        const results = await this.searchMemories(query);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ results }));
        return;
      }

      // Stats
      if (path === '/stats' && method === 'GET') {
        const stats = await this.store.stats();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(stats));
        return;
      }

      res.writeHead(404);
      res.end(JSON.stringify({ error: 'Not found' }));
    } catch (e) {
      console.error('[Sub-Conscious] Request error:', e);
      res.writeHead(500);
      res.end(JSON.stringify({ error: String(e) }));
    }
  }

  private async generateWhisper(request: WhisperRequest): Promise<string | null> {
    // Get relevant memories
    const memories = await this.store.search({
      query: request.message || '',
      limit: 5
    });

    // Get guidance from memory blocks
    const guidance = await this.memoryBlocks.getGuidance();

    // Generate whisper using LLM
    const whisper = await generateWhisper({
      message: request.message,
      memories,
      recentTopics: request.recentTopics,
      sessionHistory: request.sessionHistory
    });

    // If we have guidance, prepend it
    if (guidance && whisper) {
      return `${guidance}\n\n${whisper}`;
    }

    return whisper || guidance || null;
  }

  private async storeCouncilMemory(payload: CouncilPayload): Promise<void> {
    // Store in SQLite
    await this.store.save({
      content: payload.deliberation,
      context: `council:${payload.topic}`,
      tags: ['council', payload.councilorId, payload.topic],
      importance: 0.8,
      source: 'council_deliberation',
      sessionId: payload.sessionId
    });

    // Update project_context block with council insights
    const block = await this.memoryBlocks.getBlock('project_context');
    if (block) {
      await this.memoryBlocks.appendToBlock('project_context',
        `\n[${new Date().toISOString()}] Council (${payload.councilorId}): ${payload.deliberation.slice(0, 200)}...`
      );
    }

    // Broadcast to mesh
    if (this.mesh?.isConnected()) {
      await this.mesh.broadcast(JSON.stringify({
        type: 'council_memory_stored',
        topic: payload.topic,
        councilorId: payload.councilorId
      }));
    }
  }

  private async processDream(payload: DreamPayload): Promise<void> {
    // Store dream
    await this.store.save({
      content: JSON.stringify(payload),
      context: 'dream',
      tags: ['dream', ...payload.topics],
      importance: 0.7,
      source: 'kairos_dream'
    });

    // Update guidance block with dream insights
    if (payload.insights.length > 0) {
      const guidance = payload.insights.map(i => `- ${i}`).join('\n');
      await this.memoryBlocks.updateBlock('guidance', guidance);
    }

    // Update session_summaries
    if (payload.actionSummary) {
      await this.memoryBlocks.appendToBlock('session_summaries',
        `\n[Dream ${new Date(payload.startedAt).toISOString()}] ${payload.actionSummary}`
      );
    }

    // Broadcast to mesh
    if (this.mesh?.isConnected()) {
      await this.mesh.broadcast(JSON.stringify({
        type: 'dream_complete',
        topics: payload.topics,
        insightCount: payload.insights.length
      }));
    }
  }

  private async searchMemories(query: string): Promise<any[]> {
    return this.store.search({ query, limit: 10 });
  }

  private startBackgroundProcessing(): void {
    setInterval(async () => {
      if (this.processing || this.analysisQueue.length === 0) return;

      this.processing = true;
      const payload = this.analysisQueue.shift()!;

      try {
        await this.analyzeSession(payload);
      } catch (e) {
        console.error('[Sub-Conscious] Analysis error:', e);
      } finally {
        this.processing = false;
      }
    }, 5000); // Process every 5 seconds
  }

  private async analyzeSession(payload: SessionPayload): Promise<void> {
    // Analyze transcript
    const analysis = await analyzeTranscript(payload.transcript, payload.sessionId);
    if (!analysis) return;

    // Update memory blocks based on analysis
    if (analysis.keyDecisions.length > 0) {
      await this.memoryBlocks.appendToBlock('project_context',
        `\n[${new Date().toISOString()}] Decisions: ${analysis.keyDecisions.join(', ')}`
      );
    }

    if (analysis.patterns.length > 0) {
      await this.memoryBlocks.appendToBlock('codebase_patterns',
        `\n[${new Date().toISOString()}] Patterns: ${analysis.patterns.join(', ')}`
      );
    }

    if (analysis.insights.length > 0) {
      const guidance = analysis.insights.map(i => `- ${i}`).join('\n');
      await this.memoryBlocks.updateBlock('guidance', guidance);
    }

    // Store in FTS index
    for (const topic of analysis.topics) {
      this.fts.addDocument(payload.sessionId, topic, analysis.summary);
    }

    // Broadcast analysis complete
    if (this.mesh?.isConnected()) {
      await this.mesh.broadcast(JSON.stringify({
        type: 'session_analyzed',
        sessionId: payload.sessionId,
        topics: analysis.topics,
        importance: analysis.importance
      }));
    }

    console.log(`[Sub-Conscious] Analyzed session ${payload.sessionId}: ${analysis.summary.slice(0, 100)}...`);
  }

  async stop(): Promise<void> {
    if (this.server) {
      this.server.close();
    }
    if (this.mesh) {
      await this.mesh.unregister();
    }
  }
}

// CLI entry point
if (require.main === module) {
  const daemon = new SubconsciousDaemon();
  daemon.start().catch(console.error);

  process.once('SIGINT', () => {
    console.log('\n[Sub-Conscious] Shutting down...');
    daemon.stop().then(() => process.exit(0));
  });
}

export default SubconsciousDaemon;
