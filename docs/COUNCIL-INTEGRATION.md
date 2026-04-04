# 🏛️ AI Council Integration

> **How duck-cli uses the AI Council for complex, ethical, and high-stakes decisions.**

**Version:** v0.6.1 — April 4, 2026

---

## Overview

The AI Council is a **deliberative body** of specialized AI agents that debate and vote on complex tasks. duck-cli's Hybrid Orchestrator automatically engages the council when tasks are sufficiently complex, risky, or ethically nuanced.

```
┌─────────────────────────────────────────────────────────────┐
│                    TASK ENTERS ORCHESTRATOR                  │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          ▼
              ┌───────────────────────────┐
              │  Complexity Score (1-10)  │
              └───────────────────────────┘
                          │
           ┌──────────────┼──────────────┐
           │              │              │
      Score < 7      Score >= 7     User asks
           │              │         "should I"
           ▼              ▼              ▼
     Direct Route   ┌─────────────────────────┐
                    │     AI COUNCIL          │
                    │                         │
                    │  1. Load relevant memory│
                    │  2. Present perspectives│
                    │  3. Deliberate          │
                    │  4. Vote                │
                    │  5. Return verdict      │
                    └───────────┬─────────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │  VERDICT + REASONING  │
                    │  approve / reject /    │
                    │  conditional           │
                    └───────────────────────┘
                                │
                                ▼
                    ┌───────────────────────┐
                    │  Execute with model   │
                    │  recommended by council│
                    └───────────────────────┘
```

---

## When Does the Council Deliberate?

### Automatic Triggers

The orchestrator **automatically** engages the council when:

| Condition | Threshold | Example |
|-----------|-----------|---------|
| **Complexity score** | ≥ 7/10 | "Plan my entire startup" |
| **Ethical dimension** | ANY | "Is it okay to scrape this data?" |
| **High stakes + complexity** | ≥ 5/10 + money/security | "Should I invest $10K in X?" |
| **Tradeoffs** | complexity ≥ 7 | "iPhone vs Pixel for my use case" |
| **Recent failures** | 3+ failures in last hour | Agent keeps failing same task |

### Manual Triggers

You can also **explicitly** ask for council deliberation:

```bash
# Use "should I" phrasing
duck "should I take this job offer?"
duck "should I upgrade to iPhone 17?"

# Or use --council flag
duck run "invest in crypto?" --council
```

### Always Engages For

| Category | Examples |
|----------|----------|
| **Ethical decisions** | Privacy, bias, fairness, manipulation |
| **High financial risk** | Investments, purchases, contracts |
| **Security concerns** | Passwords, data access, authentication |
| **Life decisions** | Career, relationships, major commitments |

---

## Council Modes

The council operates in different **modes** depending on the task type:

### ⚖️ Legislative (Default)

**For:** Policy decisions, rules, guidelines, proposals

```
Mode: legislative
Task: "Should we auto-delete data after 90 days?"
Council:
  Speaker → Facilitates debate
  Technocrat → Technical feasibility
  Ethicist → Moral implications
  Pragmatist → Real-world impact
  Skeptic → Potential problems
  [VOTE] → Approve / Reject / Conditional
```

### 🔬 Research

**For:** Deep investigation, multi-vector analysis

```bash
# Set mode
duck council --mode research "analyze this competitor"
```

```
Mode: research
Task: "Why did our conversion rate drop?"
Council:
  Investigator → Examines data
  Analyst → Statistical patterns
  Expert → Industry context
  Challenger → Alternative explanations
  [REPORT] → Comprehensive briefing
```

### 💻 Swarm Coding

**For:** Large codebases, complex features

```bash
duck council --mode swarm "implement authentication system"
```

```
Mode: swarm
Task: "Build a payment processing system"
Council:
  Architect → System design
  Security → Threat modeling
  Backend → API implementation
  Frontend → UI/UX
  QA → Testing strategy
  [IMPLEMENTATION] → Parallel + coordinated
```

### 📊 Prediction Market

**For:** Forecasting, probability estimation

```bash
duck council --mode prediction "will this feature succeed?"
```

```
Mode: prediction
Task: "Will iPhone sales grow 20% next quarter?"
Council:
  Bull → Arguments for growth
  Bear → Arguments against
  Analyst → Data-driven
  Macro → Economic factors
  [PROBABILITY] → % likelihood with confidence
```

### ❓ Inquiry

**For:** Direct Q&A with full reasoning

