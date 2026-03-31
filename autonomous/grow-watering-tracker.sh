#!/bin/bash
#===============================================================================
# 💧 Grow Watering Tracker - Daily Reservoir Monitoring
#===============================================================================
# Purpose: Check reservoir level via AC Infinity, log to watering journal,
#          and alert if refilled or dropping faster than expected
# Schedule: Daily at 7:00 AM
# Example:  0 7 * * * /Users/duckets/.openclaw/workspace/tools/autonomous/grow-watering-tracker.sh
#===============================================================================

set -euo pipefail

# Configuration
OUT_DIR="/Users/duckets/.openclaw/workspace/grow-logs"
WATER_LOG="$OUT_DIR/watering-log.txt"
DATA_DIR="$OUT_DIR/data"
LOG_FILE="/Users/duckets/.openclaw/workspace/logs/grow-watering.log"
TELEGRAM_TOPIC_ID="648118"

# Expected consumption rates (liters per day)
EXPECTED_DAILY_USE=2.0  # Adjust based on your setup
RESERVOIR_SIZE=20.0     # Total reservoir capacity in liters

# Thresholds
LOW_RESERVOIR_THRESHOLD=3.0   # Alert when below this
HIGH_USE_THRESHOLD=3.5        # Alert if using more than this per day

#-------------------------------------------------------------------------------
# Logging helper
#-------------------------------------------------------------------------------
log() {
    local msg="[$(date '+%Y-%m-%d %H:%M:%S')] [WATER] $1"
    echo "$msg" | tee -a "$LOG_FILE" 2>/dev/null || echo "$msg"
}

#-------------------------------------------------------------------------------
# Send Telegram alert
#-------------------------------------------------------------------------------
send_telegram() {
    local message="$1"
    
    if [ -n "$message" ]; then
        mcporter call message.send target="telegram" message="$message" threadId="$TELEGRAM_TOPIC_ID" 2>/dev/null || {
            local bot_token=$(cat ~/.openclaw/openclaw.json 2>/dev/null | grep -o '"botToken"[[:space:]]*:[[:space:]]*"[^"]*' | head -1 | sed 's/.*"://;s/"$//')
            if [ -n "$bot_token" ]; then
                curl -s -X POST "https://api.telegram.org/bot$bot_token/sendMessage" \
                    -d "chat_id=-100${TELEGRAM_TOPIC_ID}" \
                    -d "text=$message" \
                    -d "parse_mode=Markdown" >/dev/null 2>&1 || true
            fi
        }
    fi
}

#-------------------------------------------------------------------------------
# Auto-detect ADB device
#-------------------------------------------------------------------------------
get_adb_serial() {
    local serials=("192.168.1.251:34341" "192.168.1.251:37609" "192.168.1.251:5555")
    
    for serial in "${serials[@]}"; do
        if adb -s "$serial" shell getprop ro.product.model >/dev/null 2>&1; then
            echo "$serial"
            return 0
        fi
    done
    return 1
}

#-------------------------------------------------------------------------------
# Capture AC Infinity screen for reservoir info
#-------------------------------------------------------------------------------
capture_reservoir_screen() {
    local ts="$1"
    
    log "📊 Capturing AC Infinity for reservoir info..."
    
    adb -s "$SERIAL" shell am start -n com.eternal.acinfinity/com.eternal.start.StartActivity >/dev/null 2>&1 || true
    sleep 4
    
    adb -s "$SERIAL" shell screencap -p /sdcard/reservoir-$ts.png 2>/dev/null
    adb -s "$SERIAL" pull /sdcard/reservoir-$ts.png "$OUT_DIR/reservoir-$ts.png" 2>/dev/null
    
    if [ -f "$OUT_DIR/reservoir-$ts.png" ]; then
        log "✅ Reservoir screenshot captured"
        echo "$OUT_DIR/reservoir-$ts.png"
    else
        log "⚠️  Failed to capture reservoir screen"
        echo ""
    fi
}

