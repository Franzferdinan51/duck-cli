/**
 * 🎯 Chat Agent Model Router
 * 
 * Ensures proper model selection and delegation:
 * 1. Uses orchestrator-selected models for each task type
 * 2. Routes sub-agents through ACP bridge
 * 3. Maintains session context
 * 4. Handles tool call compatibility
 */

import { ProviderManager } from '../providers/manager.js';
import { ACPBridge } from '../bridge/acp-bridge.js';

export interface ModelRoute {
  provider: string;
  model: string;
  reason: string;
}

export interface TaskType {
  type: 'coding' | 'vision' | 'reasoning' | 'fast' | 'android' | 'general';
  complexity: number;
  requiresTools: boolean;
  requiresVision: boolean;
}

export class ChatAgentModelRouter {
  private providerManager: ProviderManager;
  private acpBridge?: ACPBridge;
  private defaultRoutes: Map<string, ModelRoute>;

  constructor() {
    this.providerManager = new ProviderManager();
    this.defaultRoutes = new Map([
      ['coding', { provider: 'minimax', model: 'glm-5', reason: 'Best for code tasks' }],
      ['vision', { provider: 'kimi', model: 'kimi-k2.5', reason: 'Best vision capabilities' }],
      ['reasoning', { provider: 'minimax', model: 'MiniMax-M2.7', reason: 'Complex reasoning' }],
      ['fast', { provider: 'minimax', model: 'qwen3.5-plus', reason: 'Fast responses' }],
      ['android', { provider: 'lmstudio', model: 'gemma-4-e4b-it', reason: 'Android tool-calling' }],
      ['general', { provider: 'minimax', model: 'MiniMax-M2.7', reason: 'General purpose' }]
    ]);
  }

  async initialize(): Promise<void> {
    await this.providerManager.load();
  }

  setACPBridge(bridge: ACPBridge): void {
    this.acpBridge = bridge;
  }

  /**
   * Route a task to the appropriate model
   */
  async routeTask(task: TaskType): Promise<ModelRoute> {
    // Check if we have an ACP bridge for OpenClaw routing
    if (this.acpBridge?.isConnected()) {
      // Use OpenClaw's orchestrator for model selection
      return this.routeViaOpenClaw(task);
    }

    // Fall back to local routing
    return this.routeLocally(task);
  }

