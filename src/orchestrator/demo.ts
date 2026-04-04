/**
 * duck-cli v2 - Demo Usage
 * Shows how to use the orchestrator with tools and fallbacks
 */

import {
  createOrchestrator,
  createAndroidScreenshotTool,
  createLLMReasoningTool,
  Task,
  ToolResult,
  getOrchestrator,
} from './index.js';

async function main() {
  console.log('🦆 duck-cli v2 Orchestrator Demo\n');
  console.log('='.repeat(50));

  // Create orchestrator
  const orchestrator = createOrchestrator({
    name: 'duck-cli',
    version: '2.0.0',
  });

  // Register example tools
  createAndroidScreenshotTool(orchestrator);
  createLLMReasoningTool(orchestrator);

  console.log('\n📋 Registered tools:', orchestrator.listTools());
  console.log('📊 Registry info:', orchestrator.getRegistryInfo());

  // Example 1: Android Screenshot Task
  console.log('\n' + '='.repeat(50));
  console.log('📸 EXAMPLE 1: Android Screenshot Task\n');

  const screenshotTask: Task = {
    id: 'task_screenshot_001',
    type: 'screenshot',
    description: 'Capture screen from Android device',
    intent: 'take a screenshot of the android tablet',
    params: { device: 'tablet' },
  };

  const screenshotResult = await orchestrator.execute(screenshotTask);
  console.log('Result:', JSON.stringify(screenshotResult, null, 2));

  // Example 2: LLM Reasoning Task
  console.log('\n' + '='.repeat(50));
  console.log('🧠 EXAMPLE 2: LLM Reasoning Task\n');

  const reasoningTask: Task = {
    id: 'task_reasoning_001',
    type: 'reasoning',
    description: 'Complex reasoning using LLM',
    intent: 'analyze this problem and provide reasoning',
    params: { prompt: 'What is the meaning of life?' },
  };

  const reasoningResult = await orchestrator.execute(reasoningTask);
  console.log('Result:', JSON.stringify(reasoningResult, null, 2));

  // Example 3: File Read Task
  console.log('\n' + '='.repeat(50));
  console.log('📄 EXAMPLE 3: File Read Task\n');

  orchestrator.registerTool(
    'file_read',
    'Read file contents',
    [
      {
        name: 'read',
        description: 'Read file from filesystem',
        keywords: ['read', 'file', 'contents', 'load'],
      },
    ],
    async (params) => ({
      success: true,
      data: { path: params.path, content: 'Hello from duck-cli!' },
      toolName: 'file_read',
      executionTimeMs: 50,
    }),
    'filesystem'
  );

  const readTask: Task = {
    id: 'task_read_001',
    type: 'read',
    description: 'Read a file',
    intent: 'read the contents of config.json',
    params: { path: 'config.json' },
  };

  const readResult = await orchestrator.execute(readTask);
  console.log('Result:', JSON.stringify(readResult, null, 2));

  // Show metrics
  console.log('\n' + '='.repeat(50));
  console.log('📈 Orchestrator Metrics\n');
  console.log(JSON.stringify(orchestrator.getMetrics(), null, 2));

  // Show router stats
  console.log('\n📊 Router Stats\n');
  console.log(JSON.stringify(orchestrator.getRouterStats(), null, 2));

  console.log('\n' + '='.repeat(50));
  console.log('✅ Demo complete!\n');
}

main().catch(console.error);
