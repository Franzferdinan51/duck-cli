# 🦆 Duck Agent Changelog

All notable changes to Duck Agent will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [v2.0.0] — 2026-04-06

### Added
- **🦸 Super Agent** — Complete v3 rewrite positioning duck-cli as rival to Claude Code, Letta Code, OpenAI Codex
- **Chat Agent** — Conversational HTTP layer (port 18797) with multi-provider support (MiniMax/LM Studio/Kimi/OpenAI/OpenRouter)
- **AI Council Bridge** — Deliberation BEFORE execution for complex/ethical/high-stakes tasks
- **Agent Mesh Integration** — Inter-agent communication bus (port 4000) with registration, messaging, WebSocket
- **3 Meta Agents** — Bridge Agent, Orchestrator, Subconscious all documented and integrated
- **Multi-provider Chat** — Switch models at runtime via env vars or HTTP headers
- **Pluggable Memory** — SQLite-backed persistent storage (Letta can be added later)

### Changed
- **README.md** — Complete rewrite with Super Agent tagline, v3 architecture diagram, all commands documented
- **docs/ARCHITECTURE.md** — Full v2.0.0 architecture with all agents, flows, protocols
- **docs/COUNCIL-INTEGRATION.md** — Updated to v2.0.0
- **docs/ORCHESTRATOR.md** — Renamed to Meta-Agent Orchestrator v3
- **Version** — All docs updated from v0.x to v2.0.0

### Architecture
- User → Chat Agent → AI Council → Bridge Agent → Orchestrator → Tools
- Chat Agent: conversational layer, session memory, multi-provider
- AI Council: Speaker + Technocrat + Ethicist + Sentinel + Pragmatist
- Bridge Agent: connection health, routing, protocol negotiation
- Orchestrator: Plan→Critic→Healer→Learner loop
- Subconscious: whisper monitoring, pattern matching
- Agent Mesh: optional inter-agent communication

---

## [v0.6.1] — 2026-04-04

### Added
- **Hybrid Orchestrator v2** — Complete rewrite with complexity scoring (1-10) across 6 dimensions
- **Model Router** — Priority-based routing with 15+ rules for android, vision, coding, reasoning, fast tasks
- **AI Council Bridge** — Full integration with council deliberation for complexity 7+ tasks
- **Subagent Manager** — Parallel subagent spawning with monitoring, collection, error handling
- **Solo Agent Mode** — Phone runs duck-cli natively with full Hybrid Orchestrator
- **SUPER-AGENT-SETUP.md** — Complete installation guide for Android Termux with one-command install
- **MODEL-ROUTING.md** — Comprehensive model selection guide with decision trees
- **COUNCIL-INTEGRATION.md** — AI Council usage guide with modes, verdicts, triggers
- **SUBAGENT-MANAGEMENT.md** — Parallel subagent patterns and best practices

### Changed
- **Complexity scoring** now considers: multiStep (+3), hasTradeoffs (+3), ethicalDimension (+2), highStakes (+2), ambiguous (+2), externalDeps (+1)
- **Model routing** now uses priority-based rules with confidence scores and alternatives
- **ANDROID-INTEGRATION.md** updated with Solo Agent Mode documentation
- **TERMUX-SETUP.md** updated with SOLO AGENT option pointing to SUPER-AGENT-SETUP.md
- **ORCHESTRATOR.md** updated with complexity scoring details

### Fixed
- Map/Set swap bug in fallback-manager.ts (lines 38-39)
- FallbackChain not properly exported from tool.ts
- Git merge conflicts resolved in src/cli/main.ts and src/update/index.ts

---

## [v0.6.0] — 2026-04-04

### Added
- **Hybrid Orchestrator Core** — Smart task routing combining complexity analysis, model selection, and council integration
- **Task Complexity Classifier** — 6-dimension scoring system (multiStep, hasTradeoffs, ethicalDimension, highStakes, ambiguous, externalDeps)
- **Model Router** — Keyword-based routing with Gemma 4 for Android, Kimi for vision, GLM-5 for coding, Qwen for fast tasks
- **Council Bridge** — Connects orchestrator to AI Council for deliberation on complex/ethical tasks
- **Subconscious Enhancement** — Whispers with confidence ≥ 0.7 trigger council consideration
- **android-agent-phone.py** — Run duck-cli agent ON the phone (not just controlling it)
- **duck-cli-super-agent-setup.sh** — One-command installation script for Android Termux

### Architecture Decisions
- **Hybrid over Full Council** — Only complexity 7+ triggers council (saves ~2-3 seconds latency)
- **Two Android Modes** — Solo Agent (phone IS the agent) vs Remote Control (Mac controls phone via ADB)
- **HTTP for LM Studio** — Phone connects to Mac's LM Studio via HTTP for AI inference

