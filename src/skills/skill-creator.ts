/**
 * Duck Agent - Autonomous Skill Creator
 * Detects complex recurring patterns and auto-creates skills
 * Uses LLM to generate properly formatted SKILL.md files
 */

import { mkdirSync, writeFileSync, readdirSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { ProviderManager } from '../providers/manager.js';
import { SkillRunner } from './runner.js';

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
}

const SKILL_AUTOCREATE_DIR = join(process.env.HOME || '/tmp', '.duck', 'skills', 'auto');

export class SkillCreator {
  private skillExecutions: Map<string, SkillExecution[]> = new Map();
  private skillPatterns: Map<string, number> = new Map(); // pattern → count
  private minPatternLength = 3; // Min tools in sequence to consider
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

    // Use MiniMax for skill generation (fast + capable)
    const provider = new ProviderManager();
    await provider.load(); // Initialize providers before use
    const model = 'minimax/glm-5';

    const systemPrompt = `You are duck-cli's Skill Creator. Given a recurring task pattern, output a properly formatted SKILL.md file.

Output ONLY valid markdown. Use this exact format:

\`\`\`markdown
# {Skill Name}

**Trigger phrases:** phrase1, phrase2, phrase3
**Created:** ${new Date().toISOString().split('T')[0]}
**Auto-created:** true
**Pattern:** ${pattern}

## Description
{2-3 sentence description of what this skill does}

## Steps
1. {First step}
2. {Second step}
3. {Third step...}

## Example
User: {example prompt that would trigger this skill}
Agent: {what the agent should do}
\`\`\`

Rules:
- Skill name: Use kebab-case, max 3 words
- Triggers: 3-5 short phrases that would make someone want this skill
- Steps: 3-7 numbered steps, specific to THIS pattern
- Example: Use a real prompt from the executions provided
- Be specific about the tools and order, not generic`;

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

    const provider = new ProviderManager();
    await provider.load(); // Initialize providers before use
    const model = 'minimax/glm-5';

    const context = `Create a skill from this request:\n"${prompt}"\n\nSteps identified:\n${steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}`;

    const systemPrompt = `You are duck-cli's Skill Creator. Output ONLY a SKILL.md file.

\`\`\`markdown
# {Skill Name}

**Trigger phrases:** phrase1, phrase2, phrase3
**Created:** ${new Date().toISOString().split('T')[0]}
**Auto-created:** true

## Description
{2-3 sentence description}

## Steps
${steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}

## Example
User: {trigger phrase}
Agent: {behavior}
\`\`\``;

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
    return content.includes('# ') &&
           content.includes('**Trigger') &&
           content.includes('## Description') &&
           content.includes('## Steps');
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
    const content = `# ${name}

**Trigger phrases:** ${pattern.split('→').join(', ')}
**Created:** ${new Date().toISOString().split('T')[0]}
**Auto-created:** true
**Pattern:** ${pattern}

## Description
Auto-created skill from ${executions.length} recurring executions of: ${pattern}

## Steps
${pattern.split('→').map((tool, i) => `${i + 1}. Use ${tool}`).join('\n')}

## Example
User: ${example?.prompt.slice(0, 100) || 'trigger phrase'}
Agent: Execute the ${pattern} workflow
`;

    return this.saveSkill(name, content);
  }

  private parseSkillTemplate(name: string, content: string): SkillTemplate {
    const triggersMatch = content.match(/\*\*Trigger phrases:\*\* ([^\n]+)/);
    const descMatch = content.match(/## Description\n([\s\S]+?)(?=## |```)/);
    const stepMatches = content.matchAll(/^\d+\. (.+)$/gm);
    const exampleMatch = content.match(/User: (.+)\nAgent: (.+)/);

    return {
      name,
      description: descMatch?.[1]?.trim() || name,
      triggers: triggersMatch?.[1]?.split(',').map(t => t.trim()) || [],
      steps: Array.from(stepMatches).map(m => m[1]),
      example: {
        prompt: exampleMatch?.[1] || '',
        behavior: exampleMatch?.[2] || ''
      },
      autoCreated: content.includes('**Auto-created:** true'),
      createdAt: new Date().toISOString(),
      parentExecutions: this.skillPatterns.get(name) || 0
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
