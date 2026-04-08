# Model Architecture Assignments

## Overview
Duck-cli uses a multi-model architecture where different components use different models optimized for their specific tasks.

## Model Assignments

| Component | Model | Provider | Purpose |
|-----------|-------|----------|---------|
| **Chat Agent** | MiniMax-M2.7 | MiniMax | Primary user-facing chat, handles all incoming messages |
| **Orchestration Agent** | qwen3.5-0.8b | LM Studio | Fast local task routing and orchestration decisions |
| **Bridge (ACP/MCP)** | qwen3.5-0.8b | LM Studio | Protocol bridge operations, agent coordination |
| **Subconscious** | qwen3.5-2b-claude-4.6-opus-reasoning-distilled | LM Studio | Whisper engine, pattern recognition, background analysis |

## Routing Logic

### Chat Agent (MiniMax)
- Handles all user messages
- Simple tasks (complexity ≤ 2): Responds directly
- Complex tasks (complexity ≥ 4): Routes to MetaAgent orchestrator
- Uses qwen3.5-0.8b for fast/simple tasks when LM Studio available

### Orchestration Agent (qwen3.5-0.8b)
- Task classification and routing
- MetaAgent spawning for complex tasks
- Provider/model selection
- Fast local inference, no API costs

### Bridge (qwen3.5-0.8b)
- ACP/MCP protocol handling
- Agent-to-agent communication
- External tool coordination

### Subconscious (qwen3.5-2b-claude-4.6-opus-reasoning-distilled)
- Background pattern matching
- Whisper generation
- Session analysis
- Long-term memory processing

## Configuration

Environment variables for model selection:
```bash
# Chat Agent
DUCK_CHAT_PROVIDER=minimax
DUCK_CHAT_MODEL=MiniMax-M2.7

# Orchestration (via LM Studio)
LMSTUDIO_BASE_URL=http://127.0.0.1:1234/v1

# Subconscious
SUBCONSCIOUS_MODEL=qwen3.5-2b-claude-4.6-opus-reasoning-distilled
```

## Fallback Chain

1. Primary model (as assigned above)
2. LM Studio local models (qwen3.5-0.8b, qwen3.5-9b)
3. MiniMax API (MiniMax-M2.7)
4. Error message with recovery suggestions

## Performance Characteristics

| Model | Speed | Cost | Best For |
|-------|-------|------|----------|
| MiniMax-M2.7 | Fast | API quota | General chat, reasoning |
| qwen3.5-0.8b | Very Fast | Free (local) | Quick tasks, orchestration |
| qwen3.5-2b-claude-4.6-opus-reasoning-distilled | Medium | Free (local) | Complex reasoning, analysis |

## Testing

Verify model assignments:
```bash
# Check chat agent
./duck chat-agent status

# Check orchestration
./duck meta status

# Check bridge
./duck bridge status

# Check subconscious
./duck subconscious status
```
