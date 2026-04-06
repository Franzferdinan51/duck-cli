#!/bin/bash
#===============================================================================
# 🌅 Grow Morning Check - Daily Morning Grow Routine
#===============================================================================
# Purpose: Morning plant health check - captures photo, runs diagnostics,
#          logs to journal, and sends Telegram report
# Schedule: Daily at 9:00 AM (configure via cron)
# Example:  0 9 * * * /.openclaw/workspace/tools/autonomous/grow-morning-check.sh
#===============================================================================

set -euo pipefail

# Configuration
OUT_DIR="/.openclaw/workspace/grow-logs"
LOG_FILE="/.openclaw/workspace/logs/grow-morning.log"
JOURNAL_FILE="$OUT_DIR/grow-journal.md"
CANNAI_URL="http://localhost:3000"
TELEGRAM_TOPIC_ID="648118"

# Thresholds for alerts
VPD_THRESHOLD=1.8
TEMP_THRESHOLD=82
HUMID_THRESHOLD=55

#-------------------------------------------------------------------------------
# Logging helper
#-------------------------------------------------------------------------------
log() {
    local msg="[$(date '+%Y-%m-%d %H:%M:%S')] [MORNING] $1"
    echo "$msg" | tee -a "$LOG_FILE" 2>/dev/null || echo "$msg"
}

