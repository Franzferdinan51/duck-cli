# 🤖 Subagent Management

> **Spawn, coordinate, and collect results from parallel AI subagents.**

**Version:** v0.6.1 — April 4, 2026

---

## Overview

duck-cli's subagent system lets you **run multiple AI agents in parallel**, each with its own model, task, and context. The main orchestrator coordinates them and synthesizes results.

```
Main Agent (you)
    │
    ├──► Subagent 1 (MiniMax-M2.7) ──► Research task A
    ├──► Subagent 2 (kimi-k2.5)   ──► Vision analysis
    ├──► Subagent 3 (glm-5)        ──► Write code
    └──► Subagent 4 (qwen3.5-plus) ──► Quick lookup
              │
              │ (all complete)
              ▼
    ┌─────────────────────┐
    │  Result Synthesis   │
    │  (main agent)        │
    └─────────────────────┘
              │
              ▼
         Final Answer
```

---

## Why Parallel Subagents?

| Benefit | Example |
|---------|---------|
| **Speed** | 4 tasks in parallel = 4x faster |
| **Specialization** | Vision model for screenshots, coding model for APIs |
| **Context isolation** | Each agent has clean context |
| **Reliability** | If one fails, others continue |

### When to Spawn Subagents

**ALWAYS spawn for:**
- Tasks taking >5 minutes
- Multiple independent tasks
- Specialized work (vision, coding, research)
- Iterative work (debugging cycles)
- Parallel data gathering

**DON'T spawn for:**
- Quick lookups (<30 seconds)
- Simple single-step tasks
- Tasks requiring sequential execution
- Low-complexity tasks (1-3)

---

## Spawning Subagents

### CLI Interface

```bash
# Basic spawn
duck spawn --task "Research competitor X" --model minimax/MiniMax-M2.7

# Named subagent
duck spawn --name researcher --task "Deep dive on Y" --model kimi/kimi-k2.5

# With timeout
duck spawn --task "Build this feature" --model minimax/glm-5 --timeout 300

# Wait for completion
duck spawn --task "Task" --model minimax/qwen3.5-plus --wait
```

### TypeScript API

```typescript
import { sessions_spawn } from './utils/spawn.js';

// Spawn a research subagent
const researchAgent = await sessions_spawn({
  task: "Research latest AI developments in autonomous agents",
  model: 'minimax/MiniMax-M2.7',
  label: 'research-1',
  mode: 'run',  // One-shot, not persistent
  runTimeoutSeconds: 300
});

// Spawn a vision subagent
const visionAgent = await sessions_spawn({
  task: "Analyze this screenshot: /tmp/screen.png",
  model: 'kimi/kimi-k2.5',
  label: 'vision-1'
});

// Both run in parallel...
// Results auto-announce when complete
```

### Python API

```python
from subagent_manager import SubagentManager

manager = SubagentManager()

# Spawn multiple in parallel
agent1 = manager.spawn(
    task="Research X",
    model="minimax/MiniMax-M2.7",
    label="research-1"
)

agent2 = manager.spawn(
    task="Analyze screenshot",
    model="kimi/kimi-k2.5",
    label="vision-1"
)

agent3 = manager.spawn(
    task="Write unit tests",
    model="minimax/glm-5",
    label="coder-1"
)

# Wait for all
results = manager.wait_all([agent1, agent2, agent3])

# Or with timeout
results = manager.wait_all([...], timeout=60)
```

---

## Model Selection for Subagents

### Picking the Right Model

| Task | Best Model | Why |
|------|-----------|-----|
| **Research** | `minimax/MiniMax-M2.7` | Fast, long context, good reasoning |
| **Vision/Screenshots** | `kimi/kimi-k2.5` | Best-in-class vision |
| **Coding** | `minimax/glm-5` | 81.5% MMLU, code-optimized |
| **Fast/simple** | `minimax/qwen3.5-plus` | 1M context, fast |
| **Premium reasoning** | `openai-codex/gpt-5.4` | Highest quality |
| **Android control** | `lmstudio/google/gemma-4-e4b-it` | Vision + tool-calling |
| **Free tier** | `qwen/qwen3.6-plus-preview:free` | OpenRouter free |

### Parallel Model Mix Example

