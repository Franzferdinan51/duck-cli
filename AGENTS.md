# AGENTS.md - Duck CLI Internal Agent Guide

## Overview

Duck CLI is a standalone AI agent system with multi-provider routing, orchestration, and extensive tooling. This guide helps internal agents understand the system architecture and their role within it.

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Duck CLI v0.8.0                       │
├─────────────────────────────────────────────────────────────┤
│  Access Layer (CLI / Telegram / Web UI / Discord)           │
├─────────────────────────────────────────────────────────────┤
│  Chat Agent (Port 18797) - Conversational interface         │
│  ├─ Session Management (in-memory + subconscious)          │
│  ├─ Complexity Scoring (Hybrid Orchestrator)               │
│  ├─ AI Council Deliberation (for complex tasks)            │
│  └─ Meta-Agent Routing (score >= 5)                        │
├─────────────────────────────────────────────────────────────┤
│  Hybrid Orchestrator (v4)                                   │
│  ├─ Task Complexity Classifier (1-10 scoring)              │
│  ├─ Model Router (MiniMax/Kimi/LM Studio/OpenRouter)       │
│  ├─ Council Bridge (deliberation before execution)         │
│  └─ Fallback Manager (auto-retry with fallbacks)           │
├─────────────────────────────────────────────────────────────┤
│  Meta-Agent (Plan → Execute → Critic → Heal → Learn)       │
│  ├─ MetaPlanner: Creates execution plans                   │
│  ├─ MetaCritic: Evaluates step results                     │
│  ├─ MetaHealer: Diagnoses and recovers from failures       │
│  └─ MetaLearner: Logs experiences for improvement          │
├─────────────────────────────────────────────────────────────┤
│  Tool Registry (40+ tools)                                  │
│  ├─ Shell Execution (dangerous, guarded)                   │
│  ├─ File I/O (read/write with guards)                      │
│  ├─ Web Search (DuckDuckGo)                                │
│  ├─ Memory System (SQLite-backed)                          │
│  ├─ Android Tools (ADB integration)                        │
│  ├─ Desktop Control (macOS/Windows/Linux)                  │
│  └─ Sub-Agent Management (parallel agents)                 │
├─────────────────────────────────────────────────────────────┤
│  Bridge Layer                                               │
│  ├─ MCP Server (Port 3850) - Tool protocol                 │
│  ├─ ACP Server (Port 18794) - Agent protocol               │
│  ├─ WebSocket (Port 18796) - Real-time comms               │
│  └─ Meta-Agent Bridge - Cross-agent coordination           │
├─────────────────────────────────────────────────────────────┤
│  Mesh Layer (Agent Mesh Networking)                         │
│  ├─ Peer Discovery (port 4000)                             │
│  ├─ Broadcast Messaging                                    │
│  ├─ Whisper Routing (subconscious alerts)                  │
│  └─ meshd Daemon                                           │
├─────────────────────────────────────────────────────────────┤
│  Sub-Conscious (Port 4001) - LLM-powered memory            │
│  ├─ Session Analysis (async LLM processing)                │
│  ├─ Whisper Generation (contextual hints)                  │
│  ├─ FTS Search (TF-IDF across memories)                    │
│  └─ Council Memory (deliberation storage)                  │
├─────────────────────────────────────────────────────────────┤
│  KAIROS - Proactive AI Heartbeat                            │
│  ├─ Dream Consolidation (pattern recognition)              │
│  ├─ Proactive Suggestions (idle-time processing)           │
│  └─ Self-Improvement (continuous learning)                 │
└─────────────────────────────────────────────────────────────┘
```

## Agent Responsibilities

### 1. Chat Agent
- **Role**: Primary user interface
- **Port**: 18797
- **Key Functions**:
  - Session management (in-memory with subconscious persistence)
  - Complexity scoring using Hybrid Orchestrator
  - Route tasks to Meta-Agent when score >= 5
  - AI Council deliberation for complex/ethical tasks
  - Real-time streaming responses

### 2. Meta-Agent
- **Role**: Complex task orchestration
- **Lifecycle**: Plan → Execute → Critic → Heal → Learn
- **Key Functions**:
  - Create execution plans from natural language
  - Execute tools with retry and fallback
  - Self-critique and auto-heal from failures
  - Learn from experiences

### 3. Sub-Conscious Daemon
- **Role**: Long-term memory and pattern recognition
- **Port**: 4001
- **Key Functions**:
  - Analyze session transcripts (async)
  - Generate contextual whispers
  - Full-text search across all memories
  - Store council deliberations

### 4. Mesh Agent
- **Role**: Inter-agent communication
- **Port**: 4000
- **Key Functions**:
  - Peer discovery and registration
  - Broadcast messages to all agents
  - Route whispers to appropriate agents
  - Coordinate multi-agent tasks

## Tool Categories

### Dangerous Tools (Require Approval)
- `shell` - Execute shell commands
- `file_write` - Write to files

### Safe Tools
- `file_read` - Read files
- `web_search` - Search the web
- `memory_remember` - Store memories
- `memory_recall` - Search memories
- `desktop_*` - Desktop control
- `android_*` - Android device control

### Meta Tools
- `agent_spawn` - Spawn sub-agents
- `agent_list` - List active agents
- `plan_create` - Create execution plans
- `skill_create` - Auto-create skills

## Provider Chain

1. **MiniMax** (Primary) - MiniMax-M2.7, glm-5
2. **Kimi** (Vision) - kimi-k2.5
3. **LM Studio** (Local) - qwen3.5-9b, gemma-4
4. **OpenRouter** (Fallback) - Free tier models

## Environment Variables

```bash
# Required
MINIMAX_API_KEY=sk-...

