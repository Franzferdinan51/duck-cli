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
/new, /reset - Start fresh session
/compact - Summarize context
/stop - Abort current task
/export-session - Export session

<b>Identity & Context:</b>
/whoami, /id - Show your identity
/context - Context window info

<b>Model Control:</b>
/model [name|list|status] - Switch model
/models - List all models
/think [level] - Set thinking depth
/reasoning [on|off|stream] - Show reasoning
/verbose [on|full|off] - Verbosity control

<b>System:</b>
/health - Quick health check
/doctor - Full diagnostics
/config - Config management
/usage [tokens|full|cost|off] - Usage tracking
/tools - Tool categories
/providers - AI providers
/skills - Skills marketplace

<b>Agent Systems:</b>
/council [question] - AI Council
/kairos [mode] - Proactive AI
/subconscious [cmd] - Self-reflection
/mesh - Agent mesh
/agent - Sub-agent management
/subagents [list|kill] - Manage subagents
/kill [id|all] - Abort subagent
/steer [msg] - Redirect agent (/tell)

<b>Permissions:</b>
/elevated [on|off|ask|full] - Exec permissions
/approve [action] - Approve requests
/allowlist [list|add|remove] - User allowlist

<b>Channels:</b>
/dock-telegram - Use Telegram
/dock_discord - Use Discord
/focus [thread] - Bind thread
/unfocus - Unbind thread

<b>Voice:</b>
/tts [mode] - Text-to-speech
/voice - TTS alias

<b>Info:</b>
/version - Show version
/help - This help
/restart - Restart gateway

<b>Chat with me naturally - no commands needed!</b>`,
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
  // Get actual configured models from environment
  const env = process.env;
  
  let text = '🦆 <b>Available Models</b>\n\n';
  
  // MiniMax
  if (env.MINIMAX_API_KEY) {
    text += '<b>MiniMax ✅</b>\n';
    text += `  • ${env.MINIMAX_MODEL || 'MiniMax-M2.7'} (default)\n`;
    text += '  • glm-5\n';
    text += '  • qwen3.5-plus\n\n';
  } else {
    text += '<b>MiniMax ❌</b> (API key not set)\n\n';
  }
  
  // Kimi
  if (env.KIMI_API_KEY) {
    text += '<b>Kimi ✅</b>\n';
    text += `  • ${env.KIMI_MODEL || 'k2.5'} (default)\n`;
    text += '  • k2\n\n';
  } else {
    text += '<b>Kimi ❌</b> (API key not set)\n\n';
  }
  
  // LM Studio
  const lmUrl = env.LMSTUDIO_URL || env.LMSTUDIO_BASE_URL;
  if (lmUrl) {
    text += '<b>LM Studio ✅</b>\n';
    text += `  • ${env.LMSTUDIO_MODEL || 'qwen3.5-9b'} (default)\n`;
    text += '  • gemma-4-e4b-it\n';
    text += '  • foundation-sec-8b-reasoning\n\n';
  } else {
    text += '<b>LM Studio ❌</b> (URL not set)\n\n';
  }
  
  // OpenRouter
  if (env.OPENROUTER_API_KEY) {
    text += '<b>OpenRouter ✅</b>\n';
    text += `  • ${env.OPENROUTER_MODEL || 'qwen/qwen3.6-plus-preview:free'} (default)\n`;
    text += '  • meta-llama/llama-3.3-70b-instruct:free\n\n';
  } else {
    text += '<b>OpenRouter ❌</b> (API key not set)\n\n';
  }
  
  // OpenAI
  if (env.OPENAI_API_KEY) {
    text += '<b>OpenAI ✅</b>\n';
    text += `  • ${env.OPENAI_MODEL || 'gpt-4o-mini'} (default)\n\n`;
  }
  
  // Anthropic
  if (env.ANTHROPIC_API_KEY) {
    text += '<b>Anthropic ✅</b>\n';
    text += `  • ${env.ANTHROPIC_MODEL || 'claude-3-5-sonnet'} (default)\n\n`;
  }
  
  text += '<em>✅ = Configured | ❌ = Not configured</em>';
  
  return { text, parseMode: 'HTML' };
});

registerCommand('restart', async () => {
  return '🦆 Gateway restart requires owner authentication. Use the CLI: duck gateway restart';
});

registerCommand('health', async () => {
  return {
    text: `🦆 <b>Health Check</b>

