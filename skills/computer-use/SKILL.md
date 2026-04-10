---
name: computer-use
description: "Full desktop computer control with vision-based UI understanding using UI-TARS models"
license: MIT
metadata:
  author: duck-cli
  version: "1.0"
---

# Computer Use Skill

**Purpose:** Full desktop computer control with vision-based UI understanding  
**Models:** `lmstudio/ui-tars-1.5-7b` or `lmstudio/ui-tars-7b-dpo` (FREE local)  
**Tools:** `tools/computer-use.sh` (scrot + xdotool integration)  
**Status:** ✅ OPERATIONAL (2026-02-26)

---

## 🎯 When to Use

Use this skill when you need to:
- Automate desktop tasks (browser, applications, UI navigation)
- Click buttons, type text, or navigate interfaces
- Analyze screens and take autonomous actions
- Control mouse and keyboard programmatically
- Perform visual UI automation tasks

**DO NOT use for:**
- Mobile/Android tasks (use `android-engineer` skill)
- Simple tasks that don't need vision (use direct tool calls)
- When browser tool is available (prefer browser tool for web)

---

## 🛠️ Spawn Sub-Agent

### Basic Usage:
```bash
sessions_spawn \
  --task "Use computer-use skill to [describe task]" \
  --model lmstudio/ui-tars-1.5-7b \
  --label "computer-use-$(date +%s)"
```

### Examples:

```bash
# Open a website
sessions_spawn \
  --task "Use computer-use skill to open Chrome and navigate to google.com" \
  --model lmstudio/ui-tars-1.5-7b

# Click a button
sessions_spawn \
  --task "Use computer-use skill to click the settings button" \
  --model lmstudio/ui-tars-1.5-7b

# Type text
sessions_spawn \
  --task "Use computer-use skill to type 'Hello World' in the active window" \
  --model lmstudio/ui-tars-1.5-7b

# Complex workflow
sessions_spawn \
  --task "Use computer-use skill to open Chrome, go to gmail.com, and check inbox" \
  --model lmstudio/ui-tars-1.5-7b
```

---

## 🔧 Available Actions

The skill provides these capabilities via `tools/computer-use.sh`:

| Action | Description | Example |
|--------|-------------|---------|
| **analyze** | Capture + analyze screen with UI-TARS | Identify UI elements |
| **auto** | Vision-guided autonomous action | "Click settings" |
| **click** | Click at coordinates | `click 500 300` |
| **type** | Type text | `type "Hello"` |
| **press** | Press a key | `press Enter` |
| **move** | Move mouse | `move 100 200` |

---

## 📋 Workflow

```
┌─────────────────────────────────────────────────────────┐
│  1. CAPTURE SCREEN                                      │
│     → scrot saves screenshot to screenshots/ directory │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  2. ANALYZE WITH UI-TARS                                │
│     → Vision model identifies UI elements               │
│     → Returns: screen description + suggested actions   │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  3. PLAN ACTION                                         │
│     → Parse UI-TARS response                            │
│     → Extract coordinates or action type                │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  4. EXECUTE                                             │
│     → xdotool performs mouse/keyboard action            │
│     → click, type, press, or move                       │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│  5. VERIFY (Optional)                                   │
│     → Capture follow-up screenshot                      │
│     → Confirm action succeeded                          │
└─────────────────────────────────────────────────────────┘
```

---

## 🎯 Example Task Flows

### Task: "Open Chrome and go to Google"

```bash
# Step 1: Spawn sub-agent
sessions_spawn \
  --task "Use computer-use skill to open Chrome and navigate to google.com" \
  --model lmstudio/ui-tars-1.5-7b

# What the sub-agent does:
# 1. Analyze screen to find Chrome icon or running Chrome window
# 2. Click Chrome icon (if not open) or focus window
# 3. Click address bar
# 4. Type "google.com"
# 5. Press Enter
# 6. Verify Google loaded
```

### Task: "Close the current window"

```bash
sessions_spawn \
  --task "Use computer-use skill to close the current window" \
  --model lmstudio/ui-tars-1.5-7b

# Sub-agent:
# 1. Analyze screen to find window controls
# 2. Locate close button (typically top-right X)
# 3. Click close button
# 4. Verify window closed
```

### Task: "Type 'Hello World' in the active text field"

