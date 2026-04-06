#!/bin/bash
# =============================================================================
# code-auto-commit.sh - DuckBot Auto Git Commit Script
# =============================================================================
# Every 6 hours, checks key repos for changes and commits/pushes
# Uses AI to generate commit messages
# Logs to /tmp/auto-commit.log
# Sends summary to Telegram 647892
# =============================================================================

set -euo pipefail

# Configuration
readonly LOG_FILE="/tmp/auto-commit.log"
readonly LOCK_FILE="/tmp/code-auto-commit.lock"
readonly WORKSPACE="${HOME}/.openclaw/workspace"
readonly AI_COUNCIL="/AI-Bot-Council-Concensus"

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
# Lock
# =============================================================================
check_lock() {
    if [[ -f "$LOCK_FILE" ]]; then
        local pid
        pid=$(cat "$LOCK_FILE" 2>/dev/null || echo "")
        if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
            log "WARN: Another commit instance running. Exiting."
            exit 0
        fi
        rm -f "$LOCK_FILE"
    fi
    echo $$ > "$LOCK_FILE"
}

cleanup() { rm -f "$LOCK_FILE"; }
trap cleanup EXIT

# =============================================================================
# Check if directory is a git repo
# =============================================================================
is_git_repo() {
    [[ -d "$1/.git" ]]
}

# =============================================================================
# Check if repo has remote
# =============================================================================
has_remote() {
    cd "$1" && git remote get-url origin &>/dev/null
}

# =============================================================================
# Get list of repos to check
# =============================================================================
get_repos() {
    local repos=()

    # Main workspace
    if [[ -d "$WORKSPACE" ]]; then
        repos+=("$WORKSPACE")
    fi

    # AI Council
    if [[ -d "$AI_COUNCIL" ]]; then
        repos+=("$AI_COUNCIL")
    fi

    # Scan ${HOME}/ for other git repos
    if [[ -d "${HOME}" ]]; then
        while IFS= read -r -d '' repo; do
            # Skip .openclaw subdirs
            if [[ "$repo" != *".openclaw/"* ]] && [[ "$repo" != *".openclaw"* ]]; then
                if is_git_repo "$repo"; then
                    repos+=("$repo")
                fi
            fi
        done < <(find ${HOME} -maxdepth 2 -type d -name ".git" -print0 2>/dev/null | while read -d '' gitdir; do dirname "$gitdir"; done)
    fi

    # Remove duplicates
    printf '%s\n' "${repos[@]}" | sort -u
}

# =============================================================================
# Check if repo has uncommitted changes
# =============================================================================
has_changes() {
    cd "$1" || return 1
    ! git diff --stat --cached --quiet 2>/dev/null && return 0
    ! git diff --stat --quiet 2>/dev/null && return 0
    ! git status --porcelain --untracked-files=all 2>/dev/null | grep -q . && return 1
    return 0
}

# =============================================================================
# Get summary of changes
# =============================================================================
get_change_summary() {
    cd "$1" || return ""
    git diff --stat --cached 2>/dev/null || true
    git diff --stat 2>/dev/null || true
    git status --porcelain 2>/dev/null | head -20 || true
}

# =============================================================================
# Generate AI commit message using local LM Studio
# =============================================================================
generate_commit_message() {
    local repo_path="$1"
    local summary="$2"

    local prompt="Generate a concise git commit message (max 72 chars) for these changes in a DuckBot/OpenClaw project:

${summary}

Respond with ONLY the commit message, no explanation. Format: type: description (e.g., feat: add new health check script)"

    # Try LM Studio first (fast, local)
    local msg
    msg=$(curl -s -X POST "http://100.116.54.125:1234/v1/chat/completions" \
        -H "Content-Type: application/json" \
        -d "{\"model\":\"qwen3.5-27b\",\"messages\":[{\"role\":\"user\",\"content\":\"${prompt}\"}],\"max_tokens\":60}" \
        2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['choices'][0]['message']['content'])" 2>/dev/null || echo "")

    # Fallback to simple message if AI fails
    if [[ -z "$msg" ]]; then
        msg="chore: auto-sync $(date '+%Y-%m-%d')"
    fi

    # Trim to 72 chars
    echo "${msg:0:72}"
}

# =============================================================================
# Commit and push a repo
# =============================================================================
auto_commit_repo() {
    local repo_path="$1"
    local repo_name
    repo_name=$(basename "$repo_path")

    log "========================================="
    log "Processing repo: $repo_path"

    if ! is_git_repo "$repo_path"; then
        log "Not a git repo. Skipping."
        return 0
    fi

    if ! has_changes "$repo_path"; then
        log "No changes. Skipping."
        return 0
    fi

    log "Changes detected in ${repo_name}!"

    local summary
    summary=$(get_change_summary "$repo_path")
    log "Change summary: $summary"

    # Generate commit message
    local commit_msg
    commit_msg=$(generate_commit_message "$repo_path" "$summary")
    log "Commit message: $commit_msg"

    # Stage all changes
    cd "$repo_path"
    git add -A >> "$LOG_FILE" 2>&1

    # Commit
    if git commit -m "$commit_msg" >> "$LOG_FILE" 2>&1; then
        log "Committed: $commit_msg"
    else
        log "Commit failed or nothing to commit"
        return 1
    fi

    # Push if remote exists
    if has_remote "$repo_path"; then
        log "Pushing to remote..."
        if git push >> "$LOG_FILE" 2>&1; then
            log "Pushed successfully"
            echo "PUSHED:${repo_name}:${commit_msg}"
        else
            log "PUSH FAILED - may need gh auth"
            echo "FAILED_PUSH:${repo_name}:${commit_msg}"
        fi
    else
        log "No remote configured. Commit only."
        echo "COMMITTED:${repo_name}:${commit_msg}"
    fi

    return 0
}

# =============================================================================
# Main
# =============================================================================
main() {
    check_lock

    log ""
    log "#########################################"
    log "# code-auto-commit.sh started"
    log "#########################################"

    local repos
    IFS= read -r -a repos < <(get_repos)

    if [[ ${#repos[@]} -eq 0 ]]; then
        log "No repos found."
        exit 0
    fi

    log "Found ${#repos[@]} repos to check: ${repos[*]}"

    local results=()
    local has_any_commits=false

    for repo in "${repos[@]}"; do
        if [[ -d "$repo" ]]; then
            local result
            if result=$(auto_commit_repo "$repo" 2>&1); then
                if [[ "$result" =~ ^(PUSHED|COMMITTED|FAILED_PUSH): ]]; then
                    results+=("$result")
                    has_any_commits=true
                fi
            fi
        fi
    done

    # Send Telegram summary
    if $has_any_commits; then
        local summary="📝 <b>Auto-Commit Summary</b>%0A"
        for r in "${results[@]}"; do
            local status emoji
            status="${r%%:*}"
            case "$status" in
                PUSHED) emoji="✅" ;;
                COMMITTED) emoji="📝" ;;
                FAILED_PUSH) emoji="⚠️" ;;
            esac
            summary+="${emoji} ${r#*:}%0A"
        done
        send_telegram "$summary"
    else
        log "No commits made."
    fi

    log "#########################################"
    log "# Done"
    log "#########################################"
    log ""
}

main "$@"