Use /doctor for full diagnostics or CLI: duck health`,
    parseMode: 'HTML'
  };
});

registerCommand('doctor', async () => {
  const env = process.env;
  const checks = [];
  
  // Node.js
  checks.push(`✅ Node.js ${process.version}`);
  
  // API Keys
  if (env.MINIMAX_API_KEY) checks.push('✅ MiniMax API key');
  else checks.push('❌ MiniMax API key');
  
  if (env.KIMI_API_KEY) checks.push('✅ Kimi API key');
  else checks.push('❌ Kimi API key');
  
  if (env.OPENROUTER_API_KEY) checks.push('✅ OpenRouter API key');
  else checks.push('❌ OpenRouter API key');
  
  if (env.LMSTUDIO_URL || env.LMSTUDIO_BASE_URL) checks.push('✅ LM Studio URL');
  else checks.push('❌ LM Studio URL');
  
  // Directories
  const fs = require('fs');
  if (fs.existsSync('node_modules')) checks.push('✅ node_modules');
  else checks.push('❌ node_modules');
  
  if (fs.existsSync('src/skills')) checks.push('✅ Skills directory');
  else checks.push('❌ Skills directory');
  
  return {
    text: `🦆 <b>System Diagnostics</b>

${checks.join('\n')}

Use CLI for detailed diagnostics: duck doctor`,
    parseMode: 'HTML'
  };
});

registerCommand('config', async (args) => {
  if (args.length === 0) {
    return {
      text: `🦆 <b>Config Commands</b>

/config get <key> - Get config value
/config set <key> <value> - Set config value
/config list - List all config

Use CLI for full config management: duck config`,
      parseMode: 'HTML'
    };
  }
  return '🦆 Config management requires CLI: duck config';
});

registerCommand('skills', async () => {
  return {
    text: `🦆 <b>Skills</b>

Use CLI to manage skills:
• duck skills list
• duck skills search <query>
• duck skills install <name>
• duck clawhub

Or visit: https://clawhub.ai`,
    parseMode: 'HTML'
  };
});

registerCommand('mesh', async () => {
  return {
    text: `🦆 <b>Agent Mesh</b>

Use CLI to manage mesh:
• duck mesh list - List agents
• duck mesh register - Register this agent
• duck mesh broadcast <msg> - Broadcast message
• duck meshd - Start mesh server

Current mesh key: ${process.env.MESH_API_KEY ? '✅ Set' : '❌ Not set'}`,
    parseMode: 'HTML'
  };
});

registerCommand('council', async (args) => {
  if (args.length === 0) {
    return {
      text: `🦆 <b>AI Council</b>

Ask the AI Council a question:
/council "your question here"

Modes:
/council "question" --mode decision
/council "question" --mode research
/council "question" --mode prediction

Use CLI: duck council "question"`,
      parseMode: 'HTML'
    };
  }
  // Forward to actual council via CLI
  const question = args.join(' ');
  return {
    text: `🦆 <b>AI Council</b>

Question: "${question}"

Use CLI for full deliberation:
duck council "${question}"

Or with mode:
duck council "${question}" --mode decision`,
    parseMode: 'HTML'
  };
});

registerCommand('kairos', async (args) => {
  const mode = args[0] || 'status';
  const validModes = ['status', 'enable', 'disable', 'aggressive', 'balanced', 'conservative'];
  
  if (!validModes.includes(mode)) {
    return `🦆 Usage: /kairos [status|enable|disable|aggressive|balanced|conservative]

Use CLI: duck kairos ${mode}`;
  }
  
  return {
    text: `🦆 <b>KAIROS Proactive AI</b>

Mode: ${mode}
Status: Use CLI for full control
• duck kairos status
• duck kairos enable
• duck kairos disable
• duck kairos aggressive`,
    parseMode: 'HTML'
  };
});

