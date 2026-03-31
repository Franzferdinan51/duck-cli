/**
 * 🦆 Duck Agent - Model Router
 * Route tasks to appropriate models based on complexity
 */

// Model routing strategy
export const MODEL_ROUTING = {
  // Complex reasoning tasks -> MiniMax M2.7
  complex: 'MiniMax-M2.7',
  // Fast tasks -> local
  fast: 'jan-v3-4b-base-instruct',
  // Vision -> Kimi
  vision: 'kimi-k2.5',
  // Coding -> glm-5
  coding: 'glm-5',
  // Default fallback
  default: 'MiniMax-M2.7',
};

// Task complexity indicators
const COMPLEX_INDICATORS = [
  'analyze', 'debate', 'compare', 'evaluate', 'reason',
  'explain why', 'architect', 'design', 'complex', 'difficult',
];

const SIMPLE_INDICATORS = [
  'what is', 'who is', 'quick', 'simple', 'list',
  'summarize', 'find', 'search', 'lookup',
];

const VISION_INDICATORS = [
  'image', 'photo', 'picture', 'screenshot', 'visual',
  'analyze this', 'what is in', 'describe',
];

const CODING_INDICATORS = [
  'code', 'function', 'class', 'implement', 'bug',
  'refactor', 'optimize', 'test', 'debug',
];

/**
 * Route a task to the appropriate model based on content analysis
 */
export function routeModelForTask(taskDescription: string): string {
  const lower = taskDescription.toLowerCase();
  
  // Vision tasks -> Kimi
  if (VISION_INDICATORS.some(ind => lower.includes(ind))) {
    return MODEL_ROUTING.vision;
  }
  
  // Coding tasks -> glm-5
  if (CODING_INDICATORS.some(ind => lower.includes(ind))) {
    return MODEL_ROUTING.coding;
  }
  
  // Complex tasks -> MiniMax M2.7
  if (COMPLEX_INDICATORS.some(ind => lower.includes(ind))) {
    return MODEL_ROUTING.complex;
  }
  
  // Simple tasks -> local/fast
  if (SIMPLE_INDICATORS.some(ind => lower.includes(ind))) {
    return MODEL_ROUTING.fast;
  }
  
  return MODEL_ROUTING.default;
}

/**
 * Get model for a specific councilor role
 */
export function getModelForCouncilor(role: string): string {
  switch (role) {
    case 'speaker':
    case 'moderator':
      return MODEL_ROUTING.complex;
    case 'technocrat':
    case 'scientist':
    case 'sentinel':
      return MODEL_ROUTING.complex;
    case 'journalist':
    case 'historian':
    case 'ethicist':
      return MODEL_ROUTING.complex;
    case 'pragmatist':
    case 'skeptic':
    case 'visionary':
      return MODEL_ROUTING.default;
    case 'specialist':
      return MODEL_ROUTING.coding;
    default:
      return MODEL_ROUTING.default;
  }
}

/**
 * Get priority for a task type
 */
export function getTaskPriority(taskType: string): number {
  switch (taskType) {
    case 'critical':
      return 1;
    case 'high':
      return 2;
    case 'medium':
      return 3;
    case 'low':
      return 4;
    default:
      return 3;
  }
}

export default { routeModelForTask, getModelForCouncilor, getTaskPriority };
