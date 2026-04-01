# Duck CLI - Kanban Board

**Last Updated:** 2026-04-01
**Repo:** https://github.com/Franzferdinan51/duck-cli

---

## ✅ DONE

| # | Card | Fix | Priority |
|---|------|-----|----------|
| 1 | Duplicate tools bug | Fixed: removed duplicate log in `ToolRegistry.register()`, duplicate check prevents double-registration | P0 |
| 2 | Go CLI `duck status` missing | Added `statusCmd()` to Go wrapper (`cmd/duck/main.go`) | P0 |
| 3 | Go CLI path wrong | Fixed Go wrapper to use `dist/cli/main.js` instead of `internal/agent/main.js` | P0 |
| 4 | Go return type bug | Fixed `return "--run", prompt` → `return "--run " + prompt` | P0 |
| 5 | TypeScript compiles clean | ✅ `npm run build` succeeds | P0 |
| 6 | CLI starts | ✅ `duck status` works | P0 |
| 7 | Skills load | ✅ 10 skills loaded correctly | P1 |
| 8 | Web server starts | ✅ Serves HTML on port 3000 | P1 |

---

## 📋 TODO

| # | Card | Priority |
|---|------|----------|
| 9 | Provider setup | P1 |
| 10 | CLI shell interactive mode | P2 |
| 11 | MCP server | P2 |
| 12 | AI Council integration | P2 |
| 13 | Desktop control tools | P2 |
| 14 | Security/DEFCON commands | P2 |
| 15 | Web UI test | P2 |
| 16 | README accuracy check | P2 |
| 17 | Test `duck run <task>` | P2 |
| 18 | Test `duck council <question>` | P2 |
| 19 | Test `duck skills list` | P2 |
| 20 | Verify all features from README | P1 |

---

## 🔴 IN PROGRESS

None currently.

---

## Notes

### Fixes Applied (2026-04-01)

1. **`src/tools/registry.ts`** — Removed duplicate `+ Tool:` log from `register()` method. `registerTool()` in `core.ts` already logs, so duplicate was causing double-display. Added defensive `if (this.tools.has(def.name)) return;` guard.

2. **`cmd/duck/main.go`** — Added `statusCmd()` subcommand: `duck status` now works via Go wrapper. Fixed Go path to `dist/cli/main.js`. Fixed return type bug.

### System Status (2026-04-01)

```
$ duck status
✅ Duck Agent ready!
   Providers: 0  ← Need API key setup
   Tools: 13   ← Fixed (was showing 13 twice)
   Skills: 10  ← All loaded
```

### Next Priority

1. Set up provider (MiniMax API key → `.env`)
2. Test real agent task execution: `duck run "hello world"`
3. Test AI Council: `duck council "is AI alignment important?"`
