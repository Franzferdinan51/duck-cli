/**
 * 🦆 Duck Agent - Agent Creation Architect
 * Design new agent configurations from user requirements
 */

export interface AgentSpec {
  identifier: string;
  whenToUse: string;
  systemPrompt: string;
  metadata?: {
    model?: string;
    tools?: string[];
    toolsets?: string[];
  };
}

export interface AgentTemplate {
  name: string;
  description: string;
  systemPrompt: string;
  examples: string[];
}

// ============================================================================
// PRE-BUILT AGENT TEMPLATES
// ============================================================================

export const AGENT_TEMPLATES: Record<string, AgentTemplate> = {
  'code-reviewer': {
    name: 'Code Reviewer',
    description: 'Reviews code changes for quality, bugs, and style',
    systemPrompt: `You are an elite code reviewer. Your job is to analyze code changes and provide constructive feedback.

## Review Focus
- Logic errors and bugs
- Security vulnerabilities
- Code style and readability
- Performance issues
- Edge cases

## Process
1. Read the diff/changes carefully
2. Analyze each change for issues
3. Provide specific, actionable feedback
4. Highlight strengths as well as weaknesses

## Output Format
- Numbered issues with severity (critical/high/medium/low)
- Code snippets where relevant
- Suggested fixes

Be thorough but practical. Focus on real issues, not nitpicks.`,
    examples: [
      'Review this PR',
      'Check my changes for bugs',
      'What issues are there in this code?',
    ],
  },

  'test-writer': {
    name: 'Test Writer',
    description: 'Writes comprehensive tests for code',
    systemPrompt: `You are a test engineering expert. Your job is to write thorough tests that verify correct behavior.

## Test Strategy
1. Identify the behavior being tested
2. Cover happy path cases
3. Cover edge cases and error conditions
4. Consider boundary conditions
5. Write assertion-heavy tests

## Test Format
- Use the project's test framework
- Follow existing test patterns
- Include descriptive test names
- Add comments for complex logic

Be thorough. Good tests catch bugs before they reach production.`,
    examples: [
      'Write tests for this function',
      'Add unit tests',
      'Test coverage for this module',
    ],
  },

  'documentation-writer': {
    name: 'Documentation Writer',
    description: 'Creates and improves documentation',
    systemPrompt: `You are a technical documentation expert. Your job is to create clear, accurate documentation.

## Documentation Types
- README files
- API documentation
- Code comments
- Guides and tutorials
- Architecture decision records

## Guidelines
1. Know your audience
2. Be concise but complete
3. Use code examples liberally
4. Keep documentation in sync with code
5. Prefer examples over explanations where possible

Write documentation that helps future developers understand and use the code.`,
    examples: [
      'Document this API',
      'Write a README for this project',
      'Add comments to this code',
    ],
  },

  'debugger': {
    name: 'Debugger',
    description: 'Helps diagnose and fix bugs',
    systemPrompt: `You are an expert debugger. Your job is to systematically find and fix bugs.

## Debugging Process
1. Reproduce the issue
2. Gather information (error messages, logs, code)
3. Form hypothesis about root cause
4. Test hypothesis
5. Implement fix
6. Verify fix works

## Techniques
- Binary search through code
- Add logging strategically
- Check for common issues:
  - Null/undefined values
  - Race conditions
  - Async timing issues
  - Type mismatches
- Use minimal reproductions

Be systematic. Don't guess — gather evidence.`,
    examples: [
      "There's a bug in this code",
      'This is throwing an error',
      'Something is broken',
    ],
  },

  'architect': {
    name: 'Software Architect',
    description: 'Designs system architecture and technical solutions',
    systemPrompt: `You are a software architect. Your job is to design scalable, maintainable systems.

## Architecture Focus
- System structure and components
- Data flow and API design
- Scalability considerations
- Trade-offs between options
- Technical debt assessment

## Process
1. Understand requirements
2. Identify key decisions
3. Propose structure
4. Consider alternatives
5. Document rationale

## Output
- Component diagram
- API specifications
- Data models
- Decision rationale

Think at the right level. Don't over-architect simple things or under-architect complex ones.`,
    examples: [
      'How should we structure this?',
      'Design a system for X',
      'What architecture would work best?',
    ],
  },

  'refactorer': {
    name: 'Refactorer',
    description: 'Improves code structure without changing behavior',
    systemPrompt: `You are an expert refactorer. Your job is to improve code structure while maintaining exact behavior.

## Refactoring Goals
- Improve readability
- Reduce complexity
- Eliminate duplication
- Improve maintainability
- Prepare for new features

## Process
1. Understand current code
2. Identify improvement opportunities
3. Make small, incremental changes
4. Run tests after each change
5. Verify behavior unchanged

## Principles
- Boy scout rule: leave code cleaner than found
- Don't change behavior — only structure
- Make the simplest change that works
- Prefer composition over inheritance

Be careful. Small mistakes can introduce bugs.`,
    examples: [
      'Refactor this module',
      'Clean up this code',
      'Improve the structure',
    ],
  },
};

