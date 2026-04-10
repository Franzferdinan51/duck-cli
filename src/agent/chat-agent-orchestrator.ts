// @ts-nocheck
/**
 * Chat Agent Orchestrator Integration
 * Ensures chat agent properly uses MetaAgent and Hybrid Orchestrator
 */

import { getOrCreateSession } from './chat-session.js';
import { spawn } from 'child_process';
import { join } from 'path';
import { existsSync } from 'fs';

// RAM-aware model selection for security tasks
interface RAMStatus {
  totalMB: number;
  freeMB: number;
  usedPercent: number;
}

async function getRAMStatus(): Promise<RAMStatus> {
  try {
    // macOS RAM check
    const { execSync } = require('child_process');
    const vmStat = execSync('vm_stat', { encoding: 'utf-8' });
    const pageSize = 4096; // Default page size on macOS
    
    let freePages = 0;
    let inactivePages = 0;
    
    for (const line of vmStat.split('\n')) {
      if (line.includes('Pages free:')) {
        freePages = parseInt(line.match(/\d+/)?.[0] || '0');
      }
      if (line.includes('Pages inactive:')) {
        inactivePages = parseInt(line.match(/\d+/)?.[0] || '0');
      }
    }
    
    const freeMB = Math.floor((freePages + inactivePages) * pageSize / 1024 / 1024);
    
    // Get total RAM
    const systemInfo = execSync('sysctl hw.memsize', { encoding: 'utf-8' });
    const totalBytes = parseInt(systemInfo.match(/\d+/)?.[0] || '0');
    const totalMB = Math.floor(totalBytes / 1024 / 1024);
    
    const usedPercent = Math.floor(((totalMB - freeMB) / totalMB) * 100);
    
    return { totalMB, freeMB, usedPercent };
  } catch (e) {
    // Fallback - assume low RAM to trigger API fallback
    return { totalMB: 8192, freeMB: 1024, usedPercent: 87 };
  }
}

/**
 * Select the best model for security tasks based on RAM availability
 */
export async function selectSecurityModel(preferLocal: boolean = true): Promise<{
  provider: string;
  model: string;
  reason: string;
}> {
  const ram = await getRAMStatus();
  
  // If RAM is tight (< 2GB free or > 85% used), use API
  if (ram.freeMB < 2048 || ram.usedPercent > 85) {
    return {
      provider: 'minimax',
      model: 'MiniMax-M2.7',
      reason: `RAM usage high (${ram.usedPercent}%, ${ram.freeMB}MB free) - using API model`
    };
  }
  
  // Use local security model if RAM is available
  if (preferLocal) {
    return {
      provider: 'lmstudio',
      model: 'foundation-sec-8b-reasoning',
      reason: `RAM available (${ram.freeMB}MB free) - using local security model`
    };
  }
  
  return {
    provider: 'minimax',
    model: 'MiniMax-M2.7',
    reason: 'API fallback requested'
  };
}

/**
 * Route task to MetaAgent with proper orchestration
 */
export async function routeToMetaAgent(
  task: string,
  sessionId: string,
  options: {
    enableTrace?: boolean;
    enableLearning?: boolean;
    dryRun?: boolean;
  } = {}
): Promise<{
  success: boolean;
  result: string;
  steps: number;
  timeMs: number;
}> {
  const duckBin = findDuckBinary();
  if (!duckBin) {
    return {
      success: false,
      result: 'Duck CLI binary not found',
      steps: 0,
      timeMs: 0
    };
  }

  const startTime = Date.now();
  
  return new Promise((resolve) => {
    const args = ['meta', 'run', task];
    
    if (options.dryRun) args.push('--dry-run');
    if (!options.enableTrace) args.push('--no-trace');
    if (!options.enableLearning) args.push('--no-learn');
    
    console.log(`[Orchestrator] Spawning MetaAgent: ${task.substring(0, 60)}...`);
    
    const child = spawn(duckBin, args, {
      cwd: process.env.DUCK_SOURCE_DIR || process.cwd(),
      env: { 
        ...process.env, 
        DUCK_CHAT_SESSION_ID: sessionId,
        DUCK_META_TIMEOUT_MS: '300000'
      },
    });

    let stdout = '';
    let stderr = '';
    let finished = false;

    const finish = (success: boolean, result: string) => {
      if (finished) return;
      finished = true;
      const timeMs = Date.now() - startTime;
      
      // Extract step count from output
      const stepMatch = result.match(/Steps: (\d+) executed/);
      const steps = stepMatch ? parseInt(stepMatch[1]) : 0;
      
      resolve({ success, result, steps, timeMs });
    };

    child.stdout?.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    child.on('close', (code: number) => {
      const output = stdout || stderr;
      finish(code === 0, output);
    });

    child.on('error', (err: Error) => {
      finish(false, `MetaAgent error: ${err.message}`);
    });

    // Timeout after 5 minutes
    setTimeout(() => {
      child.kill('SIGTERM');
      setTimeout(() => {
        try { child.kill('SIGKILL'); } catch {}
      }, 3000);
      finish(false, stdout + '\n[MetaAgent timeout after 5 minutes]');
    }, 300000);
  });
}

