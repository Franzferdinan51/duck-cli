# 🦆 Duck CLI Architecture

> **Duck CLI v2.0.0** — Super Agent with AI Council, Meta-Agent Orchestrator, and Agent Mesh

---

## System Overview

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           Duck CLI v2.0.0 — SUPER AGENT                        │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │                           USER INTERFACE                                 │  │
│  │       CLI (duck run/shell/web) | Telegram | Desktop UI                │  │
│  └────────────────────────────────┬───────────────────────────────────────┘  │
│                                   │                                            │
│  ┌────────────────────────────────▼───────────────────────────────────────┐  │
│  │                    🗣️ CHAT AGENT (MiniMax M2.7)                         │  │
│  │         Conversational, friendly, session memory, multi-provider       │  │
│  │                        Port 18797 HTTP server                          │  │
│  └────────────────────────────────┬───────────────────────────────────────┘  │
│                                   │                                            │
│                    ┌──────────────┴──────────────┐                          │
│                    │                             │                          │
│           Simple chat                  Complex/Ethical/High-stakes          │
│                    │                             │                          │
│                    ▼                             ▼                          │
│         ┌──────────────────┐       ┌──────────────────────────────────┐     │
│         │  Direct MiniMax  │       │   🧠 AI COUNCIL DELIBERATION   │     │
│         │    Response      │       │   (Ethical/High-stakes/Complex) │     │
│         └──────────────────┘       │   Speaker + Technocrat +         │     │
│                                     │   Ethicist + Sentinel +          │     │
│                                     │   Pragmatist                    │     │
│                                     └──────────────┬───────────────────┘     │
│                                                    │ APPROVE / REJECT / MODIFY
│                                                    ▼                          │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                    🌉 BRIDGE AGENT (qwen3.5-0.8b)                      │  │
│  │          Connection health, routing decisions, protocol negotiation     │  │
│  │                    Intercepts ALL tasks after Council                 │  │
│  └────────────────────────────────┬───────────────────────────────────────┘  │
│                                   │                                            │
│                    ┌──────────────┴──────────────┐                          │
│                    │                             │                          │
│           Simple task                  Complex task                         │
│                    │                             │                          │
│                    ▼                             ▼                          │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                  META-AGENT ORCHESTRATOR v3                            │  │
│  │              (LLM-powered: Planner → Critic → Healer → Learner)        │  │
│  │                                                                        │  │
│  │  ┌──────────────────────────────────────────────────────────────────┐  │  │
│  │  │              TASK COMPLEXITY CLASSIFIER (1-10)                   │  │  │
│  │  │                                                                   │  │  │
│  │  │  Dimensions: Ambiguity, Scope, Reversibility, Ethics, Stakes     │  │  │
│  │  └──────────────────────────────┬───────────────────────────────────┘  │  │
│  │                                  │                                        │  │
│  │               ┌──────────────────┼──────────────────┐                    │  │
│  │               ▼                  ▼                  ▼                     │  │
│  │  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────────┐        │  │
│  │  │  SIMPLE (1-3)   │ │ MODERATE (4-6) │ │  COMPLEX (7-10)    │        │  │
│  │  │  Fast path       │ │ Best model      │ │  AI Council first  │        │  │
│  │  └────────┬────────┘ └────────┬────────┘ └──────────┬──────────┘      │  │
│  │           └────────────────────┼──────────────────────┘                   │  │
│  │                                ▼                                            │  │
│  │  ┌──────────────────────────────────────────────────────────────────┐   │  │
│  │  │                      MODEL ROUTER                                   │   │  │
│  │  │                                                                   │   │  │
│  │  │  Android → Gemma 4 e4b  |  Vision → Kimi k2p5                   │   │  │
│  │  │  Coding → MiniMax M2.7   |  Reasoning → qwen3.5-plus           │   │  │
│  │  │  Local free → qwen3.5-0.8b  (LM Studio)                          │   │  │
│  │  └──────────────────────────────┬───────────────────────────────────┘   │  │
│  │                                  │                                        │  │
│  └──────────────────────────────────┼──────────────────────────────────────┘  │
│                                     ▼                                           │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                      🔧 TOOL EXECUTION (102 tools)                       │  │
│  │                                                                        │  │
│  │  Registry with: name, description, category, capability flags,          │  │
│  │  safety level, retry count, fallback behavior                          │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │              🕸️ AGENT MESH (port 4000) — Optional                     │  │
│  │                                                                        │  │
│  │  Inter-agent communication bus:                                        │  │
│  │  • Agent registration + discovery                                       │  │
│  │  • WebSocket real-time messaging                                       │  │
│  │  • Task delegation between agents                                      │  │
│  │  • Health heartbeat monitoring                                        │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                      💾 SUBCONSCIOUS (Pattern Matching)                  │  │
│  │                                                                        │  │
│  │  Whisper engine: monitors conversations, detects patterns,              │  │
│  │  alerts on keywords, routes high-confidence whispers to Council         │  │
│  │                                                                        │  │
│  │  Memory: SQLite-backed persistent storage (pluggable backend)           │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 3 Meta Agents

