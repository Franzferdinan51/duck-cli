/**
 * 🦆 Duck Agent - Devices CLI Commands
 * openclaw devices [list|approve|reject|rotate|revoke|token]
 * Device pairing management via OpenClaw Gateway API
 */

import { Command } from 'commander';
import { DevicePairing } from '../devices/device-pairing.js';

export function createDevicesCommand(): Command {
  const cmd = new Command('devices')
    .description('Manage companion device pairing')
    .passThroughOptions();

  // duck devices list
  cmd
    .command('list')
    .description('List all paired/rejected/pending devices')
    .option('-s, --status <status>', 'Filter: pending, paired, rejected, expired, all')
    .option('-l, --limit <n>', 'Limit results', '50')
    .option('-g, --gateway <url>', 'Gateway URL')
    .action(async (options) => {
      const dp = new DevicePairing({ gatewayUrl: options.gateway });
      const status = options.status || 'all';
      const limit = parseInt(options.limit) || 50;
      await dp.printDeviceList({ status: status as any, limit });
    });

  // duck devices info <deviceId>
  cmd
    .command('info <deviceId>')
    .description('Show detailed device info')
    .option('-g, --gateway <url>', 'Gateway URL')
    .action(async (deviceId, options) => {
      const dp = new DevicePairing({ gatewayUrl: options.gateway });
      await dp.printDeviceInfo(deviceId);
    });

  // duck devices approve <deviceId>
  cmd
    .command('approve <deviceId>')
    .description('Approve a pending device')
    .option('-g, --gateway <url>', 'Gateway URL')
    .option('-b, --by <name>', 'Approved by name')
    .action(async (deviceId, options) => {
      const dp = new DevicePairing({ gatewayUrl: options.gateway });
      const result = await dp.approveDevice(deviceId, options.by);
      if (result.success) {
        console.log(`\n✅ Device ${deviceId} approved!\n`);
      } else {
        console.log(`\n❌ Failed to approve device: ${result.error}\n`);
        process.exit(1);
      }
    });

  // duck devices reject <deviceId>
  cmd
    .command('reject <deviceId>')
    .description('Reject a pending or paired device')
    .option('-g, --gateway <url>', 'Gateway URL')
    .option('-r, --reason <reason>', 'Rejection reason')
    .action(async (deviceId, options) => {
      const dp = new DevicePairing({ gatewayUrl: options.gateway });
      const result = await dp.rejectDevice(deviceId, options.reason);
      if (result.success) {
        console.log(`\n✅ Device ${deviceId} rejected!\n`);
      } else {
        console.log(`\n❌ Failed to reject device: ${result.error}\n`);
        process.exit(1);
      }
    });

  // duck devices rotate <deviceId>
  cmd
    .command('rotate <deviceId>')
    .description('Rotate device token (disconnect + new token)')
    .option('-g, --gateway <url>', 'Gateway URL')
    .option('-r, --reason <reason>', 'Rotation reason')
    .option('--no-notify', 'Do not notify device')
    .action(async (deviceId, options) => {
      const dp = new DevicePairing({ gatewayUrl: options.gateway });
      const result = await dp.rotateDeviceToken({
        deviceId,
        reason: options.reason,
        notifyDevice: options.notify !== false,
      });
      if (result.success) {
        console.log(`\n✅ Token rotated for ${deviceId}!`);
        if (result.newToken) {
          console.log(`   New token: ${result.newToken.substring(0, 8)}...`);
        }
        console.log();
      } else {
        console.log(`\n❌ Failed to rotate token: ${result.error}\n`);
        process.exit(1);
      }
    });

  // duck devices revoke <deviceId>
  cmd
    .command('revoke <deviceId>')
    .description('Revoke and remove a device')
    .option('-g, --gateway <url>', 'Gateway URL')
    .option('-r, --reason <reason>', 'Revocation reason')
    .action(async (deviceId, options) => {
      const dp = new DevicePairing({ gatewayUrl: options.gateway });
      const result = await dp.revokeDevice(deviceId, options.reason);
      if (result.success) {
        console.log(`\n✅ Device ${deviceId} revoked!\n`);
      } else {
        console.log(`\n❌ Failed to revoke device: ${result.error}\n`);
        process.exit(1);
      }
    });

  // duck devices token (generate pairing token)
  cmd
    .command('token')
    .description('Generate a new device pairing token')
    .option('-g, --gateway <url>', 'Gateway URL')
    .option('-l, --label <label>', 'Token label')
    .action(async (options) => {
      const dp = new DevicePairing({ gatewayUrl: options.gateway });
      const result = await dp.generatePairingToken(options.label);
      if (result.success) {
        console.log(`\n🔑 Pairing token generated!`);
        if (result.token) console.log(`   Token: ${result.token}`);
        if (result.expiresAt) console.log(`   Expires: ${result.expiresAt}`);
        console.log(`\n   Scan with companion app or use: duck qr --token ${result.token}\n`);
      } else {
        console.log(`\n❌ Failed to generate token: ${result.error}\n`);
        process.exit(1);
      }
    });

  return cmd;
}

export default createDevicesCommand;
