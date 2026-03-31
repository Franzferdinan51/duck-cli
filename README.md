# 🦆 Duck CLI

**The ultimate AI coding agent** — combining the best of Claude Code, OpenCode, Gemini CLI, and OpenClaw.

## Features

- **10 AI Providers**: Anthropic, OpenAI, Gemini, Moonshot/Kimi, MiniMax, ZAI, DeepSeek, Ollama, LM Studio, Custom
- **MCP Integration**: Full Model Context Protocol support
- **Multi-Agent Swarm**: Coordinator pattern with parallel workers
- **Persistent Memory**: Semantic memory across sessions
- **DEFCON Security**: Proactive vulnerability scanning
- **AI Council**: Multi-agent deliberation for decisions
- **Skills System**: Extensible command system

## Quick Start

```bash
# Clone
git clone https://github.com/Franzferdinan51/duck-cli.git
cd duck-cli

# Install
npm install

# Run
npx tsx internal/agent/main.ts --run "Fix the login bug"
npx tsx internal/agent/main.ts -i  # Interactive shell
```

## Providers

Duck CLI supports multiple AI providers. Set any combination:

```bash
# Anthropic (Claude) - Recommended for coding
export ANTHROPIC_API_KEY=sk-ant-...

# OpenAI (GPT)
export OPENAI_API_KEY=sk-...

# Google Gemini
export GEMINI_API_KEY=...

# Moonshot/Kimi - Great for long context
export MOONSHOT_API_KEY=...

# MiniMax
export MINIMAX_API_KEY=...

# ZAI
export ZAI_API_KEY=...

# DeepSeek
export DEEPSEEK_API_KEY=...

# Set default provider
export DEFAULT_PROVIDER=kimi
```

### Local Providers (No API Key Required)

```bash
# LM Studio - Download from https://lmstudio.ai
export LMSTUDIO_URL=http://localhost:1234

# Ollama - Download from https://ollama.com
export OLLAMA_HOST=http://localhost:11434
```

### Custom Provider

```bash
export CUSTOM_PROVIDER_URL=https://your-api.com/v1
export CUSTOM_PROVIDER_KEY=your-key
export CUSTOM_PROVIDER_MODELS=model1,model2
```

## Commands

```bash
# Run a task
duck run "Fix the login bug"
duck -i                              # Interactive shell

# Agents
duck agent spawn <name> <task>       # Spawn agent
duck agent list                      # List agents

# MCP
duck mcp list                        # List MCP servers
duck mcp add <name> <command>        # Add server

# Skills
duck skills list                     # List skills
duck skills search <query>           # Search skills

# Security
duck security audit                  # Run security scan
duck security defcon                  # Show DEFCON level

# AI Council
duck council "Should we refactor?"   # Ask the council
```

## Skills

| Skill | Description |
|-------|-------------|
| `context-memory` | 🔥 Persistent semantic memory |
| `security-audit` | DEFCON vulnerability scanning |
| `git-workflow` | Smart git with worktree isolation |
| `code-review` | Multi-agent verification |
| `mcp-manager` | MCP server management |

## Architecture

```
duck-cli/
├── cmd/duck/main.go          # Go CLI entry point
├── internal/
│   ├── agent/                # Core agent loop
│   ├── tools/                # Tool registry
│   ├── providers/            # Multi-provider support (10+ providers)
│   ├── mcp/                  # MCP integration
│   ├── skills/               # Skills system
│   ├── security/             # DEFCON monitor
│   ├── council/              # AI Council
│   └── memory/               # Semantic memory
└── skills/                   # Built-in skills
```

## Provider Priority

When multiple providers are configured:

1. **Anthropic** (if `DEFAULT_PROVIDER=anthropic`)
2. **Kimi** (if `DEFAULT_PROVIDER=kimi`)
3. **MiniMax** (if `DEFAULT_PROVIDER=minimax`)
4. **LM Studio** (local, fallback)

## Development

```bash
# TypeScript
npm run build     # Compile
npm run dev       # Run with tsx

# Go CLI
cd cmd/duck && go build -o duck

# Link
npm link
```

## Sources Referenced

| Source | Size | Purpose |
|--------|------|---------|
| Claude Code | 33MB | Agent architecture, tools |
| Charm Crush | 15MB | Go TUI, Bubble Tea |
| OpenCode | 137MB | MCP management |
| Gemini CLI | 38MB | Interactive terminal |
| OpenClaw | 167MB | Skills, agents, sessions |
| System Prompts | 376KB | 30 Claude Code prompts |

## License

MIT
