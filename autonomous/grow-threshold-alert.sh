#!/bin/bash
#===============================================================================
# 🚨 Grow Threshold Alert - Continuous Threshold Monitoring
#===============================================================================
# Purpose: Check AC Infinity thresholds continuously and send alerts
#          if VPD > 1.8, temp > 82°F, or humidity > 55%
# Schedule: Every 15 minutes via cron
# Example:  0 */2 * * * /Users/duckets/.openclaw/workspace/tools/autonomous/grow-threshold-alert.sh
#===============================================================================

set -euo pipefail

# Configuration
OUT_DIR="/Users/duckets/.openclaw/workspace/grow-logs"
LOG_FILE="/Users/duckets/.openclaw/workspace/logs/grow-threshold-alert.log"
DATA_DIR="$OUT_DIR/data"
CANNAI_URL="http://localhost:3000"
TELEGRAM_TOPIC_ID="648118"

# Thresholds (alert if exceeded)
VPD_THRESHOLD=1.8
TEMP_THRESHOLD=82
HUMID_THRESHOLD=55

# Cooldown period (don't re-alert within this many seconds)
COOLDOWN_FILE="/tmp/grow-threshold-cooldown.txt"
COOLDOWN_SECONDS=1800  # 30 minutes

#-------------------------------------------------------------------------------
# Logging helper
#-------------------------------------------------------------------------------
log() {
    local msg="[$(date '+%Y-%m-%d %H:%M:%S')] [THRESHOLD] $1"
    echo "$msg" | tee -a "$LOG_FILE" 2>/dev/null || echo "$msg"
}

#-------------------------------------------------------------------------------
# Send Telegram alert with photo
#-------------------------------------------------------------------------------
send_telegram_alert() {
    local message="$1"
    local photo="$2"
    
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
    
    if [ -f "$photo" ]; then
        local bot_token=$(cat ~/.openclaw/openclaw.json 2>/dev/null | grep -o '"botToken"[[:space:]]*:[[:space:]]*"[^"]*' | head -1 | sed 's/.*"://;s/"$//')
        if [ -n "$bot_token" ]; then
            curl -s -X POST "https://api.telegram.org/bot$bot_token/sendPhoto" \
                -F "chat_id=-100${TELEGRAM_TOPIC_ID}" \
                -F "photo=@$photo" \
                -F "caption=🚨 Threshold Alert - $(date '+%Y-%m-%d %H:%M')" >/dev/null 2>&1 || true
        fi
    fi
}

#-------------------------------------------------------------------------------
# Send TTS voice alert for critical situations
#-------------------------------------------------------------------------------
send_voice_alert() {
    local message="$1"
    log "🔊 Sending voice alert: $message"
    tts "$message" 2>/dev/null || true
}

#-------------------------------------------------------------------------------
# Check if in cooldown period
#-------------------------------------------------------------------------------
is_in_cooldown() {
    if [ ! -f "$COOLDOWN_FILE" ]; then
        return 1  # No cooldown file = not in cooldown
    fi
    
    local last_alert=$(cat "$COOLDOWN_FILE" 2>/dev/null || echo "0")
    local now=$(date +%s)
    local elapsed=$((now - last_alert))
    
    if [ $elapsed -lt "$COOLDOWN_SECONDS" ]; then
        log "⏳ In cooldown period ($((COOLDOWN_SECONDS - elapsed))s remaining)"
        return 0  # In cooldown
    fi
    
    return 1  # Not in cooldown
}

