# Duck Agent Subconscious

**AI Council-Enhanced Background Agent with Pattern Detection**

## Overview

The Subconscious is a background agent that watches, learns, and generates pre-action insights (whispers) WITHOUT requiring a separate Letta service. It uses rule-based triggers + AI Council deliberation for complex decisions.

## Architecture

```
User Message → Subconscious → Rule Engine → [Whisper]
                                     ↓
                              High Confidence?
                                     ↓
                              AI Council Deliberation
                                     ↓
                              [Enhanced Whisper + Verdict]
```

## Features

### 1. Rule-Based Whispers (No Council Needed)

| Trigger | Confidence | Example |
|---------|------------|---------|
| `keyword` | 0.2 | User says "stuck" → "Be patient" |
| `pattern` | 0.75 | Topic discussed 3+ times → "Summarize" |
| `time` | 0.65 | Late night hours → "Be concise" |
| `frustration` | 0.70 | Previous bad session → "Start fresh" |
| `kairos` | 0.80 | High stress → "Be extra supportive" |

### 2. AI Council Deliberation (Complex Cases)

When a whisper has confidence ≥ 0.7, the Subconscious triggers AI Council deliberation:

```
High-confidence whisper detected
    ↓
Build council prompt with context
    ↓
POST to AI Council API (localhost:3001)
    ↓
Council debates (Speaker + Technocrat + Ethicist + Pragmatist + Skeptic)
    ↓
Return verdict + reasoning
    ↓
Add as 'council' whisper type with metadata
```

### 3. Memory Bridge

Stores memories in Duck Agent's native storage:
- Pattern detection across sessions
- Topic frequency tracking
- Importance-weighted recall

## Usage

### Enable/Disable

```typescript
import { getSubconscious } from './subconscious';

const sub = getSubconscious();
sub.enable();
sub.disable();
```

### Get Whispers

```typescript
const context = {
  message: "I'm stuck on this coding problem",
  sessionHistory: ["User asked about APIs", "User asked about databases"],
  time: new Date(),
  kairosStress: 0.8
};

const whispers = await sub.getWhispers(context);
// Returns array of whispers, including AI Council verdict if confidence high
```

### Deliberate on Custom Topic

```typescript
// Ask the council directly
const decision = await sub.deliberateWithCouncil(
  "User keeps asking about the same topic. Should I proactively offer a summary?",
  context
);

console.log(`Verdict: ${decision.verdict}`);
console.log(`Confidence: ${decision.confidence}%`);
console.log(`Reasoning: ${decision.reasoning}`);
```

### Check Status

```typescript
const status = await sub.getStatus();
console.log(status);
// {
//   enabled: true,
//   uptime: 3600000,
//   memoryCount: 42,
//   councilStats: { total: 5, avgConfidence: 0.82, avgDuration: 2300 }
// }
```

## Configuration

```typescript
const sub = getSubconscious({
  whisperInterval: 5000,    // ms between checks
  maxMemories: 1000,         // max memories to store
  patternThreshold: 0.5,     // pattern detection sensitivity
  councilEnabled: true,      // enable AI Council deliberation
  councilThreshold: 0.7      // min confidence to trigger council
});
```

## Whisper Types

| Type | Trigger | Confidence | Council? |
|------|---------|------------|----------|
| `keyword` | Frustration words | 0.2 | ❌ |
| `pattern` | 3+ topic mentions | 0.75 | ✅ |
| `time` | Late night hours | 0.65 | ❌ |
| `frustration` | Previous bad session | 0.70 | ✅ |
| `kairos` | Stress > 0.7 | 0.80 | ✅ |
| `council` | Deliberation result | 0.75+ | — |

## Example Output

```
[Subconscious] High-confidence whisper: kairos (0.85)
[CouncilBridge] Deliberating on: High stress detected - be extra supportive
[CouncilBridge] Verdict: User is frustrated with this task. Break it down into smaller steps. (82% confidence)

Whisper {
  type: 'council',
  message: 'COUNCIL: User is frustrated with this task. Break it down into smaller steps.',
  confidence: 0.82,
  metadata: {
    reasoning: 'Technocrat: Small steps first... | Ethicist: Patient approach...',
    councilors: ['Technocrat', 'Ethicist', 'Pragmatist'],
    duration: 2100
  }
}
```

## CLI Commands

```bash
# Check status
duck subconscious status

# View stats
duck subconscious stats

# Recall memories
duck subconscious recall "topic"

# Get recent council decisions
duck subconscious council

# Trigger manual deliberation
duck subconscious deliberate "should I suggest a break?"
```

## AI Council Integration

The Subconscious connects to the AI Council at `http://localhost:3001/api/deliberate`:

```typescript
const council = getCouncilBridge({
  enabled: true,
  autoDeliberate: true,
  threshold: 0.7,
  councilUrl: 'http://localhost:3001/api/deliberate',
  mode: 'deliberation',
  timeout: 30000
});
```

### Council Modes

- `deliberation` - Standard debate (default)
- `legislative` - Law/policy focus
- `inquiry` - Q&A style
- `research` - Deep investigation

## Daemon Mode

For persistent background operation:

```bash
# Start daemon
duck subconsciousd

# Daemon provides:
# - Continuous whisper generation
# - SQLite memory persistence
# - LLM-powered transcript analysis
# - Council deliberation tracking
```

## Comparison: Before vs After

### Before (Rule-Based Only)
```
User: "I'm so frustrated this isn't working"
→ Whisper: "Be patient, empathetic" (confidence: 0.2)
```

### After (AI Council Enhanced)
```
User: "I've tried 5 times and it's still broken"
→ Whisper: "Be patient, empathetic" (confidence: 0.2)
→ Council Deliberation triggered (confidence: 0.75)
→ Verdict: "Acknowledge the frustration, suggest trying a different approach" (82%)
→ Enhanced Whisper: "COUNCIL: Acknowledge frustration, suggest different approach" (0.82)
```

## Files

- `subconscious.ts` - Main class
- `whisper-engine.ts` - Rule-based trigger engine
- `council-bridge.ts` - AI Council integration
- `memory-bridge.ts` - Memory storage
- `types.ts` - Type definitions
- `index.ts` - Exports

---

**🦆 Powered by duck-cli + AI Council**
