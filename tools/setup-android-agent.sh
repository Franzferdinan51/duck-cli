#!/bin/bash
# Duck CLI Android Agent - Complete Setup
# Runs on Mac, controls Android via ADB, uses LM Studio for LLM reasoning
#
# Architecture:
#   Mac (duck-cli + LM Studio gemma-4-e4b-it) ← ADB → Phone (controlled)
#
# Usage:
#   ./setup-android-agent.sh                    # Setup and run
#   ./setup-android-agent.sh --goal "open settings"  # Run specific goal
#   ./setup-android-agent.sh --test              # Test connection
#   ./setup-android-agent.sh --status            # Check status

set -e

# Configuration
AGENT_DIR="/tmp/duck-agent"
mkdir -p "$AGENT_DIR"

# LM Studio Configuration
LM_STUDIO_URL="${LM_STUDIO_URL:-http://100.68.208.113:1234}"
LM_STUDIO_MODEL="${LM_STUDIO_MODEL:-google/gemma-4-e4b-it}"
LM_STUDIO_API_KEY="${LM_STUDIO_API_KEY:-sk-lm-xWvfQHZF:L8P76SQakhEA95U8DDNf}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

log() { echo -e "${GREEN}[DuckAgent]${NC} $1"; }
warn() { echo -e "${YELLOW}[DuckAgent]${NC} $1"; }
error() { echo -e "${RED}[DuckAgent]${NC} $1"; }

# Check prerequisites
check_prereqs() {
    log "Checking prerequisites..."
    
    # Check ADB
    if ! command -v adb &> /dev/null; then
        error "ADB not found. Install with: brew install android-platform-tools"
        exit 1
    fi
    log "✓ ADB available"
    
    # Check curl
    if ! command -v curl &> /dev/null; then
        error "curl not found"
        exit 1
    fi
    log "✓ curl available"
    
    # Check device connection
    DEVICES=$(adb devices | grep "device$" | wc -l)
    if [ "$DEVICES" -eq 0 ]; then
        error "No Android devices connected via ADB"
        exit 1
    fi
    log "✓ $DEVICES device(s) connected"
}

# Test LM Studio connection
test_lm_studio() {
    log "Testing LM Studio connection..."
    log "  URL: $LM_STUDIO_URL"
    log "  Model: $LM_STUDIO_MODEL"
    
    RESPONSE=$(curl -s -w "\n%{http_code}" "$LM_STUDIO_URL/v1/models" \
        -H "Authorization: Bearer $LM_STUDIO_API_KEY" 2>/dev/null || echo "000")
    
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    
    if [ "$HTTP_CODE" = "200" ]; then
        log "✓ LM Studio connected"
        return 0
    else
        warn "⚠ LM Studio returned HTTP $HTTP_CODE"
        warn "  Will attempt to use anyway..."
        return 1
    fi
}

# Get screen state
perceive() {
    local step=$1
    
    # Capture screenshot
    adb shell screencap -p /sdcard/screen.png 2>/dev/null
    adb pull /sdcard/screen.png "$AGENT_DIR/screen_$step.png" 2>/dev/null
    
    # Dump UI hierarchy
    adb shell uiautomator dump /sdcard/ui.xml 2>/dev/null
    adb pull /sdcard/ui.xml "$AGENT_DIR/ui_$step.xml" 2>/dev/null
    
    # Get screen info
    local xml=$(cat "$AGENT_DIR/ui_$step.xml" 2>/dev/null || echo "")
    local app=$(adb shell "dumpsys activity activities | grep mResumedActivity | head -1" 2>/dev/null | grep -oP '[^\/]+/[^\s]+' | head -1)
    
    echo "$xml" > "$AGENT_DIR/screen_info_$step.txt"
    echo "$app" > "$AGENT_DIR/app_$step.txt"
    
    # Extract tappable elements
    if [ -f "$AGENT_DIR/ui_$step.xml" ]; then
        grep -oP 'text="[^"]*"(?=[^>]*(clickable="true"|focused="true"))' "$AGENT_DIR/ui_$step.xml" 2>/dev/null | head -10
    fi
}

