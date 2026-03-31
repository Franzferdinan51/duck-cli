/**
 * Duck CLI - Toolset System
 * 
 * Based on Hermes Agent's toolset_distributions.py:
 * - Pre-configured tool bundles
 * - Easy tool grouping
 * - Restrictive defaults
 */

import { ToolRegistry, Tool } from './registry.js';

export interface Toolset {
  name: string;
  description: string;
  tools: string[];
  restrictions?: {
    allowed?: string[];
    blocked?: string[];
  };
}

// Pre-configured toolsets
export const TOOLSETS: Record<string, Toolset> = {
  // Minimal - safe defaults
  minimal: {
    name: 'minimal',
    description: 'Read-only access to files',
    tools: ['Read', 'Glob', 'Grep'],
    restrictions: {
      blocked: ['Write', 'Bash', 'Rm']
    }
  },

  // Terminal operations
  terminal: {
    name: 'terminal',
    description: 'Shell commands and file operations',
    tools: ['Read', 'Write', 'Bash', 'Glob', 'Grep', 'Ls']
  },

  // Full file access
  file: {
    name: 'file',
    description: 'Complete file operations',
    tools: ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'Ls', 'Rm', 'Mkdir']
  },

  // Web access
  web: {
    name: 'web',
    description: 'Web browsing and fetching',
    tools: ['Fetch', 'WebSearch', 'WebScrape']
  },

  // Memory (read-only)
  memory: {
    name: 'memory',
    description: 'Read from memory and context',
    tools: ['MemoryRead', 'SessionSearch', 'ContextRead']
  },

  // Development tools
  dev: {
    name: 'dev',
    description: 'Development workflow',
    tools: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep', 'Git', 'Npm', 'Pip']
  },

  // CI/CD
  cicd: {
    name: 'cicd',
    description: 'CI/CD and deployment',
    tools: ['Bash', 'Git', 'Docker', 'Kubectl', 'Terraform']
  },

  // Data science
  data: {
    name: 'data',
    description: 'Data analysis and ML',
    tools: ['Read', 'Bash', 'Python', 'Jupyter', 'Pandas', 'Sql']
  },

  // Security (restricted)
  security: {
    name: 'security',
    description: 'Security scanning (read-only)',
    tools: ['Read', 'Bash', 'NpmAudit', 'Grep'],
    restrictions: {
      blocked: ['Write', 'Rm', 'Bash'],
      allowed: ['NpmAudit', 'Grep', 'Read']
    }
  },

  // All tools (use carefully)
  all: {
    name: 'all',
    description: 'All available tools (dangerous)',
    tools: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep', 'Ls', 'Rm', 'Mkdir', 'Fetch', 'WebSearch', 'Git', 'Docker']
  }
};

// Agent presets with safe defaults
export const AGENT_PRESETS: Record<string, string[]> = {
  // Safe for untrusted code
  safe: ['minimal'],

  // Development work
  developer: ['terminal', 'file', 'memory'],

  // Research
  researcher: ['web', 'memory'],

  // Full access
  power: ['terminal', 'file', 'web', 'memory'],

  // Admin tasks
  admin: ['terminal', 'file', 'cicd']
};

export class ToolsetManager {
  private registry: ToolRegistry;

  constructor(registry: ToolRegistry) {
    this.registry = registry;
  }

  getToolsForToolset(toolsetNames: string[]): Tool[] {
    const tools: Map<string, Tool> = new Map();

    for (const name of toolsetNames) {
      const toolset = TOOLSETS[name];
      if (!toolset) continue;

      for (const toolName of toolset.tools) {
        const tool = this.registry.get(toolName);
        if (tool) {
          // Check restrictions
          if (toolset.restrictions?.blocked?.includes(toolName)) {
            continue;
          }
          tools.set(toolName, tool);
        }
      }
    }

    return Array.from(tools.values());
  }

  getPresetTools(preset: string): Tool[] {
    const toolsetNames = AGENT_PRESETS[preset] || ['minimal'];
    return this.getToolsForToolset(toolsetNames);
  }

  listToolsets(): Toolset[] {
    return Object.values(TOOLSETS);
  }

  listPresets(): { name: string; toolsets: string[] }[] {
    return Object.entries(AGENT_PRESETS).map(([name, toolsets]) => ({
      name,
      toolsets
    }));
  }
}

// Threat pattern scanner for tool inputs
export class ToolSecurityScanner {
  private patterns = [
    // Path traversal
    { pattern: /\.\.\//g, name: 'path_traversal' },
    
    // Command injection
    { pattern: /[;&|`$]/g, name: 'command_injection' },
    { pattern: /\$\(/g, name: 'command_substitution' },
    
    // Dangerous commands
    { pattern: /rm\s+-rf\s+\//g, name: 'destructive_rm' },
    { pattern: /:!|\|sh/g, name: 'shell_escape' },
    
    // File writes to sensitive locations
    { pattern: /\/\.ssh\//g, name: 'ssh_access' },
    { pattern: /\/\.aws\//g, name: 'aws_creds' },
    { pattern: /\/etc\/passwd/g, name: 'system_file' },
  ];

  scan(input: string): { safe: boolean; threats: string[] } {
    const threats: string[] = [];

    for (const { pattern, name } of this.patterns) {
      if (pattern.test(input)) {
        threats.push(name);
      }
    }

    return {
      safe: threats.length === 0,
      threats
    };
  }

  blockIfThreat(input: string): void {
    const { safe, threats } = this.scan(input);
    if (!safe) {
      throw new Error(`Blocked: detected threats: ${threats.join(', ')}`);
    }
  }
}
