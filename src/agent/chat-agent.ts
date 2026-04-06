// @ts-nocheck
/**
 * duck-cli v3 - Chat Agent
 * Conversational AI agent with AI Council deliberation.
 * Uses MiniMax for responses, MetaAgent for complex tasks.
 * AI Council deliberates BEFORE execution on complex/ethical/high-stakes tasks.
 */

import http from 'http';
import { Url } from 'url';
import { ChatSession, getOrCreateSession, ChatMessage } from './chat-session.js';
import { processWithCouncil } from '../council/chat-bridge.js';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const PORT = parseInt(process.env.DUCK_CHAT_PORT || '18797');
const API_KEY = process.env.MINIMAX_API_KEY || '';
const MODEL = process.env.DUCK_CHAT_MODEL || 'MiniMax-M2.7';
const SYSTEM_PROMPT = `You are Duck Agent - a friendly, casual AI assistant. You're helpful but not formal. Use emojis appropriately. You can help with coding, research, automation, and general questions. When tasks are complex, delegate to the orchestrator.`;

const MAX_CONTEXT_TOKENS = 16000; // leave headroom for response

// ---------------------------------------------------------------------------
// MiniMax API (direct, not via ProviderManager)
// ---------------------------------------------------------------------------
async function chatComplete(model, messages, apiKey) {
  const resp = await fetch('https://api.minimax.io/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model, messages, stream: false }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`MiniMax API error ${resp.status}: ${text}`);
  }

  const data = await resp.json();
  return data.choices[0].message.content;
}

// ---------------------------------------------------------------------------
// Task complexity scoring (0-10)
// ---------------------------------------------------------------------------
function scoreComplexity(message: string): number {
  const lower = message.toLowerCase();
  let score = 1;

  // Indicators of complexity
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

  // Long messages tend to be more complex
  if (message.length > 500) score += 1;
  if (message.length > 2000) score += 2;

  return Math.max(1, Math.min(10, Math.round(score)));
}

// ---------------------------------------------------------------------------
// Route to MetaAgent orchestrator
// ---------------------------------------------------------------------------
async function routeToMetaAgent(task: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = Bun.spawn(
      ['./duck', 'meta', 'run', task],
      {
        cwd: process.cwd(),
        env: { ...process.env },
        stdout: 'pipe',
        stderr: 'pipe',
      }
    );

    let output = '';
    child.stdout?.subscribe((chunk) => {
      output += new TextDecoder().decode(chunk);
    });

    child.wait().then((exit) => {
      if (exit.signal === 'SIGKILL' || exit.code !== 0) {
        resolve(`[MetaAgent error: exited with ${exit.code}]`);
      } else {
        resolve(output || '[no output from meta agent]');
      }
    });

    // Timeout after 120 seconds
    setTimeout(() => {
      child.kill();
      resolve('[MetaAgent timeout after 120s]');
    }, 120000);
  });
}

// ---------------------------------------------------------------------------
// Process a single chat message
// ---------------------------------------------------------------------------
async function processMessage(userId: string, message: string): Promise<{ response: string; routed: 'direct' | 'meta' | 'council_rejected' | 'council_modified'; council?: any }> {
  const session = getOrCreateSession(userId);

  // Add user message
  session.addUser(message);

  // Ensure system prompt is present
  if (!session.messages.some(m => m.role === 'system')) {
    session.addSystem(SYSTEM_PROMPT);
  }

  const complexity = scoreComplexity(message);
  const context = session.getContext(MAX_CONTEXT_TOKENS);

  // === AI COUNCIL DELIBERATION (before execution) ===
  if (API_KEY) {
    const councilResult = await processWithCouncil(userId, message, complexity, API_KEY);
    
    if (councilResult.routed === 'council_rejected') {
      return { response: councilResult.response, routed: 'council_rejected', council: councilResult.council };
    }
    
    if (councilResult.routed === 'council_modified') {
      return { response: councilResult.response, routed: 'council_modified', council: councilResult.council };
    }
    
    // councilResult.routed === 'orchestrator' - proceed to MetaAgent
  }

  // Route complex tasks to MetaAgent
  if (complexity >= 7 && API_KEY) {
    // Route to MetaAgent
    try {
      const result = await routeToMetaAgent(message);
      session.addAssistant(result);
      return { response: result, routed: 'meta' };
    } catch (err) {
      console.error('[ChatAgent] MetaAgent routing failed:', err);
    }
  }

  // Direct MiniMax response
  if (!API_KEY) {
    const noKeyMsg = '🦆 MiniMax API key not configured. Set MINIMAX_API_KEY env var, or the task has been routed to MetaAgent.';
    session.addAssistant(noKeyMsg);
    return { response: noKeyMsg, routed: 'direct' };
  }

  try {
    const response = await chatComplete(MODEL, context, API_KEY);
    session.addAssistant(response);
    return { response, routed: 'direct' };
  } catch (err) {
    console.error('[ChatAgent] MiniMax error:', err);
    const errorMsg = `🦆 Oops, something went wrong: ${err.message}`;
    session.addAssistant(errorMsg);
    return { response: errorMsg, routed: 'direct' };
  }
}

