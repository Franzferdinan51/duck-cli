#!/bin/bash
# Duck CLI Android Agent - Shell Version
# Runs on phone via Termux, connects to Mac for LLM
#
# Usage:
#   ./android-agent.sh "your goal"
#   ./android-agent.sh --workflow workflow.json
#   ./android-agent.sh --mode interactive
#
# Requires:
#   - ADB connection to phone (from Mac or directly)
#   - LLM endpoint (Mac's LM Studio or cloud API)

set -e

# Configuration
DEVICE_SERIAL="${DEVICE_SERIAL:-}"
MAX_STEPS=30
STEP_DELAY=0.5
LLM_PROVIDER="${LLM_PROVIDER:-lmstudio}"
LLM_MODEL="${LLM_MODEL:-qwen3.5-9b}"
LLM_API_KEY="${LLM_API_KEY:-}"
LLM_BASE_URL="${LLM_BASE_URL:-http://192.168.1.81:1234}"
AGENT_DIR="${AGENT_DIR:-/sdcard/Download/duck-agent}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging
log() { echo -e "${GREEN}[Agent]${NC} $1"; }
warn() { echo -e "${YELLOW}[Agent]${NC} $1"; }
error() { echo -e "${RED}[Agent]${NC} $1"; }

# ADB helper
adb_cmd() {
    if [ -n "$DEVICE_SERIAL" ]; then
        adb -s "$DEVICE_SERIAL" "$@"
    else
        adb "$@"
    fi
}

# Initialize
init() {
    log "🦆 Duck CLI Android Agent initializing..."
    
    # Create agent directory
    adb_cmd shell "mkdir -p $AGENT_DIR"
    
    # Check device connection
    if ! adb_cmd shell "echo connected" > /dev/null 2>&1; then
        error "No Android device connected!"
        exit 1
    fi
    
    log "✓ Device connected"
}

# Perceive: Get current screen state
perceive() {
    local step=$1
    
    # Capture screenshot
    adb_cmd shell "screencap -p /sdcard/screen.png" 2>/dev/null || true
    
    # Dump UI hierarchy
    adb_cmd shell "uiautomator dump /sdcard/ui.xml" 2>/dev/null || true
    
    # Pull files to phone's download
    adb_cmd pull "/sdcard/screen.png" "$AGENT_DIR/screen_$step.png" 2>/dev/null || true
    adb_cmd pull "/sdcard/ui.xml" "$AGENT_DIR/ui_$step.xml" 2>/dev/null || true
    
    # Get screen text
    local text=$(adb_cmd shell "getevent -tc 3 2>/dev/null" | head -5 || echo "")
    
    # Get foreground app
    local app=$(adb_cmd shell "dumpsys activity activities | grep mResumedActivity | head -1 | grep -oP '\{[^}]+\}'" 2>/dev/null | grep -oP '[^\/]+/[^\s]+' || echo "unknown")
    
    echo "$app"
}

# Reason: Call LLM to decide action
reason() {
    local goal="$1"
    local screen_info="$2"
    local history="$3"
    
    # Build prompt
    local prompt="You are an Android automation agent.
Goal: $goal

Current screen: $screen_info
History: $history

Based on this, what should the agent do next?

Respond with ONE action in this format:
ACTION: tap X Y
ACTION: type TEXT
ACTION: press KEY
ACTION: swipe DIRECTION
ACTION: launch PACKAGE
ACTION: done

Example:
ACTION: tap 360 720
ACTION: type Hello World
ACTION: press back
ACTION: launch com.whatsapp
ACTION: done"

    # Call LLM based on provider
    case "$LLM_PROVIDER" in
        lmstudio)
            call_lmstudio "$prompt"
            ;;
        ollama)
            call_ollama "$prompt"
            ;;
        openai)
            call_openai "$prompt"
            ;;
        groq)
            call_groq "$prompt"
            ;;
        *)
            error "Unknown LLM provider: $LLM_PROVIDER"
            exit 1
            ;;
    esac
}

