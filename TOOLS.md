# TOOLS.md - Duck CLI Tool Reference

## Tool Registry Overview

Duck CLI provides 40+ tools organized into categories. Each tool has:
- **Name**: Unique identifier
- **Description**: What it does
- **Schema**: Input parameters (JSON Schema)
- **Dangerous Flag**: Whether it requires approval
- **Handler**: Implementation function

## Tool Categories

### 1. Desktop Control (macOS/Windows/Linux)

| Tool | Description | Dangerous |
|------|-------------|-----------|
| `desktop_open` | Open an application | No |
| `desktop_click` | Click at screen coordinates | No |
| `desktop_type` | Type text at current focus | No |
| `desktop_screenshot` | Take screenshot (base64 or path) | No |
| `screen_read` | Screenshot + vision AI analysis | No |

**Example:**
```javascript
// Take screenshot for vision analysis
{
  "tool": "screen_read",
  "params": {
    "query": "Find all buttons and input fields"
  }
}
```

### 2. File Operations

| Tool | Description | Dangerous |
|------|-------------|-----------|
| `file_read` | Read file contents | No |
| `file_write` | Write/create file | Yes |

**Examples:**
```javascript
// Read file
{
  "tool": "file_read",
  "params": {
    "path": "/path/to/file.txt",
    "limit": 1000  // optional: truncate after N chars
  }
}

// Write file
{
  "tool": "file_write",
  "params": {
    "path": "/path/to/output.txt",
    "content": "Hello World"
  }
}
```

### 3. Shell Execution

| Tool | Description | Dangerous |
|------|-------------|-----------|
| `shell` | Execute shell command | Yes |

**Example:**
```javascript
{
  "tool": "shell",
  "params": {
    "command": "ls -la",
    "timeout": 30000  // optional: milliseconds
  }
}
```

**Safety Features:**
- Critical risk commands blocked automatically
- High risk commands require approval
- All commands logged
- Output truncated at 5MB

### 4. Web Operations

| Tool | Description | Dangerous |
|------|-------------|-----------|
| `web_search` | Search DuckDuckGo | No |

**Example:**
```javascript
{
  "tool": "web_search",
  "params": {
    "query": "latest TypeScript features"
  }
}
```

### 5. Memory System

| Tool | Description | Dangerous |
|------|-------------|-----------|
| `memory_remember` | Store information | No |
| `memory_recall` | Search memories | No |
| `memory_list` | List all memories | No |
| `memory_stats` | Show memory statistics | No |
| `memory_fts_search` | Full-text search (TF-IDF) | No |

**Examples:**
```javascript
// Remember something
{
  "tool": "memory_remember",
  "params": {
    "content": "User prefers dark mode",
    "type": "preference",
    "tags": "ui,preference"
  }
}

// Recall memories
{
  "tool": "memory_recall",
  "params": {
    "query": "user preferences",
    "limit": 10
  }
}
```

### 6. Sub-Agent Management

| Tool | Description | Dangerous |
|------|-------------|-----------|
| `agent_spawn` | Spawn a sub-agent | No |
| `agent_spawn_team` | Spawn multiple agents | No |
| `think_parallel` | Parallel thinking with N agents | No |
| `agent_list` | List active agents | No |
| `agent_status` | Get agent status | No |
| `agent_cancel` | Cancel an agent | No |
| `agent_wait` | Wait for agent completion | No |

**Examples:**
```javascript
// Spawn single agent
{
  "tool": "agent_spawn",
  "params": {
    "task": "Research best practices for X",
    "role": "researcher",
    "name": "research_1"
  }
}

// Parallel thinking
{
  "tool": "think_parallel",
  "params": {
    "prompt": "How should we architect this system?",
    "perspectives": 3
  }
}
```

### 7. Planning Tools

| Tool | Description | Dangerous |
|------|-------------|-----------|
| `plan_create` | Create autonomous plan | No |
| `plan_status` | Show plan progress | No |
| `plan_list` | List active plans | No |
| `plan_abort` | Abort a plan | No |

**Example:**
```javascript
{
  "tool": "plan_create",
  "params": {
    "goal": "Build a REST API",
    "context": "{\"language\": \"TypeScript\"}"
  }
}
```

### 8. Session Management

| Tool | Description | Dangerous |
|------|-------------|-----------|
| `session_search` | Search past conversations | No |
| `session_list` | List recent sessions | No |
| `session_log` | View session logs | No |
| `sessions_search` | TF-IDF search sessions | No |

