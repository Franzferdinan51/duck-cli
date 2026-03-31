#!/bin/bash
# ============================================================================
# osint-keyword-alert.sh - Keyword Mention Monitor
# Runs: Every 30 minutes
# Tracks: DuckBot, CannaAI, RS-Agent, ClawdWatch, Duckets, NAFO, Fellas
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/osint-config.sh"

SCRIPT_NAME="keyword"
LOG_FILE="${LOG_DIR}/osint-${SCRIPT_NAME}.log"

# ============================================================================
# MAIN FUNCTION
# ============================================================================
main() {
    log_osint "$SCRIPT_NAME" "Starting keyword alert scan"
    
    local alert_count=0
    local alert_message=""
    local new_mentions=false
    
    alert_message="🔔 KEYWORD ALERTS — $(date '+%H:%M %m/%d') 🦆\n"
    alert_message+="━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n"
    
    # Search for each keyword
    for keyword in "${KEYWORDS[@]}"; do
        log_osint "$SCRIPT_NAME" "Searching keyword: $keyword"
        
        # Check rate limit (60s between searches)
        check_rate_limit "brave_search" 60
        
        # Perform search
        local results=$(web_search "$keyword" 10)
        
        if [[ -n "$results" && "$results" != '{"query"'* ]]; then
            # Create a hash of the keyword for cache
            local cache_key="keyword_${keyword// /_}"
            
            # Try to parse results and check for new mentions
            if command -v jq &>/dev/null; then
                # Check if we have results array
                local results_count=$(echo "$results" | jq '.results | length' 2>/dev/null || echo "0")
                
                if [[ "$results_count" -gt 0 ]]; then
                    log_osint "$SCRIPT_NAME" "Found $results_count results for '$keyword'"
                    
                    # Process each result
                    while IFS= read -r result_json; do
                        local title=$(echo "$result_json" | jq -r '.title // empty' 2>/dev/null)
                        local url=$(echo "$result_json" | jq -r '.url // empty' 2>/dev/null)
                        local snippet=$(echo "$result_json" | jq -r '.description // empty' 2>/dev/null | head -c 200)
                        
                        # Skip if missing essential data
                        [[ -z "$title" || "$title" == "null" ]] && continue
                        [[ -z "$url" || "$url" == "null" ]] && continue
                        
                        # Create unique ID for this mention
                        local mention_id=$(echo "$url" | md5sum | cut -d' ' -f1)
                        
                        # Check if already seen
                        if is_seen "mention" "$mention_id"; then
                            continue
                        fi
                        
                        # New mention found!
                        mark_seen "mention" "$mention_id"
                        new_mentions=true
                        ((alert_count++))
                        
                        alert_message+="📢 Keyword: $keyword\n"
                        alert_message+="• ${title}\n"
                        alert_message+="  🔗 ${url}\n"
                        if [[ -n "$snippet" && "$snippet" != "null" ]]; then
                            alert_message+="  💬 ${snippet}...\n"
                        fi
                        alert_message+="\n"
                        
                    done < <(echo "$results" | jq -r '.results[] | @json' 2>/dev/null)
                fi
            else
                # Fallback: extract URLs and basic text
                local urls=$(echo "$results" | grep -oE 'https?://[^"[:space:]]+' | head -5)
                
                if [[ -n "$urls" ]]; then
                    while IFS= read -r url && [[ $alert_count -lt 10 ]]; do
                        local mention_id=$(echo "$url" | md5sum | cut -d' ' -f1)
                        
                        if ! is_seen "mention" "$mention_id"; then
                            mark_seen "mention" "$mention_id"
                            new_mentions=true
                            ((alert_count++))
                            
                            alert_message+="📢 Keyword: $keyword\n"
                            alert_message+="• ${url}\n"
                            alert_message+="  🔗 ${url}\n\n"
                        fi
                    done <<< "$urls"
                fi
            fi
        fi
        
        # Rate limit between keyword searches
        sleep 3
    done
    
    # Finalize message
    alert_message+="━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
    alert_message+="🤖 DuckBot OSINT • Found $alert_count new mentions"
    
    # Send alert if we found new mentions
    if [[ "$new_mentions" == "true" ]]; then
        log_osint "$SCRIPT_NAME" "Found $alert_count new mentions, sending alert"
        
        if send_telegram "$alert_message" "$TELEGRAM_TOPIC_ID"; then
            log_osint "$SCRIPT_NAME" "Alert sent successfully"
        else
            log_osint "$SCRIPT_NAME" "Failed to send alert"
        fi
    else
        log_osint "$SCRIPT_NAME" "No new mentions found"
    fi
    
    log_osint "$SCRIPT_NAME" "Keyword scan complete"
}

# ============================================================================
# ERROR HANDLING
# ============================================================================
trap 'log_osint "$SCRIPT_NAME" "ERROR: Script failed at line $LINENO"; exit 1' ERR

# ============================================================================
# RUN
# ============================================================================
main "$@"
