# 🦆 Duck Agent Update Strategy & Changelog

> **Duck Agent v0.4.0** — Desktop UI, Sub-Conscious, CopilotKit/Pretext Canvas, OpenClaw v2026.3.31 compat

---

## Version History

| Version | Date | Highlights |
|---------|------|------------|
| **v0.4.0** | 2026-03-31 | Desktop UI RUNNABLE, Sub-Conscious, CopilotKit, Pretext Canvas, AI Council votes |
| **v0.3.2** | 2026-03-31 | Agent Mesh, OpenClaw-RL, 45 councilors, v2026.3.31 compat |
| **v0.3.0** | 2026-03-15 | KAIROS v2, Claude Code tools, unified server, OpenClaw ACP |
| **v0.2.x** | 2026-02-xx | Voice/TTS, Buddy, Teams, Cron |
| **v0.1.x** | 2026-01-xx | Initial release, MCP server |

---

## v0.4.0 — Complete Feature List

**Released: 2026-03-31**

### ✅ REQUIRED Features (Always Available)

#### Core Agent
- [x] **Agent Core** — Reasoning engine, task planner, tool orchestrator
- [x] **Memory System** — 3-tier (identity/config/session) + learned patterns
- [x] **Claude Code Tools** — 60+ tools (read, write, edit, bash, grep, LSP, etc.)
- [x] **Multi-Provider Routing** — MiniMax, Kimi, ChatGPT, LM Studio, Codex
- [x] **Cost Tracking** — Token and cost monitoring per provider

#### AI Systems
- [x] **KAIROS Proactive AI** — Heartbeat, decision engine, auto-dream, modes
- [x] **Sub-Conscious** — Claude-style self-reflection, 5 whisper triggers (v0.4.0 NEW)
- [x] **AI Buddy** — Companion with rarities (common → legendary)
- [x] **Multi-Agent Teams** — Coordinated execution (code-review, research, swarm)

#### Protocols
- [x] **MCP Server** — Full MCP 2024-11-05 spec, port 3850
- [x] **Gateway API** — OpenAI-compatible REST, port 18792
- [x] **ACP Client** — Spawn Codex, Claude, Cursor, Gemini, Pi, OpenClaw
- [x] **ACP Server** — Let OpenClaw connect TO you, port 18794
- [x] **WebSocket Manager** — Bidirectional messaging, port 18796
- [x] **Unified Server** — All protocols in one command (`duck unified`)

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

#### 🖥️ Desktop UI (v0.4.0 — NOW RUNNABLE!)
- [x] **Vite + React 19 + TypeScript** — Dev server on port 5173
- [x] **CopilotKit** — Streaming chat with `@copilotkit/react-core` + `@copilotkit/react-ui`
- [x] **Pretext Canvas Toolkit** — `@chenglou/pretext` for character-level text measurement
- [x] **Tailwind CSS** — Dark theme, responsive layout, screen-fit design
- [x] **Canvas Generative UI** — Metrics, streaming text, particle effects

**Run:**
```bash
cd src/ui/desktop
npm install
npm run dev  # http://localhost:5173
```

**Built:** Chat interface, dashboard with canvas metrics, sidebar navigation, Pretext integration

**Planned:** System tray, mesh visualizer, council panel, notifications, window controls

#### 🎨 Pretext Canvas Toolkit (v0.4.0 NEW)
- [x] **Pretext Server** — Optional HTTP server on port 3458 (measure, lines, shrinkwrap, float)
- [x] **Canvas Generator** — `pretext-generator.js` for animated card generation
- [x] **AI Council Vote Visualization** — Canvas-rendered vote tallies
- [x] **Weather/Crypto Cards** — Animated backgrounds, bouncing icons, particle effects
- [x] **Streaming Chat** — Pre-measured text blocks flowing through canvas
- [x] **Performance:** `prepare()` ~19ms, `layout()` ~0.09ms

#### 🤖 CopilotKit (v0.4.0 NEW)
- [x] **Generative UI** — AI renders custom React components mid-stream
- [x] **Shared State** — Agents and UI share reactive context
- [x] **Human-in-the-Loop** — UI buttons/sliders inject into agent context
- [x] **Streaming Responses** — Real-time AI text streaming into UI

#### 👻 Sub-Conscious (v0.4.0 NEW)
- [x] **5 Rule-Based Whisper Triggers:**
  1. Long task completion → What went well / remember
  2. Repeated errors → Pattern detected — flag for review
  3. User correction → Learning moment — update memory
  4. Multi-provider mix → Efficiency note — optimize routing
  5. Idle too long → Context stale — offer refresh
- [x] **Commands:** `duck subconscious status/enable/disable/stats`
- [x] **Memory Integration:** Writes to SOUL.md, AGENTS.md, MEMORY.md
- [x] **No external dependencies** — Uses Duck Agent's own models

#### 🌐 Agent Mesh (v0.3.2)
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

#### 🧪 OpenClaw-RL (v0.3.2)
- [x] **RL Client** — Connect, enable, disable, stats
- [x] **GRPO Training** — Binary RL (+1/-1/0 rewards)
- [x] **OPD Training** — On-Policy Distillation (token-level hints)
- [x] **PRM Evaluation** — Process Reward Model scoring
- [x] **Background Training** — Async policy updates, no latency
- [x] **Session-Aware** — Unique session ID per conversation thread
- [x] **Turn Classification** — Main turns train, side turns skip
- [x] **KAIROS Integration** — RL feeds on KAIROS insights

