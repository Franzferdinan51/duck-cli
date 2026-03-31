/**
 * 🦆 Duck Agent - OpenClaw Compatibility Layer
 * Feature detection, fallbacks, and polyfills for OpenClaw-specific APIs
 * 
 * This module answers the question: "Is this OpenClaw feature available?"
 * and provides fallback implementations when features are missing.
 */

import { EventEmitter } from 'events';
import * as path from 'path';
import * as fs from 'fs';

// ============================================================================
// Feature Flags
// ============================================================================

export interface OpenClawFeatures {
  // Core features
  websocketStreaming: boolean;
  sessionPersistence: boolean;
  multiAgent: boolean;
  skillSystem: boolean;
  memorySystem: boolean;
  toolRegistry: boolean;
  
  // Advanced features
  visionAnalysis: boolean;
  voiceSynthesis: boolean;
  desktopControl: boolean;
  browserAutomation: boolean;
  
  // Protocol features
  acpProtocol: boolean;
  mcpProtocol: boolean;
  openaiCompat: boolean;
  
  // Integration features
  openclawsExtension: boolean;
  skillHotReload: boolean;
  agentMesh: boolean;

  // v2026.3.31 OpenClaw features
  /** SQLite-backed task ledger for background tasks */
  taskLedgerSQLite: boolean;
  /** Persisted blocked state for tasks */
  taskBlockedState: boolean;
  /** Parent-child task flow for orchestrated work */
  taskParentChildFlow: boolean;
  /** dangerous-code scanning fails closed by default */
  dangerousCodeScanning: boolean;
  /** Node commands require explicit pairing approval */
  nodePairingApproval: boolean;
  /** MCP remote HTTP/SSE server support */
  mcpRemoteHTTP: boolean;
}

export interface FeatureCheck {
  name: string;
  available: boolean;
  fallback?: string;
  version?: string;
  notes?: string;
}

// ============================================================================
// Feature Detection
// ============================================================================

export class OpenClawCompatibilityChecker extends EventEmitter {
  private features: Partial<OpenClawFeatures> = {};
  private checked: boolean = false;
  
  constructor() {
    super();
  }

