#!/bin/bash
# ============================================================================
# osint-github-watch.sh - GitHub Repository Monitor
# Runs: Every 2 hours
# Tracks: starred repos and Duckets' repos
# Monitors: commits, issues, PRs, releases
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/osint-config.sh"

SCRIPT_NAME="github"
LOG_FILE="${LOG_DIR}/osint-${SCRIPT_NAME}.log"

# ============================================================================
# GET REPO INFO
# ============================================================================
get_repo_info() {
    local repo="$1"  # format: owner/repo
    local data=$(github_api "repos/${repo}")
    echo "$data"
}

# ============================================================================
# GET RECENT COMMITS
# ============================================================================
get_recent_commits() {
    local repo="$1"
    local since="${2:-24h}"  # Default: last 24 hours
    
    # Convert to ISO date
    local since_date=$(date -v-${since} +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -d "-${since}" +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || echo "")
    
    if [[ -n "$since_date" ]]; then
        github_api "repos/${repo}/commits?since=${since_date}&per_page=10"
    else
        github_api "repos/${repo}/commits?per_page=10"
    fi
}

# ============================================================================
# GET RECENT ISSUES
# ============================================================================
get_recent_issues() {
    local repo="$1"
    local state="${2:-open}"  # open, closed, all
    
    github_api "repos/${repo}/issues?state=${state}&per_page=10&sort=updated"
}

# ============================================================================
# GET RECENT PULL REQUESTS
# ============================================================================
get_recent_prs() {
    local repo="$1"
    local state="${2:-open}"  # open, closed, merged, all
    
    github_api "repos/${repo}/pulls?state=${state}&per_page=10&sort=updated"
}

# ============================================================================
# GET RECENT RELEASES
# ============================================================================
get_recent_releases() {
    local repo="$1"
    
    github_api "repos/${repo}/releases?per_page=5"
}

# ============================================================================
# PARSE AND FORMAT ACTIVITY
# ============================================================================
format_activity() {
    local repo="$1"
    local activity_type="$2"
    local data="$3"
    
    local formatted=""
    
    if ! command -v jq &>/dev/null; then
        return 1
    fi
    
    case "$activity_type" in
        "commits")
            # Check if we have commits
            local count=$(echo "$data" | jq 'length' 2>/dev/null || echo "0")
            if [[ "$count" -gt 0 ]]; then
                formatted+="  📝 ${count} commits:\n"
                
                while IFS= read -r commit_json; do
                    local sha=$(echo "$commit_json" | jq -r '.sha[:7]' 2>/dev/null)
                    local message=$(echo "$commit_json" | jq -r '.commit.message' 2>/dev/null | head -c 100)
                    local author=$(echo "$commit_json" | jq -r '.commit.author.name' 2>/dev/null)
                    local date=$(echo "$commit_json" | jq -r '.commit.author.date' 2>/dev/null | cut -d'T' -f1)
                    
                    if [[ -n "$message" && "$message" != "null" ]]; then
                        formatted+="     • ${sha} ${author}: ${message}...\n"
                    fi
                done < <(echo "$data" | jq -r '.[0:5] | .[] | @json' 2>/dev/null)
            fi
            ;;
        "issues")
            local count=$(echo "$data" | jq 'length' 2>/dev/null || echo "0")
            if [[ "$count" -gt 0 ]]; then
                formatted+="  🐛 ${count} issues:\n"
                
                while IFS= read -r issue_json; do
                    local title=$(echo "$issue_json" | jq -r '.title' 2>/dev/null | head -c 80)
                    local num=$(echo "$issue_json" | jq -r '.number' 2>/dev/null)
                    local state=$(echo "$issue_json" | jq -r '.state' 2>/dev/null)
                    local url=$(echo "$issue_json" | jq -r '.html_url' 2>/dev/null)
                    
                    if [[ -n "$title" && "$title" != "null" ]]; then
                        formatted+="     • #${num} [${state}] ${title}\n"
                    fi
                done < <(echo "$data" | jq -r '.[0:3] | .[] | @json' 2>/dev/null)
            fi
            ;;
        "prs")
            local count=$(echo "$data" | jq 'length' 2>/dev/null || echo "0")
            if [[ "$count" -gt 0 ]]; then
                formatted+="  🔀 ${count} PRs:\n"
                
                while IFS= read -r pr_json; do
                    local title=$(echo "$pr_json" | jq -r '.title' 2>/dev/null | head -c 80)
                    local num=$(echo "$pr_json" | jq -r '.number' 2>/dev/null)
                    local state=$(echo "$pr_json" | jq -r '.state' 2>/dev/null)
                    local draft=$(echo "$pr_json" | jq -r '.draft' 2>/dev/null)
                    
                    if [[ -n "$title" && "$title" != "null" ]]; then
                        local draft_marker=""
                        [[ "$draft" == "true" ]] && draft_marker="[DRAFT]"
                        formatted+="     • #${num} [${state}] ${draft_marker} ${title}\n"
                    fi
                done < <(echo "$data" | jq -r '.[0:3] | .[] | @json' 2>/dev/null)
            fi
            ;;
        "releases")
            local count=$(echo "$data" | jq 'length' 2>/dev/null || echo "0")
            if [[ "$count" -gt 0 ]]; then
                formatted+="  🚀 ${count} releases:\n"
                
                while IFS= read -r release_json; do
                    local tag=$(echo "$release_json" | jq -r '.tag_name' 2>/dev/null)
                    local name=$(echo "$release_json" | jq -r '.name' 2>/dev/null | head -c 60)
                    local date=$(echo "$release_json" | jq -r '.published_at' 2>/dev/null | cut -d'T' -f1)
                    
                    if [[ -n "$tag" && "$tag" != "null" ]]; then
                        formatted+="     • ${tag} - ${name} (${date})\n"
                    fi
                done < <(echo "$data" | jq -r '.[0:2] | .[] | @json' 2>/dev/null)
            fi
            ;;
    esac
    
    echo "$formatted"
}

