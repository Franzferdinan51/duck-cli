/**
 * 🦆 Duck Agent - Telegram Channel
 * Connect Duck Agent to Telegram for messaging
 * 
 * Enhanced with:
 * - Webhook support
 * - Command handlers
 * - Inline keyboards
 * - Conversation state
 * - Rich formatting (HTML)
 */

import https from 'https';
import http from 'http';
import { Agent } from '../agent/core.js';
import { DEFAULT_TELEGRAM_WEBHOOK_PORT } from '../config/index.js';

export interface TelegramConfig {
  botToken: string;
  allowedUsers?: string[];
  groupIds?: string[];
  webhook?: {
    url: string;
    secretToken?: string;
  };
}

export interface TelegramMessage {
  message_id: number;
  from?: { id: number; is_bot: boolean; first_name: string };
  chat: { id: number; type: string; title?: string };
  text?: string;
  date: number;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: {
    id: string;
    from: { id: number; is_bot: boolean; first_name: string };
    chat: { id: number; type: string };
    message?: TelegramMessage;
    data: string;
  };
}

export interface InlineKeyboardButton {
  text: string;
  callback_data?: string;
  url?: string;
}

export interface ConversationState {
  state: string;
  data: Record<string, any>;
  lastMessage: number;
}

type CommandHandler = (chatId: number, args: string[]) => Promise<void>;
type CallbackHandler = (chatId: number, data: string) => Promise<void>;

export class TelegramChannel {
  private agent: Agent;
  private botToken: string;
  private allowedUsers: Set<number> = new Set();
  private groupIds: Set<number> = new Set();
  private offset: number = 0;
  private polling: boolean = false;
  private longPollTimeout: NodeJS.Timeout | null = null;
  private useWebhook: boolean = false;
  private webhookSecret?: string;
  // Rate limiting (Telegram has 30 msg/sec limit)
  private rateLimiter = {
    messages: 0,
    lastReset: Date.now(),
    maxPerSecond: 30
  };

  // Command handlers
  private commands: Map<string, CommandHandler> = new Map();
  
  // Callback query handlers
  private callbackHandlers: Map<string, CallbackHandler> = new Map();
  private defaultCallbackHandler?: CallbackHandler;

  // Conversation states
  private conversations: Map<number, ConversationState> = new Map();
  private conversationTimeout: number = 300000; // 5 minutes

  // Default command handlers
  private registerDefaultCommands(): void {
    this.onCommand('start', async (chatId) => {
      await this.sendFormatted(chatId, 
        '👋 <b>Welcome to Duck Agent!</b>\n\n' +
        'I\'m your AI assistant. Here are some commands:\n\n' +
        '• /help - Show all commands\n' +
        '• /status - Check bot status\n' +
        '• /cancel - Cancel current conversation'
      );
    });

    this.onCommand('help', async (chatId) => {
      await this.sendFormatted(chatId,
        '📚 <b>Available Commands:</b>\n\n' +
        '• /start - Start the bot\n' +
        '• /help - Show this help\n' +
        '• /status - Check bot status\n' +
        '• /cancel - Cancel current conversation\n\n' +
        'Just type any message to chat with me!'
      );
    });

    this.onCommand('status', async (chatId) => {
      await this.sendFormatted(chatId,
        '✅ <b>Bot Status:</b>\n\n' +
        `• Mode: ${this.useWebhook ? 'Webhook' : 'Polling'}\n` +
        `• Conversations: ${this.conversations.size} active\n` +
        `• Commands registered: ${this.commands.size}`
      );
    });

    this.onCommand('cancel', async (chatId) => {
      if (this.conversations.has(chatId)) {
        this.conversations.delete(chatId);
        await this.sendMessage(chatId, '❌ Conversation cancelled.');
      } else {
        await this.sendMessage(chatId, 'No active conversation to cancel.');
      }
    });
  }

  constructor(agent: Agent, config: TelegramConfig) {
    this.agent = agent;
    this.botToken = config.botToken;
    
    if (config.allowedUsers) {
      config.allowedUsers.forEach(id => this.allowedUsers.add(typeof id === 'string' ? parseInt(id) : id));
    }
    if (config.groupIds) {
      config.groupIds.forEach(id => this.groupIds.add(typeof id === 'string' ? parseInt(id) : id));
    }
    
    if (config.webhook) {
      this.useWebhook = true;
      this.webhookSecret = config.webhook.secretToken;
    }

    // Register default commands
    this.registerDefaultCommands();
  }

