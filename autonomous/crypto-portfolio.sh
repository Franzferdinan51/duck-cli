#!/bin/bash
#===============================================================================
# crypto-portfolio.sh - Daily Portfolio Summary
# Runs: Daily at 9AM (configure via cron)
# 
# Gets wallet balances, pulls current prices, calculates USD value
# and P&L vs previous day, then sends summary to Telegram.
#===============================================================================

set -euo pipefail

# Load configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/crypto-config.sh"

# Initialize logging
init_log
rotate_logs

log_msg "INFO" "=== Starting Daily Portfolio Report ==="

#------------------------------------------------------------------------------
# Helper Functions
#------------------------------------------------------------------------------

# Get BTC balance from address (using blockchain.com API)
get_btc_balance() {
    local address="$1"
    local url="https://blockchain.info/q/addressbalance/${address}"
    local balance_sats=$(curl -s --max-time 10 "$url" 2>/dev/null || echo "0")
    # Convert satoshis to BTC
    echo "scale=8; $balance_sats / 100000000" | bc 2>/dev/null || echo "0"
}

# Get ETH balance from address (using Etherscan API)
get_eth_balance() {
    local address="$1"
    local etherscan_api_key="${ETHERSCAN_API_KEY:-}"
    
    if [[ -z "$etherscan_api_key" ]]; then
        # Fallback: use public API
        local url="https://api.etherscan.io/api?module=account&action=balance&address=${address}&tag=latest"
        local response=$(curl -s --max-time 10 "$url" 2>/dev/null)
        local balance_wei=$(echo "$response" | grep -oP '"result":"\K[^"]+' || echo "0")
        # Convert wei to ETH
        echo "scale=8; $balance_wei / 1000000000000000000" | bc 2>/dev/null || echo "0"
    else
        local url="https://api.etherscan.io/api?module=account&action=balance&address=${address}&tag=latest&apikey=${etherscan_api_key}"
        local response=$(curl -s --max-time 10 "$url" 2>/dev/null)
        local balance_wei=$(echo "$response" | grep -oP '"result":"\K[^"]+' || echo "0")
        echo "scale=8; $balance_wei / 1000000000000000000" | bc 2>/dev/null || echo "0"
    fi
}

# Get SOL balance from address (using Solana RPC)
get_sol_balance() {
    local address="$1"
    local url="https://api.mainnet-beta.solana.com"
    local payload='{"jsonrpc":"2.0","id":1,"method":"getBalance","params":["'"$address"'"]}'
    local response=$(curl -s --max-time 10 -X POST "$url" -H "Content-Type: application/json" -d "$payload" 2>/dev/null)
    local balance_lamports=$(echo "$response" | grep -oP '"value":\K[0-9]+' || echo "0")
    # Convert lamports to SOL
    echo "scale=8; $balance_lamports / 1000000000" | bc 2>/dev/null || echo "0"
}

# Calculate P&L vs previous prices
calculate_pnl() {
    local current_price="$1"
    local prev_price="$2"
    local quantity="$3"
    
    if [[ $(echo "$prev_price <= 0" | bc) -eq 1 ]]; then
        echo "N/A"
        return
    fi
    
    local current_value=$(echo "scale=2; $current_price * $quantity" | bc)
    local prev_value=$(echo "scale=2; $prev_price * $quantity" | bc)
    local pnl_value=$(echo "scale=2; $current_value - $prev_value" | bc)
    local pnl_pct=$(echo "scale=2; (($current_price - $prev_price) / $prev_price) * 100" | bc)
    
    # Determine if profit or loss
    if [[ $(echo "$pnl_value >= 0" | bc) -eq 1 ]]; then
        echo "+$${pnl_value} (+${pnl_pct}%)"
    else
        echo "$${pnl_value} (${pnl_pct}%)"
    fi
}

# Load previous prices from cache
load_prev_prices() {
    if [[ -f "$PRICE_CACHE_FILE" ]]; then
        cat "$PRICE_CACHE_FILE"
    else
        echo "{}"
    fi
}

# Save current prices to cache
save_prices() {
    echo "$1" > "$PRICE_CACHE_FILE"
}

#------------------------------------------------------------------------------
# Main Portfolio Logic
#------------------------------------------------------------------------------

# Collect coin IDs for CoinGecko
coin_ids=""
for coin_entry in "${TRACKED_COINS[@]+"${TRACKED_COINS[@]}"}"; do
    IFS=':' read -ra coin_parts <<< "$coin_entry"
    coin_id="${coin_parts[0]}"
    if [[ -z "$coin_ids" ]]; then
        coin_ids="$coin_id"
    else
        coin_ids="${coin_ids},${coin_id}"
    fi
done

log_msg "INFO" "Fetching prices for: ${coin_ids}"

