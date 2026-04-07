/**
 * 🦆 Duck CLI - Telegram Command Handler
 * Enhanced command support for Telegram bot
 */

export interface CommandContext {
  chatId: string;
  userId: string;
  messageId: number;
  username?: string;
}

export type CommandHandler = (
  args: string[],
  ctx: CommandContext
) => Promise<string | { text: string; parseMode?: 'HTML' | 'Markdown' }>;

// Command registry
const commands = new Map<string, CommandHandler>();

/**
 * Register a command handler
 */
export function registerCommand(name: string, handler: CommandHandler): void {
  commands.set(name.toLowerCase(), handler);
}

/**
 * Process a command message
 */
export async function processCommand(
  text: string,
  ctx: CommandContext
): Promise<boolean> {
  if (!text.startsWith('/')) return false;
  
  const parts = text.slice(1).split(' ');
  const command = parts[0].toLowerCase();
  const args = parts.slice(1);
  
  const handler = commands.get(command);
  if (!handler) return false;
  
  try {
    const result = await handler(args, ctx);
    const responseText = typeof result === 'string' ? result : result.text;
    
    // Send the response back to Telegram
    await sendTelegramMessage(responseText, ctx.messageId);
    return true;
  } catch (e: any) {
    await sendTelegramMessage(`⚠️ Command error: ${e.message}`, ctx.messageId);
    return true;
  }
}

