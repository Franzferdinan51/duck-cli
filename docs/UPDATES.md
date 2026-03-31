# 🦆 Duck Agent Update Strategy & Changelog

> **Duck Agent v0.3.2** — Agent Mesh, OpenClaw-RL, 45-Agent Council, OpenClaw v2026.3.31

---

## Version History

| Version | Date | Highlights |
|---------|------|------------|
| **v0.3.2** | 2026-03-31 | Agent Mesh, OpenClaw-RL, 45 councilors, v2026.3.31 compat |
| **v0.3.0** | 2026-03-15 | KAIROS v2, Claude Code tools, unified server, OpenClaw ACP |
| **v0.2.x** | 2026-02-xx | Voice/TTS, Buddy, Teams, Cron |
| **v0.1.x** | 2026-01-xx | Initial release, MCP server |

---

## v0.3.2 — Complete Feature List

**Released: 2026-03-31**

### ✅ REQUIRED Features (Always Available)

These are built-in and always operational — no setup required.

#### Core Agent
- [x] **Agent Core** — Reasoning engine, task planner, tool orchestrator
- [x] **Memory System** — 3-tier (identity/config/session) + learned patterns
- [x] **Claude Code Tools** — 60+ tools (read, write, edit, bash, grep, LSP, etc.)
- [x] **Multi-Provider Routing** — MiniMax, Kimi, ChatGPT, LM Studio, Codex
- [x] **Cost Tracking** — Token and cost monitoring per provider

#### Protocols
- [x] **MCP Server** — Full MCP 2024-11-05 spec, port 3850
- [x] **Gateway API** — OpenAI-compatible REST, port 18792
- [x] **ACP Client** — Spawn Codex, Claude, Cursor, Gemini, Pi, OpenClaw
- [x] **ACP Server** — Let OpenClaw connect TO you, port 18794
- [x] **WebSocket Manager** — Bidirectional messaging, port 18796
- [x] **Unified Server** — All protocols in one command (`duck unified`)

#### AI Systems
- [x] **KAIROS Proactive AI** — Heartbeat, decision engine, auto-dream, modes
- [x] **AI Buddy** — Companion with rarities (common → legendary)
- [x] **Multi-Agent Teams** — Coordinated execution (code-review, research, swarm)

#### Automation & Integration
- [x] **Cron Scheduler** — 30+ predefined jobs (system, grow, crypto, OSINT, weather)
- [x] **Channels** — Telegram and Discord integration
- [x] **Desktop Control** — Native macOS/Windows via ClawdCursor
- [x] **BrowserOS Integration** — 45+ browser automation tools

#### Voice / TTS
- [x] **MiniMax TTS** — Text-to-speech, 4,000 chars/day, multiple voices
- [x] **Auto-play** — Plays on macOS automatically

#### Security
- [x] **SSRF Validation** — Blocks private IPs, DNS rebinding
- [x] **Credential Sanitizer** — Prevents API key leaks
- [x] **State Manager** — Encrypted persistent state
- [x] **Network Policies** — YAML-based access control

#### Update System
- [x] **Multi-Source Updates** — Pulls from OpenClaw, Claude Code, Hermes, NemoClaw, Codex CLI
- [x] **Backup & Restore** — Automatic backups before updates
- [x] **Version Strategy** — `DUCK_MAJOR.OPENCLAW_COMPAT.DATE` hybrid versioning

#### Web UI
- [x] **Full Web Interface** — SvelteKit app at `http://localhost:3001`
- [x] **Dashboard** — Uptime, cost, tokens, providers
- [x] **KAIROS Panel** — Toggle, modes, action logs
- [x] **Buddy Panel** — Hatch, reroll, stats
- [x] **Teams Panel** — Templates, member cards
- [x] **Council Panel** — Deliberation, councilors, output
- [x] **Cron Panel** — Job scheduler, enable/disable
- [x] **Memory Panel** — Recent memories viewer
- [x] **Settings** — Provider config, theme
- [x] **Logs Viewer** — Activity viewer

---

### 🎁 OPTIONAL Features (Enable When Needed)

These require extra setup and are **disabled by default**.

#### 🌐 Agent Mesh (v0.3.2 NEW)
- [x] **Mesh Client** — Register, list, send, broadcast, inbox
- [x] **Capability Registry** — Maps skills to agents
- [x] **Catastrophe Tracker** — Active event monitoring
- [x] **Health Dashboard** — Ping mesh server status
- [x] **Requires:** `npm start` in `/Users/duckets/Desktop/agent-mesh-api`

**Commands:**
```bash
duck mesh register           # Join mesh
duck mesh list              # Discover agents
duck mesh send <id> <msg>   # Send message
duck mesh broadcast <msg>   # Broadcast
duck mesh inbox             # Check inbox
duck mesh capabilities      # Map skills
duck mesh catastrophe       # Check events
duck mesh status            # Ping server
```

