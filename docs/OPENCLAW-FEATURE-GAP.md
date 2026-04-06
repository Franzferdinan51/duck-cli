# OpenClaw Feature Gap Analysis — duck-cli

**Date:** 2026-04-06  
**Purpose:** Identify high-value features from OpenClaw workspace that duck-cli could benefit from

---

## Executive Summary

duck-cli has a solid foundation (13 tools, 10 skills, AI Council, hybrid orchestrator, termux integration) but OpenClaw's workspace has many mature, production-ready skills that duck-cli could adopt. This analysis identifies **5 high-value additions** and notes **1 missing integration** (wecom).

---

## Current duck-cli Capabilities

### Tools (13 core)
- Shell/bash/powershell execution
- File read/write/edit
- Web search, fetch
- Vision analysis, image generation
- Text-to-speech
- Memory (remember/recall)
- Session search
- BrowserOS automation
- Task delegation
- Code diagnostics, REPL

### Skills (3 native + integration-ready)
- `termux` — Android phone control via Termux
- `moltbrain` — Long-term memory with SQLite + ChromaDB
- `android-agent` — XML-based Android UI automation

### Daemons
- `subconsciousd` — LLM-powered session analysis
- `mesh-server` — Agent mesh communication

---

## High-Value Additions from OpenClaw Workspace

### 1. **Security Audit Toolkit** (HIGH PRIORITY)

**Location:** `~/.openclaw/workspace/skills/security-audit-toolkit/`

**Why:** duck-cli executes shell commands and writes files — it's a security-critical tool. Having built-in security auditing would be a major differentiator.

**What it adds:**
- `npm audit` / `pip-audit` integration for dependency vulnerabilities
- Secret detection (hardcoded API keys, passwords)
- OWASP top 10 vulnerability scanning
- SSL/TLS verification
- File permission auditing

**Integration:** Create `duck security audit [path]` command that wraps the skill's scanning capabilities.

---

### 2. **Self-Improving Agent** (HIGH PRIORITY)

**Location:** `~/.openclaw/workspace/skills/self-improving-agent/`

**Why:** duck-cli would learn from its mistakes and improve over time — just like DuckBot.

**What it adds:**
- `.learnings/ERRORS.md` — Log failures
- `.learnings/LEARNINGS.md` — Log corrections and best practices
- `.learnings/FEATURE_REQUESTS.md` — Log missing capabilities
- Automatic pattern promotion to `SOUL.md` / `AGENTS.md`

**Integration:** Add post-execution hooks in the agent core to log failures and corrections. Creates persistent learning loop.

---

### 3. **GitHub CLI Skill** (MEDIUM PRIORITY)

**Location:** `~/.openclaw/workspace/skills/github-cli/`

**Why:** duck-cli is positioned as a coding agent — GitHub integration is essential for repo management, PRs, issues, releases.

**What it adds:**
- `gh` CLI wrapper for all GitHub operations
- Repo, issues, PRs, Actions, releases, gists
- Search, labels, secrets/variables
- GraphQL API access

**Integration:** Add `duck github <command>` command or integrate into existing git-workflow skill.

---

### 4. **Desktop Control (ClawdCursor/macOS)** (MEDIUM PRIORITY)

**Locations:**
- `~/.openclaw/workspace/skills/clawd-cursor/` — Windows/macOS desktop agent
- `~/.openclaw/workspace/skills/desktop-control/` — Linux PyAutoGUI-based
- `~/.openclaw/workspace/skills/mac-use/` — macOS Vision + click automation

**Why:** duck-cli already has browserOS, but desktop control extends it to native apps.

**What it adds:**
- Pixel-perfect mouse control, keyboard input
- Screen capture, window management
- Full desktop automation (not just browser)

**Integration:** Add as optional tool in `tools/desktop.ts` when platform supports it.

---

### 5. **Browser Automation (Stagehand)** (MEDIUM PRIORITY)

