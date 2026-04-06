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
import { existsSync, readFileSync, writeFileSync, createReadStream } from 'fs';
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
      } catch (e) {
        console.warn(`[Telegram] Failed to read env file ${envPath}:`, e instanceof Error ? e.message : e);
      }
      break;
    }
  }
  return env;
}

const UPDATE_FILE = '/tmp/duck-cli-telegram-update-id.txt';

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

function sanitizeTelegramReply(text: string): string {
  const filtered = String(text)
    .replace(/<think>[\s\S]*?<\/think>/g, '')
    .replace(/<start_ck>[\s\S]*?<\/end_ck>/g, '')
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .filter(line => !(
      line.startsWith('◇ injected env') ||
      line.startsWith('[Provider]') ||
      line.startsWith('[Router') ||
      line.startsWith('[LMStudio]') ||
      line.startsWith('[MetaPlanner]') ||
      line.startsWith('🦆 Duck Agent shutting down') ||
      line.startsWith('Total cost:') ||
      line.startsWith('Interactions:') ||
      line.startsWith('Success rate:') ||
      line.startsWith('Sessions:') ||
      line.startsWith('Learned skills:') ||
      line.startsWith('Cron jobs:') ||
      line.startsWith('Active subagents:') ||
      line.startsWith('✅ Duck Agent stopped')
    ))
    .join('\n')
    .replace(/\[TOOL:.*?\]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return filtered || '🦆 Processed, but no clean reply was returned.';
}

function loadUpdateOffset(): number {
  if (!existsSync(UPDATE_FILE)) return 0;
  try {
    return parseInt(readFileSync(UPDATE_FILE, 'utf-8').trim(), 10) || 0;
  } catch {
    return 0;
  }
}

function saveUpdateOffset(offset: number): void {
  try {
    writeFileSync(UPDATE_FILE, String(offset));
  } catch {}
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

/**
 * Send a message. Returns the Telegram message_id so callers can edit it.
 */
async function sendMessage(text: string, replyTo?: number): Promise<number | undefined> {
  const { botToken, chatId } = getConfig();
  const payload: any = {
    chat_id: chatId,
    text: escapeHtml(text),
    parse_mode: 'HTML',
  };
  if (replyTo) payload.reply_to_message_id = replyTo;
  const result = await telegramRequest('sendMessage', payload);
  return (result as any)?.message_id;
}

/**
 * Edit an existing Telegram message in-place.
 *
 * Telegram allows editing messages within 48 hours of sending.
 * Used for the draft/edit-in-place pattern during long-running orchestrated replies:
 *   1. Send initial "processing..." placeholder
 *   2. Progressively edit as chunks arrive
 *   3. Final edit replaces placeholder with clean response
 */
async function editMessage(messageId: number, text: string): Promise<void> {
  const { botToken, chatId } = getConfig();
  await telegramRequest('editMessageText', {
    chat_id: chatId,
    message_id: messageId,
    text: escapeHtml(text),
    parse_mode: 'HTML',
  });
}

async function sendVoice(filePath: string, caption?: string, replyTo?: number): Promise<void> {
  const { botToken, chatId } = getConfig();
  return new Promise((resolve, reject) => {
    const boundary = '----DuckCLIBoundary' + Date.now();
    const fileData = readFileSync(filePath);
    const filename = filePath.split('/').pop() || 'voice.mp3';

    // Build multipart form-data body manually
    let body = '';
    body += `--${boundary}\r\n`;
    body += `Content-Disposition: form-data; name="chat_id"\r\n\r\n${chatId}\r\n`;

    if (replyTo) {
      body += `--${boundary}\r\n`;
      body += `Content-Disposition: form-data; name="reply_to_message_id"\r\n\r\n${replyTo}\r\n`;
    }

    if (caption) {
      body += `--${boundary}\r\n`;
      body += `Content-Disposition: form-data; name="caption"\r\n\r\n${escapeHtml(caption)}\r\n`;
    }

    body += `--${boundary}\r\n`;
    body += `Content-Disposition: form-data; name="voice"; filename="${filename}"\r\n`;
    body += `Content-Type: audio/mpeg\r\n\r\n`;

    const bodyStart = Buffer.from(body, 'utf-8');
    const bodyEnd = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf-8');
    const fullBody = Buffer.concat([bodyStart, fileData, bodyEnd]);

    const options: https.RequestOptions = {
      hostname: 'api.telegram.org',
      path: `/bot${botToken}/sendVoice`,
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': fullBody.length,
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.ok) resolve();
          else reject(new Error(parsed.description || 'Telegram sendVoice error'));
        } catch (e: any) {
          reject(new Error(`Failed to parse sendVoice response: ${e.message}`));
        }
      });
    });
    req.on('error', reject);
    req.write(fullBody);
    req.end();
  });
}

