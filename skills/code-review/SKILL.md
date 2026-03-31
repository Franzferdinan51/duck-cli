---
name: code-review
description: "Automated code review with multi-agent verification"
triggers:
  - "/review"
  - "code review"
  - "review code"
  - "check my code"
bins:
  - git
  - npm
  - eslint
  - ruff
---

# Code Review Skill

Automated code review using multi-agent verification.

## Based On

Claude Code's verification agent architecture:
- Spawns adversarial reviewer
- Tests independently
- Assigns PASS/FAIL verdict

## Features

- **Security Review**: Vulnerability detection
- **Style Check**: Lint rules, formatting
- **Best Practices**: Patterns, performance
- **Test Coverage**: Missing tests detection
- **Documentation**: Docstring completeness

## Usage

```bash
/review                  # Review staged changes
/review --full          # Review entire codebase
/review --security      # Security-focused review
/review --tests         # Check test coverage
```

## Review Agent Prompts

Based on Claude Code's verification agent:
- "Try to break this implementation"
- "Run tests with feature enabled"
- "Verify edge cases"
- "Check for security issues"
