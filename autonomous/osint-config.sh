#!/bin/bash
# ============================================================================
# osint-config.sh - OSINT Monitoring Configuration
# Sourced by all OSINT monitoring scripts
# ============================================================================

# Directory paths
OSINT_DIR="/Users/duckets/.openclaw/workspace/tools/autonomous"
LOG_DIR="/Users/duckets/.openclaw/workspace/logs"
CACHE_DIR="${OSINT_DIR}/cache"
STATE_DIR="${OSINT_DIR}/state"

# Ensure directories exist
mkdir -p "${LOG_DIR}" "${CACHE_DIR}" "${STATE_DIR}"

# ============================================================================
# TELEGRAM CONFIGURATION
# ============================================================================
TELEGRAM_BOT_TOKEN="${TELEGRAM_BOT_TOKEN:-}"  # Set in environment or get from config
TELEGRAM_CHAT_ID="${TELEGRAM_CHAT_ID:-588090613}"
TELEGRAM_TOPIC_ID="647894"  # OSINT topic

# ============================================================================
# TELEGRAM SEND FUNCTION
# Usage: send_telegram "message" [topic_id]
# ============================================================================
send_telegram() {
    local message="$1"
    local topic_id="${2:-$TELEGRAM_TOPIC_ID}"
    local bot_token="${TELEGRAM_BOT_TOKEN}"
    
    # Try to get token from config if not set
    if [[ -z "$bot_token" ]]; then
        bot_token=$(grep -A5 '"telegram"' /Users/duckets/.openclaw/openclaw.json 2>/dev/null | grep 'token' | head -1 | sed 's/.*"token"[[:space:]]*:[[:space:]]*"//' | sed 's/".*//' || echo "")
    fi
    
    if [[ -z "$bot_token" ]]; then
        echo "[$(date)] ERROR: No Telegram bot token found" >> "${LOG_DIR}/osint-error.log"
        return 1
    fi
    
    # Escape JSON special characters
    local escaped_message=$(python3 -c "import json,sys; print(json.dumps(sys.stdin.read()))" <<< "$message" | sed 's/^"//;s/"$//')
    
    # Send to topic
    local url="https://api.telegram.org/bot${bot_token}/sendMessage"
    local data="{\"chat_id\": \"${TELEGRAM_CHAT_ID}\", \"text\": ${escaped_message}, \"message_thread_id\": ${topic_id}}"
    
    curl -s -X POST "$url" \
        -H "Content-Type: application/json" \
        -d "$data" \
        -o /dev/null
    
    return 0
}

# ============================================================================
# LOGGING FUNCTION
# ============================================================================
log_osint() {
    local script_name="$1"
    local message="$2"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [${script_name}] $message" >> "${LOG_DIR}/osint-${script_name}.log"
}

# ============================================================================
# RATE LIMIT HANDLING
# ============================================================================
# Simple rate limit: check if we hit API limits recently
RATE_LIMIT_FILE="${STATE_DIR}/rate_limit.json"

check_rate_limit() {
    local endpoint="$1"
    local wait_seconds="${2:-60}"
    
    local last_call_file="${STATE_DIR}/rate_limit_${endpoint}.last"
    
    if [[ -f "$last_call_file" ]]; then
        local last_call=$(cat "$last_call_file")
        local now=$(date +%s)
        local elapsed=$((now - last_call))
        
        if [[ $elapsed -lt $wait_seconds ]]; then
            local remaining=$((wait_seconds - elapsed))
            echo "[$(date)] Rate limited for ${endpoint}, waiting ${remaining}s"
            sleep $remaining
        fi
    fi
    
    # Update last call time
    date +%s > "$last_call_file"
}

# ============================================================================
# CACHE FUNCTIONS
# ============================================================================
get_cache() {
    local cache_key="$1"
    local max_age_seconds="${2:-3600}"  # Default 1 hour
    local cache_file="${CACHE_DIR}/${cache_key}.cache"
    
    if [[ -f "$cache_file" ]]; then
        local file_age=$(($(date +%s) - $(stat -f %m "$cache_file" 2>/dev/null || stat -c %Y "$cache_file" 2>/dev/null)))
        if [[ $file_age -lt $max_age_seconds ]]; then
            cat "$cache_file"
            return 0
        fi
    fi
    return 1
}

set_cache() {
    local cache_key="$1"
    local cache_file="${CACHE_DIR}/${cache_key}.cache"
    cat > "$cache_file"
}

# ============================================================================
# TRACKED KEYWORDS
# ============================================================================
KEYWORDS=(
    "DuckBot"
    "CannaAI"
    "RS-Agent"
    "ClawdWatch"
    "Duckets"
    "NAFO"
    "Fellas"
)

# ============================================================================
# TRACKED ACCOUNTS (for account watch)
# ============================================================================
# Format: "display_name|search_handle|platform"
TRACKED_ACCOUNTS=(
    "Diligent Denizen|@DiligentDenizen|X"
    "HustleBitch|@HustleBitch_|X"
    "Ron Paul|Ron Paul|X"
    "Scott Horton|@Scott Horton on War in Iran|X"
    "NAFO Updates|@NAFOupdates|X"
    "Slava Ukraine|@slavaukraini|X"
)

# ============================================================================
# TRACKED SUBREDDITS
# ============================================================================
TRACKED_SUBREDDITS=(
    "microgrowery"
    "SSB"           # Space Station 13
    "privacy"
    "OSRS"
)

# ============================================================================
# TRACKED GITHUB REPOS
# Format: "owner/repo"
# ============================================================================
TRACKED_GITHUB_REPOS=(
    "Franzferdinan51/AI-Bot-Council-Concensus"
    "Franzferdinan51/Open-WebUi-Lobster-Edition"
    "openclaw/openclaw"
    "openclaw/agents"
)

