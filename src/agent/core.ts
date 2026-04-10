/**
 * 🦆 Duck Agent - Super Agent Core
 * SQLite memory, streaming, planning, cron, subagents, learning loop
 */

import { EventEmitter } from 'events';
import { ProviderManager } from '../providers/manager.js';
import { MemorySystem } from '../memory/system.js';
import { ToolRegistry, ToolDefinition } from '../tools/registry.js';
import { SkillRunner } from '../skills/runner.js';
import { DesktopControl } from '../integrations/desktop.js';
import { osType, homeDir } from '../utils/platform.js';
import { join } from 'path';
import { DangerousToolGuard, ToolRisk, ApprovalCallback } from '../tools/approval.js';
import { Planner, Plan, PlanStep } from './planner.js';
import { SessionStore } from './session-store.js';
import { StreamManager, streamManager } from './stream-manager.js';
import { CronScheduler } from './cron-scheduler.js';
import { SubagentManager } from './subagent-manager.js';
import { LearningLoop } from './learning-loop.js';
import { SpeculativeExecutor, SpeculativeResult, codeQualityScorer, analysisQualityScorer } from './speculative.js';
import { tracer } from '../tracing/execution-tracer.js';
import { ExecutionTrace, maybeStartTrace, maybeEndTrace } from './execution-trace.js';
import { agentCardManager } from '../mesh/agent-card.js';
import { LoopDetector } from './loop-detector.js';
import { SessionLogger } from './session-logger.js';
import { SessionStream } from './session-stream.js';
import { WorkflowRunner } from './workflow-runner.js';
import { FlowRunner, defineFlow, acp, action, compute, checkpoint, shell as flowShell } from './flow-graph.js';
import { FlowTrace } from './flow-trace.js';
import { AndroidTools, getAndroidTools } from './android-tools.js';
import {
  TOOL_RETRY_REGISTRY,
  getToolRetryConfig,
  classifyError,
  shouldRetryOnError,
  shouldFallbackOnError,
  logEvent,
  ToolErrorType,
  ToolRegistryEntry
} from './tool-registry.js';
import { getFailureReporter } from '../orchestrator/failure-reporter.js';
import { scanForSecrets, redactFromResult, warnOnSecrets } from './secret-scanner.js';
import { captureDiffSnapshot, generateDiff, formatInlineDiff } from './inline-diff.js';
import { CredentialPoolManager } from './credential-pool.js';
import { MemoryManager } from './memory-provider.js';
import { getTTS } from '../tools/tts.js';
import { WhisperEngine, MemoryBridge } from '../subconscious/index.js';
import type { Whisper } from '../subconscious/index.js';
import { compileSystemPrompt, SystemPromptOptions } from '../prompts/index.js';
import { existsSync, readFileSync } from 'fs';
import { dirname } from 'path';
import { homedir } from 'os';

// Runtime path for SOUL-template.md fallback personality
export function getSoulTemplate(): string {
  try {
    // Try common paths for prompts/SOUL-template.md relative to this file
    const possiblePaths = [
      join(dirname(require.resolve('./core.js')), '..', 'prompts', 'SOUL-template.md'),
      join(homedir(), '.openclaw', 'workspace', 'duck-cli-src', 'src', 'prompts', 'SOUL-template.md'),
    ];
    for (const p of possiblePaths) {
      if (existsSync(p)) {
        return readFileSync(p, 'utf-8');
      }
    }
  } catch (e) {
    // Fall through
  }
  return '';
}

export { Planner, Plan, PlanStep };
export { DangerousToolGuard, ToolRisk };
export { SessionStore };
export { StreamManager, streamManager };
export { CronScheduler };
export { SubagentManager };
export { LearningLoop };
export { SpeculativeExecutor, SpeculativeResult };
export { codeQualityScorer, analysisQualityScorer };

export interface AgentConfig {
  name?: string;
  model?: string;
  provider?: string;
  maxIterations?: number;
  maxHistory?: number;
  costBudget?: number;
  learningEnabled?: boolean;
  quietMode?: boolean;
  sessionId?: string;
  streamEnabled?: boolean;
  planningEnabled?: boolean;
  cronEnabled?: boolean;
  subagentEnabled?: boolean;
  memoryDir?: string;
}

export interface Message {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: number;
  cost?: number;
  tokens?: number;
}

export interface LearningEntry {
  input: string;
  output: string;
  success: boolean;
  timestamp: number;
  feedback?: string;
}

export interface CostRecord {
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  cost: number;
  timestamp: number;
}

export interface AgentMetrics {
  totalInteractions: number;
  successfulInteractions: number;
  failedInteractions: number;
  totalCost: number;
  totalTokens: number;
  averageConfidence: number;
}

export class Agent extends EventEmitter {
  readonly id: string;
  name: string;
  
  private config: AgentConfig;
  private providers: ProviderManager;
  private memory: MemorySystem;
  private tools: ToolRegistry;
  private skills: SkillRunner;
  private desktop: DesktopControl;
  private guard: DangerousToolGuard;
  private planner: Planner;
  private sessions: SessionStore;
  private streams: StreamManager;
  private cron: CronScheduler;
  private subagents: SubagentManager;
  private learning: LearningLoop;
  private speculative: SpeculativeExecutor;
  private loopDetector: LoopDetector;
  private sessionLogger: SessionLogger;
  private sessionStream: SessionStream;
  private androidTools: AndroidTools;
  private executionTrace: ExecutionTrace;
  // Hermes v2026.4.3 features
  private secretScanner: any = null;  // SecretScanner instance
  private credPoolManager: any = null;  // CredentialPoolManager instance
  private memoryManager: any = null;  // MemoryManager instance
  private initialized: boolean = false;
  
  // Sub-Conscious integration
  private whisperEngine: WhisperEngine;
  private memoryBridge: MemoryBridge;
  
  // Conversation
  private history: Message[] = [];
  private maxHistory: number;
  private sessionId: string;
  
  // Learning
  private learningEnabled: boolean;
  private learnedPatterns: Map<string, string> = new Map();
  private learningLog: LearningEntry[] = [];
  
  // Cost tracking
  private costRecords: CostRecord[] = [];
  private costBudget: number;
  private totalCost: number = 0;
  
  // Metrics
  private metrics: AgentMetrics = {
    totalInteractions: 0,
    successfulInteractions: 0,
    failedInteractions: 0,
    totalCost: 0,
    totalTokens: 0,
    averageConfidence: 0.8
  };

