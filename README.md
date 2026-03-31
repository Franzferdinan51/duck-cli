# 🦆 Duck CLI

**The ultimate AI coding agent** — combining the best of Claude Code, OpenCode, Gemini CLI, and OpenClaw.

## Features

- **Multi-Provider AI**: Anthropic, OpenAI, Gemini, LM Studio, MiniMax
- **MCP Integration**: Full Model Context Protocol support
- **Multi-Agent Swarm**: Coordinator pattern with parallel workers
- **Persistent Memory**: Semantic memory across sessions
- **DEFCON Security**: Proactive vulnerability scanning
- **AI Council**: Multi-agent deliberation for decisions
- **Skills System**: Extensible command system

## Quick Start

```bash
# Install dependencies
npm install

# Run in dev mode
npm run dev

# Or use Go CLI (when built)
duck run "Fix the login bug"
duck -i  # Interactive shell
```

## Commands

```bash
duck run "task"                    # Run a task
duck -i                            # Interactive shell
duck agent spawn <name> <task>     # Spawn an agent
duck mcp list                      # List MCP servers
duck skills list                   # List skills
duck security audit                # Run security audit
duck council "question"            # Ask AI Council
```

## Architecture

```
duck-cli/
├── cmd/duck/main.go          # Go CLI entry point
├── internal/
│   ├── agent/                # Core agent loop
│   ├── tools/                # Tool registry
│   ├── providers/            # Multi-provider support
│   ├── mcp/                  # MCP integration
│   ├── skills/               # Skills system
│   ├── security/             # DEFCON monitor
│   ├── council/              # AI Council
│   └── memory/               # Semantic memory
├── skills/                   # Built-in skills
└── sources/                  # Reference implementations
```

## Skills

| Skill | Description |
|-------|-------------|
| `context-memory` | 🔥 Persistent semantic memory |
| `security-audit` | DEFCON vulnerability scanning |
| `git-workflow` | Smart git with worktree isolation |
| `code-review` | Multi-agent verification |
| `mcp-manager` | MCP server management |

## Environment Variables

```bash
ANTHROPIC_API_KEY=sk-ant-...     # Anthropic (Claude)
OPENAI_API_KEY=sk-...           # OpenAI (GPT)
MINIMAX_API_KEY=...             # MiniMax
LMSTUDIO_URL=http://localhost:1234  # Local LM Studio
```

## Development

```bash
# TypeScript
npm run build     # Compile TypeScript
npm run dev       # Run with tsx

# Go CLI
cd cmd/duck && go build -o duck

# Install
npm link
```

## Sources Referenced

| Source | Size | Purpose |
|--------|------|---------|
| Claude Code (Original) | 33MB | Agent architecture, tools |
| Charm Crush | 15MB | Go TUI, Bubble Tea |
| OpenCode | 137MB | MCP management |
| Gemini CLI | 38MB | Interactive terminal |
| OpenClaw | 167MB | Skills, agents, sessions |
| System Prompts | 376KB | 30 Claude Code prompts |

## License

MIT
