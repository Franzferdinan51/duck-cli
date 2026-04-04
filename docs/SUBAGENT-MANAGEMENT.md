# 🤖 Subagent Management

> How to spawn and manage parallel subagents in duck-cli.

## Overview

duck-cli supports **parallel subagent execution** - spawn multiple agents to work on tasks simultaneously, then collect results when complete.

```
Main Agent
    │
    ├──► Agent 1 (Research) ──────────────────┐
    ├──► Agent 2 (Coding)   ──────────────────┼──► Collect & Merge
    ├──► Agent 3 (Testing)  ──────────────────┤
    └──► Agent 4 (Review)   ──────────────────┘
                   All run in PARALLEL
```

---

## Spawning Subagents

### Basic Spawn

```typescript
import { agent_spawn } from './agent/tools';

// Spawn a single subagent
const result = await agent_spawn({
  task: "Research Flutter state management",
  model: "minimax/MiniMax-M2.7",
  label: "research-flutter"
});
```

### Parallel Team Spawn

```typescript
import { agent_spawn_team } from './agent/tools';

// Spawn multiple agents in parallel
const results = await agent_spawn_team({
  tasks: [
    { task: "Research React patterns", label: "react-research", model: "minimax/MiniMax-M2.7" },
    { task: "Research Vue patterns", label: "vue-research", model: "minimax/MiniMax-M2.7" },
    { task: "Research Svelte patterns", label: "svelte-research", model: "minimax/MiniMax-M2.7" }
  ],
  waitForAll: true
});
// Waits for ALL agents to complete before returning
```

### Think Parallel (Multiple Perspectives)

```typescript
import { think_parallel } from './agent/tools';

// Multiple perspectives on same question
const perspectives = await think_parallel({
  prompt: "Should we use microservices or a monolith?",
  perspectives: ["architect", "developer", "product-manager"],
  model: "minimax/MiniMax-M2.7"
});
```

---

## Subagent Manager

```typescript
import { SubagentManager } from './agent/subagent-manager';

const manager = new SubagentManager();

// Spawn agents
await manager.spawn('research', { task: "Research AI trends", model: "minimax/MiniMax-M2.7" });
await manager.spawn('coding', { task: "Build API", model: "minimax/glm-5" });

// List active agents
const active = manager.listAgents();
// [{ id, label, status, startedAt }, ...]

// Wait for specific agent
const result = await manager.waitFor('research');

// Cancel an agent
manager.cancel('coding');
```

---

## Model Selection for Subagents

| Task Type | Model | Why |
|-----------|-------|-----|
| Research | `minimax/MiniMax-M2.7` | Fast, good reasoning |
| Coding | `minimax/glm-5` | Code-optimized (81.5% MMLU) |
| Vision | `kimi/kimi-k2.5` | Best screen analysis |
| Premium | `openai-codex/gpt-5.4` | Critical tasks only |
| Local | `lmstudio/qwen3.5-9b` | Free, privacy |

```typescript
// Example: Different models for different tasks
const team = await agent_spawn_team({
  tasks: [
    { task: "Research competitors", model: "minimax/MiniMax-M2.7", label: "research" },
    { task: "Build landing page", model: "minimax/glm-5", label: "frontend" },
    { task: "Design logo", model: "minimax/qwen3.5-plus", label: "design" }
  ]
});
```

---

## Error Handling

### Retry on Failure

```typescript
interface SubagentConfig {
  maxRetries: number;      // Default: 3
  retryDelay: number;       // Default: 1000ms
  onError: 'retry' | 'skip' | 'fail';  // Default: 'retry'
}

const result = await agent_spawn({
  task: "Complex task",
  model: "minimax/MiniMax-M2.7",
  config: {
    maxRetries: 3,
    retryDelay: 2000
  }
});
```

### Timeout Handling

```typescript
// Cancel after timeout
const result = await agent_spawn({
  task: "Long-running research",
  model: "minimax/MiniMax-M2.7",
  timeoutMs: 60000  // 1 minute max
});

// Or with manager
manager.spawn('long-task', { task: "...", timeoutMs: 60000 });
```