  constructor(config: AgentConfig = {}) {
    super();
    
    this.id = `duck_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this.name = config.name || 'Duck Agent';
    this.sessionId = config.sessionId || `session_${Date.now()}`;
    this.config = {
      maxIterations: config.maxIterations || 10,
      maxHistory: config.maxHistory || 50,
      costBudget: config.costBudget || 10,
      learningEnabled: config.learningEnabled !== false,
      quietMode: config.quietMode !== undefined ? config.quietMode : true,
      streamEnabled: config.streamEnabled !== false,
      planningEnabled: config.planningEnabled !== false,
      cronEnabled: config.cronEnabled !== false,
      subagentEnabled: config.subagentEnabled !== false,
      ...config
    };
    
    this.maxHistory = this.config.maxHistory!;
    this.learningEnabled = this.config.learningEnabled!;
    this.costBudget = this.config.costBudget!;
    
    // Initialize all systems
    const memDir = this.config.memoryDir || undefined;
    this.providers = new ProviderManager();
    this.memory = new MemorySystem(memDir);
    this.tools = new ToolRegistry();
    this.skills = new SkillRunner();
    this.desktop = new DesktopControl();
    this.guard = new DangerousToolGuard(this.sessionId);
    this.planner = new Planner(this.memory);
    this.sessions = new SessionStore(memDir);
    this.streams = streamManager;
    this.cron = new CronScheduler();
    this.subagents = new SubagentManager();
    this.learning = new LearningLoop(memDir);
    this.speculative = new SpeculativeExecutor(this.providers);
    this.loopDetector = new LoopDetector();
    this.sessionLogger = new SessionLogger('/tmp/duck-sessions', this.name, 'duck-cli', 'multi-provider');
    this.sessionStream = new SessionStream(join(homeDir(), '.duck', 'sessions'), this.name);
    this.androidTools = getAndroidTools();
    this.executionTrace = new ExecutionTrace(this.sessionId);
    this.guard.setQuietMode(this.config.quietMode!);
    
    // Initialize Sub-Conscious
    this.whisperEngine = new WhisperEngine();
    this.memoryBridge = new MemoryBridge();
    
    // Subscribe to learning nudges
    this.learning.on('nudge', (nudge: any) => {
      this.emit('nudge', nudge);
    });
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
    
    console.log(`🦆 ${this.name} initializing...`);
    
    await this.providers.load();
    await this.memory.initialize();
    await this.skills.load();

    // Hermes v2026.4.3: Initialize pluggable memory provider system
    const { MemoryManager } = await import('./memory-provider.js');
    this.memoryManager = new MemoryManager();
    await this.memoryManager.initializeAll(this.sessionId);

    // Hermes v2026.4.3: Initialize credential pool manager (auto-configures from env)
    const { CredentialPoolManager } = await import('./credential-pool.js');
    this.credPoolManager = new CredentialPoolManager();
    this.credPoolManager.autoConfigure();

    // Hermes v2026.4.3: Initialize secret scanner
    const { SecretScanner } = await import('./secret-scanner.js');
    this.secretScanner = new SecretScanner();
    this.registerTools();
    
    const stats = this.memory.stats();
    console.log(`   + Memory: ${stats.memories} entries`);
    console.log(`   + Sessions: ${this.sessions.stats().totalSessions} stored`);
    console.log(`   + Learned skills: ${this.learning.stats().learnedSkills}`);
    console.log(`   + Cron jobs: ${this.cron.stats().totalJobs}`);
    if (this.credPoolManager) {
      const stats = this.credPoolManager.allStats();
      const poolCount = Object.keys(stats).filter(k => stats[k].total > 0).length;
      console.log(`   + Credential pools: ${poolCount} providers with multi-key`);
    }
    if (this.memoryManager) {
      console.log(`   + Memory providers: ${this.memoryManager.listProviders().join(', ')}`);
    }
    if (this.secretScanner) {
      console.log(`   + Secret scanner: API key exfiltration blocker`);
    }
    
    console.log(`✅ ${this.name} ready!`);
    console.log(`   Providers: ${this.providers.list().length}`);
    console.log(`   Tools: ${this.tools.list().length}`);
    console.log(`   Skills: ${this.skills.list().length}`);
    console.log(`   Memory: SQLite-backed`);
    console.log(`   Streaming: ${this.config.streamEnabled ? 'enabled' : 'disabled'}`);
    console.log(`   Planning: ${this.config.planningEnabled ? 'enabled' : 'disabled'}`);
    console.log(`   Cron: ${this.config.cronEnabled ? 'enabled' : 'disabled'}`);
    console.log(`   Subagents: ${this.config.subagentEnabled ? 'enabled' : 'disabled'}`);
    console.log(`   Learning: ${this.learningEnabled ? 'enabled' : 'disabled'}`);
    console.log(`   Guard: ${this.config.quietMode ? 'quiet' : 'interactive'}`);
  }

  setApprovalCallback(callback: ApprovalCallback): void {
    this.guard.setApprovalCallback(callback);
    this.guard.setQuietMode(false);
  }

  // ─── Tools ────────────────────────────────────────────────

  private registerTools(): void {
    // ─── Desktop ──────────────────────────────────────────
    this.registerTool({ name: 'desktop_open', description: 'Open an application', schema: { app: { type: 'string' } }, dangerous: false,
      handler: async (args: any) => { await this.desktop.openApp(args.app); return `Opened ${args.app}`; }
    });
    this.registerTool({ name: 'desktop_click', description: 'Click at coordinates', schema: { x: { type: 'number' }, y: { type: 'number' } }, dangerous: false,
      handler: async (args: any) => { await this.desktop.click(args.x, args.y); return `Clicked at ${args.x}, ${args.y}`; }
    });
    this.registerTool({ name: 'desktop_type', description: 'Type text', schema: { text: { type: 'string' } }, dangerous: false,
      handler: async (args: any) => { await this.desktop.type(args.text); return `Typed: ${args.text}`; }
    });
    this.registerTool({ name: 'desktop_screenshot', description: '📸 Take screenshot and return as base64 image for vision analysis',
      schema: { mode: { type: 'string', optional: true, description: 'Return mode: path (file path) or base64 (image data for vision)' } }, dangerous: false,
      handler: async (args: any) => {
        const fs = await import('fs');
        const path = await import('path');
        const platform = osType();
        
        try {
          // Get Desktop path for current platform
          const getDesktopPath = () => {
            if (platform === 'windows') {
              return path.join(homeDir(), 'Desktop');
            } else if (platform === 'darwin') {
              return path.join(homeDir(), 'Desktop');
            } else {
              // Linux - common DE desktops
              const xdg = process.env.XDG_DESKTOP_DIR;
              if (xdg && fs.existsSync(xdg)) return xdg;
              return path.join(homeDir(), 'Desktop');
            }
          };
          
          // Get screenshot file filter for current platform
          const getScreenshotFilter = (filename: string) => {
            if (platform === 'darwin') {
              return filename.startsWith('Screenshot ') && (filename.endsWith('.png') || filename.endsWith('.jpg'));
            } else if (platform === 'windows') {
              // Windows: often has Screen Shot, Capture, etc.
              const lower = filename.toLowerCase();
              return (lower.includes('screen') || lower.includes('capture') || lower.includes('screenshot')) &&
                     (filename.endsWith('.png') || filename.endsWith('.jpg') || filename.endsWith('.jpeg'));
            } else {
              // Linux - various formats
              const lower = filename.toLowerCase();
              return (lower.includes('screen') || lower.includes('capture')) &&
                     (filename.endsWith('.png') || filename.endsWith('.jpg'));
            }
          };
          
          const desktopPath = getDesktopPath();
          
          const getRecentScreenshot = () => {
            try {
              if (!fs.existsSync(desktopPath)) return null;
              const files = fs.readdirSync(desktopPath)
                .filter(getScreenshotFilter)
                .map(f => ({ name: f, path: path.join(desktopPath, f), mtime: fs.statSync(path.join(desktopPath, f)).mtime }))
                .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
              return files[0]?.path || null;
            } catch { return null; }
          };
          
          const beforeShot = getRecentScreenshot();
          
          // Take screenshot via ClawdCursor (macOS) or native
          const result = await this.desktop.screenshot();
          
          // Wait for file to be written
          await new Promise(r => setTimeout(r, 2000));
          
          // Find the new screenshot
          const afterShot = getRecentScreenshot();
          const screenshotPath = afterShot && afterShot !== beforeShot ? afterShot : afterShot;
          
          if (args.mode === 'path') {
            return screenshotPath || `Screenshot saved to ${desktopPath}`;
          }
          
          // Default: return base64 image data for vision
          if (screenshotPath && fs.existsSync(screenshotPath)) {
            const imageBuffer = fs.readFileSync(screenshotPath);
            const base64 = imageBuffer.toString('base64');
            const ext = path.extname(screenshotPath).toLowerCase().slice(1) || 'png';
            const mimeType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png';
            return `data:${mimeType};base64,${base64}`;
          }
          
          // Fallback: try to find any recent screenshot
          if (afterShot) {
            const imageBuffer = fs.readFileSync(afterShot);
            const base64 = imageBuffer.toString('base64');
            return `data:image/png;base64,${base64}`;
          }
          
          return { success: false, error: `Screenshot not found. Desktop: ${desktopPath}` };
        } catch (e: any) {
          return { success: false, error: e.message };
        }
      }
    });

    // ─── Screen Reading (DroidClaw-inspired vision) ────────
    this.registerTool({
      name: 'screen_read',
      description: '📸 Take screenshot and analyze it with vision AI to identify UI elements, text, buttons, and layout. ' +
        'Use this to "see" the desktop screen and understand what elements are visible.',
      schema: {
        query: { type: 'string', optional: true, description: 'What to look for: "buttons", "form fields", "errors", or general description' }
      },
      dangerous: false,
      handler: async (args: any) => {
        const fs = await import('fs');
        const path = await import('path');
        const platform = osType();

        // Take screenshot
        const getDesktopPath = () => {
          if (platform === 'windows') return path.join(homeDir(), 'Desktop');
          else if (platform === 'darwin') return path.join(homeDir(), 'Desktop');
          else return process.env.XDG_DESKTOP_DIR || path.join(homeDir(), 'Desktop');
        };

        const desktopPath = getDesktopPath();
        const getScreenshotFilter = (filename: string) => {
          if (platform === 'darwin') return filename.startsWith('Screenshot ') && (filename.endsWith('.png') || filename.endsWith('.jpg'));
          const lower = filename.toLowerCase();
          return (lower.includes('screen') || lower.includes('capture')) && (lower.endsWith('.png') || lower.endsWith('.jpg'));
        };

        const beforeShot = (() => {
          try {
            if (!fs.existsSync(desktopPath)) return null;
            return fs.readdirSync(desktopPath).filter(getScreenshotFilter)
              .map(f => ({ name: f, mtime: fs.statSync(path.join(desktopPath, f)).mtime }))
              .sort((a, b) => b.mtime.getTime() - a.mtime.getTime())[0]?.name || null;
          } catch { return null; }
        })();

        await this.desktop.screenshot();
        await new Promise(r => setTimeout(r, 2000));

        const afterShot = (() => {
          try {
            if (!fs.existsSync(desktopPath)) return null;
            return fs.readdirSync(desktopPath).filter(getScreenshotFilter)
              .map(f => ({ name: f, mtime: fs.statSync(path.join(desktopPath, f)).mtime }))
              .sort((a, b) => b.mtime.getTime() - a.mtime.getTime())[0]?.name || null;
          } catch { return null; }
        })();

        const newShot = afterShot && afterShot !== beforeShot ? afterShot : afterShot;
        if (!newShot) return { success: false, error: 'Could not capture screenshot' };

        const screenshotPath = path.join(desktopPath, newShot);
        if (!fs.existsSync(screenshotPath)) return { success: false, error: 'Screenshot file not found' };

        // Read image as base64
        const imageBuffer = fs.readFileSync(screenshotPath);
        const base64 = imageBuffer.toString('base64');
        const ext = path.extname(screenshotPath).toLowerCase().slice(1) || 'png';
        const mimeType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png';

        // Try to analyze with a vision-capable model via the provider
        try {
          const query = args.query || 'Describe what you see on screen, including all buttons, text fields, and interactive elements.';
          const visionResult = await this.providers.analyzeImage(`data:${mimeType};base64,${base64}`, query);
          return {
            success: true,
            screenshot: newShot,
            path: screenshotPath,
            analysis: visionResult
          };
        } catch (err: any) {
          // Fallback: return screenshot path for external vision analysis
          return {
            success: true,
            screenshot: newShot,
            path: screenshotPath,
            analysis: `Screenshot captured at ${screenshotPath}. Use Kimi k2.5 or GPT-4 Vision to analyze this image for: ${args.query || 'UI elements and layout'}`,
            hint: 'To enable vision analysis, configure a vision-capable provider (Kimi k2.5, GPT-4o, or Claude 3.5 Sonnet)'
          };
        }
      }
    });

    // ─── Memory ────────────────────────────────────────────
    this.registerTool({ name: 'memory_remember', description: 'Remember information permanently', 
      schema: { content: { type: 'string' }, type: { type: 'string', optional: true }, tags: { type: 'string', optional: true } }, dangerous: false,
      handler: async (args: any) => {
        const tags = args.tags ? args.tags.split(',').map((t: string) => t.trim()) : [];
        const id = await this.memory.add(args.content, args.type || 'fact', tags);
        this.streams.memorySave(this.sessionId, id, args.content);
        return `Remembered [${id}]: ${args.content}`;
      }
    });
    this.registerTool({ name: 'memory_recall', description: 'Search persistent memories', 
      schema: { query: { type: 'string' }, limit: { type: 'number', optional: true } }, dangerous: false,
      handler: async (args: any) => {
        const results = await this.memory.recall(args.query, args.limit || 10);
        if (results.length === 0) return 'No memories found';
        return results.map(r => `[${r.type}] ${r.content}`).join('\n---\n');
      }
    });
    this.registerTool({ name: 'memory_list', description: 'List memories', 
      schema: { type: { type: 'string', optional: true }, limit: { type: 'number', optional: true } }, dangerous: false,
      handler: async (args: any) => {
        const entries = await this.memory.list(args.type as any, args.limit || 50);
        if (entries.length === 0) return 'No memories stored';
        return entries.map(e => `[${e.type}] ${e.content}`).join('\n---\n');
      }
    });
    this.registerTool({ name: 'memory_stats', description: 'Show memory statistics', schema: {}, dangerous: false,
      handler: async () => {
        const stats = this.memory.stats();
        const toolStats = await this.memory.getToolStats();
        const failing = await this.memory.getFailingTools();
        return { ...stats, toolStats, failingTools: failing, approvalStats: this.guard.stats() };
      }
    });

    // ─── Skills (Autonomous + Self-Improving) ──────────────────────
    this.registerTool({ name: 'skill_create', description: 'Create a new skill from description and steps',
      schema: { prompt: { type: 'string' }, steps: { type: 'string[]', description: 'Array of step descriptions' } }, dangerous: false,
      handler: async (args: any) => {
        const { getSkillCreator } = await import('../skills/skill-creator.js');
        const creator = getSkillCreator();
        const result = await creator.createSkillFromPrompt(args.prompt, args.steps || []);
        if (result) return { success: true, skill: result.name, triggers: result.triggers, description: result.description };
        return { success: false, error: 'Skill creation failed (may already exist)' };
      }
    });
    this.registerTool({ name: 'skill_list', description: 'List all auto-created skills with health',
      schema: {}, dangerous: false,
      handler: async () => {
        const { getSkillCreator } = await import('../skills/skill-creator.js');
        const { getSkillImprover } = await import('../skills/skill-improver.js');
        const creator = getSkillCreator();
        const improver = getSkillImprover();
        return creator.listAutoSkills().map((name: string) => ({ name, health: improver.getSkillHealth(name) }));
      }
    });
    this.registerTool({ name: 'skill_health', description: 'Get health stats for a skill',
      schema: { skillName: { type: 'string' } }, dangerous: false,
      handler: async (args: any) => {
        const { getSkillImprover } = await import('../skills/skill-improver.js');
        return getSkillImprover().getSkillHealth(args.skillName);
      }
    });
    this.registerTool({ name: 'skill_improve', description: 'Trigger improvement for a skill',
      schema: { skillName: { type: 'string' } }, dangerous: false,
      handler: async (args: any) => {
        const { getSkillImprover } = await import('../skills/skill-improver.js');
        const result = await getSkillImprover().improveSkillManual(args.skillName);
        if (result) return { success: true, changes: result.changes, reason: result.reason };
        return { success: false, error: 'Improvement failed' };
      }
    });
    this.registerTool({ name: 'skill_patterns', description: 'Get patterns ready for skill creation',
      schema: {}, dangerous: false,
      handler: async () => {
        const { getSkillCreator } = await import('../skills/skill-creator.js');
        return getSkillCreator().getReadyPatterns();
      }
    });

    // ─── Dream / KAIROS ──────────────────────────────────────────
    this.registerTool({ name: 'dream_status', description: 'Check KAIROS dream system status',
      schema: {}, dangerous: false,
      handler: async () => {
        const { getKAIROS } = await import('../kairos/orchestrator.js');
        const k = getKAIROS();
        return { running: k.isActive(), state: k.getState(), config: k.getConfig(), dream: k.getCurrentDream() };
      }
    });
    this.registerTool({ name: 'dream_trigger', description: 'Manually trigger KAIROS dream consolidation',
      schema: { save: { type: 'boolean', optional: true } }, dangerous: false,
      handler: async (args: any) => {
        const { getKAIROS } = await import('../kairos/orchestrator.js');
        const { getSubconsciousClient } = await import('../subconscious/client.js');
        const k = getKAIROS();
        (k as any).state.isAsleep = true;
        (k as any).state.dreamEnabled = true;
        await (k as any).tick();
        const dream = k.getCurrentDream();
        if (dream && args.save) {
          try { await getSubconsciousClient().saveDream({ sessionId: `dream_${Date.now()}`, startedAt: dream.startedAt, endedAt: dream.endedAt, topics: dream.topics, insights: dream.insights }); } catch {}
        }
        return { started: !!dream, insights: dream?.insights || [], topics: dream?.topics || [] };
      }
    });
    this.registerTool({ name: 'dream_results', description: 'Get recent dream/consolidation results',
      schema: { limit: { type: 'number', optional: true } }, dangerous: false,
      handler: async (args: any) => {
        const { getSubconsciousClient } = await import('../subconscious/client.js');
        try {
          const result = await getSubconsciousClient().getRecent(args.limit || 5);
          return result.memories.filter((m: any) => m.tags?.includes('dream'));
        } catch { return []; }
      }
    });
    this.registerTool({ name: 'kairos_start', description: 'Start KAIROS autonomous heartbeat',
      schema: { mode: { type: 'string', optional: true } }, dangerous: false,
      handler: async (args: any) => {
        const { startKAIROS } = await import('../kairos/orchestrator.js');
        const k = startKAIROS({ proactiveMode: (args.mode as any) || 'balanced' });
        return { started: true, mode: k.getConfig().proactiveMode };
      }
    });
    this.registerTool({ name: 'kairos_stop', description: 'Stop KAIROS autonomous heartbeat',
      schema: {}, dangerous: false,
      handler: async () => {
        const { stopKAIROS } = await import('../kairos/orchestrator.js');
        stopKAIROS();
        return { stopped: true };
      }
    });

    // ─── FTS Memory + Session Search ───────────────────────────────
    this.registerTool({ name: 'memory_fts_search', description: 'Full-text search memories via TF-IDF',
      schema: { query: { type: 'string' }, limit: { type: 'number', optional: true } }, dangerous: false,
      handler: async (args: any) => {
        const { getSubconsciousClient } = await import('../subconscious/client.js');
        try { const r = await getSubconsciousClient().recall(args.query, args.limit || 10); return { results: r.memories, count: r.count }; }
        catch (e: any) { return { error: e.message }; }
      }
    });
    this.registerTool({ name: 'sessions_search', description: 'TF-IDF search across session transcripts',
      schema: { query: { type: 'string' }, limit: { type: 'number', optional: true } }, dangerous: false,
      handler: async (args: any) => {
        try {
          const { getSessionFTS } = await import('../subconscious/fts-search.js');
          const fts = getSessionFTS();
          return fts.search(args.query, args.limit || 10);
        } catch (e: any) { return { error: e.message }; }
      }
    });

    // ─── Voice / TTS ────────────────────────────────────
    this.registerTool({ name: 'speak', description: '🎤 Convert text to speech using MiniMax TTS. When user asks to "say X", "read this aloud", "generate speech", or "speak this", ALWAYS call this tool first. IMPORTANT: After calling speak, you MUST include the [AUDIO:filepath] marker in your text response so Telegram can send it as a voice message. Format: the marker should appear as a SEPARATE LINE in your response, not inside JSON.',
      schema: { text: { type: 'string', description: 'Text to convert to speech' }, voice: { type: 'string', optional: true, description: 'Voice: narrator, casual, sad, chinese, japanese, korean' } }, dangerous: false,
      handler: async (args: any) => {
        const { text, voice } = args;
        if (!text) return { error: 'No text provided', success: false };
        try {
          const tts = getTTS();
          if (voice) tts.setVoice(voice);
          const outPath = `/tmp/tts_${Date.now()}.mp3`;
          const result = await tts.speak({ text, outputPath: outPath });
          if (!result.success) return { error: result.error, success: false };
          // Return as string with audio_marker as a SEPARATE LINE so PTY/Telegram bot can detect it
          const marker = `[AUDIO:${outPath}]`;
          return `SUCCESS
Chars: ${result.chars} | Voice: ${voice || 'narrator'}
${marker}`;
        } catch (err: any) {
          return { error: err.message, success: false };
        }
      }
    });

    // ─── Shell (GUARDED) ─────────────────────────────────
    this.registerTool({ name: 'shell', description: 'Execute shell command ⚠️', 
      schema: { command: { type: 'string' }, timeout: { type: 'number', optional: true } }, dangerous: true,
      handler: async (args: any) => {
        const start = Date.now();
        this.streams.toolStart(this.sessionId, 'shell', { command: args.command });
        
        const approved = await this.guard.checkApproval('shell', { command: args.command });
        if (!approved) {
          this.streams.toolEnd(this.sessionId, 'shell', false, undefined, 'Command denied by guard', Date.now() - start);
          this.streams.guardBlock(this.sessionId, 'shell', { command: args.command }, 'blocked', ['Denied by user/system']);
          return { error: 'Command denied by dangerous tool guard', risk: 'blocked' };
        }

        const risk = this.guard.analyzeRisk(args.command, 'shell', {});
        if (risk.level === 'critical') {
          this.streams.guardBlock(this.sessionId, 'shell', { command: args.command }, 'critical', risk.reasons);
          this.streams.toolEnd(this.sessionId, 'shell', false, undefined, `CRITICAL risk: ${risk.reasons.join(', ')}`, Date.now() - start);
          return { error: `CRITICAL risk command blocked: ${risk.reasons.join(', ')}`, risk: 'critical' };
        }

        const { exec } = await import('child_process');
        const timeout = args.timeout || 30000;
        
        return new Promise((resolve) => {
          exec(args.command, { timeout, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
            const duration = Date.now() - start;
            const success = !error;
            this.memory.logTool('shell', args.command, success, error?.message, duration).catch(() => {});
            
            if (risk.level === 'high') {
              this.streams.guardWarn(this.sessionId, 'shell', { command: args.command }, risk.level, risk.reasons);
            }
            
            if (error) {
              this.streams.toolEnd(this.sessionId, 'shell', false, undefined, error.message, duration);
              resolve({ error: error.message, stderr, duration, risk: risk.level });
            } else {
              this.streams.toolEnd(this.sessionId, 'shell', true, stdout.slice(0, 5000), undefined, duration);
              resolve({ stdout, stderr, duration, risk: risk.level });
            }
          });
        });
      }
    });

    // ─── File ──────────────────────────────────────────────
    this.registerTool({ name: 'file_read', description: 'Read a file', 
      schema: { path: { type: 'string' }, limit: { type: 'number', optional: true } }, dangerous: false,
      handler: async (args: any) => {
        const { readFile } = await import('fs/promises');
        try {
          const content = await readFile(args.path, 'utf-8');
          const limit = args.limit || 0;
          if (limit > 0 && content.length > limit) {
            return content.slice(0, limit) + `\n... [truncated, ${content.length} total]`;
          }
          return content;
        } catch (e: any) { return `Error: ${e.message}`; }
      }
    });
    this.registerTool({ name: 'file_write', description: 'Write to a file ⚠️', 
      schema: { path: { type: 'string' }, content: { type: 'string' } }, dangerous: true,
      handler: async (args: any) => {
        const start = Date.now();
        this.streams.toolStart(this.sessionId, 'file_write', args);
        
        const approved = await this.guard.checkApproval('file_write', args);
        if (!approved) {
          this.streams.toolEnd(this.sessionId, 'file_write', false, undefined, 'Write denied', Date.now() - start);
          return { error: 'Write denied by guard', risk: 'blocked' };
        }

        const { writeFile, mkdir } = await import('fs/promises');
        try {
          const dir = args.path.substring(0, args.path.lastIndexOf('/'));
          if (dir) {
            try {
              await mkdir(dir, { recursive: true });
            } catch (dirErr: any) {
              return { error: `Failed to create directory: ${dirErr.message}` };
            }
          }
          await writeFile(args.path, args.content);
          const duration = Date.now() - start;
          this.memory.logTool('file_write', args.path, true, undefined, duration).catch(() => {});
          this.streams.toolEnd(this.sessionId, 'file_write', true, `${args.path} (${args.content.length}B)`, undefined, duration);
          return { written: args.path, bytes: args.content.length, duration };
        } catch (e: any) {
          const duration = Date.now() - start;
          this.memory.logTool('file_write', args.path, false, e.message, duration).catch(() => {});
          this.streams.toolEnd(this.sessionId, 'file_write', false, undefined, e.message, duration);
          return { error: e.message };
        }
      }
    });

    // ─── Web ──────────────────────────────────────────────
    this.registerTool({ name: 'web_search', description: 'Search the web',
      schema: { query: { type: 'string' }, provider: { type: 'string', optional: true } }, dangerous: false,
      handler: async (args: any) => {
        const query = String(args.query || '').trim();
        if (!query) return { error: 'Missing required argument: query' };

        // Retry config: 3 retries with exponential backoff
        const retryDelays = [1000, 2000, 4000];
        let lastError = '';

        for (let attempt = 0; attempt <= retryDelays.length; attempt++) {
          if (attempt > 0) {
            const delay = retryDelays[attempt - 1];
            console.log(`[web_search] Retry ${attempt}/${retryDelays.length} after ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }

