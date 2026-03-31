# Duck CLI - Comprehensive Architecture Research

**Research Date:** March 31, 2026  
**Sources:** Charm Crush, OpenCode, Gemini CLI, Claude Code (instructkr), OpenClaw

---

## Executive Summary

Based on deep analysis of leading AI CLI tools, this document outlines the architecture for **Duck CLI** - a next-generation AI coding agent that combines the best features from existing tools while adding unique OpenClaw innovations.

---

## 1. Key Architecture Patterns

### 1.1 Agent Loop Pattern (from Claude Code + Crush)

```
┌─────────────────────────────────────────────────────────────┐
│                    Duck CLI Agent Loop                       │
├─────────────────────────────────────────────────────────────┤
│  1. Read user input (prompt + attachments)                  │
│  2. Invoke model with context (session history + tools)     │
│  3. Execute tool calls (file, terminal, web, agent)         │
│  4. Stream results back to UI                               │
│  5. Compress context (if needed)                            │
│  6. Repeat until task complete                              │
└─────────────────────────────────────────────────────────────┘
```

**Key Files to Reference:**
- `charm-crush/internal/agent/` - Agent coordination
- `charm-crush/internal/ui/model/ui.go` - UI state machine
- `claude-code/src/runtime.py` - Python agent loop

### 1.2 Tool Registry Pattern

All tools follow a consistent interface:

```go
// Go (Crush style)
type AgentTool interface {
    Name() string
    Description() string
    Execute(ctx context.Context, params any) (ToolResponse, error)
}
```

```typescript
// TypeScript (OpenCode style)
interface Tool {
  name: string
  description: string
  parameters: z.ZodSchema
  execute: (params: any, context: ToolContext) => Promise<ToolResult>
}
```

### 1.3 Session-Based Architecture

```
Session
├── ID (UUID)
├── Messages (conversation history)
├── Files (tracked file versions)
├── Todos (in-progress tasks)
├── Tools (available tool set)
└── Context (provider, model, settings)
```

**Key Files:**
- `charm-crush/internal/session/session.go`
- `charm-crush/internal/message/message.go`

### 1.4 Pub/Sub Event System

```go
// Crush uses pubsub for decoupled communication
type Event[T any] struct {
    Type    EventType
    Payload T
}

// Events flow:
// User Input → Agent → Tool Execution → UI Update
```

---

## 2. Important Source Files to Reference

### 2.1 Charm Crush (Go + Bubble Tea)

| File | Purpose | What to Copy |
|------|---------|--------------|
| `internal/cmd/run.go` | CLI entry point | Flag parsing, stdin handling |
| `internal/ui/model/ui.go` | Main UI model | State machine, key handling |
| `internal/ui/chat/tools.go` | Tool rendering | Tool output formatting |
| `internal/agent/tools/bash.go` | Bash tool | Background jobs, command blocking |
| `internal/agent/tools/edit.go` | File edit tool | Diff generation, file tracking |
| `internal/config/config.go` | Configuration | Provider config, MCP/LSP support |
| `internal/permission/permission.go` | Permission system | YOLO mode, permission requests |

### 2.2 OpenCode (TypeScript + Effect)

| File | Purpose | What to Copy |
|------|---------|--------------|
| `packages/opencode/src/index.ts` | CLI entry | Command routing, middleware |
| `packages/opencode/src/cli/cmd/mcp.ts` | MCP management | Add/list/remove MCP servers |
| `packages/opencode/src/cli/cmd/agent.ts` | Agent management | Agent creation wizard |
| `packages/opencode/src/agent/agent.ts` | Agent core | Agent lifecycle |
| `packages/opencode/src/mcp/` | MCP client | OAuth, transport, auth |

### 2.3 Gemini CLI (TypeScript + Ink)

| File | Purpose | What to Copy |
|------|---------|--------------|
| `packages/gemini-cli-core/src/` | Core library | Tool definitions |
| `.gemini/skills/` | Skill examples | Skill format, structure |
| `evals/` | Evaluation suite | Testing patterns |

### 2.4 Claude Code (Python - instructkr)

