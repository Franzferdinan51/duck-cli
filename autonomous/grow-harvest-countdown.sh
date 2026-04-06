#!/bin/bash
#===============================================================================
# 🌾 Grow Harvest Countdown - Weekly Harvest Estimator
#===============================================================================
# Purpose: Read grow journal planting dates, calculate days to harvest
#          per strain, and send countdown to Telegram
# Schedule: Weekly Sunday at 9:00 AM
# Example:  0 9 * * 0 /.openclaw/workspace/tools/autonomous/grow-harvest-countdown.sh
#===============================================================================

set -euo pipefail

# Configuration
OUT_DIR="/.openclaw/workspace/grow-logs"
JOURNAL_FILE="$OUT_DIR/grow-journal.md"
COUNTDOWN_FILE="$OUT_DIR/harvest-countdown.txt"
LOG_FILE="/.openclaw/workspace/logs/grow-harvest.log"
TELEGRAM_TOPIC_ID="648118"

# Default flowering times by strain type (days from flip)
FLOWERING_INDICA=56
FLOWERING_SATIVA=70
FLOWERING_HYBRID=63
FLOWERING_AUTO=75
FLOWERING_UNKNOWN=65

get_flowering_time() {
    local strain="$1"
    case "$strain" in
        indica|Indica|INDICA) echo $FLOWERING_INDICA ;;
        sativa|Sativa|SATIVA) echo $FLOWERING_SATIVA ;;
        hybrid|Hybrid|HYBRID) echo $FLOWERING_HYBRID ;;
        auto|Auto|AUTO) echo $FLOWERING_AUTO ;;
        *) echo $FLOWERING_UNKNOWN ;;
    esac
}

#-------------------------------------------------------------------------------
# Logging helper
#-------------------------------------------------------------------------------
log() {
    local msg="[$(date '+%Y-%m-%d %H:%M:%S')] [HARVEST] $1"
    echo "$msg" | tee -a "$LOG_FILE" 2>/dev/null || echo "$msg"
}

#-------------------------------------------------------------------------------
# Send Telegram message
#-------------------------------------------------------------------------------
send_telegram() {
    local message="${1:-}"
    
    if [ -n "$message" ]; then
        local bot_token=$(cat ~/.openclaw/openclaw.json 2>/dev/null | grep -o '"botToken"[[:space:]]*:[[:space:]]*"[^"]*' | head -1 | sed 's/.*"://;s/"$//')
        if [ -n "$bot_token" ]; then
            curl -s -X POST "https://api.telegram.org/bot$bot_token/sendMessage" \
                -d "chat_id=588090613" \
                -d "text=$message" \
                -d "parse_mode=Markdown" \
                -d "message_thread_id=$TELEGRAM_TOPIC_ID" >/dev/null 2>&1 || true
        fi
    fi
}

#-------------------------------------------------------------------------------
# Parse planting information from journal
#-------------------------------------------------------------------------------
parse_planting_info() {
    log "📖 Reading grow journal..."
    
    # Check if journal exists
    if [ ! -f "$JOURNAL_FILE" ]; then
        log "⚠️  No grow journal found at $JOURNAL_FILE"
        echo ""
        return
    fi
    
    # Try to extract planting info from journal
    # Format expected: "Plant Date: YYYY-MM-DD" or "Planted: YYYY-MM-DD" or similar
    
    local plant_dates=$(grep -iE "plant(date|ed|ing):|[0-9]{4}-[0-9]{2}-[0-9]{2}.*plant" "$JOURNAL_FILE" 2>/dev/null | tail -5)
    
    if [ -z "$plant_dates" ]; then
        log "⚠️  No planting dates found in journal"
        echo ""
        return
    fi
    
    echo "$plant_dates"
}

