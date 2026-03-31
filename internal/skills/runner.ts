/**
 * Duck CLI - Skills Runner
 * 
 * Based on OpenClaw's skill system:
 * - SKILL.md parsing
 * - Trigger matching
 * - Script execution
 */

import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface SkillMetadata {
  name: string;
  description: string;
  triggers: string[];
  bins?: string[];
  env?: Record<string, string>;
}

interface Skill {
  metadata: SkillMetadata;
  path: string;
  readme: string;
}

export interface SkillResult {
  success: boolean;
  output?: string;
  error?: string;
}

export class SkillRunner {
  private skills = new Map<string, Skill>();

  async loadSkills(): Promise<void> {
    const skillDirs = [
      // Built-in skills
      join(process.cwd(), 'skills'),
      // User skills
      join(process.cwd(), '.duck/skills')
    ];

    for (const dir of skillDirs) {
      try {
        await this.loadSkillsFromDir(dir);
      } catch {
        // Directory doesn't exist
      }
    }
  }

  private async loadSkillsFromDir(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      
      const skillPath = join(dir, entry.name);
      const skill = await this.loadSkill(skillPath);
      
      if (skill && skill.metadata.name) {
        this.skills.set(skill.metadata.name, skill);
      }
    }
  }

  private async loadSkill(path: string): Promise<Skill | null> {
    try {
      const readmePath = join(path, 'SKILL.md');
      const content = await readFile(readmePath, 'utf-8');
      const metadata = this.parseMetadata(content);
      
      if (!metadata) return null;
      
      return {
        metadata,
        path,
        readme: content
      };
    } catch {
      return null;
    }
  }

  private parseMetadata(content: string): SkillMetadata | null {
    const match = content.match(/^---\n([\s\S]*?)\n---\n/);
    if (!match) return null;

    const yaml = match[1];
    const metadata: SkillMetadata = {
      name: '',
      description: '',
      triggers: []
    };

    // Parse line by line with better quote handling
    const lines = yaml.split('\n');
    let currentKey = '';
    
    for (const line of lines) {
      // Check if this is a new key (no leading whitespace)
      if (!line.startsWith(' ') && !line.startsWith('\t')) {
        const colonIdx = line.indexOf(':');
        if (colonIdx !== -1) {
          currentKey = line.slice(0, colonIdx).trim();
          let value = line.slice(colonIdx + 1).trim();
          
          // Strip quotes from values
          if (value.startsWith('"') && value.endsWith('"')) {
            value = value.slice(1, -1);
          } else if (value.startsWith("'") && value.endsWith("'")) {
            value = value.slice(1, -1);
          }
          
          // Handle arrays
          if (value === '' || value === '[]') {
            metadata[currentKey as keyof SkillMetadata] = [] as any;
          } else {
            (metadata as any)[currentKey] = value;
          }
        }
      } else if (line.trim().startsWith('-')) {
        // Array item
        let item = line.trim().slice(1).trim();
        // Strip quotes
        if (item.startsWith('"') && item.endsWith('"')) {
          item = item.slice(1, -1);
        } else if (item.startsWith("'") && item.endsWith("'")) {
          item = item.slice(1, -1);
        }
        if (currentKey === 'triggers' || currentKey === 'bins') {
          (metadata[currentKey as keyof SkillMetadata] as string[]).push(item);
        }
      }
    }

    return metadata.name ? metadata : null;
  }

  findByTrigger(input: string): Skill | undefined {
    const lower = input.toLowerCase();
    
    for (const skill of this.skills.values()) {
      for (const trigger of skill.metadata.triggers) {
        if (lower.includes(trigger.toLowerCase())) {
          return skill;
        }
      }
    }
    
    return undefined;
  }

  async run(name: string, context: { args: string; cwd: string }): Promise<SkillResult> {
    const skill = this.skills.get(name);
    
    if (!skill) {
      return {
        success: false,
        error: `Skill not found: ${name}`
      };
    }

    // Check required binaries
    if (skill.metadata.bins) {
      for (const bin of skill.metadata.bins) {
        try {
          await execAsync(`which ${bin}`);
        } catch {
          return {
            success: false,
            error: `Required binary not found: ${bin}`
          };
        }
      }
    }

    // Execute main script if exists
    const scriptPath = join(skill.path, 'scripts/main.sh');
    
    try {
      const { stdout, stderr } = await execAsync(`bash "${scriptPath}" ${context.args}`, {
        cwd: context.cwd,
        env: { ...process.env, ...skill.metadata.env }
      });
      
      return {
        success: true,
        output: stdout + stderr
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  search(query: string): Skill[] {
    const lower = query.toLowerCase();
    const results: Skill[] = [];

    for (const skill of this.skills.values()) {
      if (
        skill.metadata.name.toLowerCase().includes(lower) ||
        skill.metadata.description.toLowerCase().includes(lower)
      ) {
        results.push(skill);
      }
    }

    return results;
  }

  listSkills(): Skill[] {
    return Array.from(this.skills.values());
  }

  getSkill(name: string): Skill | undefined {
    return this.skills.get(name);
  }
}