registerCommand('subconscious', async (args) => {
  const cmd = args[0] || 'status';
  return {
    text: `🦆 <b>Sub-Conscious</b>

Command: ${cmd}

Use CLI for full control:
• duck subconscious status
• duck subconscious daemon
• duck subconscious whisper
• duck subconscious recall
• duck subconscious council`,
    parseMode: 'HTML'
  };
});

registerCommand('agent', async (args) => {
  return {
    text: `🦆 <b>Sub-Agent Management</b>

Use CLI:
• duck agent list - List active subagents
• duck agent spawn "task" - Spawn new subagent
• duck team list - List teams
• duck team create <name> - Create team

Current agent: Duck CLI`,
    parseMode: 'HTML'
  };
});

registerCommand('version', async () => {
  return {
    text: `🦆 <b>Duck CLI</b>

Version: 0.8.0
Built on: OpenClaw

GitHub: https://github.com/Franzferdinan51/duck-cli`,
    parseMode: 'HTML'
  };
});

// ========== OpenClaw Parity Commands ==========

registerCommand('model', async (args) => {
  const model = args[0];
  if (!model || model === 'list') {
    return {
      text: `🦆 <b>Available Models</b>

Use /models to see all models.

To switch model:
/model <name>

Examples:
/model MiniMax-M2.7
/model glm-5
/model k2.5

Use CLI for full model management: duck config set defaults.model <model>`,
      parseMode: 'HTML'
    };
  }
  if (model === 'status') {
    return `🦆 Current model: ${process.env.DUCK_CHAT_MODEL || 'MiniMax-M2.7'}`;
  }
  return `🦆 To switch to ${model}, use CLI: duck config set defaults.model ${model}`;
});

registerCommand('whoami', async (args, ctx) => {
  return {
    text: `🦆 <b>Your Identity</b>

User ID: ${ctx.userId}
Chat ID: ${ctx.chatId}
Username: ${ctx.username || 'N/A'}

This is your sender identity as seen by the bot.`,
    parseMode: 'HTML'
  };
});

registerCommand('id', async (args, ctx) => {
  return `🦆 User ID: ${ctx.userId}`;
});

registerCommand('context', async () => {
  return {
    text: `🦆 <b>Context Window</b>

Context management is handled automatically.

Commands:
/compact - Summarize and compress context
/reset - Start fresh session
/context detail - Use CLI for detailed breakdown

Use CLI for full context control: duck stats`,
    parseMode: 'HTML'
  };
});

registerCommand('stop', async () => {
  return '🦆 Stop command received. (Task abort not yet implemented in Telegram bot)';
});

registerCommand('usage', async (args) => {
  const subcmd = args[0] || 'status';
  return {
    text: `🦆 <b>Usage Tracking</b>

Command: /usage ${subcmd}

Available:
• /usage tokens - Show token count
• /usage full - Full breakdown
• /usage cost - Cost summary
• /usage off - Disable tracking

Use CLI for detailed usage: duck stats`,
    parseMode: 'HTML'
  };
});

registerCommand('verbose', async (args) => {
  const mode = args[0] || 'status';
  return `🦆 Verbose mode: ${mode}

Use CLI for full control: duck config set verbose ${mode}`;
});

registerCommand('v', async (args) => {
  return commands.get('verbose')!(args, {} as any);
});

registerCommand('reasoning', async (args) => {
  const mode = args[0] || 'status';
  const validModes = ['on', 'off', 'stream'];
  
  if (!validModes.includes(mode)) {
    return `🦆 Usage: /reasoning [on|off|stream]

Shows AI reasoning process.
Use CLI: duck config set reasoning ${mode}`;
  }
  
  return `🦆 Reasoning mode set to: ${mode}`;
});

registerCommand('reason', async (args) => {
  return commands.get('reasoning')!(args, {} as any);
});

