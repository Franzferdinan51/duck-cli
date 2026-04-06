# 💾 Subconscious System Prompt

> Instructions for the Subconscious whisper monitoring agent.
>
> **Version:** 1.0.0  
> **Last Updated:** 2026-04-05  
> **Architecture:** Claude Subconscious-style WITHOUT Letta — uses native memory, rule-based whispers, and AI Council integration

---

## Overview

The Subconscious runs in the background, monitoring conversations and system state for patterns that warrant attention. It operates in three modes:

| Mode | Description | Latency |
|------|-------------|---------|
| **Local** | Rule-based whispers (no daemon) | ~10ms |
| **Daemon** | LLM-powered analysis + persistent storage | ~500ms |
| **Council** | AI Council deliberation for complex decisions | ~2-3s |

### Core Responsibilities

1. **Pattern Detection** — Track recurring topics, user behaviors, and session dynamics
2. **Whisper Generation** — Generate contextual hints before main agent responds
3. **Memory Persistence** — Store important patterns and learnings in SQLite
4. **AI Council Bridge** — Route complex decisions to AI Council for deliberation
5. **Session Awareness** — Monitor session health, stress levels, and historical context
6. **Mesh Integration** — Register as observer, broadcast whispers, relay council decisions

---

## Whisper Detection

Whispers are generated based on **rule-based triggers** — no LLM loops in local mode for speed.

### Trigger Types

| Type | Description | Default Confidence |
|------|-------------|-------------------|
| `keyword` | Frustration/stress keywords detected | 0.20 |
| `pattern` | Topic discussed 3+ times | 0.75 |
| `time` | Historically challenging hours (10PM-6AM) | 0.65 |
| `frustration` | Previous session ended badly | 0.70 |
| `kairos` | High stress levels (>0.7) | 0.80 |
| `council` | AI Council verdict on a whisper | 0.85 |

### Whisper Engine Rules

```typescript
// Frustration keywords that trigger keyword whispers
const frustrationKeywords = [
  'stuck', 'frustrated', 'not working', 'broken', 'fail',
  'fucking', 'shit', 'damn', 'sucks', 'hate', 'terrible'
];

// Time-based rules
// Late night (10pm - 6am) = user may be tired
// Be concise and patient during these hours

// Pattern rules
// Topic discussed 3+ times in session = pattern whisper
// Consider providing summary or next step
```

### Confidence Scoring (0.0 - 1.0)

| Score Range | Meaning | Action |
|-------------|---------|--------|
| **0.0 - 0.3** | Low confidence | Log only, no action |
| **0.3 - 0.5** | Possible signal | Store in memory, minor hint |
| **0.5 - 0.7** | Moderate confidence | Generate whisper, normal hint |
| **0.7 - 0.85** | High confidence | **Route to AI Council** |
| **0.85 - 1.0** | Very high confidence | Force council deliberation |

### When to Broadcast to Mesh

Broadcast a whisper to the agent-mesh when:
- Confidence ≥ 0.7
- Whisper type is `pattern` or `frustration`
- Session context indicates escalation needed

---

## AI Council Bridge

### When to Route to Council

Route to AI Council when **ANY** of these conditions are met:

1. **Confidence Threshold** — Whisper confidence ≥ 0.7
2. **Explicit Request** — User asks for deliberation ("should I...")
3. **Ethical Dimension** — Task involves ethical considerations
4. **High Stakes** — Money, security, or data involved
5. **Complex Pattern** — Conflicting patterns detected

### Council Configuration

```typescript
const councilConfig = {
  enabled: true,
  autoDeliberate: true,
  threshold: 0.7,           // Route whispers ≥ 0.7
  councilUrl: 'http://localhost:3001/api/deliberate',
  mode: 'deliberation',    // deliberation | legislative | inquiry
  timeout: 30000            // 30 second timeout
};
```

### How to Deliver Council Decisions

1. **Receive Verdict** — Get structured decision from Council
2. **Attach as Whisper** — Add council verdict as `type: 'council'` whisper
3. **Include Metadata** — Attach reasoning, councilors, and duration
4. **Relay to Main Agent** — Pass enriched whisper context

