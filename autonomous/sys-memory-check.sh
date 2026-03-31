#!/bin/bash
# =============================================================================
# sys-memory-check.sh - DuckBot RAM Memory Monitor
# =============================================================================
# Every 30 minutes, checks free RAM on Mac mini
# If free RAM < 500MB: cleanup routine (kill BrowserOS, ChatGPT Atlas, etc.)
# If free RAM < 250MB: CRITICAL alert
# Sends reports to Telegram 647892
# =============================================================================

set -euo pipefail

# Configuration
readonly LOG_FILE="/tmp/sys-memory.log"
readonly LOCK_FILE="/tmp/sys-memory-check.lock"
readonly TELEGRAM_BOT_TOKEN="${TELEGRAM_BOT_TOKEN:-}"
readonly TELEGRAM_CHAT_ID="${TELEGRAM_CHAT_ID:-647892}"

# Thresholds (in MB)
readonly WARN_THRESHOLD=500
readonly CRITICAL_THRESHOLD=250

# Processes that are safe to kill (NEVER kill openclaw-gateway!)
readonly SAFE_TO_KILL=(
    "BrowserOS"
    "ChatGPT Atlas"
    "News"
    "Steam"
    "Messages"
    "Siri"
    "Surfshark"
    "Google Chrome"
    "Chromium"
)

# =============================================================================
# Logging
# =============================================================================
log() {
    local msg="[$(date '+%Y-%m-%d %H:%M:%S')] $1"
    echo "$msg" >> "$LOG_FILE"
    echo "$msg"
}

send_telegram() {
    local message="$1"
    if [[ -n "$TELEGRAM_BOT_TOKEN" ]]; then
        curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
            -d "chat_id=${TELEGRAM_CHAT_ID}&text=${message}&parse_mode=HTML" >> /dev/null 2>&1 || true
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
            log "WARN: Another memory check running. Exiting."
            exit 0
        fi
        rm -f "$LOCK_FILE"
    fi
    echo $$ > "$LOCK_FILE"
}

cleanup() { rm -f "$LOCK_FILE"; }
trap cleanup EXIT

# =============================================================================
# Get free RAM in MB (macOS)
# =============================================================================
get_free_ram_mb() {
    # vm_stat gives pages. Free pages * page size / 1024 / 1024 = MB
    local vm_stat_output
    vm_stat_output=$(vm_stat 2>/dev/null || echo "")

    local pages_free
    pages_free=$(echo "$vm_stat_output" | grep "Pages free" | awk '{print $3}' | tr -d '.')

    if [[ -z "$pages_free" ]]; then
        # Fallback to top
        pages_free=$(top -l 1 -n 0 2>/dev/null | grep "Pages free" | awk '{print $7}' || echo "0")
    fi

    # Page size on macOS (typically 4096 bytes)
    local page_size
    page_size=$(sysctl -n hw.pagesize 2>/dev/null || echo "4096")

    # Calculate free MB
    local free_mb=$((pages_free * page_size / 1024 / 1024))
    echo "$free_mb"
}

# =============================================================================
# Get memory info summary
# =============================================================================
get_memory_summary() {
    local vm_stat_output
    vm_stat_output=$(vm_stat 2>/dev/null)

    local pages_free pages_active pages_inactive pages_wired
    pages_free=$(echo "$vm_stat_output" | grep "Pages free" | awk '{print $3}' | tr -d '.')
    pages_active=$(echo "$vm_stat_output" | grep "Pages active" | awk '{print $3}' | tr -d '.')
    pages_inactive=$(echo "$vm_stat_output" | grep "Pages inactive" | awk '{print $3}' | tr -d '.')
    pages_wired=$(echo "$vm_stat_output" | grep "Pages wired down" | awk '{print $4}' | tr -d '.')

    local page_size
    page_size=$(sysctl -n hw.pagesize 2>/dev/null || echo "4096")

    local free_mb=$((pages_free * page_size / 1024 / 1024))
    local active_mb=$((pages_active * page_size / 1024 / 1024))
    local inactive_mb=$((pages_inactive * page_size / 1024 / 1024))
    local wired_mb=$((pages_wired * page_size / 1024 / 1024))
    local total_mb=$(( (pages_free + pages_active + pages_inactive + pages_wired) * page_size / 1024 / 1024 ))

    echo "Free: ${free_mb}MB | Active: ${active_mb}MB | Inactive: ${inactive_mb}MB | Wired: ${wired_mb}MB | Total: ${total_mb}MB"
}

# =============================================================================
# Check if process is safe to kill (NEVER kill openclaw-gateway!)
# =============================================================================
is_safe_to_kill() {
    local proc_name="$1"

    # CRITICAL: Never kill these
    case "$proc_name" in
        *openclaw*|*gateway*|*telegram*|*DuckBot*|*duckbot*)
            return 1
            ;;
    esac

    for safe in "${SAFE_TO_KILL[@]}"; do
        if [[ "$proc_name" == *"$safe"* ]]; then
            return 0
        fi
    done

    return 1
}

