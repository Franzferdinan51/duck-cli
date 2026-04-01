# Duck CLI - Kanban Board

**Last Updated:** 2026-04-01
**Repo:** https://github.com/Franzferdinan51/duck-cli

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

---

## 📋 TODO

### P0 — Critical (needs API key rotated)

| # | Card | Priority |
|---|------|----------|
| 15 | **Rotate MiniMax API key** | P0 |
| 16 | Verify all commands work with new key | P0 |

### P1 — Core Integration

| # | Card | Priority |
|---|------|----------|
| 17 | Test MCP server end-to-end | P1 |
| 18 | Test AI Council deliberation | P1 |
| 19 | Test web UI chat with real provider | P1 |
| 20 | Test interactive shell (TTY) | P1 |

### P2 — Feature Completion

| # | Card | Priority |
|---|------|----------|
| 21 | Verify `duck agent spawn` works | P2 |
| 22 | Verify `duck mcp add/list` | P2 |
| 23 | Verify `duck council` with real council engine | P2 |
| 24 | Test `duck skills search` | P2 |
| 25 | Verify desktop-control tools work | P2 |

### P3 — Enhancement

| # | Card | Priority |
|---|------|----------|
| 26 | Add `./duck run` flags (--model, --provider) | P3 |
| 27 | Add `./duck shell` tab-completion | P3 |
| 28 | Verify web UI serves on port 0 (random) | P3 |
| 29 | Add health check script for CI | P3 |

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
✅ Tools: 13       ← All tools load once (no duplicates)
✅ Skills: 10      ← All skills loaded correctly
✅ Web UI: works  ← /v1/ routes aliased
✅ Go wrapper: works  ← -- prefix removed, path resolved
```

### API Key Note

⚠️ The `.env` with actual MiniMax API key was committed to GitHub in commits `3d54899` and `65c4a5e`. **Rotate the key at platform.minimax.io.** The `.env` has been removed from git history.

### Files Added for Agent Clarity

| File | Purpose |
|------|---------|
| `AGENTS.md` | Agent guide: setup, build, extend, test |
| `TOOLS.md` | Tool reference: all 13 tools with schemas |
| `INSTALL.md` | Installation guide: 5-min quick start |
| `skills/SKILL.md` | Updated with setup + "Using from OpenClaw" |

### Key Paths

```
src/cli/main.ts        ← CLI router (add commands here)
src/agent/core.ts      ← Agent engine (initialize, think, chat)
src/tools/registry.ts  ← Tool registration
src/providers/manager.ts ← Provider loading
src/web-server.ts      ← Web UI server
cmd/duck/main.go       ← Go wrapper (cobra commands)
skills/                ← Skill directories (auto-loaded)
```

### Common Commands

```bash
# Rebuild everything
npm run build && go build -o duck ./cmd/duck/

# Quick test
./duck status

# Test with AI
./duck run "What is 2+2?"

# Web UI
./duck web 3001
```