### Key Technical Details
- Framework > Raw Model: Mobile-use achieves 100% on AndroidWorld via hierarchical agent design, not supermodel
- AI Council deliberation adds ~2-3 seconds: Not acceptable for simple tasks, perfect for complex ethical decisions
- Subconscious whispers with confidence ≥ 0.7 trigger council: Good threshold found through testing
- Phone runs duck-cli via Termux: Agent executes ON phone, connects to Mac's LM Studio via HTTP

---

## [v0.4.1] — 2026-04-02

### Added

#### Built-in Mesh Server Daemon (NO external dependency)
- **duck meshd** — starts mesh server as background daemon (port 4000)
- **src/daemons/mesh-server.ts** — full mesh API server (~500 lines)
  - Agent registration with name-based identity, WebSocket /ws endpoint
  - Direct messaging + broadcast, heartbeat tracking
  - Health dashboard, catastrophe reporting, capability discovery
  - In-memory store, API key auth (MESH_API_KEY env)
  - 15+ API endpoints matching agent-mesh-api spec
- All mesh CLI commands now work with built-in server:
  `duck mesh list|send|broadcast|inbox|health|capabilities|catastrophe|status`
  - `duck mesh send` auto-registers, resolves agent name→ID, sends message
- Updated src/mesh/agent-mesh.ts client (auto-register, response unwrapping)
- Go meshdCmd() added for `duck meshd` shortcut
- Dependencies added: express, cors, uuid (+ @types)

#### Sub-Conscious Daemon (LLM-Powered, NO Letta)
- **subconsciousd** — background HTTP daemon (port 4001) with SQLite persistent memory
- **LLM Analyzer** — analyzes session transcripts using MiniMax/LM Studio
- **Whisper API** — contextual whispers from memories before prompts
- **SQLite Store** — FTS5 full-text search in `~/.duckagent/subconscious/`
- CLI commands: `daemon`, `whisper`, `recall`, `recent`, `council`

#### AI Council → Sub-Conscious Integration
- Council queries daemon for relevant memories before deliberation
- Deliberation insights auto-stored to daemon after each run

### Changed
- **clawhub-client.ts** — fixed search endpoint: `/skills/search` → `/api/search` (clawhub.ai live API)
- **subconsciousCmd** — fixed Go cobra to accept multiple args for `recall`/`whisper` commands
- **meshCmd** — fixed Go cobra: MaximumNArgs(2) → MinimumNArgs(0) for multi-word messages

### Fixed
- ClawHub search now works (API endpoint path corrected)
- `duck mesh send` resolves agent name to ID before sending
- `duck mesh catastrophe|inbox` properly unwrap API response objects
- **Standalone Agent Mode** — `duck` (no args) starts interactive shell with welcome message and session resume
- **Setup Wizard** — `duck setup` interactive API key configuration (creates ~/.duck/.env)
- **Skills Auto-Install** — `skills/` copied to dist/ on build; SkillsRunner auto-detects installed location
- **Skills Auto-Detect** — SkillsRunner finds skills at ~/.local/bin/dist/skills/ on installed systems
- **Version Sync** — All source files updated to v0.4.0 (was mixed 0.3.0/0.3.2)
- **Session Persistence** — Shell resumes previous conversations from SQLite SessionStore

### Changed
- **README Complete Rewrite** — Removed 137-skill fiction, fake commands, wrong architecture paths
- **INSTALL.md Fixed** — Correct install steps, duck setup, correct env vars
- **BUILD.md Fixed** — Correct build steps, ~/.local/bin paths, accurate architecture
- **Duck Doctor** — Now detects skills dir; shows 7 checks (all ✅)

### Fixed
- `duck doctor` skills dir check (was always ❌)
- SkillsRunner skillsDir detection (was hardcoded ./skills)
- `duck` no-args behavior (was showing help, now starts shell)

## v0.3.2 — 2026-03-31

### Added
- **OpenClaw v2026.3.31 Compatibility** — Full compatibility layer for OpenClaw v2026.3.31 features:
  - `taskLedgerSQLite`: SQLite-backed task ledger for background tasks
  - `taskBlockedState`: Persisted blocked state tracking
  - `taskParentChildFlow`: Parent-child task flow for orchestrated work
  - `dangerousCodeScanning`: Dangerous-code scanning (fails closed by default)
  - `nodePairingApproval`: Explicit node pairing approval requirement
  - `mcpRemoteHTTP`: MCP remote HTTP/SSE server support

### Added
- **Task Registry Module** (`src/tasks/`) — New SQLite-backed task ledger implementing:
  - Persistent task storage with JSON backend
  - Blocked state tracking for tasks
  - Parent-child task flow relationships
  - Task filtering, listing, and status management
  - Automatic cleanup of old completed tasks

