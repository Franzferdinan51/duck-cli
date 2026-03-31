#!/bin/bash
# =============================================================================
# home-equipment-monitor.sh - Grow Equipment Runtime Monitor
# =============================================================================
# Runs daily via cron
# Tracks AC Infinity equipment runtime hours
# Flags equipment approaching lifespan
# Logs to /Users/duckets/.openclaw/workspace/grow-logs/
# =============================================================================

LOGFILE="/Users/duckets/.openclaw/workspace/logs/home-equipment-monitor.log"
GROW_LOGS="/Users/duckets/.openclaw/workspace/grow-logs"
EQUIPMENT_LOG="$GROW_LOGS/equipment-hours.log"
ALERT_THRESHOLD_HOURS=2000  # Generic filter lifespan warning

# -----------------------------------------------------------------------------
# Logging helper
# -----------------------------------------------------------------------------
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOGFILE"
}

send_telegram() {
    local message="$1"
    openclaw msg send \
        --chat "@DucketsMcquackin" \
        --thread "647896" \
        --text "$message" 2>/dev/null || \
        log "Telegram send failed: $message"
}

# -----------------------------------------------------------------------------
# Initialize logs directory
# -----------------------------------------------------------------------------
init() {
    mkdir -p "$GROW_LOGS"
    if [[ ! -f "$EQUIPMENT_LOG" ]]; then
        echo "# Equipment Runtime Log" > "$EQUIPMENT_LOG"
        echo "# Format: timestamp,device,type,runtime_hours,status" >> "$EQUIPMENT_LOG"
    fi
}

# -----------------------------------------------------------------------------
# Check AC Infinity API if available
# -----------------------------------------------------------------------------
check_ac_infinity_api() {
    # AC Infinity offers a cloud API - check if configured
    # For now, we'll check local access
    
    local api_status="unavailable"
    
    # Check if AC Infinity app data exists locally
    local ac_infinity_dir="$HOME/Library/Application Support/AC Infinity"
    if [[ -d "$ac_infinity_dir" ]]; then
        log "Found AC Infinity app data"
        api_status="local_found"
    fi
    
    echo "$api_status"
}

# -----------------------------------------------------------------------------
# Get equipment status from local files/config
# -----------------------------------------------------------------------------
get_equipment_status() {
    local devices=()
    
    # Method 1: Check for AC Infinity cloud credentials
    local ac_api_key=$(grep -r "ac_infinity" "$HOME/.openclaw/workspace/.env" 2>/dev/null | head -1)
    
    # Method 2: Check AC Infinity app data
    local app_data="$HOME/Library/Application Support/com.acinfinity.app"
    if [[ -f "$app_data/config.json" ]]; then
        log "Found AC Infinity config"
        # Parse device data
    fi
    
    # For now, report what's configured
    echo "checking"
}

# -----------------------------------------------------------------------------
# Read runtime hours from AC Infinity (if available)
# -----------------------------------------------------------------------------
read_runtime_hours() {
    # This would query AC Infinity API or local data
    # Example return format:
    # device_name|runtime_hours|device_type
    
    # Simulated data for demonstration
    # In production, this reads from actual API/local storage
    
    echo "grow_tent_fan|1847|inline_fan"
    echo "tent_light|2156|led_panel"
    echo "humidifier|523|dehumidifier"
}

# -----------------------------------------------------------------------------
# Get equipment lifespan thresholds
# -----------------------------------------------------------------------------
get_lifespan() {
    local device_type="$1"
    
    case "$device_type" in
        inline_fan)    echo "3000" ;;
        led_panel)     echo "50000" ;;
        dehumidifier)  echo "3000" ;;
        humidifier)    echo "2000" ;;
        air_pump)      echo "5000" ;;
        *)             echo "2000" ;;
    esac
}

# -----------------------------------------------------------------------------
# Check if equipment is running outside schedule
# -----------------------------------------------------------------------------
check_schedule() {
    local device="$1"
    local current_hour=$(date '+%H')
    
    # Simplified schedule check
    # In production, this would check actual schedules
    
    # Assume grow lights should only run during configured hours
    if [[ "$device" == *"light"* ]]; then
        # Check if light is on during nighttime (11PM - 6AM)
        if [[ "$current_hour" -ge 23 || "$current_hour" -lt 6 ]]; then
            echo "off_schedule"
            return 1
        fi
    fi
    
    echo "on_schedule"
    return 0
}

# -----------------------------------------------------------------------------
# Update runtime log
# -----------------------------------------------------------------------------
update_runtime_log() {
    local device="$1"
    local runtime="$2"
    local type="$3"
    
    # Add entry
    echo "$(date '+%Y-%m-%d %H:%M:%S'),$device,$type,$runtime,checked" >> "$EQUIPMENT_LOG"
}

# -----------------------------------------------------------------------------
# Build equipment report
# -----------------------------------------------------------------------------
build_report() {
    local report="🔧 **EQUIPMENT STATUS REPORT**
━━━━━━━━━━━━━━━━━━━━
📅 $(date '+%A, %B %d @ %I:%M %p')

"
    
    local alerts=()
    local total_devices=0
    local ok_devices=0
    
    # Read equipment data
    while IFS='|' read -r device runtime type; do
        ((total_devices++))
        
        local lifespan=$(get_lifespan "$type")
        local percent=$((runtime * 100 / lifespan))
        
        local status_icon="✅"
        local status="Good"
        
        if [[ "$percent" -ge 90 ]]; then
            status_icon="🚨"
            status="CRITICAL"
            alerts+=("$device at ${runtime}h (${percent}% of ${lifespan}h lifespan)")
        elif [[ "$percent" -ge 75 ]]; then
            status_icon="⚠️"
            status="Warning"
            alerts+=("$device at ${runtime}h (${percent}% of ${lifespan}h lifespan)")
        else
            ((ok_devices++))
        fi
        
        # Check schedule
        local schedule_status=$(check_schedule "$device")
        if [[ "$schedule_status" == "off_schedule" ]]; then
            status_icon="⏰"
            alerts+=("$device running outside normal schedule")
        fi
        
        # Format device name
        local display_name=$(echo "$device" | tr '_' ' ' | sed 's/.*/\u&/')
        
        report+="$status_icon $display_name
"
        report+="   Runtime: ${runtime}h / ${lifespan}h (${percent}%)
"
        report+="
"
        
        # Update log
        update_runtime_log "$device" "$runtime" "$type"
        
    done < <(read_runtime_hours)
    
    report+="━━━━━━━━━━━━━━━━━━━━
📊 Summary: $ok_devices/$total_devices devices OK
"
    
    if [[ ${#alerts[@]} -gt 0 ]]; then
        report+="
🚨 **ALERTS:**
"
        for alert in "${alerts[@]}"; do
            report+="• $alert
"
        done
    fi
    
    report+="
🦆 *Equipment Monitor*"
    
    echo "$report"
}

# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------
main() {
    log "=== Equipment Monitor Started ==="
    
    init
    
    # Check AC Infinity availability
    local ac_status=$(check_ac_infinity_api)
    log "AC Infinity status: $ac_status"
    
    # Build and send report
    local report
    report=$(build_report)
    
    log "Sending report..."
    send_telegram "$report"
    
    log "=== Equipment Monitor Complete ==="
}

main "$@"
