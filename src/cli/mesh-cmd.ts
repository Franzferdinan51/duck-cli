
// ============ AGENT MESH ============

async function meshCommand(args: string[]) {
  const [action, ...actionArgs] = args;

  // Colors for mesh output
  const meshColors = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    green: '\x1b[32m',
    cyan: '\x1b[36m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    dim: '\x1b[2m',
  };

  console.log(`
${meshColors.cyan}${meshColors.bold}
   ╔═══════════════════════════════════════╗
   ║     🦆 Duck Agent Mesh Network 🦆      ║
   ╚═══════════════════════════════════════╝
${meshColors.reset}`);

  // Show mesh status
  const meshUrl = process.env.AGENT_MESH_URL || 'http://localhost:4000';
  console.log(`   Server: ${meshColors.cyan}${meshUrl}${meshColors.reset}`);
  console.log(`   Key:    ${meshColors.dim}openclaw-mesh-default-key${meshColors.reset}`);
  console.log();

  // Load the mesh client
  const { AgentMeshClient } = await import('../mesh/agent-mesh.js');

  // Create client instance
  const mesh = new AgentMeshClient({
    serverUrl: meshUrl,
    agentName: 'DuckCLI',
    agentEndpoint: process.env.DUCK_AGENT_ENDPOINT || 'http://localhost:3000',
    capabilities: ['reasoning', 'coding', 'messaging', 'cli'],
  });

  // Handle actions
  switch (action) {
    case 'register': {
      // Register with mesh
      console.log(`${meshColors.cyan}Registering with mesh...${meshColors.reset}`);

      const agentId = await mesh.register();

      if (agentId) {
        console.log(`${meshColors.green}✅ Registered successfully!${meshColors.reset}`);
        console.log(`   Agent ID: ${agentId}`);

        // Optionally connect for real-time events
        const connected = await mesh.connect();
        if (connected) {
          console.log(`${meshColors.green}✅ WebSocket connected${meshColors.reset}`);

          // Listen for messages
          mesh.on('message_received', (msg: any) => {
            console.log(`
${meshColors.yellow}📨 New Message:${meshColors.reset}
   From: ${msg.from || msg.fromAgentId}
   Content: ${msg.content || msg.message}
`);
          });
        }

        console.log(`
${meshColors.green}✅ Duck Agent is now part of the mesh!${meshColors.reset}
   Use ${meshColors.bold}duck mesh list${meshColors.reset} to see other agents
   Use ${meshColors.bold}duck mesh send <agent> <message>${meshColors.reset} to send a message
`);
      } else {
        console.log(`${meshColors.red}❌ Registration failed${meshColors.reset}`);
        console.log(`   Is the mesh server running at ${meshUrl}?`);
      }
      break;
    }

    case 'list':
    case 'discover': {
      // List all agents on mesh
      console.log(`${meshColors.cyan}Discovering agents on mesh...${meshColors.reset}\n`);

      const agents = await mesh.discoverAgents();

      if (agents.length === 0) {
        console.log(`${meshColors.yellow}No agents found on mesh${meshColors.reset}`);
        console.log(`Run ${meshColors.bold}duck mesh register${meshColors.reset} to join!`);
      } else {
        console.log(`${meshColors.green}Found ${agents.length} agent(s):${meshColors.reset}\n`);

        for (const agent of agents) {
          const status = agent.status === 'online'
            ? `${meshColors.green}● ONLINE${meshColors.reset}`
            : `${meshColors.dim}○ OFFLINE${meshColors.reset}`;

          console.log(`   ${meshColors.bold}${agent.name}${meshColors.reset}`);
          console.log(`   ID:     ${agent.id}`);
          console.log(`   Status: ${status}`);
          console.log(`   Endpoint: ${agent.endpoint || 'N/A'}`);
          if (agent.capabilities && agent.capabilities.length > 0) {
            console.log(`   Skills: ${agent.capabilities.join(', ')}`);
          }
          console.log();
        }
      }
      break;
    }

    case 'send': {
      // Send message to agent
      const [targetAgent, ...messageParts] = actionArgs;
      const message = messageParts.join(' ');

      if (!targetAgent || !message) {
        console.log(`${meshColors.yellow}Usage: duck mesh send <agent-id|agent-name> <message>${meshColors.reset}`);
        console.log(`\nExample: duck mesh send abc123 "Hello from Duck Agent!"`);
        return;
      }

      console.log(`${meshColors.cyan}Sending message...${meshColors.reset}`);

      // First, find the agent (by ID or name)
      let targetId = targetAgent;

      // If not a UUID, try to find by name
      if (!targetAgent.includes('-')) {
        const agents = await mesh.discoverAgents();
        const found = agents.find(a =>
          a.name.toLowerCase() === targetAgent.toLowerCase() ||
          a.name.toLowerCase().includes(targetAgent.toLowerCase())
        );

        if (found) {
          targetId = found.id;
          console.log(`   Found agent: ${found.name}`);
        }
      }

      const messageId = await mesh.sendMessage(targetId, message);

      if (messageId) {
        console.log(`${meshColors.green}✅ Message sent!${meshColors.reset}`);
        console.log(`   Message ID: ${messageId}`);
        console.log(`   To: ${targetId}`);
      } else {
        console.log(`${meshColors.red}❌ Failed to send message${meshColors.reset}`);
      }
      break;
    }

    case 'inbox': {
      // Get messages for this agent
      console.log(`${meshColors.cyan}Checking inbox...${meshColors.reset}\n`);

      const messages = await mesh.getInbox(true);

      if (messages.length === 0) {
        console.log(`${meshColors.dim}No unread messages${meshColors.reset}`);
      } else {
        console.log(`${meshColors.green}You have ${messages.length} unread message(s):${meshColors.reset}\n`);

        for (const msg of messages) {
          console.log(`   ${meshColors.bold}From:${meshColors.reset} ${msg.from}`);
          console.log(`   ${meshColors.bold}Content:${meshColors.reset} ${msg.content}`);
          console.log(`   ${meshColors.bold}Time:${meshColors.reset} ${new Date(msg.timestamp).toLocaleString()}`);
          console.log();

          // Mark as read
          await mesh.markRead(msg.id);
        }
      }
      break;
    }

    case 'health': {
      // Health dashboard
      console.log(`${meshColors.cyan}Loading health dashboard...${meshColors.reset}\n`);

      const health = await mesh.getHealth();

      if (health) {
        const total = health.totalAgents || 0;
        const healthy = health.healthy || 0;
        const degraded = health.degraded || 0;
        const unhealthy = health.unhealthy || 0;
        const offline = health.offline || 0;

        console.log(`${meshColors.bold}Mesh Health Overview${meshColors.reset}`);
        console.log(`   Total Agents: ${total}`);
        console.log(`   ${meshColors.green}Healthy:${meshColors.reset}   ${healthy}`);
        console.log(`   ${meshColors.yellow}Degraded:${meshColors.reset}  ${degraded}`);
        console.log(`   ${meshColors.red}Unhealthy:${meshColors.reset} ${unhealthy}`);
        console.log(`   ${meshColors.dim}Offline:${meshColors.reset}   ${offline}`);

        if (health.criticalEvents && health.criticalEvents > 0) {
          console.log(`\n   ${meshColors.red}⚠️  ${health.criticalEvents} critical event(s)${meshColors.reset}`);
        }
      } else {
        console.log(`${meshColors.red}❌ Failed to get health status${meshColors.reset}`);
      }
      break;
    }

    case 'broadcast': {
      // Broadcast to all agents
      const message = actionArgs.join(' ');

      if (!message) {
        console.log(`${meshColors.yellow}Usage: duck mesh broadcast <message>${meshColors.reset}`);
        return;
      }

      console.log(`${meshColors.cyan}Broadcasting...${meshColors.reset}`);

      const count = await mesh.broadcast(message);

      console.log(`${meshColors.green}✅ Message sent to ${count} agent(s)${meshColors.reset}`);
      break;
    }

    case 'capabilities':
    case 'skills': {
      // Discover capabilities
      console.log(`${meshColors.cyan}Discovering agent capabilities...${meshColors.reset}\n`);

      const agents = await mesh.discoverAgents();
      const capabilityMap = new Map<string, string[]>();

      for (const agent of agents) {
        if (agent.capabilities) {
          for (const cap of agent.capabilities) {
            if (!capabilityMap.has(cap)) {
              capabilityMap.set(cap, []);
            }
            capabilityMap.get(cap)!.push(agent.name);
          }
        }
      }

      console.log(`${meshColors.bold}Available Capabilities:${meshColors.reset}\n`);

      for (const [capability, agentsWithCap] of Array.from(capabilityMap.entries())) {
        console.log(`   ${meshColors.green}${capability}${meshColors.reset}`);
        console.log(`      Provided by: ${agentsWithCap.join(', ')}`);
        console.log();
      }
      break;
    }

    case 'catastrophe': {
      // Check catastrophe status
      console.log(`${meshColors.cyan}Checking catastrophe status...${meshColors.reset}\n`);

      const catastrophes = await mesh.listCatastrophes('active');

      if (catastrophes.length === 0) {
        console.log(`${meshColors.green}✅ No active catastrophes${meshColors.reset}`);
      } else {
        console.log(`${meshColors.red}⚠️  ${catastrophes.length} active catastrophe(s):${meshColors.reset}\n`);

        for (const cat of catastrophes) {
          console.log(`   ${meshColors.bold}${cat.title}${meshColors.reset}`);
          console.log(`   Type:     ${cat.eventType}`);
          console.log(`   Severity: ${cat.severity}`);
          console.log(`   Reported: ${new Date(cat.timestamp).toLocaleString()}`);
          console.log();
        }
      }
      break;
    }

    case 'ping':
    case 'status': {
      // Check connection status
      console.log(`${meshColors.cyan}Pinging mesh server...${meshColors.reset}`);

      const online = await mesh.ping();

      if (online) {
        console.log(`${meshColors.green}✅ Mesh server is online${meshColors.reset}`);

        const agentId = mesh.getAgentId();
        if (agentId) {
          console.log(`   Registered Agent ID: ${agentId}`);
          console.log(`   Agent Name: ${mesh.getAgentName()}`);
          console.log(`   Capabilities: ${mesh.getCapabilities().join(', ')}`);
        } else {
          console.log(`${meshColors.yellow}   Not registered - run "duck mesh register"${meshColors.reset}`);
        }
      } else {
        console.log(`${meshColors.red}❌ Mesh server is offline${meshColors.reset}`);
        console.log(`   Check that server is running at ${meshUrl}`);
      }
      break;
    }

    case 'help':
    case '-h':
    case '--help':
    default: {
      console.log(`${meshColors.bold}Duck Agent Mesh Commands:${meshColors.reset}

${meshColors.green}duck mesh register${meshColors.reset}
   Register this agent with the mesh network
   - Gets unique agent ID
   - Connects WebSocket for real-time events
   - Enables message sending/receiving

${meshColors.green}duck mesh list${meshColors.reset}
   Discover all agents on the mesh
   - Shows agent names, IDs, statuses
   - Lists capabilities of each agent

${meshColors.green}duck mesh send <agent> <message>${meshColors.reset}
   Send a message to another agent
   - Use agent ID or partial name for <agent>
   - Message can be any text content

${meshColors.green}duck mesh inbox${meshColors.reset}
   Check for unread messages
   - Shows messages from other agents
   - Auto-marks messages as read

${meshColors.green}duck mesh health${meshColors.reset}
   View mesh health dashboard
   - Shows healthy/degraded/unhealthy counts
   - Lists any critical events

${meshColors.green}duck mesh broadcast <message>${meshColors.reset}
   Send message to all agents at once

${meshColors.green}duck mesh capabilities${meshColors.reset}
   Discover what agents can do
   - Maps capabilities to agent names

${meshColors.green}duck mesh catastrophe${meshColors.reset}
   Check for active catastrophe events
   - Shows any reported issues

${meshColors.green}duck mesh status${meshColors.reset}
   Check mesh server connection status

${meshColors.yellow}Environment Variables:${meshColors.reset}
   AGENT_MESH_URL     Mesh server URL (default: http://localhost:4000)
   AGENT_MESH_API_KEY API key (default: openclaw-mesh-default-key)

${meshColors.dim}Starting the mesh server:${meshColors.reset}
   cd /Users/duckets/Desktop/agent-mesh-api
   npm install
   npm start
`);
      break;
    }
  }
}
export { meshCommand };