# Call LM Studio
call_lmstudio() {
    local prompt="$1"
    curl -s "$LLM_BASE_URL/v1/chat/completions" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $LLM_API_KEY" \
        -d "{
            \"model\": \"$LLM_MODEL\",
            \"messages\": [{\"role\": \"user\", \"content\": \"$prompt\"}],
            \"max_tokens\": 100
        }" | grep -oP '"content":"\K[^"]+' | head -1
}

# Call Ollama
call_ollama() {
    local prompt="$1"
    curl -s "$LLM_BASE_URL/api/chat" \
        -H "Content-Type: application/json" \
        -d "{
            \"model\": \"$LLM_MODEL\",
            \"messages\": [{\"role\": \"user\", \"content\": \"$prompt\"}],
            \"stream\": false
        }" | grep -oP '"content":"\K[^"]+' | head -1
}

# Call OpenAI
call_openai() {
    local prompt="$1"
    curl -s "https://api.openai.com/v1/chat/completions" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $LLM_API_KEY" \
        -d "{
            \"model\": \"$LLM_MODEL\",
            \"messages\": [{\"role\": \"user\", \"content\": \"$prompt\"}]
        }" | grep -oP '"content":"\K[^"]+' | head -1
}

# Call Groq
call_groq() {
    local prompt="$1"
    curl -s "https://api.groq.com/openai/v1/chat/completions" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $LLM_API_KEY" \
        -d "{
            \"model\": \"$LLM_MODEL\",
            \"messages\": [{\"role\": \"user\", \"content\": \"$prompt\"}]
        }" | grep -oP '"content":"\K[^"]+' | head -1
}

# Act: Execute the action
act() {
    local action="$1"
    
    local cmd=$(echo "$action" | awk '{print $1}')
    local args=$(echo "$action" | awk '{$1=""; print $0}' | xargs)
    
    case "$cmd" in
        tap)
            local coords=($args)
            adb_cmd shell "input tap ${coords[0]} ${coords[1]}"
            echo "Tapped (${coords[0]}, ${coords[1]})"
            ;;
        type)
            adb_cmd shell "input text \"$args\""
            echo "Typed: $args"
            ;;
        press)
            case "$args" in
                back) adb_cmd shell "input keyevent 4" ;;
                home) adb_cmd shell "input keyevent 3" ;;
                enter) adb_cmd shell "input keyevent 66" ;;
                recent) adb_cmd shell "input keyevent 187" ;;
                power) adb_cmd shell "input keyevent 26" ;;
                *) adb_cmd shell "input keyevent $args" ;;
            esac
            echo "Pressed: $args"
            ;;
        swipe)
            local dir=$args
            case "$dir" in
                up) adb_cmd shell "input swipe 360 1000 360 300 500" ;;
                down) adb_cmd shell "input swipe 360 300 360 1000 500" ;;
                left) adb_cmd shell "input swipe 600 800 100 800 500" ;;
                right) adb_cmd shell "input swipe 100 800 600 800 500" ;;
            esac
            echo "Swiped: $dir"
            ;;
        launch)
            adb_cmd shell "am start -n $args"
            echo "Launched: $args"
            ;;
        done)
            return 0
            ;;
        *)
            warn "Unknown action: $cmd"
            return 1
            ;;
    esac
    
    return 0
}

# Detect stuck loop
is_stuck() {
    local history="$1"
    local last_tap=$(echo "$history" | grep "Tapped" | tail -1 || echo "")
    
    # Check if last 3 taps are at same coordinates
    local count=$(echo "$history" | grep -c "$last_tap" || echo 0)
    if [ "$count" -ge 3 ]; then
        return 0
    fi
    return 1
}

# Main execution loop
execute_goal() {
    local goal="$1"
    local step=1
    local history=""
    
    log "🎯 Goal: $goal"
    log "Starting execution loop..."
    
    while [ $step -le $MAX_STEPS ]; do
        echo ""
        log "--- Step $step/$MAX_STEPS ---"
        
        # Perceive
        log "📱 Perceiving screen..."
        local screen_info=$(perceive $step)
        log "   Foreground: $screen_info"
        
        # Reason
        log "🧠 Reasoning..."
        local action=$(reason "$goal" "$screen_info" "$history")
        action=$(echo "$action" | sed 's/ACTION: //' | xargs)
        
        if [ -z "$action" ]; then
            warn "No action received from LLM, trying fallback"
            action="done"
        fi
        
        log "   Action: $action"
        
        # Check for done
        if [[ "$action" == "done"* ]]; then
            log "✅ Goal completed!"
            return 0
        fi
        
        # Act
        log "🎬 Acting..."
        act "$action"
        history="$history\nStep $step: $action"
        
        # Check for stuck loop
        if is_stuck "$history"; then
            warn "⚠️ Stuck loop detected, injecting recovery"
            history="$history\n[RECOVERY: Try different approach]"
        fi
        
        # Delay
        sleep $STEP_DELAY
        step=$((step + 1))
    done
    
    warn "⚠️ Max steps reached, goal not completed"
    return 1
}

# Interactive mode
interactive_mode() {
    log "🖥️ Interactive Mode - type 'exit' to quit"
    
    while true; do
        echo -n -e "${BLUE}>${NC} "
        read -r goal
        
        [ "$goal" = "exit" ] && break
        [ -z "$goal" ] && continue
        
        execute_goal "$goal"
    done
}

# Main
main() {
    case "${1:-}" in
        --help|-h)
            echo "Duck CLI Android Agent"
            echo ""
            echo "Usage: android-agent.sh [command] [args]"
            echo ""
            echo "Commands:"
            echo "  <goal>              Execute a goal"
            echo "  --interactive, -i   Interactive mode"
            echo "  --workflow <file>   Run workflow file"
            echo "  --help, -h          Show this help"
            echo ""
            echo "Environment Variables:"
            echo "  LLM_PROVIDER        lmstudio, ollama, openai, groq"
            echo "  LLM_MODEL           Model name"
            echo "  LLM_BASE_URL        API endpoint URL"
            echo "  LLM_API_KEY         API key (for cloud providers)"
            echo "  DEVICE_SERIAL       ADB device serial"
            echo "  MAX_STEPS           Max steps per goal (default: 30)"
            echo ""
            ;;
        --interactive|-i)
            init
            interactive_mode
            ;;
        --workflow)
            [ -z "$2" ] && error "Workflow file required" && exit 1
            init
            log "Workflow mode not yet implemented"
            # TODO: Parse JSON workflow and execute steps
            ;;
        "")
            error "No goal specified. Use --help for usage."
            exit 1
            ;;
        *)
            init
            execute_goal "$1"
            ;;
    esac
}

main "$@"