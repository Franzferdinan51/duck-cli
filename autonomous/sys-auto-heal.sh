#!/bin/bash
# =============================================================================
# sys-auto-heal.sh - DuckBot Auto-Heal Script
# =============================================================================
# Attempts to restart failed services up to 3 times
# Logs all attempts to /tmp/auto-heal.log
# Alerts to Telegram 647890 after 3 failed attempts
# =============================================================================

set -euo pipefail

# Configuration
readonly LOG_FILE="/tmp/auto-heal.log"
readonly MAX_ATTEMPTS=3
readonly LOCK_FILE="/tmp/sys-auto-heal.lock"
readonly TELEGRAM_BOT_TOKEN="${TELEGRAM_BOT_TOKEN:-}"
readonly TELEGRAM_ALERT_ID="647890"

# Service to heal (arg from sys-health-check.sh)
SERVICE="${1:-}"

# =============================================================================
# Logging helper
# =============================================================================
log() {
    local msg="[$(date '+%Y-%m-%d %H:%M:%S')] $1"
    echo "$msg" >> "$LOG_FILE"
    echo "$msg"
}

# =============================================================================
# Send Telegram alert (to critical alert channel)
# =============================================================================
send_telegram_alert() {
    local message="$1"
    if [[ -n "$TELEGRAM_BOT_TOKEN" ]]; then
        curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
            -d "chat_id=${TELEGRAM_ALERT_ID}&text=${message}&parse_mode=HTML" >> /dev/null 2>&1 || true
    fi
}

# =============================================================================
# Check lock (prevent concurrent heals)
# =============================================================================
check_lock() {
    if [[ -f "$LOCK_FILE" ]]; then
        local pid
        pid=$(cat "$LOCK_FILE" 2>/dev/null || echo "")
        if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
            log "WARN: Another heal instance running (PID $pid). Exiting."
            exit 0
        fi
        log "WARN: Stale lock found. Removing."
        rm -f "$LOCK_FILE"
    fi
    echo $$ > "$LOCK_FILE"
}

cleanup() {
    rm -f "$LOCK_FILE"
}
trap cleanup EXIT

# =============================================================================
# Health check helper
# =============================================================================
is_up() {
    local url="$1"
    local response
    response=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$url" 2>/dev/null || echo "000")
    [[ "$response" =~ ^[2-5][0-9][0-9]$ ]]
}

# =============================================================================
# Heal OpenClaw Gateway
# =============================================================================
heal_openclaw_gateway() {
    log "  -> Attempting to heal openclaw-gateway..."
    openclaw gateway restart >> "$LOG_FILE" 2>&1
    sleep 5
    if is_up "http://127.0.0.1:18789"; then
        log "  -> openclaw-gateway: HEALED"
        return 0
    fi
    log "  -> openclaw-gateway: still DOWN after restart"
    return 1
}

# =============================================================================
# Heal CannaAI
# =============================================================================
heal_cannai() {
    log "  -> Attempting to heal CannaAI..."
    # Find and kill existing CannaAI process
    local pids
    pids=$(pgrep -f "tsx server.ts" 2>/dev/null | grep -v "$$" || true)
    if [[ -n "$pids" ]]; then
        log "  -> Killing existing CannaAI processes: $pids"
        echo "$pids" | xargs kill -9 2>/dev/null || true
        sleep 2
    fi

    # Restart CannaAI
    cd /.openclaw/workspace/CannaAI
    # Check if build exists, rebuild if missing
    if [[ ! -f ".next/BUILD_ID" ]]; then
        log "  -> CannaAI build missing, rebuilding..."
        npm run build >> /tmp/cannai-build.log 2>&1 || true
    fi
    nohup /bin/sh -c "NODE_ENV=production npx tsx server.ts" >> /tmp/cannai.log 2>&1 &
    sleep 5

    if is_up "http://localhost:3000"; then
        log "  -> CannaAI: HEALED"
        return 0
    fi
    log "  -> CannaAI: still DOWN after restart"
    return 1
}

