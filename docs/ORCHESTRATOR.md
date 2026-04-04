# 🎯 Orchestrator Core v2

> Intelligent tool routing with capability-based selection and automatic fallback chains.

## What is the Orchestrator?

The **Orchestrator Core v2** is duck-cli's brain for tool selection. Instead of hardcoding which tool to use for a task, it:

1. **Registers tools** with their capabilities and priorities
2. **Matches tasks** to the best available tool based on capability
3. **Falls back** to alternatives when a tool fails
4. **Routes execution** to the selected tool transparently

```
┌────────────────────────────────────────────────────────────────┐
│                      ORCHESTRATOR CORE v2                       │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    Tool Registry                         │  │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐           │  │
│  │  │ screenshot │ │  clipboard │ │   launch   │  ...      │  │
│  │  │  [cap:*]   │ │  [cap:*]   │ │  [cap:*]   │           │  │
│  │  │  prio: 1   │ │  prio: 1   │ │  prio: 1   │           │  │
│  │  │  [adb]     │ │  [adb]     │ │  [adb]     │           │  │
│  │  └────────────┘ └────────────┘ └────────────┘           │  │
│  │                                                           │  │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐           │  │
│  │  │ screenshot │ │  clipboard │ │   launch   │  ...      │  │
│  │  │  [cap:*]   │ │  [cap:*]   │ │  [cap:*]   │           │  │
│  │  │  prio: 2   │ │  prio: 2   │ │  prio: 2   │           │  │
│  │  │ [scrot]    │ │ [xclip]    │ │ [am]       │           │  │
│  │  └────────────┘ └────────────┘ └────────────┘           │  │
│  │                                                           │  │
│  │  ┌────────────┐ ┌────────────┐                          │  │
│  │  │ screenshot │ │  clipboard │                           │  │
│  │  │  prio: 3   │ │  prio: 3   │  ...                      │  │
│  │  │ [native]   │ │ [native]   │                           │  │
│  │  └────────────┘ └────────────┘                          │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              │                                 │
│  ┌──────────────────────────▼──────────────────────────────┐  │
│  │                   Fallback Manager                        │  │
│  │                                                            │  │
│  │  Task: "capture the screen"                               │  │
│  │                                                            │  │
│  │  1. Try: adb_screenshot (prio=1) ──► ✅ SUCCESS          │  │
│  │     └─► Return screenshot                                 │  │
│  │                                                            │  │
│  │  ─────────────────────────────────────────────────────   │  │
│  │                                                            │  │
│  │  If adb_screenshot FAILS:                                │  │
│  │  2. Try: scrot_screenshot (prio=2) ──► fallback         │  │
│  │                                                            │  │
│  │  If ALL fail:                                             │  │
│  │  3. Return error with diagnostic info                   │  │
│  │                                                            │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
```

## Core Concepts

### Capabilities

Every tool declares **what it can do** via capabilities:

```typescript
// Example: Android screenshot tool
registry.register({
  name: "android_screenshot",
  capabilities: ["screenshot", "capture", "screen_record"],
  priority: 1,      // Try first
  platform: "android",
  handler: async (args) => {
    // Use ADB screencap
    return await adb.screencap();
  }
});

// Example: Desktop screenshot tool
registry.register({
  name: "scrot_screenshot",
  capabilities: ["screenshot", "capture"],
  priority: 2,      // Fallback if android fails
  platform: "linux",
  handler: async (args) => {
    return exec("scrot /tmp/screen.png");
  }
});
```

### Priority & Fallback

Tools with the **same capability** form a fallback chain by priority:

| Priority | Tool | When Used |
|----------|------|-----------|
| 1 | `android_screenshot` | Android device connected |
| 2 | `scrot_screenshot` | Linux desktop, no Android |
| 3 | `native_screenshot` | Last resort, built-in |

### Platform Detection

The orchestrator auto-detects the environment:

```typescript
// Platform detection logic
const platform = detectPlatform();
// platform = "android" | "linux" | "macos" | "windows"

// Only runs tools matching current platform
const tools = registry.getToolsByCapability("screenshot", {
  platform: platform
});
```

## Tool Registry API

### Registration

