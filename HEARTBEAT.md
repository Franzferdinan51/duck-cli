# HEARTBEAT.md - Duck CLI Health Monitoring

## Automated Health Checks

The duck-cli system includes automated heartbeat monitoring for all core components:

### Components Monitored

1. **Gateway** - Connection to OpenClaw/AI providers
2. **Subconscious Daemon** - Memory and context persistence
3. **Agent Mesh** - Inter-agent communication network
4. **Providers** - AI model availability (MiniMax, Kimi, OpenRouter, LM Studio)
5. **Android Bridge** - Device connectivity
6. **Telegram Bot** - Message transport

### Check Intervals

- **Critical components**: Every 30 seconds
- **Provider health**: Every 60 seconds
- **Full system scan**: Every 5 minutes

### Health Status Levels

- ✅ **Healthy** - Component functioning normally
- ⚠️ **Degraded** - Working with issues (e.g., slow response, optional provider down)
- 🔴 **Critical** - Component failure requiring immediate attention

## Manual Health Check

```bash
# Quick health overview
./duck health

# Detailed component status
./duck health --verbose

# Check specific component
./duck health --component subconscious
./duck health --component mesh
./duck health --component gateway
```

## Automated Recovery

When a component fails health checks:

1. **Auto-restart** - Attempts to restart failed daemons
2. **Failover** - Switches to backup providers
3. **Alert** - Logs failure for investigation
4. **Escalation** - Critical failures trigger notifications

## Heartbeat Log Location

```
~/.duck/logs/heartbeat.log
~/.duck/logs/health-checks.json
```

## Custom Health Checks

Add custom health checks in `~/.duck/config/health-checks.yaml`:

```yaml
custom_checks:
  - name: "My Service"
    command: "curl -f http://localhost:8080/health"
    interval: 60
    timeout: 10
```