# Optional
KIMI_API_KEY=sk-kimi-...
OPENAI_API_KEY=sk-...
OPENROUTER_API_KEY=sk-or-...
LMSTUDIO_URL=http://localhost:1234
LMSTUDIO_KEY=sk-lm-...

# Feature Flags
MESH_ENABLED=true
SUBCONSCIOUS_ENABLED=true
DUCK_CHAT_PROVIDER=minimax
DUCK_CHAT_MODEL=MiniMax-M2.7
```

## Key Files

| File | Purpose |
|------|---------|
| `src/agent/core.ts` | Main Agent class with tool registry |
| `src/agent/chat-agent.ts` | Chat interface and routing |
| `src/orchestrator/` | Hybrid Orchestrator v4 |
| `src/orchestrator/meta-agent.ts` | Meta-Agent implementation |
| `src/daemons/subconsciousd.ts` | Sub-Conscious daemon |
| `src/mesh/` | Agent mesh networking |
| `src/tools/registry.ts` | Tool registry |
| `src/providers/manager.ts` | Multi-provider routing |

## Communication Protocols

### MCP (Model Context Protocol)
- Port: 3850
- Purpose: Tool exposure to external systems

### ACP (Agent Communication Protocol)
- Port: 18794
- Purpose: Inter-agent communication
- Features: Sub-agent spawning, parallel execution

### WebSocket
- Port: 18796
- Purpose: Real-time streaming

## Debugging

```bash
# Check all services
./duck health

# View logs
./duck logger logs --limit 50

# Check agent status
./duck agent list

# Test provider
./duck run "test" --provider minimax

