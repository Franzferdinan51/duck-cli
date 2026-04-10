---
name: mmx-cli
description: "MiniMax AI Platform CLI integration for text, image, video, speech, music, vision, and search"
triggers:
  - "/mmx"
  - "minimax"
  - "generate image"
  - "generate speech"
  - "generate music"
  - "generate video"
  - "minimax search"
  - "vision analysis"
bins:
  - mmx
  - node
env:
  MINIMAX_API_KEY: "Optional if already authenticated via mmx auth"
---

# 🚀 MiniMax CLI Skill

Official MiniMax AI Platform CLI wrapper for duck-cli.

## What It Does

Provides quick access to MiniMax's full multimodal API:
- 📝 **Text generation** — chat, completion
- 🖼️ **Image generation** — text-to-image, image-to-image
- 🎤 **Speech** — TTS, voice cloning, voice design
- 🎵 **Music** — song generation, instrumentals
- 🎬 **Video** — text-to-video, image-to-video
- 👁️ **Vision** — image understanding, OCR, analysis
- 🔍 **Search** — web search via MiniMax

## Shell Commands

Inside `duck shell`, type:
```
/mmx image "cyberpunk cat with neon wings"
/mmx text chat --message "Explain quantum computing"
/mmx speech synthesize --text "Hello world" --out hello.mp3
/mmx vision ./photo.jpg
/mmx search "latest AI news"
/mmx quota
```

## CLI Commands

```bash
# Text
duck mmx text chat --message "Hello"

# Image
duck mmx image "A futuristic city at sunset"

# Speech
duck mmx speech synthesize --text "Welcome" --out welcome.mp3

# Music
duck mmx music generate --prompt "Upbeat electronic track" --out track.mp3

# Video
duck mmx video generate --prompt "Ocean waves at dawn" --async

# Vision
duck mmx vision photo.jpg

# Search
duck mmx search "MiniMax AI latest updates"

# Quota
duck mmx quota

# Auth
duck mmx auth login --api-key YOUR_KEY
duck mmx auth status
```

## Agent Tools

When MiniMax tools are available to the agent, it can invoke:
- `mmx_text` — Generate text/chat responses
- `mmx_image` — Generate images from prompts
- `mmx_vision` — Analyze images
- `mmx_search` — Web search
- `mmx_status` — Check quota and auth status

## Quick Scripts

- `scripts/mmx-chat.sh "prompt"` — quick text chat
- `scripts/mmx-image.sh "prompt"` — quick image generation
- `scripts/mmx-status.sh` — check mmx-cli install + auth