# ============================================================================
# TOPICS FOR BRIEFINGS
# ============================================================================
BRIEFING_TOPICS=(
    "Ukraine NAFO conflict"
    "Epstein corruption documents"
    "cannabis regulation 2026"
)

# ============================================================================
# NEWS/API ENDPOINTS
# ============================================================================
BRAVE_SEARCH_API="${BRAVE_SEARCH_API:-}"  # Set in environment
NEWS_API_KEY="${NEWS_API_KEY:-}"          # Optional: NewsAPI.org

# ============================================================================
# STATE FILES
# ============================================================================
LAST_KEYWORD_RUN="${STATE_DIR}/last_keyword_run.json"
LAST_ACCOUNT_RUN="${STATE_DIR}/last_account_run.json"
LAST_GITHUB_RUN="${STATE_DIR}/last_github_run.json"
LAST_REDDIT_RUN="${STATE_DIR}/last_reddit_run.json"
SEEN_ITEMS_FILE="${STATE_DIR}/seen_items.json"

# Initialize seen items if not exists
init_seen_items() {
    if [[ ! -f "$SEEN_ITEMS_FILE" ]]; then
        echo "{}" > "$SEEN_ITEMS_FILE"
    fi
}

# Add seen item
mark_seen() {
    local item_type="$1"
    local item_id="$2"
    local timestamp=$(date +%s)
    
    local temp_file=$(mktemp)
    jq --arg type "$item_type" --arg id "$item_id" --arg ts "$timestamp" \
        '.[$type] //= {} | .[$type][$id] = $ts' \
        "$SEEN_ITEMS_FILE" > "$temp_file" && mv "$temp_file" "$SEEN_ITEMS_FILE"
}

# Check if seen
is_seen() {
    local item_type="$1"
    local item_id="$2"
    local seen_ts=$(jq -r ".[\"$item_type\"][\"$item_id\"] // empty" "$SEEN_ITEMS_FILE" 2>/dev/null)
    [[ -n "$seen_ts" ]]
}

# ============================================================================
# WEB SEARCH FUNCTION
# Uses Brave Search API (primary) or curl fallback
# ============================================================================
web_search() {
    local query="$1"
    local count="${3:-5}"
    
    # Try Brave Search first
    if [[ -n "$BRAVE_SEARCH_API" ]]; then
        curl -s --retry 3 --retry-delay 2 \
            -H "Accept: application/json" \
            -H "X-Subscription-Token: ${BRAVE_SEARCH_API}" \
            "https://api.search.brave.com/res/v1/web/search?q=${query}&count=${count}&freshness=pd" \
            2>/dev/null
        return 0
    fi
    
    # Fallback: Use web_search tool via exec
    # This calls the configured web_search function
    echo "{\"query\": \"$query\"}"
    return 1
}

# ============================================================================
# GITHUB API FUNCTION
# ============================================================================
github_api() {
    local endpoint="$1"  # e.g., "repos/owner/repo/commits"
    local result=$(curl -s --retry 3 --retry-delay 2 \
        -H "Accept: application/vnd.github.v3+json" \
        "https://api.github.com/${endpoint}" 2>/dev/null)
    
    # Check rate limits
    local remaining=$(curl -s -I "https://api.github.com/${endpoint}" 2>/dev/null | grep -i "x-ratelimit-remaining" | awk '{print $2}' | tr -d '\r')
    if [[ -n "$remaining" && "$remaining" -lt 10 ]]; then
        log_osint "github" "GitHub API rate limit low: $remaining remaining"
    fi
    
    echo "$result"
}

# ============================================================================
# REDDIT API FUNCTION
# Uses Reddit's public JSON endpoints
# ============================================================================
reddit_api() {
    local subreddit="$1"
    local sort="${2:-top}"  # top, hot, new, rising
    local limit="${3:-10}"
    
    curl -s --retry 3 --retry-delay 2 \
        -H "User-Agent: DuckBot-OSINT/1.0" \
        "https://www.reddit.com/r/${subreddit}/${sort}.json?limit=${limit}" 2>/dev/null
}

# ============================================================================
# AI SUMMARIZE FUNCTION (Optional - uses local LM Studio or API)
# ============================================================================
ai_summarize() {
    local text="$1"
    local max_length="${2:-280}"
    
    # Skip if text is short enough
    if [[ ${#text} -lt $max_length ]]; then
        echo "$text"
        return 0
    fi
    
    # Try LM Studio first (local)
    if curl -s http://100.116.54.125:1234/v1/models -o /dev/null 2>/dev/null; then
        local summary=$(curl -s http://100.116.54.125:1234/v1/chat/completions \
            -H "Content-Type: application/json" \
            -d "{
                \"model\": \"qwen3.5-27b\",
                \"messages\": [{\"role\": \"user\", \"content\": \"Summarize this in ${max_length} characters or less: ${text}\"}],
                \"max_tokens\": 200
            }" 2>/dev/null | jq -r '.choices[0].message.content // empty')
        
        if [[ -n "$summary" ]]; then
            echo "$summary"
            return 0
        fi
    fi
    
    # Fallback: just truncate
    echo "${text:0:$max_length}..."
    return 0
}

# ============================================================================
# INITIALIZATION
# ============================================================================
init_seen_items

# Export functions for use in subshells
export -f send_telegram log_osint check_rate_limit get_cache set_cache mark_seen is_seen
export -f web_search github_api reddit_api ai_summarize
export OSINT_DIR LOG_DIR CACHE_DIR STATE_DIR TELEGRAM_TOPIC_ID

echo "[$(date)] OSINT config loaded"
