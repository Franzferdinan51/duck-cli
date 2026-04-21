# Agent Council — Deliberation Integration

## Overview

Integrates the AI Council Chamber for adversarial deliberation and multi-agent decision making.

**Council Endpoint:** `http://localhost:3003`

## Council Capabilities

- **45 Councilors** across 8 categories
- **11 Deliberation Modes**
- **Smart Selection** based on topic
- **Vision Council** for image analysis
- **Swarm Coding** for complex builds

## Councilor Categories

| Category | Councilors |
|----------|------------|
| **councilor** | Speaker, Technocrat, Ethicist, Pragmatist, Skeptic |
| **vision** | Visual Analyst, Pattern Recognizer, Color Specialist, Composition Expert, Context Interpreter, Detail Observer, Emotion Reader, Symbol Interpreter |
| **coding** | Architect, Backend, Frontend, DevOps, Security, QA |
| **specialist** | Risk Analyst, Legal Expert, Finance Expert |
| **emergency** | Meteorologist, Emergency Manager |

## Deliberation Modes

| Mode | Use Case |
|------|----------|
| `standard` | General discussion |
| `socratic` | Deep questioning |
| `adversarial` | Conflict resolution |
| `consensus` | Agreement building |
| `creative` | Brainstorming |
| `analytical` | Data analysis |
| `emergency` | Crisis response |
| `vision` | Image analysis |
| `swarm_coding` | Complex builds |
| `game_studio` | Game development |
| `strategic` | Long-term planning |

## API Integration

### Start Deliberation
```bash
curl -X POST http://localhost:3003/api/session \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "Should we use microservices?",
    "mode": "adversarial",
    "councilors": ["technocrat", "ethicist", "pragmatist", "skeptic"]
  }'
```

### Get Session Result
```bash
curl http://localhost:3003/api/session/{session_id}
```

### List Councilors
```bash
curl http://localhost:3003/api/councilors
```

### Vision Analysis
```bash
curl -X POST http://localhost:3003/api/vision \
  -F "image=@image.jpg" \
  -F "topic=Analyze this design"
```

## Team Integration

Add council role to team workflow:

```bash
# Add deliberation task
./team-task.sh add "Council decision on architecture" council

# Spawn council deliberation
./scripts/spawn-council.sh "Is microservices the right choice?" adversarial
```

## Output Format

Council returns structured deliberation:
```json
{
  "session_id": "xxx",
  "topic": "...",
  "mode": "...",
  "verdict": "...",
  "arguments": [...],
  "consensus_score": 0.85,
  "councilors_heard": [...]
}
```

## When to Use

- Complex architectural decisions
- Ethical dilemmas
- Risk assessment
- Strategic planning
- Any decision needing multiple perspectives

## Status

Built: 2026-04-18
