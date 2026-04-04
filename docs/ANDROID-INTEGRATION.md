# Duck CLI Android Integration

Comprehensive Android device control and automation through duck-cli.

## Quick Start

### Connect Device
```bash
# Via USB (enable USB debugging in Developer Options)
adb devices

# Via WiFi (after enabling TCPIP mode)
adb tcpip 5555
adb connect <device-ip>:5555

# Verify
duck android devices
```

### Basic Commands
```bash
# Device info
duck android info              # Full info
duck android battery           # Battery status

# Screen operations
duck android screenshot       # Capture screenshot
duck android screen            # Read text (OCR)
duck android analyze           # AI analysis
duck android dump              # UI hierarchy

# Interactions
duck android tap 360 720      # Tap coordinates
duck android swipe up           # Swipe
duck android type "hello"      # Type text
duck android key enter          # Press key

# Apps
duck android launch com.example.app
duck android kill com.example.app
duck android foreground       # Current app
duck android packages          # List apps
```

## Architecture

```
┌─────────────────┐     ┌─────────────────┐
│   Duck CLI      │────▶│  Android Device │
│   (Mac/Linux)   │ ADB │  (Phone/Tablet) │
└─────────────────┘     └─────────────────┘
        │
        └──► duck android <command>
                │
                ├──► ADB Shell
                ├──► Android UIAutomator
                └──► Termux API
```

## Installation

### Prerequisites
- duck-cli installed: `npm install -g duck-cli`
- ADB installed: `brew install android-platform-tools` (macOS)
- Android device with USB debugging enabled

### Enable ADB
1. Go to Settings > About Phone
2. Tap "Build Number" 7 times
3. Back to Settings > System > Developer Options
4. Enable USB Debugging
5. Connect device and approve RSA key

### WiFi ADB Setup
```bash
# Enable TCPIP on device
adb tcpip 5555

# Find device IP
adb shell ip route | grep wlan

# Connect
adb connect <device-ip>:5555

# Verify
duck android devices
```

## Tools & Skills

### Tools (`src/tools/android/`)
- `android-automation.ts` - 25+ automation tools
- `android-vision.ts` - AI screen analysis

### Skills (`skills/android/`)
- `SKILL.md` - Complete usage guide

### Scripts (`tools/`)
- `android-workflow.py` - Python automation
- `android-helpers.sh` - Shell wrappers

## Workflow Examples

### Send SMS
```bash
# Open messages
duck android launch com.google.android.apps.messaging
sleep 2

# Start new conversation
duck android tap 360 1200
sleep 1

# Type number
duck android type "9372425637"
sleep 1

# Send
duck android key enter
sleep 1

# Type message
duck android type "Hello from Duck CLI!"
duck android key enter
```

### Take & Analyze Screenshot
```bash
# Capture
duck android screenshot /tmp/screen.png

# AI analysis
duck android analyze

# Read text
duck android screen
```

### Grow Monitoring
```python
from android-workflow import GrowMonitorWorkflow

grow = GrowMonitorWorkflow()
photo = grow.capture_grow_photo()
analysis = grow.analyze_grow_health()
print(analysis)
```

### App Automation
```bash
# Find element and tap
ELEMENT=$(duck android dump | grep "Button Text")
# Parse coordinates from XML
X=360
Y=720
duck android tap $X $Y
```

## Termux Integration

```bash
# Battery info
duck android termux battery

# Clipboard
duck android termux clip-get
duck android termux clip-set "Hello"

# Notifications
duck android termux notif

# Location
duck android termux location

# Sensors
duck android termux sensors
```

## Advanced Usage

### UI Element Discovery
```bash
# Get full hierarchy
duck android dump > ui.xml

# Filter by package
duck android dump com.example.app > ui.xml

# Find clickable elements
grep 'clickable="true"' ui.xml

# Find by text
grep 'text="Login"' ui.xml
```

### Coordinate Finding
```python
from android-workflow import AndroidWorkflow

wf = AndroidWorkflow()
element = wf.find_element("Submit")
if element:
    wf.tap(element.x, element.y)
```

### Wait Patterns
```bash
# Poll for element
for i in {1..10}; do
    if duck android screen | grep -q "Target Text"; then
        echo "Found!"
        break
    fi
    sleep 1
done
```

## Vision AI Integration

```bash
# Full analysis
duck android analyze

# The analyze command:
# 1. Captures screenshot
# 2. Dumps UI hierarchy
# 3. Reads all text
# 4. Sends to AI model (kimi-k2.5)
# 5. Returns analysis + recommendations
```

## Troubleshooting

### Device Not Found
```bash
# Restart ADB
adb kill-server
adb start-server
duck android devices
```

### Tap Misses
```bash
# Dump UI to find correct coordinates
duck android dump > /tmp/ui.xml
grep "text=\"Target\"" /tmp/ui.xml
# Extract bounds and calculate center
```

### App Won't Launch
```bash
# Check package exists
duck android shell "pm list packages | grep example"

# Force stop first
duck android kill com.example.app
duck android launch com.example.app
```

## File Transfer

```bash
# Push to device
duck android push ./file.apk /sdcard/Download/

# Pull from device
duck android pull /sdcard/DCIM/Camera/photo.jpg ./

# Shell alternatives
duck android shell "cp /sdcard/file.mp4 /sdcard/Download/"
```

## Automation Scripts

### Python Workflow
```python
#!/usr/bin/env python3
from android_workflow import AndroidWorkflow

wf = AndroidWorkflow()

# Launch app
wf.launch_app("com.example.app")
wf.wait_for_screen("Loading...")

# Fill form
wf.tap(100, 200)  # First field
wf.type_text("Value 1")

wf.tap(100, 300)  # Second field
wf.type_text("Value 2")

# Submit
wf.find_and_tap("Submit")
```

### Shell Script
```bash
#!/bin/bash
# automate.sh - Example automation

set -e

echo "Starting automation..."

# Launch app
duck android launch com.example.app
sleep 3

# Wait for load
until duck android screen | grep -q "Ready"; do
    echo "Waiting..."
    sleep 1
done

# Take action
duck android tap 360 720
duck android type "Automated!"
duck android key enter

echo "Done!"
```

## Tips & Tricks

1. **Use `dump` first**: Always dump UI to find element positions
2. **Add delays**: Use `sleep` for app transitions
3. **Check state**: Verify with `screen` or `foreground`
4. **Handle errors**: Check return values
5. **Log actions**: Record coordinates and sequences

## Development

### Add New Tools
Edit `src/tools/android/android-automation.ts`:
```typescript
{
  name: 'android_new_tool',
  description: 'Description',
  schema: { ... },
  handler: async (args) => { ... }
}
```

### Test Locally
```bash
cd /tmp/duck-cli-main
npm run build
duck android devices
```

## Related

- [DroidClaw](https://github.com/unitedbyai/droidclaw) - AI Android automation
- [OpenClaw Nodes](https://docs.openclaw.ai/nodes) - Mobile node integration
- [Android Debug Bridge](https://developer.android.com/studio/command-line/adb)
