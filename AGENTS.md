# AGENTS.md - Duck CLI Internal Agent Guide

## Overview

Duck CLI is a standalone AI agent system with multi-provider routing, orchestration, and extensive tooling. This guide helps internal agents understand the system architecture and their role within it.

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Duck CLI v0.8.0                       │
├─────────────────────────────────────────────────────────────┤
│  Access Layer (CLI / Telegram / Web UI / Discord)           │
├─────────────────────────────────────────────────────────────┤
│  Chat Agent (Port 18797) - Conversational interface         │
│  ├─ Session Management (in-memory + subconscious)          │
│  ├─ Complexity Scoring (Hybrid Orchestrator)               │
│  ├─ AI Council Deliberation (for complex tasks)            │
│  └─ Meta-Agent Routing (score >= 5)                        │
├─────────────────────────────────────────────────────────────┤
│  Hybrid Orchestrator (v4)                                   │
│  ├─ Task Complexity Classifier (1-10 scoring)              │
│  ├─ Model Router (MiniMax/Kimi/LM Studio/OpenRouter)       │
│  ├─ Council Bridge (deliberation before execution)         │
│  └─ Fallback Manager (auto-retry with fallbacks)           │
├─────────────────────────────────────────────────────────────┤
│  Meta-Agent (Plan → Execute → Critic → Heal → Learn)       │
│  ├─ MetaPlanner: Creates execution plans                   │
│  ├─ MetaCritic: Evaluates step results                     │
│  ├─ MetaHealer: Diagnoses and recovers from failures       │
│  └─ MetaLearner: Logs experiences for improvement          │
├─────────────────────────────────────────────────────────────┤
│  Tool Registry (40+ tools)                                  │
│  ├─ Shell Execution (dangerous, guarded)                   │
│  ├─ File I/O (read/write with guards)                      │
│  ├─ Web Search (DuckDuckGo)                                │
│  ├─ Memory System (SQLite-backed)                          │
│  ├─ Android Tools (ADB integration)                        │
│  ├─ Desktop Control (macOS/Windows/Linux)                  │
│  └─ Sub-Agent Management (parallel agents)                 │
├─────────────────────────────────────────────────────────────┤
│  Bridge Layer                                               │
│  ├─ MCP Server (Port 3850) - Tool protocol                 │
│  ├─ ACP Server (Port 18794) - Agent protocol               │
│  ├─ WebSocket (Port 18796) - Real-time comms               │
│  └─ Meta-Agent Bridge - Cross-agent coordination           │
├─────────────────────────────────────────────────────────────┤
│  Mesh Layer (Agent Mesh Networking)                         │
│  ├─ Peer Discovery (port 4000)                             │
│  ├─ Broadcast Messaging                                    │
│  ├─ Whisper Routing (subconscious alerts)                  │
│  └─ meshd Daemon                                           │
├─────────────────────────────────────────────────────────────┤
│  Sub-Conscious (Port 4001) - LLM-powered memory            │
│  ├─ Session Analysis (async LLM processing)                │
│  ├─ Whisper Generation (contextual hints)                  │
│  ├─ FTS Search (TF-IDF across memories)                    │
│  └─ Council Memory (deliberation storage)                  │
├─────────────────────────────────────────────────────────────┤
│  KAIROS - Proactive AI Heartbeat                            │
│  ├─ Dream Consolidation (pattern recognition)              │
│  ├─ Proactive Suggestions (idle-time processing)           │
│  └─ Self-Improvement (continuous learning)                 │
└─────────────────────────────────────────────────────────────┘
```

## Agent Responsibilities

### 1. Chat Agent
- **Role**: Primary user interface
- **Port**: 18797
- **Key Functions**:
  - Session management (in-memory with subconscious persistence)
  - Complexity scoring using Hybrid Orchestrator
  - Route tasks to Meta-Agent when score >= 5
  - AI Council deliberation for complex/ethical tasks
  - Real-time streaming responses

### 2. Meta-Agent
- **Role**: Complex task orchestration
- **Lifecycle**: Plan → Execute → Critic → Heal → Learn
- **Key Functions**:
  - Create execution plans from natural language
  - Execute tools with retry and fallback
  - Self-critique and auto-heal from failures
  - Learn from experiences

### 3. Sub-Conscious Daemon
- **Role**: Long-term memory and pattern recognition
- **Port**: 4001
- **Key Functions**:
  - Analyze session transcripts (async)
  - Generate contextual whispers
  - Full-text search across all memories
  - Store council deliberations

### 4. Mesh Agent
- **Role**: Inter-agent communication
- **Port**: 4000
- **Key Functions**:
  - Peer discovery and registration
  - Broadcast messages to all agents
  - Route whispers to appropriate agents
  - Coordinate multi-agent tasks

## Tool Categories

### Dangerous Tools (Require Approval)
- `shell` - Execute shell commands
- `file_write` - Write to files

### Safe Tools
- `file_read` - Read files
- `web_search` - Search the web
- `memory_remember` - Store memories
- `memory_recall` - Search memories
- `desktop_*` - Desktop control
- `android_*` - Android device control

### Meta Tools
- `agent_spawn` - Spawn sub-agents
- `agent_list` - List active agents
- `plan_create` - Create execution plans
- `skill_create` - Auto-create skills

## Provider Chain

1. **MiniMax** (Primary) - MiniMax-M2.7, glm-5
2. **Kimi** (Vision) - kimi-k2.5
3. **LM Studio** (Local) - qwen3.5-9b, gemma-4
4. **OpenRouter** (Fallback) - Free tier models

## Environment Variables

```bash
# Required
MINIMAX_API_KEY=sk-...

