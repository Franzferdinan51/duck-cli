#!/bin/bash
# =============================================================================
# DuckBot Master Cron Scheduler
# Installs all autonomous task cron jobs
# =============================================================================
# Usage: master-cron-scheduler.sh [install|show|run-all|verify]
#   install   - Install all cron jobs (default)
#   show      - Show current crontab with explanations
#   run-all   - Create run-all.sh and run all tasks manually
#   verify    - Verify all scripts exist
# =============================================================================

set -euo pipefail

readonly AUTONOMOUS_DIR="/.openclaw/workspace/tools/autonomous"
readonly LOG_DIR="/tmp"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_header() { echo -e "\n${BLUE}==== $1 ====${NC}"; }
print_ok() { echo -e "${GREEN}✓ $1${NC}"; }
print_warn() { echo -e "${YELLOW}⚠ $1${NC}"; }
print_err() { echo -e "${RED}✗ $1${NC}"; }

# =============================================================================
# Verify all scripts exist
# =============================================================================
verify_scripts() {
    print_header "Verifying Scripts"
    local missing=0
    local scripts=(
        # Grow
        "${AUTONOMOUS_DIR}/grow-morning-check.sh"
        "${AUTONOMOUS_DIR}/grow-evening-check.sh"
        "${AUTONOMOUS_DIR}/grow-threshold-alert.sh"
        "${AUTONOMOUS_DIR}/grow-harvest-countdown.sh"
        "${AUTONOMOUS_DIR}/grow-monthly-report.sh"
        "${AUTONOMOUS_DIR}/grow-watering-tracker.sh"
        # Crypto
        "${AUTONOMOUS_DIR}/crypto-portfolio.sh"
        "${AUTONOMOUS_DIR}/crypto-price-alert.sh"
        "${AUTONOMOUS_DIR}/crypto-news-scan.sh"
        "${AUTONOMOUS_DIR}/crypto-whale-watch.sh"
        "${AUTONOMOUS_DIR}/crypto-defi-health.sh"
        # OSINT
        "${AUTONOMOUS_DIR}/osint-briefing.sh"
        "${AUTONOMOUS_DIR}/osint-keyword-alert.sh"
        "${AUTONOMOUS_DIR}/osint-account-watch.sh"
        "${AUTONOMOUS_DIR}/osint-github-watch.sh"
        "${AUTONOMOUS_DIR}/osint-reddit-digest.sh"
        # News
        "${AUTONOMOUS_DIR}/news-daily-brief.sh"
        "${AUTONOMOUS_DIR}/weather-daily.sh"
        # Home
        "${AUTONOMOUS_DIR}/home-equipment-monitor.sh"
        "${AUTONOMOUS_DIR}/home-smart-lights.sh"
        # DevOps
        "${AUTONOMOUS_DIR}/sys-health-check.sh"
        "${AUTONOMOUS_DIR}/sys-auto-heal.sh"
        "${AUTONOMOUS_DIR}/sys-backup.sh"
        "${AUTONOMOUS_DIR}/sys-memory-check.sh"
        "${AUTONOMOUS_DIR}/code-auto-commit.sh"
        "${AUTONOMOUS_DIR}/code-failure-recover.sh"
    )
    for s in "${scripts[@]}"; do
        if [[ -f "$s" && -x "$s" ]]; then
            print_ok "$(basename $s)"
        else
            if [[ ! -f "$s" ]]; then
                print_err "MISSING: $(basename $s)"
            else
                print_warn "NOT EXECUTABLE: $(basename $s)"
                chmod +x "$s" 2>/dev/null && print_ok "Fixed: $(basename $s)"
            fi
            ((missing++))
        fi
    done
    echo ""
    if [[ $missing -eq 0 ]]; then
        print_ok "All scripts verified!"
    else
        print_warn "$missing script(s) missing or not executable"
    fi
}

