/**
 * Duck CLI - Channel Integration System
 * 
 * Connect to Telegram, Discord, Signal, WhatsApp, and more.
 * Based on OpenClaw's channel system.
 */

export interface ChannelConfig {
  enabled: boolean;
  botToken?: string;
  botTokenEnv?: string;  // Env var name for token
  apiKey?: string;
  apiKeyEnv?: string;
  pairingRequired?: boolean;
  dmPolicy?: 'allow' | 'deny' | 'pairing';
  allowFrom?: string[];  // User IDs allowed to DM
}

export interface ChannelProvider {
  telegram?: ChannelConfig;
  discord?: ChannelConfig;
  signal?: ChannelConfig;
  whatsapp?: ChannelConfig;
  slack?: ChannelConfig;
  irc?: ChannelConfig;
}

// Default configs from OpenClaw
export const DEFAULT_CHANNELS: ChannelProvider = {
  telegram: {
    enabled: false,
    botTokenEnv: 'TELEGRAM_BOT_TOKEN',
    dmPolicy: 'pairing',
  },
  discord: {
    enabled: false,
    botTokenEnv: 'DISCORD_BOT_TOKEN',
    dmPolicy: 'pairing',
  },
  signal: {
    enabled: false,
    apiKeyEnv: 'SIGNAL_API_KEY',
    pairingRequired: true,
  },
  whatsapp: {
    enabled: false,
    apiKeyEnv: 'WHATSAPP_API_KEY',
  },
  slack: {
    enabled: false,
    botTokenEnv: 'SLACK_BOT_TOKEN',
  },
};

export interface Message {
  channel: string;
  chatId: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
  replyTo?: string;
  threadId?: string;
}

export interface ChannelHandler {
  name: string;
  send(message: string, chatId: string): Promise<void>;
  sendMedia(media: Buffer, caption: string, chatId: string): Promise<void>;
  onMessage(handler: (msg: Message) => void): void;
}

// ============================================
// TELEGRAM INTEGRATION
// ============================================

export class TelegramChannel implements ChannelHandler {
  name = 'telegram';
  private token: string;
  private chatIds = new Map<string, string>(); // userId -> chatId

  constructor(token?: string) {
    this.token = token || process.env.TELEGRAM_BOT_TOKEN || '';
    if (!this.token) {
      throw new Error('TELEGRAM_BOT_TOKEN not set');
    }
  }

  async send(message: string, chatId: string): Promise<void> {
    const response = await fetch(`https://api.telegram.org/bot${this.token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'Markdown',
      }),
    });

    if (!response.ok) {
      throw new Error(`Telegram error: ${response.status}`);
    }
  }

  async sendMedia(media: Buffer, caption: string, chatId: string): Promise<void> {
    const form = new FormData();
    form.append('chat_id', chatId);
    form.append('caption', caption);
    form.append('photo', new Blob([media]));

    const response = await fetch(`https://api.telegram.org/bot${this.token}/sendPhoto`, {
      method: 'POST',
      body: form,
    });

    if (!response.ok) {
      throw new Error(`Telegram media error: ${response.status}`);
    }
  }

  async getUpdates(): Promise<Message[]> {
    const response = await fetch(`https://api.telegram.org/bot${this.token}/getUpdates?limit=100&timeout=60`);
    const data = await response.json();
    
    return (data.result || []).map((update: any) => ({
      channel: 'telegram',
      chatId: update.message?.chat?.id?.toString() || '',
      senderId: update.message?.from?.id?.toString() || '',
      senderName: update.message?.from?.first_name || 'Unknown',
      text: update.message?.text || '',
      timestamp: update.message?.date * 1000,
      replyTo: update.message?.reply_to_message?.message_id?.toString(),
    }));
  }

  onMessage(handler: (msg: Message) => void): void {
    // Poll for updates in a loop
    const poll = async () => {
      try {
        const updates = await this.getUpdates();
        for (const msg of updates) {
          handler(msg);
        }
      } catch (e) {
        console.error('Telegram poll error:', e);
      }
      setTimeout(poll, 5000);
    };
    poll();
  }
}

// ============================================
// DISCORD INTEGRATION
// ============================================

export class DiscordChannel implements ChannelHandler {
  name = 'discord';
  private token: string;
  private channelId: string;

