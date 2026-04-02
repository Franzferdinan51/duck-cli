/**
 * Duck Agent - Skill Runner
 * Execute and manage skills
 */

import { readdir, readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';

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
    if (!existsSync(this.skillsDir)) {
      return;
    }

    const entries = await readdir(this.skillsDir, { withFileTypes: true });
    
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      
      const skillPath = join(this.skillsDir, entry.name, 'SKILL.md');
      if (!existsSync(skillPath)) continue;

      try {
        const content = await readFile(skillPath, 'utf-8');
        const skill = this.parseSkill(entry.name, content);
        this.skills.set(skill.name, skill);
        console.log(`   + Skill: ${skill.name}`);
      } catch (e) {
        // Skip invalid skills
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