# =============================================================================
# Generate crontab
# MAX: 1x per hour for any polling task
# =============================================================================
generate_crontab() {
    cat << CRONEOF
# =============================================================================
# DuckBot Master Cron Schedule
# MAX: 1x per hour for any polling task
# Generated: $(date '+%Y-%m-%d %H:%M')
# =============================================================================

SHELL=/bin/bash
PATH=/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin
MAILTO=""

# -----------------------------------------------------------------------------
# EVERY HOUR (max polling rate)
# -----------------------------------------------------------------------------
0 * * * * /.openclaw/workspace/tools/autonomous/sys-health-check.sh >> /tmp/sys-health.log 2>&1
0 * * * * /.openclaw/workspace/tools/autonomous/sys-memory-check.sh >> /tmp/sys-memory.log 2>&1
0 * * * * /.openclaw/workspace/tools/autonomous/code-failure-recover.sh >> /tmp/failure-recover.log 2>&1
0 * * * * /.openclaw/workspace/tools/autonomous/grow-threshold-alert.sh >> /.openclaw/workspace/logs/grow-cron.log 2>&1
0 * * * * /.openclaw/workspace/tools/autonomous/crypto-price-alert.sh >> /.openclaw/workspace/logs/crypto-cron.log 2>&1
0 * * * * /.openclaw/workspace/tools/autonomous/crypto-whale-watch.sh >> /.openclaw/workspace/logs/crypto-cron.log 2>&1
0 * * * * /.openclaw/workspace/tools/autonomous/osint-keyword-alert.sh >> /.openclaw/workspace/logs/osint-cron.log 2>&1
0 * * * * /.openclaw/workspace/tools/autonomous/osint-account-watch.sh >> /.openclaw/workspace/logs/osint-cron.log 2>&1

# -----------------------------------------------------------------------------
# EVERY 2 HOURS
# -----------------------------------------------------------------------------
0 */2 * * * /.openclaw/workspace/tools/autonomous/sys-backup.sh >> /tmp/sys-backup.log 2>&1
0 */2 * * * /.openclaw/workspace/tools/autonomous/code-auto-commit.sh >> /tmp/auto-commit.log 2>&1
0 */2 * * * /.openclaw/workspace/tools/autonomous/osint-github-watch.sh >> /.openclaw/workspace/logs/osint-cron.log 2>&1

# -----------------------------------------------------------------------------
# EVERY 6 HOURS
# -----------------------------------------------------------------------------
0 */6 * * * /.openclaw/workspace/tools/autonomous/crypto-defi-health.sh >> /.openclaw/workspace/logs/crypto-cron.log 2>&1

# -----------------------------------------------------------------------------
# DAILY (once per day)
# -----------------------------------------------------------------------------
0 7 * * * /.openclaw/workspace/tools/autonomous/grow-watering-tracker.sh >> /.openclaw/workspace/logs/grow-cron.log 2>&1
0 7 * * * /.openclaw/workspace/tools/autonomous/weather-daily.sh >> /.openclaw/workspace/logs/weather-cron.log 2>&1
0 8 * * * /.openclaw/workspace/tools/autonomous/news-daily-brief.sh >> /.openclaw/workspace/logs/news-cron.log 2>&1
0 8 * * * /.openclaw/workspace/tools/autonomous/crypto-news-scan.sh >> /.openclaw/workspace/logs/crypto-cron.log 2>&1
0 9 * * * /.openclaw/workspace/tools/autonomous/osint-briefing.sh >> /.openclaw/workspace/logs/osint-cron.log 2>&1
0 9 * * * /.openclaw/workspace/tools/autonomous/osint-reddit-digest.sh >> /.openclaw/workspace/logs/osint-cron.log 2>&1
0 9 * * * /.openclaw/workspace/tools/autonomous/crypto-portfolio.sh >> /.openclaw/workspace/logs/crypto-cron.log 2>&1
0 9 * * * /.openclaw/workspace/tools/autonomous/grow-morning-check.sh >> /.openclaw/workspace/logs/grow-cron.log 2>&1
0 21 * * * /.openclaw/workspace/tools/autonomous/grow-evening-check.sh >> /.openclaw/workspace/logs/grow-cron.log 2>&1
0 18 * * * /.openclaw/workspace/tools/autonomous/crypto-news-scan.sh >> /.openclaw/workspace/logs/crypto-cron.log 2>&1
0 18 * * * /.openclaw/workspace/tools/autonomous/osint-reddit-digest.sh >> /.openclaw/workspace/logs/osint-cron.log 2>&1
0 8 * * * /.openclaw/workspace/tools/autonomous/home-equipment-monitor.sh >> /.openclaw/workspace/logs/home-cron.log 2>&1

# -----------------------------------------------------------------------------
# WEEKLY (Sunday 9AM)
# -----------------------------------------------------------------------------
0 9 * * 0 /.openclaw/workspace/tools/autonomous/grow-harvest-countdown.sh >> /.openclaw/workspace/logs/grow-cron.log 2>&1

# -----------------------------------------------------------------------------
# MONTHLY (1st of month 8AM)
# -----------------------------------------------------------------------------
0 8 1 * * /.openclaw/workspace/tools/autonomous/grow-monthly-report.sh >> /.openclaw/workspace/logs/grow-cron.log 2>&1

# =============================================================================
# End of DuckBot Master Cron
# =============================================================================
CRONEOF
}

