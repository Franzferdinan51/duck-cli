# Duck Agent Subconscious

Claude Subconscious-style background agent **WITHOUT Letta**.

## Features

- **Background watching** - Learns from session patterns
- **Whisper injection** - Surfaces insights before actions
- **5 Rule-based triggers** (NOT autonomous LLM loops):
  - Keyword (0.2 confidence) - frustration keywords
  - Pattern (0.75 confidence) - topic discussed 3+ times
  - Time (0.65 confidence) - historically challenging hours
  - Frustration (0.70 confidence) - previous session ended rough
  - KAIROS (0.80 confidence) - stress level > 0.7

## NO Letta Dependency

Uses Duck Agent's own:
- Native memory system (in-memory + file-based)
- Providers (MiniMax, Kimi, etc.)
- KAIROS integration

## CLI Commands

```bash
duck subconscious status   # Show state
duck subconscious enable   # Turn on
duck subconscious disable  # Turn off
duck subconscious stats    # Show learnings
duck subconscious reset    # Reset all learned data
```

## Architecture

```
subconscious/
├── index.ts           - Exports
├── types.ts           - Type definitions
├── memory-bridge.ts   - Duck Agent memory connection
├── whisper-engine.ts  - Rule-based triggers
└── subconscious.ts    - Main orchestrator
```

## AI Council Decision

AI Council ruled on priorities:
1. Memory architecture (JSONL + native)
2. Rule-based triggers (not autonomous LLM loops)
3. Aggressive pruning

This implementation follows the council's ruling.

## Usage

```typescript
import { getSubconscious } from './subconscious';

const subconscious = getSubconscious();

// Enable
subconscious.enable();

// Get whispers before action
const whispers = await subconscious.getWhispers({
  message: "I'm stuck on this problem",
  time: new Date(),
  kairosStress: 0.3
});

// Remember something
await subconscious.remember("User likes concise responses", "preference", 0.8);

// Get status
const status = await subconscious.getStatus();
```
