#!/bin/bash
# ============================================================================
# osint-briefing.sh - Daily OSINT Briefing Generator
# Runs: Daily at 9 AM
# Topics: Ukraine/NAFO, Epstein/corruption, cannabis regulation
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/osint-config.sh"

SCRIPT_NAME="briefing"
LOG_FILE="${LOG_DIR}/osint-${SCRIPT_NAME}.log"

# ============================================================================
# MAIN FUNCTION
# ============================================================================
main() {
    log_osint "$SCRIPT_NAME" "Starting daily briefing generation"
    
    local briefing=""
    local topic_results=""
    local has_results=false
    
    # Topic queries for web search
    # Topic queries
TOPIC1="Ukraine war NAFO updates"
TOPIC2="Epstein documents corruption investigation"
TOPIC3="cannabis legalization regulation 2026"

get_topic_query() {
    case "$1" in
        1) echo "$TOPIC1" ;;
        2) echo "$TOPIC2" ;;
        3) echo "$TOPIC3" ;;
        *) echo "" ;;
    esac
}
    
    # Generate header
    briefing="📰 OSINT BRIEFING — $(date '+%B %d, %Y') 🦆\n"
    briefing+="━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n"
    
    # Process each topic
    for topic in "Ukraine/NAFO" "Epstein/Corruption" "Cannabis Regulation"; do
        log_osint "$SCRIPT_NAME" "Searching for: $topic"
        
        # Map to config key
        local config_key="${topic//\//}"
        local query
        case "$topic" in
            "Ukraine/NAFO") query="$TOPIC1" ;;
            "Epstein/Corruption") query="$TOPIC2" ;;
            "Cannabis Regulation") query="$TOPIC3" ;;
            *) query="" ;;
        esac
        
        if [[ -z "$query" ]]; then
            log_osint "$SCRIPT_NAME" "No query for topic: $topic"
            continue
        fi
        
        # Perform search using web_search tool
        local results=$(web_search "$query" 5)
        
        if [[ -n "$results" ]]; then
            has_results=true
            briefing+="📌 $topic\n"
            briefing+="─────────────\n"
            
            # Parse and format results
            local -a links=()
            local count=0
            
            # Try to extract results from Brave Search JSON
            if command -v jq &>/dev/null && echo "$results" | jq -e '.results' &>/dev/null; then
                while IFS= read -r result && [[ $count -lt 3 ]]; do
                    local title=$(echo "$result" | jq -r '.title // empty')
                    local url=$(echo "$result" | jq -r '.url // empty')
                    local snippet=$(echo "$result" | jq -r '.description // empty' | head -c 150)
                    
                    if [[ -n "$title" && -n "$url" && "$title" != "null" ]]; then
                        briefing+="• ${title}\n"
                        briefing+="  🔗 ${url}\n"
                        if [[ -n "$snippet" && "$snippet" != "null" ]]; then
                            briefing+="  ${snippet}...\n"
                        fi
                        briefing+="\n"
                        ((count++))
                    fi
                done < <(echo "$results" | jq -r '.results[] | @json' 2>/dev/null)
            else
                # Fallback: try to extract from JSON
                local titles=$(echo "$results" | jq -r '.. | strings | select(test("title|description|url"; "i")) | select(test("http"; "i") | not)' 2>/dev/null | head -10)
                local urls=$(echo "$results" | grep -oE 'https?://[^"[:space:]]+' | head -5)
                
                if [[ -n "$urls" ]]; then
                    count=0
                    while IFS= read -r url && [[ $count -lt 3 ]]; do
                        briefing+="• ${url}\n"
                        briefing+="  🔗 ${url}\n\n"
                        ((count++))
                    done <<< "$urls"
                fi
            fi
            
            briefing+="\n"
        else
            log_osint "$SCRIPT_NAME" "No results for: $topic"
            briefing+="📌 $topic\n"
            briefing+="─────────────\n"
            briefing+="⚠️ No recent results found\n\n"
        fi
        
        # Rate limit between topics
        sleep 2
    done
    
    # Add footer
    briefing+="━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
    briefing+="🤖 DuckBot OSINT • Generated $(date '+%H:%M:%S %Z')\n"
    briefing+="📊 Topics: Ukraine/NAFO, Epstein/Corruption, Cannabis"
    
    # Send to Telegram
    if [[ "$has_results" == "true" ]] || true; then  # Always send, even partial
        log_osint "$SCRIPT_NAME" "Sending briefing to Telegram topic ${TELEGRAM_TOPIC_ID}"
        if send_telegram "$briefing" "$TELEGRAM_TOPIC_ID"; then
            log_osint "$SCRIPT_NAME" "Briefing sent successfully"
        else
            log_osint "$SCRIPT_NAME" "Failed to send briefing to Telegram"
            # Try to log the briefing for debugging
            echo "$briefing" >> "${LOG_DIR}/osint-${SCRIPT_NAME}-failed.log"
        fi
    fi
    
    log_osint "$SCRIPT_NAME" "Briefing generation complete"
}

# ============================================================================
# ERROR HANDLING
# ============================================================================
trap 'log_osint "$SCRIPT_NAME" "ERROR: Script failed at line $LINENO"; exit 1' ERR

# ============================================================================
# RUN
# ============================================================================
main "$@"
