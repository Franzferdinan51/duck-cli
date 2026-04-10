---
name: android-agent
description: "Run Duck CLI as a local AI agent on Android with perception-reasoning-action loop, supporting multiple LLM backends"
license: MIT
metadata:
  author: duck-cli
  version: "1.0"
---

# Android Local Agent Skill for Duck CLI

## Overview
This skill enables Duck CLI to run as a **local AI agent on Android**, controlling the phone autonomously using a perception → reasoning → action loop (DroidClaw-style architecture).

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    DUCK CLI ANDROID AGENT                    │
│                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────┐  │
│  │  PERCEIVE   │───▶│   REASON    │───▶│      ACT        │  │
│  │             │    │             │    │                 │  │
│  │ • dump UI   │    │ • analyze   │    │ • tap           │  │
│  │ • screenshot│    │ • plan      │    │ • type          │  │
│  │ • read text │    │ • decide    │    │ • swipe         │  │
│  │ • get state │    │ • use LLM   │    │ • launch app    │  │
│  └─────────────┘    └─────────────┘    └─────────────────┘  │
│         │                  │                    │            │
│         │◀──────────── loop back if needed ─────│            │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
              ┌────────────────────────────┐
              │     LLM BACKEND            │
              │  • OpenAI (cloud)          │
              │  • Groq (cloud, free tier)  │
              │  • Ollama (local)           │
              │  • LM Studio (local)       │
              │  • MiniMax (cloud)          │
              └────────────────────────────┘
```

## Prerequisites

### On Mac (Running Duck CLI)
- duck-cli installed
- Android device connected via ADB (USB or WiFi)
- Optional: LM Studio running (for local LLM)

### On Android Phone
- USB debugging enabled
- Termux installed (for advanced features)
- Any app you want to automate

## Quick Start

### 1. Connect Device
```bash
# Via USB
adb devices

# Via WiFi (after enabling tcpip)
adb tcpip 5555
adb connect <phone-ip>:5555
```

### 2. Set Up LLM Provider

Create `~/.duck/agent.env`:
```bash
# Option A: Groq (free, fast)
LLM_PROVIDER=groq
GROQ_API_KEY=gsk_your_key_here

# Option B: OpenAI
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-your_key_here

# Option C: Ollama (local, no API key)
LLM_PROVIDER=ollama
OLLAMA_MODEL=llama3.2
OLLAMA_BASE_URL=http://localhost:11434

# Option D: LM Studio (local, on Mac)
LLM_PROVIDER=lmstudio
LMSTUDIO_MODEL=qwen3.5-9b
LMSTUDIO_BASE_URL=http://192.168.1.81:1234
```

### 3. Run Agent Goal
```bash
# Basic usage
duck agent "open settings and turn on dark mode"

# With specific device
duck agent --device ZT4227P8NK "send a message on WhatsApp"

# Interactive mode
duck agent --mode interactive
```

## Agent Commands

### Execute Goal
```bash
duck agent "open YouTube and search for 'lofi hip hop'"
```

The agent will:
1. **Perceive** - Dump UI, capture screenshot, read screen text
2. **Reason** - Send context to LLM, get action plan
3. **Act** - Execute tap/type/swipe/press
4. **Loop** - Repeat until goal is done or max steps reached

### Workflow Mode
```bash
# Run a predefined workflow (JSON/YAML file)
duck agent --workflow ./workflows/my-task.json

# Example workflow:
{
  "name": "Morning Briefing",
  "steps": [
    {"app": "com.google.android.googlequicksearchbox", "goal": "Check weather"},
    {"app": "com.whatsapp", "goal": "Send good morning to Mom"}
  ]
}
```

### Flow Mode (No LLM, just macros)
```bash
# Execute fixed sequence of taps/types (instant, no AI)
duck agent --flow ./flows/send-whatsapp.yaml

# Example flow:
appId: com.whatsapp
name: Send WhatsApp Message
---
- launchApp
- wait: 2
- tap: 360 1200
- type: "Hello from Duck Agent!"
- press: enter
```

## Agent Configuration

### Environment Variables

```bash
# ~/.duck/agent.env

# LLM Provider (required)
LLM_PROVIDER=groq  # openai, anthropic, groq, ollama, lmstudio, minimax, kimi

# LLM Model (provider-specific)
LLM_MODEL=llama-3.2-3b-preview  # groq default
# LLM_MODEL=gpt-4o-mini          # openai
# LLM_MODEL=llama3.2             # ollama

# API Key (for cloud providers)
OPENAI_API_KEY=sk-...
GROQ_API_KEY=gsk_...

# Local LLM endpoint
OLLAMA_BASE_URL=http://localhost:11434
LMSTUDIO_BASE_URL=http://192.168.1.81:1234