#### 🧪 OpenClaw-RL (v0.3.2 NEW)
- [x] **RL Client** — Connect, enable, disable, stats
- [x] **GRPO Training** — Binary RL (+1/-1/0 rewards)
- [x] **OPD Training** — On-Policy Distillation (token-level hints)
- [x] **PRM Evaluation** — Process Reward Model scoring
- [x] **Background Training** — Async policy updates, no latency
- [x] **Session-Aware** — Unique session ID per conversation thread
- [x] **Turn Classification** — Main turns train, side turns skip
- [x] **KAIROS Integration** — RL feeds on KAIROS insights
- [x] **Requires:** OpenClaw-RL server running (`bash run_qwen3_4b_openclaw_rl.sh`)

**Commands:**
```bash
duck rl status        # Show RL state
duck rl enable       # Turn on training
duck rl disable      # Turn off training
duck rl connect <url> # Connect RL server
duck rl disconnect   # Remove connection
duck rl stats        # Training statistics
```

#### 🏛️ AI Council — 45 Councilors (v0.3.2 NEW)
- [x] **45 Specialized Councilors** — Speaker, Technocrat, Ethicist, Skeptic, + 40 more
- [x] **Deliberation Modes** — Legislative, Deep Research, Swarm Coding, Prediction Market, Inquiry, Deliberation
- [x] **LM Studio Integration** — Local model inference
- [x] **Voting System** — Approve/Reject/Abstain with tally
- [x] **Council History** — Searchable past deliberations
- [x] **Summon Specific** — Call individual councilors
- [x] **Requires:** Council server + LM Studio models configured

**Commands:**
```bash
duck council "Should we refactor?"      # Ask council
duck council list                        # List 45 councilors
duck council summon Technocrat           # Summon specific
duck council mode research               # Set mode
duck council members                     # Active participants
duck council vote approve                # Cast vote
duck council history                    # Past deliberations
```

#### 🖥️ Desktop UI (v0.4.0 — PLANNED)
- [x] **Design Complete** — See [DESKTOP-UI.md](DESKTOP-UI.md)
- [ ] **Not yet built** — Coming in v0.4.0

---

## Changes Since v0.3.0

### Protocol Changes
| Change | Description |
|--------|-------------|
| **Agent Mesh** | NEW — Inter-agent communication network on port 4000 |
| **OpenClaw-RL** | NEW — RL client connecting to port 30000 |
| **45 Councilors** | NEW — Expanded from 6 to 45 specialized councilors |
| **OpenClaw compat** | NEW — `src/compat/v2026_3_31/` layer for v2026.3.31 compatibility |
| **ACP enhancements** | Improved session management, max 8 concurrent sessions |
| **Mesh commands** | NEW — `duck mesh register/list/send/broadcast/inbox/capabilities/catastrophe/status` |
| **RL commands** | NEW — `duck rl connect/enable/disable/stats/disconnect/status` |
| **Council expansion** | NEW — `duck council list/summon/mode/members/vote/history` |

### Module Changes
| Module | Change |
|--------|--------|
| `src/mesh/` | NEW — Complete mesh networking client |
| `src/rl/` | NEW — OpenClaw-RL client and trainer |
| `src/council/` | NEW — 45 councilors with LM Studio integration |
| `src/compat/` | NEW — OpenClaw v2026.3.31 compatibility layer |
| `src/ui/desktop/` | NEW — Desktop UI source (for v0.4.0) |
| `src/commands/mesh.ts` | NEW — CLI mesh commands |
| `src/commands/rl.ts` | NEW — CLI RL commands |
| `src/commands/council.ts` | ENHANCED — Expanded with 45 councilors |

### Documentation Changes
| Doc | Change |
|-----|--------|
| `README.md` | REWRITTEN — REQUIRED vs OPTIONAL separation, mesh examples, RL examples, 45 councilors |
| `COMMANDS.md` | REWRITTEN — Full mesh, RL, council command documentation |
| `ARCHITECTURE.md` | REWRITTEN — New module structure, compat layer, data flow diagrams |
| `UPDATES.md` | REWRITTEN — Complete v0.3.2 feature list, v0.4.0 roadmap |
| `DESKTOP-UI.md` | NEW — Desktop UI design preview |

### Feature Enhancements
| Feature | v0.3.0 | v0.3.2 |
|---------|--------|--------|
| AI Council | 6 councilors | **45 councilors** |
| Mesh | Not available | **Full mesh networking** |
| RL Training | Not available | **OpenClaw-RL integration** |
| OpenClaw compat | v2026.2.x | **v2026.3.31** |
| Council modes | Basic deliberation | **6 modes** |
| Mesh tools | None | **8 commands** |
| RL tools | None | **6 commands** |

---

## v0.4.0 Roadmap

**Target: TBD**

### 🖥️ Desktop UI (PRIORITY 1)

Native desktop application built from `src/ui/desktop/`. See full design in [DESKTOP-UI.md](DESKTOP-UI.md).

