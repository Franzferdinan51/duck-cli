# 🦆 Duck Agent Update Strategy

> **v0.3.1** — OpenClaw Compatibility + Enhanced Auto-Heal

---

## Update Philosophy

Duck Agent pulls features from multiple upstream sources while maintaining its unique identity:

### Upstream Sources

| Source | What We Pull | Update Frequency |
|--------|--------------|------------------|
| **OpenClaw** | Gateway protocol, channels, skills, tools | Weekly |
| **Claude Code** | KAIROS, buddy, multi-agent patterns | As needed |
| **Hermes-Agent** | Gateway patterns, search | Monthly |
| **NemoClaw** | Security (SSRF, credentials) | Security patches |
| **Codex CLI** | MCP server, exec mode | Updates |
| **DroidClaw** | Phone control, workflow | As needed |

---

## Update Commands

```bash
# Check for updates from all sources
duck update check

# Install latest from upstream
duck update install

# Create backup before updating
duck update backup

# Restore from backup if update breaks
duck update restore

# Show git status
duck update status
```

---

## OpenClaw Compatibility

Duck Agent is designed to be **compatible but not dependent** on OpenClaw.

### Safe to Pull

- Bug fixes
- New tool types (additive)
- Performance improvements
- Security patches
- New skill templates

### Requires Shim Layer

- Changed tool argument schemas
- Modified agent lifecycle
- WebSocket format changes
- New required config fields

### Never Pull

- Core identity changes
- Multi-agent coordination protocol changes
- System prompt injection points

---

## Version Strategy

Duck Agent uses a hybrid versioning approach:

```
DUCK_MAJOR.OPENCLAW_COMPAT.DATE
     │           │           │
     │           │           └── Last OpenClaw sync date
     │           └── OpenClaw compatibility level
     └── Duck Agent major version
```

**Rules:**
- New Duck features → increment major
- OpenClaw change with shim fix → increment compat
- OpenClaw patch (no shim needed) → update date only

---

## Testing After Update

Always run after updating:

```bash
# 1. Build
npm run build

# 2. Test protocols
duck unified &            # Start all servers
sleep 3
curl http://localhost:3850/health   # MCP
curl http://localhost:18792/health  # Gateway
kill %1

# 3. Test standalone
duck shell "test"        # Quick TTY test
duck web                 # Web UI test
```

---

## Rollback Procedure

If update breaks something:

```bash
# 1. Check backup
ls -la ~/.duck-agent/backups/

# 2. Restore
duck update restore

# 3. If that fails, manual restore:
cd ~/.duck-agent
git checkout HEAD~1
npm run build
```

---

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for full version history.
