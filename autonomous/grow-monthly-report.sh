#!/bin/bash
#===============================================================================
# 📊 Grow Monthly Report - Monthly Statistics Compilation
#===============================================================================
# Purpose: Compile monthly stats (temp/humidity/VPD averages),
#          equipment runtime, photo timeline, and send formatted report
# Schedule: Monthly on the 1st at 8:00 AM
# Example:  0 8 1 * * /.openclaw/workspace/tools/autonomous/grow-monthly-report.sh
#===============================================================================

set -euo pipefail

# Configuration
OUT_DIR="/.openclaw/workspace/grow-logs"
DATA_DIR="$OUT_DIR/data"
LOG_FILE="/.openclaw/workspace/logs/grow-monthly.log"
TELEGRAM_TOPIC_ID="648118"

# Previous month (for the report)
REPORT_MONTH=$(date -v-1m '+%Y-%m' 2>/dev/null || date -d "$(date +%Y-%m-01) -1 month" '+%Y-%m' 2>/dev/null)
REPORT_MONTH_NAME=$(date -v-1m '+%B %Y' 2>/dev/null || date -d "$(date +%Y-%m-01) -1 month" '+%B %Y' 2>/dev/null)

#-------------------------------------------------------------------------------
# Logging helper
#-------------------------------------------------------------------------------
log() {
    local msg="[$(date '+%Y-%m-%d %H:%M:%S')] [MONTHLY] $1"
    echo "$msg" | tee -a "$LOG_FILE" 2>/dev/null || echo "$msg"
}

#-------------------------------------------------------------------------------
# Send Telegram message
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
# Calculate average from values
#-------------------------------------------------------------------------------
calculate_avg() {
    local values=("$@")
    local sum=0
    local count=0
    
    for val in "${values[@]}"; do
        if [ -n "$val" ] && [ "$val" != "NA" ]; then
            sum=$(echo "$sum + $val" | bc -l 2>/dev/null || echo "$sum")
            count=$((count + 1))
        fi
    done
    
    if [ $count -gt 0 ]; then
        echo "scale=1; $sum / $count" | bc -l 2>/dev/null || echo "N/A"
    else
        echo "N/A"
    fi
}

#-------------------------------------------------------------------------------
# Compile environmental statistics
#-------------------------------------------------------------------------------
compile_env_stats() {
    log "📊 Compiling environmental statistics for $REPORT_MONTH..."
    
    local temps=()
    local humids=()
    local vpds=()
    
    # Search for data files from last month
    local month_prefix="${REPORT_MONTH}-"
    
    # Find all JSON data files
    while IFS= read -r json_file; do
        [ -z "$json_file" ] && continue
        
        # Extract values from JSON
        local temp=$(grep -o '"temperature_f": [0-9.]*' "$json_file" 2>/dev/null | head -1 | grep -o '[0-9.]*' || echo "")
        local humid=$(grep -o '"humidity_rh": [0-9.]*' "$json_file" 2>/dev/null | head -1 | grep -o '[0-9.]*' || echo "")
        local vpd=$(grep -o '"vpd_kpa": [0-9.]*' "$json_file" 2>/dev/null | head -1 | grep -o '[0-9.]*' || echo "")
        
        [ -n "$temp" ] && temps+=("$temp")
        [ -n "$humid" ] && humids+=("$humid")
        [ -n "$vpd" ] && vpds+=("$vpd")
        
    done < <(find "$DATA_DIR" -name "*.json" -newermt "${REPORT_MONTH}-01" ! -newermt "$(date -d "${REPORT_MONTH}-01 +1 month" +%Y-%m-%d 2>/dev/null || echo "${REPORT_MONTH}-31")" 2>/dev/null)
    
    # Also check main grow-logs directory
    while IFS= read -r json_file; do
        [ -z "$json_file" ] && continue
        
        local temp=$(grep -o '"temperature_f": [0-9.]*' "$json_file" 2>/dev/null | head -1 | grep -o '[0-9.]*' || echo "")
        local humid=$(grep -o '"humidity_rh": [0-9.]*' "$json_file" 2>/dev/null | head -1 | grep -o '[0-9.]*' || echo "")
        local vpd=$(grep -o '"vpd_kpa": [0-9.]*' "$json_file" 2>/dev/null | head -1 | grep -o '[0-9.]*' || echo "")
        
        [ -n "$temp" ] && temps+=("$temp")
        [ -n "$humid" ] && humids+=("$humid")
        [ -n "$vpd" ] && vpds+=("$vpd")
        
    done < <(find "$OUT_DIR" -maxdepth 1 -name "*.json" -newermt "${REPORT_MONTH}-01" ! -newermt "$(date -d "${REPORT_MONTH}-01 +1 month" +%Y-%m-%d 2>/dev/null || echo "${REPORT_MONTH}-31")" 2>/dev/null)
    
    # Calculate averages
    local avg_temp=$(calculate_avg "${temps[@]}")
    local avg_humid=$(calculate_avg "${humids[@]}")
    local avg_vpd=$(calculate_avg "${vpds[@]}")
    
    # Get min/max for temperature
    local min_temp=$(printf '%s\n' "${temps[@]}" | sort -n | head -1 || echo "N/A")
    local max_temp=$(printf '%s\n' "${temps[@]}" | sort -n | tail -1 || echo "N/A")
    
    log "   Avg Temp: $avg_temp°F (range: $min_temp-$max_temp°F)"
    log "   Avg Humidity: $avg_humid%"
    log "   Avg VPD: $avg_vpd kPa"
    
    # Return values
    echo "$avg_temp|$avg_humid|$avg_vpd|$min_temp|$max_temp|${#temps[@]}"
}

