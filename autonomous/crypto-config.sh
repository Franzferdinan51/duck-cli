#!/bin/bash
#===============================================================================
# crypto-config.sh - Configuration for DuckBot Crypto Monitoring Scripts
# Sourced by all other crypto monitoring scripts
#===============================================================================

# Script directory (resolve symlinks)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

#------------------------------------------------------------------------------
# Telegram Configuration
#------------------------------------------------------------------------------
TELEGRAM_BOT_TOKEN="8094662802:AAF2IcMguSovSu4a_R0o9ckzfCJfpYw14UM"  # Set in environment or below
TELEGRAM_CHAT_ID="588090613"  # Topic ID for crypto alerts

#------------------------------------------------------------------------------
# CoinGecko API Configuration
#------------------------------------------------------------------------------
COINGECKO_API_URL="https://api.coingecko.com/api/v3"
COINGECKO_RATE_LIMIT=10  # seconds between API calls (free tier: 10-30/min)
COINGECKO_MAX_RETRIES=3
COINGECKO_RETRY_DELAY=5

#------------------------------------------------------------------------------
# Tracked Cryptocurrencies
# Format: "id:symbol:wallet_address:network"
# Examples:
#   bitcoin:btc:bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh  (BTC mainnet)
#   ethereum:eth:0x742d35Cc6634C0532925a3b844Bc9e7595f2bD12 (ETH mainnet)
#   solana:sol:7EcDhSYGxXyscszYEp35KHN8vvw3svAuLKTzXwCFLtV  (Solana)
#------------------------------------------------------------------------------
TRACKED_COINS=(
    "bitcoin:btc:YOUR_BTC_ADDRESS:bitcoin"
    "ethereum:eth:YOUR_ETH_ADDRESS:ethereum"
    "solana:sol:YOUR_SOL_ADDRESS:solana"
)

# Tracked coins for price alerts (CoinGecko IDs)
PRICE_ALERT_COINS="bitcoin,ethereum,solana,cardano,polkadot,ripple"

#------------------------------------------------------------------------------
# Price Alert Thresholds
#------------------------------------------------------------------------------
PRICE_CHANGE_DROP_THRESHOLD=5.0      # Alert if price drops >5%
PRICE_CHANGE_PUMP_THRESHOLD=10.0     # Alert if price pumps >10%
PRICE_CHECK_INTERVAL=300             # seconds (5 min)

# Absolute price thresholds (alert when price crosses these)
# Format: "coin_id:above:price" or "coin_id:below:price"
PRICE_THRESHOLDS=(
    "bitcoin:above:100000"
    "bitcoin:below:70000"
    "ethereum:above:4000"
    "ethereum:below:2500"
)

#------------------------------------------------------------------------------
# Whale Watch Configuration
#------------------------------------------------------------------------------
WHALE_THRESHOLD_USD=1000000          # Alert for transactions >$1M
WHALE_CHECK_INTERVAL=600             # seconds (10 min)

# Blockchain explorer APIs (free tier)
BITCOIN_WHALE_API="https://mempool.space/api/v1/whale-wallets"
ETHEREUM_WHALE_API="https://api.etherscan.io/api"

# Known whale wallet labels (optional - for context in alerts)
# These are publicly known large wallets
WHALE_LABELS=(
    "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh:BinanceHot"
    "0x28C6c06298d514Db089934071355E5743bf21d60:BinanceCold"
    "0x21a31Ee1afC51d94C2E3fA1aDcaE3B96b0A0aa54:FTXHot"
)

#------------------------------------------------------------------------------
# DeFi Protocol Configuration
#------------------------------------------------------------------------------
# Tracked DeFi protocols
# Format: "protocol_id:network:pool_address"
TRACKED_DEFI_PROTOCOLS=(
    "aave:ethereum:0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9"
    "uniswap-v3:ethereum:0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8"
)

# DeFi alert thresholds
DEFI_TVL_CHANGE_THRESHOLD=10.0       # Alert if TVL changes >10%
DEFI_APY_CHANGE_THRESHOLD=5.0        # Alert if APY changes >5%

#------------------------------------------------------------------------------
# News Scan Configuration
#------------------------------------------------------------------------------
NEWS_SCAN_INTERVALS=(8 18)           # Hours (24h format) for daily scans
NEWS_TOPICS=(
    "bitcoin ETF approval news"
    "cryptocurrency regulation SEC"
    "crypto exchange hack 2024"
    "defi protocol exploit"
    "bitcoin price prediction"
)

# Sentiment thresholds
SENTIMENT_HIGH_IMPACT_SCORE=7       # Score 0-10, alert if >= this

#------------------------------------------------------------------------------
# Portfolio Settings
#------------------------------------------------------------------------------
PORTFOLIO_REPORT_TIME="09:00"        # Daily report time
CURRENCY_DISPLAY="USD"

