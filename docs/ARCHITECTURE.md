# 🦆 Duck Agent System

> **A complete AI agent system** - not just a CLI wrapper.

## What is Duck Agent?

Duck Agent is a **standalone AI agent** that can:
- Think and reason autonomously
- Use tools to accomplish tasks
- Remember context across sessions
- Control your desktop
- Learn and improve over time
- Connect to multiple AI providers

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Duck Agent                            │
│  ┌─────────────────────────────────────────────────────┐  │
│  │                    Agent Core                           │  │
│  │   • Reasoning Engine                                  │  │
│  │   • Task Planning                                     │  │
│  │   • Tool Orchestration                                │  │
│  │   • Memory Management                                 │  │
│  │   • Self-Improvement                                 │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐         │
│  │Provider │ │ Memory  │ │ Tools   │ │ Skills  │         │
│  │Manager  │ │ System  │ │ Registry│ │ Runner  │         │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘         │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐  │
│  │                 Integrations                          │  │
│  │  • Desktop Control (ClawdCursor)                      │  │
│  │  • AI Council (Multi-Agent)                          │  │
│  │  • OpenClaw Gateway (Channels)                       │  │
│  │  • MCP Servers                                       │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐  │
│  │                    UI Layer                           │  │
│  │  • TUI (Terminal)                                    │  │
│  │  • CLI (Commands)                                    │  │
│  │  • Web (Future)                                     │  │
│  └─────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Core Components

### Agent Core (`src/agent/`)
- **Agent.ts** - Main agent loop
- **Reasoner.ts** - Chain-of-thought reasoning
- **Planner.ts** - Task decomposition
- **Executor.ts** - Action execution

### Providers (`src/providers/`)
- **Manager.ts** - Multi-provider coordination
- **MiniMax** - Fast inference
- **LM Studio** - Local models
- **Anthropic** - Claude
- **OpenAI** - GPT

### Memory (`src/memory/`)
- **SOUL.ts** - Personality/identity
- **CONTEXT.ts** - Working memory
- **STORE.ts** - Persistent storage
- **FTS.ts** - Full-text search

### Tools (`src/tools/`)
- **Registry.ts** - Tool discovery
- **Executor.ts** - Tool execution
- **Desktop.ts** - Desktop control
- **Browser.ts** - Web automation
- **Files.ts** - File operations

### Skills (`src/skills/`)
- **Runner.ts** - Skill execution
- **Creator.ts** - Self-improving skills
- **Marketplace.ts** - Skill discovery

## How It Works

```
User: "Draw a circle in Paint"
         │
         ▼
┌─────────────────┐
│  Agent Core     │
│  • Parse intent │
│  • Plan steps   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Task Planner   │
│  1. Open Paint │
│  2. Select tool│
│  3. Draw circle│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Tool Executor  │
│  Desktop Control│
│  → ClawdCursor │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Verification   │
│  Screenshot +   │
│  Confirm draw  │
└─────────────────┘
```

## Usage Modes

### 1. Interactive TUI
```bash
duck                    # Start TUI
> draw a circle
> open safari
> check my calendar
```

### 2. Single Task
```bash
duck run "fix the auth bug"
```

### 3. Headless Agent
```bash
duck agent start        # Background agent
duck agent task "..."   # Send task
```

### 4. API Server
```bash
duck serve            # HTTP API
curl -X POST http://localhost:3000/task \
  -d '{"input": "fix bug"}'
```

## Desktop Control

Duck Agent can control your desktop using ClawdCursor:

```typescript
const agent = new Agent();
await agent.start();

agent.execute("Open Safari");
agent.execute("Click the search box");
agent.execute("Type 'hello world'");
agent.execute("Take screenshot");
```

## Memory & Context

Duck Agent maintains:

1. **SOUL** - Who it is, personality, rules
2. **MEMORY** - What it's learned, facts
3. **CONTEXT** - Current conversation
4. **HISTORY** - Past interactions

```typescript
// Soul defines identity
agent.soul.set("friendly", true);
agent.soul.set("rules", ["be helpful", "be concise"]);

// Memory stores learnings
agent.memory.add("User prefers dark mode");
agent.memory.search("preferences");
```

## Skills

Skills are reusable capabilities:

```bash
# Built-in skills
duck skill list

# Use a skill
duck skill use desktop-control "open notepad"

# Create new skill
duck skill create my-workflow
```

## Providers

Multiple AI providers for different tasks:

| Task | Provider | Why |
|------|----------|-----|
| Coding | Claude | Best reasoning |
| Fast chat | MiniMax | Cheap, fast |
| Local | LM Studio | Private, free |
| Vision | Kimi | Great at images |

## Status

Duck Agent is a **work in progress** - the architecture is designed, core components being implemented.

See `src/` directory for implementation.
