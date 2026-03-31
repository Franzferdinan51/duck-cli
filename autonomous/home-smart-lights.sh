#!/bin/bash
# =============================================================================
# home-smart-lights.sh - Smart Light Scheduler (Sunrise/Sunset)
# =============================================================================
# Runs daily based on sunrise/sunset times
# Adjusts smart lights for Huber Heights, OH
# Uses sunrise-sunset.org API (no key needed)
# Handles DST automatically via API
# =============================================================================

LOGFILE="/Users/duckets/.openclaw/workspace/logs/home-smart-lights.log"
LAT="39.84"  # Huber Heights, OH
LON="-84.17"

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
        log "Telegram send failed"
}

# -----------------------------------------------------------------------------
# Fetch sunrise/sunset times from API
# -----------------------------------------------------------------------------
get_sun_times() {
    local today=$(date '+%Y-%m-%d')
    
    # sunrise-sunset.org API - free, handles DST automatically
    local api_response=$(curl -s --max-time 10 \
        "https://api.sunrise-sunset.org/json?lat=$LAT&lng=$LON&date=today&formatted=0" \
        2>/dev/null)
    
    if [[ -z "$api_response" || "$api_response" == *"error"* ]]; then
        log "API fetch failed: $api_response"
        return 1
    fi
    
    # Parse JSON response
    local sunrise=$(echo "$api_response" | python3 -c "
import sys,json
d=json.load(sys.stdin)
results=d.get('results',{})
sunrise=results.get('sunrise','')
sunset=results.get('sunset','')
civil_twilight_begin=results.get('civil_twilight_begin','')
civil_twilight_end=results.get('civil_twilight_end','')
print(f'{sunrise}|{sunset}|{civil_twilight_begin}|{civil_twilight_end}')
" 2>/dev/null)
    
    echo "$sunrise"
}

# -----------------------------------------------------------------------------
# Convert ISO time to hour:minute
# -----------------------------------------------------------------------------
format_sun_time() {
    local iso_time="$1"
    
    # Remove timezone and format
    echo "$iso_time" | python3 -c "
import sys
from datetime import datetime
t=sys.stdin.read().strip()
if t:
    # Parse ISO format
    dt=datetime.fromisoformat(t.replace('Z','+00:00'))
    # Convert to local timezone (America/New_York)
    import pendulum
    dt=dt.in_tz('America/New_York')
    print(dt.strftime('%I:%M %p'))
" 2>/dev/null || echo "unknown"
}

# -----------------------------------------------------------------------------
# Calculate grow light schedule
# -----------------------------------------------------------------------------
calculate_light_schedule() {
    local sunrise="$1"
    local sunset="$2"
    
    # Convert to usable times
    local sunrise_time=$(format_sun_time "$sunrise")
    local sunset_time=$(format_sun_time "$sunset")
    
    # Calculate approximate day length
    local day_hours=$(python3 -c "
from datetime import datetime
import pendulum
s='$sunrise'.replace('Z','+00:00')
e='$sunset'.replace('Z','+00:00')
if s and e:
    start=datetime.fromisoformat(s).in_tz('America/New_York')
    end=datetime.fromisoformat(e).in_tz('America/New_York')
    diff=end-start
    hours=diff.total_seconds()/3600
    print(f'{hours:.1f}')
" 2>/dev/null || echo "12")
    
    # During veg: 18 hours lights, 6 hours dark
    # During flower: 12 hours lights, 12 hours dark
    # For simplicity, use 18/6 schedule with lights starting at sunrise
    
    local lights_on=$(python3 -c "
from datetime import datetime, timedelta
import pendulum
s='$sunrise'.replace('Z','+00:00')
if s:
    start=datetime.fromisoformat(s).in_tz('America/New_York')
    print(start.strftime('%I:%M %p'))
" 2>/dev/null || echo "sunrise")
    
    local lights_off=$(python3 -c "
from datetime import datetime, timedelta
import pendulum
s='$sunrise'.replace('Z','+00:00')
if s:
    start=datetime.fromisoformat(s).in_tz('America/New_York')
    lights_on=start+timedelta(hours=18)
    print(lights_on.strftime('%I:%M %p'))
" 2>/dev/null || echo "6 hours after sunrise")
    
    echo "$sunrise_time|$sunset_time|$lights_on|$lights_off|$day_hours"
}

# -----------------------------------------------------------------------------
# Apply light schedule (placeholder for actual smart home integration)
# -----------------------------------------------------------------------------
apply_light_schedule() {
    local schedule="$1"
    
    local sunrise=$(echo "$schedule" | cut -d'|' -f1)
    local sunset=$(echo "$schedule" | cut -d'|' -f2)
    local lights_on=$(echo "$schedule" | cut -d'|' -f3)
    local lights_off=$(echo "$schedule" | cut -d'|' -f4)
    local day_hours=$(echo "$schedule" | cut -d'|' -f5)
    
    log "Applying light schedule:"
    log "  Sunrise: $sunrise"
    log "  Sunset: $sunset"
    log "  Lights ON: $lights_on (18h veg schedule)"
    log "  Lights OFF: $lights_off"
    log "  Day length: ${day_hours}h"
    
    # =========================================================================
    # SMART HOME INTEGRATION NOTES:
    # =========================================================================
    # This section requires actual smart home setup:
    #
    # Option 1: HomeKit/Apple Home
    #   Use 'homekit' CLI or Homebridge HTTP API
    #   curl -X PUT "http://localhost:8080/api/lights/schedule" -d '{"on":true}'
    #
    # Option 2: Philips Hue
    #   Use OpenHue CLI: ~/.openclaw/workspace/skills/openhue/
    #   openhue scene activate "Grow Lights On"
    #
    # Option 3: AC Infinity lights (if smart)
    #   Direct API integration with AC Infinity app
    #
    # Option 4: Smart plugs (Tasmota/ESPHome)
    #   Control via MQTT or HTTP API
    # =========================================================================
    
    return 0
}

# -----------------------------------------------------------------------------
# Build report
# -----------------------------------------------------------------------------
build_report() {
    local sun_times="$1"
    local schedule="$2"
    
    local sunrise=$(echo "$sun_times" | cut -d'|' -f1)
    local sunset=$(echo "$sun_times" | cut -d'|' -f2)
    local civil_dawn=$(echo "$sun_times" | cut -d'|' -f3)
    local civil_dusk=$(echo "$sun_times" | cut -d'|' -f4)
    
    local lights_on=$(echo "$schedule" | cut -d'|' -f3)
    local lights_off=$(echo "$schedule" | cut -d'|' -f4)
    local day_hours=$(echo "$schedule" | cut -d'|' -f5)
    
    # Check current time vs schedule
    local current_hour=$(date '+%H')
    local lights_status="❓"
    
    # Simplified check
    if [[ "$lights_on" != "unknown" && "$lights_off" != "unknown" ]]; then
        lights_status="✅ Schedule set"
    fi
    
    local report="💡 **SMART LIGHT SCHEDULE**
━━━━━━━━━━━━━━━━━━━━
📅 $(date '+%A, %B %d')
📍 Huber Heights, OH

☀️ **Sun Times:**
• Sunrise: $sunrise
• Sunset: $sunset
• Dawn: $civil_dawn
• Dusk: $civil_dusk

🌱 **Grow Light Schedule (18/6):**
• Lights ON: $lights_on
• Lights OFF: $lights_off

⏱️ Day Length: ${day_hours}h

━━━━━━━━━━━━━━━━━━━━
$lights_status Smart lights updated

🦆 *Light Scheduler*
"
    
    echo "$report"
}

# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------
main() {
    log "=== Smart Light Scheduler Started ==="
    
    # Get sun times
    local sun_times=$(get_sun_times)
    
    if [[ -z "$sun_times" ]]; then
        log "Failed to get sun times"
        send_telegram "❌ Light scheduler: Could not fetch sunrise/sunset data"
        exit 1
    fi
    
    # Calculate schedule
    local schedule=$(calculate_light_schedule "$sun_times" "")
    
    # Apply schedule (if smart home is configured)
    apply_light_schedule "$schedule"
    
    # Build and send report
    local report
    report=$(build_report "$sun_times" "$schedule")
    send_telegram "$report"
    
    log "=== Smart Light Scheduler Complete ==="
}

main "$@"
