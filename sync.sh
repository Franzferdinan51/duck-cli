#!/bin/bash
# Duck CLI - Quick Sync Script
# Usage: ./sync.sh "commit message"

cd "${DUCK_CLI_DIR:-$HOME/.openclaw/workspace/duck-cli-src}"

MSG="${1:-Auto-sync $(date '+%Y-%m-%d %H:%M')}"

echo "🔄 Syncing Duck CLI..."
echo ""

# Check for changes
if git diff --quiet && git diff --cached --quiet; then
    echo "✅ No changes to commit"
else
    echo "📝 Committing changes..."
    git add -A
    git commit -m "$MSG"
    echo ""
fi

# Pull latest from submodules
echo "📦 Updating submodules..."
git submodule update --remote --merge 2>/dev/null || echo "  (no submodules changed)"

# Push
echo "🚀 Pushing to GitHub..."
git push origin main 2>&1

echo ""
echo "✅ Done! https://github.com/Franzferdinan51/duck-cli"
