#!/bin/bash
# =============================================================================
# news-daily-brief.sh - Daily News Brief Generator
# =============================================================================
# Runs at 8AM via cron
# Topics: cannabis regulation, crypto, AI agents, Ukraine
# AI-compiles into brief format
# Sends to Telegram topic 647901
# =============================================================================

LOGFILE="/Users/duckets/.openclaw/workspace/logs/news-daily-brief.log"
TELEGRAM_TOPIC="647901"
MAX_RESULTS=5

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
# Search for news on a topic
# -----------------------------------------------------------------------------
search_topic() {
    local topic="$1"
    local query="$2"
    
    log "Searching: $topic"
    
    # URL encode query using python
    local encoded=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$query'))")
    
    # Use Brave Search API directly
    local results=$(curl -s "https://api.search.brave.com/res/v1/news/search?q=$encoded&count=$MAX_RESULTS&freshness=pd" \
        -H "Accept: application/json" \
        -H "X-Subscription-Token: BSA5j7E0FgEj-CkoWkC4cCbgnVNg0pr" 2>/dev/null || echo '{"results":[]}')
    
    # Parse results - extract titles and descriptions
    echo "$results" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    results = data.get('results', [])
    for r in results[:$MAX_RESULTS]:
        title = r.get('title', '')
        desc = r.get('description', '')[:150]
        url = r.get('url', '')
        if title:
            print(f'### {title}')
            if desc:
                print(f'{desc}')
            print(f'Source: {url}')
            print()
except Exception as e:
    print(f'Parse error: {e}')
    print('No results')
" 2>/dev/null || echo "Search failed"
}


# -----------------------------------------------------------------------------
# Build cannabis section
# -----------------------------------------------------------------------------
build_cannabis_section() {
    local section="🌿 **CANNABIS REGULATION**
━━━━━━━━━━━━━━━━━━━━
"
    
    local news=$(search_topic "cannabis" "cannabis regulation 2026 marijuana legal")
    
    if [[ -n "$news" && "$news" != "Search unavailable" ]]; then
        section+="$news"
    else
        section+="No significant updates today"
    fi
    
    section+="
"
    echo "$section"
}

# -----------------------------------------------------------------------------
# Build crypto section
# -----------------------------------------------------------------------------
build_crypto_section() {
    local section="💰 **CRYPTO**
━━━━━━━━━━━━━━━━━━━━
"
    
    local news=$(search_topic "crypto" "bitcoin cryptocurrency news 2026")
    
    if [[ -n "$news" && "$news" != "Search unavailable" ]]; then
        section+="$news"
    else
        section+="No significant updates today"
    fi
    
    section+="
"
    echo "$section"
}

# -----------------------------------------------------------------------------
# Build AI agents section
# -----------------------------------------------------------------------------
build_ai_section() {
    local section="🤖 **AI AGENTS**
━━━━━━━━━━━━━━━━━━━━
"
    
    local news=$(search_topic "AI agents" "AI agents autonomous 2026")
    
    if [[ -n "$news" && "$news" != "Search unavailable" ]]; then
        section+="$news"
    else
        section+="No significant updates today"
    fi
    
    section+="
"
    echo "$section"
}

# -----------------------------------------------------------------------------
# Build Ukraine section
# -----------------------------------------------------------------------------
build_ukraine_section() {
    local section="🇺🇦 **UKRAINE**
━━━━━━━━━━━━━━━━━━━━
"
    
    local news=$(search_topic "Ukraine" "Ukraine war news 2026")
    
    if [[ -n "$news" && "$news" != "Search unavailable" ]]; then
        section+="$news"
    else
        section+="No significant updates today"
    fi
    
    section+="
"
    echo "$section"
}

# -----------------------------------------------------------------------------
# Build full brief
# -----------------------------------------------------------------------------
build_brief() {
    local date_str=$(date '+%A, %B %d, %Y')
    
    local brief="📰 **DAILY NEWS BRIEF**
━━━━━━━━━━━━━━━━━━━━
📅 $date_str

"
    
    brief+="$(build_cannabis_section)"
    brief+="$(build_crypto_section)"
    brief+="$(build_ai_section)"
    brief+="$(build_ukraine_section)"
    
    brief+="━━━━━━━━━━━━━━━━━━━━
🦆 *DuckBot News Brief*"
    
    echo "$brief"
}

# -----------------------------------------------------------------------------
# Send brief in chunks (Telegram message limit)
# -----------------------------------------------------------------------------
send_brief() {
    local brief="$1"
    local max_len=4000
    
    # Split if needed
    if [[ ${#brief} -gt $max_len ]]; then
        log "Brief too long (${#brief} chars), splitting..."
        
        # Split by section
        local part1=$(echo "$brief" | head -c 4000)
        local part2=$(echo "$brief" | tail -c +4001)
        
        send_telegram "$part1"
        sleep 1
        send_telegram "$part2"
    else
        send_telegram "$brief"
    fi
}

# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------
main() {
    log "=== Daily News Brief Started ==="
    
    local brief
    brief=$(build_brief)
    
    log "Brief built (${#brief} chars), sending..."
    send_brief "$brief"
    
    log "=== Daily News Brief Complete ==="
}

main "$@"


# BrowserOS MCP fallback for rate limits
mcp_browser_search() {
    local query="$1"
    # Use BrowserOS MCP to search via browser at 127.0.0.1:9002
    mcporter --config http://127.0.0.1:9002/mcp call browseros.browser_web_search query="$query" count=5 2>/dev/null || echo "MCP search failed"
}
