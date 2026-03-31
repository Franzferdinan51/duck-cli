#!/bin/bash
# =============================================================================
# code-failure-recover.sh - DuckBot Cron Failure Recovery Script
# =============================================================================
# On cron failure, attempts to recover known tasks
# Checks /tmp/ and log files for failed cron jobs
# After 3 failures, alerts to Telegram 647890
# =============================================================================

set -euo pipefail

# Configuration
readonly LOG_FILE="/tmp/failure-recover.log"
readonly LOCK_FILE="/tmp/code-failure-recover.lock"
readonly TELEGRAM_BOT_TOKEN="${TELEGRAM_BOT_TOKEN:-}"
readonly TELEGRAM_ALERT_ID="647890"
readonly MAX_FAILURES=3
readonly AUTONOMOUS_DIR="/Users/duckets/.openclaw/workspace/tools/autonomous"
readonly TOOLS_DIR="/Users/duckets/.openclaw/workspace/tools"

# =============================================================================
# Logging
# =============================================================================
log() {
    local msg="[$(date '+%Y-%m-%d %H:%M:%S')] $1"
    echo "$msg" >> "$LOG_FILE"
    echo "$msg"
}

send_telegram_alert() {
    local message="$1"
    if [[ -n "$TELEGRAM_BOT_TOKEN" ]]; then
        curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
            -d "chat_id=${TELEGRAM_ALERT_ID}&text=${message}&parse_mode=HTML" >> /dev/null 2>&1 || true
    fi
}

# =============================================================================
# Lock
# =============================================================================
check_lock() {
    if [[ -f "$LOCK_FILE" ]]; then
        local pid
        pid=$(cat "$LOCK_FILE" 2>/dev/null || echo "")
        if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
            log "WARN: Another recovery instance running. Exiting."
            exit 0
        fi
        rm -f "$LOCK_FILE"
    fi
    echo $$ > "$LOCK_FILE"
}

cleanup() { rm -f "$LOCK_FILE"; }
trap cleanup EXIT

# =============================================================================
# Get failure count for a task
# =============================================================================
get_failure_count() {
    local task_name="$1"
    local failure_file="/tmp/.failure_count_${task_name}"
    if [[ -f "$failure_file" ]]; then
        cat "$failure_file" 2>/dev/null || echo "0"
    else
        echo "0"
    fi
}

# =============================================================================
# Increment failure count
# =============================================================================
increment_failure_count() {
    local task_name="$1"
    local failure_file="/tmp/.failure_count_${task_name}"
    local count
    count=$(get_failure_count "$task_name")
    echo $((count + 1)) > "$failure_file"
}

# =============================================================================
# Reset failure count (on success)
# =============================================================================
reset_failure_count() {
    local task_name="$1"
    rm -f "/tmp/.failure_count_${task_name}"
}

# =============================================================================
# Check if process is running
# =============================================================================
is_running() {
    pgrep -f "$1" &>/dev/null
}

# =============================================================================
# Kill and restart a process
# =============================================================================
kill_and_restart() {
    local name="$1"
    local restart_cmd="$2"
    local pid

    log "Attempting to restart: $name"

    # Kill existing
    pkill -f "$name" 2>/dev/null || true
    sleep 2

    # Restart
    eval "$restart_cmd" >> "$LOG_FILE" 2>&1 &
    sleep 3

    if is_running "$name"; then
        log "SUCCESS: $name restarted"
        return 0
    else
        log "FAILED: $name could not be restarted"
        return 1
    fi
}

# =============================================================================
# Recover grow scripts
# =============================================================================
recover_grow_scripts() {
    log "Checking grow scripts..."

    local grow_scripts=(
        "grow-twice-daily.sh"
        "grow-monitor-autonomous.sh"
        "grow-daily-report.sh"
    )

    for script in "${grow_scripts[@]}"; do
        local script_path="${TOOLS_DIR}/${script}"
        if [[ -f "$script_path" ]]; then
            if ! is_running "$script"; then
                log "Grow script not running: $script"
                nohup "$script_path" >> "$LOG_FILE" 2>&1 &
                sleep 2
            fi
        fi
    done
}

