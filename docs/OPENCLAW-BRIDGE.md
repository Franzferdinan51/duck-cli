# 🔗 OpenClaw Bridge

> Connect duck-cli to OpenClaw gateway for ACP/MCP integration, enabling cross-agent communication and tool sharing.

## Overview

The **OpenClaw Bridge** connects duck-cli to OpenClaw's agent mesh, allowing:

- **ACP Protocol** — Spawn duck-cli agents from OpenClaw
- **MCP Protocol** — Expose duck-cli tools as MCP tools
- **Tool Sharing** — Use duck-cli tools from OpenClaw UI
- **Agent Mesh** — duck-cli joins OpenClaw's multi-agent network

```
┌────────────────────────────────────────────────────────────────┐
│                     OpenClaw Gateway                            │
│              ws://localhost:18789 (default)                     │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  ACP Server (port 18790)                                 │   │
│  │  - Agent spawning                                        │   │
│  │  - Session management                                    │   │
│  │  - Message routing                                       │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  MCP Server (port 3848)                                  │   │
│  │  - Tool definitions (JSON-RPC)                          │   │
│  │  - Tool execution                                        │   │
│  │  - stdio / HTTP transport                                │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  WebSocket (port 18791)                                  │   │
│  │  - Real-time streaming                                   │   │
│  │  - Event subscriptions                                   │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
         │                    │                    │
         │  ACP               │  MCP               │  WebSocket
         ▼                    ▼                    ▼
┌────────────────────────────────────────────────────────────────┐
│                     duck-cli Bridge                             │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  ACP Bridge Client                                       │   │
│  │  - Connect to OpenClaw ACP server                       │   │
│  │  - Receive spawn requests                               │   │
│  │  - Report agent status                                  │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  MCP Bridge Server                                       │   │
│  │  - Expose duck-cli tools as MCP                        │   │
│  │  - Accept tool calls from OpenClaw                      │   │
│  │  - Return results                                       │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  WebSocket Bridge                                        │   │
│  │  - Stream results to OpenClaw UI                        │   │
│  │  - Subscribe to events                                  │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────────────────────────────┐
│                   duck-cli Core                                 │
│  - Orchestrator Core v2 (tool registry)                        │
│  - Android Agent                                                │
│  - 40+ built-in tools                                           │
│  - LLM providers (LM Studio, Kimi, MiniMax, OpenAI)            │
└────────────────────────────────────────────────────────────────┘
```

## Quick Start

### 1. Start OpenClaw Gateway

```bash
# If OpenClaw is not running
openclaw gateway start

# Or use duck-cli to start it (if duck-cli includes gateway)
duck gateway
```

### 2. Connect duck-cli to OpenClaw

```bash
# Basic connection
duck bridge connect --gateway ws://localhost:18789

# With authentication
duck bridge connect \
  --gateway ws://localhost:18789 \
  --token your-auth-token

# Custom ports
duck bridge connect \
  --gateway ws://localhost:18789 \
  --acp-port 18790 \
  --mcp-port 3848
```

### 3. Verify Connection

```bash
# Check bridge status
duck bridge status

# Output:
# Bridge Status: ✅ Connected
# Gateway: ws://localhost:18789
# ACP: ✅ Connected (port 18790)
# MCP: ✅ Connected (port 3848)
# Registered Tools: 42
```

### 4. Register Tools with OpenClaw

```bash
# Register all duck-cli tools as MCP tools
duck bridge register-tools

# Register specific tools
duck bridge register-tools --tools android_screenshot,android_tap

# List registered tools
duck bridge list-tools
```

## ACP Protocol Integration

ACP (Agent Communication Protocol) enables **agent spawning** from OpenClaw:

### Spawn duck-cli from OpenClaw

```bash
# From OpenClaw CLI
openclaw acp spawn --agent duck-cli --task "control android device ZT4227P8NK"

# With options
openclaw acp spawn \
  --agent duck-cli \
  --task "analyze phone screen" \
  --model gemma-4-e4b-it \
  --timeout 300

# Persistent session
openclaw acp spawn \
  --agent duck-cli \
  --task "monitor grow tent" \
  --session grow-monitor \
  --mode persistent
```

### duck-cli as ACP Client

```bash
# Connect to ACP server
duck acp connect ws://localhost:18790

# Spawn external agent
duck acp spawn --agent openclaw --task "run research query"

# List active sessions
duck acp sessions

# Send message to session
duck acp send <session-id> "continue with task"
```

### ACP Message Format

```json
{
  "type": "spawn",
  "agent": "duck-cli",
  "task": "control android",
  "options": {
    "model": "gemma-4-e4b-it",
    "timeout": 300,
    "tools": ["android_screenshot", "android_tap"]
  },
  "replyTo": "session-123"
}
```

