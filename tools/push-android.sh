#!/bin/bash
# Push duck-android binary to Android device
# Usage: ./push-android.sh [device-serial]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BINARY="$ROOT_DIR/duck-android"
REMOTE_PATH="/data/local/tmp/duck"
DEST_DIR="/data/local/tmp"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

usage() {
    echo -e "${BOLD}🦆 Push duck-android to Android device${RESET}"
    echo ""
    echo "Usage: $0 [device-serial]"
    echo ""
    echo "Arguments:"
    echo "  device-serial    Optional ADB device serial"
    echo ""
    echo "Example:"
    echo "  $0                          # Push to first connected device"
    echo "  $0 192.168.1.251:41771      # Push to specific device"
    exit 1
}

# Check for --help or -h
if [[ "${1:-}" == "--help" ]] || [[ "${1:-}" == "-h" ]]; then
    usage
fi

DEVICE="${1:-}"
ADB_CMD="adb"

if [[ -n "$DEVICE" ]]; then
    ADB_CMD="adb -s $DEVICE"
fi

echo -e "${CYAN}╔══════════════════════════════════════════╗${RESET}"
echo -e "${CYAN}║${RESET}  ${BOLD}🦆 Push duck-android to Android${RESET}      ${CYAN}║${RESET}"
echo -e "${CYAN}╚══════════════════════════════════════════╝${RESET}"
echo ""

# Check binary exists
if [[ ! -f "$BINARY" ]]; then
    echo -e "${RED}✗ Error: duck-android binary not found at:${RESET}"
    echo "  $BINARY"
    echo ""
    echo -e "${YELLOW}Hint: Build it with 'npm run build:android' or 'go build -o duck-android ./cmd/duck-android/'${RESET}"
    exit 1
fi

BINARY_SIZE=$(du -h "$BINARY" | cut -f1)
echo -e "${BOLD}Binary:${RESET} $BINARY (${BINARY_SIZE})"
echo -e "${BOLD}Target:${RESET} ${DEVICE:-first connected device}"
echo ""

# Check ADB connection
echo -e "${CYAN}→ Checking ADB connection...${RESET}"
if ! $ADB_CMD shell echo "OK" > /dev/null 2>&1; then
    echo -e "${RED}✗ Error: Cannot connect to device via ADB${RESET}"
    echo "  Make sure USB debugging is enabled and the device is connected."
    exit 1
fi
echo -e "${GREEN}✓${RESET} Device connected"

# Check if already running
echo -e "${CYAN}→ Checking for existing duck process...${RESET}"
if $ADB_CMD shell "[ -f $REMOTE_PATH ]" 2>/dev/null; then
    echo -e "${YELLOW}! Warning: Existing duck binary found at $REMOTE_PATH${RESET}"
    echo -e "${CYAN}→ Killing existing duck process...${RESET}"
    $ADB_CMD shell "pkill -f duck || true" 2>/dev/null || true
fi

# Ensure destination directory exists
echo -e "${CYAN}→ Creating destination directory...${RESET}"
$ADB_CMD shell "mkdir -p $DEST_DIR" 2>/dev/null

# Push the binary
echo -e "${CYAN}→ Pushing duck-android to $REMOTE_PATH...${RESET}"
if $ADB_CMD push "$BINARY" "$REMOTE_PATH" 2>&1; then
    echo -e "${GREEN}✓${RESET} Binary pushed successfully"
else
    echo -e "${RED}✗ Failed to push binary${RESET}"
    exit 1
fi

# Make executable
echo -e "${CYAN}→ Setting executable permission...${RESET}"
if $ADB_CMD shell "chmod 755 $REMOTE_PATH" 2>&1; then
    echo -e "${GREEN}✓${RESET} Permissions set"
else
    echo -e "${RED}✗ Failed to set permissions${RESET}"
    exit 1
fi

# Verify
echo -e "${CYAN}→ Verifying installation...${RESET}"
REMOTE_SIZE=$($ADB_CMD shell "stat -c%s $REMOTE_PATH 2>/dev/null || stat -f%z $REMOTE_PATH 2>/dev/null" 2>/dev/null | tr -d '\r\n')
LOCAL_SIZE=$(stat -c%s "$BINARY" 2>/dev/null || stat -f%z "$BINARY" 2>/dev/null)
echo -e "${GREEN}✓${RESET} Remote size: ${REMOTE_SIZE} bytes"
echo -e "${GREEN}✓${RESET} Local size:  ${LOCAL_SIZE} bytes"

if [[ "$REMOTE_SIZE" == "$LOCAL_SIZE" ]]; then
    echo -e "${GREEN}✓${RESET} Size matches!"
else
    echo -e "${YELLOW}⚠ Size mismatch - file may be corrupted${RESET}"
fi

echo ""
echo -e "${GREEN}✅ duck-android pushed successfully!${RESET}"
echo ""
echo "To run on the device:"
echo -e "  ${CYAN}adb shell $REMOTE_PATH --help${RESET}"
echo ""
echo "To forward a port and run:"
echo -e "  ${CYAN}duck android forward tcp:18789 tcp:18789${RESET}"
echo -e "  ${CYAN}adb shell $REMOTE_PATH${RESET}"
