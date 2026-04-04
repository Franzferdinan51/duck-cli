# 🎯 Model Routing Guide

> How duck-cli selects the best model for each task.

## Overview

duck-cli uses a **Hybrid Orchestrator** to route tasks to the optimal model based on:
- Task type (Android, vision, coding, reasoning)
- Complexity (1-10 score)
- Cost sensitivity
- Latency requirements

```
Task Input
    │
    ▼
┌─────────────────────┐
│  Task Complexity     │  ← Score 1-10
│  Classifier           │
└──────────┬────────────┘
           │
    ┌──────┴──────┐
    │             │
  Simple      Complex
  (1-6)        (7+)
    │             │
    ▼             ▼
 Fast Path   AI Council
 (no delay)  Deliberation
    │             │
    ▼             ▼
┌─────────────────────┐
│   Model Router      │
│  (keyword + type)   │
└──────────┬───────────┘
           │
           ▼
    ┌──────┴──────┐
    │             │
   Task Type    Model
    Matches     Selected
```

---

## Model Map

| Task Type | Primary Model | Provider | Best For |
|-----------|---------------|----------|----------|
| **Android Control** | `google/gemma-4-e4b-it` | LM Studio | Tap, swipe, type, launch |
| **Vision / Screenshots** | `kimi/kimi-k2.5` | Kimi | Analyze UI, find elements |
| **Fast Tasks** | `minimax/qwen3.5-plus` | MiniMax | Quick Q&A, simple actions |
| **Complex Reasoning** | `minimax/MiniMax-M2.7` | MiniMax | Planning, multi-step |
| **Premium Reasoning** | `openai-codex/gpt-5.4` | OpenAI OAuth | Critical decisions |
| **Local Free** | `lmstudio/qwen/qwen3.5-9b` | LM Studio | Privacy, offline, free |

---

## Routing Logic

### 1. Task Type Detection (Keyword-Based)

```typescript
// Priority order (first match wins)

if (task.includes("android") || task.includes("tap") || 
    task.includes("swipe") || task.includes("open app")) {
  // → Android control → Gemma 4 e4B
  return "lmstudio/google/gemma-4-e4b-it";
}

if (task.includes("screenshot") || task.includes("image") || 
    task.includes("visual") || task.includes("see")) {
  // → Vision task → Kimi K2.5
  return "kimi/kimi-k2.5";
}

if (task.includes("code") || task.includes("debug") || 
    task.includes("implement") || task.includes("build")) {
  // → Coding task → MiniMax glm-5
  return "minimax/glm-5";
}

if (task.includes("research") || task.includes("analyze") || 
    task.includes("investigate")) {
  // → Research task → MiniMax M2.7
  return "minimax/MiniMax-M2.7";
}

// Default → Qwen3.5 Plus (fast + capable)
return "minimax/qwen3.5-plus";
```

### 2. Complexity-Based Routing

```typescript
interface TaskAnalysis {
  complexity: number;      // 1-10
  needsCouncil: boolean;   // complexity >= 7 OR ethical
  recommendedModel: string;
}

// Complexity scoring
function analyzeTask(task: string): TaskAnalysis {
  let score = 0;
  
  // Multi-step: +3
  if (countActions(task) > 3) score += 3;
  
  // Has tradeoffs: +3
  if (hasTradeoffs(task)) score += 3;
  
  // Ethical dimension: +2 (ALWAYS triggers council)
  if (isEthical(task)) score += 2;
  
  // High stakes (money/security): +2
  if (isHighStakes(task)) score += 2;
  
  // Ambiguous intent: +2
  if (isAmbiguous(task)) score += 2;
  
  // External dependencies: +1
  if (hasExternalDeps(task)) score += 1;
  
  const needsCouncil = score >= 7 || isEthical(task);
  
  return {
    complexity: Math.min(score, 10),
    needsCouncil,
    recommendedModel: selectModel(task, score)
  };
}
```

### 3. Model Selection by Complexity

```typescript
function selectModel(task: string, complexity: number): string {
  // High complexity → Premium model
  if (complexity >= 8) {
    return "openai-codex/gpt-5.4";
  }
  
  // Medium complexity → Reasoning model
  if (complexity >= 5) {
    return "minimax/MiniMax-M2.7";
  }
  
  // Task-type specific
  if (isAndroidTask(task)) {
    return "lmstudio/google/gemma-4-e4b-it";
  }
  
  if (isVisionTask(task)) {
    return "kimi/kimi-k2.5";
  }
  
  // Low complexity → Fast model
  return "minimax/qwen3.5-plus";
}
```

---

## Usage Examples

### Android Task (Gemma 4)
```bash
duck run "tap the settings button"
# → Routes to Gemma 4 e4B
# → Perceive→Reason→Act loop
# → Executes tap via ADB
```

### Vision Task (Kimi)
```bash
duck run "what's on my screen?"
# → Routes to Kimi K2.5
# → Captures screenshot
# → Analyzes visual content
```

### Complex Task (Council + Premium)
```bash
duck run "should I upgrade this dependency?"
# → Complexity: 8 (tradeoffs, high stakes)
# → AI Council deliberation
# → Verdict → GPT-5.4 execution
```

### Fast Task (Qwen)
```bash
duck run "what time is it?"
# → Complexity: 1
# → Fast path (no council)
# → Routes to qwen3.5-plus
```

---

## Configuration Options

```typescript
interface ModelRouterConfig {
  preferLocal: boolean;      // Prefer LM Studio models
  preferFree: boolean;         // Prefer free tier
  costSensitive: boolean;     // Minimize API costs
  latencySensitive: boolean;   // Minimize response time
}

// Custom routing
const router = createModelRouter({
  preferLocal: true,      // Use Gemma 4 when possible
  costSensitive: true,    // Minimize API costs
});
```

---

## Cost Optimization

| Scenario | Model Choice | Cost |
|----------|--------------|------|
| **Privacy required** | LM Studio (local) | Free |
| **Android control** | Gemma 4 e4B (local) | Free |
| **Quick Q&A** | Qwen 3.5 9B (local) | Free |
| **Heavy reasoning** | MiniMax M2.7 | API credits |
| **Critical decisions** | GPT-5.4 | OAuth |

---

## Troubleshooting

### Wrong model selected?

Check task keywords - they take priority over complexity:

```bash
# This will use Gemma 4 (Android keyword), not GPT-5.4
duck run "open settings on android"
```

### Need to force a specific model?

```bash
# Use duck-cli with provider override
duck -p lmstudio run "task"
```

---

## Summary

| Situation | Model |
|-----------|-------|
| Android automation | Gemma 4 e4B |
| Screen analysis | Kimi K2.5 |
| Quick local tasks | Qwen 3.5 9B |
| Complex reasoning | MiniMax M2.7 |
| Critical decisions | GPT-5.4 |