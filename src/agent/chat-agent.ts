// @ts-nocheck
/**
 * duck-cli v3 - Chat Agent
 * Multi-provider conversational AI agent with AI Council deliberation.
 * 
 * Supports: MiniMax, LM Studio, Kimi, OpenAI (ChatGPT), OpenRouter
 * 
 * Usage:
 *   DUCK_CHAT_PROVIDER=minimax DUCK_CHAT_MODEL=MiniMax-M2.7 ./duck chat-agent start
 *   DUCK_CHAT_PROVIDER=lmstudio DUCK_CHAT_MODEL=qwen3.5-0.8b ./duck chat-agent start
 *   DUCK_CHAT_PROVIDER=kimi DUCK_CHAT_MODEL=k2p5 ./duck chat-agent start
 *   DUCK_CHAT_PROVIDER=openai DUCK_CHAT_MODEL=gpt-5.4 ./duck chat-agent start
 *   DUCK_CHAT_PROVIDER=openrouter DUCK_CHAT_MODEL=qwen/qwen3.6-plus-preview:free ./duck chat-agent start
 */

import http from 'http';
import { Url } from 'url';
import { ChatSession, getOrCreateSession } from './chat-session.js';
import { processWithCouncil } from '../council/chat-bridge.js';
import { logger } from '../server/logger.js';

// ---------------------------------------------------------------------------
// Config - Multi-provider setup
// ---------------------------------------------------------------------------
const PORT = parseInt(process.env.DUCK_CHAT_PORT || '18797');

// ---------------------------------------------------------------------------
// Agent Mesh Integration (optional)
// ---------------------------------------------------------------------------
const MESH_ENABLED = process.env.MESH_ENABLED === 'true';
const MESH_API_URL = process.env.MESH_API_URL || 'http://localhost:4000';
const MESH_API_KEY = process.env.MESH_API_KEY || 'openclaw-mesh-default-key';
const AGENT_ID = 'ChatAgent';

let meshRegistered = false;
let registeredAgentId: string | null = null;
let meshWs: any = null; // WebSocket for receiving mesh messages

// Whisper routing: optional external webhook for high-confidence whispers
const WHISPER_CALLBACK_URL = process.env.WHISPER_CALLBACK_URL; // e.g. OpenClaw gateway URL

/**
 * Check if mesh is available (port 4000 open)
 */
async function checkMeshAvailable(): Promise<boolean> {
  if (!MESH_ENABLED) return false;
  try {
    const resp = await fetch(`${MESH_API_URL}/health`, { 
      method: 'GET',
      signal: AbortSignal.timeout(2000)
    });
    return resp.ok;
  } catch {
    return false;
  }
}

/**
 * Register this agent with the mesh (optional - won't fail if mesh unavailable)
 */
async function registerWithMesh(): Promise<void> {
  if (!MESH_ENABLED) return;
  
  const available = await checkMeshAvailable();
  if (!available) {
    console.log('[Mesh] Server not available, skipping registration');
    return;
  }

  try {
    const resp = await fetch(`${MESH_API_URL}/api/agents/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': MESH_API_KEY,
      },
      body: JSON.stringify({
        name: AGENT_ID,
        endpoint: `http://localhost:${PORT}`,
        capabilities: ['chat', 'messaging', 'conversation'],
      }),
    });
    
    if (!resp.ok) {
      console.log(`[Mesh] Registration failed: ${resp.status}`);
      return;
    }

    const data = await resp.json();
    if (data.success) {
      meshRegistered = true;
      registeredAgentId = data.agentId;
      console.log(`[Mesh] Registered as ${data.agentId}`);
      // Now connect WebSocket to receive messages (true 2-way mesh)
      connectMeshWebSocket();
    }
  } catch (err) {
    console.log(`[Mesh] Registration error: ${err.message}`);
  }
}

/**
 * Broadcast message to mesh (optional - won't fail if mesh unavailable)
 */