# =============================================================================
# Recover health check
# =============================================================================
recover_health_check() {
    log "Checking health check..."

    if ! is_running "sys-health-check"; then
        log "Health check not running. Starting..."
        nohup "${AUTONOMOUS_DIR}/sys-health-check.sh" >> "$LOG_FILE" 2>&1 &
        sleep 2
    fi
}

# =============================================================================
# Recover backup scripts
# =============================================================================
recover_backup() {
    log "Checking backup..."

    if ! is_running "sys-backup"; then
        log "Backup not running. Triggering fresh backup..."
        nohup "${AUTONOMOUS_DIR}/sys-backup.sh" >> "$LOG_FILE" 2>&1 &
        sleep 2
    fi
}

# =============================================================================
# Scan logs for failures
# =============================================================================
scan_for_failures() {
    log "Scanning log files for failures..."

    local log_files=(
        "/tmp/sys-health.log"
        "/tmp/auto-heal.log"
        "/tmp/sys-backup.log"
        "/tmp/auto-commit.log"
        "/Users/duckets/.openclaw/workspace/logs/grow-cron.log"
    )

    local found_failures=()

    for logf in "${log_files[@]}"; do
        if [[ -f "$logf" ]]; then
            # Look for failure patterns
            if grep -qE "(FAILED|ERROR|FATAL|DOWN)" "$logf" 2>/dev/null; then
                local last_lines
                last_lines=$(tail -20 "$logf" | grep -E "(FAILED|ERROR|FATAL|DOWN)" | head -5 || true)
                if [[ -n "$last_lines" ]]; then
                    found_failures+=("$logf: $last_lines")
                fi
            fi
        fi
    done

    if [[ ${#found_failures[@]} -gt 0 ]]; then
        log "Found failures in logs:"
        for f in "${found_failures[@]}"; do
            log "  - $f"
        done
    fi

    echo "${found_failures[*]}"
}

# =============================================================================
# Main recovery logic
# =============================================================================
recover_task() {
    local task_type="$1"

    log "Attempting recovery for: $task_type"

    local failures
    failures=$(get_failure_count "$task_type")

    if [[ $failures -ge $MAX_FAILURES ]]; then
        log "MAX FAILURES reached for $task_type ($failures/$MAX_FAILURES)"
        send_telegram_alert "🚨 <b>CRITICAL: Task Failing</b>%0ATask: ${task_type}%0AFailures: ${failures}/${MAX_FAILURES}%0AManual intervention required!"
        return 1
    fi

    log "Failure count: $failures/$MAX_FAILURES"

    local recovered=false

    case "$task_type" in
        "grow")
            recover_grow_scripts && recovered=true
            ;;
        "health-check")
            recover_health_check && recovered=true
            ;;
        "backup")
            recover_backup && recovered=true
            ;;
        *)
            log "Unknown task type: $task_type"
            return 1
            ;;
    esac

    if $recovered; then
        reset_failure_count "$task_type"
        log "SUCCESS: $task_type recovered"
        send_telegram_alert "✅ <b>Task Recovered</b>%0ATask: ${task_type}%0AAuto-recovered successfully."
        return 0
    else
        increment_failure_count "$task_type"
        log "FAILED: $task_type still not recovered"
        return 1
    fi
}

# =============================================================================
# Main
# =============================================================================
main() {
    check_lock

    log ""
    log "#########################################"
    log "# code-failure-recover.sh started"
    log "#########################################"

    # Optionally accept a specific task to recover
    local target_task="${1:-}"

    if [[ -n "$target_task" ]]; then
        # Recover specific task
        recover_task "$target_task"
    else
        # Auto-detect and recover all known tasks
        log "No task specified. Scanning for failures..."

        local failures
        failures=$(scan_for_failures)

        # Check each known task type
        for task in grow health-check backup; do
            recover_task "$task"
        done
    fi

    log "#########################################"
    log "# Recovery check complete"
    log "#########################################"
    log ""
}

main "$@"
