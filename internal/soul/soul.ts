/**
 * Duck CLI - Soul System
 * 
 * Inspired by OpenClaw's SOUL.md - the agent's personality and identity
 * Loaded at startup, shapes how the agent responds
 */

export interface SoulConfig {
  name: string;
  personality: {
    tone: 'formal' | 'casual' | 'sarcastic' | 'friendly' | 'direct';
    verbose: boolean;
    emoji_usage: boolean;
    swearing_allowed: boolean;
    homie_mode: boolean;
  };
  traits: string[];
  quirks: string[];
  rules: string[];
  greeting?: string;
  goodbye?: string;
  error_messages: {
    generic: string;
    auth_failed: string;
    not_found: string;
    timeout: string;
  };
}

const DEFAULT_SOUL: SoulConfig = {
  name: 'Duck CLI',
  personality: {
    tone: 'friendly',
    verbose: false,
    emoji_usage: true,
    swearing_allowed: true,
    homie_mode: true
  },
  traits: [
    'helpful',
    'efficient',
    'friendly',
    'proactive',
    'technical'
  ],
  quirks: [
    'uses duck emoji 🦆',
    'vibes with users',
    'no corporate speak'
  ],
  rules: [
    'be direct',
    'no padding',
    'call out bullshit',
    'get the job done'
  ],
  greeting: 'What do you need? 🦆',
  goodbye: 'Later! 🦆',
  error_messages: {
    generic: 'Something went wrong',
    auth_failed: 'Auth failed - check your API keys',
    not_found: "Can't find that",
    timeout: 'Took too long, try again'
  }
};

export class Soul {
  private config: SoulConfig;
  private loaded: boolean = false;

  constructor() {
    this.config = { ...DEFAULT_SOUL };
  }

  async load(soulPath?: string): Promise<boolean> {
    try {
      const { readFile } = await import('fs/promises');
      const path = soulPath || join(process.cwd(), 'SOUL.md');
      const content = await readFile(path, 'utf-8');
      this.config = this.parseSoulMarkdown(content);
      this.loaded = true;
      return true;
    } catch {
      // Use default soul
      this.loaded = true;
      return false;
    }
  }

  private parseSoulMarkdown(content: string): Partial<SoulConfig> {
    const config: any = { ...DEFAULT_SOUL };

    // Parse sections
    const lines = content.split('\n');
    let currentSection = 'root';

    for (const line of lines) {
      // Detect sections
      if (line.startsWith('## ')) {
        currentSection = line.slice(3).toLowerCase();
        continue;
      }

      // Parse key: value pairs
      const colonIdx = line.indexOf(':');
      if (colonIdx > 0) {
        const key = line.slice(0, colonIdx).trim().toLowerCase();
        const value = line.slice(colonIdx + 1).trim();

        switch (currentSection) {
          case 'name':
            config.name = value;
            break;
          case 'personality':
            if (key === 'tone') config.personality.tone = value as SoulConfig['personality']['tone'];
            if (key === 'verbose') config.personality.verbose = value === 'true';
            if (key === 'emoji_usage') config.personality.emoji_usage = value === 'true';
            if (key === 'swearing_allowed') config.personality.swearing_allowed = value === 'true';
            if (key === 'homie_mode') config.personality.homie_mode = value === 'true';
            break;
          case 'rules':
            if (value) config.rules.push(value);
            break;
          case 'traits':
            if (value) config.traits.push(value);
            break;
        }
      }
    }

    return config;
  }

  get(): SoulConfig {
    return this.config;
  }

  isLoaded(): boolean {
    return this.loaded;
  }

  // Generate system prompt segment from soul
  getSystemPrompt(): string {
    const { personality, traits, quirks, rules } = this.config;

    let prompt = `# ${this.config.name}\n\n`;
    prompt += `You are ${this.config.name} - `;
    prompt += `a ${traits.slice(0, 3).join(', ')} AI assistant.\n\n`;

    prompt += `## Your Personality\n`;
    prompt += `- Tone: ${personality.tone}\n`;
    prompt += `- ${personality.homie_mode ? 'You talk to users like they\'re your homie' : 'Professional but friendly'}\n`;
    prompt += `- ${personality.emoji_usage ? 'Use emoji appropriately' : 'Minimal emoji'}\n`;
    prompt += `- ${personality.swearing_allowed ? 'Swearing is allowed when appropriate' : 'Keep it clean'}\n\n`;

    if (rules.length > 0) {
      prompt += `## Your Rules\n`;
      for (const rule of rules.slice(0, 5)) {
        prompt += `- ${rule}\n`;
      }
      prompt += '\n';
    }

    if (quirks.length > 0) {
      prompt += `## Your Quirks\n`;
      for (const quirk of quirks.slice(0, 3)) {
        prompt += `- ${quirk}\n`;
      }
      prompt += '\n';
    }

    return prompt;
  }

  // Format response based on soul
  formatResponse(text: string): string {
    const { emoji_usage, homie_mode, tone } = this.config.personality;

    let formatted = text;

    // Add duck emoji if enabled and missing
    if (emoji_usage && !formatted.includes('🦆') && Math.random() > 0.7) {
      formatted += ' 🦆';
    }

    // Adjust tone
    if (tone === 'direct' && formatted.startsWith('Certainly')) {
      formatted = formatted.replace('Certainly, ', '');
      formatted = formatted.replace('Certainly! ', '');
    }

    return formatted;
  }

  // Get error message
  getError(type: keyof SoulConfig['error_messages']): string {
    return this.config.error_messages[type] || this.config.error_messages.generic;
  }
}

// Import helper
import { join } from 'path';

export default Soul;
