/**
 * 🦆 Duck CLI - Telegram Plugin
 * Simple Telegram bot integration for duck-cli
 * 
 * Usage:
 *   duck telegram test        - Send test message to configured chat ID
 *   duck telegram start       - Start Telegram bot (continuous polling)
 *   duck telegram send <msg>  - Send a message to the configured chat ID
 */

import https from 'https';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

// Load env from .env file if present
function loadEnv(): Record<string, string> {
  const env: Record<string, string> = { ...process.env };
  
  // Try to load from .env in various locations
  const envPaths = [
    // DUCK_SOURCE_DIR is set by the Go wrapper (points to where dist/ is)
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
  const chatId = env.TELEGRAM_CHAT_ID || '588090613'; // Default to Duckets' chat ID
  
  if (!botToken) {
    throw new Error(
      'TELEGRAM_BOT_TOKEN not set.\n' +
      'Set it in .env or as an environment variable:\n' +
      '  TELEGRAM_BOT_TOKEN=8296473333:AAENFYdpNdQEegzIWIY-tZHq6SAULm9nzHQ'
    );
  }
  
  return { botToken, chatId };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

async function sendMessage(botToken: string, chatId: string, text: string): Promise<void> {
  const escapedText = escapeHtml(text);
  
  const postData = JSON.stringify({
    chat_id: chatId,
    text: escapedText,
    parse_mode: 'HTML',
  });
  
  return new Promise((resolve, reject) => {
    const options: https.RequestOptions = {
      hostname: 'api.telegram.org',
      path: `/bot${botToken}/sendMessage`,
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
          if (parsed.ok) {
            resolve();
          } else {
            reject(new Error(parsed.description || 'Telegram API error'));
          }
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

async function getMe(botToken: string): Promise<{ username: string; first_name: string }> {
  return new Promise((resolve, reject) => {
    https.get(`https://api.telegram.org/bot${botToken}/getMe`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.ok) {
            resolve(parsed.result);
          } else {
            reject(new Error(parsed.description));
          }
        } catch (e: any) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

export async function telegramTest(): Promise<void> {
  const { botToken, chatId } = getConfig();
  
  console.log('📱 Telegram Test');
  console.log('================');
  console.log(`Chat ID: ${chatId}`);
  
  try {
    const me = await getMe(botToken);
    console.log(`Bot: @${me.username} (${me.first_name})`);
    console.log('');
    console.log('🧪 Sending test message...');
    
    await sendMessage(botToken, chatId, '🦆 Duck CLI is running!\n\nTest message from duck-cli Telegram plugin.');
    
    console.log('✅ Test message sent successfully!');
    console.log(`   Sent to chat ID: ${chatId}`);
  } catch (e: any) {
    console.error('❌ Failed to send test message:');
    console.error(`   ${e.message}`);
    process.exit(1);
  }
}

export async function telegramSend(args: string[]): Promise<void> {
  const { botToken, chatId } = getConfig();
  const message = args.join(' ');
  
  if (!message) {
    console.log('Usage: duck telegram send <message>');
    return;
  }
  
  try {
    await sendMessage(botToken, chatId, message);
    console.log(`✅ Message sent to ${chatId}`);
  } catch (e: any) {
    console.error(`❌ Failed: ${e.message}`);
    process.exit(1);
  }
}

export async function telegramStart(): Promise<void> {
  const { botToken, chatId } = getConfig();
  
  console.log('📱 Starting Telegram Bot');
  console.log('======================');
  
  try {
    const me = await getMe(botToken);
    console.log(`✅ Logged in as @${me.username}`);
    console.log(`📍 Listening for messages...`);
    console.log(`   Chat ID: ${chatId}`);
    console.log('');
    console.log('Press Ctrl+C to stop\n');
    
    // For now, just verify connection with a startup message
    await sendMessage(botToken, chatId, `🦆 Duck CLI Telegram bot started!\n\nBot @${me.username} is now running and listening for commands.`);
    console.log('✅ Startup message sent!');
    
    // TODO: Implement continuous polling and agent forwarding
    console.log('');
    console.log('⚠️  Continuous mode not yet implemented.');
    console.log('   Use `duck telegram test` to verify your setup.');
  } catch (e: any) {
    console.error(`❌ Failed to start bot: ${e.message}`);
    process.exit(1);
  }
}

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
  start          Start the Telegram bot (basic mode)

Environment Variables (set in .env or shell):
  TELEGRAM_BOT_TOKEN    Your Telegram bot token (from @BotFather)
  TELEGRAM_CHAT_ID      Your Telegram chat ID (default: 588090613)

Example:
  # First, set your bot token
  export TELEGRAM_BOT_TOKEN=8296473333:AAENFYdpNdQEegzIWIY-tZHq6SAULm9nzHQ
  
  # Test the connection
  duck telegram test
  
  # Send a custom message
  duck telegram send "Hello from duck-cli!"
  
  # Start the bot
  duck telegram start
`);
  }
}