  async start(): Promise<void> {
    console.log('📱 Starting Telegram bot...');
    
    // Test connection
    const me = await this.getMe();
    console.log(`✅ Logged in as @${me.username}`);
    
    if (this.useWebhook) {
      // Set up webhook
      const webhookUrl = (this.agent as any).config?.telegram?.webhook?.url;
      if (webhookUrl) {
        await this.setWebhook(webhookUrl);
        console.log(`🔗 Webhook set to ${webhookUrl}`);
      }
    } else {
      // Start polling
      this.polling = true;
      this.poll();
    }
    
    console.log(`📱 Telegram bot is running (${this.useWebhook ? 'Webhook' : 'Polling'})!`);
  }

  stop(): void {
    this.polling = false;
    if (this.longPollTimeout) {
      clearTimeout(this.longPollTimeout);
    }
    console.log('📱 Telegram bot stopped');
  }

  // ============== WEBHOOK METHODS ==============

  /**
   * Set webhook URL for receiving updates
   */
  async setWebhook(url: string): Promise<void> {
    await this.request('/setWebhook', { 
      url, 
      drop_pending_updates: true,
      secret_token: this.webhookSecret
    });
  }

  /**
   * Delete webhook and revert to polling
   */
  async deleteWebhook(): Promise<void> {
    await this.request('/deleteWebhook', { drop_pending_updates: true });
  }

  /**
   * Get current webhook info
   */
  async getWebhookInfo(): Promise<any> {
    return this.request('/getWebhookInfo');
  }

  /**
   * Handle incoming webhook update (call this from your webhook server)
   */
  async handleWebhookUpdate(update: TelegramUpdate): Promise<void> {
    if (update.message) {
      await this.handleMessage(update.message);
    } else if (update.callback_query) {
      await this.handleCallbackQuery(update.callback_query);
    }
  }

