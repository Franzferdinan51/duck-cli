# 🦆 Duck Agent System

> **A complete AI agent system** - standalone agent + MCP server + Telegram/Discord channels.
> 
> Inspired by OpenClaw, Hermes-Agent, Claude Code, and DuckBot-OS.

---

## ⚡ Quick Start

```bash
# Build
npm install && npm run build

# Interactive TUI shell
node dist/cli/main.js shell

# Run single task
node dist/cli/main.js run "say hello"

# Think about something
node dist/cli/main.js think "Why is the sky blue"

# Start with Telegram/Discord
node dist/cli/main.js channels
```

---

## 🎯 Three Modes in One

### 1️⃣ Standalone Agent
```bash
# Interactive shell
node dist/cli/main.js shell

# Single task
node dist/cli/main.js run "open Safari"

# Reasoning
node dist/cli/main.js think "Should I learn Rust or Go?"
```

### 2️⃣ MCP Server (for OpenClaw)
```bash
# Start MCP server
node dist/cli/main.js mcp 3848

# OpenClaw connects via:
POST http://localhost:3848/mcp
```

### 3️⃣ Telegram/Discord Bot
```bash
# Create channels.json with your bot tokens
node dist/cli/main.js channels

# Send message directly
node dist/cli/main.js send telegram 123456789 "Hello!"
```

---

## ✅ Verified Working (v0.3)

| Component | Status | Details |
|-----------|--------|---------|
| **Core Agent** | ✅ Working | Multi-turn conversation |
| **TUI Shell** | ✅ Working | Interactive mode |
| **MiniMax AI** | ✅ Working | Reasoning + responses |
| **Memory System** | ✅ Working | Persistent SOUL + facts |
| **Learning** | ✅ Working | Pattern learning |
| **Cost Tracking** | ✅ Working | 15+ model pricing |
| **Skills** | ✅ Working | 10 loaded |
| **Tools** | ✅ Working | 13 tools |
| **MCP Server** | ✅ Working | JSON-RPC protocol |
| **Telegram** | ✅ Ready | Polling bot |
| **Discord** | ✅ Ready | Slash commands |
| **Desktop Control** | ✅ Ready | ClawdCursor |

---

## 🤖 AI Providers

**Current:** MiniMax-M2.5 (API key: `sk-cp-f6PbhZ...`)

Set environment variables:

```bash
export MINIMAX_API_KEY="your-key"
export ANTHROPIC_API_KEY="sk-ant-..."
export OPENAI_API_KEY="sk-..."
export LMSTUDIO_URL="http://localhost:1234"
```

---

## 💰 Cost Tracking

Duck Agent tracks costs with 15+ models:

| Provider | Model | Input/1K | Output/1K |
|----------|-------|----------|------------|
| MiniMax | MiniMax-M2.5 | $0.50 | $0.50 |
| OpenAI | gpt-4o | $2.50 | $10.00 |
| Anthropic | claude-3.5-sonnet | $3.00 | $15.00 |
| LM Studio | local | FREE | FREE |

```bash
# Check cost
duck tools | grep cost

# Get detailed summary
duck status | grep cost
```

---

## 📦 Skills (10 loaded)

| Skill | Purpose |
|-------|---------|
| `desktop-control-lobster` | AI drawing, automation |
| `desktop-control` | AI Agent automation |
| `clawd-cursor` | REST API desktop control |
| `computer-use` | Vision-based UI automation |
| `claude-code-mastery` | Employee-grade overrides |
| `code-review` | Automated code review |
| `context-memory` | Semantic memory |
| `security-audit` | Vulnerability scanning |
| `git-workflow` | Smart git operations |
| `mcp-manager` | MCP server management |

---

## 🔧 Tools (13 available)

| Tool | Purpose | Danger |
|------|---------|--------|
| `desktop_open` | Open applications | - |
| `desktop_click` | Click coordinates | - |
| `desktop_type` | Type text | - |
| `desktop_screenshot` | Take screenshot | - |
| `memory_remember` | Save memory | - |
| `memory_recall` | Search memory | - |
| `shell` | Execute command | ⚠️ |
| `file_read` | Read files | - |
| `file_write` | Write files | ⚠️ |
| `web_search` | Search web | - |
| `learn_from_feedback` | Learn from feedback | - |
| `get_metrics` | Performance metrics | - |
| `get_cost` | Cost tracking | - |

---

## 🖥️ Desktop Control

Requires ClawdCursor:
```bash
cd ~/.openclaw/workspace/clawd-cursor
nohup npx clawdcursor start > /tmp/clawdcursor.log 2>&1 &
```

Commands:
```bash
duck desktop open Calculator
duck desktop click 100 200
duck desktop type "Hello"
duck desktop screenshot
```

---

## 📱 Telegram/Discord Integration

### Setup

1. **Telegram:** Create bot via @BotFather, get token
2. **Discord:** Create app at discord.com/developers, add bot

### Config (`channels.json`)
```json
{
  "telegram": {
    "botToken": "123456:ABC-DEF...",
    "allowedUsers": [123456789]
  },
  "discord": {
    "botToken": "abc.def.ghi...",
    "applicationId": "123456789012345678",
    "allowedRoles": ["Admin", "DuckBot User"]
  }
}
```

