/**
 * 🦆 Duck Agent - Telegram Channel
 * Connect Duck Agent to Telegram for messaging
 */

import https from 'https';
import http from 'http';
import { Agent } from '../agent/core.js';
import FormData from 'form-data';

export interface TelegramConfig {
  botToken: string;
  allowedUsers?: string[];
  groupIds?: string[];
}

export interface TelegramMessage {
  message_id: number;
  from?: { id: number; is_bot: boolean; first_name: string };
  chat: { id: number; type: string; title?: string };
  text?: string;
  date: number;
}

export class TelegramChannel {
  private agent: Agent;
  private botToken: string;
  private allowedUsers: Set<number> = new Set();
  private groupIds: Set<number> = new Set();
  private offset: number = 0;
  private polling: boolean = false;
  private longPollTimeout: NodeJS.Timeout | null = null;

  constructor(agent: Agent, config: TelegramConfig) {
    this.agent = agent;
    this.botToken = config.botToken;
    
    if (config.allowedUsers) {
      config.allowedUsers.forEach(id => this.allowedUsers.add(typeof id === 'string' ? parseInt(id) : id));
    }
    if (config.groupIds) {
      config.groupIds.forEach(id => this.groupIds.add(typeof id === 'string' ? parseInt(id) : id));
    }
  }

  async start(): Promise<void> {
    console.log('📱 Starting Telegram bot...');
    
    // Test connection
    const me = await this.getMe();
    console.log(`✅ Logged in as @${me.username}`);
    
    // Start polling
    this.polling = true;
    this.poll();
    
    console.log('📱 Telegram bot is running!');
  }

  stop(): void {
    this.polling = false;
    if (this.longPollTimeout) {
      clearTimeout(this.longPollTimeout);
    }
    console.log('📱 Telegram bot stopped');
  }

  private async poll(): Promise<void> {
    if (!this.polling) return;

    try {
      const updates = await this.getUpdates();
      
      for (const update of updates) {
        if (update.message) {
          await this.handleMessage(update.message);
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

  private async getUpdates(): Promise<any[]> {
    const url = `https://api.telegram.org/bot${this.botToken}/getUpdates?offset=${this.offset}&timeout=30&allowed_updates=message`;
    
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

  private async handleMessage(message: TelegramMessage): Promise<void> {
    const chatId = message.chat.id;
    const text = message.text || '';

    // Check permissions
    if (!this.isAllowed(chatId, message.from?.id)) {
      await this.sendMessage(chatId, '❌ You are not authorized to use this bot.');
      return;
    }

    // Ignore commands without text
    if (!text) return;

    // Process message
    console.log(`📱 Telegram: ${message.from?.first_name}: ${text}`);

    try {
      const response = await this.agent.chat(text);
      await this.sendMessage(chatId, response);
    } catch (e: any) {
      await this.sendMessage(chatId, `❌ Error: ${e.message}`);
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

  async sendMessage(chatId: number, text: string): Promise<void> {
    const escapedText = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    await this.request('/sendMessage', {
      chat_id: chatId,
      text: escapedText,
      parse_mode: 'HTML'
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

  // Form request for multipart uploads (photos, documents, voice)
  private formRequest(method: string, formData: FormData): Promise<any> {
    return new Promise((resolve, reject) => {
      const data = formData.getBuffer();
      
      const options: https.RequestOptions = {
        hostname: 'api.telegram.org',
        path: `/bot${this.botToken}${method}`,
        method: 'POST',
        headers: {
          ...formData.getHeaders(),
          'Content-Length': data.length
        }
      };

      const req = https.request(options, (res) => {
        let responseData = '';
        res.on('data', chunk => responseData += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(responseData);
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
      req.write(data);
      req.end();
    });
  }

  // ==================== GROUP CHAT FEATURES ====================

  // Reply to a specific message
  async replyTo(chatId: number, messageId: number, text: string): Promise<void> {
    const escapedText = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    await this.request('/sendMessage', {
      chat_id: chatId,
      text: escapedText,
      reply_to_message_id: messageId,
      parse_mode: 'HTML'
    });
  }

  // Get chat info
  async getChat(chatId: number): Promise<any> {
    return this.request('/getChat', { chat_id: chatId });
  }

  // Get chat administrators
  async getChatMembers(chatId: number): Promise<any> {
    return this.request('/getChatAdministrators', { chat_id: chatId });
  }

  // Leave a chat
  async leaveChat(chatId: number): Promise<void> {
    await this.request('/leaveChat', { chat_id: chatId });
  }

  // ==================== MEDIA SUPPORT ====================

  // Send a photo
  async sendPhoto(chatId: number, photo: string | Buffer, caption?: string): Promise<void> {
    const formData = new FormData();
    formData.append('chat_id', chatId.toString());
    formData.append('photo', photo);
    if (caption) {
      const escapedCaption = caption
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      formData.append('caption', escapedCaption);
      formData.append('parse_mode', 'HTML');
    }
    await this.formRequest('/sendPhoto', formData);
  }

  // Send a document
  async sendDocument(chatId: number, document: string | Buffer, caption?: string): Promise<void> {
    const formData = new FormData();
    formData.append('chat_id', chatId.toString());
    formData.append('document', document);
    if (caption) {
      const escapedCaption = caption
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      formData.append('caption', escapedCaption);
      formData.append('parse_mode', 'HTML');
    }
    await this.formRequest('/sendDocument', formData);
  }

  // Send voice message
  async sendVoice(chatId: number, voice: string | Buffer, caption?: string): Promise<void> {
    const formData = new FormData();
    formData.append('chat_id', chatId.toString());
    formData.append('voice', voice);
    if (caption) {
      const escapedCaption = caption
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      formData.append('caption', escapedCaption);
      formData.append('parse_mode', 'HTML');
    }
    await this.formRequest('/sendVoice', formData);
  }

  // ==================== MESSAGE ACTIONS ====================

  // Send chat action (typing, upload_photo, record_video, upload_voice)
  async sendAction(chatId: number, action: 'typing' | 'upload_photo' | 'record_video' | 'upload_voice' | 'record_audio' | 'upload_video' | 'upload_document' | 'find_location' | 'record_video_note' | 'upload_video_note'): Promise<void> {
    await this.request('/sendChatAction', { chat_id: chatId, action });
  }

  // ==================== EDIT AND DELETE ====================

  // Edit a message
  async editMessage(chatId: number, messageId: number, text: string): Promise<void> {
    const escapedText = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    await this.request('/editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text: escapedText,
      parse_mode: 'HTML'
    });
  }

  // Delete a message
  async deleteMessage(chatId: number, messageId: number): Promise<void> {
    await this.request('/deleteMessage', {
      chat_id: chatId,
      message_id: messageId
    });
  }

  // Send to a specific chat
  async send(chatId: number, message: string): Promise<void> {
    await this.sendMessage(chatId, message);
  }
}

export default TelegramChannel;