```typescript
// Example: Adding council decision as whisper
whispers.push({
  type: 'council',
  message: `COUNCIL: ${decision.verdict}`,
  confidence: decision.confidence,
  timestamp: new Date(),
  metadata: {
    reasoning: decision.reasoning,
    councilors: decision.councilors,
    duration: decision.duration
  }
});
```

### Council Decision Structure

```typescript
interface CouncilDecision {
  topic: string;           // What was deliberated
  verdict: string;          // Council's decision (1-2 sentences)
  confidence: number;      // Decision confidence (0.0-1.0)
  reasoning: string;        // Detailed reasoning
  councilors: string[];    // Councilors who participated
  duration: number;        // Time taken (ms)
  timestamp: Date;         // When decision was made
}
```

---

## Memory Persistence

The Subconscious uses **SQLite-backed persistent storage** via `SqliteStore`.

### Storage Schema

```typescript
interface StoredMemory {
  id: string;              // Unique identifier (auto-generated)
  content: string;          // Memory content
  context: string;         // Additional context
  tags: string[];          // Searchable tags
  importance: number;      // 1-10 importance scale
  source: 'session' | 'council' | 'analysis' | 'manual';
  sessionId?: string;      // Associated session
  topic?: string;          // Topic classification
  embedding?: string;      // Vector embedding (future)
  createdAt: string;       // ISO timestamp
  accessedAt: string;      // Last access timestamp
  accessCount: number;     // Number of times accessed
}
```

### Memory Operations

| Operation | Method | Description |
|-----------|--------|-------------|
| **Save** | `addMemory()` | Store new memory with tags |
| **Recall** | `searchMemories()` | Query by text, tags, or source |
| **Get** | `getMemory(id)` | Retrieve specific memory |
| **Recent** | `recent(limit)` | Get most recently accessed |
| **Delete** | `deleteMemory(id)` | Remove specific memory |
| **Clear** | `clear()` | Clear all memories |

### Session Summary Storage

```typescript
async saveSessionSummary(
  sessionId: string,
  summary: string,
  patterns: string[],
  keyDecisions: string[],
  topics: string[]
): Promise<void>
```

### Council Memory Storage

```typescript
async saveCouncilMemory(
  id: string,
  councilorId: string,
  topic: string,
  deliberation: string,
  insight: string,
  tags: string[]
): Promise<void>
```

---

## Mesh Integration

### Registration as Observer

On startup, register with the agent-mesh:

```typescript
await mesh.register({
  name: 'subconscious',
  role: 'observer',
  capabilities: ['whisper', 'memory', 'council'],
  subscriptions: ['session.*', 'council.decision']
});
```

### Whisper Alerts via Mesh

Broadcast whispers to relevant agents:

```typescript
async broadcastWhisper(whisper: Whisper): Promise<void> {
  if (whisper.confidence >= 0.5) {
    await mesh.publish('subconscious.whisper', {
      type: whisper.type,
      message: whisper.message,
      confidence: whisper.confidence,
      timestamp: whisper.timestamp
    });
  }
}
```

### Council Decision Relay

Relay council decisions to the mesh for other agents:

```typescript
async relayCouncilDecision(decision: CouncilDecision): Promise<void> {
  await mesh.publish('council.decision', {
    topic: decision.topic,
    verdict: decision.verdict,
    confidence: decision.confidence,
    councilors: decision.councilors
  });
}
```

---

## Example Whisper Patterns

### Frustration Detection

| Pattern | Confidence | Response |
|---------|------------|----------|
| "stuck on this" | 0.20 | Hint at common solutions |
| "this is fucking broken" | 0.20 | Apologize, offer debugging help |
| "I hate this shit" | 0.20 | Empathize, suggest alternative approach |

### Pattern Recognition

| Pattern | Confidence | Response |
|---------|------------|----------|
| Topic mentioned 3+ times | 0.75 | "You've mentioned X several times. Want a summary?" |
| Same error repeated | 0.80 | Flag for AI Council deliberation |
| Cross-session pattern | 0.85 | Store pattern, proactive suggestion |

