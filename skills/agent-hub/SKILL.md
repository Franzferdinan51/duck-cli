# Agent Hub — Unified Multi-Agent System

## Overview

Unified integration layer for all agent systems: Agent Teams, AI Council, Agent Mesh, and Duck CLI.

**Services:**
- Agent Teams: `http://localhost:3131`
- AI Council: `http://localhost:3003`
- Agent Mesh: `http://localhost:4000`
- Duck CLI: `~/.gitnexus/repos/duck-cli`

## Quick Access

```bash
# Agent Teams (Hive Nation)
curl http://localhost:3131/api/teams/list

# AI Council (53 councilors)
curl http://localhost:3003/api/councilors

# Agent Mesh (registered agents)
curl http://localhost:4000/api/agents -H "X-API-Key: openclaw-mesh-default-key"

# Duck CLI
cd ~/.gitnexus/repos/duck-cli && ./duck --version
```

## When to Use

| Need | Use |
|------|-----|
| Execute task | Duck CLI |
| Complex build | Agent Teams (swarm coding) |
| Expert debate | AI Council |
| Multi-agent comms | Agent Mesh |
| All of the above | Agent Hub |

## Workflow Example

```
1. Duck CLI → receives task
2. Agent Mesh → distributes to agents
3. Agent Teams → spawns specialists
4. AI Council → debates approach
5. Duck CLI → executes and reports
```

## Status

Updated: 2026-04-21
