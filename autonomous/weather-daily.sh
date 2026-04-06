#!/bin/bash
# =============================================================================
# weather-daily.sh - Daily Weather Report for Huber Heights, OH
# =============================================================================
# Runs at 7AM via cron
# Gets 5-day forecast with grow-relevant alerts
# Sends to Telegram topic 647896
# =============================================================================

LOGFILE="/.openclaw/workspace/logs/weather-daily.log"
TELEGRAM_TOPIC="647896"
LOCATION="45424"  # Huber Heights, OH
ALERT_EMAIL_FILE="${HOME}/.openclaw/workspace/.last-weather-alert"

# -----------------------------------------------------------------------------
# Logging helper
# -----------------------------------------------------------------------------
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOGFILE"
}

send_telegram() {
    local message="$1"
    curl -s -X POST "https://api.telegram.org/bot8094662802:AAF2IcMguSovSu4a_R0o9ckzfCJfpYw14UM/sendMessage" \
        -d chat_id="588090613" \
        -d message_thread_id="$TELEGRAM_TOPIC" \
        -d text="$message" >> "$LOGFILE" 2>&1 || \
        log "Telegram send failed"
}

# -----------------------------------------------------------------------------
# Fetch weather from wttr.in
# -----------------------------------------------------------------------------
fetch_wttr() {
    local weather=$(curl -s --max-time 10 \
        "https://wttr.in/$LOCATION?format=j1" 2>/dev/null)
    echo "$weather"
}

# -----------------------------------------------------------------------------
# Fetch from Open-Meteo (more detailed)
# -----------------------------------------------------------------------------
fetch_open_meteo() {
    # Open-Meteo free API, no key needed
    local weather=$(curl -s --max-time 10 \
        "https://api.open-meteo.com/v1/forecast?latitude=39.84&longitude=-84.17&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max,weathercode&timezone=America%2FNew_York&forecast_days=5" \
        2>/dev/null)
    echo "$weather"
}

# -----------------------------------------------------------------------------
# Parse Open-Meteo response and build report
# -----------------------------------------------------------------------------
parse_open_meteo() {
    local json="$1"
    local report=""
    
    if [[ -z "$json" || "$json" == *"error"* ]]; then
        log "Open-Meteo fetch failed, trying wttr.in"
        return 1
    fi
    
    # Extract dates
    local dates=$(echo "$json" | python3 -c "import sys,json; d=json.load(sys.stdin); print(' '.join(d.get('daily',{}).get('time',[])))" 2>/dev/null)
    
    report="🌤️ **5-DAY WEATHER FORECAST**
━━━━━━━━━━━━━━━━━━━━
📍 Huber Heights, OH

"
    
    # Day counter
    local day_num=1
    for date in $dates; do
        local date_formatted=$(date -jf "%Y-%m-%d" "$date" "+%a, %b %d" 2>/dev/null || \
            date -d "$date" "+%a, %b %d" 2>/dev/null)
        
        # Get values for this day
        local temps=$(echo "$json" | python3 -c "
import sys,json
d=json.load(sys.stdin)
idx=$((day_num - 1))
times=d.get('daily',{}).get('time',[])
if idx < len(times):
    max_t=d.get('daily',{}).get('temperature_2m_max',[0])[idx]
    min_t=d.get('daily',{}).get('temperature_2m_min',[0])[idx]
    precip=d.get('daily',{}).get('precipitation_sum',[0])[idx]
    wind=d.get('daily',{}).get('windspeed_10m_max',[0])[idx]
    code=d.get('daily',{}).get('weathercode',[0])[idx]
    print(f'{max_t}|{min_t}|{precip}|{wind}|{code}')
" 2>/dev/null)
        
        if [[ -n "$temps" ]]; then
            local max_temp=$(echo "$temps" | cut -d'|' -f1)
            local min_temp=$(echo "$temps" | cut -d'|' -f2)
            local precip=$(echo "$temps" | cut -d'|' -f3)
            local wind=$(echo "$temps" | cut -d'|' -f4)
            local code=$(echo "$temps" | cut -d'|' -f5)
            
            # Weather icon
            local icon="☀️"
            case "$code" in
                [1-3]*) icon="⛅" ;;
                [45]*)  icon="🌫️" ;;
                [5-7]*) icon="🌫️" ;;
                [51-57]*) icon="🌧️" ;;
                [61-67]*) icon="🌧️" ;;
                [71-77]*) icon="❄️" ;;
                [80-82]*) icon="🌧️" ;;
                [85-86]*) icon="❄️" ;;
                95) icon="⛈️" ;;
                [96-99]*) icon="⛈️" ;;
            esac
            
            report+="$icon **$date_formatted**
