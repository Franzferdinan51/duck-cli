#!/bin/bash
#===============================================================================
# crypto-defi-health.sh - DeFi Protocol Health Monitor
# Runs: Every 6 hours (configure via cron)
# 
# Monitors tracked DeFi protocols for TVL changes, APY changes,
# and alerts on significant developments.
#===============================================================================

set -euo pipefail

# Load configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/crypto-config.sh"

# Initialize logging
init_log
rotate_logs

# Lock file
LOCK_FILE="${STATE_DIR}/defi-health.lock"
if [[ -f "$LOCK_FILE" ]]; then
    lock_age=$(($(date +%s) - $(stat -f "%m" "$LOCK_FILE" 2>/dev/null || stat -c "%Y" "$LOCK_FILE" 2>/dev/null)))
    if [[ $lock_age -gt 7200 ]]; then
        rm -f "$LOCK_FILE"
    else
        log_msg "WARN" "DeFi health check already running, skipping"
        exit 0
    fi
fi
touch "$LOCK_FILE"

trap 'rm -f "$LOCK_FILE"' EXIT

log_msg "INFO" "=== Starting DeFi Health Check ==="

#------------------------------------------------------------------------------
# Helper Functions
#------------------------------------------------------------------------------

# Get TVL and APY from DeFiLlama API (free, no key)
get_defillama_protocol() {
    local protocol="$1"
    local url="https://api.llama.fi/protocol/${protocol}"
    
    curl -s --max-time 20 "$url" 2>/dev/null || echo "{}"
}

# Get current prices for USD conversion
get_defi_prices() {
    local coins="bitcoin,ethereum"
    local url="${COINGECKO_API_URL}/simple/price?ids=${coins}&vs_currencies=usd"
    
    curl -s --max-time 15 "$url" 2>/dev/null || echo "{}"
}

# Calculate percentage change
pct_change() {
    local old="$1"
    local new="$2"
    
    if [[ $(echo "$old <= 0" | bc) -eq 1 ]]; then
        echo "0"
    else
        echo "scale=4; (($new - $old) / $old) * 100" | bc
    fi
}

# Format large numbers
format_tvl() {
    local value="$1"
    
    if [[ $(echo "$value >= 1000000000" | bc) -eq 1 ]]; then
        printf "\$%.2fB" $(echo "scale=2; $value / 1000000000" | bc)
    elif [[ $(echo "$value >= 1000000" | bc) -eq 1 ]]; then
        printf "\$%.2fM" $(echo "scale=2; $value / 1000000" | bc)
    elif [[ $(echo "$value >= 1000" | bc) -eq 1 ]]; then
        printf "\$%.2fK" $(echo "scale=2; $value / 1000" | bc)
    else
        printf "\$%.2f" "$value"
    fi
}

# Format APY
format_apy() {
    local apy="$1"
    printf "%.2f%%" "$apy"
}

# Load previous protocol data
load_prev_defi_data() {
    local state_file="${STATE_DIR}/defi_prev_data.json"
    if [[ -f "$state_file" ]]; then
        cat "$state_file"
    else
        echo "{}"
    fi
}

# Save current protocol data
save_defi_data() {
    local state_file="${STATE_DIR}/defi_prev_data.json"
    echo "$1" > "$state_file"
}

#------------------------------------------------------------------------------
# DeFi Protocol Fetching
#------------------------------------------------------------------------------

# Get DeFiLlama protocol data
fetch_defi_data() {
    local protocol="$1"
    
    log_msg "INFO" "Fetching DeFi data for: ${protocol}"
    
    local response=$(get_defillama_protocol "$protocol")
    
    if echo "$response" | grep -q '"error"'; then
        log_msg "WARN" "DeFiLlama API error for ${protocol}"
        echo "{}"
        return
    fi
    
    echo "$response"
}