| File | Purpose | What to Copy |
|------|---------|--------------|
| `src/tools.py` | Tool system | Tool definitions, schemas |
| `src/query_engine.py` | Query engine | Context management |
| `src/runtime.py` | Runtime | Agent execution loop |
| `src/coordinator/` | Task coordination | Dependency graphs |
| `src/vim/` | Vim mode | Modal editing |
| `src/voice/` | Voice mode | Speech input |

---

## 3. Unique Features We Should Copy

### 3.1 From Charm Crush

#### Multi-Provider Support
```go
// Config supports multiple providers simultaneously
type Config struct {
    Models map[SelectedModelType]SelectedModel  // large/small
    Providers *csync.Map[string, ProviderConfig] // All providers
    MCP MCPs  // MCP servers
    LSP LSPs  // Language servers
}
```

**Unique:** Large/small model switching, provider auto-discovery

#### LSP Integration
- Auto-start language servers based on file types
- Real-time diagnostics in chat
- Symbol references on demand

#### Permission System
```go
// YOLO mode for trusted sessions
type Permissions struct {
    AllowedTools []string  // Always allowed
    SkipRequests bool      // YOLO mode - auto-approve
}
```

#### File Tracking
- Track which files have been read
- Prevent edits on stale files
- Automatic file versioning

### 3.2 From OpenCode

#### MCP Server Management
```bash
# Add MCP servers
opencode mcp add <name> <command>
opencode mcp list
opencode mcp auth <name>

# Config format
{
  "mcp": {
    "filesystem": {
      "type": "local",
      "command": ["npx", "-y", "@modelcontextprotocol/server-filesystem", "/path"]
    },
    "remote-api": {
      "type": "remote",
      "url": "https://api.example.com/mcp",
      "oauth": { "clientId": "..." }
    }
  }
}
```

**Unique:** OAuth support for remote MCP servers, dynamic registration

#### Agent Client Protocol (ACP)
```typescript
// Spawn sub-agents that can communicate
interface ACPMessage {
  from: string    // Agent ID
  to: string      // Target agent
  type: string    // Message type
  payload: any    // Data
}
```

**Unique:** Inter-agent messaging, file collision detection

#### Fleet Mode
- Run multiple agents in parallel
- Each agent has isolated worktree
- Coordination via message bus

### 3.3 From Gemini CLI

#### Interactive Terminal Commands
```bash
# Built-in terminal UI commands
:terminal          # Open terminal
:vim file.ts       # Open vim
:top               # System monitor
:git rebase -i     # Interactive rebase
```

#### Sandboxed Execution
- Docker sandbox for untrusted code
- Automatic sandbox recovery
- File system isolation

#### Skills System
```yaml
# .gemini/skills/my-skill/SKILL.md
---
description: What this skill does
---

# Instructions for the agent
When asked about X, do Y...
```

### 3.4 From Claude Code

#### Worktree Isolation
```
Main Session
├── Subagent 1 → Worktree A (isolated git)
├── Subagent 2 → Worktree B (isolated git)
└── Subagent 3 → Worktree C (isolated git)
```

**Benefits:** Parallel execution without conflicts

#### Context Compression
- Automatic summarization of old messages
- 65% token savings
- Preserves important context

#### Task Dependency Graph
```python
# Tasks can depend on other tasks
task1 = Task("read file")
task2 = Task("analyze", depends_on=[task1])
task3 = Task("write", depends_on=[task2])
```

#### Vim Mode
```
/vim              # Enter vim mode
:w                # Write file
:q                # Quit vim
/w                # Toggle between vim and assistant
```

---

## 4. CLI Argument Patterns

### 4.1 Standard Patterns

```bash
# Run mode (non-interactive)
duck run "prompt"                    # Single prompt
duck run -q "prompt"                 # Quiet (no spinner)
duck run -v "prompt"                 # Verbose (show logs)
duck run -m gpt-4 "prompt"           # Specify model
duck run --continue "follow up"      # Continue last session

# Interactive mode
duck                                 # Start interactive
duck --session <id>                  # Resume session
duck --continue                      # Continue recent

# Provider selection
duck --provider anthropic "prompt"
duck --provider openai "prompt"
duck --provider lmstudio "prompt"
```

### 4.2 MCP Management

