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
bash tools/install-pc.sh

# 3. Test
~/.local/bin/duck status

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

Keys/settings can also live in project `.env` (useful for phone + PC installs):

```bash
LMSTUDIO_URL=http://localhost:1234
LMSTUDIO_KEY=your_lmstudio_api_key_here
LMSTUDIO_MODELS=gemma-4-e4b-it
OPENCLAW_GATEWAY=ws://localhost:18789
OPENCLAW_GATEWAY_HTTP=http://localhost:18789
```

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

## Termux / Android

```bash
pkg update && pkg upgrade
pkg install -y nodejs git

git clone https://github.com/Franzferdinan51/duck-cli.git ~/duck-cli
cd ~/duck-cli
bash tools/install-termux.sh

# configure ~/duck-cli/.env, then:
source ~/.bashrc
duck run "Say hi"
```

## Uninstall

```bash
rm ~/.local/bin/duck
rm -rf ~/.local/bin/dist/
rm -rf ~/.duck/        # removes config + memory
```
