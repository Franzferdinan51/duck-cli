# MoltBrain Skill — duck-cli Long-Term Memory Integration

**Purpose:** Persistent memory layer for duck-cli that learns and recalls context automatically
**Install:** `/plugin marketplace add nhevers/moltbrain` (OpenClaw)
**Alternative:** `npm install @moltbrain/game-plugin` (for Virtuals agents)
**Worker:** `http://localhost:37777`

## Quick Start

```bash
# After installation, MoltBrain works automatically
# It captures observations and injects relevant context

# Search memory
duck moltbrain search "authentication setup"

# Show stats
duck moltbrain stats

# Export memory
duck moltbrain export

# Tag observation
duck moltbrain tag <id> <tag>
```

## How It Works

```
duck-cli Session
    ↓ PostToolUse
MoltBrain Worker (localhost:37777)
    ↓
SQLite (observations, summaries)
ChromaDB (semantic search)
    ↓ SessionStart
duck-cli Next Session (context injected)
```

## Features

| Feature | Description |
|---------|-------------|
| **Auto-Capture** | Observes tool calls, extracts facts |
| **Semantic Search** | Natural language memory search |
| **Timeline** | View memory by project/time |
| **Analytics** | Track tokens, sessions, concepts |
| **Tags & Filters** | Organize observations |
| **Export** | JSON, CSV, Markdown |
| **Web Viewer** | UI at localhost:37777 |

## API Endpoints

```bash
# Health check
curl http://localhost:37777/health

# Search
curl "http://localhost:37777/api/search?q=authentication"

# Timeline
curl "http://localhost:37777/api/timeline?project=my-app&days=7"

# Stats
curl http://localhost:37777/api/stats

# Export
curl "http://localhost:37777/api/export?format=json" > backup.json
```

## Configuration

```json
{
  "MOLTBRAIN_WORKER_PORT": 37777,
  "MOLTBRAIN_CONTEXT_OBSERVATIONS": 50,
  "MOLTBRAIN_PROVIDER": "claude",
  "MOLTBRAIN_PRUNE_DAYS": 0,
  "MOLTBRAIN_THEME": "system"
}
```

## duck-cli Integration

MoltBrain integrates with OpenClaw via MCP. duck-cli can:

1. **Use OpenClaw's MoltBrain** if connected to OpenClaw gateway
2. **Run MoltBrain worker locally** on the Mac
3. **Connect to remote MoltBrain** at phone/server

## MoltBrain Storage (Optional)

**App:** https://app.moltbrain.dev/storage
**Payment:** x402 micropayments ($0.01 USDC on Base)

| Storage | Description |
|---------|-------------|
| **BLOB** | Content-addressed JSON via SHA-256 |
| **Memory Slots** | Named key-value for agent state |
| **Agent Vault** | Per-wallet scoping with labels |

## Related Skills

- `termux` — Run MoltBrain on Android phone
- `memory` — duck-cli's built-in session memory

## Status

✅ MoltBrain available for OpenClaw
✅ MCP tools for search/capture
✅ REST API for external access
🔄 duck-cli native integration WIP
