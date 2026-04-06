# 🌙 Dreaming Integration — OpenClaw Memory Consolidation

**Version:** v2.0.0 — April 2026

---

## What is Dreaming?

Dreaming is OpenClaw's **optional background memory consolidation** system. It helps move strong short-term signals into durable memory while keeping the process explainable and reviewable.

**Three phases:**
| Phase | Purpose | Writes MEMORY.md? |
|-------|---------|-------------------|
| **Light** | Sort and stage recent short-term material | No |
| **Deep** | Score and promote durable candidates | **Yes** |
| **REM** | Reflect on themes and recurring ideas | No |

---

## How it Works

1. **Light phase** ingests recent daily memory signals and recall traces, dedupes them, and stages candidate lines
2. **Deep phase** ranks candidates using weighted scoring and threshold gates, promotes to MEMORY.md
3. **REM phase** extracts patterns and reflective signals from recent short-term traces

**Weighted scoring:**
| Signal | Weight | Description |
|--------|--------|-------------|
| Frequency | 0.24 | How many short-term signals accumulated |
| Relevance | 0.30 | Average retrieval quality |
| Query diversity | 0.15 | Distinct query/day contexts |
| Recency | 0.15 | Time-decayed freshness |
| Consolidation | 0.10 | Multi-day recurrence strength |
| Conceptual richness | 0.06 | Concept-tag density |

---

## Duck-cli Integration

### Enable Dreaming

Add to `~/.openclaw/openclaw.json`:

```json
{
  "plugins": {
    "entries": {
      "memory-core": {
        "enabled": true,
        "config": {
          "dreaming": {
            "enabled": true,
            "frequency": "0 3 * * *"
          }
        }
      }
    }
  }
}
```

### Dreaming Commands

```bash
# Check status
openclaw memory status --deep

# Enable/disable
/dreaming on
/dreaming off

# Manual promote
openclaw memory promote --apply
openclaw memory promote --limit 5

# Preview REM reflections
openclaw memory rem-harness

# Explain why candidate would/wouldn't promote
openclaw memory promote-explain "topic"
```

---

## Enhancing Duck-cli's Kairos Engine

The Kairos heartbeat system + Dreaming creates a powerful memory pipeline:

```
Kairos (heartbeat) → Short-term memory → Dreaming → Long-term memory
                            ↓
                       DREAMS.md (Dream Diary)
```

**Duck-cli integration:**
1. Kairos runs every 30s, tracking system state
2. Dreaming runs at 3 AM (configurable), consolidating Kairos insights
3. Deep phase promotes important patterns to MEMORY.md
4. Dream Diary (DREAMS.md) provides human-readable summaries

---

## Kairos + Dreaming Synergy

| Kairos provides | Dreaming does |
|-----------------|---------------|
| Real-time heartbeat | Background consolidation |
| System stress detection | Pattern extraction |
| Anomaly flags | Memory promotion |
| Session context | Thematic reflection |

---

## Configuration

```json
{
  "plugins": {
    "entries": {
      "memory-core": {
        "enabled": true,
        "config": {
          "dreaming": {
            "enabled": true,
            "frequency": "0 3 * * *",
            "timezone": "America/New_York"
          }
        }
      }
    }
  }
}
```

**Default:** 3 AM daily sweep (`0 3 * * *`)

---

## Output Files

- **DREAMS.md** — Dream Diary for human review
- **memory/dreaming/YYYY-MM-DD.md** — Phase summaries
- **memory/.dreams/** — Machine state (recall store, phase signals)

---

**Last Updated:** April 6, 2026
