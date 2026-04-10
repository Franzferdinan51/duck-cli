# 🦆 Duck CLI Memory System - Migration Plan

## Current State (MemPalace)
- ❌ External dependency
- ❌ Paid service
- ❌ Vendor lock-in
- ❌ Privacy concerns

## Target State (Obsidian + Local)
- ✅ Local-first
- ✅ Free
- ✅ Full control
- ✅ Future-proof (markdown)
- ✅ Powerful UI (Obsidian)

---

## Migration Steps

### Step 1: Set Up Obsidian (5 minutes)
1. Download Obsidian: https://obsidian.md
2. Install and create new vault
3. Set vault location: `~/.openclaw/workspace/memory-vault`
4. Install "Local REST API" plugin (optional, for API access)

### Step 2: Export from MemPalace (if any data)
```bash
# If you have data in mempalace, export it
# (Check if there's an export feature)
```

### Step 3: Import to Obsidian
```bash
# Memories will be saved as markdown files automatically
# Each memory = one .md file with frontmatter
```

### Step 4: Update duck-cli
```bash
# The obsidian-integration.ts module handles this
# Memories save to vault automatically
```

### Step 5: Verify
```bash
# Check that memories appear in Obsidian
# Test search
# Test graph view
```

---

## File Structure

```
~/.openclaw/workspace/memory-vault/
├── mem-1234567890-abc123.md    # Individual memories
├── mem-1234567891-def456.md
├── daily-2026-04-07.md         # Daily notes
├── insights/                   # Folder organization
│   ├── mem-...
│   └── mem-...
└── .obsidian/                  # Obsidian config
    ├── app.json
    ├── appearance.json
    └── plugins/
```

---

## Memory Format

Each memory is a markdown file with YAML frontmatter:

```markdown
---
id: mem-1234567890-abc123
type: session
source: duck-cli
timestamp: 2026-04-07T13:09:00.000Z
tags: ["session", "test"]
related: [mem-1234567890-abc124]
---

# Session: mem-1234567

Memory content here...

## Metadata
- **Created**: 4/7/2026, 1:09:00 PM
- **Source**: duck-cli
- **Tags**: session, test
- **Related**: mem-1234567890-abc124
```

---

## Usage Examples

### Save a memory
```typescript
import { saveMemory } from './memory/obsidian-integration.js';

const memory = saveMemory({
  content: 'Learned about memory systems today',
  type: 'learning',
  tags: ['memory', 'architecture'],
});
```

### Search memories
```typescript
import { searchMemories } from './memory/obsidian-integration.js';

const results = searchMemories('memory system');
```

### List recent memories
```typescript
import { getRecentMemories } from './memory/obsidian-integration.js';

const recent = getRecentMemories(10);
```

---

## Obsidian Features You'll Get

1. **Graph View** - Visual memory connections
2. **Search** - Full-text search across all memories
3. **Tags** - Organize by tags
4. **Links** - Connect related memories
5. **Daily Notes** - Automatic daily memory logs
6. **Plugins** - Thousands of community plugins
7. **Sync** - Optional sync via Git/iCloud/Dropbox

---

## Why This is Better

| Feature | MemPalace | Obsidian |
|---------|-----------|----------|
| Cost | $0.01/memory | Free |
| Control | Vendor | You |
| Format | Proprietary | Markdown |
| UI | Basic | Advanced |
| Search | Basic | Full-text + graph |
| Privacy | Cloud | Local |
| Longevity | Uncertain | Proven |

---

## Next Steps

1. ✅ Decision made: Use Obsidian
2. 🔄 Install Obsidian
3. 🔄 Create vault
4. 🔄 Test integration
5. 🔄 Migrate any existing data
6. 🔄 Update documentation

---

## Rollback Plan

If Obsidian doesn't work out:
1. All data is markdown - portable anywhere
2. Can switch to any other markdown-based system
3. Can build custom UI later
4. No data loss, no lock-in