  /**
   * Run all feature checks
   */
  async checkAll(): Promise<OpenClawFeatures> {
    if (this.checked) {
      return this.features as OpenClawFeatures;
    }
    
    this.features = {
      // Core features
      websocketStreaming: await this.check('WebSocket streaming', () => {
        try {
          const { WebSocket } = require('ws');
          return typeof WebSocket === 'function';
        } catch {
          return false;
        }
      }),
      
      sessionPersistence: await this.check('Session persistence', async () => {
        // Duck Agent always supports session persistence
        return true;
      }),
      
      multiAgent: await this.check('Multi-agent coordination', async () => {
        try {
          const { MultiAgent } = require('../multiagent/coordinator.js');
          return typeof MultiAgent === 'function';
        } catch {
          return false;
        }
      }),
      
      skillSystem: await this.check('Skill system', async () => {
        try {
          const { SkillRunner } = require('../skills/runner.js');
          return typeof SkillRunner === 'function';
        } catch {
          return false;
        }
      }),
      
      memorySystem: await this.check('Memory system', async () => {
        try {
          const { MemorySystem } = require('../memory/system.js');
          return typeof MemorySystem === 'function';
        } catch {
          return false;
        }
      }),
      
      toolRegistry: await this.check('Tool registry', async () => {
        try {
          const { ToolRegistry } = require('../tools/registry.js');
          return typeof ToolRegistry === 'function';
        } catch {
          return false;
        }
      }),
      
      // Advanced features
      visionAnalysis: await this.check('Vision analysis', async () => {
        try {
          // Check if we have image models available
          const providers = process.env.PROVIDERS || '';
          return providers.includes('kimi') || 
                 providers.includes('openai') || 
                 providers.includes('lmstudio');
        } catch {
          return false;
        }
      }),
      
      voiceSynthesis: await this.check('Voice synthesis (TTS)', async () => {
        try {
          // Check for TTS availability
          const fs = require('fs');
          const path = require('path');
          const ttsPath = path.join(process.cwd(), 'skills', 'minimax-speech');
          return fs.existsSync(ttsPath);
        } catch {
          return false;
        }
      }),
      
      desktopControl: await this.check('Desktop control', async () => {
        try {
          // Check for ClawdCursor or desktop integration
          const fs = require('fs');
          const desktopPath = path.join(process.cwd(), 'src', 'integrations', 'desktop.js');
          return fs.existsSync(desktopPath);
        } catch {
          return false;
        }
      }),
      
      browserAutomation: await this.check('Browser automation', async () => {
        try {
          // Check for PinchTab or BrowserOS
          const execSync = require('child_process').execSync;
          try {
            execSync('which pinchtab', { stdio: 'pipe' });
            return true;
          } catch {
            // Check for BrowserOS
            const fs = require('fs');
            return fs.existsSync('/Applications/BrowserOS.app');
          }
        } catch {
          return false;
        }
      }),
      
      // Protocol features
      acpProtocol: await this.check('ACP protocol', async () => {
        try {
          const { ACPServer } = require('../gateway/acp-server.js');
          return typeof ACPServer === 'function';
        } catch {
          return false;
        }
      }),
      
      mcpProtocol: await this.check('MCP protocol', async () => {
        try {
          // Check if mcporter is available
          const execSync = require('child_process').execSync;
          try {
            execSync('which mcporter', { stdio: 'pipe' });
            return true;
          } catch {
            return false;
          }
        } catch {
          return false;
        }
      }),
      
      openaiCompat: await this.check('OpenAI compatibility', async () => {
        try {
          const { Gateway } = require('../gateway/index.js');
          return typeof Gateway === 'function';
        } catch {
          return false;
        }
      }),
      
      // Integration features
      openclawsExtension: await this.check('OpenClaws extension point', async () => {
        // This is always true for Duck Agent v0.3.0+
        return true;
      }),
      
      skillHotReload: await this.check('Skill hot reload', async () => {
        try {
          const fs = require('fs');
          const skillPath = path.join(process.cwd(), 'src', 'skills', 'watcher.js');
          return fs.existsSync(skillPath);
        } catch {
          return false;
        }
      }),
      
      agentMesh: await this.check('Agent mesh', async () => {
        try {
          const { MeshClient } = require('../mesh/client.js');
          return typeof MeshClient === 'function';
        } catch {
          return false;
        }
      }),

      // v2026.3.31 features
      taskLedgerSQLite: await this.check('SQLite task ledger', async () => {
        try {
          const fs = require('fs');
          const taskPath = path.join(process.cwd(), 'src', 'tasks', 'task-registry.store.sqlite.js');
          return fs.existsSync(taskPath);
        } catch {
          return false;
        }
      }),

      taskBlockedState: await this.check('Task blocked state persistence', async () => {
        try {
          const fs = require('fs');
          const blockedPath = path.join(process.cwd(), 'src', 'tasks', 'task-registry.store.sqlite.js');
          const content = fs.existsSync(blockedPath) ? fs.readFileSync(blockedPath, 'utf-8') : '';
          return content.includes('blocked');
        } catch {
          return false;
        }
      }),

      taskParentChildFlow: await this.check('Parent-child task flow', async () => {
        try {
          const fs = require('fs');
          const flowPath = path.join(process.cwd(), 'src', 'tasks', 'flow-registry.js');
          return fs.existsSync(flowPath);
        } catch {
          return false;
        }
      }),

      dangerousCodeScanning: await this.check('Dangerous code scanning', async () => {
        try {
          const fs = require('fs');
          const scanPath = path.join(process.cwd(), 'src', 'security', 'code-scanner.js');
          return fs.existsSync(scanPath);
        } catch {
          return false;
        }
      }),

      nodePairingApproval: await this.check('Node pairing approval', async () => {
        try {
          const fs = require('fs');
          const pairingPath = path.join(process.cwd(), 'src', 'security', 'node-pairing.js');
          return fs.existsSync(pairingPath);
        } catch {
          return false;
        }
      }),

      mcpRemoteHTTP: await this.check('MCP remote HTTP/SSE', async () => {
        try {
          const fs = require('fs');
          const mcpPath = path.join(process.cwd(), 'src', 'server', 'mcp-server.js');
          if (!fs.existsSync(mcpPath)) return false;
          const content = fs.readFileSync(mcpPath, 'utf-8');
          return content.includes('remote') || content.includes('streamable-http');
        } catch {
          return false;
        }
      }),
    };
    
    this.checked = true;
    this.emit('checkComplete', this.features);
    return this.features as OpenClawFeatures;
  }

