# Termux Skill — duck-cli Native Android Integration

**Purpose:** Execute commands and manage the phone via Termux from duck-cli
**Use when:** Controlling Android phone from Mac/Linux/Windows where duck-cli runs

## Quick Start

```bash
# Check Termux status
duck termux status

# Run a command in Termux
duck termux exec "ls -la"

# Install a package
duck termux install nodejs git

# Clone and setup a repo
duck termux clone https://github.com/user/repo.git

# Start a service
duck termux service start duck
```

## Architecture

```
duck-cli (Mac/Linux/Windows)
    ↓ ADB
Android Phone (ZT4227P8NK)
    ↓
Termux App ← Termux:API broadcasts
    ↓
Full Termux environment (bash, pkg, git, node)
```

## Termux API Method (Primary)

**Format:** `am broadcast -a com.termux.api.ACTION_RUN_COMMAND -e com.termux.api.EXTRA_COMMAND '<cmd>' com.termux.api/.TermuxAPIReceiver`

**Available Termux:API methods:**
- `ACTION_RUN_COMMAND` — Run shell commands
- `ACTION_SETTINGS` — Open Termux settings
- `ACTION_HELP` — Get help

**Example:**
```bash
adb shell am broadcast -a com.termux.api.ACTION_RUN_COMMAND \
  -e com.termux.api.EXTRA_COMMAND 'ls -la' \
  com.termux.api/.TermuxAPIReceiver
```

**Limitation:** Runs in restricted context, not full Termux environment.

## RUN_COMMAND Intent (Requires allow-external-apps)

**Format:** `am startservice -a com.termux.RUN_COMMAND`

**Extras:**
- `--es com.termux.RUN_COMMAND_PATH '<path>'` — Command to run
- `--esa com.termux.RUN_COMMAND_ARGUMENTS '<args>'` — Arguments
- `--es com.termux.RUN_COMMAND_WORKDIR '<dir>'` — Working directory
- `--ez com.termux.RUN_COMMAND_BACKGROUND 'true/false'` — Foreground/background

**Requirements:**
1. Termux app must have `allow-external-apps=true` in `~/.termux/termux.properties`
2. Caller needs `com.termux.permission.RUN_COMMAND` permission

## Termux Boot Method

Scripts in `~/.termux/boot/` execute on device boot.

## Termux Tasker Method

With `com.termux.tasker` installed, use:
```bash
am broadcast -a com.termux.tasker.EXECUTE \
  -e com.termux.tasker.EXTRA_COMMAND '<cmd>' \
  com.termux.tasker/.PluginReceiver
```

## Configuration

**Phone serial:** `ZT4227P8NK` (Moto G Play 2026)
**ADB port:** Dynamic — verify with `adb devices -l`

## Status

✅ Termux:API installed (com.termux.api)
✅ Termux Boot installed (com.termux.boot)
✅ Termux Tasker installed (com.termux.tasker)
⚠️ allow-external-apps not set (user action required)
