/**
 * Duck Agent - Agent Mesh Commands (daemon-level)
 * Manages the agent-mesh-api server lifecycle and registration.
 * 
 * duck mesh start     - Start mesh server on port 4000
 * duck mesh status    - Check if mesh server is running
 * duck mesh stop      - Stop mesh server
 * duck mesh register  - Register Chat Agent with mesh
 */

import { createConnection } from 'net';
import { spawn, execSync } from 'child_process';
import { join } from 'path';
import { existsSync, readFileSync, writeFileSync, mkdirSync, readFileSync as readFile } from 'fs';

// AgentMeshClient for persistent WebSocket mesh connections
import { AgentMeshClient } from '../mesh/agent-mesh.js';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const MESH_PORT = parseInt(process.env.MESH_PORT || '4000');
const MESH_HOST = process.env.MESH_HOST || '0.0.0.0';
const MESH_URL = process.env.AGENT_MESH_URL || `http://localhost:${MESH_PORT}`;
const MESH_API_KEY = process.env.AGENT_MESH_API_KEY || 'openclaw-mesh-default-key';

// Find mesh-api directory
function findMeshDir(): string {
  const candidates = [
    join(process.env.HOME || '', 'agent-mesh-api'),
    join(process.env.HOME || '', '.openclaw', 'workspace', 'agent-mesh-api'),
    join(process.cwd(), '..', 'agent-mesh-api'),
    join(process.cwd(), 'agent-mesh-api'),
  ];
  for (const dir of candidates) {
    if (existsSync(join(dir, 'src', 'server.js'))) {
      return dir;
    }
  }
  return candidates[0]; // default to home location
}

const MESH_API_DIR = process.env.MESH_API_DIR || findMeshDir();

// PID file for mesh server
const MESH_PID_FILE = join(process.env.HOME || '/tmp', '.duck', 'mesh-server.pid');

// ---------------------------------------------------------------------------
// Colors
// ---------------------------------------------------------------------------
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  dim: '\x1b[2m',
  brightGreen: '\x1b[92m',
};

// ---------------------------------------------------------------------------
// Port check helper
// ---------------------------------------------------------------------------
async function isPortOpen(port: number, host: string = '127.0.0.1'): Promise<boolean> {
  return new Promise((resolve) => {
    const sock = createConnection({ port, host, timeout: 2000 }, () => {
      sock.destroy();
      resolve(true);
    });
    sock.on('error', () => resolve(false));
    sock.on('timeout', () => { sock.destroy(); resolve(false); });
  });
}

// ---------------------------------------------------------------------------
// PID file helpers
// ---------------------------------------------------------------------------
function savePid(pid: number): void {
  const dir = join(MESH_PID_FILE, '..');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(MESH_PID_FILE, String(pid));
}

function loadPid(): number | null {
  try {
    if (!existsSync(MESH_PID_FILE)) return null;
    const pid = parseInt(readFileSync(MESH_PID_FILE, 'utf-8').trim());
    return isNaN(pid) ? null : pid;
  } catch {
    return null;
  }
}

function clearPid(): void {
  try {
    if (existsSync(MESH_PID_FILE)) {
      const pid = loadPid();
      if (pid) {
        // Try to kill the process
        try {
          process.kill(pid, 'SIGTERM');
        } catch { /* ignore if already dead */ }
      }
      writeFileSync(MESH_PID_FILE, '');
    }
  } catch { /* ignore */ }
}

