# 🦆 Duck Agent — Installation Guide

## Prerequisites

| Dependency | Version | Notes |
|------------|---------|-------|
| **Node.js** | 20+ | TypeScript runtime |
| **Go** | 1.21+ | CLI wrapper |
| **Git** | any | Clone repo |
| **npm** | 10+ | Install deps |

## Install (5 minutes)

```bash
# 1. Clone
git clone https://github.com/Franzferdinan51/duck-cli.git
cd duck-cli

# 2. Install + build
npm install
npm run build          # TypeScript → dist/ + copies skills
go build -o duck ./cmd/duck/

# 3. Install binary
cp duck ~/.local/bin/duck
cp -r dist/* ~/.local/bin/dist/

# 4. Configure API keys
duck setup            # interactive wizard

# 5. Test
duck doctor           # should show all green
duck status           # providers, skills, tools
```

## Providers

Duck Agent supports multiple AI providers. Set up at least one:

```bash
# MiniMax (recommended default)
# Get key at: https://platform.minimax.io
MINIMAX_API_KEY=sk-cp-...

# OpenRouter (free tier available)
# Get key at: https://openrouter.ai
OPENROUTOR_API_KEY=sk-or-v1-...

# Kimi direct
# Get key at: https://platform.moonshot.cn
KIMI_API_KEY=sk-kimi-...
```

Keys are saved to `~/.duck/.env` by `duck setup`.

## Usage

```bash
# Standalone (for humans)
duck                  # interactive chat shell
duck setup            # configure keys
duck help             # all commands

# As tool (for AI agents)
duck run "fix the auth bug"
duck council "PostgreSQL or MongoDB?"
duck status
```

## Uninstall

```bash
rm ~/.local/bin/duck
rm -rf ~/.local/bin/dist/
rm -rf ~/.duck/        # removes config + memory
```