```typescript
// Register a new tool
registry.register({
  name: "my_tool",
  description: "Does something useful",
  capabilities: ["action", "task"],
  priority: 1,           // 1 = highest, try first
  platform: "any",        // "android" | "linux" | "macos" | "windows" | "any"
  schema: {               // JSON schema for arguments
    type: "object",
    properties: {
      input: { type: "string" }
    }
  },
  handler: async (args, context) => {
    // context = { platform, device, llm, ... }
    return { success: true, result: "done" };
  }
});
```

### Selection

```typescript
// Select best tool for a task
const tool = registry.selectTool({
  task: "take a screenshot",
  requiredCapabilities: ["screenshot"],
  preferredPlatform: "android",
  context: { device: "ZT4227P8NK" }
});

// Execute
const result = await registry.execute(tool, args);
```

### Listing

```typescript
// List all registered tools
const allTools = registry.listTools();

// List by capability
const screenshotTools = registry.getToolsByCapability("screenshot");

// List by platform
const androidTools = registry.getToolsByPlatform("android");
```

### Unregistration

```typescript
// Remove a tool
registry.unregister("old_tool_name");

// Clear all tools of a type
registry.clearByCapability("screenshot");
```

## Built-in Tool Capabilities

### Android Tools

| Capability | Tools (by priority) |
|------------|---------------------|
| `screenshot` | `android_screenshot` → `scrot` → `native` |
| `tap` | `android_tap` → `adb_input` |
| `type` | `android_type` → `adb_input_text` |
| `launch` | `android_launch` → `am_start` |
| `battery` | `android_battery` → `termux_battery` |
| `clipboard` | `android_clipboard` → `termux_clip` |

### Desktop Tools

| Capability | Tools (by priority) |
|------------|---------------------|
| `screenshot` | `scrot` → `gnome-screenshot` → `native` |
| `clipboard` | `xclip` → `pbcopy` → `native` |
| `window` | `wmctrl` → `yabai` → `native` |

### LLM Tools

| Capability | Tools (by priority) |
|------------|---------------------|
| `vision` | `lmstudio_gemma4` → `kimi_k25` → `openai_gpt4o` |
| `reasoning` | `lmstudio_gemma4` → `minimax_m2` → `openai_gpt4` |
| `coding` | `lmstudio_qwen27` → `minimax_glm5` → `kimi_k2` |

## Fallback Flow Examples

### Example 1: Screenshot

```
Task: "take a screenshot"

┌─────────────────────────────────────────────────────────────┐
│ 1. Check platform = "android"                              │
│    └─► Devices: ZT4227P8NK connected                        │
│                                                             │
│ 2. Select tools for capability "screenshot":                │
│    - android_screenshot (prio=1, platform=android) ✅       │
│    - scrot (prio=2, platform=linux) ⛔ wrong platform       │
│    - native_screenshot (prio=3, platform=any)              │
│                                                             │
│ 3. Try: android_screenshot                                  │
│    └─► adb -s ZT4227P8NK shell screencap -p /sdcard/s.png │
│    └─► ✅ SUCCESS — return screenshot                       │
└─────────────────────────────────────────────────────────────┘
```

### Example 2: Screenshot with Fallback

```
Task: "take a screenshot"

┌─────────────────────────────────────────────────────────────┐
│ 1. Platform = "linux" (MacBook)                             │
│    └─► No Android device connected                         │
│                                                             │
│ 2. Select tools for capability "screenshot":               │
│    - android_screenshot (prio=1, platform=android) ⛔      │
│    - scrot (prio=2, platform=linux) ✅                    │
│                                                             │
│ 3. Try: scrot                                              │
│    └─► exec("scrot /tmp/screen.png")                      │
│    └─► ❌ FAILED — scrot not installed                     │
│                                                             │
│ 4. Fallback: Try next tool (prio=3)                        │
│                                                             │
│ 5. Try: native_screenshot (platform=any)                   │
│    └─► Use platform-native API                            │
│    └─► ✅ SUCCESS — return screenshot                      │
└─────────────────────────────────────────────────────────────┘
```

### Example 3: AI Vision with Multiple Providers

```
Task: "analyze this screenshot of my phone"

┌─────────────────────────────────────────────────────────────┐
│ 1. Required capability: "vision"                            │
│                                                             │
│ 2. Available providers ranked:                              │
│    a. LM Studio (gemma-4-e4b-it) — local, fast             │
│    b. Kimi (kimi-k2.5) — API, high quality                │
│    c. OpenAI (gpt-4o) — API, premium                      │
│                                                             │
│ 3. Try: lmstudio_gemma4_vision                             │
│    └─► http://100.68.208.113:1234/v1/chat/completions     │
│    └─► ✅ SUCCESS — return analysis                        │
└─────────────────────────────────────────────────────────────┘
```

