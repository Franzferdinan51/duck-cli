#!/bin/bash
# Android Helper Scripts for Duck CLI
# Quick command wrappers for common Android operations

set -e

DEVICE=""
ANDROID_DIR="/tmp/duck-android"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

usage() {
    echo "Duck CLI Android Helper"
    echo ""
    echo "Usage: duck-android <command> [options]"
    echo ""
    echo "Commands:"
    echo "  devices                    List connected devices"
    echo "  info [serial]              Device information"
    echo "  screenshot [file]          Capture screenshot"
    echo "  screen                     Read screen text (OCR)"
    echo "  analyze                    AI screen analysis"
    echo "  dump [package]             UI hierarchy dump"
    echo "  tap <x> <y>                Tap at coordinates"
    echo "  swipe <dir> [dist]         Swipe gesture (up|down|left|right)"
    echo "  type <text>                Type text"
    echo "  key <key>                  Press key (enter|back|home|recent)"
    echo "  launch <package>           Launch app"
    echo "  kill <package>             Force stop app"
    echo "  foreground                 Current foreground app"
    echo "  battery                   Battery status"
    echo "  notifications              Recent notifications"
    echo "  packages [filter]         List packages"
    echo "  shell <cmd>                Run shell command"
    echo "  push <local> <remote>      Push file to device"
    echo "  pull <remote> <local>      Pull file from device"
    echo "  install <apk>               Install APK"
    echo ""
    echo "Options:"
    echo "  -d, --device <serial>      Target device serial"
    echo "  -h, --help                 Show this help"
    echo ""
    exit 1
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -d|--device)
            DEVICE="--device $2"
            shift 2
            ;;
        -h|--help)
            usage
            ;;
        *)
            CMD="$1"
            shift
            break
            ;;
    esac
done

# Ensure directory exists
mkdir -p "$ANDROID_DIR"

# Run duck android command
run() {
    duck android $CMD $DEVICE "$@"
}

# Commands
case "$CMD" in
    devices)
        run
        ;;
    info)
        run "${@:-}"
        ;;
    screenshot)
        FILE="${1:-$ANDROID_DIR/screenshot_$(date +%s).png}"
        run "$FILE"
        echo -e "${GREEN}Screenshot saved: $FILE${NC}"
        ;;
    screen)
        run
        ;;
    analyze)
        run
        ;;
    dump)
        run "${@:-}"
        ;;
    tap)
        if [ $# -lt 2 ]; then
            echo -e "${RED}Error: tap requires <x> <y>${NC}"
            exit 1
        fi
        run "$1" "$2"
        ;;
    swipe)
        DIR="${1:-down}"
        DIST="${2:-300}"
        run "$DIR" "$DIST"
        ;;
    type)
        if [ $# -lt 1 ]; then
            echo -e "${RED}Error: type requires <text>${NC}"
            exit 1
        fi
        run "$1"
        ;;
    key)
        if [ $# -lt 1 ]; then
            echo -e "${RED}Error: key requires <key>${NC}"
            exit 1
        fi
        run "$1"
        ;;
    launch)
        if [ $# -lt 1 ]; then
            echo -e "${RED}Error: launch requires <package>${NC}"
            exit 1
        fi
        run "$1"
        ;;
    kill)
        if [ $# -lt 1 ]; then
            echo -e "${RED}Error: kill requires <package>${NC}"
            exit 1
        fi
        run "$1"
        ;;
    foreground)
        run
        ;;
    battery)
        run
        ;;
    notifications)
        run
        ;;
    packages)
        run "${@:-}"
        ;;
    shell)
        if [ $# -lt 1 ]; then
            echo -e "${RED}Error: shell requires <command>${NC}"
            exit 1
        fi
        run "$1"
        ;;
    push)
        if [ $# -lt 2 ]; then
            echo -e "${RED}Error: push requires <local> <remote>${NC}"
            exit 1
        fi
        run "$1" "$2"
        ;;
    pull)
        if [ $# -lt 2 ]; then
            echo -e "${RED}Error: pull requires <remote> <local>${NC}"
            exit 1
        fi
        run "$1" "$2"
        ;;
    install)
        if [ $# -lt 1 ]; then
            echo -e "${RED}Error: install requires <apk>${NC}"
            exit 1
        fi
        run "$1"
        ;;
    termux)
        run "${@:-}"
        ;;
    "")
        echo -e "${RED}Error: No command specified${NC}"
        usage
        ;;
    *)
        echo -e "${RED}Error: Unknown command: $CMD${NC}"
        usage
        ;;
esac
