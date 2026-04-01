# Duck CLI - Consolidation Plan

**Status:** Read-only consolidation audit complete  
**Date:** 2026-04-01

## Goal

Reduce unnecessary server/process sprawl while preserving everything and only fixing/enhancing.

## Core Principle

Duck CLI should be **CLI-first and orchestration-first**, not just another permanently running fragile server stack.

## Canonical Stack

- **duck-cli** = main application / orchestrator
- **OpenClaw base** = foundational infrastructure
- **AI Council** = heavily integrated deliberation/decision layer
- **openclaude / instructkr-style capabilities** = additive bridges/adapters

## What Should Be Unified Behind duck-cli

### 1. AI Council command surface
Unify deliberation workflows behind commands like:
- `duck council`
- `duck council --mode legislative`
- `duck council --mode swarm-coding`
- `duck review --council`
- `duck decide`

### 2. Web/dashboard entrypoints
Where safe, make duck-cli the orchestrator for:
- dashboard views
- council views
- orchestration views
- kanban/backlog visibility

### 3. Tool execution layer
Consolidate user-facing tool invocation under duck-cli command/tool abstractions even if underlying services remain separate.

### 4. Process management
Let duck-cli manage when supporting processes are needed rather than requiring the user to mentally juggle many separate runtimes.

## What Should Stay External / Foundational

### Keep external / foundational
- **OpenClaw Gateway**
- **LM Studio**
- **CannaAI**
- **ClawdCursor / desktop-control services**

These are specialized or base services and should be integrated as dependencies/clients, not blindly absorbed.

## Recommended Consolidation Strategy

### Phase 1 — Unify the interface, not the world
- make duck-cli the single mental entrypoint
- reuse OpenClaw sessions/MCP/memory/gateway directly
- expose council and orchestration via duck-cli commands

### Phase 2 — Add bridges, not forks
- wrap openclaude / instructkr-style subsystems behind adapters
- avoid destructive code merges that hurt upstream pullability

### Phase 3 — Rationalize Web UI / dashboard processes
- keep useful Web UI pieces
- reduce duplicate entrypoints where safe
- centralize runtime selection/orchestration in duck-cli

### Phase 4 — AI Council looped prioritization
- after major milestones, ask AI Council what remains
- pull the next task from backlog into kanban
- repeat until no meaningful work remains

## Risks to Avoid

- turning duck-cli into a giant always-on monolith
- replacing OpenClaw base instead of standing on it
- destructive rewrites of existing council/openclaude systems
- introducing multiple competing orchestrators with overlapping responsibilities

## Safe Rule

**Unify the user-facing entrypoint and orchestration layer first.**
**Do not force every specialized service into one binary unless it clearly reduces complexity without breaking compatibility.**