# =============================================================================
# Get list of killable processes with their RAM usage
# =============================================================================
get_killable_processes() {
    local procs=""

    for safe in "${SAFE_TO_KILL[@]}"; do
        local pids
        pids=$(pgrep -fl "$safe" 2>/dev/null | grep -v grep || true)
        if [[ -n "$pids" ]]; then
            procs+="$pids"$'\n'
        fi
    done

    echo "$procs" | grep -v '^$' | sort -u
}

# =============================================================================
# Kill a process safely
# =============================================================================
safe_kill() {
    local pid="$1"
    local name="$2"

    log "Attempting to kill: $name (PID $pid)"

    # Check if it's safe
    if ! is_safe_to_kill "$name"; then
        log "REFUSED: Not safe to kill: $name"
        return 1
    fi

    # Try SIGTERM first
    if kill -0 "$pid" 2>/dev/null; then
        kill "$pid" 2>/dev/null || true
        sleep 2

        # If still running, SIGKILL
        if kill -0 "$pid" 2>/dev/null; then
            log "SIGTERM failed, sending SIGKILL..."
            kill -9 "$pid" 2>/dev/null || true
        fi
    fi

    if ! kill -0 "$pid" 2>/dev/null; then
        log "SUCCESS: Killed $name"
        return 0
    else
        log "FAILED: Could not kill $name"
        return 1
    fi
}

# =============================================================================
# Cleanup routine for low memory
# =============================================================================
run_cleanup() {
    log "Running cleanup routine..."

    local procs
    procs=$(get_killable_processes)

    if [[ -z "$procs" ]]; then
        log "No killable processes found."
        return 0
    fi

    log "Found killable processes:"
    echo "$procs" | while read -r line; do
        log "  - $line"
    done

    local killed=0
    local failed=0

    echo "$procs" | while read -r line; do
        local pid name
        pid=$(echo "$line" | awk '{print $1}')
        name=$(echo "$line" | sed 's/^[0-9]* //')

        if safe_kill "$pid" "$name"; then
            ((killed++))
        else
            ((failed++))
        fi
    done

    log "Cleanup complete: killed $killed, failed $failed"
    echo "$killed:$failed"
}

# =============================================================================
# Main
# =============================================================================
main() {
    check_lock

    log ""
    log "#########################################"
    log "# sys-memory-check.sh started"
    log "#########################################"

    local free_ram
    free_ram=$(get_free_ram_mb)
    local mem_summary
    mem_summary=$(get_memory_summary)

    log "Memory Status: $mem_summary"
    log "Free RAM: ${free_ram}MB"

    local mem_status="OK"
    local emoji="✅"

    if [[ $free_ram -lt $CRITICAL_THRESHOLD ]]; then
        mem_status="CRITICAL"
        emoji="🚨"
        log "CRITICAL: Free RAM below ${CRITICAL_THRESHOLD}MB!"

        send_telegram "🚨 <b>CRITICAL: Memory Emergency!</b>%0AFree RAM: ${free_ram}MB%0A${mem_summary}%0AAutomatically attempting cleanup..."

        # Run aggressive cleanup
        local result
        result=$(run_cleanup)
        local killed="${result%%:*}"
        local failed="${result##*:}"

        # Check memory after cleanup
        sleep 3
        local free_after
        free_after=$(get_free_ram_mb)

        send_telegram "🚨 <b>Memory Cleanup Report</b>%0AFree RAM: ${free_after}MB%0AKilled: ${killed} processes%0AFailed: ${failed}%0A${mem_summary}"

        if [[ $free_after -lt $CRITICAL_THRESHOLD ]]; then
            send_telegram "🚨 <b>CRITICAL: Memory Still Low!</b>%0AFree RAM: ${free_after}MB%0AManual intervention may be required!"
        fi

    elif [[ $free_ram -lt $WARN_THRESHOLD ]]; then
        mem_status="WARN"
        emoji="⚠️"
        log "WARNING: Free RAM below ${WARN_THRESHOLD}MB"

        send_telegram "⚠️ <b>Memory Warning</b>%0AFree RAM: ${free_ram}MB%0ARunning cleanup routine..."

        local result
        result=$(run_cleanup)
        local killed="${result%%:*}"
        local failed="${result##*:}"

        sleep 3
        local free_after
        free_after=$(get_free_ram_mb)

        send_telegram "⚠️ <b>Memory Cleanup Done</b>%0AFree RAM: ${free_after}MB%0AKilled: ${killed} processes%0A${mem_summary}"

    else
        log "Memory OK: ${free_ram}MB free"
    fi

    # Always log current status
    log "Current: Free=${free_ram}MB Status=${mem_status}"

    log "#########################################"
    log "# Memory check complete"
    log "#########################################"
    log ""
}

main "$@"