async function broadcastToMesh(type: string, content: any): Promise<void> {
  if (!meshRegistered) return;

  try {
    await fetch(`${MESH_API_URL}/api/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': MESH_API_KEY,
      },
      body: JSON.stringify({
        type: 'broadcast',
        fromAgentId: registeredAgentId || AGENT_ID,
        content: { event: type, ...content },
      }),
    });
  } catch (err) {
    console.log(`[Mesh] Broadcast error: ${err.message}`);
  }
}

/**
 * Send whisper alert to user via mesh
 */
async function sendWhisperAlert(alert: { type: string; message: string; confidence: number }): Promise<void> {
  if (!meshRegistered) return;

  try {
    await fetch(`${MESH_API_URL}/api/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': MESH_API_KEY,
      },
      body: JSON.stringify({
        type: 'whisper',
        fromAgentId: 'Subconscious',
        toAgentId: registeredAgentId || AGENT_ID,
        content: alert,
      }),
    });
  } catch (err) {
    console.log(`[Mesh] Whisper send error: ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// Mesh WebSocket Consumer — TRUE 2-WAY MESH
// Enables duck-cli to RECEIVE messages from mesh (not just broadcast).
// This completes the bidirectional channel after HTTP registration.
// ---------------------------------------------------------------------------

/**
 * Connect WebSocket to agent-mesh-api for real-time message consumption.
 * Call AFTER successful HTTP registration (registerWithMesh).
 *
 * This makes the chat-agent truly 2-way:
 * - OUTBOUND: broadcasts, whisper alerts (existing)
 * - INBOUND: incoming whispers, task delegations, system broadcasts (new)
 */
async function connectMeshWebSocket(): Promise<void> {
  if (!meshRegistered || !registeredAgentId) {
    console.log('[MeshWS] Not registered yet — skipping WebSocket connect');
    return;
  }

  // Avoid duplicate connections
  if (meshWs && meshWs.readyState === 1 /* OPEN */) {
    return;
  }

  try {
    const wsUrl = MESH_API_URL.replace('http', 'ws') + '/ws';
    meshWs = new (require('ws'))(wsUrl + `?agentId=${registeredAgentId}`);

    meshWs.on('open', () => {
      console.log(`[MeshWS] ✅ Connected to mesh WebSocket`);
    });

    meshWs.on('message', (data: any) => {
      try {
        const msg = JSON.parse(data.toString());
        handleMeshMessage(msg);
      } catch (e) {
        console.log('[MeshWS] Failed to parse message:', e);
      }
    });

    meshWs.on('close', () => {
      console.log(`[MeshWS] ⚠️ WebSocket closed — will reconnect on next registration`);
      meshWs = null;
    });

    meshWs.on('error', (err: any) => {
      console.log(`[MeshWS] Error: ${err?.message || err}`);
    });

    console.log(`[MeshWS] Connecting to ${wsUrl}?agentId=${registeredAgentId}...`);
  } catch (err) {
    console.log(`[MeshWS] WebSocket not available (ws module may not be installed): ${err instanceof Error ? err.message : err}`);
  }
}

/**
 * Handle incoming mesh messages — routes by message type.
 *
 * INTERNAL messages (stay within duck-cli):
 * - broadcast (system events) → log only
 * - agent_joined / agent_left → log only
 *
 * EXTERNAL messages (route to user/OpenClaw):
 * - whisper (high-confidence, confidence >= 0.7) → route to user
 * - task-delegate → route to processMessage
 *
 * This separation keeps Telegram/public replies separate from
 * internal bridge/meta/council traffic.
 */
function handleMeshMessage(msg: {
  type?: string;
  fromAgentId?: string;
  content?: any;
  event?: string;
}): void {
  const type = msg.type || msg.event;
  const content = msg.content || msg;

  switch (type) {
    case 'whisper': {
      // Whisper from Subconscious — route to user if high confidence
      const whisper = content?.alert || content;
      const confidence = whisper?.confidence ?? 0;
      if (confidence >= 0.7) {
        console.log(`[MeshWS] High-confidence whisper (${confidence}): ${whisper?.message}`);
        routeWhisperToUser(whisper);
      } else {
        console.log(`[MeshWS] Low-confidence whisper (${confidence}): ${whisper?.message}`);
      }
      break;
    }

    case 'task-delegate': {
      // Task delegation from another agent — process it
      const task = content?.task || content;
      const fromAgent = msg.fromAgentId || 'unknown';
      console.log(`[MeshWS] Task delegate from ${fromAgent}: ${task?.substring(0, 80)}...`);
      // Process as a new message (high complexity, go through full flow)
      processMessage(`mesh-delegate-${fromAgent}`, task, undefined, undefined)
        .then(result => {
          console.log(`[MeshWS] Delegate task completed`);
        })
        .catch(err => {
          console.error(`[MeshWS] Delegate task failed: ${err.message}`);
        });
      break;
    }

    case 'message_received': {
      // Direct message from another agent — log it
      const fromAgent = msg.fromAgentId || 'unknown';
      console.log(`[MeshWS] Message from ${fromAgent}: ${JSON.stringify(content)?.substring(0, 100)}`);
      break;
    }

    case 'agent_joined':
    case 'agent_left':
    case 'agent_updated': {
      // System events — log for visibility, don't bother user
      console.log(`[MeshWS] 🤝 ${type}: ${content?.name || msg.fromAgentId}`);
      break;
    }

    case 'broadcast': {
      // System broadcast — log for visibility
      const fromAgent = msg.fromAgentId || 'system';
      console.log(`[MeshWS] 📢 Broadcast from ${fromAgent}: ${JSON.stringify(content)?.substring(0, 100)}`);
      break;
    }

    case 'health':
    case 'catastrophe': {
      // Health/catastrophe from mesh — forward to OpenClaw if configured
      if (WHISPER_CALLBACK_URL) {
        forwardToCallback(WHISPER_CALLBACK_URL, { type, content }).catch(() => {});
      }
      break;
    }

    default:
      // Unknown message type — log but don't crash
      console.log(`[MeshWS] Unknown message type "${type}": ${JSON.stringify(msg)?.substring(0, 100)}`);
  }
}

/**
 * Route high-confidence whisper to user.
 * Sends to WHISPER_CALLBACK_URL if configured (e.g. OpenClaw gateway).
 * Falls back to broadcasting to mesh so other agents can handle it.
 */
async function routeWhisperToUser(whisper: { type: string; message: string; confidence: number }): Promise<void> {
  const payload = {
    source: 'whisper',
    whisper,
    // Mark as internal meta/council traffic (not a direct user message)
    _internal: true,
  };

  if (WHISPER_CALLBACK_URL) {
    try {
      await forwardToCallback(WHISPER_CALLBACK_URL, payload);
      console.log(`[MeshWS] Whisper forwarded to callback: ${WHISPER_CALLBACK_URL}`);
      return;
    } catch (err) {
      console.log(`[MeshWS] Whisper callback failed: ${err instanceof Error ? err.message : err}`);
    }
  }

  // Fallback: broadcast to mesh so other agents can handle
  await broadcastToMesh('whisper-to-user', payload);
}

/**
 * Forward data to an external HTTP callback.
 * Used for routing whispers and alerts to OpenClaw.
 */
async function forwardToCallback(url: string, data: any): Promise<void> {
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Routing': 'duck-cli/whisper',
    },
    body: JSON.stringify(data),
  });
  if (!resp.ok) {
    throw new Error(`Callback ${resp.status}: ${await resp.text()}`);
  }
}

// Provider config - loaded from environment
const PROVIDER = process.env.DUCK_CHAT_PROVIDER || 'minimax';
const MODEL = process.env.DUCK_CHAT_MODEL || getDefaultModel(PROVIDER);
// Try to load SOUL.md for richer system prompt
function loadSoulPrompt(): string {
  try {
    const { readFileSync, existsSync } = require('fs');
    const soulPath = __dirname + '/../SOUL.md';
    if (existsSync(soulPath)) {
      return readFileSync(soulPath, 'utf-8').trim();
    }
  } catch {
    // Fall back to embedded prompt
  }
  return null;
}
const soulFromFile = loadSoulPrompt();
const SYSTEM_PROMPT = process.env.DUCK_CHAT_SYSTEM_PROMPT || soulFromFile || `You are Duck Agent - an autonomous desktop AI assistant built by Duckets on a Mac mini.

## Who You Are
- Name: Duck Agent (or "duck")
- Type: Desktop AI agent — rivals Claude Code, Letta Code, OpenAI Codex
- Personality: Casual, direct, technical but friendly. Use emojis naturally.
- NOT formal or corporate.

## Your Capabilities
- Autonomous execution: You PLAN, EXECUTE, and LEARN — not just chat
- 102 built-in tools: file ops, shell, web search, Android control, cron, subagents
- Multi-provider AI: MiniMax (fast), LM Studio (local free), Kimi kimi-k2p5 (vision), OpenRouter (free)
- Memory and learning: Subconscious whisper engine runs alongside, catching patterns
- AI Council: For complex/ethical decisions, deliberation with ~35 specialized councilors
- ACP/MCP Bridge: Exposes your capabilities via ACP/MCP/WebSocket to other agents

## How You Work
- Simple tasks: Answer directly
- Moderate tasks: Use best model, optional AI Council
- Complex tasks: Full MetaAgent orchestrator (Plan→Critic→Healer→Learner loop)
- Pattern matching: Subconscious catches whispers, routes high-confidence alerts to AI Council

## Key Commands
- duck run "task" — Run a task with smart provider routing
- duck council "question" — Deliberate with AI Council
- duck status — Show system status
- duck mesh — Agent mesh networking
- duck android — Control Android devices
- duck subconscious — Whisper engine controls
- duck kairos — Autonomous proactive mode

## Backend
- Providers: MiniMax (quota), LM Studio (local free), Kimi (vision), OpenRouter (free)
- ACP/MCP Bridge: ACP/MCP/WebSocket protocol access layer for external tools and agents
- Mesh: agent-mesh-api (port 4000) — coordination bus for multi-agent systems
- Subconscious: Background pattern matcher with confidence scoring

When tasks are complex, high-stakes, or ethically nuanced — delegate to the MetaAgent orchestrator or AI Council. For everything else, answer directly and confidently.`
const MAX_CONTEXT_TOKENS = parseInt(process.env.DUCK_CHAT_MAX_CONTEXT || '16000');

// ---------------------------------------------------------------------------
// Default models per provider
// ---------------------------------------------------------------------------
function getDefaultModel(provider: string): string {
  const defaults: Record<string, string> = {
    minimax: 'MiniMax-M2.7',
    lmstudio: 'qwen3.5-0.8b',
    kimi: 'k2p5',
    openai: 'gpt-5.4',
    openrouter: 'qwen/qwen3.6-plus-preview:free',
  };
  return defaults[provider] || 'MiniMax-M2.7';
}

// ---------------------------------------------------------------------------
// Provider API Keys - loaded from environment
// ---------------------------------------------------------------------------
function getApiKey(provider: string): string {
  const keys: Record<string, string | undefined> = {
    minimax: process.env.MINIMAX_API_KEY,
    lmstudio: process.env.LMSTUDIO_API_KEY || 'local', // local = no API key needed
    kimi: process.env.KIMI_API_KEY || process.env.MOONSHOT_API_KEY,
    openai: process.env.OPENAI_API_KEY,
    openai_oauth: process.env.OPENAI_CLIENT_ID ? 'oauth' : undefined,
    openrouter: process.env.OPENROUTER_API_KEY,
  };
  return keys[provider] || keys[PROVIDER] || '';
}

function getBaseUrl(provider: string): string {
  const urls: Record<string, string> = {
    minimax: 'https://api.minimax.io/v1',
    lmstudio: process.env.LMSTUDIO_BASE_URL || 'http://127.0.0.1:1234/v1',
    kimi: 'https://api.moonshot.cn/v1',
    openai: 'https://api.openai.com/v1',
    openrouter: 'https://openrouter.ai/api/v1',
  };
  return urls[provider] || urls.minimax;
}

// ---------------------------------------------------------------------------
// Unified chat completion interface
// ---------------------------------------------------------------------------
interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface ChatResponse {
  content: string;
  provider: string;
  model: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

async function chatComplete(
  provider: string,
  model: string,
  messages: ChatMessage[],
  apiKey: string,
  baseUrl?: string
): Promise<ChatResponse> {
  const url = (baseUrl || getBaseUrl(provider)) + '/chat/completions';
  
  // Build request based on provider
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Auth header varies by provider
  if (provider === 'openai_oauth') {
    // OAuth flow - would need token exchange
    throw new Error('OAuth not yet implemented for Chat Agent');
  } else if (provider === 'lmstudio') {
    // LM Studio local - may not need auth or uses Bearer
    if (apiKey && apiKey !== 'local') {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }
  } else if (provider === 'openrouter') {
    headers['Authorization'] = `Bearer ${apiKey}`;
    // OpenRouter requires app-specific header
    headers['HTTP-Referer'] = 'https://duck-cli.github';
    headers['X-Title'] = 'Duck CLI Chat Agent';
  } else {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  // Model name varies by provider
  let modelName = model;
  if (provider === 'minimax') {
    modelName = model; // 'MiniMax-M2.7' etc
  } else if (provider === 'kimi') {
    modelName = model; // 'k2p5' etc
  } else if (provider === 'openai') {
    modelName = model; // 'gpt-5.4' etc
  } else if (provider === 'openrouter') {
    modelName = model; // 'qwen/qwen3.6-plus-preview:free' etc
  } else if (provider === 'lmstudio') {
    modelName = model; // 'qwen3.5-0.8b' etc
  }

  const body: any = {
    model: modelName,
    messages: messages.filter(m => m.content), // skip empty
    stream: false,
  };

  // Provider-specific options
  if (provider === 'openai' || provider === 'openrouter') {
    body.max_tokens = 4096;
    body.temperature = 0.7;
  } else if (provider === 'minimax') {
    body.max_tokens = 4096;
    body.temperature = 0.7;
  }

  const resp = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`${provider} API error ${resp.status}: ${text}`);
  }

  const data = await resp.json();
  
  // Parse response - format varies by provider
  let content = '';
  if (data.choices?.[0]?.message?.content) {
    // Standard format
    content = data.choices[0].message.content;
  } else if (data.choices?.[0]?.text) {
    // Some providers use text field
    content = data.choices[0].text;
  } else if (typeof data.choices?.[0] === 'string') {
    content = data.choices[0];
  } else {
    throw new Error(`Unexpected response format from ${provider}`);
  }

  return {
    content: content.trim(),
    provider,
    model,
    usage: data.usage,
  };
}

// ---------------------------------------------------------------------------
// Task complexity scoring (0-10)
// ---------------------------------------------------------------------------
function scoreComplexity(message: string): number {
  const lower = message.toLowerCase();
  let score = 1;

  const complexKeywords = [
    'build', 'create', 'implement', 'design', 'architect',
    'research', 'analyze', 'compare', 'evaluate', 'investigate',
    'multiple', 'several', 'complex', 'difficult',
    'database', 'api', 'server', 'deployment', 'infrastructure',
    'debug', 'refactor', 'migrate', 'integrate',
    'planning', 'strategy', 'decision',
  ];
  const simpleKeywords = [
    'hi', 'hello', 'hey', 'thanks', 'thank you',
    'what is', 'who is', 'how do i', 'quick', 'simple',
    'weather', 'time', 'date', 'remind', 'joke',
    'define', 'explain', 'tell me about',
  ];

  for (const kw of complexKeywords) {
    if (lower.includes(kw)) score += 1;
  }
  for (const kw of simpleKeywords) {
    if (lower.includes(kw)) score -= 0.5;
  }

  if (message.length > 500) score += 1;
  if (message.length > 2000) score += 2;

  return Math.max(1, Math.min(10, Math.round(score)));
}

// ---------------------------------------------------------------------------
// Route to MetaAgent orchestrator
// ---------------------------------------------------------------------------
async function routeToMetaAgent(task: string): Promise<string> {
  return new Promise((resolve) => {
    const { spawn } = require('child_process');
    const { join } = require('path');
    const duckBin = process.env.DUCK_CLI_PATH
      || (process.env.DUCK_SOURCE_DIR ? join(process.env.DUCK_SOURCE_DIR, 'duck') : './duck');
    const timeoutMs = parseInt(process.env.DUCK_META_TIMEOUT_MS || '300000', 10);

    const child = spawn(duckBin, ['meta', 'run', task], {
      cwd: process.env.DUCK_SOURCE_DIR || process.cwd(),
      env: { ...process.env },
    });

    let output = '';
    let finished = false;
    const finish = (text: string) => {
      if (finished) return;
      finished = true;
      resolve(text);
    };

    child.stdout.on('data', (data: Buffer) => { output += data.toString(); });
    child.stderr.on('data', (data: Buffer) => { output += data.toString(); });

    child.on('close', (code: number) => {
      finish(output || `[MetaAgent exited with code ${code}]`);
    });

    setTimeout(() => {
      try { child.kill('SIGTERM'); } catch {}
      setTimeout(() => {
        try { child.kill('SIGKILL'); } catch {}
      }, 3000);
      finish(`[MetaAgent timeout after ${Math.round(timeoutMs / 1000)}s]`);
    }, timeoutMs);
  });
}

// ---------------------------------------------------------------------------
// Process a single chat message
// ---------------------------------------------------------------------------
async function processMessage(
  userId: string, 
  message: string,
  overrideProvider?: string,
  overrideModel?: string
): Promise<{ 
  response: string; 
  routed: 'direct' | 'meta' | 'council_rejected' | 'council_modified'; 
  council?: any;
  provider?: string;
  model?: string;
}> {
  const session = getOrCreateSession(userId);
  const apiKey = getApiKey(PROVIDER);
  
  // Allow runtime override
  const effectiveProvider = overrideProvider || PROVIDER;
  const effectiveModel = overrideModel || MODEL;

  // Add user message
  session.addUser(message);

  // Ensure system prompt is present
  if (!session.messages.some((m: any) => m.role === 'system')) {
    session.addSystem(SYSTEM_PROMPT);
  }

  const complexity = scoreComplexity(message);
  const context = session.getContext(MAX_CONTEXT_TOKENS);

  // === FAST PATH: Low-complexity tasks skip council deliberation ===
  // Score 1-2 = simple greetings/facts — no need to burden the council
  const FAST_PATH_THRESHOLD = 2;
  const isFastPath = complexity <= FAST_PATH_THRESHOLD;

  // === AI COUNCIL DELIBERATION (before execution) ===
  // Use MiniMax for council (or configured council provider)
  // Skip council for fast-path tasks (unless councilApiKey is explicitly required)
  const councilApiKey = process.env.MINIMAX_API_KEY || apiKey;
  if (councilApiKey && !isFastPath) {
    const councilResult = await processWithCouncil(userId, message, complexity, councilApiKey);
    
    if (councilResult.routed === 'council_rejected') {
      return { 
        response: councilResult.response, 
        routed: 'council_rejected', 
        council: councilResult.council,
        provider: effectiveProvider,
        model: effectiveModel,
      };
    }
    
    if (councilResult.routed === 'council_modified') {
      return { 
        response: councilResult.response, 
        routed: 'council_modified', 
        council: councilResult.council,
        provider: effectiveProvider,
        model: effectiveModel,
      };
    }
  }

  // Broadcast task-queued to mesh for complex tasks
  if (complexity >= 7) {
    broadcastToMesh('task-queued', { prompt: message, complexity });
  }

  // Route complex tasks to MetaAgent
  if (complexity >= 7 && apiKey) {
    try {
      const result = await routeToMetaAgent(message);
      
      // Broadcast task-completed to mesh
      broadcastToMesh('task-completed', { prompt: message, complexity, routed: 'meta' });
      
      session.addAssistant(result);
      return { 
        response: result, 
        routed: 'meta',
        provider: effectiveProvider,
        model: effectiveModel,
      };
    } catch (err) {
      console.error('[ChatAgent] MetaAgent routing failed:', err);
      broadcastToMesh('task-failed', { prompt: message, complexity, error: err.message });
    }
  }

  // For complex tasks that fell back to direct (no apiKey), broadcast completion
  if (complexity >= 7) {
    broadcastToMesh('task-completed', { prompt: message, complexity, routed: 'direct' });
  }

  // Direct response via selected provider
  if (!apiKey || apiKey === 'local') {
    // For LM Studio local, apiKey might be 'local' which is fine
    if (!apiKey && PROVIDER !== 'lmstudio') {
      const noKeyMsg = `🦆 No API key configured for ${PROVIDER}. Set the appropriate env var:\n` +
        `  MINIMAX_API_KEY, KIMI_API_KEY, OPENAI_API_KEY, OPENROUTER_API_KEY\n` +
        `Or use --provider lmstudio for free local inference.`;
      session.addAssistant(noKeyMsg);
      return { response: noKeyMsg, routed: 'direct', provider: effectiveProvider, model: effectiveModel };
    }
  }

  try {
    const result = await chatComplete(effectiveProvider, effectiveModel, context, apiKey);
    session.addAssistant(result.content);
    return { 
      response: result.content, 
      routed: 'direct',
      provider: result.provider,
      model: result.model,
    };
  } catch (err) {
    // Classify error type for helpful error messages and potential retry logic
    const errorMsg = err.message || String(err);
    const isRateLimit = errorMsg.includes('429') || errorMsg.includes('rate limit') || errorMsg.includes('Rate limit');
    const isServerError = /\b5\d{2}\b/.test(errorMsg); // 500-599
    const isAuthError = errorMsg.includes('401') || errorMsg.includes('403') || errorMsg.includes('unauthorized') || errorMsg.includes('Forbidden');
    const isTimeout = errorMsg.includes('timeout') || errorMsg.includes('timed out');
    const isNetworkError = errorMsg.includes('network') || errorMsg.includes('ECONNREFUSED') || errorMsg.includes('ENOTFOUND');

    let action = '';
    if (isRateLimit) {
      action = `\n\n💡 Tip: Rate limit hit. Wait a moment and try again, or switch providers with POST /providers/switch.`;
    } else if (isServerError) {
      action = `\n\n💡 Tip: ${effectiveProvider} server issue. Try again shortly or use a different provider.`;
    } else if (isAuthError) {
      action = `\n\n💡 Tip: Auth failed for ${effectiveProvider}. Check your API key in the environment.`;
    } else if (isTimeout) {
      action = `\n\n💡 Tip: Request timed out. Try a smaller context or a faster model.`;
    } else if (isNetworkError) {
      action = `\n\n💡 Tip: Network error. Check your internet connection or try a different provider.`;
    }

    console.error(`[ChatAgent] ${effectiveProvider} error [rate_limit=${isRateLimit} server=${isServerError} auth=${isAuthError}]:`, err);
    const fullErrorMsg = `🦆 Oops, something went wrong with ${effectiveProvider}: ${err.message}${action}`;
    session.addAssistant(fullErrorMsg);
    return { response: fullErrorMsg, routed: 'direct', provider: effectiveProvider, model: effectiveModel };
  }
}

// ---------------------------------------------------------------------------
// HTTP Server
// ---------------------------------------------------------------------------
function startServer(port: number) {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${port}`);
    const pathname = url.pathname;

    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Provider, X-Model');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // Logger status endpoints
    if (req.method === 'GET' && pathname === '/health') {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(logger.getHealth()));
      return;
    }
    if (req.method === 'GET' && pathname === '/logs') {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(logger.getLogs({ limit: 50 })));
      return;
    }
    if (req.method === 'GET' && pathname === '/errors') {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(logger.getErrors()));
      return;
    }

    // POST /chat
    if (req.method === 'POST' && pathname === '/chat') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', async () => {
        try {
          const { userId, message, provider, model } = JSON.parse(body);
          if (!userId || !message) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'userId and message required' }));
            return;
          }

          logger.info('rest', 'chat-agent', `Chat request from ${userId}: ${message.substring(0, 50)}...`);

          // Runtime override via header or body
          const overrideProvider = provider || req.headers['x-provider'];
          const overrideModel = model || req.headers['x-model'];

          const result = await processMessage(userId, message, overrideProvider, overrideModel);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            ...result,
            sessionId: userId,
          }));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }

    // POST /chat/stream
    if (req.method === 'POST' && pathname === '/chat/stream') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', async () => {
        try {
          const { userId, message, provider, model } = JSON.parse(body);
          if (!userId || !message) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'userId and message required' }));
            return;
          }

          const overrideProvider = provider || req.headers['x-provider'];
          const overrideModel = model || req.headers['x-model'];

          res.writeHead(200, {
            'Content-Type': 'text/plain; charset=utf-8',
            'Transfer-Encoding': 'chunked',
          });

          const result = await processMessage(userId, message, overrideProvider, overrideModel);

          // Stream response
          const chunkSize = 64;
          for (let i = 0; i < result.response.length; i += chunkSize) {
            res.write(result.response.slice(i, i + chunkSize));
            await new Promise(r => setTimeout(r, 10));
          }
          res.write(`\n\n[DONE]`);
          res.end();
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }

    // GET /providers - list available providers
    if (req.method === 'GET' && pathname === '/providers') {
      const { getApiKey } = require('./chat-agent.js');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        current: PROVIDER,
        model: MODEL,
        available: {
          minimax: { 
            configured: !!process.env.MINIMAX_API_KEY,
            default_model: 'MiniMax-M2.7',
          },
          lmstudio: { 
            configured: true, // local, no key needed
            default_model: 'qwen3.5-0.8b',
            base_url: getBaseUrl('lmstudio'),
          },
          kimi: { 
            configured: !!(process.env.KIMI_API_KEY || process.env.MOONSHOT_API_KEY),
            default_model: 'k2p5',
          },
          openai: { 
            configured: !!process.env.OPENAI_API_KEY,
            default_model: 'gpt-5.4',
          },
          openrouter: { 
            configured: !!process.env.OPENROUTER_API_KEY,
            default_model: 'qwen/qwen3.6-plus-preview:free',
            free_models: [
              'qwen/qwen3.6-plus-preview:free',
              'qwen/qwen3-coder:free',
              'meta-llama/llama-3.3-70b-instruct:free',
              'nvidia/nemotron-3-nano-30b:free',
            ],
          },
        },
      }));
      return;
    }

    // POST /providers/switch - switch provider at runtime
    if (req.method === 'POST' && pathname === '/providers/switch') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', async () => {
        try {
          const { provider, model } = JSON.parse(body);
          if (!provider) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'provider required' }));
            return;
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            ok: true,
            message: `Provider switched to ${provider}, model ${model || getDefaultModel(provider)}`,
            note: 'Runtime switch affects current request only. For persistent switch, set DUCK_CHAT_PROVIDER env var.',
          }));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }

    // GET /chat/:userId/history
    const historyMatch = pathname.match(/^\/chat\/([^/]+)\/history$/);
    if (req.method === 'GET' && historyMatch) {
      const userId = historyMatch[1];
      const session = getOrCreateSession(userId);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(session.toJSON()));
      return;
    }

    // GET /chat/:userId
    const sessionMatch = pathname.match(/^\/chat\/([^/]+)$/);
    if (req.method === 'GET' && sessionMatch) {
      const userId = sessionMatch[1];
      const session = getOrCreateSession(userId);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ sessionId: session.sessionId, messageCount: session.size() }));
      return;
    }

    // GET /sessions
    if (req.method === 'GET' && pathname === '/sessions') {
      const { listSessions } = require('./chat-session.js');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ sessions: listSessions() }));
      return;
    }

    // DELETE /chat/:userId
    const deleteMatch = pathname.match(/^\/chat\/([^/]+)$/);
    if (req.method === 'DELETE' && deleteMatch) {
      const userId = deleteMatch[1];
      const { clearSession } = require('./chat-session.js');
      clearSession(userId);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    // GET /council/cache - Get council deliberation cache stats
    if (req.method === 'GET' && pathname === '/council/cache') {
      const { getCouncilCacheStats, clearCouncilCache } = require('../council/chat-bridge.js');
      const stats = getCouncilCacheStats();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        cacheSize: stats.size,
        ttlMs: stats.ttlMs,
        note: 'Cache TTL prevents redundant council deliberations for similar queries',
      }));
      return;
    }

    // POST /council/cache/clear - Clear council deliberation cache
    if (req.method === 'POST' && pathname === '/council/cache/clear') {
      const { clearCouncilCache } = require('../council/chat-bridge.js');
      clearCouncilCache();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, message: 'Council cache cleared' }));
      return;
    }

    // POST /mesh/whisper - Receive whisper alerts from Subconscious via mesh
    if (req.method === 'POST' && pathname === '/mesh/whisper') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', async () => {
        try {
          const { type, message, confidence, fromAgentId } = JSON.parse(body);
          
          // Handle whisper alert from Subconscious
          if (type === 'whisper' && fromAgentId === 'Subconscious') {
            console.log(`[Mesh] Whisper alert received: ${message} (confidence: ${confidence})`);
            
            // Log the whisper for now - in production this would notify the user
            // The notification mechanism depends on the chat channel (Telegram, etc.)
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ received: true, notified: true }));
            return;
          }
          
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ received: true }));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }

    // Health check
    if (req.method === 'GET' && (pathname === '/health' || pathname === '/')) {
      const apiKey = getApiKey(PROVIDER);
      const wsConnected = meshWs && meshWs.readyState === 1;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'ok',
        service: 'duck-chat-agent',
        version: 'v3',
        port,
        provider: PROVIDER,
        model: MODEL,
        apiKeyConfigured: !!apiKey,
        meshRegistered,
        meshWsConnected: wsConnected,
        meshEnabled: MESH_ENABLED,
        endpoints: {
          'POST /chat': 'Send message',
          'POST /chat/stream': 'Streaming response',
          'GET /providers': 'List available providers',
          'POST /providers/switch': 'Switch provider (runtime)',
          'GET /chat/:userId/history': 'Session history',
          'GET /sessions': 'List all sessions',
          'DELETE /chat/:userId': 'Clear session',
          'POST /mesh/whisper': 'Receive whisper alerts from mesh',
          'GET /health': 'Health check',
        },
        usage: {
          env_vars: 'DUCK_CHAT_PROVIDER, DUCK_CHAT_MODEL, DUCK_CHAT_MAX_CONTEXT',
          header_override: 'X-Provider, X-Model',
          runtime_switch: 'POST /providers/switch',
          whisper_routing: 'WHISPER_CALLBACK_URL env var routes high-confidence whispers',
        },
      }));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  });

  server.listen(port, () => {
    const apiKey = getApiKey(PROVIDER);
    console.log(`\n🦆 Duck Chat Agent v3 running on http://localhost:${port}`);
    console.log(`   Provider: ${PROVIDER}`);
    console.log(`   Model: ${MODEL}`);
    console.log(`   API Key: ${apiKey ? '✓ configured' : '✗ not set'}`);
    console.log(`\n   Routes:`);
    console.log(`     POST   /chat              — Send message`);
    console.log(`     POST   /chat/stream     — Streaming response`);
    console.log(`     GET    /providers       — List available providers`);
    console.log(`     POST   /providers/switch — Switch provider (runtime)`);
    console.log(`     GET    /chat/:userId/history — Session history`);
    console.log(`     GET    /sessions        — List all sessions`);
    console.log(`     GET    /health          — Health check\n`);
    
    if (!apiKey && PROVIDER !== 'lmstudio') {
      console.log(`   ⚠️  Warning: No API key for ${PROVIDER}. Set env var before chatting.\n`);
    }
  });

  return server;
}

