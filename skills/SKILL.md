---
name: duck-skills
description: "Duck CLI skill system - extensible commands that enhance the AI agent"
metadata:
  {
    "version": "1.0.0",
    "format_version": "1"
  }
---

# 🦆 Duck CLI Skills System

Skills extend Duck CLI with specialized commands and integrations. Each skill is auto-discovered from the `skills/` directory and loaded at startup.

---

## ⚙️ Setup (For OpenClaw Agents)

**To use duck-cli skills, the duck-cli system must be installed first.**

### Quick Setup (5 min)

```bash
git clone https://github.com/Franzferdinan51/duck-cli.git
cd duck-cli
npm install
npm run build
go build -o duck ./cmd/duck/

# Configure API key (REQUIRED)
cp .env.example .env
# Edit .env → MINIMAX_API_KEY=your_key

# Verify
./duck status
```

### System-wide install

```bash
# Build once
go build -o duck ./cmd/duck/

# Install binary
cp duck ~/.local/bin/
mkdir -p ~/.duck-cli
cp .env ~/.duck-cli/env

# Verify from anywhere
duck status
```

### What you need

| Dependency | Install |
|------------|---------|
| Node.js 20+ | `nvm install 20` or nodejs.org |
| Go 1.21+ | `brew install go` or go.dev |
| Git | `brew install git` |
| MINIMAX_API_KEY | Get from MiniMax console |

---

## 📦 Available Skills

| Skill | Triggers | What it does | Dependencies |
|-------|----------|---------------|---------------|
| `code-review` | `/review`, "code review" | Multi-agent code verification | `git`, `npm` |
| `git-workflow` | `/git`, "git workflow" | Worktree isolation, smart commits | `git`, `gh` |
| `context-memory` | automatic | Persistent semantic memory | None |
| `mcp-manager` | `/mcp` | MCP server lifecycle | None |
| `security-audit` | `/audit` | Vulnerability scanning | `git`, `npm` |
| `desktop-control` | automatic | Desktop automation | None |
| `clawd-cursor` | automatic | Cursor-based GUI control | None |
| `claude-code-mastery` | automatic | Claude Code patterns | None |
| `computer-use` | automatic | Computer use protocols | None |
| `desktop-control-lobster` | automatic | Lobster-specific controls | None |

---

## Skill Format

Each skill is a directory:

```
skill-name/
├── SKILL.md        # This file
├── scripts/        # Executable scripts (optional)
│   ├── main.sh     # Main entry point
│   └── ...
└── references/     # Documentation, templates (optional)
```

## SKILL.md Structure

```yaml
---
name: skill-name
description: "What this skill does"
triggers:
  - "/skill-name"
  - "do the thing"
bins:           # Required system binaries
  - git
  - gh
env:            # Required environment variables
  REQUIRED_VAR: "description"
---

# Detailed documentation

## Usage

`/skill-name <args>`

## Setup

Any additional setup steps beyond the base duck-cli install.
```

## Trigger Patterns

Skills are invoked when:
1. User types `/skill-name`
2. User message matches a trigger phrase
3. Tool use matches `USE_SKILL` directive

---

## 📁 Tool Registrations

The 13 core tools are registered in `src/tools/registry.ts`. Skills that provide tools must register them here to be available to the agent.

---

## 📚 Full Documentation

- **[INSTALL.md](../INSTALL.md)** — Complete installation guide
- **[README.md](../README.md)** — Full system overview
- **[src/tools/registry.ts](../src/tools/registry.ts)** — Tool definitions