# Get TVL from DeFiLlama response
extract_tvl() {
    local json="$1"
    
    # Try different TVL fields
    local tvl=$(echo "$json" | grep -oP '"tvl":\K[0-9.]+' | head -1)
    
    if [[ -z "$tvl" ]]; then
        # Try category tvlData
        tvl=$(echo "$json" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    if 'tvl' in data:
        print(data['tvl'])
    elif 'tvlList' in data and len(data['tvlList']) > 0:
        print(data['tvlList'][-1]['tvl'])
    else:
        print(0)
except:
    print(0)
" 2>/dev/null || echo "0")
    fi
    
    echo "$tvl"
}

# Get APY for pools
get_pool_apy() {
    local protocol="$1"
    local pool_address="$2"
    
    # Use DeFiLlama's yield API
    local yield_url="https://api.yield俊杰labs.io/v1/chains/ethereum/pools"
    local pools_json=$(curl -s --max-time 20 "$yield_url" 2>/dev/null || echo "[]")
    
    if [[ "$pools_json" == "[]" ]]; then
        # Fallback: estimate from protocol
        echo "N/A"
        return
    fi
    
    # Find pool by address
    local apy=$(echo "$pools_json" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    for pool in data:
        if pool.get('pool', '').lower() == '$pool_address'.lower():
            print(pool.get('apy', 0))
            break
    else:
        print('N/A')
except:
    print('N/A')
" 2>/dev/null || echo "N/A")
    
    echo "$apy"
}

#------------------------------------------------------------------------------
# Main DeFi Health Check Logic
#------------------------------------------------------------------------------

# Get prices for conversion
prices_json=$(get_defi_prices)
btc_price=$(echo "$prices_json" | grep -oP '"bitcoin":\s*\{\s*"usd":\K[0-9.]+' || echo "0")
eth_price=$(echo "$prices_json" | grep -oP '"ethereum":\s*\{\s*"usd":\K[0-9.]+' || echo "0")

log_msg "INFO" "BTC: \$${btc_price}, ETH: \$${eth_price}"

# Load previous data
prev_defi_data=$(load_prev_defi_data)

# Arrays to collect alerts
defi_alerts=()
significant_changes=()

# Process each tracked protocol
for protocol_entry in "${TRACKED_DEFI_PROTOCOLS[@]}"; do
    IFS=':' read -ra parts <<< "$protocol_entry"
    protocol_id="${parts[0]}"
    network="${parts[1]}"
    pool_address="${parts[2]:-}"
    
    log_msg "INFO" "Checking ${protocol_id} on ${network}..."
    
    # Fetch current data
    protocol_data=$(fetch_defi_data "$protocol_id")
    
    if [[ -z "$protocol_data" ]] || echo "$protocol_data" | grep -q '"error"'; then
        log_msg "WARN" "Failed to fetch data for ${protocol_id}"
        continue
    fi
    
    # Extract TVL
    current_tvl=$(extract_tvl "$protocol_data")
    
    if [[ $(echo "$current_tvl <= 0" | bc) -eq 1 ]]; then
        log_msg "WARN" "No TVL data for ${protocol_id}"
        continue
    fi
    
    # Get protocol name
    protocol_name=$(echo "$protocol_data" | grep -oP '"name":"\K[^"]+' | head -1 || echo "$protocol_id")
    
    # Get category
    protocol_category=$(echo "$protocol_data" | grep -oP '"category":"\K[^"]+' | head -1 || echo "DeFi")
    
    # Get change metrics
    change_1d=$(echo "$protocol_data" | grep -oP '"change_1d":"\K[-0-9.]+' | head -1 || echo "0")
    change_7d=$(echo "$protocol_data" | grep -oP '"change_7d":"\K[-0-9.]+' | head -1 || echo "0")
    
    # Get previous TVL
    prev_tvl=$(echo "$prev_defi_data" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    if '$protocol_id' in data:
        print(data['$protocol_id'].get('tvl', 0))
    else:
        print(0)
except:
    print(0)
" 2>/dev/null || echo "0")
    
    # Calculate TVL change
    if [[ $(echo "$prev_tvl > 0" | bc) -eq 1 ]]; then
        tvl_change=$(pct_change "$prev_tvl" "$current_tvl")
        abs_change=$(echo "$tvl_change" | tr -d '-')
        
        # Check for significant TVL change
        if [[ $(echo "$abs_change > $DEFI_TVL_CHANGE_THRESHOLD" | bc) -eq 1 ]]; then
            direction="📈"
            if [[ $(echo "$tvl_change < 0" | bc) -eq 1 ]]; then
                direction="📉"
            fi
            
            significant_changes+=("${direction} *${protocol_name}* TVL
• Current: $(format_tvl "$current_tvl")
• Change: ${tvl_change}%
• Previous: $(format_tvl "$prev_tvl")")
            
            log_msg "WARN" "${protocol_name} TVL changed ${tvl_change}%: $(format_tvl "$current_tvl")"
        fi
    fi
    
    # Get pool APY if available
    apy="N/A"
    if [[ -n "$pool_address" ]]; then
        apy=$(get_pool_apy "$protocol_id" "$pool_address")
    fi
    
    # Log current state
    log_msg "INFO" "${protocol_name}: TVL $(format_tvl "$current_tvl"), 24h: ${change_1d}%, 7d: ${change_7d}%"
done

# Update stored data with current values
new_defi_data="{}"

for protocol_entry in "${TRACKED_DEFI_PROTOCOLS[@]}"; do
    IFS=':' read -ra parts <<< "$protocol_entry"
    protocol_id="${parts[0]}"
    
    protocol_data=$(fetch_defi_data "$protocol_id")
    current_tvl=$(extract_tvl "$protocol_data")
    
    # Preserve previous data and add current
    new_defi_data=$(echo "$new_defi_data" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
except:
    data = {}
    
protocol_id = '$protocol_id'
current_tvl = $current_tvl

if protocol_id not in data:
    data[protocol_id] = {}

data[protocol_id]['tvl'] = current_tvl
data[protocol_id]['timestamp'] = $(date +%s)

print(json.dumps(data))
" 2>/dev/null || echo "{}")
done

save_defi_data "$new_defi_data"

#------------------------------------------------------------------------------
# Build and Send Report
#------------------------------------------------------------------------------

telegram_msg="🏦 *DeFi Protocol Health Report*
$(date '+%B %d, %Y %H:%M %Z')

━━━━━━━━━━━━━━━━━━━━━━

📊 *Protocol Overview:*

"

# Add protocol summaries
for protocol_entry in "${TRACKED_DEFI_PROTOCOLS[@]}"; do
    IFS=':' read -ra parts <<< "$protocol_entry"
    protocol_id="${parts[0]}"
    
    protocol_data=$(fetch_defi_data "$protocol_id")
    
    if [[ -z "$protocol_data" ]] || echo "$protocol_data" | grep -q '"error"'; then
        continue
    fi
    
    protocol_name=$(echo "$protocol_data" | grep -oP '"name":"\K[^"]+' | head -1 || echo "$protocol_id")
    current_tvl=$(extract_tvl "$protocol_data")
    change_1d=$(echo "$protocol_data" | grep -oP '"change_1d":"\K[-0-9.]+' | head -1 || echo "0")
    change_7d=$(echo "$protocol_data" | grep -oP '"change_7d":"\K[-0-9.]+' | head -1 || echo "0")
    
    # Format changes
    if [[ $(echo "$change_1d >= 0" | bc) -eq 1 ]]; then
        change_1d_str="+${change_1d}%"
    else
        change_1d_str="${change_1d}%"
    fi
    
    if [[ $(echo "$change_7d >= 0" | bc) -eq 1 ]]; then
        change_7d_str="+${change_7d}%"
    else
        change_7d_str="${change_7d}%"
    fi
    
    telegram_msg="${telegram_msg}• *${protocol_name}*
  TVL: $(format_tvl "$current_tvl")
  24h: ${change_1d_str} | 7d: ${change_7d_str}

"
done

# Add significant changes section
if [[ ${#significant_changes[@]} -gt 0 ]]; then
    telegram_msg="${telegram_msg}
━━━━━━━━━━━━━━━━━━━━━━

🚨 *Significant Changes:*

"
    
    for change in "${significant_changes[@]}"; do
        telegram_msg="${telegram_msg}${change}

"
    done
fi

telegram_msg="${telegram_msg}
━━━━━━━━━━━━━━━━━━━━━━

🦆 *DuckBot DeFi Monitor*"

# Send to Telegram
log_msg "INFO" "Sending DeFi health report (${#significant_changes[@]} significant changes)"
send_telegram "$telegram_msg"

# Clean up lock
rm -f "$LOCK_FILE"

log_msg "INFO" "=== DeFi Health Check Complete ==="
echo ""
