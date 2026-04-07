# OpenClaw vs duck-cli Feature Gap Analysis

**Date:** April 7, 2026  
**Purpose:** Identify what OpenClaw has that duck-cli is missing

---

## 🎯 Core Philosophy Difference

| Aspect | OpenClaw | duck-cli |
|--------|----------|----------|
| **Primary Interface** | Multi-channel (Telegram, WhatsApp, Discord, etc.) | CLI + Telegram |
| **Architecture** | Gateway daemon + plugins | Standalone agent with bridge |
| **Session Model** | Persistent, multi-user | Single-user, session-based |
| **Deployment** | Always-on daemon | On-demand execution |

---

## ✅ What duck-cli HAS (that OpenClaw has)

### Core Features
- [x] Telegram integration
- [x] MCP server (port 3850)
- [x] ACP support
- [x] Multi-provider routing (MiniMax, Kimi, LM Studio)
- [x] AI Council deliberation
- [x] Tool registry (40+ tools)
- [x] Android automation
- [x] Web UI
- [x] Skills system

### Advanced Features
- [x] Meta agents (9 internal agents)
- [x] Agent mesh networking
- [x] KAIROS proactive heartbeat
- [x] Sub-conscious whisper system
- [x] Live logger (port 3851)
- [x] Workflow engine
- [x] Swarm coding

---

## ❌ What duck-cli is MISSING (that OpenClaw has)

### 1. Multi-Channel Support
**Priority: HIGH**

OpenClaw supports:
- WhatsApp
- Discord
- Slack
- Google Chat
- Signal
- iMessage
- BlueBubbles
- IRC
- Microsoft Teams
- Matrix
- Feishu
- LINE
- Mattermost
- Nextcloud Talk
- Nostr
- Synology Chat
- Tlon
- Twitch
- Zalo
- WeChat
- WebChat

duck-cli only has:
- Telegram
- CLI
- Web UI

**Gap:** 18+ messaging platforms

---

### 2. Gateway Daemon Architecture
**Priority: HIGH**

OpenClaw:
- Runs as persistent daemon
- Auto-starts with OS
- Manages all connections
- Handles reconnections automatically

duck-cli:
- Runs on-demand
- Manual start required
- No auto-restart on crash

**Gap:** Production-grade daemon management

---

### 3. Session Persistence (Fixed in this update)
**Priority: CRITICAL**

OpenClaw:
- Sessions persist across restarts
- Context never lost
- Multi-user session isolation
- Session recovery on crash

duck-cli (BEFORE):
- Sessions lost on restart
- Context randomly unbinds
- No cross-session memory

**Gap:** (Being fixed with SessionManager + Persistence)

---

### 4. Plugin System
**Priority: MEDIUM**

OpenClaw:
- Rich plugin marketplace
- /plugin command
- Auto-install from GitHub
- Plugin versioning

duck-cli:
- Skills system (similar but different)
- Manual skill installation
- No marketplace integration

**Gap:** Unified plugin marketplace

---

### 5. Onboarding Wizard
**Priority: MEDIUM**

OpenClaw:
- `openclaw onboard` interactive setup
- Step-by-step configuration
- Automatic daemon installation
- Channel pairing wizard

duck-cli:
- Manual setup
- No guided onboarding
- No auto-daemon setup

**Gap:** User-friendly onboarding

---

### 6. Canvas Rendering
**Priority: MEDIUM**

OpenClaw:
- Live Canvas UI
- Generative UI with Pretext
- Real-time visualization
- Interactive elements

duck-cli:
- Web UI (basic)
- No Canvas integration yet

**Gap:** Advanced Canvas rendering

---

### 7. OAuth Integration
**Priority: MEDIUM**

OpenClaw:
- Built-in OAuth flows
- ChatGPT/Codex OAuth
- Secure token management
- Auto-refresh tokens

duck-cli:
- API keys only
- No OAuth flow
- Manual token management

**Gap:** OAuth authentication

---

### 8. Backup/Restore System
**Priority: MEDIUM**

OpenClaw:
- `openclaw backup create`
- Automatic backups
- Cloud sync option
- One-command restore

duck-cli:
- No built-in backup
- Manual file copying

**Gap:** Integrated backup system

---

### 9. Update System
**Priority: LOW**

OpenClaw:
- `openclaw update` command
- Channel switching (stable/beta/dev)
- Automatic updates
- Update notifications

duck-cli:
- Manual git pull
- No update checking

**Gap:** Built-in update mechanism

---

### 10. Health/Doctor System
**Priority: LOW**

OpenClaw:
- `openclaw doctor` diagnostics
- `openclaw health` checks
- Self-healing capabilities
- Detailed diagnostics

duck-cli:
- Basic health check
- Limited diagnostics

**Gap:** Comprehensive health system

---

## 🔄 What's BETTER in duck-cli

| Feature | duck-cli | OpenClaw |
|---------|----------|----------|
| **Meta Agents** | 9 internal agents | None |
| **Agent Mesh** | Full mesh networking | Basic |
| **Swarm Coding** | Game studio mode | None |
| **Android Control** | Full ADB + AI agent | Limited |
| **Live Logger** | Port 3851 streaming | None |
| **KAIROS** | Proactive heartbeat | None |
| **Sub-conscious** | Whisper system | None |
| **Workflow Engine** | Checkpointing | None |
| **Go CLI** | Fast binary | Node.js only |

---

## 📋 Implementation Priority

### Phase 1: Critical (This Week)
1. ✅ Fix session persistence (DONE)
2. Add multi-channel support (WhatsApp, Discord)
3. Gateway daemon mode

### Phase 2: High (Next 2 Weeks)
4. Plugin marketplace integration
5. Onboarding wizard
6. OAuth flows

### Phase 3: Medium (Next Month)
7. Canvas rendering
8. Backup system
9. Auto-updates

### Phase 4: Nice to Have
10. Health/doctor improvements
11. Additional channels

---

## 🎯 Recommendation

**duck-cli should focus on:**
1. **Being the best standalone agent** (not trying to be OpenClaw)
2. **Advanced features** OpenClaw doesn't have (meta agents, swarm coding)
3. **Bridge to OpenClaw** (let OpenClaw handle multi-channel)

**Integration strategy:**
- duck-cli as the "brain"
- OpenClaw as the "nervous system" (channels, daemon)
- Use ACP/MCP to connect them

---

**Last Updated:** April 7, 2026