```bash
duck council --mode inquiry "explain quantum computing"
```

---

## Council Structure

### Core Councilors

| Councilor | Role | Specialty |
|-----------|------|-----------|
| **Speaker** | Facilitator | Orchestrates debate, summarizes consensus |
| **Technocrat** | Technical | Feasibility, implementation, architecture |
| **Ethicist** | Moral compass | Ethics, bias, fairness, privacy |
| **Pragmatist** | Real-world | Practical outcomes, user impact |
| **Skeptic** | Devil's advocate | Problems, risks, edge cases |
| **Sentinel** | Guardian | Security, safety, compliance |

### Specialist Councilors (19 additional)

| Councilor | Specialty |
|-----------|-----------|
| **Financial** | Money, investments, costs |
| **Legal** | Compliance, liability, contracts |
| **Medical** | Health, wellness, safety |
| **Educational** | Learning, training, documentation |
| **Creative** | Design, UX, branding |
| **+ 13 more** | Industry-specific specialists |

---

## Verdict Interpretation

### Verdict Types

| Verdict | Meaning | Action |
|---------|---------|--------|
| **approve** | Council recommends proceeding | Execute with confidence |
| **reject** | Council recommends against | Do not execute |
| **conditional** | Proceed with modifications | Execute with caution + changes |

### Consensus Score (0-1)

| Score | Meaning |
|-------|---------|
| 0.9-1.0 | Near-unanimous — proceed confidently |
| 0.7-0.9 | Strong agreement — good to proceed |
| 0.5-0.7 | Mixed — consider carefully |
| 0.3-0.5 | Significant disagreement — proceed with caution |
| 0.0-0.3 | Strong rejection — reconsider |

### Example Verdicts

#### approve — High Consensus
```
VERDICT: APPROVE ✓
Consensus: 0.92
Reasoning: "The council unanimously agrees this is the right path.
  Technocrat confirms technical feasibility, Ethicist finds no moral
  concerns, Pragmatist verifies user demand exists."
Recommendations:
  1. Proceed with implementation
  2. Add error handling for edge cases
  3. Monitor user feedback closely
Model: gpt-5.4 (premium reasoning for execution)
```

#### conditional — Split Decision
```
VERDICT: CONDITIONAL ⚠️
Consensus: 0.58
Reasoning: "The council is divided. Technocrat strongly supports,
  but Ethicist raises privacy concerns. Skeptic flags potential
  regulatory issues. Recommend proceeding with safeguards."
Recommendations:
  1. Add user consent dialogs
  2. Implement data anonymization
  3. Consult legal before production
  4. Set up monitoring for complaints
Model: gpt-5.4 (complexity requires premium reasoning)
```

#### reject — Low Consensus
```
VERDICT: REJECT ✗
Consensus: 0.23
Reasoning: "The council strongly opposes this action. Ethicist
  flags serious privacy violations. Sentinel identifies security
  risks. Legal confirms potential liability issues."
Recommendations:
  1. Do NOT proceed with current approach
  2. Redesign with privacy-first architecture
  3. Consult compliance team
  4. Consider alternative that achieves same goal
Model: None — council rejected execution
```

---

## Using the Council (CLI)

### Basic Deliberation

```bash
# Automatic mode (orchestrator decides)
duck "should I launch this feature?"

# Explicit legislative mode
duck council --mode legislative "should we use freemium model?"

# Research mode
duck council --mode research "why is our retention dropping?"

# Force council even for simple tasks
duck "what's 2+2?" --council
```

### Verbose Output

```bash
# See full deliberation process
duck council --verbose "should I hire this candidate?"

# Output:
# [Council] Loading relevant memories...
# [Council] Engaging 6 councilors...
# [Council] Speaker: "Let's examine this from all angles..."
# [Council] Technocrat: "From a technical standpoint..."
# [Council] Ethicist: "The moral dimensions are..."
# [Council] [VOTE] Technocrat: approve, Ethicist: conditional, ...
# [Council] Consensus: 0.78
```

### With Context

```bash
# Pass context to council
duck council --context "budget=50k, timeline=3months" \
  "should we build or buy?"

# Include external data
duck council --data ./analysis.json "recommend strategy"
```

---

## Programmatic Usage

### TypeScript

