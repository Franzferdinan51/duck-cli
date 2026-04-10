#!/usr/bin/env bash
# Quick MiniMax text chat via mmx-cli
set -e
PROMPT="${1:-"Hello, what's up?"}"
mmx text chat --message "$PROMPT"
