# TOOLS.md — Duck Agent Tool Reference

**For AI agents using or extending duck-cli's tool system.**

---

## Tool Registry

All tools are registered in `src/tools/registry.ts` and exposed through `src/agent/core.ts`.

**Source:** `src/tools/registry.ts`
**Compiled:** `dist/tools/registry.js`

---

## Available Tools (13 total)

### shell ⚠️
**Dangerous** — executes arbitrary shell commands.

```typescript
{
  name: 'shell',
  description: 'Execute shell command',
  schema: {
    command: { type: 'string' }
  },
  dangerous: true
}
```

**Example:**
```json
{ "command": "ls -la" }
```

---

### file_read
Read the contents of a file.

```typescript
{
  name: 'file_read',
  description: 'Read a file',
  schema: {
    path: { type: 'string' }
  }
}
```

**Example:**
```json
{ "path": "/tmp/notes.txt" }
```

---

### file_write ⚠️
**Dangerous** — writes content to a file (creates or overwrites).

```typescript
{
  name: 'file_write',
  description: 'Write to a file',
  schema: {
    path: { type: 'string' },
    content: { type: 'string' }
  },
  dangerous: true
}
```

**Example:**
```json
{ "path": "/tmp/test.txt", "content": "Hello world" }
```

---

### desktop_open
Open an application.

```typescript
{
  name: 'desktop_open',
  description: 'Open an application',
  schema: {
    app: { type: 'string' }
  }
}
```

**Example:**
```json
{ "app": "Safari" }
```

---

### desktop_click
Click at screen coordinates.

```typescript
{
  name: 'desktop_click',
  description: 'Click at coordinates',
  schema: {
    x: { type: 'number' },
    y: { type: 'number' }
  }
}
```

**Example:**
```json
{ "x": 500, "y": 300 }
```

---

### desktop_type
Type text at the current focus.

```typescript
{
  name: 'desktop_type',
  description: 'Type text',
  schema: {
    text: { type: 'string' }
  }
}
```

**Example:**
```json
{ "text": "Hello world" }
```

---

### desktop_screenshot
Capture a screenshot of the screen.

```typescript
{
  name: 'desktop_screenshot',
  description: 'Take a screenshot',
  schema: {}
}
```

**Returns:** Screenshot image data.

---

### memory_remember
Store information in persistent memory.

```typescript
{
  name: 'memory_remember',
  description: 'Remember information',
  schema: {
    content: { type: 'string' },
    type: { type: 'string', optional: true }
  }
}
```

**Example:**
```json
{ "content": "User prefers dark mode", "type": "preference" }
```

---

### memory_recall
Search persistent memory.

```typescript
{
  name: 'memory_recall',
  description: 'Search memories',
  schema: {
    query: { type: 'string' }
  }
}
```

**Example:**
```json
{ "query": "dark mode preferences" }
```

---

### web_search
Search the web.

```typescript
{
  name: 'web_search',
  description: 'Search the web',
  schema: {
    query: { type: 'string' }
  }
}
```

**Example:**
```json
{ "query": "weather in Dayton Ohio" }
```

---

### learn_from_feedback
Learn from feedback to improve future responses.

```typescript
{
  name: 'learn_from_feedback',
  description: 'Learn from feedback to improve future responses',
  schema: {
    success: { type: 'boolean' },
    feedback: { type: 'string', optional: true }
  }
}
```

**Example:**
```json
{ "success": true, "feedback": "Good explanation" }
```

---

### get_metrics
Get agent performance metrics.

```typescript
{
  name: 'get_metrics',
  description: 'Get agent performance metrics',
  schema: {}
}
```

**Returns:**
```json
{
  "totalInteractions": 42,
  "successfulInteractions": 38,
  "failedInteractions": 4,
  "totalCost": 0.0012,
  "totalTokens": 5000,
  "averageConfidence": 0.85
}
```

---

### get_cost
Get cost tracking information.

```typescript
{
  name: 'get_cost',
  description: 'Get cost tracking info',
  schema: {}
}
```

**Returns:**
```json
{
  "total": 0.0012,
  "budget": 10.0,
  "remaining": 9.9988
}
```

---

## New Super Agent Tools (22 total)

### Memory Tools
```typescript
memory_list     // List all memories, filter by type
memory_stats    // Show memory + tool telemetry stats
```

### Planning Tools
```typescript
plan_create     // Create autonomous plan from goal
plan_status     // Show current plan progress
plan_list       // List all active plans
plan_abort      // Abort an active plan
```

### Dangerous Tool Guard Tools
```typescript
guard_check     // Check risk level without executing
guard_log       // Show approval decision log
guard_stats     // Show guard statistics
```

## Adding a New Tool

1. **Edit `src/agent/core.ts`** — find `registerTools()` — find `registerTools()` method
2. **Add your tool definition:**

```typescript
this.registerTool({
  name: 'my_tool',
  description: 'Description of what it does',
  schema: {
    param1: { type: 'string' },
    param2: { type: 'number', optional: true }
  },
  dangerous: false,  // true if it modifies anything
  handler: async (args) => {
    // Implementation
    return { success: true, result: 'output' };
  }
});
```

3. **Rebuild:** `npm run build`
4. **Verify:** `./duck status` → Tools count should increase

---

## Dangerous Tools

Tools marked ⚠️ require extra care. They are logged with a warning indicator. The tool registry supports an approval callback:

```typescript
agent.setApprovalCallback(async (name, args) => {
  // Return true to approve, false to reject
  if (name === 'shell' && args.command.includes('rm -rf')) {
    return false;
  }
  return true;
});
```

---

## Tool Execution Flow

```
agent.think(message)
  → parses message for tool calls
  → agent.tools.execute(toolName, args)
    → checks dangerous flag + approval
    → calls tool.handler(args)
    → returns { success, result, output }
```

---

## Testing Tools

```bash
# Start web UI
./duck web 3001 &

# Test via curl
curl -X POST http://localhost:3001/v1/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Use shell to run: ls"}'

# Or use the interactive shell
./duck shell
# Then type: /quit
```
