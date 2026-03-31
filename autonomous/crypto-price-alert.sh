#!/bin/bash
#===============================================================================
# crypto-price-alert.sh - Real-Time Price Alert Monitor
# Runs: Every 5 minutes (continuous polling via cron)
# 
# Monitors BTC, ETH, and configured coins for significant price movements
# and absolute price threshold crossings.
#===============================================================================

set -euo pipefail

# Load configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/crypto-config.sh"

# Initialize logging
init_log
rotate_logs

# Lock file to prevent concurrent runs
LOCK_FILE="${STATE_DIR}/price-alert.lock"
if [[ -f "$LOCK_FILE" ]]; then
    lock_age=$(($(date +%s) - $(stat -f "%m" "$LOCK_FILE" 2>/dev/null || stat -c "%Y" "$LOCK_FILE" 2>/dev/null)))
    # If lock is older than 10 minutes, it's stale
    if [[ $lock_age -gt 600 ]]; then
        rm -f "$LOCK_FILE"
    else
        log_msg "WARN" "Price alert script already running, skipping this cycle"
        exit 0
    fi
fi
touch "$LOCK_FILE"

trap 'rm -f "$LOCK_FILE"' EXIT

log_msg "INFO" "=== Starting Price Alert Check ==="

#------------------------------------------------------------------------------
# Helper Functions
#------------------------------------------------------------------------------

# Get current prices for monitored coins
fetch_prices() {
    local coin_list="$1"
    local url="${COINGECKO_API_URL}/simple/price?ids=${coin_list}&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true"
    api_call "$url"
}

# Load previous prices from state file
load_prev_prices() {
    if [[ -f "$PREV_PRICES_FILE" ]]; then
        cat "$PREV_PRICES_FILE"
    else
        echo "{}"
    fi
}

# Save current prices to state file
save_prices() {
    echo "$1" | tee "$PREV_PRICES_FILE" > /dev/null
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

# Check absolute price thresholds
check_thresholds() {
    local coin_id="$1"
    local current_price="$2"
    local symbol="$3"
    
    for threshold in "${PRICE_THRESHOLDS[@]}"; do
        IFS=':' read -ra parts <<< "$threshold"
        local thresh_coin="${parts[0]}"
        local thresh_direction="${parts[1]}"
        local thresh_price="${parts[2]}"
        
        if [[ "$thresh_coin" != "$coin_id" ]]; then
            continue
        fi
        
        case "$thresh_direction" in
            above)
                if [[ $(echo "$current_price > $thresh_price" | bc) -eq 1 ]]; then
                    echo "ABOVE:${thresh_price}"
                    return 0
                fi
                ;;
            below)
                if [[ $(echo "$current_price < $thresh_price" | bc) -eq 1 ]]; then
                    echo "BELOW:${thresh_price}"
                    return 0
                fi
                ;;
        esac
    done
    echo ""
}

# Format large numbers
format_price() {
    local price="$1"
    printf "%.2f" "$price"
}

#------------------------------------------------------------------------------
# Main Alert Logic
#------------------------------------------------------------------------------

# Get current prices
current_prices_json=$(fetch_prices "$PRICE_ALERT_COINS")
if [[ $? -ne 0 ]] || [[ -z "$current_prices_json" ]]; then
    log_msg "ERROR" "Failed to fetch prices from CoinGecko"
    exit 1
fi

# Load previous prices
prev_prices_json=$(load_prev_prices)

# Arrays to collect alerts
alerts=()
threshold_alerts=()

