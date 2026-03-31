# Duck CLI - Project Specification

**Version:** 0.1.0 (Planning)
**Status:** RESEARCH PHASE
**Started:** March 31, 2026

---

## Executive Summary

Build the **ultimate AI coding CLI** by combining the best features from Claude Code, Charm Crush, OpenCode, Gemini CLI, Codex, and OpenClaw - plus unique innovations only WE can offer.

**Tagline:** *"The CLI that coding agents deserve."*

---

## Source References

### Source Code
| Source | Location | Size | Type |
|--------|----------|------|------|
| Claude Code (Original) | `workspace/claude-code-src/` | 33MB | TypeScript |
| instructkr (Python) | `workspace/claude-code/` | 20MB | Python |
| instructkr (Rust) | `workspace/claw-code/` | ~20MB | Rust |
| instructkr (Desktop) | `workspace/instructkr-claude-code-desktop/` | 43MB | TypeScript |
| Charm Crush | `sources/charm-crush/` | 15MB | Go |
| OpenCode | `sources/opencode/` | 137MB | TypeScript |
| Gemini CLI | `sources/gemini-cli/` | 38MB | TypeScript |

### Key Files to Reference

#### Claude Code (Original)
- `src/Tool.ts` - Tool system with Zod schemas
- `src/Task.ts` - Task management
- `src/runtime.ts` - Agent loop
- `src/vim/` - Vim mode
- `src/voice/` - Voice mode
- `src/coordinator/` - Task coordination
- `src/skills/` - Skills system

#### OpenCode
- MCP server management
- Fleet mode
- IM adapters (Slack, Discord, Telegram)
- GitHub/GitLab integration

#### Charm Crush
- Go + Bubble Tea TUI
- Multi-model routing
- Beautiful terminal UI

#### Gemini CLI
- Interactive terminal
- Google Search grounding
- Free tier

---

## Feature Set

### Tier 1: Core (Must Have)

#### Agent System
- [ ] Agent loop with tool execution
- [ ] Task queue with dependency graph
- [ ] Subagent spawning
- [ ] Inter-agent messaging
- [ ] Worktree isolation for parallel execution

#### Tool System
- [ ] 40+ built-in tools
- [ ] Zod schema validation
- [ ] Permission system (granular)
- [ ] Progress streaming
- [ ] Deferred tool loading
- [ ] MCP integration

#### Multi-Provider
- [ ] Anthropic (Claude)
- [ ] OpenAI (GPT)
- [ ] Google (Gemini)
- [ ] Local LM Studio
- [ ] MiniMax
- [ ] Kimi
- [ ] OpenAI-compatible APIs

### Tier 2: Advanced

#### Modes
- [ ] Vim mode
- [ ] Voice mode
- [ ] Interactive terminal (top, vim, git rebase)
- [ ] Worktree isolation

#### Context Management
- [ ] Context compression
- [ ] Semantic memory
- [ ] Session persistence
- [ ] CLAUDE.md project files

#### Integrations
- [ ] GitHub Actions
- [ ] GitLab
- [ ] MCP servers
- [ ] LSP

### Tier 3: OpenClaw-Enhanced (Differentiators)

#### Unique Features
- [ ] DEFCON security mode
- [ ] AI Council deliberation
- [ ] Semantic memory with embeddings
- [ ] Grow automation hooks
- [ ] OpenClaw skills integration
- [ ] Pretext/Canvas generative UI

---

## Architecture

### Recommended Stack

**Core:** TypeScript (Node.js/Bun)
- Agent loop
- Tool system
- CLI interface

**Performance Parts:** Go or Rust
- File watching
- Git operations
- LSP client

**UI:** Bubble Tea or Ink
- Terminal UI
- Animations

### Project Structure
```
duck-cli/
├── cmd/
│   └── duck/
│       └── main.go (or main.ts)
├── pkg/
│   ├── agent/           # Agent loop
│   ├── tools/           # Tool registry
│   ├── skills/           # Skills system
│   ├── mcp/             # MCP integration
│   ├── providers/        # Multi-provider
│   ├── worktree/         # Git worktree
│   ├── vim/              # Vim mode
│   ├── voice/            # Voice mode
│   └── ui/               # Terminal UI
├── skills/               # Built-in skills
├── docs/                 # Documentation
└── README.md
```

---

## Killer Features (Unique to Duck CLI)

1. **True Agent Mesh** - Agents that spawn, delegate, and communicate
2. **Universal MCP** - MCP servers as easy as npm packages
3. **DEFCON Mode** - Proactive security scanning
4. **AI Council** - Multi-agent deliberation for decisions
5. **Semantic Memory** - Remember everything across sessions
6. **Canvas UI** - Generative terminal graphics
7. **Grow Automation** - Home monitoring hooks

---

## Next Steps

### Phase 1: Foundation
1. [ ] Finalize language choice (TS vs Go hybrid)
2. [ ] Set up project structure
3. [ ] Implement core agent loop
4. [ ] Build tool registry
5. [ ] Add one provider (Claude)

### Phase 2: Multi-Provider
6. [ ] Provider abstraction layer
7. [ ] Add GPT, Gemini, LM Studio
8. [ ] Config system

### Phase 3: Advanced
9. [ ] Vim mode
10. [ ] Voice mode
11. [ ] MCP management
12. [ ] Worktree isolation

### Phase 4: OpenClaw Features
13. [ ] Semantic memory
14. [ ] DEFCON mode
15. [ ] AI Council
16. [ ] Skills system

---

## References

- Claude Code Docs: https://code.claude.com
- OpenCode Docs: https://opencode.ai/docs
- Charm Crush: https://charm.sh
- Gemini CLI: https://github.com/google-gemini/gemini-cli
- OpenClaw: https://github.com/openclaw/openclaw

---

*Building the CLI that coding agents deserve.*

---

## 🎯 Priority Killer Features (From AI Council)

### Must Have
1. **Context-Aware Project Memory** - Remembers codebase, patterns, tech debt across sessions
2. **Multi-Agent Swarm Coding** - Parallel specialized sub-agents that coordinate
3. **DEFCON Security Mode** - Proactive security/vulnerability scanning
4. **AI Council Deliberation** - Multi-agent decision making built-in

### High Priority
5. **Predictive Intent Engine** - AI anticipates next actions
6. **Living Documentation** - Auto-generated docs that stay in sync
7. **Voice-Native Mode** - Full hands-free development
8. **Natural Language Testing** - Write tests in plain English

### Differentiators
9. **Code Archaeology** - Trace why code decisions were made
10. **Team Intelligence Layer** - Shared knowledge across team
11. **Dependency Risk Radar** - Proactive dependency monitoring
12. **Smart Worktree Orchestration** - Intelligent parallel development
