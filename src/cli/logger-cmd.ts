import { logger } from '../server/logger.js';
import http from 'http';
import { DEFAULT_MCP_PORT } from '../config/index.js';

/**
 * duck logger status - Show logger status
 */
export async function loggerStatusCommand() {
  const health = logger.getHealth();
  
  console.log('🦆 Logger Status');
  console.log('================');
  console.log(`Uptime: ${Math.floor(health.uptime / 1000 / 60)} minutes`);
  console.log(`Total Logs: ${health.logs.total}`);
  console.log(`Total Errors: ${health.errors.total}`);
  console.log('');
  console.log('Protocol Health:');
  for (const [proto, stats] of Object.entries(health.protocols)) {
    const status = stats.status === 'healthy' ? '✅' : stats.status === 'degraded' ? '⚠️' : '❌';
    console.log(`  ${status} ${proto.toUpperCase()}: ${stats.requests} requests, ${stats.errors} errors`);
  }
}

/**
 * duck logger logs - Show recent logs
 */
export async function loggerLogsCommand(options: { limit?: number; level?: string; protocol?: string }) {
  const logs = logger.getLogs({
    limit: options.limit || 20,
    level: options.level ? parseInt(options.level) : undefined,
    protocol: options.protocol as any
  });
  
  console.log(`🦆 Recent Logs (${logs.length})`);
  console.log('================');
  
  for (const log of logs.slice(-20).reverse()) {
    const timestamp = log.timestamp.split('T')[1].split('.')[0];
    const levelEmoji = log.level === 'ERROR' ? '❌' : log.level === 'WARN' ? '⚠️' : log.level === 'INFO' ? 'ℹ️' : '📝';
    console.log(`${timestamp} ${levelEmoji} [${log.protocol}] ${log.component}: ${log.message}`);
  }
}

/**
 * duck logger errors - Show errors
 */
export async function loggerErrorsCommand(options: { unresolved?: boolean; protocol?: string }) {
  const errors = logger.getErrors(
    options.protocol as any,
    options.unresolved
  );
  
  console.log(`🦆 Errors (${errors.length})`);
  console.log('================');
  
  if (errors.length === 0) {
    console.log('No errors!');
    return;
  }
  
  for (const error of errors.slice(0, 20)) {
    const timestamp = error.timestamp.split('T')[1].split('.')[0];
    const resolved = error.resolved ? '✅' : '❌';
    console.log(`${timestamp} ${resolved} [${error.protocol}] ${error.component}: ${error.message}`);
    if (error.stack) {
      console.log('  Stack:', error.stack.split('\n')[1]?.trim() || 'No stack');
    }
  }
}

/**
 * duck logger tail - Stream logs in real-time via HTTP
 */
export async function loggerTailCommand(port: number = DEFAULT_MCP_PORT) {
  console.log(`🦆 Tailing logs from http://localhost:${port}/logs (Ctrl+C to stop)`);
  console.log('');
  
  let lastCount = 0;
  const interval = setInterval(async () => {
    try {
      const logs = await new Promise<string>((resolve, reject) => {
        http.get(`http://localhost:${port}/logs?limit=5`, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => resolve(data));
        }).on('error', reject);
      });
      
      const parsed = JSON.parse(logs);
      if (Array.isArray(parsed) && parsed.length > lastCount) {
        const newLogs = parsed.slice(-(parsed.length - lastCount));
        for (const log of newLogs.reverse()) {
          const timestamp = log.timestamp.split('T')[1].split('.')[0];
          const levelEmoji = log.level === 'ERROR' ? '❌' : log.level === 'WARN' ? '⚠️' : log.level === 'INFO' ? 'ℹ️' : '📝';
          console.log(`${timestamp} ${levelEmoji} [${log.protocol}] ${log.component}: ${log.message}`);
        }
        lastCount = parsed.length;
      }
    } catch (e) {
      // Server might not be running
    }
  }, 1000);
  
  process.on('SIGINT', () => {
    clearInterval(interval);
    console.log('\nStopped.');
    process.exit(0);
  });
}

/**
 * Remote logger status via HTTP
 */
export async function remoteLoggerStatus(host: string, port: number) {
  return new Promise((resolve, reject) => {
    http.get(`http://${host}:${port}/health`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const health = JSON.parse(data);
          console.log(`🦆 Remote Logger (${host}:${port})`);
          console.log(`Uptime: ${Math.floor(health.uptime / 1000 / 60)} minutes`);
          console.log(`Errors: ${health.errors.total}`);
          resolve(health);
        } catch (e) {
          reject(new Error('Invalid response'));
        }
      });
    }).on('error', reject);
  });
}