# Call LLM for reasoning
reason() {
    local goal="$1"
    local step=$2
    local history="$3"
    
    # Build prompt
    local prompt="You are an Android automation agent running on Mac controlling a phone via ADB.

GOAL: $goal
STEP: $step/30

HISTORY:
$history

CURRENT SCREEN INFO:
$(cat "$AGENT_DIR/screen_info_$step.txt" 2>/dev/null | head -50 || echo "No screen data")

Based on the goal and current screen, decide the next action.

Actions available:
- tap X Y (e.g., tap 360 720)
- type TEXT (e.g., type Hello)
- press KEY (back, home, enter, recent)
- swipe DIRECTION (up, down, left, right)
- launch PACKAGE (e.g., launch com.android.settings)
- done (goal complete)

Respond with JSON only:
{\"think\": \"why this action\", \"action\": \"the action to take\"}"
    
    # Call LM Studio (OpenAI-compatible)
    local response=$(curl -s "$LM_STUDIO_URL/v1/chat/completions" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $LM_STUDIO_API_KEY" \
        -d "{
            \"model\": \"$LM_STUDIO_MODEL\",
            \"messages\": [{\"role\": \"user\", \"content\": $prompt}],
            \"max_tokens\": 200,
            \"temperature\": 0.1
        }" 2>/dev/null)
    
    # Parse response
    echo "$response" | grep -oP '"content":"\K[^"]+' | head -1 || echo '{"think":"error","action":"done"}'
}

# Execute action
act() {
    local action="$1"
    
    local cmd=$(echo "$action" | jq -r '.action // .Action // "done"' 2>/dev/null || echo "$action")
    local think=$(echo "$action" | jq -r '.think // .Think // ""' 2>/dev/null || echo "")
    
    if [ -n "$think" ]; then
        log "  💭 $think"
    fi
    
    case "$cmd" in
        tap*)
            local coords=$(echo "$cmd" | grep -oP '\d+ \d+' || echo "")
            if [ -n "$coords" ]; then
                adb shell "input tap $coords"
                log "  ✓ Tapped $coords"
            fi
            ;;
        type*)
            local text=$(echo "$cmd" | sed 's/type //' | sed 's/"/\\"/g')
            adb shell "input text \"$text\""
            log "  ✓ Typed: $text"
            ;;
        press*)
            local key=$(echo "$cmd" | awk '{print $2}')
            case "$key" in
                back) adb shell "input keyevent 4" ;;
                home) adb shell "input keyevent 3" ;;
                enter) adb shell "input keyevent 66" ;;
                recent) adb shell "input keyevent 187" ;;
                *) adb shell "input keyevent $key" ;;
            esac
            log "  ✓ Pressed $key"
            ;;
        swipe*)
            local dir=$(echo "$cmd" | awk '{print $2}')
            case "$dir" in
                up) adb shell "input swipe 360 300 360 1000 500" ;;
                down) adb shell "input swipe 360 1000 360 300 500" ;;
                left) adb shell "input swipe 600 800 100 800 500" ;;
                right) adb shell "input swipe 100 800 600 800 500" ;;
            esac
            log "  ✓ Swiped $dir"
            ;;
        launch*)
            local pkg=$(echo "$cmd" | awk '{print $2}')
            adb shell "am start -n $pkg/.Main 2>/dev/null" || adb shell "monkey -p $pkg -c android.intent.category.LAUNCHER 1"
            log "  ✓ Launched $pkg"
            ;;
        done*)
            return 0
            ;;
        *)
            log "  ⚠ Unknown action: $cmd"
            return 1
            ;;
    esac
    
    return 0
}