# ============================================================================
# MAIN FUNCTION
# ============================================================================
main() {
    log_osint "$SCRIPT_NAME" "Starting GitHub watch scan"
    
    local activity_count=0
    local alert_message=""
    local has_activity=false
    
    alert_message="🐙 GITHUB WATCH — $(date '+%H:%M %m/%d') 🦆\n"
    alert_message+="━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n"
    
    # Process each tracked repo
    for repo in "${TRACKED_GITHUB_REPOS[@]}"; do
        log_osint "$SCRIPT_NAME" "Checking repo: $repo"
        
        # Rate limit check
        check_rate_limit "github_api" 30
        
        local repo_activity=""
        local repo_has_activity=false
        
        # Check commits (last 24 hours)
        log_osint "$SCRIPT_NAME" "Checking commits for $repo"
        local commits=$(get_recent_commits "$repo" "24h")
        local commits_formatted=$(format_activity "$repo" "commits" "$commits")
        if [[ -n "$commits_formatted" ]]; then
            repo_activity+="$commits_formatted"
            repo_has_activity=true
            ((activity_count++))
        fi
        
        sleep 1
        
        # Check releases
        log_osint "$SCRIPT_NAME" "Checking releases for $repo"
        local releases=$(get_recent_releases "$repo")
        local releases_formatted=$(format_activity "$repo" "releases" "$releases")
        if [[ -n "$releases_formatted" ]]; then
            repo_activity+="$releases_formatted"
            repo_has_activity=true
            ((activity_count++))
        fi
        
        sleep 1
        
        # Check issues
        log_osint "$SCRIPT_NAME" "Checking issues for $repo"
        local issues=$(get_recent_issues "$repo" "all")
        local issues_formatted=$(format_activity "$repo" "issues" "$issues")
        if [[ -n "$issues_formatted" ]]; then
            repo_activity+="$issues_formatted"
            repo_has_activity=true
            ((activity_count++))
        fi
        
        sleep 1
        
        # Check PRs
        log_osint "$SCRIPT_NAME" "Checking PRs for $repo"
        local prs=$(get_recent_prs "$repo" "all")
        local prs_formatted=$(format_activity "$repo" "prs" "$prs")
        if [[ -n "$prs_formatted" ]]; then
            repo_activity+="$prs_formatted"
            repo_has_activity=true
            ((activity_count++))
        fi
        
        # If we found any activity, add it to the alert
        if [[ "$repo_has_activity" == "true" ]]; then
            has_activity=true
            alert_message+="📦 ${repo}\n"
            alert_message+="${repo_activity}"
            alert_message+="\n"
        fi
        
        # Rate limit between repos
        sleep 5
    done
    
    # Finalize message
    alert_message+="━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
    alert_message+="🤖 DuckBot OSINT • ${#TRACKED_GITHUB_REPOS[@]} repos • $activity_count activities"
    
    # Send alert if we found any activity
    if [[ "$has_activity" == "true" ]]; then
        log_osint "$SCRIPT_NAME" "Found activity, sending alert"
        
        if send_telegram "$alert_message" "$TELEGRAM_TOPIC_ID"; then
            log_osint "$SCRIPT_NAME" "Alert sent successfully"
        else
            log_osint "$SCRIPT_NAME" "Failed to send alert"
        fi
    else
        log_osint "$SCRIPT_NAME" "No new GitHub activity found"
    fi
    
    log_osint "$SCRIPT_NAME" "GitHub watch complete"
}

# ============================================================================
# ERROR HANDLING
# ============================================================================
trap 'log_osint "$SCRIPT_NAME" "ERROR: Script failed at line $LINENO"; exit 1' ERR

# ============================================================================
# RUN
# ============================================================================
main "$@"