          try {
            // 15-second timeout per attempt
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 15000);

            const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
            const res = await fetch(url, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
              },
              signal: controller.signal
            });
            clearTimeout(timeout);

            if (res.status === 429) {
              lastError = 'Rate limited by search engine (429). Will retry with backoff.';
              console.warn(`[web_search] Rate limited (429)`);
              continue; // retry
            }
            if (!res.ok) {
              lastError = `Search HTTP ${res.status}`;
              if (res.status >= 500) {
                console.warn(`[web_search] Server error ${res.status}, will retry`);
                continue;
              }
              return { error: lastError };
            }

            const html = await res.text();
            const results: Array<{ title: string; url: string; snippet?: string }> = [];
            const blocks = html.split('<div class="result results_links');
            for (const block of blocks.slice(1)) {
              const titleMatch = block.match(/class="result__a"[^>]*>([\s\S]*?)<\/a>/i);
              const hrefMatch = block.match(/class="result__a"[^>]*href="([^"]+)"/i);
              const snippetMatch = block.match(/class="result__snippet">([\s\S]*?)<\/a>|class="result__snippet">([\s\S]*?)<\/div>/i);
              const clean = (s: string) => s
                .replace(/<[^>]+>/g, ' ')
                .replace(/&amp;/g, '&')
                .replace(/&quot;/g, '"')
                .replace(/&#39;/g, "'")
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/\s+/g, ' ')
                .trim();
              if (titleMatch && hrefMatch) {
                results.push({
                  title: clean(titleMatch[1]),
                  url: hrefMatch[1],
                  snippet: snippetMatch ? clean(snippetMatch[1] || snippetMatch[2] || '') : ''
                });
              }
              if (results.length >= 5) break;
            }

            if (results.length === 0) {
              return { query, results: [], note: 'No results found. Try a different search query.' };
            }

            return {
              query,
              results,
              summary: results.map((r, i) => `${i + 1}. ${r.title} — ${r.url}${r.snippet ? `\n   ${r.snippet}` : ''}`).join('\n')
            };
          } catch (e: any) {
            lastError = e.message || 'Unknown fetch error';
            const isRetryable = e.name === 'AbortError' || e.message?.includes('ECONNRESET') ||
                               e.message?.includes('ETIMEDOUT') || e.message?.includes('ENOTFOUND') ||
                               e.message?.includes('Connection') || e.message?.includes('fetch');
            if (!isRetryable) {
              return { error: `Web search failed: ${lastError}\n💡 Check your internet connection and try again.` };
            }
            console.warn(`[web_search] Network error: ${lastError}, retrying...`);
          }
        }

        return { error: `Web search failed after retries: ${lastError}\n💡 Tip: DuckDuckGo may be blocked or rate-limited. Try again in 30 seconds, or use BrowserOS/PinchTab for web access.` };
      }
    });

    // ─── Web Fetch ────────────────────────────────────────
    this.registerTool({ name: 'web_fetch', description: 'Fetch content from a URL',
      schema: { url: { type: 'string' }, maxChars: { type: 'number', optional: true } }, dangerous: false,
      handler: async (args: any) => {
        const url = String(args.url || '').trim();
        if (!url) return { error: 'Missing required argument: url' };

        // Basic URL validation
        let parsedUrl: URL;
        try {
          parsedUrl = new URL(url);
          if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
            return { error: `Unsupported protocol: ${parsedUrl.protocol}. Only http and https are supported.` };
          }
        } catch {
          return { error: `Invalid URL: "${url}". Please provide a valid http or https URL.` };
        }

        const retryDelays = [1000, 2000, 4000];
        let lastError = '';
        const maxChars = args.maxChars || 50000;

        for (let attempt = 0; attempt <= retryDelays.length; attempt++) {
          if (attempt > 0) {
            const delay = retryDelays[attempt - 1];
            console.log(`[web_fetch] Retry ${attempt}/${retryDelays.length} after ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }

          try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 15000);

            const res = await fetch(url, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
              },
              signal: controller.signal,
              redirect: 'follow'
            });
            clearTimeout(timeout);

            if (res.status === 429) {
              lastError = 'Rate limited (429). Will retry with backoff.';
              console.warn(`[web_fetch] Rate limited (429)`);
              continue;
            }
            if (res.status >= 500) {
              lastError = `Server error ${res.status}`;
              console.warn(`[web_fetch] Server error ${res.status}, will retry`);
              continue;
            }
            if (res.status === 403 || res.status === 401) {
              return { error: `Fetch blocked by ${parsedUrl.hostname} (HTTP ${res.status}). The site may require authentication or blocks automated access.` };
            }
            if (!res.ok) {
              return { error: `Fetch HTTP ${res.status} for ${url}` };
            }

            const ct = res.headers.get('content-type') || '';
            let content = await res.text();

            // Truncate if needed
            if (content.length > maxChars) {
              content = content.slice(0, maxChars) + `\n\n[... truncated, ${content.length - maxChars} chars cut ...]`;
            }

            return {
              url,
              content,
              contentType: ct,
              truncated: content.length > maxChars || undefined,
              summary: `Fetched ${content.length} chars from ${url} (${ct.split(';')[0]})`
            };
          } catch (e: any) {
            lastError = e.message || 'Unknown fetch error';
            const isRetryable = e.name === 'AbortError' || e.message?.includes('ECONNRESET') ||
                               e.message?.includes('ETIMEDOUT') || e.message?.includes('ENOTFOUND') ||
                               e.message?.includes('Connection') || e.message?.includes('fetch');
            if (!isRetryable) {
              return { error: `Web fetch failed: ${lastError}\n💡 Check the URL is correct and the site is accessible.` };
            }
            console.warn(`[web_fetch] Network error: ${lastError}, retrying...`);
          }
        }

        return { error: `Web fetch failed after retries: ${lastError}\n💡 The site may be down or blocking requests. Try again later or use BrowserOS for browser-based access.` };
      }
    });

    // ─── Learning ──────────────────────────────────────────
    this.registerTool({ name: 'learn_from_feedback', description: 'Learn from feedback', 
      schema: { success: { type: 'boolean' }, feedback: { type: 'string', optional: true } }, dangerous: false,
      handler: async (args: any) => {
        if (this.learningEnabled) {
          this.learn(args.success, args.feedback);
          await this.memory.learnFromFeedback(args.success, args.feedback);
        }
        return 'Learned from feedback';
      }
    });

    // ─── Metrics ─────────────────────────────────────────
    this.registerTool({ name: 'get_metrics', description: 'Get agent metrics', schema: {}, dangerous: false,
      handler: async () => this.getMetrics()
    });
    this.registerTool({ name: 'get_cost', description: 'Get cost info', schema: {}, dangerous: false,
      handler: async () => ({ totalCost: this.totalCost, budget: this.costBudget, remaining: this.costBudget - this.totalCost })
    });

    // ─── Planning ─────────────────────────────────────────
    if (this.config.planningEnabled) {
      this.registerTool({ name: 'plan_create', description: 'Create autonomous plan', 
        schema: { goal: { type: 'string' }, context: { type: 'string', optional: true } }, dangerous: false,
        handler: async (args: any) => {
          let context = {};
          if (args.context) {
            try {
              context = JSON.parse(args.context);
            } catch {
              return { error: 'Invalid context JSON' };
            }
          }
          const plan = await this.planner.createPlan(args.goal, context, this.tools.list().map(t => t.name));
          this.streams.sessionStart(this.sessionId, args.goal);
          return this.planner.formatProgress(plan);
        }
      });
      this.registerTool({ name: 'plan_status', description: 'Show plan progress', 
        schema: { planId: { type: 'string', optional: true } }, dangerous: false,
        handler: async (args: any) => {
          const plan = args.planId ? this.planner.getPlan(args.planId) : this.planner.listActivePlans()[0];
          if (!plan) return 'No active plan';
          return this.planner.formatProgress(plan);
        }
      });
      this.registerTool({ name: 'plan_list', description: 'List active plans', schema: {}, dangerous: false,
        handler: async () => {
          const active = this.planner.listActivePlans();
          const history = this.planner.listHistory(5);
          return `Active: ${active.length}\nHistory: ${history.length}\n\n` +
            active.map(p => `• ${p.id}: ${p.goal} (${p.status})`).join('\n');
        }
      });
      this.registerTool({ name: 'plan_abort', description: 'Abort a plan', 
        schema: { planId: { type: 'string' }, reason: { type: 'string' } }, dangerous: false,
        handler: async (args: any) => {
          const plan = this.planner.abortPlan(args.planId, args.reason);
          return plan ? `Aborted: ${plan.goal}` : 'Plan not found';
        }
      });
    }

    // ─── Session Search ───────────────────────────────────
    this.registerTool({ name: 'session_search', description: 'Search past conversations', 
      schema: { query: { type: 'string' }, limit: { type: 'number', optional: true } }, dangerous: false,
      handler: async (args: any) => {
        const results = this.sessions.search(args.query, args.limit || 10);
        if (results.length === 0) return 'No past conversations found';
        return results.map(r => `[${r.role}] ${r.content}`).join('\n---\n');
      }
    });
    this.registerTool({ name: 'session_list', description: 'List recent conversations', 
      schema: { limit: { type: 'number', optional: true } }, dangerous: false,
      handler: async (args: any) => {
        const sessions = this.sessions.getRecentSessions(args.limit || 10);
        if (sessions.length === 0) return 'No past conversations';
        return sessions.map(s => 
          `[${new Date(s.timestamp).toLocaleString()}] ${s.topic}: "${s.lastMessage.slice(0, 80)}..." (${s.messageCount} msgs)`
        ).join('\n');
      }
    });

    // ─── Session Logs (DroidClaw-inspired) ────────────────
    this.registerTool({
      name: 'session_log',
      description: '📋 View recent session logs (DroidClaw-style crash-safe logs)',
      schema: {
        limit: { type: 'number', optional: true, description: 'Number of recent sessions to show (default: 5)' }
      },
      dangerous: false,
      handler: async (args: any) => {
        const { getSessionLogs } = await import('./session-logger.js');
        const logs = getSessionLogs('/tmp/duck-sessions');
        if (logs.length === 0) return 'No session logs found';
        const limit = args.limit || 5;
        const recent = logs.slice(-limit);
        const fs = await import('fs');
        return recent.map(logPath => {
          try {
            const data = JSON.parse(fs.readFileSync(logPath, 'utf8'));
            const status = data.completed ? '✅' : '⏳';
            return `${status} Session ${data.sessionId}\n` +
              `  Goal: ${data.goal || 'N/A'}\n` +
              `  Steps: ${data.totalSteps} (${data.successCount} ✅ / ${data.failCount} ❌)\n` +
              `  Time: ${new Date(data.startTime).toLocaleString()} → ${new Date(data.endTime).toLocaleString()}\n` +
              `  Model: ${data.model}\n` +
              `  File: ${logPath}`;
          } catch { return `Could not read: ${logPath}`; }
        }).join('\n\n');
      }
    });

    // ─── Cron ─────────────────────────────────────────────
    if (this.config.cronEnabled) {
      this.registerTool({ name: 'cron_create', description: 'Create scheduled task from natural language', 
        schema: { name: { type: 'string' }, schedule: { type: 'string' }, task: { type: 'string' }, taskType: { type: 'string', optional: true } }, dangerous: false,
        handler: async (args: any) => {
          const job = this.cron.createJob(args.name, args.schedule, args.task, (args.taskType || 'shell') as any);
          return `Scheduled: "${args.name}" — ${job.schedule}\nNext run: ${job.nextRun ? new Date(job.nextRun!).toLocaleString() : 'N/A'}`;
        }
      });
      this.registerTool({ name: 'cron_list', description: 'List scheduled tasks', schema: {}, dangerous: false,
        handler: async () => {
          const jobs = this.cron.listJobs();
          if (jobs.length === 0) return 'No scheduled tasks';
          return jobs.map(j => 
            `[${j.enabled ? 'ON' : 'OFF'}] ${j.name} — ${j.schedule}\n   Task: ${j.task}\n   Last: ${j.lastRun ? new Date(j.lastRun).toLocaleString() : 'never'} | Next: ${j.nextRun ? new Date(j.nextRun).toLocaleString() : 'N/A'}`
          ).join('\n\n');
        }
      });
      this.registerTool({ name: 'cron_enable', description: 'Enable/disable a task', 
        schema: { jobId: { type: 'string' }, enabled: { type: 'boolean' } }, dangerous: false,
        handler: async (args: any) => {
          this.cron.setEnabled(args.jobId, args.enabled);
          return `${args.enabled ? 'Enabled' : 'Disabled'} job ${args.jobId}`;
        }
      });
      this.registerTool({ name: 'cron_delete', description: 'Delete a task', 
        schema: { jobId: { type: 'string' } }, dangerous: false,
        handler: async (args: any) => {
          this.cron.deleteJob(args.jobId);
          return `Deleted job ${args.jobId}`;
        }
      });
      this.registerTool({ name: 'cron_stats', description: 'Show cron statistics', schema: {}, dangerous: false,
        handler: async () => this.cron.stats()
      });
    }

    // ─── Subagents ────────────────────────────────────────
    if (this.config.subagentEnabled) {
      this.registerTool({ name: 'agent_spawn', description: 'Spawn a subagent', 
        schema: { task: { type: 'string' }, role: { type: 'string', optional: true }, name: { type: 'string', optional: true } }, dangerous: false,
        handler: async (args: any) => {
          const agent = this.subagents.spawn(args.task, { role: (args.role || 'general') as any, name: args.name });
          return `Spawned ${agent.role} subagent ${agent.id}: ${agent.name}\nTask: ${agent.task}`;
        }
      });
      this.registerTool({ name: 'agent_spawn_team', description: 'Spawn multiple subagents in parallel', 
        schema: { tasks: { type: 'string' /* JSON array */ } }, dangerous: false,

        handler: async (args: any) => {
          const tasks = JSON.parse(args.tasks);
          const agents = this.subagents.spawnTeam(tasks);
          return {
            agentIds: agents.map(a => a.id),
            count: agents.length,
            summary: 'Spawned ' + agents.length + ' subagents:\n' + agents.map(a => '• ' + a.id + ' [' + a.role + ']: ' + a.name).join('\n')
          };
        }
      });

      // think_parallel: spawn N agents to think about the same prompt from different angles
      this.registerTool({
        name: 'think_parallel',
        description: 'Think about something using MULTIPLE parallel agents, each with a different perspective. Use for complex decisions, research, architecture, debugging. Agents spawn in parallel, you wait for all results.',
        schema: {
          prompt: { type: 'string', description: 'The question or task' },
          perspectives: { type: 'number', optional: true, description: 'Number of perspectives (default 3, max 5)' }
        },
        dangerous: false,
        handler: async (args: any) => {
          const n = Math.min(args.perspectives || 3, 5);
          const prompt = args.prompt;
          const roles = ['researcher', 'critic', 'creator', 'analyst', 'strategist'].slice(0, n);
          const tasks = roles.map((role, i) => ({
            task: prompt + '\n\n[Angle ' + (i+1) + '/' + n + ' as ' + role + '. Be specific.]',
            role: role as any,
            name: 'angle_' + role
          }));
          this.streams.thinking(this.sessionId, 'Spawning ' + n + ' parallel thinking agents...');
          
          // Spawn team with error handling
          let agents;
          try {
            agents = this.subagents.spawnTeam(tasks);
          } catch (err: any) {
            return { error: `Failed to spawn agents: ${err.message}` };
          }
          
          const agentIds = agents.map(a => a.id);
          
          // Wait for all agents with error isolation (Promise.allSettled)
          const settled = await Promise.allSettled(agentIds.map(id => this.subagents.waitFor(id, 300000)));
          
          // Clean up completed agents to prevent memory leak
          for (const id of agentIds) {
            this.subagents.removeAgent(id);
          }
          
          const results = settled.map((result, i) => {
            if (result.status === 'fulfilled') {
              return result.value;
            } else {
              return { error: result.reason?.message || 'Agent failed', status: 'failed' };
            }
          });
          
          return {
            prompt: prompt,
            perspectives: roles.map((role, i) => ({ role: role, result: results[i] })),
            synthesis: 'Synthesized ' + n + ' perspectives on: ' + prompt
          };
        }
      });


      this.registerTool({ name: 'agent_list', description: 'List active subagents', schema: {}, dangerous: false,
        handler: async () => {
          const active = this.subagents.listActive();
          const stats = this.subagents.stats();
          if (active.length === 0) return `No active subagents\nStats: ${stats.total} total, ${stats.completed} completed, ${stats.failed} failed`;
          return active.map(a => 
            `[${a.status.toUpperCase()}] ${a.id} [${a.role}]: ${a.progress}% — ${a.task.slice(0, 60)}...`
          ).join('\n');
        }
      });
      this.registerTool({ name: 'agent_status', description: 'Get subagent status', 
        schema: { agentId: { type: 'string' } }, dangerous: false,
        handler: async (args: any) => {
          const agent = this.subagents.get(args.agentId);
          if (!agent) return `Subagent not found: ${args.agentId}`;
          return `[${agent.status.toUpperCase()}] ${agent.name} [${agent.role}]\nTask: ${agent.task}\nProgress: ${agent.progress}%\n` +
            (agent.result ? `\nResult:\n${agent.result.slice(0, 500)}` : '') +
            (agent.error ? `\nError: ${agent.error}` : '');
        }
      });
      this.registerTool({ name: 'agent_cancel', description: 'Cancel a subagent', 
        schema: { agentId: { type: 'string' } }, dangerous: false,
        handler: async (args: any) => {
          const ok = this.subagents.cancel(args.agentId);
          return ok ? `Cancelled ${args.agentId}` : `Failed to cancel ${args.agentId} (not running?)`;
        }
      });
      this.registerTool({ name: 'agent_wait', description: 'Wait for subagent to complete', 
        schema: { agentId: { type: 'string' }, timeout: { type: 'number', optional: true } }, dangerous: false,
        handler: async (args: any) => {
          try {
            const agent = await this.subagents.waitFor(args.agentId, args.timeout || 300000);
            const result = `[${agent.status.toUpperCase()}] ${agent.id}\n` +
              (agent.result ? `Result:\n${agent.result.slice(0, 500)}` : '') +
              (agent.error ? `Error: ${agent.error}` : '');
            // Clean up agent to prevent memory leak
            this.subagents.removeAgent(args.agentId);
            return result;
          } catch (e: any) {
            return `Wait failed: ${e.message}`;
          }
        }
      });
    }

    // ─── Guard ────────────────────────────────────────────
    this.registerTool({ name: 'guard_check', description: 'Check risk level', 
      schema: { tool: { type: 'string' }, args: { type: 'string' } }, dangerous: false,
      handler: async (args: any) => {
        const parsedArgs = JSON.parse(args.args || '{}');
        const risk = this.guard.analyzeRisk(args.args, args.tool, parsedArgs);
        return this.guard.formatRisk(risk);
      }
    });
    this.registerTool({ name: 'guard_log', description: 'Show approval log', 
      schema: { limit: { type: 'number', optional: true } }, dangerous: false,
      handler: async (args: any) => {
        const log = this.guard.getLog(args.limit || 20);
        if (log.length === 0) return 'No approval decisions yet';
        return log.map(l => 
          `${l.decision === 'approved' ? '✅' : l.decision === 'denied' ? '❌' : l.decision === 'always' ? '🔓' : '🔒'} ` +
          `${l.toolName} [${l.risk.level}] - ${l.decision} @ ${new Date(l.timestamp).toLocaleTimeString()}`
        ).join('\n');
      }
    });
    this.registerTool({ name: 'guard_stats', description: 'Show guard statistics', schema: {}, dangerous: false,
      handler: async () => this.guard.stats()
    });

    // ─── Learning ──────────────────────────────────────────
    this.registerTool({ name: 'learning_stats', description: 'Show learning statistics', schema: {}, dangerous: false,
      handler: async () => {
        const ls = this.learning.stats();
        const cs = this.cron.stats();
        const ss = this.sessions.stats();
        return { learning: ls, cron: cs, sessions: ss };
      }
    });
    this.registerTool({ name: 'learning_context', description: 'Get context for current session', schema: {}, dangerous: false,
      handler: async () => {
        const prompt = this.learning.buildContextPrompt(this.sessionId);
        return prompt || 'No learning context yet';
      }
    });
    this.registerTool({ name: 'user_model', description: 'Get/update user model', 
      schema: { updates: { type: 'string', optional: true } }, dangerous: false,
      handler: async (args: any) => {
        if (args.updates) {
          const updates = JSON.parse(args.updates);
          this.learning.updateUserModel(updates);
          return `Updated user model: ${JSON.stringify(updates)}`;
        }
        return JSON.stringify(this.learning.getUserModel(), null, 2);
      }
    });

    // ─── Skill Runner Tools ─────────────────────────────────
    this.registerTool({ name: 'skill_git_workflow', description: 'Run git workflow skill',
      schema: { action: { type: 'string', optional: true }, repo: { type: 'string', optional: true } }, dangerous: false,
      handler: async (args: any) => {
        const input = JSON.stringify({ action: args.action, repo: args.repo });
        return await this.skills.execute('git-workflow', input);
      }
    });
    this.registerTool({ name: 'skill_code_review', description: 'Run code review skill',
      schema: { code: { type: 'string' }, language: { type: 'string', optional: true } }, dangerous: false,
      handler: async (args: any) => {
        const input = JSON.stringify({ code: args.code, language: args.language });
        return await this.skills.execute('code-review', input);
      }
    });
    this.registerTool({ name: 'skill_security_audit', description: 'Run security audit skill',
      schema: { target: { type: 'string', optional: true }, level: { type: 'string', optional: true } }, dangerous: false,
      handler: async (args: any) => {
        const input = JSON.stringify({ target: args.target, level: args.level });
        return await this.skills.execute('security-audit', input);
      }
    });
    this.registerTool({ name: 'skill_claude_code_mastery', description: 'Claude Code mastery skill',
      schema: { topic: { type: 'string', optional: true }, level: { type: 'string', optional: true } }, dangerous: false,
      handler: async (args: any) => {
        const input = JSON.stringify({ topic: args.topic, level: args.level });
        return await this.skills.execute('claude-code-mastery', input);
      }
    });
    this.registerTool({ name: 'skill_clawd_cursor', description: 'Clawd Cursor desktop control',
      schema: { task: { type: 'string' } }, dangerous: false,
      handler: async (args: any) => {
        const input = JSON.stringify({ task: args.task });
        return await this.skills.execute('clawd-cursor', input);
      }
    });
    this.registerTool({ name: 'skill_computer_use', description: 'Computer use skill',
      schema: { task: { type: 'string' }, mode: { type: 'string', optional: true } }, dangerous: false,
      handler: async (args: any) => {
        const input = JSON.stringify({ task: args.task, mode: args.mode });
        return await this.skills.execute('computer-use', input);
      }
    });
    this.registerTool({ name: 'skill_context_memory', description: 'Context memory skill',
      schema: { action: { type: 'string' }, query: { type: 'string', optional: true } }, dangerous: false,
      handler: async (args: any) => {
        const input = JSON.stringify({ action: args.action, query: args.query });
        return await this.skills.execute('context-memory', input);
      }
    });
    this.registerTool({ name: 'skill_desktop_control', description: 'Desktop control skill',
      schema: { action: { type: 'string' }, target: { type: 'string', optional: true } }, dangerous: false,
      handler: async (args: any) => {
        const input = JSON.stringify({ action: args.action, target: args.target });
        return await this.skills.execute('desktop-control', input);
      }
    });
    this.registerTool({ name: 'skill_mcp_manager', description: 'MCP manager skill',
      schema: { action: { type: 'string', optional: true }, server: { type: 'string', optional: true } }, dangerous: false,
      handler: async (args: any) => {
        const input = JSON.stringify({ action: args.action, server: args.server });
        return await this.skills.execute('mcp-manager', input);
      }
    });

    // ─── Dynamic Skill Management Tools (Agent-Friendly) ─────────────────────
    this.registerTool({ name: 'skill_list', description: '📋 List all available skills (built-in + file-based)', schema: {}, dangerous: false,
      handler: async () => {
        const skills = this.skills.list();
        return `Available skills (${skills.length}):\n${skills.map(s => `  - ${s}`).join('\n')}`;
      }
    });
    this.registerTool({ name: 'skill_get', description: '📄 Get a skill\'s full content by name', 
      schema: { name: { type: 'string' } }, dangerous: false,
      handler: async (args: any) => {
        const skill = this.skills.get(args.name);
        if (!skill) {
          const byTrigger = this.skills.getByNameOrTrigger(args.name);
          if (byTrigger) {
            return `Skill: ${byTrigger.name}\nDescription: ${byTrigger.description}\nTriggers: ${byTrigger.triggers.join(', ')}\n\n${byTrigger.content}`;
          }
          return `Skill not found: ${args.name}`;
        }
        return `Skill: ${skill.name}\nDescription: ${skill.description}\nTriggers: ${skill.triggers.join(', ')}\n\n${skill.content}`;
      }
    });
    this.registerTool({ name: 'skill_register', description: '🆕 Register a new skill dynamically (agent-created)', 
      schema: { 
        name: { type: 'string' }, 
        description: { type: 'string' }, 
        triggers: { type: 'string' },
        content: { type: 'string' }
      }, dangerous: false,
      handler: async (args: any) => {
        const triggers = args.triggers ? args.triggers.split(',').map((t: string) => t.trim()) : [];
        const skill = {
          name: args.name,
          description: args.description || args.name,
          triggers,
          content: args.content
        };
        this.skills.registerSkill(skill);
        return `Skill registered: ${args.name} with ${triggers.length} trigger(s)`;
      }
    });
    this.registerTool({ name: 'skill_reload', description: '🔄 Reload skills from disk (for newly added file-based skills)', schema: {}, dangerous: false,
      handler: async () => {
        await this.skills.reload();
        return `Skills reloaded: ${this.skills.list().length} total`;
      }
    });

    // ─── Duck CLI Command Tools ─────────────────────────────────
    this.registerTool({ name: 'duck_run', description: '💻 Run a task with Duck CLI (auto-routes through smart provider chain)',
      schema: { prompt: { type: 'string' }, interactive: { type: 'boolean', optional: true } }, dangerous: false,
      handler: async (args: any) => {
        const { exec } = await import('child_process');
        const interactive = args.interactive ? '-i' : '';
        return new Promise((resolve) => {
          exec(`~/.local/bin/duck run ${interactive} "${args.prompt}"`, { timeout: 120000 }, (e, stdout, stderr) => {
            resolve(e ? `Error: ${e.message}` : stdout);
          });
        });
      }
    });
    this.registerTool({ name: 'duck_council', description: '🏛️ Ask the AI Council (~35 specialized councilors)',
      schema: { question: { type: 'string' }, mode: { type: 'string', optional: true } }, dangerous: false,
      handler: async (args: any) => {
        const { exec } = await import('child_process');
        const mode = args.mode ? `--mode ${args.mode}` : '';
        return new Promise((resolve) => {
          exec(`~/.local/bin/duck council "${args.question}" ${mode}`, { timeout: 180000 }, (e, stdout, stderr) => {
            resolve(e ? `Error: ${e.message}` : stdout);
          });
        });
      }
    });
    this.registerTool({ name: 'duck_kairos', description: '⏰ KAIROS proactive AI control',
      schema: { mode: { type: 'string', optional: true } }, dangerous: false,
      handler: async (args: any) => {
        const { exec } = await import('child_process');
        return new Promise((resolve) => {
          exec(`~/.local/bin/duck kairos ${args.mode || 'status'}`, (e, stdout, stderr) => {
            resolve(e ? `Error: ${e.message}` : stdout);
          });
        });
      }
    });
    this.registerTool({ name: 'duck_status', description: '📊 Show Duck CLI status', schema: {}, dangerous: false,
      handler: async () => {
        const { exec } = await import('child_process');
        return new Promise((resolve) => {
          exec('~/.local/bin/duck status', (e, stdout, stderr) => resolve(e ? `Error: ${e.message}` : stdout));
        });
      }
    });
    this.registerTool({ name: 'duck_skills', description: '🛒 Skills marketplace',
      schema: { action: { type: 'string' }, name: { type: 'string', optional: true } }, dangerous: false,
      handler: async (args: any) => {
        const { exec } = await import('child_process');
        return new Promise((resolve) => {
          exec(`~/.local/bin/duck skills ${args.action} ${args.name || ''}`, (e, stdout, stderr) => {
            resolve(e ? `Error: ${e.message}` : stdout);
          });
        });
      }
    });
    this.registerTool({ name: 'duck_security', description: '🛡️ Security operations (audit, defcon <level>, status)',
      schema: { action: { type: 'string', description: 'Action: audit|defcon|status' }, level: { type: 'string', optional: true, description: 'For defcon: 1-5' } }, dangerous: false,
      handler: async (args: any) => {
        const { exec } = await import('child_process');
        return new Promise((resolve) => {
          const cmd = args.action === 'defcon' && args.level ? `defcon ${args.level}` : args.action;
          exec(`~/.local/bin/duck security ${cmd}`, (e, stdout, stderr) => {
            resolve(e ? `Error: ${e.message}` : stdout);
          });
        });
      }
    });
    this.registerTool({ name: 'duck_cron', description: '⏱️ Cron automation (list|enable|disable|run)',
      schema: { action: { type: 'string' }, jobId: { type: 'string', optional: true }, task: { type: 'string', optional: true } }, dangerous: false,
      handler: async (args: any) => {
        const { exec } = await import('child_process');
        return new Promise((resolve) => {
          exec(`~/.local/bin/duck cron ${args.action} ${args.jobId || ''} ${args.task || ''}`, (e, stdout, stderr) => {
            resolve(e ? `Error: ${e.message}` : stdout);
          });
        });
      }
    });
    this.registerTool({ name: 'duck_team', description: '👥 Multi-agent teams (create|spawn|status <team-id>|list)',
      schema: { action: { type: 'string' }, teamId: { type: 'string', optional: true, description: 'Team ID (required for status command)' } }, dangerous: false,
      handler: async (args: any) => {
        const { exec } = await import('child_process');
        return new Promise((resolve) => {
          const teamId = args.teamId || args.action === 'list' || args.action === 'create' ? '' : 'YOUR_TEAM_ID';
          exec(`~/.local/bin/duck team ${args.action} ${teamId}`, (e, stdout, stderr) => {
            resolve(e ? `Error: ${e.message}` : stdout);
          });
        });
      }
    });
    this.registerTool({ name: 'duck_mesh', description: '🌐 Agent Mesh networking (register|list|send|broadcast)',
      schema: { action: { type: 'string' }, target: { type: 'string', optional: true }, message: { type: 'string', optional: true } }, dangerous: false,
      handler: async (args: any) => {
        const { exec } = await import('child_process');
        return new Promise((resolve) => {
          exec(`~/.local/bin/duck mesh ${args.action} ${args.target || ''} ${args.message || ''}`, (e, stdout, stderr) => {
            resolve(e ? `Error: ${e.message}` : stdout);
          });
        });
      }
    });
    this.registerTool({ name: 'duck_update', description: '🔄 Update Duck CLI (check|install|backup|restore)',
      schema: { action: { type: 'string', optional: true } }, dangerous: false,
      handler: async (args: any) => {
        const { exec } = await import('child_process');
        return new Promise((resolve) => {
          exec(`~/.local/bin/duck update ${args.action || ''}`, (e, stdout, stderr) => {
            resolve(e ? `Error: ${e.message}` : stdout);
          });
        });
      }
    });
    this.registerTool({ name: 'duck_doctor', description: '🩺 Run system diagnostics', 
      schema: {}, dangerous: false,
      handler: async () => {
        const { exec } = await import('child_process');
        return new Promise((resolve) => {
          // Find duck-cli source: env var, workspace, or current dir
          const sourceCandidates = [
            process.env.DUCK_SOURCE_DIR,
            join(process.env.HOME || '', '.openclaw', 'workspace', 'duck-cli-src'),
            process.cwd()
          ].filter(Boolean);
          const duckBinary = process.env.DUCK_BINARY || 'duck';
          let resolved = false;
          const tryNext = (i: number) => {
            if (i >= sourceCandidates.length) {
              if (!resolved) { resolve(`Error: duck source not found. Set DUCK_SOURCE_DIR or ensure duck-cli is in cwd.`); resolved = true; }
              return;
            }
            const duckSourceDir = sourceCandidates[i];
            exec(`cd ${duckSourceDir} && ${duckBinary} doctor`, (e, stdout, stderr) => {
              if (!resolved && e && e.message.includes('No such file')) {
                tryNext(i + 1); // try next candidate
              } else if (!resolved) {
                resolve(e ? `Error: ${e.message}` : stdout); resolved = true;
              }
            });
          };
          tryNext(0);
        });
      }
    });
    this.registerTool({ name: 'duck_agent', description: '🤖 Manage agents and sub-agents',
      schema: { action: { type: 'string' }, agentId: { type: 'string', optional: true }, params: { type: 'string', optional: true } }, dangerous: false,
      handler: async (args: any) => {
        const { exec } = await import('child_process');
        return new Promise((resolve) => {
          exec(`~/.local/bin/duck agent ${args.action} ${args.agentId || ''} ${args.params || ''}`, (e, stdout, stderr) => {
            resolve(e ? `Error: ${e.message}` : stdout);
          });
        });
      }
    });

    // ─── Provider Tools ─────────────────────────────────────────────
    this.registerTool({ name: 'provider_list', description: '🔌 List available AI providers and their status',
      schema: {}, dangerous: false,
      handler: async () => {
        const providers = this.providers.list();
        const status = providers.map(p => {
          const isLocal = p === 'lmstudio';
          const icon = isLocal ? '🖥️' : '☁️';
          const cost = isLocal ? 'FREE (local)' : 'API cost';
          return `${icon} ${p}: ${cost}`;
        }).join('\n');
        
        return {
          available: providers,
          summary: `${providers.length} providers configured`,
          details: `Available providers:\n${status}\n\nTo use a specific provider, set DUCK_PROVIDER env var or use 'duck run -p provider_name'`,
          lmstudio_url: process.env.LMSTUDIO_URL || 'http://localhost:1234 (auto-detected)'
        };
      }
    });

    this.registerTool({ name: 'provider_set', description: '⚙️ Set active AI provider',
      schema: { name: { type: 'string', description: 'Provider name: lmstudio, minimax, kimi, openrouter, openai, anthropic' } }, dangerous: false,
      handler: async (args: any) => {
        const success = this.providers.setActive(args.name);
        if (success) {
          return { success: true, provider: args.name, message: `Active provider set to: ${args.name}` };
        }
        return { success: false, error: `Provider '${args.name}' not available. Use provider_list to see available providers.` };
      }
    });

    // ─── Stress Test Tool (Registry Check + Lightweight Execution) ─────────────
    this.registerTool({ name: 'duck_stress_test', description: '🧪 Test MCP server stability - checks tool registry',
      schema: { mode: { type: 'string', optional: true, description: 'Mode: registry (fast) or exec (full test, slower)' } }, dangerous: false,
      handler: async (args: any) => {
        const mode = args.mode || 'registry';
        const results: any = { timestamp: new Date().toISOString(), mode, tools: [], summary: { pass: 0, fail: 0, total: 0 } };
        
        // Get all registered tools from the tool registry
        const registeredTools = this.tools.list();
        const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
        
        // Group tools by prefix
        const groups: any = {};
        for (const tool of registeredTools) {
          const prefix = tool.name.split('_')[0];
          const groupName = prefix === 'duck' ? 'Duck CLI' : 
                           ['memory', 'session', 'agent', 'plan', 'cron', 'guard', 'skill', 'desktop', 'file', 'web', 'shell', 'learn'].includes(prefix) ? 
                           prefix.charAt(0).toUpperCase() + prefix.slice(1) : 'Other';
          if (!groups[groupName]) groups[groupName] = { name: groupName, tools: [], pass: 0, fail: 0 };
          
          if (mode === 'registry') {
            // Fast check: verify tool exists (name is present)
            await sleep(10); // Small delay between checks
            const valid = tool.name && tool.name.length > 0;
            groups[groupName].tools.push({ name: tool.name, status: valid ? 'REGISTERED' : 'BROKEN' });
            if (valid) { groups[groupName].pass++; results.summary.pass++; }
            else { groups[groupName].fail++; results.summary.fail++; }
            results.summary.total++;
          }
        }
        
        if (mode === 'exec') {
          // Execute only lightweight status tools - SEQUENTIALLY with delays
          const safeTools = ['duck_status', 'duck_doctor', 'memory_stats', 'agent_list', 'cron_list', 'guard_stats', 'plan_list'];
          
          for (const toolName of safeTools) {
            const tool = registeredTools.find((t: any) => t.name === toolName);
            if (!tool) continue;
            
            const prefix = toolName.split('_')[0];
            const groupName = prefix === 'duck' ? 'Duck CLI' : prefix.charAt(0).toUpperCase() + prefix.slice(1);
            if (!groups[groupName]) groups[groupName] = { name: groupName, tools: [], pass: 0, fail: 0 };
            
            try {
              // Execute and wait for completion before next tool
              const r: any = await this.executeTool(toolName, {});
              const success = r && r.success === true;
              groups[groupName].tools.push({ name: toolName, status: success ? 'PASS' : 'FAIL', error: success ? null : (r?.error || 'Failed') });
              if (success) { groups[groupName].pass++; results.summary.pass++; }
              else { groups[groupName].fail++; results.summary.fail++; }
              results.summary.total++;
            } catch (e: any) {
              groups[groupName].tools.push({ name: toolName, status: 'ERROR', error: e.message });
              groups[groupName].fail++; results.summary.fail++; results.summary.total++;
            }
            
            // Wait for previous tool to fully clean up before next
            await sleep(1000);
          }
        }
        
        results.tools = Object.values(groups);
        const allPass = results.summary.fail === 0;
        results.summary.status = allPass ? '✅ ALL PASSING' : '⚠️ SOME FAILING';
        results.summary.passRate = results.summary.total > 0 
          ? Math.round((results.summary.pass / results.summary.total) * 100) + '%' 
          : '0%';
        results.note = mode === 'registry' ? 'Fast registry check - run with mode:"exec" for full execution test' : 'Execution test of safe tools only';
        
        return JSON.stringify(results, null, 2);
      }
    });

    // ─── Speculative Execution ──────────────────────────────
    this.registerTool({
      name: 'speculate',
      description: '🔮 Run multiple approaches in parallel, use the best result',
      schema: {
        task: { type: 'string', description: 'The task to solve' },
        branches: { type: 'number', optional: true, description: 'Number of approaches (default 3, max 6)' },
        mode: { type: 'string', optional: true, description: '"code", "analysis", or "auto" (default)' }
      },
      dangerous: false,
      handler: async (args: any) => {
        const branches = Math.min(args.branches || 3, 6);
        const mode = args.mode || 'auto';
        const scorer = mode === 'code' ? codeQualityScorer : mode === 'analysis' ? analysisQualityScorer : undefined;
        
        const results = await this.speculative.speculateAll(args.task, { branches, scorer });
        const best = results[0];
        
        return {
          best: {
            approach: best.approach,
            result: best.result,
            score: best.score,
            latencyMs: best.latencyMs
          },
          all_results: results.map(r => ({
            approach: r.approach,
            score: r.score,
            latencyMs: r.latencyMs,
            error: r.error
          })),
          comparison: `🏆 Winner: ${best.approach} (score: ${best.score}/100)

` +
            results.map(r => {
              const status = r.error ? '❌' : '✅';
              return `${status} ${r.approach}: score=${r.score}, ${r.latencyMs}ms`;
            }).join('\n')
        };
      }
    });

    // ─── Execution Tracing ──────────────────────────────────
    this.registerTool({
      name: 'trace_enable',
      description: '📊 Enable execution tracing for current session',
      schema: { sessionId: { type: 'string', optional: true } },
      dangerous: false,
      handler: async (args: any) => {
        const traceId = tracer.startTrace(args.sessionId || this.sessionId);
        return { enabled: true, traceId };
      }
    });
    this.registerTool({
      name: 'trace_disable',
      description: '📊 Disable tracing and get final trace',
      schema: {},
      dangerous: false,
      handler: async () => {
        const trace = tracer.endTrace();
        return trace || { message: 'No active trace' };
      }
    });
    this.registerTool({
      name: 'trace_view',
      description: '📊 View a trace by ID',
      schema: { traceId: { type: 'string' } },
      dangerous: false,
      handler: async (args: any) => {
        const trace = tracer.getTrace(args.traceId);
        return trace || { error: 'Trace not found' };
      }
    });
    this.registerTool({
      name: 'trace_list',
      description: '📊 List recent traces',
      schema: { limit: { type: 'number', optional: true } },
      dangerous: false,
      handler: async (args: any) => {
        const traces = tracer.getTraces(this.sessionId);
        return {
          count: traces.length,
          traces: traces.slice(0, args.limit || 10).map(t => ({
            id: t.id,
            durationMs: t.stats.totalMs,
            tokens: t.stats.totalTokens,
            createdAt: t.createdAt
          }))
        };
      }
    });

    // ─── Workflow Runner (DroidClaw-inspired) ──────────────
    this.registerTool({
      name: 'workflow_run',
      description: '📋 Execute a JSON workflow file with multi-step goals (DroidClaw-style). ' +
        'Workflows contain steps the agent figures out. Supports form data injection {var} syntax.',
      schema: {
        file: { type: 'string', description: 'Path to workflow JSON file' },
        step: { type: 'number', optional: true, description: 'Start from step N (0-indexed)' }
      },
      dangerous: false,
      handler: async (args: any) => {
        try {
          const runner = new WorkflowRunner(this);
          const result = await runner.runFromFile(args.file);
          return {
            name: result.name,
            success: result.success,
            completedSteps: result.steps.filter(s => s.success).length,
            totalSteps: result.steps.length,
            steps: result.steps.map(s => ({
              goal: s.goal,
              flow: s.flow,
              success: s.success,
              stepsUsed: s.stepsUsed,
              output: s.output?.slice(0, 200),
              error: s.error
            }))
          };
        } catch (err: any) {
          return { error: err.message };
        }
      }
    });
    this.registerTool({
      name: 'flow_run',
      description: '⚡ Execute a deterministic YAML flow file (no LLM) — DroidClaw Maestro-style. ' +
        'Supports: shell, type, open, click, wait, back, enter, clear, tab, done. ' +
        'YAML format: { appId: com.example } / name: My Flow / --- / - shell: echo hi / - type: hello / - wait: 2',
      schema: {
        file: { type: 'string', description: 'Path to YAML flow file' }
      },
      dangerous: true,
      handler: async (args: any) => {
        try {
          const runner = new WorkflowRunner(this);
          const result = await runner.runFlowFromFile(args.file);
          return result;
        } catch (err: any) {
          return { error: err.message };
        }
      }
    });

    // ─── ACPX-Style Flow Graph (TypeScript) ───────────────────
    this.registerTool({
      name: 'flow_run_ts',
      description: '⚡⚡ Execute an ACPX-style TypeScript flow graph (~/.duck/flows/run/<id>/). ' +
        'Supports: acp (model reasoning), action (shell/runtime), compute (local transforms), checkpoint (pause). ' +
        'Outcomes: ok | timed_out | failed | cancelled. ' +
        'Example flow def: { name: "build", nodes: { start: { kind: "acp", config: { prompt: "..." } } }, edges: [{ from: "start", condition: { type: "always", to: "..." } }] }',
      schema: {
        definition: { type: 'string', description: 'JSON flow definition (stringified)' },
        startNode: { type: 'string', optional: true, description: 'Node ID to start from' }
      },
      dangerous: false,
      handler: async (args: any) => {
        try {
          const def = typeof args.definition === 'string' ? JSON.parse(args.definition) : args.definition;
          FlowRunner.validate(def);
          const runner = new FlowRunner(def, 'memory', this.providers);
          const result = await runner.run(args.startNode);
          return {
            flowName: def.name,
            outcome: result.outcome,
            totalSteps: result.results.length,
            trace: runner.getTrace().getBundle(),
            steps: result.results.map(r => ({
              nodeId: r.nodeId,
              kind: r.kind,
              outcome: r.outcome,
              durationMs: r.durationMs,
              error: r.error
            }))
          };
        } catch (err: any) {
          return { error: err.message };
        }
      }
    });
    this.registerTool({
      name: 'flow_list',
      description: '📋 List all ACPX flow runs (~/.duck/flows/runs/)',
      schema: { limit: { type: 'number', optional: true } },
      dangerous: false,
      handler: async (args: any) => {
        const runs = FlowTrace.listRuns();
        if (runs.length === 0) return 'No flow runs found in ~/.duck/flows/runs/';
        const limit = args.limit || 10;
        return runs.slice(0, limit).map(r => {
          const icon = r.status === 'completed' ? '✅' : r.status === 'running' ? '⏳' : r.outcome === 'cancelled' ? '⚠️' : '❌';
          return `${icon} ${r.flowName} (${r.runId})\n  Status: ${r.status} | Outcome: ${r.outcome || 'running'} | Steps: ${r.completedSteps}/${r.totalSteps}\n  Created: ${new Date(r.createdAt).toLocaleString()}`;
        }).join('\n\n');
      }
    });
    this.registerTool({
      name: 'flow_replay',
      description: '🔁 Replay a flow run from its trace bundle',
      schema: { runId: { type: 'string' } },
      dangerous: false,
      handler: async (args: any) => {
        const { join } = await import('path');
        const runDir = join(process.env.HOME || '/tmp', '.duck', 'flows', 'runs', args.runId);
        try {
          const { bundle, events, snapshot } = FlowTrace.replay(runDir);
          return {
            bundle,
            eventCount: events.length,
            snapshot
          };
        } catch (err: any) {
          return { error: `Replay failed: ${err.message}` };
        }
      }
    });
    this.registerTool({
      name: 'flow_cancel',
      description: '⏹️ Cancel a running flow',
      schema: { flowName: { type: 'string' } },
      dangerous: false,
      handler: async (args: any) => {
        const latest = FlowTrace.latestRun(args.flowName);
        if (!latest) return { error: `No running flow found for: ${args.flowName}` };
        if (latest.status !== 'running') return { error: `Flow is not running (status: ${latest.status})` };
        return { cancelled: true, runId: latest.runId };
      }
    });

    // ─── Session Stream (ACPX-style NDJSON) ───────────────────
    this.registerTool({
      name: 'session_stream_list',
      description: '📋 List all NDJSON session streams (~/.duck/sessions/)',
      schema: { limit: { type: 'number', optional: true } },
      dangerous: false,
      handler: async (args: any) => {
        const sessions = SessionStream.listSessions();
        if (sessions.length === 0) return 'No sessions found in ~/.duck/sessions/';
        const limit = args.limit || 10;
        return sessions.slice(0, limit).map(s => {
          const icon = s.checkpoint.outcome === 'ok' ? '✅' : s.checkpoint.outcome === 'failed' ? '❌' : '⏳';
          return `${icon} Session ${s.recordId}\n  Last used: ${new Date(s.checkpoint.last_used_at).toLocaleString()}\n  Messages: ${s.checkpoint.last_seq} | Mode: ${s.checkpoint.current_mode_id}\n  Outcome: ${s.checkpoint.outcome || 'ongoing'}`;
        }).join('\n\n');
      }
    });
    this.registerTool({
      name: 'session_stream_info',
      description: 'ℹ️ Get info about a specific session stream',
      schema: { recordId: { type: 'string' } },
      dangerous: false,
      handler: async (args: any) => {
        const { join } = await import('path');
        const { existsSync, readFileSync } = await import('fs');
        const cpPath = join(process.env.HOME || '/tmp', '.duck', 'sessions', `${args.recordId}.json`);
        if (!existsSync(cpPath)) return { error: 'Session not found' };
        try {
          const cp = JSON.parse(readFileSync(cpPath, 'utf8'));
          return {
            recordId: cp.acpx_record_id,
            createdAt: cp.created_at,
            lastUsedAt: cp.last_used_at,
            lastSeq: cp.last_seq,
            segments: cp.event_log.segment_count,
            outcome: cp.outcome,
            messageCount: cp.messages?.length || 0,
            mode: cp.current_mode_id
          };
        } catch (err: any) {
          return { error: err.message };
        }
      }
    });
    this.registerTool({
      name: 'session_stream_replay',
      description: '🔁 Replay and repair a session stream (ACPX-style, ignores partial final line)',
      schema: { recordId: { type: 'string' } },
      dangerous: false,
      handler: async (args: any) => {
        const { join } = await import('path');
        const stream = new (require('./session-stream.js').SessionStream)(
          join(process.env.HOME || '/tmp', '.duck', 'sessions'),
          'default',
          args.recordId
        );
        const { messages, errors } = stream.replay();
        return { recordId: args.recordId, totalMessages: messages.length, errors, lastSeq: stream['lastSeq'] };
      }
    });

    // ─── Android Tools (DroidClaw-style ADB) ───────────────────
    this.registerTool({
      name: 'android_devices',
      description: '📱 List connected Android devices via ADB',
      schema: {},
      dangerous: false,
      handler: async () => {
        const android = this.androidTools;
        const devices = await android.refreshDevices();
        if (devices.length === 0) return 'No Android devices found. Ensure USB debugging is enabled and `adb devices` shows your device.';
        return devices.map(d => {
          const icon = d.state === 'device' ? '📱' : d.state === 'offline' ? '⚠️' : '❌';
          return `${icon} ${d.serial}\n  State: ${d.state}\n  Model: ${d.model || 'Unknown'}\n  Product: ${d.product || 'Unknown'}`;
        }).join('\n\n');
      }
    });
    this.registerTool({
      name: 'android_screenshot',
      description: '📸 Capture Android device screen and return path',
      schema: { filename: { type: 'string', optional: true } },
      dangerous: false,
      handler: async (args: any) => {
        try {
          const cap = await this.androidTools.captureScreen(args.filename);
          return { path: cap.path, timestamp: cap.timestamp };
        } catch (err: any) {
          return { error: `Screenshot failed: ${err.message}. Make sure a device is selected with android_devices.` };
        }
      }
    });
    this.registerTool({
      name: 'android_tap',
      description: '👆 Tap at coordinates on Android screen',
      schema: { x: { type: 'number' }, y: { type: 'number' } },
      dangerous: false,
      handler: async (args: any) => {
        const ok = await this.androidTools.tap(args.x, args.y);
        return ok ? `Tapped at (${args.x}, ${args.y})` : { error: 'Tap failed' };
      }
    });
    this.registerTool({
      name: 'android_type',
      description: '⌨️ Type text on Android device',
      schema: { text: { type: 'string' } },
      dangerous: false,
      handler: async (args: any) => {
        const ok = await this.androidTools.typeText(args.text);
        return ok ? `Typed: "${args.text}"` : { error: 'Type failed' };
      }
    });
    this.registerTool({
      name: 'android_shell',
      description: '💻 Execute ADB shell command on Android device',
      schema: { command: { type: 'string' }, timeout: { type: 'number', optional: true } },
      dangerous: true,
      handler: async (args: any) => {
        const result = await this.androidTools.shell(args.command, args.timeout || 30000);
        return result.exitCode === 0 ? result.stdout : { error: result.stderr || `Exit code: ${result.exitCode}`, stdout: result.stdout };
      }
    });
    this.registerTool({
      name: 'android_dump',
      description: '📋 Dump Android UI hierarchy (XML) and return elements',
      schema: { query: { type: 'string', optional: true, description: 'Text to search for in UI elements' } },
      dangerous: false,
      handler: async (args: any) => {
        const xml = await this.androidTools.dumpUiXml();
        const elements = this.androidTools.parseUiXml(xml);
        if (args.query) {
          const found = this.androidTools.findElement(elements, args.query);
          if (!found) return `Element "${args.query}" not found. ${elements.length} elements on screen.`;
          return `Found: ${JSON.stringify(found, null, 2)}`;
        }
        return { elementCount: elements.length, elements: elements.slice(0, 20) };
      }
    });
    this.registerTool({
      name: 'android_find_and_tap',
      description: '🔍 Find UI element by text/content-desc/resource-id and tap it (DroidClaw-style)',
      schema: { query: { type: 'string', description: 'Text, content description, or resource ID to find' } },
      dangerous: false,
      handler: async (args: any) => {
        const ok = await this.androidTools.findAndTap(args.query);
        return ok ? `Found and tapped: "${args.query}"` : { error: `Element "${args.query}" not found or not tappable` };
      }
    });
    this.registerTool({
      name: 'android_swipe',
      description: '👆 Swipe on Android screen',
      schema: { direction: { type: 'string', description: 'up | down | left | right' }, distance: { type: 'number', optional: true } },
      dangerous: false,
      handler: async (args: any) => {
        const ok = await this.androidTools.scroll(args.direction as any, args.distance || 500);
        return ok ? `Swiped ${args.direction}` : { error: 'Swipe failed' };
      }
    });
    this.registerTool({
      name: 'android_press',
      description: '🔘 Press Android key (enter | back | home | recent)',
      schema: { key: { type: 'string', description: 'enter | back | home | recent' } },
      dangerous: false,
      handler: async (args: any) => {
        switch (args.key) {
          case 'enter': return { result: await this.androidTools.pressEnter() };
          case 'back': return { result: await this.androidTools.pressBack() };
          case 'home': return { result: await this.androidTools.pressHome() };
          case 'recent': return { result: await this.androidTools.pressRecent() };
          default: return { error: `Unknown key: ${args.key}` };
        }
      }
    });
    this.registerTool({
      name: 'android_app',
      description: '🚀 Launch or kill Android app',
      schema: { package: { type: 'string', description: 'Package name (e.g. com.instagram.android)' }, action: { type: 'string', description: 'launch | kill | foreground' } },
      dangerous: false,
      handler: async (args: any) => {
        switch (args.action) {
          case 'launch': {
            const ok = await this.androidTools.launchApp(args.package);
            return ok ? `Launched: ${args.package}` : { error: 'Launch failed' };
          }
          case 'kill': {
            const ok = await this.androidTools.killApp(args.package);
            return ok ? `Killed: ${args.package}` : { error: 'Kill failed' };
          }
          case 'foreground': {
            const pkg = await this.androidTools.getForegroundApp();
            return { foreground: pkg };
          }
          default: return { error: `Unknown action: ${args.action}` };
        }
      }
    });
    this.registerTool({
      name: 'android_screen',
      description: '📖 Read all visible text on Android screen (DroidClaw-style screen OCR)',
      schema: {},
      dangerous: false,
      handler: async () => {
        const text = await this.androidTools.readScreen();
        return text || 'No text found on screen';
      }
    });
    this.registerTool({
      name: 'android_battery',
      description: '🔋 Get Android battery level',
      schema: {},
      dangerous: false,
      handler: async () => {
        const level = await this.androidTools.getBatteryLevel();
        return level >= 0 ? `${level}%` : { error: 'Could not read battery level' };
      }
    });
    this.registerTool({
      name: 'android_info',
      description: '📱 Get full device info (model, Android version, SDK, screen, battery, IP)',
      schema: { serial: { type: 'string', optional: true } },
      dangerous: false,
      handler: async (args: any) => {
        const info = await this.androidTools.getDeviceInfo(args.serial);
        if (info.error) return info;
        return `Device: ${info.serial}\n  Model: ${info.model}\n  Manufacturer: ${info.manufacturer}\n  Android: ${info.android} (SDK ${info.sdk})\n  Screen: ${(info.screen as any)?.width}x${(info.screen as any)?.height}\n  Density: ${info.density}\n  State: ${info.state}\n  Battery: ${info.battery}%\n  IP: ${info.ip || 'Not found'}`;
      }
    });
    this.registerTool({
      name: 'android_install',
      description: '📦 Install APK on Android device',
      schema: { apk: { type: 'string' }, serial: { type: 'string', optional: true } },
      dangerous: true,
      handler: async (args: any) => {
        const result = await this.androidTools.installApk(args.apk, args.serial);
        return result;
      }
    });
    this.registerTool({
      name: 'android_packages',
      description: '📋 List installed packages on Android device',
      schema: { serial: { type: 'string', optional: true } },
      dangerous: false,
      handler: async (args: any) => {
        const apps = await this.androidTools.listApps();
        return `Installed packages (${apps.length}):\n\n${apps.slice(0, 80).join('\n')}${apps.length > 80 ? `\n... and ${apps.length - 80} more` : ''}`;
      }
    });
    // ─── AI Council Tools (Deliberation Layer) ───────────────────
    this.registerTool({
      name: 'council_deliberate',
      description: '🏛️ Deliberate with AI Council for complex/ethical decisions. Use for high-stakes choices, moral dilemmas, or when multiple expert perspectives are needed.',
      schema: {
        topic: { type: 'string', description: 'The topic/question to deliberate' }
      },
      dangerous: false,
      handler: async (args: any) => {
        const { processWithCouncil } = await import('../council/chat-bridge.js');
        const result = await processWithCouncil('tool-call', args.topic, 5, process.env.MINIMAX_API_KEY || '');
        return {
          verdict: result.routed,
          response: result.response,
          council: result.council
        };
      }
    });
    this.registerTool({
      name: 'council_ask',
      description: '🎯 Ask AI Council a direct question and get a verdict. Returns APPROVE, REJECT, MODIFY, or DELEGATE with reasoning.',
      schema: {
        question: { type: 'string', description: 'The question to ask the council' }
      },
      dangerous: false,
      handler: async (args: any) => {
        const { askCouncil } = await import('../council/chat-bridge.js');
        const result = await askCouncil(args.question, 'Direct question from tool call', process.env.MINIMAX_API_KEY || '');
        return {
          verdict: result.verdict,
          reasoning: result.reasoning,
          confidence: result.confidence,
          councilors: result.councilors_heard
        };
      }
    });

    this.registerTool({
      name: 'android_termux',
      description: '🖥️ Run Termux API command (battery, clip-get, clip-set, notif, sensors, location, wifi, toast, vibrate, torch)',
      schema: { command: { type: 'string' }, serial: { type: 'string', optional: true } },
      dangerous: false,
      handler: async (args: any) => {
        const map: Record<string, string> = {
          battery: 'termux-battery-status', 'clip-get': 'termux-clipboard-get', 'clip-set': 'termux-clipboard-set',
          clipboard: 'termux-clipboard-get', notif: 'termux-notification-list', notifications: 'termux-notification-list',
          'notif-show': "termux-notification -t DuckCLI -c 'From duck-cli'",
          sensors: 'termux-sensor -s accelerometer -n 1', location: 'termux-location -l',
          wifi: 'termux-wifi-scaninfo', tel: 'termux-telephony-deviceinfo',
          camera: 'termux-camera-info', sms: 'termux-sms-list',
          toast: "termux-toast 'duck-cli'", vibrate: 'termux-vibrate -d 500',
          torch: 'termux-torch on', 'torch-on': 'termux-torch on', 'torch-off': 'termux-torch off',
        };
        const cmd = map[args.command.toLowerCase()] || `termux-${args.command}`;
        const result = await this.androidTools.termuxCommand(cmd, args.serial || null);
        if (!result || result === '(no output)') {
          return `Termux API not available. Install:\n  pkg install termux-api`;
        }
        return result;
      }
    });
    this.registerTool({
      name: 'android_analyze',
      description: '🔍 Full vision pipeline: screenshot + UI tree + foreground app + battery + screen',
      schema: { serial: { type: 'string', optional: true } },
      dangerous: false,
      handler: async (args: any) => {
        try {
          const data = await this.androidTools.screenshotAnalyze(args.serial);
          return data;
        } catch (e: any) {
          return { error: e.message };
        }
      }
    });
    this.registerTool({
      name: 'android_push',
      description: '📤 Push local file to Android device',
      schema: { local: { type: 'string' }, remote: { type: 'string' }, serial: { type: 'string', optional: true } },
      dangerous: true,
      handler: async (args: any) => {
        if (args.serial) this.androidTools.setDevice(args.serial);
        return (await this.androidTools.pushFile(args.local, args.remote)) ? 'Pushed successfully' : 'Push failed';
      }
    });
    this.registerTool({
      name: 'android_pull',
      description: '📥 Pull file from Android device',
      schema: { remote: { type: 'string' }, local: { type: 'string' }, serial: { type: 'string', optional: true } },
      dangerous: true,
      handler: async (args: any) => {
        return (await this.androidTools.pullFile(args.remote, args.local)) ? 'Pulled' : 'Pull failed';
      }
    });
    this.registerTool({
      name: 'android_clipboard',
      description: '📋 Get/set clipboard on Android',
      schema: { action: { type: 'string', description: 'get | set' }, text: { type: 'string', optional: true }, serial: { type: 'string', optional: true } },
      dangerous: false,
      handler: async (args: any) => {
        if (args.action === 'get') {
          const text = await this.androidTools.getClipboard();
          return text || '(empty)';
        } else {
          return (await this.androidTools.setClipboard(args.text || '')) ? 'Clipboard set' : 'Clipboard failed';
        }
      }
    });
    this.registerTool({
      name: 'android_notifications',
      description: '🔔 Get recent Android notifications',
      schema: { serial: { type: 'string', optional: true } },
      dangerous: false,
      handler: async (args: any) => {
        const notifs = await this.androidTools.getNotifications();
        return notifs.length > 0 ? notifs.join('\n') : 'No notifications';
      }
    });

    // ─── Agent Card (A2A/Mesh Discovery) ────────────────────
    this.registerTool({
      name: 'agent_card',
      description: '🎴 Get this agent\'s Agent Card for mesh discovery',
      schema: {},
      dangerous: false,
      handler: async () => {
        return agentCardManager.getCard();
      }
    });
    this.registerTool({
      name: 'agent_card_update',
      description: '🎴 Update this agent\'s Agent Card',
      schema: {
        description: { type: 'string', optional: true },
        skills: { type: 'array', optional: true }
      },
      dangerous: false,
      handler: async (args: any) => {
        const updates: any = {};
        if (args.description) updates.description = args.description;
        if (args.skills) updates.skills = args.skills;
        return agentCardManager.updateCard(updates);
      }
    });

    // ─── MiniMax CLI (mmx) ───────────────────────────────────
    this.registerTool({
      name: 'mmx_text',
      description: '📝 Generate text/chat via MiniMax CLI (mmx). Use for quick text generation when connected to MiniMax.',
      schema: {
        prompt: { type: 'string', description: 'Text prompt or message' },
        system: { type: 'string', optional: true, description: 'System prompt' }
      },
      dangerous: false,
      handler: async (args: any) => {
        const { spawnSync } = await import('child_process');
        const systemArg = args.system ? `--system "${args.system}" ` : '';
        const result = spawnSync('mmx', ['text', 'chat', '--message', args.prompt, ...(args.system ? ['--system', args.system] : [])], { encoding: 'utf-8' });
        return result.stdout || result.stderr || 'No output from mmx';
      }
    });
    this.registerTool({
      name: 'mmx_image',
      description: '🖼️ Generate an image via MiniMax CLI (mmx). Provide a prompt.',
      schema: {
        prompt: { type: 'string', description: 'Image generation prompt' },
        output: { type: 'string', optional: true, description: 'Output file path' }
      },
      dangerous: false,
      handler: async (args: any) => {
        const { spawnSync } = await import('child_process');
        const result = spawnSync('mmx', ['image', args.prompt, ...(args.output ? ['--out', args.output] : [])], { encoding: 'utf-8' });
        return result.stdout || result.stderr || 'No output from mmx';
      }
    });
    this.registerTool({
      name: 'mmx_vision',
      description: '👁️ Analyze an image via MiniMax CLI (mmx) vision model. Provide image path and optional query.',
      schema: {
        imagePath: { type: 'string', description: 'Path to image file' },
        query: { type: 'string', optional: true, description: 'What to look for in the image' }
      },
      dangerous: false,
      handler: async (args: any) => {
        const { spawnSync } = await import('child_process');
        const result = spawnSync('mmx', ['vision', args.imagePath, ...(args.query ? ['--query', args.query] : [])], { encoding: 'utf-8' });
        return result.stdout || result.stderr || 'No output from mmx';
      }
    });
    this.registerTool({
      name: 'mmx_search',
      description: '🔍 Search the web via MiniMax CLI (mmx).',
      schema: {
        query: { type: 'string', description: 'Search query' }
      },
      dangerous: false,
      handler: async (args: any) => {
        const { spawnSync } = await import('child_process');
        const result = spawnSync('mmx', ['search', args.query], { encoding: 'utf-8' });
        return result.stdout || result.stderr || 'No output from mmx';
      }
    });
    this.registerTool({
      name: 'mmx_status',
      description: '📊 Check MiniMax CLI (mmx) quota and auth status.',
      schema: {},
      dangerous: false,
      handler: async () => {
        const { spawnSync } = await import('child_process');
        const result = spawnSync('mmx', ['quota'], { encoding: 'utf-8' });
        return result.stdout || result.stderr || 'No output from mmx';
      }
    });
  }

  private registerTool(def: ToolDefinition): void {
    this.tools.register(def);
    console.log(`   + Tool: ${def.name}${def.dangerous ? ' ⚠️' : ''}`);
  }

  // ─── Chat Loop ─────────────────────────────────────────

  async chat(message: string): Promise<string> {
    // DEFENSIVE: Ensure message is always a string before any processing
    const safeMessage = (() => {
      if (typeof message === 'string') return message;
      if (Array.isArray(message)) return JSON.stringify(message);
      if (typeof message === 'object' && message !== null) return JSON.stringify(message);
      return String(message);
    })();
    await this.ensureInitialized();
    this.metrics.totalInteractions++;
    const startTime = Date.now();

    // Start execution trace if DUCK_TRACE=1
    const traceId = maybeStartTrace(this.sessionId);
    this.executionTrace.logThought(safeMessage.substring(0, 100));

    this.sessions.addMessage({
      sessionId: this.sessionId,
      role: 'user',
      content: safeMessage,
      timestamp: startTime
    });

    if (this.totalCost >= this.costBudget) {
      return "⚠️ Cost budget exceeded.";
    }

    this.history.push({ role: 'user', content: safeMessage, timestamp: startTime });
    
    // Build context with learning loop context
    const context = await this.buildContext();
    
    // Emit thinking
    this.streams.thinking(this.sessionId, 'Building context...');

    // Smart router: tries providers in priority order (kimi → minimax → openrouter)
    let response: string | null = null;
    let lastProvider = '';
    try {
      const routeResult = await this.providers.route('', context);
      response = routeResult.text;
      lastProvider = routeResult.provider;
      this.trackCost(routeResult.provider, this.estimateTokens(JSON.stringify(context)), this.estimateTokens(response));
    } catch (e: any) {
      // fall through to error
    }

    if (!response) {
      this.metrics.failedInteractions++;
      const errMsg = `❌ All router targets failed`;
      this.sessions.addMessage({ sessionId: this.sessionId, role: 'assistant', content: errMsg, timestamp: Date.now() });
      this.executionTrace.logError('All router targets failed');
      this.executionTrace.generateErrorReport('All router targets failed', ['Attempted route through providers'], 'Check provider configuration');
      await maybeEndTrace();
      return errMsg;
    }

    // Parse and execute tools in PARALLEL
    const toolCalls = this.parseToolCalls(response);
    const toolsUsed: string[] = [];
    
    // Generate whispers before tool execution (Sub-Conscious integration)
    const whispers = await this.whisperEngine.generateWhispers({
      message: safeMessage,
      sessionHistory: this.history.slice(-5).map(m => m.content),
      time: new Date()
    });
    // If high-confidence whisper, log it
    for (const whisper of whispers) {
      if (whisper.confidence >= 0.7) {
        console.log(`👻 Whisper: ${whisper.message}`);
      }
    }
    // Emit high-confidence whispers to user
    if (whispers.length > 0) {
      const highConfidence = whispers.filter(w => w.confidence >= 0.6);
      if (highConfidence.length > 0) {
        this.streams.whisper(this.sessionId, highConfidence);
      }
    }
    
    if (toolCalls.length > 0) {
      const results = await Promise.all(toolCalls.map(async (call) => {
        const tStart = Date.now();
        this.streams.toolStart(this.sessionId, call.name, call.args);
        this.executionTrace.logToolCall(call.name, call.args);
        toolsUsed.push(call.name);
        let success = false;
        let result: any;
        try {
          result = await this.executeToolWithRetry(call.name, call.args);
          success = true;
          const tDuration = Date.now() - tStart;
          if (call.name === 'agent_spawn_team' && result && typeof result === 'object') {
            const agentIds: string[] = result.agentIds || [];
            if (agentIds.length > 0) {
              this.streams.thinking(this.sessionId, 'Waiting for ' + agentIds.length + ' parallel agents...');
              // Wait for agents with error isolation
              const settled = await Promise.allSettled(agentIds.map(id => this.subagents.waitFor(id, 300000)));
              // Clean up completed agents to prevent memory leak
              for (const id of agentIds) {
                this.subagents.removeAgent(id);
              }
              const agentResults = settled.map((r, i) => r.status === 'fulfilled' ? r.value : { error: r.reason?.message || 'Agent failed', id: agentIds[i] });
              result = { agents: agentIds, results: agentResults };
            }
          }
          // Hermes v2026.4.3: Secret scanner - redact API keys from tool results before logging
          const scanResult = this.secretScanner?.scan(JSON.stringify(result).slice(0, 200));
          const displayResult = scanResult && !scanResult.clean
            ? scanResult.redacted
            : JSON.stringify(result).slice(0, 200);
          if (scanResult && !scanResult.clean) {
            this.secretScanner!.warn(scanResult.findings, `tool ${call.name}`);
          }
          this.streams.toolEnd(this.sessionId, call.name, true, displayResult, undefined, tDuration);
          this.loopDetector.record(call.name, call.args, true, 'ok');
          this.sessionLogger.logStep(toolCalls.indexOf(call) + 1, { tool: call.name, args: call.args, success: true }, { success: true, message: 'Tool executed successfully', durationMs: tDuration });
          this.executionTrace.logToolResult(displayResult, tDuration);
          // ACPX-style NDJSON session stream
          this.sessionStream.notify('tool/execute', { tool: call.name, args: call.args }, { role: 'assistant', toolName: call.name, outcome: 'ok', durationMs: tDuration });
          // Save to Sub-Conscious memory after tool success
          await this.memoryBridge.save({
            id: `whisper-${Date.now()}`,
            content: `Tool ${call.name} succeeded`,
            context: JSON.stringify(call.args),
            timestamp: new Date(),
            importance: 0.5
          });
          return '\n\n🔧 ' + call.name + ': ' + JSON.stringify(result);
        } catch (e: any) {
          const tDuration = Date.now() - tStart;
          this.streams.toolEnd(this.sessionId, call.name, false, undefined, e.message, tDuration);
          this.loopDetector.record(call.name, call.args, false, 'failed');
          this.sessionLogger.logStep(toolCalls.indexOf(call) + 1, { tool: call.name, args: call.args, success: false }, { success: false, message: e.message, durationMs: tDuration });
          this.executionTrace.logToolError(e.message, tDuration);
          // ACPX-style NDJSON session stream
          this.sessionStream.notify('tool/execute', { tool: call.name, args: call.args }, { role: 'assistant', toolName: call.name, outcome: 'failed', durationMs: tDuration, toolResult: e.message });
          // Save to Sub-Conscious memory after tool failure
          await this.memoryBridge.save({
            id: `whisper-${Date.now()}`,
            content: `Tool ${call.name} failed: ${e.message}`,
            context: JSON.stringify(call.args),
            timestamp: new Date(),
            importance: 0.5
          });
          return '\n\n❌ ' + call.name + ' failed: ' + e.message;
        }
      }));
      const toolSummary = results.join('');

      // After tool execution, do a final synthesis pass so users get a clean
      // assistant answer instead of raw tool payloads / TOOL_CALL traces.
      try {
        const cleanedDraft = response
          .replace(/\[TOOL_CALL\][\s\S]*?\[\/TOOL_CALL\]/g, '')
          .replace(/<(?:minimax:)?tool_call>[\s\S]*?<\/(?:minimax:)?tool_call>/gi, '')
          .replace(/<invoke\s+name="[^"]+">[\s\S]*?<\/invoke>/gi, '')
          .replace(/<parameter\s+name="[^"]+">[\s\S]*?<\/parameter>/gi, '')
          .trim();
        const synthesisPrompt = [
          'Answer the user directly using the tool results below.',
          'Do not emit TOOL_CALL blocks, internal logs, JSON dumps, or chain-of-thought.',
          'Respond as a normal assistant with the final answer only.',
          '',
          `User request: ${safeMessage}`,
          cleanedDraft ? `Initial draft: ${cleanedDraft}` : '',
          `Tool results:${toolSummary}`,
        ].filter(Boolean).join('\n');

        const synthesized = await this.providers.route(synthesisPrompt);
        const finalText = (synthesized?.text || '')
          .replace(/\[TOOL_CALL\][\s\S]*?\[\/TOOL_CALL\]/g, '')
          .replace(/<(?:minimax:)?tool_call>[\s\S]*?<\/(?:minimax:)?tool_call>/gi, '')
          .replace(/<invoke\s+name="[^"]+">[\s\S]*?<\/invoke>/gi, '')
          .replace(/<parameter\s+name="[^"]+">[\s\S]*?<\/parameter>/gi, '')
          .trim();

        response = finalText || (cleanedDraft + toolSummary);
      } catch (e: any) {
        console.log('[ToolSynth] Final synthesis failed, falling back to raw tool summary');
        response = response
          .replace(/\[TOOL_CALL\][\s\S]*?\[\/TOOL_CALL\]/g, '')
          .replace(/<(?:minimax:)?tool_call>[\s\S]*?<\/(?:minimax:)?tool_call>/gi, '')
          .replace(/<invoke\s+name="[^"]+">[\s\S]*?<\/invoke>/gi, '')
          .replace(/<parameter\s+name="[^"]+">[\s\S]*?<\/parameter>/gi, '')
          .trim() + toolSummary;
      }

      // DroidClaw-style: Check for stuck loops and inject recovery hints
      const hints = this.loopDetector.check();
      if (hints.length > 0) {
        const hintText = hints.map(h => `⚠️ LOOP_DETECTED [${h.priority}]: ${h.message}`).join('\n');
        console.log('[LoopDetector] Stuck pattern detected, injecting recovery hint');
        response += '\n\n' + hintText;
      }
    }

    // Track interaction for learning
    if (this.learningEnabled) {
      const duration = Date.now() - startTime;
      this.learning.trackInteraction({
        sessionId: this.sessionId,
        input: safeMessage,
        output: response,
        outcome: this.metrics.failedInteractions === 0 ? 'success' : 'partial',
        toolsUsed,
        duration,
        timestamp: Date.now()
      });
    }

    // Learn from interaction
    if (this.learningEnabled) {
      this.learnFromInteraction(safeMessage, response);
    }

    this.history.push({ role: 'assistant', content: response, timestamp: Date.now() });
    this.metrics.successfulInteractions++;

    // Save to session
    this.sessions.addMessage({
      sessionId: this.sessionId,
      role: 'assistant',
      content: response,
      timestamp: Date.now()
    });

    // Trim history
    if (this.history.length > this.maxHistory) {
      this.history = this.history.slice(-this.maxHistory);
    }

    // Emit session end
    this.streams.sessionEnd(this.sessionId, 'success', Date.now() - startTime, toolsUsed);
    this.sessionLogger.finalize(true);
    this.sessionStream.close('ok');

    // End execution trace
    maybeEndTrace();

    return response;
  }

  private checkLearnedPatterns(input: string): string | null {
    const inputLower = input.toLowerCase();
    for (const [pattern, response] of this.learnedPatterns) {
      if (inputLower.includes(pattern.toLowerCase())) {
        return `📚 From memory: ${response}`;
      }
    }
    return null;
  }

  private learnFromInteraction(input: string, output: string): void {
    const words = input.toLowerCase().split(/\s+/).filter(w => w.length > 4);
    if (words.length > 0 && output.length > 20) {
      const key = words.slice(0, 3).join(' ');
      if (!this.learnedPatterns.has(key)) {
        this.learnedPatterns.set(key, output.slice(0, 200));
      }
    }
    this.learningLog.push({ input, output, success: true, timestamp: Date.now() });
  }

  learn(success: boolean, feedback?: string): void {
    const last = this.learningLog[this.learningLog.length - 1];
    if (last) {
      last.success = success;
      last.feedback = feedback;
    }
  }

  private async buildContext(): Promise<any[]> {
    const messages: any[] = [];
    
    const systemPrompt = this.buildSystemPrompt();
    messages.push({ role: 'system', content: systemPrompt });

    // Learning context
    if (this.learningEnabled) {
      const learningContext = this.learning.buildContextPrompt(this.sessionId);
      if (learningContext) {
        messages.push({ role: 'system', content: learningContext });
      }
    }

    // Memory SOUL
    const soul = this.memory.getSoul();
    if (soul) messages.push({ role: 'system', content: soul });

    // DroidClaw-style: Inject recovery hints if agent is stuck
    const hints = this.loopDetector.check();
    if (hints.length > 0) {
      const hintText = hints.map(h => `[${h.priority.toUpperCase()}] ${h.message}`).join('\n');
      messages.push({ role: 'system', content: `RECOVERY_HINTS:\n${hintText}` });
    }

    // Learned patterns
    if (this.learnedPatterns.size > 0) {
      const patterns = Array.from(this.learnedPatterns.entries())
        .map(([k, v]) => `When asked about "${k}": ${v}`)
        .join('\n');
      messages.push({ role: 'system', content: `Learned responses:\n${patterns}` });
    }

    // Recent history
    const recent = this.history.slice(-20);
    messages.push(...recent);

    return messages;
  }

  private buildSystemPrompt(): string {
    // Use KAIROS system prompt compilation from prompts module
    const kairosPrompt = compileSystemPrompt();

    // Build agent-specific capabilities and tools section
    const tools = this.tools.list().map(t => `- ${t.name}: ${t.description}`).join('\n');
    const capabilities: string[] = [];

    if (this.config.planningEnabled) capabilities.push('Use plan_create for complex multi-step tasks');
    if (this.config.cronEnabled) capabilities.push('Use cron_create to schedule recurring tasks');
    if (this.config.subagentEnabled) capabilities.push('Use agent_spawn_team to run multiple agents in PARALLEL');
    capabilities.push('For tasks with independent parts, ALWAYS consider spawning parallel agents');
    if (this.learningEnabled) capabilities.push('Use memory_remember to save important information');
    capabilities.push('Use learn_from_feedback after completing tasks');

    return `${kairosPrompt}

You are ${this.name}, an advanced AI assistant with autonomous planning, subagent orchestration, and self-improvement.

# Available Tools
${tools}

# Agent Capabilities
${capabilities.join('\n')}

# Structured Thinking
- THINK: Why? Current state and what needs to happen
- PLAN: Clear 3-5 step plan to achieve the goal
- DO: Execute tools — one purposeful action at a time
- REVIEW: Did it work? What changed? What's next?

# Recovery Strategies (when stuck)
1. DIAGNOSE: What specifically failed?
2. ALTERNATIVE: Is there a DIFFERENT tool?
3. SIMPLIFY: Break into smaller steps
4. CHECK: Is target available?
5. ASK: spawn a subagent for second opinion
6. MOVE ON: Try a different approach

# Best Practices
- NEVER retry the same failing tool more than once — try DIFFERENT approach
- Silent successes: shell/file_write often succeed without output
- Multi-step: use plan_create for clarity
- Parallel: agent_spawn_team for independent tasks (faster)

# Voice / TTS (Telegram Voice Messages)
When user asks you to "say X", "read this aloud", "generate speech", or "speak this":
1. ALWAYS call the speak tool first with the text to convert
2. IMPORTANT: After the speak tool returns [AUDIO:filepath], you MUST include that exact marker as a SEPARATE LINE in your final text response (not inside JSON, not buried in text — on its own line)
3. Example correct response:
   "Hello! How are you doing today?"
   [AUDIO:/tmp/tts_1234567890.mp3]
4. The [AUDIO:...] marker will be automatically detected and sent as a Telegram voice message
5. Keep the spoken text concise (under 1000 chars for best TTS quality)
`;
  }

  private parseToolCalls(text: string): Array<{ name: string; args: any }> {
    const calls: Array<{ name: string; args: any }> = [];
    const normalizeToolName = (rawName: string): string | null => {
      const name = String(rawName || '').trim();
      if (!name) return null;
      if (this.tools.has(name)) return name;
      const lower = name.toLowerCase();
      const aliases: Record<string, string> = {
        bash: 'shell',
        shell: 'shell',
        command: 'shell',
        websearch: 'web_search',
        web_search: 'web_search',
        webfetch: 'web_fetch',
        web_fetch: 'web_fetch',
        fileread: 'file_read',
        file_read: 'file_read',
        filewrite: 'file_write',
        file_write: 'file_write',
      };
      const mapped = aliases[lower] || lower;
      return this.tools.has(mapped) ? mapped : null;
    };

    const pattern1 = /\[TOOL:\s*(\w+)\s*\|\s*args:\s*(\{[^}]+\})\]/g;
    let match;
    while ((match = pattern1.exec(text)) !== null) {
      const name = normalizeToolName(match[1]);
      if (!name) continue;
      try { calls.push({ name, args: JSON.parse(match[2]) }); } catch {}
    }

    const pattern2 = /(\w+)\s*\(\s*(\{[^}]+\})\s*\)/g;
    let match2;
    while ((match2 = pattern2.exec(text)) !== null) {
      const name = normalizeToolName(match2[1]);
      if (!name) continue;
      try { calls.push({ name, args: JSON.parse(match2[2]) }); } catch {}
    }

    // Support model outputs like:
    // {tool => "web_search", args => { --query "OpenClaw documentation" --provider "DuckDuckGo" }}
    const pattern3 = /\{\s*tool\s*=>\s*"([^"]+)"\s*,\s*args\s*=>\s*\{([\s\S]*?)\}\s*\}/g;
    let match3;
    while ((match3 = pattern3.exec(text)) !== null) {
      const name = normalizeToolName(match3[1]);
      const rawArgs = match3[2] || '';
      if (!name) continue;
      const args: Record<string, any> = {};
      const argPattern = /--([a-zA-Z0-9_-]+)\s+"([^"]*)"/g;
      let argMatch;
      while ((argMatch = argPattern.exec(rawArgs)) !== null) {
        args[argMatch[1]] = argMatch[2];
      }
      calls.push({ name, args });
    }

    // Support MiniMax/XML-style tool calls like:
    // <minimax:tool_call><invoke name="Bash"><parameter name="command">ls -la</parameter></invoke></minimax:tool_call>
    const pattern4 = /<(?:minimax:)?tool_call>[\s\S]*?<invoke\s+name="([^"]+)"\s*>([\s\S]*?)<\/invoke>[\s\S]*?<\/(?:minimax:)?tool_call>/gi;
    let match4;
    while ((match4 = pattern4.exec(text)) !== null) {
      const name = normalizeToolName(match4[1]);
      if (!name) continue;
      const rawParams = match4[2] || '';
      const args: Record<string, any> = {};
      const paramPattern = /<parameter\s+name="([^"]+)">([\s\S]*?)<\/parameter>/gi;
      let paramMatch;
      while ((paramMatch = paramPattern.exec(rawParams)) !== null) {
        const key = String(paramMatch[1] || '').trim();
        const value = String(paramMatch[2] || '')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&amp;/g, '&')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .trim();
        if (key) args[key] = value;
      }
      calls.push({ name, args });
    }

    return calls;
  }

      private estimateTokens(text: string): number {
        return Math.ceil(text.length / 4);
      }

      private trackCost(provider: string, promptTokens: number, completionTokens: number): void {
        const costs: Record<string, number> = {
          'minimax': 0.5, 'openai': 2.0, 'anthropic': 3.0, 'lmstudio': 0
        };
        const rate = costs[provider] || 1;
        const cost = (promptTokens + completionTokens) / 1_000_000 * rate;
        this.totalCost += cost;
        this.costRecords.push({ provider, model: this.config.model || 'default', promptTokens, completionTokens, cost, timestamp: Date.now() });
        // Prune unbounded collections to prevent memory leaks
        if (this.costRecords.length > 1000) this.costRecords = this.costRecords.slice(-500);
        if (this.learningLog.length > 500) this.learningLog = this.learningLog.slice(-250);
        if (this.learnedPatterns.size > 100) {
          // Remove oldest entries when map gets too big
          const entries = [...this.learnedPatterns.entries()];
          this.learnedPatterns.clear();
          entries.slice(-50).forEach(([k, v]) => this.learnedPatterns.set(k, v));
        }
      }

      getMetrics(): AgentMetrics {
        return { ...this.metrics, totalCost: this.totalCost };
      }

      getCostInfo(): { total: number; budget: number; remaining: number } {
        return { total: this.totalCost, budget: this.costBudget, remaining: this.costBudget - this.totalCost };
      }

      private async ensureInitialized(): Promise<void> {
        if (!this.initialized) await this.initialize();
      }

      async think(input: string): Promise<string> { return this.chat(input); }
      async execute(input: string): Promise<string> { return this.chat(input); }
      async remember(content: string): Promise<void> { await this.memory.add(content, 'fact'); }
      async recall(query: string): Promise<string[]> { return this.memory.search(query); }
      async openApp(app: string): Promise<void> { await this.desktop.openApp(app); }
      async click(x: number, y: number): Promise<void> { await this.desktop.click(x, y); }
      async type(text: string): Promise<void> { await this.desktop.type(text); }
      async screenshot(): Promise<string> { return this.desktop.screenshot(); }

      getHistory(): Message[] { return [...this.history]; }
      clearHistory(): void { this.history = []; }

      getStatus() {
        const activePlans = this.planner.listActivePlans();
        const memoryStats = this.memory.stats();
        const sessionStats = this.sessions.stats();
        const learningStats = this.learning.stats();
        const cronStats = this.cron.stats();
        const subagentStats = this.subagents.stats();

        return {
          id: this.id,
          name: this.name,
          sessionId: this.sessionId,
          providers: this.providers.list().length,
          tools: this.tools.list().length,
          toolList: this.tools.list().map(t => ({ name: t.name, dangerous: t.dangerous })),
          skills: this.skills.list(),
          historyLength: this.history.length,
          learnedPatterns: this.learnedPatterns.size,
          cost: this.getCostInfo(),
          metrics: this.getMetrics(),
          memory: memoryStats,
          sessions: sessionStats,
          learning: learningStats,
          cron: cronStats,
          subagents: subagentStats,
          planning: { activePlans: activePlans.length, plans: activePlans.map(p => ({ id: p.id, goal: p.goal, status: p.status })) },
          guard: this.guard.stats()
        };
    }

    // MCP tool access - expose tools for MCP server
    getTools() {
      return this.tools.list();
    }

    async executeTool(name: string, args: any) {
      return await this.tools.execute(name, args);
    }

    // ─── Tool Execution with Retry & Fallback ─────────────────────────────────

    /**
     * Execute a tool with retry logic, exponential backoff, and fallback alternatives.
     * Reads retry/fallback config from src/agent/tool-registry.ts per tool.
     * Uses structured log format:
     *   [TOOL_CALL] tool=... attempt=1/3
     *   [TOOL_SUCCESS] tool=... duration=123ms
     *   [TOOL_RETRY] tool=... error="..." attempt=2/3 wait=1000ms
     *   [TOOL_FALLBACK] tool=... trying=android_exec_out
     *   [TOOL_FAIL] tool=... error="..." attempts=3/3
     */
    async executeToolWithRetry(toolName: string, args: any): Promise<any> {
      const entry: ToolRegistryEntry | null = getToolRetryConfig(toolName);

      // No retry config found - execute once without retry machinery
      if (!entry) {
        return await this.tools.execute(toolName, args);
      }

      const maxAttempts = entry.maxRetries + 1; // total attempts = maxRetries + 1 (first try)
      let currentArgs = args;
      let lastError: any = null;
      let lastResult: any = null;

      // ─── Primary tool attempts with retry ────────────────────────────────────
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        // Structured log: TOOL_CALL
        const ts = new Date().toISOString();
        console.log(`[TOOL_CALL] timestamp=${ts} tool=${toolName} attempt=${attempt}/${maxAttempts}`);

        const startTime = Date.now();
        try {
          let result = await this.tools.execute(toolName, currentArgs);
          const durationMs = Date.now() - startTime;

          // Some tool handlers return { error: ... } inside a successful wrapper
          // instead of throwing. Normalize that into a real tool failure so retry,
          // fallback, and failure-reporting logic can actually fire.
          if (
            result?.success &&
            result?.result &&
            typeof result.result === 'object' &&
            result.result.error &&
            result.result.success !== true
          ) {
            result = { ...result, success: false, error: String(result.result.error) };
          }

          if (result.success) {
            // Structured log: TOOL_SUCCESS
            console.log(`[TOOL_SUCCESS] timestamp=${new Date().toISOString()} tool=${toolName} duration=${durationMs}ms`);
            return result;
          }

          // Tool returned an error - classify it
          lastError = result.error || 'Unknown tool error';
          lastResult = result;

          // Structured log: TOOL_RETRY (if more attempts left)
          const errorType = classifyError(lastError, toolName);
          if (attempt < maxAttempts) {
            if (shouldRetryOnError(entry, errorType)) {
              const backoffMs = Math.floor(entry.retryConfig.backoffMs * Math.pow(entry.retryConfig.backoffMultiplier, attempt - 1));
              console.log(`[TOOL_RETRY] timestamp=${new Date().toISOString()} tool=${toolName} error="${lastError}" attempt=${attempt + 1}/${maxAttempts} wait=${backoffMs}ms`);
              await new Promise(r => setTimeout(r, backoffMs));
              continue;
            } else if (shouldFallbackOnError(entry, errorType) && entry.fallbacks.length > 0) {
              // Don't retry, fall through to fallback below
              break;
            } else {
              // fail-fast: error type doesn't allow retry
              break;
            }
          } else {
            // Last attempt failed, check if fallback is available
            if (shouldFallbackOnError(entry, errorType) && entry.fallbacks.length > 0) {
              break; // Will try fallbacks below
            }
            // Structured log: TOOL_FAIL
            console.log(`[TOOL_FAIL] timestamp=${new Date().toISOString()} tool=${toolName} error="${lastError}" attempts=${maxAttempts}/${maxAttempts}`);
            try { getFailureReporter().reportTool(toolName, String(lastError), JSON.stringify(currentArgs)); } catch {}
            return { success: false, error: lastError };
          }
        } catch (e: any) {
          const durationMs = Date.now() - startTime;
          lastError = e;
          const errorType = classifyError(e, toolName);

          if (attempt < maxAttempts && shouldRetryOnError(entry, errorType)) {
            const backoffMs = Math.floor(entry.retryConfig.backoffMs * Math.pow(entry.retryConfig.backoffMultiplier, attempt - 1));
            console.log(`[TOOL_RETRY] timestamp=${new Date().toISOString()} tool=${toolName} error="${e.message}" attempt=${attempt + 1}/${maxAttempts} wait=${backoffMs}ms`);
            await new Promise(r => setTimeout(r, backoffMs));
            continue;
          }

          // Check if fallback is available
          if (shouldFallbackOnError(entry, errorType) && entry.fallbacks.length > 0) {
            break; // Will try fallbacks below
          }

          // Structured log: TOOL_FAIL
          console.log(`[TOOL_FAIL] timestamp=${new Date().toISOString()} tool=${toolName} error="${e.message}" attempts=${attempt}/${maxAttempts}`);
          try { getFailureReporter().reportTool(toolName, String(e.message), JSON.stringify(currentArgs)); } catch {}
          return { success: false, error: e.message };
        }
      }

      // ─── Fallback chain ─────────────────────────────────────────────────────
      if (entry.fallbacks.length > 0) {
        for (const fallback of entry.fallbacks) {
          // Check if fallback tool is actually registered
          if (!this.tools.has(fallback.tool)) {
            console.log(`[TOOL_FALLBACK] timestamp=${new Date().toISOString()} tool=${toolName} skipped fallback=${fallback.tool} (not registered)`);
            continue;
          }

          // Structured log: TOOL_FALLBACK
          console.log(`[TOOL_FALLBACK] timestamp=${new Date().toISOString()} tool=${toolName} trying=${fallback.tool}`);

          // Transform args if transformer is provided
          const fallbackArgs = fallback.argsTransform ? fallback.argsTransform(currentArgs, lastResult, lastError) : currentArgs;

          try {
            const fbResult = await this.tools.execute(fallback.tool, fallbackArgs);
            if (fbResult.success) {
              // Structured log: TOOL_SUCCESS (via fallback)
              console.log(`[TOOL_SUCCESS] timestamp=${new Date().toISOString()} tool=${fallback.tool} duration=0ms fallback=true`);
              return { ...fbResult, _fallbackUsed: fallback.tool, _fallbackNote: fallback.description };
            }
            // Fallback also failed, try next fallback
            lastError = fbResult.error;
            lastResult = fbResult;
            continue;
          } catch (e: any) {
            lastError = e;
            // Fallback threw, try next fallback
            continue;
          }
        }
      }

      // ─── All retries and fallbacks exhausted ────────────────────────────────
      // Structured log: TOOL_FAIL
      const totalAttempts = maxAttempts + entry.fallbacks.length;
      console.log(`[TOOL_FAIL] timestamp=${new Date().toISOString()} tool=${toolName} error="${lastError?.message || lastError}" attempts=${totalAttempts}/${totalAttempts}`);
      try { getFailureReporter().reportTool(toolName, String(lastError?.message || lastError), JSON.stringify(currentArgs)); } catch {}

      // Build a helpful summary error
      const fallbackNames = entry.fallbacks.map(f => f.tool).join(' → ');
      const summaryError = fallbackNames
        ? `[${toolName} failed after ${maxAttempts} attempts + ${entry.fallbacks.length} fallbacks (${fallbackNames})] ${lastError?.message || lastError}`
        : `[${toolName} failed after ${maxAttempts} attempts] ${lastError?.message || lastError}`;

      return { success: false, error: summaryError };
    }

    async shutdown(): Promise<void> {
        console.log(`\n🦆 ${this.name} shutting down...`);
        try { this.memory.close(); } catch {}
        try { this.sessions.endSession(this.sessionId, 'success'); } catch {}
        try { this.sessions.close(); } catch {}
        try { this.cron.close(); } catch {}
        try { this.subagents.close(); } catch {}
        try { this.learning.close(); } catch {}
        try { this.streams.sessionEnd(this.sessionId, 'success', 0, []); } catch {}
        console.log(`   Total cost: $${this.totalCost.toFixed(4)}`);
        console.log(`   Interactions: ${this.metrics.totalInteractions}`);
        console.log(`   Success rate: ${this.metrics.totalInteractions > 0 ? (this.metrics.successfulInteractions / this.metrics.totalInteractions * 100).toFixed(1) : 0}%`);
        try { console.log(`   Sessions: ${this.sessions.stats().totalSessions}`); } catch {}
        try { console.log(`   Learned skills: ${this.learning.stats().learnedSkills}`); } catch {}
        try { console.log(`   Cron jobs: ${this.cron.stats().totalJobs}`); } catch {}
        try { console.log(`   Active subagents: ${this.subagents.stats().active}`); } catch {}
        console.log(`✅ ${this.name} stopped`);
      }
    }

    export default Agent;
    