function isPidRunning(pid: number): boolean {
  try {
    process.kill(pid, 0); // signal 0 just checks if process exists
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Banner
// ---------------------------------------------------------------------------
function printBanner(): void {
  console.log(`\n${c.cyan}${c.bold}   ╔═══════════════════════════════════════╗
   ║     🦆 Duck Agent Mesh Network 🦆      ║
   ╚═══════════════════════════════════════╝${c.reset}`);
}

// ---------------------------------------------------------------------------
// meshCommand - handles: start, status, stop, register
// (Also handles the client-level commands: list, send, inbox, health, etc.)
// ---------------------------------------------------------------------------
export async function meshCommand(args: string[]): Promise<void> {
  const [action, ...actionArgs] = args;

  printBanner();
  console.log(`   Server: ${c.cyan}${MESH_URL}${c.reset}`);
  console.log(`   Key:    ${c.dim}openclaw-mesh-default-key${c.reset}`);
  console.log(`   API:    ${c.dim}${MESH_API_DIR}${c.reset}`);
  console.log();

  switch (action) {
    // -----------------------------------------------------------------------
    // duck mesh start - Start the mesh server daemon
    // -----------------------------------------------------------------------
    case 'start': {
      const port = parseInt(actionArgs[0] || String(MESH_PORT));
      const host = actionArgs[1] || MESH_HOST;

      console.log(`${c.cyan}Starting mesh server...${c.reset}`);

      // Check if already running
      const existingPid = loadPid();
      if (existingPid && isPidRunning(existingPid)) {
        console.log(`${c.yellow}⚠️  Mesh server already running (PID: ${existingPid})${c.reset}`);
        console.log(`   Use ${c.bold}duck mesh status${c.reset} to check or ${c.bold}duck mesh stop${c.reset} to stop it.`);
        return;
      }

      // Check if port is already in use by another process
      const portInUse = await isPortOpen(port);
      if (portInUse) {
        console.log(`${c.yellow}⚠️  Port ${port} is already in use${c.reset}`);
        console.log(`   A mesh server may already be running.`);
        console.log(`   Check: ${c.bold}curl http://localhost:${port}/health${c.reset}`);
        return;
      }

      // Find the server entry point
      const serverPath = existsSync(join(MESH_API_DIR, 'src', 'server.js'))
        ? join(MESH_API_DIR, 'src', 'server.js')
        : join(MESH_API_DIR, 'server.js');
      if (!existsSync(serverPath)) {
        console.log(`${c.red}❌ Mesh API not found at: ${serverPath}${c.reset}`);
        console.log(`\n${c.yellow}To install mesh-api:${c.reset}`);
        console.log(`   cd ~`);
        console.log(`   git clone https://github.com/Franzferdinan51/agent-mesh-api.git`);
        console.log(`   cd agent-mesh-api && npm install`);
        console.log(`\n   Or set MESH_API_DIR environment variable to the correct path.`);
        return;
      }

      // Spawn server as detached background process
      console.log(`   🌐 Starting on: http://${host === '0.0.0.0' ? 'localhost' : host}:${port}`);
      console.log(`   🔑 API Key:     openclaw-mesh-default-key`);
      console.log();

      const child = spawn(process.execPath, [serverPath], {
        detached: true,
        stdio: 'ignore',
        env: {
          ...process.env,
          MESH_PORT: String(port),
          MESH_HOST: host,
          MESH_API_KEY: MESH_API_KEY,
        },
        cwd: MESH_API_DIR,
      });

      child.unref();
      savePid(child.pid!);

      // Wait a moment for server to start
      await new Promise(r => setTimeout(r, 2000));

      const started = await isPortOpen(port);
      if (started) {
        console.log(`${c.green}✅ Mesh server started successfully!${c.reset}`);
        console.log(`   PID: ${child.pid}`);
        console.log(`   Health: ${c.bold}curl http://localhost:${port}/health${c.reset}`);
        console.log(`\n${c.dim}Server running in background. Stop with: duck mesh stop${c.reset}`);
      } else {
        console.log(`${c.red}❌ Server failed to start on port ${port}${c.reset}`);
        console.log(`   Check that port ${port} is available.`);
        clearPid();
      }
      break;
    }

    // -----------------------------------------------------------------------
    // duck mesh status - Check if mesh server is running
    // -----------------------------------------------------------------------
    case 'status': {
      const port = parseInt(actionArgs[0] || String(MESH_PORT));

      console.log(`${c.cyan}Checking mesh server status...${c.reset}\n`);

      const portOpen = await isPortOpen(port);
      const pid = loadPid();
      const pidRunning = pid ? isPidRunning(pid) : false;

      if (portOpen) {
        console.log(`${c.green}✅ Mesh server is RUNNING on port ${port}${c.reset}`);
        if (pid && pidRunning) {
          console.log(`   PID: ${pid}`);
        }

        // Try to get health info
        try {
          const resp = await fetch(`${MESH_URL}/health`, {
            headers: { 'X-API-Key': MESH_API_KEY },
            signal: AbortSignal.timeout(3000),
          });
          if (resp.ok) {
            const health = await resp.json() as any;
            console.log(`   Agents: ${health.agents?.length ?? health.totalAgents ?? '?'}`);
          }
        } catch { /* ignore */ }

        console.log(`\n${c.green}Available commands:${c.reset}`);
        console.log(`   ${c.bold}duck mesh list${c.reset}      - Discover agents`);
        console.log(`   ${c.bold}duck mesh register${c.reset}  - Register this agent`);
        console.log(`   ${c.bold}duck mesh stop${c.reset}      - Stop server`);
      } else {
        console.log(`${c.red}❌ Mesh server is NOT running on port ${port}${c.reset}`);
        console.log(`   Start with: ${c.bold}duck mesh start${c.reset}`);
      }

      if (pid && !pidRunning) {
        console.log(`\n${c.yellow}⚠️  Stale PID file (process ${pid} is dead)${c.reset}`);
        clearPid();
      }
      break;
    }

    // -----------------------------------------------------------------------
    // duck mesh stop - Stop the mesh server
    // -----------------------------------------------------------------------
    case 'stop': {
      console.log(`${c.cyan}Stopping mesh server...${c.reset}`);

      const pid = loadPid();
      if (!pid || !isPidRunning(pid)) {
        console.log(`${c.yellow}⚠️  No running mesh server found${c.reset}`);
        clearPid();
        return;
      }

      try {
        process.kill(pid, 'SIGTERM');
        // Give it a moment to gracefully shut down
        await new Promise(r => setTimeout(r, 1000));

        if (!isPidRunning(pid)) {
          console.log(`${c.green}✅ Mesh server stopped (PID: ${pid})${c.reset}`);
        } else {
          // Force kill if still running
          process.kill(pid, 'SIGKILL');
          console.log(`${c.green}✅ Mesh server killed (PID: ${pid})${c.reset}`);
        }
      } catch (e: any) {
        console.log(`${c.red}❌ Failed to stop mesh server: ${e.message}${c.reset}`);
      }

      clearPid();
      break;
    }

    // -----------------------------------------------------------------------
    // duck mesh register - Register Chat Agent with mesh
    // -----------------------------------------------------------------------
    case 'register': {
      console.log(`${c.cyan}Registering with mesh...${c.reset}\n`);

      const port = parseInt(actionArgs[0] || String(MESH_PORT));
      const meshUrl = actionArgs[1] ? `http://localhost:${parseInt(actionArgs[1]) || port}` : MESH_URL;
      const agentName = process.env.DUCK_AGENT_NAME || 'DuckCLI';
      const endpoint = process.env.DUCK_AGENT_ENDPOINT || 'http://localhost:18797';
      const capabilities = (process.env.DUCK_AGENT_CAPABILITIES || 'reasoning,coding,messaging,cli,chat').split(',');

      const portOpen = await isPortOpen(port);
      if (!portOpen) {
        console.log(`${c.red}❌ Mesh server not running on port ${port}${c.reset}`);
        console.log(`   Start it first: ${c.bold}duck mesh start${c.reset}`);
        return;
      }

      try {
        const resp = await fetch(`${meshUrl}/api/agents/register`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': MESH_API_KEY,
          },
          body: JSON.stringify({
            name: agentName,
            endpoint,
            capabilities,
          }),
          signal: AbortSignal.timeout(5000),
        });

        const data = await resp.json() as any;

        if (resp.ok && data.success !== false) {
          const agentId = data.agentId || data.id;
          console.log(`${c.green}✅ Registered successfully!${c.reset}`);
          console.log(`   Agent ID: ${c.bold}${agentId}${c.reset}`);
          console.log(`   Name:     ${agentName}`);
          console.log(`   Endpoint: ${endpoint}`);
          console.log(`   Skills:   ${capabilities.join(', ')}`);

          console.log(`\n${c.green}Next steps:${c.reset}`);
          console.log(`   ${c.bold}duck mesh list${c.reset}      - See other agents`);
          console.log(`   ${c.bold}duck mesh send <id> <msg>${c.reset} - Send a message`);
        } else {
          console.log(`${c.red}❌ Registration failed: ${JSON.stringify(data)}${c.reset}`);
        }
      } catch (e: any) {
        console.log(`${c.red}❌ Registration error: ${e.message}${c.reset}`);
        console.log(`   Is the mesh server running? Check: ${c.bold}duck mesh status${c.reset}`);
      }
      break;
    }

    // -----------------------------------------------------------------------
    // duck mesh list - List all registered agents on the mesh
    // -----------------------------------------------------------------------
    case 'list': {
      const port = parseInt(actionArgs[0] || String(MESH_PORT));
      const portOpen = await isPortOpen(port);
      if (!portOpen) {
        console.log(`${c.red}❌ Mesh server not running on port ${port}${c.reset}`);
        console.log(`   Start it first: ${c.bold}duck mesh start${c.reset}`);
        return;
      }

      console.log(`${c.cyan}Discovering agents on mesh...${c.reset}\n`);

      try {
        const resp = await fetch(`${MESH_URL}/api/agents`, {
          headers: { 'X-API-Key': MESH_API_KEY },
          signal: AbortSignal.timeout(5000),
        });

        if (resp.ok) {
          const data = await resp.json() as any;
          const agents = Array.isArray(data) ? data : (data.agents || []);
          if (agents.length === 0) {
            console.log(`${c.yellow}No agents registered yet.${c.reset}`);
            console.log(`   Run ${c.bold}duck mesh register${c.reset} to register this agent.`);
          } else {
            console.log(`${c.green}Registered agents (${agents.length}):${c.reset}`);
            for (const agent of agents) {
              console.log(`   ${c.bold}${agent.name}${c.reset} (${agent.id})`);
              console.log(`      Endpoint: ${agent.endpoint}`);
              console.log(`      Last seen: ${agent.last_seen || 'unknown'}`);
              if (agent.capabilities?.length) {
                console.log(`      Capabilities: ${agent.capabilities.join(', ')}`);
              }
              console.log();
            }
          }
        } else {
          console.log(`${c.red}❌ Failed to list agents: ${resp.status}${c.reset}`);
        }
      } catch (e: any) {
        console.log(`${c.red}❌ Error: ${e.message}${c.reset}`);
      }
      break;
    }

    // -----------------------------------------------------------------------
    // duck mesh send <agentId> <message> - Send message to specific agent
    // -----------------------------------------------------------------------
    case 'send': {
      const agentId = actionArgs[0];
      const message = actionArgs.slice(1).join(' ');

      if (!agentId || !message) {
        console.log(`${c.yellow}Usage: duck mesh send <agent-id> <message>${c.reset}`);
        console.log(`   Example: duck mesh send abc123 "Hello agent!"`);
        return;
      }

      const portOpen = await isPortOpen(MESH_PORT);
      if (!portOpen) {
        console.log(`${c.red}❌ Mesh server not running${c.reset}`);
        return;
      }

      console.log(`${c.cyan}Sending message to ${agentId}...${c.reset}`);

      try {
        const resp = await fetch(`${MESH_URL}/api/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': MESH_API_KEY,
          },
          body: JSON.stringify({
            type: 'direct',
            from: process.env.DUCK_AGENT_NAME || 'DuckCLI',
            to: agentId,
            content: message,
          }),
          signal: AbortSignal.timeout(5000),
        });

        const data = await resp.json() as any;
        if (resp.ok || data.success) {
          console.log(`${c.green}✅ Message sent!${c.reset}`);
        } else {
          console.log(`${c.red}❌ Failed: ${data.message || JSON.stringify(data)}${c.reset}`);
        }
      } catch (e: any) {
        console.log(`${c.red}❌ Error: ${e.message}${c.reset}`);
      }
      break;
    }

    // -----------------------------------------------------------------------
    // duck mesh broadcast <message> - Broadcast to all agents
    // -----------------------------------------------------------------------
    case 'broadcast': {
      const message = actionArgs.join(' ');

      if (!message) {
        console.log(`${c.yellow}Usage: duck mesh broadcast <message>${c.reset}`);
        console.log(`   Example: duck mesh broadcast "System update available!"`);
        return;
      }

      const portOpen = await isPortOpen(MESH_PORT);
      if (!portOpen) {
        console.log(`${c.red}❌ Mesh server not running${c.reset}`);
        return;
      }

      console.log(`${c.cyan}Broadcasting to all agents...${c.reset}`);

      try {
        const resp = await fetch(`${MESH_URL}/api/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': MESH_API_KEY,
          },
          body: JSON.stringify({
            type: 'broadcast',
            from: process.env.DUCK_AGENT_NAME || 'DuckCLI',
            to: '*',
            content: message,
          }),
          signal: AbortSignal.timeout(5000),
        });

        const data = await resp.json() as any;
        if (resp.ok || data.success) {
          console.log(`${c.green}✅ Broadcast sent!${c.reset}`);
          if (data.recipients !== undefined) {
            console.log(`   Recipients: ${data.recipients}`);
          }
        } else {
          console.log(`${c.red}❌ Failed: ${data.message || JSON.stringify(data)}${c.reset}`);
        }
      } catch (e: any) {
        console.log(`${c.red}❌ Error: ${e.message}${c.reset}`);
      }
      break;
    }

    // -----------------------------------------------------------------------
    // duck mesh inbox - Check inbox/messages for this agent
    // -----------------------------------------------------------------------
    case 'inbox': {
      const agentId = actionArgs[0] || process.env.DUCK_AGENT_NAME || 'DuckCLI';

      const portOpen = await isPortOpen(MESH_PORT);
      if (!portOpen) {
        console.log(`${c.red}❌ Mesh server not running${c.reset}`);
        return;
      }

      console.log(`${c.cyan}Checking inbox for ${agentId}...${c.reset}\n`);

      try {
        // Try the inbox endpoint first
        const resp = await fetch(`${MESH_URL}/api/inbox/${encodeURIComponent(agentId)}`, {
          headers: { 'X-API-Key': MESH_API_KEY },
          signal: AbortSignal.timeout(5000),
        });

        if (resp.ok) {
          const data = await resp.json() as any;
          const messages = data.messages || [];
          if (messages.length === 0) {
            console.log(`${c.yellow}No messages in inbox.${c.reset}`);
          } else {
            console.log(`${c.green}Messages (${messages.length}):${c.reset}`);
            for (const msg of messages) {
              console.log(`   ${c.bold}From:${c.reset} ${msg.fromAgentId || msg.from || 'unknown'}`);
              console.log(`   ${c.bold}Time:${c.reset} ${new Date(msg.timestamp || Date.now()).toLocaleString()}`);
              console.log(`   ${c.bold}Content:${c.reset} ${typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)}`);
              console.log();
            }
          }
        } else if (resp.status === 404) {
          console.log(`${c.yellow}No messages in inbox yet.${c.reset}`);
          console.log(`   ${c.dim}Inbox feature requires agent-mesh-api v2.1+${c.reset}`);
        } else {
          console.log(`${c.yellow}Inbox not available (${resp.status}).${c.reset}`);
          console.log(`   ${c.dim}Use ${c.bold}duck mesh broadcast${c.reset}${c.dim} to send messages to all agents.${c.reset}`);
        }
      } catch (e: any) {
        console.log(`${c.yellow}Inbox check failed: ${e.message}${c.reset}`);
        console.log(`   ${c.dim}Use ${c.bold}duck mesh broadcast${c.reset}${c.dim} to send messages.${c.reset}`);
      }
      break;
    }

    // -----------------------------------------------------------------------
    // duck mesh health - Mesh health dashboard
    // -----------------------------------------------------------------------
    case 'health': {
      const portOpen = await isPortOpen(MESH_PORT);
      if (!portOpen) {
        console.log(`${c.red}❌ Mesh server not running${c.reset}`);
        return;
      }

      console.log(`${c.cyan}Mesh health check...${c.reset}\n`);

      try {
        const resp = await fetch(`${MESH_URL}/health`, {
          headers: { 'X-API-Key': MESH_API_KEY },
          signal: AbortSignal.timeout(5000),
        });

        if (resp.ok) {
          const data = await resp.json() as any;
          console.log(`${c.green}✅ Mesh server healthy${c.reset}`);
          console.log(`   Service: ${data.service || 'agent-mesh-api'}`);
          console.log(`   Uptime: ${data.uptime ? Math.round(data.uptime / 1000) + 's' : 'unknown'}`);
          console.log(`   Agents: ${data.agents?.length || data.totalAgents || '?'}`);
          console.log(`   Messages: ${data.totalMessages || data.messages || '?'}`);
        } else {
          console.log(`${c.red}❌ Health check failed: ${resp.status}${c.reset}`);
        }
      } catch (e: any) {
        console.log(`${c.red}❌ Error: ${e.message}${c.reset}`);
      }
      break;
    }

    // -----------------------------------------------------------------------
    // duck mesh connect [port] - Persistent WebSocket connection to mesh
    // -----------------------------------------------------------------------
    case 'connect': {
      const port = parseInt(actionArgs[0] || String(MESH_PORT));
      const meshUrl = actionArgs[1] || MESH_URL;

      console.log(`${c.cyan}Connecting to mesh at ${meshUrl}...${c.reset}\n`);

      // Check server is reachable
      const portOpen = await isPortOpen(port);
      if (!portOpen) {
        console.log(`${c.red}❌ Mesh server not running on port ${port}${c.reset}`);
        console.log(`   Start it first: ${c.bold}duck mesh start${c.reset}`);
        return;
      }

      const agentName = process.env.DUCK_AGENT_NAME || 'DuckCLI';
      const endpoint = process.env.DUCK_AGENT_ENDPOINT || 'http://localhost:18797';
      const capabilities = (process.env.DUCK_AGENT_CAPABILITIES || 'reasoning,coding,messaging,cli,chat,mesh-client').split(',').map(s => s.trim()).filter(Boolean);

      // Create the full-featured mesh client
      const client = new AgentMeshClient({
        serverUrl: meshUrl,
        apiKey: MESH_API_KEY,
        agentName,
        agentEndpoint: endpoint,
        capabilities,
        version: process.env.DUCK_CLI_VERSION || '1.0.0',
        heartbeatInterval: 30000,
        reconnectInterval: 5000,
      });

      // ── Event handlers ──────────────────────────────────────────────────

      client.on('registered', ({ agentId }: { agentId: string }) => {
        console.log(`${c.green}✅ Registered on mesh as ${agentId}${c.reset}`);
      });

      client.on('connected', () => {
        console.log(`${c.green}✅ WebSocket connected to mesh${c.reset}`);
        console.log(`${c.cyan}   Listening for events... (Ctrl+C to disconnect)${c.reset}\n`);
      });

      client.on('disconnected', () => {
        console.log(`${c.yellow}⚠️  Disconnected from mesh${c.reset}`);
      });

      client.on('agent_joined', (data: any) => {
        console.log(`${c.green}🤝 Agent joined mesh:${c.reset} ${data?.name || data?.agentId || 'unknown'}`);
      });

      client.on('agent_left', (data: any) => {
        console.log(`${c.yellow}👋 Agent left mesh:${c.reset} ${data?.name || data?.agentId || 'unknown'}`);
      });

      client.on('message_received', (msg: any) => {
        const from = msg.from || msg.fromAgentId || 'unknown';
        const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
        console.log(`${c.cyan}📨 Mesh message from ${from}:${c.reset}`);
        console.log(`   ${content.substring(0, 200)}${content.length > 200 ? '...' : ''}`);
      });

      client.on('catastrophe_alert', (evt: any) => {
        console.warn(`${c.red}🚨 Catastrophe alert:${c.reset} ${evt?.title || evt?.eventType || 'unknown'}`);
        if (evt?.description) {
          console.warn(`   ${evt.description}`);
        }
      });

      client.on('agent_health_change', (data: any) => {
        console.log(`${c.cyan}🏥 Agent health change:${c.reset} ${data?.agentId} → ${data?.status}`);
      });

      client.on('error', ({ type, error }: { type: string; error: any }) => {
        console.error(`${c.red}❌ Mesh error [${type}]:${c.reset} ${error?.message || error}`);
      });

      // ── Register + Connect ──────────────────────────────────────────────

      const agentId = await client.register();
      if (!agentId) {
        console.log(`${c.red}❌ Registration failed — check mesh server is running${c.reset}`);
        console.log(`   ${c.bold}duck mesh status${c.reset} to verify`);
        return;
      }

      // Connect WebSocket (auto-reconnect enabled)
      const connected = await client.connect();
      if (!connected) {
        console.log(`${c.red}❌ WebSocket connection failed${c.reset}`);
        return;
      }

      // Save PID for background runs
      const CONNECT_PID_FILE = join(process.env.HOME || '/tmp', '.duck', 'mesh-client.pid');
      const pidDir = join(CONNECT_PID_FILE, '..');
      if (!existsSync(pidDir)) mkdirSync(pidDir, { recursive: true });
      writeFileSync(CONNECT_PID_FILE, String(process.pid));

      // Graceful shutdown
      const shutdown = async () => {
        console.log(`\n${c.yellow}Disconnecting from mesh...${c.reset}`);
        try { await client.unregister(); } catch {}
        client.disconnect();
        try { writeFileSync(CONNECT_PID_FILE, ''); } catch {}
        console.log(`${c.green}✅ Disconnected${c.reset}`);
        process.exit(0);
      };

      process.on('SIGINT', shutdown);
      process.on('SIGTERM', shutdown);

      // Keep alive — mesh client handles its own heartbeat + reconnect
      // tsc needs this to not exit
      await new Promise(() => {});
      break;
    }

    // -----------------------------------------------------------------------
    // Unknown action - show help
    // -----------------------------------------------------------------------
    default: {
      showMeshHelp();
      break;
    }
  }
}