**Components:**
- [ ] `main.ts` — Desktop entry point, window management
- [ ] `tray.ts` — System tray with quick actions
- [ ] `dashboard.ts` — Real-time agent stats (CPU, RAM, tokens)
- [ ] `chat.ts` — Live chat interface
- [ ] `mesh-view.ts` — Visual mesh network graph
- [ ] `council-panel.ts` — Council deliberation UI
- [ ] `notifications.ts` — System notification center

**Features:**
- [ ] Native window with system tray
- [ ] Real-time agent dashboard
- [ ] Live chat interface
- [ ] Mesh network visualizer
- [ ] Council deliberation panel
- [ ] Desktop control widget
- [ ] Notification center
- [ ] Auto-start on login

**Tech Stack:**
- Electron or Tauri (TBD)
- Pretext + Canvas for generative UI
- System tray integration

---

### 🌐 Agent Mesh Enhancements (PRIORITY 2)
- [ ] Mesh web UI — Visual agent map
- [ ] Capability discovery — Auto-detect agent skills
- [ ] Mesh relay — Route messages through other agents
- [ ] Mesh persistence — Store messages on mesh server
- [ ] ACL — Access control lists for mesh messages

### 🧪 OpenClaw-RL Enhancements (PRIORITY 2)
- [ ] Multi-model RL — Train on multiple RL servers simultaneously
- [ ] RL web UI — Training dashboard with real-time charts
- [ ] Reward tuning — Adjust reward signals per conversation type
- [ ] RL export — Export trained model checkpoints
- [ ] OPD enhancements — Token-level hint interface

### 🏛️ AI Council Enhancements (PRIORITY 3)
- [ ] Council web UI — Visual deliberation interface
- [ ] Custom councilors — Define your own specialist agents
- [ ] Council memory — Remember past deliberations
- [ ] Council voting dashboard — Real-time vote tallies
- [ ] Expert pools — Groups of specialized agents per domain

### 🔧 Core Improvements (ONGOING)
- [ ] Performance — Faster tool execution, lower latency
- [ ] Memory — Improved context management
- [ ] Security — Enhanced SSRF and credential sanitization
- [ ] Documentation — More examples, tutorials, videos

---

## Update Philosophy

Duck Agent pulls features from multiple upstream sources while maintaining its unique identity:

### Upstream Sources

| Source | What We Pull | Update Frequency |
|--------|--------------|------------------|
| **OpenClaw** | Gateway protocol, channels, skills, compat/v2026.3.31 | Weekly |
| **Claude Code** | KAIROS, buddy, multi-agent patterns | As needed |
| **Hermes-Agent** | Gateway patterns, FTS5 search | Monthly |
| **NemoClaw** | Security (SSRF, credentials) | Security patches |
| **Codex CLI** | MCP server, exec mode | Updates |
| **DroidClaw** | Phone control, workflow | As needed |
| **OpenCrabs** | Local voice, hybrid memory | As needed |
| **TrinityClaw** | ChromaDB, identity system | As needed |
| **FlowlyAI** | @mention routing, skills hub | As needed |
| **OpenClaw-RL** | Reinforcement learning self-improvement | Active development |
| **agent-mesh-api** | Agent mesh networking | Active development |

---

## OpenClaw Compatibility

Duck Agent is designed to be **compatible but not dependent** on OpenClaw.

### Safe to Pull
- Bug fixes
- New tool types (additive)
- Performance improvements
- Security patches
- New skill templates

### Requires Shim Layer
- Changed tool argument schemas
- Modified agent lifecycle
- WebSocket format changes
- New required config fields

### Never Pull
- Core identity changes
- Multi-agent coordination protocol changes
- System prompt injection points

---

## Version Strategy

Duck Agent uses a hybrid versioning approach:

```
DUCK_MAJOR.OPENCLAW_COMPAT.DATE
     │           │           │
     │           │           └── Last OpenClaw sync date
     │           └── OpenClaw compatibility level
     └── Duck Agent major version
```

**Rules:**
- New Duck features → increment major
- OpenClaw change with shim fix → increment compat
- OpenClaw patch (no shim needed) → update date only

---

## Testing After Update

Always run after updating:

```bash
# 1. Build
npm run build

# 2. Test protocols
duck unified &
sleep 3
curl http://localhost:3850/health   # MCP
curl http://localhost:18792/health  # Gateway
kill %1

# 3. Test standalone
duck shell "test"        # Quick TTY test
duck web                 # Web UI test

# 4. Test optional features (if enabled)
duck mesh status         # Mesh
duck rl status           # RL
duck council list        # Council
```

---

## Rollback Procedure

If update breaks something:

```bash
# 1. Check backup
ls -la ~/.duck-agent/backups/

# 2. Restore
duck update restore

# 3. If that fails, manual restore:
cd ~/.duck-agent
git checkout HEAD~1
npm run build
```

---

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for full version history.
