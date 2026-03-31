# Duck Agent Desktop — SPEC.md

**Last Updated:** 2026-03-31

## Overview

Duck Agent Desktop is a React-based desktop UI for DuckBot, powered by OpenClaw Gateway. It features a dark shell design with AI agent panels, gateway status, and generative UI via **Pretext Canvas**.

---

## 🎨 Pretext Canvas Integration (2026-03-31)

**What:** Character-level canvas rendering where AI controls every pixel via pretext. Pretext measures layout → Canvas renders.

**Source Toolkit:** `~/Desktop/Pretext-Generative-UI-Toolkit/`

### Architecture

```
Pretext (measures text) → Canvas 2D (renders pixels)
```

**Key API:**
```ts
import { prepare, layout, prepareWithSegments, layoutWithLines } from '@chenglou/pretext'
const prepared = prepare(text, '16px Inter')
const { height } = layout(prepared, 400, 22) // ~0.09ms, no DOM!
```

### Package Dependency

```json
"dependencies": {
  "@chenglou/pretext": "^0.1.0"
}
```

---

## Panels

| Panel | File | Description |
|-------|------|-------------|
| Chat | `panels/chat-panel.tsx` | Standard WebSocket chat |
| **ChatCanvas** | `panels/ChatCanvas.tsx` | **Pretext streaming messages** |
| KAIROS | `panels/kairos-panel.tsx` | Time series view |
| Council | `panels/council-panel.tsx` | AI Council deliberation |
| **CouncilCanvas** | `panels/CouncilCanvas.tsx` | **Canvas-rendered council + votes** |
| Mesh | `panels/mesh-panel.tsx` | Agent mesh visualization |
| RL Status | `panels/rl-panel.tsx` | Reinforcement learning |
| **MetricsCanvas** | `panels/MetricsCanvas.tsx` | **Animated metrics via Canvas** |
| Settings | `panels/settings-panel.tsx` | App configuration |

---

## Pretext Components

### Core Files

| File | Purpose |
|------|---------|
| `PretextCanvasRenderer.tsx` | Main canvas renderer — messages, votes, consensus meter |
| `StreamingMessage.tsx` | Pretext-powered streaming text with pre-measured layout |
| `src/pretext/PretextCanvas.tsx` | Text measurement hook + canvas rendering |
| `src/pretext/PretextLayout.tsx` | Flex, Grid, Masonry, Adaptive layouts |
| `src/pretext/PretextStream.tsx` | Streaming text hook + components |
| `src/pretext/SceneEngine.ts` | Scene graph, motion, template scenes |
| `src/components/CanvasRenderer.tsx` | Wraps PretextCanvasRenderer + AnimatedMetricsCanvas |

### Pretext Features Used

- **Character-level text measurement** — no DOM reflow
- **Pre-measured streaming** — heights calculated before content appears
- **Canvas 2D rendering** — GPU-accelerated, pixel-perfect
- **Animated metric cards** — requestAnimationFrame at 60fps
- **Vote visualization** — bar charts rendered on canvas
- **Consensus meter** — gradient progress bar with glow

### Scene Templates (from SceneEngine.ts)

- `weather` — Animated weather card with pulsing temperature
- `crypto` — Price display with gradient backgrounds
- `orbit` — Orbiting text nodes
- `council` — Consensus visualization
- `plant` — Health metrics with VPD
- `osrs` — RS3 price display
- `glass` — Apple-inspired liquid glass UI

---

## Canvas Panels

### ChatCanvas

- Uses `StreamingMessage` for pretext-powered streaming
- Canvas avatar rendering (no DOM avatars)
- Smooth text streaming without layout shift
- Real-time character-by-character rendering

### CouncilCanvas

- Uses `PretextCanvasRenderer` for full council visualization
- Canvas-rendered councilor messages
- Vote panel with bar charts
- Consensus meter with gradient fill
- Glow effects for streaming messages

### MetricsCanvas

- `AnimatedMetricsCanvas` component — 60fps metric cards
- Animated sparkline charts
- Agent status grid with pulse indicators
- System info display (FPS, text measure speed)

---

## Build & Run

```bash
cd /Users/duckets/Desktop/DuckCLI-Project/src/ui/desktop

# Install dependencies (includes @chenglou/pretext)
npm install

# Development
npm run dev

# Production build
npm run build
```

---

## Tech Stack

- **React 19** + TypeScript
- **Vite 6** — build tooling
- **Tailwind CSS 3** — styling
- **@chenglou/pretext** — text measurement
- **Canvas 2D** — generative rendering
- **WebSocket** — gateway communication

---

## Navigation

New canvas panels added to sidebar:

| ID | Label | Icon | File |
|----|-------|------|------|
| `chat-canvas` | Canvas | 🎨 | `ChatCanvas.tsx` |
| `council-canvas` | C-Canvas | ⚖️ | `CouncilCanvas.tsx` |
| `metrics-canvas` | Metrics | 📊 | `MetricsCanvas.tsx` |

---

## Files Structure

```
src/ui/desktop/src/
├── App.tsx                    # Entry point
├── PretextCanvasRenderer.tsx  # AI Council canvas renderer (copied from toolkit)
├── StreamingMessage.tsx       # Pretext streaming (copied from toolkit)
├── panels/
│   ├── main-view.tsx          # Shell with nav + canvas panel routing
│   ├── ChatCanvas.tsx         # Pretext-powered chat streaming
│   ├── CouncilCanvas.tsx      # Canvas-rendered AI council
│   └── MetricsCanvas.tsx      # Animated live metrics
├── components/
│   ├── CanvasRenderer.tsx     # AnimatedMetricsCanvas wrapper
│   ├── duck-button.tsx
│   ├── duck-card.tsx
│   ├── duck-input.tsx
│   ├── duck-modal.tsx
│   ├── duck-modal.tsx
│   ├── vote-panel.tsx
│   ├── councilor-badge.tsx
│   ├── status-indicator.tsx
│   └── toast.tsx
└── pretext/                   # Full Pretext toolkit
    ├── PretextCanvas.tsx
    ├── PretextLayout.tsx
    ├── PretextStream.tsx
    ├── SceneEngine.ts
    └── index.ts
```
