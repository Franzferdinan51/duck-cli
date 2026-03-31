/**
 * 🦆 Duck Agent - KAIROS Module
 * Autonomous proactive AI system
 */

// Orchestrator
export { 
  KAIROS, 
  KAIROSHeartbeat,
  getKAIROS,
  startKAIROS,
  stopKAIROS,
} from './orchestrator.js';
export type { 
  KAIROSTick,
  KAIROSConfig,
  KAIROSEvent,
  KAIROSAction,
  KAIROSDream,
  HeartbeatState,
} from './orchestrator.js';

// Context & Memory
export { 
  MemorySystem,
  SessionManager,
  buildContext,
  getGitContext,
} from './context.js';
export type { 
  MemoryFile,
  ContextOptions,
  Context,
  Session,
} from './context.js';

// Thinking
export { 
  ThinkingModule,
  fastThink,
  ReasoningChain,
} from './thinking.js';
export type { 
  ThinkingOptions,
  Thought,
  ThinkingResult,
  ReasoningStep,
} from './thinking.js';

// Tools
export { 
  ToolRegistry,
  BUILTIN_TOOLS,
  matchTool,
  getToolRegistry,
} from './tools.js';
export type { 
  ToolDefinition,
  ToolUse,
  ToolResult,
} from './tools.js';