```typescript
import { createCouncilBridge } from '../orchestrator/council-bridge.js';

const bridge = createCouncilBridge();

// Submit task for deliberation
const verdict = await bridge.submit({
  task: "Should we implement biometric auth?",
  context: { userId: '123', riskLevel: 'high' },
  perspectives: ['security', 'privacy', 'usability'],
  mode: 'legislative',
  urgency: 'normal'
});

console.log(verdict);
// {
//   verdict: 'conditional',
//   reasoning: '...',
//   consensus: 0.71,
//   recommendations: [...],
//   confidence: 0.85
// }
```

### Python

```python
from ai_council_client import CouncilClient

client = CouncilClient("http://localhost:3000")

verdict = client.deliberate(
    task="Should we deploy to production?",
    mode="legislative",
    context={"test_coverage": 0.85, "risk_score": 0.3}
)

if verdict.verdict == "approve":
    print("Council approves - deploying...")
elif verdict.verdict == "reject":
    print("Council rejects - aborting!")
else:
    print(f"Conditional: {verdict.recommendations}")
```

---

## Council + Subconscious Integration

When a task has high **emotional stakes** or relates to past experiences, the Subconscious daemon provides relevant memories to the council:

```
Subconscious Whispers
        │
        ▼ (confidence >= 0.7)
┌───────────────────┐
│  Council Deliberation │
│  includes memory context  │
└───────────────────┘
        │
        ▼
  Richer verdict with
  emotional/personal context
```

### Example

**Task:** "Should I take the job in Seattle?"

```
Subconscious Memory Retrieved:
  - "You moved 3 times in 5 years and felt rootless"
  - "You value proximity to family (visited parents 12x this year)"
  - "Past relocation caused relationship stress"

Council considers: personal stability history
Verdict: CONDITIONAL (with relocation support plan)
```

---

## Configuration

### Enable/Disable Council

```bash
# Enable (default)
duck config set council.enabled true

# Disable (use for testing)
duck config set council.enabled false
```

### Set Timeout

```bash
# Council deliberation timeout (ms)
duck config set council.timeout 30000  # 30 seconds
```

### Set Default Mode

```bash
duck config set council.default_mode legislative
```

### Set Minimum Complexity

```bash
# Only council for complexity >= this
duck config set council.min_complexity 7  # default
```

---

## Troubleshooting

### Council Not Engaging

```bash
# Check if council is enabled
duck config get council.enabled

# Force council for testing
duck "test" --council

# Check complexity score
duck debug --analyze "your task"
# Output includes: "Complexity: X/10, Council: YES/NO"
```

### Slow Deliberation

```bash
# Council takes 2-3 seconds by design
# If too slow:
duck config set council.timeout 10000  # Reduce timeout
duck config set council.enabled false   # Disable for fast path
```

### Verdict Conflicts with Intuition

```
Remember: The council advises, you decide.
Verdicts are recommendations, not commands.
Use your own judgment + council input.
```

---

## Quick Reference

```
╔════════════════════════════════════════════════════════════════╗
║                 AI COUNCIL QUICK REFERENCE                     ║
╠════════════════════════════════════════════════════════════════╣
║                                                                ║
║  AUTOMATIC TRIGGERS:                                          ║
║  • Complexity >= 7                                             ║
║  • Ethical dimension detected                                  ║
║  • High stakes (money/security) + complexity >= 5             ║
║  • 3+ recent failures                                          ║
║                                                                ║
║  MANUAL TRIGGER:                                               ║
║  duck council "should I...?"                                   ║
║  duck "question?" --council                                    ║
║                                                                ║
║  MODES:                                                        ║
║  --mode legislative  → Debate & vote (default)                ║
║  --mode research     → Deep investigation                      ║
║  --mode swarm       → Parallel coding                         ║
║  --mode prediction   → Forecasting                             ║
║  --mode inquiry      → Direct Q&A                              ║
║                                                                ║
║  VERDICTS:                                                     ║
║  approve       → Proceed confidently                          ║
║  reject        → Do not proceed                               ║
║  conditional   → Proceed with modifications                  ║
║                                                                ║
║  CONSENSUS:                                                    ║
║  0.9-1.0 → Near-unanimous                                     ║
║  0.7-0.9 → Strong agreement                                    ║
║  0.5-0.7 → Mixed - consider carefully                         ║
║  0.0-0.5 → Significant disagreement                           ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝
```

---

**Related:**
- [ORCHESTRATOR.md](ORCHESTRATOR.md) — Hybrid orchestrator details
- [MODEL-ROUTING.md](MODEL-ROUTING.md) — How models are selected
- [SUBAGENT-MANAGEMENT.md](SUBAGENT-MANAGEMENT.md) — Parallel subagents
