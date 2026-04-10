#!/usr/bin/env bash
# Quick MiniMax image generation via mmx-cli
set -e
PROMPT="${1:-"A cute robot reading a book"}"
mmx image "$PROMPT"