```bash
duck mcp add <name> <command>        # Add local MCP
duck mcp add <name> --url <url>      # Add remote MCP
duck mcp list                        # List MCP servers
duck mcp remove <name>               # Remove MCP
duck mcp auth <name>                 # Authenticate
duck mcp debug <name>                # Debug connection
```

### 4.3 Agent Management

```bash
duck agent create                    # Create new agent
duck agent list                      # List agents
duck agent spawn <name>              # Spawn sub-agent
duck agent message <to> <msg>        # Send message
```

### 4.4 Session Management

```bash
duck session list                    # List sessions
duck session show <id>               # Show session
duck session delete <id>             # Delete session
duck session export <id>             # Export session
duck session import <file>           # Import session
```

### 4.5 Configuration

```bash
duck config init                     # Initialize config
duck config providers                # Configure providers
duck config models                   # Configure models
duck config set <key> <value>        # Set config value
```

---

## 5. Tool System Designs

### 5.1 Core Tools (All CLIs)

| Tool | Crush | OpenCode | Gemini | Claude | Duck CLI |
|------|-------|----------|--------|--------|----------|
| `view` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `write` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `edit` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `bash` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `glob` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `grep` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `ls` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `fetch` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `agent` | ✅ | ✅ | ✅ | ✅ | ✅ |

### 5.2 Tool Interface Design

```typescript
// Unified tool interface (TypeScript)
interface DuckTool {
  // Metadata
  name: string
  description: string
  parameters: z.ZodSchema
  
  // Execution
  execute: (
    params: any,
    context: ToolContext
  ) => Promise<ToolResult>
  
  // Optional: Permission handling
  needsPermission?: (params: any) => boolean
  
  // Optional: Result formatting
  formatResult?: (result: any) => string
}

interface ToolContext {
  sessionId: string
  messageId: string
  workingDir: string
  permissions: PermissionService
  fileTracker: FileTracker
  lspManager: LSPManager
}

interface ToolResult {
  content: string
  metadata?: any
  isError?: boolean
}
```

### 5.3 Tool Categories

```
File Tools
├── view - Read file contents
├── write - Create new file
├── edit - Replace content
├── multi_edit - Multiple edits
├── glob - Find files by pattern
├── grep - Search file contents
└── ls - List directory

Terminal Tools
├── bash - Execute shell command
├── job_output - Get background job output
└── job_kill - Kill background job

Web Tools
├── fetch - Fetch URL content
├── web_search - Search the web
└── agentic_fetch - Smart web fetch

Agent Tools
├── agent - Spawn sub-agent
├── agentic_fetch - Agent-powered fetch
└── todos - Task management

LSP Tools
├── lsp_diagnostics - Get diagnostics
├── lsp_references - Find references
└── lsp_restart - Restart LSP

MCP Tools
├── list_mcp_resources - List resources
├── read_mcp_resource - Read resource
└── [dynamic] - MCP-provided tools
```

### 5.4 Tool Permission Model

```go
// Permission request flow
type PermissionRequest struct {
    SessionID   string
    ToolCallID  string
    ToolName    string
    Action      string  // read, write, execute
    Description string
    Params      any     // Tool-specific params
}

// User can:
// 1. Allow once
// 2. Allow for session
// 3. Deny
// 4. Enable YOLO mode (allow all)
```

---

## 6. OpenClaw Integration Points

### 6.1 What OpenClaw Already Has

| Feature | Status | Integration |
|---------|--------|-------------|
| Multi-provider | ✅ | MiniMax, Kimi, GPT, LM Studio |
| Skills system | ✅ | Hook-based architecture |
| Semantic memory | ✅ | Embeddings + search |
| MCP integration | ✅ | MCP servers |
| Agent spawning | ✅ | Sub-agents |
| Desktop control | ✅ | ClawdCursor, mac-use |
| WebUI + Canvas | ✅ | Generative UI |
| DEFCON monitoring | ✅ | Security alerts |
| Grow automation | ✅ | Plant monitoring |
| AI Council | ✅ | Deliberation |

### 6.2 Integration Architecture

