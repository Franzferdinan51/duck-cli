#!/bin/bash
# ============================================================================
# osint-account-watch.sh - Social Media Account Monitor
# Runs: Every 10 minutes
# Tracks: Diligent Denizen, HustleBitch, Ron Paul, Scott Horton, NAFO accounts
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/osint-config.sh"

SCRIPT_NAME="account-watch"
LOG_FILE="${LOG_DIR}/osint-${SCRIPT_NAME}.log"

# ============================================================================
# SEARCH ACCOUNT FOR RECENT POSTS
# ============================================================================
search_account_posts() {
    local account_name="$1"
    local search_handle="$2"
    local platform="$3"
    
    local results=""
    
    # Search for recent posts from this account
    # Use Brave Search with account-specific query
    local query="${search_handle} site:twitter.com OR site:x.com OR site:gettr.com $(date +%Y-%m-%d | sed 's/-/ /3')"
    
    case "$platform" in
        "X")
            # Try X/Twitter specific search
            query="${search_handle} ${account_name} $(date +%Y-%m-%d)"
            ;;
        "Truth")
            query="${search_handle} Truth Social $(date +%Y-%m-%d)"
            ;;
        *)
            query="${search_handle} ${account_name}"
            ;;
    esac
    
    # Rate limit check
    check_rate_limit "brave_search" 60
    
    # Perform search
    results=$(web_search "$query" 5)
    
    echo "$results"
}

# ============================================================================
# MAIN FUNCTION
# ============================================================================
main() {
    log_osint "$SCRIPT_NAME" "Starting account watch scan"
    
    local alert_count=0
    local alert_message=""
    local new_posts=false
    
    alert_message="👤 ACCOUNT WATCH — $(date '+%H:%M %m/%d') 🦆\n"
    alert_message+="━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n"
    
    # Process each tracked account
    for account_entry in "${TRACKED_ACCOUNTS[@]}"; do
        # Parse entry (format: "display_name|search_handle|platform")
        IFS='|' read -r display_name search_handle platform <<< "$account_entry"
        
        log_osint "$SCRIPT_NAME" "Checking account: $display_name (@${search_handle})"
        
        # Check rate limit
        check_rate_limit "brave_search" 60
        
        # Get recent posts
        local posts=$(search_account_posts "$display_name" "$search_handle" "$platform")
        
        if [[ -n "$posts" && "$posts" != '{"query"'* ]]; then
            # Try to parse results
            if command -v jq &>/dev/null; then
                local results_count=$(echo "$posts" | jq '.results | length' 2>/dev/null || echo "0")
                
                if [[ "$results_count" -gt 0 ]]; then
                    log_osint "$SCRIPT_NAME" "Found $results_count potential posts for '$display_name'"
                    
                    # Create unique ID for this account's new posts
                    local account_found=false
                    
                    while IFS= read -r result_json; do
                        local title=$(echo "$result_json" | jq -r '.title // empty' 2>/dev/null)
                        local url=$(echo "$result_json" | jq -r '.url // empty' 2>/dev/null)
                        local snippet=$(echo "$result_json" | jq -r '.description // empty' 2>/dev/null | head -c 250)
                        
                        # Skip if missing essential data
                        [[ -z "$title" || "$title" == "null" ]] && continue
                        [[ -z "$url" || "$url" == "null" ]] && continue
                        
                        # Create unique ID
                        local post_id=$(echo "$url" | md5sum | cut -d' ' -f1)
                        local account_post_id="${display_name// /}_${post_id}"
                        
                        # Check if already seen
                        if is_seen "post" "$account_post_id"; then
                            continue
                        fi
                        
                        # New post found!
                        mark_seen "post" "$account_post_id"
                        new_posts=true
                        ((alert_count++))
                        
                        if [[ "$account_found" == "false" ]]; then
                            alert_message+="📱 ${display_name}\n"
                            account_found=true
                        fi
                        
                        alert_message+="━━━━━━━━━━━━\n"
                        alert_message+="• ${title}\n"
                        alert_message+="  🔗 ${url}\n"
                        if [[ -n "$snippet" && "$snippet" != "null" ]]; then
                            alert_message+="  💬 ${snippet}...\n"
                        fi
                        alert_message+="\n"
                        
                    done < <(echo "$posts" | jq -r '.results[] | @json' 2>/dev/null)
                fi
            else
                # Fallback parsing
                local urls=$(echo "$posts" | grep -oE 'https?://[^"[:space:]]+' | head -5)
                
                if [[ -n "$urls" ]]; then
                    while IFS= read -r url; do
                        local post_id=$(echo "$url" | md5sum | cut -d' ' -f1)
                        local account_post_id="${display_name// /}_${post_id}"
                        
                        if ! is_seen "post" "$account_post_id"; then
                            mark_seen "post" "$account_post_id"
                            new_posts=true
                            ((alert_count++))
                            
                            alert_message+="📱 ${display_name}\n"
                            alert_message+="━━━━━━━━━━━━\n"
                            alert_message+="• ${url}\n"
                            alert_message+="  🔗 ${url}\n\n"
                        fi
                    done <<< "$urls"
                fi
            fi
        fi
        
        # Rate limit between accounts (10 seconds)
        sleep 3
    done
    
    # Finalize message
    alert_message+="━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
    alert_message+="🤖 DuckBot OSINT • Checked ${#TRACKED_ACCOUNTS[@]} accounts • $alert_count new posts"
    
    # Send alert if we found new posts
    if [[ "$new_posts" == "true" ]]; then
        log_osint "$SCRIPT_NAME" "Found $alert_count new posts, sending alert"
        
        if send_telegram "$alert_message" "$TELEGRAM_TOPIC_ID"; then
            log_osint "$SCRIPT_NAME" "Alert sent successfully"
        else
            log_osint "$SCRIPT_NAME" "Failed to send alert"
        fi
    else
        log_osint "$SCRIPT_NAME" "No new posts found"
    fi
    
    log_osint "$SCRIPT_NAME" "Account watch complete"
}

# ============================================================================
# ERROR HANDLING
# ============================================================================
trap 'log_osint "$SCRIPT_NAME" "ERROR: Script failed at line $LINENO"; exit 1' ERR

# ============================================================================
# RUN
# ============================================================================
main "$@"