```typescript
// Main agent: orchestrator (MiniMax-M2.7)
// Spawns 4 subagents simultaneously:

const agents = await Promise.all([
  sessions_spawn({
    task: "Research competitor A's pricing",
    model: 'minimax/MiniMax-M2.7',
    label: 'research-a'
  }),
  sessions_spawn({
    task: "Research competitor B's pricing", 
    model: 'minimax/MiniMax-M2.7',
    label: 'research-b'
  }),
  sessions_spawn({
    task: "Analyze current UI screenshot",
    model: 'kimi/kimi-k2.5',
    label: 'vision-ui'
  }),
  sessions_spawn({
    task: "Draft API specification",
    model: 'minimax/glm-5',
    label: 'coder-api'
  })
]);
```

---

## Monitoring Subagents

### List Active Subagents

```bash
# CLI
duck agents list

# Output:
# ACTIVE SUBAGENTS (4):
# ┌────────────┬──────────────────┬──────────┬────────┐
# │ ID        │ Task             │ Model    │ Status │
# ├────────────┼──────────────────┼──────────┼────────┤
# │ agent-123 │ Research A       │ M2.7     │ running│
# │ agent-124 │ Research B       │ M2.7     │ running│
# │ agent-125 │ Vision analysis  │ kimi-k2.5│ running│
# │ agent-126 │ API draft        │ glm-5    │ running│
# └────────────┴──────────────────┴──────────┴────────┘
```

### Check Status

```bash
duck agents status agent-123

# Output:
# Subagent: agent-123
# Task: Research competitor A's pricing
# Model: minimax/MiniMax-M2.7
# Status: running (3m 24s elapsed)
# Progress: Processing 5/20 sources
# Memory: 45K tokens used
```

### Stream Output

```bash
# Watch real-time output
duck agents watch agent-123

# Output streams as it happens
```

---

## Collecting Results

### Wait for All

```typescript
// Wait for all subagents to complete
const results = await Promise.all(agents);

// results is an array of results in same order as spawn
for (const result of results) {
  console.log(`Agent ${result.label}: ${result.success}`);
}
```

### Wait for First

```typescript
// Get first result, cancel others
const first = await Promise.race(agents);

// Useful for "first to find X" scenarios
```

### Selective Wait

```typescript
// Wait for specific agents
const [researchResult] = await waitFor([researchAgent], {
  timeout: 30000
});

// Continue with partial results if timeout
```

### Result Structure

```typescript
interface SubagentResult {
  sessionKey: string;
  label: string;
  success: boolean;
  result?: string;           // Main output
  error?: string;            // Error message if failed
  model: string;              // Model used
  executionTimeMs: number;    // How long it ran
  tokensUsed?: number;        // If tracked
  artifacts?: {               // Files created
    path: string;
    type: string;
  }[];
}
```

---

## Error Handling

### Retry Logic

```typescript
async function spawnWithRetry(task: string, model: string, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await sessions_spawn({ task, model, label: `attempt-${i}` });
    } catch (err) {
      if (i === retries - 1) throw err;
      await sleep(1000 * (i + 1));  // Exponential backoff
    }
  }
}
```

### Timeout Handling

```typescript
const result = await Promise.race([
  sessions_spawn({ task, model }),
  new Promise((_, reject) => 
    setTimeout(() => reject(new Error('Timeout')), 60000)
  )
]).catch(err => ({ success: false, error: err.message }));
```

### Partial Failure

```typescript
const results = await Promise.allSettled(agents);

// Filter successful
const successes = results
  .filter(r => r.status === 'fulfilled' && r.value.success)
  .map(r => r.value);

// Handle failures
const failures = results
  .filter(r => r.status === 'rejected' || !r.value.success);
```

### Kill Stuck Agents

```bash
# Kill specific subagent
duck agents kill agent-123

# Kill all subagents
duck agents kill-all
```

---

## Coordination Patterns

### Fan-Out / Fan-In

```typescript
// Fan-Out: Spawn many agents for sub-tasks
const subagents = items.map(item => 
  sessions_spawn({
    task: `Process item: ${item.id}`,
    model: 'minimax/qwen3.5-plus',
    label: `processor-${item.id}`
  })
);

// Fan-In: Collect all results
const results = await Promise.all(subagents);
const summary = synthesize(results);
```

### Pipeline

```typescript
// Stage 1: Parallel research
const researchAgents = await Promise.all([
  sessions_spawn({ task: "Research A", model: 'M2.7', label: 'r1' }),
  sessions_spawn({ task: "Research B", model: 'M2.7', label: 'r2' }),
]);

// Stage 2: Synthesis (after stage 1 completes)
const synthesis = await sessions_spawn({
  task: `Synthesize: ${researchAgents.map(r => r.result).join('\n')}`,
  model: 'gpt-5.4',
  label: 'synth'
});
```

