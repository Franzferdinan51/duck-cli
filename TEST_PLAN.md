# 🧪 Duck CLI Comprehensive Test & Fix Plan

## Issues to Fix (Priority Order)

### 1. ✅ Telegram Processing Indicator
- **Status**: Fixed - shows 🦆 now
- **Action**: Verified in compiled JS

### 2. ✅ Chat Context Loss (FIXED)
- **Problem**: Context lost every 5-6 messages or after tool calls
- **Solution**: Persistent session storage to `~/.duck-cli/sessions/{sessionId}.json`
- **Features**: 24-hour TTL, auto-cleanup, loads on startup

### 3. ✅ Chat Agent Bypassing Orchestration (FIXED)
- **Problem**: Chat agent not routing complex tasks to MetaAgent
- **Solution**: Created `chat-agent-orchestrator.ts` with:
  - RAM-aware security model selection (foundation-sec-8b-reasoning with API fallback)
  - Task classification for orchestration routing
  - Proper MetaAgent spawning via `duck meta run`
- **Integration**: Wired into chat-agent.ts processMessage()

### 4. ✅ Telegram /commands (FIXED)
- **Problem**: Limited command support
- **Solution**: Created `telegram-commands.ts` with:
  - /help, /start, /status, /tools, /providers, /models
  - /new, /reset, /compact, /think
  - Extensible command registry
- **Integration**: Wired into telegram.ts

### 5. 🟡 MetaAgent Integration (PENDING TEST)
- **Status**: Code written, needs testing
- **Test**: Verify `duck meta run` works from chat agent

### 6. 🟡 OpenClaw Feature Integration (PENDING)
- **Source**: https://github.com/openclaw/openclaw
- **Features to integrate**:
  - Dreaming/sleep cycles
  - Advanced tool orchestration
  - Multi-agent routing
  - Canvas integration

---

## Implementation Summary

### Files Created/Modified

| File | Status | Description |
|------|--------|-------------|
| chat-session.ts | ✅ | Persistent sessions with disk storage |
| chat-agent-orchestrator.ts | ✅ | Orchestration integration with RAM-aware routing |
| telegram-commands.ts | ✅ | Command handlers with registry pattern |
| telegram.ts | ✅ | Command integration + lazy loading |
| chat-agent.ts | ✅ | Orchestrator wiring in processMessage() |

### Key Features Implemented

1. **Persistent Sessions**
   - JSON storage in `~/.duck-cli/sessions/`
   - 24-hour TTL with auto-cleanup
   - Loads on startup

2. **RAM-Aware Model Selection**
   - Checks available RAM before selecting security model
   - Falls back to API when RAM < 2GB or usage > 85%
   - Uses foundation-sec-8b-reasoning when resources available

3. **Task Classification**
   - Security tasks (complexity 6+)
   - Complex multi-step tasks (complexity 5+)
   - Standard queries (complexity 2-4)
   - Simple queries (complexity 1)

4. **Orchestration Routing**
   - Tasks with complexity >= 4 route to MetaAgent
   - MetaAgent spawns via `duck meta run`
   - Full Plan→Critic→Healer→Learner loop

5. **Telegram Commands**
   - /help, /start, /status
   - /tools, /providers, /models
   - Lazy-loaded command handler

---

## Next Steps

1. **Rebuild and test**
   ```bash
   npm run build
   ```

2. **Test orchestration**
   - Send complex task: "build a web server"
   - Verify MetaAgent is spawned
   - Check output routing

3. **Test Telegram commands**
   - Send /help
   - Send /status
   - Verify responses

4. **Test session persistence**
   - Send 10 messages
   - Verify context retained
   - Restart gateway
   - Verify sessions reload

5. **Commit changes**
   ```bash
   git add -A
   git commit -m "fix: orchestration, session persistence, telegram commands"
   ```

---

## Testing Checklist

- [ ] Build succeeds
- [ ] Telegram /help works
- [ ] Telegram /status works
- [ ] Complex task routes to MetaAgent
- [ ] Session persists after 10 messages
- [ ] Session reloads after restart
- [ ] Security tasks use correct model
- [ ] RAM-aware fallback works