"
            report+="   High: ${max_temp}°F  Low: ${min_temp}°F
"
            report+="   💧 Precip: ${precip}mm  💨 Wind: ${wind}km/h
"
            report+="
"
            
            # Grow-relevant alerts
            # Frost check (low < 35°F)
            local min_int=$(echo "$min_temp" | cut -d'.' -f1)
            if [[ "$min_int" -lt 35 ]]; then
                report+="   🥶 **FROST ALERT!** Low of ${min_temp}°F
"
            fi
            
            # High humidity (> 80%)
            if [[ $(echo "$precip > 10" | bc 2>/dev/null || echo "0") -eq 1 ]]; then
                report+="   💧 Heavy rain expected - PM risk!
"
            fi
            
            # High wind
            if [[ $(echo "$wind > 40" | bc 2>/dev/null || echo "0") -eq 1 ]]; then
                report+="   💨 High wind advisory
"
            fi
        fi
        
        ((day_num++))
    done
    
    echo "$report"
}

# -----------------------------------------------------------------------------
# Fetch wttr.in as fallback
# -----------------------------------------------------------------------------
fetch_wttr_report() {
    local report="🌤️ **WEATHER FORECAST**
━━━━━━━━━━━━━━━━━━━━
📍 Huber Heights, OH ($(date '+%a, %b %d'))

"
    
    local weather=$(fetch_wttr)
    
    if [[ -z "$weather" ]]; then
        report+="⚠️ Could not fetch weather data"
        echo "$report"
        return 1
    fi
    
    # Parse wttr.in JSON
    local current=$(echo "$weather" | python3 -c "
import sys,json
d=json.load(sys.stdin)
current=d.get('current_condition',[0])
if current:
    temp=current[0].get('temp_F','?')
    humidity=current[0].get('humidity','?')
    desc=current[0].get('weatherDesc',[{}])[0].get('value','?')
    print(f'{temp}|{humidity}|{desc}')
" 2>/dev/null)
    
    if [[ -n "$current" ]]; then
        local temp=$(echo "$current" | cut -d'|' -f1)
        local humidity=$(echo "$current" | cut -d'|' -f2)
        local desc=$(echo "$current" | cut -d'|' -f3)
        
        report+="**Now:** ${temp}°F, $desc
Humidity: ${humidity}%

"
    fi
    
    # Next 3 days
    report+="**Coming Days:**
"
    
    local future=$(echo "$weather" | python3 -c "
import sys,json
d=json.load(sys.stdin)
for day in d.get('weather',[])[:3]:
    date=day.get('date','?')
    max_t=day.get('maxtempF','?')
    min_t=day.get('mintempF','?')
    desc=day.get('hourly',[{}])[4].get('weatherDesc',[{}])[0].get('value','?')
    print(f'{date}|{max_t}|{min_t}|{desc}')
" 2>/dev/null)
    
    while IFS='|' read -r date max_t min_t desc; do
        if [[ "$date" != "?" ]]; then
            local date_short=$(date -jf "%Y-%m-%d" "$date" "+%a" 2>/dev/null || echo "$date")
            report+="• $date_short: $max_t°/$min_t° $desc
"
        fi
    done <<< "$future"
    
    echo "$report"
}

# -----------------------------------------------------------------------------
# Check for severe weather
# -----------------------------------------------------------------------------
check_severe() {
    local json="$1"
    
    # Check for thunderstorm codes
    local severe_codes=$(echo "$json" | grep -oE '"(95|96|99|2|3)"' | head -3)
    
    if [[ -n "$severe_codes" ]]; then
        return 0  # Severe weather detected
    fi
    return 1
}

# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------
main() {
    log "=== Weather Daily Started ==="
    
    local report=""
    local use_open_meteo=true
    
    # Try Open-Meteo first (more detailed)
    local meteo_data=$(fetch_open_meteo)
    
    if [[ -n "$meteo_data" && "$meteo_data" != *"error"* ]]; then
        log "Using Open-Meteo data"
        report=$(parse_open_meteo "$meteo_data")
        
        # Check for severe weather
        if check_severe "$meteo_data"; then
            log "Severe weather detected!"
            report+="

🚨 **SEVERE WEATHER POSSIBLE**"
        fi
    else
        log "Falling back to wttr.in"
        report=$(fetch_wttr_report)
    fi
    
    report+="
━━━━━━━━━━━━━━━━━━━━
🦆 *Weather Brief*"
    
    send_telegram "$report"
    
    log "=== Weather Daily Complete ==="
}

main "$@"