## MCP Protocol Integration

MCP (Model Context Protocol) exposes **tools** for use by LLMs:

### How MCP Works

```
┌─────────────┐      MCP JSON-RPC       ┌─────────────────────┐
│  LLM / AI   │ ◄──────────────────►  │  duck-cli MCP       │
│  (OpenClaw) │                        │  Bridge Server       │
└─────────────┘                        │                      │
                                       │  - android_screenshot│
                                       │  - android_tap      │
                                       │  - android_type     │
                                       │  - ...              │
                                       └─────────────────────┘
                                                │
                                                ▼
                                       ┌─────────────────────┐
                                       │  duck-cli Tools     │
                                       │  (Orchestrator)     │
                                       └─────────────────────┘
```

### MCP Tool Definitions

```json
// MCP tool: android_screenshot
{
  "name": "android_screenshot",
  "description": "Capture screenshot from Android device via ADB",
  "inputSchema": {
    "type": "object",
    "properties": {
      "device": {
        "type": "string",
        "description": "Device serial (optional, uses first device)"
      },
      "output": {
        "type": "string",
        "description": "Output path (default: /tmp/screen.png)"
      }
    }
  }
}
```

### MCP Tool Calls

```bash
# Via OpenClaw UI — tools appear in LLM's tool list

# Via MCP client directly
mcp call duck-cli.android_screenshot '{"output": "/tmp/screen.png"}'

# Via mcporter
mcporter call duck-cli.android_screenshot output="/tmp/screen.png"
```

### Expose duck-cli as MCP Server

```bash
# Start MCP server (duck-cli exposes its tools)
duck mcp-server --port 3850

# Other tools can now call duck-cli tools via MCP
mcporter call duck-cli.android_tap device="ZT4227P8NK" x=360 y=720

# OpenClaw can add duck-cli as MCP server:
# Settings → MCP Servers → Add → duck-cli (port 3850)
```

## WebSocket Streaming

Real-time event streaming to OpenClaw UI:

```bash
# Enable streaming
duck bridge connect --gateway ws://localhost:18789 --stream

# Subscribe to events
duck bridge subscribe android_events
duck bridge subscribe agent_status

# Stream results
duck android goal "open settings" --stream
# Real-time output appears in OpenClaw UI
```

## Bridge Commands

```bash
# Connection
duck bridge connect --gateway <url>      # Connect to gateway
duck bridge disconnect                      # Disconnect
duck bridge status                          # Show connection status

# Tool registration
duck bridge register-tools                  # Register all tools
duck bridge register-tools --tools <list>  # Register specific
duck bridge unregister-tools                # Unregister all
duck bridge list-tools                     # List registered tools

# MCP
duck bridge mcp-server                      # Start MCP server
duck bridge mcp-client                      # Connect as MCP client

# ACP
duck bridge acp-server                      # Start ACP server
duck bridge acp-client                      # Connect as ACP client

# Debugging
duck bridge debug                           # Enable debug output
duck bridge logs                            # Show bridge logs
```

## Configuration

### Environment Variables

```bash
# OpenClaw Gateway
export OPENCLAW_GATEWAY="ws://localhost:18789"
export OPENCLAW_TOKEN="your-auth-token"

# ACP
export OPENCLAW_ACP_PORT="18790"

# MCP
export OPENCLAW_MCP_PORT="3848"
export OPENCLAW_MCP_TRANSPORT="stdio"  # or "http"

# Bridge
export DUCK_BRIDGE_STREAM="true"
export DUCK_BRIDGE_TIMEOUT="30000"
```

### config.yaml

```yaml
openclaw:
  gateway: "ws://localhost:18789"
  token: "${OPENCLAW_TOKEN}"
  
acp:
  enabled: true
  port: 18790
  auto_register: true
  
mcp:
  enabled: true
  port: 3848
  transport: "stdio"  # stdio | http
  expose_tools: true
  
websocket:
  enabled: true
  port: 18791
  stream_events: true
  
tools:
  # Which tools to expose via bridge
  expose:
    - android_screenshot
    - android_tap
    - android_type
    - android_launch
    - android_goal
    - clipboard_get
    - clipboard_set
    # ... or "*" for all
  
  # Tools to exclude
  exclude:
    - internal_debug_tool
    - secret_tool
```

## Authentication

### Token-Based Auth

```bash
# Connect with token
duck bridge connect \
  --gateway ws://localhost:18789 \
  --token sk-xxx-xxx-xxx
```

### OAuth (OpenClaw UI)

When connecting via OpenClaw web UI:
1. OpenClaw handles OAuth flow
2. Bridge receives token
3. Token used for all subsequent requests

