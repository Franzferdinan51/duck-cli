# HEARTBEAT.md - Duck CLI Periodic Tasks

## Overview

This file defines periodic tasks and health checks for Duck CLI. The system reads this file and executes tasks based on their schedule.

## Task Format

```yaml
- name: Task name
  schedule: cron expression or interval
  command: Command to execute
  description: What this task does
  enabled: true/false
```

## Hourly Tasks

### System Health Check
```yaml
- name: system_health
  schedule: 0 * * * *
  command: duck health --json
  description: Check all services and providers
  enabled: true
```

### Memory Cleanup
```yaml
- name: memory_cleanup
  schedule: 0 * * * *
  command: duck memory cleanup --older-than 30d
  description: Remove old memories to prevent DB bloat
  enabled: true
```

### Log Rotation
```yaml
- name: log_rotation
  schedule: 0 * * * *
  command: duck logger rotate --max-size 100MB
  description: Rotate logs when they exceed size limit
  enabled: true
```

## Daily Tasks (2 AM)

### Self-Improvement Analysis
```yaml
- name: self_improvement
  schedule: 0 2 * * *
  command: duck analyze --patterns --suggest-skills
  description: Analyze usage patterns and suggest improvements
  enabled: true
```

### Backup Configuration
```yaml
- name: config_backup
  schedule: 0 2 * * *
  command: duck backup create --include-config
  description: Backup configuration files
  enabled: true
```

### Skill Health Check
```yaml
- name: skill_health
  schedule: 0 2 * * *
  command: duck skills health --report
  description: Check auto-created skills for issues
  enabled: true
```

### Session Archive
```yaml
- name: session_archive
  schedule: 0 2 * * *
  command: duck sessions archive --older-than 7d
  description: Archive old sessions to compressed storage
  enabled: true
```

## Weekly Tasks (Sunday 3 AM)

### Full System Backup
```yaml
- name: full_backup
  schedule: 0 3 * * 0
  command: duck backup create --full
  description: Create full system backup
  enabled: true
```

### Dependency Update Check
```yaml
- name: update_check
  schedule: 0 3 * * 0
  command: duck update check
  description: Check for available updates
  enabled: true
```

### Security Audit
```yaml
- name: security_audit
  schedule: 0 3 * * 0
  command: duck security audit
  description: Run security audit on configuration
  enabled: true
```

## Continuous Monitoring

### KAIROS Proactive AI
```yaml
- name: kairos_heartbeat
  schedule: continuous
  command: kairos tick
  description: Proactive AI heartbeat for suggestions
  enabled: true
  interval: 5m
```

### Mesh Health Check
```yaml
- name: mesh_health
  schedule: continuous
  command: mesh ping --broadcast
  description: Keep mesh connections alive
  enabled: true
  interval: 30s
```

### Provider Health Monitor
```yaml
- name: provider_health
  schedule: continuous
  command: providers health-check
  description: Monitor provider availability
  enabled: true
  interval: 5m
```

## Event-Driven Tasks

### On Session Start
```yaml
- name: session_init
  trigger: session_start
  command: |
    subconscious whisper --context "New session started"
    mesh broadcast --type session_start
  description: Initialize new session context
  enabled: true
```

### On Task Complete
```yaml
- name: task_complete
  trigger: task_complete
  command: |
    memory remember --type task --content "{{task_result}}"
    kairos signal --type task_complete
  description: Log completed tasks
  enabled: true
```

### On Error
```yaml
- name: error_handler
  trigger: error
  command: |
    logger error --notify
    mesh broadcast --type error --severity {{error_level}}
    if [ "{{error_level}}" = "critical" ]; then
      duck defcon escalate
    fi
  description: Handle errors and alerts
  enabled: true
```

## Manual Tasks

### Deep Analysis (On Demand)
```yaml
- name: deep_analysis
  schedule: manual
  command: |
    duck analyze --full
    duck council "Review recent performance"
    duck skills improve --all
  description: Comprehensive system analysis
  enabled: true
```

### Emergency Diagnostics (On Demand)
```yaml
- name: emergency_diagnostics
  schedule: manual
  command: |
    duck doctor
    duck health --verbose
    duck trace list --recent
    duck logger errors --unresolved
  description: Emergency diagnostic run
  enabled: true
```

## Task Implementation Notes

### For Agent Developers

1. **Schedule Parsing**: Use cron-parser or similar for cron expressions
2. **State Persistence**: Store last run time in `~/.duck/cron/state.json`
3. **Concurrency**: Prevent overlapping runs with lock files
4. **Error Handling**: Log failures but don't block other tasks
5. **Resource Limits**: Set memory/CPU limits for background tasks

### Cron Expression Format

```
* * * * *
│ │ │ │ │
│ │ │ │ └── Day of week (0-7, 0=Sunday)
│ │ │ └──── Month (1-12)
│ │ └────── Day of month (1-31)
│ └──────── Hour (0-23)
└────────── Minute (0-59)
```

Examples:
- `0 * * * *` - Every hour
- `0 2 * * *` - Daily at 2 AM
- `*/5 * * * *` - Every 5 minutes
- `0 3 * * 0` - Weekly on Sunday at 3 AM

### Special Schedules

- `continuous` - Run as daemon with specified interval
- `manual` - Only run when explicitly triggered
- `event:NAME` - Run on specific event

## Monitoring

Check task status:
```bash
duck cron status
duck cron list
duck cron logs --task system_health
```

## Maintenance

Edit this file to add/modify tasks. Changes take effect on next heartbeat check.

## Current Status

- Active Tasks: 12
- Last Run: 2026-04-06 18:58 EDT
- Next Scheduled: 2026-04-06 19:00 EDT (system_health)
