# 🧠 AI Council Integration

> How duck-cli uses multi-agent deliberation for complex decisions.

## Overview

The AI Council is a **deliberation system** where multiple specialized agents debate and vote on complex tasks. It's triggered automatically for complex tasks (complexity 7+) or can be invoked manually.

```
Simple Task (1-3)          Complex Task (7+)
     │                           │
     ▼                           ▼
 Fast Path                ┌─────────────────┐
 (No delay)               │  AI Council      │
     │                    │  Deliberation    │
     │                    └────────┬─────────┘
     │                             │
     ▼                             ▼
  Execute              ┌────────────────────┐
                      │ Councilors Debate   │
                      │ • Speaker           │
                      │ • Technocrat        │
                      │ • Ethicist          │
                      │ • Pragmatist        │
                      │ • Skeptic           │
                      └────────┬────────────┘
                               │
                               ▼
                      ┌─────────────────┐
                      │    Verdict      │
                      │ approve/reject/ │
                      │ conditional     │
                      └────────┬────────┘
                               │
                               ▼
                          Execute
```

---

## When Council Deliberates

### Automatic Triggers

| Trigger | Confidence | Example |
|---------|-------------|---------|
| Complexity ≥ 7 | 70% | Multi-step refactoring |
| Ethical dimension | 90% | "Should I delete user data?" |
| High stakes | 80% | "Spend $10k on infrastructure" |
| Security concern | 85% | "Grant admin access?" |

### Manual Trigger

```bash
# Force council deliberation
duck council "should I upgrade the database?"

# Or with context
duck council "is this code secure?"
```

---

## Councilors

| Councilor | Focus | Specialty |
|-----------|-------|-----------|
| **Speaker** | Communication | How to phrase/explain |
| **Technocrat** | Technical | Code quality, architecture |
| **Ethicist** | Ethics | Right/wrong, values |
| **Pragmatist** | Practicality | Cost, time, effort |
| **Skeptic** | Risk | What could go wrong |
| **Sentinel** | Security | Threats, vulnerabilities |

---

## Council Modes

### Deliberation (Default)
Standard debate - all councilors weigh in:

```bash
duck council --mode deliberation "should I merge this PR?"
```

### Legislative
Focus on rules/policies:

```bash
duck council --mode legislative "what's our data retention policy?"
```

### Research
Deep investigation:

```bash
duck council --mode research "investigate this security alert"
```

### Prediction
Forecast outcomes:

```bash
duck council --mode prediction "will this scale to 1M users?"
```

---

## Interpreting Verdicts

| Verdict | Meaning | Action |
|---------|---------|--------|
| **approve** | Council supports action | Proceed |
| **reject** | Council opposes action | Don't do it |
| **conditional** | Proceed with caution | Do it with changes |

### Response Format

```json
{
  "verdict": "approve",
  "confidence": 0.85,
  "reasoning": "Technocrat: Good architecture. | Ethicist: No concerns. | Pragmatist: Worth the effort.",
  "recommendations": [
    "Add tests before merging",
    "Monitor performance after deploy"
  ],
  "councilors": ["Technocrat", "Ethicist", "Pragmatist", "Skeptic"]
}
```

---

## Integration with Subconscious

The **Subconscious** can trigger council for emotional/contextual tasks:

```typescript
// Subconscious whispers with confidence ≥ 0.7 trigger council
const whisper = {
  type: 'pattern',
  message: 'User keeps asking about the same topic',
  confidence: 0.8  // Triggers council
};
// → Council deliberates → enhanced whisper with verdict
```

---

## Code Example

```typescript
import { HybridOrchestrator } from './orchestrator';

const orchestrator = createHybridOrchestrator();

// Task automatically routes to council if complex
const result = await orchestrator.execute(
  "should I refactor the authentication system?",
  { autoCouncil: true }
);

// Check if council was engaged
console.log(result.councilVerdict);
// { verdict: 'approve', confidence: 0.78, ... }
```

---

## Subconscious + Council Bridge

The **CouncilBridge** class integrates council into the Subconscious:

```typescript
interface CouncilBridgeConfig {
  enabled: boolean;
  autoDeliberate: boolean;
  threshold: number;        // Min confidence to trigger
  councilUrl: string;      // Council API endpoint
  mode: 'deliberation' | 'legislative' | 'inquiry';
  timeout: number;          // Max deliberation time (ms)
}

// Default config
const config: CouncilBridgeConfig = {
  enabled: true,
  autoDeliberate: true,
  threshold: 0.7,           // Only high-confidence whispers
  councilUrl: 'http://localhost:3001/api/deliberate',
  mode: 'deliberation',
  timeout: 30000            // 30 seconds
};
```

---

## Stats & Monitoring

Track council usage:

```typescript
// Get council stats
const stats = councilBridge.getStats();
// { total: 15, avgConfidence: 0.82, avgDuration: 2300 }

// Get recent decisions
const recent = councilBridge.getRecentDecisions(5);
// [CouncilDecision, ...]
```

---

## CLI Usage

```bash
# Ask the council
duck council "should we use microservices?"

# With mode
duck council --mode legislative "what's our security policy?"

# Verbose output
duck council -v "is this code ethical?"

# Force no council (fast path)
duck run --no-council "simple task"
```

---

## Best Practices

1. **Use for complex decisions** - Council adds latency (~2-3s), use only when needed
2. **Provide context** - More context = better deliberation
3. **Trust the verdict** - Multiple perspectives usually beat single agent
4. **Check confidence** - Low confidence verdicts may need human review

---

## Troubleshooting

### Council timeout?

```typescript
// Increase timeout
const bridge = new CouncilBridge({ timeout: 60000 });
```

### Council not triggering?

```typescript
// Check threshold
const bridge = new CouncilBridge({ 
  autoDeliberate: true,
  threshold: 0.7  // Lower this to trigger more often
});
```

### No response from council?

```bash
# Check if AI Council is running
curl http://localhost:3001/health

# Restart if needed
cd ~/AI-Bot-Council-Concensus && npm run start
```