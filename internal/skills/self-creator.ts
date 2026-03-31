/**
 * Duck CLI - Agent-Created Skills (Procedural Memory)
 * 
 * Based on Hermes Agent's self-improvement loop:
 * - After N complex tool calls, agent creates a SKILL.md
 * - Skills self-improve during use
 * - Substring-based patching for efficient updates
 */

import { readdir, readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

export interface SkillDefinition {
  name: string;
  description: string;
  triggers: string[];
  usageCount: number;
  lastUsed: number;
  createdAt: number;
  content: string;
}

export interface SkillCreateOptions {
  name: string;
  description: string;
  triggers: string[];
  content: string;
  bins?: string[];
}

export interface AgentSkillConfig {
  autoCreate: boolean;
  complexityThreshold: number;  // Tool calls before suggesting skill
  skillDir: string;
  maxSkills: number;
}

const DEFAULT_CONFIG: AgentSkillConfig = {
  autoCreate: true,
  complexityThreshold: 5,
  skillDir: '.duck/skills',
  maxSkills: 50
};

export class SelfCreatingSkills {
  private config: AgentSkillConfig;
  private skillDir: string;
  private skills = new Map<string, SkillDefinition>();
  private toolCallCount = 0;
  private recentToolCalls: { tool: string; args: any }[] = [];

  constructor(config?: Partial<AgentSkillConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.skillDir = join(process.cwd(), this.config.skillDir);
  }

  async initialize(): Promise<void> {
    await mkdir(this.skillDir, { recursive: true });
    await this.loadExistingSkills();
  }

  private async loadExistingSkills(): Promise<void> {
    if (!existsSync(this.skillDir)) return;

    const entries = await readdir(this.skillDir, { withFileTypes: true });
    
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      
      const skillPath = join(this.skillDir, entry.name, 'SKILL.md');
      if (!existsSync(skillPath)) continue;

      try {
        const content = await readFile(skillPath, 'utf-8');
        const skill = this.parseSkillMarkdown(entry.name, content);
        if (skill) {
          this.skills.set(skill.name, skill);
        }
      } catch {
        // Skip invalid skills
      }
    }
  }

  private parseSkillMarkdown(name: string, content: string): SkillDefinition | null {
    // Parse YAML frontmatter
    const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!match) return null;

    const yaml = match[1];
    const body = match[2];

    const get = (key: string): string | undefined => {
      const m = yaml.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
      return m ? m[1].trim().replace(/^["']|["']$/g, '') : undefined;
    };

    const triggers: string[] = [];
    const triggerMatch = yaml.match(/triggers:([\s\S]*?)(?=^\w|\n\w)/m);
    if (triggerMatch) {
      const lines = triggerMatch[1].split('\n');
      for (const line of lines) {
        const m = line.match(/^\s*-\s*(.+)/);
        if (m) triggers.push(m[1].trim().replace(/^["']|["']$/g, ''));
      }
    }

    return {
      name: get('name') || name,
      description: get('description') || '',
      triggers,
      usageCount: parseInt(get('usageCount') || '0'),
      lastUsed: parseInt(get('lastUsed') || '0'),
      createdAt: parseInt(get('createdAt') || Date.now().toString()),
      content
    };
  }

  // Track tool usage
  trackToolCall(toolName: string, args: any): void {
    this.recentToolCalls.push({ tool: toolName, args });
    this.toolCallCount++;

    // Keep only recent calls
    if (this.recentToolCalls.length > 20) {
      this.recentToolCalls.shift();
    }
  }

  // Check if we should suggest creating a skill
  shouldSuggestSkill(): boolean {
    if (!this.config.autoCreate) return false;
    return this.toolCallCount >= this.config.complexityThreshold;
  }

  // Analyze recent work to generate skill suggestion
  analyzeForSkill(): { suggestion: string; skill: Partial<SkillCreateOptions> } | null {
    if (!this.shouldSuggestSkill()) return null;

    // Simple pattern detection
    const toolSequence = this.recentToolCalls.map(t => t.tool).join(' → ');
    
    // Check if this is a reusable pattern
    if (this.recentToolCalls.length < 3) return null;

    // Detect common patterns
    const hasRead = this.recentToolCalls.some(t => t.tool === 'Read');
    const hasWrite = this.recentToolCalls.some(t => t.tool === 'Write');
    const hasBash = this.recentToolCalls.some(t => t.tool === 'Bash');
    const hasGit = this.recentToolCalls.some(t => t.tool === 'Bash' && JSON.stringify(t.args).includes('git'));

    let name = 'custom-workflow';
    let description = 'A custom workflow';
    let triggers: string[] = [];

    if (hasGit && hasRead) {
      name = 'git-review';
      description = 'Review git changes and analyze code';
      triggers = ['review git', 'check git diff', 'review changes'];
    } else if (hasWrite && hasBash) {
      name = 'build-deploy';
      description = 'Build and deploy application';
      triggers = ['build and deploy', 'deploy app', 'build project'];
    } else if (hasRead && hasWrite) {
      name = 'code-edit';
      description = 'Read and edit code files';
      triggers = ['edit code', 'modify files', 'code changes'];
    } else {
      name = `workflow-${Date.now()}`;
      description = `Tool sequence: ${toolSequence}`;
      triggers = [name.replace(/-/g, ' ')];
    }

    this.toolCallCount = 0;
    this.recentToolCalls = [];

    return {
      suggestion: `Detected pattern that could be saved as a skill: ${name}`,
      skill: {
        name,
        description,
        triggers,
        content: this.generateSkillContent(name, description, this.recentToolCalls)
      }
    };
  }

  private generateSkillContent(name: string, description: string, calls: { tool: string; args: any }[]): string {
    const examples = calls.slice(0, 3).map(c => {
      return `\`\`\`\n${c.tool}: ${JSON.stringify(c.args, null, 2)}\n\`\`\``;
    }).join('\n');

    return `---
name: ${name}
description: "${description}"
triggers:
  - "${name.replace(/-/g, ' ')}"
usageCount: 0
lastUsed: ${Date.now()}
createdAt: ${Date.now()}
---

# ${name}

${description}

## What it does

This skill automates: ${calls.map(c => c.tool).join(' → ')}

## Usage

Run with: /\`${name}\`

## Examples

${examples}

## Auto-generated

This skill was created automatically by Duck CLI's self-improvement system.
`;
  }

  // Create a skill
  async createSkill(options: SkillCreateOptions): Promise<{ success: boolean; path?: string; error?: string }> {
    if (this.skills.size >= this.config.maxSkills) {
      return { success: false, error: `Max skills (${this.config.maxSkills}) reached` };
    }

    if (this.skills.has(options.name)) {
      return { success: false, error: `Skill "${options.name}" already exists` };
    }

    const skillDir = join(this.skillDir, options.name);
    await mkdir(skillDir, { recursive: true });

    const content = `---
name: ${options.name}
description: "${options.description}"
triggers:
${options.triggers.map(t => `  - "${t}"`).join('\n')}
bins:
${(options.bins || []).map(b => `  - ${b}`).join('\n')}
usageCount: 0
lastUsed: ${Date.now()}
createdAt: ${Date.now()}
---

${options.content}
`;

    await writeFile(join(skillDir, 'SKILL.md'), content, 'utf-8');

    const skill: SkillDefinition = {
      name: options.name,
      description: options.description,
      triggers: options.triggers,
      usageCount: 0,
      lastUsed: Date.now(),
      createdAt: Date.now(),
      content
    };

    this.skills.set(options.name, skill);

    return { success: true, path: skillDir };
  }

  // Patch/update an existing skill
  async patchSkill(name: string, find: string, replace: string): Promise<{ success: boolean; error?: string }> {
    const skill = this.skills.get(name);
    if (!skill) {
      return { success: false, error: `Skill "${name}" not found` };
    }

    if (!skill.content.includes(find)) {
      return { success: false, error: `Pattern "${find.slice(0, 30)}..." not found in skill` };
    }

    const newContent = skill.content.replace(find, replace);
    
    await writeFile(join(this.skillDir, name, 'SKILL.md'), newContent, 'utf-8');
    
    skill.content = newContent;
    this.skills.set(name, skill);

    return { success: true };
  }

  // Increment usage
  async markUsed(name: string): Promise<void> {
    const skill = this.skills.get(name);
    if (skill) {
      skill.usageCount++;
      skill.lastUsed = Date.now();

      // Update the file
      const skillPath = join(this.skillDir, name, 'SKILL.md');
      const updated = skill.content.replace(
        /usageCount: \d+/,
        `usageCount: ${skill.usageCount}`
      ).replace(
        /lastUsed: \d+/,
        `lastUsed: ${skill.lastUsed}`
      );

      await writeFile(skillPath, updated, 'utf-8');
    }
  }

  // Find skill by trigger
  findByTrigger(input: string): SkillDefinition | null {
    const lower = input.toLowerCase();
    
    for (const skill of this.skills.values()) {
      for (const trigger of skill.triggers) {
        if (lower.includes(trigger.toLowerCase())) {
          return skill;
        }
      }
    }
    return null;
  }

  // Get all skills
  listSkills(): SkillDefinition[] {
    return Array.from(this.skills.values());
  }

  // Get skill
  getSkill(name: string): SkillDefinition | undefined {
    return this.skills.get(name);
  }

  // Delete skill
  async deleteSkill(name: string): Promise<boolean> {
    const skill = this.skills.get(name);
    if (!skill) return false;

    try {
      await rm(join(this.skillDir, name), { recursive: true });
      this.skills.delete(name);
      return true;
    } catch {
      return false;
    }
  }

  // Get most used skills
  getMostUsed(limit: number = 5): SkillDefinition[] {
    return Array.from(this.skills.values())
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, limit);
  }

  // Get recently used
  getRecentlyUsed(limit: number = 5): SkillDefinition[] {
    return Array.from(this.skills.values())
      .sort((a, b) => b.lastUsed - a.lastUsed)
      .slice(0, limit);
  }
}