#-------------------------------------------------------------------------------
# Try to parse reservoir level from AC Infinity data
#-------------------------------------------------------------------------------
get_reservoir_level() {
    # Try to find reservoir level from AC Infinity JSON data
    local latest_json=$(ls -t "$DATA_DIR"/*.json 2>/dev/null | head -1)
    
    if [ -n "$latest_json" ] && [ -f "$latest_json" ]; then
        # Try various JSON fields that might contain reservoir/water level
        local reservoir=$(grep -o '"reservoir_[^"]*": [0-9.]*' "$latest_json" 2>/dev/null | head -1 | grep -o '[0-9.]*' || echo "")
        
        if [ -n "$reservoir" ]; then
            echo "$reservoir"
            return
        fi
        
        local water_level=$(grep -o '"water_level": [0-9.]*' "$latest_json" 2>/dev/null | head -1 | grep -o '[0-9.]*' || echo "")
        if [ -n "$water_level" ]; then
            echo "$water_level"
            return
        fi
        
        local tank_level=$(grep -o '"tank_level": [0-9.]*' "$latest_json" 2>/dev/null | head -1 | grep -o '[0-9.]*' || echo "")
        if [ -n "$tank_level" ]; then
            echo "$tank_level"
            return
        fi
    fi
    
    # Try the main grow-logs directory
    latest_json=$(ls -t "$OUT_DIR"/ac-*.json 2>/dev/null | head -1)
    if [ -n "$latest_json" ] && [ -f "$latest_json" ]; then
        local reservoir=$(grep -o '"reservoir_[^"]*": [0-9.]*' "$latest_json" 2>/dev/null | head -1 | grep -o '[0-9.]*' || echo "")
        [ -n "$reservoir" ] && echo "$reservoir" && return
    fi
    
    echo "NA"
}

#-------------------------------------------------------------------------------
# Get last recorded reservoir level
#-------------------------------------------------------------------------------
get_last_reservoir_reading() {
    local today=$(date +%Y-%m-%d)
    local yesterday=$(date -v-1d +%Y-%m-%d 2>/dev/null || date -d "yesterday" +%Y-%m-%d 2>/dev/null)
    
    if [ -f "$WATER_LOG" ]; then
        # Get last reading from log
        local last_line=$(tail -1 "$WATER_LOG" 2>/dev/null)
        local last_level=$(echo "$last_line" | grep -oE '[0-9]+\.?[0-9]*' | head -1)
        local last_date=$(echo "$last_line" | grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2}' | tail -1)
        
        if [ -n "$last_level" ]; then
            echo "$last_level|$last_date"
            return
        fi
    fi
    
    echo "NA|NA"
}

#-------------------------------------------------------------------------------
# Calculate daily usage
#-------------------------------------------------------------------------------
calculate_daily_usage() {
    local current_level="$1"
    local previous_level="$2"
    
    if [ "$previous_level" = "NA" ] || [ -z "$previous_level" ] || [ "$previous_level" = "0" ]; then
        echo "NA"
        return
    fi
    
    # Usage = previous - current (level goes down as water is used)
    local usage=$(echo "$previous_level - $current_level" | bc -l 2>/dev/null || echo "NA")
    
    # If current > previous, reservoir was refilled
    local refilled=$(echo "$current_level > $previous_level" | bc -l 2>/dev/null || echo "0")
    
    if [ "$refilled" = "1" ]; then
        echo "REFILL"
    else
        echo "$usage"
    fi
}

#-------------------------------------------------------------------------------
# Log watering event
#-------------------------------------------------------------------------------
log_watering_event() {
    local level="$1"
    local daily_use="$2"
    local notes="${3:-}"
    
    local today=$(date '+%Y-%m-%d')
    local time=$(date '+%H:%M')
    
    {
        echo "---"
        echo "Date: $today $time"
        echo "Reservoir Level: ${level}L"
        echo "Daily Usage: ${daily_use}L"
        echo "Notes: ${notes:-Auto-check}"
    } >> "$WATER_LOG"
    
    log "✅ Logged to watering journal"
}

#-------------------------------------------------------------------------------
# Check if reservoir is low
#-------------------------------------------------------------------------------
check_low_reservoir() {
    local level="$1"
    
    if [ "$level" = "NA" ]; then
        return 1
    fi
    
    if (( $(echo "$level < $LOW_RESERVOIR_THRESHOLD" | bc -l 2>/dev/null || echo 0) )); then
        return 0  # Low reservoir
    fi
    
    return 1  # Normal
}

#-------------------------------------------------------------------------------
# Check if usage is higher than expected
#-------------------------------------------------------------------------------
check_high_usage() {
    local usage="$1"
    
    if [ "$usage" = "NA" ] || [ "$usage" = "REFILL" ]; then
        return 1
    fi
    
    if (( $(echo "$usage > $HIGH_USE_THRESHOLD" | bc -l 2>/dev/null || echo 0) )); then
        return 0  # High usage
    fi
    
    return 1
}

#-------------------------------------------------------------------------------
# Send watering report
#-------------------------------------------------------------------------------
send_watering_report() {
    local current_level="$1"
    local daily_use="$2"
    local days_until_empty="$3"
    local alert_reason="$4"
    
    local report="💧 **Daily Watering Report - $(date '+%Y-%m-%d')**\n\n"
    
    report+="📊 **Reservoir Status:**\n"
    report+="• Current Level: ${current_level}L\n"
    report+="• Daily Usage: ${daily_use}L\n"
    
    if [ "$days_until_empty" != "NA" ] && [ "$days_until_empty" != "REFILL" ]; then
        if (( $(echo "$days_until_empty > 0" | bc -l 2>/dev/null || echo 0) )); then
            report+="• Est. Days Until Empty: ~$days_until_empty days\n"
        fi
    fi
    
    # Add alert if applicable
    if [ -n "$alert_reason" ]; then
        report+="\n⚠️  **$alert_reason**\n"
    fi
    
    # Add refill notification
    if [ "$daily_use" = "REFILL" ]; then
        report+="\n🔄 **RESERVOIR REFELLED**\n"
        report+="• Water level increased since last check\n"
        report+="• Logging new baseline\n"
    fi
    
    # Add recommendations
    report+="\n💡 **Recommendations:**\n"
    
    if [ "$daily_use" != "REFILL" ] && [ "$daily_use" != "NA" ]; then
        if (( $(echo "$daily_use > $EXPECTED_DAILY_USE" | bc -l 2>/dev/null || echo 0) )); then
            report+="• Usage higher than normal - check for leaks\n"
        fi
    fi
    
    if [ "$days_until_empty" != "NA" ] && [ "$days_until_empty" != "REFILL" ]; then
        if (( $(echo "$days_until_empty < 3" | bc -l 2>/dev/null || echo 0) )); then
            report+="• Reservoir running low - plan refill soon\n"
        fi
    fi
    
    report+="• Monitor closely over next few days\n"
    
    send_telegram "$report"
    log "✅ Watering report sent to Telegram"
}

#-------------------------------------------------------------------------------
# Main execution
#-------------------------------------------------------------------------------
main() {
    log "💧 Starting daily watering check..."
    log "=========================================="
    
    # Ensure directories
    mkdir -p "$OUT_DIR" "$DATA_DIR" "$(dirname "$LOG_FILE")"
    
    # Initialize water log if needed
    if [ ! -f "$WATER_LOG" ]; then
        log "📝 Creating new watering log"
        echo "# 💧 Grow Watering Log" > "$WATER_LOG"
        echo "# Auto-generated by grow-watering-tracker.sh" >> "$WATER_LOG"
        echo "" >> "$WATER_LOG"
    fi
    
    # Auto-detect ADB device
    log "📱 Detecting ADB device..."
    SERIAL=$(get_adb_serial) || {
        log "⚠️  No ADB device found - using last known values"
        SERIAL=""
    }
    
    if [ -n "$SERIAL" ]; then
        log "✅ Using device: $SERIAL"
        local TS=$(date +%Y%m%d_%H%M%S)
        capture_reservoir_screen "$TS"
    fi
    
    # Get current reservoir level
    log "📊 Reading reservoir level..."
    local current_level=$(get_reservoir_level)
    log "   Current level: $current_level"
    
    # Get last reading
    local last_reading=$(get_last_reservoir_reading)
    local previous_level=$(echo "$last_reading" | cut -d'|' -f1)
    local previous_date=$(echo "$last_reading" | cut -d'|' -f2)
    log "   Previous level: $previous_level (from $previous_date)"
    
    # Calculate daily usage
    local daily_use=$(calculate_daily_usage "$current_level" "$previous_level")
    log "   Daily usage: $daily_use"
    
    # Calculate days until empty
    local days_until_empty="NA"
    if [ "$daily_use" != "NA" ] && [ "$daily_use" != "REFILL" ] && [ "$daily_use" != "0" ]; then
        if (( $(echo "$daily_use > 0" | bc -l 2>/dev/null || echo 0) )); then
            days_until_empty=$(echo "scale=1; $current_level / $daily_use" | bc -l 2>/dev/null || echo "NA")
        fi
    fi
    
    # Determine alert reason
    local alert_reason=""
    
    if [ "$daily_use" = "REFILL" ]; then
        alert_reason="RESERVOIR REFELLED"
        log "🔄 Reservoir was refilled!"
    elif check_low_reservoir "$current_level"; then
        alert_reason="LOW RESERVOIR ALERT"
        log "⚠️  Reservoir level is low!"
    elif check_high_usage "$daily_use"; then
        alert_reason="HIGH WATER USAGE"
        log "⚠️  Water usage higher than expected!"
    fi
    
    # Log the event
    log_watering_event "$current_level" "$daily_use"
    
    # Send report
    send_watering_report "$current_level" "$daily_use" "$days_until_empty" "$alert_reason"
    
    log "✅ Watering check complete!"
    log "=========================================="
}

# Run main
main
