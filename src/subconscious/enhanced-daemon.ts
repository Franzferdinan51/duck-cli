/**
 * Duck Agent Subconscious - Enhanced Daemon
 * Claude Subconscious-style but WITHOUT Letta - WITH AI Council integration
 * Port 3090, SQLite persistence, FTS search, memory blocks
 */

import express from 'express';
import { EventEmitter } from 'events';
import { MemoryStore } from './memory-store.js';
import { MemoryBlocksManager } from './memory-blocks.js';
import { FullTextSearch } from './fts.js';
import { AgentMeshClient } from '../mesh/client.js';
import { analyzeTranscript } from './analyzer.js';
import type { WhisperSource } from './types.js';

interface SessionPayload {
  sessionId: string;
  transcript: string[];
  timestamp: string;
}

interface CouncilPayload {
  topic: string;
  deliberation: string;
  councilorId: string;
  sessionId: string;
}

interface DreamPayload {
  topics: string[];
  insights: string[];
  actionSummary: string;
  startedAt: string;
}

interface AnalysisPayload {
  type: 'session' | 'council' | 'dream';
  sessionId?: string;
  topic?: string;
  content?: string;
  timestamp: string;
}

export class SubconsciousDaemon extends EventEmitter {
  private app: express.Application;
  private server: any;
  private port: number;
  private store: MemoryStore;
  private memoryBlocks: MemoryBlocksManager;
  private fts: FullTextSearch;
  private mesh?: AgentMeshClient;
  private analysisQueue: AnalysisPayload[] = [];
  private processing = false;

  constructor(port = 3090) {
    super();
    this.app = express();
    this.port = port;
    this.store = new MemoryStore();
    this.memoryBlocks = new MemoryBlocksManager();
    this.fts = new FullTextSearch();

    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    this.app.use(express.json({ limit: '10mb' }));
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (_req, res) => {
      res.json({
        status: 'ok',
        service: 'subconscious-daemon',
        port: this.port,
        meshConnected: this.mesh?.isConnected() || false
      });
    });

    // POST /analyze - Analyze session transcript
    this.app.post('/analyze', async (req, res) => {
      const payload: SessionPayload = req.body;
      this.analysisQueue.push({
        type: 'session',
        sessionId: payload.sessionId,
        content: payload.transcript.join('\n'),
        timestamp: payload.timestamp
      });
      res.json({ status: 'queued', sessionId: payload.sessionId });
    });

    // POST /council - Store council deliberation
    this.app.post('/council', async (req, res) => {
      const payload: CouncilPayload = req.body;
      await this.processCouncil(payload);
      res.json({ status: 'stored', topic: payload.topic });
    });

    // POST /dream - Store KAIROS dream
    this.app.post('/dream', async (req, res) => {
      const payload: DreamPayload = req.body;
      await this.processDream(payload);
      res.json({ status: 'stored', insightCount: payload.insights.length });
    });

    // GET /whisper - Get whisper for current context
    this.app.get('/whisper', async (req, res) => {
      const context = req.query.context as string;
      const whisper = await this.generateWhisper(context);
      res.json(whisper);
    });

    // GET /memories - Search memories
    this.app.get('/memories', async (req, res) => {
      const query = req.query.q as string;
      const memories = await this.searchMemories(query);
      res.json(memories);
    });

    // GET /blocks/:name - Get memory block
    this.app.get('/blocks/:name', async (req, res) => {
      const block = await this.memoryBlocks.getBlock(req.params.name);
      if (!block) {
        res.status(404).json({ error: 'Block not found' });
        return;
      }
      res.json(block);
    });
  }

  async start(): Promise<void> {
    // Initialize stores
    await this.store.initialize();
    await this.memoryBlocks.initialize();

    // Connect to mesh
    this.mesh = new AgentMeshClient('ws://localhost:4000');
    await this.mesh.register({
      id: 'subconscious-daemon',
      name: 'Sub-Conscious Daemon',
      capabilities: ['memory', 'analysis', 'whisper']
    });

    // Start background processing
    this.startBackgroundProcessing();

    // Start server
    return new Promise((resolve) => {
      this.server = this.app.listen(this.port, () => {
        console.log(`[Sub-Conscious] Daemon running on port ${this.port}`);
        console.log(`[Sub-Conscious] Connected to mesh at ws://localhost:4000`);
        resolve();
      });
    });
  }

  private async processCouncil(payload: CouncilPayload): Promise<void> {
    // Store in SQLite
    await this.store.save({
      content: payload.deliberation,
      context: `council:${payload.topic}`,
      tags: ['council', payload.councilorId, payload.topic],
      importance: 0.8,
      source: 'council_deliberation' as WhisperSource,
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
      source: 'kairos_dream' as WhisperSource
    });

    // Update guidance block with dream insights
    if (payload.insights.length > 0) {
      const guidance = payload.insights.map((i: string) => `- ${i}`).join('\n');
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

  private async generateWhisper(context: string): Promise<any> {
    // Search relevant memories
    const memories = await this.searchMemories(context);

    // Get recent blocks
    const blocks = await this.memoryBlocks.getAllBlocks();

    // Generate whisper based on context
    const whisper = {
      message: this.buildWhisperMessage(memories, blocks, context),
      confidence: this.calculateConfidence(memories),
      timestamp: new Date().toISOString(),
      source: 'memory_blocks_manager' as WhisperSource
    };

    return whisper;
  }

  private buildWhisperMessage(memories: any[], blocks: any[], context: string): string {
    // Build contextual whisper from memories and blocks
    const relevantMemories = memories.slice(0, 3);
    const recentBlocks = blocks.filter(b => b.updatedAt > Date.now() - 86400000);

    let message = '';

    if (relevantMemories.length > 0) {
      message += `Based on ${relevantMemories.length} relevant memories. `;
    }

    if (recentBlocks.length > 0) {
      message += `Recent activity in ${recentBlocks.length} memory blocks. `;
    }

    message += `Context: ${context}`;

    return message;
  }

  private calculateConfidence(memories: any[]): number {
    if (memories.length === 0) return 0.3;
    const avgImportance = memories.reduce((sum, m) => sum + (m.importance || 0.5), 0) / memories.length;
    return Math.min(0.9, avgImportance + 0.2);
  }

  private startBackgroundProcessing(): void {
    setInterval(async () => {
      if (this.processing || this.analysisQueue.length === 0) return;

      this.processing = true;
      const payload = this.analysisQueue.shift()!;

      try {
        if (payload.type === 'session' && payload.sessionId) {
          await this.analyzeSession({
            sessionId: payload.sessionId,
            transcript: payload.content?.split('\n') || [],
            timestamp: payload.timestamp
          });
        }
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
      const guidance = analysis.insights.map((i: string) => `- ${i}`).join('\n');
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
