# BOOTSTRAP.md - Duck CLI Initialization Guide

## Quick Start

```bash
# Clone and setup
git clone https://github.com/Franzferdinan51/duck-cli.git
cd duck-cli
npm install
npm run build
go build -o duck ./cmd/duck/

# Configure environment
cp .env.example .env
# Edit .env with your API keys

# Start core services
./duck subconsciousd &  # Start subconscious daemon
./duck mesh start &     # Start agent mesh
./duck telegram start & # Start Telegram bot (optional)

# Verify everything is running
./duck status
./duck health
```

## Environment Variables

### Required
- `MINIMAX_API_KEY` - Primary AI provider
- `TELEGRAM_BOT_TOKEN` - For Telegram integration

### Optional
- `DUCK_GATEWAY_URL` - Custom gateway endpoint
- `MESH_ENABLED` - Enable agent mesh (default: true)
- `SUBCONSCIOUS_ENABLED` - Enable subconscious (default: true)
- `DUCK_MODEL` - Default model (default: qwen3.5-0.8b)
- `DUCK_PROVIDER` - Default provider (default: lmstudio)

## First Run Verification

```bash
# Test basic functionality
./duck run "Hello, are you working?"

# Test web search
./duck run "search the web for OpenClaw"

# Test meta-agent
./duck meta run "create a test file in /tmp"

# Check all systems
./duck health
```

## Troubleshooting

### Subconscious not collecting memories
```bash
./duck subconscious status
./duck subconscious start
```

### Mesh not connecting
```bash
./duck mesh status
./duck mesh start
./duck mesh register
```

### Provider issues
Check `~/.duck/logs/` for detailed error logs.