## Error Handling

### Connection Failures

```bash
# Retry with backoff
duck bridge connect --gateway ws://localhost:18789 --retry

# Check firewall / ports
curl -v ws://localhost:18789

# Verify OpenClaw is running
openclaw gateway status
```

### Tool Call Failures

```bash
# MCP error responses include diagnostic info
{
  "error": {
    "code": -32603,
    "message": "Device not connected",
    "data": {
      "tool": "android_screenshot",
      "device": "ZT4227P8NK",
      "suggestion": "Run 'duck android connect ZT4227P8NK'"
    }
  }
}
```

### Session Management

```bash
# Check active sessions
duck bridge sessions

# Kill stuck session
duck bridge kill <session-id>

# Force reconnect
duck bridge reconnect
```

## Use Cases

### Use Case 1: AI Council Controls Android

```
┌──────────────────────────────────────────────────────────────────┐
│  AI Council (OpenClaw)                                           │
│  - Deliberates: "Should we adjust grow tent humidity?"          │
│  - Votes: Yes (majority)                                        │
│  - Decision: OpenClaw spawns duck-cli agent                      │
└──────────────────────────────────────────────────────────────────┘
                           │
                           │ openclaw acp spawn --agent duck-cli
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│  duck-cli (Android Agent)                                        │
│  - Receives task: "adjust humidity to 50%"                      │
│  - Launches AC Infinity app                                      │
│  - Navigates to humidity setting                                │
│  - Changes to 50%                                                │
│  - Reports completion                                            │
└──────────────────────────────────────────────────────────────────┘
```

### Use Case 2: OpenClaw UI Triggers duck-cli Tools

```
┌──────────────────────────────────────────────────────────────────┐
│  OpenClaw Web UI                                                 │
│  - User clicks "Take Screenshot" button                         │
│  - Sends MCP tool call to duck-cli bridge                       │
└──────────────────────────────────────────────────────────────────┘
                           │
                           │ MCP: android_screenshot
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│  duck-cli MCP Server                                             │
│  - Receives tool call                                           │
│  - Routes to orchestrator                                       │
│  - Executes via Android agent                                   │
│  - Returns screenshot path                                      │
└──────────────────────────────────────────────────────────────────┘
```

### Use Case 3: duck-cli as Part of Agent Mesh

```
┌──────────────────────────────────────────────────────────────────┐
│  Agent Mesh (OpenClaw)                                           │
│                                                                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │ Duck CLI    │  │ OpenClaw    │  │ Claude Code │              │
│  │ (Android)   │◄─┤ (Router)    │◄─┤ (Coding)    │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
│                                                                   │
│  Messages flow through OpenClaw ACP                             │
└──────────────────────────────────────────────────────────────────┘
```

## Troubleshooting

### Gateway Not Reachable

```bash
# Check OpenClaw is running
openclaw gateway status

# Check port is open
nc -zv localhost 18789

# View OpenClaw logs
openclaw gateway logs
```

### MCP Tools Not Appearing

```bash
# Re-register tools
duck bridge unregister-tools
duck bridge register-tools

# Check MCP server is running
curl http://localhost:3848/tools

# Verify tools are exposed in config
duck bridge list-tools
```

### ACP Spawn Not Working

```bash
# Check ACP server
nc -zv localhost 18790

# Verify agent is registered
duck acp list-agents

# Check spawn permissions
openclaw acp permissions
```

## Performance

### Latency

| Operation | Typical Latency |
|-----------|----------------|
| MCP tool call (local) | 5-20ms |
| MCP tool call (remote) | 50-200ms |
| ACP spawn | 100-500ms |
| WebSocket stream | <10ms |

### Rate Limits

OpenClaw gateway may apply rate limits:
- MCP calls: 100/minute (configurable)
- ACP spawns: 10/minute (configurable)
- WebSocket events: 1000/minute (configurable)

## Security

### Tool Permissions

```yaml
# config.yaml - restrict which tools OpenClaw can call
bridge:
  allowed_tools:
    - android_screenshot
    - android_tap
    - clipboard_get
    # Deny dangerous tools
  denied_tools:
    - android_shell  # Too powerful
    - system_exec    # Security risk
```

### Token Scopes

```bash
# Limited token (can only call certain tools)
duck bridge connect \
  --gateway ws://localhost:18789 \
  --token "sk-limited-xxx" \
  --scope "android_read,clipboard"
```

## Related

- [ANDROID-AGENT.md](ANDROID-AGENT.md) — Android tools exposed via bridge
- [ORCHESTRATOR.md](ORCHESTRATOR.md) — Tool registry used by bridge
- [TERMUX-SETUP.md](TERMUX-SETUP.md) — Run OpenClaw on Android
