# Duck CLI - Integrated Tools

## External Integrations

### AI Council (`ai-council`)
- **Purpose:** Multi-agent deliberation and voting
- **Start:** `./start-ai-council.sh`
- **Use:** `duck council "what should we build?"`

### BrowserOS (`browseros`)
- **Purpose:** Browser automation with 53+ tools
- **Install:** Download from browseros.com
- **Use:** BrowserOS app handles automation

## Internal Tools

### DuckTools

Located at `~/.duck/tools/`:

| Tool | Purpose |
|------|---------|
| `weather.sh` | Open-Meteo weather API (no key required) |
| `grow-camera-monitor.sh` | Grow tent camera automation |
| `subagent-router.sh` | Auto-route to best model |
| `brain-backup.sh` | Backup all brain files |
| `screenshot-api.sh` | ScreenshotAPI.net screenshots |
| `jsonbin-api.sh` | JSON storage API |
| `ai-council-client.py` | Python client for AI Council |
| `stardew-vision-analysis.py` | Stardew Valley vision AI |
| `stardew-state-monitor.py` | Real-time game state |

### DuckCLI Skills

Located at `~/.duck/skills/`:

| Skill | Purpose |
|-------|---------|
| `code-review` | Automated code review |
| `context-memory` | Persistent semantic memory |
| `git-workflow` | Smart git operations |
| `mcp-manager` | MCP server management |
| `security-audit` | Vulnerability scanning |

## Usage Examples

```bash
# Weather
./tools/weather.sh current -c Dayton

# Screenshot
./tools/screenshot-api.sh quick https://example.com

# Grow monitoring
./tools/grow-twice-daily.sh

# AI Council
python3 tools/ai-council-client.py deliberate "Should we refactor the auth system?"
```
