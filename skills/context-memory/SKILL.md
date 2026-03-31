---
name: context-memory
description: "Persistent semantic memory across sessions"
triggers:
  - "/remember"
  - "remember that"
  - "what did we"
  - "context memory"
bins:
  - sqlite3
---

# Context Memory Skill

**Killer Feature**: Persistent memory across sessions.

## Problem

Other CLIs start fresh every session. Duck CLI *remembers*.

## Features

- **Semantic Search**: Find relevant past context
- **Session Summaries**: Compact conversations into summaries
- **Project Memory**: Architecture, decisions, conventions
- **Codebase Context**: What we built, why decisions were made

## Based On

Claude Code's memory system:
- `15_session_search.md` - Semantic search
- `16_memory_selection.md` - Memory selection
- `21_compact_service.md` - Conversation summarization
- `24_memory_instruction.md` - CLAUDE.md loading

## Commands

```bash
# Memory operations
/remember "store this fact"      # Save to memory
/remember --search "query"       # Search memory
/remember --project             # Show project memory
/remember --clear               # Clear session memory

# Session management
/memory compact                 # Compact context
/memory summary                # Generate summary
/memory context               # Load relevant context
```

## Memory Files

```
.workspace/
├── MEMORY.md           # Project-wide memory
├── memory/
│   ├── decisions.md    # Key decisions
│   ├── patterns.md     # Code patterns
│   └── context.md      # Current session
└── .claude/
    └── sessions/       # Session history
```

## Context Loading

When starting a new session:
1. Load `CLAUDE.md` / `MEMORY.md`
2. Search past sessions for relevant context
3. Inject `@include` directives
4. Summarize recent conversations
