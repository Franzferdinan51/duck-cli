#!/bin/bash
# ============================================================================
# osint-reddit-digest.sh - Reddit Subreddit Digest
# Runs: 9 AM and 6 PM daily
# Subreddits: r/microgrowery, r/SSB (Space Station 13), r/privacy, r/OSRS
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/osint-config.sh"

SCRIPT_NAME="reddit-digest"
LOG_FILE="${LOG_DIR}/osint-${SCRIPT_NAME}.log"

# ============================================================================
# FETCH SUBREDDIT POSTS
# ============================================================================
fetch_subreddit_posts() {
    local subreddit="$1"
    local sort="${2:-top}"  # top, hot, new
    local limit="${3:-10}"
    
    log_osint "$SCRIPT_NAME" "Fetching r/${subreddit} (${sort})"
    
    # Rate limit check
    check_rate_limit "reddit_api" 30
    
    # Use Reddit JSON API
    local data=$(curl -s --retry 3 --retry-delay 2 \
        -H "User-Agent: DuckBot-OSINT/1.0 (by /u/duckets)" \
        "https://www.reddit.com/r/${subreddit}/${sort}.json?limit=${limit}&t=day" 2>/dev/null)
    
    echo "$data"
}

# ============================================================================
# PARSE AND FORMAT POST
# ============================================================================
format_post() {
    local post_json="$1"
    
    local title=$(echo "$post_json" | jq -r '.data.title // empty' 2>/dev/null)
    local score=$(echo "$post_json" | jq -r '.data.score // 0' 2>/dev/null)
    local num_comments=$(echo "$post_json" | jq -r '.data.num_comments // 0' 2>/dev/null)
    local subreddit=$(echo "$post_json" | jq -r '.data.subreddit // empty' 2>/dev/null)
    local permalink=$(echo "$post_json" | jq -r '.data.permalink // empty' 2>/dev/null)
    local url=$(echo "$post_json" | jq -r '.data.url // empty' 2>/dev/null)
    local author=$(echo "$post_json" | jq -r '.data.author // "[deleted]"' 2>/dev/null)
    local created=$(echo "$post_json" | jq -r '.data.created_utc // 0' 2>/dev/null)
    local link_flair=$(echo "$post_json" | jq -r '.data.link_flair_text // empty' 2>/dev/null)
    
    # Skip if missing essential data
    [[ -z "$title" || "$title" == "null" ]] && return 1
    
    # Format timestamp
    local time_ago=""
    if [[ -n "$created" && "$created" != "0" ]]; then
        local age_seconds=$(echo "$(date +%s) - $created" | bc 2>/dev/null || echo "0")
        if [[ $age_seconds -lt 3600 ]]; then
            time_ago="${age_seconds%s}s ago"
        elif [[ $age_seconds -lt 86400 ]]; then
            time_ago="$((age_seconds / 3600))h ago"
        else
            time_ago="$((age_seconds / 86400))d ago"
        fi
    fi
    
    # Build formatted output
    local formatted=""
    formatted+="📌 ${title}\n"
    [[ -n "$link_flair" && "$link_flair" != "null" ]] && formatted+="   🏷️ ${link_flair}\n"
    formatted+="   ⬆️ ${score} pts • 💬 ${num_comments} comments • u/${author}"
    [[ -n "$time_ago" ]] && formatted+=" • ${time_ago}"
    formatted+="\n"
    [[ -n "$permalink" && "$permalink" != "null" ]] && formatted+="   🔗 reddit.com${permalink}\n"
    
    echo "$formatted"
}

# ============================================================================
# MAIN FUNCTION
# ============================================================================
main() {
    log_osint "$SCRIPT_NAME" "Starting Reddit digest"
    
    local hour=$(date +%H)
    local digest_time="AM"
    [[ $hour -ge 12 ]] && digest_time="PM"
    
    local digest_message=""
    local total_posts=0
    local has_posts=false
    
    digest_message="📱 REDDIT DIGEST — $(date '+%I:00 %A') ${digest_time} 🦆\n"
    digest_message+="━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n"
    
    # Process each subreddit
    for subreddit in "${TRACKED_SUBREDDITS[@]}"; do
        log_osint "$SCRIPT_NAME" "Processing r/${subreddit}"
        
        # Get posts from last 24 hours
        local data=$(fetch_subreddit_posts "$subreddit" "top" 10)
        
        if [[ -n "$data" ]]; then
            digest_message+="r/${subreddit}\n"
            digest_message+="━━━━━━━━━━━━\n"
            
            local post_count=0
            
            # Parse posts
            if command -v jq &>/dev/null; then
                while IFS= read -r post_json && [[ $post_count -lt 5 ]]; do
                    # Get unique ID for this post
                    local post_id=$(echo "$post_json" | jq -r '.data.id // empty' 2>/dev/null)
                    
                    if [[ -z "$post_id" || "$post_id" == "null" ]]; then
                        continue
                    fi
                    
                    # Check if already seen
                    if is_seen "reddit_${subreddit}" "$post_id"; then
                        continue
                    fi
                    
                    # Mark as seen
                    mark_seen "reddit_${subreddit}" "$post_id"
                    
                    # Format post
                    local formatted=$(format_post "$post_json")
                    if [[ -n "$formatted" ]]; then
                        digest_message+="$formatted"
                        digest_message+="\n"
                        ((post_count++))
                        ((total_posts++))
                    fi
                done < <(echo "$data" | jq -r '.data.children[] | @json' 2>/dev/null)
            else
                # Fallback: try basic extraction
                digest_message+="⚠️ jq not available, raw data:\n"
                local urls=$(echo "$data" | grep -oE '"permalink":"[^"]*"' | head -5 | sed 's/"permalink":"//g; s/\\//g; s/"//g')
                while IFS= read -r permalink && [[ $post_count -lt 5 ]]; do
                    digest_message+="📌 ${permalink}\n"
                    digest_message+="   🔗 reddit.com${permalink}\n\n"
                    ((post_count++))
                    ((total_posts++))
                done <<< "$urls"
            fi
            
            if [[ $post_count -eq 0 ]]; then
                digest_message+="   No new posts in last 24h\n"
            fi
            
            has_posts=true
        else
            digest_message+="r/${subreddit}\n"
            digest_message+="━━━━━━━━━━━━\n"
            digest_message+="   ⚠️ Failed to fetch posts\n"
        fi
        
        digest_message+="\n"
        
        # Rate limit between subreddits
        sleep 2
    done
    
    # Finalize message
    digest_message+="━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
    digest_message+="🤖 DuckBot OSINT • ${#TRACKED_SUBREDDITS[@]} subreddits • ${total_posts} new posts"
    
    # Send digest
    log_osint "$SCRIPT_NAME" "Sending digest with $total_posts posts"
    
    if send_telegram "$digest_message" "$TELEGRAM_TOPIC_ID"; then
        log_osint "$SCRIPT_NAME" "Digest sent successfully"
    else
        log_osint "$SCRIPT_NAME" "Failed to send digest"
    fi
    
    log_osint "$SCRIPT_NAME" "Reddit digest complete"
}

# ============================================================================
# ERROR HANDLING
# ============================================================================
trap 'log_osint "$SCRIPT_NAME" "ERROR: Script failed at line $LINENO"; exit 1' ERR

# ============================================================================
# RUN
# ============================================================================
main "$@"