### 9. Cron/Scheduling

| Tool | Description | Dangerous |
|------|-------------|-----------|
| `cron_create` | Create scheduled task | No |
| `cron_list` | List scheduled tasks | No |
| `cron_enable` | Enable/disable task | No |
| `cron_delete` | Delete a task | No |
| `cron_stats` | Show cron statistics | No |

**Example:**
```javascript
{
  "tool": "cron_create",
  "params": {
    "name": "daily_backup",
    "schedule": "0 2 * * *",
    "task": "duck backup create",
    "taskType": "shell"
  }
}
```

### 10. Android Tools

| Tool | Description | Dangerous |
|------|-------------|-----------|
| `android_screenshot` | Capture Android screen | No |
| `android_tap` | Tap on screen | No |
| `android_type` | Type text | No |
| `android_shell` | Execute ADB shell | Yes |
| `android_swipe` | Swipe gesture | No |
| `android_press` | Press button | No |
| `android_app` | App management | No |

### 11. Voice/TTS

| Tool | Description | Dangerous |
|------|-------------|-----------|
| `speak` | Text-to-speech | No |

**Example:**
```javascript
{
  "tool": "speak",
  "params": {
    "text": "Hello, this is a test",
    "voice": "narrator"  // or: casual, sad, chinese, japanese, korean
  }
}
```

### 12. KAIROS/Dream

| Tool | Description | Dangerous |
|------|-------------|-----------|
| `dream_status` | Check KAIROS status | No |
| `dream_trigger` | Trigger dream consolidation | No |
| `dream_results` | Get recent dreams | No |
| `kairos_start` | Start KAIROS heartbeat | No |
| `kairos_stop` | Stop KAIROS heartbeat | No |

### 13. Skills

| Tool | Description | Dangerous |
|------|-------------|-----------|
| `skill_create` | Create new skill | No |
| `skill_list` | List auto-skills | No |
| `skill_health` | Check skill health | No |
| `skill_improve` | Improve a skill | No |
| `skill_patterns` | Get ready patterns | No |

### 14. Guard/Security

| Tool | Description | Dangerous |
|------|-------------|-----------|
| `guard_check` | Check risk level | No |
| `guard_log` | Show guard log | No |
| `guard_stats` | Show guard statistics | No |

### 15. Metrics

| Tool | Description | Dangerous |
|------|-------------|-----------|
| `get_metrics` | Get agent metrics | No |
| `get_cost` | Get cost tracking | No |
| `learn_from_feedback` | Learn from feedback | No |

## Tool Result Format

All tools return a standardized result:

```typescript
interface ToolResult {
  success: boolean;
  result?: any;        // Successful result data
  error?: string;      // Error message if failed
  output?: string;     // String representation
  durationMs?: number; // Execution time
}
```

## Tool Retry and Fallback

Tools support automatic retry and fallback:

1. **Retry**: Failed tools retry up to 3 times with exponential backoff
2. **Fallback**: If primary tool fails, fallback tools are attempted
3. **Logging**: All attempts logged for debugging

## Adding New Tools

To add a new tool:

1. Define in `src/agent/core.ts` → `registerTools()`
2. Implement handler function
3. Add to schema
4. Set dangerous flag if needed
5. Rebuild: `npm run build`

**Template:**
```typescript
this.registerTool({
  name: 'my_tool',
  description: 'What it does',
  schema: {
    param1: { type: 'string' },
    param2: { type: 'number', optional: true }
  },
  dangerous: false,
  handler: async (args: any) => {
    // Implementation
    return { success: true, result: 'done' };
  }
});
```

## Tool Registry API

List all tools:
```bash
duck tools list
```

Search tools:
```bash
duck tools search "file"
```

Get tool schema:
```bash
duck tools schema <tool-name>
```

## Best Practices

1. **Prefer safe tools** when possible
2. **Batch operations** to reduce tool calls
3. **Check results** before proceeding
4. **Handle errors** gracefully
5. **Log important actions** to memory

## Troubleshooting

Tool not found:
- Check tool name spelling
- Run `duck tools list` to see available tools
- Ensure tool is registered in `core.ts`

Tool execution failed:
- Check parameters match schema
- Review error message for hints
- Try with simpler inputs first
- Check tool logs: `duck logger logs`
