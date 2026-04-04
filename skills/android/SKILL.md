# Android Automation Skill for Duck CLI

## Overview
This skill provides comprehensive Android device automation through Duck CLI's `duck android` commands. It enables control of Android devices connected via ADB (USB or WiFi).

## Prerequisites
- Android device with USB debugging enabled
- ADB installed (android-tools on Linux, comes with Android SDK)
- Device connected: `adb devices` should show your device

## Connection Setup

### WiFi ADB (No USB Cable)
```bash
# Connect device via USB first, then:
adb tcpip 5555
adb connect <device-ip>:5555

# Find device IP:
# Settings > About Phone > Status > IP Address
# Or: adb shell ip route
```

### Verify Connection
```bash
duck android devices
```

## Core Commands

### Device Info
```bash
duck android info                    # Full device info
duck android battery                # Battery status
duck android info --serial <serial> # Specific device
```

### Screen Operations
```bash
duck android screenshot                    # Capture screen
duck android screen                       # Read all text (OCR)
duck android dump                          # UI hierarchy XML
duck android dump <package>                # Filter by package
```

### Interactions
```bash
duck android tap <x> <y>                 # Tap coordinates
duck android swipe up|down|left|right    # Swipe gesture
duck android type "text"                   # Type text
duck android key enter|back|home|recent   # Press key
```

### App Management
```bash
duck android launch <package>             # Launch app
duck android kill <package>                # Force stop app
duck android foreground                    # Current app
duck android packages                      # List packages
duck android install <apk-path>            # Install APK
```

### Termux Integration
```bash
duck android termux battery               # Termux battery API
duck android termux clip-get             # Get clipboard
duck android termux clip-set "text"       # Set clipboard
duck android termux notif                 # Notifications
duck android termux sensors              # Sensor data
duck android termux location             # GPS location
```

### File Operations
```bash
duck android push <local> <remote>       # Push file to device
duck android pull <remote> <local>        # Pull file from device
```

### Shell Access
```bash
duck android shell <command>             # Run shell command
duck android shell "pm list packages"    # List all packages
duck android shell "getprop ro.build"    # Get system properties
```

## Workflow Examples

### Send SMS Message
```bash
# 1. Open Messages app
duck android launch com.google.android.apps.messaging

# 2. Wait for app to load
sleep 2

# 3. Start new message (tap compose)
duck android tap 360 1200

# 4. Type phone number
duck android type "9372425637"

# 5. Tap send button (find coords via dump)
duck android tap 650 200

# 6. Type message
duck android type "Hello from Duck CLI!"

# 7. Send
duck android press enter
```

### Take Screenshot and Analyze
```bash
# Capture
duck android screenshot /tmp/screen.png

# Analyze with AI (via duck analyze)
duck android analyze

# Or use screen text extraction
duck android screen
```

### Automate App Installation
```bash
# Push APK to device
duck android push /path/to/app.apk /sdcard/Download/app.apk

# Install
duck android install /sdcard/Download/app.apk

# Launch
duck android launch com.example.app
```

### Monitor Device State
```bash
# Check battery
duck android battery

# Check foreground app
duck android foreground

# Get notifications
duck android notifications

# Get system info
duck android info
```

### Device Troubleshooting
```bash
# UI inspection
duck android dump > ui.xml

# Find element position
duck android dump com.example.app | grep "button"

# Screen text for debugging
duck android screen

# Full system info
duck android info
```

## Automation Patterns

### Wait for Element Pattern
```bash
# Poll until text appears
for i in {1..10}; do
  if duck android screen | grep -q "Target Text"; then
    echo "Found!"
    duck android tap <x> <y>
    break
  fi
  sleep 1
done
```

### Scroll to Find Pattern
```bash
# Try scrolling to find content
for i in {1..5}; do
  if duck android screen | grep -q "Search Item"; then
    # Found! Tap it
    duck android find <element-id>
    break
  fi
  # Scroll down
  duck android swipe down
  sleep 1
done
```

### Form Fill Pattern
```bash
# Open app
duck android launch com.example.form

# Wait for load
sleep 2

# Fill field 1
duck android tap <field1_x> <field1_y>
duck android type "Value 1"

# Fill field 2
duck android tap <field2_x> <field2_y>
duck android type "Value 2"

# Submit
duck android tap <submit_x> <submit_y>
duck android press enter
```

## Use Cases

### Phone as AI Agent (Vision + Actions)
```bash
# Full vision analysis
duck android screenshot
duck android analyze

# Take photo
duck android termux camera-screenshot

# Control camera app
duck android launch com.motorola.camera
duck android tap <shutter_x> <shutter_y>
```

### Grow Monitoring (Plant Automation)
```bash
# Take grow tent photo
duck android launch com.motorola.camera5
sleep 2
duck android tap 360 1353  # Shutter button

# View photo
duck android launch com.google.android.apps.photos

# Send to AI analysis
duck android analyze
```

### Remote Device Control
```bash
# From anywhere with ADB over network
adb connect <phone-ip>:5555

# Full control
duck android devices
duck android info
duck android screenshot
duck android shell "ps aux"
```

## Troubleshooting

### Device Not Found
```bash
# Restart ADB server
adb kill-server
adb start-server
adb devices
```

### Tap Not Working
```bash
# Get current screen coordinates
duck android dump > /tmp/ui.xml

# Find element bounds
grep "text=\"Target\"" /tmp/ui.xml
# Look for bounds="[x1,y1][x2,y2]"
# Tap center: x=((x1+x2)/2), y=((y1+y2)/2)
```

### App Won't Launch
```bash
# Check if package exists
duck android shell "pm list packages | grep <package>"

# Force stop first
duck android kill <package>
duck android launch <package>
```

### Permissions Issues
```bash
# Grant permissions via shell
duck android shell "pm grant <package> <permission>"
# Example:
duck android shell "pm grant com.example.app android.permission.CAMERA"
```

## Best Practices

1. **Get UI coordinates first**: Always use `duck android dump` to find element positions
2. **Add delays**: Use `sleep` between actions for app transitions
3. **Check state**: Verify actions with `duck android screen` or `duck android foreground`
4. **Handle errors**: Check return values and retry logic
5. **Log actions**: Record coordinates and sequences for debugging

## Tips & Tricks

### Quick Element Finding
```bash
# Find button by text
grep "button\|Button" <(duck android dump)

# Find by content description
grep "content-desc=" <(duck android dump)
```

### Batch Operations
```bash
# Install multiple APKs
for apk in /path/to/apks/*.apk; do
  duck android push "$apk" /sdcard/Download/
  duck android install "/sdcard/Download/$(basename $apk)"
done
```

### Backup & Restore
```bash
# Pull all photos
duck android shell "ls /sdcard/DCIM/Camera/"
duck android pull /sdcard/DCIM/Camera/*.jpg ./backup/

# Restore
duck android push ./restore/*.jpg /sdcard/DCIM/Camera/
```

## Related Skills

- `android-vision` - AI-powered screen analysis
- `android-sensor` - Sensor data collection
- `android-automation` - Complex workflow automation

## Meta
- Version: 1.0.0
- Author: Duck CLI Team
- Purpose: Comprehensive Android device control
