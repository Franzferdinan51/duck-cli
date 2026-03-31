/**
 * 🦆 Duck Agent - Channel Manager
 * Manage Telegram, Discord, and other messaging channels
 */

import { Agent } from '../agent/core.js';
import { TelegramChannel, TelegramConfig } from './telegram.js';
import { DiscordChannel, DiscordConfig } from './discord.js';

export interface ChannelConfig {
  telegram?: TelegramConfig;
  discord?: DiscordConfig;
}

export class ChannelManager {
  private agent: Agent;
  private telegram?: TelegramChannel;
  private discord?: DiscordChannel;
  private channels: Map<string, any> = new Map();

  constructor(agent: Agent) {
    this.agent = agent;
  }

  async start(config: ChannelConfig): Promise<void> {
    console.log('📡 Starting channel manager...');

    if (config.telegram?.botToken) {
      try {
        this.telegram = new TelegramChannel(this.agent, config.telegram);
        await this.telegram.start();
        this.channels.set('telegram', this.telegram);
        console.log('✅ Telegram channel started');
      } catch (e: any) {
        console.error('❌ Failed to start Telegram:', e.message);
      }
    }

    if (config.discord?.botToken) {
      try {
        this.discord = new DiscordChannel(this.agent, config.discord);
        await this.discord.start();
        this.channels.set('discord', this.discord);
        console.log('✅ Discord channel started');
      } catch (e: any) {
        console.error('❌ Failed to start Discord:', e.message);
      }
    }

    console.log(`📡 Channel manager started with ${this.channels.size} channel(s)`);
  }

  stop(): void {
    console.log('📡 Stopping channel manager...');
    
    if (this.telegram) {
      this.telegram.stop();
    }
    if (this.discord) {
      this.discord.stop();
    }
    
    this.channels.clear();
  }

  getChannel(name: string): any {
    return this.channels.get(name);
  }

  listChannels(): string[] {
    return Array.from(this.channels.keys());
  }

  async sendTo(channel: string, chatId: string, message: string): Promise<void> {
    const ch = this.channels.get(channel);
    if (ch && ch.send) {
      await ch.send(chatId, message);
    } else {
      throw new Error(`Channel ${channel} not available or doesn't support direct sending`);
    }
  }

  isRunning(): boolean {
    return this.channels.size > 0;
  }

  getStatus(): any {
    return {
      channels: Array.from(this.channels.keys()),
      count: this.channels.size,
      running: this.isRunning(),
    };
  }
}

export default ChannelManager;