### Discord Slash Commands
- `/chat <message>` - Chat with Duck Agent
- `/think <question>` - Reasoning mode
- `/status` - Bot status

---

## 🧠 Memory System

```bash
# Remember something
duck remember "API docs are in /docs"

# Search memory
duck recall "API docs"

# Or in shell:
/remember User prefers dark mode
/recall dark mode
```

---

## 💬 Shell Commands

```bash
duck shell

# Inside shell:
/help           Show help
/status         Show agent status
/tools           List available tools
/history        Show conversation history
/clear          Clear history
/think <text>  Think about something
/remember <text> Remember something
/recall <query> Search memory
/quit           Exit
```

---

## 📡 MCP Server

```bash
# Start on default port 3848
duck mcp

# Start on custom port
duck mcp 4000

# Endpoints:
POST /mcp     - JSON-RPC
GET  /sse     - Server-Sent Events
GET  /tools   - List tools
GET  /health  - Health check
```

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Duck Agent v0.3                          │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐  │
│  │              Agent Core                              │  │
│  │   Think → Reason → Plan → Execute → Learn            │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │ Providers │ │  Memory  │ │  Tools   │ │  Skills  │   │
│  │ MiniMax   │ │ SOUL+SQL │ │ 13 tools │ │ 10 loaded│   │
│  │ LM Studio │ │ Learning │ │ Dangerous│ │ Registry │   │
│  │ OpenAI    │ │ Patterns │ │ Approvals│ │ Fallback│   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  Modes                                                  │  │
│  │  🖥️ Standalone  📡 MCP  📱 Telegram/Discord         │  │
│  └─────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 📁 Project Structure

```
duck-cli/
├── src/
│   ├── agent/
│   │   ├── core.ts          # Main agent logic
│   │   └── cost-tracker.ts # Cost tracking
│   ├── providers/
│   │   └── manager.ts      # AI providers (MiniMax, LM Studio, etc)
│   ├── memory/
│   │   └── system.ts       # SOUL + persistent memory
│   ├── tools/
│   │   └── registry.ts     # Tool registry + approvals
│   ├── skills/
│   │   └── runner.ts       # Skill loader
│   ├── channels/
│   │   ├── telegram.ts     # Telegram bot
│   │   ├── discord.ts      # Discord bot
│   │   └── manager.ts      # Channel coordinator
│   ├── integrations/
│   │   └── desktop.ts     # ClawdCursor
│   ├── server/
│   │   └── mcp-server.ts  # MCP server
│   └── cli/
│       └── main.ts         # CLI/TUI
├── skills/                  # 10 loaded skills
├── channels.json.example    # Channel config template
└── dist/                   # Built output
```

---

## 🔗 Features from Source Projects

| Feature | Source |
|---------|--------|
| Agent architecture | OpenClaw, Hermes-Agent |
| Tool registry | Hermes-Agent |
| Cost tracking | DuckBot-OS |
| Provider fallback | DuckBot-OS |
| Learning system | DuckBot-OS |
| Telegram integration | DuckBot-OS |
| Discord integration | DuckBot-OS |
| Desktop control | ClawdCursor |
| Skills framework | OpenClaw |

---

## 📊 Metrics Tracked

- Total interactions
- Success/failure rate
- Cost per provider/model
- Token usage
- Learned patterns
- Cost budget remaining

---

## 🔗 GitHub

```
https://github.com/Franzferdinan51/duck-cli
```

---

**🦆 v0.3.0** - Built for Ryan (Duckets)
**Inspired by:** OpenClaw, Hermes-Agent, Claude Code, DuckBot-OS
## 🌐 BrowserOS Integration

Duck Agent can connect to [BrowserOS](https://github.com/browseros-ai/BrowserOS) for 45+ browser automation tools!

### What is BrowserOS?
- **Privacy-first AI browser** built on Chromium
- **53+ automation tools** - navigate, click, type, extract data
- **MCP Server** - Control browser from any MCP client
- **Local models** - Run AI locally via Ollama/LM Studio

### Setup

1. **Download BrowserOS:** https://files.browseros.com
2. **Start BrowserOS** and note the port (default 9100)
3. **Set environment:**
```bash
export BROWSEROS_HOST=127.0.0.1
export BROWSEROS_PORT=9100
```

### BrowserOS Tools (45+)

| Category | Tools |
|----------|-------|
| **Navigation** | list_pages, get_active_page, navigate, new_page, close_page, show_page |
| **Observation** | take_snapshot, take_enhanced_snapshot, get_page_content, get_page_links, search_dom, take_screenshot, evaluate_script |
| **Input** | click, click_at, hover, type, fill, press_key, scroll, clear, check, uncheck, select_option |
| **Page Actions** | save_pdf, save_screenshot, download_file |
| **Bookmarks** | get_bookmarks, create_bookmark, remove_bookmark, search_bookmarks |
| **History** | get_recent_history, search_history, delete_history_url |
| **Windows** | list_windows, create_window, close_window |
| **Tab Groups** | list_tab_groups, group_tabs, ungroup_tabs |

### Usage Example

```typescript
const browserOS = provider.getBrowserOS();
if (browserOS) {
  // Navigate to a page
  await browserOS.navigate('https://example.com');
  
  // Take screenshot
  const { screenshot } = await browserOS.takeScreenshot();
  
  // Extract content
  const { content } = await browserOS.getPageContent();
}
```