# =============================================================================
# Heal AI Council Chamber
# =============================================================================
heal_ai_council() {
    log "  -> Attempting to heal AI Council Chamber..."
    local start_script="${HOME}/.openclaw/workspace/start-ai-council.sh"

    if [[ ! -f "$start_script" ]]; then
        log "  -> start-ai-council.sh not found, trying direct start..."

        # Kill existing
        pkill -f "vite" 2>/dev/null || true
        sleep 2

        # Start from known location
        local council_dir="${HOME}/.openclaw/workspace/ai-council-chamber"
        if [[ -d "$council_dir" ]]; then
            cd "$council_dir"
            nohup npm run dev >> /tmp/ai-council.log 2>&1 &
            sleep 10
        fi
    else
        # Use the start script
        nohup "$start_script" >> /tmp/ai-council.log 2>&1 &
        sleep 5
    fi

    if is_up "http://localhost:3001"; then
        log "  -> AI Council: HEALED"
        return 0
    fi
    log "  -> AI Council: still DOWN after restart"
    return 1
}

# =============================================================================
# Heal BrowserOS
# =============================================================================
heal_browseros() {
    log "  -> Attempting to heal BrowserOS..."

    # Kill existing BrowserOS processes
    pkill -9 -f "BrowserOS" 2>/dev/null || true
    sleep 2

    # Restart BrowserOS
    open -a BrowserOS >> "$LOG_FILE" 2>&1 &
    sleep 5

    # Check if either port is up
    if is_up "http://127.0.0.1:9000" || is_up "http://127.0.0.1:9200"; then
        log "  -> BrowserOS: HEALED"
        return 0
    fi
    log "  -> BrowserOS: still DOWN after restart"
    return 1
}

# =============================================================================
# Heal LM Studio
# =============================================================================
heal_lm_studio() {
    log "  -> Attempting to heal LM Studio (Windows PC)..."
    # LM Studio is on a Windows PC - we can only try to ping/wake it
    # In practice, you may need to use Wake-on-LAN or remote access
    # For now, just log and try curl with a longer wait
    log "  -> LM Studio is on Windows PC - manual intervention may be needed"
    log "  -> Sending WOL if configured..."

    # Try to check if it responds
    if is_up "http://100.116.54.125:1234"; then
        log "  -> LM Studio: HEALED (it came back)"
        return 0
    fi

    # Try WOL if MAC address is known (uncomment and configure if needed)
    # wakeonlan AA:BB:CC:DD:EE:FF 2>/dev/null || true

    log "  -> LM Studio: DOWN - manual check required"
    return 1
}

# =============================================================================
# Main heal logic with retry loop
# =============================================================================
heal_service() {
    local service="$1"
    log "========================================="
    log "HEAL ATTEMPT FOR: $service"
    log "========================================="

    local attempt=1
    local healed=false

    while [[ $attempt -le $MAX_ATTEMPTS ]]; do
        log "--- Attempt $attempt of $MAX_ATTEMPTS ---"

        case "$service" in
            "openclaw-gateway")
                heal_openclaw_gateway && healed=true
                ;;
            "cannai")
                heal_cannai && healed=true
                ;;
            "ai-council")
                heal_ai_council && healed=true
                ;;
            "browseros")
                heal_browseros && healed=true
                ;;
            "lm-studio")
                heal_lm_studio && healed=true
                ;;
            *)
                log "ERROR: Unknown service: $service"
                return 1
                ;;
        esac

        if $healed; then
            log "SUCCESS: $service healed on attempt $attempt"
            return 0
        fi

        if [[ $attempt -lt $MAX_ATTEMPTS ]]; then
            local wait_sec=$((attempt * 10))
            log "Waiting ${wait_sec}s before retry..."
            sleep "$wait_sec"
        fi

        ((attempt++))
    done

    # All attempts failed
    log "FATAL: $service could not be healed after $MAX_ATTEMPTS attempts"
    return 1
}

# =============================================================================
# Main
# =============================================================================
main() {
    check_lock

    log ""
    log "#########################################"
    log "# sys-auto-heal.sh started"
    log "#########################################"

    if [[ -z "$SERVICE" ]]; then
        log "Usage: $0 <service-name>"
        log "Available services:"
        log "  - openclaw-gateway"
        log "  - cannai"
        log "  - ai-council"
        log "  - browseros"
        log "  - lm-studio"
        log "#########################################"
        exit 1
    fi

    if heal_service "$SERVICE"; then
        log "RESULT: $SERVICE - HEALED"
        send_telegram_alert "✅ <b>Service Healed</b>%0A${SERVICE} is back UP"
    else
        log "RESULT: $SERVICE - FAILED AFTER $MAX_ATTEMPTS ATTEMPTS"
        send_telegram_alert "🚨 <b>CRITICAL: Service DOWN</b>%0A${SERVICE} could not be healed after ${MAX_ATTEMPTS} attempts%0AManual intervention required!"
    fi

    log ""
}

main "$@"
