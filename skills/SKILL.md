---
name: duck-skills
description: "Duck CLI skill system - extensible commands that enhance the AI agent"
metadata:
  {
    "version": "1.0.0",
    "format_version": "1"
  }
---

# Duck CLI Skills System

Skills extend Duck CLI with specialized commands and integrations.

## Skill Format

Each skill is a directory with:

```
skill-name/
├── SKILL.md        # Skill definition & trigger
├── scripts/        # Executable scripts
│   ├── main.sh     # Main entry point
│   └── ...
└── references/     # Documentation, templates
```

## SKILL.md Structure

```yaml
---
name: skill-name
description: "What this skill does"
triggers:
  - "/skill-name"
  - "do the thing"
env:
  REQUIRED_VAR: "description"
bins:
  - gh
  - jq
---

# Detailed documentation
```

## Trigger Patterns

Skills are invoked when:
1. User types `/skill-name`
2. User message matches a trigger phrase
3. Tool use matches `USE_SKILL` directive

## Examples

See `../sources/openclaw/skills/` for 53 reference implementations.
```

---

# Skill Template

Use this template to create new skills:

```markdown
---
name: my-skill
description: "What my skill does"
triggers:
  - "/my-skill"
  - "run my skill"
bins:
  - curl
env:
  API_KEY: "Required API key"
---

# My Skill

## Usage

`/my-skill <arg>`

## What it does

Description here.
```
