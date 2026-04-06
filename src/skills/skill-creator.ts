/**
 * Duck Agent - Autonomous Skill Creator
 * Detects complex recurring patterns and auto-creates skills
 * Uses LLM to generate properly formatted SKILL.md files
 * Follows the agentskills.io open standard for skill portability
 */

import { mkdirSync, writeFileSync, readdirSync, existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { ProviderManager } from '../providers/manager.js';
import { SkillRunner } from './runner.js';

// Ensure environment variables are loaded before provider use
function ensureEnv(): void {
  if (!process.env.MINIMAX_API_KEY && !process.env.OPENROUTER_API_KEY) {
    try {
      const dotenv = require('dotenv');
      const paths = [
        join(process.cwd(), '.env'),
        join(homedir(), '.openclaw', 'workspace', 'duck-cli-src', '.env'),
        join(dirname(process.argv[1] || '/'), '..', '..', '.env'),
      ];
      for (const p of paths) {
        if (existsSync(p)) {
          dotenv.config({ path: p });
          break;
        }
      }
    } catch {}
  }
}

export interface SkillExecution {
  id: string;
  prompt: string;
  toolSequence: string[];
  success: boolean;
  timestamp: number;
  durationMs: number;
  output?: string;
}

export interface SkillTemplate {
  name: string;
  description: string;
  triggers: string[];
  steps: string[];
  example: { prompt: string; behavior: string };
  autoCreated: boolean;
  createdAt: string;
  parentExecutions: number;
  // agentskills.io standard fields
  author: string;
  version: string;
}

const SKILL_AUTOCREATE_DIR = join(process.env.HOME || '/tmp', '.duck', 'skills', 'auto');

// agentskills.io YAML frontmatter template for tryCreateSkill
const AGENTSKILLS_PROMPT_TEMPLATE = `--You are duck-cli's Skill Creator. Given a recurring task pattern, output a properly formatted SKILL.md file.

Follow the agentskills.io standard with YAML frontmatter:

\`\`\`markdown
---
name: skill-name
description: 2-3 sentence description of what this skill does and when to use it.
metadata:
  author: duck-cli
  version: "1.0.0"
---

# Skill Name

## Trigger Phrases
phrase1, phrase2, phrase3

## Steps
1. {First step}
2. {Second step}
3. {Third step...}

## Example
User: {example prompt that would trigger this skill}
Agent: {what the agent should do}
\`\`\`

Rules:
- name: kebab-case, max 64 chars, lowercase alphanumeric + hyphens only
- description: max 1024 chars, describe what it does AND when to use it
- metadata.author: always "duck-cli"
- metadata.version: always "1.0.0"
- Triggers: 3-5 short phrases that would make someone want this skill
- Steps: 3-7 numbered steps, specific to THIS pattern
- Example: Use a real prompt from the executions provided
- Be specific about the tools and order, not generic-->`;

const SKILLIFY_PROMPT_TEMPLATE = `--You are duck-cli's Skill Creator. Output ONLY a SKILL.md file.

Follow the agentskills.io standard with YAML frontmatter:

\`\`\`markdown
---
name: skill-name
description: 2-3 sentence description of what this skill does and when to use it.
metadata:
  author: duck-cli
  version: "1.0.0"
---

# Skill Name

## Trigger Phrases
phrase1, phrase2, phrase3

## Steps
${'{steps}'}

## Example
User: {trigger phrase}
Agent: {behavior}
\`\`\`

Rules:
- name: kebab-case, max 64 chars, lowercase alphanumeric + hyphens only
- description: max 1024 chars, describe what it does AND when to use it
- metadata.author: always "duck-cli"
- metadata.version: always "1.0.0"-->`;

const SKILLAUTO_FRONT = `-----
name: `;
const SKILLAUTO_MID1 = `
description: Auto-created skill from `;
const SKILLAUTO_MID2 = ` recurring executions of `;
const SKILLAUTO_MID3 = `. Trigger when needing to perform this workflow.
metadata:
  author: duck-cli
  version: "1.0.0"
---

# `;
const SKILLAUTO_TRIGGERS = `

## Trigger Phrases
`;
const SKILLAUTO_DESC = `

## Description
Auto-created skill from `;
const SKILLAUTO_STEPS = `

## Steps
`;
const SKILLAUTO_EXAMPLE1 = `

## Example
User: `;
const SKILLAUTO_EXAMPLE2 = `
Agent: Execute the `;
const SKILLAUTO_END = ` workflow
`;

const SKILLAUTO_NAME_DESC_FRONT = `-----
name: `;
const SKILLAUTO_NAME_DESC_MID1 = `
description: Auto-created skill from `;
const SKILLAUTO_NAME_DESC_MID2 = ` recurring executions. Trigger when needing to perform this workflow.
metadata:
  author: duck-cli
  version: "1.0.0"
---

# `;

export class SkillCreator {
  private skillExecutions: Map<string, SkillExecution[]> = new Map();
  private skillPatterns: Map<string, number> = new Map(); // pattern → count
  private minPatternLength = 2; // Min tools in sequence to consider
  private minOccurrences = 3;   // Times a pattern must repeat to create skill

  constructor() {
    // Ensure auto-create dir exists
    if (!existsSync(SKILL_AUTOCREATE_DIR)) {
      mkdirSync(SKILL_AUTOCREATE_DIR, { recursive: true });
    }
  }

  /**
   * Record a tool sequence from a task execution
   */
  recordExecution(prompt: string, toolSequence: string[], success: boolean, durationMs: number, output?: string): void {
    // Create a pattern key from sorted unique tools
    const pattern = toolSequence.filter(t => t !== 'unknown').join('→');
    if (!pattern || toolSequence.length < this.minPatternLength) return;

    const execId = `exec_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const execution: SkillExecution = {
      id: execId,
      prompt,
      toolSequence,
      success,
      timestamp: Date.now(),
      durationMs,
      output
    };

    // Store execution
    const existing = this.skillExecutions.get(pattern) || [];
    existing.push(execution);
    this.skillExecutions.set(pattern, existing);

    // Increment pattern count
    const count = (this.skillPatterns.get(pattern) || 0) + 1;
    this.skillPatterns.set(pattern, count);

    // Check if we should create a skill
    if (count >= this.minOccurrences && existing.length >= 3) {
      const skillExecutions = existing.filter(e => e.success);
      if (skillExecutions.length >= 2) {
        this.tryCreateSkill(pattern, skillExecutions);
      }
    }
  }

  /**
   * Get patterns that are ready for skill creation
   */
  getReadyPatterns(): Array<{ pattern: string; count: number; executions: SkillExecution[] }> {
    const ready: Array<{ pattern: string; count: number; executions: SkillExecution[] }> = [];
    for (const [pattern, count] of this.skillPatterns) {
      if (count >= this.minOccurrences) {
        const executions = this.skillExecutions.get(pattern) || [];
        ready.push({ pattern, count, executions });
      }
    }
    return ready.sort((a, b) => b.count - a.count);
  }

  /**
   * Try to create a skill from a recurring pattern
   */
  async tryCreateSkill(pattern: string, executions: SkillExecution[]): Promise<SkillTemplate | null> {
    // Check if skill already exists for this pattern
    const skillName = this.patternToSkillName(pattern);
    if (this.skillExists(skillName)) {
      return null;
    }

    console.log(`\n🎯 SkillCreator: Detected recurring pattern "${skillName}" (${executions.length} occurrences)`);

    // Build context for LLM
    const context = this.buildCreationContext(pattern, executions);

    // Load env vars so provider can actually call the LLM
    ensureEnv();
    const provider = new ProviderManager();
    await provider.load();
    await provider.load(); // Initialize providers before use
    const model = 'minimax/MiniMax-M2.7';

    try {
      const response = await provider.routeWithModel(model, context);
      const content = response.text;
      const skillMd = this.extractMarkdown(content);

      if (skillMd && this.isValidSkillMd(skillMd)) {
        return this.saveSkill(skillName, skillMd);
      } else {
        console.log(`⚠️  SkillCreator: LLM output invalid, saving raw version`);
        // Save with basic info even if LLM failed
        return this.saveSkillBasic(skillName, pattern, executions);
      }
    } catch (e: any) {
      console.log(`⚠️  SkillCreator: LLM failed (${e.message}), saving basic skill`);
      return this.saveSkillBasic(skillName, pattern, executions);
    }
  }

  /**
   * Manually trigger skill creation for a specific pattern
   */
  async createSkillForPattern(pattern: string): Promise<SkillTemplate | null> {
    const executions = this.skillExecutions.get(pattern) || [];
    const successful = executions.filter(e => e.success);
    if (successful.length === 0) {
      console.log(`⚠️  No successful executions for pattern: ${pattern}`);
      return null;
    }
    return this.tryCreateSkill(pattern, successful);
  }

  /**
   * Create a skill from a natural language description
   */
  async createSkillFromPrompt(prompt: string, steps: string[]): Promise<SkillTemplate | null> {
    const skillName = this.promptToSkillName(prompt);
    if (this.skillExists(skillName)) {
      console.log(`⚠️  Skill already exists: ${skillName}`);
      return null;
    }

    ensureEnv();
    const provider = new ProviderManager();
    await provider.load(); // Initialize providers before use
    const model = 'minimax/MiniMax-M2.7';

    const context = `Create a skill from this request:\n"${prompt}"\n\nSteps identified:\n${steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}`;

    try {
      const response = await provider.routeWithModel(model, context);
      const content = response.text;
      const skillMd = this.extractMarkdown(content);

      if (skillMd) {
        return this.saveSkill(skillName, skillMd);
      }
    } catch (e: any) {
      console.log(`⚠️  SkillCreator: ${e.message}`);
    }
    return null;
  }

  private buildCreationContext(pattern: string, executions: SkillExecution[]): string {
    const recent = executions.slice(-5);
    return `Recurring task pattern detected:

PATTERN: ${pattern}
OCCURRENCES: ${executions.length}

EXAMPLE EXECUTIONS:
${recent.map((e, i) => `
[${i + 1}] Prompt: "${e.prompt.slice(0, 150)}"
  Tools: ${e.toolSequence.join(' → ')}
  Duration: ${Math.round(e.durationMs / 1000)}s
  Success: ${e.success}
`).join('\n')}

Generate a SKILL.md that captures this recurring task.`;
  }

  private patternToSkillName(pattern: string): string {
    // Convert "shell→file_write→shell" to "shell-file-workflow"
    const parts = pattern.split('→').filter(p => p.length > 2);
    if (parts.length === 0) return 'generic-workflow';
    if (parts.length === 1) return `${parts[0]}-workflow`;
    if (parts.length === 2) return `${parts[0]}-${parts[1]}`;
    return `${parts[0]}-workflow`;
  }

  private promptToSkillName(prompt: string): string {
    // Extract key words from prompt
    const words = prompt.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 3)
      .slice(0, 3);
    return words.join('-') || 'custom-skill';
  }

  private extractMarkdown(content: string): string | null {
    const match = content.match(/```markdown\n([\s\S]*?)```/);
    return match ? match[1].trim() : content.trim();
  }

  private isValidSkillMd(content: string): boolean {
    // Check for agentskills.io YAML frontmatter
    const hasFrontmatter = content.startsWith('---') && content.includes('name:') && content.includes('description:') && content.includes('metadata:');
    // Also validate body sections
    const hasBody = content.includes('# ') && content.includes('## Steps');
    return hasFrontmatter && hasBody;
  }

  private skillExists(name: string): boolean {
    const skillPath = join(SKILL_AUTOCREATE_DIR, name, 'SKILL.md');
    return existsSync(skillPath);
  }

  private saveSkill(name: string, content: string): SkillTemplate {
    const dir = join(SKILL_AUTOCREATE_DIR, name);
    mkdirSync(dir, { recursive: true });

    const skillPath = join(dir, 'SKILL.md');
    writeFileSync(skillPath, content);

    console.log(`✅ SkillCreator: Created skill "${name}" at ${skillPath}`);

    return this.parseSkillTemplate(name, content);
  }

  private saveSkillBasic(name: string, pattern: string, executions: SkillExecution[]): SkillTemplate {
    const example = executions[executions.length - 1];
    const stepLines = pattern.split('→').map((tool, i) => `${i + 1}. Use ${tool}`).join('\n');
    const content =
      SKILLAUTO_NAME_DESC_FRONT + name +
      SKILLAUTO_NAME_DESC_MID1 + executions.length +
      SKILLAUTO_NAME_DESC_MID2 +
      SKILLAUTO_TRIGGERS.slice(2) + pattern.split('→').join(', ') +
      SKILLAUTO_DESC + executions.length + SKILLAUTO_MID2 + pattern +
      SKILLAUTO_STEPS + stepLines +
      SKILLAUTO_EXAMPLE1 + (example?.prompt.slice(0, 100) || 'trigger phrase') +
      SKILLAUTO_EXAMPLE2 + pattern +
      SKILLAUTO_END;

    return this.saveSkill(name, content);
  }

  private parseSkillTemplate(name: string, content: string): SkillTemplate {
    const triggersMatch = content.match(/## Trigger Phrases\n([\s\S]+?)(?=## |```)/i);
    const descMatch = content.match(/## Description\n([\s\S]+?)(?=## |```)/i);
    const stepMatches = content.matchAll(/^\d+\. (.+)$/gm);
    const exampleMatch = content.match(/User: (.+)\nAgent: (.+)/);
    const metadataMatch = content.match(/metadata:\s+author:\s*(\S+)/i);

    return {
      name,
      description: descMatch?.[1]?.trim() || name,
      triggers: triggersMatch?.[1]?.split(',').map((t: string) => t.trim()).filter(Boolean) || [],
      steps: Array.from(stepMatches).map((m: RegExpMatchArray) => m[1]),
      example: {
        prompt: exampleMatch?.[1] || '',
        behavior: exampleMatch?.[2] || ''
      },
      autoCreated: content.includes('duck-cli'),
      createdAt: new Date().toISOString(),
      parentExecutions: this.skillPatterns.get(name) || 0,
      author: metadataMatch?.[1] || 'duck-cli',
      version: '1.0.0',
    };
  }

  /**
   * List all auto-created skills
   */
  listAutoSkills(): string[] {
    try {
      return readdirSync(SKILL_AUTOCREATE_DIR).filter(d => {
        const skillPath = join(SKILL_AUTOCREATE_DIR, d, 'SKILL.md');
        return existsSync(skillPath);
      });
    } catch {
      return [];
    }
  }

  /**
   * Get skill creator statistics
   */
  getStats(): { patternsTracked: number; skillsCreated: number; readyToCreate: number } {
    return {
      patternsTracked: this.skillPatterns.size,
      skillsCreated: this.listAutoSkills().length,
      readyToCreate: this.getReadyPatterns().length
    };
  }
}

// Singleton
let instance: SkillCreator | null = null;

export function getSkillCreator(): SkillCreator {
  if (!instance) {
    instance = new SkillCreator();
  }
  return instance;
}
