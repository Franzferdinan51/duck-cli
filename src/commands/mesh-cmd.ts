/**
 * 🦆 Duck Agent - Mesh Commands
 * CLI commands for Agent Mesh management
 */

import { Command } from 'commander';
import { AgentMesh } from '../mesh/agent-mesh-enhanced.js';

export function createMeshCommand(): Command {
  const cmd = new Command('mesh')
    .description('Agent Mesh - Multi-agent communication network');

  let mesh: AgentMesh | null = null;

  cmd
    .command('start [port]')
    .description('Start the agent mesh server')
    .option('-n, --name <name>', 'Mesh name', 'duck-cli-mesh')
    .action(async (port = '4000', options) => {
      mesh = new AgentMesh(options.name);
      
      mesh.on('agent_registered', (agent) => {
        console.log(`✅ Agent registered: ${agent.name} (${agent.id})`);
      });

      mesh.on('agent_disconnected', (agent) => {
        console.log(`⚠️  Agent disconnected: ${agent.name}`);
      });

      mesh.on('message_routed', (msg) => {
        console.log(`📨 Message: ${msg.from} → ${msg.to}`);
      });

      mesh.on('catastrophe', (report) => {
        console.log(`🚨 CATASTROPHE: ${report.type} (${report.severity})`);
      });

      mesh.on('external_mesh_connected', (extMesh) => {
        console.log(`🌐 Connected to external mesh: ${extMesh.name}`);
      });

      await mesh.startServer(parseInt(port));
      console.log(`\n🌐 Agent Mesh running on port ${port}`);
      console.log('Press Ctrl+C to stop\n');

      // Keep running
      process.on('SIGINT', () => {
        console.log('\nStopping mesh...');
        mesh?.stop();
        process.exit(0);
      });

      await new Promise(() => {});
    });

  cmd
    .command('register')
    .description('Register this agent with a mesh')
    .requiredOption('-u, --url <url>', 'Mesh URL (ws://host:port)')
    .requiredOption('-n, --name <name>', 'Agent name')
    .option('-t, --type <type>', 'Agent type', 'duck-cli')
    .option('-c, --capabilities <list>', 'Capabilities (comma-separated)', 'shell,file,process')
    .option('-e, --endpoint <url>', 'Agent endpoint URL')
    .action(async (options) => {
      const WebSocket = (await import('ws')).default;
      const ws = new WebSocket(options.url);

      ws.on('open', () => {
        console.log(`Connected to mesh at ${options.url}`);
        
        ws.send(JSON.stringify({
          type: 'register',
          name: options.name,
          agentType: options.type,
          capabilities: options.capabilities.split(','),
          endpoint: options.endpoint,
          metadata: { registeredAt: Date.now() }
        }));
      });

      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'registered') {
          console.log(`✅ Registered with mesh: ${msg.meshName}`);
          console.log(`Agent ID: ${msg.agentId}`);
          console.log(`Mesh ID: ${msg.meshId}`);
        } else {
          console.log('📨 Received:', msg);
        }
      });

      ws.on('error', (err) => {
        console.error('Connection error:', err);
      });

      console.log('Listening for messages... (Ctrl+C to exit)');
    });

  cmd
    .command('send')
    .description('Send message to agent(s)')
    .requiredOption('-u, --url <url>', 'Mesh URL')
    .requiredOption('-f, --from <id>', 'Sender agent ID')
    .requiredOption('-t, --to <target>', 'Recipient (agentId, broadcast, or multicast)')
    .requiredOption('-m, --message <msg>', 'Message payload (JSON)')
    .option('--topic <topic>', 'Topic for multicast')
    .option('--priority <level>', 'Priority (low/normal/high/critical)', 'normal')
    .action(async (options) => {
      const WebSocket = (await import('ws')).default;
      const ws = new WebSocket(options.url);

      ws.on('open', () => {
        const msg = {
          type: 'message',
          id: `msg_${Date.now()}`,
          from: options.from,
          to: options.to,
          payload: JSON.parse(options.message),
          topic: options.topic,
          priority: options.priority,
          timestamp: Date.now(),
          ttl: 10
        };

        ws.send(JSON.stringify(msg));
        console.log(`📨 Message sent to ${options.to}`);
        ws.close();
      });
    });

  cmd
    .command('dashboard')
    .description('Show mesh dashboard')
    .requiredOption('-u, --url <url>', 'Mesh URL')
    .action(async (options) => {
      // This would typically fetch from a REST API endpoint
      console.log('📊 Mesh Dashboard');
      console.log('==================');
      console.log('Use: duck mesh status -u <url> for detailed info');
    });

  cmd
    .command('status')
    .description('Show mesh status and connected agents')
    .requiredOption('-u, --url <url>', 'Mesh URL (or "local" if server running)')
    .action(async (options) => {
      if (options.url === 'local' && mesh) {
        const dashboard = mesh.getDashboard();
        
        console.log('\n🌐 Mesh Status');
        console.log(`Name: ${dashboard.meshName}`);
        console.log(`ID: ${dashboard.meshId}`);
        console.log(`Agents: ${dashboard.agents.length}`);
        console.log(`External Meshes: ${dashboard.externalMeshes.length}`);
        console.log(`Messages: ${dashboard.messages}`);
        console.log(`File Transfers: ${dashboard.fileTransfers}`);
        console.log(`Catastrophes: ${dashboard.catastrophes.length}`);

        console.log('\n📡 Connected Agents:');
        for (const agent of dashboard.agents) {
          const statusIcon = agent.status === 'online' ? '🟢' : 
                            agent.status === 'busy' ? '🟡' : 
                            agent.status === 'error' ? '🔴' : '⚪';
          console.log(`  ${statusIcon} ${agent.name} (${agent.type})`);
          console.log(`     ID: ${agent.id}`);
          console.log(`     Capabilities: ${agent.capabilities.join(', ')}`);
          console.log(`     Last Seen: ${new Date(agent.lastSeen).toISOString()}`);
        }

        if (dashboard.externalMeshes.length > 0) {
          console.log('\n🌐 External Meshes:');
          for (const ext of dashboard.externalMeshes) {
            const statusIcon = ext.status === 'connected' ? '🟢' : '🔴';
            console.log(`  ${statusIcon} ${ext.name}`);
            console.log(`     Agents: ${ext.agents}`);
            console.log(`     Last Sync: ${new Date(ext.lastSync).toISOString()}`);
          }
        }
      } else {
        console.log('Connect to mesh to view status, or use "local" if server is running');
      }
    });

  cmd
    .command('connect')
    .description('Connect to external mesh (create hive mind!)')
    .requiredOption('-u, --url <url>', 'Local mesh URL')
    .requiredOption('-e, --external <endpoint>', 'External mesh endpoint')
    .requiredOption('-n, --name <name>', 'External mesh name')
    .action(async (options) => {
      const WebSocket = (await import('ws')).default;
      const ws = new WebSocket(options.url);

      ws.on('open', () => {
        // Request mesh to connect externally
        ws.send(JSON.stringify({
          type: 'connect_external',
          endpoint: options.external,
          name: options.name
        }));
        console.log(`🌐 Connecting to external mesh: ${options.name}`);
        console.log(`Endpoint: ${options.external}`);
      });

      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'external_connected') {
          console.log(`✅ Connected to external mesh: ${msg.meshName}`);
          console.log(`Agents available: ${msg.agents}`);
        } else if (msg.type === 'error') {
          console.error(`❌ Connection failed: ${msg.error}`);
        }
        ws.close();
      });
    });

  cmd
    .command('broadcast')
    .description('Broadcast message to all agents')
    .requiredOption('-u, --url <url>', 'Mesh URL')
    .requiredOption('-f, --from <id>', 'Sender agent ID')
    .requiredOption('-m, --message <msg>', 'Message payload')
    .action(async (options) => {
      const WebSocket = (await import('ws')).default;
      const ws = new WebSocket(options.url);

      ws.on('open', () => {
        ws.send(JSON.stringify({
          type: 'message',
          id: `msg_${Date.now()}`,
          from: options.from,
          to: 'broadcast',
          payload: { message: options.message },
          timestamp: Date.now(),
          ttl: 10,
          priority: 'normal'
        }));
        console.log('📢 Broadcast sent to all agents');
        ws.close();
      });
    });

  cmd
    .command('subscribe')
    .description('Subscribe to topic for multicast')
    .requiredOption('-u, --url <url>', 'Mesh URL')
    .requiredOption('-a, --agent <id>', 'Agent ID')
    .requiredOption('-t, --topic <topic>', 'Topic to subscribe to')
    .action(async (options) => {
      const WebSocket = (await import('ws')).default;
      const ws = new WebSocket(options.url);

      ws.on('open', () => {
        ws.send(JSON.stringify({
          type: 'subscribe',
          agentId: options.agent,
          topic: options.topic
        }));
        console.log(`📡 Agent ${options.agent} subscribed to topic: ${options.topic}`);
        ws.close();
      });
    });

  return cmd;
}

export default createMeshCommand;