// ============ MESH SERVER DAEMON ============

async function meshServerCommand(args: string[]) {
  const port = parseInt(args[0] || process.env.MESH_PORT || '4000');
  const host = process.env.MESH_HOST || '0.0.0.0';
  const { join } = await import('path');
  const meshDir = join(process.env.HOME || '/tmp', '.duckagent', 'mesh');

  const meshServerColors = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    green: '\x1b[32m',
    cyan: '\x1b[36m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    dim: '\x1b[2m',
  };

  console.log(`\n${meshServerColors.cyan}${meshServerColors.bold}
   ╔═══════════════════════════════════════╗
   ║     🦆 Duck Mesh Server Daemon 🦆    ║
   ╚═══════════════════════════════════════╝
${meshServerColors.reset}`);

  // Check if port is in use
  try {
    const { createConnection } = await import('net');
    const checkPort = new Promise<boolean>((resolve) => {
      const sock = createConnection({ port, host }, () => {
        sock.destroy();
        resolve(true);
      });
      sock.on('error', () => resolve(false));
      sock.setTimeout(1000, () => { sock.destroy(); resolve(false); });
    });
    
    const inUse = await checkPort;
    if (inUse) {
      console.log(`${meshServerColors.yellow}⚠️  Port ${port} is already in use${meshServerColors.reset}`);
      console.log(`   A mesh server may already be running.`);
      console.log(`   Check: ${meshServerColors.bold}curl http://localhost:${port}/health${meshServerColors.reset}`);
      console.log(`   Or try a different port: ${meshServerColors.bold}duck meshd 5000${meshServerColors.reset}`);
      return;
    }
  } catch (e) {
    // Ignore port check errors
  }

  // Spawn server as detached background process
  const { spawn } = await import('child_process');
  const serverPath = join(process.cwd(), 'dist', 'daemons', 'mesh-server.js');
  
  const child = spawn('node', [serverPath], {
    detached: true,
    stdio: 'ignore',
    env: {
      ...process.env,
      MESH_PORT: String(port),
      MESH_HOST: host,
    }
  });

  child.unref(); // Allow parent to exit

  // Wait a moment for server to start
  await new Promise(r => setTimeout(r, 1500));

  console.log(`   🌐 Starting on: http://${host === '0.0.0.0' ? 'localhost' : host}:${port}`);
  console.log(`   🔌 WebSocket:   ws://localhost:${port}/ws`);
  console.log(`   🔑 API Key:     openclaw-mesh-default-key`);
  console.log(`   📁 Data:       ${meshDir}/`);
  console.log(`   📊 Health:     GET http://localhost:${port}/api/health/dashboard`);
  console.log(`   👥 Agents:     GET http://localhost:${port}/api/agents`);
  console.log(`   💬 Messages:   POST http://localhost:${port}/api/messages`);
  console.log();

  // Verify it started
  try {
    const { createConnection } = await import('net');
    const check = new Promise<boolean>((resolve) => {
      const sock = createConnection({ port, host }, () => {
        sock.destroy();
        resolve(true);
      });
      sock.on('error', () => resolve(false));
      sock.setTimeout(2000, () => { sock.destroy(); resolve(false); });
    });
    
    const started = await check;
    if (started) {
      console.log(`${meshServerColors.green}✅ Duck Mesh Server started!${meshServerColors.reset}\n`);
      console.log(`   Register an agent:`);
      console.log(`   ${meshServerColors.bold}curl -X POST http://localhost:${port}/api/agents/register \\${meshServerColors.reset}`);
      console.log(`     -H "Content-Type: application/json" \\`);
      console.log(`     -d '{"name": "MyAgent"}'`);
      console.log();
      console.log(`${meshServerColors.dim}Server running in background (PID: ${child.pid})`);
      console.log(`Stop with: kill ${child.pid}${meshServerColors.reset}`);
    } else {
      console.log(`${meshServerColors.red}❌ Server failed to start${meshServerColors.reset}`);
      console.log(`   Check log: ~/.duckagent/mesh/`);
    }
  } catch (e) {
    console.log(`${meshServerColors.red}❌ Error checking server${meshServerColors.reset}`);
  }
}

export { meshServerCommand };
