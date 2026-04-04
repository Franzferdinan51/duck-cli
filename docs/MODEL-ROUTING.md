# 🎯 Model Routing Guide

> **How duck-cli selects the best AI model for each task.**

**Version:** v0.6.1 — April 4, 2026

---

## Overview

duck-cli's Hybrid Orchestrator uses a **two-stage routing system**:

```
Task Input
    │
    ▼
┌─────────────────────────────────────────┐
│  Stage 1: Task Complexity Classifier    │
│  Scores task 1-10 across 6 dimensions   │
│  Determines if AI Council is needed      │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│  Stage 2: Model Router                  │
│  Selects best model based on:          │
│  • Task type (android, vision, coding)  │
│  • Complexity score                     │
│  • Task dimensions (tradeoffs, stakes) │
└─────────────────┬───────────────────────┘
                  │
                  ▼
            Selected Model
```

---

## Model Map

duck-cli has access to multiple providers with specialized models:

| Provider | Model | Best For | Context | Cost |
|----------|-------|----------|---------|------|
| **LM Studio** | `google/gemma-4-e4b-it` | **Android control** — has vision + tool-calling + Android Studio training | 262K | Free (local) |
| **LM Studio** | `google/gemma-4-26b-a4b` | High-quality local vision + reasoning | 262K | Free (local) |
| **LM Studio** | `qwen/qwen3.5-9b` | Fast local inference + native vision | 32K | Free (local) |
| **LM Studio** | `qwen3.5-27b` | Fast + native vision (27B dense) | 50K | Free (local) |
| **Kimi** | `kimi/kimi-k2.5` | **Vision + coding** — best screenshot analysis | 256K | Pay-per-use |
| **Kimi** | `kimi/kimi-k2` | Coding agent tasks | 256K | Pay-per-use |
| **MiniMax** | `minimax/MiniMax-M2.7` | Complex reasoning + research agents | 196K | Quota |
| **MiniMax** | `minimax/glm-5` | **Coding** — 81.5% MMLU, fast | 128K | API credits |
| **MiniMax** | `minimax/qwen3.5-plus` | **Fast tasks** — 1M context | 1M | Quota |
| **ChatGPT** | `openai-codex/gpt-5.4` | **Premium reasoning** — highest quality | Large | OAuth |
| **OpenRouter** | `qwen/qwen3.6-plus-preview:free` | Free tier fallback | 1M | Free |

---

## Routing Decision Tree

```
Task arrives
    │
    ├─► "android" or "tap" or "swipe" or "adb"
    │       └─► Use: gemma-4-e4b-it (Android-trained vision + tool-calling)
    │
    ├─► "screenshot" or "image" or "photo" or "vision"
    │       └─► Use: kimi-k2.5 (best vision quality)
    │
    ├─► Complexity >= 8
    │       └─► Use: MiniMax-M2.7 (reasoning power)
    │
    ├─► "should I" or "versus" or "tradeoff" or "?"
    │       └─► Use: MiniMax-M2.7 (reasoning)
    │
    ├─► Complexity >= 7 + hasTradeoffs
    │       └─► AI COUNCIL deliberation → verdict → model
    │
    ├─► "code" or "function" or "api" or "bug" or "fix"
    │       └─► Use: glm-5 (coding optimized)
    │
    ├─► High stakes (money/security) + complexity >= 5
    │       └─► Use: gpt-5.4 (premium reasoning)
    │
    └─► Default (simple/fast task)
            └─► Use: qwen3.5-plus (fast + 1M context)
```

---

## Task Type Routing

### Android Control → Gemma 4

**Why Gemma 4?**
- Specifically trained on **Android Studio Agent Mode**
- Has **vision** (can see screenshots)
- Has **autonomous tool-calling** (can execute ADB commands)
- **Local** — runs on your Mac, no API cost
- 4B params — fast enough for real-time use

```typescript
// Routing logic (from model-router.ts)
if (task.includes('android') || task.includes('tap ') || 
    task.includes('swipe') || task.includes('adb')) {
  return 'lmstudio/google/gemma-4-e4b-it';
}
```

**Example tasks:**
- "Take a screenshot of my phone"
- "Tap the settings button"
- "Open Chrome and search for X"
- "Swipe up to dismiss the notification"