// ---------------------------------------------------------------------------
// HTTP Server
// ---------------------------------------------------------------------------
function startServer(port: number) {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${port}`);
    const pathname = url.pathname;

    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // POST /chat
    if (req.method === 'POST' && pathname === '/chat') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', async () => {
        try {
          const { userId, message } = JSON.parse(body);
          if (!userId || !message) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'userId and message required' }));
            return;
          }

          const { response, routed, council } = await processMessage(userId, message);

          res.writeHead(200, {
            'Content-Type': 'application/json',
            'Transfer-Encoding': 'chunked',
          });
          res.end(JSON.stringify({ response, routed, sessionId: userId, council }));
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }

    // POST /chat/stream (streaming via chunked transfer)
    if (req.method === 'POST' && pathname === '/chat/stream') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', async () => {
        try {
          const { userId, message } = JSON.parse(body);
          if (!userId || !message) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'userId and message required' }));
            return;
          }

          res.writeHead(200, {
            'Content-Type': 'text/plain; charset=utf-8',
            'Transfer-Encoding': 'chunked',
            'X-Content-Type-Options': 'nosniff',
          });

          const { response, routed } = await processMessage(userId, message);

          // Stream the response in chunks
          const chunkSize = 64;
          for (let i = 0; i < response.length; i += chunkSize) {
            res.write(response.slice(i, i + chunkSize));
            await new Promise(r => setTimeout(r, 10)); // small delay for effect
          }
          res.write('\n\n[DONE]');
          res.end();
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

    // GET /chat/:userId (session info)
    const sessionMatch = pathname.match(/^\/chat\/([^/]+)$/);
    if (req.method === 'GET' && sessionMatch) {
      const userId = sessionMatch[1];
      const session = getOrCreateSession(userId);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ sessionId: session.sessionId, messageCount: session.size() }));
      return;
    }

    // GET /sessions — list all sessions
    if (req.method === 'GET' && pathname === '/sessions') {
      const { listSessions } = require('./chat-session.js');
      const ids = listSessions();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ sessions: ids }));
      return;
    }

    // DELETE /chat/:userId — clear session
    const deleteMatch = pathname.match(/^\/chat\/([^/]+)$/);
    if (req.method === 'DELETE' && deleteMatch) {
      const userId = deleteMatch[1];
      const { clearSession } = require('./chat-session.js');
      clearSession(userId);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    // Health check
    if (req.method === 'GET' && (pathname === '/health' || pathname === '/')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'ok',
        service: 'duck-chat-agent',
        port,
        model: MODEL,
      }));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  });

  server.listen(port, () => {
    console.log(`\n🦆 Duck Chat Agent running on http://localhost:${port}`);
    console.log(`   Model: ${MODEL}`);
    console.log(`   Routes:`);
    console.log(`     POST   /chat              — Send message`);
    console.log(`     POST   /chat/stream       — Streaming response`);
    console.log(`     GET    /chat/:userId/history — Get session history`);
    console.log(`     GET    /chat/:userId      — Session info`);
    console.log(`     DELETE /chat/:userId      — Clear session`);
    console.log(`     GET    /sessions          — List all sessions`);
    console.log(`     GET    /health            — Health check\n`);
  });

  return server;
}

// ---------------------------------------------------------------------------
// CLI entrypoint
// ---------------------------------------------------------------------------
export async function startChatAgent(port: number = PORT) {
  console.log(`\n🦆 Starting Duck Chat Agent v3...`);
  console.log(`   Port: ${port}`);
  console.log(`   Model: ${MODEL}`);
  if (!API_KEY) {
    console.log(`   ⚠️  MINIMAX_API_KEY not set — direct responses will be disabled`);
  }
  const server = startServer(port);

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🦆 Shutting down...');
    server.close();
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    server.close();
    process.exit(0);
  });
}

export { processMessage, scoreComplexity };
