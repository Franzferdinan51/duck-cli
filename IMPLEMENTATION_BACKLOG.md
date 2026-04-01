# Duck CLI - Prioritized Implementation Backlog

**Status:** Read-only architecture audit complete  
**Date:** 2026-04-01

## Executive Summary

Duck CLI should evolve as the **main application** while preserving the full original plan. The clean implementation direction is:
- **duck-cli = primary product / orchestrator**
- **OpenClaw = base infrastructure** (gateway, sessions, memory, providers, MCP)
- **AI Council = first-class integrated capability**
- **openclaude / instructkr-style features = additive bridges**
- **server/process sprawl = reduced carefully, not destructively**

## Priority Themes

### P0 — Foundation / Truth Alignment
- [ ] Make README, SPEC, PROJECT-SPEC, SUPER-AGENT-PLAN consistent
- [ ] Define duck-cli as the canonical app in docs
- [ ] Explicitly document OpenClaw as base infrastructure
- [ ] Document AI Council as a first-class subsystem
- [ ] Add kanban workflow guidance for execution

### P1 — Core Runtime Architecture
- [ ] Build/clarify unified duck-cli entrypoint
- [ ] Keep OpenClaw gateway as base client dependency
- [ ] Reuse sessions/sub-agent infrastructure directly where possible
- [ ] Reuse MCP infrastructure directly where possible
- [ ] Reuse memory/brain system directly where possible
- [ ] Add adapter boundary for systems that should not be tightly coupled

### P2 — Heavy AI Council Integration
- [ ] Add `duck council` command family
- [ ] Add deliberation mode selection (`legislative`, `research`, `swarm-coding`, `risk`, `emergency`)
- [ ] Reuse councilor definitions and role mappings
- [ ] Bridge to existing council engine rather than rewriting immediately
- [ ] Add council-backed code review / architecture review flows
- [ ] Add council-backed “what next?” loop for continuous execution

### P3 — Feature Absorption / Bridges
- [ ] Identify reusable tool patterns from openclaude / instructkr
- [ ] Add bridge/adapters for useful tooling, not destructive merges
- [ ] Add vim-mode / voice-mode / advanced tool-loop backlog items
- [ ] Add inter-agent messaging and spawn/fork workflows
- [ ] Preserve full original feature vision

### P4 — Server / Process Consolidation
- [ ] Keep duck-cli CLI-first, not another fragile always-on monolith
- [ ] Consolidate council flows behind duck-cli commands where safe
- [ ] Consolidate dashboard/WebUI entrypoints where safe
- [ ] Keep OpenClaw gateway external/foundational
- [ ] Keep specialized external services external when appropriate (LM Studio, CannaAI, ClawdCursor)

### P5 — Web UI Upgrades
- [ ] Audit current Web UI feature gaps
- [ ] Improve routes, consistency, and integration with duck-cli runtime
- [ ] Add council views / orchestration views / backlog-kanban visibility
- [ ] Keep desktop/web UI aligned with CLI architecture

## Suggested Execution Order

1. **Docs + architecture alignment**
2. **kanban + backlog operationalization**
3. **duck-cli ↔ OpenClaw base reuse layer**
4. **AI Council command integration**
5. **bridge/adapters for openclaude / instructkr capabilities**
6. **Web UI upgrades**
7. **safe consolidation of moving parts**
8. **AI Council loop to choose next tasks until backlog is exhausted**

## Non-Negotiable Constraints

- **Do not remove anything**
- **Only fix and enhance**
- **Preserve full plan**
- **Maintain OpenClaw-base compatibility**
- **Use AI Council when prioritization or architecture is unclear**
- **Use backlog + kanban appropriately**
