/**
 * 🦆 Duck CLI - Telegram Plugin
 * Full duplex Telegram bot - sends AND receives messages
 * 
 * Usage:
 *   duck telegram test        - Send test message to configured chat ID
 *   duck telegram start       - Start Telegram bot (continuous polling)
 *   duck telegram send <msg>  - Send a message to the configured chat ID
 */

import https from 'https';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { spawn } from 'child_process';

// ─── Env Loading ────────────────────────────────────────────────────────────────

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = { ...process.env };
  const envPaths = [
    process.env.DUCK_SOURCE_DIR ? join(process.env.DUCK_SOURCE_DIR, '.env') : '',
    process.env.DUCK_SOURCE_DIR ? join(process.env.DUCK_SOURCE_DIR, '..', '.env') : '',
    join(process.cwd(), '.env'),
    join(process.cwd(), '..', '.env'),
    join(process.env.HOME || '', '.duck', '.env'),
  ].filter(Boolean);
  for (const envPath of envPaths) {
    if (existsSync(envPath)) {
      try {
        const content = readFileSync(envPath, 'utf-8');
        for (const line of content.split('\n')) {
          const m = line.match(/^([^#=]+)=(.*)$/);
          if (m) env[m[1].trim()] = m[2].trim();
        }
      } catch {}
      break;
    }
  }
  return env;
}

function getConfig() {
  const env = loadEnv();
  const botToken = env.TELEGRAM_BOT_TOKEN;
  const chatId = env.TELEGRAM_CHAT_ID || '588090613';
  if (!botToken) {
    throw new Error(
      'TELEGRAM_BOT_TOKEN not set.\n' +
      'Set it in .env or as an environment variable:\n' +
      '  TELEGRAM_BOT_TOKEN=8296473333:AAENFYdpNdQEegzIWIY-tZHq6SAULm9nzHQ'
    );
  }
  return { botToken, chatId };
}

// ─── HTML Escape ───────────────────────────────────────────────────────────────

function escapeHtml(text: string): string {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ─── Telegram API Helpers ──────────────────────────────────────────────────────

function telegramRequest(method: string, body: Record<string, any> = {}): Promise<any> {
  return new Promise((resolve, reject) => {
    const { botToken } = getConfig();
    const postData = JSON.stringify(body);
    const options: https.RequestOptions = {
      hostname: 'api.telegram.org',
      path: `/bot${botToken}/${method}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.ok) resolve(parsed.result);
          else reject(new Error(parsed.description || 'Telegram API error'));
        } catch (e: any) {
          reject(new Error(`Failed to parse response: ${e.message}`));
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function sendMessage(text: string, replyTo?: number): Promise<void> {
  const { botToken, chatId } = getConfig();
  const payload: any = {
    chat_id: chatId,
    text: escapeHtml(text),
    parse_mode: 'HTML',
  };
  if (replyTo) payload.reply_to_message_id = replyTo;
  await telegramRequest('sendMessage', payload);
}

async function getMe(): Promise<{ username: string; first_name: string }> {
  return telegramRequest('getMe');
}

async function getUpdates(offset: number = 0, timeout: number = 30): Promise<any[]> {
  return telegramRequest('getUpdates', { offset, timeout });
}

// ─── Duck CLI Gateway Forwarder ──────────────────────────────────────────────

async function forwardToGateway(message: string): Promise<string> {
  return new Promise((resolve) => {
    // Find duck binary - check multiple possible locations
    const duckBin = process.env.DUCK_BINARY 
      || findDuckBinary();
    
    if (!duckBin) {
      resolve('🦆 Duck CLI not found. Install duck-cli first: https://github.com/Franzferdinan51/duck-cli');
      return;
    }
    
    // Escape message for shell
    const escapedMsg = message.replace(/[\\"`'${}]/g, '\\$&').replace(/\n/g, '\\n');
    
    const child = spawn(duckBin, ['run', message], {
      cwd: process.env.DUCK_SOURCE_DIR || process.cwd(),
      env: { ...process.env },
      timeout: 45000,
    });
    
    let stdout = '';
    let stderr = '';
    
    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });
    
    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });
    
    child.on('close', (code) => {
      if (stdout.trim()) {
        // Return last 1500 chars (Telegram limit per message)
        const result = stdout.trim().slice(-1500);
        resolve(result);
      } else if (stderr.trim()) {
        resolve('🦆 ' + stderr.trim().slice(-1500));
      } else {
        resolve('🦆 Processed (no output)');
      }
    });
    
    child.on('error', (err) => {
      resolve(`🦆 Error running duck: ${err.message}`);
    });
    
    // Timeout after 45 seconds
    setTimeout(() => {
      child.kill();
      resolve('🦆 Request timed out (45s limit)');
    }, 45000);
  });
}

