# USER.md - Duck CLI User Guide

## For End Users

### Getting Started

1. **Install Duck CLI**
   ```bash
   git clone https://github.com/Franzferdinan51/duck-cli.git
   cd duck-cli
   npm install && npm run build
   go build -o duck ./cmd/duck/
   cp duck ~/.local/bin/
   ```

2. **Configure API Keys**
   ```bash
   cp .env.example .env
   # Edit .env and add your API keys
   ```

3. **Verify Installation**
   ```bash
   duck status
   duck health
   ```

### Basic Usage

**Interactive Mode:**
```bash
duck shell
```

**Single Command:**
```bash
duck run "Your task here"
```

**With Specific Provider:**
```bash
duck run "Your task" --provider minimax
duck run "Your task" --provider lmstudio
```

### Common Tasks

**File Operations:**
```bash
# Read a file
duck run "Read /path/to/file.txt"

# Write a file
duck run "Create a file at /path/to/file.txt with content: Hello World"

# Search files
duck run "Find all .ts files in src/"
```

**Web Search:**
```bash
duck run "Search for latest TypeScript features"
```

**Code Tasks:**
```bash
# Code review
duck run "Review this code" --skill code-review

# Git workflow
duck run "Create a feature branch and commit changes"
```

**Android Control:**
```bash
# List devices
duck android devices

# Take screenshot
duck android screenshot

# Execute command
duck android shell "ls -la /sdcard/"
```

### Advanced Features

**AI Council Deliberation:**
```bash
duck council "Should we use microservices or monolith?"
```

**Parallel Thinking:**
```bash
duck run "Think about this problem from multiple angles" --parallel 3
```

**Spawn Sub-Agents:**
```bash
duck run "Spawn 3 agents to research X, Y, and Z in parallel"
```

**Create Skills:**
```bash
duck run "Create a skill for deploying to AWS"
```

## For Developers

### Architecture Overview

Duck CLI consists of:
- **Go CLI Wrapper**: Entry point, command routing
- **TypeScript Core**: Agent logic, tools, providers
- **Hybrid Orchestrator**: Task routing and complexity analysis
- **Meta-Agent**: Complex task planning and execution
- **Sub-Conscious**: Long-term memory and pattern recognition

### Key Components

| Component | File | Purpose |
|-----------|------|---------|
| Agent Core | `src/agent/core.ts` | Main agent class |
| Chat Agent | `src/agent/chat-agent.ts` | Conversational interface |
| Orchestrator | `src/orchestrator/` | Task routing |
| Meta-Agent | `src/orchestrator/meta-agent.ts` | Complex task handling |
| Tool Registry | `src/tools/registry.ts` | Tool management |
| Providers | `src/providers/manager.ts` | AI provider routing |

### Adding Features

**New Tool:**
1. Add to `src/agent/core.ts` → `registerTools()`
2. Define schema and handler
3. Rebuild: `npm run build`

**New Provider:**
1. Create provider class in `src/providers/`
2. Register in `src/providers/manager.ts`
3. Add configuration to `.env`

**New Skill:**
1. Create `skills/my-skill/SKILL.md`
2. Add scripts if needed
3. Rebuild to auto-load

### Development Workflow

```bash
# Start development
npm run watch

# Run tests
npm test

# Type check
npx tsc --noEmit

# Build Go binary
go build -o duck ./cmd/duck/

# Test locally
./duck run "test command"
```

### Debugging

```bash
# Enable tracing
DUCK_TRACE=1 ./duck run "command"

# View logs
./duck logger logs --limit 50

# Check health
./duck health

# Run doctor
./duck doctor
```

## Configuration

### Environment Variables

**Required:**
- `MINIMAX_API_KEY` - Primary AI provider

**Optional:**
- `KIMI_API_KEY` - Moonshot/Kimi
- `OPENAI_API_KEY` - OpenAI/Codex
- `OPENROUTER_API_KEY` - OpenRouter
- `LMSTUDIO_URL` - Local LM Studio
- `TELEGRAM_BOT_TOKEN` - Telegram bot

### Configuration Files

| File | Location | Purpose |
|------|----------|---------|
| `.env` | Project root | API keys |
| `config.json` | `~/.duck/` | User preferences |
| `memory.db` | `~/.duck/` | SQLite database |
| `sessions/` | `~/.duck/` | Session logs |

## Troubleshooting

### Common Issues

**"Module not found" errors:**
```bash
npm install
npm run build
```

**Provider timeout:**
- Check API key validity
- Verify network connection
- Try different provider: `--provider openrouter`

**Permission denied:**
```bash
chmod +x duck
```

**Port conflicts:**
```bash
# Check ports
lsof -i :3850    # MCP
lsof -i :18794   # ACP
lsof -i :18797   # Chat Agent
```

### Getting Help

1. Check `duck doctor` for diagnostics
2. Run `duck health` to check services
3. View logs: `duck logger logs`
4. Search issues: https://github.com/Franzferdinan51/duck-cli/issues
5. Join Discord: https://discord.gg/clawd

## Best Practices

### For Users

1. **Start simple** - Begin with basic commands
2. **Use skills** - Leverage built-in skills for common tasks
3. **Check outputs** - Review what the agent is doing
4. **Provide feedback** - Help the system learn
5. **Stay secure** - Review dangerous operations before approving

### For Developers

1. **Test thoroughly** - Run tests before committing
2. **Document changes** - Update relevant .md files
3. **Follow patterns** - Use existing code as reference
4. **Handle errors** - Graceful failure handling
5. **Respect limits** - Don't abuse API rate limits

## Resources

- **GitHub**: https://github.com/Franzferdinan51/duck-cli
- **OpenClaw**: https://github.com/openclaw/openclaw
- **Hermes**: https://github.com/NousResearch/hermes-agent
- **Discord**: https://discord.gg/clawd

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - See LICENSE file for details

---

*This guide helps both users and developers get the most out of Duck CLI.*