```
Duck CLI
├── Core (Agent Loop, Tools, UI)
├── OpenClaw Bridge
│   ├── Provider Router → OpenClaw models
│   ├── Skills Loader → OpenClaw skills
│   ├── Memory Client → OpenClaw memory
│   ├── MCP Client → OpenClaw MCP
│   └── Agent Spawner → OpenClaw subagents
└── Extensions
    ├── DEFCON Module
    ├── AI Council Module
    ├── Grow Module
    └── Canvas UI Module
```

### 6.3 Configuration Bridge

```json
{
  "duckcli": {
    "openclaw": {
      "enabled": true,
      "gatewayUrl": "ws://localhost:18789",
      "skillsPath": "~/.openclaw/skills",
      "memoryEnabled": true,
      "defconEnabled": true
    }
  }
}
```

---

## 7. Technical Stack Recommendation

### 7.1 Hybrid Approach

```
┌─────────────────────────────────────────────┐
│           Duck CLI Architecture              │
├─────────────────────────────────────────────┤
│  CLI Core          → Go (fast startup)      │
│  Agent Loop        → Go (performance)       │
│  TUI               → Bubble Tea (Go)        │
│  Tool Registry     → Go + WASM plugins      │
├─────────────────────────────────────────────┤
│  Skills            → TypeScript/JS          │
│  MCP Clients       → TypeScript (official)  │
│  Extensions        → TypeScript             │
├─────────────────────────────────────────────┤
│  OpenClaw Bridge   → TypeScript (existing)  │
└─────────────────────────────────────────────┘
```

### 7.2 Why This Stack?

| Component | Language | Reason |
|-----------|----------|--------|
| CLI Core | Go | Fast startup (<100ms), single binary |
| TUI | Go + Bubble Tea | Proven, beautiful, responsive |
| Tools | Go | Performance for file/terminal ops |
| Skills | TypeScript | Ecosystem, easy to write |
| MCP | TypeScript | Official SDK, better support |
| Extensions | TypeScript | OpenClaw compatibility |

### 7.3 Alternative: Pure TypeScript

If development speed is priority:
- Use TypeScript for everything
- Compile with `pkg` or `bun build --compile`
- Accept slower startup (~500ms)

---

## 8. Implementation Phases

### Phase 1: Foundation (Weeks 1-2)
- [ ] Project setup (Go + TS hybrid)
- [ ] CLI framework (cobra or custom)
- [ ] Basic agent loop
- [ ] Tool registry (5 core tools)
- [ ] Single provider (Claude)

### Phase 2: Multi-Provider (Weeks 3-4)
- [ ] Provider abstraction
- [ ] Add GPT, Gemini, LM Studio
- [ ] Config system
- [ ] Model switching

### Phase 3: Advanced Features (Weeks 5-6)
- [ ] MCP server management
- [ ] Worktree isolation
- [ ] Vim mode
- [ ] Voice mode

### Phase 4: OpenClaw Integration (Weeks 7-8)
- [ ] Skills system
- [ ] Semantic memory
- [ ] DEFCON mode
- [ ] AI Council
- [ ] Canvas UI

### Phase 5: Polish (Weeks 9-10)
- [ ] Documentation
- [ ] Testing
- [ ] Performance optimization
- [ ] Release

---

## 9. File Structure

```
duck-cli/
├── cmd/
│   └── duck/
│       └── main.go              # CLI entry
├── pkg/
│   ├── agent/
│   │   ├── loop.go              # Agent loop
│   │   ├── coordinator.go       # Task coordination
│   │   └── context.go           # Context management
│   ├── tools/
│   │   ├── registry.go          # Tool registry
│   │   ├── bash.go              # Bash tool
│   │   ├── file.go              # File tools
│   │   ├── web.go               # Web tools
│   │   └── agent.go             # Agent tool
│   ├── ui/
│   │   ├── tui.go               # Bubble Tea UI
│   │   ├── chat.go              # Chat component
│   │   └── tools.go             # Tool rendering
│   ├── config/
│   │   ├── config.go            # Config types
│   │   └── providers.go         # Provider configs
│   ├── mcp/
│   │   ├── client.go            # MCP client
│   │   └── manager.go           # MCP management
│   ├── lsp/
│   │   └── manager.go           # LSP management
│   └── openclaw/
│       ├── bridge.go            # OpenClaw integration
│       ├── skills.go            # Skills loader
│       └── memory.go            # Memory client
├── skills/                       # Built-in skills
│   └── builtin/
├── scripts/                      # Build scripts
├── docs/                         # Documentation
├── go.mod
├── package.json                  # For TS components
└── README.md
```

