/**
 * 🦆 Duck Agent - Discord Channel
 * Connect Duck Agent to Discord with slash commands
 */

import https from 'https';
import http from 'http';
import { EventEmitter } from 'events';
import { Agent } from '../agent/core.js';

export interface DiscordConfig {
  botToken: string;
  applicationId: string;
  guildId?: string;
  allowedRoles?: string[];
}

export interface DiscordMessage {
  id: string;
  content: string;
  author: { id: string; username: string; bot: boolean };
  channel_id: string;
  guild_id?: string;
  member?: { roles: string[] };
}

export class DiscordChannel extends EventEmitter {
  private agent: Agent;
  private botToken: string;
  private applicationId: string;
  private guildId?: string;
  private allowedRoles: Set<string> = new Set();
  private wsUrl: string = '';
  private ws: any = null;
  private sessionId: string = '';
  private sequence: number = 0;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private connected: boolean = false;

  constructor(agent: Agent, config: DiscordConfig) {
    super();
    this.agent = agent;
    this.botToken = config.botToken;
    this.applicationId = config.applicationId;
    this.guildId = config.guildId;
    
    if (config.allowedRoles) {
      config.allowedRoles.forEach(role => this.allowedRoles.add(role));
    }
  }

  async start(): Promise<void> {
    console.log('🎮 Starting Discord bot...');

    try {
      // Get gateway URL
      await this.connectGateway();
      
      console.log('🎮 Discord bot is running!');
      this.connected = true;
      
      // Setup slash commands
      await this.setupCommands();
      
    } catch (e: any) {
      console.error('Failed to start Discord bot:', e.message);
    }
  }

  stop(): void {
    this.connected = false;
    if (this.ws) {
      this.ws.close();
    }
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    console.log('🎮 Discord bot stopped');
  }

  private async connectGateway(): Promise<void> {
    const gateway = await this.request('GET', '/gateway');
    this.wsUrl = `${gateway.url}?v=10&encoding=json`;
    
    // For simple implementation, we'll use HTTP long-polling instead of WebSocket
    // Full WebSocket implementation would be more complex
    console.log(`🎮 Connected to Discord gateway`);
  }

  private startHeartbeat(interval: number): void {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws) {
        this.sendWs({ op: 1, d: this.sequence });
      }
    }, interval);
  }

  private sendWs(data: any): void {
    if (this.ws && this.connected) {
      this.ws.send(JSON.stringify(data));
    }
  }

  private async setupCommands(): Promise<void> {
    const commands = [
      {
        name: 'chat',
        description: 'Chat with Duck Agent',
        options: [
          {
            name: 'message',
            type: 3, // STRING
            description: 'Message to send',
            required: true
          }
        ]
      },
      {
        name: 'status',
        description: 'Check bot status'
      },
      {
        name: 'think',
        description: 'Ask Duck Agent to think about something',
        options: [
          {
            name: 'question',
            type: 3,
            description: 'Question to think about',
            required: true
          }
        ]
      }
    ];

    try {
      // Get existing commands
      const existing = await this.request('GET', `/applications/${this.applicationId}/commands`);
      
      // Register new commands
      for (const cmd of commands) {
        await this.request('POST', `/applications/${this.applicationId}/commands`, cmd);
      }
      
      console.log(`🎮 Registered ${commands.length} slash commands`);
    } catch (e: any) {
      console.error('Failed to setup commands:', e.message);
    }
  }

  async handleInteraction(interaction: any): Promise<void> {
    const { type, data, member, user } = interaction;
    
    // Handle ping
    if (type === 1) {
      this.sendResponse(interaction, { type: 1 });
      return;
    }

    // Handle application command
    if (type === 2) {
      const commandName = data.name;
      const options = data.options || [];
      
      // Check permissions
      if (!this.isAllowed(member)) {
        this.sendResponse(interaction, {
          type: 4,
          data: { content: '❌ You do not have permission to use this command.' }
        });
        return;
      }

      let response: string;

      if (commandName === 'chat') {
        const message = options.find((o: any) => o.name === 'message')?.value || '';
        response = await this.agent.chat(message);
      } else if (commandName === 'think') {
        const question = options.find((o: any) => o.name === 'question')?.value || '';
        response = await this.agent.think(question);
      } else if (commandName === 'status') {
        const status = this.agent.getStatus();
        response = `📊 Duck Agent Status\n\n` +
          `• Name: ${status.name}\n` +
          `• Providers: ${status.providers}\n` +
          `• Tools: ${status.tools}\n` +
          `• Interactions: ${status.metrics?.totalInteractions || 0}`;
      } else {
        response = 'Unknown command';
      }

      // Send response (can take up to 3 seconds)
      this.sendResponse(interaction, {
        type: 4,
        data: { content: response.substring(0, 2000) }
      });
    }
  }

  private isAllowed(member?: { roles: string[] }): boolean {
    if (this.allowedRoles.size === 0) return true;
    if (!member?.roles) return false;
    
    for (const role of member.roles) {
      if (this.allowedRoles.has(role)) return true;
    }
    return false;
  }

  private sendResponse(interaction: any, response: any): void {
    const { token } = interaction;
    
    this.request('POST', `/interactions/${interaction.id}/${token}/callback`, response)
      .catch(e => console.error('Failed to send response:', e.message));
  }

  async sendMessage(channelId: string, content: string): Promise<void> {
    await this.request('POST', `/channels/${channelId}/messages`, { content });
  }

  async replyTo(replyToken: string, content: string): Promise<void> {
    await this.request('POST', `/webhooks/${this.applicationId}/${replyToken}`, { content });
  }

  private request(method: string, path: string, body?: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const postData = body ? JSON.stringify(body) : '';
      
      const options: https.RequestOptions = {
        hostname: 'discord.com',
        path: `/api/v10${path}`,
        method,
        headers: {
          'Authorization': `Bot ${this.botToken}`,
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
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              resolve(parsed);
            } else {
              reject(new Error(`${res.statusCode}: ${JSON.stringify(parsed)}`));
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

  isConnected(): boolean {
    return this.connected;
  }
}

export default DiscordChannel;