## Context-Aware Routing

The orchestrator considers context when selecting tools:

```typescript
// Context includes:
interface OrchestratorContext {
  platform: "android" | "linux" | "macos" | "windows";
  device?: string;           // ADB serial
  llm?: LLMConfig;           // Current LLM
  capabilities: string[];    // Available capabilities
  preferences: UserPrefs;     // User preferences
}

// Example: Route based on device
const tool = registry.selectTool({
  task: "control android",
  requiredCapabilities: ["automation"],
  context: {
    device: "ZT4227P8NK",    // Specific phone
    platform: "android"
  }
});
```

## Implementing Custom Tools

### TypeScript

```typescript
// src/tools/my-tool.ts
import { Tool, ToolRegistry } from "../orchestrator";

export const myTool: Tool = {
  name: "my_custom_tool",
  description: "Does something custom",
  capabilities: ["custom", "action"],
  priority: 5,
  platform: "any",
  schema: {
    type: "object",
    properties: {
      input: { type: "string" },
      count: { type: "number", default: 1 }
    }
  },
  handler: async (args, ctx) => {
    const { input, count = 1 } = args;
    
    // Do something
    for (let i = 0; i < count; i++) {
      console.log(`${i + 1}. ${input}`);
    }
    
    return {
      success: true,
      output: `Printed "${input}" ${count} times`
    };
  }
};

// Register
registry.register(myTool);
```

### Shell Script

```bash
#!/bin/bash
# tools/my-shell-tool.sh
# Called by orchestrator when this tool is selected

INPUT="$1"
COUNT="${2:-1}"

for i in $(seq 1 $COUNT); do
    echo "$i. $INPUT"
done
```

### Integration with Registry

```typescript
// Register shell tool
registry.register({
  name: "my_shell_tool",
  capabilities: ["custom"],
  priority: 10,
  platform: "any",
  type: "shell",
  command: "./tools/my-shell-tool.sh",
  args: ["{{input}}", "{{count}}"]
});
```

## Performance

### Tool Selection Overhead

| Scenario | Latency |
|----------|---------|
| Direct call | < 1ms |
| Registry lookup + call | ~2-5ms |
| Fallback chain (1 fallback) | ~5-10ms |
| Fallback chain (3 fallbacks) | ~15-30ms |

### Caching

```typescript
// Tools are registered once at startup
// Selection uses cached capability map
// Only re-scans on register/unregister

registry.register(tool);      // Invalidates cache
registry.unregister(name);     // Invalidates cache
registry.clearByCapability(); // Invalidates cache

// Get tools (uses cache)
registry.getToolsByCapability("screenshot");  // Fast ~0.1ms
```

## Debugging

### List Registered Tools

```bash
# See all tools
duck orchestrator list

# Filter by capability
duck orchestrator list --capability screenshot

# Filter by platform
duck orchestrator list --platform android
```

### Trace Tool Selection

```bash
# Enable debug output
DUCK_ORCHESTRATOR_DEBUG=1 duck run "take a screenshot"

# Output:
# [Orchestrator] Task: "take a screenshot"
# [Orchestrator] Required: ["screenshot"]
# [Orchestrator] Platform: android
# [Orchestrator] Selected: android_screenshot (prio=1)
# [Orchestrator] Executing...
# [Orchestrator] ✅ Success (23ms)
```

### Force Specific Tool

```bash
# Bypass fallback, use specific tool
duck run "take a screenshot" --tool scrot

# Force fallback to lower priority
duck run "take a screenshot" --force-fallback
```

## Configuration

### config.yaml

```yaml
orchestrator:
  # Default fallback timeout (ms)
  fallback_timeout: 5000
  
  # Enable debug logging
  debug: false
  
  # Max fallbacks per task
  max_fallbacks: 3
  
  # Platform auto-detect
  auto_detect_platform: true
  
  # Preferred platforms (tried in order)
  preferred_platforms:
    - android
    - linux
    - macos
    - windows

tools:
  # Tool-specific overrides
  android_screenshot:
    priority: 1
    enabled: true
    
  scrot:
    priority: 2
    enabled: true
```

## Error Handling