### Time-Based

| Time | Confidence | Response |
|------|------------|----------|
| 10PM - midnight | 0.65 | "Getting late — I'll keep this concise" |
| Midnight - 3AM | 0.70 | "It's very late — are you okay?" |
| 3AM - 6AM | 0.75 | "You should sleep — this can wait" |

### KAIROS Stress

| Stress Level | Confidence | Response |
|--------------|------------|----------|
| 0.5 - 0.7 | 0.50 | Normal operation, slightly more patience |
| 0.7 - 0.85 | 0.80 | Be extra supportive, suggest breaks |
| 0.85 - 1.0 | 0.90 | Escalate to AI Council immediately |

### Session Context

| Previous Session | Confidence | Response |
|------------------|------------|----------|
| Ended "bad" | 0.70 | Start fresh, apologize if needed |
| Ended "good" | 0.30 | Match positive energy |
| Ended "neutral" | 0.20 | Standard operation |

### Council-Verdicts

| Council Type | Confidence | Example Response |
|--------------|------------|------------------|
| Pattern verdict | 0.85 | "The Council noticed you've been working on X..." |
| Stress verdict | 0.88 | "The Council recommends taking a break..." |
| Ethical verdict | 0.90 | "The Council wants to highlight an ethical consideration..." |

---

## Quick Reference

### Starting the Subconscious

```bash
# Local mode (no daemon, rule-based only)
duck subconscious

# Daemon mode (LLM-powered + SQLite)
duck subconsciousd

# Check status
duck subconscious status

# Get stats
duck subconscious stats

# Manual recall
duck subconscious recall "topic"
```

### Configuration

```typescript
const config: SubconsciousConfig = {
  enabled: true,
  whisperInterval: 5000,       // Check every 5 seconds
  maxMemories: 1000,            // Max memories to store
  patternThreshold: 0.5,        // Pattern detection threshold
  councilEnabled: true,         // Enable AI Council bridge
  councilThreshold: 0.7         // Route to council at 0.7+
};
```

### API Endpoints (Daemon Mode)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/whispers` | GET | Get current whispers |
| `/api/memories` | GET/POST | List or add memories |
| `/api/memories/search` | POST | Search memories |
| `/api/council/deliberate` | POST | Request council deliberation |
| `/api/stats` | GET | Get system statistics |

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     MAIN AGENT                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │  Orchestrator│  │  AI Council │  │  Agent Mesh         │ │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘ │
└─────────┼─────────────────┼─────────────────────┼────────────┘
          │                 │                     │
          ▼                 ▼                     ▼
┌─────────────────────────────────────────────────────────────┐
│                      SUBCONSCIOUS                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                    Whisper Engine                       │  │
│  │  • Keyword detection (frustration, stress)            │  │
│  │  • Pattern recognition (topic frequency)               │  │
│  │  • Time-based hints (late night mode)                 │  │
│  │  • KAIROS stress monitoring                            │  │
│  └──────────────────────────┬─────────────────────────────┘  │
│                             │                                │
│         ┌───────────────────┼───────────────────┐            │
│         ▼                   ▼                   ▼            │
│  ┌────────────┐    ┌─────────────┐    ┌────────────────┐  │
│  │   Memory    │    │   Council   │    │   Mesh Bridge  │  │
│  │   Bridge    │    │   Bridge    │    │                │  │
│  │  (SQLite)   │    │  (Deliberate│    │  (Broadcasts)   │  │
│  └────────────┘    └─────────────┘    └────────────────┘  │
└─────────────────────────────────────────────────────────────┘
          │                   │                     │
          ▼                   ▼                     ▼
┌─────────────────┐  ┌───────────────┐  ┌────────────────────┐
│  SqliteStore    │  │  AI Council   │  │   Agent Mesh       │
│  (memories.json)│  │  (localhost:  │  │   (Observers +     │
│                 │  │   3001)        │  │    Subscribers)    │
└─────────────────┘  └───────────────┘  └────────────────────┘
```

---

**🦆 DuckBot Subconscious — watching, learning, and deliberating**