  /**
   * Check a single feature
   */
  private async check(name: string, fn: () => boolean | Promise<boolean>): Promise<boolean> {
    try {
      const result = await Promise.resolve(fn());
      this.emit('featureCheck', { name, available: result });
      return result;
    } catch (e) {
      this.emit('featureCheck', { name, available: false, error: e });
      return false;
    }
  }

  /**
   * Check if a specific feature is available
   */
  async isFeatureAvailable(feature: keyof OpenClawFeatures): Promise<boolean> {
    if (!this.checked) {
      await this.checkAll();
    }
    return this.features[feature] || false;
  }

  /**
   * Get all feature checks as a report
   */
  async getReport(): Promise<FeatureCheck[]> {
    if (!this.checked) {
      await this.checkAll();
    }
    
    const featureNames: (keyof OpenClawFeatures)[] = [
      'websocketStreaming',
      'sessionPersistence', 
      'multiAgent',
      'skillSystem',
      'memorySystem',
      'toolRegistry',
      'visionAnalysis',
      'voiceSynthesis',
      'desktopControl',
      'browserAutomation',
      'acpProtocol',
      'mcpProtocol',
      'openaiCompat',
      'openclawsExtension',
      'skillHotReload',
      'agentMesh',
      'taskLedgerSQLite',
      'taskBlockedState',
      'taskParentChildFlow',
      'dangerousCodeScanning',
      'nodePairingApproval',
      'mcpRemoteHTTP',
    ];
    
    const fallbacks: Record<string, string> = {
      websocketStreaming: 'HTTP long-polling',
      visionAnalysis: 'Text-only mode',
      voiceSynthesis: 'External TTS service',
      desktopControl: 'CLI-based control',
      browserAutomation: 'PinchTab fallback',
      mcpProtocol: 'Direct tool calls',
      skillHotReload: 'Manual skill reload',
    };
    
    return featureNames.map(name => ({
      name: this.formatFeatureName(name),
      available: this.features[name] || false,
      fallback: this.features[name] ? undefined : fallbacks[name],
      version: '0.3.0',
      notes: this.features[name] ? 'Available' : `Fallback: ${fallbacks[name] || 'Not available'}`,
    }));
  }

  /**
   * Get compatibility score (0-100)
   */
  async getCompatibilityScore(): Promise<number> {
    if (!this.checked) {
      await this.checkAll();
    }
    
    const total = Object.keys(this.features).length;
    const available = Object.values(this.features).filter(Boolean).length;
    
    return Math.round((available / total) * 100);
  }

  /**
   * Format feature name for display
   */
  private formatFeatureName(name: string): string {
    return name
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  }
}

// ============================================================================
// Polyfills for OpenClaw-Specific APIs
// ============================================================================

export interface PolyfillOptions {
  strict?: boolean; // Throw errors if polyfill is used
  warn?: boolean;   // Log when polyfill is used
}

/**
 * OpenClaw API Polyfills
 * Provides implementations for OpenClaw-specific APIs that Duck Agent
 * doesn't natively support.
 */
export class OpenClawPolyfills {
  private options: PolyfillOptions;
  
  constructor(options: PolyfillOptions = {}) {
    this.options = {
      strict: options.strict ?? false,
      warn: options.warn ?? true,
    };
  }

  /**
   * Polyfill: openclaw.createSkill()
   * Creates a skill in the OpenClaw skill format
   */
  createSkill(name: string, definition: any): any {
    if (this.options.warn) {
      console.warn(`[Polyfill] openclaw.createSkill() - consider using Duck Agent's native skill system`);
    }
    
    return {
      name,
      version: '1.0.0',
      definition,
      createdAt: Date.now(),
      polyfilled: true,
    };
  }

  /**
   * Polyfill: openclaw.registerMiddleware()
   * Registers middleware for the agent pipeline
   */
  registerMiddleware(name: string, fn: (msg: any, next: () => void) => void): void {
    if (this.options.warn) {
      console.warn(`[Polyfill] openclaw.registerMiddleware("${name}")`);
    }
    
    // Duck Agent doesn't have middleware - just log
    console.log(`[Middleware registered] ${name}`);
  }