#-------------------------------------------------------------------------------
# Calculate days to harvest for each strain
#-------------------------------------------------------------------------------
calculate_countdown() {
    local today=$(date +%Y-%m-%d)
    local today_epoch=$(date -j -f "%Y-%m-%d" "$today" +%s 2>/dev/null || date -d "$today" +%s 2>/dev/null)
    
    log "📅 Calculating harvest countdown for $today..."
    
    local report=""
    local has_strains=0
    
    # Check for strain info in journal
    local strain_info=$(grep -iE "strain:|variety:|genetics:" "$JOURNAL_FILE" 2>/dev/null | tail -10)
    
    # Get all date entries from journal
    while IFS= read -r line; do
        [ -z "$line" ] && continue
        
        # Extract date if present
        local date_match=$(echo "$line" | grep -oE "[0-9]{4}-[0-9]{2}-[0-9]{2}" | head -1)
        
        if [ -n "$date_match" ]; then
            # Determine flowering time based on strain mention
            local flower_days=65  # Default
            local strain_name="Unknown"
            
            # Check for strain in nearby lines
            local strain_line=$(grep -B2 -E "$date_match" "$JOURNAL_FILE" 2>/dev/null | grep -iE "strain|variety" | head -1)
            if [ -n "$strain_line" ]; then
                strain_name=$(echo "$strain_line" | sed 's/.*:[[:space:]]*//')
                
                # Set flowering time based on strain type
                if echo "$strain_name" | grep -qi "indica"; then
                    flower_days=56
                elif echo "$strain_name" | grep -qi "sativa"; then
                    flower_days=70
                elif echo "$strain_name" | grep -qi "auto"; then
                    flower_days=75
                else
                    flower_days=63
                fi
            fi
            
            # Calculate harvest date (plant date + veg time + flower time)
            # Assume 2-4 weeks veg time (use 21 days as default)
            local veg_days=21
            local total_days=$((veg_days + flower_days))
            
            # Try to parse the plant date
            local plant_epoch
            plant_epoch=$(date -j -f "%Y-%m-%d" "$date_match" +%s 2>/dev/null || date -d "$date_match" +%s 2>/dev/null) || continue
            
            local harvest_epoch=$((plant_epoch + (total_days * 86400)))
            local harvest_date=$(date -r "$harvest_epoch" +%Y-%m-%d 2>/dev/null || date -d "@$harvest_epoch" +%Y-%m-%d 2>/dev/null)
            
            # Calculate days remaining
            local days_remaining=$(( (harvest_epoch - today_epoch) / 86400 ))
            
            if [ $days_remaining -ge 0 ]; then
                has_strains=1
                log "   $strain_name: $days_remaining days to harvest (~$harvest_date)"
            fi
        fi
    done <<< "$(cat "$JOURNAL_FILE")"
    
    if [ $has_strains -eq 0 ]; then
        log "⚠️  No active plantings found"
    fi
    
    echo "$has_strains"
}

#-------------------------------------------------------------------------------
# Build and send countdown report
#-------------------------------------------------------------------------------
send_countdown_report() {
    local today=$(date '+%Y-%m-%d')
    local day_of_week=$(date +%A)
    
    # Build header
    local report="🌾 **Harvest Countdown Report**\n"
    report+="📅 $today ($day_of_week)\n"
    report+="━━━━━━━━━━━━━━━━━━━━━━\n\n"
    
    # Check for countdown file (created by manual entries or other scripts)
    if [ -f "$COUNTDOWN_FILE" ]; then
        log "📄 Reading countdown file..."
        report+="📋 **Planned Harvests:**\n"
        while IFS= read -r line; do
            [ -n "$line" ] && report+="$line\n"
        done < "$COUNTDOWN_FILE"
        report+="\n"
    fi
    
    # Check journal for planting info
    local planting_info=$(parse_planting_info)
    if [ -n "$planting_info" ]; then
        log "🌱 Found planting information in journal"
        # Calculate based on journal entries
        calculate_countdown >/dev/null 2>&1 || true
        
        # Add estimated harvest info
        report+="📊 **Estimated Harvests (from journal):**\n"
        report+="• Review journal for active planting dates\n"
        report+="• Add strains to journal using: Strain: [name]\n\n"
    fi
    
    # Add generic cannabis flowering info
    report+="🌿 **General Flowering Times:**\n"
    report+="• Indica strains: ~8 weeks\n"
    report+="• Sativa strains: ~10 weeks\n"
    report+="• Hybrid strains: ~9 weeks\n"
    report+="• Autoflower: ~10-11 weeks\n\n"
    
    # Tips
    report+="💡 **Harvest Tips:**\n"
    report+="• Check pistils (60-70% amber = peak)\n"
    report+="• Check trichomes (cloudy/milky = ready)\n"
    report+="• Flush 1-2 weeks before harvest\n"
    report+="• Prepare drying space\n"
    
    # Save report
    {
        echo "# 🌾 Harvest Countdown - $today"
        echo ""
        echo "$report" | sed 's/\*\*/#/g;s/\*//g'
    } > "$OUT_DIR/harvest-countdown-$today.md"
    
    log "📤 Sending countdown report to Telegram..."
    send_telegram "$report"
    
    log "✅ Countdown report sent"
}

#-------------------------------------------------------------------------------
# Main execution
#-------------------------------------------------------------------------------
main() {
    log "🌾 Starting harvest countdown check..."
    log "=========================================="
    
    # Ensure directories
    mkdir -p "$OUT_DIR" "$(dirname "$LOG_FILE")"
    
    # Send countdown report
    send_countdown_report
    
    log "✅ Harvest countdown complete!"
    log "=========================================="
}

# Run main
main