# Parse prices and check for changes
IFS=',' read -ra coins <<< "$PRICE_ALERT_COINS"
for coin_id in "${coins[@]}"; do
    # Get current price
    current_price=$(echo "$current_prices_json" | python3 -c "
import sys, json, re
data = json.load(sys.stdin)
coin = '$coin_id'
if coin in data and 'usd' in data[coin]:
    print(data[coin]['usd'])
" 2>/dev/null || echo "0")
    
    if [[ $(echo "$current_price <= 0" | bc) -eq 1 ]]; then
        continue
    fi
    
    # Get 24h change
    change_24h=$(echo "$current_prices_json" | python3 -c "
import sys, json
data = json.load(sys.stdin)
coin = '$coin_id'
if coin in data and 'usd_24h_change' in data[coin]:
    print(data[coin]['usd_24h_change'])
" 2>/dev/null || echo "0")
    
    # Get previous price
    prev_price=$(echo "$prev_prices_json" | python3 -c "
import sys, json
data = json.load(sys.stdin)
coin = '$coin_id'
if coin in data and 'usd' in data[coin]:
    print(data[coin]['usd'])
" 2>/dev/null || echo "0")
    
    # Calculate change from last check
    if [[ $(echo "$prev_price > 0" | bc) -eq 1 ]]; then
        pct_diff=$(pct_change "$prev_price" "$current_price")
        abs_pct_diff=$(echo "$pct_diff" | tr -d '-')
        
        symbol=$(echo "$coin_id" | cut -c1 | tr '[:lower:]' '[:upper:]')$(echo "$coin_id" | cut -c2-)
        
        # Check for significant drop (>5%)
        if [[ $(echo "$pct_diff < -$PRICE_CHANGE_DROP_THRESHOLD" | bc) -eq 1 ]]; then
            alerts+=("🚨 *PRICE DROP ALERT*

${symbol}: \$$(format_price "$current_price")
↘️ -${abs_pct_diff}% since last check
24h: ${change_24h}%

⚠️ Price dropped more than ${PRICE_CHANGE_DROP_THRESHOLD}% since the last alert!")
            log_msg "WARN" "${symbol} dropped ${pct_diff}% since last check"
        fi
        
        # Check for significant pump (>10%)
        if [[ $(echo "$pct_diff > $PRICE_CHANGE_PUMP_THRESHOLD" | bc) -eq 1 ]]; then
            alerts+=("🚀 *PRICE PUMP ALERT*

${symbol}: \$$(format_price "$current_price")
↗️ +${abs_pct_diff}% since last check
24h: ${change_24h}%

💰 Price pumped more than ${PRICE_CHANGE_PUMP_THRESHOLD}% since the last alert!")
            log_msg "INFO" "${symbol} pumped ${pct_diff}% since last check"
        fi
    fi
    
    # Check absolute thresholds
    threshold_result=$(check_thresholds "$coin_id" "$current_price" "$symbol")
    if [[ -n "$threshold_result" ]]; then
        IFS=':' read -ra thresh_parts <<< "$threshold_result"
        direction="${thresh_parts[0]}"
        thresh_value="${thresh_parts[1]}"
        
        symbol=$(echo "$coin_id" | cut -c1 | tr '[:lower:]' '[:upper:]')$(echo "$coin_id" | cut -c2-)
        
        if [[ "$direction" == "ABOVE" ]]; then
            threshold_alerts+=("🎯 *PRICE THRESHOLD CROSSED*

${symbol} crossed *ABOVE* \$$(format_price "$thresh_value")
Current: \$$(format_price "$current_price")")
        else
            threshold_alerts+=("🎯 *PRICE THRESHOLD CROSSED*

${symbol} crossed *BELOW* \$$(format_price "$thresh_value")
Current: \$$(format_price "$current_price")")
        fi
    fi
done

# Save current prices for next check
save_prices "$current_prices_json"

# Send alerts
if [[ ${#alerts[@]} -gt 0 ]]; then
    for alert in "${alerts[@]}"; do
        log_msg "INFO" "Sending price movement alert"
        send_telegram "$alert"
        # Rate limit between alerts
        sleep 2
    done
fi

if [[ ${#threshold_alerts[@]} -gt 0 ]]; then
    threshold_msg="⚠️ *Price Threshold Alerts*
━━━━━━━━━━━━━━━━━━━━━━

"
    for thresh_alert in "${threshold_alerts[@]}"; do
        threshold_msg="${threshold_msg}${thresh_alert}

"
    done
    threshold_msg="${threshold_msg}🦆 DuckBot Crypto Monitor"
    
    log_msg "INFO" "Sending threshold alerts"
    send_telegram "$threshold_msg"
fi

# Always log the check
coin_count=$(echo "$PRICE_ALERT_COINS" | tr ',' '\n' | wc -l)
log_msg "INFO" "Price check complete. Monitored ${coin_count} coins. Alerts sent: ${#alerts[@]} movement, ${#threshold_alerts[@]} threshold"

# Clean up lock
rm -f "$LOCK_FILE"

log_msg "INFO" "=== Price Alert Check Complete ==="
echo ""
