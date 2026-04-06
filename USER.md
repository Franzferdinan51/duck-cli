# USER.md - Duck CLI User Guide

## For End Users

### Getting Started

1. **Installation**: See INSTALL.md
2. **Configuration**: Copy `.env.example` to `.env` and add your API keys
3. **First Run**: `./duck run "Hello!"`

### Common Commands

```bash
# Basic chat
./duck run "What's the weather in Tokyo?"

# Web search
./duck run "search for latest AI news"

# File operations
./duck run "read the README.md file"
./duck run "create a file called notes.txt with my ideas"

# Meta-agent for complex tasks
./duck meta run "research Python async patterns and create a summary"

# Android control (if device connected)
./duck android screen
./duck android tap 500 800
```

### Configuration

Edit `~/.duck/config.yaml`:

```yaml
default_provider: lmstudio
default_model: qwen3.5-0.8b
subconscious:
  enabled: true
  persistence: sqlite
mesh:
  enabled: true
  port: 4000
```

### Troubleshooting

**Issue**: Commands not executing  
**Fix**: Check `./duck health` and ensure providers are configured

**Issue**: Context lost between sessions  
**Fix**: Ensure subconscious daemon is running: `./duck subconscious status`

**Issue**: Meta-agent not spawning subagents  
**Fix**: Check mesh status: `./duck mesh status`

## For Developers

### Architecture Overview

Duck CLI consists of:
- **Core Agent** (`src/agent/core.ts`) - Main orchestration
- **Chat Agent** (`src/agent/chat-agent.ts`) - HTTP API server
- **Subconscious** (`src/daemons/subconsciousd.ts`) - Context persistence
- **Mesh** (`src/mesh/`) - Inter-agent communication
- **Bridge** (`src/bridge/`) - External integrations

### Adding Tools

Edit `src/agent/core.ts`:

```typescript
this.registerTool({
  name: 'my_tool',
  description: 'Does something useful',
  schema: { param: { type: 'string' } },
  handler: async (args) => {
    // Implementation
    return { result: 'success' };
  }
});
```

### Adding Skills

Create `skills/my-skill/SKILL.md` following the skill template.

### Testing

```bash
# Run all tests
npm test

# Test specific component
npm test -- --grep "agent"

# E2E test
./duck test e2e
```

## Advanced Usage

### Custom Providers

Add to `src/providers/`:

```typescript
export class MyProvider implements Provider {
  name = 'my-provider';
  async complete(opts) {
    // Call your API
    return { text: result };
  }
}
```

### Agent Mesh Integration

Register your agent:

```bash
./duck mesh register --id my-agent --role worker
./duck mesh broadcast "Hello from my-agent"
```

### Subconscious API

Access memories programmatically:

```typescript
const client = new SubconsciousClient();
await client.save({ content: 'Important context' });
const memories = await client.recall('context', 5);
```
