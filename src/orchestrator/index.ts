/**
 * duck-cli v2 - Orchestrator Module
 * Exports all orchestrator components
 */

// Core Types
export {
  Tool,
  Task,
  TaskResult,
  ToolParams,
  ToolResult,
  ToolCapability,
  ToolConfig,
  FallbackConfig,
  RetryConfig,
  FallbackChain,
  AllToolsFailedError,
  ExecutionContext,
  FallbackTool,
  createBaseTool,
  createFallbackTool,
} from './tool.js';

// Tool Registry
export {
  ToolRegistry,
  RegistryConfig,
  MatchResult,
  CategoryStats,
  getRegistry,
  setRegistry,
  createRegistry,
} from './tool-registry.js';

// Fallback Manager
export {
  FallbackManager,
  FallbackStrategy,
  FallbackEvent,
  FallbackEventHandler,
  getFallbackManager,
  createFallbackManager,
} from './fallback-manager.js';

// Execution Engine
export {
  ExecutionEngine,
  ExecutionOptions,
  ExecutionProgress,
  ExecutionSummary,
  getExecutionEngine,
  createExecutionEngine,
} from './execution-engine.js';

// Task Router
export {
  TaskRouter,
  RouterConfig,
  RouteResult,
  RoutingRule,
  getRouter,
  createRouter,
} from './task-router.js';

// Orchestrator Core
export {
  OrchestratorCore,
  OrchestratorConfig,
  OrchestratorMetrics,
  OrchestratorPhase,
  OrchestratorEvent,
  OrchestratorEventType,
  OrchestratorEventHandler,
  PerceptionResult,
  ReasoningResult,
  getOrchestrator,
  createOrchestrator,
  createAndroidScreenshotTool,
  createLLMReasoningTool,
} from './core.js';

// Convenience re-exports
import { OrchestratorCore, createOrchestrator, getOrchestrator } from './core.js';
import { ToolRegistry, createRegistry } from './tool-registry.js';
import { ExecutionEngine, createExecutionEngine } from './execution-engine.js';
import { TaskRouter, createRouter } from './task-router.js';

/**
 * Quick setup - create a fully configured orchestrator with common tools
 */
export function createDuckCLIOrchestrator(): OrchestratorCore {
  const orchestrator = createOrchestrator({
    name: 'duck-cli',
    version: '2.0.0',
    defaultTimeout: 30000,
    maxConcurrentTasks: 5,
    enableMetrics: true,
  });

  return orchestrator;
}

/**
 * Demo orchestrator with example tools
 */