```bash
sessions_spawn \
  --task "Use computer-use skill to type 'Hello World'" \
  --model lmstudio/ui-tars-1.5-7b

# Sub-agent:
# 1. Analyze screen to identify active text field
# 2. Click to focus if needed
# 3. Type "Hello World"
# 4. Verify text appeared
```

---

## ⚙️ Configuration

### Required:
- **LM Studio:** Running on `http://100.116.54.125:1234`
- **UI-TARS Models:** `ui-tars-1.5-7b` or `ui-tars-7b-dpo` loaded
- **X11 Display:** Active X Window session (not Wayland)
- **Tools:** `scrot`, `xdotool` installed

### Paths:
- **Skill:** `/Users/duckets/.openclaw/workspace/skills/computer-use/SKILL.md`
- **Tool:** `/Users/duckets/.openclaw/workspace/tools/computer-use.sh`
- **Screenshots:** `/Users/duckets/.openclaw/workspace/screenshots/`

### Verify Setup:
```bash
# Check LM Studio is running
curl http://100.116.54.125:1234/v1/models | grep ui-tars

# Check tools are installed
which scrot xdotool

# Test screenshot
scrot /tmp/test.png && ls -lh /tmp/test.png
```

---

## 🚨 Limitations

| Limitation | Details | Workaround |
|------------|---------|------------|
| **X11 Only** | Requires X Window System | Not compatible with Wayland by default |
| **Active Display** | Needs unlocked desktop session | Won't work when user is away |
| **Accuracy** | ~80-90% on clear UI elements | Verify with follow-up screenshots |
| **Desktop Only** | No mobile support | Use `android-engineer` for mobile |
| **Speed** | Vision analysis takes 5-15 seconds | Use for complex tasks, not simple clicks |

---

## 🔧 Troubleshooting

### Issue: "Cannot open display"
**Cause:** DISPLAY environment variable not set  
**Fix:**
```bash
export DISPLAY=:0  # or :1, check with `echo $DISPLAY`
```

### Issue: "UI-TARS not responding"
**Cause:** LM Studio not running or model not loaded  
**Fix:**
```bash
# Check LM Studio
curl http://100.116.54.125:1234/v1/models

# Should show: ui-tars-1.5-7b, ui-tars-7b-dpo
```

### Issue: "Screenshots are black"
**Cause:** No active window or display is locked  
**Fix:**
- Ensure desktop session is active (not locked)
- Check DISPLAY variable: `echo $DISPLAY`
- Try: `scrot /tmp/test.png` manually

### Issue: "xdotool commands fail"
**Cause:** X11 display issue or window manager problem  
**Fix:**
```bash
# Test xdotool
xdotool getmouselocation

# Should return: x y screen window
```

### Issue: "UI-TARS gives wrong coordinates"
**Cause:** Vision model misidentified UI element  
**Fix:**
- Use `analyze` first to understand the screen
- Break complex tasks into smaller steps
- Verify with screenshot after each action

---

## 📝 Best Practices

1. **Analyze First:** Always start with `analyze` to understand the screen
2. **Verify Actions:** Take screenshots before/after to confirm success
3. **Small Steps:** Break complex workflows into individual actions
4. **Error Handling:** Check for success after each step
5. **Use Browser Tool:** Prefer browser tool for web automation when available
6. **Document:** Log what actions were taken for debugging

---

## 🧪 Testing

### Quick Test:
```bash
# Test screenshot + analysis
./tools/computer-use.sh analyze

# Test mouse control
./tools/computer-use.sh move 500 300
./tools/computer-use.sh click 500 300

# Test keyboard
./tools/computer-use.sh type "Test"
./tools/computer-use.sh press Enter
```

### Full Test:
```bash
# Autonomous action test
./tools/computer-use.sh auto "Click the close button"
```

---

## 🔗 Related Skills

| Skill | Purpose | When to Use |
|-------|---------|-------------|
| `android-engineer` | Android device control | Mobile tasks, ADB |
| `browser` (tool) | Web browser automation | Web tasks (when available) |
| `openplanter` | Research/investigation | Deep research tasks |

---

## 📚 References

- **UI-TARS Model:** https://github.com/bytedance/UI-TARS
- **scrot:** https://github.com/dreamer/scrot
- **xdotool:** https://github.com/jordansissel/xdotool
- **LM Studio:** https://lmstudio.ai/

---

**Status:** ✅ Operational  
**Last Updated:** 2026-02-26  
**Tested:** UI-TARS vision working, scrot + xdotool installed