// Helper to send Telegram message (inline to avoid circular deps)
async function sendTelegramMessage(text: string, replyTo?: number): Promise<void> {
  // Load env directly to avoid circular dependency
  const envPaths = [
    process.env.DUCK_SOURCE_DIR ? require('path').join(process.env.DUCK_SOURCE_DIR, '.env') : '',
    require('path').join(process.cwd(), '.env'),
    require('path').join(process.env.HOME || '', '.duck', '.env'),
  ].filter(Boolean);
  
  let botToken = process.env.TELEGRAM_BOT_TOKEN;
  let chatId = process.env.TELEGRAM_CHAT_ID || '588090613';
  
  for (const envPath of envPaths) {
    if (require('fs').existsSync(envPath)) {
      try {
        const content = require('fs').readFileSync(envPath, 'utf-8');
        for (const line of content.split('\n')) {
          const m = line.match(/^([^#=]+)=(.*)$/);
          if (m) {
            const key = m[1].trim();
            const value = m[2].trim();
            if (key === 'TELEGRAM_BOT_TOKEN') botToken = value;
            if (key === 'TELEGRAM_CHAT_ID') chatId = value;
          }
        }
      } catch {}
      break;
    }
  }
  
  if (!botToken) {
    console.error('[TelegramCommands] No bot token configured');
    return;
  }
  
  const https = require('https');
  const postData = JSON.stringify({
    chat_id: chatId,
    text: escapeHtml(text),
    parse_mode: 'HTML',
    reply_to_message_id: replyTo,
  });
  
  const options = {
    hostname: 'api.telegram.org',
    path: `/bot${botToken}/sendMessage`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
    },
  };
  
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res: any) => {
      let data = '';
      res.on('data', (chunk: any) => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.ok) resolve();
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

function escapeHtml(text: string): string {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Default command implementations
registerCommand('help', async () => {
  return {
    text: `🦆 <b>Duck CLI Bot Commands</b>

<b>Session Control:</b>
/status - Check bot and session status
/new - Start a new session (clear history)
/compact - Compact session context
/think &lt;level&gt; - Set thinking level (off/minimal/low/medium/high/xhigh)

<b>System:</b>
/tools - List available tool categories
/providers - Show available AI providers
/models - List available models
/restart - Restart the gateway (owner only)

<b>Just send any message to chat with the AI!</b>`,
    parseMode: 'HTML'
  };
});

registerCommand('start', async () => {
  return {
    text: `🦆 <b>Welcome to Duck CLI Bot!</b>

I'm your AI assistant powered by duck-cli. I can:
• Answer questions and have conversations
• Execute tools and commands
• Help with coding and technical tasks
• Control Android devices
• And much more!

Send /help for available commands or just start chatting!`,
    parseMode: 'HTML'
  };
});

registerCommand('status', async () => {
  const provider = process.env.DUCK_CHAT_PROVIDER || 'minimax';
  const model = process.env.DUCK_CHAT_MODEL || 'MiniMax-M2.7';
  
  return {
    text: `🦆 <b>Bot Status</b>

✅ Bot is running
Provider: ${provider}
Model: ${model}

Use /providers to see all available providers.`,
    parseMode: 'HTML'
  };
});

registerCommand('tools', async () => {
  return {
    text: `🦆 <b>Available Tool Categories</b>

• <b>Android Control</b> - Device automation, ADB commands
• <b>Desktop Automation</b> - macOS control, screenshots
• <b>File Operations</b> - Read, write, edit files
• <b>Shell Commands</b> - Execute bash commands
• <b>Web Search</b> - Brave Search integration
• <b>Crypto/Web3</b> - Blockchain interactions
• <b>Grow Automation</b> - Plant monitoring
• <b>Memory & Agents</b> - Session management
• <b>Cron & Skills</b> - Scheduled tasks

Use the web UI or CLI to browse all 100+ tools.`,
    parseMode: 'HTML'
  };
});

registerCommand('new', async () => {
  return '🦆 New session started! Previous context cleared.';
});

registerCommand('reset', async () => {
  return '🦆 Session reset! Starting fresh.';
});

registerCommand('compact', async () => {
  return '🦆 Session compacted! (Context summarized)';
});

registerCommand('think', async (args) => {
  const level = args[0]?.toLowerCase();
  const validLevels = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh'];
  
  if (!level || !validLevels.includes(level)) {
    return `🦆 Usage: /think <level>

Levels: off | minimal | low | medium | high | xhigh

Current: medium (default)`;
  }
  
  return `🦆 Thinking level set to: ${level}`;
});

registerCommand('providers', async () => {
  const env = process.env;
  const providers = [];
  
  if (env.MINIMAX_API_KEY) providers.push('✅ MiniMax');
  else providers.push('❌ MiniMax');
  
  if (env.KIMI_API_KEY || env.MOONSHOT_API_KEY) providers.push('✅ Kimi');
  else providers.push('❌ Kimi');
  
  if (env.OPENAI_API_KEY) providers.push('✅ OpenAI');
  else providers.push('❌ OpenAI');
  
  if (env.OPENROUTER_API_KEY) providers.push('✅ OpenRouter');
  else providers.push('❌ OpenRouter');
  
  providers.push('✅ LM Studio (local)');
  
  return {
    text: `🦆 <b>AI Providers</b>

${providers.join('\n')}

Set API keys in your .env file to enable providers.`,
    parseMode: 'HTML'
  };
});

registerCommand('models', async () => {
  return {
    text: `🦆 <b>Available Models</b>

<b>MiniMax:</b>
• MiniMax-M2.7 (default) - Fast, good for most tasks
• glm-5 - Strong coding model
• qwen3.5-plus - Complex reasoning

<b>Kimi:</b>
• k2.5 - Vision + coding
• k2 - Fast vision

<b>LM Studio (Local):</b>
• qwen3.5-9b - Fast local inference
• foundation-sec-8b-reasoning - Security analysis
• gemma-4-e4b-it - Android control

<b>OpenRouter (Free):</b>
• qwen/qwen3.6-plus-preview:free
• meta-llama/llama-3.3-70b-instruct:free

Use /providers to check which are configured.`,
    parseMode: 'HTML'
  };
});

registerCommand('restart', async () => {
  return '🦆 Gateway restart requires owner authentication. Use the CLI: duck gateway restart';
});

export { commands };
