#!/bin/bash
# =============================================================================
# sys-health-check.sh - DuckBot System Health Checker
# =============================================================================
# Checks all critical services every 15 minutes
# Logs to /tmp/sys-health.log
# Triggers auto-heal on any DOWN service
# =============================================================================

set -euo pipefail

# Configuration
readonly LOG_FILE="/tmp/sys-health.log"
readonly HEAL_SCRIPT="/Users/duckets/.openclaw/workspace/tools/autonomous/sys-auto-heal.sh"
readonly LOCK_FILE="/tmp/sys-health-check.lock"
readonly TIMEOUT=5  # seconds for curl timeout

# Telegram config
TELEGRAM_BOT_TOKEN="${TELEGRAM_BOT_TOKEN:-}"
TELEGRAM_CHAT_ID="${TELEGRAM_CHAT_ID:-647892}"

# =============================================================================
# Logging helper
# =============================================================================
log() {
    local msg="[$(date '+%Y-%m-%d %H:%M:%S')] $1"
    echo "$msg" >> "$LOG_FILE"
    echo "$msg"
}

# =============================================================================
# Send Telegram alert
# =============================================================================
send_telegram() {
    local message="$1"
    if [[ -n "$TELEGRAM_BOT_TOKEN" ]]; then
        curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
            -d "chat_id=${TELEGRAM_CHAT_ID}&text=${message}&parse_mode=HTML" >> /dev/null 2>&1 || true
    fi
}

# =============================================================================
# Check if already running (prevent overlapping runs)
# =============================================================================
check_lock() {
    if [[ -f "$LOCK_FILE" ]]; then
        local pid
        pid=$(cat "$LOCK_FILE" 2>/dev/null || echo "")
        if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
            log "WARN: Another instance is running (PID $pid). Exiting."
            exit 0
        fi
        log "WARN: Stale lock file found. Removing."
        rm -f "$LOCK_FILE"
    fi
    echo $$ > "$LOCK_FILE"
}

# =============================================================================
# Cleanup on exit
# =============================================================================
cleanup() {
    rm -f "$LOCK_FILE"
}
trap cleanup EXIT

# =============================================================================
# Check a single service
# Returns: 0=UP, 1=DOWN
# =============================================================================
check_service() {
    local name="$1"
    local url="$2"
    local extra_args="${3:-}"

    log "Checking ${name} at ${url}..."

    local response
    response=$(curl -s -o /dev/null -w "%{http_code}" --max-time "$TIMEOUT" "$url" $extra_args 2>/dev/null || echo "000")

    if [[ "$response" =~ ^[2-5][0-9][0-9]$ ]]; then
        log "  -> ${name}: UP (HTTP ${response})"
        return 0
    else
        log "  -> ${name}: DOWN (HTTP ${response})"
        return 1
    fi
}

# =============================================================================
# Main health check
# =============================================================================
main() {
    check_lock

    log "========================================="
    log "SYSTEM HEALTH CHECK STARTED"
    log "========================================="

    local failed_services=()

    # --- OpenClaw Gateway ---
    if ! check_service "OpenClaw Gateway" "http://127.0.0.1:18789"; then
        failed_services+=("openclaw-gateway")
    fi

    # --- CannaAI ---
    if ! check_service "CannaAI" "http://localhost:3000"; then
        failed_services+=("cannai")
    fi

    # --- AI Council Chamber ---
    if ! check_service "AI Council Chamber" "http://localhost:3001"; then
        failed_services+=("ai-council")
    fi

    # --- BrowserOS (try 9000 first, then 9200) ---
    local browseros_up=false
    if check_service "BrowserOS (9000)" "http://127.0.0.1:9000"; then
        browseros_up=true
    elif check_service "BrowserOS (9200)" "http://127.0.0.1:9200"; then
        browseros_up=true
    fi
    if ! $browseros_up; then
        failed_services+=("browseros")
    fi

    # --- LM Studio ---
    if ! check_service "LM Studio" "http://100.116.54.125:1234"; then
        failed_services+=("lm-studio")
    fi

    # --- AC Infinity Cloud (optional - check if endpoint known) ---
    # AC Infinity doesn't have a public API, but we can check if the local
    # AC Infinity monitor script can reach the cloud. For now, skip this
    # or check via the grow automation if configured.
    log "Checking AC Infinity Cloud (optional)..."
    # Add your AC Infinity cloud check here if you have an endpoint
    log "  -> AC Infinity: SKIPPED (no endpoint configured)"

    # --- Report Summary ---
    log "========================================="
    if [[ ${#failed_services[@]} -eq 0 ]]; then
        log "ALL SERVICES: UP"
        log "========================================="
        send_telegram "✅ <b>Health Check PASSED</b>%0AAll services are UP"
    else
        log "FAILED SERVICES: ${failed_services[*]}"
        log "========================================="
        local msg="🚨 <b>Health Check FAILED</b>%0AFailed services: ${failed_services[*]}"
        send_telegram "$msg"

        # Trigger auto-heal for all failed services
        log "Triggering auto-heal for failed services..."
        for service in "${failed_services[@]}"; do
            log "Calling auto-heal for: $service"
            "$HEAL_SCRIPT" "$service" 2>&1 | tee -a "$LOG_FILE" || true
        done
    fi

    log ""
}

main "$@"