**Location:** `~/.openclaw/workspace/skills/browser-automation/`

**Why:** duck-cli's BrowserOS integration works but Stagehand offers natural language browser automation.

**What it adds:**
- `browser navigate <url>`
- `browser act "<action>"` — Natural language actions
- `browser extract "<instruction>"` — Data extraction
- `browser screenshot` / `browser close`

**Integration:** Add as alternative browser tool alongside BrowserOS. Offer both since they have different strengths.

---

## Missing Integration: WeChat Work (企业微信/wecom)

**Status:** NOT PRESENT in duck-cli

**Location in OpenClaw:** `~/.openclaw/extensions/wecom/skills/` (15 skills!)

**What OpenClaw has:**
- `wecom-msg` — Message history, send messages
- `wecom-contact-lookup` — Contact search
- `wecom-doc-manager` — Document management
- `wecom-edit-todo` / `wecom-get-todo-list` — Todo integration
- `wecom-meeting-*` — Meeting management
- `wecom-schedule` — Scheduling
- `wecom-smartsheet-*` — SmartSheet integration
- `wecom-preflight` — Preflight checks
- `wecom-send-media` / `wecom-send-template-card` — Rich messaging

**Should duck-cli add this?**
- **Only if** Duckets uses WeChat Work for business communication
- The MCP-based integration is complex (15 skills deep)
- **Recommendation:** Evaluate need first — this is a significant undertaking

---

## Skills duck-cli HAS that OpenClaw workspace could use

These are already in duck-cli and could be ported back to OpenClaw:

| Skill | Value |
|-------|-------|
| `duck-cli-agent` skill | Allows DuckBot to spawn duck-cli sessions |
| AI Council integration | Well-developed deliberation system |
| Hybrid orchestrator | Complexity-based task routing |
| Subconscious daemon | LLM-powered session analysis |

---

## Recommended Priority Order

| Priority | Feature | Effort | Value |
|----------|---------|--------|-------|
| 1 | Security Audit | Low | High |
| 2 | Self-Improving | Medium | High |
| 3 | GitHub CLI | Low | Medium |
| 4 | Desktop Control | Medium | Medium |
| 5 | Browser Automation | Medium | Medium |
| — | WeCom | High | ??? |

---

## Implementation Notes

### Security Audit (Easiest Win)
```bash
# duck-cli could add:
duck security audit              # Scan cwd
duck security audit /path/to/project  # Scan specific path
duck security secrets /path       # Scan for hardcoded secrets
```

### Self-Improving Agent
```bash
# Add hooks in agent core:
- Post-tool failure → Log to .learnings/ERRORS.md
- User correction → Log to .learnings/LEARNINGS.md
- Missing feature → Log to .learnings/FEATURE_REQUESTS.md
```

### GitHub CLI
```bash
# duck-cli could add:
duck github repo create "name"
duck github pr create --title "..." --body "..."
duck github issue list
```

---

## Files Examined

### OpenClaw Workspace
- `~/.openclaw/workspace/skills/` — 100+ skills available
- `~/.openclaw/workspace/tools/` — Various utility scripts
- `~/.openclaw/extensions/wecom/skills/` — WeChat Work integration
- `~/.openclaw/openclaw.json` — OpenClaw config

### duck-cli
- `~/.openclaw/workspace/duck-cli-src/src/tools/` — 13 core tools
- `~/.openclaw/workspace/duck-cli-src/src/skills/` — termux, moltbrain, android-agent
- `~/.openclaw/workspace/duck-cli-src/src/daemons/` — subconsciousd, mesh-server
- `~/.openclaw/workspace/duck-cli-src/docs/` — 20+ architecture docs

---

**Conclusion:** duck-cli has a strong foundation but could benefit most from **Security Audit** (quick win) and **Self-Improving Agent** (long-term value). Both are relatively low effort with high impact on agent quality.
