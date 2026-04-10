/**
 * 🦆 Duck Agent - Remote Node Commands
 * CLI commands for managing remote nodes
 */

import { Command } from 'commander';
import { RemoteNodeManager } from '../agent/remote-node-manager.js';
import { readFileSync } from 'fs';

export function createRemoteNodeCommand(): Command {
  const cmd = new Command('node')
    .description('Remote node management - create and control nodes on remote devices');

  cmd
    .command('create')
    .description('Create a new remote node')
    .requiredOption('-n, --name <name>', 'Node name')
    .requiredOption('-h, --host <host>', 'Remote host')
    .requiredOption('-u, --user <username>', 'SSH username')
    .option('-k, --key <path>', 'SSH private key path')
    .option('-p, --password <password>', 'SSH password')
    .option('-g, --gateway <url>', 'Gateway URL', 'ws://localhost:18789')
    .option('-c, --capabilities <list>', 'Capabilities (comma-separated)', 'shell,file,process')
    .action(async (options) => {
      const manager = new RemoteNodeManager(options.gateway);
      
      const nodeId = `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      console.log(`Creating remote node: ${options.name}`);
      console.log(`Host: ${options.host}`);
      console.log(`Connecting to gateway: ${options.gateway}`);
      
      try {
        const node = await manager.createNode({
          id: nodeId,
          name: options.name,
          host: options.host,
          username: options.user,
          privateKey: options.key,
          password: options.password,
          gatewayUrl: options.gateway,
          capabilities: options.capabilities.split(',')
        });

        console.log(`\n✅ Node created successfully!`);
        console.log(`Node ID: ${node.id}`);
        console.log(`Status: ${node.status}`);
        console.log(`Capabilities: ${node.capabilities.join(', ')}`);
        
        // Save node config
        console.log(`\nAdd to your environment:`);
        console.log(`export DUCK_NODE_${node.name.toUpperCase().replace(/[^A-Z0-9]/g, '_')}=${node.id}`);
      } catch (e) {
        console.error(`\n❌ Failed to create node:`, e);
        process.exit(1);
      }
    });

  cmd
    .command('list')
    .description('List all remote nodes')
    .option('-g, --gateway <url>', 'Gateway URL', 'ws://localhost:18789')
    .action(async (options) => {
      const manager = new RemoteNodeManager(options.gateway);
      const nodes = manager.listNodes();
      
      console.log(`\n🖥️  Remote Nodes: ${nodes.length}`);
      
      for (const node of nodes) {
        const statusIcon = node.status === 'connected' ? '🟢' :
                          node.status === 'connecting' ? '🟡' :
                          node.status === 'error' ? '🔴' : '⚪';
        console.log(`\n${statusIcon} ${node.name} (${node.id})`);
        console.log(`   Host: ${node.host}`);
        console.log(`   Status: ${node.status}`);
        console.log(`   Paired: ${node.paired ? 'Yes' : 'No'}`);
        console.log(`   Capabilities: ${node.capabilities.join(', ')}`);
        console.log(`   Last Seen: ${new Date(node.lastSeen).toISOString()}`);
      }
    });

  cmd
    .command('status <nodeId>')
    .description('Check node status and health')
    .option('-g, --gateway <url>', 'Gateway URL', 'ws://localhost:18789')
    .action(async (nodeId, options) => {
      const manager = new RemoteNodeManager(options.gateway);
      const node = manager.getNode(nodeId);
      
      if (!node) {
        console.log(`Node not found: ${nodeId}`);
        return;
      }

      console.log(`\n🖥️  Node: ${node.name}`);
      console.log(`ID: ${node.id}`);
      console.log(`Host: ${node.host}`);
      console.log(`Status: ${node.status}`);
      console.log(`Paired: ${node.paired ? 'Yes' : 'No'}`);
      
      if (node.status === 'connected') {
        console.log(`\nChecking health...`);
        const healthy = await manager.checkNodeHealth(nodeId);
        console.log(`Health: ${healthy ? '✅ Healthy' : '❌ Unhealthy'}`);
      }
    });

  cmd
    .command('exec <nodeId> <command>')
    .description('Execute command on remote node')
    .option('-g, --gateway <url>', 'Gateway URL', 'ws://localhost:18789')
    .option('-t, --timeout <ms>', 'Command timeout', '60000')
    .option('-d, --cwd <dir>', 'Working directory')
    .allowUnknownOption()
    .action(async (nodeId, command, options, commandObj) => {
      const manager = new RemoteNodeManager(options.gateway);
      
      // Get additional args after --
      const extraArgs = commandObj.args.slice(2);
      
      console.log(`Executing on ${nodeId}: ${command} ${extraArgs.join(' ')}`);
      
      try {
        const result = await manager.sendCommand(
          nodeId,
          command,
          extraArgs,
          {
            cwd: options.cwd,
            timeout: parseInt(options.timeout)
          }
        );

        if (result.success) {
          console.log(result.stdout);
          if (result.stderr) {
            console.error('stderr:', result.stderr);
          }
        } else {
          console.error('Command failed:', result.stderr);
          process.exit(result.exitCode);
        }
      } catch (e) {
        console.error('Execution error:', e);
        process.exit(1);
      }
    });

  cmd
    .command('remove <nodeId>')
    .description('Remove a remote node')
    .option('-g, --gateway <url>', 'Gateway URL', 'ws://localhost:18789')
    .action(async (nodeId, options) => {
      const manager = new RemoteNodeManager(options.gateway);
      
      console.log(`Removing node: ${nodeId}`);
      await manager.removeNode(nodeId);
      console.log('✅ Node removed');
    });

  cmd
    .command('pair <nodeId>')
    .description('Pair with a remote node (manual pairing)')
    .option('-g, --gateway <url>', 'Gateway URL', 'ws://localhost:18789')
    .action(async (nodeId, options) => {
      console.log(`Pairing with node: ${nodeId}`);
      console.log(`Gateway: ${options.gateway}`);
      console.log('\nTo complete pairing:');
      console.log(`1. On the remote device, run: duck node agent --gateway ${options.gateway}`);
      console.log(`2. Enter pairing code when prompted`);
      console.log(`3. Node will appear as paired in 'duck node list'`);
    });

  cmd
    .command('agent')
    .description('Run as remote node agent (on remote device)')
    .requiredOption('-g, --gateway <url>', 'Gateway URL to connect to')
    .option('-n, --name <name>', 'Node name', `node_${Math.random().toString(36).substr(2, 9)}`)
    .option('-c, --capabilities <list>', 'Capabilities', 'shell,file,process')
    .action(async (options) => {
      console.log(`Starting remote node agent: ${options.name}`);
      console.log(`Connecting to: ${options.gateway}`);
      
      const manager = new RemoteNodeManager(options.gateway);
      
      // Create node that connects to gateway
      const node = await manager.createNode({
        id: options.name,
        name: options.name,
        host: 'localhost',
        username: process.env.USER || 'agent',
        gatewayUrl: options.gateway,
        capabilities: options.capabilities.split(',')
      });

      console.log(`✅ Connected as node: ${node.id}`);
      console.log('Waiting for commands... (Ctrl+C to exit)');

      // Keep alive
      process.on('SIGINT', async () => {
        console.log('\nDisconnecting...');
        await manager.removeNode(node.id);
        process.exit(0);
      });

      // Keep running
      await new Promise(() => {});
    });

  return cmd;
}

export default createRemoteNodeCommand;
