#!/usr/bin/env bash
# Check mmx-cli install and auth status
set -e

echo "🔍 Checking mmx-cli..."
if ! command -v mmx &> /dev/null; then
  echo "❌ mmx-cli not installed"
  echo "   Install: npm install -g mmx-cli"
  exit 1
fi

echo "✅ mmx-cli installed"
echo ""
mmx auth status || echo "⚠️  mmx auth status failed — run: mmx auth login --api-key <key>"
