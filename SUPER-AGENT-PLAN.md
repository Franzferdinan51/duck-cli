# 🦆 Duck Super Agent - Build Plan

## Vision
Build the ultimate AI agent combining:
- **Claude Code** (instructkr) - Coding mastery
- **OpenClaw** - Gateway architecture + 140 skills
- **Hermes-Agent** - Advanced tools + delegation
- **DuckBot-OS** - Features, learning, cost tracking
- **KAIROS-style** - Proactive AI (always-on)

## Source Projects
| Project | Purpose | Location |
|---------|--------|----------|
| instructkr-claude-code | Main base - Claude Code | ~/Desktop/instructkr-claude-code |
| OpenClaw | Gateway, skills, architecture | github.com/openclaw/openclaw |
| Hermes-Agent | Tools, delegation | github.com/Franzferdinan51/hermes-agent |
| DuckBot-OS | Features, learning | github.com/Franzferdinan51/DuckBot-OS |

## Architecture Goals

### 1. Gateway Layer (from OpenClaw)
- MCP server with 140+ skills
- Channel integrations (Telegram, Discord)
- Multi-provider routing
- Session management

### 2. Agent Core (from instructkr + Hermes)
- Claude Code-style coding abilities
- Tool execution framework
- Multi-file editing
- Code search (grep, glob)
- LSP integration

### 3. Proactive Features (KAIROS-style)
- Heartbeat system (every X seconds)
- Proactive task detection
- Auto-notifications
- Background monitoring
- Daily auto-dream consolidation

### 4. Duck Agent Additions
- Voice/TTS (DONE ✓)
- Cost tracking (DONE ✓)
- Learning system (DONE ✓)
- Context manager (DONE ✓)
- BrowserOS integration (DONE ✓)

## Implementation Phases

### Phase 1: Core Integration ✅
- [x] Voice/TTS with MiniMax
- [x] MiniMax M2.7 upgrade
- [x] Cost tracking
- [x] Context manager
- [x] BrowserOS tools

### Phase 2: Gateway (from OpenClaw)
- [ ] Import OpenClaw gateway architecture
- [ ] MCP server with full tool schema
- [ ] Channel manager (Telegram/Discord)
- [ ] Session persistence

### Phase 3: Claude Code Tools (from instructkr)
- [ ] FileEditTool (multi-file editing)
- [ ] BashTool (secure shell)
- [ ] GrepTool / GlobTool
- [ ] LSPTool (language server)
- [ ] REPLTool
- [ ] TaskCreateTool

### Phase 4: Advanced Tools (from Hermes)
- [ ] Delegate tool (spawn sub-agents)
- [ ] Cron job scheduling
- [ ] Memory tool
- [ ] Skill manager
- [ ] Code execution sandbox

### Phase 5: KAIROS Proactive AI
- [ ] Heartbeat system
- [ ] Proactive decision engine
- [ ] Push notifications
- [ ] Background task execution
- [ ] Daily auto-dream

## Tool Categories

### Coding Tools (from instructkr)
- FileRead, FileWrite, FileEdit
- Bash, PowerShell
- Grep, Glob
- LSP, REPL
- NotebookEdit

### System Tools (from Hermes)
- Delegate (sub-agents)
- Cron (scheduling)
- Memory (persistence)
- Skills (dynamic loading)

### Web Tools (from BrowserOS)
- Navigate, click, type
- Screenshot, content extraction
- Bookmarks, history

### Duck Tools (our additions)
- TTS/Speech generation
- Cost tracking
- Learning system
- Context patterns

## Non-Goals (No Conflicts)
- Won't replace OpenClaw gateway (can run alongside)
- Won't conflict with Hermes (different focus)
- Can use all three together

## Status: Building...
