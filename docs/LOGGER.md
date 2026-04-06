# 🦆 Duck Bridge Logger

Comprehensive logging and error tracking for duck-cli.

## Features

- ✅ Structured JSON logs
- ✅ Protocol-specific logging (MCP, ACP, WebSocket, REST)
- ✅ Real-time WebSocket streaming
- ✅ Error tracking with stack traces
- ✅ Protocol-specific error codes
- ✅ HTTP API for log queries
- ✅ HTML dashboard
- ✅ TTY-aware output (colored CLI vs JSON)
- ✅ Batched async file writes

## Architecture

```
Error/Event
    ↓
Logger.log()
    ↓
┌─────┴─────┐
↓     ↓     ↓
Memory  Console  File
Queue      (TTY)  (async batch)
    ↓
WebSocket
Broadcast
```

## Log Levels

| Level | Value | Description | CLI Color |
|-------|-------|-------------|-----------|
| DEBUG | 0 | Verbose: tool I/O, timing | Gray |
| INFO | 1 | Normal: connections, completions | Cyan |
| WARN | 2 | Attention: retries, invalid input | Yellow |
| ERROR | 3 | Problem: failed tools, protocol errors | Red |
| FATAL | 4 | Critical: crashes, security | Magenta |

## Protocols

| Protocol | Description |
|----------|-------------|
| `mcp` | MCP protocol errors |
| `acp` | ACP agent protocol errors |
| `websocket` | WebSocket connection errors |
| `rest` | REST API errors |
| `system` | Server/system errors |
| `agent` | Agent-level errors |

## HTTP API

### GET /health
Returns full health status.

```bash
curl http://localhost:3850/health
```

Response:
```json
{
  "uptime": 4996,
  "protocols": {
    "mcp": { "status": "healthy", "requests": 0, "errors": 0 },
    "acp": { "status": "healthy", "requests": 0, "errors": 0 },
    "websocket": { "status": "healthy", "requests": 0, "errors": 0 },
    "rest": { "status": "healthy", "requests": 0, "errors": 0 }
  },
  "errors": { "total": 0, "byProtocol": {} },
  "logs": { "total": 0, "byLevel": {} }
}
```

### GET /logs
Query logs with filters.

```bash
# All logs
curl http://localhost:3850/logs

# With limit
curl "http://localhost:3850/logs?limit=50"

# Filter by protocol
curl "http://localhost:3850/logs?protocol=mcp"

# Filter by level (0-4)
curl "http://localhost:3850/logs?level=3"

# Search
curl "http://localhost:3850/logs?search=tool"
```

### GET /errors
Get error list.

```bash
# All errors
curl http://localhost:3850/errors

# Only unresolved
curl "http://localhost:3850/errors?unresolved=true"

# By protocol
curl "http://localhost:3850/errors?protocol=mcp"
```

### GET /dashboard
HTML dashboard (browser).

```
http://localhost:3850/dashboard
```

### WebSocket /logs/stream
Real-time log streaming.

```javascript
const ws = new WebSocket('ws://localhost:3850/logs/stream');
ws.on('message', (data) => {
  const log = JSON.parse(data);
  console.log(log);
});
```

## Error Codes

### MCP Errors
| Code | Description |
|------|-------------|
| MCP_001 | Invalid request |
| MCP_002 | Tool not found |
| MCP_003 | Tool execution failed |
| MCP_004 | Protocol violation |
| MCP_005 | Timeout |

### ACP Errors
| Code | Description |
|------|-------------|
| ACP_001 | Agent crashed |
| ACP_002 | Timeout |
| ACP_003 | Communication error |
| ACP_004 | Agent disconnected |

### WebSocket Errors
| Code | Description |
|------|-------------|
| WS_001 | Connection failed |
| WS_002 | Message parse error |
| WS_003 | Authentication failed |
| WS_004 | Client disconnected |

## CLI Commands

```bash
# Check status
./duck logger status

# View recent logs
./duck logger logs

# View errors
./duck logger errors

# Stream logs
./duck logger tail
```

## Usage in Code

```typescript
import { logger } from './server/logger.js';

// Log levels
logger.debug('mcp', 'handler', 'Detailed debug info');
logger.info('acp', 'agent', 'Agent connected', { agentId: '123' });
logger.warn('rest', 'api', 'Rate limited', { retryAfter: 60 });
logger.error('mcp', 'tool', 'Tool failed', error);
logger.fatal('system', 'server', 'Server crash', error);

// Query
const health = logger.getHealth();
const logs = logger.getLogs({ protocol: 'mcp', level: 3 });
const errors = logger.getErrors({ unresolved: true });
```

## File Location

- Log file: `/tmp/duck-bridge.log`
- Max size: ~10MB (rotated)
- Format: JSON (one entry per line)

## Performance

- In-memory: 1000 logs, 100 errors (bounded)
- File writes: Batched async (100ms interval)
- WebSocket: Non-blocking broadcast
- Console: TTY-aware (colored vs JSON)

## LiveErrorStream

Real-time error streaming via WebSocket on port 3851.

```bash
# Admin connection (full errors)
ws://localhost:3851/errors?admin=true

# Agent connection (filtered)
ws://localhost:3851/errors
```

## Dashboard

Visual dashboard at `http://localhost:3850/dashboard`:
- Protocol health grid
- Recent errors
- Live log stream
- API documentation