### Vision → Kimi K2.5

**Why Kimi K2.5?**
- **Best-in-class vision** — 256K context
- Excellent at reading UI hierarchies
- Good at code/screenshot analysis
- Pay-per-use — only pay for vision tasks

```typescript
if (task.includes('screenshot') || task.includes('image') || 
    task.includes('photo') || task.includes('visual')) {
  return 'kimi/kimi-k2.5';
}
```

**Example tasks:**
- "What's on my screen right now?"
- "Analyze this error screenshot"
- "Read the text in this image"
- "Does this UI look good?"

### Coding → GLM-5

**Why GLM-5?**
- **81.5% MMLU** — strong reasoning
- Fast inference
- Optimized for code generation
- Uses MiniMax API credits (quota-based)

```typescript
if (task.includes('code') || task.includes('function') || 
    task.includes('api') || task.includes('bug') || 
    task.includes('fix') || task.includes('refactor')) {
  return 'minimax/glm-5';
}
```

**Example tasks:**
- "Write a function to sort an array"
- "Fix this bug in my code"
- "Create a REST API endpoint"
- "Refactor this class"

### Fast Tasks → Qwen3.5-Plus

**Why Qwen3.5-Plus?**
- **1M context window** — handles long conversations
- Fast inference
- Good for simple Q&A
- Uses MiniMax quota

```typescript
// Default for complexity <= 3
return 'minimax/qwen3.5-plus';
```

**Example tasks:**
- "What's the weather?"
- "Calculate 15% tip"
- "Define recursion"
- "Translate hello to Spanish"

### Premium Reasoning → GPT-5.4

**Why GPT-5.4?**
- **Highest quality** reasoning model
- Best for complex ethical decisions
- Most nuanced understanding
- Uses ChatGPT OAuth subscription

```typescript
if (highStakes && complexity >= 5) {
  return 'openai-codex/gpt-5.4';
}
```

**Example tasks:**
- "Should I invest in X?"
- "What's the ethical thing to do here?"
- "Help me decide between A and B"
- "Analyze this contract for risks"

### Research → MiniMax-M2.7

**Why M2.7?**
- Fast with generous quota
- 196K context
- Good for agentic tasks
- Powers research sub-agents

```typescript
if (complexity >= 8 || hasTradeoffs) {
  return 'minimax/MiniMax-M2.7';
}
```

**Example tasks:**
- "Research X and summarize findings"
- "Investigate this security issue"
- "Find all references to Y in this codebase"

---

## Complexity-Based Routing

### Complexity Score (1-10)

The Task Complexity Classifier scores tasks based on 6 dimensions:

| Dimension | Keywords | Score Impact |
|-----------|----------|--------------|
| **multiStep** | build, create, setup, configure, deploy, implement | +3 |
| **hasTradeoffs** | should, compare, versus, recommend, pros/cons | +3 |
| **ethicalDimension** | ethical, bias, privacy, safe, harm, moral | +2 |
| **highStakes** | money, security, password, production, destroy | +2 |
| **ambiguous** | maybe, unclear, help, fix, issue, problem | +2 |
| **externalDeps** | api, http, database, github, npm, android | +1 |

### Complexity Zones

| Score | Zone | Route | Council? |
|-------|------|-------|----------|
| 1-3 | **Fast Path** | qwen3.5-plus | No |
| 4-6 | **Standard** | glm-5 / qwen3.5-plus | Optional |
| 7-8 | **Complex** | M2.7 + Council deliberation | Yes |
| 9-10 | **Critical** | gpt-5.4 + Council | Yes |

### Examples

| Task | Complexity | Model | Council? |
|------|------------|-------|----------|
| "What's 2+2?" | 1 | qwen3.5-plus | No |
| "Open settings" | 2 | gemma-4-e4b-it | No |
| "Fix this bug" | 5 | glm-5 | No |
| "Build a REST API" | 6 | glm-5 | No |
| "Should I invest in ETH?" | 7 | M2.7 | Yes |
| "What's the ethical choice?" | 8 | gpt-5.4 | Yes |
| "Plan my entire startup" | 9 | gpt-5.4 | Yes |

---

## Model Selection by Context

### When Multiple Models Match

The router uses **priority-based rules**. Higher priority rules win:

```
Priority 100: android_tap    → gemma-4-e4b-it
Priority  95: android_shot   → gemma-4-e4b-it
Priority  90: vision_shot    → kimi-k2.5
Priority  85: vision_image   → kimi-k2.5
Priority  80: complex_reason → M2.7
Priority  75: tradeoff       → M2.7
Priority  70: high_stakes    → gpt-5.4
...
Priority  10: simple_task    → qwen3.5-plus
```

### Alternatives

When the top model is unavailable, the router provides alternatives:

```typescript
{
  model: 'lmstudio/google/gemma-4-e4b-it',
  reason: 'Android control task - Gemma 4 has Android tool-calling training',
  confidence: 0.95,
  matchedRule: 'android_tap',
  alternatives: [
    { model: 'kimi/kimi-k2.5', reason: 'Fallback - has vision' },
    { model: 'lmstudio/qwen3.5-9b', reason: 'Local fallback' }
  ]
}
```

---

## Configuration

### Prefer Local Models

```typescript
const router = createRouter({
  preferLocal: true  // Prefer LM Studio over API
});
```

### Prefer Free Tier

```typescript
const router = createRouter({
  preferFree: true  // Prefer OpenRouter free models
});
```

### Cost-Sensitive Routing

```typescript
const router = createRouter({
  costSensitive: true  // Prefer free/local models
});
```

### Latency-Sensitive Routing

```typescript
const router = createRouter({
  latencySensitive: true  // Prefer fast models
});
```

---

## Custom Routing Rules

Add your own rules:

```typescript
const router = createRouter({
  customRules: [
    {
      name: 'my_custom_rule',
      priority: 150,  // Higher than built-in rules
      match: (task, analysis) => task.includes('my-keyword'),
      model: 'my-favorite-model',
      reason: 'Matches my custom keyword'
    }
  ]
});
```

---

## Debugging Routing

### Enable Debug Output

```bash
DUCK_ROUTER_DEBUG=1 duck run "your task here"
```

Output:
```
[Router] Task: "take a screenshot"
[Router] Complexity: 3
[Router] Dimensions: { vision: true, multiStep: false }
[Router] Matched rules: android_screenshot, vision_screenshot
[Router] Selected: gemma-4-e4b-it (prio=95)
[Router] Confidence: 0.85
[Router] Alternatives: kimi-k2.5, qwen3.5-9b
```

### List Available Rules

```bash
duck orchestrator list-rules
```

### Force Specific Model

```bash
# Override routing
duck run "your task" --model kimi/kimi-k2.5
```

---

## Quick Reference

```
╔════════════════════════════════════════════════════════════════╗
║                    MODEL ROUTING CHEAT SHEET                    ║
╠════════════════════════════════════════════════════════════════╣
║                                                                ║
║  TASK TYPE              →  MODEL                               ║
║  ──────────────────────────────────────────────────────────    ║
║  Android tap/swipe      →  gemma-4-e4b-it (local)            ║
║  Screenshot/vision       →  kimi-k2.5 (API)                   ║
║  Coding/bug/fix         →  glm-5 (MiniMax)                   ║
║  Research/investigate   →  MiniMax-M2.7 (MiniMax)            ║
║  Fast Q&A/simple         →  qwen3.5-plus (MiniMax)           ║
║  High stakes/ethical     →  gpt-5.4 (ChatGPT OAuth)          ║
║  Free fallback           →  qwen3.6-plus-preview:free        ║
║                                                                ║
║  COMPLEXITY → COUNCIL → MODEL                                  ║
║  ──────────────────────────────────────────────────────────    ║
║  1-3 (fast)     No      qwen3.5-plus                          ║
║  4-6 (medium)   No      glm-5 / qwen3.5-plus                 ║
║  7-8 (complex)  Yes     M2.7 + council verdict               ║
║  9-10 (critical) Yes    gpt-5.4 + council                    ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝
```

---

**Related:**
- [ORCHESTRATOR.md](ORCHESTRATOR.md) — Full orchestrator documentation
- [COUNCIL-INTEGRATION.md](COUNCIL-INTEGRATION.md) — AI Council deliberation
- [SUPER-AGENT-SETUP.md](SUPER-AGENT-SETUP.md) — Running on Android