// ---------------------------------------------------------------------------
// CLI entrypoint
// ---------------------------------------------------------------------------
export async function startChatAgent(port: number = PORT) {
  const apiKey = getApiKey(PROVIDER);
  
  console.log(`\n🦆 Starting Duck Chat Agent v3...`);
  console.log(`   Provider: ${PROVIDER}`);
  console.log(`   Model: ${MODEL}`);
  console.log(`   Max context: ${MAX_CONTEXT_TOKENS} tokens`);
  
  // Register with mesh (optional - won't fail if mesh unavailable)
  if (MESH_ENABLED) {
    console.log(`   Mesh: Enabled (${MESH_API_URL})`);
    registerWithMesh();
  } else {
    console.log(`   Mesh: Disabled (set MESH_ENABLED=true to enable)`);
  }
  
  const server = startServer(port);

  process.on('SIGINT', () => {
    console.log('\n🦆 Shutting down...');
    if (meshWs) {
      meshWs.close();
      meshWs = null;
    }
    server.close();
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    if (meshWs) {
      meshWs.close();
      meshWs = null;
    }
    server.close();
    process.exit(0);
  });
}

export { processMessage, scoreComplexity, chatComplete, getApiKey, getBaseUrl };

// Additional exports for bridge integration
export { connectMeshWebSocket, handleMeshMessage, routeWhisperToUser };
