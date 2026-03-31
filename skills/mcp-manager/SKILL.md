---
name: mcp-manager
description: "Manage MCP servers, tools, and resource access"
triggers:
  - "/mcp"
  - "mcp server"
  - "add mcp"
bins:
  - npx
  - python
  - node
---

# MCP Manager Skill

Model Context Protocol server management.

## Features

- **Server Management**: Add, remove, configure MCP servers
- **Tool Registry**: List and invoke MCP tools
- **Permission Control**: Tool access policies
- **Health Check**: Monitor server status

## Based On

OpenClaw's MCP integration:
- `src/mcp/` - MCP transport handling
- `src/tools/mcp-tools.ts` - Tool exposure
- ACP for inter-agent messaging

## Commands

```bash
# Server management
/mcp add <name> <command>     # Add MCP server
/mcp remove <name>             # Remove server
/mcp list                      # List servers
/mcp status                    # Check health

# Tool access
/mcp tools                     # List available tools
/mcp invoke <tool> <args>     # Call tool

# Configuration
/mcp config                    # Edit config
/mcp reload                    # Reload servers
```

## Server Config

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "."]
    },
    "git": {
      "command": "uvx",
      "args": ["mcp-server-git"]
    }
  }
}
```
