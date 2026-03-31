# Duck CLI Feature Matrix

## Comprehensive Feature Comparison

| Feature | Claude | Crush | OpenCode | Gemini | **DuckCLI** |
|---------|--------|-------|----------|--------|-------------|
| **Core** | | | | | |
| Agent loop | ✅ | ❌ | ✅ | ✅ | ✅ |
| Multi-model | ❌ | ✅ | ✅ | ✅ | ✅ |
| CLI interface | ✅ | ✅ | ✅ | ✅ | ✅ |
| Desktop app | ✅ | ❌ | ✅ | ❌ | ✅ |
| **Tools** | | | | | |
| File ops | ✅ | ✅ | ✅ | ✅ | ✅ |
| Shell/Bash | ✅ | ✅ | ✅ | ✅ | ✅ |
| Git ops | ✅ | ❌ | ✅ | ✅ | ✅ |
| Web fetch | ✅ | ❌ | ✅ | ✅ | ✅ |
| Search | ✅ | ❌ | ✅ | ✅ | ✅ |
| LSP | ✅ | ❌ | ❌ | ❌ | ✅ |
| MCP | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Modes** | | | | | |
| Vim mode | ✅ | ❌ | ❌ | ❌ | ✅ |
| Voice mode | ✅ | ❌ | ❌ | ❌ | ✅ |
| Interactive terminal | ❌ | ❌ | ❌ | ✅ | ✅ |
| Worktree isolation | ✅ | ❌ | ❌ | ❌ | ✅ |
| **Agents** | | | | | |
| Subagent spawning | ✅ | ❌ | ✅ | ✅ | ✅ |
| Inter-agent messaging | ❌ | ❌ | ✅ | ❌ | ✅ |
| Fleet mode | ❌ | ❌ | ✅ | ❌ | ✅ |
| Agent teams | ✅ | ❌ | ✅ | ❌ | ✅ |
| **Context** | | | | | |
| Context compression | ✅ | ❌ | ❌ | ❌ | ✅ |
| Memory/scoped | ✅ | ❌ | ❌ | ❌ | ✅ |
| Session persistence | ✅ | ✅ | ✅ | ✅ | ✅ |
| CLAUDE.md | ✅ | ❌ | ❌ | ❌ | ✅ |
| **Providers** | | | | | |
| Anthropic | ✅ | ❌ | ✅ | ❌ | ✅ |
| OpenAI | ❌ | ✅ | ✅ | ❌ | ✅ |
| Google Gemini | ❌ | ❌ | ✅ | ✅ | ✅ |
| Local (LM Studio) | ❌ | ❌ | ✅ | ❌ | ✅ |
| OpenAI-compatible | ❌ | ✅ | ✅ | ❌ | ✅ |
| MiniMax | ❌ | ❌ | ❌ | ❌ | ✅ |
| Kimi | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Integrations** | | | | | |
| GitHub Actions | ❌ | ❌ | ✅ | ❌ | ✅ |
| GitLab | ❌ | ❌ | ✅ | ❌ | ✅ |
| Slack/Discord | ❌ | ❌ | ✅ | ❌ | ✅ |
| Telegram | ❌ | ❌ | ✅ | ❌ | ✅ |
| **OpenClaw-Only** | | | | | |
| Semantic memory | ❌ | ❌ | ❌ | ❌ | ✅ |
| DEFCON security | ❌ | ❌ | ❌ | ❌ | ✅ |
| AI Council | ❌ | ❌ | ❌ | ❌ | ✅ |
| Grow automation | ❌ | ❌ | ❌ | ❌ | ✅ |
| Skills system | ✅ | ❌ | ✅ | ❌ | ✅ |
| Canvas UI | ❌ | ❌ | ❌ | ❌ | ✅ |
| Pretext text | ❌ | ❌ | ❌ | ❌ | ✅ |

## Source Code References

### Claude Code (Original)
- **Location:** `sources/claude-code-src/`
- **Key files:**
  - `src/Tool.ts` - Tool system
  - `src/Task.ts` - Task management
  - `src/runtime.ts` - Agent runtime
  - `src/vim/` - Vim mode
  - `src/voice/` - Voice mode

### instructkr (Python)
- **Location:** `sources/claude-code/`
- **Type:** Clean-room Python rewrite

### instructkr (Rust)
- **Location:** `sources/claw-code/` (dev/rust)
- **Type:** Rust + TypeScript hybrid

### Charm Crush
- **Location:** `sources/charm-crush/`
- **Tech:** Go + Bubble Tea
- **Key features:**
  - Beautiful TUI
  - Multi-model
  - MCP extensibility

### OpenCode
- **Location:** `sources/opencode/`
- **Tech:** TypeScript
- **Key features:**
  - MCP server management
  - Fleet mode
  - IM adapters
  - GitHub/GitLab integration

### Gemini CLI
- **Location:** `sources/gemini-cli/`
- **Tech:** Node.js
- **Key features:**
  - Interactive terminal
  - Google Search grounding
  - Free tier

## Key Architectural Patterns

### 1. Agent Loop (Claude Code)
```
while (task not complete) {
  - Get user input
  - Invoke model
  - Execute tools
  - Compress context
  - Store memory
}
```

### 2. Tool System (Claude Code)
- Zod schemas for validation
- Permission gates
- Progress streaming
- Deferred loading

### 3. Task Coordination (Claude Code)
- Task types: bash, agent, workflow, etc.
- Disk-backed output
- AbortController for cancellation

### 4. MCP Integration (OpenCode)
```
MCP Server → MCP Client → Tools
```

### 5. Multi-Provider (Crush/OpenCode)
```
User Input → Router → Provider (Claude/GPT/Gemini/Local)
```

---

## OpenClaw Features (168MB source)

### Core Architecture
- **Agent Runtime:** Full agent loop with tool execution
- **Subagents:** Registry, lifecycle, spawning, messaging
- **Sessions:** Session management, persistence, history
- **Compaction:** Context compression/token management

### Model Providers
- Anthropic, OpenAI, Google Gemini, Moonshot
- MiniMax, Ollama, LM Studio, DeepSeek
- Cloudflare AI Gateway, Vercel AI, HuggingFace
- Custom API registry

### Tools & Skills
- **Skills System:** 53 built-in skills
- **MCP Integration:** Full MCP client/server
- **Tool Policy:** Permission system
- **Tool Catalog:** Dynamic tool registration

### Features
- Canvas (generative UI)
- TTS (text-to-speech)
- Browser automation
- Memory with embeddings
- Web search
- Security scanning

### Key Source Files
- `src/agents/` - Agent system (200+ files)
- `src/mcp/` - MCP integration
- `src/cli/` - CLI commands
- `skills/` - 53 skills
- `packages/` - Reusable packages