  constructor(token?: string, channelId?: string) {
    this.token = token || process.env.DISCORD_BOT_TOKEN || '';
    this.channelId = channelId || process.env.DISCORD_CHANNEL_ID || '';
    if (!this.token) {
      throw new Error('DISCORD_BOT_TOKEN not set');
    }
  }

  async send(message: string, channelId?: string): Promise<void> {
    const targetChannel = channelId || this.channelId;
    const response = await fetch(`https://discord.com/api/v10/channels/${targetChannel}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bot ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content: message }),
    });

    if (!response.ok) {
      throw new Error(`Discord error: ${response.status}`);
    }
  }

  async sendMedia(media: Buffer, filename: string, caption: string, channelId?: string): Promise<void> {
    const targetChannel = channelId || this.channelId;
    const form = new FormData();
    form.append('file', new Blob([media]), filename);
    form.append('payload_json', JSON.stringify({ content: caption }));

    const response = await fetch(`https://discord.com/api/v10/channels/${targetChannel}/messages`, {
      method: 'POST',
      headers: { 'Authorization': `Bot ${this.token}` },
      body: form,
    });

    if (!response.ok) {
      throw new Error(`Discord media error: ${response.status}`);
    }
  }

  async getMessages(limit = 50): Promise<Message[]> {
    const response = await fetch(
      `https://discord.com/api/v10/channels/${this.channelId}/messages?limit=${limit}`,
      {
        headers: { 'Authorization': `Bot ${this.token}` },
      }
    );

    const data = await response.json();
    return (data || []).map((msg: any) => ({
      channel: 'discord',
      chatId: msg.channel_id,
      senderId: msg.author.id,
      senderName: msg.author.username,
      text: msg.content,
      timestamp: new Date(msg.timestamp).getTime(),
    }));
  }

  onMessage(handler: (msg: Message) => void): void {
    // Discord uses webhooks/Gateway - simplified polling for now
    const poll = async () => {
      try {
        const messages = await this.getMessages();
        for (const msg of messages.slice(0, 5)) {
          handler(msg);
        }
      } catch (e) {
        console.error('Discord poll error:', e);
      }
      setTimeout(poll, 10000);
    };
    poll();
  }
}

// ============================================
// CHANNEL MANAGER
// ============================================

export class ChannelManager {
  private channels = new Map<string, ChannelHandler>();

  add(handler: ChannelHandler): void {
    this.channels.set(handler.name, handler);
  }

  async send(channel: string, message: string, chatId: string): Promise<void> {
    const handler = this.channels.get(channel);
    if (!handler) {
      throw new Error(`Channel ${channel} not configured`);
    }
    await handler.send(message, chatId);
  }

  async sendAll(message: string): Promise<void> {
    for (const [name, handler] of this.channels) {
      try {
        // Use default chat for each channel
        await handler.send(message, 'default');
      } catch (e) {
        console.error(`${name} send error:`, e);
      }
    }
  }

  list(): string[] {
    return Array.from(this.channels.keys());
  }

  isConfigured(channel: string): boolean {
    return this.channels.has(channel);
  }
}

// ============================================
// CLI COMMANDS
// ============================================

export async function setupChannels(): Promise<ChannelManager> {
  const manager = new ChannelManager();

  // Telegram
  if (process.env.TELEGRAM_BOT_TOKEN) {
    try {
      manager.add(new TelegramChannel(process.env.TELEGRAM_BOT_TOKEN));
      console.log('✅ Telegram connected');
    } catch (e) {
      console.log('❌ Telegram failed:', e);
    }
  }

  // Discord
  if (process.env.DISCORD_BOT_TOKEN) {
    try {
      manager.add(new DiscordChannel(process.env.DISCORD_BOT_TOKEN, process.env.DISCORD_CHANNEL_ID));
      console.log('✅ Discord connected');
    } catch (e) {
      console.log('❌ Discord failed:', e);
    }
  }

  return manager;
}

// Example: Send a message
export async function sendChannelMessage(channel: string, message: string): Promise<void> {
  const manager = await setupChannels();
  const chatId = getDefaultChatId(channel);
  await manager.send(channel, message, chatId);
}

function getDefaultChatId(channel: string): string {
  switch (channel) {
    case 'telegram':
      return process.env.TELEGRAM_CHAT_ID || 'me';
    case 'discord':
      return process.env.DISCORD_CHANNEL_ID || '0';
    default:
      return 'default';
  }
}