**Commands:**
```bash
duck rl status        # Show RL state
duck rl enable       # Turn on training
duck rl disable      # Turn off training
duck rl connect <url> # Connect RL server
duck rl disconnect   # Remove connection
duck rl stats        # Training statistics
```

#### 🏛️ AI Council — 45 Councilors (v0.3.2)
- [x] **45 Specialized Councilors** — Speaker, Technocrat, Ethicist, Skeptic, + 40 more
- [x] **Deliberation Modes** — Legislative, Deep Research, Swarm Coding, Prediction Market, Inquiry, Deliberation
- [x] **LM Studio Integration** — Local model inference
- [x] **Voting System** — Approve/Reject/Abstain with tally
- [x] **Canvas Vote Bars** — Animated approval/rejection bar charts (v0.4.0)
- [x] **Council History** — Searchable past deliberations
- [x] **Summon Specific** — Call individual councilors

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

---

## Changes Since v0.3.2

### v0.4.0 Major Additions

| Addition | Description |
|----------|-------------|
| **Desktop UI** | ✅ NOW RUNNABLE — Vite + React + CopilotKit + Pretext Canvas on port 5173 |
| **Sub-Conscious** | NEW — Claude-style self-reflection with 5 whisper triggers |
| **Pretext Canvas** | NEW — Generative UI toolkit for Canvas rendering |
| **CopilotKit** | NEW — Streaming chat + generative UI in React |
| **AI Council Votes** | NEW — Canvas-rendered vote tally visualization |

### Module Changes (v0.4.0)

| Module | Change |
|--------|--------|
| `src/ui/desktop/` | **MAJOR UPDATE** — Now runnable, CopilotKit, Pretext, Tailwind |
| `src/subconscious/` | **NEW** — Sub-Conscious whisper layer |
| `src/ui/pretext-canvas/` | **NEW** — Pretext Canvas toolkit |
| `src/council/` | **UPDATED** — Canvas vote visualization |
| `docs/` | Updated — DESKTOP-UI.md marked RUNNABLE |

### Documentation Changes (v0.4.0)

| Doc | Change |
|-----|--------|
| `README.md` | **REWRITTEN** — Desktop UI RUNNABLE section, Sub-Conscious, Pretext Canvas, CopilotKit, updated feature table |
| `docs/DESKTOP-UI.md` | **REWRITTEN** — Status changed to ✅ RUNNABLE, tech stack, CopilotKit, Pretext |
| `docs/UPDATES.md` | **REWRITTEN** — v0.4.0 complete feature list, roadmap update |
| `package.json` | **VERSION BUMP** — 0.3.2 → 0.4.0, keywords updated |

---

## v0.5.0 Roadmap

### 🖥️ Desktop UI Enhancements (v0.5.0)
- [ ] System tray integration with quick actions
- [ ] Native window controls (minimize, maximize, close)
- [ ] Mesh network visualizer
- [ ] Council deliberation panel with vote canvas
- [ ] Notification center
- [ ] Auto-start on login
- [ ] Desktop control widget

### 🌐 Agent Mesh Enhancements (v0.5.0)
- [ ] Mesh web UI — Visual agent map
- [ ] Capability discovery — Auto-detect agent skills
- [ ] Mesh relay — Route messages through other agents
- [ ] Mesh persistence — Store messages on mesh server
- [ ] ACL — Access control lists for mesh messages

### 🧪 OpenClaw-RL Enhancements (v0.5.0)
- [ ] Multi-model RL — Train on multiple RL servers simultaneously
- [ ] RL web UI — Training dashboard with real-time charts
- [ ] Reward tuning — Adjust reward signals per conversation type
- [ ] RL export — Export trained model checkpoints
- [ ] OPD enhancements — Token-level hint interface

### 🏛️ AI Council Enhancements (v0.5.0)
- [ ] Council web UI — Visual deliberation interface
- [ ] Custom councilors — Define your own specialist agents
- [ ] Council memory — Remember past deliberations
- [ ] Expert pools — Groups of specialized agents per domain

### 👻 Sub-Conscious Enhancements (v0.5.0)
- [ ] Configurable whisper triggers
- [ ] Memory layer export to vector store
- [ ] Sub-Conscious web UI for reviewing whispers

### 🔧 Core Improvements (ONGOING)
- [ ] Performance — Faster tool execution, lower latency
- [ ] Memory — Improved context management
- [ ] Security — Enhanced SSRF and credential sanitization
- [ ] Documentation — More examples, tutorials, videos

---

## Update Philosophy

Duck Agent pulls features from multiple upstream sources while maintaining its unique identity.

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
| **Pretext** | Text measurement library | Stable |
| **CopilotKit** | Generative UI, streaming chat | Active development |
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

```bash
# 1. Build core
npm run build

# 2. Build desktop UI
cd src/ui/desktop && npm run build

# 3. Test protocols
duck unified &
sleep 3
curl http://localhost:3850/health   # MCP
curl http://localhost:18792/health # Gateway
kill %1

# 4. Test standalone
duck shell "test"

# 5. Test optional features
duck kairos status
duck subconscious status
duck mesh status
duck rl status
duck council list
```

---

## Rollback Procedure

```bash
# 1. Check backup
ls -la ~/.duck-agent/backups/

# 2. Restore
duck update restore

# 3. Manual restore:
cd ~/.duck-agent
git checkout HEAD~1
npm run build
```

---

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for full version history.