#-------------------------------------------------------------------------------
# Count photos taken in the month
#-------------------------------------------------------------------------------
count_photos() {
    log "📸 Counting photos from $REPORT_MONTH..."
    
    local photo_count=$(find "$OUT_DIR" -name "*.jpg" -o -name "*.png" 2>/dev/null | \
        while IFS= read -r f; do
            # Check if file is from last month
            local file_date=$(date -r "$f" +%Y-%m 2>/dev/null || echo "")
            [ "$file_date" = "$REPORT_MONTH" ] && echo "$f"
        done | wc -l)
    
    log "   Photo count: $photo_count"
    echo "$photo_count"
}

#-------------------------------------------------------------------------------
# Check for alerts in the month
#-------------------------------------------------------------------------------
count_alerts() {
    log "🚨 Counting alerts from $REPORT_MONTH..."
    
    local alert_count=0
    local alert_file="$OUT_DIR/alerts.log"
    
    if [ -f "$alert_file" ]; then
        alert_count=$(grep "$REPORT_MONTH" "$alert_file" 2>/dev/null | wc -l || echo "0")
    fi
    
    log "   Alert count: $alert_count"
    echo "$alert_count"
}

#-------------------------------------------------------------------------------
# Estimate equipment runtime
#-------------------------------------------------------------------------------
estimate_runtime() {
    log "⏱️  Estimating equipment runtime..."
    
    # Assume equipment runs based on monitoring data
    # Count screenshots as proxy for runtime (one every 5 min = 288/day)
    local screenshot_count=$(find "$OUT_DIR" -name "ac-infinity-*.png" -newermt "${REPORT_MONTH}-01" 2>/dev/null | wc -l || echo "0")
    
    # Estimate hours (each screenshot = ~5 min runtime)
    local estimated_hours=$((screenshot_count * 5 / 60))
    
    if [ $estimated_hours -gt 24 ]; then
        estimated_hours=24  # Cap at reasonable max
    fi
    
    log "   Estimated runtime: ~$estimated_hours hours/day"
    echo "$estimated_hours"
}

#-------------------------------------------------------------------------------
# Get journal summary
#-------------------------------------------------------------------------------
get_journal_summary() {
    log "📖 Getting journal summary..."
    
    local summary=""
    
    if [ -f "$OUT_DIR/grow-journal.md" ]; then
        # Count entries from last month
        local entry_count=$(grep -c "$REPORT_MONTH" "$OUT_DIR/grow-journal.md" 2>/dev/null || echo "0")
        summary="Journal entries: $entry_count"
    else
        summary="No journal entries found"
    fi
    
    echo "$summary"
}