async function getMe(): Promise<{ username: string; first_name: string }> {
  return telegramRequest('getMe');
}

async function getUpdates(offset: number = 0, timeout: number = 30): Promise<any[]> {
  return telegramRequest('getUpdates', { offset, timeout });
}

// ─── Duck CLI Gateway Forwarder ──────────────────────────────────────────────

/**
 * Callback for progressive chunk delivery during long-running tasks.
 * Fires each time stdout receives new data from the subprocess,
 * enabling edit-in-place Telegram replies instead of silent waiting.
 */
type ChunkCallback = (rawChunk: string, runningText: string) => void;

interface ForwardOptions {
  /** Called with each stdout chunk for progressive Telegram updates */
  onChunk?: ChunkCallback;
}

/**
 * Forward a user message to duck-cli and return the response.
 *
 * For long-running orchestrated replies this supports a streaming callback (onChunk)
 * so the Telegram message can be progressively edited as output arrives, giving the
 * user live feedback instead of silent waiting.
 *
 * @param message   The user's text message
 * @param chatId    Telegram chat ID (used for typing keepalive)
 * @param opts      Optional: onChunk callback for progressive updates
 */
async function forwardToGateway(
  message: string,
  chatId?: string,
  opts: ForwardOptions = {},
): Promise<string> {
  return new Promise((resolve) => {
    const duckBin = process.env.DUCK_BINARY || findDuckBinary();
    if (!duckBin) {
      resolve('🦆 Duck CLI not found. Install duck-cli first: https://github.com/Franzferdinan51/duck-cli');
      return;
    }

    // Support both DUCK_TIMEOUT_MS (general override) and DUCK_TELEGRAM_REPLY_TIMEOUT_MS (Telegram-specific).
    // DUCK_TELEGRAM_REPLY_TIMEOUT_MS takes priority (default 5 min).
    const envGeneral   = parseInt(process.env.DUCK_TIMEOUT_MS || '0', 10);
    const envTelegram  = parseInt(process.env.DUCK_TELEGRAM_REPLY_TIMEOUT_MS || '0', 10);
    const timeoutMs    = envTelegram > 0 ? envTelegram : (envGeneral > 0 ? envGeneral : 300000);

    const child = spawn(duckBin, ['run', message], {
      cwd: process.env.DUCK_SOURCE_DIR || process.cwd(),
      env: { ...process.env, DUCK_BOT_MODE: '1' },
    });

    let stdout = '';
    let stderr = '';
    let finished = false;

    // Periodic typing keepalive every 4s — Telegram shows "typing..." to the user.
    // Critical for long-running orchestrated tasks where the user would otherwise
    // see nothing until the final response arrives (which can take 10+ seconds).
    const typingInterval = chatId
      ? setInterval(() => {
          telegramRequest('sendChatAction', { chat_id: chatId, action: 'typing' }).catch(() => {});
        }, 4000)
      : undefined;

    const finish = (text: string) => {
      if (finished) return;
      finished = true;
      if (typingInterval) clearInterval(typingInterval);
      resolve(text);
    };

    // Stream stdout chunks to callback for progressive Telegram reply updates.
    // Even when the AI model returns a single blob, intermediate tool output
    // (shell commands, file operations) arrives incrementally and benefits from this.
    child.stdout?.on('data', (data: Buffer) => {
      const chunk = data.toString();
      stdout += chunk;
      if (opts.onChunk) {
        const runningText = sanitizeTelegramReply(stdout);
        opts.onChunk(chunk, runningText);
      }
    });

    child.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    child.on('close', (_code: number) => {
      if (stdout.trim()) {
        finish(sanitizeTelegramReply(stdout));
      } else if (stderr.trim()) {
        finish('🦆 ' + sanitizeTelegramReply(stderr).slice(-1500));
      } else {
        finish('🦆 Processed (no output)');
      }
    });

    child.on('error', (err: Error) => {
      finish(`🦆 Error running duck: ${err.message}`);
    });

    setTimeout(() => {
      child.kill('SIGTERM');
      setTimeout(() => {
        try { child.kill('SIGKILL'); } catch { /* ignore */ }
      }, 3000);
      finish(`🦆 Request timed out after ${Math.round(timeoutMs / 1000)}s`);
    }, timeoutMs);
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

  // No startup message by default. Restarts should stay quiet for users.
  console.log('✅ Telegram bot ready\n');

  let updateOffset = loadUpdateOffset();
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
          saveUpdateOffset(updateOffset);
          continue;
        }

        if (!text) continue;

        console.log(`📩 From ${msg.from?.first_name || 'user'}: ${text}`);

        // ── DRAFT / EDIT-IN-PLACE PATTERN ──────────────────────────────────
        // Send an immediate "processing" placeholder so the user gets instant
        // acknowledgment. Then progressively edit it as chunks arrive.
        // Finally replace it with the clean final response.
        // ────────────────────────────────────────────────────────────────────
        const PLACEHOLDER = '🧠 <i>Processing your request...</i>';
        let replyMsgId: number | undefined;
        try {
          const result = await telegramRequest('sendMessage', {
            chat_id: msgChatId,
            text: escapeHtml(PLACEHOLDER),
            parse_mode: 'HTML',
            reply_to_message_id: msg.message_id,
          }) as any;
          replyMsgId = result?.message_id;
        } catch {
          // Non-fatal: continue without progressive updates
        }

        try {
          const response = await forwardToGateway(text, msgChatId, {
            // Progressive edit: update Telegram message as chunks arrive.
            // Telegram edit limit is 4096 chars; show trailing chars if over limit.
            onChunk: async (_rawChunk: string, runningText: string) => {
              if (!replyMsgId) return;
              const editText = runningText.length > 4096
                ? '📝 ' + runningText.slice(-4093)
                : (runningText || '📝 Processing...');
              try {
                await editMessage(replyMsgId, editText);
              } catch {
                // Non-fatal: message may be >48h old or hit flood control
              }
            },
          });

          // Extract [AUDIO:filepath] markers and send voice messages
          const audioMarkers = response.match(/\[AUDIO:([^\]]+)\]/g) || [];
          for (const marker of audioMarkers) {
            const filePath = marker.match(/\[AUDIO:([^\]]+)\]/)?.[1];
            if (filePath) {
              try {
                await sendVoice(filePath, undefined, msg.message_id);
                console.log(`📤 Sent voice message: ${filePath}`);
              } catch (e: any) {
                console.error(`❌ Voice send failed: ${e.message}`);
              }
            }
          }

          // Strip [AUDIO:filepath] markers from display text
          const displayText = response.replace(/\[AUDIO:[^\]]+\]/g, '').trim();

          if (replyMsgId) {
            // We have a draft — replace it with the final response
            if (displayText.length <= 4096) {
              // Final text fits in one message — edit in-place (clean single message)
              await editMessage(replyMsgId, displayText || '🦆 Done.');
              console.log(`📤 Replied (1 message, edited in-place)`);
            } else {
              // Final text exceeds edit limit — delete draft, send as normal chunks
              try {
                await telegramRequest('deleteMessage', {
                  chat_id: msgChatId,
                  message_id: replyMsgId,
                });
              } catch { /* ignore */ }
              const chunks = displayText.match(/.{1,4096}/g) || [displayText];
              for (const chunk of chunks) {
                await sendMessage(chunk, msg.message_id);
              }
              console.log(`📤 Replied (${chunks.length} message(s), draft replaced)`);
            }
          } else {
            // No draft possible — fall back to normal multi-chunk reply
            const chunks = displayText.match(/.{1,4096}/g) || [displayText];
            for (const chunk of chunks) {
              await sendMessage(chunk, msg.message_id);
            }
            console.log(`📤 Replied (${chunks.length} message(s))`);
          }
        } catch (e: any) {
          console.error(`❌ Reply failed: ${e.message}`);
          // Clean up placeholder if it was sent
          if (replyMsgId) {
            try {
              await telegramRequest('deleteMessage', {
                chat_id: msgChatId,
                message_id: replyMsgId,
              });
            } catch { /* ignore */ }
          }
          await sendMessage(`⚠️ Error processing your message: ${e.message}`, msg.message_id);
        }

        updateOffset = update.update_id + 1;
        saveUpdateOffset(updateOffset);
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
  DUCK_TELEGRAM_REPLY_TIMEOUT_MS  Max wait for a reply (default: 300000 = 5 min)

Example:
  duck telegram test
  duck telegram send "Hello from duck-cli!"
  duck telegram start     # ← This makes the bot RESPOND to messages

The bot will connect to duck-cli via the 'duck run' command and
forward all messages for AI responses.
`);
  }
}