// ---------------------------------------------------------------------------
// meshServerCommand - legacy alias for duck meshd (starts server)
// ---------------------------------------------------------------------------
export async function meshServerCommand(args: string[]): Promise<void> {
  await meshCommand(['start', ...args]);
}

// ---------------------------------------------------------------------------
// Help
// ---------------------------------------------------------------------------
function showMeshHelp(): void {
  console.log(`${c.bold}Duck Mesh Commands:${c.reset}

${c.green}duck mesh start${c.reset} [port]
   Start the mesh server daemon on port 4000 (or specified port)
   - Spawns node src/server.js from agent-mesh-api directory
   - Runs in background as detached process
   - Saves PID to ~/.duck/mesh-server.pid

${c.green}duck mesh status${c.reset} [port]
   Check if mesh server is running
   - Checks if port 4000 (or specified) is open
   - Shows PID if server is running
   - Auto-cleans stale PID files

${c.green}duck mesh stop${c.reset}
   Stop the running mesh server
   - Sends SIGTERM for graceful shutdown
   - Falls back to SIGKILL if needed
   - Clears PID file

${c.green}duck mesh register${c.reset} [port]
   Register Duck CLI agent with the mesh
   - Calls POST /api/agents/register on the mesh server
   - Uses agent name from DUCK_AGENT_NAME env var (default: DuckCLI)
   - Uses capabilities from DUCK_AGENT_CAPABILITIES env var
   - Requires server to be running

${c.yellow}Other mesh commands (client):${c.reset}
${c.green}duck mesh list${c.reset}      - Discover all agents on mesh
${c.green}duck mesh send <id> <msg>${c.reset} - Send message to agent
${c.green}duck mesh inbox${c.reset}     - Check unread messages
${c.green}duck mesh health${c.reset}    - Mesh health dashboard
${c.green}duck mesh broadcast <msg>${c.reset} - Broadcast to all agents
${c.green}duck mesh connect${c.reset} [port] - Persistent WebSocket connection to mesh
   (separate from register — sets up full mesh client with event listeners)

${c.yellow}Environment Variables:${c.reset}
   MESH_PORT              Server port (default: 4000)
   MESH_HOST              Server host (default: 0.0.0.0)
   AGENT_MESH_URL         Mesh server URL
   AGENT_MESH_API_KEY     API key (default: openclaw-mesh-default-key)
   MESH_API_DIR           Path to agent-mesh-api directory
   DUCK_AGENT_NAME        Agent name for registration
   DUCK_AGENT_ENDPOINT    Agent endpoint URL
   DUCK_AGENT_CAPABILITIES Comma-separated capabilities list

${c.dim}Installing agent-mesh-api:${c.reset}
   cd ~
   git clone https://github.com/Franzferdinan51/agent-mesh-api.git
   cd agent-mesh-api && npm install
`);
}
