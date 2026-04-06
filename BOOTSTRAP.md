# BOOTSTRAP.md - Duck CLI Bootstrap Guide

## Quick Start (5 minutes)

### 1. Clone and Build

```bash
git clone https://github.com/Franzferdinan51/duck-cli.git
cd duck-cli
npm install
npm run build
go build -o duck ./cmd/duck/
```

### 2. Configure Environment

```bash
# Copy example env
cp .env.example .env

# Edit .env with your API keys
nano .env
```

Required:
```bash
MINIMAX_API_KEY=sk-cp-...  # Get from platform.minimax.io
```

Optional:
```bash
KIMI_API_KEY=sk-kimi-...           # Get from platform.moonshot.cn
OPENAI_API_KEY=sk-...              # For OpenAI/Codex
OPENROUTER_API_KEY=sk-or-...       # For OpenRouter free tier
LMSTUDIO_URL=http://localhost:1234 # Local LM Studio
TELEGRAM_BOT_TOKEN=...             # For Telegram bot
```

### 3. Install Binary

```bash
# Option 1: Copy to PATH
cp duck ~/.local/bin/

# Option 2: Create symlink
ln -s $(pwd)/duck ~/.local/bin/duck

# Option 3: Use full path
./duck status
```

### 4. Verify Installation

```bash
./duck status
./duck health
./duck --version
```

## Directory Structure

```
duck-cli/
├── cmd/duck/           # Go CLI wrapper
├── src/                # TypeScript source
│   ├── agent/          # Core agent logic
│   ├── cli/            # CLI router
│   ├── orchestrator/   # Hybrid Orchestrator v4
│   ├── daemons/        # Background services
│   ├── mesh/           # Agent mesh networking
│   ├── tools/          # Tool registry
│   ├── providers/      # AI provider management
│   └── skills/         # Skill system
├── dist/               # Compiled JavaScript
├── skills/             # Auto-loaded skills
└── docs/               # Documentation
```

## First Run

```bash
# Start in interactive mode
./duck shell

# Or run a single command
./duck run "What is 2+2?"

# Start chat agent
./duck chat-agent start

# Start all services
./duck unified
```

## Development Mode

```bash
# Watch mode (auto-rebuild on changes)
npm run watch

# Run tests
npm test

# Lint code
npm run lint

# Type check
npx tsc --noEmit
```

## Troubleshooting

### Build Errors

```bash
# Clean and rebuild
rm -rf dist/
npm run build

# Check TypeScript version
npx tsc --version  # Should be 5.x

# Reinstall dependencies
rm -rf node_modules/
npm install
```

### Runtime Errors

```bash
# Check Node version
node --version  # Should be 20+

# Check Go version
go version  # Should be 1.21+

# Verify paths
./duck doctor

# Check health
./duck health
```

### Provider Issues

```bash
# Test specific provider
./duck run "test" --provider minimax
./duck run "test" --provider lmstudio
./duck run "test" --provider openrouter

# Check provider status
./duck providers
```

## Configuration Files

| File | Purpose |
|------|---------|
| `.env` | API keys and secrets |
| `openclaw.json` | OpenClaw integration config |
| `~/.duck/config.json` | User preferences |
| `~/.duck/memory.db` | SQLite memory database |
| `~/.duck/sessions/` | Session logs |
| `~/.duck/skills/` | Auto-created skills |

## Environment Variables

### Required
- `MINIMAX_API_KEY` - Primary AI provider

### Optional
- `KIMI_API_KEY` - Moonshot/Kimi provider
- `OPENAI_API_KEY` - OpenAI/Codex
- `OPENROUTER_API_KEY` - OpenRouter fallback
- `LMSTUDIO_URL` - Local LM Studio endpoint
- `LMSTUDIO_KEY` - LM Studio auth key
- `TELEGRAM_BOT_TOKEN` - Telegram integration
- `MESH_ENABLED` - Enable agent mesh
- `SUBCONSCIOUS_ENABLED` - Enable subconscious

### Development
- `DUCK_SOURCE_DIR` - Source directory path
- `DUCK_TRACE` - Enable execution tracing
- `DUCK_DEBUG` - Debug logging
- `NODE_ENV` - development/production

## Services and Ports

| Service | Port | Purpose |
|---------|------|---------|
| MCP Server | 3850 | Tool protocol |
| ACP Server | 18794 | Agent protocol |
| WebSocket | 18796 | Real-time streaming |
| Chat Agent | 18797 | Conversational interface |
| Mesh | 4000 | Agent mesh networking |
| Sub-Conscious | 4001 | Memory daemon |
| KAIROS | - | Proactive heartbeat |

## Next Steps

1. Read [AGENTS.md](AGENTS.md) for architecture details
2. Read [TOOLS.md](TOOLS.md) for available tools
3. Read [SOUL.md](SOUL.md) for personality guidelines
4. Check [HEARTBEAT.md](HEARTBEAT.md) for periodic tasks

## Support

- GitHub Issues: https://github.com/Franzferdinan51/duck-cli/issues
- OpenClaw Discord: https://discord.gg/clawd