| Agent | Model | Purpose |
|-------|-------|---------|
| **Bridge Agent** | qwen3.5-0.8b (LM Studio) | Connection health, routing decisions, protocol negotiation |
| **Orchestrator** | qwen3.5-0.8b or MiniMax-M2.7 | Plan→Critic→Healer→Learner loop |
| **Subconscious** | Pattern matching (no model) | Whisper monitoring, alerts, autonomous responses |

---

## Communication Flow

```
User → Chat Agent → AI Council → Bridge Agent → Orchestrator → Tools
                  ↓
            Simple chat → Direct MiniMax response
                  ↓
            Complex → AI Council deliberation
                  ↓
            Bridge Agent (qwen3.5-0.8b) — routing decision
                  ↓
            Orchestrator (MetaAgent) — Plan/Critic/Healer/Learner
                  ↓
            Tools (102 built-in)
                  ↓
            Subconscious — whisper monitoring
```

---

## Provider Architecture

```
┌─────────────────────────────────────────────┐
│              PROVIDER MANAGER                 │
│                                             │
│  MiniMax ──── M2.7, glm-5, glm-4.7, qwen3+ │
│  LM Studio ── Gemma 4 26B/e4b, qwen3.5-0.8b│
│  Kimi ─────── k2p5, k2                      │
│  OpenAI ───── gpt-5.4, gpt-5.4-mini        │
│  OpenRouter ─ qwen3.6-plus-preview:free       │
│  Gateway ──── duck-cli built-in gateway (port 18792)      │
└─────────────────────────────────────────────┘
```

---

## Protocol Layer

| Protocol | Port | Purpose |
|----------|------|---------|
| **MCP Server** | 3850 | Model Context Protocol tools |
| **ACP Server** | 18794 | Agent Communication Protocol |
| **WS Manager** | 18796 | WebSocket real-time |
| **Gateway API** | 18792 | duck-cli built-in REST API (proxies to MiniMax/Kimi/etc.) |
| **Chat Agent** | 18797 | Conversational HTTP server |
| **Agent Mesh** | 4000 | Inter-agent communication (optional) |

---

## Key Files

| Path | Purpose |
|------|---------|
| `src/agent/chat-agent.ts` | Chat Agent — conversational layer |
| `src/orchestrator/meta-agent.ts` | MetaAgent Orchestrator v3 |
| `src/subconscious/subconscious.ts` | Subconscious whisper engine |
| `src/council/chat-bridge.ts` | AI Council deliberation bridge |
| `src/mesh/agent-mesh.ts` | Agent Mesh client |
| `src/providers/manager.ts` | Multi-provider routing |

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| **v2.0.0** | 2026-04-05 | Super Agent with Chat Agent, AI Council, MetaAgent Orchestrator, Agent Mesh |
| v0.4.0 | 2026-03 | Agent Mesh, 45-Agent Council, OpenClaw-RL |
