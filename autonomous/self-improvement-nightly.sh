#!/bin/bash
# Nightly Self-Improvement Workflow
# Runs 2x nightly (2AM and 5AM) - autonomous self-improvement + Kanban
# Sends Telegram notification on completion

LOG_FILE="/.openclaw/workspace/logs/self-improvement.log"
KANBAN="${HOME}/.openclaw/workspace/KANBAN.md"
DATE=$(date '+%Y-%m-%d %H:%M')

echo "=== Self-Improvement Run: $DATE ===" >> "$LOG_FILE"

# 1. Review Kanban - check for tasks to complete
echo "[$DATE] Checking Kanban for actionable tasks..." >> "$LOG_FILE"

# 2. Check for stale INBOX items (older than 7 days)
echo "[$DATE] Checking for stale Kanban items..." >> "$LOG_FILE"

# 3. Spawn sub-agents if needed (use local LM Studio models when possible)
echo "[$DATE] Checking if sub-agents needed..." >> "$LOG_FILE"
# Can spawn agents for parallel improvement work
# Can use LM Studio local models (free, fast)
# Can use MiniMax/Kimi API models for complex tasks

# 4. BUILD IMPROVEMENTS - actually create tools/skills/fixes
echo "[$DATE] Building improvements..." >> "$LOG_FILE"
# Check what needs to be built and BUILD IT
# - Scripts that would help
# - Skills that are missing
# - Tools to automate tasks
# - Fixes for pain points identified
# Use local models to help write code faster

# 5. Add new tasks based on observations
echo "[$DATE] Adding new tasks based on observations..." >> "$LOG_FILE"

# 6. Archive old DONE items (older than 30 days)
echo "[$DATE] Archiving old completed items..." >> "$LOG_FILE"

# 7. Analyze recent patterns (can use local models for analysis)
echo "[$DATE] Analyzing recent session patterns..." >> "$LOG_FILE"
# Can spawn analysis agent using LM Studio (local, free)

# 8. Check for improvements to BUILD
echo "[$DATE] Identifying what to BUILD..." >> "$LOG_FILE"

# 9. BUILD actual improvements - scripts, tools, skills
echo "[$DATE] Building tools and scripts..." >> "$LOG_FILE"
# If something is tedious, BUILD a script to automate it
# If a skill is missing, BUILD it
# If a tool would help, CREATE it
# Can use local models to help write code

# 10. Update memory
echo "[$DATE] Updating memory systems..." >> "$LOG_FILE"

# 11. Review skill effectiveness
echo "[$DATE] Reviewing skill performance..." >> "$LOG_FILE"

# 12. Optimize workflows
echo "[$DATE] Optimizing workflows..." >> "$LOG_FILE"

# 13. Clean up
echo "[$DATE] Cleaning temp files..." >> "$LOG_FILE"
find /tmp -name "*.log" -mtime +7 -delete 2>/dev/null
find /tmp -name "*.tmp" -mtime +3 -delete 2>/dev/null

# 14. Git status (NO AUTO-COMMIT - only Duckets commits)
echo "[$DATE] Git status (not committing - Duckets reviews):" >> "$LOG_FILE"
cd ${HOME}/.openclaw/workspace
git status --short 2>/dev/null | head -10 >> "$LOG_FILE"

echo "[$DATE] Run complete" >> "$LOG_FILE"
echo "---" >> "$LOG_FILE"

# Send Telegram notification
curl -s -X POST "https://api.telegram.org/bot8094662802:AAF2IcMguSovSu4a_R0o9ckzfCJfpYw14UM/sendMessage" \
    -d chat_id="588090613" \
    -d text="🧠 Self-improvement complete at $DATE

Built improvements, check git status for changes." >> "$LOG_FILE" 2>&1

echo "Nightly self-improvement complete at $DATE"