### Priority Queue

```typescript
// High priority
const urgent = await sessions_spawn({
  task: "Critical fix",
  model: 'gpt-5.4',
  priority: 100
});

// Normal priority
const normal = await sessions_spawn({
  task: "Background task",
  model: 'qwen3.5-plus',
  priority: 50
});
```

---

## Best Practices

### 1. Name Everything

```typescript
// Bad
const a = await sessions_spawn({ task: "..." });

// Good
const researchAgent = await sessions_spawn({ 
  task: "...",
  label: 'market-research-2026-04-04'
});
```

### 2. Set Reasonable Timeouts

```typescript
// Research task: 5 minutes
await sessions_spawn({ 
  task: "Deep research",
  runTimeoutSeconds: 300
});

// Quick analysis: 30 seconds
await sessions_spawn({
  task: "Quick look",
  runTimeoutSeconds: 30
});
```

### 3. Handle Failures Gracefully

```typescript
const results = await Promise.allSettled(agents);
const successes = results.filter(isSuccess);
const failures = results.filter(isFailure);

// Always provide value if some succeed
if (successes.length > 0) {
  return synthesize(successes);
} else {
  throw new Error('All subagents failed');
}
```

### 4. Limit Concurrent Agents

```typescript
// Don't spawn 100 agents at once
const BATCH_SIZE = 5;
for (const batch of chunk(items, BATCH_SIZE)) {
  const agents = batch.map(item => sessions_spawn({ task: item }));
  const results = await Promise.all(agents);
  process(results);
}
```

### 5. Use Appropriate Models

```
Quick/Fast → qwen3.5-plus (fast, cheap)
Research   → MiniMax-M2.7 (context, reasoning)
Vision     → kimi-k2.5 (quality)
Coding     → glm-5 (MMLU, speed)
Premium    → gpt-5.4 (best quality)
```

---

## CLI Reference

```bash
# Spawn
duck spawn --task "Task" --model <model> [--timeout <sec>] [--name <label>]
duck spawn -t "Task" -m <model>  # Short form

# List
duck agents list
duck agents ls

# Status
duck agents status <id>
duck agents show <id>

# Watch
duck agents watch <id>

# Kill
duck agents kill <id>
duck agents kill-all

# Results
duck agents results <id>
duck agents output <id>
```

---

## Quick Reference

```
╔════════════════════════════════════════════════════════════════╗
║              SUBAGENT MANAGEMENT QUICK REFERENCE             ║
╠════════════════════════════════════════════════════════════════╣
║                                                                ║
║  SPAWN:                                                        ║
║  duck spawn -t "task" -m minimax/MiniMax-M2.7                  ║
║  duck spawn -t "task" -m kimi/kimi-k2.5                       ║
║  duck spawn -t "task" -m glm-5 --timeout 300                   ║
║                                                                ║
║  MANAGE:                                                       ║
║  duck agents list            → Show active subagents           ║
║  duck agents status <id>     → Check specific agent            ║
║  duck agents watch <id>      → Stream output                   ║
║  duck agents kill <id>       → Kill stuck agent                ║
║  duck agents kill-all        → Kill all subagents              ║
║                                                                ║
║  MODEL SELECTION:                                              ║
║  Research     → MiniMax-M2.7                                   ║
║  Vision       → kimi-k2.5                                     ║
║  Coding       → glm-5                                          ║
║  Fast/simple  → qwen3.5-plus                                  ║
║  Premium      → gpt-5.4                                        ║
║  Android      → gemma-4-e4b-it                                ║
║                                                                ║
║  BEST PRACTICES:                                               ║
║  • Name every agent (--name or label)                          ║
║  • Set timeouts (--timeout)                                    ║
║  • Use Promise.allSettled for error tolerance                  ║
║  • Limit concurrent agents to 5-10                             ║
║  • Use specialized models per task type                        ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝
```

---

**Related:**
- [ORCHESTRATOR.md](ORCHESTRATOR.md) — Hybrid orchestrator
- [MODEL-ROUTING.md](MODEL-ROUTING.md) — Model selection
- [COUNCIL-INTEGRATION.md](COUNCIL-INTEGRATION.md) — AI Council