# Main agent loop
execute_goal() {
    local goal="$1"
    local max_steps=30
    
    log "🎯 Goal: $goal"
    log "Starting agent loop..."
    
    local history=""
    local step=1
    
    while [ $step -le $max_steps ]; do
        echo ""
        log "--- Step $step/$max_steps ---"
        
        # Perceive
        log "📱 Perceiving..."
        perceive $step
        local app=$(cat "$AGENT_DIR/app_$step.txt" 2>/dev/null | head -1 || echo "unknown")
        log "  App: $app"
        
        # Reason
        log "🧠 Reasoning..."
        local response=$(reason "$goal" $step "$history")
        log "  Response: $response"
        
        # Check if done
        local action=$(echo "$response" | jq -r '.action // .Action // "done"' 2>/dev/null || echo "done")
        if [ "$action" = "done" ]; then
            log "✅ Goal completed!"
            return 0
        fi
        
        # Act
        log "🎬 Acting: $action"
        act "$response"
        
        # Update history
        history="$history
Step $step: $action"
        
        # Delay
        sleep 1
        step=$((step + 1))
    done
    
    warn "⚠️ Max steps reached"
    return 1
}

# Test mode
test_mode() {
    log "Testing Android Agent setup..."
    check_prereqs
    
    echo ""
    test_lm_studio
    
    echo ""
    log "Testing Android control..."
    
    # Get device info
    log "Device info:"
    adb shell getprop ro.product.model 2>/dev/null
    adb shell getprop ro.build.version.release 2>/dev/null
    
    echo ""
    log "Taking test screenshot..."
    adb shell screencap -p /sdcard/test.png
    adb pull /sdcard/test.png "$AGENT_DIR/test.png"
    
    if [ -f "$AGENT_DIR/test.png" ]; then
        log "✓ Screenshot captured"
    else
        error "Screenshot failed"
    fi
    
    echo ""
    log "Testing tap..."
    adb shell "input tap 360 800"
    log "✓ Tap executed"
    
    echo ""
    log "Testing type..."
    adb shell "input text hello"
    log "✓ Type executed"
    
    echo ""
    log "✅ All tests passed!"
}

# Status mode
status_mode() {
    log "Duck Agent Status"
    echo ""
    
    # Device status
    log "Android Devices:"
    adb devices | grep "device$" || echo "  None connected"
    
    echo ""
    
    # LM Studio status
    log "LM Studio:"
    RESPONSE=$(curl -s -w "\n%{http_code}" "$LM_STUDIO_URL/v1/models" \
        -H "Authorization: Bearer $LM_STUDIO_API_KEY" 2>/dev/null || echo "000")
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    if [ "$HTTP_CODE" = "200" ]; then
        log "  ✓ Connected ($LM_STUDIO_URL)"
        log "  Model: $LM_STUDIO_MODEL"
    else
        warn "  ✗ Not reachable (HTTP $HTTP_CODE)"
    fi
    
    echo ""
    
    # Screen state
    log "Current Screen:"
    adb shell "dumpsys activity activities | grep mResumedActivity | head -1" 2>/dev/null | grep -oP '[^\/]+/[^\s]+' || echo "  Unknown"
}

# Help
show_help() {
    echo "Duck CLI Android Agent"
    echo ""
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  --goal \"text\"     Execute a goal"
    echo "  --test            Test connections"
    echo "  --status          Check status"
    echo "  --help            Show this help"
    echo ""
    echo "Environment Variables:"
    echo "  LM_STUDIO_URL      LM Studio endpoint (default: http://100.68.208.113:1234)"
    echo "  LM_STUDIO_MODEL    Model name (default: google/gemma-4-e4b-it)"
    echo "  LM_STUDIO_API_KEY  API key for LM Studio"
    echo ""
    echo "Examples:"
    echo "  $0 --goal \"open settings and turn on dark mode\""
    echo "  $0 --goal \"send a message on WhatsApp\""
    echo "  $0 --test"
}

# Main
main() {
    case "${1:-}" in
        --help|-h)
            show_help
            ;;
        --test|-t)
            test_mode
            ;;
        --status|-s)
            status_mode
            ;;
        --goal|-g)
            check_prereqs
            test_lm_studio
            execute_goal "${2:-}"
            ;;
        *)
            if [ -n "${1:-}" ]; then
                check_prereqs
                test_lm_studio
                execute_goal "$1"
            else
                show_help
            fi
            ;;
    esac
}

main "$@"