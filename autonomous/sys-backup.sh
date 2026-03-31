#!/bin/bash
# =============================================================================
# sys-backup.sh - DuckBot Brain Backup Script
# =============================================================================
# Backs up OpenClaw workspace, config, and skills
# Runs if last backup > 2 hours old
# Sends confirmation to Telegram 647892
# =============================================================================

set -euo pipefail

# Configuration
readonly LOG_FILE="/tmp/sys-backup.log"
readonly BACKUP_DIR="/Users/duckets/openclaw-backups"
readonly WORKSPACE_DIR="/Users/duckets/.openclaw/workspace"
readonly BRAIN_BACKUP_SCRIPT="/Users/duckets/.openclaw/workspace/tools/brain-backup.sh"
readonly LOCK_FILE="/tmp/sys-backup.lock"
readonly MIN_BACKUP_INTERVAL_HOURS=2

# Telegram
TELEGRAM_BOT_TOKEN="${TELEGRAM_BOT_TOKEN:-}"
TELEGRAM_CHAT_ID="${TELEGRAM_CHAT_ID:-647892}"

# =============================================================================
# Logging
# =============================================================================
log() {
    local msg="[$(date '+%Y-%m-%d %H:%M:%S')] $1"
    echo "$msg" >> "$LOG_FILE"
    echo "$msg"
}

send_telegram() {
    local message="$1"
    if [[ -n "$TELEGRAM_BOT_TOKEN" ]]; then
        curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
            -d "chat_id=${TELEGRAM_CHAT_ID}&text=${message}&parse_mode=HTML" >> /dev/null 2>&1 || true
    fi
}

# =============================================================================
# Lock check
# =============================================================================
check_lock() {
    if [[ -f "$LOCK_FILE" ]]; then
        local pid
        pid=$(cat "$LOCK_FILE" 2>/dev/null || echo "")
        if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
            log "WARN: Another backup instance running. Exiting."
            exit 0
        fi
        rm -f "$LOCK_FILE"
    fi
    echo $$ > "$LOCK_FILE"
}

cleanup() { rm -f "$LOCK_FILE"; }
trap cleanup EXIT

# =============================================================================
# Check if backup is needed (last backup > 2 hours old)
# =============================================================================
should_backup() {
    local last_backup_file="${BACKUP_DIR}/.last_backup_timestamp"

    if [[ ! -f "$last_backup_file" ]]; then
        log "No previous backup found. Will backup."
        return 0
    fi

    local last_ts
    last_ts=$(cat "$last_backup_file" 2>/dev/null || echo "0")
    local now_ts
    now_ts=$(date +%s)
    local age_hours=$(( (now_ts - last_ts) / 3600 ))

    log "Last backup was ${age_hours} hours ago."

    if [[ $age_hours -ge $MIN_BACKUP_INTERVAL_HOURS ]]; then
        log "Backup is older than ${MIN_BACKUP_INTERVAL_HOURS}h threshold. Proceeding."
        return 0
    fi

    log "Backup is fresh enough. Skipping."
    return 1
}

# =============================================================================
# Run brain-backup.sh if available
# =============================================================================
run_brain_backup() {
    if [[ -x "$BRAIN_BACKUP_SCRIPT" ]]; then
        log "Running brain-backup.sh..."
        "$BRAIN_BACKUP_SCRIPT" >> "$LOG_FILE" 2>&1 || true
    else
        log "brain-backup.sh not found or not executable. Skipping."
    fi
}

# =============================================================================
# Create compressed archive backup
# =============================================================================
create_archive_backup() {
    log "Creating archive backup..."

    mkdir -p "$BACKUP_DIR"

    local timestamp
    timestamp=$(date '+%Y%m%d_%H%M%S')
    local archive_name="openclaw_backup_${timestamp}.tar.gz"
    local archive_path="${BACKUP_DIR}/${archive_name}"

    # Key dirs to backup
    local dirs_to_backup=(
        "/Users/duckets/.openclaw/workspace"
        "/Users/duckets/.openclaw/config"
        "/Users/duckets/.openclaw/skills"
    )

    # Check which dirs actually exist
    local existing_dirs=()
    for d in "${dirs_to_backup[@]}"; do
        if [[ -d "$d" ]]; then
            existing_dirs+=("$d")
        fi
    done

    if [[ ${#existing_dirs[@]} -eq 0 ]]; then
        log "ERROR: No directories found to backup!"
        return 1
    fi

    log "Backing up: ${existing_dirs[*]}"

    tar -czf "$archive_path" \
        "${existing_dirs[@]}" \
        2>> "$LOG_FILE" || {
            log "ERROR: tar failed!"
            return 1
        }

    local size
    size=$(du -h "$archive_path" | cut -f1)
    log "Backup created: $archive_path (${size})"

    # Update timestamp
    date +%s > "${BACKUP_DIR}/.last_backup_timestamp"

    # Clean up old backups (keep last 7)
    cleanup_old_backups

    echo "$archive_path"
    return 0
}

# =============================================================================
# Keep only last 7 backups
# =============================================================================
cleanup_old_backups() {
    log "Cleaning up old backups (keeping last 7)..."
    cd "$BACKUP_DIR" || return

    # Count backup files
    local count
    count=$(ls -1 openclaw_backup_*.tar.gz 2>/dev/null | wc -l | tr -d ' ')

    if [[ "$count" -gt 7 ]]; then
        # Remove oldest backups
        ls -1t openclaw_backup_*.tar.gz | tail -n +8 | xargs rm -f 2>/dev/null || true
        log "Removed $((count - 7)) old backup(s)"
    fi
}

# =============================================================================
# Send backup confirmation
# =============================================================================
send_backup_report() {
    local status="$1"      # SUCCESS or FAILED
    local archive_path="$2"
    local size="$3"

    local emoji="✅"
    if [[ "$status" == "FAILED" ]]; then
        emoji="❌"
    fi

    local timestamp
    timestamp=$(date '+%Y-%m-%d %H:%M:%S')

    send_telegram "${emoji} <b>Brain Backup ${status}</b>%0ATime: ${timestamp}%0AArchive: ${archive_path##*/}%0ASize: ${size}%0AInterval: ${MIN_BACKUP_INTERVAL_HOURS}h+"
}

# =============================================================================
# Main
# =============================================================================
main() {
    check_lock

    log ""
    log "#########################################"
    log "# sys-backup.sh started"
    log "#########################################"

    # Check if backup is needed
    if ! should_backup; then
        log "Backup not needed. Exiting."
        exit 0
    fi

    # Run brain-backup.sh first (if available)
    run_brain_backup

    # Create archive
    local archive_path=""
    local backup_status="FAILED"
    local archive_size="N/A"

    if archive_path=$(create_archive_backup); then
        backup_status="SUCCESS"
        archive_size=$(du -h "$archive_path" | cut -f1)
        log "Backup completed successfully: $archive_path (${archive_size})"
    else
        log "Backup FAILED!"
    fi

    send_backup_report "$backup_status" "$archive_path" "$archive_size"

    log "#########################################"
    log "# Backup finished"
    log "#########################################"
    log ""
}

main "$@"
