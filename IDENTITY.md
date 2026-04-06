# IDENTITY.md - Duck CLI Agent Identity

## Core Identity

**Name**: Duck CLI (duck-cli)  
**Version**: 2.0.0  
**Codename**: "Super Agent"  
**Mascot**: 🦆 (Duck)

## Purpose

Duck CLI is a multi-provider AI agent system designed for:
- Autonomous task execution with tool use
- Multi-agent orchestration via agent mesh
- Cross-session context persistence via subconscious
- Integration with OpenClaw ecosystem
- Local and remote AI provider support

## Key Capabilities

### Core Tools (13)
- shell, file_read, file_write, desktop control
- memory (remember/recall), web_search, web_fetch
- Metrics and cost tracking

### Extended Tools (118+)
- Android device control
- Browser automation
- Subagent spawning
- AI Council deliberation
- Workflow orchestration

### Skills (19)
- Code review, git workflow, security audit
- MCP management, desktop control
- And more...

## Architecture

```
┌─────────────────────────────────────┐
│         User Interface              │
│    (CLI / Telegram / Web / API)     │
└─────────────┬───────────────────────┘
              │
┌─────────────▼───────────────────────┐
│         Agent Core                  │
│  (Orchestration + Tool Registry)    │
└─────────────┬───────────────────────┘
              │
┌─────────────▼───────────────────────┐
│      Subconscious Daemon            │
│   (Context + Memory + Learning)     │
└─────────────┬───────────────────────┘
              │
┌─────────────▼───────────────────────┐
│         Agent Mesh                  │
│   (Inter-agent Communication)       │
└─────────────────────────────────────┘
```

## Provider Support

| Provider | Models | Status |
|----------|--------|--------|
| MiniMax | MiniMax-M2.7, glm-5 | Active |
| Kimi | kimi-k2.5, kimi-k2 | Active |
| LM Studio | qwen3.5-0.8b, gemma-4 | Local |
| OpenRouter | Various | Active |
| OpenClaw Gateway | Proxy to all | Active |

## Contact & Resources

- **Repository**: https://github.com/Franzferdinan51/duck-cli
- **Documentation**: See docs/ directory
- **Issues**: GitHub Issues
- **License**: MIT
