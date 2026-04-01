# AGENTS.md — Duck Agent

**For AI agents working with or extending duck-cli.**

---

## What Is This

Duck Agent (duck-cli) is a TypeScript/Go CLI agent system with:
- **13 core tools** (shell, file I/O, desktop control, memory, web search)
- **10 skills** (code review, git workflow, MCP management, security audit, etc.)
- **Multi-provider AI** (MiniMax, OpenAI, Anthropic, LM Studio)
- **Web UI** and **MCP server** modes
- **Go CLI wrapper** for ergonomic command-line interface

**Repo:** https://github.com/Franzferdinan51/duck-cli
**Main language:** TypeScript (Node.js) + Go wrapper
**Node version:** 20+
**Go version:** 1.21+

---

## Quick Setup (5 minutes)

```bash
git clone https://github.com/Franzferdinan51/duck-cli.git
cd duck-cli
npm install
npm run build
go build -o duck ./cmd/duck/

# Configure (copy .env.example → .env and add your keys)
cp .env.example .env
# Edit .env → MINIMAX_API_KEY=your_key

# Verify
./duck status
```

---

## Key Files

| File | Purpose |
|------|---------|
| `cmd/duck/main.go` | Go CLI wrapper (entry point, cobra commands) |
| `src/cli/main.ts` | TypeScript CLI router (command switch) |
| `src/agent/core.ts` | Core agent (initialize, think, chat, tools) |
| `src/providers/manager.ts` | Multi-provider AI (loads MINIMAX_API_KEY etc.) |
| `src/tools/registry.ts` | Tool registration and execution |
| `src/skills/runner.ts` | Skill discovery and loading |
| `src/web-server.ts` | Web UI HTTP server |
| `dist/` | Compiled JS output (don't edit, auto-generated) |
| `skills/` | Individual skill directories (auto-loaded) |
| `SKILL.md` | This repo's skill system |
| `INSTALL.md` | Human-facing installation guide |
| `KANBAN.md` | Current work tracking |

---

## Architecture

```
duck (Go binary)
└── dist/cli/main.js
    ├── dist/agent/core.js         ← Agent engine
    │   ├── providers/manager.js   ← AI provider routing
    │   ├── tools/registry.js     ← Tool registration
    │   └── skills/runner.js      ← Skill loading
    ├── dist/web-server.js        ← Web UI server
    └── dist/cli/mesh-cmd.js     ← Agent mesh commands
```

---

## Build & Test

```bash
# Build TypeScript → JavaScript
npm run build

# Build Go wrapper
go build -o duck ./cmd/duck/

# Full rebuild (TS + Go)
npm run build && go build -o duck ./cmd/duck/

# Run CLI
./duck status
./duck run "hello world"
./duck web 3001

# Watch mode (auto-rebuild on changes)
npm run watch
```

**After ANY change to `.ts` files:** run `npm run build` to regenerate `dist/`.

---

## Adding a New Tool

1. Define the tool in `src/tools/registry.ts` → `registerTools()`:

```typescript
private registerTools() {
  // ... existing tools ...
  this.registerTool({
    name: 'my_tool',
    description: 'What it does',
    schema: { /* JSON Schema */ },
    dangerous: false,
    handler: async (args) => {
      // your implementation
      return { success: true, result };
    }
  });
}
```

2. Rebuild: `npm run build`
3. Test: `./duck status` → should show `Tools: 14`

---

## Adding a New Skill

1. Create `skills/my-skill/SKILL.md`:

```yaml
---
name: my-skill
description: "What this skill does"
triggers:
  - "/my-skill"
  - "do the thing"
bins:
  - curl
env:
  API_KEY: "Required API key"
---

# My Skill

## What it does

Description here.
```

2. Add scripts/references if needed
3. Rebuild: `npm run build`
4. Test: `./duck skills list` → should show new skill

---

## Tool System

Tools are registered in `src/tools/registry.ts` via `registerTools()` in `src/agent/core.ts`.

**Current 13 tools:**
- `shell` — Execute shell commands ⚠️ (dangerous)
- `file_read` — Read files
- `file_write` — Write files ⚠️ (dangerous)
- `desktop_open` — Open applications
- `desktop_click` — Click at coordinates
- `desktop_type` — Type text
- `desktop_screenshot` — Capture screenshots
- `memory_remember` — Store information
- `memory_recall` — Search memories
- `web_search` — Web search
- `learn_from_feedback` — Learning from feedback
- `get_metrics` — Performance stats
- `get_cost` — Cost tracking

---

## Provider System

Providers are configured via environment variables:

```bash
MINIMAX_API_KEY=...      # Primary (recommended)
OPENAI_API_KEY=...      # Optional
ANTHROPIC_API_KEY=...    # Optional
LMSTUDIO_URL=...         # Optional (local models)
```

The provider manager (`src/providers/manager.ts`) loads all available providers and uses the first one that responds.

---

## Web Server

```bash
./duck web              # Starts on port 3000
./duck web 8080        # Custom port
```

Routes:
- `GET /` → `web-ui/index.html`
- `GET /v1/status` → Agent status JSON
- `GET /v1/tools` → Tool list
- `POST /v1/chat` → Chat with agent
- `POST /v1/think` → Single think request

---

## MCP Server

```bash
./duck mcp              # Starts on port 3850
./duck mcp 4000         # Custom port
```

Exposes tools via the Model Context Protocol.

---

## CLI Commands Reference

```bash
./duck status                      # Show agent status
./duck run "task"                 # Run a task
./duck shell                      # Interactive TTY shell
./duck council "question"         # AI Council deliberation
./duck skills list                # List all skills
./duck skills search <query>      # Search skills
./duck agent list                 # List agents
./duck agent spawn <name> <type>  # Spawn an agent
./duck mcp [port]                # Start MCP server
./duck web [port]                # Start web UI
./duck security defcon            # Show DEFCON level
./duck security audit            # Run security audit
./duck --help                     # Full help
```

---

## Git Workflow

```bash
# Make changes to TypeScript files
# ...

# Rebuild
npm run build
go build -o duck ./cmd/duck/

# Test
./duck status
./duck run "test"

# Commit (keep it descriptive)
git add <changed files>
git commit -m "fix: describe what you fixed"
git push origin main
```

---

## Testing Changes

```bash
# 1. Build
npm run build && go build -o duck ./cmd/duck/

# 2. Quick status check
./duck status
# Should show: Providers: 1, Tools: 13, Skills: 10

# 3. Run a task
./duck run "What is 2+2?"

# 4. Check web UI
./duck web 3001 &
# curl http://localhost:3001/v1/status

# 5. Kill background processes
pkill -f "dist/web-server.js"
```

---

## Common Errors

| Error | Fix |
|-------|-----|
| `Providers: 0` | Add `MINIMAX_API_KEY` to `.env` |
| `Tools: 0` | Run `npm run build` first |
| `Node.js not found` | Install Node.js 20+ |
| Web UI 404 | Run `npm run build`, then `./duck web` |
| Skills missing | Check `skills/` directory exists, run `npm run build` |

---

## Provider-Specific Notes

- **MiniMax** — Primary provider. Get key at platform.minimax.io. Handles most tasks well.
- **OpenAI** — Set `OPENAI_API_KEY`. Good for code tasks.
- **Anthropic** — Set `ANTHROPIC_API_KEY`. Best for complex reasoning.
- **LM Studio** — Set `LMSTUDIO_URL`. Local free inference, slower but no API cost.

---

## Extending

**Priority order for adding capabilities:**
1. New tool → edit `src/tools/registry.ts` → rebuild
2. New skill → create `skills/my-skill/SKILL.md` → rebuild
3. New CLI command → edit `src/cli/main.ts` + `cmd/duck/main.go` → rebuild both
4. New provider → edit `src/providers/manager.ts` → rebuild

---

## Metadata

- **Version:** 0.4.0
- **License:** MIT
- **Status:** Active development
- **Last updated:** 2026-04-01