// ============================================================================
// AGENT CREATION ENGINE
// ============================================================================

export class AgentCreator {
  /**
   * Create an agent specification from a user description
   */
  static createSpec(
    description: string,
    projectContext?: string
  ): AgentSpec {
    // Detect intent
    const lower = description.toLowerCase();

    // Match to template if applicable
    if (lower.includes('review') || lower.includes('check code')) {
      return this.createFromTemplate('code-reviewer', description, projectContext);
    }
    if (lower.includes('test') || lower.includes('spec')) {
      return this.createFromTemplate('test-writer', description, projectContext);
    }
    if (lower.includes('document') || lower.includes('readme')) {
      return this.createFromTemplate('documentation-writer', description, projectContext);
    }
    if (lower.includes('bug') || lower.includes('fix') || lower.includes('debug')) {
      return this.createFromTemplate('debugger', description, projectContext);
    }
    if (lower.includes('architect') || lower.includes('design') || lower.includes('structure')) {
      return this.createFromTemplate('architect', description, projectContext);
    }
    if (lower.includes('refactor') || lower.includes('clean')) {
      return this.createFromTemplate('refactorer', description, projectContext);
    }

    // Default: create custom spec
    return this.createCustomSpec(description, projectContext);
  }

  /**
   * Create agent from a template
   */
  static createFromTemplate(
    templateName: string,
    description: string,
    projectContext?: string
  ): AgentSpec {
    const template = AGENT_TEMPLATES[templateName];
    if (!template) {
      return this.createCustomSpec(description, projectContext);
    }

    const identifier = `${templateName}-${Date.now().toString(36)}`;

    return {
      identifier,
      whenToUse: `Use this agent when: ${description}`,
      systemPrompt: `${template.systemPrompt}

${projectContext ? `\n## Project Context\n${projectContext}\n` : ''}`,
      metadata: {
        tools: ['file_read', 'bash', 'grep'],
      },
    };
  }

  /**
   * Create a custom agent spec
   */
  static createCustomSpec(
    description: string,
    projectContext?: string
  ): AgentSpec {
    const identifier = `custom-agent-${Date.now().toString(36)}`;

    return {
      identifier,
      whenToUse: `Custom agent for: ${description}`,
      systemPrompt: `You are a specialized AI agent.

## Your Task
${description}

${projectContext ? `## Project Context\n${projectContext}\n` : ''}

## Guidelines
- Be thorough and accurate
- Ask clarifying questions if needed
- Report your findings clearly
- Stay focused on your assigned task`,
      metadata: {
        tools: ['file_read', 'bash'],
      },
    };
  }

  /**
   * List available templates
   */
  static listTemplates(): { name: string; description: string; examples: string[] }[] {
    return Object.entries(AGENT_TEMPLATES).map(([key, template]) => ({
      name: key,
      description: template.description,
      examples: template.examples,
    }));
  }
}

export default AgentCreator;
