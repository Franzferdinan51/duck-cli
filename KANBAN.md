# Duck CLI - Kanban Board

**Last Updated:** 2026-04-01
**Repo:** https://github.com/Franzferdinan51/duck-cli
**Status:** SUPER AGENT UPGRADES COMPLETE ✅

---

## ✅ DONE

| # | Card | Fix | Priority |
|---|------|-----|----------|
| 1 | Duplicate tools bug | Fixed: removed duplicate log in `ToolRegistry.register()` | P0 |
| 2 | `duck status` missing | Added `statusCmd()` to Go wrapper | P0 |
| 3 | Go path wrong | Fixed Go wrapper to use `dist/cli/main.js` | P0 |
| 4 | Go return type bug | Fixed `return "--run " + prompt` | P0 |
| 5 | Web UI `/v1/*` routes missing | Added `/v1/` aliases for all `/api/` routes | P0 |
| 6 | Chat timeout hanging | Added 30s timeout to `/v1/chat` | P0 |
| 7 | Go `--` prefix broke commands | Removed `--` from all `runNode()` calls | P0 |
| 8 | Security commands fell through | Added `security-defcon/audit` cases to CLI switch | P0 |
| 9 | No persistent config | Added godotenv auto-load from `.env` | P1 |
| 10 | Go binary path broken | Fixed `os.Args[0]`-relative path resolution | P1 |
| 11 | API key exposed in git | Removed `.env` from git history, added to .gitignore | P0 |
| 12 | Docs for agents missing | Added `AGENTS.md`, `TOOLS.md`, `INSTALL.md` | P1 |
| 13 | Skills lacked setup instructions | Updated `skills/SKILL.md` with setup + usage | P1 |
| 14 | README missing agent docs | Added "For OpenClaw Agents" section | P1 |
| 15 | **Memory was JSON-only** | Upgraded to SQLite-backed (better-sqlite3) | P0 |
| 16 | **No planning system** | Built autonomous planner with goal decomposition | P0 |
| 17 | **Shell was unguarded** | Built dangerous tool guard (35+ patterns) | P0 |
| 18 | Tool telemetry missing | Tool usage logged to SQLite (success, duration, errors) | P1 |
| 19 | No self-correction | Planner auto-retries/skips failed steps | P1 |

---

## 📋 TODO

### P1 — Core Integration

| # | Card | Priority |
|---|------|----------|
| 20 | Test AI Council deliberation end-to-end | P1 |
| 21 | Test web UI chat with real provider | P1 |
| 22 | Test interactive shell (TTY) | P1 |
| 23 | Test MCP server end-to-end | P1 |

### P2 — Feature Completion

| # | Card | Priority |
|---|------|----------|
| 24 | Verify `duck agent spawn` works | P2 |
| 25 | Verify `duck mcp add/list` | P2 |
| 26 | Test `plan_create` with real AI decomposition | P2 |
| 27 | Test `guard_check` interactive confirmation | P2 |
| 28 | Verify desktop-control tools work | P2 |
| 29 | Add vector embeddings for semantic memory search | P2 |
| 30 | Add session resume from plan history | P2 |

### P3 — Enhancement

| # | Card | Priority |
|---|------|----------|
| 31 | Add `./duck run` flags (--model, --provider) | P3 |
| 32 | Add `./duck shell` tab-completion | P3 |
| 33 | Verify web UI serves on port 0 (random) | P3 |
| 34 | Add health check script for CI | P3 |
| 35 | Streaming SSE for web UI chat | P3 |

---

## 🔴 IN PROGRESS

| Card | Notes |
|------|-------|
| (none) | |

---

## Notes

### System Status (2026-04-01)

```
$ ./duck status
✅ Providers: 1   ← MiniMax API key loaded from .env
✅ Tools: 22      ← 9 new super agent tools added
✅ Skills: 10     ← All skills loaded correctly
✅ Memory: SQLite  ← better-sqlite3, FTS5 search
✅ Planning: Active ← Goal decomposition + progress
✅ Guard: Quiet     ← Auto-approve low risk
```

### Files Added for Super Agent

| File | Lines | Purpose |
|------|-------|---------|
| `src/agent/planner.ts` | 354 | Autonomous planning state machine |
| `src/memory/sqlite-store.ts` | 476 | SQLite memory engine |
| `src/tools/approval.ts` | 351 | Dangerous tool guard |
| `src/agent/core.ts` | +360 | Wired in all 3 systems |

### Key Paths

```
src/agent/core.ts        ← Agent engine (initialize, think, chat, tools)
src/agent/planner.ts    ← Planning state machine
src/memory/sqlite-store.ts ← SQLite memory engine
src/memory/system.ts     ← Memory system (SQLite-backed)
src/tools/approval.ts   ← Dangerous tool guard
src/tools/registry.ts   ← Tool registration
cmd/duck/main.go        ← Go wrapper (cobra commands)
```

### Common Commands

```bash
# Rebuild everything
npm run build && go build -o duck ./cmd/duck/

# Quick test
./duck status

# Test planning
./duck run "Create a plan to build a REST API"

# Test guard
./duck run "Check risk of: rm -rf /"

# Test memory
./duck run "Remember: user prefers TypeScript"

# Web UI
./duck web 3001
```

### API Key Note

⚠️ The `.env` with actual MiniMax API key was committed to GitHub. **Rotate the key at platform.minimax.io.**