```typescript
// Tool returns structured error
interface ToolResult {
  success: boolean;
  output?: any;
  error?: {
    code: string;
    message: string;
    tool: string;
    fallback?: string;  // Suggested fallback
  };
}

// Fallback on error
const result = await registry.executeWithFallback({
  task: "screenshot",
  fallbacks: ["scrot", "native_screenshot"],
  timeout: 5000
});

if (!result.success) {
  console.log(`All tools failed. Last error: ${result.error.message}`);
  console.log(`Tried: ${result.error.tool}`);
}
```

## Complexity Scoring System (v2)

The orchestrator scores every task 1-10 across **6 dimensions** to determine complexity and route decisions:

### Scoring Dimensions

| Dimension | Score | Keywords That Trigger |
|-----------|-------|----------------------|
| **multiStep** | +3 | build, create, setup, configure, install, deploy, implement, architect, orchestrate |
| **hasTradeoffs** | +3 | should, compare, versus, tradeoff, recommend, pros, cons, choose, decide |
| **ethicalDimension** | +2 | ethical, moral, bias, privacy, consent, harm, safe, responsible |
| **highStakes** | +2 | money, cost, security, password, production, destroy, delete, financial |
| **ambiguous** | +2 | maybe, unclear, unsure, help, fix, issue, problem, broken, not working |
| **externalDeps** | +1 | api, http, database, github, npm, android, service, server |

### Complexity Zones

```
┌─────────────────────────────────────────────────────────────┐
│ COMPLEXITY SCORING                                          │
│                                                             │
│  1-3  │  ████░░░░░░░░░░░  │ Fast path — direct routing   │
│       │                     │ qwen3.5-plus / gemma-4        │
│  4-6  │  ████████░░░░░░░  │ Standard — best model        │
│       │                     │ glm-5 / qwen3.5-plus          │
│  7-8  │  ████████████░░░  │ Complex — AI Council          │
│       │                     │ deliberation required         │
│  9-10 │  ██████████████  │ Critical — premium model      │
│       │                     │ gpt-5.4 + full council        │
└─────────────────────────────────────────────────────────────┘
```

### Complexity Analysis Output

```typescript
interface TaskAnalysis {
  complexity: number;        // 1-10
  needsCouncil: boolean;     // Auto-triggered at 7+
  recommendedModel: string;  // Best model for task
  reasoning: string;         // Why this score
  dimensions: TaskDimensions;
  urgency: 'low' | 'normal' | 'high' | 'critical';
  estimatedTimeMs: number;   // Expected execution time
  keywords: string[];         // Matched keywords
}
```

### Example Scores

| Task | Dimensions Detected | Score | Route | Council? |
|------|---------------------|-------|-------|----------|
| "What's 2+2?" | none | 1 | qwen3.5-plus | No |
| "Open settings" | android | 2 | gemma-4-e4b-it | No |
| "Fix this bug" | code + ambiguous | 5 | glm-5 | No |
| "Build REST API" | multiStep + code | 6 | glm-5 | No |
| "Should I invest $10K?" | highStakes + tradeoff | 7 | M2.7 + council | **Yes** |
| "Plan startup exit" | multiStep + highStakes | 9 | gpt-5.4 + council | **Yes** |

### Council Auto-Trigger Conditions

The council **automatically** engages when:
- Complexity ≥ 7
- Any ethical dimension detected
- HighStakes + complexity ≥ 5
- 3+ recent failures (same task type)

### Debug Complexity Scoring

```bash
# See full analysis
DUCK_ORCHESTRATOR_DEBUG=1 duck run "your task here"

# Output includes:
# [Complexity] Task: "your task"
# [Complexity] Keywords: [multiStep, android]
# [Complexity] Score: 4/10
# [Complexity] Council: No
# [Complexity] Recommended: gemma-4-e4b-it
```

## Related

- [ANDROID-AGENT.md](ANDROID-AGENT.md) — Android tools using orchestrator
- [OPENCLAW-BRIDGE.md](OPENCLAW-BRIDGE.md) — OpenClaw tools via MCP
- [COMMANDS.md](COMMANDS.md) — CLI commands for orchestrator
- [MODEL-ROUTING.md](MODEL-ROUTING.md) — Model selection guide
- [COUNCIL-INTEGRATION.md](COUNCIL-INTEGRATION.md) — AI Council usage
- [SUBAGENT-MANAGEMENT.md](SUBAGENT-MANAGEMENT.md) — Parallel subagents