#-------------------------------------------------------------------------------
# Send Telegram message with optional photo
#-------------------------------------------------------------------------------
send_telegram() {
    local message="${1:-}"
    local photo="${2:-}"
    
    # Use mcporter message tool for Telegram
    if [ -n "$message" ]; then
        mcporter call message.send target="telegram" message="$message" threadId="$TELEGRAM_TOPIC_ID" 2>/dev/null || {
            log "⚠️  mcporter Telegram send failed, trying curl..."
            # Fallback to direct curl
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

send_telegram_photo() {
    local caption="$1"
    local photo_path="$2"
    
    if [ -f "$photo_path" ]; then
        local bot_token=$(cat ~/.openclaw/openclaw.json 2>/dev/null | grep -o '"botToken"[[:space:]]*:[[:space:]]*"[^"]*' | head -1 | sed 's/.*"://;s/"$//')
        if [ -n "$bot_token" ]; then
            curl -s -X POST "https://api.telegram.org/bot$bot_token/sendPhoto" \
                -F "chat_id=-100${TELEGRAM_TOPIC_ID}" \
                -F "photo=@$photo_path" \
                -F "caption=$caption" \
                -F "reply_to_message_id=$TELEGRAM_TOPIC_ID" >/dev/null 2>&1 || true
        fi
    fi
}

#-------------------------------------------------------------------------------
# Auto-detect ADB device (handles dynamic ports)
#-------------------------------------------------------------------------------
get_adb_serial() {
    # Primary: IP:port for grow phone
    local serials=("192.168.1.251:34341" "192.168.1.251:37609" "192.168.1.251:5555")
    
    for serial in "${serials[@]+"${@serials[@]}"}"; do
        if adb -s "$serial" shell getprop ro.product.model >/dev/null 2>&1; then
            echo "$serial"
            return 0
        fi
    done
    
    # Fallback: any connected device
    local line=$(adb devices -l 2>/dev/null | grep "device" | grep -v "List" | head -1)
    if [ -n "$line" ]; then
        echo "$line" | awk '{print $1}'
        return 0
    fi
    
    return 1
}

#-------------------------------------------------------------------------------
# Capture AC Infinity screen for env data
#-------------------------------------------------------------------------------
capture_ac_infinity() {
    local ts="$1"
    
    log "📊 Capturing AC Infinity screen..."
    
    # Open AC Infinity app
    adb -s "$SERIAL" shell am start -n com.eternal.acinfinity/com.eternal.start.StartActivity >/dev/null 2>&1 || true
    sleep 4
    
    # Capture screen
    adb -s "$SERIAL" shell screencap -p /sdcard/env-morning-$ts.png 2>/dev/null
    adb -s "$SERIAL" pull /sdcard/env-morning-$ts.png "$OUT_DIR/env-morning-$ts.png" 2>/dev/null
    
    if [ -f "$OUT_DIR/env-morning-$ts.png" ]; then
        log "✅ AC Infinity screenshot saved"
        echo "$OUT_DIR/env-morning-$ts.png"
    else
        log "⚠️  Failed to capture AC Infinity screen"
        echo ""
    fi
}

#-------------------------------------------------------------------------------
# Capture plant photo via camera
#-------------------------------------------------------------------------------
capture_plant_photo() {
    local ts="$1"
    
    log "📸 Capturing plant photo..."
    
    # Open camera
    adb -s "$SERIAL" shell am start -n com.motorola.camera5/com.motorola.camera.Camera >/dev/null 2>&1 || true
    sleep 3
    
    # Enable flash (tap flash icon)
    adb -s "$SERIAL" shell input tap 600 100 >/dev/null 2>&1 || true
    sleep 1
    
    # Take photo (tap shutter)
    adb -s "$SERIAL" shell input tap 360 1353 >/dev/null 2>&1 || true
    sleep 3
    
    # Get latest photo
    local latest=$(adb -s "$SERIAL" shell "ls -t /sdcard/DCIM/Camera/*.jpg 2>/dev/null | head -1" | tr -d '\r')
    
    if [ -n "$latest" ]; then
        adb -s "$SERIAL" pull "$latest" "$OUT_DIR/plants-morning-$ts.jpg" 2>/dev/null
        if [ -f "$OUT_DIR/plants-morning-$ts.jpg" ]; then
            log "✅ Plant photo captured: plants-morning-$ts.jpg"
            echo "$OUT_DIR/plants-morning-$ts.jpg"
        else
            log "⚠️  Failed to pull plant photo"
            echo ""
        fi
    else
        log "⚠️  No photo found, using screenshot fallback"
        adb -s "$SERIAL" shell screencap -p /sdcard/camera-morning-$ts.png
        adb -s "$SERIAL" pull /sdcard/camera-morning-$ts.png "$OUT_DIR/plants-morning-$ts.png" 2>/dev/null
        echo "$OUT_DIR/plants-morning-$ts.png"
    fi
}

#-------------------------------------------------------------------------------
# Run CannaAI diagnostic
#-------------------------------------------------------------------------------
run_cannaai_diagnostic() {
    local photo_path="$1"
    local temp="${2:-74.6}"
    local humid="${3:-50.5}"
    
    log "🧠 Running CannaAI diagnostic..."
    
    # Check if CannaAI is running
    if ! curl -s -o /dev/null -w "%{http_code}" "$CANNAI_URL/health" 2>/dev/null | grep -q "200\|404"; then
        log "⚠️  CannaAI not running, attempting to start..."
        cd /.openclaw/workspace/CannaAI
        if [ ! -d ".next" ]; then
            npm run build >/dev/null 2>&1 || true
        fi
        NODE_ENV=production nohup npx tsx server.ts >/tmp/cannaai.log 2>&1 &
        sleep 10
    fi
    
    # Create analysis script
    cat > /tmp/cannaai-morning-check.py << 'PYTHON_EOF'
#!/usr/bin/env python3
import sys
import json
import base64
import requests
from datetime import datetime

CANNAI_URL = "http://localhost:3000"
PHOTO_PATH = sys.argv[1] if len(sys.argv) > 1 else ""
ENV_TEMP = float(sys.argv[2]) if len(sys.argv) > 2 else 74.6
ENV_HUMID = float(sys.argv[3]) if len(sys.argv) > 3 else 50.5

def analyze_plant():
    if not PHOTO_PATH or not os.path.exists(PHOTO_PATH):
        return {"error": "No photo provided", "healthScore": "N/A"}
    
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
            timeout=180
        )
        
        if response.status_code == 200:
            result = response.json()
            analysis = result.get('analysis', {})
            return {
                "healthScore": analysis.get('healthScore', 'N/A'),
                "diagnosis": analysis.get('diagnosis', 'N/A'),
                "urgency": analysis.get('urgency', 'low'),
                "actions": analysis.get('prioritizedActionPlan', {}).get('immediate', [])[:3],
                "prognosis": analysis.get('prognosis', {}).get('expectedOutcome', 'N/A')
            }
        else:
            return {"error": f"API error: {response.status_code}", "healthScore": "Error"}
            
    except Exception as e:
        return {"error": str(e), "healthScore": "Error"}

import os
result = analyze_plant()
print(json.dumps(result))
PYTHON_EOF

    # Run analysis
    local result
    result=$(python3 /tmp/cannaai-morning-check.py "$photo_path" "$temp" "$humid" 2>/dev/null)
    
    if [ -n "$result" ]; then
        log "✅ CannaAI analysis complete"
        echo "$result"
    else
        log "⚠️  CannaAI analysis failed"
        echo '{"healthScore":"N/A","diagnosis":"Analysis unavailable","urgency":"unknown"}'
    fi
}

#-------------------------------------------------------------------------------
# Log to grow journal
#-------------------------------------------------------------------------------
log_to_journal() {
    local ts="$1"
    local photo_path="$2"
    local cannaai_result="$3"
    local temp="${4:-74.6}"
    local humid="${5:-50.5}"
    local vpd="${6:-1.45}"
    
    # Parse CannaAI result
    local health_score=$(echo "$cannaai_result" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('healthScore','N/A'))" 2>/dev/null || echo "N/A")
    local diagnosis=$(echo "$cannaai_result" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('diagnosis','N/A'))" 2>/dev/null || echo "N/A")
    
    # Append to journal
    {
        echo "---"
        echo "Date: $(date '+%Y-%m-%d %H:%M') [MORNING]"
        echo "Temp: ${temp}°F | Humidity: ${humid}% | VPD: ${vpd} kPa"
        echo "Health Score: $health_score"
        echo "Diagnosis: $diagnosis"
        echo "Photo: $(basename "$photo_path")"
        echo ""
    } >> "$JOURNAL_FILE"
    
    log "✅ Logged to grow journal"
}

#-------------------------------------------------------------------------------
# Check thresholds and alert if needed
#-------------------------------------------------------------------------------
check_thresholds() {
    local temp="$1"
    local humid="$2"
    local vpd="$3"
    
    local alerts=()
    
    # Check VPD
    local vpd_val=$(echo "$vpd" | bc -l 2>/dev/null || echo "0")
    local vpd_thresh=$(echo "$VPD_THRESHOLD" | bc -l)
    if (( $(echo "$vpd_val > $vpd_thresh" | bc -l 2>/dev/null || echo 0) )); then
        alerts+=("🚨 VPD too HIGH: ${vpd}kPa (max: ${VPD_THRESHOLD})")
    fi
    
    # Check temperature
    if (( $(echo "$temp > $TEMP_THRESHOLD" | bc -l 2>/dev/null || echo 0) )); then
        alerts+=("🌡️ Temp too HIGH: ${temp}°F (max: ${TEMP_THRESHOLD}°F)")
    fi
    
    # Check humidity
    if (( $(echo "$humid > $HUMID_THRESHOLD" | bc -l 2>/dev/null || echo 0) )); then
        alerts+=("💧 Humidity too HIGH: ${humid}% (max: ${HUMID_THRESHOLD}%)")
    fi
    
    # Return alerts joined by newline
    printf '%s\n' "${alerts[@]+"${alerts[@]+"${@alerts[@]}"}"}"
}

#-------------------------------------------------------------------------------
# Build and send Telegram report
#-------------------------------------------------------------------------------
send_report() {
    local photo_path="$1"
    local cannaai_result="$2"
    local temp="${3:-74.6}"
    local humid="${4:-50.5}"
    local vpd="${5:-1.45}"
    local alerts="$6"
    
    # Parse CannaAI
    local health_score=$(echo "$cannaai_result" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('healthScore','N/A'))" 2>/dev/null || echo "N/A")
    local diagnosis=$(echo "$cannaai_result" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('diagnosis','N/A'))" 2>/dev/null || echo "N/A")
    local urgency=$(echo "$cannaai_result" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('urgency','low'))" 2>/dev/null || echo "low")
    
    # Build report
    local report="🌅 **Morning Grow Check - $(date '+%Y-%m-%d %H:%M')**\n\n"
    report+="🌿 **Health Score: $health_score/100**\n"
    report+="📋 **Status:** $diagnosis\n"
    report+="⚠️  **Urgency:** $(echo "$urgency" | tr '[:lower:]' '[:upper:]')\n\n"
    
    report+="🌍 **Environment:**\n"
    report+="   • Temperature: ${temp}°F\n"
    report+="   • Humidity: ${humid}%\n"
    report+="   • VPD: ${vpd} kPa\n\n"
    
    # Show alerts if any
    if [ -n "$alerts" ]; then
        report+="⚠️ **THRESHOLD ALERTS:**\n"
        while IFS= read -r line; do
            [ -n "$line" ] && report+="$line\n"
        done <<< "$alerts"
        report+="\n"
    fi
    
    report+="📸 _Photo sent separately_"
    
    # Send text first
    send_telegram "$report"
    
    # Send photo with caption
    local photo_caption="🌅 Morning Check - $(date '+%Y-%m-%d %H:%M')"
    send_telegram_photo "$photo_caption" "$photo_path"
    
    log "✅ Report sent to Telegram"
}

#-------------------------------------------------------------------------------
# Main execution
#-------------------------------------------------------------------------------
main() {
    log "🌅 Starting morning grow check..."
    log "=========================================="
    
    # Ensure directories exist
    mkdir -p "$OUT_DIR" "$(dirname "$LOG_FILE")"
    
    # Auto-detect ADB device
    log "📱 Detecting ADB device..."
    SERIAL=$(get_adb_serial) || {
        log "❌ No ADB device found - phone may be offline"
        send_telegram "❌ Morning Check Failed: No ADB device found"
        exit 1
    }
    log "✅ Using device: $SERIAL"
    
    # Timestamps
    TS=$(date +%Y%m%d_%H%M%S)
    DATE_READABLE=$(date '+%Y-%m-%d %H:%M')
    
    # Default env values (override with actual if available)
    ENV_TEMP=74.6
    ENV_HUMID=50.5
    ENV_VPD=1.45
    
    # Capture AC Infinity screen
    ENV_PATH=$(capture_ac_infinity "$TS")
    
    # Try to parse env data from latest JSON if available
    local latest_json=$(ls -t "$OUT_DIR"/ac-*.json 2>/dev/null | head -1)
    if [ -n "$latest_json" ] && [ -f "$latest_json" ]; then
        ENV_TEMP=$(grep -o '"temperature_f": [0-9.]*' "$latest_json" 2>/dev/null | head -1 | grep -o '[0-9.]*' || echo "$ENV_TEMP")
        ENV_HUMID=$(grep -o '"humidity_rh": [0-9.]*' "$latest_json" 2>/dev/null | head -1 | grep -o '[0-9.]*' || echo "$ENV_HUMID")
    fi
    
    # Capture plant photo
    PHOTO_PATH=$(capture_plant_photo "$TS")
    
    # Run CannaAI diagnostic
    CANNAI_RESULT=$(run_cannaai_diagnostic "$PHOTO_PATH" "$ENV_TEMP" "$ENV_HUMID")
    
    # Log to journal
    log_to_journal "$TS" "$PHOTO_PATH" "$CANNAI_RESULT" "$ENV_TEMP" "$ENV_HUMID" "$ENV_VPD"
    
    # Check thresholds
    ALERTS=$(check_thresholds "$ENV_TEMP" "$ENV_HUMID" "$ENV_VPD")
    if [ -n "$ALERTS" ]; then
        log "⚠️  Threshold alerts detected!"
        while IFS= read -r line; do
            [ -n "$line" ] && log "$line"
        done <<< "$ALERTS"
    fi
    
    # Send Telegram report
    send_report "$PHOTO_PATH" "$CANNAI_RESULT" "$ENV_TEMP" "$ENV_HUMID" "$ENV_VPD" "$ALERTS"
    
    log "✅ Morning check complete!"
    log "=========================================="
}

# Run main
main