#-------------------------------------------------------------------------------
# Build and send monthly report
#-------------------------------------------------------------------------------
send_monthly_report() {
    local avg_temp="$1"
    local avg_humid="$2"
    local avg_vpd="$3"
    local min_temp="$4"
    local max_temp="$5"
    local data_points="$6"
    local photo_count="$7"
    local alert_count="$8"
    local equipment_hours="$9"
    local journal_summary="${10}"
    
    log "📤 Building monthly report..."
    
    # Build report
    local report="📊 **Monthly Grow Report - $REPORT_MONTH_NAME**\n"
    report+="━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n"
    
    report+="🌡️ **Environmental Summary:**\n"
    report+="• Avg Temperature: ${avg_temp}°F\n"
    report+="  → Range: ${min_temp}°F - ${max_temp}°F\n"
    report+="• Avg Humidity: ${avg_humid}%\n"
    report+="• Avg VPD: ${avg_vpd} kPa\n"
    report+="• Data points: ${data_points}\n\n"
    
    report+="📸 **Monitoring Activity:**\n"
    report+="• Photos captured: ${photo_count}\n"
    report+="• Equipment runtime: ~${equipment_hours} hrs/day\n\n"
    
    report+="🚨 **Alerts:**\n"
    if [ "$alert_count" -gt 0 ]; then
        report+="• $alert_count threshold alerts triggered\n"
    else
        report+="• No alerts - all systems normal ✅\n"
    fi
    report+="\n"
    
    report+="$journal_summary\n\n"
    
    # Add strain info if available
    if [ -f "$OUT_DIR/grow-journal.md" ]; then
        local strains=$(grep -i "strain:" "$OUT_DIR/grow-journal.md" 2>/dev/null | tail -3 | sed 's/.*strain:[[:space:]]*//i' | sort -u)
        if [ -n "$strains" ]; then
            report+="🌿 **Active Strains:**\n"
            while IFS= read -r strain; do
                [ -n "$strain" ] && report+="• $strain\n"
            done <<< "$strains"
            report+="\n"
        fi
    fi
    
    # Goals for next month
    report+="🎯 **Goals for $(date '+%B %Y'):**\n"
    report+="• Continue monitoring VPD < 1.8 kPa\n"
    report+="• Maintain temp 70-80°F range\n"
    report+="• Keep humidity 45-55% during flower\n"
    
    # Save full report to file
    local report_file="$OUT_DIR/monthly-report-$REPORT_MONTH.md"
    {
        echo "# 📊 Monthly Grow Report - $REPORT_MONTH_NAME"
        echo ""
        echo "$report" | sed 's/\*\*/#/g;s/\*//g;s/botToken.*//g'
        echo ""
        echo "_Generated: $(date '+%Y-%m-%d %H:%M')_"
    } > "$report_file"
    
    log "✅ Report saved to $report_file"
    
    # Send to Telegram
    send_telegram "$report"
    
    log "✅ Monthly report sent!"
}

#-------------------------------------------------------------------------------
# Main execution
#-------------------------------------------------------------------------------
main() {
    log "📊 Starting monthly report generation..."
    log "=========================================="
    log "   Report period: $REPORT_MONTH_NAME"
    
    # Ensure directories
    mkdir -p "$OUT_DIR" "$DATA_DIR" "$(dirname "$LOG_FILE")"
    
    # Compile statistics
    local env_stats=$(compile_env_stats)
    local avg_temp=$(echo "$env_stats" | cut -d'|' -f1)
    local avg_humid=$(echo "$env_stats" | cut -d'|' -f2)
    local avg_vpd=$(echo "$env_stats" | cut -d'|' -f3)
    local min_temp=$(echo "$env_stats" | cut -d'|' -f4)
    local max_temp=$(echo "$env_stats" | cut -d'|' -f5)
    local data_points=$(echo "$env_stats" | cut -d'|' -f6)
    
    local photo_count=$(count_photos)
    local alert_count=$(count_alerts)
    local equipment_hours=$(estimate_runtime)
    local journal_summary=$(get_journal_summary)
    
    # Send report
    send_monthly_report "$avg_temp" "$avg_humid" "$avg_vpd" "$min_temp" "$max_temp" \
                        "$data_points" "$photo_count" "$alert_count" \
                        "$equipment_hours" "$journal_summary"
    
    log "✅ Monthly report complete!"
    log "=========================================="
}

# Run main
main