#-------------------------------------------------------------------------------
# Set cooldown timestamp
#-------------------------------------------------------------------------------
set_cooldown() {
    date +%s > "$COOLDOWN_FILE"
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
# Capture AC Infinity screen
#-------------------------------------------------------------------------------
capture_ac_infinity() {
    local ts="$1"
    
    adb -s "$SERIAL" shell am start -n com.eternal.acinfinity/com.eternal.start.StartActivity >/dev/null 2>&1 || true
    sleep 4
    
    adb -s "$SERIAL" shell screencap -p /sdcard/env-alert-$ts.png 2>/dev/null
    adb -s "$SERIAL" pull /sdcard/env-alert-$ts.png "$OUT_DIR/env-alert-$ts.png" 2>/dev/null
    
    if [ -f "$OUT_DIR/env-alert-$ts.png" ]; then
        echo "$OUT_DIR/env-alert-$ts.png"
    else
        echo ""
    fi
}

#-------------------------------------------------------------------------------
# Capture plant photo
#-------------------------------------------------------------------------------
capture_plant_photo() {
    local ts="$1"
    
    adb -s "$SERIAL" shell am start -n com.motorola.camera5/com.motorola.camera.Camera >/dev/null 2>&1 || true
    sleep 3
    
    adb -s "$SERIAL" shell input tap 600 100 >/dev/null 2>&1 || true
    sleep 1
    
    adb -s "$SERIAL" shell input tap 360 1353 >/dev/null 2>&1 || true
    sleep 3
    
    local latest=$(adb -s "$SERIAL" shell "ls -t /sdcard/DCIM/Camera/*.jpg 2>/dev/null | head -1" | tr -d '\r')
    
    if [ -n "$latest" ]; then
        adb -s "$SERIAL" pull "$latest" "$OUT_DIR/plants-alert-$ts.jpg" 2>/dev/null
        if [ -f "$OUT_DIR/plants-alert-$ts.jpg" ]; then
            echo "$OUT_DIR/plants-alert-$ts.jpg"
        else
            echo ""
        fi
    else
        echo ""
    fi
}

#-------------------------------------------------------------------------------
# Run quick CannaAI check
#-------------------------------------------------------------------------------
run_cannaai_check() {
    local photo_path="$1"
    local temp="$2"
    local humid="$3"
    
    if ! curl -s -o /dev/null -w "%{http_code}" "$CANNAI_URL/health" 2>/dev/null | grep -q "200\|404"; then
        log "⚠️  CannaAI not running"
        echo "CannaAI unavailable"
        return
    fi
    
    cat > /tmp/cannaai-threshold-check.py << 'PYTHON_EOF'
#!/usr/bin/env python3
import sys
import json
import base64
import requests
import os

CANNAI_URL = "http://localhost:3000"
PHOTO_PATH = sys.argv[1] if len(sys.argv) > 1 else ""
ENV_TEMP = float(sys.argv[2]) if len(sys.argv) > 2 else 74.6
ENV_HUMID = float(sys.argv[3]) if len(sys.argv) > 3 else 50.5

def quick_check():
    if not PHOTO_PATH or not os.path.exists(PHOTO_PATH):
        return "No photo"
    
    try:
        with open(PHOTO_PATH, "rb") as f:
            image_data = base64.b64encode(f.read()).decode('utf-8')
        
        response = requests.post(
            f"{CANNAI_URL}/api/analyze",
            json={
                "image": f"data:image/jpeg;base64,{image_data}",
                "analysisType": "plant_health",
                "strain": "Cannabis",
                "leafSymptoms": "general_health_check",
                "growthStage": "flowering",
                "environmentalData": {
                    "temperature": ENV_TEMP,
                    "humidity": ENV_HUMID,
                    "ph": 6.5,
                    "light_cycle": "12/12"
                }
            },
            timeout=120
        )
        
        if response.status_code == 200:
            result = response.json()
            analysis = result.get('analysis', {})
            return analysis.get('diagnosis', 'Check complete')
        else:
            return f"API error: {response.status_code}"
            
    except Exception as e:
        return f"Error: {str(e)}"

print(quick_check())
PYTHON_EOF

    python3 /tmp/cannaai-threshold-check.py "$photo_path" "$temp" "$humid" 2>/dev/null || echo "CannaAI error"
}

#-------------------------------------------------------------------------------
# Get latest env data
#-------------------------------------------------------------------------------
get_latest_env_data() {
    local latest_json=$(ls -t "$DATA_DIR"/*.json 2>/dev/null | head -1)
    
    if [ -n "$latest_json" ] && [ -f "$latest_json" ]; then
        local temp=$(grep -o '"temperature_f": [0-9.]*' "$latest_json" 2>/dev/null | head -1 | grep -o '[0-9.]*' || echo "")
        local humid=$(grep -o '"humidity_rh": [0-9.]*' "$latest_json" 2>/dev/null | head -1 | grep -o '[0-9.]*' || echo "")
        local vpd=$(grep -o '"vpd_kpa": [0-9.]*' "$latest_json" 2>/dev/null | head -1 | grep -o '[0-9.]*' || echo "")
        
        echo "${temp:-NA}|${humid:-NA}|${vpd:-NA}"
    else
        echo "NA|NA|NA"
    fi
}

#-------------------------------------------------------------------------------
# Check thresholds and return alerts
#-------------------------------------------------------------------------------
check_thresholds() {
    local temp="$1"
    local humid="$2"
    local vpd="$3"
    
    local alerts=()
    local severity="NORMAL"
    
    # Check VPD
    if [ "$vpd" != "NA" ] && [ -n "$vpd" ]; then
        local vpd_val=$(echo "$vpd" | bc -l 2>/dev/null || echo "0")
        local vpd_thresh=$(echo "$VPD_THRESHOLD" | bc -l)
        if (( $(echo "$vpd_val > $vpd_thresh" | bc -l 2>/dev/null || echo 0) )); then
            alerts+=("🚨 VPD CRITICAL: ${vpd}kPa (threshold: ${VPD_THRESHOLD}kPa)")
            severity="CRITICAL"
        fi
    fi
    
    # Check temperature
    if [ "$temp" != "NA" ] && [ -n "$temp" ]; then
        if (( $(echo "$temp > $TEMP_THRESHOLD" | bc -l 2>/dev/null || echo 0) )); then
            alerts+=("🌡️ Temp HIGH: ${temp}°F (threshold: ${TEMP_THRESHOLD}°F)")
            [ "$severity" = "NORMAL" ] && severity="WARNING"
        fi
    fi
    
    # Check humidity
    if [ "$humid" != "NA" ] && [ -n "$humid" ]; then
        if (( $(echo "$humid > $HUMID_THRESHOLD" | bc -l 2>/dev/null || echo 0) )); then
            alerts+=("💧 Humidity HIGH: ${humid}% (threshold: ${HUMID_THRESHOLD}%)")
            [ "$severity" = "NORMAL" ] && severity="WARNING"
        fi
    fi
    
    # Return severity and alerts
    echo "$severity"
    printf '%s\n' "${alerts[@]}"
}

#-------------------------------------------------------------------------------
# Trigger full alert sequence
#-------------------------------------------------------------------------------
trigger_alert() {
    local severity="$1"
    shift
    local alerts=("$@")
    
    local TS=$(date +%Y%m%d_%H%M%S)
    
    log "🚨 TRIGGERING ALERT: $severity"
    
    # Capture photos
    log "📸 Capturing photos for alert..."
    local env_photo=$(capture_ac_infinity "$TS")
    local plant_photo=$(capture_plant_photo "$TS")
    
    # Run CannaAI
    local env_data=$(get_latest_env_data)
    local temp=$(echo "$env_data" | cut -d'|' -f1)
    local humid=$(echo "$env_data" | cut -d'|' -f2)
    
    log "🧠 Running CannaAI diagnostic..."
    local cannaai_result=$(run_cannaai_check "$plant_photo" "$temp" "$humid")
    
    # Build alert message
    local alert_msg="🚨 **GROW THRESHOLD ALERT**\n"
    alert_msg+="⏰ Time: $(date '+%Y-%m-%d %H:%M:%S')\n"
    alert_msg+="⚠️  Severity: **$severity**\n\n"
    
    alert_msg+="📊 **Exceeded Thresholds:**\n"
    for alert in "${alerts[@]}"; do
        alert_msg+="$alert\n"
    done
    
    alert_msg+="\n🌿 **CannaAI Check:** $cannaai_result\n"
    alert_msg+="\n📸 Photos attached"
    
    # Send alert
    send_telegram_alert "$alert_msg" "$plant_photo"
    
    # Voice alert for critical
    if [ "$severity" = "CRITICAL" ]; then
        send_voice_alert "Critical grow alert. $(IFS='. '; echo "${alerts[*]}")"
    fi
    
    # Set cooldown
    set_cooldown
    
    log "✅ Alert sequence complete"
}

#-------------------------------------------------------------------------------
# Main execution
#-------------------------------------------------------------------------------
main() {
    log "🔍 Starting threshold check..."
    
    # Check cooldown
    if is_in_cooldown; then
        log "⏳ Skipping check - in cooldown period"
        exit 0
    fi
    
    # Ensure directories
    mkdir -p "$OUT_DIR" "$DATA_DIR" "$(dirname "$LOG_FILE")"
    
    # Get latest env data
    log "📊 Reading latest environmental data..."
    local env_data=$(get_latest_env_data)
    local temp=$(echo "$env_data" | cut -d'|' -f1)
    local humid=$(echo "$env_data" | cut -d'|' -f2)
    local vpd=$(echo "$env_data" | cut -d'|' -f3)
    
    log "   Current: Temp=$temp, Humidity=$humid, VPD=$vpd"
    
    # Check thresholds
    local severity
    local alerts
    severity=$(check_thresholds "$temp" "$humid" "$vpd")
    alerts=$(check_thresholds "$temp" "$humid" "$vpd" 2>/dev/null)
    
    if [ "$severity" != "NORMAL" ]; then
        log "⚠️  Threshold exceeded: $severity"
        
        # Convert alerts to array
        local alert_array=()
        while IFS= read -r line; do
            [ -n "$line" ] && alert_array+=("$line")
        done <<< "$alerts"
        
        # Detect ADB and trigger full alert with photos
        if get_adb_serial >/dev/null 2>&1; then
            SERIAL=$(get_adb_serial)
            trigger_alert "$severity" "${alert_array[@]}"
        else
            # Just send text alert without photos
            log "📱 No ADB device - sending text-only alert"
            local alert_msg="🚨 **GROW THRESHOLD ALERT**\n"
            alert_msg+="⏰ Time: $(date '+%Y-%m-%d %H:%M:%S')\n"
            alert_msg+="⚠️  Severity: **$severity**\n\n"
            alert_msg+="📊 **Exceeded Thresholds:**\n"
            for alert in "${alert_array[@]}"; do
                alert_msg+="$alert\n"
            done
            send_telegram_alert "$alert_msg" ""
            set_cooldown
        fi
    else
        log "✅ All thresholds normal"
    fi
    
    log "✅ Threshold check complete"
}

# Run main
main