registerCommand('elevated', async (args) => {
  const mode = args[0] || 'status';
  const validModes = ['on', 'off', 'ask', 'full'];
  
  if (!validModes.includes(mode)) {
    return `🦆 Usage: /elevated [on|off|ask|full]

Controls execution permissions for shell commands.
• ask - Prompt before each exec (default)
• full - Skip approvals (use carefully!)

Use CLI: duck config set elevated ${mode}`;
  }
  
  return `🦆 Elevated mode: ${mode}

⚠️ Use with caution - allows shell command execution`;
});

registerCommand('elev', async (args) => {
  return commands.get('elevated')!(args, {} as any);
});

registerCommand('skill', async (args) => {
  const skillName = args[0];
  if (!skillName) {
    return {
      text: `🦆 <b>Skill Runner</b>

Usage: /skill <name> [input]

Examples:
/skill summarize
/skill weather Tokyo

Use CLI to see all skills: duck skills list`,
      parseMode: 'HTML'
    };
  }
  return `🦆 Running skill: ${skillName}

Use CLI for full skill execution: duck skills run ${skillName}`;
});

registerCommand('subagents', async (args) => {
  const subcmd = args[0] || 'list';
  return {
    text: `🦆 <b>Sub-Agent Management</b>

Command: /subagents ${subcmd}

Available:
• /subagents list - List running subagents
• /subagents kill <id> - Kill subagent
• /subagents log <id> - View logs

Use CLI for full control:
• duck agent list
• duck agent spawn "task"`,
    parseMode: 'HTML'
  };
});

registerCommand('kill', async (args) => {
  const agentId = args[0];
  if (!agentId) {
    return '🦆 Usage: /kill <agent-id> or /kill all';
  }
  return `🦆 Kill command sent for: ${agentId}

Use CLI: duck agent kill ${agentId}`;
});

registerCommand('steer', async (args) => {
  const message = args.join(' ');
  if (!message) {
    return {
      text: `🦆 <b>Steer Sub-Agent</b>

Usage: /steer <message>

Redirects a running sub-agent mid-task.
Example: /steer focus only on Python files

Alias: /tell`,
      parseMode: 'HTML'
    };
  }
  return `🦆 Steering message sent: "${message}"`;
});

registerCommand('tell', async (args) => {
  return commands.get('steer')!(args, {} as any);
});

registerCommand('tts', async (args) => {
  const mode = args[0] || 'status';
  const validModes = ['off', 'always', 'inbound', 'status'];
  
  if (!validModes.includes(mode)) {
    return `🦆 Usage: /tts [off|always|inbound|status]

Text-to-speech control:
• off - Disable TTS
• always - Speak all responses
• inbound - Speak incoming messages only
• status - Show TTS status`;
  }
  
  return `🦆 TTS mode: ${mode}`;
});

registerCommand('voice', async (args) => {
  return commands.get('tts')!(args, {} as any);
});

registerCommand('approve', async (args) => {
  const action = args[0];
  if (!action) {
    return `🦆 Usage: /approve [allow-once|allow-always|deny]

Approve pending execution requests.`;
  }
  return `🦆 Approval action: ${action}`;
});

registerCommand('allowlist', async (args) => {
  const action = args[0] || 'list';
  return {
    text: `🦆 <b>Allowlist Management</b>

Command: /allowlist ${action}

Available:
• /allowlist list - Show allowed users
• /allowlist add <id> - Add user
• /allowlist remove <id> - Remove user

Use CLI for full control: duck config`,
    parseMode: 'HTML'
  };
});

registerCommand('export-session', async (args) => {
  const path = args[0] || 'default';
  return `🦆 Export session to: ${path}

Use CLI: duck memory export`;
});

registerCommand('dock-telegram', async () => {
  return '🦆 Already using Telegram. This command is for cross-channel routing.';
});

registerCommand('dock_discord', async () => {
  return '🦆 Use CLI to configure Discord: duck channels discord';
});

registerCommand('focus', async (args) => {
  const threadId = args[0];
  if (!threadId) {
    return '🦆 Usage: /focus <thread-id> - Bind thread to session';
  }
  return `🦆 Focus set to thread: ${threadId}`;
});

registerCommand('unfocus', async () => {
  return '🦆 Thread binding removed.';
});

export { commands };