---

## 10. Key Design Decisions

### 10.1 Session Persistence
- Store sessions in SQLite (like OpenCode)
- Enable search and history
- Support export/import

### 10.2 Tool Execution
- Sandboxed by default
- Permission system for destructive ops
- Background job support

### 10.3 Provider Abstraction
- OpenAI-compatible API as baseline
- Provider-specific features as extensions
- Easy to add new providers

### 10.4 Extension Model
- Skills for behavior
- MCP for tools
- Plugins for deep integration

---

## 11. Competitive Advantages

| Feature | Duck CLI | Others |
|---------|----------|--------|
| Multi-provider | ✅ Native | ❌ Single |
| OpenClaw skills | ✅ Deep | ❌ None |
| Semantic memory | ✅ Built-in | ❌ None |
| DEFCON security | ✅ Unique | ❌ None |
| AI Council | ✅ Unique | ❌ None |
| Canvas UI | ✅ Unique | ❌ Text only |
| Local models | ✅ First-class | ❌ Afterthought |
| Worktree isolation | ✅ Built-in | ❌ Manual |

---

## 12. Next Steps

1. **Finalize language choice** (Go hybrid vs Pure TS)
2. **Set up repository** with proper structure
3. **Implement core agent loop** with 5 tools
4. **Add first provider** (Claude via OpenClaw)
5. **Build basic TUI** with Bubble Tea
6. **Iterate and expand**

---

*This architecture document is a living document. Update as research progresses and implementation decisions are made.*

---

## System Prompts - Claude Code Architecture

**Source:** `sources/claude-code-system-prompts/` (30 prompts, 376KB)

### Key Insights

1. **Dynamic Assembly:** Main system prompt built from modular section builders at runtime
2. **Caching Boundary:** `__SYSTEM_PROMPT_DYNAMIC_BOUNDARY__` splits cacheable vs session-specific
3. **Multi-Agent Coordinator:** 4-phase workflow (Research → Synthesis → Implementation → Verification)
4. **Self-Contained Prompts:** Workers can't see coordinator conversation - everything must be in the prompt
5. **Parallelism:** Launch independent workers concurrently, serialize writes

### Coordinator Pattern to Implement

```typescript
// 1. Spawn research workers in parallel
const researchResults = await Promise.all([
  agent.spawn({ task: 'Research auth system', type: 'worker' }),
  agent.spawn({ task: 'Research API routes', type: 'worker' }),
]);

// 2. Synthesize findings (coordinator job)
const spec = synthesize(researchResults);

// 3. Implementation worker (or continue if same files)
agent.spawn({ task: spec, type: 'worker' });

// 4. Verification worker (always fresh eyes)
agent.spawn({ task: verifySpec, type: 'verification' });
```

### Prompt Sections (in order)

1. Intro (getSimpleIntroSection)
2. System (getSimpleSystemSection)
3. Doing Tasks (getSimpleDoingTasksSection)
4. Actions (getActionsSection)
5. Using Tools (getUsingYourToolsSection)
6. Tone & Style (getSimpleToneAndStyleSection)
7. Output Efficiency (getOutputEfficiencySection)
8. __DYNAMIC_BOUNDARY__
9. Session-Specific Guidance
10. Environment Info (injected)

### Verification Agent (Adversarial)

Claude Code has a dedicated verification agent that:
- Tries to break implementations
- Runs tests with feature enabled
- Investigates errors (not just confirms)
- Assigns PASS/FAIL verdict

### Key System Prompts to Reference

| # | Prompt | Use For |
|---|--------|---------|
| 01 | Main System Prompt | Core agent identity |
| 05 | Coordinator | Swarm orchestration |
| 07 | Verification Agent | Testing strategy |
| 08 | Explore Agent | Read-only research |
| 12 | Auto Mode Classifier | Permission system |
| 13 | Tool Prompts | All 30+ tool descriptions |
| 21 | Compact Service | Context compression |
| 19 | Simplify Skill | Code review workflow |
| 25 | Skillify Skill | Skill creation system |