# Optional
KIMI_API_KEY=sk-kimi-...
OPENAI_API_KEY=sk-...
OPENROUTER_API_KEY=sk-or-...
LMSTUDIO_URL=http://localhost:1234
LMSTUDIO_KEY=sk-lm-...

# Feature Flags
MESH_ENABLED=true
SUBCONSCIOUS_ENABLED=true
DUCK_CHAT_PROVIDER=minimax
DUCK_CHAT_MODEL=MiniMax-M2.7
```

## Key Files

| File | Purpose |
|------|---------|
| `src/agent/core.ts` | Main Agent class with tool registry |
| `src/agent/chat-agent.ts` | Chat interface and routing |
| `src/orchestrator/` | Hybrid Orchestrator v4 |
| `src/orchestrator/meta-agent.ts` | Meta-Agent implementation |
| `src/daemons/subconsciousd.ts` | Sub-Conscious daemon |
| `src/mesh/` | Agent mesh networking |
| `src/tools/registry.ts` | Tool registry |
| `src/providers/manager.ts` | Multi-provider routing |

## Communication Protocols

### MCP (Model Context Protocol)
- Port: 3850
- Purpose: Tool exposure to external systems

### ACP (Agent Communication Protocol)
- Port: 18794
- Purpose: Inter-agent communication
- Features: Sub-agent spawning, parallel execution

### WebSocket
- Port: 18796
- Purpose: Real-time streaming

## Debugging

```bash
# Check all services
./duck health

# View logs
./duck logger logs --limit 50

# Check agent status
./duck agent list

# Test provider
./duck run "test" --provider minimax

# Trace execution
DUCK_TRACE=1 ./duck run "complex task"
```

## Common Issues

1. **Path Resolution**: Ensure `DUCK_SOURCE_DIR` is set correctly
2. **Provider Timeouts**: Check API keys and network connectivity
3. **Memory Limits**: SQLite WAL mode can grow large
4. **Port Conflicts**: Check if ports 3850, 18794, 18797 are free

## Best Practices

1. Always use the Hybrid Orchestrator for task routing
2. Persist important sessions to Sub-Conscious
3. Use council deliberation for ethical/complex decisions
4. Spawn parallel agents for independent subtasks
5. Check tool registry before implementing new tools

## Resources

- GitHub: https://github.com/Franzferdinan51/duck-cli
- OpenClaw: https://github.com/openclaw/openclaw
- Hermes: https://github.com/NousResearch/hermes-agent