  /**
   * Route via OpenClaw ACP bridge
   */
  private async routeViaOpenClaw(task: TaskType): Promise<ModelRoute> {
    // Query OpenClaw gateway for model recommendation
    try {
      const response = await fetch('http://localhost:18792/v1/route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task: task.type,
          complexity: task.complexity,
          requiresTools: task.requiresTools,
          requiresVision: task.requiresVision
        })
      });

      if (response.ok) {
        const result = await response.json();
        return {
          provider: result.provider,
          model: result.model,
          reason: `OpenClaw orchestrator: ${result.reason}`
        };
      }
    } catch (e) {
      console.warn('[ModelRouter] OpenClaw routing failed, falling back to local');
    }

    return this.routeLocally(task);
  }

  /**
   * Route locally using provider manager
   */
  private routeLocally(task: TaskType): ModelRoute {
    const route = this.defaultRoutes.get(task.type) || this.defaultRoutes.get('general')!;
    
    // Check if preferred provider is available (simplified - assume available if env var set)
    const envKey = `${route.provider.toUpperCase()}_API_KEY`;
    if (process.env[envKey] || route.provider === 'lmstudio') {
      return route;
    }

    // Fall back to LM Studio local
    if (process.env.LMSTUDIO_BASE_URL || route.provider === 'lmstudio') {
      return {
        provider: 'lmstudio',
        model: 'qwen3.5-9b',
        reason: `Fallback: ${route.provider} API key not set`
      };
    }

    // Last resort: LM Studio local
    return {
      provider: 'lmstudio',
      model: 'qwen3.5-9b',
      reason: 'Emergency fallback to local'
    };
  }

  /**
   * Spawn a sub-agent with the correct model
   */
  async spawnSubAgent(
    task: string,
    taskType: TaskType,
    parentSessionId?: string
  ): Promise<{ sessionId: string; model: ModelRoute }> {
    const model = await this.routeTask(taskType);
    
    if (this.acpBridge?.isConnected()) {
      // Spawn via OpenClaw ACP
      const sessionId = await (this.acpBridge as any).spawnAgent?.({
        task,
        model: `${model.provider}/${model.model}`,
        parentSessionId
      }) || `acp_${Date.now()}`;
      
      return { sessionId, model };
    }

    // Spawn locally
    const sessionId = `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Store session with model info
    await this.storeSession(sessionId, {
      task,
      model,
      parentSessionId,
      createdAt: new Date()
    });

    return { sessionId, model };
  }

  /**
   * Get model for tool execution
   */
  async getToolModel(toolName: string): Promise<ModelRoute> {
    // Some tools need specific models
    if (toolName.includes('android')) {
      return this.defaultRoutes.get('android')!;
    }
    if (toolName.includes('vision') || toolName.includes('image')) {
      return this.defaultRoutes.get('vision')!;
    }
    if (toolName.includes('code') || toolName.includes('shell')) {
      return this.defaultRoutes.get('coding')!;
    }
    
    return this.defaultRoutes.get('general')!;
  }

  /**
   * Check if a model supports a tool
   */
  async supportsTool(model: string, tool: string): Promise<boolean> {
    // LM Studio models (local) support all tools
    if (model.includes('lmstudio') || model.includes('qwen3.5') || model.includes('gemma')) {
      return true;
    }
    
    // MiniMax models support most tools
    if (model.includes('minimax') || model.includes('MiniMax')) {
      return !tool.includes('vision'); // MiniMax doesn't have vision
    }
    
    // Kimi supports vision and tools
    if (model.includes('kimi')) {
      return true;
    }

    return true; // Default to allowing
  }

  private getDefaultModelForProvider(provider: string): string {
    const defaults: Record<string, string> = {
      'minimax': 'MiniMax-M2.7',
      'kimi': 'kimi-k2.5',
      'openrouter': 'qwen3.6-plus',
      'lmstudio': 'qwen3.5-9b',
      'openai': 'gpt-4o',
      'anthropic': 'claude-3-5-sonnet'
    };
    return defaults[provider] || 'MiniMax-M2.7';
  }

  private async storeSession(sessionId: string, data: any): Promise<void> {
    // Store in session manager or database
    try {
      const { writeFileSync, mkdirSync, existsSync } = require('fs');
      const { join } = require('path');
      const { homedir } = require('os');
      
      const sessionDir = join(homedir(), '.duck-cli', 'model-sessions');
      if (!existsSync(sessionDir)) {
        mkdirSync(sessionDir, { recursive: true });
      }
      
      const sessionFile = join(sessionDir, `${sessionId}.json`);
      writeFileSync(sessionFile, JSON.stringify(data, null, 2));
    } catch (e) {
      console.warn('[ModelRouter] Failed to store session:', e);
    }
  }

  /**
   * Get all available models with their capabilities
   */
  getAvailableModels(): Array<{provider: string; model: string; capabilities: string[]}> {
    return [
      { provider: 'minimax', model: 'MiniMax-M2.7', capabilities: ['chat', 'tools', 'reasoning'] },
      { provider: 'minimax', model: 'glm-5', capabilities: ['chat', 'tools', 'coding'] },
      { provider: 'minimax', model: 'qwen3.5-plus', capabilities: ['chat', 'tools', 'fast'] },
      { provider: 'kimi', model: 'kimi-k2.5', capabilities: ['chat', 'tools', 'vision', 'coding'] },
      { provider: 'lmstudio', model: 'qwen3.5-9b', capabilities: ['chat', 'tools', 'vision', 'local'] },
      { provider: 'lmstudio', model: 'gemma-4-e4b-it', capabilities: ['chat', 'tools', 'android', 'local'] },
      { provider: 'openrouter', model: 'qwen3.6-plus', capabilities: ['chat', 'tools', 'free'] }
    ];
  }
}

export default ChatAgentModelRouter;
