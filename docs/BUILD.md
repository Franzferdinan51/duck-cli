# Building Duck CLI from Source

> No npm registry - build from source only

## Prerequisites

```bash
# Node.js 20+
node --version  # Must be 20+

# Bun (faster builds) OR npm
bun --version   # Recommended
# OR
npm install -g npm@latest
```

## Quick Build

```bash
git clone https://github.com/Franzferdinan51/duck-cli.git
cd duck-cli
npm install  # or: bun install
npm run build  # or: bun run build
```

## Build Commands

```bash
# Install dependencies
bun install

# TypeScript compilation
bun run build

# Or with npm
npm install
npm run build
```

## Link Globally

```bash
# After build
npm link

# Or with bun
bun link

# Then use anywhere
duck run "fix auth bug"
duck -i
```

## Environment Setup

```bash
# Required for AI providers
export ANTHROPIC_API_KEY=sk-ant-...

# Optional providers
export OPENAI_API_KEY=sk-...
export MINIMAX_API_KEY=...
export MOONSHOT_API_KEY=...
export GEMINI_API_KEY=...

# Optional channels (use OpenClaw gateway instead of direct polling)
export TELEGRAM_BOT_TOKEN=...  # Prefer OpenClaw gateway
export DISCORD_BOT_TOKEN=...    # Prefer OpenClaw gateway
```

## OpenClaw Gateway Integration (RECOMMENDED)

**DON'T poll Telegram/Discord directly from Duck CLI** - OpenClaw already handles channels.

Duck CLI connects to OpenClaw gateway as an ACP client:

```bash
export OPENCLAW_GATEWAY=ws://localhost:18792
export OPENCLAW_TOKEN=your_token

duck run "task via OpenClaw gateway"
```

This avoids:
- Bot token conflicts
- getUpdates() polling conflicts  
- Duplicate message handling
- Channel state corruption

## OpenClaw Gateway Setup

OpenClaw handles Telegram/Discord natively:

```bash
# OpenClaw config at ~/.openclaw/openclaw.json
{
  "channels": {
    "telegram": {
      "enabled": true,
      "botToken": "YOUR_BOT_TOKEN"
    },
    "discord": {
      "enabled": true,
      "token": "YOUR_DISCORD_TOKEN"
    }
  }
}
```

## Architecture

```
┌─────────────────────────────────────────┐
│         OpenClaw Gateway (handles channels)│
│  Telegram, Discord, Signal, WhatsApp     │
│  Polling, message routing, sessions       │
└───────────────┬─────────────────────────┘
                │
                │ ACP protocol (ws://)
                ▼
┌─────────────────────────────────────────┐
│           Duck CLI (builds from source)   │
│  Code editing, tools, skills, memory      │
│  NO direct channel polling               │
└─────────────────────────────────────────┘
```

## Troubleshooting

### "getUpdates conflict" errors
→ Multiple processes polling same bot token
→ Use OpenClaw gateway for channels instead

### "token invalid"
→ Bot token not set or expired
→ Generate new token via @BotFather

### Build errors
```bash
rm -rf node_modules bun.lockb
bun install
bun run build
```

## Files

```
duck-cli/
├── src/              # Source code
├── internal/          # Core modules
├── built/            # Build output
├── package.json
├── tsconfig.json
└── README.md
```

## Git

```bash
git clone https://github.com/Franzferdinan51/duck-cli.git
cd duck-cli
git remote add upstream https://github.com/openclaw/duck-cli.git  # If forked from upstream
```