# =============================================================================
# Create run-all.sh
# =============================================================================
create_run_all() {
    local run_all_path="${AUTONOMOUS_DIR}/run-all.sh"
    cat > "$run_all_path" << 'SCRIPTEOF'
#!/bin/bash
set -euo pipefail
readonly AUTONOMOUS_DIR="/.openclaw/workspace/tools/autonomous"
readonly LOG_DIR="/tmp"
log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"; }
SCRIPTEOF
    # Add each script
    for s in "${AUTONOMOUS_DIR}"/*.sh; do
        [[ "$(basename $s)" == "run-all.sh" ]] && continue
        echo "log 'Running: $(basename $s)' && $s 2>&1 | tee -a '${LOG_DIR}/run-all.log' || log 'FAILED: $(basename $s)'" >> "$run_all_path"
    done
    chmod +x "$run_all_path"
    print_ok "Created: $run_all_path"
}

# =============================================================================
# Install crontab
# =============================================================================
install_crontab() {
    print_header "Installing DuckBot Cron Jobs"
    if crontab -l &>/dev/null; then
        local backup="/tmp/crontab.backup.$(date '+%Y%m%d_%H%M%S')"
        crontab -l > "$backup"
        print_ok "Backed up existing crontab to: $backup"
    fi
    local temp_cron=$(mktemp)
    generate_crontab | sed "s/\$(date '+%Y-%m-%d %H:%M:%S')/$(date '+%Y-%m-%d %H:%M')/" > "$temp_cron"
    crontab "$temp_cron"
    rm -f "$temp_cron"
    print_ok "Crontab installed!"
    echo ""
    show_crontab
}

# =============================================================================
# Show current crontab
# =============================================================================
show_crontab() {
    print_header "Current Crontab"
    if crontab -l &>/dev/null; then
        crontab -l | grep -v "^#" | grep -v "^$" | grep -v "^SHELL" | grep -v "^PATH" | grep -v "^MAILTO" || echo "(empty)"
    else
        print_warn "No crontab installed"
    fi
}

# =============================================================================
# Explain crontab
# =============================================================================
explain_crontab() {
    print_header "Crontab Entry Explanations"
    cat << 'EXPLAIN'

## EVERY HOUR (max polling)
1. sys-health-check.sh — Services UP/DOWN (OpenClaw, CannaAI, AI Council, BrowserOS, LM Studio)
2. sys-memory-check.sh — Free RAM <500MB triggers cleanup
3. code-failure-recover.sh — Retry failed cron jobs
4. grow-threshold-alert.sh — VPD/temp/humidity thresholds (max 1x/hr)
5. crypto-price-alert.sh — BTC/ETH >5% swing alerts (max 1x/hr)
6. crypto-whale-watch.sh — >$1M wallet movements (max 1x/hr)
7. osint-keyword-alert.sh — DuckBot/CannaAI/R S-Agent mentions (max 1x/hr)
8. osint-account-watch.sh — Tracked X accounts (max 1x/hr)

## EVERY 2 HOURS
9. sys-backup.sh — Brain backup to /openclaw-backups/
10. code-auto-commit.sh — Git auto-commit/push
11. osint-github-watch.sh — Repo commits/PRs/releases

## EVERY 6 HOURS
12. crypto-defi-health.sh — TVL + APY monitoring

## DAILY
13. grow-watering-tracker.sh — 7AM reservoir check
14. weather-daily.sh — 7AM 5-day forecast + grow alerts
15. news-daily-brief.sh — 8AM AI/crypto/cannabis/Ukraine news
16. crypto-news-scan.sh — 8AM news sentiment
17. osint-briefing.sh — 9AM OSINT briefing
18. osint-reddit-digest.sh — 9AM subreddit digest
19. crypto-portfolio.sh — 9AM wallet balances + P&L
20. grow-morning-check.sh — 9AM photo + CannaAI + env data
21. grow-evening-check.sh — 9PM trend comparison
22. crypto-news-scan.sh — 6PM news sentiment
23. osint-reddit-digest.sh — 6PM subreddit digest
24. home-equipment-monitor.sh — 8AM equipment runtime hours

## WEEKLY
25. grow-harvest-countdown.sh — Sunday 9AM harvest estimate

## MONTHLY
26. grow-monthly-report.sh — 1st of month 8AM stats report

EXPLAIN
}

# =============================================================================
# Main
# =============================================================================
action="${1:-install}"

case "$action" in
    install) install_crontab ;;
    show) show_crontab ;;
    explain) explain_crontab ;;
    verify) verify_scripts ;;
    run-all)
        verify_scripts
        echo ""
        create_run_all
        echo ""
        print_header "Running All Tasks"
        "$AUTONOMOUS_DIR/run-all.sh"
        ;;
    *)
        echo "Usage: $0 [install|show|explain|verify|run-all]"
        echo "  install   - Install all cron jobs (default)"
        echo "  show      - Show current crontab"
        echo "  explain   - Explain each crontab entry"
        echo "  verify    - Verify all scripts exist"
        echo "  run-all   - Create run-all.sh and run all tasks"
        ;;
esac
