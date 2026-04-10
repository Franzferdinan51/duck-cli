#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   send_message.sh "Stephano" "message text"
# Opens Messages, searches the contact, types the message, and sends it.

RECIPIENT="${1:-}"
MESSAGE="${2:-}"

if [[ -z "$RECIPIENT" || -z "$MESSAGE" ]]; then
  echo "Usage: $0 <recipient> <message>" >&2
  exit 1
fi

open -a Messages
sleep 2

osascript <<APPLESCRIPT
 tell application "System Events"
   tell process "Messages"
     set frontmost to true
     keystroke "f" using command down
     delay 0.4
     keystroke "$RECIPIENT"
     delay 0.4
     key code 53
     delay 0.4
     keystroke tab
     keystroke tab
     keystroke tab
     keystroke tab
     keystroke tab
     keystroke tab
     keystroke tab
     keystroke tab
     keystroke tab
     keystroke tab
     keystroke tab
     keystroke tab
     delay 0.4
     keystroke "$MESSAGE"
     delay 0.4
     keystroke return
   end tell
 end tell
APPLESCRIPT