- **Remote MCP Client** (`src/server/mcp-remote-client.ts`) — Connect to external MCP servers:
  - Remote HTTP/SSE MCP server connections
  - Auth header support for authenticated endpoints
  - Connection timeouts and error handling
  - Multi-server management

### Changed
- **OpenClaw Compatibility Checker** — Extended feature detection for v2026.3.31 features
- **Feature Flags** — Added 6 new feature flags for OpenClaw v2026.3.31 compatibility

---

---

## v0.3.1 — 2026-03-31

### Added
- **Enhanced Auto-Heal System** — Improved self-recovery for crashed processes, memory leaks, and failed health checks
- **OpenClaw Compatibility Layer** — Full ACP protocol implementation allowing OpenClaw to spawn/control Duck Agent sessions
- **Full Protocol Testing Suite** — Comprehensive test coverage for MCP, ACP, WebSocket, and Gateway endpoints
- **Auto-heal scripts** — Background monitoring with automatic restart capabilities
- **OpenClaw runtime config** — Ready-to-use configuration for integrating Duck Agent as an OpenClaw ACP backend

### Changed
- **Unified Server** — All protocol servers start/stop gracefully with proper cleanup
- **ACP Server** — Improved session management with timeout handling and concurrent session limits (max 8)

### Fixed
- Session cleanup on unexpected disconnections
- Graceful shutdown handling for all protocol servers
- Memory leak in long-running WebSocket connections

---

## v0.3.0 — 2026-03-14

### Added
- **MCP Server (Model Context Protocol)** — Full MCP 2024-11-05 spec implementation with JSON-RPC 2.0
- **ACP Client** — Spawn external coding agents (Codex, Claude, Cursor, Gemini, Pi, OpenClaw, OpenCode)
- **WebSocket Manager** — Bidirectional WebSocket connections with auto-reconnection
- **Unified Server** — All headless protocols in one command (`duck unified`)
  - MCP Server (port 3848)
  - ACP Gateway (port 18790)
  - WebSocket (port 18791)
  - Gateway API (port 18789)
- **Gateway API** — OpenAI-compatible REST API for chat completions
- **14+ Built-in MCP Tools** — execute, think, remember, recall, kairos_status, kairos_action, desktop_*, get_status, ping, spawn_agent
- **Claude Code Tools Integration** — 60+ coding tools including file operations, shell, search, LSP
- **BrowserOS Integration** — 45+ browser automation tools via MCP
- **Multi-Provider AI** — MiniMax, Kimi, ChatGPT (OAuth), LM Studio, OpenAI Codex

### Added
- **Desktop Control** — Native macOS/Windows control via ClawdCursor
- **Preftext Canvas** — Pure canvas text measurement for generative UI
- **MiniMax Multimodal Toolkit** — TTS, voice cloning, image generation
- **MiniMax Plus Integration** — Speech (4K chars/day) and image (50/day) generation

### Changed
- **Web UI** — Full-featured web interface at port 3000
- **KAIROS Modes** — Three operational modes: aggressive, balanced, conservative

---

## v0.2.0 — 2026-02-25

### Added
- **Full Web UI** — Complete web interface with chat, dashboard, settings
- **Buddy System** — AI companion with rarities (common → legendary) and species (duck, blob, cat, dragon, owl, ghost, robot, rabbit, cactus, snail)
- **KAIROS Proactive AI** — Always-on AI with heartbeat, decision engine, auto-dream at 3AM
- **AI Council** — Deliberative decision making with 7 councilors (Speaker, Technocrat, Ethicist, Pragmatist, Skeptic, Sentinel + 19 specialists)
- **Multi-Agent Teams** — Coordinated parallel execution with templates (code-review, research, swarm)
- **Cron Automation** — 30+ predefined jobs across system, grow, crypto, OSINT, news, weather, home categories
- **TUI Shell** — Interactive terminal interface
- **Claude Code Integration** — Full exec mode with approval layers
- **Memory System** — 3-tier architecture (Identity, Config, Session)
- **Security Modules** — SSRF validation, credential sanitizer, state manager, network policies

### Changed
- **Agent Core** — Reasoning engine, task planning, tool orchestration, self-improvement
- **Provider Manager** — Multi-provider coordination with automatic fallback

---

## v0.1.0 — 2026-01-15

### Added
- Initial release
- Core agent architecture
- Basic CLI interface
- MiniMax provider integration
- File operations
- Shell execution
- Web search
- Basic memory (remember/recall)
- Telegram channel support
- Discord channel support
- Docker support

---

## Roadmap

- [ ] v0.4.0 — Voice conversation, vision analysis, autonomous agents
- [ ] v0.5.0 — Mobile app, cross-device sync
- [ ] v1.0.0 — Production release with enterprise features