# Get current prices with 24h change
current_prices_json=$(get_prices "$coin_ids" "usd")
if [[ $? -ne 0 ]] || [[ -z "$current_prices_json" ]]; then
    log_error "Failed to fetch current prices from CoinGecko"
fi

# Load previous prices
prev_prices_json=$(load_prev_prices)

# Build portfolio summary
portfolio_lines=()
total_value=0
total_change_24h=0

log_msg "INFO" "Calculating portfolio balances..."

for coin_entry in "${TRACKED_COINS[@]+"${TRACKED_COINS[@]}"}"; do
    IFS=':' read -ra coin_parts <<< "$coin_entry"
    coin_id="${coin_parts[0]}"
    symbol="${coin_parts[1]}"
    address="${coin_parts[2]}"
    network="${coin_parts[3]}"
    
    # Skip placeholder addresses
    if [[ "$address" == "YOUR_"* ]]; then
        log_msg "WARN" "Skipping ${symbol} - wallet address not configured"
        continue
    fi
    
    # Get balance based on network
    case "$network" in
        bitcoin)
            balance=$(get_btc_balance "$address")
            ;;
        ethereum|erc20)
            balance=$(get_eth_balance "$address")
            ;;
        solana)
            balance=$(get_sol_balance "$address")
            ;;
        *)
            balance="0"
            ;;
    esac
    
    # Skip if balance is 0 or invalid
    if [[ $(echo "$balance <= 0" | bc) -eq 1 ]]; then
        log_msg "INFO" "${symbol}: ${balance} (no balance or API error)"
        continue
    fi
    
    # Get current price
    current_price=$(echo "$current_prices_json" | grep -oP "\"${coin_id}\":\s*\{\s*\"usd\":\K[0-9.]+" || echo "0")
    change_24h=$(echo "$current_prices_json" | grep -oP "\"${coin_id}\":\s*\{\s*\"usd\":[0-9.]+\s*,\s*\"usd_24h_change\":\K[-0-9.]+" || echo "0")
    
    # Calculate values
    value_usd=$(echo "scale=2; $current_price * $balance" | bc)
    total_value=$(echo "scale=2; $total_value + $value_usd" | bc)
    
    # Get previous price for P&L
    prev_price=$(echo "$prev_prices_json" | grep -oP "\"${coin_id}\":\s*\{\s*\"usd\":\K[0-9.]+" || echo "0")
    pnl_info=$(calculate_pnl "$current_price" "$prev_price" "$balance")
    
    log_msg "INFO" "${symbol}: ${balance} @ \$${current_price} = \$${value_usd} | P&L: ${pnl_info}"
    
    # Format line for Telegram
    portfolio_lines+=("• *${symbol^^}*: ${balance} × \$${current_price} = *\$${value_usd}*\n  24h: ${change_24h}% | P&L: ${pnl_info}")
done

# Save current prices for tomorrow
save_prices "$current_prices_json"

# Build Telegram message
telegram_msg="📊 *Daily Crypto Portfolio Report*
$(date '+%B %d, %Y %H:%M %Z')

━━━━━━━━━━━━━━━━━━━━━━

"

for line in "${portfolio_lines[@]+"${portfolio_lines[@]}"}"; do
    telegram_msg="${telegram_msg}${line}
"
done

telegram_msg="${telegram_msg}
━━━━━━━━━━━━━━━━━━━━━━

💰 *Total Portfolio Value:* *\$${total_value}*

📈 *24h Market Summary:*
"

# Add market overview (top coins)
market_overview=$(curl -s --max-time 15 "${COINGECKO_API_URL}/coins/markets?vs_currency=usd&ids=bitcoin,ethereum&order=market_cap_desc&per_page=2&page=1&sparkline=false" 2>/dev/null || echo "[]")

btc_market=$(echo "$market_overview" | grep -oP '"id":"bitcoin".*?"current_price":\K[0-9.]+' | head -1)
eth_market=$(echo "$market_overview" | grep -oP '"id":"ethereum".*?"current_price":\K[0-9.]+' | head -1)
btc_change=$(echo "$market_overview" | grep -oP '"id":"bitcoin".*?"price_change_percentage_24h":\K[-0-9.]+' | head -1)
eth_change=$(echo "$market_overview" | grep -oP '"id":"ethereum".*?"price_change_percentage_24h":\K[-0-9.]+' | head -1)

if [[ -n "$btc_market" ]]; then
    telegram_msg="${telegram_msg}• BTC: \$${btc_market} (${btc_change}%)
"
fi
if [[ -n "$eth_market" ]]; then
    telegram_msg="${telegram_msg}• ETH: \$${eth_market} (${eth_change}%)
"
fi

telegram_msg="${telegram_msg}
🦆 *DuckBot Crypto Monitor*"

# Send to Telegram
log_msg "INFO" "Sending portfolio report to Telegram..."
send_telegram "$telegram_msg"

log_msg "INFO" "=== Daily Portfolio Report Complete ==="
echo ""
