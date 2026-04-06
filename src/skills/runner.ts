/**
 * Duck Agent - Skill Runner
 * Execute and manage skills
 */

import { readdir, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { DEFAULT_SKILLS as PROMPT_SKILLS } from '../prompts/skills.js';

export interface Skill {
  name: string;
  description: string;
  triggers: string[];
  content: string;
}

export class SkillRunner {
  private skillsDir: string;
  private skills: Map<string, Skill> = new Map();

  constructor(skillsDir?: string) {
    if (skillsDir) {
      this.skillsDir = skillsDir;
    } else {
      // Auto-detect installed skills dir (next to dist/), fallback to CWD
      const distCliDir = dirname(process.argv[1] || process.execPath);
      const distDir = join(distCliDir, '..'); // dist/cli/ -> dist/
      const installedSkills = join(distDir, 'skills'); // ~/.local/bin/dist/skills/
      if (existsSync(installedSkills)) {
        this.skillsDir = installedSkills;
      } else {
        this.skillsDir = join(distDir, '..', 'skills'); // ~/.local/bin/skills/
        if (!existsSync(this.skillsDir)) {
          this.skillsDir = './skills'; // fallback to CWD
        }
      }
    }
  }

  async load(): Promise<void> {
    // Register built-in skills from prompts/skills.ts first
    for (const promptSkill of PROMPT_SKILLS) {
      if (!this.skills.has(promptSkill.name)) {
        this.skills.set(promptSkill.name, {
          name: promptSkill.name,
          description: promptSkill.description,
          triggers: Array.isArray(promptSkill.trigger)
            ? promptSkill.trigger
            : promptSkill.trigger ? [promptSkill.trigger] : [],
          content: promptSkill.content,
        });
        console.log(`   + Skill(builtin): ${promptSkill.name}`);
      }
    }

    const scanDirs: string[] = [this.skillsDir];

    // Also scan auto-created skills dir
    const autoDir = join(homedir(), '.duck', 'skills', 'auto');
    if (existsSync(autoDir) && !scanDirs.includes(autoDir)) {
      scanDirs.push(autoDir);
    }

    for (const dir of scanDirs) {
      if (!existsSync(dir)) continue;

      const entries = await readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        const skillPath = join(dir, entry.name, 'SKILL.md');
        if (!existsSync(skillPath)) continue;

        try {
          const content = await readFile(skillPath, 'utf-8');
          const skill = this.parseSkill(entry.name, content);
          // Don't override manual skills with auto ones of same name
          if (!this.skills.has(skill.name)) {
            this.skills.set(skill.name, skill);
            const tag = dir.includes('.duck') ? '(auto)' : '';
            console.log(`   + Skill${tag}: ${skill.name}`);
          }
        } catch (e) {
          // Skip invalid skills
        }
      }
    }
  }

  private parseSkill(name: string, content: string): Skill {
    // Simple parsing - look for frontmatter or headers
    let description = '';
    let triggers: string[] = [];

    const descMatch = content.match(/description:\s*(.+)/i);
    if (descMatch) description = descMatch[1];

    const triggerMatches = content.matchAll(/triggers?:\s*\n((?:\s*-\s*.+\n)+)/gi);
    for (const match of triggerMatches) {
      const lines = match[1].split('\n');
      for (const line of lines) {
        const m = line.match(/-\s*(.+)/);
        if (m) triggers.push(m[1].trim());
      }
    }

    return {
      name,
      description: description || name,
      triggers,
      content
    };
  }

  get(name: string): Skill | undefined {
    return this.skills.get(name);
  }

  find(input: string): Skill | undefined {
    const inputLower = input.toLowerCase();
    
    for (const skill of this.skills.values()) {
      // Check triggers
      for (const trigger of skill.triggers) {
        if (inputLower.includes(trigger.toLowerCase())) {
          return skill;
        }
      }
      
      // Check name
      if (inputLower.includes(skill.name.toLowerCase())) {
        return skill;
      }
    }

    return undefined;
  }

  list(): string[] {
    return Array.from(this.skills.keys());
  }

  async execute(skillName: string, input: string): Promise<string> {
    const skill = this.skills.get(skillName);
    if (!skill) {
      throw new Error(`Unknown skill: ${skillName}`);
    }

    // For now, skills are just documentation
    // In future, could execute skill scripts
    return `Skill "${skill.name}": ${skill.description}\n\n${skill.content.slice(0, 500)}...`;
  }
}

export default SkillRunner;
