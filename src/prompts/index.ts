/**
 * 🦆 Duck Agent - System Prompts Module
 * Based on Claude Code system prompts
 */

// System prompts
export {
  MAIN_SYSTEM_PROMPT,
  SYSTEM_SECTION,
  DOING_TASKS_SECTION,
  ACTIONS_SECTION,
  AUTONOMOUS_WORK_PROMPT,
  BASH_TOOL_PROMPT,
  EDIT_TOOL_PROMPT,
  MEMORY_INSTRUCTION,
  AGENT_TOOL_PROMPT,
  compileSystemPrompt,
} from './kairos-system.js';
export type { SystemPromptOptions } from './kairos-system.js';

// Skills
export {
  SKILLIFY_PROMPT,
  SIMPLIFY_SKILL_PROMPT,
  STUCK_SKILL_PROMPT,
  REMEMBER_SKILL_PROMPT,
  UPDATE_CONFIG_SKILL_PROMPT,
  AGENT_CREATION_PROMPT,
  VERIFICATION_AGENT_PROMPT,
  EXPLORE_AGENT_PROMPT,
  SESSION_SEARCH_PROMPT,
  MEMORY_SELECTION_PROMPT,
  DEFAULT_SKILLS,
} from './skills.js';
export type { Skill } from './skills.js';

// Agent creation
export {
  AgentCreator,
  AGENT_TEMPLATES,
} from './agent-creator.js';
export type { AgentSpec, AgentTemplate } from './agent-creator.js';