function findDuckBinary(): string | undefined {
  // Check DUCK_SOURCE_DIR first
  if (process.env.DUCK_SOURCE_DIR) {
    const inSource = join(process.env.DUCK_SOURCE_DIR, 'duck');
    if (existsSync(inSource)) return inSource;
  }
  // Check where the Go binary usually is (portable: use HOME env var)
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

// ─── Commands ─────────────────────────────────────────────────────────────────

export async function telegramTest(): Promise<void> {
  const { botToken, chatId } = getConfig();
  console.log('📱 Telegram Test');
  console.log('================');
  console.log(`Chat ID: ${chatId}`);
  try {
    const me = await getMe();
    console.log(`Bot: @${me.username} (${me.first_name})`);
    console.log('');
    console.log('🧪 Sending test message...');
    await sendMessage('🦆 Duck CLI Telegram plugin is working!\n\nSend me any message and I will respond.');
    console.log('✅ Test message sent successfully!');
  } catch (e: any) {
    console.error('❌ Failed:', e.message);
    process.exit(1);
  }
}

export async function telegramSend(args: string[]): Promise<void> {
  const message = args.join(' ');
  if (!message) {
    console.log('Usage: duck telegram send <message>');
    return;
  }
  try {
    await sendMessage(message);
    console.log(`✅ Message sent`);
  } catch (e: any) {
    console.error(`❌ Failed: ${e.message}`);
    process.exit(1);
  }
}

// ─── Continuous Polling Loop ──────────────────────────────────────────────────

export async function telegramStart(): Promise<void> {
  const { chatId } = getConfig();

  console.log('📱 Starting Duck CLI Telegram Bot');
  console.log('================================');
  console.log(`Listening for messages in chat: ${chatId}`);
  console.log('Press Ctrl+C to stop\n');

  try {
    const me = await getMe();
    console.log(`✅ Logged in as @${me.username}`);
  } catch (e: any) {
    console.error(`❌ Login failed: ${e.message}`);
    process.exit(1);
  }

  // Send startup message
  try {
    await sendMessage(
      '🦆 <b>Duck CLI Telegram Bot is online!</b>\n\n' +
      'I am connected to duck-cli. Send me any message and I will forward it to the AI.\n' +
      'Type /help for commands.'
    );
    console.log('✅ Startup notification sent\n');
  } catch (e: any) {
    console.error(`⚠️  Could not send startup message: ${e.message}`);
  }

  let updateOffset = 0;
  let running = true;

  const shutdown = () => {
    running = false;
    console.log('\n🛑 Bot stopped');
    sendMessage('🦆 Duck CLI Telegram bot stopped.').catch(() => {});
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  console.log('🔄 Polling for messages...\n');

  while (running) {
    try {
      const updates = await getUpdates(updateOffset, 30);

      for (const update of updates) {
        if (!update.message) continue;
        const msg = update.message;
        const text = msg.text?.trim();
        const msgChatId = String(msg.chat.id);

        // Only respond to the configured chat
        if (msgChatId !== chatId) continue;

        // Skip commands for now
        if (text?.startsWith('/')) {
          if (text === '/help' || text === '/start') {
            await sendMessage(
              '🦆 <b>Duck CLI Bot Commands:</b>\n\n' +
              '/help - Show this message\n' +
              '/status - Check bot status\n' +
              '/tools - List available tools\n' +
              '<b>Or just send any message!</b>',
              msg.message_id
            );
          } else if (text === '/status') {
            await sendMessage('🦆 Bot is running and connected to duck-cli!', msg.message_id);
          } else if (text === '/tools') {
            await sendMessage(
              '🦆 Available categories:\n' +
              '• Android control\n• Desktop automation\n• Crypto / Web3\n• Grow automation\n• Memory & agents\n' +
              '• Cron & skills\n' +
              'Use the Tools tab in DuckBot New app to browse all 100+ tools.',
              msg.message_id
            );
          } else {
            await sendMessage(`Unknown command: ${text}\nSend /help for available commands.`, msg.message_id);
          }
          updateOffset = update.update_id + 1;
          continue;
        }

        if (!text) continue;

        console.log(`📩 From ${msg.from?.first_name || 'user'}: ${text}`);

        // Typing indicator
        try {
          await telegramRequest('sendChatAction', { chat_id: msgChatId, action: 'typing' });
        } catch {}

        try {
          const response = await forwardToGateway(text);
          // Telegram message length limit
          const chunks = response.match(/.{1,4096}/g) || [response];
          for (const chunk of chunks) {
            await sendMessage(chunk, msg.message_id);
          }
          console.log(`📤 Replied (${chunks.length} message(s))`);
        } catch (e: any) {
          console.error(`❌ Reply failed: ${e.message}`);
          await sendMessage(`⚠️ Error processing your message: ${e.message}`, msg.message_id);
        }

        updateOffset = update.update_id + 1;
      }
    } catch (e: any) {
      console.error(`⚠️  Polling error: ${e.message}`);
      await new Promise(r => setTimeout(r, 5000)); // Wait before retry on error
    }
  }
}

// ─── CLI Entry ───────────────────────────────────────────────────────────────

export async function telegramCommand(args: string[]): Promise<void> {
  const subcommand = args[0] || 'help';

  switch (subcommand) {
    case 'test':
      await telegramTest();
      break;
    case 'send':
      await telegramSend(args.slice(1));
      break;
    case 'start':
      await telegramStart();
      break;
    case 'help':
    default:
      console.log(`
📱 Telegram Plugin for Duck CLI
===============================

Usage: duck telegram <command>

Commands:
  test           Send a test message to verify your Telegram setup
  send <msg>     Send a message to your configured Telegram chat
  start          Start the Telegram bot (continuous polling - FULL DUPLEX)

Environment Variables (set in .env or shell):
  TELEGRAM_BOT_TOKEN    Your Telegram bot token (from @BotFather)
  TELEGRAM_CHAT_ID      Your Telegram chat ID (default: 588090613)

Example:
  duck telegram test
  duck telegram send "Hello from duck-cli!"
  duck telegram start     # ← This makes the bot RESPOND to messages

The bot will connect to duck-cli/OpenClaw gateway at localhost:18789
and forward all messages for AI responses.
`);
  }
}