# Previous day prices cache file (for P&L calculation)
PRICE_CACHE_FILE="/tmp/crypto_prices_prev.json"

#------------------------------------------------------------------------------
# Logging Configuration
#------------------------------------------------------------------------------
LOG_DIR="${LOG_DIR:-/.openclaw/workspace/logs}"
LOG_FILE="${LOG_DIR}/crypto-monitor.log"
ARCHIVE_LOG_DAYS=7                  # Keep logs for 7 days

#------------------------------------------------------------------------------
# State Files (for continuous monitoring scripts)
#------------------------------------------------------------------------------
STATE_DIR="/tmp/crypto-monitor-state"
PREV_PRICES_FILE="${STATE_DIR}/prev_prices.json"
LAST_NEWS_FILE="${STATE_DIR}/last_news.json"
LAST_WHALE_FILE="${STATE_DIR}/last_whale.json"

# Ensure state directory exists
mkdir -p "${STATE_DIR}" 2>/dev/null

#------------------------------------------------------------------------------
# Utility Functions
#------------------------------------------------------------------------------

# Log message with timestamp
log_msg() {
    local level="$1"
    local message="$2"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[${timestamp}] [${level}] ${message}" | tee -a "${LOG_FILE}"
}

# Log error and exit
log_error() {
    log_msg "ERROR" "$1"
    exit 1
}

# API call with retry logic
api_call() {
    local url="$1"
    local method="${2:-GET}"
    local data="${3:-}"
    local retries=0
    
    while [[ $retries -lt $COINGECKO_MAX_RETRIES ]]; do
        if [[ "$method" == "POST" ]]; then
            response=$(curl -s -X POST "$url" -H "Content-Type: application/json" -d "$data" 2>&1)
        else
            response=$(curl -s -G "$url" 2>&1)
        fi
        
        # Check for rate limit (429)
        if echo "$response" | grep -q '"error"'; then
            log_msg "WARN" "API error, retrying in ${COINGECKO_RETRY_DELAY}s..."
            sleep $COINGECKO_RETRY_DELAY
            ((retries++))
            continue
        fi
        
        echo "$response"
        return 0
    done
    
    log_msg "ERROR" "API call failed after ${COINGECKO_MAX_RETRIES} retries"
    echo "{}"
    return 1
}

# Send Telegram message
send_telegram() {
    local message="$1"
    local parse_mode="${2:-Markdown}"
    
    if [[ -z "${TELEGRAM_BOT_TOKEN}" ]]; then
        log_msg "WARN" "TELEGRAM_BOT_TOKEN not set, skipping message: ${message:0:50}..."
        return 1
    fi
    
    local telegram_url="https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage"
    local payload="{\"chat_id\": \"${TELEGRAM_CHAT_ID}\", \"text\": \"${message}\", \"parse_mode\": \"${parse_mode}\"}"
    
    response=$(curl -s -X POST "${telegram_url}" \
        -H "Content-Type: application/json" \
        -d "${payload}" 2>&1)
    
    if echo "$response" | grep -q '"ok":true'; then
        log_msg "INFO" "Telegram message sent successfully"
        return 0
    else
        log_msg "WARN" "Telegram send failed: ${response}"
        return 1
    fi
}

# Initialize log file
init_log() {
    mkdir -p "${LOG_DIR}" 2>/dev/null
    touch "${LOG_FILE}" 2>/dev/null
}

# Rotate old logs
rotate_logs() {
    if [[ -f "${LOG_FILE}" ]]; then
        local file_age=$(($(date +%s) - $(stat -f "%m" "${LOG_FILE}" 2>/dev/null || stat -c "%Y" "${LOG_FILE}" 2>/dev/null)))
        local max_age=$((ARCHIVE_LOG_DAYS * 86400))
        
        if [[ $file_age -gt $max_age ]]; then
            mv "${LOG_FILE}" "${LOG_FILE}.$(date +%Y%m%d)"
            touch "${LOG_FILE}"
            log_msg "INFO" "Log file rotated"
        fi
    fi
}

# Get coin price from CoinGecko
get_coin_price() {
    local coin_id="$1"
    local currency="${2:-usd}"
    
    local url="${COINGECKO_API_URL}/simple/price?ids=${coin_id}&vs_currencies=${currency}&include_24hr_change=true"
    api_call "$url"
}

# Get multiple coin prices
get_prices() {
    local coin_ids="$1"
    local currency="${2:-usd}"
    
    local url="${COINGECKO_API_URL}/simple/price?ids=${coin_ids}&vs_currencies=${currency}&include_24hr_change=true&include_market_cap=true"
    api_call "$url"
}