# Agent Behavior
MAX_STEPS=30           # Max actions per goal
STEP_DELAY=500         # ms between actions
SCREENSHOT_ON_ERROR=true

# Autonomous Mode
AUTONOMOUS_ENABLED=false
AUTONOMOUS_INTERVAL=60  # seconds
```

### Programmatic Configuration
```typescript
import { AndroidAgent } from './android-agent.js';

const agent = new AndroidAgent({
  llmProvider: 'groq',
  llmModel: 'llama-3.2-3b-preview',
  maxSteps: 30,
  stepDelay: 500
});

await agent.init();
const result = await agent.executeGoal('open settings');
console.log(result.completed ? 'Success!' : 'Failed');
```

## Advanced Features

### Recovery Mechanisms

The agent has built-in failure recovery:

1. **Stuck Loop Detection** - If same coordinates tapped 3x, inject recovery hints
2. **Drift Detection** - If navigation spam without interaction, nudge toward direct action
3. **Vision Fallback** - If accessibility tree empty (Flutter/WebView), use screenshot
4. **Action Feedback** - Every action result fed to LLM for next step

### Multi-Step Workflows

```bash
# Create a workflow file: research-weather.json
{
  "name": "Weather to WhatsApp",
  "steps": [
    {
      "app": "com.google.android.googlequicksearchbox",
      "goal": "search for weather in Dayton Ohio"
    },
    {
      "goal": "share the weather to WhatsApp contact John"
    }
  ]
}

# Run it
duck agent --workflow research-weather.json
```

### Termux Integration

For fully local operation on the phone:

```bash
# In Termux on phone, install Node.js
pkg update && pkg install nodejs

# Clone Duck CLI
git clone https://github.com/Franzferdinan51/duck-cli

# Run agent locally
cd duck-cli && node dist/cli/main.js agent "automate my morning routine"

# Set up auto-start with Termux:Boot
# Create /data/data/com.termux/files/home/.termux/boot/start-agent.sh
```

### Vision Analysis

The agent can use screenshots for AI analysis:

```bash
# Agent uses vision when:
# 1. Accessibility tree is empty (Flutter, WebView, games)
# 2. Explicitly requested with --vision flag

duck agent --vision "play Pokemon Go and catch a Pikachu"
```

## Use Cases

### 1. Automate Messaging
```bash
duck agent "send good morning to Mom on WhatsApp"
```

### 2. App Control
```bash
duck agent "open YouTube and search for cat videos"
```

### 3. Settings Automation
```bash
duck agent "turn on dark mode and enable battery saver"
```

### 4. Data Collection
```bash
duck agent "check my bank app balance and report total"
```

### 5. Cross-App Workflows
```bash
duck agent "search for a recipe, add ingredients to shopping list, share with friend"
```

## Troubleshooting

### Device Not Connected
```bash
# Check ADB
adb devices

# Restart ADB server
adb kill-server
adb start-server
```

### LLM Connection Failed
```bash
# Check API key
echo $GROQ_API_KEY

# Test connection
curl https://api.groq.com/openai/v1/models \
  -H "Authorization: Bearer $GROQ_API_KEY"

# For local LLM, check if Ollama/LM Studio is running
curl http://localhost:11434/api/tags  # Ollama
curl http://192.168.1.81:1234/v1/models  # LM Studio
```

### Agent Stuck
```bash
# Press Ctrl+C to abort
# Then check what went wrong
duck agent --debug "your goal"

# Or use screenshot to see current state
duck android screenshot
duck android screen
```

### Rate Limits
```bash
# If hitting rate limits, switch provider
export LLM_PROVIDER=ollama  # Local, unlimited
export OLLAMA_MODEL=llama3.2
duck agent "your task"
```

## Integration with DroidClaw

This agent is inspired by DroidClaw's architecture but with key differences:

| Feature | DroidClaw | Duck Agent |
|---------|-----------|------------|
| Runs on | Phone (Termux) | Mac + Phone |
| LLM | Cloud or Ollama | Any provider |
| Connection | USB directly to phone | ADB from Mac |
| Interface | Terminal on phone | CLI on Mac |
| Workflows | JSON | JSON/YAML |
| Flows | YAML | YAML |

DroidClaw's strength: Fully on-phone, no computer needed
Duck Agent's strength: Can use more powerful LLMs, integrated with Mac tools

## Related

- [android-automation](android-automation.md) - Low-level Android tools
- [android-vision](android-vision.md) - AI screen analysis
- [DroidClaw](https://github.com/unitedbyai/droidclaw) - Original Android agent project

## Meta
- Version: 1.0.0
- Author: Duck CLI Team
- Based on: DroidClaw architecture