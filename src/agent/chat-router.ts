/**
 * Chat to Meta Agent Orchestrator Router
 * Enhanced routing from chat interface to AI Meta Agent Orchestrator
 * 
 * This module provides intelligent routing decisions that:
 * 1. Analyze task complexity using the Hybrid Orchestrator
 * 2. Route to Meta Agent for complex tasks (complexity >= 4)
 * 3. Route to AI Council for ethical/complex decisions
 * 4. Use fast path for simple queries
 * 5. Provide detailed metadata about routing decisions
 */

import { getHybridOrchestrator, HybridResult } from '../orchestrator/hybrid-core.js';
import { getClassifier, TaskAnalysis, TaskContext } from '../orchestrator/task-complexity.js';
import { getRouter } from '../orchestrator/model-router.js';
import { getCouncilBridge, CouncilRequest } from '../orchestrator/council-bridge.js';
import { routeToMetaAgent } from './chat-agent-orchestrator.js';

// Router configuration
interface RouterConfig {
  // Complexity thresholds
  fastPathThreshold: number;      // Complexity <= this uses fast path (default: 2)
  metaAgentThreshold: number;     // Complexity >= this uses Meta Agent (default: 4)
  councilThreshold: number;       // Complexity >= this considers AI Council (default: 6)
  
  // Feature flags
  enableFastPath: boolean;
  enableMetaAgent: boolean;
  enableCouncil: boolean;
  enableLearning: boolean;
  
  // Timeouts
  metaAgentTimeoutMs: number;
  councilTimeoutMs: number;
  
  // Provider preferences
  preferLocal: boolean;
  costSensitive: boolean;
}

// Routing result with full metadata
interface RoutingResult {
  success: boolean;
  response: string;
  routed: 'fast' | 'direct' | 'meta' | 'council' | 'council_rejected' | 'error';
  
  // Metadata
  metadata: {
    taskId: string;
    complexity: number;
    complexityReason: string;
    model: string;
    modelReason: string;
    executionTimeMs: number;
    
    // Council info (if engaged)
    councilVerdict?: 'approve' | 'reject' | 'conditional';
    councilReasoning?: string;
    councilConfidence?: number;
    
    // Meta Agent info (if used)
    metaSteps?: number;
    metaPlan?: any;
    
    // Fallback info
    fallbackUsed?: boolean;
    fallbackReason?: string;
  };
  
  // Error info (if failed)
  error?: string;
}

// Default configuration
const DEFAULT_CONFIG: RouterConfig = {
  fastPathThreshold: 2,
  metaAgentThreshold: 4,
  councilThreshold: 6,
  enableFastPath: true,
  enableMetaAgent: true,
  enableCouncil: true,
  enableLearning: true,
  metaAgentTimeoutMs: 300000,  // 5 minutes
  councilTimeoutMs: 120000,    // 2 minutes
  preferLocal: true,
  costSensitive: false,
};

/**
 * Enhanced Chat Router
 * Main entry point for routing chat messages to appropriate processing
 */
export class ChatRouter {
  private config: RouterConfig;
  private orchestrator: ReturnType<typeof getHybridOrchestrator>;
  private classifier: ReturnType<typeof getClassifier>;
  private modelRouter: ReturnType<typeof getRouter>;
  private councilBridge: ReturnType<typeof getCouncilBridge>;
  
  constructor(config: Partial<RouterConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.orchestrator = getHybridOrchestrator();
    this.classifier = getClassifier();
    this.modelRouter = getRouter();
    this.councilBridge = getCouncilBridge();
  }
  