  /**
   * Create a webhook server (Express example)
   */
  createWebhookServer(port: number = DEFAULT_TELEGRAM_WEBHOOK_PORT): http.Server {
    const server = http.createServer(async (req, res) => {
      if (req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
          // Verify secret token if set
          if (this.webhookSecret) {
            const token = req.headers['x-telegram-bot-api-secret-token'];
            if (token !== this.webhookSecret) {
              res.writeHead(401);
              res.end('Unauthorized');
              return;
            }
          }

          try {
            const update: TelegramUpdate = JSON.parse(body);
            await this.handleWebhookUpdate(update);
            res.writeHead(200);
            res.end('OK');
          } catch (e) {
            console.error('Webhook error:', e);
            res.writeHead(500);
            res.end('Error');
          }
        });
      } else {
        res.writeHead(200);
        res.end('Telegram Webhook Server Running');
      }
    });

    server.listen(port, () => {
      console.log(`🔗 Webhook server listening on port ${port}`);
    });

    return server;
  }

  // ============== COMMAND HANDLERS ==============

  /**
   * Register a command handler
   * @param command Command name (without /)
   * @param handler Function to handle the command
   */
  onCommand(command: string, handler: CommandHandler): void {
    this.commands.set(command.toLowerCase(), handler);
  }

  /**
   * Register a callback query handler
   * @param pattern Pattern to match (prefix)
   * @param handler Function to handle the callback
   */
  onCallback(pattern: string, handler: CallbackHandler): void {
    this.callbackHandlers.set(pattern, handler);
  }

  /**
   * Register a default callback handler (for unmatched callbacks)
   */
  onAnyCallback(handler: CallbackHandler): void {
    this.defaultCallbackHandler = handler;
  }

  // ============== INLINE KEYBOARD METHODS ==============

  /**
   * Send message with inline keyboard
   */
  async sendWithKeyboard(
    chatId: number, 
    text: string, 
    keyboard: InlineKeyboardButton[][]
  ): Promise<void> {
    const escapedText = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    await this.request('/sendMessage', {
      chat_id: chatId,
      text: escapedText,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: keyboard
      }
    });
  }

  /**
   * Send a message with keyboard and force reply
   */
  async sendWithReplyKeyboard(
    chatId: number,
    text: string,
    keyboard: InlineKeyboardButton[][],
    placeholder?: string
  ): Promise<void> {
    const escapedText = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    await this.request('/sendMessage', {
      chat_id: chatId,
      text: escapedText,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: keyboard,
        input_field_placeholder: placeholder
      }
    });
  }

  /**
   * Answer a callback query
   */
  async answerCallbackQuery(callbackId: string, text?: string): Promise<void> {
    await this.request('/answerCallbackQuery', {
      callback_query_id: callbackId,
      text,
      show_alert: !!text
    });
  }

  // ============== CONVERSATION STATE METHODS ==============

  /**
   * Start a conversation with a user
   */
  startConversation(chatId: number, state: string, initialData: Record<string, any> = {}): void {
    this.conversations.set(chatId, {
      state,
      data: initialData,
      lastMessage: Date.now()
    });
  }

  /**
   * Update conversation state
   */
  updateConversation(chatId: number, state?: string, data?: Record<string, any>): void {
    const conversation = this.conversations.get(chatId);
    if (conversation) {
      if (state) conversation.state = state;
      if (data) conversation.data = { ...conversation.data, ...data };
      conversation.lastMessage = Date.now();
    }
  }

  /**
   * Get conversation state
   */
  getConversation(chatId: number): ConversationState | undefined {
    const conversation = this.conversations.get(chatId);
    if (conversation && Date.now() - conversation.lastMessage > this.conversationTimeout) {
      this.conversations.delete(chatId);
      return undefined;
    }
    return conversation;
  }

  /**
   * End a conversation
   */
  endConversation(chatId: number): void {
    this.conversations.delete(chatId);
  }

  /**
   * Set conversation timeout (default 5 minutes)
   */
  setConversationTimeout(timeoutMs: number): void {
    this.conversationTimeout = timeoutMs;
  }

  // ============== RICH FORMATTING METHODS ==============

  /**
   * Send HTML formatted message
   */
  async sendFormatted(chatId: number, html: string): Promise<void> {
    // Only escape text nodes, not HTML tags
    const escapedHtml = this.escapeHtml(html);
    
    await this.request('/sendMessage', {
      chat_id: chatId,
      text: escapedHtml,
      parse_mode: 'HTML'
    });
  }

  /**
   * Escape HTML special characters (but preserve existing tags)
   */
  private escapeHtml(text: string): string {
    // Don't escape content inside HTML tags
    return text
      .replace(/&(?!(amp|lt|gt|quot|apos|nbsp);)/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  /**
   * Send message with MarkdownV2 formatting
   */
  async sendMarkdown(chatId: number, text: string): Promise<void> {
    await this.request('/sendMessage', {
      chat_id: chatId,
      text,
      parse_mode: 'MarkdownV2'
    });
  }

  // ============== POLLING METHODS ==============

  private async poll(): Promise<void> {
    if (!this.polling) return;

    try {
      const updates = await this.getUpdates();
      
      for (const update of updates) {
        if (update.message) {
          await this.handleMessage(update.message);
        } else if (update.callback_query) {
          await this.handleCallbackQuery(update.callback_query);
        }
      }

      if (updates.length > 0) {
        const lastUpdate = updates[updates.length - 1];
        this.offset = lastUpdate.update_id + 1;
      }
    } catch (e) {
      console.error('Polling error:', e);
    }

    // Continue polling
    if (this.polling) {
      this.longPollTimeout = setTimeout(() => this.poll(), 1000);
    }
  }

  private async getUpdates(): Promise<TelegramUpdate[]> {
    const url = `https://api.telegram.org/bot${this.botToken}/getUpdates?offset=${this.offset}&timeout=30&allowed_updates=message,callback_query`;
    
    return new Promise((resolve, reject) => {
      https.get(url, (res) => {
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
          } catch (e) {
            reject(e);
          }
        });
      }).on('error', reject);
    });
  }

  private async getMe(): Promise<{ id: number; is_bot: boolean; username: string }> {
    const data = await this.request('/getMe');
    return data;
  }

  // ============== MESSAGE HANDLERS ==============

  private async handleMessage(message: TelegramMessage): Promise<void> {
    const chatId = message.chat.id;
    const text = message.text || '';
    const userId = message.from?.id;

    // Check permissions
    if (!this.isAllowed(chatId, userId)) {
      await this.sendMessage(chatId, '❌ You are not authorized to use this bot.');
      return;
    }

    // Ignore non-text messages
    if (!text) return;

    // Check for commands
    if (text.startsWith('/')) {
      const parts = text.slice(1).split(' ');
      const command = parts[0].toLowerCase();
      const args = parts.slice(1);

      // Check if command exists
      if (this.commands.has(command)) {
        const handler = this.commands.get(command)!;
        try {
          await handler(chatId, args);
        } catch (e: any) {
          await this.sendMessage(chatId, `❌ Command error: ${e.message}`);
        }
        return;
      }

      // Unknown command - just process as regular message
      console.log(`📱 Telegram: Unknown command ${command}`);
    }

    // Check for active conversation
    const conversation = this.getConversation(chatId);
    if (conversation) {
      console.log(`📱 Telegram conversation [${conversation.state}]: ${message.from?.first_name}: ${text}`);
      // Conversation handlers would be registered externally
      // For now, pass to agent
      try {
        const response = await this.agent.chat(text);
        await this.sendMessage(chatId, response);
      } catch (e: any) {
        await this.sendMessage(chatId, `❌ Error: ${e.message}`);
      }
      return;
    }

    // Regular message - process with agent
    console.log(`📱 Telegram: ${message.from?.first_name}: ${text}`);

    try {
      const response = await this.agent.chat(text);
      await this.sendMessage(chatId, response);
    } catch (e: any) {
      await this.sendMessage(chatId, `❌ Error: ${e.message}`);
    }
  }

  private async handleCallbackQuery(callbackQuery: TelegramUpdate['callback_query']): Promise<void> {
    if (!callbackQuery) return;

    const chatId = callbackQuery.message?.chat.id;
    const data = callbackQuery.data;
    const callbackId = callbackQuery.id;

    if (!chatId || !data) return;

    // Check permissions
    if (!this.isAllowed(chatId, callbackQuery.from.id)) {
      await this.answerCallbackQuery(callbackId, '❌ You are not authorized.');
      return;
    }

    // Find matching handler
    let handler: CallbackHandler | undefined;
    let matchedPattern: string | undefined;

    for (const [pattern, h] of this.callbackHandlers) {
      if (data.startsWith(pattern)) {
        handler = h;
        matchedPattern = pattern;
        break;
      }
    }

    if (handler) {
      try {
        const callbackData = matchedPattern ? data.slice(matchedPattern.length) : data;
        await handler(chatId, callbackData);
        await this.answerCallbackQuery(callbackId);
      } catch (e: any) {
        await this.answerCallbackQuery(callbackId, `❌ Error: ${e.message}`);
      }
    } else if (this.defaultCallbackHandler) {
      try {
        await this.defaultCallbackHandler(chatId, data);
        await this.answerCallbackQuery(callbackId);
      } catch (e: any) {
        await this.answerCallbackQuery(callbackId, `❌ Error: ${e.message}`);
      }
    } else {
      await this.answerCallbackQuery(callbackId, 'Unknown action');
    }
  }

  private isAllowed(chatId: number, userId?: number): boolean {
    // Allow all if no restrictions
    if (this.allowedUsers.size === 0 && this.groupIds.size === 0) {
      return true;
    }

    // Check user
    if (userId && this.allowedUsers.has(userId)) {
      return true;
    }

    // Check group
    if (this.groupIds.has(chatId)) {
      return true;
    }

    return false;
  }


  // ============== RATE LIMITING & RETRY ==============


  /**
   * Rate-limited request that respects Telegram's 30 msg/sec limit
   */
  private async rateLimitedRequest(method: string, body?: any): Promise<any> {
    const now = Date.now();
    if (now - this.rateLimiter.lastReset > 1000) {
      this.rateLimiter.messages = 0;
      this.rateLimiter.lastReset = now;
    }
    
    if (this.rateLimiter.messages >= this.rateLimiter.maxPerSecond) {
      await new Promise(r => setTimeout(r, 1000 - (now - this.rateLimiter.lastReset)));
      return this.rateLimitedRequest(method, body);
    }
    
    this.rateLimiter.messages++;
    return this.requestWithRetry(method, body);
  }

  /**
   * Request with exponential backoff retry for transient errors
   */
  private async requestWithRetry(method: string, body?: any, retries = 3): Promise<any> {
    for (let i = 0; i < retries; i++) {
      try {
        return await this.request(method, body);
      } catch (e: any) {
        if (e.message.includes('429') && i < retries - 1) {
          // Rate limited, wait and retry with exponential backoff
          await new Promise(r => setTimeout(r, Math.pow(2, i) * 1000));
          continue;
        }
        throw e;
      }
    }
  }

  // ============== SEND METHODS ==============

  async sendMessage(chatId: number, text: string): Promise<void> {
    const escapedText = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    await this.rateLimitedRequest('/sendMessage', {
      chat_id: chatId,
      text: escapedText,
      parse_mode: 'HTML'
    });
  }

  /**
   * Send a photo with optional caption
   */
  async sendPhoto(chatId: number, photo: string, caption?: string): Promise<void> {
    await this.rateLimitedRequest('/sendPhoto', {
      chat_id: chatId,
      photo,
      caption: caption,
      parse_mode: caption ? 'HTML' : undefined
    });
  }

  /**
   * Send a document with optional caption
   */
  async sendDocument(chatId: number, document: string, caption?: string): Promise<void> {
    await this.rateLimitedRequest('/sendDocument', {
      chat_id: chatId,
      document,
      caption: caption,
      parse_mode: caption ? 'HTML' : undefined
    });
  }

  private request(method: string, body?: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const postData = body ? JSON.stringify(body) : '';
      
      const options: https.RequestOptions = {
        hostname: 'api.telegram.org',
        path: `/bot${this.botToken}${method}`,
        method: body ? 'POST' : 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      };

      const req = https.request(options, (res) => {
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
          } catch (e) {
            reject(e);
          }
        });
      });

      req.on('error', reject);
      
      if (body) {
        req.write(postData);
      }
      req.end();
    });
  }

  // Send to a specific chat
  async send(chatId: number, message: string): Promise<void> {
    await this.sendMessage(chatId, message);
  }
}

export default TelegramChannel;
