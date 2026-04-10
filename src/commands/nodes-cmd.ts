/**
 * 🦆 Duck Agent - Nodes CLI Commands
 * openclaw nodes [list|describe|approve|reject]
 * Gateway-side node queries via OpenClaw Gateway API
 */

import { Command } from 'commander';
import { NodesClient } from '../nodes/nodes-client.js';

export function createNodesCommand(): Command {
  const cmd = new Command('nodes')
    .description('Query and manage nodes paired to the gateway')
    .passThroughOptions();

  // duck nodes list
  cmd
    .command('list')
    .description('List all paired nodes')
    .option('-s, --status <status>', 'Filter by status: online, offline, pending, rejected, all')
    .option('-l, --limit <n>', 'Limit results', '50')
    .option('-g, --gateway <url>', 'Gateway URL')
    .option('--include-expired', 'Include expired tokens')
    .action(async (options) => {
      const client = new NodesClient({ gatewayUrl: options.gateway });
      const status = options.status || 'all';
      const limit = parseInt(options.limit) || 50;
      await client.printNodeList({ status: status as any, limit, includeExpired: options.includeExpired });
    });

  // duck nodes describe <nodeId>
  cmd
    .command('describe <nodeId>')
    .description('Show detailed info for a node')
    .option('-g, --gateway <url>', 'Gateway URL')
    .action(async (nodeId, options) => {
      const client = new NodesClient({ gatewayUrl: options.gateway });
      await client.printDescribeNode(nodeId);
    });

  // duck nodes status <nodeId>
  cmd
    .command('status <nodeId>')
    .description('Quick status check for a node')
    .option('-g, --gateway <url>', 'Gateway URL')
    .action(async (nodeId, options) => {
      const client = new NodesClient({ gatewayUrl: options.gateway });
      const status = await client.getNodeStatus(nodeId);
      console.log(`\n📶 Node ${nodeId}: ${status}\n`);
    });

  // duck nodes approve <nodeId>
  cmd
    .command('approve <nodeId>')
    .description('Approve a pending node')
    .option('-g, --gateway <url>', 'Gateway URL')
    .option('-b, --by <name>', 'Approved by name')
    .action(async (nodeId, options) => {
      const client = new NodesClient({ gatewayUrl: options.gateway });
      const ok = await client.approveNode(nodeId, options.by);
      if (ok) {
        console.log(`\n✅ Node ${nodeId} approved!\n`);
      } else {
        console.log(`\n❌ Failed to approve node ${nodeId}\n`);
        process.exit(1);
      }
    });

  // duck nodes reject <nodeId>
  cmd
    .command('reject <nodeId>')
    .description('Reject a pending or paired node')
    .option('-g, --gateway <url>', 'Gateway URL')
    .option('-r, --reason <reason>', 'Rejection reason')
    .action(async (nodeId, options) => {
      const client = new NodesClient({ gatewayUrl: options.gateway });
      const ok = await client.rejectNode(nodeId, options.reason);
      if (ok) {
        console.log(`\n✅ Node ${nodeId} rejected!\n`);
      } else {
        console.log(`\n❌ Failed to reject node ${nodeId}\n`);
        process.exit(1);
      }
    });

  return cmd;
}

export default createNodesCommand;