  /**
   * Route a chat message to the appropriate handler
   * This is the main entry point for chat routing
   */
  async route(
    userId: string,
    message: string,
    context?: {
      sessionId?: string;
      messageCount?: number;
      hasToolCalls?: boolean;
      previousMessages?: string[];
    }
  ): Promise<RoutingResult> {
    const startTime = Date.now();
    const taskId = `chat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    
    try {
      // Step 1: Analyze task complexity
      const taskContext: TaskContext = {
        sessionId: context?.sessionId,
        userId,
        metadata: {
          messageCount: context?.messageCount,
          hasToolCalls: context?.hasToolCalls,
          previousMessages: context?.previousMessages,
        },
      };
      
      const analysis = this.classifier.analyze(message, taskContext);
      
      console.log(`[ChatRouter] Task analyzed: complexity=${analysis.complexity}, ` +
        `needsCouncil=${analysis.needsCouncil}, recommendedModel=${analysis.recommendedModel}`);
      
      // Step 2: Determine routing path
      const routingDecision = this.makeRoutingDecision(analysis);
      
      // Step 3: Execute based on routing decision
      switch (routingDecision.path) {
        case 'fast':
          return this.executeFastPath(userId, message, analysis, taskId, startTime);
          
        case 'direct':
          return this.executeDirect(userId, message, analysis, taskId, startTime);
          
        case 'meta':
          return this.executeMetaAgent(userId, message, analysis, taskId, startTime);
          
        case 'council':
          return this.executeWithCouncil(userId, message, analysis, taskId, startTime);
          
        default:
          throw new Error(`Unknown routing path: ${routingDecision.path}`);
      }
      
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error(`[ChatRouter] Routing error:`, err);
      
      return {
        success: false,
        response: `Routing error: ${err.message}`,
        routed: 'error',
        metadata: {
          taskId,
          complexity: 0,
          complexityReason: 'Error during analysis',
          model: 'none',
          modelReason: 'Error',
          executionTimeMs: Date.now() - startTime,
        },
        error: err.message,
      };
    }
  }
  
  /**
   * Make routing decision based on task analysis
   */
  private makeRoutingDecision(analysis: TaskAnalysis): {
    path: 'fast' | 'direct' | 'meta' | 'council';
    reason: string;
  } {
    // Check for AI Council requirement first (highest priority)
    if (this.config.enableCouncil && analysis.needsCouncil) {
      return { path: 'council', reason: 'Task requires council deliberation' };
    }
    
    // Check for Meta Agent threshold
    if (this.config.enableMetaAgent && analysis.complexity >= this.config.metaAgentThreshold) {
      return { path: 'meta', reason: `Complexity ${analysis.complexity} >= threshold ${this.config.metaAgentThreshold}` };
    }
    
    // Check for fast path
    if (this.config.enableFastPath && analysis.complexity <= this.config.fastPathThreshold) {
      return { path: 'fast', reason: `Complexity ${analysis.complexity} <= threshold ${this.config.fastPathThreshold}` };
    }
    
    // Default to direct
    return { path: 'direct', reason: `Complexity ${analysis.complexity} - standard processing` };
  }
  
  /**
   * Execute fast path (simple queries)
   */
  private async executeFastPath(
    userId: string,
    message: string,
    analysis: TaskAnalysis,
    taskId: string,
    startTime: number
  ): Promise<RoutingResult> {
    console.log(`[ChatRouter] Fast path for: ${message.substring(0, 50)}...`);
    
    // Use the hybrid orchestrator for fast execution
    const result = await this.orchestrator.execute(message, {
      sessionId: userId,
      userId,
      metadata: { fastPath: true },
    });
    
    return {
      success: result.success,
      response: typeof result.result?.data === 'object' && result.result?.data !== null 
        ? (result.result.data as any).message || 'Fast path completed'
        : 'Fast path completed',
      routed: 'fast',
      metadata: {
        taskId,
        complexity: analysis.complexity,
        complexityReason: analysis.reasoning,
        model: result.model,
        modelReason: result.modelReason,
        executionTimeMs: Date.now() - startTime,
        fallbackUsed: result.fallbackAttempted,
      },
    };
  }
  
  /**
   * Execute direct path (standard chat)
   */
  private async executeDirect(
    userId: string,
    message: string,
    analysis: TaskAnalysis,
    taskId: string,
    startTime: number
  ): Promise<RoutingResult> {
    console.log(`[ChatRouter] Direct path for: ${message.substring(0, 50)}...`);
    
    // Get model recommendation
    const routeResult = this.modelRouter.route(message, analysis);
    
    // Return routing info - actual chat completion happens in chat-agent.ts
    return {
      success: true,
      response: '',  // Empty response indicates direct handling
      routed: 'direct',
      metadata: {
        taskId,
        complexity: analysis.complexity,
        complexityReason: analysis.reasoning,
        model: routeResult.model,
        modelReason: routeResult.reason,
        executionTimeMs: Date.now() - startTime,
      },
    };
  }
  
  /**
   * Execute with Meta Agent (complex tasks)
   */
  private async executeMetaAgent(
    userId: string,
    message: string,
    analysis: TaskAnalysis,
    taskId: string,
    startTime: number
  ): Promise<RoutingResult> {
    console.log(`[ChatRouter] Meta Agent path for: ${message.substring(0, 50)}...`);
    
    // Use the existing routeToMetaAgent function
    const result = await routeToMetaAgent(message, userId, {
      enableTrace: true,
      enableLearning: this.config.enableLearning,
    });
    
    return {
      success: result.success,
      response: result.result,
      routed: 'meta',
      metadata: {
        taskId,
        complexity: analysis.complexity,
        complexityReason: analysis.reasoning,
        model: analysis.recommendedModel,
        modelReason: 'Meta Agent orchestration',
        executionTimeMs: result.timeMs,
        metaSteps: result.steps,
      },
    };
  }
  
  /**
   * Execute with AI Council (ethical/complex decisions)
   */
  private async executeWithCouncil(
    userId: string,
    message: string,
    analysis: TaskAnalysis,
    taskId: string,
    startTime: number
  ): Promise<RoutingResult> {
    console.log(`[ChatRouter] AI Council path for: ${message.substring(0, 50)}...`);
    
    // Build council request with required perspectives
    const councilRequest: CouncilRequest = {
      task: message,
      context: { userId, sessionId: userId },
      perspectives: ['speaker', 'technocrat', 'ethicist', 'pragmatist', 'skeptic', 'sentinel'],
      mode: analysis.urgency === 'critical' ? 'legislative' : 'deliberation',
      urgency: analysis.urgency,
    };
    
    // Engage council
    const councilResponse = await this.councilBridge.engage(councilRequest);
    
    // Handle council verdict
    if (councilResponse.verdict === 'reject') {
      return {
        success: false,
        response: `AI Council rejected this request: ${councilResponse.reasoning}`,
        routed: 'council_rejected',
        metadata: {
          taskId,
          complexity: analysis.complexity,
          complexityReason: analysis.reasoning,
          model: analysis.recommendedModel,
          modelReason: 'Council deliberation',
          executionTimeMs: Date.now() - startTime,
          councilVerdict: 'reject',
          councilReasoning: councilResponse.reasoning,
          councilConfidence: councilResponse.confidence,
        },
      };
    }
    
    // Council approved or conditional - proceed with Meta Agent
    const metaResult = await routeToMetaAgent(message, userId, {
      enableTrace: true,
      enableLearning: this.config.enableLearning,
    });
    
    return {
      success: metaResult.success,
      response: metaResult.result,
      routed: 'council',
      metadata: {
        taskId,
        complexity: analysis.complexity,
        complexityReason: analysis.reasoning,
        model: analysis.recommendedModel,
        modelReason: 'Council-approved Meta Agent',
        executionTimeMs: Date.now() - startTime,
        councilVerdict: councilResponse.verdict,
        councilReasoning: councilResponse.reasoning,
        councilConfidence: councilResponse.confidence,
        metaSteps: metaResult.steps,
      },
    };
  }
  
  /**
   * Get router status and metrics
   */
  getStatus(): {
    config: RouterConfig;
    orchestratorStatus: ReturnType<ReturnType<typeof getHybridOrchestrator>['getStatus']>;
  } {
    return {
      config: this.config,
      orchestratorStatus: this.orchestrator.getStatus(),
    };
  }
  
  /**
   * Update configuration
   */
  updateConfig(updates: Partial<RouterConfig>): void {
    this.config = { ...this.config, ...updates };
  }
}

// Singleton instance
let defaultRouter: ChatRouter | null = null;

export function getChatRouter(config?: Partial<RouterConfig>): ChatRouter {
  if (!defaultRouter) {
    defaultRouter = new ChatRouter(config);
  }
  return defaultRouter;
}

export function createChatRouter(config?: Partial<RouterConfig>): ChatRouter {
  return new ChatRouter(config);
}

/**
 * Convenience function for quick routing
 */
export async function routeChatMessage(
  userId: string,
  message: string,
  context?: Parameters<ChatRouter['route']>[2]
): Promise<RoutingResult> {
  return getChatRouter().route(userId, message, context);
}

// Export types
export type { RouterConfig, RoutingResult };