  /**
   * Polyfill: openclaw.getMetrics()
   * Get OpenClaw-style metrics
   */
  getMetrics(): any {
    if (this.options.warn) {
      console.warn(`[Polyfill] openclaw.getMetrics()`);
    }
    
    return {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      version: '0.3.0',
      adapter: 'duck-agent',
      polyfilled: true,
    };
  }

  /**
   * Polyfill: openclaw.watchFile()
   * Watch a file for changes (like OpenClaw's file watcher)
   */
  watchFile(path: string, callback: (event: string, filename: string) => void): () => void {
    if (this.options.warn) {
      console.warn(`[Polyfill] openclaw.watchFile("${path}")`);
    }
    
    try {
      const fs = require('fs');
      const watcher = fs.watch(path, (eventType: string, filename: string) => {
        callback(eventType, filename);
      });
      
      return () => watcher.close();
    } catch (e) {
      console.error(`[Polyfill] Failed to watch file: ${path}`, e);
      return () => {};
    }
  }

  /**
   * Polyfill: openclaw.getSessionHistory()
   * Get session history in OpenClaw format
   */
  getSessionHistory(sessionId: string, limit?: number): any[] {
    if (this.options.warn) {
      console.warn(`[Polyfill] openclaw.getSessionHistory("${sessionId}")`);
    }
    
    // Return empty array - Duck Agent handles history differently
    return [];
  }

  /**
   * Polyfill: openclaw.setContext()
   * Set persistent context for the agent
   */
  setContext(key: string, value: any): void {
    if (this.options.warn) {
      console.warn(`[Polyfill] openclaw.setContext("${key}")`);
    }
    
    process.env[`DUCK_CONTEXT_${key}`] = JSON.stringify(value);
  }

  /**
   * Polyfill: openclaw.getContext()
   * Get persistent context
   */
  getContext(key: string): any {
    if (this.options.warn) {
      console.warn(`[Polyfill] openclaw.getContext("${key}")`);
    }
    
    try {
      const value = process.env[`DUCK_CONTEXT_${key}`];
      return value ? JSON.parse(value) : undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * Polyfill: openclaw.createTool()
   * Create a tool in OpenClaw format
   */
  createTool(tool: {
    name: string;
    description?: string;
    schema?: any;
    handler: (input: any) => Promise<any>;
  }): any {
    if (this.options.warn) {
      console.warn(`[Polyfill] openclaw.createTool("${tool.name}")`);
    }
    
    return {
      name: tool.name,
      description: tool.description || '',
      input_schema: tool.schema || {},
      handler: tool.handler,
      polyfilled: true,
      createdAt: Date.now(),
    };
  }
}

// ============================================================================
// Standalone Functions
// ============================================================================

/**
 * Check if Duck Agent is OpenClaw-compatible
 */
export async function checkOpenClawCompatibility(): Promise<{
  compatible: boolean;
  score: number;
  features: FeatureCheck[];
}> {
  const checker = new OpenClawCompatibilityChecker();
  const features = await checker.getReport();
  const score = await checker.getCompatibilityScore();
  
  // Consider compatible if score >= 70%
  const compatible = score >= 70;
  
  return { compatible, score, features };
}

/**
 * Get polyfill instance
 */
export function getPolyfills(options?: PolyfillOptions): OpenClawPolyfills {
  return new OpenClawPolyfills(options);
}

/**
 * Check if a specific OpenClaw API is available
 */
export async function isOpenClawAPIAvailable(apiName: string): Promise<boolean> {
  const checker = new OpenClawCompatibilityChecker();
  
  // Map API names to feature flags
  const apiMap: Record<string, keyof OpenClawFeatures> = {
    'websocket': 'websocketStreaming',
    'sessions': 'sessionPersistence',
    'multiagent': 'multiAgent',
    'skills': 'skillSystem',
    'memory': 'memorySystem',
    'tools': 'toolRegistry',
    'vision': 'visionAnalysis',
    'voice': 'voiceSynthesis',
    'desktop': 'desktopControl',
    'browser': 'browserAutomation',
    'acp': 'acpProtocol',
    'mcp': 'mcpProtocol',
    'openai': 'openaiCompat',
  };
  
  const feature = apiMap[apiName.toLowerCase()];
  if (!feature) {
    return false;
  }
  
  return checker.isFeatureAvailable(feature);
}

export default {
  OpenClawCompatibilityChecker,
  OpenClawPolyfills,
  checkOpenClawCompatibility,
  getPolyfills,
  isOpenClawAPIAvailable,
};