# Trace execution
DUCK_TRACE=1 ./duck run "complex task"
```

## Common Issues

1. **Path Resolution**: Ensure `DUCK_SOURCE_DIR` is set correctly
2. **Provider Timeouts**: Check API keys and network connectivity
3. **Memory Limits**: SQLite WAL mode can grow large
4. **Port Conflicts**: Check if ports 3850, 18794, 18797 are free

## Best Practices

1. Always use the Hybrid Orchestrator for task routing
2. Persist important sessions to Sub-Conscious
3. Use council deliberation for ethical/complex decisions
4. Spawn parallel agents for independent subtasks
5. Check tool registry before implementing new tools

## Resources

<<<<<<< Updated upstream
- GitHub: https://github.com/Franzferdinan51/duck-cli
- OpenClaw: https://github.com/openclaw/openclaw
- Hermes: https://github.com/NousResearch/hermes-agent
=======
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

## Super Agent Features

### 1. SQLite Memory (Priority #1)
Persistent, searchable memory across sessions.

```bash
./duck run "Remember that user prefers dark mode"  # memory_remember
./duck run "What do I know about user preferences?" # memory_recall
```

New tools: `memory_list`, `memory_stats`

### 2. Autonomous Planning (Priority #2)
Goal decomposition + progress tracking.

```bash
./duck run "Create a plan to build a REST API with authentication"
# Decomposes into steps: understand → design → implement → test
```

New tools: `plan_create`, `plan_status`, `plan_list`, `plan_abort`

### 3. Dangerous Tool Guardrails (Priority #3)
Risk-evaluated shell and file writes.

```bash
./duck run "Check risk of: rm -rf /"
# 🔴 CRITICAL: Recursive force delete of root or all files — BLOCKED
```

New tools: `guard_check`, `guard_log`, `guard_stats`

**Risk levels:** 🟢 LOW → 🟡 MEDIUM → 🟠 HIGH → 🔴 CRITICAL

**35+ dangerous patterns detected:** rm -rf /, fork bombs, dd, mkfs, chmod 777, etc.

### Tool Telemetry
Every tool execution is logged. Track success rates:

```bash
./duck run "Show me tool stats"
# shell: 42 calls, 95% success, avg 230ms
# file_write: 12 calls, 100% success
```

## Common Errors

| Error | Fix |
|-------|-----|
| `Providers: 0` | Add `MINIMAX_API_KEY` to `.env` |
| `Tools: 0` | Run `npm run build` first |
| `Node.js not found` | Install Node.js 20+ |
| Web UI 404 | Run `npm run build`, then `./duck web` |
| Skills missing | Check `skills/` directory exists, run `npm run build` |
| `Providers: 0` | Add `MINIMAX_API_KEY` to `.env` |

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

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **duck-cli** (6648 symbols, 18311 relationships, 300 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## When Debugging

1. `gitnexus_query({query: "<error or symptom>"})` — find execution flows related to the issue
2. `gitnexus_context({name: "<suspect function>"})` — see all callers, callees, and process participation
3. `READ gitnexus://repo/duck-cli/process/{processName}` — trace the full execution flow step by step
4. For regressions: `gitnexus_detect_changes({scope: "compare", base_ref: "main"})` — see what your branch changed

## When Refactoring

- **Renaming**: MUST use `gitnexus_rename({symbol_name: "old", new_name: "new", dry_run: true})` first. Review the preview — graph edits are safe, text_search edits need manual review. Then run with `dry_run: false`.
- **Extracting/Splitting**: MUST run `gitnexus_context({name: "target"})` to see all incoming/outgoing refs, then `gitnexus_impact({target: "target", direction: "upstream"})` to find all external callers before moving code.
- After any refactor: run `gitnexus_detect_changes({scope: "all"})` to verify only expected files changed.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Tools Quick Reference

| Tool | When to use | Command |
|------|-------------|---------|
| `query` | Find code by concept | `gitnexus_query({query: "auth validation"})` |
| `context` | 360-degree view of one symbol | `gitnexus_context({name: "validateUser"})` |
| `impact` | Blast radius before editing | `gitnexus_impact({target: "X", direction: "upstream"})` |
| `detect_changes` | Pre-commit scope check | `gitnexus_detect_changes({scope: "staged"})` |
| `rename` | Safe multi-file rename | `gitnexus_rename({symbol_name: "old", new_name: "new", dry_run: true})` |
| `cypher` | Custom graph queries | `gitnexus_cypher({query: "MATCH ..."})` |

## Impact Risk Levels

| Depth | Meaning | Action |
|-------|---------|--------|
| d=1 | WILL BREAK — direct callers/importers | MUST update these |
| d=2 | LIKELY AFFECTED — indirect deps | Should test |
| d=3 | MAY NEED TESTING — transitive | Test if critical path |

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/duck-cli/context` | Codebase overview, check index freshness |
| `gitnexus://repo/duck-cli/clusters` | All functional areas |
| `gitnexus://repo/duck-cli/processes` | All execution flows |
| `gitnexus://repo/duck-cli/process/{name}` | Step-by-step execution trace |

## Self-Check Before Finishing

Before completing any code modification task, verify:
1. `gitnexus_impact` was run for all modified symbols
2. No HIGH/CRITICAL risk warnings were ignored
3. `gitnexus_detect_changes()` confirms changes match expected scope
4. All d=1 (WILL BREAK) dependents were updated

## Keeping the Index Fresh

After committing code changes, the GitNexus index becomes stale. Re-run analyze to update it:

```bash
npx gitnexus analyze
```

If the index previously included embeddings, preserve them by adding `--embeddings`:

```bash
npx gitnexus analyze --embeddings
```

To check whether embeddings exist, inspect `.gitnexus/meta.json` — the `stats.embeddings` field shows the count (0 means no embeddings). **Running analyze without `--embeddings` will delete any previously generated embeddings.**

> Claude Code users: A PostToolUse hook handles this automatically after `git commit` and `git merge`.

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
>>>>>>> Stashed changes
