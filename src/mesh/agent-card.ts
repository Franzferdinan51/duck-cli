/**
 * 🦆 Duck Agent - Agent Card Generator
 * Generates Agent Cards for mesh discovery (A2A-style)
 */

import { AgentCard, Skill } from '../a2a/types.js';
import * as fs from 'fs';
import * as path from 'path';
import { homedir } from 'os';

const DATA_DIR = path.join(homedir(), '.duckagent', 'mesh');
const CARD_FILE = path.join(DATA_DIR, 'agent-card.json');

export class AgentCardManager {
  private card: AgentCard;

  constructor() {
    this.card = this.loadOrCreate();
  }

  private loadOrCreate(): AgentCard {
    try {
      if (fs.existsSync(CARD_FILE)) {
        return JSON.parse(fs.readFileSync(CARD_FILE, 'utf-8'));
      }
    } catch (error) {
      console.error('[AgentCard] Failed to load card, using defaults:', error);
    }

    // Create default card
    return {
      name: 'duck-agent',
      version: '0.4.0',
      description: 'Duck Agent - Multi-provider AI with KAIROS, Sub-Conscious, AI Council',
      capabilities: {
        streaming: true,
        pushNotifications: false,
        stateTransitionHistory: true,
        inputModes: ['text', 'json'],
        outputModes: ['text', 'json']
      },
      skills: this.detectSkills(),
      streaming: true,
      endpoint: process.env.AGENT_MESH_URL || 'http://localhost:4000'
    };
  }

  private detectSkills(): Skill[] {
    const skills: Skill[] = [
      { name: 'duck_run', description: 'Run AI tasks with smart provider routing', tags: ['ai', 'reasoning'] },
      { name: 'duck_council', description: '~35-agent deliberative council', tags: ['ai', 'deliberation'] },
      { name: 'duck_kairos', description: 'Proactive autonomous AI', tags: ['ai', 'autonomous'] },
      { name: 'provider_list', description: 'List available AI providers', tags: ['system'] },
      { name: 'memory_recall', description: 'Search long-term memory', tags: ['memory'] },
      { name: 'desktop_control', description: 'Control desktop applications', tags: ['system'] },
      { name: 'code_generation', description: 'Generate code with Claude Code tools', tags: ['coding'] },
      { name: 'web_search', description: 'Search the web', tags: ['search'] },
      { name: 'shell_exec', description: 'Execute shell commands', tags: ['system'] },
      { name: 'cron_schedule', description: 'Schedule autonomous tasks', tags: ['automation'] },
    ];

    // Try to load skills from installed skills
    try {
      const skillsDir = path.join(process.cwd(), 'dist', 'skills');
      if (fs.existsSync(skillsDir)) {
        const skillFiles = fs.readdirSync(skillsDir).filter(f => f.endsWith('.json'));
        for (const file of skillFiles) {
          const skillData = JSON.parse(fs.readFileSync(path.join(skillsDir, file), 'utf-8'));
          if (skillData.name && skillData.description) {
            skills.push({
              name: skillData.name,
              description: skillData.description,
              tags: skillData.tags || ['general']
            });
          }
        }
      }
    } catch (error) {
      console.error('[AgentCard] Failed to detect skills:', error);
    }

    return skills;
  }

  getCard(): AgentCard {
    return this.card;
  }

  updateCard(updates: Partial<AgentCard>): AgentCard {
    this.card = { ...this.card, ...updates };
    this.save();
    return this.card;
  }

  addSkill(skill: Skill): void {
    if (!this.card.skills.find(s => s.name === skill.name)) {
      this.card.skills.push(skill);
      this.save();
    }
  }

  removeSkill(name: string): void {
    this.card.skills = this.card.skills.filter(s => s.name !== name);
    this.save();
  }

  private save(): void {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(CARD_FILE, JSON.stringify(this.card, null, 2));
    } catch (error) {
      console.error('[AgentCard] Failed to save:', error);
    }
  }

  toJSON(): string {
    return JSON.stringify(this.card, null, 2);
  }

  static fromJSON(json: string): AgentCard {
    return JSON.parse(json);
  }
}

export const agentCardManager = new AgentCardManager();