/**
 * Enhanced task classification with orchestration routing
 */
export function classifyTaskForOrchestration(
  message: string,
  context: { messageCount: number; hasToolCalls: boolean }
): {
  complexity: number;
  useOrchestration: boolean;
  useCouncil: boolean;
  reason: string;
} {
  const lower = message.toLowerCase();
  
  // Security-related tasks
  const securityKeywords = [
    'security', 'audit', 'vulnerability', 'exploit', 'hack',
    'penetration test', 'pentest', 'scan', 'assess risk',
    'check for', 'malware', 'backdoor', 'breach'
  ];
  
  // Complex multi-step tasks
  const complexKeywords = [
    'build', 'create', 'implement', 'design', 'architect',
    'research', 'analyze deeply', 'compare multiple',
    'integrate', 'migrate', 'refactor', 'optimize',
    'setup', 'configure', 'deploy', 'orchestrate'
  ];
  
  // Simple queries
  const simpleKeywords = [
    'hi', 'hello', 'hey', 'thanks', 'what is', 'who is',
    'how do i', 'quick', 'simple', 'weather', 'time',
    'define', 'explain briefly'
  ];
  
  let complexity = 1;
  let reason = 'Simple query';
  
  // Check for security tasks
  const isSecurity = securityKeywords.some(kw => lower.includes(kw));
  
  // Check for complex tasks
  const isComplex = complexKeywords.some(kw => lower.includes(kw));
  
  // Check for simple tasks
  const isSimple = simpleKeywords.some(kw => lower.includes(kw));
  
  // Calculate complexity
  if (isSecurity) {
    complexity = 6;
    reason = 'Security-related task';
  } else if (isComplex) {
    complexity = 5;
    reason = 'Complex multi-step task';
  } else if (message.length > 500) {
    complexity = 4;
    reason = 'Long detailed request';
  } else if (context.hasToolCalls) {
    complexity = 3;
    reason = 'Following up on tool execution';
  } else if (!isSimple) {
    complexity = 2;
    reason = 'Standard query';
  }
  
  // Determine routing
  const useOrchestration = complexity >= 4;
  const useCouncil = complexity >= 3 && complexity < 6;
  
  return { complexity, useOrchestration, useCouncil, reason };
}

function findDuckBinary(): string | undefined {
  if (process.env.DUCK_SOURCE_DIR) {
    const inSource = join(process.env.DUCK_SOURCE_DIR, 'duck');
    if (existsSync(inSource)) return inSource;
  }
  
  const duckHome = process.env.HOME || '';
  const paths = [
    join(duckHome, '.openclaw', 'workspace', 'duck-cli-src', 'duck'),
    join(duckHome, '.local', 'bin', 'duck'),
    '/usr/local/bin/duck',
  ];
  
  for (const p of paths) {
    if (existsSync(p)) return p;
  }
  
  return undefined;
}

/**
 * Process message with full orchestration
 */
export async function processWithOrchestration(
  userId: string,
  message: string,
  options: {
    overrideProvider?: string;
    overrideModel?: string;
  } = {}
): Promise<{
  response: string;
  routed: 'direct' | 'meta' | 'council' | 'security';
  metadata: {
    complexity: number;
    reason: string;
    steps?: number;
    timeMs?: number;
  };
}> {
  const session = getOrCreateSession(userId);
  const context = {
    messageCount: session.size(),
    hasToolCalls: session.getMessages().some(m => 
      m.content.includes('[Tool') || m.content.includes('tool_call')
    )
  };
  
  // Classify the task
  const classification = classifyTaskForOrchestration(message, context);
  
  console.log(`[Orchestrator] Task classified: complexity=${classification.complexity}, ` +
    `orchestration=${classification.useOrchestration}, council=${classification.useCouncil}, ` +
    `reason="${classification.reason}"`);
  
  // Route to appropriate handler
  if (classification.useOrchestration) {
    // Use MetaAgent for complex tasks
    const result = await routeToMetaAgent(message, userId, {
      enableTrace: true,
      enableLearning: true
    });
    
    return {
      response: result.result,
      routed: 'meta',
      metadata: {
        complexity: classification.complexity,
        reason: classification.reason,
        steps: result.steps,
        timeMs: result.timeMs
      }
    };
  }
  
  // For security tasks, use security model
  if (classification.reason.includes('Security')) {
    const securityModel = await selectSecurityModel();
    return {
      response: `Security task detected. Using ${securityModel.provider}/${securityModel.model} (${securityModel.reason})`,
      routed: 'security',
      metadata: {
        complexity: classification.complexity,
        reason: classification.reason
      }
    };
  }
  
  // Return classification for direct handling
  return {
    response: '',
    routed: 'direct',
    metadata: {
      complexity: classification.complexity,
      reason: classification.reason
    }
  };
}
