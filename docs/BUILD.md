# Building Duck CLI from Source

## Prerequisites

| Dependency | Version | Notes |
|------------|---------|-------|
| **Node.js** | 20+ | Runtime for TypeScript agent |
| **Go** | 1.21+ | CLI wrapper binary |
| **Git** | any | Clone repo |
| **npm** | 10+ | Install dependencies |

## Build

```bash
git clone https://github.com/Franzferdinan51/duck-cli.git
cd duck-cli
npm install
npm run build          # tsc + copies skills to dist/
go build -o duck ./cmd/duck/
```

## Install

```bash
# Binary
cp duck ~/.local/bin/duck

# Runtime (TypeScript + skills — both required!)
cp -r dist/* ~/.local/bin/dist/
```

That's it. The Go binary reads `dist/` from its own directory at runtime.

## Verify

```bash
~/.local/bin/duck --version    # 0.4.0
~/.local/bin/duck doctor        # All systems operational
~/.local/bin/duck status       # Providers, skills, tools
~/.local/bin/duck skills list  # 10 local skills
```

## Build+Reinstall (one liner)

```bash
npm run build && go build -o duck ./cmd/duck/ && cp duck ~/.local/bin/duck && cp -r dist/* ~/.local/bin/dist/
```

## Uninstall

```bash
rm ~/.local/bin/duck
rm -rf ~/.local/bin/dist/
rm -rf ~/.duck/           # user data (optional)
```

## Key Paths

| Path | What it is |
|------|-----------|
| `~/.local/bin/duck` | Go binary (command you run) |
| `~/.local/bin/dist/` | TypeScript compiled + skills |
| `~/.duck/.env` | API keys (created by `duck setup`) |
| `~/.duck/memory/` | SQLite session DB |

## API Keys

```bash
# Interactive setup (creates ~/.duck/.env)
duck setup

# Or create ~/.duck/.env manually:
MINIMAX_API_KEY=sk-cp-...
OPENROUTER_API_KEY=sk-or-v1-...
KIMI_API_KEY=sk-kimi-...
DUCK_PROVIDER=minimax
```

## Architecture

```
~/.local/bin/duck          ← Go binary
~/.local/bin/dist/
├── cli/main.js            ← TypeScript CLI entry
├── agent/                 ← Agent core
├── council/               ← AI Council deliberation
├── server/                ← MCP server
├── providers/             ← Model routing
├── skills/                ← 10 local skills
├── voice/                 ← Voice wake + talk
├── canvas/                ← Live Canvas renderer
└── security/              ← Skill scanner + Docker sandbox
~/.duck/                   ← User data (created at runtime)
```