export async function createDemoOrchestrator(): Promise<OrchestratorCore> {
  const orchestrator = createDuckCLIOrchestrator();

  // Add Android screenshot tool with fallbacks
  orchestrator.registerToolWithFallbacks(
    'android_screenshot',
    'Capture screenshot from Android device',
    [
      {
        name: 'screenshot',
        description: 'Capture screen from Android device',
        keywords: ['screenshot', 'screen capture', 'android', 'capture'],
      },
    ],
    async () => ({
      success: true,
      data: { method: 'screencap', path: '/sdcard/screen.png' },
      toolName: 'android_screencap',
      executionTimeMs: 500,
    }),
    [
      {
        name: 'android_screenrecord',
        priority: 2,
        reason: 'screencap failed',
        handler: async () => ({
          success: true,
          data: { method: 'screenrecord', path: '/sdcard/screen.png' },
          toolName: 'android_screenrecord',
          executionTimeMs: 800,
        }),
      },
      {
        name: 'android_termux_camera',
        priority: 3,
        reason: 'screenrecord failed',
        handler: async () => ({
          success: true,
          data: { method: 'termux_camera', path: '/sdcard/screen.png' },
          toolName: 'android_termux_camera',
          executionTimeMs: 1200,
        }),
      },
    ],
    'android'
  );

  // Add LLM reasoning tool with provider fallbacks
  orchestrator.registerToolWithFallbacks(
    'llm_reasoning',
    'Complex reasoning using LLM with automatic provider fallback',
    [
      {
        name: 'reasoning',
        description: 'Complex reasoning and analysis',
        keywords: ['reason', 'think', 'analyze', 'reasoning', 'llm', 'ai'],
      },
      {
        name: 'gemma',
        description: 'Google Gemma model',
        keywords: ['gemma', 'google'],
      },
      {
        name: 'qwen',
        description: 'Alibaba Qwen model',
        keywords: ['qwen', 'alibaba'],
      },
    ],
    async () => ({
      success: true,
      data: { provider: 'lm_studio_gemma4', model: 'gemma-4-e4b-it' },
      toolName: 'llm_gemma4',
      executionTimeMs: 2000,
    }),
    [
      {
        name: 'llm_qwen',
        priority: 2,
        reason: 'Gemma 4 unavailable',
        handler: async () => ({
          success: true,
          data: { provider: 'lm_studio_qwen', model: 'qwen3.5-9b' },
          toolName: 'llm_qwen',
          executionTimeMs: 1500,
        }),
      },
      {
        name: 'llm_openai',
        priority: 3,
        reason: 'Qwen unavailable',
        handler: async () => ({
          success: true,
          data: { provider: 'openai', model: 'gpt-5.4' },
          toolName: 'llm_openai',
          executionTimeMs: 3000,
        }),
      },
    ],
    'llm'
  );

  // Add file read tool
  orchestrator.registerTool(
    'file_read',
    'Read file contents',
    [
      {
        name: 'read',
        description: 'Read file contents',
        keywords: ['read', 'file', 'open', 'load', 'contents'],
      },
    ],
    async (params) => ({
      success: true,
      data: { path: params.path, content: 'file contents...' },
      toolName: 'file_read',
      executionTimeMs: 100,
    }),
    'filesystem'
  );

  // Add shell command tool
  orchestrator.registerTool(
    'shell_exec',
    'Execute shell command',
    [
      {
        name: 'shell',
        description: 'Execute shell command',
        keywords: ['shell', 'command', 'exec', 'bash', 'run'],
      },
    ],
    async (params) => ({
      success: true,
      data: { command: params.command, output: 'command output' },
      toolName: 'shell_exec',
      executionTimeMs: 500,
    }),
    'system'
  );

  return orchestrator;
}

// ==================== Usage Examples ====================

/**
 * Example usage:
 *
 * ```typescript
 * import {
 *   createOrchestrator,
 *   createAndroidScreenshotTool,
 *   createLLMReasoningTool,
 *   Task,
 * } from './orchestrator';
 *
 * // Create orchestrator
 * const orchestrator = createOrchestrator();
 *
 * // Register example tools
 * createAndroidScreenshotTool(orchestrator);
 * createLLMReasoningTool(orchestrator);
 *
 * // Execute a task
 * const task: Task = {
 *   id: 'task_1',
 *   type: 'screenshot',
 *   description: 'Take screenshot of Android device',
 *   intent: 'capture screen from android tablet',
 *   params: { device: 'tablet' },
 * };
 *
 * const result = await orchestrator.execute(task);
 * console.log(result);
 *
 * // Output:
 * // {
 * //   taskId: 'task_1',
 * //   success: true,
 * //   result: { success: true, data: { method: 'screencap', ... }, ... },
 * //   fallbackAttempted: false,
 * //   toolsAttempted: ['android_screenshot'],
 * //   totalExecutionTimeMs: 523
 * // }
 *
 * // If primary tool fails:
 * // {
 * //   taskId: 'task_1',
 * //   success: true,
 * //   result: { success: true, data: { method: 'screenrecord', ... }, ... },
 * //   fallbackAttempted: true,
 * //   toolsAttempted: ['android_screenshot', 'android_screenrecord'],
 * //   totalExecutionTimeMs: 1340
 * // }
 * ```
 */

// Type exports for consumers
export type { ToolRegistry as Registry } from './tool-registry.js';
export type { ExecutionEngine as Engine } from './execution-engine.js';
export type { TaskRouter as Router } from './task-router.js';