### Fallback Chain

```typescript
// If one model fails, try next
const result = await agent_spawn_with_fallback({
  task: "Code review",
  models: [
    "openai-codex/gpt-5.4",      // Primary
    "minimax/glm-5",              // Fallback 1
    "minimax/MiniMax-M2.7"       // Fallback 2
  ]
});
```

---

## Collecting Results

### Wait for All

```typescript
const results = await agent_spawn_team({
  tasks: [task1, task2, task3],
  waitForAll: true
});

// results = [result1, result2, result3]
```

### Wait for First

```typescript
const result = await agent_spawn_team({
  tasks: [task1, task2, task3],
  waitForFirst: true  // Return as soon as one completes
});
```

### Selective Wait

```typescript
const manager = new SubagentManager();
manager.spawn('agent1', { task: "..." });
manager.spawn('agent2', { task: "..." });

// Wait for specific agent
const result1 = await manager.waitFor('agent1');

// Continue with result1 while agent2 is still running
process(result1);
```

---

## Monitoring

### List Active Agents

```typescript
const agents = manager.listAgents();
// [
//   { id: 'uuid1', label: 'research', status: 'running', startedAt: Date },
//   { id: 'uuid2', label: 'coding', status: 'completed', startedAt: Date },
//   ...
// ]
```

### Get Agent Status

```typescript
const status = manager.getStatus('agent-id');
// { status: 'running', progress: 0.65, message: 'Processing...' }
```

### Subscribe to Updates

```typescript
manager.on('agent-complete', (agent) => {
  console.log(`Agent ${agent.label} completed with: ${agent.result}`);
});

manager.on('agent-error', (agent, error) => {
  console.error(`Agent ${agent.label} failed: ${error}`);
});
```

---

## CLI Usage

```bash
# Spawn single agent
duck agent spawn research "Research AI trends"

# Spawn team
duck agent team spawn research,coding,testing "Build new feature"

# List agents
duck agent list

# Cancel agent
duck agent cancel research

# Wait for agent
duck agent wait research
```

---

## Best Practices

1. **Use parallel for independent tasks** - Research, testing, document generation
2. **Match model to task** - Don't use GPT-5.4 for simple Q&A
3. **Set reasonable timeouts** - Long-running agents should have limits
4. **Handle failures gracefully** - Use fallback chains for critical tasks
5. **Monitor resource usage** - Too many agents = slow everything

---

## Common Patterns

### Research Loop

```typescript
// Spawn research agents for multiple topics
const results = await agent_spawn_team({
  tasks: topics.map(topic => ({
    task: `Research: ${topic}`,
    model: "minimax/MiniMax-M2.7",
    label: `research-${topic}`
  }))
});

// Aggregate findings
const summary = results.map(r => r.findings).join('\n');
```

### Build Pipeline

```typescript
// Sequential but with parallel substages
const spec = await agent_spawn({ task: "Create SPEC.md", model: "minimax/glm-5" });
const [frontend, backend] = await agent_spawn_team({
  tasks: [
    { task: "Build frontend", model: "minimax/glm-5", label: "frontend" },
    { task: "Build backend API", model: "minimax/glm-5", label: "backend" }
  ]
});
const tests = await agent_spawn({ task: "Write tests", model: "minimax/glm-5" });
```

---

## Troubleshooting

### Agent not completing?

```bash
# Check if agent is still running
duck agent list

# Cancel and retry
duck agent cancel <label>
duck agent spawn <label> "<task>"
```

### Too many agents?

```typescript
// Limit concurrent agents
const manager = new SubagentManager({
  maxConcurrent: 3  // Max 3 at once
});
```

### Memory issues?

```typescript
// Use smaller models for parallel agents
const results = await agent_spawn_team({
  tasks: manyTasks,
  model: "lmstudio/qwen3.5-9b"  // Local, free
});
```